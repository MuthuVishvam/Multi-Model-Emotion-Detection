from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserRegister(BaseModel):
    email: str
    password: str
    role: str = "student"


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SessionStartRequest(BaseModel):
    session_name: str
    course: Optional[str] = None


class SessionStartResponse(BaseModel):
    id: str
    session_name: str
    course: Optional[str] = None
    started_by: str
    created_at: datetime


class EmotionLogRequest(BaseModel):
    user_id: str
    text: str = ""
    emotion: str = "neutral"
    probabilities: dict[str, float] = Field(default_factory=dict)


class DashboardSummaryResponse(BaseModel):
    session_id: str
    total_logs: int
    emotion_distribution: dict[str, int]
