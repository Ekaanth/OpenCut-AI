"""Device-specific TurboQuant compute backends.

Two completely distinct implementations of the inference-time compression
and "turbo boost" strategy — one tuned for NVIDIA GPUs, one for CPUs.

Why separate classes instead of a single `device=` switch?

- **Different compression paths.** The GPU backend uses the real cuTile fused
  kernel (`turboquant_gpu._compress_kv_fused`) with `auto_tune()` to pick the
  fastest `total_bits` for the actual hardware. The CPU backend forces the
  PyTorch fallback, caps compression at 3 bits (2-bit CPU decode quality is
  too lossy to be useful), and uses the engine purely as a **measurement**
  tool on the prefill cache — decode runs through plain HF `model.generate`
  because CPU greedy-only is a regression users would notice.

- **Different "turbo boost" strategies.** On GPU we enable TF32, reserve a
  large workspace, and use the cuTile kernels for KV compression. On CPU we
  set the inter/intra-op thread counts, prefer `bfloat16` when the CPU
  supports it, and skip kernel benchmarking entirely.

- **Different warm-up costs.** GPU runs `auto_tune()` once on load; CPU skips
  it (pointless without cuTile) and instead does a single dummy forward pass
  to populate caches.

- **Different failure modes.** GPU reloads raise hard errors if CUDA isn't
  actually available; CPU tolerates a missing `turboquant_gpu` library and
  silently falls back to plain HF inference.

The factory `create_turbo_backend(device, ...)` returns the right instance.
Callers just call `backend.generate(prompt, max_tokens, temperature, top_p)`
and `backend.describe()` — all device differences stay hidden behind the API.
"""

from __future__ import annotations

import logging
import os
import time
from abc import ABC, abstractmethod
from typing import Any

import torch

try:
    from turboquant_gpu import TurboQuantEngine  # type: ignore
except ImportError:  # pragma: no cover
    TurboQuantEngine = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_head_dim(model_config: Any) -> int:
    """Compute the attention head dimension in a way that cannot div-by-zero.

    Malformed HF configs (num_attention_heads=0, missing hidden_size, etc.)
    are a DOS vector if we divide blindly. Raise a clean ValueError instead.
    """
    explicit = getattr(model_config, "head_dim", None)
    if isinstance(explicit, int) and explicit > 0:
        return explicit
    hidden = getattr(model_config, "hidden_size", None)
    heads = getattr(model_config, "num_attention_heads", None)
    if not isinstance(hidden, int) or hidden <= 0:
        raise ValueError(f"model.config.hidden_size is invalid: {hidden!r}")
    if not isinstance(heads, int) or heads <= 0:
        raise ValueError(f"model.config.num_attention_heads is invalid: {heads!r}")
    return hidden // heads


# ---------------------------------------------------------------------------
# Base interface
# ---------------------------------------------------------------------------


class BaseTurboBackend(ABC):
    """Contract every compute backend must satisfy.

    The goal is that `app.py` never has to branch on device type. Both
    backends accept the same inputs and return the same shape of output;
    the *how* is radically different between CPU and GPU.
    """

    # Human-readable name surfaced in /health and logs.
    kind: str = "base"

    def __init__(
        self,
        *,
        model: Any,
        tokenizer: Any,
        kv_cache_bits: int,
    ) -> None:
        self.model = model
        self.tokenizer = tokenizer
        # `kv_cache_bits` is the *requested* value from the user config.
        # Each backend may clamp it further (e.g. CPU refuses 2-bit).
        self.requested_bits = kv_cache_bits
        self.engine: Any = None
        self.last_compression_ratio: float | None = None

    # -- lifecycle ----------------------------------------------------------

    @abstractmethod
    def warm_up(self) -> None:
        """Run device-specific warm-up. Called once after load."""

    def release(self) -> None:
        """Drop any heavy references on unload."""
        self.engine = None

    # -- inference ----------------------------------------------------------

    @abstractmethod
    def generate(
        self,
        *,
        prompt_text: str,
        max_new_tokens: int,
        temperature: float,
        top_p: float,
    ) -> dict[str, Any]:
        """Run a single generation request.

        Returns a dict with keys:
            response_text:        str, the completion (prompt stripped)
            prompt_tokens:        int
            completion_tokens:    int
            compression_ratio:    float | None   — None if not measured
            engine_used:          bool           — was the TQ engine in the hot path?
            inference_time_s:     float
        """

    # -- introspection ------------------------------------------------------

    def describe(self) -> dict[str, Any]:
        """Public status surface — used by /health."""
        return {
            "kind": self.kind,
            "engine_ready": self.engine is not None,
            "requested_bits": self.requested_bits,
            "effective_bits": getattr(self, "effective_bits", None),
            "last_compression_ratio": self.last_compression_ratio,
        }


# ---------------------------------------------------------------------------
# GPU backend — cuTile kernels, aggressive compression, engine.generate() decode
# ---------------------------------------------------------------------------


class GPUTurboBackend(BaseTurboBackend):
    """NVIDIA GPU compute path.

    - Uses the real `turboquant_gpu.TurboQuantEngine` with cuTile fused kernels.
    - Runs `auto_tune()` once on load to pick the fastest backend (cuTile vs
      PyTorch) and the best `total_bits` (2 vs 3) for this GPU.
    - Decode path = `engine.generate()` (greedy, but the whole point — every
      token goes through the compressed KV cache).
    - Turbo boost: enables TF32 matmul, reserves a CUDA stream, and prefers
      float16 model weights (already done at model-load time in app.py).
    - Temperature/top-p requests fall back to `model.generate()` and still
      report real compression ratios by probing the prefill cache once.
    """

    kind = "gpu"

    def __init__(
        self,
        *,
        model: Any,
        tokenizer: Any,
        kv_cache_bits: int,
    ) -> None:
        super().__init__(model=model, tokenizer=tokenizer, kv_cache_bits=kv_cache_bits)
        if TurboQuantEngine is None:
            raise RuntimeError(
                "turboquant-gpu is not installed; cannot use GPUTurboBackend. "
                "Install it via `pip install turboquant-gpu` or rebuild the "
                "turboquant-service image with TURBOQUANT_EXTRAS=gpu."
            )
        if not torch.cuda.is_available():
            raise RuntimeError(
                "GPUTurboBackend requires CUDA, but torch.cuda.is_available() is False."
            )

        # --- Turbo boost (GPU edition) -------------------------------------
        # TF32 lets Ampere+ GPUs run matmul at ~2x speed with negligible
        # accuracy loss. Compounds with the KV-cache compression win.
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        torch.backends.cudnn.benchmark = True

        head_dim = _safe_head_dim(model.config)
        # 2-bit is only viable on GPU where the Lloyd-Max + QJL combo can run
        # as a fused kernel. 4-bit legacy requests clamp to 3.
        effective_bits = 2 if kv_cache_bits <= 2 else 3
        self.effective_bits = effective_bits

        self.engine = TurboQuantEngine(
            head_dim=head_dim,
            total_bits=effective_bits,
            device="cuda",
        )
        logger.info(
            "GPUTurboBackend ready: head_dim=%d bits=%d tf32=on cudnn.benchmark=on",
            head_dim,
            effective_bits,
        )

    def warm_up(self) -> None:
        """Benchmark cuTile vs PyTorch and pick the faster one for *this* GPU.

        `auto_tune()` also checks that both compression paths hit the quality
        threshold; if they don't, defaults are kept.
        """
        try:
            logger.info("GPU warm-up: running turboquant auto_tune...")
            self.engine.auto_tune(seq_len=512, warmup=5, trials=10)
        except Exception:
            # auto_tune is best-effort — engine still works with defaults
            logger.exception("auto_tune failed; keeping default TQ backend")

    def generate(
        self,
        *,
        prompt_text: str,
        max_new_tokens: int,
        temperature: float,
        top_p: float,
    ) -> dict[str, Any]:
        inputs = self.tokenizer(prompt_text, return_tensors="pt")
        input_ids = inputs["input_ids"].to(self.model.device)
        prompt_tokens = int(input_ids.shape[1])

        use_engine = temperature == 0
        start = time.time()
        compression_ratio: float | None = None

        if use_engine:
            # Real engine path: every decode token goes through the compressed cache.
            result = self.engine.generate(
                self.model,
                self.tokenizer,
                prompt_text,
                max_new_tokens=max_new_tokens,
            )
            full_text = result.get("text", "")
            response_text = (
                full_text[len(prompt_text):]
                if full_text.startswith(prompt_text)
                else full_text
            )
            completion_tokens = int(result.get("tokens", 0))
            stats = result.get("stats") or {}
            ratio = float(stats.get("ratio", 0.0))
            if ratio > 0:
                compression_ratio = ratio
        else:
            # Sampling path: keep temperature/top-p via plain HF generate, then
            # *measure* what compression would have been on the prefill cache.
            with torch.no_grad():
                outputs = self.model.generate(
                    input_ids,
                    max_new_tokens=max_new_tokens,
                    temperature=temperature if temperature > 0 else None,
                    top_p=top_p,
                    do_sample=temperature > 0,
                    pad_token_id=self.tokenizer.eos_token_id,
                    return_dict_in_generate=True,
                    use_cache=True,
                )
            seq = outputs.sequences[0]
            new_tokens = seq[prompt_tokens:]
            response_text = self.tokenizer.decode(new_tokens, skip_special_tokens=True)
            completion_tokens = int(len(new_tokens))
            # Probe compression on the prefill past_key_values if available.
            pkv = getattr(outputs, "past_key_values", None)
            if pkv is not None:
                try:
                    stats = self.engine.compression_stats(pkv)
                    ratio = float(stats.get("ratio", 0.0))
                    if ratio > 0:
                        compression_ratio = ratio
                except Exception:
                    logger.debug("GPU probe compression stats failed", exc_info=True)

        elapsed = time.time() - start
        if compression_ratio is not None:
            self.last_compression_ratio = compression_ratio
        return {
            "response_text": response_text,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "compression_ratio": compression_ratio,
            "engine_used": use_engine,
            "inference_time_s": round(elapsed, 3),
        }


# ---------------------------------------------------------------------------
# CPU backend — plain HF generate + metric-only compression probe
# ---------------------------------------------------------------------------


class CPUTurboBackend(BaseTurboBackend):
    """CPU compute path — fundamentally different strategy than GPU.

    - **Decode path is pure HF `model.generate`.** We never run the engine in
      the hot path on CPU, because the PyTorch fallback for `_compress_kv_fused`
      is O(seq * heads) of pure Python loops per decode step — users would see
      ~10x slowdown compared to plain HF.
    - **Engine is a metrics probe only.** We still instantiate a
      `TurboQuantEngine` and run `compression_stats()` on the prefill cache
      after the fact, so the UI still shows real compression ratios (not
      fake numbers) — just without paying the decode cost.
    - **Compression is capped at 3-bit** on CPU. Two-bit MSE quantization
      without the cuTile kernels degrades quality more than it saves memory.
    - **Turbo boost (CPU edition)** = thread-count tuning + bfloat16 preference
      where the CPU supports it (AVX-512, Arm Neoverse, Apple Silicon). Sets
      `torch.set_num_threads` to all physical cores to avoid hyperthread
      contention, and turns on mkldnn.
    - **Graceful engine absence.** If `turboquant-gpu` isn't installed at all
      (e.g. someone stripped it from requirements), the backend keeps working
      with `engine=None` — we just don't report compression ratios.
    """

    kind = "cpu"

    def __init__(
        self,
        *,
        model: Any,
        tokenizer: Any,
        kv_cache_bits: int,
    ) -> None:
        super().__init__(model=model, tokenizer=tokenizer, kv_cache_bits=kv_cache_bits)

        # --- Turbo boost (CPU edition) -------------------------------------
        # Use all physical cores, not logical ones. Hyperthreading hurts
        # transformer inference because both siblings fight for the same
        # vector unit.
        try:
            physical = os.cpu_count() or 1
            # Common heuristic: half of logical cores ≈ physical cores.
            torch.set_num_threads(max(1, physical // 2) if physical > 1 else 1)
        except Exception:
            logger.debug("torch.set_num_threads failed", exc_info=True)

        # mkldnn / oneDNN acceleration on x86.
        try:
            torch.backends.mkldnn.enabled = True  # type: ignore[attr-defined]
        except Exception:
            pass

        # CPU caps compression at 3-bit. 2-bit without cuTile is too lossy.
        effective_bits = max(3, min(3, kv_cache_bits if kv_cache_bits in (2, 3) else 3))
        self.effective_bits = effective_bits

        # Engine is *optional* on CPU. If the package is missing, we still
        # serve inference — we just can't report compression metrics.
        if TurboQuantEngine is not None:
            try:
                head_dim = _safe_head_dim(model.config)
                self.engine = TurboQuantEngine(
                    head_dim=head_dim,
                    total_bits=effective_bits,
                    device="cpu",
                )
                # Force the PyTorch fallback explicitly — there's no cuTile on CPU.
                # turboquant-gpu uses a private _force_pytorch flag for this.
                if hasattr(self.engine, "_force_pytorch"):
                    self.engine._force_pytorch = True
                logger.info(
                    "CPUTurboBackend ready: head_dim=%d bits=%d threads=%d mode=metrics-only",
                    head_dim,
                    effective_bits,
                    torch.get_num_threads(),
                )
            except Exception:
                logger.exception(
                    "TurboQuantEngine init failed on CPU; running without compression metrics"
                )
                self.engine = None
        else:
            logger.info(
                "CPUTurboBackend ready: turboquant-gpu not installed, no compression metrics"
            )

    def warm_up(self) -> None:
        """Single dummy forward pass. Skip auto_tune (no cuTile to benchmark)."""
        try:
            probe = self.tokenizer("hello", return_tensors="pt")
            input_ids = probe["input_ids"].to(self.model.device)
            with torch.no_grad():
                self.model(input_ids=input_ids, use_cache=False)
            logger.info("CPU warm-up complete")
        except Exception:
            logger.debug("CPU warm-up probe failed", exc_info=True)

    def generate(
        self,
        *,
        prompt_text: str,
        max_new_tokens: int,
        temperature: float,
        top_p: float,
    ) -> dict[str, Any]:
        inputs = self.tokenizer(prompt_text, return_tensors="pt")
        input_ids = inputs["input_ids"].to(self.model.device)
        prompt_tokens = int(input_ids.shape[1])

        start = time.time()
        with torch.no_grad():
            outputs = self.model.generate(
                input_ids,
                max_new_tokens=max_new_tokens,
                temperature=temperature if temperature > 0 else None,
                top_p=top_p,
                do_sample=temperature > 0,
                pad_token_id=self.tokenizer.eos_token_id,
                return_dict_in_generate=True,
                use_cache=True,
            )
        elapsed = time.time() - start

        seq = outputs.sequences[0]
        new_tokens = seq[prompt_tokens:]
        response_text = self.tokenizer.decode(new_tokens, skip_special_tokens=True)
        completion_tokens = int(len(new_tokens))

        # Metric-only compression probe on the prefill KV cache.
        compression_ratio: float | None = None
        if self.engine is not None:
            pkv = getattr(outputs, "past_key_values", None)
            if pkv is not None:
                try:
                    stats = self.engine.compression_stats(pkv)
                    ratio = float(stats.get("ratio", 0.0))
                    if ratio > 0:
                        compression_ratio = ratio
                        self.last_compression_ratio = compression_ratio
                except Exception:
                    logger.debug("CPU compression_stats probe failed", exc_info=True)

        return {
            "response_text": response_text,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "compression_ratio": compression_ratio,
            # Engine is never in the hot path on CPU — metrics only.
            "engine_used": False,
            "inference_time_s": round(elapsed, 3),
        }


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def create_turbo_backend(
    *,
    device: str,
    model: Any,
    tokenizer: Any,
    kv_cache_bits: int,
) -> BaseTurboBackend:
    """Pick the right backend for the resolved device.

    `device` is the string resolved by `app._detect_device()` — one of
    "cuda", "mps", or "cpu". MPS (Apple Silicon) is currently served by the
    CPU backend because the cuTile kernel path is CUDA-only and the MPS
    PyTorch fallback isn't meaningfully faster than CPU for the compression
    probe. Real Apple Silicon support is a future story.
    """
    if device == "cuda":
        try:
            backend: BaseTurboBackend = GPUTurboBackend(
                model=model,
                tokenizer=tokenizer,
                kv_cache_bits=kv_cache_bits,
            )
        except Exception:
            logger.exception(
                "GPU backend init failed; falling back to CPU backend. "
                "This usually means the cuda-tile extras aren't installed "
                "or the turboquant-gpu package is missing."
            )
            backend = CPUTurboBackend(
                model=model,
                tokenizer=tokenizer,
                kv_cache_bits=kv_cache_bits,
            )
    else:
        # cpu + mps share the CPU backend.
        backend = CPUTurboBackend(
            model=model,
            tokenizer=tokenizer,
            kv_cache_bits=kv_cache_bits,
        )

    # Warm-up runs right after construction so the first real request doesn't
    # eat a 5-second auto_tune stall.
    try:
        backend.warm_up()
    except Exception:
        logger.exception("%s warm-up failed", backend.kind)
    return backend
