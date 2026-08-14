"""Local NLLB-200 translation proxy routes.

Thin proxy over the translate-service microservice (services/translate-service,
port 8427) running Meta's NLLB-200. This is the privacy-first translation path
for AI dubbing — no text ever leaves the host, no API key required.

Maps the ISO 639-1 codes the frontend uses (e.g. "en", "es", "hi") to NLLB's
FLORES-200 codes (e.g. "eng_Latn", "spa_Latn", "hin_Deva") so callers don't
have to know the FLORES convention.
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/translate", tags=["translate"])

_FORWARD_TIMEOUT = 300.0

# ISO 639-1 → NLLB FLORES-200 code. Keep in sync with the frontend dubbing
# language list. Only languages we actually offer for dubbing are mapped; the
# translate-service itself supports all 200 NLLB languages via raw FLORES codes.
ISO_TO_FLORES = {
    "en": "eng_Latn",
    "es": "spa_Latn",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "it": "ita_Latn",
    "pt": "por_Latn",
    "pl": "pol_Latn",
    "tr": "tur_Latn",
    "ru": "rus_Cyrl",
    "nl": "nld_Latn",
    "cs": "ces_Latn",
    "ar": "arb_Arab",
    "zh": "zho_Hans",
    "ja": "jpn_Jpan",
    "ko": "kor_Hang",
    "hi": "hin_Deva",
    "hu": "hun_Latn",
    "bn": "ben_Beng",
    "ta": "tam_Taml",
    "te": "tel_Telu",
    "mr": "mar_Deva",
    "gu": "guj_Gujr",
    "kn": "kan_Knda",
    "ml": "mal_Mlym",
    "pa": "pan_Guru",
    "od": "ory_Orya",
}


def _to_flores(iso: str) -> str:
    """Map an ISO 639-1 code (or already-FLORES code) to NLLB FLORES-200."""
    if not iso:
        return ""
    # Already a FLORES code? (contains underscore)
    if "_" in iso:
        return iso
    mapped = ISO_TO_FLORES.get(iso)
    if not mapped:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language code '{iso}'. Provide an ISO 639-1 code "
            f"(e.g. 'en', 'es', 'hi') or a FLORES-200 code (e.g. 'eng_Latn').",
        )
    return mapped


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    source_lang: str = Field(default="", description="ISO 639-1 or empty for auto-detect")
    target_lang: str = Field(..., description="ISO 639-1 or FLORES-200 code")


class TranslateBatchRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=200)
    source_lang: str = Field(default="")
    target_lang: str = Field(...)


def _service_down(url: str) -> HTTPException:
    logger.error("NLLB translate service unavailable at %s", url)
    return HTTPException(
        status_code=503,
        detail="NLLB translate service is not available. Start it with: docker compose up -d translate-service",
    )


@router.get("/health")
async def translate_service_health() -> dict:
    """Health check for the downstream NLLB translate service."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.TRANSLATE_SERVICE_URL}/health")
            resp.raise_for_status()
            return {"upstream": resp.json(), "reachable": True}
    except Exception as e:
        return {
            "reachable": False,
            "url": settings.TRANSLATE_SERVICE_URL,
            "error": str(e),
        }


@router.post("/translate")
async def translate(req: TranslateRequest) -> dict:
    """Translate a single text via the local NLLB-200 service."""
    source_flores = _to_flores(req.source_lang) if req.source_lang else "eng_Latn"
    target_flores = _to_flores(req.target_lang)
    try:
        async with httpx.AsyncClient(timeout=_FORWARD_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.TRANSLATE_SERVICE_URL}/translate",
                json={
                    "text": req.text,
                    "source_lang": source_flores,
                    "target_lang": target_flores,
                },
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise _service_down(settings.TRANSLATE_SERVICE_URL)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Translate service error: {e.response.text}",
        )


@router.post("/translate-batch")
async def translate_batch(req: TranslateBatchRequest) -> dict:
    """Batch-translate texts via the local NLLB-200 service."""
    source_flores = _to_flores(req.source_lang) if req.source_lang else "eng_Latn"
    target_flores = _to_flores(req.target_lang)
    try:
        async with httpx.AsyncClient(timeout=_FORWARD_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.TRANSLATE_SERVICE_URL}/translate-batch",
                json={
                    "texts": req.texts,
                    "source_lang": source_flores,
                    "target_lang": target_flores,
                },
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise _service_down(settings.TRANSLATE_SERVICE_URL)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Translate service error: {e.response.text}",
        )
