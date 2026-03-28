"""Hardware-aware model registry for automatic model selection.

Detects available RAM/VRAM and recommends the best model + quantization
level that fits the user's hardware. Implements the memory-budget system
described in the TurboQuant integration plan.
"""

import logging
import os
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Model tier definitions
# ---------------------------------------------------------------------------

@dataclass
class ModelSpec:
    """A specific model configuration with memory requirements."""

    name: str
    ollama_tag: str
    memory_mb: int
    quality: str  # "good", "great", "excellent"
    description: str
    quantization: str  # "fp16", "q8_0", "q5_K_M", "q4_K_M", "q3_K_M", "q2_K"
    kv_cache_mb_per_1k: float  # MB of KV cache per 1K context tokens at FP16


@dataclass
class ModelTier:
    """A collection of models grouped by resource requirements."""

    name: str  # "lite", "standard", "pro"
    label: str
    description: str
    min_ram_mb: int
    models: list[ModelSpec] = field(default_factory=list)


# Pre-defined model tiers
OLLAMA_MODEL_TIERS: list[ModelTier] = [
    ModelTier(
        name="lite",
        label="Lite",
        description="Minimal footprint, runs on 4-8 GB RAM",
        min_ram_mb=4096,
        models=[
            ModelSpec(
                name="Llama 3.2 1B (Q4)",
                ollama_tag="llama3.2:1b",
                memory_mb=800,
                quality="good",
                description="Fast, small, decent for simple commands",
                quantization="q4_K_M",
                kv_cache_mb_per_1k=2.0,
            ),
            ModelSpec(
                name="Llama 3.2 3B (Q3)",
                ollama_tag="llama3.2:3b-instruct-q3_K_M",
                memory_mb=1500,
                quality="great",
                description="Good balance at 3-bit quantization",
                quantization="q3_K_M",
                kv_cache_mb_per_1k=4.5,
            ),
        ],
    ),
    ModelTier(
        name="standard",
        label="Standard",
        description="Best quality/size balance, needs 8-16 GB RAM",
        min_ram_mb=8192,
        models=[
            ModelSpec(
                name="Llama 3.2 3B (Q4)",
                ollama_tag="llama3.2:3b-instruct-q4_K_M",
                memory_mb=2500,
                quality="great",
                description="Recommended default — excellent quality at 4-bit",
                quantization="q4_K_M",
                kv_cache_mb_per_1k=4.5,
            ),
            ModelSpec(
                name="Mistral 7B (Q4)",
                ollama_tag="mistral:7b-instruct-q4_K_M",
                memory_mb=5000,
                quality="excellent",
                description="High quality 7B model at 4-bit",
                quantization="q4_K_M",
                kv_cache_mb_per_1k=8.0,
            ),
        ],
    ),
    ModelTier(
        name="pro",
        label="Pro",
        description="Maximum quality, needs 16-32+ GB RAM or GPU",
        min_ram_mb=16384,
        models=[
            ModelSpec(
                name="Llama 3.1 8B (Q4)",
                ollama_tag="llama3.1:8b-instruct-q4_K_M",
                memory_mb=6000,
                quality="excellent",
                description="Best quality 8B at 4-bit",
                quantization="q4_K_M",
                kv_cache_mb_per_1k=10.0,
            ),
            ModelSpec(
                name="Mistral 7B (Q5)",
                ollama_tag="mistral:7b-instruct-q5_K_M",
                memory_mb=6500,
                quality="excellent",
                description="Near-lossless 7B at 5-bit",
                quantization="q5_K_M",
                kv_cache_mb_per_1k=8.0,
            ),
            ModelSpec(
                name="Llama 3.1 8B (Q3 TurboQuant)",
                ollama_tag="llama3.1:8b-instruct-q3_K_M",
                memory_mb=4000,
                quality="excellent",
                description="8B at 3-bit — TurboQuant KV cache makes this viable on 16 GB",
                quantization="q3_K_M",
                kv_cache_mb_per_1k=10.0,
            ),
        ],
    ),
]

# TurboQuant-compatible HuggingFace models (served by turboquant-service)
TURBOQUANT_HF_MODELS: list[dict[str, Any]] = [
    {
        "id": "Qwen/Qwen2.5-0.5B-Instruct",
        "name": "Qwen2.5 0.5B Instruct",
        "family": "qwen2.5",
        "params": "0.5B",
        "memory_fp16_mb": 1100,
        "memory_4bit_mb": 400,
        "context_length": 32768,
        "tier": "lite",
    },
    {
        "id": "Qwen/Qwen2.5-1.5B-Instruct",
        "name": "Qwen2.5 1.5B Instruct",
        "family": "qwen2.5",
        "params": "1.5B",
        "memory_fp16_mb": 3200,
        "memory_4bit_mb": 1100,
        "context_length": 32768,
        "tier": "lite",
    },
    {
        "id": "Qwen/Qwen2.5-3B-Instruct",
        "name": "Qwen2.5 3B Instruct",
        "family": "qwen2.5",
        "params": "3B",
        "memory_fp16_mb": 6400,
        "memory_4bit_mb": 2200,
        "context_length": 32768,
        "tier": "standard",
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
        "tier": "pro",
    },
    {
        "id": "Qwen/Qwen2.5-14B-Instruct",
        "name": "Qwen2.5 14B Instruct",
        "family": "qwen2.5",
        "params": "14B",
        "memory_fp16_mb": 28000,
        "memory_4bit_mb": 9500,
        "context_length": 131072,
        "tier": "pro",
    },
    {
        "id": "Qwen/Qwen2.5-Coder-3B-Instruct",
        "name": "Qwen2.5 Coder 3B",
        "family": "qwen2.5-coder",
        "params": "3B",
        "memory_fp16_mb": 6400,
        "memory_4bit_mb": 2200,
        "context_length": 32768,
        "tier": "standard",
    },
    {
        "id": "Qwen/Qwen2.5-Coder-7B-Instruct",
        "name": "Qwen2.5 Coder 7B",
        "family": "qwen2.5-coder",
        "params": "7B",
        "memory_fp16_mb": 14500,
        "memory_4bit_mb": 5000,
        "context_length": 131072,
        "tier": "pro",
    },
]

# Whisper model tiers
WHISPER_TIERS: dict[str, dict[str, Any]] = {
    "lite": {
        "model_size": "base",
        "compute_type": "int8",
        "memory_mb": 500,
        "quality": "good",
    },
    "standard": {
        "model_size": "small",
        "compute_type": "int8",
        "memory_mb": 1000,
        "quality": "great",
    },
    "pro": {
        "model_size": "medium",
        "compute_type": "int8",
        "memory_mb": 2500,
        "quality": "excellent",
    },
}

# TTS memory estimates
TTS_MEMORY: dict[str, int] = {
    "xtts_v2_fp16": 1800,
    "xtts_v2_int8": 900,
    "piper": 50,
}

# KV cache compression ratios from TurboQuant benchmarks
KV_CACHE_COMPRESSION: dict[int, dict[str, float]] = {
    4: {"ratio": 3.8, "cosine_sim": 0.9986, "quality": "near-lossless"},
    3: {"ratio": 5.0, "cosine_sim": 0.9953, "quality": "minor degradation"},
    2: {"ratio": 7.3, "cosine_sim": 0.9874, "quality": "noticeable loss"},
}


def _parse_budget_mb(budget: str) -> int | None:
    """Parse a memory budget string like '8GB' to MB."""
    if budget == "auto":
        return None
    budget = budget.strip().upper()
    if budget.endswith("GB"):
        return int(budget[:-2]) * 1024
    if budget.endswith("MB"):
        return int(budget[:-2])
    try:
        return int(budget)
    except ValueError:
        return None


class ModelRegistry:
    """Manages model selection based on available hardware and memory budget."""

    _instance: "ModelRegistry | None" = None

    def __new__(cls) -> "ModelRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def detect_hardware(self) -> dict[str, Any]:
        """Detect available system RAM and GPU VRAM."""
        info: dict[str, Any] = {
            "ram_total_mb": 0,
            "ram_available_mb": 0,
            "gpu_available": False,
            "gpu_vram_mb": 0,
            "gpu_name": None,
        }

        try:
            import psutil

            mem = psutil.virtual_memory()
            info["ram_total_mb"] = round(mem.total / 1024 / 1024)
            info["ram_available_mb"] = round(mem.available / 1024 / 1024)
        except ImportError:
            logger.warning("psutil not installed — cannot detect RAM")

        try:
            import torch

            if torch.cuda.is_available():
                info["gpu_available"] = True
                device = torch.cuda.current_device()
                props = torch.cuda.get_device_properties(device)
                info["gpu_vram_mb"] = round(props.total_mem / 1024 / 1024)
                info["gpu_name"] = props.name
        except ImportError:
            pass

        return info

    def recommend_tier(self, budget: str = "auto") -> str:
        """Recommend a model tier based on hardware or explicit budget."""
        budget_mb = _parse_budget_mb(budget)
        if budget_mb is None:
            hw = self.detect_hardware()
            budget_mb = hw["ram_available_mb"]

        if budget_mb >= 16384:
            return "pro"
        if budget_mb >= 8192:
            return "standard"
        return "lite"

    def recommend_model(self, budget: str = "auto", tier: str = "auto") -> ModelSpec:
        """Select the best model that fits within the memory budget."""
        if tier == "auto":
            tier = self.recommend_tier(budget)

        budget_mb = _parse_budget_mb(budget)
        if budget_mb is None:
            hw = self.detect_hardware()
            # Reserve ~40% of RAM for OS and other services
            budget_mb = int(hw["ram_available_mb"] * 0.6)

        # Find the tier
        tier_data = next((t for t in OLLAMA_MODEL_TIERS if t.name == tier), OLLAMA_MODEL_TIERS[0])

        # Pick the largest model that fits
        best = tier_data.models[0]
        for model in tier_data.models:
            if model.memory_mb <= budget_mb:
                best = model

        return best

    def recommend_whisper(self, budget: str = "auto") -> dict[str, Any]:
        """Recommend a Whisper model size based on budget."""
        tier = self.recommend_tier(budget)
        return WHISPER_TIERS.get(tier, WHISPER_TIERS["lite"])

    def estimate_kv_cache_savings(
        self,
        model_kv_mb_per_1k: float,
        context_length: int,
        num_layers: int = 32,
        kv_bits: int = 4,
    ) -> dict[str, Any]:
        """Estimate KV cache memory savings from TurboQuant compression."""
        baseline_mb = model_kv_mb_per_1k * (context_length / 1000) * (num_layers / 32)
        compression = KV_CACHE_COMPRESSION.get(kv_bits, KV_CACHE_COMPRESSION[4])
        compressed_mb = baseline_mb / compression["ratio"]

        return {
            "baseline_kv_cache_mb": round(baseline_mb, 1),
            "compressed_kv_cache_mb": round(compressed_mb, 1),
            "savings_mb": round(baseline_mb - compressed_mb, 1),
            "compression_ratio": compression["ratio"],
            "quality": compression["quality"],
            "cosine_similarity": compression["cosine_sim"],
            "kv_bits": kv_bits,
        }

    def get_all_tiers(self) -> list[dict[str, Any]]:
        """Return all model tiers with their specs for the frontend."""
        result = []
        for tier in OLLAMA_MODEL_TIERS:
            models = []
            for m in tier.models:
                models.append({
                    "name": m.name,
                    "ollama_tag": m.ollama_tag,
                    "memory_mb": m.memory_mb,
                    "quality": m.quality,
                    "description": m.description,
                    "quantization": m.quantization,
                })
            result.append({
                "name": tier.name,
                "label": tier.label,
                "description": tier.description,
                "min_ram_mb": tier.min_ram_mb,
                "models": models,
            })
        return result

    def get_hf_models_for_tier(self, tier: str = "auto", budget: str = "auto") -> list[dict[str, Any]]:
        """Return HuggingFace models suitable for a given tier/budget."""
        if tier == "auto":
            tier = self.recommend_tier(budget)

        budget_mb = _parse_budget_mb(budget)
        if budget_mb is None:
            hw = self.detect_hardware()
            budget_mb = int(hw["ram_available_mb"] * 0.6)

        use_4bit = True  # Assume 4-bit on GPU, fp16 otherwise
        result = []
        for m in TURBOQUANT_HF_MODELS:
            mem = m["memory_4bit_mb"] if use_4bit else m["memory_fp16_mb"]
            if mem <= budget_mb:
                result.append({**m, "fits_budget": True, "effective_memory_mb": mem})
            else:
                result.append({**m, "fits_budget": False, "effective_memory_mb": mem})
        return result

    def estimate_full_stack_memory(
        self,
        ollama_model: str = "auto",
        whisper_size: str = "auto",
        tts_enabled: bool = True,
        kv_bits: int = 4,
    ) -> dict[str, Any]:
        """Estimate total memory for running the full AI stack."""
        # Find the Ollama model spec
        ollama_mem = 2500  # Default
        ollama_kv = 4.5
        for tier in OLLAMA_MODEL_TIERS:
            for m in tier.models:
                if m.ollama_tag == ollama_model:
                    ollama_mem = m.memory_mb
                    ollama_kv = m.kv_cache_mb_per_1k
                    break

        # Whisper memory
        whisper_mem = WHISPER_TIERS.get(whisper_size, {}).get("memory_mb", 500)

        # TTS memory
        tts_mem = TTS_MEMORY["xtts_v2_int8"] if tts_enabled else 0

        # KV cache at 8K context
        kv_savings = self.estimate_kv_cache_savings(ollama_kv, 8192, kv_bits=kv_bits)

        total_without_kv = ollama_mem + whisper_mem + tts_mem
        total_with_kv = total_without_kv + kv_savings["compressed_kv_cache_mb"]
        total_baseline_kv = total_without_kv + kv_savings["baseline_kv_cache_mb"]

        return {
            "ollama_mb": ollama_mem,
            "whisper_mb": whisper_mem,
            "tts_mb": tts_mem,
            "kv_cache_compressed_mb": kv_savings["compressed_kv_cache_mb"],
            "kv_cache_baseline_mb": kv_savings["baseline_kv_cache_mb"],
            "total_with_turboquant_mb": round(total_with_kv),
            "total_without_turboquant_mb": round(total_baseline_kv),
            "savings_mb": round(total_baseline_kv - total_with_kv),
            "kv_bits": kv_bits,
        }


# Module-level singleton
model_registry = ModelRegistry()
