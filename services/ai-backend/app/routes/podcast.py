"""Podcast clip analysis routes -- clip finding, keyword extraction, question cards, speaker diarization.

LLM analysis is done via the Ollama service using transcript data.
Speaker diarization is proxied to the speaker-service microservice.
"""

import logging
import os
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.services.audio_service import extract_audio
from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analyze", tags=["podcast"])


# ── Request / Response Models ──────────────────────────────────────────


class TranscriptWord(BaseModel):
    word: str
    start: float
    end: float
    confidence: float = 0.9


class TranscriptSegment(BaseModel):
    id: int
    text: str
    start: float
    end: float
    speaker: str | None = None
    words: list[TranscriptWord] = []


class FindClipsRequest(BaseModel):
    segments: list[TranscriptSegment]
    min_duration: float = 15.0
    max_duration: float = 90.0
    max_clips: int = 10


class ClipCandidate(BaseModel):
    title: str
    start: float
    end: float
    score: int  # 0-100
    reason: str
    tags: list[str] = []


class FindClipsResponse(BaseModel):
    clips: list[ClipCandidate]
    total_duration: float


class KeywordRequest(BaseModel):
    segments: list[TranscriptSegment]


class KeywordEntry(BaseModel):
    word: str
    color: str  # hex color
    category: str  # "emphasis", "name", "number", "positive", "negative", "quote"


class KeywordResponse(BaseModel):
    keywords: list[KeywordEntry]


class QuestionCardsRequest(BaseModel):
    segments: list[TranscriptSegment]
    max_cards: int = 5


class QuestionCard(BaseModel):
    question: str
    timestamp: float
    theme: str  # "dark", "gradient", "bold"
    emoji: str = ""


class QuestionCardsResponse(BaseModel):
    cards: list[QuestionCard]


# ── Endpoints ──────────────────────────────────────────────────────────


@router.post("/find-clips", response_model=FindClipsResponse)
async def find_clips(request: FindClipsRequest) -> dict[str, Any]:
    """Find the best clip-worthy moments in a podcast transcript.

    Uses LLM to score transcript segments by engagement potential:
    - Strong statements / hot takes
    - Questions with surprising answers
    - Statistics / numbers / claims
    - Emotional peaks
    - Complete thought arcs (setup → punchline)
    """
    if not request.segments:
        return {"clips": [], "total_duration": 0}

    available = await ollama_service.check_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="Ollama LLM is required for clip finding. Start it with: docker compose up -d ollama",
        )

    # Build a timestamped transcript for the LLM
    transcript_lines: list[str] = []
    total_duration = 0.0
    for seg in request.segments:
        transcript_lines.append(f"[{seg.start:.1f}s-{seg.end:.1f}s] {seg.text}")
        total_duration = max(total_duration, seg.end)

    transcript_text = "\n".join(transcript_lines)

    prompt = f"""You are a viral content editor. Analyze this podcast transcript and find the {request.max_clips} most engaging moments that would make great short-form clips (TikTok, YouTube Shorts, Reels).

Each clip should be {request.min_duration:.0f}-{request.max_duration:.0f} seconds long.

Score each clip 0-100 based on:
- Viral potential (controversial takes, surprising facts, humor)
- Emotional intensity (passion, surprise, laughter)
- Standalone value (makes sense without context)
- Hook strength (grabs attention in first 2 seconds)
- Shareability (people would want to share this)

Transcript:
{transcript_text}

Respond with JSON: {{"clips": [{{"title": "short catchy title", "start": float, "end": float, "score": int, "reason": "why this is engaging", "tags": ["funny", "hot-take", etc]}}]}}

Sort by score descending. Only include clips scoring 50 or above."""

    try:
        data = await ollama_service.generate_json(prompt=prompt)
        clips = data.get("clips", [])

        # Validate and clamp clip boundaries
        validated_clips: list[dict[str, Any]] = []
        for clip in clips:
            start = max(0, float(clip.get("start", 0)))
            end = min(total_duration, float(clip.get("end", start + 30)))
            if end - start < request.min_duration * 0.5:
                continue
            validated_clips.append({
                "title": str(clip.get("title", "Untitled clip")),
                "start": round(start, 2),
                "end": round(end, 2),
                "score": max(0, min(100, int(clip.get("score", 50)))),
                "reason": str(clip.get("reason", "")),
                "tags": [str(t) for t in clip.get("tags", [])],
            })

        # Sort by score descending
        validated_clips.sort(key=lambda c: c["score"], reverse=True)

        return {
            "clips": validated_clips[:request.max_clips],
            "total_duration": round(total_duration, 2),
        }

    except ValueError as e:
        logger.error("LLM returned invalid response for clip finding: %s", e)
        raise HTTPException(
            status_code=502,
            detail="LLM returned an invalid response. Try again or use a larger model.",
        )
    except Exception:
        logger.exception("Clip finding failed")
        raise HTTPException(status_code=500, detail="Clip finding failed.")


@router.post("/keywords", response_model=KeywordResponse)
async def extract_keywords(request: KeywordRequest) -> dict[str, Any]:
    """Extract important keywords from transcript for subtitle highlighting.

    Identifies words that should be visually emphasized:
    - Names and proper nouns → cyan (#06B6D4)
    - Numbers and statistics → green (#22C55E)
    - Strong/emotional words → red (#EF4444)
    - Positive words → green (#22C55E)
    - Key concepts → yellow (#FACC15)
    """
    if not request.segments:
        return {"keywords": []}

    available = await ollama_service.check_available()
    if not available:
        # Fall back to rule-based extraction
        return {"keywords": _rule_based_keywords(request.segments)}

    full_text = " ".join(seg.text for seg in request.segments)

    prompt = f"""Analyze this transcript and identify the most important words that should be visually highlighted in subtitles.

Categorize each word:
- "emphasis": strong/emotional/action words (color: #EF4444 red)
- "name": names and proper nouns (color: #06B6D4 cyan)
- "number": numbers, statistics, amounts (color: #22C55E green)
- "positive": positive/success words (color: #22C55E green)
- "negative": negative/warning words (color: #F97316 orange)
- "quote": quoted or notable phrases (color: #A855F7 purple)

Text: {full_text}

Respond with JSON: {{"keywords": [{{"word": "exact word from text", "color": "#hex", "category": "category"}}]}}

Return 15-30 keywords maximum. Only include truly impactful words."""

    try:
        data = await ollama_service.generate_json(prompt=prompt)
        keywords = data.get("keywords", [])

        color_map = {
            "emphasis": "#EF4444",
            "name": "#06B6D4",
            "number": "#22C55E",
            "positive": "#22C55E",
            "negative": "#F97316",
            "quote": "#A855F7",
        }

        validated: list[dict[str, str]] = []
        for kw in keywords:
            word = str(kw.get("word", "")).strip()
            category = str(kw.get("category", "emphasis"))
            if not word:
                continue
            color = kw.get("color", color_map.get(category, "#FACC15"))
            validated.append({
                "word": word,
                "color": color,
                "category": category,
            })

        return {"keywords": validated}

    except (ValueError, Exception):
        logger.warning("LLM keyword extraction failed, falling back to rules")
        return {"keywords": _rule_based_keywords(request.segments)}


def _rule_based_keywords(segments: list[TranscriptSegment]) -> list[dict[str, str]]:
    """Fallback rule-based keyword extraction when LLM is unavailable."""
    keywords: list[dict[str, str]] = []
    seen: set[str] = set()

    for seg in segments:
        for word_obj in seg.words:
            word = word_obj.word.strip().strip(".,!?;:\"'")
            lower = word.lower()
            if lower in seen or len(word) < 2:
                continue

            # Numbers
            if any(c.isdigit() for c in word):
                keywords.append({"word": word, "color": "#22C55E", "category": "number"})
                seen.add(lower)
            # Capitalized words (likely proper nouns) - skip sentence starters
            elif word[0].isupper() and len(word) > 2 and word_obj.start > 0.5:
                keywords.append({"word": word, "color": "#06B6D4", "category": "name"})
                seen.add(lower)
            # Long impactful words
            elif len(word) > 8:
                keywords.append({"word": word, "color": "#EF4444", "category": "emphasis"})
                seen.add(lower)

    return keywords[:30]


@router.post("/question-cards", response_model=QuestionCardsResponse)
async def generate_question_cards(request: QuestionCardsRequest) -> dict[str, Any]:
    """Generate AI question/topic cards for podcast clip intros.

    Analyzes the transcript to find topic shifts and generates
    engaging questions that introduce each topic segment.
    """
    if not request.segments:
        return {"cards": []}

    available = await ollama_service.check_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="Ollama LLM is required for question card generation.",
        )

    transcript_lines: list[str] = []
    for seg in request.segments:
        transcript_lines.append(f"[{seg.start:.1f}s] {seg.text}")

    transcript_text = "\n".join(transcript_lines)

    prompt = f"""You are a social media content producer. Analyze this podcast transcript and create {request.max_cards} engaging question/topic cards that would appear as animated title slides in a short-form video clip.

Each card should:
- Be a compelling question or statement that hooks the viewer
- Appear at a natural topic transition point
- Be short (under 10 words)
- Create curiosity or intrigue

Transcript:
{transcript_text}

Respond with JSON: {{"cards": [{{"question": "Can money buy happiness?", "timestamp": float (seconds where topic starts), "theme": "dark"|"gradient"|"bold", "emoji": "optional emoji"}}]}}

Choose themes:
- "dark": serious/analytical topics
- "gradient": inspirational/positive topics
- "bold": controversial/surprising topics"""

    try:
        data = await ollama_service.generate_json(prompt=prompt)
        cards = data.get("cards", [])

        total_duration = max((seg.end for seg in request.segments), default=0)

        validated: list[dict[str, Any]] = []
        for card in cards:
            question = str(card.get("question", "")).strip()
            if not question:
                continue
            timestamp = max(0, min(total_duration, float(card.get("timestamp", 0))))
            validated.append({
                "question": question,
                "timestamp": round(timestamp, 2),
                "theme": str(card.get("theme", "dark")),
                "emoji": str(card.get("emoji", "")),
            })

        return {"cards": validated[:request.max_cards]}

    except ValueError as e:
        logger.error("LLM returned invalid response for question cards: %s", e)
        raise HTTPException(
            status_code=502,
            detail="LLM returned an invalid response. Try again.",
        )
    except Exception:
        logger.exception("Question card generation failed")
        raise HTTPException(status_code=500, detail="Question card generation failed.")


# ── Speaker Diarization ────────────────────────────────────────────────


async def _save_upload_file(file: UploadFile, prefix: str) -> tuple[str, str]:
    """Save an uploaded file and return (upload_path, ext)."""
    ext = Path(file.filename or "audio.wav").suffix.lower()
    upload_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join(settings.UPLOAD_DIR, f"{prefix}_{upload_id}{ext}")
    contents = await file.read()
    with open(upload_path, "wb") as f:
        f.write(contents)
    return upload_path, ext


def _local_fallback_diarization(audio_path: str, num_speakers: int | None = None) -> list[dict]:
    """Silence-based speaker diarization fallback using FFmpeg.

    Detects silence boundaries, then alternates speaker labels at each
    pause. Works without any ML model — just FFmpeg.
    """
    import subprocess
    import json as _json

    max_spk = num_speakers or 2
    labels = [f"SPEAKER_{chr(65 + i)}" for i in range(max_spk)]

    # Get duration
    dur_cmd = [
        "ffprobe", "-v", "quiet",
        "-show_entries", "format=duration", "-of", "json", audio_path,
    ]
    dur_proc = subprocess.run(dur_cmd, capture_output=True, text=True, timeout=30)
    try:
        total_duration = float(_json.loads(dur_proc.stdout)["format"]["duration"])
    except Exception:
        total_duration = 0

    # Silence detection via FFmpeg
    cmd = [
        "ffmpeg", "-i", audio_path,
        "-af", "silencedetect=noise=-30dB:d=0.8",
        "-f", "null", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    stderr = proc.stderr

    silence_starts: list[float] = []
    silence_ends: list[float] = []
    for line in stderr.split("\n"):
        if "silence_start:" in line:
            try:
                val = float(line.split("silence_start:")[1].strip().split()[0])
                silence_starts.append(val)
            except (ValueError, IndexError):
                pass
        elif "silence_end:" in line:
            try:
                val = float(line.split("silence_end:")[1].strip().split()[0])
                silence_ends.append(val)
            except (ValueError, IndexError):
                pass

    if not silence_starts and not silence_ends:
        # No silences — single speaker
        return [{"speaker": labels[0], "start": 0.0, "end": total_duration}]

    segments: list[dict] = []
    speaker_idx = 0

    # First speech segment
    if silence_starts and silence_starts[0] > 0.3:
        segments.append({"speaker": labels[0], "start": 0.0, "end": round(silence_starts[0], 2)})
        speaker_idx = 1

    # Segments between silences
    for i, end_time in enumerate(silence_ends):
        next_start = silence_starts[i + 1] if i + 1 < len(silence_starts) else total_duration
        gap = next_start - end_time
        if gap > 0.3:
            # Only switch speaker if the silence was long enough (>1.5s = likely a speaker change)
            silence_dur = end_time - (silence_starts[i] if i < len(silence_starts) else end_time)
            if silence_dur > 1.5:
                speaker_idx += 1
            segments.append({
                "speaker": labels[speaker_idx % max_spk],
                "start": round(end_time, 2),
                "end": round(next_start, 2),
            })

    if not segments:
        segments = [{"speaker": labels[0], "start": 0.0, "end": total_duration}]

    # Merge consecutive segments from the same speaker
    merged: list[dict] = []
    for seg in segments:
        if merged and merged[-1]["speaker"] == seg["speaker"] and seg["start"] - merged[-1]["end"] < 1.0:
            merged[-1]["end"] = seg["end"]
        else:
            merged.append(seg)

    return merged


@router.post("/speakers")
async def analyze_speakers(
    file: UploadFile = File(...),
    num_speakers: int | None = Form(default=None),
    min_speakers: int | None = Form(default=None),
    max_speakers: int | None = Form(default=None),
) -> dict[str, Any]:
    """Detect which speaker is talking at each moment.

    Tries the speaker-service (pyannote) first. If unavailable, falls back
    to a built-in silence-based approach using FFmpeg — this always works
    without any additional Docker services.

    Returns speaker segments:
    [{"speaker": "SPEAKER_A", "start": 0.0, "end": 5.2}, ...]
    """
    upload_path, ext = await _save_upload_file(file, "speaker")

    try:
        # Extract audio if it's a video file
        video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm"}
        audio_path = upload_path
        if ext in video_exts:
            audio_path = await extract_audio(upload_path)

        # Try pyannote speaker-service first
        try:
            async with httpx.AsyncClient(timeout=600) as client:
                with open(audio_path, "rb") as f:
                    files = {"file": (os.path.basename(audio_path), f, "audio/wav")}
                    data: dict[str, str] = {}
                    if num_speakers is not None:
                        data["num_speakers"] = str(num_speakers)
                    if min_speakers is not None:
                        data["min_speakers"] = str(min_speakers)
                    if max_speakers is not None:
                        data["max_speakers"] = str(max_speakers)

                    resp = await client.post(
                        f"{settings.SPEAKER_SERVICE_URL}/diarize",
                        files=files,
                        data=data,
                    )
                    resp.raise_for_status()
                    result = resp.json()

            return {
                "segments": result.get("segments", []),
                "num_speakers": result.get("num_speakers", 0),
                "method": result.get("method", "unknown"),
            }

        except (httpx.ConnectError, httpx.HTTPStatusError) as proxy_err:
            # Speaker-service not available — use built-in fallback
            logger.info(
                "Speaker-service not available (%s), using local fallback diarization.",
                type(proxy_err).__name__,
            )
            segments = _local_fallback_diarization(audio_path, num_speakers)
            return {
                "segments": segments,
                "num_speakers": len(set(s["speaker"] for s in segments)),
                "method": "fallback-silence",
            }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Speaker diarization failed")
        raise HTTPException(status_code=500, detail="Speaker diarization failed.")
    finally:
        for p in [upload_path, upload_path.rsplit(".", 1)[0] + "_audio.wav"]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass


# ── Face Detection ─────────────────────────────────────────────────────


@router.post("/faces")
async def analyze_faces(
    file: UploadFile = File(...),
    sample_interval: float = Form(default=1.0),
    max_samples: int = Form(default=120),
) -> dict[str, Any]:
    """Detect faces in a video file for auto-reframe.

    Proxies the video to the face-service microservice which runs
    MediaPipe face detection on sampled frames.

    Returns face bounding boxes (normalized 0-1) per sampled frame.
    """
    upload_path, ext = await _save_upload_file(file, "face")

    try:
        try:
            async with httpx.AsyncClient(timeout=300) as client:
                with open(upload_path, "rb") as f:
                    files = {"file": (os.path.basename(upload_path), f, "video/mp4")}
                    data = {
                        "sample_interval": str(sample_interval),
                        "max_samples": str(max_samples),
                    }
                    resp = await client.post(
                        f"{settings.FACE_SERVICE_URL}/detect",
                        files=files,
                        data=data,
                    )
                    resp.raise_for_status()
                    return resp.json()

        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Face service is not available at {settings.FACE_SERVICE_URL}. "
                    "Start it with: docker compose up -d face-service"
                ),
            )
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Face service error: {e.response.text}",
            )

    except HTTPException:
        raise
    except Exception:
        logger.exception("Face detection failed")
        raise HTTPException(status_code=500, detail="Face detection failed.")
    finally:
        if os.path.exists(upload_path):
            try:
                os.remove(upload_path)
            except OSError:
                pass


# ── Emotion Detection ──────────────────────────────────────────────────


def _local_fallback_emotions(audio_path: str, window_seconds: float = 5.0) -> list[dict]:
    """RMS energy-based emotion approximation using FFmpeg."""
    import subprocess
    import struct
    import math
    import json as _json

    dur_cmd = ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "json", audio_path]
    dur_proc = subprocess.run(dur_cmd, capture_output=True, text=True, timeout=30)
    try:
        total_duration = float(_json.loads(dur_proc.stdout)["format"]["duration"])
    except Exception:
        total_duration = 60.0

    pcm_cmd = [
        "ffmpeg", "-i", audio_path,
        "-f", "s16le", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        "-y", "pipe:1",
    ]
    proc = subprocess.run(pcm_cmd, capture_output=True, timeout=300)
    if proc.returncode != 0:
        return []

    raw = proc.stdout
    sample_rate = 16000
    samples_per_window = int(sample_rate * window_seconds)
    num_samples = len(raw) // 2
    results = []

    for start_sample in range(0, num_samples, samples_per_window):
        end_sample = min(start_sample + samples_per_window, num_samples)
        chunk = raw[start_sample * 2 : end_sample * 2]
        if len(chunk) < 100:
            break
        n = len(chunk) // 2
        values = struct.unpack(f"<{n}h", chunk[:n * 2])
        rms = math.sqrt(sum(v * v for v in values) / n) / 32768.0
        timestamp = start_sample / sample_rate
        intensity = min(1.0, rms * 5.0)
        emotion = "excited" if intensity > 0.6 else ("neutral" if intensity > 0.3 else "calm")
        results.append({
            "start": round(timestamp, 2),
            "end": round(min(timestamp + window_seconds, total_duration), 2),
            "emotion": emotion,
            "intensity": round(intensity, 3),
        })

    return results


@router.post("/emotions")
async def analyze_emotions(
    file: UploadFile = File(...),
    window_seconds: float = Form(default=5.0),
) -> dict[str, Any]:
    """Detect emotional peaks in audio for better clip scoring.

    Tries the speaker-service (speechbrain) first. Falls back to local
    energy-based analysis using FFmpeg if the service is unavailable.
    """
    upload_path, ext = await _save_upload_file(file, "emotion")

    try:
        video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm"}
        audio_path = upload_path
        if ext in video_exts:
            audio_path = await extract_audio(upload_path)

        try:
            async with httpx.AsyncClient(timeout=300) as client:
                with open(audio_path, "rb") as f:
                    files = {"file": (os.path.basename(audio_path), f, "audio/wav")}
                    data = {"window_seconds": str(window_seconds)}
                    resp = await client.post(
                        f"{settings.SPEAKER_SERVICE_URL}/analyze-emotion",
                        files=files,
                        data=data,
                    )
                    resp.raise_for_status()
                    return resp.json()

        except (httpx.ConnectError, httpx.HTTPStatusError) as proxy_err:
            logger.info(
                "Speaker-service emotion endpoint not available (%s), using local fallback.",
                type(proxy_err).__name__,
            )
            emotions = _local_fallback_emotions(audio_path, window_seconds)
            return {
                "emotions": emotions,
                "method": "fallback-energy",
                "peak_emotion": max(emotions, key=lambda r: r["intensity"])["emotion"] if emotions else "neutral",
            }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Emotion detection failed")
        raise HTTPException(status_code=500, detail="Emotion detection failed.")
    finally:
        for p in [upload_path, upload_path.rsplit(".", 1)[0] + "_audio.wav"]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
