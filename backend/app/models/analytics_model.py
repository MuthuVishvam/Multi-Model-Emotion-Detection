from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StudentEmotionHistory(BaseModel):
    student_id: str = Field(alias="studentId")
    lesson_id: str = Field(alias="lessonId")
    date: datetime
    session_duration: float = Field(alias="sessionDuration", default=0.0)
    face_emotion: str = Field(alias="faceEmotion", default="unknown")
    text_emotion: str = Field(alias="textEmotion", default="unknown")
    voice_emotion: str = Field(alias="voiceEmotion", default="unknown")
    attention: float = 0.0
    engagement: float = 0.0
    completion: float = 0.0
    transcript: str = ""
    emotion_timeline: list[dict] = Field(alias="emotionTimeline", default_factory=list)

    class Config:
        populate_by_name = True
