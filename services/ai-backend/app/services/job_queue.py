"""Background job queue using asyncio + Redis.

Provides async job management for long-running tasks like YouTube
video processing. Job state is stored in Redis with configurable TTL.

Falls back to in-memory storage when Redis is unavailable.
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class Job:
    """Represents a background processing job."""

    __slots__ = ("job_id", "status", "progress", "message", "result", "error", "created_at", "updated_at")

    def __init__(self, job_id: str) -> None:
        self.job_id = job_id
        self.status = "queued"
        self.progress: float = 0.0
        self.message: str = "Queued"
        self.result: dict[str, Any] | None = None
        self.error: str | None = None
        self.created_at: float = time.time()
        self.updated_at: float = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Job":
        job = cls(data["job_id"])
        job.status = data.get("status", "queued")
        job.progress = data.get("progress", 0.0)
        job.message = data.get("message", "")
        job.result = data.get("result")
        job.error = data.get("error")
        job.created_at = data.get("created_at", time.time())
        job.updated_at = data.get("updated_at", time.time())
        return job


class JobQueue:
    """Manages background jobs with Redis persistence.

    Falls back to in-memory dict when Redis is unavailable.
    """

    def __init__(self) -> None:
        self._redis = None
        self._redis_checked = False
        self._memory_store: dict[str, Job] = {}
        self._tasks: dict[str, asyncio.Task] = {}
        self._ttl = settings.YOUTUBE_JOB_TTL_HOURS * 3600

    async def _get_redis(self):
        """Lazily connect to Redis. Returns None if unavailable."""
        if self._redis_checked:
            return self._redis

        self._redis_checked = True
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
            )
            await self._redis.ping()
            logger.info("Job queue connected to Redis at %s", settings.REDIS_URL)
            return self._redis
        except Exception:
            logger.info("Redis not available, using in-memory job store")
            self._redis = None
            return None

    def _redis_key(self, job_id: str) -> str:
        return f"youtube_job:{job_id}"

    async def create_job(self) -> Job:
        """Create a new job and return it."""
        job = Job(job_id=uuid.uuid4().hex[:12])
        await self._save_job(job)
        return job

    async def update_job(
        self,
        job_id: str,
        *,
        status: str | None = None,
        progress: float | None = None,
        message: str | None = None,
        result: dict | None = None,
        error: str | None = None,
    ) -> None:
        """Update specific fields of a job."""
        job = await self.get_job(job_id)
        if not job:
            return

        if status is not None:
            job.status = status
        if progress is not None:
            job.progress = progress
        if message is not None:
            job.message = message
        if result is not None:
            job.result = result
        if error is not None:
            job.error = error
        job.updated_at = time.time()

        await self._save_job(job)

    async def get_job(self, job_id: str) -> Job | None:
        """Retrieve a job by ID."""
        r = await self._get_redis()
        if r:
            try:
                data = await r.get(self._redis_key(job_id))
                if data:
                    return Job.from_dict(json.loads(data))
            except Exception:
                pass

        return self._memory_store.get(job_id)

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job."""
        task = self._tasks.get(job_id)
        if task and not task.done():
            task.cancel()

        await self.update_job(job_id, status="failed", error="Cancelled by user")
        return True

    async def run_job(self, job_id: str, coro) -> None:
        """Run an async coroutine as a background job."""
        task = asyncio.create_task(self._run_wrapper(job_id, coro))
        self._tasks[job_id] = task

    async def _run_wrapper(self, job_id: str, coro) -> None:
        """Wraps a coroutine with error handling and status updates."""
        try:
            await coro
        except asyncio.CancelledError:
            await self.update_job(job_id, status="failed", error="Cancelled")
        except Exception as exc:
            logger.exception("Job %s failed", job_id)
            await self.update_job(
                job_id,
                status="failed",
                error=str(exc)[:500],
                progress=0,
            )
        finally:
            self._tasks.pop(job_id, None)

    async def active_job_count(self) -> int:
        """Count currently running jobs."""
        return sum(1 for t in self._tasks.values() if not t.done())

    async def _save_job(self, job: Job) -> None:
        """Persist job to Redis or memory."""
        r = await self._get_redis()
        if r:
            try:
                await r.set(
                    self._redis_key(job.job_id),
                    json.dumps(job.to_dict()),
                    ex=self._ttl,
                )
                return
            except Exception:
                pass

        self._memory_store[job.job_id] = job


# Module-level singleton
job_queue = JobQueue()
