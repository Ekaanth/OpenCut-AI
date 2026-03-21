"""WebSocket route for streaming transcription with progress updates.

Proxies the actual transcription to the whisper-service microservice.
"""

import json
import logging
import os
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.services.audio_service import extract_audio

logger = logging.getLogger(__name__)

router = APIRouter(tags=["transcription-ws"])

ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac",
    ".mp4", ".mkv", ".avi", ".mov", ".webm",
}
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"}


@router.websocket("/ws/transcribe")
async def ws_transcribe(websocket: WebSocket) -> None:
    """WebSocket endpoint for streaming transcription.

    Protocol:
    1. Client connects and sends a JSON message with:
       {"filename": "video.mp4", "language": "en"}  (language is optional)
    2. Client sends the raw file bytes as a binary message.
    3. Server streams back JSON messages:
       - {"type": "progress", "message": "...", "percent": 0-100}
       - {"type": "segment", "data": {...}}  (each segment as it's produced)
       - {"type": "complete", "data": {...}}  (full result)
       - {"type": "error", "message": "..."}
    """
    await websocket.accept()

    upload_path: str | None = None

    try:
        # 1. Receive metadata
        meta_raw = await websocket.receive_text()
        meta = json.loads(meta_raw)
        filename = meta.get("filename", "unknown.wav")
        language = meta.get("language")

        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            await websocket.send_json(
                {"type": "error", "message": f"Unsupported file type: {ext}"}
            )
            await websocket.close()
            return

        await websocket.send_json(
            {"type": "progress", "message": "Receiving file...", "percent": 5}
        )

        # 2. Receive file data
        file_data = await websocket.receive_bytes()
        if len(file_data) > settings.MAX_UPLOAD_SIZE:
            await websocket.send_json(
                {"type": "error", "message": "File too large."}
            )
            await websocket.close()
            return

        upload_id = uuid.uuid4().hex[:8]
        upload_path = os.path.join(settings.UPLOAD_DIR, f"ws_upload_{upload_id}{ext}")
        with open(upload_path, "wb") as f:
            f.write(file_data)

        await websocket.send_json(
            {"type": "progress", "message": "File received.", "percent": 15}
        )

        # 3. Extract audio if video
        if ext in VIDEO_EXTENSIONS:
            await websocket.send_json(
                {"type": "progress", "message": "Extracting audio...", "percent": 20}
            )
            audio_path = await extract_audio(upload_path)
        else:
            audio_path = upload_path

        # 4. Send to whisper-service for transcription
        await websocket.send_json(
            {"type": "progress", "message": "Sending to transcription service...", "percent": 30}
        )

        try:
            async with httpx.AsyncClient(timeout=300) as client:
                with open(audio_path, "rb") as af:
                    files = {"file": (os.path.basename(audio_path), af, "audio/wav")}
                    data = {}
                    if language:
                        data["language"] = language
                    resp = await client.post(
                        f"{settings.WHISPER_SERVICE_URL}/transcribe",
                        files=files,
                        data=data,
                    )
                    resp.raise_for_status()
                    result = resp.json()
        except httpx.ConnectError:
            await websocket.send_json(
                {"type": "error", "message": f"Whisper service not available at {settings.WHISPER_SERVICE_URL}. Start it with: docker compose up -d whisper-service"}
            )
            return
        except httpx.HTTPStatusError as e:
            await websocket.send_json(
                {"type": "error", "message": f"Transcription failed: {e.response.text}"}
            )
            return

        await websocket.send_json(
            {"type": "progress", "message": "Transcribing...", "percent": 40}
        )

        # 5. Stream segments from result
        segments = result.get("segments", [])
        total = len(segments)
        for i, seg in enumerate(segments):
            percent = 40 + int((i / max(total, 1)) * 55)
            await websocket.send_json(
                {"type": "segment", "data": seg, "percent": percent}
            )

        # 6. Send complete result
        await websocket.send_json(
            {"type": "complete", "data": result, "percent": 100}
        )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected during transcription.")
    except json.JSONDecodeError:
        await websocket.send_json(
            {"type": "error", "message": "Invalid JSON metadata."}
        )
    except Exception as e:
        logger.exception("WebSocket transcription error")
        try:
            await websocket.send_json(
                {"type": "error", "message": str(e)}
            )
        except Exception:
            pass
    finally:
        if upload_path and os.path.exists(upload_path):
            os.remove(upload_path)
