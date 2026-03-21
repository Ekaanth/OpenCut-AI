"""Setup, system management, and service status routes."""

import asyncio
import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.services.model_manager import model_manager
from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["setup"])


# ---------------------------------------------------------------------------
# Service health checking
# ---------------------------------------------------------------------------

async def _check_service(name: str, url: str) -> dict:
    """Check the health of a downstream microservice."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{url}/health")
            resp.raise_for_status()
            data = resp.json()
            return {"name": name, "url": url, "status": "online", "details": data}
    except httpx.ConnectError:
        return {"name": name, "url": url, "status": "offline", "details": None}
    except Exception as e:
        return {"name": name, "url": url, "status": "error", "details": str(e)}


async def _check_ollama(url: str) -> dict:
    """Check Ollama availability."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{url}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            models = [m.get("name") for m in data.get("models", [])]
            return {
                "name": "ollama",
                "url": url,
                "status": "online",
                "details": {"models": models},
            }
    except httpx.ConnectError:
        return {"name": "ollama", "url": url, "status": "offline", "details": None}
    except Exception as e:
        return {"name": "ollama", "url": url, "status": "error", "details": str(e)}


@router.get("/api/services/status")
async def services_status():
    """Check the health of all microservices and return their status."""
    results = await asyncio.gather(
        _check_service("whisper", settings.WHISPER_SERVICE_URL),
        _check_service("tts", settings.TTS_SERVICE_URL),
        _check_service("image", settings.IMAGE_SERVICE_URL),
        _check_ollama(settings.OLLAMA_URL),
        return_exceptions=True,
    )

    services = {}
    for r in results:
        if isinstance(r, Exception):
            services["unknown"] = {"status": "error", "details": str(r)}
        else:
            services[r["name"]] = r

    return {
        "services": services,
        "backend": {
            "status": "online",
            "port": settings.PORT,
        },
    }


# ---------------------------------------------------------------------------
# Model download / preparation
# ---------------------------------------------------------------------------

class DownloadModelRequest(BaseModel):
    """Request to download/prepare a model."""

    model_type: str = Field(
        ..., description="Type of model: whisper, llm, tts, diffusion"
    )
    model_name: str = Field(
        default="",
        description="Specific model name (e.g., 'base' for whisper, 'llama3.2' for LLM)",
    )


@router.post("/api/setup/download-model")
async def download_model(request: DownloadModelRequest) -> dict:
    """Download or prepare a model for use.

    For whisper: proxies to the whisper-service /load endpoint.
    For LLM: pulls the model via Ollama.
    For TTS: proxies to the tts-service /load endpoint.
    For diffusion: proxies to the image-service /load endpoint.
    """
    model_type = request.model_type.lower()

    if model_type == "whisper":
        model_size = request.model_name or "base"
        try:
            async with httpx.AsyncClient(timeout=300) as client:
                resp = await client.post(
                    f"{settings.WHISPER_SERVICE_URL}/load",
                    params={"model_size": model_size},
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail=f"Whisper service is not available at {settings.WHISPER_SERVICE_URL}",
            )
        except Exception as e:
            logger.exception("Failed to load whisper model via service")
            raise HTTPException(status_code=500, detail=str(e))

    elif model_type == "llm":
        model_name = request.model_name or "llama3.2"
        available = await ollama_service.check_available()
        if not available:
            raise HTTPException(
                status_code=503,
                detail="Ollama server is not available. Please start Ollama first.",
            )
        try:
            result = await ollama_service.pull_model(model_name)
            return {
                "status": "success",
                "model_type": "llm",
                "model_name": model_name,
                "details": result,
            }
        except Exception as e:
            logger.exception("Failed to pull LLM model")
            raise HTTPException(status_code=500, detail=str(e))

    elif model_type == "tts":
        try:
            async with httpx.AsyncClient(timeout=300) as client:
                resp = await client.post(f"{settings.TTS_SERVICE_URL}/load")
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail=f"TTS service is not available at {settings.TTS_SERVICE_URL}",
            )
        except Exception as e:
            logger.exception("Failed to load TTS model via service")
            raise HTTPException(status_code=500, detail=str(e))

    elif model_type == "diffusion":
        try:
            async with httpx.AsyncClient(timeout=300) as client:
                resp = await client.post(f"{settings.IMAGE_SERVICE_URL}/load")
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail=f"Image service is not available at {settings.IMAGE_SERVICE_URL}",
            )
        except Exception as e:
            logger.exception("Failed to load diffusion model via service")
            raise HTTPException(status_code=500, detail=str(e))

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model type: {model_type}. Use: whisper, llm, tts, diffusion",
        )


@router.post("/api/services/{service}/load")
async def load_service_model(service: str) -> dict:
    """Load/pre-load a model on a specific microservice.

    Proxies the /load call to the correct microservice.
    """
    service_urls = {
        "whisper": settings.WHISPER_SERVICE_URL,
        "tts": settings.TTS_SERVICE_URL,
        "image": settings.IMAGE_SERVICE_URL,
    }

    if service not in service_urls:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown service: {service}. Use: whisper, tts, image",
        )

    url = service_urls[service]
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(f"{url}/load")
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"{service} service is not available at {url}",
        )
    except Exception as e:
        logger.exception("Failed to load model on %s service", service)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/system/memory")
async def system_memory() -> dict:
    """Return current system and model memory usage."""
    try:
        return model_manager.get_memory_status()
    except ImportError:
        return {
            "error": "psutil is not installed. Install it for memory monitoring.",
            "active_model": model_manager.get_active(),
        }
    except Exception:
        logger.exception("Failed to get memory status")
        raise HTTPException(status_code=500, detail="Failed to get memory status.")
