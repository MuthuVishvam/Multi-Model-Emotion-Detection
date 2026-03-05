from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class LessonDocument(BaseModel):
    lesson_id: str
    teacher_id: str
    course_id: str
    title: str
    video_url: Optional[str] = None
    duration: int = 0
    created_at: Optional[datetime] = None


class LessonAssignmentDocument(BaseModel):
    lesson_id: str
    class_id: str
    publish_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
