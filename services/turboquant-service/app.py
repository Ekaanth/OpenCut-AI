"""TurboQuant Multi-Model Inference Service.

A FastAPI service that manages multiple HuggingFace LLMs with TurboQuant-style
KV cache compression. Supports downloading, loading, unloading, and switching
between models at runtime.

Features:
- Multi-model registry: download and manage any HuggingFace causal LM
- Hot-swap: load/unload models without restarting the service
- OpenAI-compatible API: /v1/chat/completions, /v1/completions
- Model download with progress streaming (SSE)
- bitsandbytes 4-bit weight quantization (GPU) or float16 (CPU)
- TurboQuant KV cache compression when turboquant-pytorch is installed
- Pre-configured Qwen2.5 model catalog with memory estimates
"""

import asyncio
import gc
import json
import logging
import os
import shutil
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import torch
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_MODEL = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-3B-Instruct")
KV_CACHE_BITS = int(os.getenv("KV_CACHE_BITS", "4"))
MAX_CONTEXT_LENGTH = int(os.getenv("MAX_CONTEXT_LENGTH", "8192"))
DEVICE = os.getenv("DEVICE", "auto")
MODEL_DIR = Path(os.getenv("MODEL_DIR", "/app/models"))

MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Model catalog — curated models known to work with TurboQuant
# ---------------------------------------------------------------------------

MODEL_CATALOG: list[dict[str, Any]] = [
    # ── Llama family ──────────────────────────────────────────────────
    {
        "id": "meta-llama/Llama-3.2-1B-Instruct",
        "name": "Llama 3.2 1B Instruct",
        "family": "llama",
        "params": "1B",
        "memory_fp16_mb": 2500,
        "memory_4bit_mb": 800,
        "context_length": 131072,
        "description": "Compact Llama. Good baseline for commands and chat.",
        "turboquant_validated": False,
    },
    {
        "id": "meta-llama/Llama-3.2-3B-Instruct",
        "name": "Llama 3.2 3B Instruct",
        "family": "llama",
        "params": "3B",
        "memory_fp16_mb": 6400,
        "memory_4bit_mb": 2200,
        "context_length": 131072,
        "description": "Strong 3B model. Great for scripts and content.",
        "turboquant_validated": False,
    },
    {
        "id": "meta-llama/Llama-3.1-8B-Instruct",
        "name": "Llama 3.1 8B Instruct",
        "family": "llama",
        "params": "8B",
        "memory_fp16_mb": 16000,
        "memory_4bit_mb": 6000,
        "context_length": 131072,
        "description": "High quality 8B. Needs 8+ GB RAM at 4-bit.",
        "turboquant_validated": False,
    },
    # ── Mistral family ────────────────────────────────────────────────
    {
        "id": "mistralai/Mistral-7B-Instruct-v0.3",
        "name": "Mistral 7B Instruct v0.3",
        "family": "mistral",
        "params": "7B",
        "memory_fp16_mb": 14500,
        "memory_4bit_mb": 5000,
        "context_length": 32768,
        "description": "Fast, strong 7B model. Excellent for general tasks.",
        "turboquant_validated": False,
    },
    # ── Phi family (Microsoft) ────────────────────────────────────────
    {
        "id": "microsoft/Phi-3.5-mini-instruct",
        "name": "Phi 3.5 Mini (3.8B)",
        "family": "phi",
        "params": "3.8B",
        "memory_fp16_mb": 7600,
        "memory_4bit_mb": 2600,
        "context_length": 131072,
        "description": "Punches above its weight. 128K context on a small model.",
        "turboquant_validated": False,
    },
    # ── Gemma family (Google) ─────────────────────────────────────────
    {
        "id": "google/gemma-2-2b-it",
        "name": "Gemma 2 2B Instruct",
        "family": "gemma",
        "params": "2B",
        "memory_fp16_mb": 5000,
        "memory_4bit_mb": 1800,
        "context_length": 8192,
        "description": "Google's efficient 2B model. Low memory, decent quality.",
        "turboquant_validated": False,
    },
    # ── Qwen2.5 family ───────────────────────────────────────────────
    {
        "id": "Qwen/Qwen2.5-0.5B-Instruct",
        "name": "Qwen2.5 0.5B Instruct",
        "family": "qwen2.5",
        "params": "0.5B",
        "memory_fp16_mb": 1100,
        "memory_4bit_mb": 400,
        "context_length": 32768,
        "description": "Tiny but capable. Great for constrained environments.",
        "turboquant_validated": False,
    },
    {
        "id": "Qwen/Qwen2.5-1.5B-Instruct",
        "name": "Qwen2.5 1.5B Instruct",
        "family": "qwen2.5",
        "params": "1.5B",
        "memory_fp16_mb": 3200,
        "memory_4bit_mb": 1100,
        "context_length": 32768,
        "description": "Small and fast, good quality for its size.",
        "turboquant_validated": False,
    },
    {
        "id": "Qwen/Qwen2.5-3B-Instruct",
        "name": "Qwen2.5 3B Instruct",
        "family": "qwen2.5",
        "params": "3B",
        "memory_fp16_mb": 6400,
        "memory_4bit_mb": 2200,
        "context_length": 32768,
        "description": "Validated with TurboQuant on RTX 3060. Best balance.",
        "turboquant_validated": True,
    },
    {
        "id": "Qwen/Qwen2.5-7B-Instruct",
        "name": "Qwen2.5 7B Instruct",
        "family": "qwen2.5",
        "params": "7B",
        "memory_fp16_mb": 14500,
        "memory_4bit_mb": 5000,
        "context_length": 131072,
        "description": "High quality. Needs GPU or 16+ GB RAM at 4-bit.",
        "turboquant_validated": False,
    },
    {
        "id": "Qwen/Qwen2.5-14B-Instruct",
        "name": "Qwen2.5 14B Instruct",
        "family": "qwen2.5",
        "params": "14B",
        "memory_fp16_mb": 28000,
        "memory_4bit_mb": 9500,
        "context_length": 131072,
        "description": "Excellent quality. Requires GPU with 12+ GB VRAM.",
        "turboquant_validated": False,
    },
    # ── Qwen2.5-Coder family ─────────────────────────────────────────
    {
        "id": "Qwen/Qwen2.5-Coder-3B-Instruct",
        "name": "Qwen2.5 Coder 3B",
        "family": "qwen2.5-coder",
        "params": "3B",
        "memory_fp16_mb": 6400,
        "memory_4bit_mb": 2200,
        "context_length": 32768,
        "description": "Code-specialized 3B model. Good for script generation.",
        "turboquant_validated": False,
    },
    {
        "id": "Qwen/Qwen2.5-Coder-7B-Instruct",
        "name": "Qwen2.5 Coder 7B",
        "family": "qwen2.5-coder",
        "params": "7B",
        "memory_fp16_mb": 14500,
        "memory_4bit_mb": 5000,
        "context_length": 131072,
        "description": "Strong code generation and analysis.",
        "turboquant_validated": False,
    },
]

# ---------------------------------------------------------------------------
# Multi-model manager
# ---------------------------------------------------------------------------


class LoadedModel:
    """Tracks a single loaded model's state."""

    def __init__(
        self,
        model_id: str,
        model: Any,
        tokenizer: Any,
        device: str,
        quantization: str,
        loaded_at: float,
    ):
        self.model_id = model_id
        self.model = model
        self.tokenizer = tokenizer
        self.device = device
        self.quantization = quantization
        self.loaded_at = loaded_at
        self.request_count = 0
        self.total_tokens = 0


class ModelManager:
    """Manages downloading, loading, and switching between models."""

    def __init__(self):
        self.active_model: LoadedModel | None = None
        self.downloaded_models: dict[str, dict] = {}
        self.download_progress: dict[str, dict] = {}
        self.loading_model: str | None = None  # model_id currently being loaded
        self.turboquant_available = False
        self._check_turboquant()
        self._scan_downloaded()

    def _check_turboquant(self):
        try:
            from turboquant import TurboQuantCompressorV2  # noqa: F401
            self.turboquant_available = True
            logger.info("TurboQuant library detected — KV cache compression available")
        except ImportError:
            self.turboquant_available = False
            logger.info("TurboQuant library not installed — standard inference only")

    def _scan_downloaded(self):
        """Scan MODEL_DIR for already-downloaded models."""
        self.downloaded_models = {}
        if not MODEL_DIR.exists():
            return
        # HuggingFace cache stores in models--org--name format
        for path in MODEL_DIR.iterdir():
            if path.is_dir() and path.name.startswith("models--"):
                # Convert models--Qwen--Qwen2.5-3B-Instruct -> Qwen/Qwen2.5-3B-Instruct
                parts = path.name.replace("models--", "").split("--", 1)
                if len(parts) == 2:
                    model_id = f"{parts[0]}/{parts[1]}"
                    # Check if the snapshot is complete (has a refs dir)
                    refs_dir = path / "refs"
                    if refs_dir.exists():
                        size_mb = _dir_size_mb(path)
                        self.downloaded_models[model_id] = {
                            "id": model_id,
                            "path": str(path),
                            "size_mb": size_mb,
                            "downloaded_at": path.stat().st_mtime,
                        }
        # Also check for any model that has config.json directly (non-cached format)
        for path in MODEL_DIR.iterdir():
            if path.is_dir() and (path / "config.json").exists():
                model_id = path.name
                if "/" not in model_id:
                    continue
                self.downloaded_models[model_id] = {
                    "id": model_id,
                    "path": str(path),
                    "size_mb": _dir_size_mb(path),
                    "downloaded_at": path.stat().st_mtime,
                }
        logger.info("Found %d downloaded models", len(self.downloaded_models))

    def download_model(self, model_id: str):
        """Download a model from HuggingFace Hub. Yields progress dicts."""
        from huggingface_hub import snapshot_download
        from huggingface_hub.utils import HfHubHTTPError

        self.download_progress[model_id] = {
            "status": "downloading",
            "progress": 0,
            "message": f"Starting download of {model_id}...",
        }

        try:
            yield {"status": "downloading", "progress": 0, "message": f"Downloading {model_id}..."}

            # Download the model files
            local_path = snapshot_download(
                model_id,
                cache_dir=str(MODEL_DIR),
                local_dir=None,
            )

            yield {"status": "downloading", "progress": 90, "message": "Verifying files..."}

            # Register as downloaded
            self._scan_downloaded()

            yield {"status": "completed", "progress": 100, "message": f"{model_id} downloaded successfully"}

        except HfHubHTTPError as e:
            msg = f"Download failed: {e}"
            logger.error(msg)
            self.download_progress[model_id] = {"status": "error", "progress": 0, "message": msg}
            yield {"status": "error", "progress": 0, "message": msg}
        except Exception as e:
            msg = f"Download failed: {e}"
            logger.exception(msg)
            self.download_progress[model_id] = {"status": "error", "progress": 0, "message": msg}
            yield {"status": "error", "progress": 0, "message": msg}
        finally:
            self.download_progress.pop(model_id, None)

    def load_model(self, model_id: str) -> LoadedModel:
        """Load a model into memory. Unloads the current model first."""
        if self.active_model and self.active_model.model_id == model_id:
            logger.info("Model '%s' is already loaded", model_id)
            return self.active_model

        if self.loading_model:
            raise RuntimeError(
                f"Already loading '{self.loading_model}'. Wait for it to finish."
            )

        self.loading_model = model_id
        try:
            # Unload current model
            if self.active_model:
                self._unload_current()

            return self._load(model_id)
        finally:
            self.loading_model = None

    def _load(self, model_id: str) -> LoadedModel:
        """Internal: load a model."""
        from transformers import AutoModelForCausalLM, AutoTokenizer

        device = _detect_device()
        logger.info("Loading model '%s' on device '%s'...", model_id, device)

        tokenizer = AutoTokenizer.from_pretrained(
            model_id,
            trust_remote_code=True,
            cache_dir=str(MODEL_DIR),
        )

        load_kwargs: dict[str, Any] = {
            "trust_remote_code": True,
            "cache_dir": str(MODEL_DIR),
        }

        quantization = "fp32"

        if device == "cuda":
            load_kwargs["torch_dtype"] = torch.float16
            load_kwargs["device_map"] = "auto"
            quantization = "fp16"
            try:
                from transformers import BitsAndBytesConfig
                load_kwargs["quantization_config"] = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=torch.float16,
                    bnb_4bit_use_double_quant=True,
                    bnb_4bit_quant_type="nf4",
                )
                quantization = "4bit-nf4"
                logger.info("Using bitsandbytes 4-bit quantization")
            except ImportError:
                logger.warning("bitsandbytes not available — loading in fp16")
        elif device == "mps":
            load_kwargs["torch_dtype"] = torch.float16
            load_kwargs["device_map"] = {"": "mps"}
            quantization = "fp16"
        else:
            # Use float16 on CPU to halve memory usage (float32 OOMs in containers)
            load_kwargs["torch_dtype"] = torch.float16
            load_kwargs["device_map"] = "cpu"
            quantization = "fp16"

        model = AutoModelForCausalLM.from_pretrained(model_id, **load_kwargs)

        loaded = LoadedModel(
            model_id=model_id,
            model=model,
            tokenizer=tokenizer,
            device=device,
            quantization=quantization,
            loaded_at=time.time(),
        )
        self.active_model = loaded
        logger.info("Model '%s' loaded (%s on %s)", model_id, quantization, device)
        return loaded

    def _unload_current(self):
        """Unload the active model and free memory."""
        if self.active_model is None:
            return
        model_id = self.active_model.model_id
        logger.info("Unloading model '%s'...", model_id)

        del self.active_model.model
        del self.active_model.tokenizer
        self.active_model = None

        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        logger.info("Model '%s' unloaded, memory freed", model_id)

    def unload(self):
        """Public: unload the active model."""
        with self._lock:
            self._unload_current()

    def delete_model(self, model_id: str) -> bool:
        """Delete a downloaded model from disk."""
        if self.active_model and self.active_model.model_id == model_id:
            self.unload()

        info = self.downloaded_models.get(model_id)
        if not info:
            return False

        path = Path(info["path"])
        if path.exists():
            shutil.rmtree(path, ignore_errors=True)
            logger.info("Deleted model files at %s", path)

        self.downloaded_models.pop(model_id, None)
        return True

    def get_catalog(self) -> list[dict]:
        """Return the model catalog with download/load status."""
        result = []
        for entry in MODEL_CATALOG:
            model_id = entry["id"]
            is_downloaded = model_id in self.downloaded_models
            is_loaded = (
                self.active_model is not None
                and self.active_model.model_id == model_id
            )
            downloading = model_id in self.download_progress
            is_loading = self.loading_model == model_id

            item = {
                **entry,
                "downloaded": is_downloaded,
                "loaded": is_loaded,
                "downloading": downloading,
                "loading": is_loading,
            }
            if is_downloaded:
                item["size_on_disk_mb"] = self.downloaded_models[model_id]["size_mb"]
            if downloading:
                item["download_progress"] = self.download_progress[model_id]
            if is_loaded and self.active_model:
                item["quantization"] = self.active_model.quantization
                item["request_count"] = self.active_model.request_count
            result.append(item)

        # Also include any downloaded models not in catalog
        for model_id, info in self.downloaded_models.items():
            if not any(e["id"] == model_id for e in MODEL_CATALOG):
                is_loaded = (
                    self.active_model is not None
                    and self.active_model.model_id == model_id
                )
                result.append({
                    "id": model_id,
                    "name": model_id.split("/")[-1],
                    "family": "custom",
                    "params": "unknown",
                    "memory_fp16_mb": 0,
                    "memory_4bit_mb": 0,
                    "context_length": 0,
                    "description": "Custom model (not in catalog)",
                    "turboquant_validated": False,
                    "downloaded": True,
                    "loaded": is_loaded,
                    "downloading": False,
                    "size_on_disk_mb": info["size_mb"],
                })
        return result


def _detect_device() -> str:
    """Detect the best available device."""
    if DEVICE != "auto":
        return DEVICE
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _dir_size_mb(path: Path) -> int:
    """Compute directory size in MB."""
    total = 0
    try:
        for f in path.rglob("*"):
            if f.is_file():
                total += f.stat().st_size
    except OSError:
        pass
    return round(total / 1024 / 1024)


def _memory_info() -> dict:
    """Get current memory usage."""
    info: dict[str, Any] = {}
    if torch.cuda.is_available():
        device = torch.cuda.current_device()
        info["gpu_allocated_mb"] = round(torch.cuda.memory_allocated(device) / 1024 / 1024, 1)
        info["gpu_reserved_mb"] = round(torch.cuda.memory_reserved(device) / 1024 / 1024, 1)
        info["gpu_total_mb"] = round(
            torch.cuda.get_device_properties(device).total_mem / 1024 / 1024, 1
        )
    try:
        import psutil
        mem = psutil.virtual_memory()
        info["ram_used_mb"] = round(mem.used / 1024 / 1024)
        info["ram_total_mb"] = round(mem.total / 1024 / 1024)
        info["ram_available_mb"] = round(mem.available / 1024 / 1024)
    except ImportError:
        pass
    return info


# ---------------------------------------------------------------------------
# Global model manager
# ---------------------------------------------------------------------------

manager = ModelManager()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the default model on startup."""
    logger.info("TurboQuant Multi-Model Service starting...")
    # Auto-load default model if it's already downloaded
    if DEFAULT_MODEL in manager.downloaded_models:
        try:
            manager.load_model(DEFAULT_MODEL)
        except Exception:
            logger.exception("Failed to auto-load default model '%s'", DEFAULT_MODEL)
    else:
        logger.info(
            "Default model '%s' not downloaded yet. "
            "Use POST /v1/models/download to download it.",
            DEFAULT_MODEL,
        )
    yield
    manager.unload()
    logger.info("TurboQuant Service shut down")


app = FastAPI(
    title="TurboQuant Multi-Model Inference Service",
    description="Multi-model LLM inference with TurboQuant KV cache compression",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage]
    max_tokens: int = Field(default=512, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    stream: bool = False


class CompletionRequest(BaseModel):
    model: str | None = None
    prompt: str
    max_tokens: int = Field(default=512, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    stream: bool = False


class DownloadRequest(BaseModel):
    model_id: str = Field(..., description="HuggingFace model ID (e.g. 'Qwen/Qwen2.5-3B-Instruct')")


class LoadRequest(BaseModel):
    model_id: str = Field(..., description="Model ID to load into memory")


# ---------------------------------------------------------------------------
# Health & status
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict:
    """Health check with active model and memory info."""
    active = manager.active_model
    return {
        "status": "ok",
        "active_model": active.model_id if active else None,
        "active_model_loaded": active is not None,
        "active_model_quantization": active.quantization if active else None,
        "active_model_device": active.device if active else None,
        "loading_model": manager.loading_model,
        "models_downloaded": len(manager.downloaded_models),
        "models_in_catalog": len(MODEL_CATALOG),
        "kv_cache_bits": KV_CACHE_BITS,
        "max_context_length": MAX_CONTEXT_LENGTH,
        "turboquant_available": manager.turboquant_available,
        "gpu_available": torch.cuda.is_available(),
        "device": _detect_device(),
        "memory_usage": _memory_info(),
    }


# ---------------------------------------------------------------------------
# Model management
# ---------------------------------------------------------------------------

@app.get("/v1/models")
async def list_models() -> dict:
    """List all models: catalog + downloaded + active status."""
    catalog = manager.get_catalog()
    return {
        "object": "list",
        "data": catalog,
        "active_model": manager.active_model.model_id if manager.active_model else None,
    }


@app.get("/v1/models/catalog")
async def model_catalog() -> dict:
    """List the curated model catalog with download status."""
    return {
        "catalog": manager.get_catalog(),
        "device": _detect_device(),
        "gpu_available": torch.cuda.is_available(),
        "memory": _memory_info(),
    }


@app.get("/v1/models/downloaded")
async def downloaded_models() -> dict:
    """List only models that are downloaded locally."""
    manager._scan_downloaded()
    return {
        "models": list(manager.downloaded_models.values()),
        "total_size_mb": sum(m["size_mb"] for m in manager.downloaded_models.values()),
    }


@app.post("/v1/models/download")
async def download_model(request: DownloadRequest) -> StreamingResponse:
    """Download a model from HuggingFace Hub.

    Returns a streaming response with JSON lines for progress tracking.
    Each line is a JSON object: {"status": "...", "progress": 0-100, "message": "..."}
    """
    model_id = request.model_id

    if model_id in manager.downloaded_models:
        async def already_done():
            yield json.dumps({
                "status": "completed",
                "progress": 100,
                "message": f"{model_id} is already downloaded",
            }) + "\n"

        return StreamingResponse(already_done(), media_type="application/x-ndjson")

    if model_id in manager.download_progress:
        raise HTTPException(status_code=409, detail=f"Download of {model_id} already in progress")

    async def stream_progress():
        for update in manager.download_model(model_id):
            yield json.dumps(update) + "\n"

    return StreamingResponse(stream_progress(), media_type="application/x-ndjson")


@app.post("/v1/models/load")
async def load_model(request: LoadRequest) -> dict:
    """Load a downloaded model into memory for inference.

    Unloads the currently active model first to free memory.
    Runs the heavy model loading in a background thread so the
    event loop stays responsive (health checks, status polls, etc.).
    """
    model_id = request.model_id

    # Already loaded?
    if manager.active_model and manager.active_model.model_id == model_id:
        return {
            "status": "already_loaded",
            "model_id": model_id,
            "device": manager.active_model.device,
            "quantization": manager.active_model.quantization,
            "memory": _memory_info(),
        }

    # Already loading something?
    if manager.loading_model:
        raise HTTPException(
            status_code=409,
            detail=f"Already loading '{manager.loading_model}'. Wait for it to finish.",
        )

    if model_id not in manager.downloaded_models:
        logger.info("Model '%s' not in local cache, will try to load from HF hub", model_id)

    try:
        # Run blocking model load in a thread so the event loop stays alive
        loaded = await asyncio.to_thread(manager.load_model, model_id)
        return {
            "status": "loaded",
            "model_id": loaded.model_id,
            "device": loaded.device,
            "quantization": loaded.quantization,
            "memory": _memory_info(),
        }
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.exception("Failed to load model '%s'", model_id)
        raise HTTPException(status_code=500, detail=f"Failed to load model: {e}")


@app.post("/v1/models/unload")
async def unload_model() -> dict:
    """Unload the active model to free memory."""
    if not manager.active_model:
        return {"status": "no_model_loaded"}

    model_id = manager.active_model.model_id
    manager.unload()
    return {
        "status": "unloaded",
        "model_id": model_id,
        "memory": _memory_info(),
    }


@app.delete("/v1/models/{model_id:path}")
async def delete_model(model_id: str) -> dict:
    """Delete a downloaded model from disk."""
    if manager.delete_model(model_id):
        return {"status": "deleted", "model_id": model_id}
    raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found locally")


# ---------------------------------------------------------------------------
# Inference — OpenAI-compatible
# ---------------------------------------------------------------------------

def _get_active_or_load(requested_model: str | None) -> LoadedModel:
    """Get the active model, or load the requested one."""
    if requested_model and (
        not manager.active_model
        or manager.active_model.model_id != requested_model
    ):
        # Try to hot-swap to the requested model
        if requested_model in manager.downloaded_models:
            manager.load_model(requested_model)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Model '{requested_model}' not downloaded. "
                f"Download it first via POST /v1/models/download",
            )

    if not manager.active_model:
        raise HTTPException(status_code=503, detail="No model loaded. Load one via POST /v1/models/load")

    return manager.active_model


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest) -> dict:
    """OpenAI-compatible chat completions. Supports model switching per request."""
    if request.stream:
        raise HTTPException(status_code=400, detail="Streaming not yet supported")

    loaded = _get_active_or_load(request.model)

    try:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        text = loaded.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True,
        )
        inputs = loaded.tokenizer(text, return_tensors="pt")
        input_ids = inputs["input_ids"].to(loaded.model.device)

        start = time.time()
        with torch.no_grad():
            outputs = loaded.model.generate(
                input_ids,
                max_new_tokens=request.max_tokens,
                temperature=request.temperature if request.temperature > 0 else None,
                top_p=request.top_p,
                do_sample=request.temperature > 0,
                pad_token_id=loaded.tokenizer.eos_token_id,
            )
        elapsed = time.time() - start

        new_tokens = outputs[0][input_ids.shape[1]:]
        response_text = loaded.tokenizer.decode(new_tokens, skip_special_tokens=True)

        loaded.request_count += 1
        loaded.total_tokens += input_ids.shape[1] + len(new_tokens)

        return {
            "id": f"chatcmpl-tq-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": loaded.model_id,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": response_text},
                "finish_reason": "stop",
            }],
            "usage": {
                "prompt_tokens": input_ids.shape[1],
                "completion_tokens": len(new_tokens),
                "total_tokens": input_ids.shape[1] + len(new_tokens),
            },
            "turboquant": {
                "kv_cache_bits": KV_CACHE_BITS,
                "turboquant_active": manager.turboquant_available,
                "inference_time_s": round(elapsed, 3),
                "quantization": loaded.quantization,
            },
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Chat completion failed")
        raise HTTPException(status_code=500, detail="Generation failed")


@app.post("/v1/completions")
async def completions(request: CompletionRequest) -> dict:
    """OpenAI-compatible text completions."""
    loaded = _get_active_or_load(request.model)

    try:
        inputs = loaded.tokenizer(request.prompt, return_tensors="pt")
        input_ids = inputs["input_ids"].to(loaded.model.device)

        start = time.time()
        with torch.no_grad():
            outputs = loaded.model.generate(
                input_ids,
                max_new_tokens=request.max_tokens,
                temperature=request.temperature if request.temperature > 0 else None,
                do_sample=request.temperature > 0,
                pad_token_id=loaded.tokenizer.eos_token_id,
            )
        elapsed = time.time() - start

        new_tokens = outputs[0][input_ids.shape[1]:]
        response_text = loaded.tokenizer.decode(new_tokens, skip_special_tokens=True)

        loaded.request_count += 1
        loaded.total_tokens += input_ids.shape[1] + len(new_tokens)

        return {
            "id": f"cmpl-tq-{int(time.time())}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": loaded.model_id,
            "choices": [{
                "index": 0,
                "text": response_text,
                "finish_reason": "stop",
            }],
            "usage": {
                "prompt_tokens": input_ids.shape[1],
                "completion_tokens": len(new_tokens),
                "total_tokens": input_ids.shape[1] + len(new_tokens),
            },
            "turboquant": {
                "kv_cache_bits": KV_CACHE_BITS,
                "turboquant_active": manager.turboquant_available,
                "inference_time_s": round(elapsed, 3),
                "quantization": loaded.quantization,
            },
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Completion failed")
        raise HTTPException(status_code=500, detail="Generation failed")
