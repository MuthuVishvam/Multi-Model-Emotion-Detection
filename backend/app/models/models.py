"""
Database Models - Pydantic schemas for all collections
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


# ============================================================================
# USER MODELS
# ============================================================================

class UserBase(BaseModel):
    """Base user fields"""
    email: EmailStr
    name: str
    role: str = Field(default="student", pattern="^(student|teacher|admin)$")


class UserCreate(UserBase):
    """User creation request"""
    password: str


class UserUpdate(BaseModel):
    """User update request"""
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    """User response (for API)"""
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime
    avatar_url: Optional[str] = None
    is_verified: bool = False
    google_id: Optional[str] = None

    class Config:
        populate_by_name = True


class UserInDB(UserBase):
    """User in database (internal)"""
    id: str = Field(alias="_id")
    password_hash: str
    is_verified: bool = False
    avatar_url: Optional[str] = None
    google_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ============================================================================
# AUTHENTICATION MODELS
# ============================================================================

class LoginRequest(BaseModel):
    """Login request"""
    email: EmailStr
    password: str


class SignupRequest(UserCreate):
    """Signup request"""
    pass


class GoogleAuthRequest(BaseModel):
    """Google OAuth request"""
    token: str


class TokenResponse(BaseModel):
    """Token response"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse
    expires_in: int = 86400  # 24 hours


class TokenPayload(BaseModel):
    """JWT token payload"""
    sub: str  # user_id
    exp: int
    iat: int


# ============================================================================
# CLASS MODELS
# ============================================================================

class ClassBase(BaseModel):
    """Base class fields"""
    name: str
    description: Optional[str] = None
    subject: str
    code: str
    teacher_id: str


class ClassCreate(ClassBase):
    """Class creation request"""
    pass


class ClassUpdate(BaseModel):
    """Class update request"""
    name: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None


class ClassResponse(ClassBase):
    """Class response"""
    id: str = Field(alias="_id")
    teacher_id: str
    students: List[str] = []
    created_at: datetime
    updated_at: datetime
    student_count: int = 0

    class Config:
        populate_by_name = True


class ClassInDB(ClassBase):
    """Class in database"""
    id: str = Field(alias="_id")
    teacher_id: str
    students: List[str] = []
    created_at: datetime
    updated_at: datetime


# ============================================================================
# LESSON MODELS
# ============================================================================

class LessonBase(BaseModel):
    """Base lesson fields"""
    title: str
    description: Optional[str] = None
    class_id: str
    video_url: Optional[str] = None
    duration_seconds: int = 0
    order: int = 0


class LessonCreate(LessonBase):
    """Lesson creation request"""
    pass


class LessonUpdate(BaseModel):
    """Lesson update request"""
    title: Optional[str] = None
    description: Optional[str] = None
    video_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    order: Optional[int] = None


class LessonResponse(LessonBase):
    """Lesson response"""
    id: str = Field(alias="_id")
    class_id: str
    created_at: datetime
    updated_at: datetime
    view_count: int = 0

    class Config:
        populate_by_name = True


class LessonInDB(LessonBase):
    """Lesson in database"""
    id: str = Field(alias="_id")
    class_id: str
    created_at: datetime
    updated_at: datetime
    view_count: int = 0


# ============================================================================
# LIVE SESSION MODELS
# ============================================================================

class LiveSessionBase(BaseModel):
    """Base live session fields"""
    class_id: str
    teacher_id: str
    title: str
    status: str = "active"  # active, ended, scheduled


class LiveSessionCreate(LiveSessionBase):
    """Live session creation request"""
    pass


class LiveSessionResponse(LiveSessionBase):
    """Live session response"""
    id: str = Field(alias="_id")
    participants: List[str] = []
    started_at: datetime
    ended_at: Optional[datetime] = None
    recording_url: Optional[str] = None

    class Config:
        populate_by_name = True


class LiveSessionInDB(LiveSessionBase):
    """Live session in database"""
    id: str = Field(alias="_id")
    participants: List[str] = []
    started_at: datetime
    ended_at: Optional[datetime] = None
    recording_url: Optional[str] = None


# ============================================================================
# EMOTION EVENT MODELS
# ============================================================================

class EmotionEventBase(BaseModel):
    """Base emotion event fields"""
    session_id: str
    user_id: str
    emotion: str
    confidence: float
    engagement_score: float


class EmotionEventCreate(EmotionEventBase):
    """Emotion event creation request"""
    pass


class EmotionEventResponse(EmotionEventBase):
    """Emotion event response"""
    id: str = Field(alias="_id")
    timestamp: datetime

    class Config:
        populate_by_name = True


class EmotionEventInDB(EmotionEventBase):
    """Emotion event in database"""
    id: str = Field(alias="_id")
    timestamp: datetime


# ============================================================================
# ANALYTICS MODELS
# ============================================================================

class StudentEngagement(BaseModel):
    """Student engagement data"""
    user_id: str
    average_engagement: float
    total_classes: int
    average_emotion: str


class ClassEngagement(BaseModel):
    """Class engagement data"""
    class_id: str
    average_engagement: float
    participant_count: int
    emotion_distribution: dict


class DashboardStats(BaseModel):
    """Dashboard statistics"""
    total_students: int
    total_classes: int
    active_sessions: int
    average_engagement: float
    top_emotion: str
    recent_sessions: List[dict]


# ============================================================================
# NOTIFICATION MODELS
# ============================================================================

class NotificationBase(BaseModel):
    """Base notification fields"""
    user_id: str
    title: str
    message: str
    type: str  # class_invite, session_start, emotion_alert


class NotificationCreate(NotificationBase):
    """Notification creation request"""
    pass


class NotificationResponse(NotificationBase):
    """Notification response"""
    id: str = Field(alias="_id")
    read: bool = False
    created_at: datetime

    class Config:
        populate_by_name = True


class NotificationInDB(NotificationBase):
    """Notification in database"""
    id: str = Field(alias="_id")
    read: bool = False
    created_at: datetime


# ============================================================================
# POWER BI MODELS
# ============================================================================

class PowerBIEmbedToken(BaseModel):
    """Power BI embed token response"""
    token: str
    expiration: datetime
    embed_url: str


class PowerBIReport(BaseModel):
    """Power BI report info"""
    id: str
    name: str
    embed_url: str


# ============================================================================
# ERROR MODELS
# ============================================================================

class ErrorResponse(BaseModel):
    """Error response"""
    detail: str
    status_code: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ValidationError(BaseModel):
    """Validation error"""
    field: str
    message: str
