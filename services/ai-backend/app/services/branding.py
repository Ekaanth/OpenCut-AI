"""Custom branding service for reels.

Applies intro/outro, watermark, and logo overlays to generated clips.
Integrates with the existing brand-kit.tsx frontend component.

Branding elements:
- Intro: short video or image shown before the clip (0.5-3 seconds)
- Outro: short video or image shown after the clip (1-5 seconds)
- Watermark: small logo overlaid on a corner throughout the clip
- Logo: full-screen logo flash at start or end
"""

import asyncio
import logging
import os

logger = logging.getLogger(__name__)


class BrandingConfig:
    def __init__(
        self,
        intro_path: str | None = None,
        intro_duration: float = 1.5,
        outro_path: str | None = None,
        outro_duration: float = 2.0,
        watermark_path: str | None = None,
        watermark_position: str = "bottom_right",  # top_left, top_right, bottom_left, bottom_right
        watermark_opacity: float = 0.5,
        watermark_scale: float = 0.08,  # fraction of video width
    ):
        self.intro_path = intro_path
        self.intro_duration = intro_duration
        self.outro_path = outro_path
        self.outro_duration = outro_duration
        self.watermark_path = watermark_path
        self.watermark_position = watermark_position
        self.watermark_opacity = watermark_opacity
        self.watermark_scale = watermark_scale

    @property
    def has_branding(self) -> bool:
        return any([self.intro_path, self.outro_path, self.watermark_path])


class BrandingService:
    """Apply branding elements to generated reels."""

    async def apply_branding(
        self,
        video_path: str,
        output_path: str,
        config: BrandingConfig,
    ) -> str:
        """Apply all configured branding elements to a video.

        Returns the path to the branded video.
        """
        if not config.has_branding:
            return video_path

        current = video_path

        # Step 1: Add watermark (if configured)
        if config.watermark_path and os.path.exists(config.watermark_path):
            watermarked = output_path.rsplit(".", 1)[0] + "_wm.mp4"
            await self._add_watermark(
                current, watermarked, config.watermark_path,
                config.watermark_position, config.watermark_opacity, config.watermark_scale,
            )
            if os.path.exists(watermarked):
                if current != video_path:
                    os.remove(current)
                current = watermarked

        # Step 2: Concatenate intro + video + outro
        parts = []
        if config.intro_path and os.path.exists(config.intro_path):
            parts.append(config.intro_path)
        parts.append(current)
        if config.outro_path and os.path.exists(config.outro_path):
            parts.append(config.outro_path)

        if len(parts) > 1:
            await self._concatenate_videos(parts, output_path)
        elif current != output_path:
            os.rename(current, output_path)

        return output_path

    async def _add_watermark(
        self,
        video_path: str,
        output_path: str,
        watermark_path: str,
        position: str,
        opacity: float,
        scale: float,
    ) -> None:
        """Overlay a watermark image on the video."""
        # Position mapping
        pos_map = {
            "top_left": "x=10:y=10",
            "top_right": "x=W-w-10:y=10",
            "bottom_left": "x=10:y=H-h-10",
            "bottom_right": "x=W-w-10:y=H-h-10",
            "center": "x=(W-w)/2:y=(H-h)/2",
        }
        overlay_pos = pos_map.get(position, pos_map["bottom_right"])

        filter_str = (
            f"[1:v]scale=iw*{scale}:-1,format=rgba,"
            f"colorchannelmixer=aa={opacity}[wm];"
            f"[0:v][wm]overlay={overlay_pos}"
        )

        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-i", watermark_path,
            "-filter_complex", filter_str,
            "-c:a", "copy",
            "-y", output_path,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()

    async def _concatenate_videos(self, parts: list[str], output_path: str) -> None:
        """Concatenate multiple video segments into one."""
        import tempfile

        # Create a concat file list
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            for part in parts:
                f.write(f"file '{part}'\n")
            concat_file = f.name

        try:
            cmd = [
                "ffmpeg",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_file,
                "-c", "copy",
                "-y", output_path,
            ]

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
        finally:
            os.remove(concat_file)


class SaliencyReframer:
    """Visual saliency-guided cropping using ViNet.

    For scenes without faces (product shots, landscapes, screen recordings),
    saliency prediction determines where viewers will look, providing
    better crop positioning than simple center-crop.

    Falls back to face detection → center crop when ViNet unavailable.
    """

    def __init__(self) -> None:
        self._model = None
        self._available: bool | None = None

    @property
    def is_available(self) -> bool:
        if self._available is not None:
            return self._available
        try:
            # ViNet would be imported here if installed
            # from vinet import ViNet
            self._available = False  # Not bundled by default
            return False
        except ImportError:
            self._available = False
            return False

    async def compute_saliency_map(self, frame_path: str) -> list[list[float]] | None:
        """Compute a saliency heatmap for a single frame.

        Returns a 2D array of saliency values (0-1) or None if unavailable.
        """
        if not self.is_available:
            return None

        # ViNet inference would go here
        return None

    async def compute_crop_trajectory(
        self,
        video_path: str,
        target_width: int,
        target_height: int,
        sample_fps: float = 2.0,
    ) -> list[dict] | None:
        """Compute optimal crop position for each frame.

        Returns list of {timestamp, x, y, w, h} crop regions,
        or None if saliency is unavailable.

        Fallback chain: saliency → face detection → center crop.
        """
        if not self.is_available:
            return None

        # Would sample frames, run saliency, find crop position
        # For now, returns None to trigger fallback
        return None


# Module-level singletons
branding_service = BrandingService()
saliency_reframer = SaliencyReframer()
