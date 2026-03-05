from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserCreate(BaseModel):
    userId: Optional[str] = None
    email: EmailStr
    passwordHash: str
    role: Literal["student", "teacher", "admin"] = "student"
    isActive: bool = True
    profile: dict[str, Any] = Field(default_factory=dict)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    passwordHash: Optional[str] = None
    role: Optional[Literal["student", "teacher", "admin"]] = None
    isActive: Optional[bool] = None
    profile: Optional[dict[str, Any]] = None


class UserDocument(BaseModel):
    userId: str
    email: EmailStr
    passwordHash: str
    role: Literal["student", "teacher", "admin"] = "student"
    isActive: bool = True
    profile: dict[str, Any] = Field(default_factory=dict)
    createdAt: datetime = Field(default_factory=utc_now)
    updatedAt: datetime = Field(default_factory=utc_now)


class CourseCreate(BaseModel):
    courseId: Optional[str] = None
    title: str
    description: str = ""
    category: str = "General"
    createdBy: str
    isPublished: bool = True


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    isPublished: Optional[bool] = None


class CourseDocument(BaseModel):
    courseId: str
    title: str
    description: str = ""
    category: str = "General"
    createdBy: str
    isPublished: bool = True
    createdAt: datetime = Field(default_factory=utc_now)
    updatedAt: datetime = Field(default_factory=utc_now)


class LessonCreateDocument(BaseModel):
    lessonId: Optional[str] = None
    courseId: str
    title: str
    description: str = ""
    content: str = ""
    orderIndex: int = 0
    createdBy: str


class LessonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    orderIndex: Optional[int] = None


class LessonDocument(BaseModel):
    lessonId: str
    courseId: str
    title: str
    description: str = ""
    content: str = ""
    orderIndex: int = 0
    createdBy: str
    createdAt: datetime = Field(default_factory=utc_now)
    updatedAt: datetime = Field(default_factory=utc_now)


class EnrollmentCreate(BaseModel):
    enrollmentId: Optional[str] = None
    userId: str
    courseId: str
    status: Literal["active", "completed", "dropped"] = "active"


class EnrollmentUpdate(BaseModel):
    status: Optional[Literal["active", "completed", "dropped"]] = None


class EnrollmentDocument(BaseModel):
    enrollmentId: str
    userId: str
    courseId: str
    status: Literal["active", "completed", "dropped"] = "active"
    enrolledAt: datetime = Field(default_factory=utc_now)
    updatedAt: datetime = Field(default_factory=utc_now)


class SessionCreateDocument(BaseModel):
    sessionId: Optional[str] = None
    userId: str
    courseId: str
    lessonId: Optional[str] = None
    status: Literal["active", "finished"] = "active"


class SessionUpdate(BaseModel):
    lessonId: Optional[str] = None
    status: Optional[Literal["active", "finished"]] = None
    endedAt: Optional[datetime] = None


class SessionDocument(BaseModel):
    sessionId: str
    userId: str
    courseId: str
    lessonId: Optional[str] = None
    status: Literal["active", "finished"] = "active"
    startedAt: datetime = Field(default_factory=utc_now)
    endedAt: Optional[datetime] = None
    updatedAt: datetime = Field(default_factory=utc_now)


class EmotionEventCreate(BaseModel):
    eventId: Optional[str] = None
    sessionId: str
    userId: str
    courseId: str
    lessonId: Optional[str] = None
    modality: Literal["face", "text", "voice"]
    emotion: str
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=utc_now)
    payload: dict[str, Any] = Field(default_factory=dict)


class EmotionEventDocument(BaseModel):
    eventId: str
    sessionId: str
    userId: str
    courseId: str
    lessonId: Optional[str] = None
    modality: Literal["face", "text", "voice"]
    emotion: str
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=utc_now)
    payload: dict[str, Any] = Field(default_factory=dict)
    createdAt: datetime = Field(default_factory=utc_now)


class ReportCreate(BaseModel):
    reportId: Optional[str] = None
    scopeType: Literal["session", "course"]
    scopeId: str
    generatedAt: datetime = Field(default_factory=utc_now)
    data: dict[str, Any] = Field(default_factory=dict)
    expiresAt: Optional[datetime] = None


class ReportDocument(BaseModel):
    reportId: str
    scopeType: Literal["session", "course"]
    scopeId: str
    generatedAt: datetime = Field(default_factory=utc_now)
    data: dict[str, Any] = Field(default_factory=dict)
    expiresAt: Optional[datetime] = None
