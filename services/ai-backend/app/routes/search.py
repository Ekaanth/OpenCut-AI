"""Semantic media search routes.

Proxies the OpenCut CLIP embedding microservice (services/clip-service, port 8426)
which returns L2-normalized 512-dim vectors for images and text.

Privacy: this layer NEVER persists embeddings or input frames — it only forwards
requests and returns the resulting vectors. The frontend stores the index in
IndexedDB (Origin Private File System), keeping the privacy-first promise that
no media data leaves the user's machine after the model runs.
"""

import logging
import os

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/search", tags=["search"])

# Embedding batches can take a few seconds on CPU; give the downstream
# service plenty of headroom before timing out.
_FORWARD_TIMEOUT = 300.0


class EmbedTextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)


class EmbedTextsRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=32)


def _service_down(url: str) -> HTTPException:
    return HTTPException(
        status_code=503,
        detail=(
            f"CLIP embedding service is not available at {url}. "
            "Start it with: docker compose up -d clip-service"
        ),
    )


@router.post("/embed-text")
async def embed_text(req: EmbedTextRequest) -> dict:
    """Embed a natural-language query into a 512-dim vector."""
    try:
        async with httpx.AsyncClient(timeout=_FORWARD_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.CLIP_SERVICE_URL}/embed-text",
                json={"text": req.text},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise _service_down(settings.CLIP_SERVICE_URL)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"CLIP service error: {e.response.text}",
        )


@router.post("/embed-texts")
async def embed_texts(req: EmbedTextsRequest) -> dict:
    """Embed a batch of natural-language queries into vectors."""
    try:
        async with httpx.AsyncClient(timeout=_FORWARD_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.CLIP_SERVICE_URL}/embed-texts",
                json={"texts": req.texts},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise _service_down(settings.CLIP_SERVICE_URL)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"CLIP service error: {e.response.text}",
        )


@router.post("/embed-frames")
async def embed_frames(files: list[UploadFile] = File(...)) -> dict:
    """Embed a batch of video frames (multipart) into vectors.

    The frontend samples frames from media via the HTML video element +
    canvas (same pattern as `use-filmstrip.ts`), then posts them here.
    Returns `{ vectors: number[][], dim: 512 }` so the caller can persist
    them keyed by `(mediaId, timestamp)`.
    """
    if not files:
        raise HTTPException(status_code=400, detail="no frames provided")
    try:
        async with httpx.AsyncClient(timeout=_FORWARD_TIMEOUT) as client:
            forwarded = []
            for f in files:
                contents = await f.read()
                forwarded.append(
                    (f.filename or "frame.jpg", contents, f.content_type or "image/jpeg"),
                )
            resp = await client.post(
                f"{settings.CLIP_SERVICE_URL}/embed-images-batch",
                files=[("files", item) for item in forwarded],
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise _service_down(settings.CLIP_SERVICE_URL)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"CLIP service error: {e.response.text}",
        )


@router.post("/zero-shot-tags")
async def zero_shot_tags(
    file: UploadFile = File(...),
    labels: str = Form(...),
) -> dict:
    """Rank candidate labels against a single image (zero-shot classification)."""
    try:
        async with httpx.AsyncClient(timeout=_FORWARD_TIMEOUT) as client:
            contents = await file.read()
            resp = await client.post(
                f"{settings.CLIP_SERVICE_URL}/zero-shot",
                files={"file": (file.filename or "image.jpg", contents, file.content_type or "image/jpeg")},
                data={"labels": labels},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise _service_down(settings.CLIP_SERVICE_URL)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"CLIP service error: {e.response.text}",
        )


@router.get("/health")
async def clip_service_health() -> dict:
    """Health check for the downstream CLIP service.

    Returns the clip-service /health payload directly so the frontend
    Settings panel can show model load status.
    """
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.CLIP_SERVICE_URL}/health")
            resp.raise_for_status()
            return {"upstream": resp.json(), "reachable": True}
    except Exception as e:
        return {
            "reachable": False,
            "url": settings.CLIP_SERVICE_URL,
            "error": str(e),
        }
