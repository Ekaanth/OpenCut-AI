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
    language: str = Field(default="en", max_length=10, description="Language code: en, es, fr, de, hi, zh, etc.")


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

def _compute_target_segments(duration: int) -> int:
    """How many segments we want for a given duration."""
    if duration <= 10:
        return 3
    if duration <= 20:
        return 4
    if duration <= 40:
        return 5
    return 6


def _pad_segments(
    parsed: list[dict], target_count: int, topic: str, style: str, audio_mood: str,
) -> list[dict]:
    """If the LLM returned fewer segments than needed, pad to fill the gap.

    Splits the last segment or adds filler segments so the template
    always has at least `target_count` entries.
    """
    while len(parsed) < target_count:
        idx = len(parsed)
        # Clone the last segment's duration and style, give it a generic label
        base = parsed[-1] if parsed else {}
        base_dur = base.get("duration", 3.0)
        parsed.append({
            "order": idx + 1,
            "duration": base_dur,
            "title": f"Continue: {topic}" if idx == len(parsed) - 1 else f"Segment {idx + 1}",
            "narration": base.get("narration", f"Continue talking about {topic}."),
            "visual_description": base.get("visual_description", "Continue with relevant visuals."),
            "key_message": base.get("key_message", topic),
            "audio_mood": base.get("audio_mood", audio_mood),
        })
    return parsed


LANGUAGE_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "pt": "Portuguese", "ja": "Japanese", "ko": "Korean", "zh": "Chinese",
    "hi": "Hindi", "ar": "Arabic", "it": "Italian", "ru": "Russian",
    "nl": "Dutch", "sv": "Swedish", "pl": "Polish", "tr": "Turkish",
    "th": "Thai", "vi": "Vietnamese", "id": "Indonesian", "ms": "Malay",
    "ta": "Tamil", "te": "Telugu", "bn": "Bengali", "ml": "Malayalam",
}


async def _run_template_generation(job_id: str, topic: str, duration: int, style: str, language: str = "en") -> None:
    """Run the LLM generation in the background and store the result."""
    audio_hints = STYLE_AUDIO_MAP.get(style, STYLE_AUDIO_MAP["engaging"])
    target_seg_count = _compute_target_segments(duration)
    lang_name = LANGUAGE_NAMES.get(language, "English")

    # Compact prompt — small models (1B-3B) work better with less text
    system_prompt = (
        "You are a short video content planner. "
        f"Write ALL content in {lang_name}. "
        "Respond ONLY with valid JSON. No explanation."
    )

    user_prompt = f"""Plan a {duration}-second {style} video about: {topic}

Return this JSON with {target_seg_count} segments totaling {duration} seconds:
{{"title":"catchy title about {topic}","background_audio_query":"{audio_hints['mood']} background music","segments":[{{"order":1,"start_time":0,"end_time":3,"duration":3,"title":"Hook","narration":"spoken voiceover text for this segment","visual_description":"describe the visual shot or scene to show","key_message":"the core idea of this segment","audio_mood":"{audio_hints['mood']}"}}]}}

Rules:
- Exactly {target_seg_count} segments, each 2-{min(duration, 10)} seconds
- Segment 1 = attention hook, last segment = call to action
- narration = what the voiceover says (full sentences)
- visual_description = what the camera shows (specific, filmable)
- key_message = the main point (short phrase)
- Write in {lang_name}"""

    try:
        data = await llm_backend.generate_json(
            prompt=user_prompt,
            system=system_prompt,
        )

        title = (data.get("title", "") or "").strip() or f"Reel: {topic}"
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

            seg_title = seg.get("title", "").strip() or f"Segment {i + 1}"
            seg_narration = seg.get("narration", "").strip()
            seg_visual = seg.get("visual_description", "").strip()
            seg_key = seg.get("key_message", "").strip()

            # Fill missing fields with sensible defaults based on what we have
            if not seg_narration:
                seg_narration = seg_key or f"Talking about {topic} - {seg_title}"
            if not seg_visual:
                seg_visual = f"Show visuals related to: {seg_title}"
            if not seg_key:
                seg_key = seg_title

            parsed.append({
                "order": i + 1,
                "duration": dur,
                "title": seg_title,
                "narration": seg_narration,
                "visual_description": seg_visual,
                "key_message": seg_key,
                "audio_mood": seg.get("audio_mood", "").strip() or audio_hints["mood"],
            })

        # Ensure we have enough segments — pad if LLM gave too few
        if len(parsed) < target_seg_count:
            logger.warning(
                "Template job %s: LLM returned %d segments, padding to %d",
                job_id, len(parsed), target_seg_count,
            )
            parsed = _pad_segments(parsed, target_seg_count, topic, style, audio_hints["mood"])

        # Scale durations to fit the requested total
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
        logger.info("Template job %s completed: %s (%d segments)", job_id, title, len(segments))

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
        _run_template_generation(job_id, request.topic, request.duration, request.style, request.language)
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
