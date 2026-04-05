"""YouTube-to-Reels API routes.

Handles video ingestion, analysis orchestration, clip generation,
and job status polling. All processing runs as background jobs.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.models.engagement import JobStatus, YouTubeVideoMeta
from app.services.clip_detector import ClipDetectionConfig, clip_detector
from app.services.job_queue import job_queue
from app.services.reel_generator import ReelConfig, reel_generator
from app.services.youtube_service import extract_video_id, youtube_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/youtube", tags=["youtube"])


# ── Request / Response models ─────────────────────────────────────────


class IngestRequest(BaseModel):
    url: str
    ownership_confirmed: bool
    language: str | None = None


class IngestResponse(BaseModel):
    job_id: str
    video_meta: YouTubeVideoMeta
    estimated_processing_minutes: float


class AnalyzeRequest(BaseModel):
    job_id: str
    min_clip_duration: float = 15.0
    max_clip_duration: float = 90.0
    max_clips: int = 10
    include_diarization: bool = False
    include_face_detection: bool = False


class ClipSelection(BaseModel):
    clip_index: int
    start: float
    end: float
    title: str = ""


class GenerateClipsRequest(BaseModel):
    job_id: str
    selected_clips: list[ClipSelection]
    output_format: str = "9:16"
    caption_style: str = "modern"
    auto_reframe: bool = True
    add_hook: bool = False
    resolution: str = "1080"


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post("/ingest", response_model=IngestResponse)
async def ingest_video(request: IngestRequest):
    """Accept a YouTube URL, validate it, fetch metadata, and start audio download.

    Requires ownership_confirmed=true. Returns job_id and video metadata.
    The audio download runs as a background job.
    """
    # E12.1: Ownership enforcement — hard requirement
    if not request.ownership_confirmed:
        raise HTTPException(
            status_code=400,
            detail="You must confirm content ownership before processing. Set ownership_confirmed to true.",
        )

    # Validate URL
    video_id = extract_video_id(request.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL.")

    # Check rate limits
    active = await job_queue.active_job_count()
    if active >= settings.YOUTUBE_MAX_CONCURRENT_JOBS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many concurrent jobs ({active}/{settings.YOUTUBE_MAX_CONCURRENT_JOBS}). Please wait.",
        )

    # Fetch metadata (fast, no download)
    try:
        meta = await youtube_service.fetch_metadata(request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Metadata fetch failed for %s", request.url)
        raise HTTPException(status_code=500, detail="Failed to fetch video metadata.")

    # Create background job
    job = await job_queue.create_job()

    # Estimate processing time (rough: 1 min per 10 min of video + 5 min base)
    est_minutes = round(5 + (meta.duration_seconds / 600), 1)

    # Start audio + caption download as background task
    async def _download():
        await job_queue.update_job(
            job.job_id, status="downloading", progress=0.05,
            message="Downloading YouTube captions...",
        )
        try:
            # Step 1: Try to get existing YouTube captions (fast, no compute)
            captions = await youtube_service.download_captions(
                request.url, job.job_id, request.language,
            )

            has_captions = captions is not None and len(captions) > 0

            # Step 2: Download audio (needed for engagement scoring even if captions exist)
            await job_queue.update_job(
                job.job_id, status="downloading", progress=0.30,
                message="Downloading audio track..."
                + (" (captions found, skipping transcription)" if has_captions else ""),
            )
            audio_path = await youtube_service.download_audio(request.url, job.job_id)

            await job_queue.update_job(
                job.job_id, status="completed", progress=1.0,
                message="Ready for analysis."
                + (f" ({len(captions)} caption segments loaded)" if has_captions else " (will transcribe with Whisper)"),
                result={
                    "audio_path": audio_path,
                    "video_url": request.url,
                    "video_id": video_id,
                    "video_meta": meta.model_dump(),
                    "language": request.language,
                    "youtube_captions": captions,
                },
            )
        except Exception as e:
            await job_queue.update_job(
                job.job_id, status="failed",
                error=f"Download failed: {str(e)[:300]}",
            )

    await job_queue.run_job(job.job_id, _download())

    # E12.3: Audit logging
    logger.info(
        "AUDIT YouTube ingest: job=%s video_id=%s title='%s' duration=%ds ownership_confirmed=%s",
        job.job_id, video_id, meta.title[:50], meta.duration_seconds, request.ownership_confirmed,
    )

    return IngestResponse(
        job_id=job.job_id,
        video_meta=meta,
        estimated_processing_minutes=est_minutes,
    )


@router.get("/status/{job_id}")
async def get_job_status(job_id: str):
    """Poll the status of a background job.

    Returns current status, progress (0-1), message, and result when completed.
    """
    job = await job_queue.get_job(job_id)
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
async def cancel_job(job_id: str):
    """Cancel a running job."""
    job = await job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired.")

    await job_queue.cancel_job(job_id)
    # Clean up files
    await youtube_service.cleanup(job_id)

    return {"status": "cancelled", "job_id": job_id}


@router.post("/analyze")
async def analyze_video(request: AnalyzeRequest):
    """Run the full clip detection pipeline on a downloaded YouTube video.

    Requires a completed ingest job. Runs transcription, clip detection,
    and engagement scoring as a background job.
    """
    job = await job_queue.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired.")

    if job.status != "completed" or not job.result:
        raise HTTPException(
            status_code=400,
            detail=f"Job is not ready for analysis. Current status: {job.status}",
        )

    audio_path = job.result.get("audio_path")
    if not audio_path:
        raise HTTPException(status_code=400, detail="No audio file found for this job.")

    # Check if YouTube captions were already downloaded during ingest
    youtube_captions = job.result.get("youtube_captions")

    analysis_job = await job_queue.create_job()

    async def _analyze():
        config = ClipDetectionConfig(
            min_duration=request.min_clip_duration,
            max_duration=request.max_clip_duration,
            max_clips=request.max_clips,
            language=job.result.get("language"),
        )

        async def on_progress(status, progress, message):
            await job_queue.update_job(
                analysis_job.job_id, status=status, progress=progress, message=message,
            )

        result = await clip_detector.detect_clips(
            audio_path=audio_path,
            config=config,
            on_progress=on_progress,
            youtube_captions=youtube_captions,
        )

        result["video_url"] = job.result.get("video_url")
        result["video_id"] = job.result.get("video_id")
        result["video_meta"] = job.result.get("video_meta")

        await job_queue.update_job(
            analysis_job.job_id, status="completed", progress=1.0,
            message=f"Found {len(result.get('clips', []))} clips.",
            result=result,
        )

    await job_queue.run_job(analysis_job.job_id, _analyze())

    return {
        "job_id": analysis_job.job_id,
        "message": "Analysis started.",
        "parent_job_id": request.job_id,
    }


@router.post("/clips")
async def generate_clips(request: GenerateClipsRequest):
    """Generate selected clips as reels from a single analyzed YouTube video.

    Requires a completed analysis job (from /analyze). Downloads only the
    selected segments from the original video, applies reframe + captions,
    and exports as platform-ready MP4s.
    """
    job = await job_queue.get_job(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired.")

    if not request.selected_clips:
        raise HTTPException(status_code=400, detail="No clips selected for generation.")

    # Get the single source video from the analysis result
    video_url = None
    transcript_segments = None
    video_id = None
    if job.result:
        video_url = job.result.get("video_url")
        video_id = job.result.get("video_id")
        transcript_segments = job.result.get("transcript_segments")

    if not video_url:
        raise HTTPException(
            status_code=400,
            detail="No source video found for this job. Run /ingest then /analyze first.",
        )

    logger.info("Generating %d reels from video %s", len(request.selected_clips), video_id or video_url[:50])

    gen_job = await job_queue.create_job()

    async def _generate():
        import os

        config = ReelConfig(
            output_format=request.output_format,
            caption_style=request.caption_style,
            auto_reframe=request.auto_reframe,
            add_hook=request.add_hook,
            resolution=request.resolution,
        )

        try:
            total = len(request.selected_clips)
            # Use the ingest job's directory (where audio was downloaded)
            # Find the ingest job_id from the video_id path
            ingest_job_id = request.job_id
            output_dir = youtube_service._job_dir(ingest_job_id)
            clips_dir = os.path.join(output_dir, "clips")
            os.makedirs(clips_dir, exist_ok=True)

            # Step 1: Download the full video ONCE
            await job_queue.update_job(
                gen_job.job_id, status="downloading", progress=0.05,
                message="Downloading full video (one-time)...",
            )

            full_video = await youtube_service.download_full_video(video_url, ingest_job_id)

            # Step 2: Cut each clip from the full video using FFmpeg
            clips_data = []
            for i, clip in enumerate(request.selected_clips):
                progress = 0.10 + (i / total) * 0.30
                await job_queue.update_job(
                    gen_job.job_id, status="downloading", progress=progress,
                    message=f"Cutting clip {i + 1} of {total} ({clip.start:.0f}s-{clip.end:.0f}s)...",
                )

                clip_video = await youtube_service.cut_clip(
                    full_video, ingest_job_id, clip.clip_index, clip.start, clip.end,
                )
                clips_data.append({
                    "clip_index": clip.clip_index,
                    "start": clip.start,
                    "end": clip.end,
                    "title": clip.title,
                    "video_path": clip_video,
                })

            # Step 3: Generate reels (reframe + captions) from the cut clips
            generated = []
            for i, clip_data in enumerate(clips_data):
                progress = 0.40 + (i / total) * 0.55
                await job_queue.update_job(
                    gen_job.job_id, status="generating", progress=progress,
                    message=f"Generating reel {i + 1} of {total}...",
                )

                # Filter and re-timestamp transcript segments for this clip
                clip_transcript = None
                if transcript_segments:
                    clip_start = clip_data["start"]
                    clip_end = clip_data["end"]
                    clip_transcript = []
                    for seg in transcript_segments:
                        seg_start = seg.get("start", 0)
                        seg_end = seg.get("end", 0)
                        if seg_start >= clip_start and seg_end <= clip_end + 0.5:
                            adjusted = dict(seg)
                            adjusted["start"] = seg_start - clip_start
                            adjusted["end"] = seg_end - clip_start
                            if "words" in adjusted:
                                adjusted["words"] = [
                                    {**w, "start": w["start"] - clip_start, "end": w["end"] - clip_start}
                                    for w in adjusted["words"]
                                ]
                            clip_transcript.append(adjusted)

                result = await reel_generator.generate_reel(
                    video_path=clip_data["video_path"],
                    clip_index=clip_data["clip_index"],
                    start=0,  # already cut by FFmpeg
                    end=clip_data["end"] - clip_data["start"],
                    output_dir=clips_dir,
                    config=config,
                    transcript_segments=clip_transcript,
                )
                generated.append(result.to_dict())

            await job_queue.update_job(
                gen_job.job_id, status="completed", progress=1.0,
                message=f"Generated {len(generated)} reels.",
                result={"clips": generated},
            )

        except Exception as e:
            logger.exception("Clip generation failed")
            await job_queue.update_job(
                gen_job.job_id, status="failed",
                error=str(e)[:500],
            )

    await job_queue.run_job(gen_job.job_id, _generate())

    return {
        "job_id": gen_job.job_id,
        "message": f"Generating {len(request.selected_clips)} clips.",
    }


# ── ZIP Download ──────────────────────────────────────────────────────


@router.get("/download/{job_id}")
async def download_clips_zip(job_id: str):
    """Download all generated clips as a ZIP archive."""
    import io
    import os
    import zipfile
    from fastapi.responses import StreamingResponse

    job = await job_queue.get_job(job_id)
    if not job or job.status != "completed" or not job.result:
        raise HTTPException(status_code=404, detail="No completed generation job found.")

    clips = job.result.get("clips", [])
    if not clips:
        raise HTTPException(status_code=404, detail="No generated clips found.")

    # Build ZIP in memory
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for clip in clips:
            file_path = clip.get("file_path", "")
            if os.path.exists(file_path):
                arcname = os.path.basename(file_path)
                zf.write(file_path, arcname)

            # Include thumbnail if exists
            thumb_path = clip.get("thumbnail_path", "")
            if thumb_path and os.path.exists(thumb_path):
                zf.write(thumb_path, os.path.basename(thumb_path))

        # Include a manifest JSON
        import json
        zf.writestr("clips.json", json.dumps(clips, indent=2))

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=opencut_reels_{job_id}.zip"},
    )


# ── Single File Download ──────────────────────────────────────────────


@router.get("/download-clip/{job_id}/{clip_index}")
async def download_single_clip(job_id: str, clip_index: int):
    """Download a single generated clip by index."""
    import os
    from fastapi.responses import FileResponse

    job = await job_queue.get_job(job_id)
    if not job or job.status != "completed" or not job.result:
        raise HTTPException(status_code=404, detail="No completed generation job found.")

    clips = job.result.get("clips", [])
    target = None
    for clip in clips:
        if clip.get("clip_index") == clip_index:
            target = clip
            break

    if not target:
        raise HTTPException(status_code=404, detail=f"Clip {clip_index} not found.")

    file_path = target.get("file_path", "")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Clip file not found on disk.")

    filename = f"reel_{clip_index + 1}.mp4"
    return FileResponse(
        file_path,
        media_type="video/mp4",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Platform Presets ──────────────────────────────────────────────────


PLATFORM_PRESETS = {
    "instagram_reels": {"width": 1080, "height": 1920, "aspect": "9:16", "max_duration": 90, "bitrate": "8M", "codec": "libx264"},
    "tiktok": {"width": 1080, "height": 1920, "aspect": "9:16", "max_duration": 60, "bitrate": "8M", "codec": "libx264"},
    "youtube_shorts": {"width": 1080, "height": 1920, "aspect": "9:16", "max_duration": 60, "bitrate": "10M", "codec": "libx264"},
    "square": {"width": 1080, "height": 1080, "aspect": "1:1", "max_duration": 60, "bitrate": "8M", "codec": "libx264"},
}


@router.get("/presets")
async def get_platform_presets():
    """Get available platform export presets."""
    return {"presets": PLATFORM_PRESETS}
