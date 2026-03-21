"""Silence detection service using FFmpeg silencedetect filter."""

import asyncio
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SilenceRegion:
    """A region of detected silence."""

    start: float
    end: float
    duration: float


async def detect_silences(
    audio_path: str,
    threshold_db: float | None = None,
    min_duration: float | None = None,
) -> list[SilenceRegion]:
    """Detect silence regions in an audio file using FFmpeg.

    Args:
        audio_path: Path to the audio/video file.
        threshold_db: Silence threshold in dB (default from config).
        min_duration: Minimum silence duration in seconds (default from config).

    Returns:
        List of SilenceRegion objects.
    """
    if not Path(audio_path).exists():
        raise FileNotFoundError(f"File not found: {audio_path}")

    threshold = threshold_db if threshold_db is not None else settings.SILENCE_THRESHOLD_DB
    duration = min_duration if min_duration is not None else settings.SILENCE_MIN_DURATION

    cmd = [
        "ffmpeg",
        "-i", audio_path,
        "-af", f"silencedetect=noise={threshold}dB:d={duration}",
        "-f", "null",
        "-",
    ]

    logger.info(
        "Running silence detection on '%s' (threshold=%sdB, min_duration=%ss)",
        audio_path,
        threshold,
        duration,
    )

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr_bytes = await proc.communicate()
    stderr = stderr_bytes.decode("utf-8", errors="replace")

    if proc.returncode != 0:
        logger.error("FFmpeg silencedetect failed: %s", stderr[-500:])
        raise RuntimeError("FFmpeg silencedetect failed")

    # Parse FFmpeg silencedetect output
    # Lines look like:
    #   [silencedetect @ ...] silence_start: 1.234
    #   [silencedetect @ ...] silence_end: 2.567 | silence_duration: 1.333
    starts: list[float] = []
    regions: list[SilenceRegion] = []

    start_pattern = re.compile(r"silence_start:\s*([\d.]+)")
    end_pattern = re.compile(r"silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)")

    for line in stderr.splitlines():
        start_match = start_pattern.search(line)
        if start_match:
            starts.append(float(start_match.group(1)))
            continue

        end_match = end_pattern.search(line)
        if end_match and starts:
            s = starts.pop(0)
            e = float(end_match.group(1))
            d = float(end_match.group(2))
            regions.append(SilenceRegion(start=round(s, 3), end=round(e, 3), duration=round(d, 3)))

    logger.info("Detected %d silence regions in '%s'", len(regions), audio_path)
    return regions
