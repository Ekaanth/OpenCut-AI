"""Face presence analyzer — scores face ratio against 30-40% optimal target.

Research shows 30-40% face presence in frames is optimal for engagement,
with early face presence (first 3 seconds) being more important than
overall percentage.
"""

import asyncio
import logging
import os
import tempfile

import httpx

from app.config import settings
from app.models.engagement import FacePresenceScore

logger = logging.getLogger(__name__)

OPTIMAL_LOW = 0.30
OPTIMAL_HIGH = 0.40
OPTIMAL_CENTER = 0.35


class FacePresenceAnalyzer:
    """Analyze face presence ratio in a video and score against optimal target."""

    async def analyze(
        self,
        video_path: str,
        sample_interval: float = 0.5,
        max_samples: int = 120,
    ) -> FacePresenceScore:
        """Analyze face presence in a video.

        Samples frames at the given interval and sends them to the face
        service for detection. Returns ratio, optimality, and score.
        """
        try:
            result = await self._detect_faces(video_path, sample_interval, max_samples)
        except (httpx.ConnectError, httpx.TimeoutException):
            logger.debug("Face service not available for presence analysis")
            return FacePresenceScore(
                face_ratio=0,
                is_optimal=False,
                early_face_present=False,
                composite=50.0,  # neutral when unavailable
            )
        except Exception:
            logger.debug("Face presence analysis failed", exc_info=True)
            return FacePresenceScore(composite=50.0)

        frames = result.get("frames", [])
        if not frames:
            return FacePresenceScore(composite=40.0)

        total_frames = len(frames)
        face_frames = sum(1 for f in frames if f.get("faces"))
        face_ratio = face_frames / total_frames if total_frames > 0 else 0.0

        # Check early face (first 3 seconds)
        early_face = any(
            f.get("faces") for f in frames if f.get("timestamp", 99) <= 3.0
        )

        # Score: peak at 35% face presence, degrades in both directions
        ratio_score = 100 - abs(face_ratio - OPTIMAL_CENTER) * 200
        ratio_score = max(0, min(100, ratio_score))

        # Bonus for early face
        if early_face:
            ratio_score = min(100, ratio_score + 15)

        return FacePresenceScore(
            face_ratio=round(face_ratio, 3),
            is_optimal=OPTIMAL_LOW <= face_ratio <= OPTIMAL_HIGH,
            early_face_present=early_face,
            composite=round(ratio_score, 1),
        )

    async def _detect_faces(
        self, video_path: str, sample_interval: float, max_samples: int
    ) -> dict:
        """Send video to face service for detection."""
        async with httpx.AsyncClient(timeout=60) as client:
            with open(video_path, "rb") as f:
                files = {"file": (os.path.basename(video_path), f, "video/mp4")}
                data = {
                    "sample_interval": str(sample_interval),
                    "max_samples": str(max_samples),
                }
                resp = await client.post(
                    f"{settings.FACE_SERVICE_URL}/detect",
                    files=files,
                    data=data,
                )
                resp.raise_for_status()
                return resp.json()


# Module-level singleton
face_presence_analyzer = FacePresenceAnalyzer()
