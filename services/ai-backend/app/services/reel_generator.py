"""Reel generation pipeline — download, reframe, caption, export.

Takes selected clip segments and produces platform-ready short-form
videos with auto-reframe (16:9 → 9:16), captions, and optional
engagement enhancements.
"""

import asyncio
import logging
import os
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class ReelConfig:
    def __init__(
        self,
        output_format: str = "9:16",
        caption_style: str = "modern",
        auto_reframe: bool = True,
        add_hook: bool = False,
        resolution: str = "1080",
    ):
        self.output_format = output_format
        self.caption_style = caption_style
        self.auto_reframe = auto_reframe
        self.add_hook = add_hook
        self.resolution = resolution

    @property
    def dimensions(self) -> tuple[int, int]:
        res = int(self.resolution)
        dims = {
            "9:16": (res, int(res * 16 / 9)),
            "1:1": (res, res),
            "4:5": (res, int(res * 5 / 4)),
        }
        return dims.get(self.output_format, (1080, 1920))


class GeneratedClip:
    def __init__(self, clip_index: int, file_path: str, duration: float,
                 file_size_mb: float, thumbnail_path: str | None = None):
        self.clip_index = clip_index
        self.file_path = file_path
        self.duration = duration
        self.file_size_mb = file_size_mb
        self.thumbnail_path = thumbnail_path

    def to_dict(self) -> dict:
        return {
            "clip_index": self.clip_index,
            "file_path": self.file_path,
            "duration": self.duration,
            "file_size_mb": round(self.file_size_mb, 2),
            "thumbnail_path": self.thumbnail_path,
        }


class ReelGenerator:
    """Generates platform-ready reels from video clips."""

    async def generate_reel(
        self,
        video_path: str,
        clip_index: int,
        start: float,
        end: float,
        output_dir: str,
        config: ReelConfig,
        transcript_segments: list[dict] | None = None,
    ) -> GeneratedClip:
        """Generate a single reel from a video clip.

        Pipeline:
        1. Extract the clip segment
        2. Auto-reframe to target aspect ratio
        3. Add captions if transcript available
        4. Export as platform-ready MP4
        """
        output_path = os.path.join(output_dir, f"reel_{clip_index:03d}.mp4")
        duration = end - start

        # Trim and copy the original video as-is — no overlays, no filters
        input_args = ["-ss", str(start), "-t", str(duration)]

        cmd = ["ffmpeg"]
        cmd.extend(input_args)
        cmd.extend(["-i", video_path])
        cmd.extend([
            "-c:v", "copy",
            "-c:a", "copy",
            "-movflags", "+faststart",
            "-avoid_negative_ts", "make_zero",
            "-y", output_path,
        ])

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            error = stderr.decode()[-500:]
            raise RuntimeError(f"FFmpeg reel generation failed: {error}")

        if not os.path.exists(output_path):
            raise RuntimeError("Reel generation completed but output file not found.")

        # Generate thumbnail from the middle of the clip
        thumb_path = await self._generate_thumbnail(output_path, output_dir, clip_index, duration)

        file_size = os.path.getsize(output_path) / (1024 * 1024)

        return GeneratedClip(
            clip_index=clip_index,
            file_path=output_path,
            duration=round(duration, 2),
            file_size_mb=file_size,
            thumbnail_path=thumb_path,
        )

    async def generate_batch(
        self,
        video_path: str,
        clips: list[dict],
        output_dir: str,
        config: ReelConfig,
        transcript_segments: list[dict] | None = None,
        on_progress: Any = None,
    ) -> list[GeneratedClip]:
        """Generate multiple reels sequentially with progress reporting."""
        results = []
        total = len(clips)

        for i, clip in enumerate(clips):
            if on_progress:
                await on_progress(
                    "generating",
                    (i / total) * 0.9 + 0.05,
                    f"Generating clip {i + 1} of {total}...",
                )

            # Get transcript segments for this clip's time range
            clip_segments = None
            if transcript_segments:
                clip_segments = [
                    seg for seg in transcript_segments
                    if seg.get("start", 0) >= clip["start"] and seg.get("end", 0) <= clip["end"]
                ]

            try:
                result = await self.generate_reel(
                    video_path=video_path,
                    clip_index=clip.get("clip_index", i),
                    start=clip["start"],
                    end=clip["end"],
                    output_dir=output_dir,
                    config=config,
                    transcript_segments=clip_segments,
                )
                results.append(result)
            except Exception as e:
                logger.error("Failed to generate clip %d: %s", i, e)
                # Continue with remaining clips

        return results

    def _build_caption_filter(
        self,
        segments: list[dict],
        clip_start: float,
        clip_end: float,
        width: int,
        height: int,
        style: str,
    ) -> str | None:
        """Build FFmpeg drawtext filter for captions.

        Supports styles: modern (word highlight), classic (sentence blocks).
        """
        # Collect words with timestamps relative to clip start
        words = []
        for seg in segments:
            for w in seg.get("words", []):
                ws = w.get("start", 0) - clip_start
                we = w.get("end", 0) - clip_start
                if ws >= 0 and we <= (clip_end - clip_start + 0.5):
                    words.append({"text": w.get("word", ""), "start": ws, "end": we})

        if not words:
            # Fallback: use segment text
            for seg in segments:
                ss = seg.get("start", 0) - clip_start
                se = seg.get("end", 0) - clip_start
                if ss >= 0:
                    words.append({"text": seg.get("text", ""), "start": ss, "end": se})

        if not words:
            return None

        # Group words into lines (~5 words each for readability)
        lines = []
        current_line = []
        for w in words:
            current_line.append(w)
            if len(current_line) >= 5 or w["text"].rstrip().endswith((".", "!", "?", ",")):
                text = " ".join(x["text"] for x in current_line).strip()
                if text:
                    lines.append({
                        "text": text,
                        "start": current_line[0]["start"],
                        "end": current_line[-1]["end"],
                    })
                current_line = []

        if current_line:
            text = " ".join(x["text"] for x in current_line).strip()
            if text:
                lines.append({
                    "text": text,
                    "start": current_line[0]["start"],
                    "end": current_line[-1]["end"],
                })

        if not lines:
            return None

        # Build drawtext filters for each line
        # Position: center-bottom, within safe zone (65-80% of height)
        y_pos = int(height * 0.75)
        font_size = max(24, width // 18)

        style_configs = {
            "modern": {"fontcolor": "white", "box": "1", "boxcolor": "black@0.6", "boxborderw": "8"},
            "classic": {"fontcolor": "white", "borderw": "2", "bordercolor": "black"},
            "karaoke": {"fontcolor": "yellow", "box": "1", "boxcolor": "black@0.7", "boxborderw": "6"},
        }
        sc = style_configs.get(style, style_configs["modern"])

        drawtext_parts = []
        for line in lines:
            # FFmpeg drawtext requires escaping: \ first, then ', :, ;, [, ]
            escaped_text = (
                line["text"]
                .replace("\\", "\\\\")
                .replace("'", "\u2019")  # Replace with unicode right quote
                .replace(":", "\\:")
                .replace(";", "\\;")
                .replace("[", "\\[")
                .replace("]", "\\]")
            )
            # Escape commas in enable expression to avoid filter chain delimiter conflict
            enable = f"between(t\\,{line['start']:.2f}\\,{line['end']:.2f})"

            part = (
                f"drawtext=text='{escaped_text}'"
                f":fontsize={font_size}"
                f":fontcolor={sc.get('fontcolor', 'white')}"
                f":x=(w-text_w)/2:y={y_pos}"
                f":enable='{enable}'"
            )
            if sc.get("box"):
                part += f":box={sc['box']}:boxcolor={sc['boxcolor']}:boxborderw={sc.get('boxborderw', '5')}"
            if sc.get("borderw"):
                part += f":borderw={sc['borderw']}:bordercolor={sc['bordercolor']}"

            drawtext_parts.append(part)

        return ",".join(drawtext_parts) if drawtext_parts else None

    def _build_hook_overlay(
        self,
        transcript_segments: list[dict],
        clip_start: float,
        width: int,
        height: int,
    ) -> str | None:
        """Build a text hook overlay for the first 1.5 seconds.

        Uses the opening words of the transcript as a hook text.
        """
        # Get the first sentence
        first_text = ""
        for seg in transcript_segments:
            text = seg.get("text", "").strip()
            if text:
                first_text = text
                break

        if not first_text or len(first_text) < 5:
            return None

        # Truncate to first ~8 words for hook
        words = first_text.split()[:8]
        hook_text = " ".join(words)
        if len(words) == 8 and not hook_text.endswith((".", "!", "?")):
            hook_text += "..."

        escaped = hook_text.replace("'", "\\'").replace(":", "\\:")
        font_size = max(28, width // 14)
        y_pos = int(height * 0.35)

        return (
            f"drawtext=text='{escaped}'"
            f":fontsize={font_size}"
            f":fontcolor=white"
            f":x=(w-text_w)/2:y={y_pos}"
            f":box=1:boxcolor=black@0.7:boxborderw=12"
            f":enable='between(t,0,1.8)'"
        )

    async def _generate_thumbnail(
        self, video_path: str, output_dir: str, clip_index: int, duration: float,
    ) -> str | None:
        """Extract thumbnail from the highest-energy moment in the clip."""
        thumb_path = os.path.join(output_dir, f"reel_{clip_index:03d}_thumb.jpg")

        # Try to find the energy peak for the best thumbnail frame
        seek = duration / 2  # default: middle
        try:
            from app.services.engagement.audio_intelligence import audio_intelligence
            envelope = await audio_intelligence.energy_envelope(video_path, resolution_hz=4)
            if envelope:
                peak_idx = envelope.index(max(envelope))
                seek = min(duration - 0.5, peak_idx / 4.0)
        except Exception:
            pass  # fall back to middle

        cmd = [
            "ffmpeg", "-ss", str(seek),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "3",
            "-y", thumb_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()

        return thumb_path if os.path.exists(thumb_path) else None


# Module-level singleton
reel_generator = ReelGenerator()
