"""Text-to-speech routes.

Proxies requests to the tts-service microservice.
Checks model readiness before proxying to avoid crashes.
"""

import logging

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.config import settings
from app.models.audio import TTSRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["tts"])

HEALTH_TIMEOUT = 5


async def _check_tts_ready() -> None:
    """Check if the TTS service is reachable and its model is loaded.

    Raises HTTPException with an actionable message when it isn't.
    """
    try:
        async with httpx.AsyncClient(timeout=HEALTH_TIMEOUT) as client:
            resp = await client.get(f"{settings.TTS_SERVICE_URL}/health")
            resp.raise_for_status()
            data = resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="TTS service is not running. Start it with: docker compose up -d tts-service",
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Cannot reach TTS service. Make sure it is running.",
        )

    model_info = data.get("model", {})

    if not model_info.get("installed", False):
        raise HTTPException(
            status_code=503,
            detail="TTS library (coqui-tts) is not installed in the TTS service container. "
            "Rebuild with: docker compose build tts-service && docker compose up -d tts-service",
        )

    if not model_info.get("loaded", False):
        raise HTTPException(
            status_code=503,
            detail="TTS model is not loaded. Go to Settings > AI Models and click "
            '"Load Model" next to the TTS service, then try again.',
        )


@router.post("/generate")
async def generate_speech(request: TTSRequest):
    """Generate speech audio from text.

    Checks model readiness first, then proxies to the tts-service.
    """
    await _check_tts_ready()

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{settings.TTS_SERVICE_URL}/generate",
                json=request.model_dump(),
            )
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            if "audio" in content_type:
                return Response(
                    content=resp.content,
                    media_type=content_type,
                    headers={"Content-Disposition": 'attachment; filename="tts_output.wav"'},
                )
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        try:
            detail = e.response.json().get("detail", e.response.text)
        except Exception:
            detail = e.response.text
        raise HTTPException(status_code=e.response.status_code, detail=detail)
    except (httpx.RemoteProtocolError, httpx.ReadError):
        logger.error("TTS service disconnected during generation — likely OOM")
        raise HTTPException(
            status_code=503,
            detail="TTS service crashed during generation (likely out of memory). "
            "The XTTS v2 model requires ~4 GB RAM. "
            "Restart with: docker compose restart tts-service",
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="TTS service is not available. Ensure tts-service is running.",
        )
    except Exception:
        logger.exception("TTS proxy failed")
        raise HTTPException(status_code=500, detail="TTS generation failed.")


@router.post("/clone-voice")
async def clone_voice(
    name: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    """Upload a reference audio file for voice cloning."""
    await _check_tts_ready()

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            files = {"file": (file.filename, await file.read(), file.content_type)}
            data = {"name": name}
            resp = await client.post(
                f"{settings.TTS_SERVICE_URL}/clone-voice",
                files=files,
                data=data,
            )
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        try:
            detail = e.response.json().get("detail", e.response.text)
        except Exception:
            detail = e.response.text
        raise HTTPException(status_code=e.response.status_code, detail=detail)
    except (httpx.RemoteProtocolError, httpx.ReadError):
        logger.error("TTS service disconnected during voice clone")
        raise HTTPException(
            status_code=503,
            detail="TTS service crashed. Try restarting: docker compose restart tts-service",
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="TTS service is not available. Ensure tts-service is running.",
        )
    except Exception:
        logger.exception("Voice clone proxy failed")
        raise HTTPException(status_code=500, detail="Failed to save voice reference.")
