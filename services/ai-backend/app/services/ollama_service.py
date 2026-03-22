"""Ollama LLM integration service."""

import json
import logging
import re
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class OllamaService:
    """Client for the Ollama REST API."""

    def __init__(self) -> None:
        self.base_url = settings.OLLAMA_URL
        self.timeout = settings.OLLAMA_TIMEOUT
        self.default_model = settings.OLLAMA_DEFAULT_MODEL

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(self.timeout, connect=10.0),
        )

    async def check_available(self) -> bool:
        """Check whether the Ollama server is reachable."""
        try:
            async with self._client() as client:
                resp = await client.get("/api/tags")
                return resp.status_code == 200
        except (httpx.ConnectError, httpx.TimeoutException):
            logger.warning("Ollama server not reachable at %s", self.base_url)
            return False

    async def list_models(self) -> list[dict[str, Any]]:
        """Return a list of locally available models."""
        try:
            async with self._client() as client:
                resp = await client.get("/api/tags")
                resp.raise_for_status()
                data = resp.json()
                return data.get("models", [])
        except Exception:
            logger.exception("Failed to list Ollama models")
            return []

    async def pull_model(self, model: str) -> dict[str, Any]:
        """Pull / download a model. Returns the final status."""
        async with self._client() as client:
            resp = await client.post(
                "/api/pull",
                json={"name": model, "stream": False},
                timeout=httpx.Timeout(600.0, connect=10.0),
            )
            resp.raise_for_status()
            return resp.json()

    async def generate(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
        format: str | None = None,
    ) -> str:
        """Generate a completion and return the response text."""
        payload: dict[str, Any] = {
            "model": model or self.default_model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            payload["system"] = system
        if format:
            payload["format"] = format

        async with self._client() as client:
            resp = await client.post("/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")

    async def generate_json(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
    ) -> dict[str, Any]:
        """Generate a completion and parse the response as JSON.

        Handles common LLM quirks:
        - Trailing whitespace / newlines after valid JSON
        - Truncated JSON (attempts to close open brackets)
        - JSON embedded in markdown code fences
        """
        raw = await self.generate(
            prompt=prompt,
            model=model,
            system=system,
            format="json",
        )

        # Strip whitespace
        cleaned = raw.strip()

        # Remove markdown code fences if present
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```\s*$", "", cleaned)
            cleaned = cleaned.strip()

        # Try parsing as-is first
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Try to extract the first complete JSON object from the text
        # Find the first '{' and try to match it
        brace_start = cleaned.find("{")
        if brace_start == -1:
            logger.error("Ollama returned no JSON object: %s", raw[:500])
            raise ValueError("LLM did not return valid JSON")

        # Try progressively from the end to find valid JSON
        text = cleaned[brace_start:]
        for end_pos in range(len(text), 0, -1):
            try:
                return json.loads(text[:end_pos])
            except json.JSONDecodeError:
                continue

        # Last resort: try to fix truncated JSON by closing open brackets
        fixed = text.rstrip()
        open_braces = fixed.count("{") - fixed.count("}")
        open_brackets = fixed.count("[") - fixed.count("]")
        # Close any unclosed strings
        if fixed.count('"') % 2 != 0:
            fixed += '"'
        fixed += "]" * open_brackets
        fixed += "}" * open_braces

        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            logger.error("Ollama returned unfixable JSON: %s", raw[:500])
            raise ValueError("LLM did not return valid JSON")

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
    ) -> str:
        """Multi-turn chat completion."""
        payload: dict[str, Any] = {
            "model": model or self.default_model,
            "messages": messages,
            "stream": False,
        }
        async with self._client() as client:
            resp = await client.post("/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")


# Module-level singleton
ollama_service = OllamaService()
