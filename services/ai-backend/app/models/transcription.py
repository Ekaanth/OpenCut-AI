"""Whisper transcription result models."""

from pydantic import BaseModel, Field


class TranscriptionWord(BaseModel):
    """Word-level timestamp from faster-whisper."""

    word: str
    start: float
    end: float
    probability: float = 0.0


class TranscriptionSegment(BaseModel):
    """A transcribed segment with optional word timings."""

    id: int
    text: str
    start: float
    end: float
    words: list[TranscriptionWord] = Field(default_factory=list)
    avg_logprob: float = 0.0
    no_speech_prob: float = 0.0
    speaker: str | None = None


class TranscriptionResult(BaseModel):
    """Full transcription output."""

    text: str = ""
    segments: list[TranscriptionSegment] = Field(default_factory=list)
    language: str = ""
    duration: float = 0.0
