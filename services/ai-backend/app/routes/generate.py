"""Generation routes -- image generation, prompt enhancement, infographics, bg removal.

Image generation and background removal are proxied to the image-service
microservice. Prompt enhancement and infographic generation remain local.
"""

import logging
import os
import uuid

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from app.config import settings
from app.services.stream_utils import streamed_llm_response
from app.models.generation import EnhancePromptRequest, ImageGenParams, InfographicRequest
from app.services.model_backend import llm_backend

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/generate", tags=["generation"])


@router.post("/image")
async def generate_image(params: ImageGenParams):
    """Generate an image from a text prompt.

    Proxies to the image-service at IMAGE_SERVICE_URL.
    """
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{settings.IMAGE_SERVICE_URL}/generate",
                json=params.model_dump(),
            )
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            if "image" in content_type:
                return Response(
                    content=resp.content,
                    media_type=content_type,
                    headers={
                        "Content-Disposition": f'attachment; filename="generated_{uuid.uuid4().hex[:8]}.png"'
                    },
                )
            return resp.json()
    except httpx.HTTPStatusError as e:
        try:
            detail = e.response.json().get("detail", e.response.text)
        except Exception:
            detail = e.response.text
        raise HTTPException(status_code=e.response.status_code, detail=detail)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Image service is not available. Ensure image-service is running on "
            f"{settings.IMAGE_SERVICE_URL}",
        )
    except Exception:
        logger.exception("Image generation proxy failed")
        raise HTTPException(status_code=500, detail="Image generation failed.")


@router.post("/enhance-prompt")
async def enhance_prompt(request: EnhancePromptRequest):
    """Enhance a short prompt into a detailed image generation prompt using the LLM.

    Streams keepalive pings to prevent timeouts.
    """
    available = await llm_backend.check_available()
    if not available:
        raise HTTPException(status_code=503, detail="Ollama is not available.")

    system = (
        "You are an expert at writing detailed image generation prompts for "
        "Stable Diffusion. Given a short description and a style, expand it into "
        "a detailed, descriptive prompt that will produce high-quality results. "
        "Include details about lighting, composition, style, and atmosphere. "
        "Respond with only the enhanced prompt text, no explanations."
    )

    async def _work():
        enhanced = await llm_backend.generate(
            prompt=f"Style: {request.style}\nOriginal prompt: {request.prompt}",
            system=system,
        )
        return {
            "original": request.prompt,
            "enhanced": enhanced.strip(),
            "style": request.style,
        }

    return streamed_llm_response(_work, error_detail="Prompt enhancement failed.")


@router.post("/infographic")
async def generate_infographic(request: InfographicRequest) -> FileResponse:
    """Generate an infographic overlay image.

    Creates a PNG with transparent background containing data visualization
    that can be overlaid on video. This remains local (uses Pillow only).
    """
    try:
        from PIL import Image, ImageDraw, ImageFont

        img = Image.new("RGBA", (request.width, request.height), request.background_color)
        draw = ImageDraw.Draw(img)

        try:
            font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
            font_body = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
        except (IOError, OSError):
            font_title = ImageFont.load_default()
            font_body = ImageFont.load_default()

        title_bbox = draw.textbbox((0, 0), request.topic, font=font_title)
        title_width = title_bbox[2] - title_bbox[0]
        draw.text(
            ((request.width - title_width) // 2, 40),
            request.topic,
            fill="white",
            font=font_title,
        )

        y_offset = 140
        for item in request.data_points:
            label = str(item.get("label", item.get("key", "")))
            value = str(item.get("value", ""))
            line = f"{label}: {value}"
            draw.text((60, y_offset), line, fill="white", font=font_body)
            y_offset += 50

        output_path = os.path.join(
            settings.GENERATED_DIR, f"infographic_{uuid.uuid4().hex[:8]}.png"
        )
        img.save(output_path, "PNG")

        return FileResponse(
            path=output_path,
            media_type="image/png",
            filename="infographic.png",
        )

    except ImportError:
        raise HTTPException(
            status_code=501, detail="Pillow is required for infographic generation."
        )
    except Exception:
        logger.exception("Infographic generation failed")
        raise HTTPException(status_code=500, detail="Infographic generation failed.")


@router.post("/remove-bg")
async def remove_bg(file: UploadFile = File(...)):
    """Remove the background from an uploaded image.

    Proxies to the image-service at IMAGE_SERVICE_URL.
    """
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            files = {"file": (file.filename, await file.read(), file.content_type)}
            resp = await client.post(
                f"{settings.IMAGE_SERVICE_URL}/remove-bg",
                files=files,
            )
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            if "image" in content_type:
                return Response(
                    content=resp.content,
                    media_type=content_type,
                    headers={
                        "Content-Disposition": f'attachment; filename="nobg_{uuid.uuid4().hex[:8]}.png"'
                    },
                )
            return resp.json()
    except httpx.HTTPStatusError as e:
        try:
            detail = e.response.json().get("detail", e.response.text)
        except Exception:
            detail = e.response.text
        raise HTTPException(status_code=e.response.status_code, detail=detail)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Image service is not available. Ensure image-service is running on "
            f"{settings.IMAGE_SERVICE_URL}",
        )
    except Exception:
        logger.exception("Background removal proxy failed")
        raise HTTPException(status_code=500, detail="Background removal failed.")
