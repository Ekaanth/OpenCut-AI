"""Multi-signal clip detection and scoring.

Orchestrates transcription, energy analysis, topic detection,
and LLM scoring to find the best clip-worthy moments in long-form content.
"""

import asyncio
import json
import logging
import os
from typing import Any

import httpx

from app.config import settings
from app.models.engagement import ScoredClip, ScoreClipRequest
from app.services.engagement.scorer import engagement_scorer
from app.services.model_backend import llm_backend
from app.services.stream_utils import streamed_llm_response

logger = logging.getLogger(__name__)


class ClipDetectionConfig:
    def __init__(
        self,
        min_duration: float = 15.0,
        max_duration: float = 90.0,
        max_clips: int = 10,
        language: str | None = None,
    ):
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.max_clips = max_clips
        self.language = language


class ClipDetector:
    """Detects the best clip-worthy moments in long-form audio/video."""

    async def detect_clips(
        self,
        audio_path: str,
        config: ClipDetectionConfig,
        on_progress: Any = None,
        youtube_captions: list[dict] | None = None,
    ) -> dict:
        """Full clip detection pipeline.

        If youtube_captions are provided (downloaded from YouTube's existing
        subtitles), uses those directly — skipping Whisper transcription entirely.
        Falls back to Whisper only when no YouTube captions are available.

        Returns dict with 'clips', 'transcript_segments', 'total_duration', 'language'.
        """
        # Step 1: Use YouTube captions if available, otherwise transcribe
        if youtube_captions:
            if on_progress:
                await on_progress("analyzing", 0.20, f"Using YouTube captions ({len(youtube_captions)} segments)...")
            segments = youtube_captions
            language = config.language or "en"
        else:
            if on_progress:
                await on_progress("transcribing", 0.15, "No YouTube captions found, transcribing with Whisper...")
            segments, language = await self._transcribe(audio_path, config.language)

        if not segments:
            return {"clips": [], "transcript_segments": [], "total_duration": 0, "language": "unknown"}

        total_duration = max(s.get("end", 0) for s in segments) if segments else 0

        # Step 2: Find clip candidates via LLM
        if on_progress:
            await on_progress("analyzing", 0.50, "Finding clip-worthy moments...")

        raw_clips = await self._find_clips_llm(segments, config, total_duration)

        # Step 3: Clean up and deduplicate
        if on_progress:
            await on_progress("analyzing", 0.65, "Cleaning clip boundaries...")

        cleaned = self._cleanup_clips(raw_clips, segments, config, total_duration)

        # Step 4: Score engagement for each clip
        if on_progress:
            await on_progress("scoring", 0.75, f"Scoring {len(cleaned)} clips for engagement...")

        scored_clips = await self._score_clips(cleaned, segments, audio_path)

        # Sort by engagement score descending
        scored_clips.sort(key=lambda c: c.engagement.composite, reverse=True)

        if on_progress:
            await on_progress("completed", 1.0, f"Found {len(scored_clips)} clips")

        def _serialize_clip(c: ScoredClip) -> dict:
            data = c.model_dump()
            # Add computed properties that model_dump() misses
            data["duration"] = c.duration
            data["engagement"] = c.engagement.to_response()
            return data

        return {
            "clips": [_serialize_clip(c) for c in scored_clips],
            "transcript_segments": segments,
            "total_duration": round(total_duration, 2),
            "language": language or "unknown",
        }

    async def _transcribe(self, audio_path: str, language: str | None) -> tuple[list[dict], str | None]:
        """Transcribe audio via the Whisper service, chunking if needed."""
        # Get audio duration
        duration = await self._get_duration(audio_path)

        # For shorter audio (<30 min), send directly to Whisper
        # For longer audio, chunk into 30-min segments
        chunk_duration = 1800  # 30 minutes
        if duration <= chunk_duration * 1.1:
            return await self._transcribe_chunk(audio_path, language)

        # Chunk the audio
        all_segments = []
        detected_lang = language
        num_chunks = int(duration / chunk_duration) + 1

        for i in range(num_chunks):
            start = i * chunk_duration
            end = min((i + 1) * chunk_duration + 5, duration)  # 5s overlap
            if start >= duration:
                break

            chunk_path = audio_path.rsplit(".", 1)[0] + f"_chunk{i}.wav"
            try:
                await self._extract_audio_segment(audio_path, chunk_path, start, end)
                chunk_segments, lang = await self._transcribe_chunk(chunk_path, language)
                if not detected_lang and lang:
                    detected_lang = lang

                # Offset timestamps
                for seg in chunk_segments:
                    seg["start"] = round(seg.get("start", 0) + start, 3)
                    seg["end"] = round(seg.get("end", 0) + start, 3)
                    for w in seg.get("words", []):
                        w["start"] = round(w.get("start", 0) + start, 3)
                        w["end"] = round(w.get("end", 0) + start, 3)

                all_segments.extend(chunk_segments)
            finally:
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)

        # Deduplicate overlapping segments at chunk boundaries
        all_segments = self._deduplicate_segments(all_segments)

        return all_segments, detected_lang

    async def _transcribe_chunk(self, audio_path: str, language: str | None) -> tuple[list[dict], str | None]:
        """Send a single audio file to the Whisper service for transcription."""
        try:
            async with httpx.AsyncClient(timeout=600) as client:
                with open(audio_path, "rb") as f:
                    files = {"file": (os.path.basename(audio_path), f, "audio/wav")}
                    data: dict[str, str] = {}
                    if language:
                        data["language"] = language

                    resp = await client.post(
                        f"{settings.WHISPER_SERVICE_URL}/transcribe",
                        files=files,
                        data=data,
                    )

                    if resp.status_code != 200:
                        logger.error("Whisper transcription failed: %s", resp.text[:300])
                        return [], None

                    result = resp.json()
                    segments = result.get("segments", [])
                    lang = result.get("language")
                    return segments, lang

        except httpx.ConnectError:
            logger.error("Whisper service not available at %s", settings.WHISPER_SERVICE_URL)
            raise RuntimeError(
                "Whisper transcription service is not available. "
                "Start it with: docker compose up -d whisper-service"
            )

    async def _find_clips_llm(
        self, segments: list[dict], config: ClipDetectionConfig, total_duration: float
    ) -> list[dict]:
        """Use LLM to find clip-worthy moments in the transcript."""
        available = await llm_backend.check_available()
        if not available:
            # Fallback: split into even segments
            logger.warning("LLM not available, using even-split fallback for clip detection")
            return self._fallback_even_split(segments, config, total_duration)

        # Build transcript text with timestamps
        transcript_lines = []
        for seg in segments:
            transcript_lines.append(f"[{seg.get('start', 0):.1f}s-{seg.get('end', 0):.1f}s] {seg.get('text', '')}")

        # Chunk transcript to fit context window (~4k tokens), splitting on newlines
        full_text = "\n".join(transcript_lines)
        max_chars = 12000  # ~3k tokens
        chunks = self._split_on_newlines(full_text, max_chars)

        all_clips = []
        for chunk_idx, chunk in enumerate(chunks):
            prompt = f"""You are a viral content editor. Analyze this transcript and find the most engaging moments for short-form clips (TikTok, YouTube Shorts, Reels).

Each clip should be {config.min_duration:.0f}-{config.max_duration:.0f} seconds long.

Score each clip 0-100 based on:
- Viral potential (controversial takes, surprising facts, humor)
- Emotional intensity (passion, surprise, laughter)
- Standalone value (makes sense without context)
- Hook strength (grabs attention in first 2 seconds)

Transcript (part {chunk_idx + 1}/{len(chunks)}):
{chunk}

Respond with JSON: {{"clips": [{{"title": "catchy title", "start": float, "end": float, "score": int, "reason": "why engaging", "tags": ["tag1"]}}]}}

Return up to {config.max_clips} clips. Only clips scoring 40+. Sort by score descending."""

            try:
                data = await llm_backend.generate_json(prompt=prompt)
                clips = data.get("clips", [])
                all_clips.extend(clips)
            except Exception as e:
                logger.warning("LLM clip finding failed for chunk %d: %s", chunk_idx, e)

        return all_clips

    def _fallback_even_split(
        self, segments: list[dict], config: ClipDetectionConfig, total_duration: float
    ) -> list[dict]:
        """Fallback when LLM is unavailable: split transcript at natural pauses."""
        clips = []
        target_duration = (config.min_duration + config.max_duration) / 2
        current_start = 0.0

        for seg in segments:
            seg_end = seg.get("end", 0)
            if seg_end - current_start >= target_duration:
                clips.append({
                    "title": seg.get("text", "Clip")[:50],
                    "start": current_start,
                    "end": seg_end,
                    "score": 50,
                    "reason": "Auto-detected segment",
                    "tags": [],
                })
                current_start = seg_end

                if len(clips) >= config.max_clips:
                    break

        return clips

    def _cleanup_clips(
        self, raw_clips: list[dict], segments: list[dict], config: ClipDetectionConfig, total_duration: float
    ) -> list[dict]:
        """Validate, deduplicate, and snap clip boundaries to sentence edges."""
        validated = []
        for clip in raw_clips:
            start = max(0, float(clip.get("start", 0)))
            end = min(total_duration, float(clip.get("end", start + 30)))

            # Enforce duration limits
            duration = end - start
            if duration < config.min_duration * 0.5:
                continue
            if duration > config.max_duration * 1.2:
                end = start + config.max_duration

            # Snap to sentence boundaries
            start, end = self._snap_to_sentence(start, end, segments)

            validated.append({
                "title": str(clip.get("title", "Untitled")),
                "start": round(start, 2),
                "end": round(end, 2),
                "score": max(0, min(100, int(clip.get("score", 50)))),
                "reason": str(clip.get("reason", "")),
                "tags": [str(t) for t in clip.get("tags", [])],
            })

        # Remove overlapping clips (keep higher scored)
        validated.sort(key=lambda c: c["score"], reverse=True)
        non_overlapping = []
        for clip in validated:
            clip_duration = clip["end"] - clip["start"]
            if clip_duration <= 0:
                continue

            overlaps = False
            for existing in non_overlapping:
                overlap_start = max(clip["start"], existing["start"])
                overlap_end = min(clip["end"], existing["end"])
                if overlap_end > overlap_start:
                    overlap_ratio = (overlap_end - overlap_start) / clip_duration
                    if overlap_ratio > 0.3:
                        overlaps = True
                        break
            if not overlaps:
                non_overlapping.append(clip)

            if len(non_overlapping) >= config.max_clips:
                break

        return non_overlapping

    def _snap_to_sentence(self, start: float, end: float, segments: list[dict]) -> tuple[float, float]:
        """Adjust start/end to nearest sentence boundary."""
        # Find nearest segment start for clip start
        best_start = start
        min_start_dist = float("inf")
        for seg in segments:
            seg_start = seg.get("start", 0)
            dist = abs(seg_start - start)
            if dist < min_start_dist and dist < 3.0:
                min_start_dist = dist
                best_start = seg_start

        # Find nearest segment end for clip end
        best_end = end
        min_end_dist = float("inf")
        for seg in segments:
            seg_end = seg.get("end", 0)
            dist = abs(seg_end - end)
            if dist < min_end_dist and dist < 3.0:
                min_end_dist = dist
                best_end = seg_end

        return best_start, best_end

    async def _score_clips(
        self, clips: list[dict], segments: list[dict], audio_path: str
    ) -> list[ScoredClip]:
        """Run engagement scoring on each clip candidate."""
        scored = []
        for i, clip in enumerate(clips):
            # Gather transcript for this clip's time range
            clip_text = " ".join(
                seg.get("text", "")
                for seg in segments
                if seg.get("start", 0) >= clip["start"] and seg.get("end", 0) <= clip["end"]
            )
            clip_segments = [
                seg for seg in segments
                if seg.get("start", 0) >= clip["start"] and seg.get("end", 0) <= clip["end"]
            ]

            req = ScoreClipRequest(
                audio_path=audio_path,
                transcript_text=clip_text,
                transcript_segments=clip_segments,
                start=clip["start"],
                end=clip["end"],
                title=clip.get("title", ""),
            )

            try:
                engagement = await engagement_scorer.score_clip(req)
            except Exception as e:
                logger.warning("Engagement scoring failed for clip %d: %s", i, e)
                from app.models.engagement import EngagementScore
                engagement = EngagementScore()

            scored.append(ScoredClip(
                index=i,
                title=clip.get("title", f"Clip {i + 1}"),
                start=clip["start"],
                end=clip["end"],
                transcript_preview=clip_text[:200],
                tags=clip.get("tags", []),
                engagement=engagement,
            ))

        return scored

    def _deduplicate_segments(self, segments: list[dict]) -> list[dict]:
        """Remove duplicate segments at chunk boundaries."""
        if not segments:
            return segments

        segments.sort(key=lambda s: s.get("start", 0))
        deduped = [segments[0]]

        for seg in segments[1:]:
            prev = deduped[-1]
            # If this segment overlaps significantly with the previous one, skip it
            if seg.get("start", 0) < prev.get("end", 0) - 0.5:
                # Keep the longer one
                if seg.get("end", 0) > prev.get("end", 0):
                    deduped[-1] = seg
            else:
                deduped.append(seg)

        return deduped

    def _split_on_newlines(self, text: str, max_chars: int) -> list[str]:
        """Split text at newline boundaries near the max_chars limit."""
        if len(text) <= max_chars:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = start + max_chars
            if end >= len(text):
                chunks.append(text[start:])
                break
            # Find the last newline before the limit
            split_at = text.rfind("\n", start, end)
            if split_at <= start:
                split_at = end  # no newline found, hard split
            chunks.append(text[start:split_at])
            start = split_at + 1

        return chunks

    async def _get_duration(self, audio_path: str) -> float:
        """Get audio duration using ffprobe."""
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "json", audio_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        try:
            return float(json.loads(stdout.decode())["format"]["duration"])
        except Exception:
            return 0

    async def _extract_audio_segment(self, src: str, dst: str, start: float, end: float) -> None:
        """Extract a time range from an audio file using FFmpeg."""
        cmd = [
            "ffmpeg", "-i", src,
            "-ss", str(start), "-t", str(end - start),
            "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            "-y", dst,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()


# Module-level singleton
clip_detector = ClipDetector()
