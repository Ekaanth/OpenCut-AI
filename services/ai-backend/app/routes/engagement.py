"""Engagement scoring API routes.

Provides endpoints for scoring video clips' engagement potential,
analyzing hooks, and batch scoring for the YouTube-to-Reels pipeline.
"""

import logging
import os
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.models.engagement import (
    EngagementScore,
    ScoreBatchRequest,
    ScoreClipRequest,
)
from app.services.engagement.audio_intelligence import audio_intelligence
from app.services.engagement.scorer import engagement_scorer
from app.services.engagement.hook_analyzer import hook_analyzer
from app.services.engagement.visual_enhancements import color_arc_generator, loop_detector
from app.services.stream_utils import streamed_llm_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/engagement", tags=["engagement"])


# ── Single clip scoring ──────────────────────────────────────────────


@router.post("/score")
async def score_clip(request: ScoreClipRequest):
    """Score a single clip's engagement potential.

    Accepts transcript data and optional audio/video paths.
    Returns the full engagement breakdown with composite score, grade,
    and actionable improvement suggestions.

    Streams keepalive pings while LLM-dependent scoring runs.
    """

    async def _work():
        score = await engagement_scorer.score_clip(request)
        return score.to_response()

    return streamed_llm_response(_work, error_detail="Engagement scoring failed.")


@router.post("/score-video")
async def score_video(
    file: UploadFile = File(...),
    transcript_text: str = Form(default=""),
):
    """Score a video file's engagement potential.

    Used by the editor for scoring videos on the timeline and
    pre-export readiness checks. Accepts a video file upload.
    """
    ext = os.path.splitext(file.filename or "video.mp4")[1].lower()
    upload_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join(settings.UPLOAD_DIR, f"engagement_{upload_id}{ext}")

    try:
        contents = await file.read()
        if len(contents) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large")
        with open(upload_path, "wb") as f:
            f.write(contents)

        # Extract audio for analysis
        audio_path = upload_path.rsplit(".", 1)[0] + "_audio.wav"
        import asyncio
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-i", upload_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            "-y", audio_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()

        # Get duration
        dur_proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "json", upload_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        dur_out, _ = await dur_proc.communicate()
        import json
        try:
            duration = float(json.loads(dur_out.decode())["format"]["duration"])
        except Exception:
            duration = 30.0

        req = ScoreClipRequest(
            audio_path=audio_path if os.path.exists(audio_path) else None,
            video_path=upload_path,
            transcript_text=transcript_text,
            start=0,
            end=duration,
        )

        async def _work():
            score = await engagement_scorer.score_clip(req)
            return score.to_response()

        return streamed_llm_response(_work, error_detail="Video engagement scoring failed.")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Video scoring failed")
        raise HTTPException(status_code=500, detail="Video engagement scoring failed.")
    finally:
        # Cleanup happens after response is sent in a background task
        import asyncio

        async def _cleanup():
            await asyncio.sleep(30)  # keep files briefly for streaming response
            for p in [upload_path, upload_path.rsplit(".", 1)[0] + "_audio.wav"]:
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass

        asyncio.create_task(_cleanup())


# ── Batch scoring ────────────────────────────────────────────────────


@router.post("/score-batch")
async def score_batch(request: ScoreBatchRequest):
    """Score multiple clips in parallel.

    Used by the YouTube-to-Reels review dashboard to score all
    detected clips at once.
    """
    if not request.clips:
        return {"scores": []}

    async def _work():
        scores = await engagement_scorer.score_batch(request.clips)
        return {"scores": [s.to_response() for s in scores]}

    return streamed_llm_response(_work, error_detail="Batch scoring failed.")


# ── Hook analysis ────────────────────────────────────────────────────


class HookAnalysisRequest(BaseModel):
    transcript_start: str = ""
    audio_path: str | None = None
    video_path: str | None = None
    clip_duration: float = 30.0


@router.post("/analyze-hook")
async def analyze_hook(request: HookAnalysisRequest):
    """Detailed hook analysis for the first 3 seconds of a clip.

    Returns the full hook breakdown with sub-signal scores and
    suggestions for improving the hook.
    """

    async def _work():
        result = await hook_analyzer.analyze(
            audio_path=request.audio_path,
            video_path=request.video_path,
            transcript_start=request.transcript_start,
            clip_duration=request.clip_duration,
        )
        return result.model_dump()

    return streamed_llm_response(_work, error_detail="Hook analysis failed.")


# ── Beat analysis ────────────────────────────────────────────────────


@router.post("/beats")
async def analyze_beats(
    file: UploadFile = File(...),
    word_timestamps_json: str = Form(default=""),
):
    """Beat detection and sync point generation.

    Returns BPM, beat positions, beat drops, energy envelope, and
    sync points (when word timestamps are provided).
    """
    ext = os.path.splitext(file.filename or "audio.wav")[1].lower()
    upload_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join(settings.UPLOAD_DIR, f"beats_{upload_id}{ext}")

    try:
        contents = await file.read()
        if len(contents) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large")
        with open(upload_path, "wb") as f:
            f.write(contents)

        word_timestamps = None
        if word_timestamps_json:
            import json
            try:
                word_timestamps = json.loads(word_timestamps_json)
            except json.JSONDecodeError:
                pass

        result = await audio_intelligence.analyze(upload_path, word_timestamps)
        return result.model_dump()

    except Exception:
        logger.exception("Beat analysis failed")
        raise HTTPException(status_code=500, detail="Beat analysis failed.")
    finally:
        import asyncio

        async def _cleanup():
            await asyncio.sleep(5)
            if os.path.exists(upload_path):
                try:
                    os.remove(upload_path)
                except OSError:
                    pass

        asyncio.create_task(_cleanup())


# ── Enhancement ──────────────────────────────────────────────────────


class EnhanceRequest(BaseModel):
    video_path: str
    enhancements: list[str] = []  # "color_arc", "beat_sync", "hook_text", "loop_trim"
    caption_style: str = "modern"
    duration: float = 30.0


@router.post("/enhance")
async def enhance_clip(request: EnhanceRequest):
    """Apply engagement enhancements to a clip.

    Returns enhanced video path and before/after engagement score delta.
    Supported enhancements: color_arc, loop_trim.
    """
    # Validate path is within allowed directories
    allowed_dirs = [settings.UPLOAD_DIR, settings.GENERATED_DIR]
    real_path = os.path.realpath(request.video_path)
    if not any(real_path.startswith(os.path.realpath(d)) for d in allowed_dirs):
        raise HTTPException(status_code=400, detail="Invalid video path")

    async def _work():
        results = {}

        if "color_arc" in request.enhancements:
            ffmpeg_filter = color_arc_generator.generate_ffmpeg_filter(request.duration)
            results["color_arc_filter"] = ffmpeg_filter

        if "loop_trim" in request.enhancements and request.video_path:
            loop_result = await loop_detector.find_loop_point(request.video_path)
            if loop_result:
                results["loop"] = loop_result

        return {"enhancements_applied": request.enhancements, "results": results}

    return streamed_llm_response(_work, error_detail="Enhancement failed.")


# ── Loop detection ───────────────────────────────────────────────────


@router.post("/detect-loop")
async def detect_loop(
    file: UploadFile = File(...),
):
    """Detect if a video can be seamlessly looped."""
    ext = os.path.splitext(file.filename or "video.mp4")[1].lower()
    upload_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join(settings.UPLOAD_DIR, f"loop_{upload_id}{ext}")

    try:
        contents = await file.read()
        if len(contents) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large")
        with open(upload_path, "wb") as f:
            f.write(contents)

        result = await loop_detector.find_loop_point(upload_path)
        return result or {"can_loop": False, "confidence": 0}

    except Exception:
        logger.exception("Loop detection failed")
        raise HTTPException(status_code=500, detail="Loop detection failed.")
    finally:
        import asyncio

        async def _cleanup():
            await asyncio.sleep(5)
            if os.path.exists(upload_path):
                try:
                    os.remove(upload_path)
                except OSError:
                    pass

        asyncio.create_task(_cleanup())
