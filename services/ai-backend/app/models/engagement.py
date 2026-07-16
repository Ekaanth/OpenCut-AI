"""Engagement scoring, YouTube ingest, and clip models."""

from pydantic import BaseModel, Field, computed_field


# ── Sub-scores ────────────────────────────────────────────────────────


class HookScore(BaseModel):
    """Hook strength of the first ~3 seconds."""

    visual_novelty: float = 0.0
    audio_energy_spike: float = 0.0
    early_face_present: bool = False
    hook_type: str = "neutral"
    hook_type_confidence: float = 0.0
    speech_rate: float = 0.0
    composite: float = 50.0


class CuriosityScore(BaseModel):
    """Curiosity-gap signals in the transcript."""

    has_question: bool = False
    has_bold_claim: bool = False
    has_open_loop: bool = False
    gap_count: int = 0
    composite: float = 50.0


class EnergyScore(BaseModel):
    """Audio energy dynamics."""

    mean_energy: float = 0.0
    peak_energy: float = 0.0
    energy_variance: float = 0.0
    has_dynamic_range: bool = False
    composite: float = 50.0


class AudioSyncScore(BaseModel):
    """Beat / caption sync quality."""

    bpm: float | None = None
    beat_count: int = 0
    caption_beat_alignment: float = 0.0
    composite: float = 50.0


class FacePresenceScore(BaseModel):
    """Face presence ratio vs optimal 30–40% target."""

    face_ratio: float = 0.0
    is_optimal: bool = False
    early_face_present: bool = False
    composite: float = 50.0


class EmotionalArcScore(BaseModel):
    """Emotional arc / pacing structure."""

    has_strong_open: bool = False
    has_buildup: bool = False
    has_peak: bool = False
    peak_timestamp: float = 0.0
    dominant_emotion: str = "calm"
    composite: float = 50.0


class ViralityScore(BaseModel):
    """LLM-predicted viral potential."""

    hook_strength: int = 0
    shareability: int = 0
    emotional_impact: int = 0
    standalone_value: int = 0
    reason: str = ""
    suggested_title: str = ""
    composite: float = 50.0


class EnhancementSuggestion(BaseModel):
    """Actionable improvement suggestion for a weak engagement signal."""

    signal: str
    current_score: float
    suggestion: str
    action_type: str = "manual"
    expected_impact: str = "medium"


# ── Aggregate score ───────────────────────────────────────────────────


def _grade_for_score(composite: float) -> tuple[str, str]:
    """Map a 0–100 composite score to (grade letter, label)."""
    if composite >= 85:
        return "A", "Excellent"
    if composite >= 70:
        return "B", "Strong"
    if composite >= 50:
        return "C", "Average"
    if composite >= 35:
        return "D", "Below average"
    return "F", "Needs work"


class EngagementScore(BaseModel):
    """Full engagement breakdown with composite score and suggestions."""

    hook: HookScore = Field(default_factory=HookScore)
    curiosity: CuriosityScore = Field(default_factory=CuriosityScore)
    energy: EnergyScore = Field(default_factory=EnergyScore)
    audio_sync: AudioSyncScore = Field(default_factory=AudioSyncScore)
    face_presence: FacePresenceScore = Field(default_factory=FacePresenceScore)
    emotional_arc: EmotionalArcScore = Field(default_factory=EmotionalArcScore)
    virality: ViralityScore = Field(default_factory=ViralityScore)
    suggestions: list[EnhancementSuggestion] = Field(default_factory=list)

    def compute_composite(self) -> float:
        """Weighted composite using configured engagement weights."""
        from app.config import settings

        return (
            self.hook.composite * settings.ENGAGEMENT_HOOK_WEIGHT
            + self.curiosity.composite * settings.ENGAGEMENT_CURIOSITY_WEIGHT
            + self.virality.composite * settings.ENGAGEMENT_VIRALITY_WEIGHT
            + self.energy.composite * settings.ENGAGEMENT_ENERGY_WEIGHT
            + self.emotional_arc.composite * settings.ENGAGEMENT_EMOTION_WEIGHT
            + self.audio_sync.composite * settings.ENGAGEMENT_AUDIO_SYNC_WEIGHT
            + self.face_presence.composite * settings.ENGAGEMENT_FACE_WEIGHT
        )

    def to_response(self) -> dict:
        """Serialize to the API shape expected by the web client."""
        composite = round(min(100.0, max(0.0, self.compute_composite())), 1)
        grade, grade_label = _grade_for_score(composite)
        return {
            "hook": self.hook.model_dump(),
            "curiosity": self.curiosity.model_dump(),
            "energy": self.energy.model_dump(),
            "audio_sync": self.audio_sync.model_dump(),
            "face_presence": self.face_presence.model_dump(),
            "emotional_arc": self.emotional_arc.model_dump(),
            "virality": self.virality.model_dump(),
            "suggestions": [s.model_dump() for s in self.suggestions],
            "composite": composite,
            "grade": grade,
            "grade_label": grade_label,
        }

    @property
    def composite(self) -> float:
        return self.compute_composite()


# ── Request models ────────────────────────────────────────────────────


class ScoreClipRequest(BaseModel):
    """Score a single clip from transcript / audio / video paths."""

    audio_path: str | None = None
    video_path: str | None = None
    transcript_text: str = ""
    transcript_segments: list[dict] | None = None
    start: float = 0.0
    end: float = 0.0
    title: str | None = None


class ScoreBatchRequest(BaseModel):
    """Batch scoring request for multiple clips."""

    clips: list[ScoreClipRequest] = Field(default_factory=list)


class ScoredClip(BaseModel):
    """A detected clip with engagement score attached."""

    index: int = 0
    title: str = ""
    start: float = 0.0
    end: float = 0.0
    transcript_preview: str = ""
    tags: list[str] = Field(default_factory=list)
    engagement: EngagementScore = Field(default_factory=EngagementScore)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


# ── YouTube / jobs ────────────────────────────────────────────────────


class YouTubeVideoMeta(BaseModel):
    """Metadata for an ingested YouTube video."""

    video_id: str
    title: str = "Untitled"
    channel_name: str = "Unknown"
    channel_id: str = ""
    duration_seconds: int = 0
    thumbnail_url: str = ""
    upload_date: str = ""
    view_count: int | None = None
    is_live: bool = False
    is_private: bool = False
    warning: str | None = None


class JobStatus(BaseModel):
    """Background job status for YouTube / clip pipelines."""

    job_id: str
    status: str = "pending"
    progress: float = 0.0
    message: str = ""
    result: dict | None = None
    error: str | None = None
