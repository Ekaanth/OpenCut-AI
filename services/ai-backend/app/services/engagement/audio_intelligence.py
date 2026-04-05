"""Audio intelligence service — beat detection, BPM, energy, sync points.

Uses FFmpeg-based audio analysis for beat detection and energy analysis.
BeatNet/Madmom are optional dependencies — falls back to FFmpeg-only
analysis when they're not installed.

Provides:
- Beat detection with downbeat marking
- BPM and energy classification
- Beat drop detection (sudden energy spikes)
- Continuous energy envelope
- Sync point generation (aligns captions to beats)
"""

import asyncio
import json
import logging
import math
import struct
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ── Models ────────────────────────────────────────────────────────────


class BeatPosition(BaseModel):
    timestamp: float
    is_downbeat: bool = False
    confidence: float = 1.0


class BPMResult(BaseModel):
    bpm: float
    energy_class: str  # "high", "medium", "calm"
    confidence: float = 0.8


class DropEvent(BaseModel):
    timestamp: float
    intensity: float = Field(ge=0, le=1)
    duration: float = 0.5


class SyncPoint(BaseModel):
    timestamp: float
    event_type: str  # "word_reveal", "emphasis", "visual_transition", "text_card"
    target_word: str | None = None


class AudioAnalysis(BaseModel):
    bpm: BPMResult | None = None
    beats: list[BeatPosition] = Field(default_factory=list)
    drops: list[DropEvent] = Field(default_factory=list)
    energy_envelope: list[float] = Field(default_factory=list)
    sync_points: list[SyncPoint] = Field(default_factory=list)
    audio_sync_score: float = 50.0


# ── Service ───────────────────────────────────────────────────────────


class AudioIntelligence:
    """Beat detection, energy analysis, and sync point generation."""

    async def analyze(
        self,
        audio_path: str,
        word_timestamps: list[dict] | None = None,
    ) -> AudioAnalysis:
        """Full audio analysis for engagement optimization."""
        # Run beats first since BPM depends on it (avoids double detection)
        beats: list[BeatPosition] = []
        try:
            beats = await self.detect_beats(audio_path)
        except Exception as e:
            logger.warning("Beat detection failed: %s", e)

        # Run remaining analyses in parallel
        bpm_task = self._compute_bpm_from_beats(beats)
        drops_task = self.detect_drops(audio_path)
        envelope_task = self.energy_envelope(audio_path)

        results = await asyncio.gather(
            bpm_task, drops_task, envelope_task,
            return_exceptions=True,
        )

        bpm = results[0] if not isinstance(results[0], Exception) else None
        drops = results[1] if not isinstance(results[1], Exception) else []
        envelope = results[2] if not isinstance(results[2], Exception) else []

        for i, r in enumerate(results):
            if isinstance(r, Exception):
                logger.warning("Audio analysis step %d failed: %s", i, r)

        # Generate sync points if word timestamps provided
        sync_points = []
        if word_timestamps and beats:
            sync_points = self.generate_sync_points(beats, drops, word_timestamps)

        # Compute audio sync score
        sync_score = self._compute_sync_score(beats, drops, word_timestamps)

        return AudioAnalysis(
            bpm=bpm,
            beats=beats,
            drops=drops,
            energy_envelope=envelope,
            sync_points=sync_points,
            audio_sync_score=sync_score,
        )

    async def detect_beats(self, audio_path: str) -> list[BeatPosition]:
        """Detect beat positions using onset detection via FFmpeg.

        Falls back to energy-based peak detection when BeatNet unavailable.
        """
        # Try BeatNet first if installed
        try:
            return await self._beatnet_detect(audio_path)
        except (ImportError, Exception):
            pass

        # Fallback: FFmpeg onset detection
        return await self._ffmpeg_onset_detect(audio_path)

    async def detect_bpm(self, audio_path: str) -> BPMResult:
        """Detect BPM and classify energy level (runs beat detection internally)."""
        beats = await self.detect_beats(audio_path)
        return await self._compute_bpm_from_beats(beats)

    async def _compute_bpm_from_beats(self, beats: list[BeatPosition]) -> BPMResult:
        """Compute BPM from pre-detected beats (avoids duplicate detection)."""
        if len(beats) < 4:
            return BPMResult(bpm=0, energy_class="calm", confidence=0.3)

        # Compute average inter-beat interval
        intervals = []
        for i in range(1, len(beats)):
            diff = beats[i].timestamp - beats[i - 1].timestamp
            if 0.2 < diff < 2.0:  # reasonable range
                intervals.append(diff)

        if not intervals:
            return BPMResult(bpm=0, energy_class="calm", confidence=0.3)

        avg_interval = sum(intervals) / len(intervals)
        bpm = 60.0 / avg_interval

        # Classify energy
        if bpm >= 120:
            energy_class = "high"
        elif bpm >= 90:
            energy_class = "medium"
        else:
            energy_class = "calm"

        # Confidence based on consistency of intervals
        variance = sum((i - avg_interval) ** 2 for i in intervals) / len(intervals)
        confidence = max(0.3, min(1.0, 1.0 - variance * 5))

        return BPMResult(bpm=round(bpm, 1), energy_class=energy_class, confidence=round(confidence, 2))

    async def detect_drops(self, audio_path: str) -> list[DropEvent]:
        """Find sudden energy spikes — optimal for visual transitions."""
        envelope = await self.energy_envelope(audio_path, resolution_hz=20)

        if len(envelope) < 10:
            return []

        drops = []
        window = 10  # 0.5 seconds at 20Hz

        for i in range(window, len(envelope)):
            current = envelope[i]
            prev_avg = sum(envelope[i - window : i]) / window

            if prev_avg > 0.01 and current > prev_avg * 2.5:
                timestamp = i / 20.0
                intensity = min(1.0, (current - prev_avg) / max(prev_avg, 0.01))

                # Avoid duplicate drops within 1 second
                if not drops or timestamp - drops[-1].timestamp > 1.0:
                    drops.append(DropEvent(
                        timestamp=round(timestamp, 2),
                        intensity=round(intensity, 3),
                    ))

        return drops

    async def energy_envelope(self, audio_path: str, resolution_hz: float = 10) -> list[float]:
        """Compute continuous energy curve at specified resolution."""
        cmd = [
            "ffmpeg", "-i", audio_path,
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

        if not stdout or len(stdout) < 200:
            return []

        sample_rate = 16000
        n_samples = len(stdout) // 2
        samples = struct.unpack(f"<{n_samples}h", stdout[:n_samples * 2])

        window_size = int(sample_rate / resolution_hz)
        envelope = []

        for i in range(0, n_samples, window_size):
            chunk = samples[i : i + window_size]
            if len(chunk) < 10:
                break
            rms = math.sqrt(sum(s * s for s in chunk) / len(chunk)) / 32768.0
            envelope.append(round(rms, 4))

        # Normalize to 0-1
        if envelope:
            max_val = max(envelope) or 1.0
            envelope = [round(v / max_val, 4) for v in envelope]

        return envelope

    def generate_sync_points(
        self,
        beats: list[BeatPosition],
        drops: list[DropEvent],
        word_timestamps: list[dict],
    ) -> list[SyncPoint]:
        """Align caption reveals and visual events to beats."""
        sync_points = []
        beat_times = [b.timestamp for b in beats]

        for word in word_timestamps:
            word_start = word.get("start", 0)
            word_text = word.get("word", word.get("text", ""))

            # Snap word to nearest beat within 150ms tolerance
            nearest_beat = self._find_nearest(word_start, beat_times, tolerance=0.15)
            if nearest_beat is not None:
                sync_points.append(SyncPoint(
                    timestamp=nearest_beat,
                    event_type="word_reveal",
                    target_word=word_text,
                ))

                # Check if this beat is a downbeat
                for b in beats:
                    if abs(b.timestamp - nearest_beat) < 0.01 and b.is_downbeat:
                        sync_points.append(SyncPoint(
                            timestamp=nearest_beat,
                            event_type="emphasis",
                            target_word=word_text,
                        ))
                        break
            else:
                # No beat nearby — use speech timing
                sync_points.append(SyncPoint(
                    timestamp=word_start,
                    event_type="word_reveal",
                    target_word=word_text,
                ))

        # Add visual transitions at drop points
        for drop in drops:
            sync_points.append(SyncPoint(
                timestamp=drop.timestamp,
                event_type="visual_transition",
            ))

        sync_points.sort(key=lambda s: s.timestamp)
        return sync_points

    def _compute_sync_score(
        self,
        beats: list[BeatPosition],
        drops: list[DropEvent],
        word_timestamps: list[dict] | None,
    ) -> float:
        """Score how well captions would align with detected beats."""
        if not beats:
            return 50.0  # neutral when no beats
        if not word_timestamps:
            return 50.0

        beat_times = [b.timestamp for b in beats]
        aligned = 0
        total = len(word_timestamps)

        for word in word_timestamps:
            nearest = self._find_nearest(word.get("start", 0), beat_times, tolerance=0.15)
            if nearest is not None:
                aligned += 1

        if total == 0:
            return 50.0

        alignment_ratio = aligned / total
        # Scale: 0% aligned = 30, 50%+ aligned = 90+
        return round(min(100, 30 + alignment_ratio * 120), 1)

    def _find_nearest(self, target: float, candidates: list[float], tolerance: float) -> float | None:
        """Find the nearest candidate within tolerance."""
        best = None
        best_dist = tolerance

        for c in candidates:
            dist = abs(c - target)
            if dist < best_dist:
                best = c
                best_dist = dist

        return best

    async def _beatnet_detect(self, audio_path: str) -> list[BeatPosition]:
        """Try to use BeatNet for beat detection (runs in thread pool to avoid blocking)."""
        from BeatNet.BeatNet import BeatNet

        def _run():
            estimator = BeatNet(
                1, mode="offline", inference_model="DBN", plot=[], thread=False,
            )
            return estimator.process(audio_path)

        loop = asyncio.get_event_loop()
        output = await loop.run_in_executor(None, _run)

        beats = []
        for beat_info in output:
            timestamp = float(beat_info[0])
            beat_num = int(beat_info[1])
            beats.append(BeatPosition(
                timestamp=round(timestamp, 3),
                is_downbeat=(beat_num == 1),
                confidence=0.9,
            ))

        return beats

    async def _ffmpeg_onset_detect(self, audio_path: str) -> list[BeatPosition]:
        """Fallback: detect onsets using FFmpeg's energy derivative."""
        envelope = await self.energy_envelope(audio_path, resolution_hz=50)

        if len(envelope) < 20:
            return []

        # Find peaks in the energy derivative
        beats = []
        threshold = 0.05
        min_gap = 0.2  # minimum 200ms between beats (300 BPM max)

        for i in range(2, len(envelope)):
            # Derivative: current - previous
            deriv = envelope[i] - envelope[i - 1]
            prev_deriv = envelope[i - 1] - envelope[i - 2]

            # Peak in derivative = onset
            if deriv > threshold and deriv > prev_deriv:
                timestamp = i / 50.0

                if not beats or timestamp - beats[-1].timestamp > min_gap:
                    beats.append(BeatPosition(
                        timestamp=round(timestamp, 3),
                        is_downbeat=(len(beats) % 4 == 0),
                        confidence=0.6,
                    ))

        return beats


# Module-level singleton
audio_intelligence = AudioIntelligence()
