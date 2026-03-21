"""Whisper-based transcription service with lazy model loading."""

import logging
from pathlib import Path

from app.config import settings
from app.models.transcription import (
    TranscriptionResult,
    TranscriptionSegment,
    TranscriptionWord,
)

logger = logging.getLogger(__name__)


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

    def load_model(self, model_size: str | None = None) -> None:
        """Load the whisper model. Lazy-loads on first transcription call."""
        target_size = model_size or settings.WHISPER_MODEL_SIZE
        if self._model is not None and self._model_size == target_size:
            logger.info("Whisper model '%s' already loaded.", target_size)
            return

        self.unload_model()

        try:
            from faster_whisper import WhisperModel

            logger.info(
                "Loading whisper model '%s' (device=%s, compute=%s)...",
                target_size,
                settings.WHISPER_DEVICE,
                settings.WHISPER_COMPUTE_TYPE,
            )
            self._model = WhisperModel(
                target_size,
                device=settings.WHISPER_DEVICE
                if settings.WHISPER_DEVICE != "auto"
                else "cpu",
                compute_type=settings.WHISPER_COMPUTE_TYPE,
            )
            self._model_size = target_size
            logger.info("Whisper model '%s' loaded successfully.", target_size)
        except Exception:
            logger.exception("Failed to load whisper model '%s'", target_size)
            raise

    def unload_model(self) -> None:
        """Free the whisper model from memory."""
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
        """Transcribe an audio file and return structured results.

        Args:
            audio_path: Path to the audio file (WAV preferred).
            language: Optional ISO 639-1 language code. Auto-detected if None.

        Returns:
            TranscriptionResult with segments and word-level timestamps.
        """
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
            len(segments),
            info.duration,
            info.language,
        )
        return result


# Module-level singleton
whisper_service = WhisperService()
