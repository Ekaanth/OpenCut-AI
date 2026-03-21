"""Background removal service.

Uses the rembg library (or a manual U2-Net approach) to remove backgrounds
from images. Useful for creating transparent overlays in the video editor.

To enable:
  pip install rembg[gpu]   # GPU-accelerated
  pip install rembg         # CPU-only

If rembg is not installed, falls back to a simple Pillow-based chroma key stub.
"""

import asyncio
import logging
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


async def remove_background(input_path: str) -> str:
    """Remove the background from an image file.

    Args:
        input_path: Path to the input image (PNG, JPG, etc.).

    Returns:
        Path to the output PNG with transparent background.
    """
    if not Path(input_path).exists():
        raise FileNotFoundError(f"Image file not found: {input_path}")

    output_path = str(
        Path(settings.GENERATED_DIR) / f"nobg_{uuid.uuid4().hex[:8]}.png"
    )

    def _remove_bg_sync() -> None:
        try:
            from rembg import remove
            from PIL import Image

            input_image = Image.open(input_path)
            output_image = remove(input_image)
            output_image.save(output_path, "PNG")
            logger.info("Background removed using rembg.")
        except ImportError:
            # Fallback: convert to RGBA and make white-ish pixels transparent
            # This is a very basic stub -- install rembg for proper results
            from PIL import Image

            logger.warning(
                "rembg not installed, using basic white-background removal fallback. "
                "Install rembg for production-quality results: pip install rembg"
            )
            img = Image.open(input_path).convert("RGBA")
            data = img.getdata()
            new_data = []
            for r, g, b, a in data:
                # Simple threshold: treat near-white as background
                if r > 220 and g > 220 and b > 220:
                    new_data.append((r, g, b, 0))
                else:
                    new_data.append((r, g, b, a))
            img.putdata(new_data)
            img.save(output_path, "PNG")

    logger.info("Removing background from '%s'...", input_path)
    await asyncio.to_thread(_remove_bg_sync)
    logger.info("Background removed: %s", output_path)
    return output_path
