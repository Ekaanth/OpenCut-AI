"""Image generation and infographic request models."""

from pydantic import BaseModel, ConfigDict, Field


class ImageGenParams(BaseModel):
    """Parameters for text-to-image generation (proxied to image-service)."""

    model_config = ConfigDict(populate_by_name=True)

    prompt: str
    negative_prompt: str = Field(default="", alias="negativePrompt")
    width: int = 512
    height: int = 512
    steps: int = 20
    guidance_scale: float = Field(default=7.5, alias="guidanceScale")
    seed: int | None = None
    model: str | None = None


class EnhancePromptRequest(BaseModel):
    """Request to expand a short prompt into a detailed diffusion prompt."""

    prompt: str
    style: str = "photorealistic"


class InfographicRequest(BaseModel):
    """Request to render a simple infographic overlay PNG."""

    topic: str
    data_points: list[dict] = Field(default_factory=list)
    style: str = "modern"
    width: int = 1080
    height: int = 1080
    background_color: tuple[int, int, int, int] | str = (0, 0, 0, 0)
