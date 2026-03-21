"""Image generation and background removal microservice.

Standalone FastAPI service for image generation (diffusion) and background
removal (rembg). Currently stubs that return clear 501 messages until
diffusers/torch/rembg are installed.
Runs on port 8423.
"""

import logging
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration via environment variables
# ---------------------------------------------------------------------------
DIFFUSION_MODEL = os.getenv("DIFFUSION_MODEL", "stabilityai/stable-diffusion-2-1")
IMAGE_DEFAULT_WIDTH = int(os.getenv("IMAGE_DEFAULT_WIDTH", "512"))
IMAGE_DEFAULT_HEIGHT = int(os.getenv("IMAGE_DEFAULT_HEIGHT", "512"))
IMAGE_DEFAULT_STEPS = int(os.getenv("IMAGE_DEFAULT_STEPS", "20"))
IMAGE_DEFAULT_GUIDANCE = float(os.getenv("IMAGE_DEFAULT_GUIDANCE", "7.5"))
GENERATED_DIR = os.getenv("GENERATED_DIR", "generated")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

os.makedirs(GENERATED_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ImageGenParams(BaseModel):
    prompt: str = Field(..., description="Text prompt for image generation")
    negative_prompt: str = Field(default="", description="Negative prompt")
    width: int = Field(default=IMAGE_DEFAULT_WIDTH, ge=64, le=2048)
    height: int = Field(default=IMAGE_DEFAULT_HEIGHT, ge=64, le=2048)
    steps: int = Field(default=IMAGE_DEFAULT_STEPS, ge=1, le=100)
    guidance_scale: float = Field(default=IMAGE_DEFAULT_GUIDANCE, ge=1.0, le=30.0)
    seed: int | None = Field(default=None, description="Random seed for reproducibility")


# ---------------------------------------------------------------------------
# Diffusion service singleton (stub)
# ---------------------------------------------------------------------------

class DiffusionService:
    """Image generation via diffusion models."""

    _instance: "DiffusionService | None" = None
    _pipeline = None
    _model_name: str = ""

    def __new__(cls) -> "DiffusionService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def is_loaded(self) -> bool:
        return self._pipeline is not None

    @property
    def is_installed(self) -> bool:
        try:
            import torch  # noqa: F401
            import diffusers  # noqa: F401
            return True
        except ImportError:
            return False

    def load_model(self) -> dict:
        """Load the diffusion pipeline. Returns status dict."""
        if self._pipeline is not None:
            return {"status": "already_loaded", "model": self._model_name}

        if not self.is_installed:
            msg = "diffusers and/or torch are not installed. Install with: pip install torch diffusers accelerate safetensors transformers"
            logger.warning(msg)
            return {"status": "not_installed", "error": msg, "install_command": "pip install torch diffusers accelerate"}

        try:
            import torch
            from diffusers import AutoPipelineForText2Image

            dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            device = "cuda" if torch.cuda.is_available() else "cpu"

            logger.info("Loading diffusion model '%s' on %s... This may take a while.", DIFFUSION_MODEL, device)

            self._pipeline = AutoPipelineForText2Image.from_pretrained(
                DIFFUSION_MODEL,
                torch_dtype=dtype,
                variant="fp16" if torch.cuda.is_available() else None,
            )
            self._pipeline = self._pipeline.to(device)
            self._model_name = DIFFUSION_MODEL

            logger.info("Diffusion model '%s' loaded on %s.", DIFFUSION_MODEL, device)
            return {"status": "loaded", "model": DIFFUSION_MODEL, "device": device}
        except Exception as e:
            logger.exception("Failed to load diffusion model")
            return {"status": "error", "error": str(e)}

    def unload(self) -> None:
        if self._pipeline is not None:
            del self._pipeline
            self._pipeline = None
            self._model_name = ""
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except ImportError:
                pass
            logger.info("Diffusion pipeline unloaded.")

    async def generate(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 512,
        height: int = 512,
        steps: int = 20,
        guidance_scale: float = 7.5,
        seed: int | None = None,
    ) -> str:
        if not self.is_loaded:
            result = self.load_model()
            if result["status"] not in ("loaded", "already_loaded"):
                raise NotImplementedError(result.get("error", "Image generation not available"))

        import torch

        generator = torch.Generator(device=self._pipeline.device)
        if seed is not None:
            generator = generator.manual_seed(seed)

        image = self._pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt if negative_prompt else None,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            generator=generator,
        ).images[0]

        output_path = os.path.join(GENERATED_DIR, f"gen_{uuid.uuid4().hex[:8]}.png")
        image.save(output_path)
        return output_path


diffusion_service = DiffusionService()


# ---------------------------------------------------------------------------
# Rembg status check
# ---------------------------------------------------------------------------

def _check_rembg_available() -> bool:
    try:
        import rembg  # noqa: F401
        return True
    except ImportError:
        return False


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="OpenCutAI Image Service", version="1.0.0")

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


@app.get("/health")
async def health():
    """Return service health and model status."""
    diffusion_installed = diffusion_service.is_installed
    rembg_available = _check_rembg_available()

    return {
        "status": "ok",
        "service": "image",
        "models": {
            "diffusion": {
                "loaded": diffusion_service.is_loaded,
                "model_name": diffusion_service._model_name if diffusion_service.is_loaded else None,
                "installed": diffusion_installed,
            },
            "rembg": {
                "available": rembg_available,
            },
        },
        "install_command": "pip install torch diffusers accelerate" if not diffusion_installed else None,
    }


@app.post("/generate")
async def generate_image(params: ImageGenParams):
    """Generate an image from a text prompt using a diffusion model.

    Returns 501 until diffusers/torch are installed.
    """
    try:
        output_path = await diffusion_service.generate(
            prompt=params.prompt,
            negative_prompt=params.negative_prompt,
            width=params.width,
            height=params.height,
            steps=params.steps,
            guidance_scale=params.guidance_scale,
            seed=params.seed,
        )
        return FileResponse(
            path=output_path,
            media_type="image/png",
            filename=f"generated_{uuid.uuid4().hex[:8]}.png",
        )
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception:
        logger.exception("Image generation failed")
        raise HTTPException(status_code=500, detail="Image generation failed.")


@app.post("/remove-bg")
async def remove_bg(file: UploadFile = File(...)):
    """Remove the background from an uploaded image.

    Returns 501 until rembg is installed.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = Path(file.filename).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".bmp"}:
        raise HTTPException(status_code=400, detail="Unsupported image format.")

    upload_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join(UPLOAD_DIR, f"rembg_{upload_id}{ext}")

    try:
        contents = await file.read()
        with open(upload_path, "wb") as f:
            f.write(contents)

        try:
            import asyncio
            from rembg import remove
            from PIL import Image

            output_path = os.path.join(GENERATED_DIR, f"nobg_{uuid.uuid4().hex[:8]}.png")

            def _remove_bg_sync() -> None:
                input_image = Image.open(upload_path)
                output_image = remove(input_image)
                output_image.save(output_path, "PNG")

            await asyncio.to_thread(_remove_bg_sync)

            return FileResponse(
                path=output_path,
                media_type="image/png",
                filename=f"nobg_{upload_id}.png",
            )
        except ImportError:
            raise HTTPException(
                status_code=501,
                detail="Install rembg to enable background removal.",
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Background removal failed")
        raise HTTPException(status_code=500, detail="Background removal failed.")
    finally:
        if os.path.exists(upload_path):
            os.remove(upload_path)


@app.post("/load")
async def load_model():
    """Pre-load the image generation model."""
    result = diffusion_service.load_model()

    if result["status"] == "not_installed":
        raise HTTPException(
            status_code=501,
            detail=result.get("error", "Diffusion libraries not installed"),
        )
    if result["status"] == "error":
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to load model"),
        )

    return result


@app.post("/unload")
async def unload_model():
    """Unload the image generation model and free memory."""
    diffusion_service.unload()
    return {"status": "success", "message": "Image model unloaded."}
