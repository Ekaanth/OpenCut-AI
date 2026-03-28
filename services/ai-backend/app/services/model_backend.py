"""Unified LLM backend abstraction — routes requests to Ollama or TurboQuant.

This module provides a single interface for all LLM inference in OpenCut-AI.
When TurboQuant is enabled (and its service is reachable), requests are routed
through the TurboQuant inference service for KV cache compression. Otherwise,
they fall back to Ollama.

Usage in routes:
    from app.services.model_backend import llm_backend

    response = await llm_backend.generate(prompt="Hello", system="You are helpful.")
    data = await llm_backend.generate_json(prompt="...", system="...")
"""

import json
import logging
import re
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class LLMBackend:
    """Unified LLM backend that transparently routes to Ollama or TurboQuant.

    TurboQuant is used as an addon when:
    1. settings.AI_LLM_BACKEND is "turboquant" or "auto"
    2. The TurboQuant service is reachable
    3. A model is loaded on the TurboQuant service

    When TurboQuant is unavailable, all requests fall back to Ollama.
    """

    def __init__(self) -> None:
        self._tq_available: bool | None = None  # cached check, reset periodically
        self._tq_check_count = 0

    # ── Public properties ─────────────────────────────────────────────

    @property
    def backend_mode(self) -> str:
        """Current backend preference: 'ollama', 'turboquant', or 'auto'."""
        return settings.AI_LLM_BACKEND

    @property
    def ollama_url(self) -> str:
        return settings.OLLAMA_URL

    @property
    def turboquant_url(self) -> str:
        return settings.TURBOQUANT_SERVICE_URL

    @property
    def default_model(self) -> str:
        return settings.OLLAMA_DEFAULT_MODEL

    # ── Backend selection ─────────────────────────────────────────────

    async def _is_turboquant_ready(self) -> bool:
        """Check if TurboQuant service is reachable and has a model loaded."""
        # Re-check every 10 calls to avoid hammering the service
        self._tq_check_count += 1
        if self._tq_available is not None and self._tq_check_count % 10 != 0:
            return self._tq_available

        try:
            async with httpx.AsyncClient(timeout=2) as client:
                resp = await client.get(f"{self.turboquant_url}/health")
                if resp.status_code == 200:
                    data = resp.json()
                    self._tq_available = data.get("active_model_loaded", False)
                    return self._tq_available
        except (httpx.ConnectError, httpx.TimeoutException):
            pass

        self._tq_available = False
        return False

    async def _should_use_turboquant(self) -> bool:
        """Determine if this request should go through TurboQuant."""
        mode = self.backend_mode
        if mode == "ollama":
            return False
        if mode == "turboquant":
            return await self._is_turboquant_ready()
        # "auto" — use TurboQuant when available, fall back to Ollama
        return await self._is_turboquant_ready()

    def reset_cache(self) -> None:
        """Force re-check of TurboQuant availability on next request."""
        self._tq_available = None

    # ── Ollama methods ────────────────────────────────────────────────

    def _ollama_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.ollama_url,
            timeout=httpx.Timeout(settings.OLLAMA_TIMEOUT, connect=10.0),
        )

    async def _ollama_generate(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
        format: str | None = None,
    ) -> str:
        payload: dict[str, Any] = {
            "model": model or self.default_model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            payload["system"] = system
        if format:
            payload["format"] = format

        async with self._ollama_client() as client:
            resp = await client.post("/api/generate", json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "")

    async def _ollama_generate_stream(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
    ) -> AsyncIterator[str]:
        """Stream tokens from Ollama generate endpoint."""
        payload: dict[str, Any] = {
            "model": model or self.default_model,
            "prompt": prompt,
            "stream": True,
        }
        if system:
            payload["system"] = system

        async with self._ollama_client() as client:
            async with client.stream("POST", "/api/generate", json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        token = data.get("response", "")
                        if token:
                            yield token
                    except json.JSONDecodeError:
                        continue

    async def _ollama_chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
    ) -> str:
        payload: dict[str, Any] = {
            "model": model or self.default_model,
            "messages": messages,
            "stream": False,
        }
        async with self._ollama_client() as client:
            resp = await client.post("/api/chat", json=payload)
            resp.raise_for_status()
            return resp.json().get("message", {}).get("content", "")

    # ── TurboQuant methods ────────────────────────────────────────────

    async def _tq_generate(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
    ) -> str:
        """Generate via TurboQuant's OpenAI-compatible chat completions."""
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=httpx.Timeout(300, connect=10.0)) as client:
            resp = await client.post(
                f"{self.turboquant_url}/v1/chat/completions",
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": 2048,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
            return ""

    async def _tq_chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
    ) -> str:
        async with httpx.AsyncClient(timeout=httpx.Timeout(300, connect=10.0)) as client:
            resp = await client.post(
                f"{self.turboquant_url}/v1/chat/completions",
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": 2048,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
            return ""

    async def _tq_generate_stream(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
    ) -> AsyncIterator[str]:
        """Stream tokens from TurboQuant's OpenAI-compatible endpoint."""
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=httpx.Timeout(300, connect=10.0)) as client:
            async with client.stream(
                "POST",
                f"{self.turboquant_url}/v1/chat/completions",
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": 2048,
                    "temperature": 0.7,
                    "stream": True,
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        token = delta.get("content", "")
                        if token:
                            yield token
                    except (json.JSONDecodeError, IndexError):
                        continue

    # ── Unified public interface ──────────────────────────────────────

    async def generate(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
        format: str | None = None,
    ) -> str:
        """Generate a completion — routes to TurboQuant or Ollama."""
        if await self._should_use_turboquant():
            try:
                logger.debug("Routing generate to TurboQuant")
                return await self._tq_generate(prompt, model, system)
            except Exception:
                logger.warning("TurboQuant generate failed, falling back to Ollama")
                self._tq_available = False

        return await self._ollama_generate(prompt, model, system, format)

    async def generate_stream(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
    ) -> AsyncIterator[str]:
        """Stream tokens from the active backend."""
        if await self._should_use_turboquant():
            try:
                logger.debug("Routing generate_stream to TurboQuant")
                async for token in self._tq_generate_stream(prompt, model, system):
                    yield token
                return
            except Exception:
                logger.warning("TurboQuant stream failed, falling back to Ollama")
                self._tq_available = False

        async for token in self._ollama_generate_stream(prompt, model, system):
            yield token

    async def generate_json(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
        _retries: int = 1,
    ) -> dict[str, Any]:
        """Generate a JSON response — routes to TurboQuant or Ollama.

        Retries once on parse failure since smaller models sometimes
        produce malformed JSON on the first attempt.
        """
        if await self._should_use_turboquant():
            try:
                logger.debug("Routing generate_json to TurboQuant")
                raw = await self._tq_generate(prompt, model, system)
                return _parse_json_response(raw)
            except Exception:
                logger.warning("TurboQuant generate_json failed, falling back to Ollama")
                self._tq_available = False

        # Ollama path with format="json"
        last_error: Exception | None = None
        for attempt in range(_retries + 1):
            try:
                raw = await self._ollama_generate(prompt, model, system, format="json")
                return _parse_json_response(raw)
            except ValueError as e:
                last_error = e
                if attempt < _retries:
                    logger.warning("JSON parse failed (attempt %d), retrying: %s", attempt + 1, e)
                    continue
                raise
        raise last_error or ValueError("LLM did not return valid JSON")

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
    ) -> str:
        """Multi-turn chat — routes to TurboQuant or Ollama."""
        if await self._should_use_turboquant():
            try:
                logger.debug("Routing chat to TurboQuant")
                return await self._tq_chat(messages, model)
            except Exception:
                logger.warning("TurboQuant chat failed, falling back to Ollama")
                self._tq_available = False

        return await self._ollama_chat(messages, model)

    async def check_available(self) -> bool:
        """Check if any LLM backend is available."""
        if await self._is_turboquant_ready():
            return True
        # Fall back to checking Ollama
        try:
            async with self._ollama_client() as client:
                resp = await client.get("/api/tags")
                return resp.status_code == 200
        except (httpx.ConnectError, httpx.TimeoutException):
            return False

    async def get_status(self) -> dict[str, Any]:
        """Get status of both backends."""
        tq_ready = await self._is_turboquant_ready()

        ollama_available = False
        ollama_models: list[dict] = []
        try:
            async with self._ollama_client() as client:
                resp = await client.get("/api/tags")
                if resp.status_code == 200:
                    ollama_available = True
                    ollama_models = resp.json().get("models", [])
        except Exception:
            pass

        tq_model = None
        if tq_ready:
            try:
                async with httpx.AsyncClient(timeout=2) as client:
                    resp = await client.get(f"{self.turboquant_url}/health")
                    if resp.status_code == 200:
                        tq_model = resp.json().get("active_model")
            except Exception:
                pass

        active_backend = "turboquant" if tq_ready and self.backend_mode != "ollama" else "ollama"

        return {
            "active_backend": active_backend,
            "backend_mode": self.backend_mode,
            "ollama": {
                "available": ollama_available,
                "url": self.ollama_url,
                "default_model": self.default_model,
                "models": ollama_models,
            },
            "turboquant": {
                "available": tq_ready,
                "url": self.turboquant_url,
                "active_model": tq_model,
                "kv_cache_bits": settings.KV_CACHE_BITS,
            },
        }


def _parse_json_response(raw: str) -> dict[str, Any]:
    """Parse a JSON response from an LLM, handling common quirks."""
    cleaned = raw.strip()
    if not cleaned:
        raise ValueError("LLM returned empty response")

    # Remove markdown code fences (```json ... ``` or ``` ... ```)
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = re.sub(r"\n?\s*```\s*$", "", cleaned)
    cleaned = cleaned.strip()

    # Strip any leading text before the first { (e.g. "Here is the JSON:\n{...")
    brace_start = cleaned.find("{")
    bracket_start = cleaned.find("[")
    if brace_start == -1 and bracket_start == -1:
        raise ValueError("LLM did not return valid JSON")

    # Pick whichever comes first
    if brace_start == -1:
        start = bracket_start
    elif bracket_start == -1:
        start = brace_start
    else:
        start = min(brace_start, bracket_start)
    cleaned = cleaned[start:]

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Strip trailing junk after the last } or ]
    for end_char_pos in range(len(cleaned) - 1, -1, -1):
        if cleaned[end_char_pos] in ("}", "]"):
            try:
                return json.loads(cleaned[: end_char_pos + 1])
            except json.JSONDecodeError:
                continue

    # Try fixing truncated JSON (LLM stopped mid-output)
    fixed = cleaned.rstrip()
    # Close any open strings
    if fixed.count('"') % 2 != 0:
        # Find last incomplete string value and close it
        fixed += '"'
    # Remove trailing comma before closing brackets
    fixed = re.sub(r",\s*$", "", fixed)
    # Close open brackets and braces
    open_brackets = fixed.count("[") - fixed.count("]")
    open_braces = fixed.count("{") - fixed.count("}")
    fixed += "]" * max(0, open_brackets)
    fixed += "}" * max(0, open_braces)

    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Last resort: try to extract any JSON object with a regex
    match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    logger.warning("Failed to parse LLM JSON response: %s", cleaned[:500])
    raise ValueError("LLM did not return valid JSON")


# Module-level singleton
llm_backend = LLMBackend()
