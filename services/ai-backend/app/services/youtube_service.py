"""YouTube video ingestion and processing service.

Handles:
- Video metadata fetching via yt-dlp
- Audio-only download for transcription (small: ~30MB for 2 hours)
- Segment-specific video download for selected clips
- Temporary file management
"""

import asyncio
import logging
import os
import re
import shutil
from pathlib import Path

from app.config import settings
from app.models.engagement import YouTubeVideoMeta

logger = logging.getLogger(__name__)

# Regex patterns for YouTube URLs
_YT_PATTERNS = [
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})"),
    re.compile(r"(?:https?://)?youtu\.be/([a-zA-Z0-9_-]{11})"),
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/shorts/([a-zA-Z0-9_-]{11})"),
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]{11})"),
]


def extract_video_id(url: str) -> str | None:
    """Extract YouTube video ID from various URL formats."""
    for pattern in _YT_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


class YouTubeService:
    """Service for downloading and managing YouTube video content."""

    def __init__(self) -> None:
        self._base_dir = os.path.join(settings.UPLOAD_DIR, "youtube")

    def _job_dir(self, job_id: str) -> str:
        """Get or create the directory for a job."""
        path = os.path.join(self._base_dir, job_id)
        os.makedirs(path, exist_ok=True)
        os.makedirs(os.path.join(path, "clips"), exist_ok=True)
        return path

    async def fetch_metadata(self, url: str) -> YouTubeVideoMeta:
        """Fetch video metadata using yt-dlp --dump-json without downloading."""
        video_id = extract_video_id(url)
        if not video_id:
            raise ValueError(f"Invalid YouTube URL: {url}")

        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            "--no-warnings",
            "--no-playlist",
            url,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode().strip()
            if "Private video" in error_msg or "Sign in" in error_msg:
                raise ValueError("This video is private or requires authentication.")
            if "not available" in error_msg.lower():
                raise ValueError("This video is not available.")
            if "geo" in error_msg.lower() or "country" in error_msg.lower():
                raise ValueError("This video is not available in your region.")
            raise ValueError(f"Failed to fetch video metadata: {error_msg[:200]}")

        import json
        data = json.loads(stdout.decode())

        duration = int(data.get("duration", 0))
        is_live = data.get("is_live", False) or data.get("was_live", False)

        # Validation
        if is_live:
            raise ValueError("Live streams cannot be processed. Please use a recorded video.")
        if duration < 60:
            raise ValueError("Video is too short (under 60 seconds). It's already short-form content.")

        warning = None
        if duration > settings.YOUTUBE_MAX_DURATION_SECONDS:
            raise ValueError(
                f"Video is too long ({duration // 3600}h {(duration % 3600) // 60}m). "
                f"Maximum supported duration is {settings.YOUTUBE_MAX_DURATION_SECONDS // 3600} hours."
            )
        if duration > 7200:  # 2 hours
            warning = f"Long video ({duration // 3600}h {(duration % 3600) // 60}m). Processing may take 15-30 minutes."

        return YouTubeVideoMeta(
            video_id=video_id,
            title=data.get("title", "Untitled"),
            channel_name=data.get("uploader", data.get("channel", "Unknown")),
            channel_id=data.get("channel_id", ""),
            duration_seconds=duration,
            thumbnail_url=data.get("thumbnail", ""),
            upload_date=data.get("upload_date", ""),
            view_count=data.get("view_count"),
            is_live=is_live,
            is_private=False,
            warning=warning,
        )

    async def download_audio(self, url: str, job_id: str) -> str:
        """Download only the audio track as WAV for transcription.

        Returns the path to the downloaded audio file.
        """
        job_dir = self._job_dir(job_id)
        output_path = os.path.join(job_dir, "audio.wav")

        if os.path.exists(output_path):
            return output_path

        cmd = [
            "yt-dlp",
            "-x",
            "--audio-format", "wav",
            "--audio-quality", "0",
            "--no-playlist",
            "--no-warnings",
            "-o", os.path.join(job_dir, "audio.%(ext)s"),
            url,
        ]

        logger.info("Downloading audio for job %s", job_id)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode().strip()
            raise RuntimeError(f"Audio download failed: {error_msg[:300]}")

        # yt-dlp may produce the file with a slightly different name
        if not os.path.exists(output_path):
            # Look for any audio file in the job dir
            for f in os.listdir(job_dir):
                if f.startswith("audio.") and not f.endswith(".part"):
                    src = os.path.join(job_dir, f)
                    # Convert to wav if needed
                    if not f.endswith(".wav"):
                        convert_cmd = ["ffmpeg", "-i", src, "-y", output_path]
                        p = await asyncio.create_subprocess_exec(
                            *convert_cmd,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                        )
                        await p.communicate()
                        os.remove(src)
                    else:
                        os.rename(src, output_path)
                    break

        if not os.path.exists(output_path):
            raise RuntimeError("Audio download completed but file not found.")

        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        logger.info("Audio downloaded: %s (%.1f MB)", output_path, size_mb)
        return output_path

    async def download_captions(self, url: str, job_id: str, language: str | None = None) -> list[dict] | None:
        """Download existing YouTube captions/subtitles with timestamps.

        Tries manual captions first, then auto-generated. Returns transcript
        segments in the same format as Whisper output, or None if no captions
        are available.

        This avoids running Whisper entirely for YouTube videos that already
        have captions — saving significant processing time and compute.
        """
        job_dir = self._job_dir(job_id)
        sub_lang = language or "en"

        # Try manual subs first, then auto-generated
        for sub_flag in ["--write-subs", "--write-auto-subs"]:
            cmd = [
                "yt-dlp",
                sub_flag,
                "--sub-lang", sub_lang,
                "--sub-format", "json3",
                "--skip-download",
                "--no-playlist",
                "--no-warnings",
                "-o", os.path.join(job_dir, "subs.%(ext)s"),
                url,
            ]

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()

            # Look for the downloaded subtitle file
            sub_path = None
            for f in os.listdir(job_dir):
                if f.endswith(".json3") or (f.startswith("subs") and f.endswith(".json")):
                    sub_path = os.path.join(job_dir, f)
                    break

            if sub_path and os.path.exists(sub_path):
                segments = self._parse_json3_captions(sub_path, sub_lang)
                if segments:
                    logger.info(
                        "Downloaded YouTube captions for job %s: %d segments (%s subs)",
                        job_id, len(segments), "manual" if sub_flag == "--write-subs" else "auto",
                    )
                    return segments

                # Clean up failed parse
                os.remove(sub_path)

        # Also try .vtt format as fallback
        cmd = [
            "yt-dlp",
            "--write-auto-subs",
            "--sub-lang", sub_lang,
            "--sub-format", "vtt",
            "--skip-download",
            "--no-playlist",
            "--no-warnings",
            "-o", os.path.join(job_dir, "subs.%(ext)s"),
            url,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()

        for f in os.listdir(job_dir):
            if f.endswith(".vtt"):
                sub_path = os.path.join(job_dir, f)
                segments = self._parse_vtt_captions(sub_path)
                if segments:
                    logger.info(
                        "Downloaded YouTube captions (VTT) for job %s: %d segments",
                        job_id, len(segments),
                    )
                    return segments

        logger.info("No YouTube captions available for job %s, will fall back to Whisper", job_id)
        return None

    def _parse_json3_captions(self, path: str, language: str) -> list[dict]:
        """Parse YouTube json3 subtitle format into transcript segments."""
        import json

        try:
            with open(path) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            return []

        events = data.get("events", [])
        segments = []
        seg_id = 0

        for event in events:
            # json3 events have tStartMs, dDurationMs, and segs (word segments)
            start_ms = event.get("tStartMs", 0)
            duration_ms = event.get("dDurationMs", 0)

            if duration_ms <= 0:
                continue

            start = start_ms / 1000.0
            end = (start_ms + duration_ms) / 1000.0

            # Extract text from word segments
            segs = event.get("segs", [])
            if not segs:
                continue

            text_parts = []
            words = []
            running_offset = start_ms

            for seg in segs:
                word_text = seg.get("utf8", "").strip()
                if not word_text or word_text == "\n":
                    continue

                word_offset = seg.get("tOffsetMs", 0)
                word_start = (start_ms + word_offset) / 1000.0
                # Estimate word end from next word or segment end
                word_end = min(word_start + 0.5, end)

                text_parts.append(word_text)
                words.append({
                    "word": word_text,
                    "start": round(word_start, 3),
                    "end": round(word_end, 3),
                    "confidence": 0.95,
                })

            full_text = " ".join(text_parts).strip()
            if not full_text:
                continue

            # Fix word end times (each word ends when the next begins)
            for i in range(len(words) - 1):
                words[i]["end"] = words[i + 1]["start"]
            if words:
                words[-1]["end"] = round(end, 3)

            segments.append({
                "id": seg_id,
                "text": full_text,
                "start": round(start, 3),
                "end": round(end, 3),
                "words": words,
            })
            seg_id += 1

        return segments

    def _parse_vtt_captions(self, path: str) -> list[dict]:
        """Parse WebVTT subtitle format into transcript segments."""
        import re

        try:
            with open(path, encoding="utf-8") as f:
                content = f.read()
        except OSError:
            return []

        # Parse VTT timestamp lines: 00:00:01.000 --> 00:00:04.000
        pattern = re.compile(
            r"(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})"
        )

        segments = []
        seg_id = 0
        lines = content.split("\n")
        i = 0

        while i < len(lines):
            match = pattern.match(lines[i].strip())
            if match:
                start = self._vtt_time_to_seconds(match.group(1))
                end = self._vtt_time_to_seconds(match.group(2))
                i += 1

                # Collect text lines until empty line
                text_lines = []
                while i < len(lines) and lines[i].strip():
                    # Strip VTT tags like <c>, </c>, <00:00:01.000>
                    clean = re.sub(r"<[^>]+>", "", lines[i]).strip()
                    if clean:
                        text_lines.append(clean)
                    i += 1

                text = " ".join(text_lines).strip()
                if text and end > start:
                    segments.append({
                        "id": seg_id,
                        "text": text,
                        "start": round(start, 3),
                        "end": round(end, 3),
                        "words": [],
                    })
                    seg_id += 1
            else:
                i += 1

        # Deduplicate overlapping segments (YouTube auto-subs often repeat)
        deduped = []
        for seg in segments:
            if deduped and seg["text"] == deduped[-1]["text"]:
                continue
            deduped.append(seg)

        return deduped

    @staticmethod
    def _vtt_time_to_seconds(time_str: str) -> float:
        """Convert VTT timestamp (HH:MM:SS.mmm) to seconds."""
        parts = time_str.split(":")
        h, m = int(parts[0]), int(parts[1])
        s = float(parts[2])
        return h * 3600 + m * 60 + s

    async def download_full_video(self, url: str, job_id: str) -> str:
        """Download the full video at up to 1080p (once per job).

        The full video is used as the source for cutting individual clips
        via FFmpeg, which is more reliable than yt-dlp --download-sections.
        """
        job_dir = self._job_dir(job_id)
        output_path = os.path.join(job_dir, "full_video.mp4")

        if os.path.exists(output_path):
            logger.info("Full video already downloaded for job %s", job_id)
            return output_path

        cmd = [
            "yt-dlp",
            "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "--merge-output-format", "mp4",
            "--no-playlist",
            "--no-warnings",
            "-o", os.path.join(job_dir, "full_video.%(ext)s"),
            url,
        ]

        logger.info("Downloading full video for job %s", job_id)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode().strip()
            raise RuntimeError(f"Video download failed: {error_msg[:300]}")

        # yt-dlp may produce a different extension before merging
        if not os.path.exists(output_path):
            for f in os.listdir(job_dir):
                if f.startswith("full_video.") and not f.endswith(".part"):
                    src = os.path.join(job_dir, f)
                    if not f.endswith(".mp4"):
                        convert_cmd = ["ffmpeg", "-i", src, "-c:v", "libx264", "-c:a", "aac", "-y", output_path]
                        p = await asyncio.create_subprocess_exec(
                            *convert_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                        )
                        await p.communicate()
                        os.remove(src)
                    else:
                        os.rename(src, output_path)
                    break

        if not os.path.exists(output_path):
            raise RuntimeError("Video download completed but file not found.")

        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        logger.info("Full video downloaded: %s (%.1f MB)", output_path, size_mb)
        return output_path

    async def cut_clip(
        self, full_video_path: str, job_id: str, clip_index: int, start: float, end: float
    ) -> str:
        """Cut a precise segment from the full video using FFmpeg.

        This is more reliable than yt-dlp --download-sections which can
        produce incorrect time ranges or download extra content.
        """
        job_dir = self._job_dir(job_id)
        clips_dir = os.path.join(job_dir, "clips")
        os.makedirs(clips_dir, exist_ok=True)
        output_path = os.path.join(clips_dir, f"clip_{clip_index:03d}.mp4")

        duration = end - start
        if duration <= 0:
            raise ValueError(f"Invalid clip range: {start}-{end}")

        cmd = [
            "ffmpeg",
            "-ss", str(start),
            "-i", full_video_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-avoid_negative_ts", "make_zero",
            "-y", output_path,
        ]

        logger.info("Cutting clip %d (%.1fs-%.1fs, %.1fs) for job %s", clip_index, start, end, duration, job_id)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            error = stderr.decode()[-500:]
            raise RuntimeError(f"FFmpeg clip cutting failed: {error}")

        if not os.path.exists(output_path):
            raise RuntimeError(f"Clip {clip_index} cut completed but file not found.")

        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        logger.info("Clip %d cut: %.1f MB", clip_index, size_mb)
        return output_path

    async def cleanup(self, job_id: str) -> None:
        """Remove all files for a job."""
        job_dir = os.path.join(self._base_dir, job_id)
        if os.path.exists(job_dir):
            shutil.rmtree(job_dir, ignore_errors=True)
            logger.info("Cleaned up job %s", job_id)

    async def cleanup_expired(self) -> int:
        """Remove job directories older than TTL. Returns count of removed jobs."""
        import time

        removed = 0
        ttl_seconds = settings.YOUTUBE_JOB_TTL_HOURS * 3600
        now = time.time()

        if not os.path.exists(self._base_dir):
            return 0

        for entry in os.listdir(self._base_dir):
            path = os.path.join(self._base_dir, entry)
            if not os.path.isdir(path):
                continue
            try:
                mtime = os.path.getmtime(path)
                if now - mtime > ttl_seconds:
                    shutil.rmtree(path, ignore_errors=True)
                    removed += 1
            except OSError:
                pass

        if removed:
            logger.info("Cleaned up %d expired YouTube jobs", removed)
        return removed


# Module-level singleton
youtube_service = YouTubeService()
