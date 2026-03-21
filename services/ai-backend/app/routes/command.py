"""AI command processing route -- natural language to editor actions."""

import json
import logging

from fastapi import APIRouter, HTTPException

from app.models.command import CommandRequest, CommandResponse, EditorAction
from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/llm", tags=["command"])

COMMAND_SYSTEM_PROMPT = """\
You are an AI assistant for a video editor called OpenCut AI. The user gives you \
natural-language editing commands and you respond with a JSON object containing \
the actions to perform on the timeline.

Available action types:
- cut: Split a clip at a time point. params: {time: float}
- trim: Trim a clip's start/end. params: {start?: float, end?: float}
- delete: Delete a clip. params: {}
- split: Split a clip at a point. params: {time: float}
- add_text: Add a text overlay. params: {text: str, start: float, duration: float, \
position?: str, fontSize?: int, color?: str}
- add_transition: Add a transition between clips. params: {type: str, duration: float}
- adjust_speed: Change playback speed. params: {speed: float}
- adjust_volume: Change audio volume. params: {volume: float}
- move_clip: Move a clip to a new position. params: {to_track?: str, to_time?: float}
- add_effect: Apply a visual effect. params: {effect: str, intensity?: float}
- add_filter: Apply a color filter. params: {filter: str}
- color_correct: Adjust color properties. params: {brightness?: float, contrast?: float, \
saturation?: float, temperature?: float}
- add_keyframe: Add an animation keyframe. params: {property: str, value: float, time: float}
- fade_in: Add a fade-in. params: {duration: float}
- fade_out: Add a fade-out. params: {duration: float}
- mute: Mute a clip's audio. params: {}
- duplicate: Duplicate a clip. params: {}
- ripple_delete: Delete and close the gap. params: {}

Respond with ONLY a JSON object in this format:
{
  "actions": [{"type": "...", "target": "clip_id or null", "params": {...}}],
  "explanation": "Human-readable explanation of what will happen",
  "confidence": 0.0 to 1.0
}
"""


@router.post("/command", response_model=CommandResponse)
async def process_command(request: CommandRequest) -> CommandResponse:
    """Process a natural-language editing command.

    Takes a command string and optional timeline state, uses the LLM to
    interpret the command, and returns structured editor actions.
    """
    available = await ollama_service.check_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="Ollama server is not available. Please start Ollama first.",
        )

    # Build the prompt with timeline context
    prompt_parts = [f"User command: {request.command}"]
    if request.timeline_state:
        prompt_parts.append(
            f"\nCurrent timeline state:\n{json.dumps(request.timeline_state, indent=2)}"
        )

    prompt = "\n".join(prompt_parts)

    try:
        data = await ollama_service.generate_json(
            prompt=prompt,
            model=request.model,
            system=COMMAND_SYSTEM_PROMPT,
        )

        actions = [
            EditorAction(**a) for a in data.get("actions", [])
        ]

        return CommandResponse(
            actions=actions,
            explanation=data.get("explanation", ""),
            confidence=data.get("confidence", 0.5),
            raw_response=json.dumps(data),
        )

    except ValueError as e:
        logger.error("LLM returned invalid response: %s", e)
        raise HTTPException(
            status_code=502,
            detail="The LLM returned an invalid response. Try rephrasing your command.",
        )
    except Exception:
        logger.exception("Command processing failed")
        raise HTTPException(status_code=500, detail="Command processing failed.")
