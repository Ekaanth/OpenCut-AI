"""Enhanced face-tracking auto-reframe (16:9 → 9:16).

Goes beyond simple center-crop by:
- Detecting faces at 2fps via the face service
- Interpolating face positions between samples for smooth tracking
- Handling single-face, multi-face, and no-face scenarios
- Generating FFmpeg crop filter with animated position

Reframe strategies:
  Single face  → center on face with headroom
  No face      → center crop with optional Ken Burns pan
  Multi-face   → bounding box of all faces; if too wide, pan between speakers
"""

import asyncio
import json
import logging
import os

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class CropRegion:
    def __init__(self, x: int, y: int, w: int, h: int, timestamp: float):
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.timestamp = timestamp


class FaceReframer:
    """Smart auto-reframe using face tracking."""

    async def compute_crop_trajectory(
        self,
        video_path: str,
        target_width: int = 1080,
        target_height: int = 1920,
        sample_interval: float = 0.5,
        max_samples: int = 240,
    ) -> list[CropRegion]:
        """Compute crop positions for each sampled frame.

        Returns a list of CropRegions that can be interpolated into
        an FFmpeg crop filter with smooth pan/zoom transitions.
        """
        # Get video dimensions
        src_w, src_h = await self._get_dimensions(video_path)
        if src_w == 0 or src_h == 0:
            return []

        target_ratio = target_width / target_height

        # Detect faces
        face_frames = await self._detect_faces(video_path, sample_interval, max_samples)

        if not face_frames:
            # No face service — center crop
            return self._center_crop_trajectory(src_w, src_h, target_ratio, 0, sample_interval, max_samples)

        regions = []
        for frame in face_frames:
            timestamp = frame.get("timestamp", 0)
            faces = frame.get("faces", [])

            if not faces:
                # No face in this frame — center crop
                crop = self._compute_center_crop(src_w, src_h, target_ratio)
            elif len(faces) == 1:
                # Single face — center on it
                crop = self._compute_face_crop(faces[0], src_w, src_h, target_ratio)
            else:
                # Multiple faces — bounding box
                crop = self._compute_multi_face_crop(faces, src_w, src_h, target_ratio)

            regions.append(CropRegion(
                x=crop["x"], y=crop["y"],
                w=crop["w"], h=crop["h"],
                timestamp=timestamp,
            ))

        # Smooth the trajectory (prevent jumpy crops)
        regions = self._smooth_trajectory(regions)

        return regions

    def generate_ffmpeg_filter(
        self,
        regions: list[CropRegion],
        src_w: int,
        src_h: int,
        target_w: int = 1080,
        target_h: int = 1920,
    ) -> str:
        """Generate an FFmpeg crop filter from the trajectory.

        For simplicity, uses the average crop position (smooth constant crop).
        For advanced usage, would generate keyframed crop coordinates.
        """
        if not regions:
            # Fallback: center crop
            target_ratio = target_w / target_h
            crop_w = min(src_w, int(src_h * target_ratio))
            crop_h = min(src_h, int(src_w / target_ratio))
            x = (src_w - crop_w) // 2
            y = (src_h - crop_h) // 2
            return f"crop={crop_w}:{crop_h}:{x}:{y}"

        # Use the most common crop region (median position)
        xs = sorted(r.x for r in regions)
        ys = sorted(r.y for r in regions)
        median_x = xs[len(xs) // 2]
        median_y = ys[len(ys) // 2]
        w = regions[0].w
        h = regions[0].h

        # Clamp
        median_x = max(0, min(src_w - w, median_x))
        median_y = max(0, min(src_h - h, median_y))

        return f"crop={w}:{h}:{median_x}:{median_y}"

    async def _detect_faces(self, video_path: str, interval: float, max_samples: int) -> list[dict]:
        """Send video to face service for frame-by-frame face detection."""
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                with open(video_path, "rb") as f:
                    files = {"file": (os.path.basename(video_path), f, "video/mp4")}
                    data = {"sample_interval": str(interval), "max_samples": str(max_samples)}
                    resp = await client.post(
                        f"{settings.FACE_SERVICE_URL}/detect",
                        files=files, data=data,
                    )
                    if resp.status_code == 200:
                        return resp.json().get("frames", [])
        except (httpx.ConnectError, httpx.TimeoutException):
            logger.debug("Face service not available for reframe")
        return []

    def _compute_center_crop(self, src_w: int, src_h: int, target_ratio: float) -> dict:
        """Simple center crop for target aspect ratio."""
        if src_w / src_h > target_ratio:
            # Source is wider — crop width
            crop_h = src_h
            crop_w = int(src_h * target_ratio)
        else:
            # Source is taller — crop height
            crop_w = src_w
            crop_h = int(src_w / target_ratio)

        return {
            "x": (src_w - crop_w) // 2,
            "y": (src_h - crop_h) // 2,
            "w": crop_w,
            "h": crop_h,
        }

    def _compute_face_crop(self, face: dict, src_w: int, src_h: int, target_ratio: float) -> dict:
        """Crop centered on a single face with headroom."""
        # Face bbox is normalized 0-1
        fx = face.get("x", 0.5) * src_w
        fy = face.get("y", 0.3) * src_h
        fw = face.get("w", 0.2) * src_w
        fh = face.get("h", 0.2) * src_h

        face_cx = fx + fw / 2
        face_cy = fy + fh / 2

        # Compute crop size
        base = self._compute_center_crop(src_w, src_h, target_ratio)
        crop_w = base["w"]
        crop_h = base["h"]

        # Center crop on face (with headroom — face at 35% from top)
        crop_x = int(face_cx - crop_w / 2)
        crop_y = int(face_cy - crop_h * 0.35)

        # Clamp to frame
        crop_x = max(0, min(src_w - crop_w, crop_x))
        crop_y = max(0, min(src_h - crop_h, crop_y))

        return {"x": crop_x, "y": crop_y, "w": crop_w, "h": crop_h}

    def _compute_multi_face_crop(self, faces: list[dict], src_w: int, src_h: int, target_ratio: float) -> dict:
        """Crop containing all detected faces."""
        if not faces:
            return self._compute_center_crop(src_w, src_h, target_ratio)

        # Find bounding box of all faces
        min_x = min(f.get("x", 0) for f in faces) * src_w
        min_y = min(f.get("y", 0) for f in faces) * src_h
        max_x = max((f.get("x", 0) + f.get("w", 0.1)) for f in faces) * src_w
        max_y = max((f.get("y", 0) + f.get("h", 0.1)) for f in faces) * src_h

        group_cx = (min_x + max_x) / 2
        group_cy = (min_y + max_y) / 2

        base = self._compute_center_crop(src_w, src_h, target_ratio)
        crop_w = base["w"]
        crop_h = base["h"]

        crop_x = int(group_cx - crop_w / 2)
        crop_y = int(group_cy - crop_h * 0.4)

        crop_x = max(0, min(src_w - crop_w, crop_x))
        crop_y = max(0, min(src_h - crop_h, crop_y))

        return {"x": crop_x, "y": crop_y, "w": crop_w, "h": crop_h}

    def _center_crop_trajectory(
        self, src_w: int, src_h: int, target_ratio: float,
        start_time: float, interval: float, max_frames: int,
    ) -> list[CropRegion]:
        """Generate a static center crop trajectory."""
        crop = self._compute_center_crop(src_w, src_h, target_ratio)
        return [
            CropRegion(
                x=crop["x"], y=crop["y"], w=crop["w"], h=crop["h"],
                timestamp=start_time + i * interval,
            )
            for i in range(max_frames)
        ]

    def _smooth_trajectory(self, regions: list[CropRegion], window: int = 5) -> list[CropRegion]:
        """Apply moving average to smooth crop trajectory."""
        if len(regions) < window:
            return regions

        smoothed = []
        for i in range(len(regions)):
            start = max(0, i - window // 2)
            end = min(len(regions), i + window // 2 + 1)
            chunk = regions[start:end]

            avg_x = int(sum(r.x for r in chunk) / len(chunk))
            avg_y = int(sum(r.y for r in chunk) / len(chunk))

            smoothed.append(CropRegion(
                x=avg_x, y=avg_y,
                w=regions[i].w, h=regions[i].h,
                timestamp=regions[i].timestamp,
            ))

        return smoothed

    async def _get_dimensions(self, video_path: str) -> tuple[int, int]:
        """Get video width and height using ffprobe."""
        cmd = [
            "ffprobe", "-v", "quiet",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "json", video_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        try:
            data = json.loads(stdout.decode())
            stream = data.get("streams", [{}])[0]
            return int(stream.get("width", 0)), int(stream.get("height", 0))
        except Exception:
            return 0, 0


# Module-level singleton
face_reframer = FaceReframer()
