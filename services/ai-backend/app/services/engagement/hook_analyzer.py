"""Hook analysis engine — analyzes the first 3 seconds of a clip.

Computes a composite hook score (0-100) from multiple signals:
- Visual novelty (frame-to-frame motion)
- Audio energy spike (first 3s vs clip average)
- Early face presence (face in first 3 seconds)
- Hook type classification (LLM-powered)
- Speech rate
"""

import asyncio
import logging
import math
import struct
import tempfile
from pathlib import Path

import httpx

from app.config import settings
from app.models.engagement import HookScore

logger = logging.getLogger(__name__)

HOOK_WINDOW = 3.0  # seconds to analyze


class HookAnalyzer:
    """Analyzes the first 3 seconds of a clip for hook strength."""

    async def analyze(
        self,
        *,
        audio_path: str | None = None,
        video_path: str | None = None,
        transcript_start: str = "",
        clip_duration: float = 30.0,
    ) -> HookScore:
        """Run all hook signals in parallel and compute composite score."""
        tasks = {}

        if video_path:
            tasks["visual"] = self._visual_novelty(video_path)
        if audio_path:
            tasks["audio"] = self._audio_energy_spike(audio_path, clip_duration)
        if video_path:
            tasks["face"] = self._early_face_presence(video_path)
        if transcript_start:
            tasks["hook_type"] = self._classify_hook_type(transcript_start)
        if audio_path and transcript_start:
            tasks["speech_rate"] = self._speech_rate(transcript_start, min(HOOK_WINDOW, clip_duration))

        results = {}
        if tasks:
            gathered = await asyncio.gather(
                *tasks.values(),
                return_exceptions=True,
            )
            for key, result in zip(tasks.keys(), gathered):
                if isinstance(result, Exception):
                    logger.warning("Hook signal '%s' failed: %s", key, result)
                    results[key] = None
                else:
                    results[key] = result

        # Extract values with fallbacks
        visual_score = results.get("visual") or 0.0
        audio_score = results.get("audio") or 0.0
        face_result = results.get("face")
        early_face = face_result if isinstance(face_result, bool) else False
        hook_type_result = results.get("hook_type") or ("neutral", 0.0)
        hook_type, hook_confidence = hook_type_result
        speech_rate_val = results.get("speech_rate") or 0.0

        # Compute hook type score
        hook_type_scores = {
            "bold_statement": 85,
            "question": 80,
            "proof_first": 75,
            "pattern_interrupt": 90,
            "combination": 95,
            "neutral": 30,
        }
        hook_type_score = hook_type_scores.get(hook_type, 30) * max(0.5, hook_confidence)

        # Face presence bonus
        face_score = 80.0 if early_face else 40.0

        # Speech rate score (3-5 wps is optimal for hooks)
        speech_score = min(100, max(0, speech_rate_val * 25)) if speech_rate_val > 0 else 50.0

        # Composite
        composite = (
            visual_score * 0.25
            + audio_score * 0.20
            + face_score * 0.15
            + hook_type_score * 0.30
            + speech_score * 0.10
        )

        return HookScore(
            visual_novelty=round(visual_score, 1),
            audio_energy_spike=round(audio_score, 1),
            early_face_present=early_face,
            hook_type=hook_type,
            hook_type_confidence=round(hook_confidence, 2),
            speech_rate=round(speech_rate_val, 2),
            composite=round(min(100, max(0, composite)), 1),
        )

    async def _visual_novelty(self, video_path: str) -> float:
        """Measure frame-to-frame pixel difference in first 3 seconds.

        High difference = motion/cuts = pattern interrupt. Returns 0-100.
        """
        # Extract frames at 5fps for the first 3 seconds (15 frames)
        with tempfile.TemporaryDirectory() as tmpdir:
            cmd = [
                "ffmpeg", "-i", video_path,
                "-t", str(HOOK_WINDOW),
                "-vf", "fps=5,scale=160:90",
                "-f", "rawvideo", "-pix_fmt", "gray",
                "-y", f"{tmpdir}/frames.raw",
            ]
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()

            raw_path = Path(tmpdir) / "frames.raw"
            if not raw_path.exists() or raw_path.stat().st_size == 0:
                return 50.0  # neutral if no frames

            raw = raw_path.read_bytes()
            frame_size = 160 * 90  # grayscale pixels per frame
            num_frames = len(raw) // frame_size

            if num_frames < 2:
                return 30.0

            # Compute mean absolute difference between consecutive frames
            total_diff = 0.0
            for i in range(1, num_frames):
                prev = raw[(i - 1) * frame_size : i * frame_size]
                curr = raw[i * frame_size : (i + 1) * frame_size]
                diff = sum(abs(a - b) for a, b in zip(prev, curr))
                total_diff += diff / frame_size  # average per pixel

            avg_diff = total_diff / (num_frames - 1)
            # Normalize: 0 diff = 0 score, 30+ avg pixel diff = 100
            return min(100, (avg_diff / 30.0) * 100)

    async def _audio_energy_spike(self, audio_path: str, clip_duration: float) -> float:
        """Compare audio RMS in first 3s vs clip average. Returns 0-100."""
        hook_rms = await self._compute_rms(audio_path, 0, HOOK_WINDOW)
        full_rms = await self._compute_rms(audio_path, 0, clip_duration)

        if full_rms < 0.001:
            return 50.0  # silence

        ratio = hook_rms / full_rms
        # ratio > 1.5 = very strong hook, ratio ~1.0 = average, ratio < 0.7 = weak
        score = min(100, max(0, (ratio - 0.5) * 80))
        return score

    async def _compute_rms(self, audio_path: str, start: float, end: float) -> float:
        """Compute RMS energy for a time range using FFmpeg."""
        duration = end - start
        cmd = [
            "ffmpeg", "-i", audio_path,
            "-ss", str(start), "-t", str(duration),
            "-f", "s16le", "-acodec", "pcm_s16le",
            "-ar", "16000", "-ac", "1",
            "-y", "pipe:1",
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()

        if not stdout or len(stdout) < 100:
            return 0.0

        n_samples = len(stdout) // 2
        samples = struct.unpack(f"<{n_samples}h", stdout[:n_samples * 2])
        rms = math.sqrt(sum(s * s for s in samples) / n_samples) / 32768.0
        return rms

    async def _early_face_presence(self, video_path: str) -> bool:
        """Check if a face is detected in the first 3 seconds via face service."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                with open(video_path, "rb") as f:
                    files = {"file": ("video.mp4", f, "video/mp4")}
                    data = {"sample_interval": "1.0", "max_samples": "3"}
                    resp = await client.post(
                        f"{settings.FACE_SERVICE_URL}/detect",
                        files=files,
                        data=data,
                    )
                    if resp.status_code == 200:
                        result = resp.json()
                        frames = result.get("frames", [])
                        # Check if any frame in first 3s has faces
                        for frame in frames:
                            if frame.get("timestamp", 99) <= HOOK_WINDOW and frame.get("faces"):
                                return True
                        return False
        except (httpx.ConnectError, httpx.TimeoutException):
            logger.debug("Face service not available for hook analysis")
        except Exception:
            logger.debug("Face detection in hook analysis failed", exc_info=True)
        return False

    async def _classify_hook_type(self, transcript_start: str) -> tuple[str, float]:
        """Classify the opening statement into a hook formula.

        Returns (hook_type, confidence). Falls back to rule-based when LLM unavailable.
        """
        # Rule-based fallback first (fast, always available)
        text = transcript_start.strip().lower()
        if "?" in transcript_start[:100]:
            return ("question", 0.8)
        if any(w in text[:80] for w in ["never", "always", "everyone", "nobody", "wrong", "myth", "lie", "truth"]):
            return ("bold_statement", 0.7)
        if any(w in text[:80] for w in ["$", "million", "percent", "%", "made", "earned", "revenue"]):
            return ("proof_first", 0.7)

        # Try LLM classification
        try:
            from app.services.model_backend import llm_backend

            available = await llm_backend.check_available()
            if not available:
                return ("neutral", 0.5)

            prompt = f"""Classify this video opening into exactly one hook type. Respond with JSON only.

Opening: "{transcript_start[:200]}"

Hook types:
- "bold_statement": Declarative claim challenging conventional wisdom
- "question": Opens with a specific question creating curiosity
- "pattern_interrupt": Unexpected or jarring opening
- "proof_first": Leads with results, credentials, or evidence
- "combination": Uses two or more of the above
- "neutral": None of the above

Respond: {{"type": "hook_type", "confidence": 0.0-1.0}}"""

            data = await llm_backend.generate_json(prompt=prompt)
            hook_type = data.get("type", "neutral")
            confidence = float(data.get("confidence", 0.5))
            valid_types = {"bold_statement", "question", "pattern_interrupt", "proof_first", "combination", "neutral"}
            if hook_type not in valid_types:
                hook_type = "neutral"
            return (hook_type, min(1.0, max(0.0, confidence)))

        except Exception:
            logger.debug("LLM hook classification failed, using rule-based", exc_info=True)
            return ("neutral", 0.5)

    async def _speech_rate(self, transcript_start: str, duration: float) -> float:
        """Calculate words per second in the opening."""
        if duration <= 0:
            return 0.0
        words = len(transcript_start.split())
        # Clamp to first ~3 seconds worth of words (assuming ~3 wps average)
        max_words = int(duration * 5)
        words = min(words, max_words)
        return words / duration


# Module-level singleton
hook_analyzer = HookAnalyzer()
