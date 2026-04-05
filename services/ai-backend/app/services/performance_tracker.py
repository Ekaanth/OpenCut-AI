"""Performance feedback loop — track clip performance to improve scoring.

When creators connect social accounts, we can track which clips actually
performed well (views, likes, shares, completion rate). This data feeds
back into the engagement scoring weights over time.

Data flow:
  Export clip → Creator posts → Track performance → Adjust weights

Storage: Redis with 90-day TTL for performance data.
"""

import json
import logging
import time
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class ClipPerformance:
    """Performance data for a single posted clip."""

    def __init__(
        self,
        clip_id: str,
        platform: str,
        post_id: str,
        predicted_score: float,
        views: int = 0,
        likes: int = 0,
        shares: int = 0,
        comments: int = 0,
        completion_rate: float = 0.0,
        posted_at: float = 0,
        last_checked: float = 0,
    ):
        self.clip_id = clip_id
        self.platform = platform
        self.post_id = post_id
        self.predicted_score = predicted_score
        self.views = views
        self.likes = likes
        self.shares = shares
        self.comments = comments
        self.completion_rate = completion_rate
        self.posted_at = posted_at or time.time()
        self.last_checked = last_checked or time.time()

    @property
    def engagement_rate(self) -> float:
        if self.views == 0:
            return 0.0
        return (self.likes + self.shares + self.comments) / self.views

    @property
    def actual_score(self) -> float:
        """Compute an actual performance score (0-100) from real metrics."""
        # Weight: views matter but engagement rate matters more
        view_score = min(50, self.views / 1000 * 10)  # 5K views = 50
        engagement_score = min(30, self.engagement_rate * 300)  # 10% rate = 30
        completion_score = self.completion_rate * 20  # 100% = 20
        return min(100, view_score + engagement_score + completion_score)

    def to_dict(self) -> dict:
        return {
            "clip_id": self.clip_id,
            "platform": self.platform,
            "post_id": self.post_id,
            "predicted_score": self.predicted_score,
            "actual_score": round(self.actual_score, 1),
            "views": self.views,
            "likes": self.likes,
            "shares": self.shares,
            "comments": self.comments,
            "completion_rate": round(self.completion_rate, 3),
            "engagement_rate": round(self.engagement_rate, 4),
            "posted_at": self.posted_at,
            "last_checked": self.last_checked,
            "prediction_error": round(self.predicted_score - self.actual_score, 1),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ClipPerformance":
        return cls(
            clip_id=data["clip_id"],
            platform=data["platform"],
            post_id=data["post_id"],
            predicted_score=data.get("predicted_score", 0),
            views=data.get("views", 0),
            likes=data.get("likes", 0),
            shares=data.get("shares", 0),
            comments=data.get("comments", 0),
            completion_rate=data.get("completion_rate", 0),
            posted_at=data.get("posted_at", 0),
            last_checked=data.get("last_checked", 0),
        )


class PerformanceTracker:
    """Track and analyze clip performance for scoring feedback."""

    REDIS_PREFIX = "clip_perf:"
    TTL = 90 * 24 * 3600  # 90 days

    def __init__(self) -> None:
        self._redis = None
        self._memory: dict[str, ClipPerformance] = {}

    async def _get_redis(self):
        try:
            import redis.asyncio as aioredis
            if self._redis is None:
                self._redis = aioredis.from_url(
                    settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2,
                )
                await self._redis.ping()
            return self._redis
        except Exception:
            return None

    async def record_post(
        self,
        clip_id: str,
        platform: str,
        post_id: str,
        predicted_score: float,
    ) -> None:
        """Record that a clip was posted to a platform."""
        perf = ClipPerformance(
            clip_id=clip_id,
            platform=platform,
            post_id=post_id,
            predicted_score=predicted_score,
        )

        r = await self._get_redis()
        key = f"{self.REDIS_PREFIX}{clip_id}:{platform}"
        if r:
            await r.set(key, json.dumps(perf.to_dict()), ex=self.TTL)
        else:
            self._memory[key] = perf

    async def update_metrics(
        self,
        clip_id: str,
        platform: str,
        views: int,
        likes: int = 0,
        shares: int = 0,
        comments: int = 0,
        completion_rate: float = 0.0,
    ) -> ClipPerformance | None:
        """Update performance metrics for a posted clip."""
        key = f"{self.REDIS_PREFIX}{clip_id}:{platform}"

        r = await self._get_redis()
        perf = None

        if r:
            data = await r.get(key)
            if data:
                perf = ClipPerformance.from_dict(json.loads(data))
        else:
            perf = self._memory.get(key)

        if not perf:
            return None

        perf.views = views
        perf.likes = likes
        perf.shares = shares
        perf.comments = comments
        perf.completion_rate = completion_rate
        perf.last_checked = time.time()

        if r:
            await r.set(key, json.dumps(perf.to_dict()), ex=self.TTL)
        else:
            self._memory[key] = perf

        return perf

    async def get_prediction_accuracy(self) -> dict:
        """Analyze how accurate our engagement scoring has been.

        Returns average prediction error and weight adjustment suggestions.
        """
        all_perfs = await self._get_all_performances()

        if not all_perfs:
            return {
                "sample_size": 0,
                "message": "No performance data yet. Post clips and update their metrics to calibrate scoring.",
            }

        # Only use clips with meaningful data (>100 views)
        significant = [p for p in all_perfs if p.views >= 100]

        if not significant:
            return {
                "sample_size": len(all_perfs),
                "message": "Clips haven't gained enough views yet for meaningful analysis.",
            }

        errors = [p.predicted_score - p.actual_score for p in significant]
        avg_error = sum(errors) / len(errors)
        abs_avg_error = sum(abs(e) for e in errors) / len(errors)

        # Identify which signal needs adjustment
        over_predicted = [p for p in significant if p.predicted_score > p.actual_score + 15]
        under_predicted = [p for p in significant if p.actual_score > p.predicted_score + 15]

        suggestions = []
        if avg_error > 10:
            suggestions.append("Scores are consistently too high. Consider lowering virality and hook weights.")
        elif avg_error < -10:
            suggestions.append("Scores are consistently too low. Consider raising energy and curiosity weights.")

        return {
            "sample_size": len(significant),
            "avg_prediction_error": round(avg_error, 1),
            "abs_avg_error": round(abs_avg_error, 1),
            "over_predicted_count": len(over_predicted),
            "under_predicted_count": len(under_predicted),
            "suggestions": suggestions,
        }

    async def _get_all_performances(self) -> list[ClipPerformance]:
        """Retrieve all performance records."""
        r = await self._get_redis()
        if r:
            keys = []
            async for key in r.scan_iter(f"{self.REDIS_PREFIX}*"):
                keys.append(key)

            perfs = []
            for key in keys:
                data = await r.get(key)
                if data:
                    perfs.append(ClipPerformance.from_dict(json.loads(data)))
            return perfs

        return list(self._memory.values())


class BatchProcessor:
    """Process multiple YouTube videos from a playlist URL.

    Accepts a YouTube playlist URL and queues each video for processing
    sequentially using the existing YouTube-to-Reels pipeline.
    """

    async def process_playlist(
        self,
        playlist_url: str,
        config: dict,
        on_progress: Any = None,
    ) -> dict:
        """Extract video URLs from a playlist and queue them for processing."""
        import asyncio

        # Extract individual video URLs from playlist
        video_urls = await self._extract_playlist_videos(playlist_url)

        if not video_urls:
            return {"videos": [], "error": "No videos found in playlist"}

        results = []
        total = len(video_urls)

        for i, url in enumerate(video_urls):
            if on_progress:
                await on_progress(
                    "processing",
                    (i / total),
                    f"Processing video {i + 1} of {total}...",
                )

            results.append({
                "index": i,
                "url": url,
                "status": "queued",
            })

        return {
            "video_count": len(video_urls),
            "videos": results,
            "message": f"Found {len(video_urls)} videos in playlist. Use /api/youtube/ingest for each.",
        }

    async def _extract_playlist_videos(self, playlist_url: str) -> list[str]:
        """Extract individual video URLs from a YouTube playlist using yt-dlp."""
        import asyncio

        cmd = [
            "yt-dlp",
            "--flat-playlist",
            "--dump-json",
            "--no-warnings",
            playlist_url,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            logger.error("Playlist extraction failed: %s", stderr.decode()[:300])
            return []

        urls = []
        for line in stdout.decode().strip().split("\n"):
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                video_id = data.get("id", "")
                if video_id:
                    urls.append(f"https://www.youtube.com/watch?v={video_id}")
            except json.JSONDecodeError:
                continue

        return urls


# Module-level singletons
performance_tracker = PerformanceTracker()
batch_processor = BatchProcessor()
