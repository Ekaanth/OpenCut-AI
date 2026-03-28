"""LLM status and model management routes."""

import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.model_backend import llm_backend
from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/llm", tags=["llm"])


class PullModelRequest(BaseModel):
    model: str


class SetModelRequest(BaseModel):
    model: str


class ChatRequest(BaseModel):
    message: str
    system: str | None = None
    model: str | None = None


class LLMStatusResponse(BaseModel):
    available: bool
    url: str
    default_model: str = ""
    active_backend: str = "ollama"
    turboquant_available: bool = False
    turboquant_model: str | None = None
    models: list[dict] = []


@router.get("/status")
async def llm_status() -> dict:
    """Check LLM availability, list models, and show active backend."""
    status = await llm_backend.get_status()
    ollama = status["ollama"]
    tq = status["turboquant"]

    return {
        "available": ollama["available"] or tq["available"],
        "url": ollama["url"],
        "default_model": ollama_service.default_model,
        "active_backend": status["active_backend"],
        "turboquant_available": tq["available"],
        "turboquant_model": tq["active_model"],
        "kv_cache_bits": tq["kv_cache_bits"],
        "models": ollama["models"],
    }


@router.post("/chat")
async def chat(request: ChatRequest) -> dict:
    """Free-form chat with the LLM.

    Routes through TurboQuant when available (auto mode), otherwise Ollama.
    """
    available = await llm_backend.check_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="No LLM backend available. Start Ollama or TurboQuant service.",
        )

    system_prompt = request.system or (
        "You are a helpful video production assistant. "
        "Help users brainstorm video ideas, write scripts, plan content, "
        "suggest thumbnails, and improve their video projects. "
        "Be creative, specific, and actionable. Keep responses concise."
    )

    try:
        response = await llm_backend.generate(
            prompt=request.message,
            model=request.model,
            system=system_prompt,
        )
        return {"response": response}
    except Exception:
        logger.exception("Chat generation failed")
        raise HTTPException(status_code=500, detail="Failed to generate response.")


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """Streaming chat — sends tokens as newline-delimited JSON.

    Each line is a JSON object: {"token": "..."} or {"done": true}.
    This prevents timeouts on slow hardware by sending data as it's generated.
    """
    available = await llm_backend.check_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="No LLM backend available. Start Ollama or TurboQuant service.",
        )

    system_prompt = request.system or (
        "You are a helpful video production assistant. "
        "Help users brainstorm video ideas, write scripts, plan content, "
        "suggest thumbnails, and improve their video projects. "
        "Be creative, specific, and actionable. Keep responses concise."
    )

    async def _stream():
        try:
            async for token in llm_backend.generate_stream(
                prompt=request.message,
                model=request.model,
                system=system_prompt,
            ):
                yield json.dumps({"token": token}) + "\n"
            yield json.dumps({"done": True}) + "\n"
        except Exception:
            logger.exception("Streaming chat generation failed")
            yield json.dumps({"error": "Failed to generate response."}) + "\n"

    return StreamingResponse(
        _stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/set-model")
async def set_model(request: SetModelRequest) -> dict:
    """Switch the active Ollama model at runtime.

    The model must already be pulled. All subsequent LLM requests
    (chat, commands, analysis) will use this model.
    """
    available = await ollama_service.check_available()
    if not available:
        raise HTTPException(status_code=503, detail="Ollama is not available.")

    # Verify the model exists
    models = await ollama_service.list_models()
    model_names = [m.get("name", "") for m in models]

    # Ollama model names can be "llama3.2:1b" or "llama3.2:latest"
    # Allow partial matches (e.g. "llama3.2:1b" matches "llama3.2:1b")
    found = request.model in model_names or any(
        request.model in name or name.startswith(request.model)
        for name in model_names
    )

    if not found:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{request.model}' not found. "
            f"Pull it first with POST /api/llm/pull-model. "
            f"Available: {model_names}",
        )

    old_model = ollama_service.default_model
    ollama_service.default_model = request.model
    logger.info("Switched default model: %s -> %s", old_model, request.model)

    return {
        "status": "switched",
        "previous_model": old_model,
        "current_model": request.model,
    }


@router.post("/pull-model")
async def pull_model(request: PullModelRequest) -> dict:
    """Pull/download a model from the Ollama registry."""
    available = await ollama_service.check_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="Ollama server is not available. Please start Ollama first.",
        )

    try:
        result = await ollama_service.pull_model(request.model)
        return {"status": "success", "model": request.model, "details": result}
    except Exception as e:
        logger.exception("Failed to pull model '%s'", request.model)
        raise HTTPException(status_code=500, detail=str(e))
