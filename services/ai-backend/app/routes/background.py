"""Video background-removal proxy routes.

Thin proxy over the image-service's per-frame rembg video pipeline. The
image-service owns the actual model work + in-process job store; this layer
just forwards create/poll requests and rewrites the result URL so the
frontend can stream the transparent WebM back through the ai-backend (which
the browser already trusts via NEXT_PUBLIC_AI_BACKEND_URL).
"""

import logging
import os

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/background", tags=["background"])

_FORWARD_TIMEOUT = 600.0


def _service_down(url: str) -> HTTPException:
    return HTTPException(
        status_code=503,
        detail=(
            f"Image service is not available at {url}. "
            "Start it with: docker compose up -d image-service"
        ),
    )


@router.post("/remove-video")
async def remove_video_background(
    file: UploadFile = File(...),
    fps: float = Form(default=8.0, ge=1.0, le=30.0),
    max_duration: float = Form(default=120.0, ge=1.0, le=600.0),
):
    """Start a video background-removal job on the image-service."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    try:
        async with httpx.AsyncClient(timeout=_FORWARD_TIMEOUT) as client:
            files = {"file": (file.filename, await file.read(), file.content_type)}
            data = {"fps": str(fps), "max_duration": str(max_duration)}
            resp = await client.post(
                f"{settings.IMAGE_SERVICE_URL}/remove-bg-video",
                files=files,
                data=data,
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise _service_down(settings.IMAGE_SERVICE_URL)
    except httpx.HTTPStatusError as e:
        try:
            detail = e.response.json().get("detail", e.response.text)
        except Exception:
            detail = e.response.text
        raise HTTPException(status_code=e.response.status_code, detail=detail)


@router.get("/job/{job_id}")
async def get_video_bg_job(job_id: str):
    """Poll a video background-removal job.

    Rewrites the result's ``videoUrl`` to point at this backend's
    ``/api/background/file/{filename}`` proxy so the browser can fetch it
    without a cross-origin request to the image-service.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.IMAGE_SERVICE_URL}/remove-bg-video/job/{job_id}"
            )
            resp.raise_for_status()
            payload = resp.json()
    except httpx.ConnectError:
        raise _service_down(settings.IMAGE_SERVICE_URL)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)

    result = payload.get("result")
    if isinstance(result, dict) and result.get("videoUrl"):
        filename = result["videoUrl"].rsplit("/", 1)[-1]
        result["videoUrl"] = f"/api/background/file/{filename}"
    return payload


@router.get("/file/{filename}")
async def stream_video_bg_file(filename: str):
    """Stream a produced transparent WebM back to the browser.

    The image-service owns the file; we proxy the bytes so the browser only
    needs the ai-backend origin.
    """
    # Guard against path traversal — only allow a bare filename.
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    upstream = f"{settings.IMAGE_SERVICE_URL}/generated/{filename}"
    try:
        # Stream the upstream response back without buffering the whole file.
        client = httpx.AsyncClient(timeout=_FORWARD_TIMEOUT)
        req = client.build_request("GET", upstream)
        resp = await client.send(req, stream=True)
    except httpx.ConnectError:
        await client.aclose()
        raise _service_down(settings.IMAGE_SERVICE_URL)

    if resp.status_code != 200:
        body = await resp.aread()
        await resp.aclose()
        await client.aclose()
        raise HTTPException(status_code=resp.status_code, detail=body.decode(errors="replace")[:200])

    async def _gen():
        try:
            async for chunk in resp.aiter_raw():
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    media = "video/webm" if filename.endswith(".webm") else "application/octet-stream"
    return StreamingResponse(_gen(), media_type=media)
