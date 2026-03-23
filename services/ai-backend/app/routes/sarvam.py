"""Routes for Sarvam AI integration.

Proxies requests to Sarvam AI cloud APIs for Indian-language
speech-to-text, translation, text-to-speech, transliteration,
and language detection.
"""

import base64
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

router = APIRouter(prefix="/api/sarvam", tags=["sarvam"])

SARVAM_TIMEOUT = 120  # seconds


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def _get_sarvam_api_key(request: Request | None = None) -> str:
    """Resolve the Sarvam API key.

    Priority:
    1. X-Sarvam-Api-Key header (passed from the frontend / Settings page)
    2. OPENCUTAI_SARVAM_API_KEY environment variable
    """
    if request is not None:
        header_key = request.headers.get("x-sarvam-api-key", "").strip()
        if header_key:
            return header_key
    return settings.SARVAM_API_KEY


def _sarvam_headers(request: Request | None = None) -> dict:
    """Return authentication headers for Sarvam API calls."""
    api_key = _get_sarvam_api_key(request)
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Sarvam API key is not configured. "
            "Add your key in Settings > API Keys, or set OPENCUTAI_SARVAM_API_KEY in your environment.",
        )
    return {"api-subscription-key": api_key}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class SarvamTranslateRequest(BaseModel):
    input: str = Field(..., description="Text to translate", max_length=2000)
    source_language_code: str = Field(..., description="Source language (e.g. hi-IN)")
    target_language_code: str = Field(..., description="Target language (e.g. en-IN)")
    model: str = Field(default="sarvam-translate:v1", description="Translation model")
    mode: str | None = Field(default=None, description="Translation mode (formal, modern-colloquial, etc.)")
    output_script: str | None = Field(default=None, description="Output script (roman, fully-native, spoken-form-in-native)")
    numerals_format: str | None = Field(default=None, description="Numerals format (international, native)")


class SarvamTTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize", max_length=2500)
    target_language_code: str = Field(..., description="Target language (e.g. hi-IN)")
    model: str = Field(default="bulbul:v3", description="TTS model")
    speaker: str = Field(default="shubh", description="Speaker voice ID")
    pace: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech pace")
    speech_sample_rate: int = Field(default=22050, description="Audio sample rate (Hz)")
    output_audio_codec: str = Field(default="mp3", description="Output audio codec")


class SarvamTransliterateRequest(BaseModel):
    input: str = Field(..., description="Text to transliterate", max_length=1000)
    source_language_code: str = Field(..., description="Source language code")
    target_language_code: str = Field(..., description="Target language code")
    spoken_form: bool = Field(default=False, description="Convert to spoken form")
    numerals_format: str = Field(default="international", description="Numerals format")


class SarvamDetectLanguageRequest(BaseModel):
    input: str = Field(..., description="Text to identify", max_length=1000)


# ---------------------------------------------------------------------------
# Speech-to-Text
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".aac", ".ogg", ".opus", ".flac", ".m4a", ".mp4", ".webm", ".mov", ".mkv", ".avi"}


@router.post("/transcribe")
async def sarvam_transcribe(
    request: Request,
    file: UploadFile = File(...),
    language_code: str | None = Form(default=None),
    model: str = Form(default="saaras:v3"),
    mode: str = Form(default="transcribe"),
):
    """Transcribe audio using Sarvam AI Saaras STT model.

    Accepts audio files up to 30 seconds. For longer files, the audio is
    chunked into 30-second segments and transcribed sequentially.

    Returns a transcription result compatible with the existing OpenCut format.
    """
    headers = _sarvam_headers(request)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Sarvam supports: {sorted(ALLOWED_EXTENSIONS)}",
        )

    file_data = await file.read()
    content_type = file.content_type or "audio/wav"

    # For video files, we need to extract audio first
    video_extensions = {".mp4", ".webm", ".mkv", ".avi", ".mov"}
    audio_data = file_data
    audio_filename = file.filename
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
            audio_filename = f"audio_{upload_id}.wav"
            audio_content_type = "audio/wav"

    # Chunk audio if longer than 30 seconds using ffprobe to detect duration
    all_transcripts = []

    with tempfile.TemporaryDirectory() as tmpdir:
        full_audio_path = os.path.join(tmpdir, f"full_audio.{audio_filename.split('.')[-1] if '.' in audio_filename else 'wav'}")
        with open(full_audio_path, "wb") as f:
            f.write(audio_data)

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
            total_duration = 30.0  # Assume within limit if we can't detect

        chunk_duration = 30.0  # Sarvam REST API limit
        num_chunks = max(1, int((total_duration + chunk_duration - 1) / chunk_duration))

        for chunk_idx in range(num_chunks):
            start_time = chunk_idx * chunk_duration

            if num_chunks > 1:
                # Extract chunk using ffmpeg
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
                chunk_filename = f"chunk_{chunk_idx}.wav"
                chunk_content_type = "audio/wav"
            else:
                chunk_data = audio_data
                chunk_filename = audio_filename
                chunk_content_type = audio_content_type

            # Send to Sarvam API
            try:
                async with httpx.AsyncClient(timeout=SARVAM_TIMEOUT) as client:
                    form_data = {"model": model, "mode": mode}
                    if language_code:
                        form_data["language_code"] = language_code

                    files = {"file": (chunk_filename, chunk_data, chunk_content_type)}

                    resp = await client.post(
                        f"{settings.SARVAM_API_BASE_URL}/speech-to-text",
                        headers=headers,
                        files=files,
                        data=form_data,
                    )
                    resp.raise_for_status()
                    result = resp.json()

                    transcript_text = result.get("transcript", "")
                    detected_lang = result.get("language_code", language_code or "hi-IN")

                    if transcript_text.strip():
                        all_transcripts.append({
                            "text": transcript_text.strip(),
                            "start": start_time,
                            "language_code": detected_lang,
                        })

            except httpx.HTTPStatusError as e:
                detail = e.response.text if e.response else str(e)
                logger.error("Sarvam STT error (chunk %d): %s", chunk_idx, detail)
                if e.response.status_code == 401:
                    raise HTTPException(status_code=401, detail="Invalid Sarvam API key.")
                if e.response.status_code == 429:
                    raise HTTPException(status_code=429, detail="Sarvam rate limit exceeded. Try again shortly.")
                raise HTTPException(status_code=502, detail=f"Sarvam STT error: {detail}")
            except httpx.ConnectError:
                raise HTTPException(status_code=503, detail="Cannot connect to Sarvam AI API.")

    # Build OpenCut-compatible response.
    #
    # Sarvam REST API returns one transcript per 30-second chunk with no
    # internal timing.  We split each chunk into sentence-sized sub-segments
    # so subtitles change at natural boundaries instead of sitting on screen
    # for the full 30 seconds.
    import re

    segments = []
    full_text_parts = []
    seg_id = 0

    for idx, chunk in enumerate(all_transcripts):
        # Estimate chunk end time
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

        # Split into sentences / clauses at natural pause boundaries.
        # Handles Hindi (Devanagari purna viram ।), standard punctuation,
        # and falls back to ~8-word groups if no punctuation exists.
        raw_sentences = re.split(r'(?<=[।|.!?;])\s+', chunk_text)
        # Further split very long sentences (>12 words) at commas / conjunctions
        sentences: list[str] = []
        for sent in raw_sentences:
            words_in_sent = sent.split()
            if len(words_in_sent) > 12:
                # Try splitting at commas / semicolons
                sub = re.split(r'(?<=[,;])\s+', sent)
                sentences.extend(sub)
            else:
                sentences.append(sent)
        # Remove empty entries
        sentences = [s.strip() for s in sentences if s.strip()]

        if not sentences:
            sentences = [chunk_text]

        # Further split any sentence with >6 words into ~4-word groups
        # so each subtitle segment is short and tightly timed.
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
            # Duration proportional to word count, minimum 0.5s
            sent_duration = max(0.5, (n_words / max(total_words, 1)) * chunk_dur)
            sent_end = min(cursor + sent_duration, chunk_end)

            # Build word-level timing
            word_list = sent.split()
            wd = sent_duration / max(len(word_list), 1)
            words = []
            for w_idx, word in enumerate(word_list):
                words.append({
                    "word": word,
                    "start": round(cursor + w_idx * wd, 3),
                    "end": round(cursor + (w_idx + 1) * wd, 3),
                    "probability": 0.9,
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

    # Map Sarvam language code to short code
    if all_transcripts:
        lang_code = all_transcripts[0].get("language_code", language_code or "hi-IN")
        detected_language = lang_code.split("-")[0] if "-" in lang_code else lang_code
    elif language_code:
        detected_language = language_code.split("-")[0] if "-" in language_code else language_code
    else:
        detected_language = "unknown"

    return {
        "text": " ".join(full_text_parts),
        "segments": segments,
        "language": detected_language,
        "duration": round(total_duration, 3),
    }


# ---------------------------------------------------------------------------
# Translation
# ---------------------------------------------------------------------------

@router.post("/translate")
async def sarvam_translate(body: SarvamTranslateRequest, request: Request):
    """Translate text using Sarvam AI translation models.

    Supports 23 languages with sarvam-translate:v1 and 11 with mayura:v1.
    """
    headers = _sarvam_headers(request)
    headers["Content-Type"] = "application/json"

    payload: dict = {
        "input": body.input,
        "source_language_code": body.source_language_code,
        "target_language_code": body.target_language_code,
        "model": body.model,
    }
    if body.mode:
        payload["mode"] = body.mode
    if body.output_script:
        payload["output_script"] = body.output_script
    if body.numerals_format:
        payload["numerals_format"] = body.numerals_format

    try:
        async with httpx.AsyncClient(timeout=SARVAM_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.SARVAM_API_BASE_URL}/translate",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()
            return {
                "translated_text": result.get("translated_text", ""),
                "source_language_code": result.get("source_language_code", body.source_language_code),
                "request_id": result.get("request_id", ""),
            }
    except httpx.HTTPStatusError as e:
        detail = e.response.text if e.response else str(e)
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid Sarvam API key.")
        if e.response.status_code == 429:
            raise HTTPException(status_code=429, detail="Sarvam rate limit exceeded.")
        raise HTTPException(status_code=502, detail=f"Sarvam translation error: {detail}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Sarvam AI API.")


# ---------------------------------------------------------------------------
# Text-to-Speech
# ---------------------------------------------------------------------------

@router.post("/tts")
async def sarvam_tts(body: SarvamTTSRequest, request: Request):
    """Generate speech audio using Sarvam AI Bulbul TTS model.

    Supports 11 Indian languages with 37+ speaker voices.
    Returns audio as a binary response.
    """
    headers = _sarvam_headers(request)
    headers["Content-Type"] = "application/json"

    payload = {
        "inputs": [body.text],
        "target_language_code": body.target_language_code,
        "model": body.model,
        "speaker": body.speaker,
        "pace": body.pace,
        "speech_sample_rate": body.speech_sample_rate,
        "output_audio_codec": body.output_audio_codec,
        "enable_preprocessing": True,
    }

    try:
        async with httpx.AsyncClient(timeout=SARVAM_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.SARVAM_API_BASE_URL}/text-to-speech",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()

            audios = result.get("audios", [])
            if not audios:
                raise HTTPException(status_code=502, detail="Sarvam TTS returned no audio.")

            # Decode base64 audio
            audio_bytes = base64.b64decode(audios[0])

            # Determine content type from codec
            codec_to_mime = {
                "mp3": "audio/mpeg",
                "wav": "audio/wav",
                "opus": "audio/opus",
                "flac": "audio/flac",
                "aac": "audio/aac",
            }
            mime_type = codec_to_mime.get(body.output_audio_codec, "audio/mpeg")

            return Response(
                content=audio_bytes,
                media_type=mime_type,
                headers={
                    "Content-Disposition": f'attachment; filename="sarvam_tts.{body.output_audio_codec}"',
                },
            )
    except httpx.HTTPStatusError as e:
        detail = e.response.text if e.response else str(e)
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid Sarvam API key.")
        if e.response.status_code == 429:
            raise HTTPException(status_code=429, detail="Sarvam rate limit exceeded.")
        raise HTTPException(status_code=502, detail=f"Sarvam TTS error: {detail}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Sarvam AI API.")


# ---------------------------------------------------------------------------
# Transliteration
# ---------------------------------------------------------------------------

@router.post("/transliterate")
async def sarvam_transliterate(body: SarvamTransliterateRequest, request: Request):
    """Transliterate text between Indian language scripts.

    Supports 11 languages. Useful for converting romanized input to native script.
    """
    headers = _sarvam_headers(request)
    headers["Content-Type"] = "application/json"

    payload = {
        "input": body.input,
        "source_language_code": body.source_language_code,
        "target_language_code": body.target_language_code,
        "spoken_form": body.spoken_form,
        "numerals_format": body.numerals_format,
    }

    try:
        async with httpx.AsyncClient(timeout=SARVAM_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.SARVAM_API_BASE_URL}/transliterate",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()
            return {
                "transliterated_text": result.get("transliterated_text", ""),
                "request_id": result.get("request_id", ""),
            }
    except httpx.HTTPStatusError as e:
        detail = e.response.text if e.response else str(e)
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid Sarvam API key.")
        raise HTTPException(status_code=502, detail=f"Sarvam transliteration error: {detail}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Sarvam AI API.")


# ---------------------------------------------------------------------------
# Language Detection
# ---------------------------------------------------------------------------

@router.post("/detect-language")
async def sarvam_detect_language(body: SarvamDetectLanguageRequest, request: Request):
    """Detect the language and script of input text.

    Uses Sarvam's language identification model supporting 11 languages.
    """
    headers = _sarvam_headers(request)
    headers["Content-Type"] = "application/json"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.SARVAM_API_BASE_URL}/text-lid",
                headers=headers,
                json={"input": body.input},
            )
            resp.raise_for_status()
            result = resp.json()
            return {
                "language_code": result.get("language_code", ""),
                "script_code": result.get("script_code", ""),
                "request_id": result.get("request_id", ""),
            }
    except httpx.HTTPStatusError as e:
        detail = e.response.text if e.response else str(e)
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid Sarvam API key.")
        raise HTTPException(status_code=502, detail=f"Sarvam language detection error: {detail}")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Sarvam AI API.")


# ---------------------------------------------------------------------------
# Health / status check
# ---------------------------------------------------------------------------

@router.get("/status")
async def sarvam_status(request: Request):
    """Check Sarvam AI API connectivity and key validity."""
    api_key = _get_sarvam_api_key(request)
    if not api_key:
        return {
            "available": False,
            "reason": "API key not configured",
        }

    try:
        headers = _sarvam_headers(request)
        headers["Content-Type"] = "application/json"
        async with httpx.AsyncClient(timeout=10) as client:
            # Use language detection as a lightweight ping
            resp = await client.post(
                f"{settings.SARVAM_API_BASE_URL}/text-lid",
                headers=headers,
                json={"input": "hello"},
            )
            if resp.status_code == 401:
                return {"available": False, "reason": "Invalid API key"}
            if resp.status_code == 200:
                return {"available": True}
            return {"available": False, "reason": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"available": False, "reason": str(e)}
