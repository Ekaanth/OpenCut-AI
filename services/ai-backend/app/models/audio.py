"""Audio / TTS request models."""

from pydantic import BaseModel, ConfigDict, Field


class TTSRequest(BaseModel):
    """Text-to-speech generation request (proxied to tts-service)."""

    model_config = ConfigDict(populate_by_name=True)

    text: str
    language: str = "en"
    speaker_wav: str | None = Field(default=None, alias="speakerWav")
    speaker: str | None = None
    speed: float = 1.0
