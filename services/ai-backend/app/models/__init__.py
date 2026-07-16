"""Pydantic request/response models for the AI backend."""

from app.models.audio import TTSRequest
from app.models.command import CommandRequest, CommandResponse, EditorAction
from app.models.engagement import (
    AudioSyncScore,
    CuriosityScore,
    EmotionalArcScore,
    EngagementScore,
    EnhancementSuggestion,
    EnergyScore,
    FacePresenceScore,
    HookScore,
    JobStatus,
    ScoreBatchRequest,
    ScoreClipRequest,
    ScoredClip,
    ViralityScore,
    YouTubeVideoMeta,
)
from app.models.generation import EnhancePromptRequest, ImageGenParams, InfographicRequest
from app.models.transcription import (
    TranscriptionResult,
    TranscriptionSegment,
    TranscriptionWord,
)

__all__ = [
    "TTSRequest",
    "CommandRequest",
    "CommandResponse",
    "EditorAction",
    "AudioSyncScore",
    "CuriosityScore",
    "EmotionalArcScore",
    "EngagementScore",
    "EnhancementSuggestion",
    "EnergyScore",
    "FacePresenceScore",
    "HookScore",
    "JobStatus",
    "ScoreBatchRequest",
    "ScoreClipRequest",
    "ScoredClip",
    "ViralityScore",
    "YouTubeVideoMeta",
    "EnhancePromptRequest",
    "ImageGenParams",
    "InfographicRequest",
    "TranscriptionResult",
    "TranscriptionSegment",
    "TranscriptionWord",
]
