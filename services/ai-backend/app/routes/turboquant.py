"""TurboQuant optimization and model management routes.

Provides endpoints for:
- Optimization status and configuration
- Model tier listing and recommendations
- Memory impact estimation
- TurboQuant inference service health
- Multi-model management (list, download, load, unload, delete) — proxied to turboquant-service
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.services.model_registry import model_registry
from app.services.turboquant_service import turboquant_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/turboquant", tags=["turboquant"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class OptimizationEstimateRequest(BaseModel):
    model_tag: str | None = Field(
        default=None, description="Ollama model tag (e.g. 'llama3.2:3b-instruct-q4_K_M')"
    )
    context_length: int = Field(default=8192, ge=512, le=131072)
    kv_bits: int | None = Field(default=None, ge=2, le=4)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/status")
async def turboquant_status() -> dict:
    """Get the current TurboQuant optimization status.

    Returns hardware info, recommended model tier, current configuration,
    and memory estimates for the full AI stack.
    """
    status = turboquant_service.get_optimization_status()
    service_status = await turboquant_service.get_service_status()
    status["inference_service"] = service_status
    return status


@router.get("/service-health")
async def turboquant_service_health() -> dict:
    """Check if the TurboQuant inference service is available."""
    return await turboquant_service.get_service_status()


@router.get("/model-tiers")
async def model_tiers() -> dict:
    """List all available model tiers with their specs.

    Returns tier definitions (lite/standard/pro) with models, memory
    requirements, quality ratings, and quantization details.
    """
    tiers = model_registry.get_all_tiers()
    hw = model_registry.detect_hardware()
    recommended_tier = model_registry.recommend_tier(settings.AI_MEMORY_BUDGET)
    recommended_model = model_registry.recommend_model(
        budget=settings.AI_MEMORY_BUDGET,
        tier=settings.AI_MODEL_TIER,
    )

    return {
        "tiers": tiers,
        "recommended_tier": recommended_tier,
        "recommended_model": recommended_model.ollama_tag,
        "current_model": settings.OLLAMA_DEFAULT_MODEL,
        "hardware": hw,
    }


@router.get("/kv-configurations")
async def kv_configurations() -> dict:
    """List supported KV cache quantization configurations.

    Returns all TurboQuant bit-width options with quality metrics,
    compression ratios, and recommendations.
    """
    configs = turboquant_service.get_supported_configurations()
    return {
        "configurations": configs,
        "current_bits": settings.KV_CACHE_BITS,
    }


@router.post("/estimate")
async def estimate_optimization(request: OptimizationEstimateRequest) -> dict:
    """Estimate the memory impact of TurboQuant optimization.

    Given a model and context length, returns how much memory is saved
    by applying TurboQuant KV cache compression.
    """
    return turboquant_service.estimate_optimization_impact(
        model_tag=request.model_tag or settings.OLLAMA_DEFAULT_MODEL,
        context_length=request.context_length,
        kv_bits=request.kv_bits or settings.KV_CACHE_BITS,
    )


@router.get("/recommend")
async def recommend_model(
    budget: str = Query(default="auto", description="Memory budget: 'auto', '4GB', '8GB', '16GB', '32GB'"),
    tier: str = Query(default="auto", description="Model tier: 'auto', 'lite', 'standard', 'pro'"),
) -> dict:
    """Get a model recommendation based on available memory.

    Uses hardware detection (when budget='auto') or an explicit budget
    to recommend the best model + quantization level.
    """
    recommended = model_registry.recommend_model(budget=budget, tier=tier)
    whisper_rec = model_registry.recommend_whisper(budget=budget)
    hw = model_registry.detect_hardware()

    stack = model_registry.estimate_full_stack_memory(
        ollama_model=recommended.ollama_tag,
        whisper_size=model_registry.recommend_tier(budget),
        tts_enabled=True,
        kv_bits=settings.KV_CACHE_BITS,
    )

    return {
        "recommendation": {
            "ollama_model": recommended.ollama_tag,
            "ollama_model_name": recommended.name,
            "ollama_memory_mb": recommended.memory_mb,
            "ollama_quality": recommended.quality,
            "ollama_quantization": recommended.quantization,
            "whisper_model": whisper_rec["model_size"],
            "whisper_compute_type": whisper_rec["compute_type"],
            "whisper_memory_mb": whisper_rec["memory_mb"],
            "kv_cache_bits": settings.KV_CACHE_BITS,
        },
        "tier": model_registry.recommend_tier(budget),
        "budget": budget,
        "hardware": hw,
        "stack_estimate": stack,
    }


@router.post("/apply-tier")
async def apply_tier(
    tier: str = Query(..., description="Model tier to apply: 'lite', 'standard', 'pro'"),
) -> dict:
    """Get the configuration for a specific tier.

    Returns the recommended Ollama model tag, Whisper model size,
    and environment variables to apply. Note: this does not change
    running configuration — it returns what should be set.
    """
    if tier not in ("lite", "standard", "pro"):
        raise HTTPException(status_code=400, detail="Tier must be 'lite', 'standard', or 'pro'")

    model = model_registry.recommend_model(tier=tier)
    whisper = model_registry.recommend_whisper(budget=f"{model_registry.detect_hardware()['ram_total_mb']}MB")

    return {
        "tier": tier,
        "configuration": {
            "OPENCUTAI_OLLAMA_DEFAULT_MODEL": model.ollama_tag,
            "OPENCUTAI_WHISPER_MODEL_SIZE": whisper["model_size"],
            "OPENCUTAI_WHISPER_COMPUTE_TYPE": whisper["compute_type"],
            "OPENCUTAI_KV_CACHE_BITS": settings.KV_CACHE_BITS,
        },
        "model": {
            "name": model.name,
            "tag": model.ollama_tag,
            "memory_mb": model.memory_mb,
            "quality": model.quality,
            "description": model.description,
        },
    }


# ---------------------------------------------------------------------------
# Multi-model management — proxied to turboquant-service
# ---------------------------------------------------------------------------

class TQModelDownloadRequest(BaseModel):
    model_id: str = Field(..., description="HuggingFace model ID (e.g. 'Qwen/Qwen2.5-3B-Instruct')")


class TQModelLoadRequest(BaseModel):
    model_id: str = Field(..., description="Model ID to load into memory")


async def _tq_proxy_get(path: str) -> dict:
    """Proxy a GET request to the turboquant-service."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.TURBOQUANT_SERVICE_URL}{path}")
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="TurboQuant service not available. Start it with docker compose.",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


async def _tq_proxy_post(path: str, json_body: dict | None = None) -> dict:
    """Proxy a POST request to the turboquant-service."""
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{settings.TURBOQUANT_SERVICE_URL}{path}",
                json=json_body,
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="TurboQuant service not available. Start it with docker compose.",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


@router.get("/models")
async def tq_list_models() -> dict:
    """List all TurboQuant models: catalog + downloaded + active."""
    return await _tq_proxy_get("/v1/models")


@router.get("/models/catalog")
async def tq_model_catalog() -> dict:
    """Get the curated model catalog with download status."""
    return await _tq_proxy_get("/v1/models/catalog")


@router.get("/models/downloaded")
async def tq_downloaded_models() -> dict:
    """List models downloaded locally on the TurboQuant service."""
    return await _tq_proxy_get("/v1/models/downloaded")


@router.post("/models/download")
async def tq_download_model(request: TQModelDownloadRequest):
    """Download a model from HuggingFace to the TurboQuant service.

    Returns streaming JSON lines with progress updates.
    """
    try:
        async with httpx.AsyncClient(timeout=600) as client:
            async with client.stream(
                "POST",
                f"{settings.TURBOQUANT_SERVICE_URL}/v1/models/download",
                json={"model_id": request.model_id},
            ) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise HTTPException(status_code=resp.status_code, detail=body.decode())

                async def forward():
                    async for chunk in resp.aiter_bytes():
                        yield chunk

                return StreamingResponse(forward(), media_type="application/x-ndjson")
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="TurboQuant service not available. Start it with docker compose.",
        )


@router.post("/models/load")
async def tq_load_model(request: TQModelLoadRequest) -> dict:
    """Load a model into memory on the TurboQuant service."""
    return await _tq_proxy_post("/v1/models/load", {"model_id": request.model_id})


@router.post("/models/unload")
async def tq_unload_model() -> dict:
    """Unload the active model from the TurboQuant service."""
    return await _tq_proxy_post("/v1/models/unload")


@router.delete("/models/{model_id:path}")
async def tq_delete_model(model_id: str) -> dict:
    """Delete a downloaded model from the TurboQuant service."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.delete(
                f"{settings.TURBOQUANT_SERVICE_URL}/v1/models/{model_id}",
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="TurboQuant service not available.",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
