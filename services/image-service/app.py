"""Image generation and background removal microservice.

Standalone FastAPI service for image generation (diffusion) and background
removal (rembg). Supports multiple open-source models with GPU/CPU selection.
Also supports per-frame video background removal (alpha-matte video output).
Runs on port 8423.
"""

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
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
# Available image generation models
# ---------------------------------------------------------------------------

AVAILABLE_IMAGE_MODELS = [
    {
        "name": "stable-diffusion-2-1",
        "full_name": "stabilityai/stable-diffusion-2-1",
        "description": "Good quality — versatile default",
        "size": "~5 GB",
        "size_mb": 5000,
        "device": "gpu",
        "default_steps": 20,
    },
    {
        "name": "sdxl-turbo",
        "full_name": "stabilityai/sdxl-turbo",
        "description": "Fast SDXL — 1-4 step generation",
        "size": "~7 GB",
        "size_mb": 7000,
        "device": "gpu",
        "default_steps": 4,
    },
    {
        "name": "sdxl-base",
        "full_name": "stabilityai/stable-diffusion-xl-base-1.0",
        "description": "Highest quality — SDXL 1.0",
        "size": "~7 GB",
        "size_mb": 7000,
        "device": "gpu",
        "default_steps": 30,
    },
    {
        "name": "sd-1.5",
        "full_name": "runwayml/stable-diffusion-v1-5",
        "description": "Classic SD 1.5 — huge ecosystem",
        "size": "~4 GB",
        "size_mb": 4000,
        "device": "gpu",
        "default_steps": 20,
    },
    {
        "name": "flux-schnell",
        "full_name": "black-forest-labs/FLUX.1-schnell",
        "description": "FLUX.1 Schnell — fast, high quality",
        "size": "~12 GB",
        "size_mb": 12000,
        "device": "gpu",
        "default_steps": 4,
    },
    {
        "name": "segmind-tiny",
        "full_name": "segmind/tiny-sd",
        "description": "Tiny SD — CPU-friendly, compact",
        "size": "~1 GB",
        "size_mb": 1000,
        "device": "cpu",
        "default_steps": 25,
    },
    {
        "name": "small-sd",
        "full_name": "OFA-Sys/small-stable-diffusion-v0",
        "description": "Small SD — runs on CPU, decent quality",
        "size": "~1.5 GB",
        "size_mb": 1500,
        "device": "cpu",
        "default_steps": 25,
    },
]

_MODEL_MAP = {m["name"]: m for m in AVAILABLE_IMAGE_MODELS}
# Also allow lookup by full HuggingFace name
_FULL_NAME_MAP = {m["full_name"]: m for m in AVAILABLE_IMAGE_MODELS}


def _resolve_model_name(name: str) -> str:
    """Given a short name or full HF name, return the full HuggingFace model ID."""
    if name in _MODEL_MAP:
        return _MODEL_MAP[name]["full_name"]
    if name in _FULL_NAME_MAP:
        return name
    # Assume it's a full HuggingFace model path
    return name


def _short_name(full_name: str) -> str:
    """Given a full HF model name, return the short display name."""
    for m in AVAILABLE_IMAGE_MODELS:
        if m["full_name"] == full_name:
            return m["name"]
    return full_name


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
# Diffusion service singleton
# ---------------------------------------------------------------------------

class DiffusionService:
    """Image generation via diffusion models with multi-model support."""

    _instance: "DiffusionService | None" = None
    _pipeline = None
    _model_name: str = ""
    _device: str = "cpu"

    def __new__(cls) -> "DiffusionService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def is_loaded(self) -> bool:
        return self._pipeline is not None

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def device(self) -> str:
        return self._device

    @property
    def is_installed(self) -> bool:
        try:
            import torch  # noqa: F401
            import diffusers  # noqa: F401
            return True
        except ImportError:
            return False

    def load_model(self, model_name: str | None = None) -> dict:
        """Load a diffusion model by name. Returns status dict."""
        target = _resolve_model_name(model_name or DIFFUSION_MODEL)

        if self._pipeline is not None and self._model_name == target:
            return {"status": "already_loaded", "model": _short_name(target), "device": self._device}

        if not self.is_installed:
            msg = "diffusers and/or torch are not installed. Install with: pip install torch diffusers accelerate safetensors transformers"
            logger.warning(msg)
            return {"status": "not_installed", "error": msg, "install_command": "pip install torch diffusers accelerate"}

        # Unload current model if switching
        if self._pipeline is not None:
            self.unload()

        try:
            import torch
            from diffusers import AutoPipelineForText2Image

            has_cuda = torch.cuda.is_available()
            dtype = torch.float16 if has_cuda else torch.float32
            device = "cuda" if has_cuda else "cpu"

            logger.info("Loading diffusion model '%s' on %s...", target, device)

            self._pipeline = AutoPipelineForText2Image.from_pretrained(
                target,
                torch_dtype=dtype,
                variant="fp16" if has_cuda else None,
            )
            self._pipeline = self._pipeline.to(device)
            self._model_name = target
            self._device = device

            logger.info("Diffusion model '%s' loaded on %s.", target, device)
            return {"status": "loaded", "model": _short_name(target), "device": device}
        except Exception as e:
            logger.exception("Failed to load diffusion model '%s'", target)
            return {"status": "error", "error": str(e)}

    def unload(self) -> None:
        if self._pipeline is not None:
            del self._pipeline
            self._pipeline = None
            self._model_name = ""
            self._device = "cpu"
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
                "model_name": _short_name(diffusion_service.model_name) if diffusion_service.is_loaded else None,
                "installed": diffusion_installed,
                "device": diffusion_service.device if diffusion_service.is_loaded else None,
            },
            "rembg": {
                "available": rembg_available,
            },
        },
        "install_command": "pip install torch diffusers accelerate" if not diffusion_installed else None,
    }


@app.get("/models")
async def list_models():
    """List available image generation models with metadata."""
    active_full = diffusion_service.model_name if diffusion_service.is_loaded else None
    active_short = _short_name(active_full) if active_full else None
    device = diffusion_service.device if diffusion_service.is_loaded else "cpu"

    models = []
    for m in AVAILABLE_IMAGE_MODELS:
        is_active = m["full_name"] == active_full
        models.append({
            **m,
            "active": is_active,
            "device": device if is_active else m["device"],
        })
    return {"models": models, "active_model": active_short, "device": device}


@app.post("/generate")
async def generate_image(params: ImageGenParams):
    """Generate an image from a text prompt using the loaded diffusion model."""
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
    """Remove the background from an uploaded image."""
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


# ---------------------------------------------------------------------------
# Video background removal (per-frame rembg)
#
# Extracts frames at a low fps, runs rembg on each, reassembles them into an
# alpha-enabled WebM. This is CPU-heavy (~0.5-2s per frame), so it runs as an
# in-process background job with a status-polling API — the same UX shape as
# the YouTube→Reels pipeline, but local to this single-instance service.
# ---------------------------------------------------------------------------

ALLOWED_VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv"}

# In-process job store. Fine because image-service runs as a single instance
# and jobs are short-lived (cleaned up on completion/failure).
_bg_jobs: dict[str, dict] = {}


def _rembg_one(input_path: str, output_path: str) -> None:
    """Run rembg on a single PNG frame (synchronous — call in a thread)."""
    from rembg import remove
    from PIL import Image

    img = Image.open(input_path)
    out = remove(img)
    out.save(output_path, "PNG")


def _run_ffmpeg(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {proc.stderr.decode()[:400]}")


async def _remove_bg_video_pipeline(
    job_id: str,
    video_path: str,
    fps: float,
    max_duration: float,
) -> None:
    """Background coroutine: frames → rembg → reassemble as alpha WebM."""
    job = _bg_jobs[job_id]
    try:
        if not _check_rembg_available():
            raise RuntimeError("rembg is not installed in the image-service container.")

        # Probe source duration + dimensions.
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height,duration",
             "-of", "default=noprint_wrappers=1", video_path],
            capture_output=True,
        )
        info: dict[str, str] = {}
        for line in probe.stdout.decode().splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                info[k] = v
        duration = min(float(info.get("duration", 0) or 0), max_duration)
        width = int(info.get("width", 0) or 0)
        if duration <= 0:
            # Fall back to container duration if stream duration missing.
            probe2 = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", video_path],
                capture_output=True,
            )
            try:
                duration = min(float(probe2.stdout.decode().strip()), max_duration)
            except ValueError:
                duration = max_duration

        total_frames = max(1, int(duration * fps))
        job.update({"total_frames": total_frames, "duration": duration})

        work = tempfile.mkdtemp(prefix=f"vbg_{job_id}_")
        try:
            # 1. Extract frames as PNGs at the target fps.
            job.update({"status": "running", "progress": 0.02, "message": "Extracting frames…"})
            frame_glob = os.path.join(work, "f_%06d.png")
            _run_ffmpeg([
                "ffmpeg", "-y", "-i", video_path,
                "-t", f"{duration:.3f}",
                "-vf", f"fps={fps}",
                frame_glob,
            ])

            # 2. rembg each frame (thread pool to overlap I/O + model).
            job.update({"message": "Removing backgrounds…"})
            from concurrent.futures import ThreadPoolExecutor

            frames = sorted(Path(work).glob("f_*.png"))
            job.update({"total_frames": len(frames)})

            def _process(idx_path: tuple[int, str]) -> None:
                i, src = idx_path
                dst = os.path.join(work, f"r_{i:06d}.png")
                _rembg_one(src, dst)

            max_workers = max(1, (os.cpu_count() or 2) // 2)
            done = 0
            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                for _ in pool.map(_process, enumerate(str(p) for p in frames)):
                    done += 1
                    if done % max(1, len(frames) // 20) == 0 or done == len(frames):
                        job.update({
                            "progress": 0.1 + 0.8 * (done / max(1, len(frames))),
                            "processed_frames": done,
                            "message": f"Processed {done}/{len(frames)} frames…",
                        })

            # 3. Reassemble into a transparent WebM (VP8 + alpha).
            job.update({"progress": 0.92, "message": "Encoding transparent video…"})
            out_name = f"vbg_{job_id}.webm"
            out_path = os.path.join(GENERATED_DIR, out_name)
            # Concat the rembg'd frames. VP8 supports alpha via pix_fmt yuva420p.
            _run_ffmpeg([
                "ffmpeg", "-y",
                "-framerate", f"{fps}",
                "-i", os.path.join(work, "r_%06d.png"),
                "-c:v", "libvpx-vp9" if shutil.which("ffmpeg") else "libvpx",
                "-pix_fmt", "yuva420p",
                "-b:v", "1M",
                "-auto-alt-ref", "0",  # required for alpha to encode
                out_path,
            ])

            job.update({
                "status": "completed",
                "progress": 1.0,
                "message": "Done.",
                "result": {
                    "videoUrl": f"/generated/{out_name}",
                    "filename": out_name,
                    "fps": fps,
                    "framesProcessed": len(frames),
                    "duration": round(duration, 3),
                    "width": width,
                },
            })
        finally:
            shutil.rmtree(work, ignore_errors=True)
    except Exception as exc:
        logger.exception("video bg job %s failed", job_id)
        job.update({"status": "failed", "error": str(exc)[:400], "message": "Failed."})
    finally:
        try:
            if os.path.exists(video_path):
                os.remove(video_path)
        except OSError:
            pass


@app.post("/remove-bg-video")
async def remove_bg_video(
    file: UploadFile = File(...),
    fps: float = Form(default=8.0, ge=1.0, le=30.0),
    max_duration: float = Form(default=120.0, ge=1.0, le=600.0),
):
    """Start a per-frame video background-removal job. Returns a job_id.

    The client polls ``GET /remove-bg-video/job/{job_id}`` for progress and
    the resulting transparent WebM URL. Deliberately defaults to 8 fps on CPU
    — per-frame rembg is ~0.5-2s/frame, so estimate roughly
    ``duration * fps * ~1s`` before starting.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext}'. Allowed: {sorted(ALLOWED_VIDEO_EXTS)}",
        )

    if not _check_rembg_available():
        raise HTTPException(
            status_code=501,
            detail="rembg is not installed in the image-service. "
            "Rebuild with rembg[cpu] in the image-service requirements.",
        )

    upload_id = uuid.uuid4().hex[:8]
    upload_path = os.path.join(UPLOAD_DIR, f"vbg_{upload_id}{ext}")
    contents = await file.read()
    with open(upload_path, "wb") as f:
        f.write(contents)

    job_id = uuid.uuid4().hex[:12]
    _bg_jobs[job_id] = {
        "status": "queued",
        "progress": 0.0,
        "message": "Queued.",
        "total_frames": None,
        "processed_frames": 0,
        "duration": None,
        "result": None,
        "error": None,
        "created_at": time.time(),
    }

    asyncio.create_task(_remove_bg_video_pipeline(job_id, upload_path, fps, max_duration))
    logger.info("AUDIT vbg create: job=%s fps=%s max_dur=%s", job_id, fps, max_duration)
    return {"job_id": job_id, "status": "queued"}


@app.get("/remove-bg-video/job/{job_id}")
async def remove_bg_video_job(job_id: str):
    """Poll a video background-removal job."""
    job = _bg_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    # GC completed/failed jobs older than 1 hour to bound memory.
    now = time.time()
    stale = [jid for jid, j in _bg_jobs.items()
             if j["status"] in ("completed", "failed") and now - j.get("created_at", now) > 3600]
    for jid in stale:
        _bg_jobs.pop(jid, None)
    return {"job_id": job_id, **job}


@app.post("/load")
async def load_model(model_name: str | None = None):
    """Load an image generation model by name. Downloads on first use."""
    result = diffusion_service.load_model(model_name)

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


@app.post("/test")
async def test_model():
    """Quick test: generate a tiny image to verify the model works."""
    if not diffusion_service.is_loaded:
        raise HTTPException(status_code=400, detail="No model loaded. Load a model first.")

    try:
        output_path = await diffusion_service.generate(
            prompt="test",
            width=64,
            height=64,
            steps=1,
            guidance_scale=1.0,
        )
        if os.path.exists(output_path):
            os.remove(output_path)

        return {
            "status": "ok",
            "model": _short_name(diffusion_service.model_name),
            "device": diffusion_service.device,
            "message": f"Model '{_short_name(diffusion_service.model_name)}' is working correctly.",
        }
    except Exception as e:
        logger.exception("Image test failed")
        raise HTTPException(status_code=500, detail=f"Test failed: {e}")


@app.post("/unload")
async def unload_model():
    """Unload the image generation model and free memory."""
    diffusion_service.unload()
    return {"status": "success", "message": "Image model unloaded."}
