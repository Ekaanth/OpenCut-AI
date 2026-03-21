"""Whisper transcription microservice.

Standalone FastAPI service for speech-to-text transcription using faster-whisper.
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
    """Pre-load the whisper model."""
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
