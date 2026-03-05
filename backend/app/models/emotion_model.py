from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SessionDocument(BaseModel):
    session_id: str
    user_id: str
    class_id: Optional[str] = None
    lesson_id: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    watch_time_sec: int = 0


class EmotionEventDocument(BaseModel):
    session_id: str
    modality: Literal["face", "text", "voice"]
    emotion_label: str
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: datetime
    extra: dict = Field(default_factory=dict)


class AttentionEventDocument(BaseModel):
    session_id: str
    state: Literal["focused", "tab_hidden", "idle", "no_face", "multi_face", "possible_distraction"]
    timestamp: datetime
    evidence: dict = Field(default_factory=dict)
