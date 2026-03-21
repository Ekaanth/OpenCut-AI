"""Image generation service with Stable Diffusion via diffusers.

Requires: pip install diffusers torch accelerate safetensors transformers
The model downloads automatically on first load (~5 GB for SDXL Turbo).
GPU strongly recommended.
"""

import logging
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class DiffusionService:
    """Image generation via diffusion models."""

    _instance: "DiffusionService | None" = None
    _pipeline = None
    _model_name: str | None = None
    _is_installed: bool | None = None

    def __new__(cls) -> "DiffusionService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def is_loaded(self) -> bool:
        return self._pipeline is not None

    @property
    def is_installed(self) -> bool:
        """Check if diffusers + torch are available."""
        if self._is_installed is None:
            try:
                import diffusers  # noqa: F401
                import torch  # noqa: F401
                self._is_installed = True
            except ImportError:
                self._is_installed = False
        return self._is_installed

    def load_model(self, model_id: str | None = None) -> dict:
        """Load the diffusion pipeline.

        Uses SDXL Turbo by default for fast generation (4 steps).
        Returns a status dict with success/error information.
        """
        if self._pipeline is not None:
            logger.info("Diffusion pipeline already loaded.")
            return {"status": "already_loaded", "model": self._model_name}

        if not self.is_installed:
            msg = (
                "Diffusers and/or torch are not installed. "
                "Install with: pip install diffusers torch accelerate safetensors transformers"
            )
            logger.warning(msg)
            return {
                "status": "not_installed",
                "error": msg,
                "install_command": "pip install diffusers torch accelerate safetensors transformers",
            }

        target_model = model_id or "stabilityai/sdxl-turbo"

        try:
            import torch
            from diffusers import AutoPipelineForText2Image

            dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            device = "cuda" if torch.cuda.is_available() else "cpu"

            logger.info("Loading diffusion model '%s' on %s... This may take a while.", target_model, device)

            self._pipeline = AutoPipelineForText2Image.from_pretrained(
                target_model,
                torch_dtype=dtype,
                variant="fp16" if torch.cuda.is_available() else None,
            )
            self._pipeline = self._pipeline.to(device)
            self._model_name = target_model

            logger.info("Diffusion model '%s' loaded on %s.", target_model, device)
            return {"status": "loaded", "model": target_model, "device": device}
        except Exception as e:
            logger.exception("Failed to load diffusion model '%s'", target_model)
            return {"status": "error", "error": str(e)}

    def unload(self) -> None:
        """Free the diffusion pipeline from memory."""
        if self._pipeline is not None:
            del self._pipeline
            self._pipeline = None
            self._model_name = None
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except ImportError:
                pass
            logger.info("Diffusion pipeline unloaded.")

    def get_status(self) -> dict:
        """Return current status for health checks."""
        return {
            "installed": self.is_installed,
            "loaded": self.is_loaded,
            "model_name": self._model_name,
            "install_command": (
                "pip install diffusers torch accelerate safetensors transformers"
                if not self.is_installed
                else None
            ),
        }

    async def generate(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 512,
        height: int = 512,
        steps: int = 4,
        guidance_scale: float = 0.0,
        seed: int | None = None,
    ) -> dict:
        """Generate an image from a text prompt.

        Returns dict with image_url and seed.
        """
        if not self.is_loaded:
            result = self.load_model()
            if result["status"] not in ("loaded", "already_loaded"):
                raise RuntimeError(f"Cannot generate image: {result.get('error', 'model not loaded')}")

        import torch

        generator = torch.Generator(device=self._pipeline.device)
        if seed is not None:
            generator = generator.manual_seed(seed)
        else:
            seed = generator.seed()

        image = self._pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt if negative_prompt else None,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            generator=generator,
        ).images[0]

        output_path = Path(settings.GENERATED_DIR) / f"gen_{uuid.uuid4().hex[:8]}.png"
        image.save(str(output_path))

        return {
            "image_url": f"/generated/{output_path.name}",
            "seed": seed,
            "prompt": prompt,
        }


# Module-level singleton
diffusion_service = DiffusionService()
