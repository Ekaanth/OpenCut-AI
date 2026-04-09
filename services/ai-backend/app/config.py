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

    # AI Memory Budget & Model Tiers
    AI_MEMORY_BUDGET: str = "auto"  # "auto", "4GB", "8GB", "16GB", "32GB"
    AI_MODEL_TIER: str = "auto"  # "lite", "standard", "pro", "auto"
    AI_LLM_BACKEND: str = "auto"  # "ollama", "turboquant", "auto" (TQ with KV-cache optimization when available, else Ollama)
    KV_CACHE_BITS: int = 2  # 2, 3, or 4 — TurboQuant KV cache quantization bits (2 = most memory efficient, default)
    # Compute mode for the TurboQuant inference service.
    # "auto" = detect CUDA → MPS → CPU; "cuda" = force GPU; "cpu" = force CPU.
    # Propagated to turboquant-service as its DEVICE env var.
    AI_COMPUTE_MODE: str = "auto"

    # Microservice URLs
    WHISPER_SERVICE_URL: str = "http://localhost:8421"
    TTS_SERVICE_URL: str = "http://localhost:8422"
    IMAGE_SERVICE_URL: str = "http://localhost:8423"
    SPEAKER_SERVICE_URL: str = "http://localhost:8424"
    FACE_SERVICE_URL: str = "http://localhost:8425"
    TURBOQUANT_SERVICE_URL: str = "http://localhost:8430"

    # Sarvam AI (Indian language APIs)
    SARVAM_API_KEY: str = ""
    SARVAM_API_BASE_URL: str = "https://api.sarvam.ai"

    # Smallest AI (Waves — Lightning TTS + Pulse STT)
    SMALLEST_API_KEY: str = ""
    SMALLEST_API_BASE_URL: str = "https://api.smallest.ai/waves/v1"

    # Seedance (ByteDance text-to-video generation via PiAPI)
    SEEDANCE_API_KEY: str = ""
    SEEDANCE_API_BASE_URL: str = "https://api.piapi.ai"

    # Google OAuth (for YouTube channel ownership verification)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:3000/api/auth/youtube/callback"

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

    # Redis (for job queue)
    REDIS_URL: str = "redis://localhost:6379"

    # YouTube to Reels
    YOUTUBE_MAX_DURATION_SECONDS: int = 14400  # 4 hours
    YOUTUBE_MAX_CONCURRENT_JOBS: int = 3
    YOUTUBE_MAX_DAILY_JOBS: int = 20
    YOUTUBE_JOB_TTL_HOURS: int = 24

    # Engagement scoring weights (must sum to 1.0)
    ENGAGEMENT_HOOK_WEIGHT: float = 0.25
    ENGAGEMENT_CURIOSITY_WEIGHT: float = 0.20
    ENGAGEMENT_VIRALITY_WEIGHT: float = 0.15
    ENGAGEMENT_ENERGY_WEIGHT: float = 0.15
    ENGAGEMENT_EMOTION_WEIGHT: float = 0.10
    ENGAGEMENT_AUDIO_SYNC_WEIGHT: float = 0.10
    ENGAGEMENT_FACE_WEIGHT: float = 0.05

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
        "env_prefix": "OPENCUTAI_",
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()

# Validate engagement weights sum to 1.0
_engagement_sum = (
    settings.ENGAGEMENT_HOOK_WEIGHT
    + settings.ENGAGEMENT_CURIOSITY_WEIGHT
    + settings.ENGAGEMENT_VIRALITY_WEIGHT
    + settings.ENGAGEMENT_ENERGY_WEIGHT
    + settings.ENGAGEMENT_EMOTION_WEIGHT
    + settings.ENGAGEMENT_AUDIO_SYNC_WEIGHT
    + settings.ENGAGEMENT_FACE_WEIGHT
)
if abs(_engagement_sum - 1.0) > 0.01:
    raise ValueError(
        f"Engagement weights must sum to 1.0, got {_engagement_sum:.3f}. "
        "Check OPENCUTAI_ENGAGEMENT_*_WEIGHT environment variables."
    )

# Ensure directories exist
os.makedirs(settings.GENERATED_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "youtube"), exist_ok=True)
