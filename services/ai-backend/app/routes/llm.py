"""LLM status and model management routes."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/llm", tags=["llm"])


class PullModelRequest(BaseModel):
    model: str


class ChatRequest(BaseModel):
    message: str
    system: str | None = None
    model: str | None = None


class LLMStatusResponse(BaseModel):
    available: bool
    url: str
    models: list[dict] = []


@router.get("/status", response_model=LLMStatusResponse)
async def llm_status() -> LLMStatusResponse:
    """Check Ollama availability and list downloaded models."""
    available = await ollama_service.check_available()
    models = []
    if available:
        models = await ollama_service.list_models()

    return LLMStatusResponse(
        available=available,
        url=ollama_service.base_url,
        models=models,
    )


@router.post("/chat")
async def chat(request: ChatRequest) -> dict:
    """Free-form chat with the LLM.

    Used for brainstorming, scripting, idea generation — any open-ended
    conversation that doesn't need structured editor actions.
    """
    available = await ollama_service.check_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not available. Start Ollama and pull a model first.",
        )

    system_prompt = request.system or (
        "You are a helpful video production assistant. "
        "Help users brainstorm video ideas, write scripts, plan content, "
        "suggest thumbnails, and improve their video projects. "
        "Be creative, specific, and actionable. Keep responses concise."
    )

    try:
        response = await ollama_service.generate(
            prompt=request.message,
            model=request.model,
            system=system_prompt,
        )
        return {"response": response}
    except Exception:
        logger.exception("Chat generation failed")
        raise HTTPException(status_code=500, detail="Failed to generate response.")


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
