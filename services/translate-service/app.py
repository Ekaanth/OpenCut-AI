"""Translation microservice.

Standalone FastAPI service for privacy-first, fully-local machine
translation using Meta's NLLB-200 (No Language Left Behind) models.

Runs entirely on-device — no text ever leaves the host. This is the
translation half of the AI Dubbing pipeline (transcribe → translate → TTS).

Runs on port 8427.
"""

import logging
import os
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration via environment variables
# ---------------------------------------------------------------------------
# NLLB model choices (HuggingFace hub IDs):
#   - distilled-600M  → ~1.5GB, good speed/quality balance (default)
#   - distilled-1.3B  → ~3.5GB, higher quality, needs more RAM / GPU
NLLB_MODEL = os.getenv("NLLB_MODEL", "facebook/nllb-200-distilled-600M")
DEVICE = os.getenv("DEVICE", "auto")  # auto | cpu | cuda | mps

AVAILABLE_MODELS = [
    {
        "name": "facebook/nllb-200-distilled-600M",
        "description": "Fast — good quality. ~1.5GB. Best default for CPU.",
        "size": "~1.5 GB",
        "size_mb": 1500,
        "languages": 200,
        "relative_speed": 3,
        "device": "cpu",
    },
    {
        "name": "facebook/nllb-200-distilled-1.3B",
        "description": "Higher quality, slower. ~3.5GB. Needs 8GB+ RAM or GPU.",
        "size": "~3.5 GB",
        "size_mb": 3500,
        "languages": 200,
        "relative_speed": 1,
        "device": "gpu",
    },
]

_MODEL_MAP = {m["name"]: m for m in AVAILABLE_MODELS}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Text to translate")
    source_lang: str = Field(..., description="Source NLLB language code, e.g. eng_Latn")
    target_lang: str = Field(..., description="Target NLLB language code, e.g. spa_Latn")


class TranslateResponse(BaseModel):
    translated_text: str
    source_lang: str
    target_lang: str
    model: str


class TranslateBatchRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=200, description="Texts to translate")
    source_lang: str
    target_lang: str


class TranslateBatchResponse(BaseModel):
    translations: list[str]
    source_lang: str
    target_lang: str
    model: str


class LoadModelRequest(BaseModel):
    model_name: str | None = None


# ---------------------------------------------------------------------------
# Translate service singleton
# ---------------------------------------------------------------------------


class TranslateService:
    """Singleton wrapping a HuggingFace NLLB-200 model for translation."""

    _instance: "TranslateService | None" = None
    _model = None
    _tokenizer = None
    _model_name: str = ""

    def __new__(cls) -> "TranslateService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def device(self) -> str:
        return self._resolve_device()

    def _resolve_device(self) -> str:
        if DEVICE != "auto":
            return DEVICE
        try:
            import torch

            if torch.cuda.is_available():
                return "cuda"
            if torch.backends.mps.is_available():
                return "mps"
        except Exception:
            pass
        return "cpu"

    def load_model(self, model_name: str | None = None) -> None:
        target = model_name or NLLB_MODEL
        if self._model is not None and self._model_name == target:
            logger.info("NLLB model '%s' already loaded.", target)
            return

        self.unload_model()

        try:
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

            import torch

            device = self._resolve_device()
            dtype = torch.float16 if device == "cuda" else torch.float32
            logger.info(
                "Loading NLLB model '%s' (device=%s, dtype=%s)...", target, device, dtype
            )
            self._tokenizer = AutoTokenizer.from_pretrained(target)
            self._model = AutoModelForSeq2SeqLM.from_pretrained(target, torch_dtype=dtype).to(
                device
            )
            self._model_name = target
            logger.info("NLLB model '%s' loaded on %s.", target, device)
        except Exception:
            logger.exception("Failed to load NLLB model '%s'", target)
            raise

    def unload_model(self) -> None:
        if self._model is not None:
            logger.info("Unloading NLLB model '%s'...", self._model_name)
            del self._model
            self._model = None
        if self._tokenizer is not None:
            del self._tokenizer
            self._tokenizer = None
        self._model_name = ""

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        if not text.strip():
            return ""
        if self._model is None or self._tokenizer is None:
            self.load_model()

        import torch

        device = self._resolve_device()
        tokenizer = self._tokenizer
        # forced_bos_token_id pins the output language. src_lang sets the encoder side.
        tokenizer.src_lang = source_lang
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(device)

        target_id = tokenizer.convert_tokens_to_ids(target_lang)
        if not isinstance(target_id, int) or target_id == tokenizer.unk_token_id:
            # convert_tokens_to_ids returns the UNK id when the lang tag is unknown.
            raise ValueError(f"Unknown target language code: {target_lang}")

        with torch.no_grad():
            generated = self._model.generate(
                **inputs,
                forced_bos_token_id=target_id,
                max_new_tokens=512,
                num_beams=4,
            )

        # Skip the forced BOS token in decode
        return tokenizer.batch_decode(generated, skip_special_tokens=True)[0].strip()

    def translate_batch(
        self, texts: list[str], source_lang: str, target_lang: str
    ) -> list[str]:
        if not texts:
            return []
        if self._model is None or self._tokenizer is None:
            self.load_model()

        import torch

        device = self._resolve_device()
        tokenizer = self._tokenizer
        tokenizer.src_lang = source_lang
        target_id = tokenizer.convert_tokens_to_ids(target_lang)
        if not isinstance(target_id, int) or target_id == tokenizer.unk_token_id:
            raise ValueError(f"Unknown target language code: {target_lang}")

        results: list[str] = []
        # Batch in chunks of 16 to bound memory on CPU
        BATCH = 16
        for i in range(0, len(texts), BATCH):
            chunk = [t for t in texts[i : i + BATCH] if t and t.strip()]
            if not chunk:
                # preserve slot count even if the chunk was all empty
                results.extend([""] * len(texts[i : i + BATCH]))
                continue
            inputs = tokenizer(
                chunk, return_tensors="pt", truncation=True, max_length=512, padding=True
            ).to(device)
            with torch.no_grad():
                generated = self._model.generate(
                    **inputs,
                    forced_bos_token_id=target_id,
                    max_new_tokens=512,
                    num_beams=4,
                )
            decoded = tokenizer.batch_decode(generated, skip_special_tokens=True)
            results.extend(d.strip() for d in decoded)
        return results


translate_service = TranslateService()

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="OpenCut AI Translate Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3100",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health")
async def health():
    """Return service health and model status."""
    return {
        "status": "ok",
        "service": "translate",
        "model": {
            "loaded": translate_service.is_loaded,
            "model_name": translate_service.model_name or NLLB_MODEL,
            "device": translate_service.device,
        },
        "supports": "NLLB-200 (200 languages)",
    }


@app.get("/models")
async def list_models():
    """List available NLLB model variants."""
    active = translate_service.model_name if translate_service.is_loaded else None
    models = [{**m, "active": m["name"] == active} for m in AVAILABLE_MODELS]
    return {"models": models, "active_model": active, "device": translate_service.device}


@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    """Translate a single text between two NLLB-200 language codes."""
    try:
        result = translate_service.translate(req.text, req.source_lang, req.target_lang)
        return TranslateResponse(
            translated_text=result,
            source_lang=req.source_lang,
            target_lang=req.target_lang,
            model=translate_service.model_name or NLLB_MODEL,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Translation failed")
        raise HTTPException(status_code=500, detail="Translation failed.")


@app.post("/translate-batch", response_model=TranslateBatchResponse)
async def translate_batch(req: TranslateBatchRequest):
    """Translate a batch of texts in one request."""
    try:
        results = translate_service.translate_batch(
            req.texts, req.source_lang, req.target_lang
        )
        return TranslateBatchResponse(
            translations=results,
            source_lang=req.source_lang,
            target_lang=req.target_lang,
            model=translate_service.model_name or NLLB_MODEL,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Batch translation failed")
        raise HTTPException(status_code=500, detail="Batch translation failed.")


@app.post("/load")
async def load_model(req: LoadModelRequest | None = None):
    """Load (or switch to) an NLLB model. Downloads on first use."""
    try:
        name = req.model_name if req and req.model_name else None
        translate_service.load_model(name)
        return {
            "status": "success",
            "model_name": translate_service.model_name,
            "device": translate_service.device,
            "message": f"NLLB model '{translate_service.model_name}' loaded.",
        }
    except Exception as e:
        logger.exception("Failed to load NLLB model")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/unload")
async def unload_model():
    """Unload the model and free memory."""
    translate_service.unload_model()
    return {"status": "success", "message": "NLLB model unloaded."}
