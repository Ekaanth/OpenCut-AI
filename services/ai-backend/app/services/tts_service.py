"""Text-to-speech service with Coqui TTS (XTTS v2).

Requires: pip install TTS
The model downloads automatically on first load (~1.8 GB).
"""

import logging
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    """Text-to-speech generation service with optional voice cloning."""

    _instance: "TTSService | None" = None
    _model = None
    _is_installed: bool | None = None

    def __new__(cls) -> "TTSService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def is_installed(self) -> bool:
        """Check if the TTS library is available."""
        if self._is_installed is None:
            try:
                import TTS  # noqa: F401
                self._is_installed = True
            except ImportError:
                self._is_installed = False
        return self._is_installed

    def load_model(self) -> dict:
        """Load the TTS model.

        Returns a status dict with success/error information.
        """
        if self._model is not None:
            logger.info("TTS model already loaded.")
            return {"status": "already_loaded", "model": "xtts_v2"}

        if not self.is_installed:
            msg = (
                "Coqui TTS is not installed. "
                "Install it with: pip install TTS"
            )
            logger.warning(msg)
            return {
                "status": "not_installed",
                "error": msg,
                "install_command": "pip install TTS",
            }

        try:
            from TTS.api import TTS as CoquiTTS

            logger.info("Loading TTS model (xtts_v2)... This may take a while on first run.")
            self._model = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2")

            # Move to GPU if available
            try:
                import torch
                if torch.cuda.is_available():
                    self._model = self._model.to("cuda")
                    logger.info("TTS model loaded on GPU.")
                else:
                    logger.info("TTS model loaded on CPU.")
            except ImportError:
                logger.info("TTS model loaded on CPU (torch not available for GPU check).")

            return {"status": "loaded", "model": "xtts_v2"}
        except Exception as e:
            logger.exception("Failed to load TTS model")
            return {"status": "error", "error": str(e)}

    def unload_model(self) -> None:
        """Free the TTS model from memory."""
        if self._model is not None:
            del self._model
            self._model = None
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except ImportError:
                pass
            logger.info("TTS model unloaded.")

    def get_status(self) -> dict:
        """Return current status for health checks."""
        return {
            "installed": self.is_installed,
            "loaded": self.is_loaded,
            "model_name": "xtts_v2" if self.is_loaded else None,
            "install_command": "pip install TTS" if not self.is_installed else None,
        }

    async def generate_speech(
        self,
        text: str,
        language: str = "en",
        speaker_wav: str | None = None,
    ) -> str:
        """Generate speech audio from text.

        Args:
            text: The text to synthesize.
            language: Language code for synthesis.
            speaker_wav: Optional path to a reference WAV for voice cloning.

        Returns:
            Path to the generated WAV file.
        """
        if not self.is_loaded:
            result = self.load_model()
            if result["status"] not in ("loaded", "already_loaded"):
                raise RuntimeError(f"Cannot generate speech: {result.get('error', 'model not loaded')}")

        output_path = Path(settings.GENERATED_DIR) / f"tts_{uuid.uuid4().hex[:8]}.wav"

        self._model.tts_to_file(
            text=text,
            language=language,
            speaker_wav=speaker_wav,
            file_path=str(output_path),
        )

        return str(output_path)


# Module-level singleton
tts_service = TTSService()
