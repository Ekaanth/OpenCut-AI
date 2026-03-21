"""TTS (Text-to-Speech) microservice.

Standalone FastAPI service for voice generation. Currently a stub that returns
clear 501 messages until coqui-tts is installed.
Runs on port 8422.
"""

import logging
import os
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration via environment variables
# ---------------------------------------------------------------------------
TTS_MODEL = os.getenv("TTS_MODEL", "xtts_v2")
GENERATED_DIR = os.getenv("GENERATED_DIR", "generated")
VOICES_DIR = os.path.join(GENERATED_DIR, "voices")

os.makedirs(GENERATED_DIR, exist_ok=True)
os.makedirs(VOICES_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class TTSGenerateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Text to speak")
    language: str = Field(default="en", description="Language code")
    speaker_wav: str | None = Field(
        default=None, description="Path to reference speaker WAV for voice cloning"
    )
    speaker: str | None = Field(
        default=None, description="Built-in speaker name (e.g., 'male', 'female')"
    )
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech speed")


# ---------------------------------------------------------------------------
# TTS service singleton (stub)
# ---------------------------------------------------------------------------

class TTSService:
    """Text-to-speech generation service (stub)."""

    _instance: "TTSService | None" = None
    _model = None
    _model_name: str = ""

    def __new__(cls) -> "TTSService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load_model(self) -> dict:
        """Load the TTS model. Returns status dict."""
        if self._model is not None:
            return {"status": "already_loaded", "model": self._model_name}

        try:
            from TTS.api import TTS as CoquiTTS
        except ImportError:
            msg = "coqui-tts is not installed. Install with: pip install coqui-tts"
            logger.warning(msg)
            return {"status": "not_installed", "error": msg, "install_command": "pip install coqui-tts"}

        try:
            logger.info("Loading TTS model '%s'... (first run downloads ~1.8 GB)", TTS_MODEL)
            model_name = f"tts_models/multilingual/multi-dataset/{TTS_MODEL}"
            self._model = CoquiTTS(model_name)
            self._model_name = TTS_MODEL

            try:
                import torch
                if torch.cuda.is_available():
                    self._model = self._model.to("cuda")
                    logger.info("TTS model loaded on GPU.")
                else:
                    logger.info("TTS model loaded on CPU.")
            except ImportError:
                logger.info("TTS model loaded on CPU.")

            return {"status": "loaded", "model": TTS_MODEL}
        except Exception as e:
            logger.exception("Failed to load TTS model")
            return {"status": "error", "error": str(e)}

    def unload_model(self) -> None:
        if self._model is not None:
            del self._model
            self._model = None
            self._model_name = ""
            logger.info("TTS model unloaded.")

    @property
    def is_installed(self) -> bool:
        try:
            import TTS  # noqa: F401
            return True
        except ImportError:
            return False

    def _ensure_speaker_ref(self, speaker: str = "default") -> str:
        """Create a speaker reference WAV with distinct pitch characteristics."""
        import struct
        import math

        safe_name = speaker.lower().replace(" ", "_")
        ref_path = os.path.join(VOICES_DIR, f"_ref_{safe_name}.wav")
        if os.path.exists(ref_path):
            return ref_path

        sample_rate = 22050
        duration_s = 2
        num_samples = sample_rate * duration_s

        # Different base frequencies create different voice characteristics
        # when XTTS uses these as speaker references
        freq_map = {
            "male": 120.0,     # Lower pitch
            "female": 220.0,   # Higher pitch
            "default": 160.0,  # Mid pitch
        }
        base_freq = freq_map.get(safe_name, 160.0)

        with open(ref_path, "wb") as f:
            data_size = num_samples * 2
            f.write(b"RIFF")
            f.write(struct.pack("<I", 36 + data_size))
            f.write(b"WAVE")
            f.write(b"fmt ")
            f.write(struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
            f.write(b"data")
            f.write(struct.pack("<I", data_size))
            for i in range(num_samples):
                t = i / sample_rate
                # Generate a subtle tone so XTTS has audio characteristics to work with
                sample = int(100 * math.sin(2 * math.pi * base_freq * t))
                f.write(struct.pack("<h", max(-32768, min(32767, sample))))

        logger.info("Created speaker reference '%s' at %s", speaker, ref_path)
        return ref_path

    def _generate_sync(
        self,
        text: str,
        language: str,
        speaker_wav: str,
        output_path: str,
    ) -> None:
        """Synchronous TTS generation — runs in a thread pool."""
        import gc

        try:
            self._model.tts_to_file(
                text=text,
                language=language,
                speaker_wav=speaker_wav,
                file_path=output_path,
            )
        except (MemoryError, RuntimeError) as exc:
            # Free memory and re-raise with a clear message
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except ImportError:
                pass
            raise MemoryError(
                "Out of memory during TTS generation. "
                "Try shorter text or allocate more RAM to Docker."
            ) from exc
        finally:
            gc.collect()

    async def generate_speech(
        self,
        text: str,
        language: str = "en",
        speaker_wav: str | None = None,
        speaker: str | None = None,
    ) -> str:
        if not self.is_loaded:
            result = self.load_model()
            if result["status"] not in ("loaded", "already_loaded"):
                raise NotImplementedError(result.get("error", "TTS model not available"))

        # XTTS v2 is multi-speaker and requires a speaker reference
        if not speaker_wav:
            speaker_wav = self._ensure_speaker_ref(speaker or "default")

        import uuid
        import asyncio
        output_path = os.path.join(GENERATED_DIR, f"tts_{uuid.uuid4().hex[:8]}.wav")

        # Run CPU-bound TTS in a thread so health checks remain responsive
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._generate_sync,
            text,
            language,
            speaker_wav,
            output_path,
        )
        return output_path


tts_service = TTSService()

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="OpenCutAI TTS Service", version="1.0.0")

AUTOLOAD = os.getenv("TTS_AUTOLOAD", "true").lower() in ("true", "1", "yes")


@app.on_event("startup")
async def _startup_load_model():
    """Auto-load TTS model on startup so it survives crash-restarts."""
    if not AUTOLOAD:
        return
    if not tts_service.is_installed:
        logger.warning("coqui-tts not installed — skipping autoload")
        return
    logger.info("Auto-loading TTS model on startup...")
    result = tts_service.load_model()
    logger.info("TTS autoload result: %s", result.get("status"))


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3100",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_LANGUAGES = [
    "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl",
    "cs", "ar", "zh-cn", "ja", "hu", "ko",
]


@app.get("/health")
async def health():
    """Return service health and model status."""
    installed = tts_service.is_installed

    return {
        "status": "ok",
        "service": "tts",
        "model": {
            "loaded": tts_service.is_loaded,
            "model_name": TTS_MODEL if tts_service.is_loaded else None,
            "installed": installed,
        },
        "install_command": "pip install coqui-tts" if not installed else None,
        "supported_languages": SUPPORTED_LANGUAGES,
    }


@app.post("/generate")
async def generate_speech(request: TTSGenerateRequest):
    """Generate speech audio from text.

    Returns the generated WAV file. Currently returns 501 until coqui-tts
    is installed.
    """
    try:
        output_path = await tts_service.generate_speech(
            text=request.text,
            language=request.language,
            speaker_wav=request.speaker_wav,
            speaker=request.speaker,
        )
        from fastapi.responses import FileResponse
        return FileResponse(
            path=output_path,
            media_type="audio/wav",
            filename="tts_output.wav",
        )
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except MemoryError as e:
        logger.error("OOM during TTS: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Out of memory during speech generation. "
            "Try shorter text or allocate more RAM to Docker.",
        )
    except Exception:
        logger.exception("TTS generation failed")
        raise HTTPException(status_code=500, detail="TTS generation failed.")


@app.post("/clone-voice")
async def clone_voice(
    name: str = Form(...),
    file: UploadFile = File(...),
):
    """Upload a reference audio file for voice cloning."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = Path(file.filename).suffix.lower()
    if ext not in {".wav", ".mp3", ".flac", ".ogg"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio format. Use WAV, MP3, FLAC, or OGG.",
        )

    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
    voice_path = os.path.join(VOICES_DIR, f"{safe_name}{ext}")

    try:
        contents = await file.read()
        with open(voice_path, "wb") as f:
            f.write(contents)

        return {
            "status": "success",
            "name": name,
            "path": voice_path,
            "message": "Voice reference saved. Use the path with /generate.",
        }
    except Exception:
        logger.exception("Voice cloning upload failed")
        raise HTTPException(status_code=500, detail="Failed to save voice reference.")


@app.post("/load")
async def load_model():
    """Pre-load the TTS model."""
    result = tts_service.load_model()

    if result["status"] == "not_installed":
        raise HTTPException(
            status_code=501,
            detail=result.get("error", "TTS library not installed"),
        )
    if result["status"] == "error":
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to load model"),
        )

    return result


@app.post("/unload")
async def unload_model():
    """Unload the TTS model and free memory."""
    tts_service.unload_model()
    return {"status": "success", "message": "TTS model unloaded."}
