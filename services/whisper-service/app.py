"""Whisper transcription microservice.

Standalone FastAPI service for speech-to-text transcription using faster-whisper.
Supports multiple model sizes with download and switching.
Runs on port 8421.
"""

import logging
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration via environment variables
# ---------------------------------------------------------------------------
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Available Whisper models
# ---------------------------------------------------------------------------

AVAILABLE_WHISPER_MODELS = [
    {
        "name": "tiny",
        "description": "Fastest — minimal accuracy",
        "size": "~75 MB",
        "size_mb": 75,
        "languages": 99,
        "relative_speed": 32,
        "device": "cpu",
    },
    {
        "name": "base",
        "description": "Good balance of speed and accuracy",
        "size": "~140 MB",
        "size_mb": 140,
        "languages": 99,
        "relative_speed": 16,
        "device": "cpu",
    },
    {
        "name": "small",
        "description": "Better accuracy, moderate speed",
        "size": "~460 MB",
        "size_mb": 460,
        "languages": 99,
        "relative_speed": 6,
        "device": "cpu",
    },
    {
        "name": "medium",
        "description": "High accuracy, slower",
        "size": "~1.5 GB",
        "size_mb": 1500,
        "languages": 99,
        "relative_speed": 2,
        "device": "cpu",
    },
    {
        "name": "large-v3",
        "description": "Best accuracy — needs 4+ GB",
        "size": "~3 GB",
        "size_mb": 3000,
        "languages": 99,
        "relative_speed": 1,
        "device": "gpu",
    },
]

_MODEL_MAP = {m["name"]: m for m in AVAILABLE_WHISPER_MODELS}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class TranscriptionWord(BaseModel):
    word: str
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    probability: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score")


class TranscriptionSegment(BaseModel):
    id: int
    text: str
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    words: list[TranscriptionWord] = Field(default_factory=list)
    avg_logprob: float = 0.0
    no_speech_prob: float = 0.0


class TranscriptionResult(BaseModel):
    text: str = Field(..., description="Full transcribed text")
    segments: list[TranscriptionSegment] = Field(default_factory=list)
    language: str = Field(default="en", description="Detected or specified language")
    duration: float = Field(default=0.0, description="Audio duration in seconds")


# ---------------------------------------------------------------------------
# Whisper service singleton
# ---------------------------------------------------------------------------

class WhisperService:
    """Singleton service wrapping faster-whisper for speech-to-text."""

    _instance: "WhisperService | None" = None
    _model = None
    _model_size: str = ""

    def __new__(cls) -> "WhisperService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def model_size(self) -> str:
        return self._model_size

    def load_model(self, model_size: str | None = None) -> None:
        target_size = model_size or WHISPER_MODEL_SIZE
        if self._model is not None and self._model_size == target_size:
            logger.info("Whisper model '%s' already loaded.", target_size)
            return

        self.unload_model()

        try:
            from faster_whisper import WhisperModel

            device = WHISPER_DEVICE if WHISPER_DEVICE != "auto" else "cpu"
            logger.info(
                "Loading whisper model '%s' (device=%s, compute=%s)...",
                target_size, device, WHISPER_COMPUTE_TYPE,
            )
            self._model = WhisperModel(
                target_size,
                device=device,
                compute_type=WHISPER_COMPUTE_TYPE,
            )
            self._model_size = target_size
            logger.info("Whisper model '%s' loaded successfully.", target_size)
        except Exception:
            logger.exception("Failed to load whisper model '%s'", target_size)
            raise

    def unload_model(self) -> None:
        if self._model is not None:
            logger.info("Unloading whisper model '%s'...", self._model_size)
            del self._model
            self._model = None
            self._model_size = ""

    def transcribe(
        self,
        audio_path: str,
        language: str | None = None,
    ) -> TranscriptionResult:
        if not Path(audio_path).exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Lazy load
        if self._model is None:
            self.load_model()

        logger.info("Transcribing '%s' (language=%s)...", audio_path, language or "auto")

        segments_iter, info = self._model.transcribe(
            audio_path,
            language=language,
            beam_size=5,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 200,
            },
        )

        segments: list[TranscriptionSegment] = []
        full_text_parts: list[str] = []

        for idx, seg in enumerate(segments_iter):
            words = []
            if seg.words:
                for w in seg.words:
                    words.append(
                        TranscriptionWord(
                            word=w.word.strip(),
                            start=round(w.start, 3),
                            end=round(w.end, 3),
                            probability=round(w.probability, 4),
                        )
                    )

            segment = TranscriptionSegment(
                id=idx,
                text=seg.text.strip(),
                start=round(seg.start, 3),
                end=round(seg.end, 3),
                words=words,
                avg_logprob=round(seg.avg_logprob, 4),
                no_speech_prob=round(seg.no_speech_prob, 4),
            )
            segments.append(segment)
            full_text_parts.append(seg.text.strip())

        result = TranscriptionResult(
            text=" ".join(full_text_parts),
            segments=segments,
            language=info.language,
            duration=round(info.duration, 3),
        )

        logger.info(
            "Transcription complete: %d segments, %.1fs duration, language=%s",
            len(segments), info.duration, info.language,
        )
        return result


whisper_service = WhisperService()

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="OpenCutAI Whisper Service", version="1.0.0")

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

ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".wma"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"}
ALLOWED_EXTENSIONS = ALLOWED_AUDIO_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS


@app.get("/health")
async def health():
    """Return service health and model status."""
    return {
        "status": "ok",
        "service": "whisper",
        "model": {
            "loaded": whisper_service.is_loaded,
            "model_size": whisper_service.model_size or WHISPER_MODEL_SIZE,
            "device": WHISPER_DEVICE,
            "compute_type": WHISPER_COMPUTE_TYPE,
        },
    }


@app.get("/models")
async def list_models():
    """List available Whisper model sizes with metadata."""
    active = whisper_service.model_size if whisper_service.is_loaded else None
    models = []
    for m in AVAILABLE_WHISPER_MODELS:
        models.append({
            **m,
            "active": m["name"] == active,
        })
    return {"models": models, "active_model": active, "device": WHISPER_DEVICE}


@app.post("/test")
async def test_model():
    """Quick test: verify the whisper model is loaded and responsive."""
    if not whisper_service.is_loaded:
        raise HTTPException(status_code=400, detail="No model loaded. Load a model first.")

    import struct
    import asyncio

    test_path = os.path.join(UPLOAD_DIR, "_whisper_test.wav")
    try:
        # Generate a tiny 0.5s silent WAV for a quick transcription test
        sample_rate = 16000
        num_samples = sample_rate // 2
        with open(test_path, "wb") as f:
            data_size = num_samples * 2
            f.write(b"RIFF")
            f.write(struct.pack("<I", 36 + data_size))
            f.write(b"WAVE")
            f.write(b"fmt ")
            f.write(struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
            f.write(b"data")
            f.write(struct.pack("<I", data_size))
            f.write(b"\x00" * data_size)

        # Run transcription in a thread so we don't block
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, whisper_service.transcribe, test_path, None)

        return {
            "status": "ok",
            "model_size": whisper_service.model_size,
            "device": WHISPER_DEVICE,
            "message": f"Model '{whisper_service.model_size}' is working correctly.",
        }
    except Exception as e:
        logger.exception("Whisper test failed")
        raise HTTPException(status_code=500, detail=f"Test failed: {e}")
    finally:
        if os.path.exists(test_path):
            os.remove(test_path)


@app.post("/transcribe", response_model=TranscriptionResult)
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
) -> TranscriptionResult:
    """Transcribe an uploaded audio or video file.

    Accepts multipart file upload. Returns structured JSON with segments
    and word-level timestamps.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    upload_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join(UPLOAD_DIR, f"upload_{upload_id}{ext}")

    try:
        contents = await file.read()
        with open(upload_path, "wb") as f:
            f.write(contents)

        # For video files, extract audio via ffmpeg
        audio_path = upload_path
        if ext in ALLOWED_VIDEO_EXTENSIONS:
            import subprocess

            audio_path = os.path.join(UPLOAD_DIR, f"audio_{upload_id}.wav")
            logger.info("Extracting audio from video file '%s'", file.filename)
            subprocess.run(
                [
                    "ffmpeg", "-i", upload_path,
                    "-vn", "-acodec", "pcm_s16le",
                    "-ar", "16000", "-ac", "1",
                    audio_path, "-y",
                ],
                check=True,
                capture_output=True,
            )

        result = whisper_service.transcribe(audio_path, language=language)
        return result

    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        logger.exception("Transcription failed for '%s'", file.filename)
        raise HTTPException(status_code=500, detail="Transcription failed.")
    finally:
        if os.path.exists(upload_path):
            os.remove(upload_path)
        # Clean up extracted audio if different from upload
        if ext in ALLOWED_VIDEO_EXTENSIONS:
            audio_cleanup = os.path.join(UPLOAD_DIR, f"audio_{upload_id}.wav")
            if os.path.exists(audio_cleanup):
                os.remove(audio_cleanup)


@app.post("/load")
async def load_model(model_size: str | None = None):
    """Load a whisper model by size. Downloads on first use."""
    try:
        whisper_service.load_model(model_size)
        return {
            "status": "success",
            "model_size": whisper_service.model_size,
            "message": f"Whisper model '{whisper_service.model_size}' loaded.",
        }
    except Exception as e:
        logger.exception("Failed to load whisper model")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/unload")
async def unload_model():
    """Unload the whisper model and free memory."""
    whisper_service.unload_model()
    return {"status": "success", "message": "Whisper model unloaded."}
