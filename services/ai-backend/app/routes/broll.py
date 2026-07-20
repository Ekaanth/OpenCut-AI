"""Auto B-roll routes.

Indexes a media asset into CLIP embeddings by sampling frames with FFmpeg,
then embedding them via the clip-service. Powers "Auto B-roll from your
footage": the frontend matches transcript segments against a client-side
vector index built from these embeddings.

Privacy: this layer never persists anything. It returns the vectors + small
thumbnail data URLs to the caller; the frontend stores them in IndexedDB.
No media or embeddings are retained server-side after the response.
"""

import asyncio
import base64
import io
import logging
import os
import shutil
import tempfile
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/broll", tags=["broll"])

_FORWARD_TIMEOUT = 300.0

ALLOWED_MEDIA_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".jpg", ".jpeg", ".png"}


def _service_down(url: str) -> HTTPException:
    return HTTPException(
        status_code=503,
        detail=(
            f"CLIP embedding service is not available at {url}. "
            "Start it with: docker compose up -d clip-service"
        ),
    )


class EmbedQueryRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


@router.post("/embed-query")
async def embed_query(req: EmbedQueryRequest) -> dict:
    """Embed a transcript segment's text into a 512-dim CLIP vector.

    Thin wrapper over the existing CLIP service — kept on this router so the
    frontend can reach both index + query through one prefix.
    """
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


async def _probe_duration(path: str) -> float:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", path,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, _ = await proc.communicate()
    try:
        return float(out.decode().strip())
    except ValueError:
        return 0.0


async def _run_ffmpeg(cmd: list[str]) -> None:
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, err = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {err.decode()[:300]}")


@router.post("/embed-asset")
async def embed_asset(
    file: UploadFile = File(...),
    sample_interval: float = Form(default=2.0, ge=0.5, le=60.0),
    max_frames: int = Form(default=120, ge=1, le=500),
):
    """Sample frames from a media asset, embed them via CLIP, return vectors.

    For images (single frame), the asset is embedded directly. For video,
    frames are extracted every ``sample_interval`` seconds (capped at
    ``max_frames``), each embedded, and returned with a small thumbnail data
    URL for the UI. The frontend persists these keyed by (mediaId, timestamp)
    in IndexedDB.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_MEDIA_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported media type '{ext}'. Allowed: {sorted(ALLOWED_MEDIA_EXTS)}",
        )

    upload_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join(settings.UPLOAD_DIR, f"broll_{upload_id}{ext}")
    contents = await file.read()
    with open(upload_path, "wb") as f:
        f.write(contents)

    work_dir = tempfile.mkdtemp(prefix=f"broll_{upload_id}_")
    try:
        # ── 1. Extract frames ──
        frame_paths: list[str] = []  # absolute paths in order
        timestamps: list[float] = []

        if ext in {".jpg", ".jpeg", ".png"}:
            # Single image — one frame at t=0.
            frame_paths = [upload_path]
            timestamps = [0.0]
        else:
            duration = await _probe_duration(upload_path)
            if duration <= 0:
                raise HTTPException(status_code=400, detail="Could not read video duration.")

            # Sample timestamps, capped at max_frames.
            n = min(max_frames, max(1, int(duration / sample_interval) + 1))
            for i in range(n):
                t = min(duration, i * sample_interval)
                timestamps.append(round(t, 3))

            if timestamps:
                # Use the select filter to grab exact timestamps; more reliable
                # than fps for uneven sampling.
                ts_expr = "+".join(f"eq(t\\,{t:.3f})" for t in timestamps)
                frame_glob = os.path.join(work_dir, "f_%04d.jpg")
                cmd = [
                    "ffmpeg", "-y", "-i", upload_path,
                    "-vf", f"select='{ts_expr}',scale=336:-2",  # 336 = CLIP input size
                    "-vsync", "vfr", "-q:v", "3",
                    frame_glob,
                ]
                await _run_ffmpeg(cmd)
                # ffmpeg numbers the selected frames sequentially regardless of
                # their source timestamp, so re-attach our timestamps in order.
                produced = sorted(Path(work_dir).glob("f_*.jpg"))
                frame_paths = [str(p) for p in produced[: len(timestamps)]]
                timestamps = timestamps[: len(frame_paths)]
            if not frame_paths:
                raise HTTPException(status_code=500, detail="Frame extraction produced no frames.")

        # ── 2. Build small thumbnails (for the UI review list) ──
        from PIL import Image  # local import; ai-backend already depends on PIL via rembg/etc

        thumbnails: list[str] = []
        thumb_glob = os.path.join(work_dir, "t_%04d.jpg")
        for i, fp in enumerate(frame_paths):
            try:
                im = Image.open(fp)
                im.thumbnail((160, 160))
                buf = io.BytesIO()
                im.convert("RGB").save(buf, format="JPEG", quality=70)
                thumbnails.append(
                    "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
                )
            except Exception:
                thumbnails.append("")

        # ── 3. Embed the frames in batches via the clip-service ──
        vectors: list[list[float]] = []
        BATCH = 32
        async with httpx.AsyncClient(timeout=_FORWARD_TIMEOUT) as client:
            for i in range(0, len(frame_paths), BATCH):
                chunk = frame_paths[i : i + BATCH]
                files_payload = []
                for fp in chunk:
                    files_payload.append(
                        ("files", (Path(fp).name, open(fp, "rb"), "image/jpeg"))
                    )
                try:
                    try:
                        resp = await client.post(
                            f"{settings.CLIP_SERVICE_URL}/embed-images-batch",
                            files=files_payload,
                        )
                        resp.raise_for_status()
                        vectors.extend(resp.json().get("vectors", []))
                    except httpx.ConnectError:
                        raise _service_down(settings.CLIP_SERVICE_URL)
                    except httpx.HTTPStatusError as e:
                        raise HTTPException(
                            status_code=e.response.status_code,
                            detail=f"CLIP service error: {e.response.text}",
                        )
                finally:
                    for _, (_, fh, _) in files_payload:
                        fh.close()

        if len(vectors) != len(frame_paths):
            logger.warning(
                "broll embed-asset: got %d vectors for %d frames (padding with zeros)",
                len(vectors), len(frame_paths),
            )
            # Pad so the response arrays stay aligned.
            dim = len(vectors[0]) if vectors else 512
            while len(vectors) < len(frame_paths):
                vectors.append([0.0] * dim)

        frames_out = [
            {"timestamp": timestamps[i], "vector": vectors[i], "thumbnail": thumbnails[i]}
            for i in range(len(frame_paths))
        ]
        return {
            "frames": frames_out,
            "count": len(frames_out),
            "model": "ViT-B-32",
            "dim": len(vectors[0]) if vectors else 512,
        }
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        try:
            if os.path.exists(upload_path):
                os.remove(upload_path)
        except OSError:
            pass
