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


class EmotionPredictRequest(BaseModel):
    session_id: str
    student_id: str
    text: str


class EmotionPredictResponse(BaseModel):
    emotion: str
    scores: dict[str, float]
    timestamp: datetime


class StudentStat(BaseModel):
    student_id: str
    top_emotion: str
    engagement_score: float


class DashboardSummaryResponse(BaseModel):
    session_id: str
    emotion_counts: dict[str, int]
    emotion_percentages: dict[str, float]
    engagement_score: float
    confusion_index: float
    timeline_buckets: dict[str, int]
    student_stats: list[StudentStat] = Field(default_factory=list)


class StudentDashboardResponse(BaseModel):
    session_id: str
    student_id: str
    timeline: dict[str, int]
    emotion_distribution: dict[str, int]
