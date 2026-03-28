"""TurboQuant optimization management service.

Manages TurboQuant-powered model optimization, provides memory estimates,
and coordinates with the TurboQuant inference service when available.

TurboQuant uses PolarQuant + QJL for 3-bit KV cache compression with zero
accuracy loss (6x memory reduction). This service provides:

- Status checks for the TurboQuant inference service
- Memory estimation for different quantization configurations
- Optimization recommendations based on the current AI stack
- KV cache compression configuration management
"""

import logging
from typing import Any

import httpx

from app.config import settings
from app.services.model_registry import KV_CACHE_COMPRESSION, model_registry

logger = logging.getLogger(__name__)


class TurboQuantService:
    """Manages TurboQuant optimization status and recommendations."""

    _instance: "TurboQuantService | None" = None

    def __new__(cls) -> "TurboQuantService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def service_url(self) -> str:
        return settings.TURBOQUANT_SERVICE_URL

    @property
    def kv_cache_bits(self) -> int:
        return settings.KV_CACHE_BITS

    async def check_service_available(self) -> bool:
        """Check whether the TurboQuant inference service is reachable."""
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                resp = await client.get(f"{self.service_url}/health")
                return resp.status_code == 200
        except (httpx.ConnectError, httpx.TimeoutException):
            return False

    async def get_service_status(self) -> dict[str, Any]:
        """Get detailed status from the TurboQuant inference service."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.service_url}/health")
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "available": True,
                        "model": data.get("model"),
                        "kv_cache_bits": data.get("kv_cache_bits"),
                        "max_context_length": data.get("max_context_length"),
                        "gpu_available": data.get("gpu_available", False),
                        "memory_usage": data.get("memory_usage"),
                    }
                return {"available": False, "reason": f"HTTP {resp.status_code}"}
        except httpx.ConnectError:
            return {
                "available": False,
                "reason": "TurboQuant service not running. Start it with docker compose.",
            }
        except httpx.TimeoutException:
            return {"available": False, "reason": "TurboQuant service timed out"}
        except Exception as e:
            return {"available": False, "reason": str(e)}

    def get_optimization_status(self) -> dict[str, Any]:
        """Return current optimization configuration and its impact."""
        kv_bits = self.kv_cache_bits
        compression = KV_CACHE_COMPRESSION.get(kv_bits, KV_CACHE_COMPRESSION[4])

        hw = model_registry.detect_hardware()
        recommended_tier = model_registry.recommend_tier(settings.AI_MEMORY_BUDGET)
        recommended_model = model_registry.recommend_model(
            budget=settings.AI_MEMORY_BUDGET,
            tier=settings.AI_MODEL_TIER,
        )

        stack_estimate = model_registry.estimate_full_stack_memory(
            ollama_model=recommended_model.ollama_tag,
            whisper_size=recommended_tier,
            tts_enabled=True,
            kv_bits=kv_bits,
        )

        return {
            "kv_cache_bits": kv_bits,
            "kv_compression_ratio": compression["ratio"],
            "kv_quality": compression["quality"],
            "kv_cosine_similarity": compression["cosine_sim"],
            "memory_budget": settings.AI_MEMORY_BUDGET,
            "model_tier": settings.AI_MODEL_TIER,
            "recommended_tier": recommended_tier,
            "recommended_model": {
                "name": recommended_model.name,
                "ollama_tag": recommended_model.ollama_tag,
                "memory_mb": recommended_model.memory_mb,
                "quality": recommended_model.quality,
                "quantization": recommended_model.quantization,
            },
            "hardware": hw,
            "stack_memory_estimate": stack_estimate,
        }

    def get_supported_configurations(self) -> list[dict[str, Any]]:
        """Return all supported KV cache bit configurations."""
        configs = []
        for bits, info in sorted(KV_CACHE_COMPRESSION.items()):
            configs.append({
                "bits": bits,
                "compression_ratio": info["ratio"],
                "cosine_similarity": info["cosine_sim"],
                "quality": info["quality"],
                "recommended": bits == 4,
                "description": _bit_description(bits),
            })
        return configs

    def estimate_optimization_impact(
        self,
        model_tag: str | None = None,
        context_length: int = 8192,
        kv_bits: int | None = None,
    ) -> dict[str, Any]:
        """Estimate the impact of TurboQuant optimization for a specific model."""
        if kv_bits is None:
            kv_bits = self.kv_cache_bits

        # Find the model spec
        from app.services.model_registry import OLLAMA_MODEL_TIERS

        model_kv = 4.5  # Default
        model_mem = 2500
        model_name = model_tag or settings.OLLAMA_DEFAULT_MODEL

        for tier in OLLAMA_MODEL_TIERS:
            for m in tier.models:
                if m.ollama_tag == model_tag:
                    model_kv = m.kv_cache_mb_per_1k
                    model_mem = m.memory_mb
                    model_name = m.name
                    break

        kv_savings = model_registry.estimate_kv_cache_savings(
            model_kv, context_length, kv_bits=kv_bits,
        )

        return {
            "model": model_name,
            "model_tag": model_tag,
            "context_length": context_length,
            "model_weight_mb": model_mem,
            "kv_cache": kv_savings,
            "total_with_turboquant_mb": model_mem + kv_savings["compressed_kv_cache_mb"],
            "total_without_turboquant_mb": model_mem + kv_savings["baseline_kv_cache_mb"],
            "memory_saved_mb": kv_savings["savings_mb"],
            "memory_saved_percent": round(
                (kv_savings["savings_mb"] / (model_mem + kv_savings["baseline_kv_cache_mb"])) * 100,
                1,
            ),
        }


def _bit_description(bits: int) -> str:
    """Human-readable description for each bit width."""
    return {
        2: "Aggressive compression (7.3x). Some quality loss — avoid for creative tasks.",
        3: "Strong compression (5x). Minor degradation, good for most tasks.",
        4: "Recommended (3.8x). Near-lossless, safe for all production workloads.",
    }.get(bits, f"{bits}-bit quantization")


# Module-level singleton
turboquant_service = TurboQuantService()
