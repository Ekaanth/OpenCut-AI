"""Export / render routes using FFmpeg."""

import asyncio
import logging
import os
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["export"])


class RenderRequest(BaseModel):
    """Request to render/export a video project."""

    input_path: str = Field(..., description="Path to the source video file")
    output_format: str = Field(default="mp4", description="Output format: mp4, webm, mov")
    resolution: str = Field(default="1920x1080", description="Output resolution WxH")
    fps: int = Field(default=30, ge=1, le=120, description="Output frame rate")
    video_codec: str = Field(default="libx264", description="Video codec")
    audio_codec: str = Field(default="aac", description="Audio codec")
    video_bitrate: str = Field(default="5M", description="Video bitrate")
    audio_bitrate: str = Field(default="192k", description="Audio bitrate")
    preset: str = Field(
        default="medium",
        description="Encoding preset: ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow",
    )
    # Trim parameters
    start_time: float | None = Field(default=None, description="Start time in seconds")
    end_time: float | None = Field(default=None, description="End time in seconds")


class RenderResponse(BaseModel):
    output_path: str
    duration: float
    file_size_mb: float


@router.post("/render", response_model=RenderResponse)
async def render_video(request: RenderRequest) -> RenderResponse:
    """Render/export a video using FFmpeg.

    Applies the specified encoding settings and optional trimming.
    """
    if not os.path.exists(request.input_path):
        raise HTTPException(status_code=404, detail="Input file not found.")

    output_filename = f"export_{uuid.uuid4().hex[:8]}.{request.output_format}"
    output_path = os.path.join(settings.GENERATED_DIR, output_filename)

    width, height = request.resolution.split("x")

    cmd = ["ffmpeg", "-y"]

    # Input trimming
    if request.start_time is not None:
        cmd.extend(["-ss", str(request.start_time)])
    cmd.extend(["-i", request.input_path])
    if request.end_time is not None:
        if request.start_time is not None:
            duration = request.end_time - request.start_time
            cmd.extend(["-t", str(duration)])
        else:
            cmd.extend(["-to", str(request.end_time)])

    # Video settings
    cmd.extend([
        "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
        "-c:v", request.video_codec,
        "-b:v", request.video_bitrate,
        "-r", str(request.fps),
        "-preset", request.preset,
    ])

    # Audio settings
    cmd.extend([
        "-c:a", request.audio_codec,
        "-b:a", request.audio_bitrate,
    ])

    cmd.append(output_path)

    logger.info("Starting render: %s", " ".join(cmd))

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr_bytes = await proc.communicate()

    if proc.returncode != 0:
        stderr = stderr_bytes.decode("utf-8", errors="replace")
        logger.error("FFmpeg render failed: %s", stderr[-500:])
        raise HTTPException(status_code=500, detail="Video rendering failed.")

    # Get file info
    file_size = os.path.getsize(output_path) / (1024 * 1024)

    # Get duration via ffprobe
    duration = 0.0
    try:
        probe = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await probe.communicate()
        duration = float(stdout.decode().strip())
    except Exception:
        pass

    logger.info("Render complete: %s (%.1f MB, %.1fs)", output_path, file_size, duration)

    return RenderResponse(
        output_path=output_path,
        duration=round(duration, 3),
        file_size_mb=round(file_size, 2),
    )
