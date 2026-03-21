"""Analysis routes -- filler detection, silence detection, structure, suggestions.

All transcription is proxied to the whisper-service microservice.
LLM analysis is done via the Ollama service.
Silence detection is done locally via FFmpeg (no heavy ML model).
"""

import logging
import os
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.services.audio_service import extract_audio
from app.services.ollama_service import ollama_service
from app.services.silence_service import detect_silences

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analyze", tags=["analysis"])


async def _transcribe_via_service(
    audio_path: str, language: str | None = None
) -> dict:
    """Proxy transcription to the whisper-service microservice."""
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            with open(audio_path, "rb") as f:
                files = {"file": (os.path.basename(audio_path), f, "audio/wav")}
                data = {}
                if language:
                    data["language"] = language
                resp = await client.post(
                    f"{settings.WHISPER_SERVICE_URL}/transcribe",
                    files=files,
                    data=data,
                )
                resp.raise_for_status()
                return resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Whisper service is not available at {settings.WHISPER_SERVICE_URL}. "
            "Start it with: docker compose up -d whisper-service",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Whisper service error: {e.response.text}",
        )


async def _save_upload(file: UploadFile, prefix: str) -> tuple[str, str]:
    """Save an uploaded file and return (upload_path, ext)."""
    ext = Path(file.filename or "audio.wav").suffix.lower()
    upload_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join(settings.UPLOAD_DIR, f"{prefix}_{upload_id}{ext}")
    contents = await file.read()
    with open(upload_path, "wb") as f:
        f.write(contents)
    return upload_path, ext


async def _get_audio_path(upload_path: str, ext: str) -> str:
    """Extract audio from video if needed, or return the upload path."""
    video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm"}
    if ext in video_exts:
        return await extract_audio(upload_path)
    return upload_path


@router.post("/fillers")
async def detect_fillers(
    file: UploadFile = File(...),
    filler_words: str = Form(default="um,uh,like,you know,so,actually,basically,right"),
    threshold: float = Form(default=0.6),
) -> dict:
    """Detect filler words in an audio/video file.

    Proxies transcription to whisper-service, then analyzes the result
    to find filler words and their positions in the timeline.
    """
    filler_list = [w.strip().lower() for w in filler_words.split(",") if w.strip()]
    upload_path, ext = await _save_upload(file, "filler")

    try:
        audio_path = await _get_audio_path(upload_path, ext)
        result = await _transcribe_via_service(audio_path)

        # Find filler words in the transcript
        fillers_found = []
        for segment in result.get("segments", []):
            for word in segment.get("words", []):
                cleaned = word.get("word", "").lower().strip(".,!?;:")
                confidence = word.get("probability", word.get("confidence", 0))
                if cleaned in filler_list and confidence >= threshold:
                    fillers_found.append({
                        "word": word.get("word", ""),
                        "start": word.get("start", 0),
                        "end": word.get("end", 0),
                        "confidence": confidence,
                    })

        duration = result.get("duration", 0)
        return {
            "fillers": fillers_found,
            "total_count": len(fillers_found),
            "duration": duration,
            "filler_density": round(
                len(fillers_found) / max(duration / 60, 0.01), 2
            ),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Filler detection failed")
        raise HTTPException(status_code=500, detail="Filler detection failed.")
    finally:
        if os.path.exists(upload_path):
            os.remove(upload_path)


@router.post("/silences")
async def analyze_silences(
    file: UploadFile = File(...),
    threshold_db: float = Form(default=settings.SILENCE_THRESHOLD_DB),
    min_duration: float = Form(default=settings.SILENCE_MIN_DURATION),
) -> dict:
    """Detect silence regions in an audio/video file.

    Uses FFmpeg silencedetect locally (no ML model needed).
    """
    upload_path, ext = await _save_upload(file, "silence")

    try:
        regions = await detect_silences(upload_path, threshold_db, min_duration)

        return {
            "silences": [
                {"start": r.start, "end": r.end, "duration": r.duration}
                for r in regions
            ],
            "total_count": len(regions),
            "total_silence_duration": round(
                sum(r.duration for r in regions), 3
            ),
        }

    except Exception:
        logger.exception("Silence detection failed")
        raise HTTPException(status_code=500, detail="Silence detection failed.")
    finally:
        if os.path.exists(upload_path):
            os.remove(upload_path)


@router.post("/structure")
async def analyze_structure(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
) -> dict:
    """Analyze content structure and suggest chapters.

    Proxies transcription to whisper-service, then uses Ollama LLM
    to identify logical chapters from the transcript.
    """
    upload_path, ext = await _save_upload(file, "struct")

    try:
        audio_path = await _get_audio_path(upload_path, ext)
        transcript = await _transcribe_via_service(audio_path, language=language)

        # Use LLM to identify chapters
        available = await ollama_service.check_available()
        if not available:
            raise HTTPException(
                status_code=503, detail="Ollama is required for structure analysis."
            )

        prompt = (
            "Analyze this transcript and identify logical chapters or sections. "
            "For each chapter, provide a title and the approximate start time based "
            "on the segment timestamps.\n\n"
            "Transcript with timestamps:\n"
        )
        for seg in transcript.get("segments", []):
            prompt += f"[{seg.get('start', 0):.1f}s] {seg.get('text', '')}\n"

        prompt += (
            "\nRespond with JSON: {\"chapters\": [{\"title\": \"...\", "
            "\"start\": float, \"end\": float, \"summary\": \"...\"}]}"
        )

        data = await ollama_service.generate_json(prompt=prompt)

        return {
            "chapters": data.get("chapters", []),
            "duration": transcript.get("duration", 0),
            "language": transcript.get("language", ""),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Structure analysis failed")
        raise HTTPException(status_code=500, detail="Structure analysis failed.")
    finally:
        if os.path.exists(upload_path):
            os.remove(upload_path)


@router.post("/suggestions")
async def smart_suggestions(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
) -> dict:
    """Generate smart editing suggestions for the content.

    Proxies transcription to whisper-service, then uses Ollama LLM
    for analysis and actionable editing recommendations.
    """
    upload_path, ext = await _save_upload(file, "suggest")

    try:
        audio_path = await _get_audio_path(upload_path, ext)
        transcript = await _transcribe_via_service(audio_path, language=language)

        available = await ollama_service.check_available()
        if not available:
            raise HTTPException(
                status_code=503, detail="Ollama is required for suggestions."
            )

        prompt = (
            "You are a professional video editor. Analyze this transcript and "
            "provide specific, actionable editing suggestions. Consider:\n"
            "- Pacing and flow\n"
            "- Repetitive content that could be cut\n"
            "- Sections that could benefit from B-roll or graphics\n"
            "- Filler words and dead air\n"
            "- Strong opening and closing\n\n"
            "Transcript with timestamps:\n"
        )
        for seg in transcript.get("segments", []):
            start = seg.get("start", 0)
            end = seg.get("end", 0)
            text = seg.get("text", "")
            prompt += f"[{start:.1f}s-{end:.1f}s] {text}\n"

        prompt += (
            "\nRespond with JSON: {\"suggestions\": [{\"type\": \"cut|add|modify\", "
            "\"start\": float, \"end\": float, \"description\": \"...\", "
            "\"priority\": \"high|medium|low\"}]}"
        )

        data = await ollama_service.generate_json(prompt=prompt)

        return {
            "suggestions": data.get("suggestions", []),
            "duration": transcript.get("duration", 0),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Suggestions failed")
        raise HTTPException(status_code=500, detail="Suggestion generation failed.")
    finally:
        if os.path.exists(upload_path):
            os.remove(upload_path)
