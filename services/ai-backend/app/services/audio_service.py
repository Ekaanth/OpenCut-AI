"""Audio processing service (extraction and denoising)."""

import asyncio
import logging
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


async def extract_audio(video_path: str) -> str:
    """Extract audio from a video file as 16kHz mono WAV using FFmpeg.

    Args:
        video_path: Path to the video file.

    Returns:
        Path to the extracted WAV file.
    """
    if not Path(video_path).exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    output_path = str(
        Path(settings.GENERATED_DIR) / f"extracted_{uuid.uuid4().hex[:8]}.wav"
    )

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        output_path,
    ]

    logger.info("Extracting audio from '%s' -> '%s'", video_path, output_path)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr_bytes = await proc.communicate()

    if proc.returncode != 0:
        stderr = stderr_bytes.decode("utf-8", errors="replace")
        logger.error("FFmpeg audio extraction failed: %s", stderr[-500:])
        raise RuntimeError("Failed to extract audio from video")

    logger.info("Audio extracted successfully: %s", output_path)
    return output_path


async def denoise(audio_path: str, strength: float = 0.7) -> str:
    """Apply noise reduction to an audio file.

    Uses the noisereduce library for spectral-gating-based noise reduction.

    Args:
        audio_path: Path to the input audio file.
        strength: Denoising strength from 0.0 (none) to 1.0 (maximum).

    Returns:
        Path to the denoised WAV file.
    """
    if not Path(audio_path).exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    output_path = str(
        Path(settings.GENERATED_DIR) / f"denoised_{uuid.uuid4().hex[:8]}.wav"
    )

    # Run CPU-bound denoising in a thread pool
    def _denoise_sync() -> None:
        import numpy as np
        import noisereduce as nr
        import soundfile as sf

        data, sample_rate = sf.read(audio_path)

        # noisereduce expects float32
        if data.dtype != np.float32:
            data = data.astype(np.float32)

        # prop_decrease maps strength to how much noise is reduced
        reduced = nr.reduce_noise(
            y=data,
            sr=sample_rate,
            prop_decrease=strength,
            stationary=True,
        )

        sf.write(output_path, reduced, sample_rate)

    logger.info("Denoising '%s' (strength=%.2f)...", audio_path, strength)
    await asyncio.to_thread(_denoise_sync)
    logger.info("Denoised audio saved: %s", output_path)

    return output_path
