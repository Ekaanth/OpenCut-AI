"""Application configuration using Pydantic BaseSettings."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration for the AI backend service."""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8420
    DEBUG: bool = False

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # Ollama
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_DEFAULT_MODEL: str = "llama3.2:1b"
    OLLAMA_TIMEOUT: int = 300

    # Microservice URLs
    WHISPER_SERVICE_URL: str = "http://localhost:8421"
    TTS_SERVICE_URL: str = "http://localhost:8422"
    IMAGE_SERVICE_URL: str = "http://localhost:8423"

    # Whisper (kept for local fallback / model manager)
    WHISPER_MODEL_SIZE: str = "base"
    WHISPER_DEVICE: str = "auto"
    WHISPER_COMPUTE_TYPE: str = "int8"

    # File paths
    GENERATED_DIR: str = str(
        Path(__file__).resolve().parent.parent / "generated"
    )
    UPLOAD_DIR: str = str(
        Path(__file__).resolve().parent.parent / "uploads"
    )

    # Limits
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500 MB

    # Audio
    SILENCE_THRESHOLD_DB: float = -30.0
    SILENCE_MIN_DURATION: float = 0.5
    DENOISE_STRENGTH: float = 0.7

    # Image generation defaults
    IMAGE_DEFAULT_WIDTH: int = 512
    IMAGE_DEFAULT_HEIGHT: int = 512
    IMAGE_DEFAULT_STEPS: int = 20
    IMAGE_DEFAULT_GUIDANCE: float = 7.5

    model_config = {
        "env_prefix": "OPENCUT_",
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()

# Ensure directories exist
os.makedirs(settings.GENERATED_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
