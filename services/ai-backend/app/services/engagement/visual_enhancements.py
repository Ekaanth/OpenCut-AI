"""Visual engagement enhancements — color arc, safe zones, contrast, loop detection.

Provides:
- Warm-to-cool color arc FFmpeg filter generation
- Platform safe zone constants and validation
- Text contrast checking against video background
- Seamless loop point detection
"""

import asyncio
import logging
import math
import struct
from typing import Any

logger = logging.getLogger(__name__)


# ── Color Arc ─────────────────────────────────────────────────────────


class ColorArcGenerator:
    """Generate neuroscience-optimized color grading filters.

    Research: warm colors increase attention at the start of content,
    cool colors increase attention at the end.
    """

    def generate_ffmpeg_filter(
        self,
        duration: float,
        intensity: str = "medium",
    ) -> str:
        """Create FFmpeg filter that transitions warm → cool over clip duration.

        First 20%: warm shift
        Middle 60%: neutral
        Last 20%: cool shift
        """
        warm_end = duration * 0.20
        cool_start = duration * 0.80

        # Intensity presets
        temps = {
            "subtle": (6700, 6500, 6300),
            "medium": (6800, 6500, 6200),
            "strong": (7000, 6500, 6000),
        }
        warm_t, neutral_t, cool_t = temps.get(intensity, temps["medium"])

        return (
            f"colortemperature=temperature={warm_t}:enable='between(t,0,{warm_end:.2f})',"
            f"colortemperature=temperature={neutral_t}:enable='between(t,{warm_end:.2f},{cool_start:.2f})',"
            f"colortemperature=temperature={cool_t}:enable='between(t,{cool_start:.2f},{duration:.2f})'"
        )


# ── Safe Zones ────────────────────────────────────────────────────────


class PlatformSafeZone:
    """Caption safe zone constants per platform."""

    ZONES = {
        "instagram_reels": {"top_pct": 0.15, "bottom_pct": 0.20, "safe_y_start": 0.15, "safe_y_end": 0.80},
        "tiktok": {"top_pct": 0.12, "bottom_pct": 0.22, "safe_y_start": 0.12, "safe_y_end": 0.78},
        "youtube_shorts": {"top_pct": 0.10, "bottom_pct": 0.18, "safe_y_start": 0.10, "safe_y_end": 0.82},
        "default": {"top_pct": 0.15, "bottom_pct": 0.20, "safe_y_start": 0.15, "safe_y_end": 0.80},
    }

    @classmethod
    def get_safe_y_range(cls, platform: str = "default", height: int = 1920) -> tuple[int, int]:
        """Get the safe Y pixel range for text placement."""
        zone = cls.ZONES.get(platform, cls.ZONES["default"])
        y_start = int(height * zone["safe_y_start"])
        y_end = int(height * zone["safe_y_end"])
        return y_start, y_end

    @classmethod
    def is_in_safe_zone(cls, y_position: int, height: int, platform: str = "default") -> bool:
        """Check if a Y position is within the safe zone."""
        y_start, y_end = cls.get_safe_y_range(platform, height)
        return y_start <= y_position <= y_end

    @classmethod
    def clamp_to_safe_zone(cls, y_position: int, height: int, platform: str = "default") -> int:
        """Clamp a Y position to within the safe zone."""
        y_start, y_end = cls.get_safe_y_range(platform, height)
        return max(y_start, min(y_end, y_position))


# ── Text Contrast ─────────────────────────────────────────────────────


class TextContrastChecker:
    """Check caption text contrast against video background."""

    MIN_CONTRAST_RATIO = 4.5  # WCAG AA standard

    async def check_contrast(
        self,
        video_path: str,
        timestamps: list[float],
        text_region_y_pct: float = 0.75,
    ) -> list[dict]:
        """Sample background luminance at caption timestamps.

        Returns list of {timestamp, luminance, passes, suggestion}.
        """
        results = []

        for ts in timestamps:
            luminance = await self._sample_luminance(video_path, ts, text_region_y_pct)

            # White text on dark bg: contrast = (L_text + 0.05) / (L_bg + 0.05)
            # For white text (L=1.0)
            contrast_white = (1.0 + 0.05) / (luminance + 0.05)
            passes = contrast_white >= self.MIN_CONTRAST_RATIO

            suggestion = None
            if not passes:
                if luminance > 0.5:
                    suggestion = "Background is too bright for white text. Add a dark text shadow or background box."
                else:
                    suggestion = "Low contrast detected. Add a semi-transparent background behind captions."

            results.append({
                "timestamp": ts,
                "bg_luminance": round(luminance, 3),
                "contrast_ratio": round(contrast_white, 2),
                "passes_wcag_aa": passes,
                "suggestion": suggestion,
            })

        return results

    async def _sample_luminance(self, video_path: str, timestamp: float, y_pct: float) -> float:
        """Extract average luminance from a frame region using FFmpeg."""
        # Extract a single frame, crop to text region, get average brightness
        cmd = [
            "ffmpeg", "-ss", str(timestamp),
            "-i", video_path,
            "-vframes", "1",
            "-vf", f"crop=iw:ih*0.1:0:ih*{y_pct:.2f},format=gray",
            "-f", "rawvideo", "-pix_fmt", "gray",
            "-y", "pipe:1",
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()

        if not stdout:
            return 0.2  # assume dark background as default

        # Average pixel value → luminance (0-1)
        total = sum(stdout)
        avg = total / len(stdout) if stdout else 128
        return avg / 255.0


# ── Loop Detection ────────────────────────────────────────────────────


class LoopDetector:
    """Detect opportunities for seamless video loops.

    Loop videos get significantly more rewatches, which algorithms
    interpret as high engagement.
    """

    async def find_loop_point(self, video_path: str) -> dict | None:
        """Compare first and last frames/audio for similarity.

        Returns {can_loop, trim_end_to, confidence} or None.
        """
        # Get video duration
        duration = await self._get_duration(video_path)
        if duration < 5:
            return None

        # Extract first and last frames as raw grayscale
        first_frame = await self._extract_frame_raw(video_path, 0.1)
        last_frame = await self._extract_frame_raw(video_path, duration - 0.1)

        if not first_frame or not last_frame:
            return None

        # Compute structural similarity (simple mean absolute difference)
        visual_sim = self._compute_similarity(first_frame, last_frame)

        # Compare audio energy
        first_energy = await self._audio_energy(video_path, 0, 0.5)
        last_energy = await self._audio_energy(video_path, duration - 0.5, duration)
        energy_match = abs(first_energy - last_energy) < 0.15 if (first_energy > 0 or last_energy > 0) else True

        can_loop = visual_sim > 0.7 and energy_match

        if can_loop:
            # Find the best trim point in the last 2 seconds
            trim_to = await self._find_best_cut(video_path, duration)
            return {
                "can_loop": True,
                "trim_end_to": round(trim_to, 2),
                "confidence": round(visual_sim, 3),
                "visual_similarity": round(visual_sim, 3),
                "energy_match": energy_match,
            }

        return {
            "can_loop": False,
            "confidence": round(visual_sim, 3),
            "visual_similarity": round(visual_sim, 3),
            "energy_match": energy_match,
        }

    async def _extract_frame_raw(self, video_path: str, timestamp: float) -> bytes | None:
        """Extract a frame as small grayscale raw bytes."""
        cmd = [
            "ffmpeg", "-ss", str(timestamp),
            "-i", video_path,
            "-vframes", "1",
            "-vf", "scale=80:60,format=gray",
            "-f", "rawvideo", "-pix_fmt", "gray",
            "-y", "pipe:1",
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        return stdout if stdout and len(stdout) > 100 else None

    def _compute_similarity(self, frame1: bytes, frame2: bytes) -> float:
        """Compute similarity between two frames (0-1, higher = more similar)."""
        min_len = min(len(frame1), len(frame2))
        if min_len == 0:
            return 0.0

        total_diff = sum(abs(a - b) for a, b in zip(frame1[:min_len], frame2[:min_len]))
        avg_diff = total_diff / min_len
        # Normalize: 0 diff = 1.0 similarity, 128 avg diff = 0.0
        return max(0, 1.0 - avg_diff / 128.0)

    async def _audio_energy(self, video_path: str, start: float, end: float) -> float:
        """Compute RMS energy for a time range."""
        duration = end - start
        cmd = [
            "ffmpeg", "-ss", str(start), "-t", str(duration),
            "-i", video_path,
            "-f", "s16le", "-acodec", "pcm_s16le",
            "-ar", "16000", "-ac", "1",
            "-y", "pipe:1",
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()

        if not stdout or len(stdout) < 100:
            return 0.0

        n = len(stdout) // 2
        samples = struct.unpack(f"<{n}h", stdout[:n * 2])
        return math.sqrt(sum(s * s for s in samples) / n) / 32768.0

    async def _find_best_cut(self, video_path: str, duration: float) -> float:
        """Find the best loop cut point in the last 2 seconds."""
        first_frame = await self._extract_frame_raw(video_path, 0.1)
        if not first_frame:
            return duration

        best_time = duration
        best_sim = 0

        # Check frames at 0.25s intervals in the last 2 seconds
        for offset in [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]:
            check_time = duration - offset
            if check_time < duration * 0.5:
                break

            frame = await self._extract_frame_raw(video_path, check_time)
            if frame:
                sim = self._compute_similarity(first_frame, frame)
                if sim > best_sim:
                    best_sim = sim
                    best_time = check_time

        return best_time

    async def _get_duration(self, video_path: str) -> float:
        import json as _json
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "json", video_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        try:
            return float(_json.loads(stdout.decode())["format"]["duration"])
        except Exception:
            return 0


# ── Singletons ────────────────────────────────────────────────────────

color_arc_generator = ColorArcGenerator()
platform_safe_zone = PlatformSafeZone()
text_contrast_checker = TextContrastChecker()
loop_detector = LoopDetector()
