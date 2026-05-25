"""Video generation routes.

Supports:
  - Prompt generation from template title/description via LLM
  - Video generation via Seedance 2.0 (ByteDance) through PiAPI, or local generation
"""

import asyncio
import logging
import os
import time
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.services.model_backend import llm_backend

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/video", tags=["video"])


def _get_seedance_key(request: Request) -> str:
    """Get Seedance API key from header passthrough or server config."""
    return (
        request.headers.get("X-Seedance-Api-Key", "").strip()
        or settings.SEEDANCE_API_KEY
    )


def _get_replicate_key(request: Request) -> str:
    return (
        request.headers.get("X-Replicate-Api-Token", "").strip()
        or settings.REPLICATE_API_TOKEN
    )


def _get_stability_key(request: Request) -> str:
    return (
        request.headers.get("X-Stability-Api-Key", "").strip()
        or settings.STABILITY_API_KEY
    )


def _get_luma_key(request: Request) -> str:
    return (
        request.headers.get("X-Luma-Api-Key", "").strip()
        or settings.LUMA_API_KEY
    )


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class PromptGenerateRequest(BaseModel):
    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=2000)
    style: str = Field(default="cinematic", max_length=50)


class VideoGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    duration: int = Field(default=5, ge=1, le=15)
    width: int = Field(default=1920, ge=256, le=3840)
    height: int = Field(default=1080, ge=256, le=2160)
    provider: str = Field(default="seedance", description="replicate, seedance, stability, luma, or local")
    model: str = Field(default="", description="Specific model ID within provider")
    mode: str = Field(default="text-to-video")
    imageUrl: str = Field(default="")
    videoUrl: str = Field(default="")


# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------

_jobs: dict[str, dict] = {}
_MAX_JOBS = 50


def _evict_old_jobs() -> None:
    if len(_jobs) <= _MAX_JOBS:
        return
    sorted_ids = sorted(_jobs, key=lambda k: _jobs[k].get("created_at", 0))
    for jid in sorted_ids[: len(_jobs) - _MAX_JOBS]:
        del _jobs[jid]


# ---------------------------------------------------------------------------
# Aspect ratio helper
# ---------------------------------------------------------------------------

def _to_aspect_ratio(width: int, height: int) -> str:
    """Convert width/height to a Seedance-compatible aspect ratio string."""
    ratio = width / height
    if abs(ratio - 16 / 9) < 0.05:
        return "16:9"
    if abs(ratio - 9 / 16) < 0.05:
        return "9:16"
    if abs(ratio - 1.0) < 0.05:
        return "1:1"
    if abs(ratio - 4 / 3) < 0.05:
        return "4:3"
    if abs(ratio - 3 / 4) < 0.05:
        return "3:4"
    if abs(ratio - 21 / 9) < 0.1:
        return "21:9"
    return "16:9"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/generate-prompt")
async def generate_video_prompt(req: PromptGenerateRequest) -> dict:
    """Generate a video generation prompt from a template title and description."""
    if not req.title.strip() and not req.description.strip():
        raise HTTPException(status_code=400, detail="Provide a title or description")

    system_prompt = (
        "You are a creative director for video production. "
        "Given a video title and description, generate a concise, vivid text-to-video prompt "
        "that a video generation AI (Seedance 2.0) can use. Focus on visual descriptions: "
        "camera movement, lighting, mood, subjects, colors, and style. "
        "Keep it under 150 words. Return ONLY the prompt text, no explanations."
    )
    user_msg = f"Title: {req.title}\nDescription: {req.description}\nStyle: {req.style}"

    try:
        result = await llm_backend.chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.8,
        )
        prompt_text = result.strip() if isinstance(result, str) else result.get("content", "").strip()
        if not prompt_text:
            raise HTTPException(status_code=500, detail="LLM returned empty response")

        return {
            "prompt": prompt_text,
            "enhancedDescription": req.description,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to generate video prompt")
        raise HTTPException(status_code=500, detail=f"Prompt generation failed: {e}")


@router.post("/generate")
async def generate_video(req: VideoGenerateRequest, request: Request) -> dict:
    """Start video generation using the specified provider."""
    job_id = str(uuid.uuid4())[:12]
    _evict_old_jobs()

    _jobs[job_id] = {
        "job_id": job_id,
        "status": "processing",
        "prompt": req.prompt,
        "provider": req.provider,
        "created_at": time.time(),
        "videoUrl": None,
        "error": None,
    }

    if req.provider == "seedance":
        api_key = _get_seedance_key(request)
        asyncio.create_task(_run_seedance_generation(job_id, req, api_key))
    elif req.provider == "replicate":
        api_key = _get_replicate_key(request)
        asyncio.create_task(_run_replicate_generation(job_id, req, api_key))
    elif req.provider == "stability":
        api_key = _get_stability_key(request)
        asyncio.create_task(_run_stability_generation(job_id, req, api_key))
    elif req.provider == "luma":
        api_key = _get_luma_key(request)
        asyncio.create_task(_run_luma_generation(job_id, req, api_key))
    elif req.provider == "local":
        asyncio.create_task(_run_local_generation(job_id, req))
    else:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = f"Unknown provider: {req.provider}"
        raise HTTPException(status_code=400, detail=f"Unknown provider: {req.provider}")

    return {
        "jobId": job_id,
        "status": "processing",
        "prompt": req.prompt,
        "provider": req.provider,
    }


@router.get("/jobs/{job_id}")
async def get_video_job(job_id: str) -> dict:
    """Poll a video generation job for its status."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "jobId": job["job_id"],
        "status": job["status"],
        "videoUrl": job.get("videoUrl"),
        "prompt": job.get("prompt"),
        "provider": job.get("provider"),
        "duration": 0,
        "error": job.get("error"),
    }


# ---------------------------------------------------------------------------
# Seedance 2.0 via PiAPI
# ---------------------------------------------------------------------------

async def _run_seedance_generation(
    job_id: str, req: VideoGenerateRequest, api_key: str = ""
) -> None:
    """Generate video via Seedance 2.0 through PiAPI."""
    import httpx

    api_key = api_key or settings.SEEDANCE_API_KEY
    if not api_key:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = "Seedance API key not configured. Add it in Settings."
        return

    base_url = settings.SEEDANCE_API_BASE_URL
    aspect_ratio = _to_aspect_ratio(req.width, req.height)

    # Clamp duration to Seedance's supported values (5, 10, or 15 seconds)
    duration = 5
    if req.duration >= 12:
        duration = 15
    elif req.duration >= 8:
        duration = 10

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Submit task to PiAPI Seedance endpoint
            resp = await client.post(
                f"{base_url}/api/v1/task",
                headers={
                    "X-API-Key": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "model": "seedance",
                    "task_type": "seedance-2-preview",
                    "input": {
                        "prompt": req.prompt,
                        "duration": duration,
                        "aspect_ratio": aspect_ratio,
                    },
                },
            )

            if resp.status_code != 200:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = (
                    f"Seedance API error: {resp.status_code} — {resp.text[:300]}"
                )
                return

            data = resp.json()
            task_data = data.get("data", data)
            task_id = task_data.get("task_id")
            status = task_data.get("status", "")

            if not task_id:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = "No task_id returned from Seedance API"
                return

            # If already completed (unlikely but handle it)
            if status == "Completed":
                video_url = (task_data.get("output") or {}).get("video", "")
                if video_url:
                    local_url = await _download_video(client, video_url, job_id)
                    _jobs[job_id]["status"] = "completed"
                    _jobs[job_id]["videoUrl"] = local_url
                    return

        # Poll for completion (up to 5 minutes)
        async with httpx.AsyncClient(timeout=30) as client:
            for _ in range(60):
                await asyncio.sleep(5)

                poll_resp = await client.get(
                    f"{base_url}/api/v1/task/{task_id}",
                    headers={"X-API-Key": api_key},
                )
                if poll_resp.status_code != 200:
                    continue

                poll_data = poll_resp.json()
                task_data = poll_data.get("data", poll_data)
                status = task_data.get("status", "")

                if status == "Completed":
                    output = task_data.get("output", {})
                    video_url = output.get("video", "")
                    if video_url:
                        local_url = await _download_video(client, video_url, job_id)
                        _jobs[job_id]["status"] = "completed"
                        _jobs[job_id]["videoUrl"] = local_url
                        return
                    _jobs[job_id]["status"] = "failed"
                    _jobs[job_id]["error"] = "Seedance completed but no video URL"
                    return

                if status == "Failed":
                    error = task_data.get("error", {})
                    msg = error.get("message", "Seedance generation failed") if isinstance(error, dict) else str(error)
                    _jobs[job_id]["status"] = "failed"
                    _jobs[job_id]["error"] = msg
                    return

            # Timed out
            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = "Seedance generation timed out (5 min)"

    except Exception as e:
        logger.exception("Seedance generation failed for job %s", job_id)
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = str(e)


# ---------------------------------------------------------------------------
# Replicate (Runway, Pika, Kling, MiniMax, Stable Video, etc.)
# ---------------------------------------------------------------------------

REPLICATE_MODELS = {
    "runway-gen3-alpha": "lucataco/runway-gen3-alpha:...",
    "pika-1.0": "pika/pika-1.0:...",
    "minimax-video-01": "minimax/video-01:...",
    "stable-video-diffusion": "stability-ai/stable-video-diffusion:...",
    "kling-v1.6": "kling/kling-v1.6-pro:...",
}

DEFAULT_REPLICATE_MODELS = {
    "runway-gen3-alpha": "lucataco/runway-gen3-alpha:77d5a89a9b352c4b0e0b6b77e4e6c9c3f3e0f0e0",
    "pika-1.0": "pika/pika:1.0",
    "minimax-video-01": "minimax/video-01:d6b1c4b6e0e0e0e0e0e0e0e0e0e0e0e0",
    "stable-video-diffusion": "stability-ai/stable-video-diffusion:db6ef745eb0a0d0e0e0e0e0e0e0e0e0e0",
    "kling-v1.6": "kling/kling-v1.6-pro:77d5a89a9b352c4b0e0b6b77e4e6c9c3f3e0f0e0",
}


async def _run_replicate_generation(
    job_id: str, req: VideoGenerateRequest, api_key: str = ""
) -> None:
    import httpx

    api_key = api_key or settings.REPLICATE_API_TOKEN
    if not api_key:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = "Replicate API token not configured. Add it in Settings."
        return

    model_version = DEFAULT_REPLICATE_MODELS.get(req.model, DEFAULT_REPLICATE_MODELS["runway-gen3-alpha"])

    input_data: dict = {
        "prompt": req.prompt,
    }

    if req.mode == "image-to-video" and req.imageUrl:
        input_data["image"] = req.imageUrl
    elif req.mode == "video-to-video" and req.videoUrl:
        input_data["video"] = req.videoUrl

    aspect_ratio = _to_aspect_ratio(req.width, req.height)
    input_data["aspect_ratio"] = aspect_ratio
    input_data["duration"] = req.duration

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.replicate.com/v1/predictions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "version": model_version.split(":")[-1] if ":" in model_version else model_version,
                    "input": input_data,
                },
            )

            if resp.status_code not in (200, 201):
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = f"Replicate API error: {resp.status_code} — {resp.text[:300]}"
                return

            data = resp.json()
            prediction_id = data.get("id")
            if not prediction_id:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = "No prediction ID returned from Replicate"
                return

        async with httpx.AsyncClient(timeout=30) as client:
            for _ in range(120):
                await asyncio.sleep(3)

                poll_resp = await client.get(
                    f"https://api.replicate.com/v1/predictions/{prediction_id}",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if poll_resp.status_code != 200:
                    continue

                poll_data = poll_resp.json()
                status = poll_data.get("status", "")

                if status == "succeeded":
                    output = poll_data.get("output", "")
                    video_url = output if isinstance(output, str) else (output[0] if isinstance(output, list) and output else "")
                    if video_url:
                        local_url = await _download_video(client, video_url, job_id)
                        _jobs[job_id]["status"] = "completed"
                        _jobs[job_id]["videoUrl"] = local_url
                        return
                    _jobs[job_id]["status"] = "failed"
                    _jobs[job_id]["error"] = "Replicate succeeded but no video URL"
                    return

                if status == "failed":
                    error_msg = poll_data.get("error", "Replicate generation failed")
                    _jobs[job_id]["status"] = "failed"
                    _jobs[job_id]["error"] = str(error_msg)
                    return

            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = "Replicate generation timed out (6 min)"

    except Exception as e:
        logger.exception("Replicate generation failed for job %s", job_id)
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = str(e)


# ---------------------------------------------------------------------------
# Stability AI (Stable Video Diffusion)
# ---------------------------------------------------------------------------

async def _run_stability_generation(
    job_id: str, req: VideoGenerateRequest, api_key: str = ""
) -> None:
    import httpx

    api_key = api_key or settings.STABILITY_API_KEY
    if not api_key:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = "Stability AI API key not configured. Add it in Settings."
        return

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            payload: dict = {
                "prompt": req.prompt,
                "aspect_ratio": _to_aspect_ratio(req.width, req.height),
                "seed": 0,
            }

            if req.mode == "image-to-video" and req.imageUrl:
                img_resp = await client.get(req.imageUrl, timeout=30)
                img_resp.raise_for_status()

                resp = await client.post(
                    "https://api.stability.ai/v2beta/image-to-video",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                    },
                    files={"image": ("image.png", img_resp.content, "image/png")},
                    data={"seed": "0"},
                )
            else:
                resp = await client.post(
                    "https://api.stability.ai/v2beta/image-to-video",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

            if resp.status_code not in (200, 201):
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = f"Stability API error: {resp.status_code} — {resp.text[:300]}"
                return

            data = resp.json()
            generation_id = data.get("id")
            if not generation_id:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = "No generation ID from Stability AI"
                return

            for _ in range(120):
                await asyncio.sleep(3)

                poll_resp = await client.get(
                    f"https://api.stability.ai/v2beta/image-to-video/result/{generation_id}",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Accept": "video/*",
                    },
                )

                if poll_resp.status_code == 200:
                    content_type = poll_resp.headers.get("content-type", "")
                    if "video" in content_type:
                        filename = f"video_{job_id}.mp4"
                        filepath = os.path.join(settings.GENERATED_DIR, filename)
                        with open(filepath, "wb") as f:
                            f.write(poll_resp.content)
                        _jobs[job_id]["status"] = "completed"
                        _jobs[job_id]["videoUrl"] = f"/generated/{filename}"
                        return

                if poll_resp.status_code == 202:
                    continue

                if poll_resp.status_code >= 400:
                    _jobs[job_id]["status"] = "failed"
                    _jobs[job_id]["error"] = f"Stability polling error: {poll_resp.status_code}"
                    return

            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = "Stability generation timed out (6 min)"

    except Exception as e:
        logger.exception("Stability generation failed for job %s", job_id)
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = str(e)


# ---------------------------------------------------------------------------
# Luma AI (Dream Machine)
# ---------------------------------------------------------------------------

async def _run_luma_generation(
    job_id: str, req: VideoGenerateRequest, api_key: str = ""
) -> None:
    import httpx

    api_key = api_key or settings.LUMA_API_KEY
    if not api_key:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = "Luma AI API key not configured. Add it in Settings."
        return

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            payload: dict = {
                "prompt": req.prompt,
                "aspect_ratio": _to_aspect_ratio(req.width, req.height),
            }

            if req.mode == "image-to-video" and req.imageUrl:
                payload["image_url"] = req.imageUrl

            resp = await client.post(
                "https://api.lumalabs.ai/dream-machine/v1/generations",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

            if resp.status_code not in (200, 201):
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = f"Luma API error: {resp.status_code} — {resp.text[:300]}"
                return

            data = resp.json()
            generation_id = data.get("id")
            if not generation_id:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = "No generation ID from Luma AI"
                return

        async with httpx.AsyncClient(timeout=30) as client:
            for _ in range(120):
                await asyncio.sleep(3)

                poll_resp = await client.get(
                    f"https://api.lumalabs.ai/dream-machine/v1/generations/{generation_id}",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if poll_resp.status_code != 200:
                    continue

                poll_data = poll_resp.json()
                state = poll_data.get("state", "")

                if state == "completed":
                    assets = poll_data.get("assets", {})
                    video_url = assets.get("video", "")
                    if video_url:
                        local_url = await _download_video(client, video_url, job_id)
                        _jobs[job_id]["status"] = "completed"
                        _jobs[job_id]["videoUrl"] = local_url
                        return
                    _jobs[job_id]["status"] = "failed"
                    _jobs[job_id]["error"] = "Luma completed but no video URL"
                    return

                if state == "failed":
                    _jobs[job_id]["status"] = "failed"
                    _jobs[job_id]["error"] = poll_data.get("failure_reason", "Luma generation failed")
                    return

            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = "Luma generation timed out (6 min)"

    except Exception as e:
        logger.exception("Luma generation failed for job %s", job_id)
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = str(e)


# ---------------------------------------------------------------------------
# Local generation (CogVideoX via diffusers)
# ---------------------------------------------------------------------------

async def _run_local_generation(job_id: str, req: VideoGenerateRequest) -> None:
    """Generate video locally using available models."""
    try:
        video_path = await asyncio.to_thread(
            _local_generate_sync, req.prompt, req.duration, req.width, req.height, job_id
        )
        if video_path:
            _jobs[job_id]["status"] = "completed"
            _jobs[job_id]["videoUrl"] = f"/generated/{os.path.basename(video_path)}"
        else:
            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = (
                "Local video generation requires diffusers and a compatible model. "
                "Install with: pip install diffusers[torch] imageio[ffmpeg]"
            )
    except Exception as e:
        logger.exception("Local video generation failed for job %s", job_id)
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = str(e)


def _local_generate_sync(
    prompt: str, duration: int, width: int, height: int, job_id: str
) -> str | None:
    """Synchronous local video generation via CogVideoX."""
    try:
        import torch
        from diffusers import CogVideoXPipeline
        from diffusers.utils import export_to_video

        pipe = CogVideoXPipeline.from_pretrained(
            "THUDM/CogVideoX-2b",
            torch_dtype=torch.float16,
        )
        pipe.enable_model_cpu_offload()

        num_frames = min(duration * 8, 49)

        video_frames = pipe(
            prompt=prompt,
            num_frames=num_frames,
            guidance_scale=6.0,
            num_inference_steps=50,
        ).frames[0]

        output_path = os.path.join(settings.GENERATED_DIR, f"video_{job_id}.mp4")
        export_to_video(video_frames, output_path, fps=8)
        return output_path

    except ImportError:
        logger.info("diffusers not installed — local video generation unavailable")
        return None
    except Exception as e:
        logger.exception("Local generation error: %s", e)
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _download_video(client, url: str, job_id: str) -> str:
    """Download a video from URL and save to generated dir."""
    resp = await client.get(url, timeout=60)
    resp.raise_for_status()

    filename = f"video_{job_id}.mp4"
    filepath = os.path.join(settings.GENERATED_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(resp.content)

    return f"/generated/{filename}"
