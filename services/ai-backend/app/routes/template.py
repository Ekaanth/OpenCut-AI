"""Instagram Reel template generation routes.

Uses LLM to generate structured content guides with timed segments
and audio suggestions. Generation runs as a background job so the
user can navigate away and come back to see results.
"""

import asyncio
import logging
import time
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.model_backend import llm_backend

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/template", tags=["template"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class TemplateGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    duration: int = Field(default=15, ge=5, le=60, description="Total duration in seconds")
    style: str = Field(default="engaging", description="Style: engaging, cinematic, educational, funny")


# ---------------------------------------------------------------------------
# In-memory job store (sufficient for single-user local editor)
# ---------------------------------------------------------------------------

_jobs: dict[str, dict] = {}
_MAX_JOBS = 50  # Evict oldest when exceeded


def _evict_old_jobs() -> None:
    """Remove oldest jobs if the store exceeds the limit."""
    if len(_jobs) <= _MAX_JOBS:
        return
    sorted_ids = sorted(_jobs, key=lambda k: _jobs[k].get("created_at", 0))
    for jid in sorted_ids[: len(_jobs) - _MAX_JOBS]:
        del _jobs[jid]


# ---------------------------------------------------------------------------
# Style → audio mapping
# ---------------------------------------------------------------------------

STYLE_AUDIO_MAP = {
    "engaging": {"mood": "upbeat and energetic", "tags": ["upbeat", "energetic", "ambient", "positive"]},
    "cinematic": {"mood": "epic and dramatic", "tags": ["cinematic", "epic", "dramatic", "ambient"]},
    "educational": {"mood": "calm and focused", "tags": ["calm", "ambient", "soft", "background"]},
    "funny": {"mood": "playful and lighthearted", "tags": ["comedy", "playful", "fun", "quirky"]},
}


# ---------------------------------------------------------------------------
# Background generation logic
# ---------------------------------------------------------------------------

async def _run_template_generation(job_id: str, topic: str, duration: int, style: str) -> None:
    """Run the LLM generation in the background and store the result."""
    audio_hints = STYLE_AUDIO_MAP.get(style, STYLE_AUDIO_MAP["engaging"])

    system_prompt = (
        "You are a professional Instagram Reels content creator and video production planner. "
        "You create detailed production guides for short-form videos. "
        "Your templates serve as content blueprints — they tell the creator what to film, "
        "what to say, and what mood to convey in each segment. "
        "You MUST respond with valid JSON only — no markdown, no explanation, no extra text. "
        "Never wrap the JSON in code fences."
    )

    user_prompt = f"""Create a production guide for an Instagram Reel about: "{topic}"

Total duration: {duration} seconds
Style: {style}

Return a JSON object with this exact structure:
{{
  "title": "catchy reel title",
  "background_audio_query": "a short search query to find suitable background audio on a sound library (e.g. 'upbeat ambient' or 'cinematic drone' or 'calm lo-fi')",
  "segments": [
    {{
      "order": 1,
      "start_time": 0,
      "end_time": 3,
      "duration": 3,
      "title": "short segment title",
      "narration": "the exact voiceover script for this segment — what the creator should say",
      "visual_description": "describe what should be shown on screen — filming direction, camera angle, scene description",
      "key_message": "the core idea or hook for this segment in 3-8 words",
      "audio_mood": "the audio energy for this segment (e.g. building, peak, calm, dramatic)"
    }}
  ]
}}

Rules:
- Split the {duration} seconds into 3-6 segments
- Each segment should be 2-5 seconds long
- Segments must cover the full duration with no gaps
- The first segment should hook the viewer immediately
- The last segment should have a clear call to action
- visual_description should be detailed filming/scene directions (camera angles, what to show)
- key_message is the core idea of each segment — NOT text to display on screen
- narration is the exact voiceover script the creator should record
- audio_mood describes the energy level and feel of background audio for that segment
- background_audio_query should be a concise search term for finding {audio_hints['mood']} background audio

Return ONLY the JSON object, nothing else."""

    try:
        data = await llm_backend.generate_json(
            prompt=user_prompt,
            system=system_prompt,
        )

        title = data.get("title", f"Reel: {topic}")
        raw_segments = data.get("segments", [])
        audio_query = data.get("background_audio_query", f"{style} ambient background")

        if not raw_segments:
            raise ValueError("LLM returned no segments")

        parsed: list[dict] = []
        for i, seg in enumerate(raw_segments):
            dur = float(seg.get("duration", 0))
            if dur <= 0:
                st = float(seg.get("start_time", 0))
                et = float(seg.get("end_time", 0))
                dur = max(et - st, 2.0)
            parsed.append({
                "order": i + 1,
                "duration": dur,
                "title": seg.get("title", f"Segment {i + 1}"),
                "narration": seg.get("narration", ""),
                "visual_description": seg.get("visual_description", ""),
                "key_message": seg.get("key_message", ""),
                "audio_mood": seg.get("audio_mood", audio_hints["mood"]),
            })

        total_raw = sum(s["duration"] for s in parsed)
        scale = duration / total_raw if total_raw > 0 else 1.0

        segments: list[dict] = []
        cursor = 0.0
        for s in parsed:
            seg_dur = round(s["duration"] * scale, 1)
            segments.append({
                "order": s["order"],
                "start_time": round(cursor, 1),
                "end_time": round(cursor + seg_dur, 1),
                "duration": seg_dur,
                "title": s["title"],
                "narration": s["narration"],
                "visual_description": s["visual_description"],
                "key_message": s["key_message"],
                "audio_mood": s["audio_mood"],
            })
            cursor += seg_dur

        result = {
            "topic": topic,
            "total_duration": duration,
            "style": style,
            "title": title,
            "segments": segments,
            "background_audio": {
                "query": audio_query,
                "mood": audio_hints["mood"],
                "tags": audio_hints["tags"],
            },
        }

        _jobs[job_id]["status"] = "completed"
        _jobs[job_id]["result"] = result
        _jobs[job_id]["completed_at"] = time.time()
        logger.info("Template job %s completed: %s", job_id, title)

    except Exception as e:
        logger.exception("Template job %s failed", job_id)
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = str(e)
        _jobs[job_id]["completed_at"] = time.time()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/generate")
async def generate_template(request: TemplateGenerateRequest):
    """Start a background template generation job.

    Returns a job_id immediately. Poll /api/template/jobs/{job_id}
    to check status and retrieve the result.
    """
    available = await llm_backend.check_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not available. Start Ollama and pull a model first.",
        )

    _evict_old_jobs()

    job_id = uuid.uuid4().hex[:12]
    _jobs[job_id] = {
        "status": "running",
        "topic": request.topic,
        "duration": request.duration,
        "style": request.style,
        "created_at": time.time(),
        "result": None,
        "error": None,
    }

    asyncio.create_task(
        _run_template_generation(job_id, request.topic, request.duration, request.style)
    )

    return {"job_id": job_id, "status": "running"}


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the status and result of a template generation job."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response: dict = {
        "job_id": job_id,
        "status": job["status"],
        "topic": job["topic"],
        "duration": job["duration"],
        "style": job["style"],
    }

    if job["status"] == "completed":
        response["result"] = job["result"]
    elif job["status"] == "failed":
        response["error"] = job["error"]

    return response


@router.get("/jobs")
async def list_jobs():
    """List all template generation jobs (most recent first)."""
    jobs = []
    for jid, job in sorted(_jobs.items(), key=lambda x: x[1].get("created_at", 0), reverse=True):
        entry: dict = {
            "job_id": jid,
            "status": job["status"],
            "topic": job["topic"],
            "style": job["style"],
            "created_at": job.get("created_at"),
        }
        if job["status"] == "completed" and job.get("result"):
            entry["title"] = job["result"].get("title", "")
        jobs.append(entry)
    return {"jobs": jobs}
