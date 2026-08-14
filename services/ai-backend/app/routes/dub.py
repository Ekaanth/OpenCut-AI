"""AI Dubbing API routes.

Creates fully-local dubs (transcribe → NLLB translate → XTTS voice-cloned
TTS) and runs them as background jobs. Mirrors the YouTube→Reels polling
UX: POST /create returns a job_id, GET /job/{job_id} reports progress.
"""

import logging
import os
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.models.engagement import JobStatus
from app.services.dubbing_service import DUB_LANGUAGES, dubbing_service
from app.services.job_queue import dubbing_job_queue

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dub", tags=["dub"])

ALLOWED_MEDIA_EXTS = {
    ".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv",  # video
    ".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac",  # audio
}

VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv"}


@router.get("/languages")
async def list_languages():
    """List languages supported for dubbing (ISO 639-1 + NLLB bridge)."""
    return {"languages": DUB_LANGUAGES}


async def _check_ready() -> None:
    """Verify the three downstream services are reachable before starting."""
    checks = [
        ("whisper", settings.WHISPER_SERVICE_URL),
        ("translate", settings.TRANSLATE_SERVICE_URL),
        ("tts", settings.TTS_SERVICE_URL),
    ]
    async with httpx.AsyncClient(timeout=5) as client:
        for name, url in checks:
            try:
                resp = await client.get(f"{url}/health")
                resp.raise_for_status()
            except Exception:
                logger.error("%s service unavailable at %s", name, url)
                raise HTTPException(
                    status_code=503,
                    detail=f"{name} service is not available. "
                    f"Start it with: docker compose up -d {name}-service",
                )


@router.post("/create")
async def create_dub(
    file: UploadFile = File(...),
    target_lang: str = Form(...),
    source_lang: str = Form(default=""),
    speaker_wav: UploadFile | None = None,
):
    """Start a dubbing job.

    Uploads the source media, optionally a voice sample for cloning, then
    enqueues the pipeline as a background job. Returns a job_id for polling.
    """
    await _check_ready()

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_MEDIA_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_MEDIA_EXTS)}",
        )

    # Save the source media
    upload_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join(settings.UPLOAD_DIR, f"dub_src_{upload_id}{ext}")
    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE // (1024 * 1024)} MB",
        )
    with open(upload_path, "wb") as f:
        f.write(contents)

    # If the source is video, extract audio for the pipeline.
    media_path = upload_path
    if ext in VIDEO_EXTS:
        from app.services.audio_service import extract_audio

        media_path = await extract_audio(upload_path)

    # Optional voice sample — forwarded to the tts-service for cloning first.
    speaker_wav_path: str | None = None
    if speaker_wav and speaker_wav.filename:
        try:
            speaker_wav_contents = await speaker_wav.read()
            if len(speaker_wav_contents) > settings.MAX_UPLOAD_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"Speaker sample too large. Maximum size: {settings.MAX_UPLOAD_SIZE // (1024 * 1024)} MB",
                )
            async with httpx.AsyncClient(timeout=60) as client:
                files = {
                    "file": (speaker_wav.filename, speaker_wav_contents, speaker_wav.content_type),
                }
                data = {"name": f"dub_voice_{upload_id}"}
                resp = await client.post(
                    f"{settings.TTS_SERVICE_URL}/clone-voice",
                    files=files,
                    data=data,
                )
                resp.raise_for_status()
                speaker_wav_path = resp.json().get("path")
        except Exception:
            logger.exception("Voice cloning failed; falling back to default voice")
            speaker_wav_path = None

    job = await dubbing_job_queue.create_job()

    async def _run():
        async def _on_progress(progress: float, message: str) -> None:
            await dubbing_job_queue.update_job(
                job.job_id, progress=progress, message=message,
            )

        try:
            await dubbing_job_queue.update_job(
                job.job_id, status="running", progress=0.02, message="Starting dub…",
            )
            result = await dubbing_service.create_dub(
                media_path=media_path,
                source_language=source_lang,
                target_language=target_lang,
                speaker_wav_path=speaker_wav_path,
                job_id=job.job_id,
                on_progress=_on_progress,
            )
            await dubbing_job_queue.update_job(
                job.job_id,
                status="completed",
                progress=1.0,
                message="Dub ready.",
                result=result.to_dict(),
            )
        except ValueError as e:
            await dubbing_job_queue.update_job(
                job.job_id, status="failed", error=str(e)[:500],
            )
        except Exception as e:
            logger.exception("Dubbing job %s failed", job.job_id)
            await dubbing_job_queue.update_job(
                job.job_id, status="failed", error=str(e)[:500],
            )
        finally:
            # Clean up the uploaded source (generated dub output is kept under /generated).
            try:
                if media_path != upload_path and os.path.exists(media_path):
                    os.remove(media_path)
                if os.path.exists(upload_path):
                    os.remove(upload_path)
            except OSError:
                pass

    await dubbing_job_queue.run_job(job.job_id, _run())

    logger.info(
        "AUDIT dub create: job=%s target=%s source=%s cloned_voice=%s",
        job.job_id, target_lang, source_lang or "auto", speaker_wav_path is not None,
    )

    return {"job_id": job.job_id, "status": "queued"}


@router.get("/job/{job_id}")
async def get_dub_job(job_id: str):
    """Poll a dubbing job's status."""
    job = await dubbing_job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired.")

    return JobStatus(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        message=job.message,
        result=job.result,
        error=job.error,
    ).model_dump()


@router.post("/cancel/{job_id}")
async def cancel_dub_job(job_id: str):
    """Cancel a running dub job."""
    job = await dubbing_job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    await dubbing_job_queue.cancel_job(job_id)
    return {"status": "cancelled", "job_id": job_id}
