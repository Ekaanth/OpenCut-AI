"""Streaming utilities for LLM-backed endpoints.

Provides helpers to wrap long-running LLM operations in a StreamingResponse
that sends keepalive pings, preventing frontend timeouts on slow hardware.

Usage in routes:
    from app.services.stream_utils import streamed_llm_response

    @router.post("/my-endpoint")
    async def my_endpoint(request: MyRequest):
        async def _run():
            data = await llm_backend.generate_json(prompt=..., system=...)
            # ... post-process data ...
            return {"result": "value"}

        return streamed_llm_response(_run)
"""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

KEEPALIVE_INTERVAL = 5  # seconds between pings


def streamed_llm_response(
    work: Callable[[], Awaitable[Any]],
    error_status: int = 500,
    error_detail: str = "Operation failed.",
) -> StreamingResponse:
    """Wrap an async LLM operation in a StreamingResponse with keepalive pings.

    Sends `{"ping": true}` every 5 seconds while the work function runs,
    then sends `{"result": ...}` with the final output.
    On error, sends `{"error": "..."}`.

    The frontend should use `requestWithKeepalive<T>()` to consume this stream.
    """

    async def _stream():
        task = asyncio.create_task(work())
        try:
            while not task.done():
                try:
                    await asyncio.wait_for(asyncio.shield(task), timeout=KEEPALIVE_INTERVAL)
                    # Task completed
                    break
                except asyncio.TimeoutError:
                    # Still running — send keepalive
                    yield json.dumps({"ping": True}) + "\n"

            result = task.result()
            yield json.dumps({"result": result}) + "\n"

        except Exception as exc:
            logger.exception("Streamed LLM operation failed")
            if not task.done():
                task.cancel()
            yield json.dumps({"error": str(exc) or error_detail}) + "\n"

    return StreamingResponse(
        _stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
