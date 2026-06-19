"""CLIP embedding microservice using open_clip.

Accepts image frames (multipart) or text (JSON), returns L2-normalized
512-dim float vectors from a ViT-B-32 CLIP model. Used by the OpenCut AI
editor for privacy-first semantic media search.

Privacy note: this service only computes embeddings on demand. It does NOT
persist vectors or input media — that is the frontend's responsibility.
The model cache (/root/.cache) contains only downloaded weights.
"""

import io
import logging
import os
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="OpenCut CLIP Embedding Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config (env-overridable)
MODEL_NAME = os.environ.get("CLIP_MODEL_NAME", "ViT-B-32")
MODEL_PRETRAINED = os.environ.get("CLIP_PRETRAINED", "laion2b_s34b_b79k")
DEVICE_OVERRIDE = os.environ.get("DEVICE", "auto")
MAX_IMAGE_DIM = int(os.environ.get("CLIP_MAX_IMAGE_DIM", "1024"))
MAX_BATCH = int(os.environ.get("CLIP_MAX_BATCH", "32"))
MAX_TEXT_LEN = int(os.environ.get("CLIP_MAX_TEXT_LEN", "1000"))

# Lazy-loaded globals
_model = None
_preprocess = None
_tokenizer = None
_device = None
_load_error: Optional[str] = None


def _pick_device() -> str:
    """Pick the best available torch device: cuda > mps > cpu."""
    if DEVICE_OVERRIDE not in ("", "auto"):
        return DEVICE_OVERRIDE
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def _load_model():
    """Lazy-load the open_clip model, preprocessing transform, and tokenizer."""
    global _model, _preprocess, _tokenizer, _device, _load_error
    if _model is not None:
        return
    try:
        import torch
        import open_clip

        _device = _pick_device()
        logger.info(
            "Loading CLIP model %s (%s) on device '%s'...",
            MODEL_NAME, MODEL_PRETRAINED, _device,
        )
        _model, _, _preprocess = open_clip.create_model_and_transforms(
            MODEL_NAME, pretrained=MODEL_PRETRAINED
        )
        _model = _model.to(_device)
        _model.eval()
        _tokenizer = open_clip.get_tokenizer(MODEL_NAME)
        logger.info("CLIP model loaded. Embedding dim = %d", _model.visual.output_dim if hasattr(_model.visual, "output_dim") else 512)
    except Exception as e:
        _load_error = f"{type(e).__name__}: {e}"
        logger.exception("Failed to load CLIP model")
        raise


def _embed_dim() -> int:
    """Embedding dimension of the loaded model (512 for the default ViT-B-32)."""
    if _model is not None and hasattr(_model.visual, "output_dim"):
        return int(_model.visual.output_dim)
    return 512


def _embed_images(images: list[Image.Image]) -> list[list[float]]:
    """Encode a list of PIL images into L2-normalized vectors."""
    import torch

    _load_model()
    try:
        with torch.no_grad():
            pixels = torch.stack([_preprocess(img) for img in images]).to(_device)
            feats = _model.encode_image(pixels)
            feats = feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-12)
            return feats.cpu().tolist()
    except Exception as e:
        logger.exception("Image embedding failed")
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")


def _embed_texts(texts: list[str]) -> list[list[float]]:
    import torch

    _load_model()
    try:
        with torch.no_grad():
            tokens = _tokenizer(texts).to(_device)
            feats = _model.encode_text(tokens)
            feats = feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-12)
            return feats.cpu().tolist()
    except Exception as e:
        logger.exception("Text embedding failed")
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")


def _read_image(contents: bytes) -> Image.Image:
    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")
    # Cap memory: downscale very large frames.
    if max(img.size) > MAX_IMAGE_DIM:
        ratio = MAX_IMAGE_DIM / max(img.size)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.BILINEAR)
    return img


@app.get("/health")
async def health() -> dict:
    """Health check. `model.loaded` reflects whether the lazy model init succeeded."""
    global _load_error
    loaded = _model is not None
    # Try a one-shot warm load so the very first user request isn't slow.
    if not loaded and _load_error is None:
        try:
            _load_model()
            loaded = _model is not None
        except Exception:
            loaded = False
    return {
        "service": "clip-embeddings",
        "status": "running",
        "model": {
            "loaded": loaded,
            "name": MODEL_NAME,
            "pretrained": MODEL_PRETRAINED,
            "installed": True,
            "error": _load_error,
        },
        "device": _device or _pick_device(),
        "version": "0.1.0",
    }


class EmbedTextRequest(BaseModel):
    text: str


class EmbedTextsRequest(BaseModel):
    texts: list[str]


@app.post("/embed-text")
async def embed_text(req: EmbedTextRequest) -> dict:
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="`text` must be non-empty")
    if len(text) > MAX_TEXT_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"`text` exceeds max length {MAX_TEXT_LEN}",
        )
    return {"vector": _embed_texts([text])[0], "model": MODEL_NAME, "dim": _embed_dim()}


@app.post("/embed-texts")
async def embed_texts(req: EmbedTextsRequest) -> dict:
    texts = [(t or "").strip() for t in (req.texts or [])]
    if not texts:
        raise HTTPException(status_code=400, detail="`texts` must be non-empty")
    if len(texts) > MAX_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"batch size {len(texts)} exceeds max {MAX_BATCH}",
        )
    for t in texts:
        if len(t) > MAX_TEXT_LEN:
            raise HTTPException(
                status_code=400,
                detail=f"a text exceeds max length {MAX_TEXT_LEN}",
            )
    return {"vectors": _embed_texts(texts), "model": MODEL_NAME, "dim": _embed_dim()}


@app.post("/embed-image")
async def embed_image(file: UploadFile = File(...)) -> dict:
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="empty file")
    img = _read_image(contents)
    return {"vector": _embed_images([img])[0], "model": MODEL_NAME, "dim": _embed_dim()}


@app.post("/embed-images-batch")
async def embed_images_batch(files: list[UploadFile] = File(...)) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail="no files provided")
    if len(files) > MAX_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"batch size {len(files)} exceeds max {MAX_BATCH}",
        )
    images: list[Image.Image] = []
    for f in files:
        contents = await f.read()
        if not contents:
            continue
        images.append(_read_image(contents))
    if not images:
        raise HTTPException(status_code=400, detail="all files were empty or invalid")
    return {"vectors": _embed_images(images), "model": MODEL_NAME, "dim": _embed_dim(), "count": len(images)}


@app.post("/zero-shot")
async def zero_shot_classify(
    file: UploadFile = File(...),
    labels: str = Form(...),
) -> dict:
    """Zero-shot classification: rank candidate labels for one image.

    `labels` is a comma-separated string. We prompt each label as
    `"a photo of {label}"` which matches CLIP's training distribution.
    """
    raw = [l.strip() for l in labels.split(",") if l.strip()]
    if not raw:
        raise HTTPException(status_code=400, detail="`labels` must contain at least one entry")
    if len(raw) > MAX_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"label count {len(raw)} exceeds max {MAX_BATCH}",
        )
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="empty file")
    img = _read_image(contents)

    img_vec = np.asarray(_embed_images([img])[0], dtype=np.float32)
    text_vecs = np.asarray(_embed_texts([f"a photo of {l}" for l in raw]), dtype=np.float32)
    # Both are L2-normalized already, so dot product = cosine similarity.
    sims = text_vecs @ img_vec
    ranked = sorted(
        ({"label": raw[i], "score": round(float(sims[i]), 4)} for i in range(len(raw))),
        key=lambda x: x["score"],
        reverse=True,
    )
    return {"tags": ranked, "model": MODEL_NAME}
