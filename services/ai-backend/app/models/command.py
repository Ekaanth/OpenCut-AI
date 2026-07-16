"""LLM command panel request/response models."""

from pydantic import BaseModel, ConfigDict, Field


class EditorAction(BaseModel):
    """A single structured editor action produced by the LLM."""

    type: str
    target: str | None = None
    params: dict = Field(default_factory=dict)
    description: str = ""


class CommandRequest(BaseModel):
    """Natural-language editing command from the frontend."""

    model_config = ConfigDict(populate_by_name=True)

    command: str
    timeline_state: dict | None = Field(default=None, alias="timelineState")
    model: str | None = None


class CommandResponse(BaseModel):
    """Structured response for an interpreted editing command."""

    actions: list[EditorAction] = Field(default_factory=list)
    explanation: str = ""
    confidence: float = 0.5
    raw_response: str | None = None
    needs_clarification: bool = False
    clarification_question: str | None = None
