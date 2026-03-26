"""Routes for Smallest AI (Waves) integration.

Proxies requests to Smallest AI cloud APIs for:
- Text-to-Speech (Lightning v3.1) — 15 languages, 80+ voices, ~100ms latency
- Speech-to-Text (Pulse) — 39 languages, speaker diarization, emotion detection
"""

import logging
import os
import subprocess
import tempfile
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/smallest", tags=["smallest"])

SMALLEST_TIMEOUT = 120  # seconds


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def _get_smallest_api_key(request: Request | None = None) -> str:
    """Resolve the Smallest AI API key.

    Priority:
    1. X-Smallest-Api-Key header (passed from the frontend / Settings page)
    2. OPENCUTAI_SMALLEST_API_KEY environment variable
    """
    if request is not None:
        header_key = request.headers.get("x-smallest-api-key", "").strip()
        if header_key:
            return header_key
    return settings.SMALLEST_API_KEY


def _smallest_headers(request: Request | None = None) -> dict:
    """Return authentication headers for Smallest AI API calls."""
    api_key = _get_smallest_api_key(request)
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Smallest AI API key is not configured. "
            "Add your key in Settings > API Keys, or set OPENCUTAI_SMALLEST_API_KEY in your environment.",
        )
    return {"Authorization": f"Bearer {api_key}"}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class SmallestTTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize (max ~250 chars per chunk)", max_length=5000)
    voice_id: str = Field(default="emily", description="Voice identifier from Smallest AI catalog")
    sample_rate: int = Field(default=24000, description="Audio sample rate in Hz (8000, 16000, 24000, 44100)")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech rate multiplier")
    language: str = Field(default="auto", description="Language code (en, hi, es, ta, auto)")
    output_format: str = Field(default="mp3", description="Output format (pcm, wav, mp3, mulaw)")


# ---------------------------------------------------------------------------
# Text-to-Speech (Lightning v3.1)
# ---------------------------------------------------------------------------

CHUNK_SIZE = 240  # chars — Smallest recommends max ~250


def _chunk_text(text: str, max_chars: int = CHUNK_SIZE) -> list[str]:
    """Split text into chunks suitable for the Lightning API.

    Tries to break at sentence boundaries, then at word boundaries.
    """
    if len(text) <= max_chars:
        return [text]

    import re
    # Split at sentence boundaries first
    sentences = re.split(r'(?<=[.!?।])\s+', text)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        if len(current) + len(sentence) + 1 <= max_chars:
            current = f"{current} {sentence}".strip() if current else sentence
        else:
            if current:
                chunks.append(current)
            # If a single sentence exceeds max_chars, split at word boundary
            if len(sentence) > max_chars:
                words = sentence.split()
                current = ""
                for word in words:
                    if len(current) + len(word) + 1 <= max_chars:
                        current = f"{current} {word}".strip() if current else word
                    else:
                        if current:
                            chunks.append(current)
                        current = word
            else:
                current = sentence

    if current:
        chunks.append(current)

    return chunks


@router.post("/tts")
async def smallest_tts(body: SmallestTTSRequest, request: Request):
    """Generate speech audio using Smallest AI Lightning v3.1 TTS.

    Supports 15 languages with 80+ voices. For long text, auto-chunks and
    concatenates audio. Returns audio as a binary response.
    """
    headers = _smallest_headers(request)
    headers["Content-Type"] = "application/json"

    chunks = _chunk_text(body.text)
    audio_parts: list[bytes] = []

    for chunk in chunks:
        payload = {
            "text": chunk,
            "voice_id": body.voice_id,
            "sample_rate": body.sample_rate,
            "speed": body.speed,
            "language": body.language,
            "output_format": body.output_format,
        }

        try:
            async with httpx.AsyncClient(timeout=SMALLEST_TIMEOUT) as client:
                resp = await client.post(
                    f"{settings.SMALLEST_API_BASE_URL}/lightning-v3.1/get_speech",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                audio_parts.append(resp.content)
        except httpx.HTTPStatusError as e:
            detail = e.response.text if e.response else str(e)
            logger.error("Smallest TTS error (chunk): %s", detail)
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Smallest AI API key.")
            if e.response.status_code == 429:
                raise HTTPException(status_code=429, detail="Smallest AI rate limit exceeded. Try again shortly.")
            raise HTTPException(status_code=502, detail=f"Smallest TTS error: {detail}")
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Cannot connect to Smallest AI API.")

    # Concatenate audio parts
    if len(audio_parts) == 1:
        combined_audio = audio_parts[0]
    else:
        # For multi-chunk, concatenate using ffmpeg for proper audio joining
        with tempfile.TemporaryDirectory() as tmpdir:
            list_path = os.path.join(tmpdir, "files.txt")
            part_paths = []
            for i, part in enumerate(audio_parts):
                part_path = os.path.join(tmpdir, f"part_{i}.{body.output_format}")
                with open(part_path, "wb") as f:
                    f.write(part)
                part_paths.append(part_path)

            # Write ffmpeg concat list
            with open(list_path, "w") as f:
                for p in part_paths:
                    f.write(f"file '{p}'\n")

            output_path = os.path.join(tmpdir, f"combined.{body.output_format}")
            try:
                subprocess.run(
                    [
                        "ffmpeg", "-f", "concat", "-safe", "0",
                        "-i", list_path, "-c", "copy",
                        output_path, "-y",
                    ],
                    check=True,
                    capture_output=True,
                )
                with open(output_path, "rb") as f:
                    combined_audio = f.read()
            except subprocess.CalledProcessError:
                # Fallback: just concatenate raw bytes
                combined_audio = b"".join(audio_parts)

    codec_to_mime = {
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "pcm": "audio/pcm",
        "mulaw": "audio/basic",
    }
    mime_type = codec_to_mime.get(body.output_format, "audio/mpeg")

    return Response(
        content=combined_audio,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="smallest_tts.{body.output_format}"',
        },
    )


# ---------------------------------------------------------------------------
# Speech-to-Text (Pulse)
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".aac", ".ogg", ".opus", ".flac", ".m4a", ".mp4", ".webm", ".mov", ".mkv", ".avi"}


@router.post("/transcribe")
async def smallest_transcribe(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form(default="en"),
):
    """Transcribe audio using Smallest AI Pulse STT.

    Accepts audio/video files. For video files, audio is extracted first.
    For files longer than 60 seconds, audio is chunked.

    Returns a transcription result compatible with the OpenCut format.
    """
    headers = _smallest_headers(request)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: {sorted(ALLOWED_EXTENSIONS)}",
        )

    file_data = await file.read()
    content_type = file.content_type or "audio/wav"

    # For video files, extract audio first
    video_extensions = {".mp4", ".webm", ".mkv", ".avi", ".mov"}
    audio_data = file_data
    audio_content_type = content_type

    if ext in video_extensions:
        upload_id = uuid.uuid4().hex[:8]
        with tempfile.TemporaryDirectory() as tmpdir:
            video_path = os.path.join(tmpdir, f"video_{upload_id}{ext}")
            audio_path = os.path.join(tmpdir, f"audio_{upload_id}.wav")

            with open(video_path, "wb") as f:
                f.write(file_data)

            try:
                subprocess.run(
                    [
                        "ffmpeg", "-i", video_path,
                        "-vn", "-acodec", "pcm_s16le",
                        "-ar", "16000", "-ac", "1",
                        audio_path, "-y",
                    ],
                    check=True,
                    capture_output=True,
                )
            except subprocess.CalledProcessError as e:
                logger.error("ffmpeg audio extraction failed: %s", e.stderr)
                raise HTTPException(status_code=500, detail="Failed to extract audio from video.")

            with open(audio_path, "rb") as f:
                audio_data = f.read()
            audio_content_type = "audio/wav"

    # Chunk audio and transcribe
    all_transcripts: list[dict] = []

    with tempfile.TemporaryDirectory() as tmpdir:
        full_audio_path = os.path.join(tmpdir, "full_audio.wav")

        # Convert to WAV for consistent processing
        temp_input = os.path.join(tmpdir, f"input{ext}")
        with open(temp_input, "wb") as f:
            f.write(audio_data)

        try:
            subprocess.run(
                [
                    "ffmpeg", "-i", temp_input,
                    "-acodec", "pcm_s16le",
                    "-ar", "16000", "-ac", "1",
                    full_audio_path, "-y",
                ],
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError:
            # If conversion fails, use as-is
            full_audio_path = temp_input

        # Get audio duration
        try:
            duration_result = subprocess.run(
                [
                    "ffprobe", "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    full_audio_path,
                ],
                capture_output=True, text=True, check=True,
            )
            total_duration = float(duration_result.stdout.strip())
        except Exception:
            total_duration = 60.0

        chunk_duration = 60.0  # Pulse can handle longer chunks
        num_chunks = max(1, int((total_duration + chunk_duration - 1) / chunk_duration))

        for chunk_idx in range(num_chunks):
            start_time = chunk_idx * chunk_duration

            if num_chunks > 1:
                chunk_path = os.path.join(tmpdir, f"chunk_{chunk_idx}.wav")
                try:
                    subprocess.run(
                        [
                            "ffmpeg", "-i", full_audio_path,
                            "-ss", str(start_time),
                            "-t", str(chunk_duration),
                            "-acodec", "pcm_s16le",
                            "-ar", "16000", "-ac", "1",
                            chunk_path, "-y",
                        ],
                        check=True, capture_output=True,
                    )
                except subprocess.CalledProcessError:
                    logger.warning("Failed to extract chunk %d, skipping", chunk_idx)
                    continue

                with open(chunk_path, "rb") as f:
                    chunk_data = f.read()
            else:
                with open(full_audio_path, "rb") as f:
                    chunk_data = f.read()

            # Send to Smallest AI Pulse API
            try:
                async with httpx.AsyncClient(timeout=SMALLEST_TIMEOUT) as client:
                    resp = await client.post(
                        f"{settings.SMALLEST_API_BASE_URL}/pulse/get_text",
                        params={"language": language},
                        headers={
                            **headers,
                            "Content-Type": "audio/wav",
                        },
                        content=chunk_data,
                    )
                    resp.raise_for_status()
                    result = resp.json()

                    transcript_text = result.get("transcription", "")
                    if transcript_text.strip():
                        all_transcripts.append({
                            "text": transcript_text.strip(),
                            "start": start_time,
                        })

            except httpx.HTTPStatusError as e:
                detail = e.response.text if e.response else str(e)
                logger.error("Smallest STT error (chunk %d): %s", chunk_idx, detail)
                if e.response.status_code == 401:
                    raise HTTPException(status_code=401, detail="Invalid Smallest AI API key.")
                if e.response.status_code == 429:
                    raise HTTPException(status_code=429, detail="Smallest AI rate limit exceeded. Try again shortly.")
                raise HTTPException(status_code=502, detail=f"Smallest STT error: {detail}")
            except httpx.ConnectError:
                raise HTTPException(status_code=503, detail="Cannot connect to Smallest AI API.")

    # Build OpenCut-compatible response
    import re

    segments = []
    full_text_parts = []
    seg_id = 0

    for idx, chunk in enumerate(all_transcripts):
        chunk_end = (
            all_transcripts[idx + 1]["start"]
            if idx + 1 < len(all_transcripts)
            else chunk["start"] + chunk_duration
        )
        chunk_end = min(chunk_end, total_duration)
        chunk_start = chunk["start"]
        chunk_text = chunk["text"].strip()

        if not chunk_text:
            continue

        full_text_parts.append(chunk_text)

        # Split into sentences for subtitle segments
        raw_sentences = re.split(r'(?<=[.!?;])\s+', chunk_text)
        sentences: list[str] = []
        for sent in raw_sentences:
            words_in_sent = sent.split()
            if len(words_in_sent) > 12:
                sub = re.split(r'(?<=[,;])\s+', sent)
                sentences.extend(sub)
            else:
                sentences.append(sent)
        sentences = [s.strip() for s in sentences if s.strip()]

        if not sentences:
            sentences = [chunk_text]

        # Split long sentences into ~4-word groups
        final_sentences: list[str] = []
        for sent in sentences:
            w = sent.split()
            if len(w) > 6:
                group_size = 4
                for i in range(0, len(w), group_size):
                    final_sentences.append(" ".join(w[i:i + group_size]))
            else:
                final_sentences.append(sent)
        sentences = [s for s in final_sentences if s.strip()]

        # Distribute time proportionally by word count
        total_words = sum(len(s.split()) for s in sentences)
        chunk_dur = chunk_end - chunk_start
        cursor = chunk_start

        for sent in sentences:
            n_words = len(sent.split())
            sent_duration = max(0.5, (n_words / max(total_words, 1)) * chunk_dur)
            sent_end = min(cursor + sent_duration, chunk_end)

            word_list = sent.split()
            wd = sent_duration / max(len(word_list), 1)
            words = []
            for w_idx, word in enumerate(word_list):
                words.append({
                    "word": word,
                    "start": round(cursor + w_idx * wd, 3),
                    "end": round(cursor + (w_idx + 1) * wd, 3),
                    "confidence": 0.9,
                })

            segments.append({
                "id": seg_id,
                "text": sent,
                "start": round(cursor, 3),
                "end": round(sent_end, 3),
                "words": words,
                "avg_logprob": 0.0,
                "no_speech_prob": 0.0,
            })
            seg_id += 1
            cursor = sent_end

    return {
        "text": " ".join(full_text_parts),
        "segments": segments,
        "language": language,
        "duration": round(total_duration, 3),
    }


# ---------------------------------------------------------------------------
# Voice listing
# ---------------------------------------------------------------------------

@router.get("/voices")
async def smallest_voices():
    """Return the catalog of available Smallest AI voices.

    This is a static list derived from the model card. The frontend
    can use this to populate voice selection dropdowns.
    """
    return {
        "voices": SMALLEST_VOICES,
        "languages": SMALLEST_LANGUAGES,
    }


# ---------------------------------------------------------------------------
# Health / status check
# ---------------------------------------------------------------------------

@router.get("/status")
async def smallest_status(request: Request):
    """Check Smallest AI API connectivity and key validity."""
    api_key = _get_smallest_api_key(request)
    if not api_key:
        return {
            "available": False,
            "reason": "API key not configured",
        }

    try:
        headers = _smallest_headers(request)
        headers["Content-Type"] = "application/json"
        async with httpx.AsyncClient(timeout=10) as client:
            # Quick TTS probe with minimal text
            resp = await client.post(
                f"{settings.SMALLEST_API_BASE_URL}/lightning-v3.1/get_speech",
                headers=headers,
                json={
                    "text": "hi",
                    "voice_id": "emily",
                    "sample_rate": 8000,
                    "output_format": "pcm",
                },
            )
            if resp.status_code == 401:
                return {"available": False, "reason": "Invalid API key"}
            if resp.status_code == 200:
                return {"available": True}
            return {"available": False, "reason": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"available": False, "reason": str(e)}


# ---------------------------------------------------------------------------
# Static voice & language catalogs (from Lightning v3.1 model card)
# ---------------------------------------------------------------------------

SMALLEST_LANGUAGES = [
    {"code": "en", "name": "English", "status": "stable"},
    {"code": "hi", "name": "Hindi", "status": "stable"},
    {"code": "es", "name": "Spanish", "status": "stable"},
    {"code": "ta", "name": "Tamil", "status": "stable"},
    {"code": "kn", "name": "Kannada", "status": "stable"},
    {"code": "te", "name": "Telugu", "status": "stable"},
    {"code": "ml", "name": "Malayalam", "status": "stable"},
    {"code": "mr", "name": "Marathi", "status": "stable"},
    {"code": "gu", "name": "Gujarati", "status": "stable"},
    {"code": "fr", "name": "French", "status": "beta"},
    {"code": "it", "name": "Italian", "status": "beta"},
    {"code": "nl", "name": "Dutch", "status": "beta"},
    {"code": "sv", "name": "Swedish", "status": "beta"},
    {"code": "pt", "name": "Portuguese", "status": "beta"},
    {"code": "de", "name": "German", "status": "beta"},
]

SMALLEST_VOICES = [
    # English (US)
    {"id": "emily", "name": "Emily", "language": "en", "gender": "female"},
    {"id": "jasmine", "name": "Jasmine", "language": "en", "gender": "female"},
    {"id": "arman", "name": "Arman", "language": "en", "gender": "male"},
    {"id": "quinn", "name": "Quinn", "language": "en", "gender": "female"},
    {"id": "mia", "name": "Mia", "language": "en", "gender": "female"},
    {"id": "magnus", "name": "Magnus", "language": "en", "gender": "male"},
    {"id": "olivia", "name": "Olivia", "language": "en", "gender": "female"},
    {"id": "daniel", "name": "Daniel", "language": "en", "gender": "male"},
    {"id": "rachel", "name": "Rachel", "language": "en", "gender": "female"},
    {"id": "nicole", "name": "Nicole", "language": "en", "gender": "female"},
    {"id": "elizabeth", "name": "Elizabeth", "language": "en", "gender": "female"},
    # Hindi / English
    {"id": "neel", "name": "Neel", "language": "hi", "gender": "male"},
    {"id": "maithili", "name": "Maithili", "language": "hi", "gender": "female"},
    {"id": "devansh", "name": "Devansh", "language": "hi", "gender": "male"},
    {"id": "sameera", "name": "Sameera", "language": "hi", "gender": "female"},
    {"id": "mihir", "name": "Mihir", "language": "hi", "gender": "male"},
    {"id": "aarush", "name": "Aarush", "language": "hi", "gender": "male"},
    {"id": "sakshi", "name": "Sakshi", "language": "hi", "gender": "female"},
    {"id": "vivaan", "name": "Vivaan", "language": "hi", "gender": "male"},
    {"id": "srishti", "name": "Srishti", "language": "hi", "gender": "female"},
    # Spanish
    {"id": "daniella", "name": "Daniella", "language": "es", "gender": "female"},
    {"id": "sandra", "name": "Sandra", "language": "es", "gender": "female"},
    {"id": "carlos", "name": "Carlos", "language": "es", "gender": "male"},
    {"id": "jose", "name": "Jose", "language": "es", "gender": "male"},
    {"id": "luis", "name": "Luis", "language": "es", "gender": "male"},
    {"id": "mariana", "name": "Mariana", "language": "es", "gender": "female"},
    {"id": "miguel", "name": "Miguel", "language": "es", "gender": "male"},
    # Tamil
    {"id": "tamil_male_1", "name": "Tamil Male", "language": "ta", "gender": "male"},
    {"id": "tamil_female_1", "name": "Tamil Female", "language": "ta", "gender": "female"},
    # Telugu
    {"id": "telugu_male_1", "name": "Telugu Male", "language": "te", "gender": "male"},
    {"id": "telugu_female_1", "name": "Telugu Female", "language": "te", "gender": "female"},
    # Malayalam
    {"id": "malayalam_male_1", "name": "Malayalam Male", "language": "ml", "gender": "male"},
    {"id": "malayalam_female_1", "name": "Malayalam Female", "language": "ml", "gender": "female"},
    # Marathi
    {"id": "marathi_male_1", "name": "Marathi Male", "language": "mr", "gender": "male"},
    {"id": "marathi_female_1", "name": "Marathi Female", "language": "mr", "gender": "female"},
    # Gujarati
    {"id": "gujarati_male_1", "name": "Gujarati Male", "language": "gu", "gender": "male"},
    {"id": "gujarati_female_1", "name": "Gujarati Female", "language": "gu", "gender": "female"},
    # Kannada
    {"id": "kannada_male_1", "name": "Kannada Male", "language": "kn", "gender": "male"},
    {"id": "kannada_female_1", "name": "Kannada Female", "language": "kn", "gender": "female"},
]

# Pulse STT supported languages (39 total — common ones listed)
SMALLEST_STT_LANGUAGES = [
    {"code": "en", "name": "English"},
    {"code": "hi", "name": "Hindi"},
    {"code": "es", "name": "Spanish"},
    {"code": "fr", "name": "French"},
    {"code": "de", "name": "German"},
    {"code": "it", "name": "Italian"},
    {"code": "pt", "name": "Portuguese"},
    {"code": "nl", "name": "Dutch"},
    {"code": "sv", "name": "Swedish"},
    {"code": "ta", "name": "Tamil"},
    {"code": "te", "name": "Telugu"},
    {"code": "kn", "name": "Kannada"},
    {"code": "ml", "name": "Malayalam"},
    {"code": "mr", "name": "Marathi"},
    {"code": "gu", "name": "Gujarati"},
    {"code": "bn", "name": "Bengali"},
    {"code": "pa", "name": "Punjabi"},
    {"code": "ur", "name": "Urdu"},
    {"code": "ja", "name": "Japanese"},
    {"code": "ko", "name": "Korean"},
    {"code": "zh", "name": "Chinese"},
    {"code": "ar", "name": "Arabic"},
    {"code": "ru", "name": "Russian"},
    {"code": "tr", "name": "Turkish"},
    {"code": "pl", "name": "Polish"},
    {"code": "uk", "name": "Ukrainian"},
    {"code": "cs", "name": "Czech"},
    {"code": "ro", "name": "Romanian"},
    {"code": "th", "name": "Thai"},
    {"code": "vi", "name": "Vietnamese"},
    {"code": "id", "name": "Indonesian"},
    {"code": "ms", "name": "Malay"},
]
