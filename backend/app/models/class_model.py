from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ClassDocument(BaseModel):
    class_id: str
    title: str
    section: Optional[str] = None
    teacher_id: str
    join_code: str
    created_at: Optional[datetime] = None


class EnrollmentDocument(BaseModel):
    class_id: str
    student_id: str
    status: str = "joined"
    joined_at: Optional[datetime] = None
