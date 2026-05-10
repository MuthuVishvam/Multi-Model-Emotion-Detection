from datetime import datetime
from typing import Annotated, Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


NonEmptyId = Annotated[str, Field(min_length=1, max_length=128)]
MessageText = Annotated[str, Field(min_length=1, max_length=4000)]
EmotionLabel = Annotated[str, Field(min_length=1, max_length=64)]


class UserRegister(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=6, max_length=256)]
    role: Literal["student", "teacher", "admin"] = "student"
    full_name: Optional[Annotated[str, Field(min_length=1, max_length=200)]] = None
    username: Optional[Annotated[str, Field(min_length=3, max_length=64)]] = None


class UserLogin(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[Annotated[str, Field(min_length=3, max_length=64)]] = None
    password: Annotated[str, Field(min_length=1, max_length=256)]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    id: str
    role: Literal["student", "teacher", "admin"]
    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    designation: Optional[str] = None
    experience_years: Optional[int] = None
    verified: Optional[bool] = None
    verified_at: Optional[datetime] = None
    status: Optional[Literal["pending", "approved", "rejected"]] = None
    is_active: Optional[bool] = True


class ProfileUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[Annotated[str, Field(min_length=3, max_length=64)]] = None
    full_name: Optional[Annotated[str, Field(min_length=1, max_length=200)]] = None
    phone: Optional[Annotated[str, Field(min_length=5, max_length=32)]] = None
    department: Optional[Annotated[str, Field(min_length=1, max_length=120)]] = None
    year: Optional[Annotated[str, Field(min_length=1, max_length=50)]] = None
    avatar_url: Optional[Annotated[str, Field(min_length=1, max_length=512)]] = None
    bio: Optional[Annotated[str, Field(min_length=1, max_length=2000)]] = None
    designation: Optional[Annotated[str, Field(min_length=1, max_length=120)]] = None
    experience_years: Optional[int] = Field(default=None, ge=0, le=80)


class TeacherAdminResponse(BaseModel):
    id: str
    role: Literal["teacher"] = "teacher"
    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    designation: Optional[str] = None
    experience_years: Optional[int] = None
    verified: bool = False
    verified_at: Optional[datetime] = None
    status: Literal["pending", "approved", "rejected"] = "pending"
    is_active: bool = True
    created_at: Optional[datetime] = None


class AdminUserStatusResponse(BaseModel):
    id: str
    role: str
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool = True
    status: Optional[Literal["pending", "approved", "rejected"]] = None
    verified: Optional[bool] = None
    verified_at: Optional[datetime] = None


class AdminClassOverviewResponse(BaseModel):
    class_id: str
    class_name: str
    section: str
    semester: str
    description: Optional[str] = None
    course_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    teacher_id: str
    teacher_email: Optional[EmailStr] = None
    teacher_username: Optional[str] = None
    teacher_full_name: Optional[str] = None
    teacher_status: Optional[str] = None
    teacher_is_active: bool = True
    student_count: int = 0


class ClassCreateRequest(BaseModel):
    class_name: Annotated[str, Field(min_length=1, max_length=200)]
    section: Annotated[str, Field(min_length=1, max_length=50)]
    semester: Annotated[str, Field(min_length=1, max_length=50)]
    description: Optional[Annotated[str, Field(min_length=1, max_length=2000)]] = None
    course_ids: list[NonEmptyId] = Field(default_factory=list)


class ClassInviteRequest(BaseModel):
    student_user_ids: list[NonEmptyId] = Field(default_factory=list)
    emails: list[EmailStr] = Field(default_factory=list)
    usernames: list[Annotated[str, Field(min_length=3, max_length=64)]] = Field(default_factory=list)


class ClassJoinRequest(BaseModel):
    join_code: Annotated[str, Field(min_length=4, max_length=32)]


class ClassMemberResponse(BaseModel):
    user_id: str
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    member_role: Literal["teacher", "student"] = "student"
    status: Literal["invited", "joined"] = "joined"
    source: Optional[str] = None
    joined_at: Optional[datetime] = None
    invited_at: Optional[datetime] = None


class ClassResponse(BaseModel):
    class_id: str
    class_name: str
    section: str
    semester: str
    description: Optional[str] = None
    course_ids: list[str] = Field(default_factory=list)
    teacher_id: str
    teacher_email: Optional[EmailStr] = None
    join_code: str
    invite_link: str
    member_count: int = 0
    my_membership_status: Optional[Literal["invited", "joined"]] = None
    created_at: datetime


class ClassDetailResponse(ClassResponse):
    members: list[ClassMemberResponse] = Field(default_factory=list)


class ClassInviteResponse(BaseModel):
    class_id: str
    invited_count: int
    notification_count: int


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    data: dict = Field(default_factory=dict)
    read: bool = False
    created_at: datetime
    read_at: Optional[datetime] = None


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse] = Field(default_factory=list)
    unread_count: int = 0


class EmotionEventIn(BaseModel):
    user_id: NonEmptyId
    teacher_id: Optional[NonEmptyId] = None
    class_id: Optional[NonEmptyId] = None
    course_id: Optional[NonEmptyId] = None
    lesson_id: Optional[NonEmptyId] = None
    session_id: Optional[NonEmptyId] = None
    live_session_id: Optional[NonEmptyId] = None
    modality: Literal["face", "text", "voice"]
    emotion_label: EmotionLabel
    confidence: float = Field(ge=0.0, le=1.0)
    engagement_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    timestamp: datetime
    extra: dict[str, Any] = Field(default_factory=dict)


class EmotionEventBatchRequest(BaseModel):
    events: list[EmotionEventIn] = Field(default_factory=list)


class AttentionEventIn(BaseModel):
    user_id: NonEmptyId
    lesson_id: Optional[NonEmptyId] = None
    session_id: Optional[NonEmptyId] = None
    live_session_id: Optional[NonEmptyId] = None
    timestamp: datetime
    state: Literal[
        "focused",
        "no_face",
        "no_face_detected",
        "multi_face",
        "away",
        "tab_hidden",
        "idle",
        "possible_distraction",
        "possible_game",
    ]
    evidence: dict[str, Any] = Field(default_factory=dict)


class AttentionEventBatchRequest(BaseModel):
    events: list[AttentionEventIn] = Field(default_factory=list)


class EventBatchIngestResponse(BaseModel):
    inserted_count: int = 0
    skipped_count: int = 0


class ModalityTimelineBucket(BaseModel):
    minute: str
    total: int
    emotions: dict[str, int] = Field(default_factory=dict)


class TextCommentAnalyticsItem(BaseModel):
    user_id: str
    student_name: Optional[str] = None
    comment: str
    emotion_label: str
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: datetime


class VoiceFeedbackAnalyticsItem(BaseModel):
    user_id: str
    student_name: Optional[str] = None
    feedback: str
    emotion_label: str
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: datetime
    audio_duration: Optional[float] = None


class LessonModalityAnalyticsResponse(BaseModel):
    lesson_id: str
    modality: Literal["face", "text", "voice"]
    total_events: int = 0
    dominant_emotion: str = "unknown"
    emotion_counts: dict[str, int] = Field(default_factory=dict)
    emotion_percentages: dict[str, float] = Field(default_factory=dict)
    timeline_buckets: list[ModalityTimelineBucket] = Field(default_factory=list)
    top_negative_comments: list[TextCommentAnalyticsItem] = Field(default_factory=list)
    feedback_items: list[VoiceFeedbackAnalyticsItem] = Field(default_factory=list)


class AttentionSummaryResponse(BaseModel):
    total_events: int = 0
    counts: dict[str, int] = Field(default_factory=dict)
    percentages: dict[str, float] = Field(default_factory=dict)


class LessonOverallAnalyticsResponse(BaseModel):
    lesson_id: str
    total_events: int = 0
    dominant_emotion: str = "unknown"
    emotion_counts: dict[str, int] = Field(default_factory=dict)
    emotion_percentages: dict[str, float] = Field(default_factory=dict)
    modality_breakdown: dict[str, int] = Field(default_factory=dict)
    modality_percentages: dict[str, float] = Field(default_factory=dict)
    engagement_score: float = 0.0
    attention_summary: AttentionSummaryResponse = Field(default_factory=AttentionSummaryResponse)


class StudentTimelineBucket(BaseModel):
    minute: str
    emotion_total: int = 0
    attention_total: int = 0
    emotion_counts: dict[str, int] = Field(default_factory=dict)
    attention_counts: dict[str, int] = Field(default_factory=dict)


class StudentLessonAnalyticsRow(BaseModel):
    user_id: str
    student_name: str
    watch_time_seconds: int = 0
    watched_time_min: float = 0.0
    completion_percent: float = 0.0
    dominant_emotion: str = "unknown"
    dominant_emotion_overall: str = "unknown"
    dominant_face_emotion: str = "unknown"
    dominant_text_emotion: str = "unknown"
    dominant_voice_emotion: str = "unknown"
    attention_score: float = 0.0
    dominant_attention_state: str = "unknown"
    attention_state_summary: str = ""
    no_face_detected: int = 0
    lesson_completed: bool = False
    emotion_event_count: int = 0
    attention_state_breakdown: dict[str, int] = Field(default_factory=dict)
    attention_state_percentages: dict[str, float] = Field(default_factory=dict)
    last_seen: Optional[datetime] = None
    text_comments: list[TextCommentAnalyticsItem] = Field(default_factory=list)
    voice_feedback: list[VoiceFeedbackAnalyticsItem] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)
    timeline: list[StudentTimelineBucket] = Field(default_factory=list)


class LessonStudentsAnalyticsResponse(BaseModel):
    lesson_id: str
    students: list[StudentLessonAnalyticsRow] = Field(default_factory=list)


class LessonProgressUpdateRequest(BaseModel):
    session_id: NonEmptyId
    watched_time_sec: int = Field(ge=0)
    completion_percent: float = Field(ge=0.0, le=100.0)
    completed: bool = False
    class_id: Optional[NonEmptyId] = None
    face_emotion_captured: bool = False
    text_feedback_sent: bool = False
    audio_feedback_sent: bool = False
    watch_progress_completed: bool = False


class LessonProgressUpdateResponse(BaseModel):
    lesson_id: str
    session_id: str
    user_id: str
    class_id: Optional[str] = None
    watched_time_sec: int = 0
    completion_percent: float = 0.0
    completed: bool = False
    face_emotion_captured: bool = False
    text_feedback_sent: bool = False
    audio_feedback_sent: bool = False
    watch_progress_completed: bool = False
    updated_at: datetime


class LessonProgressAnalyticsItem(BaseModel):
    user_id: str
    student_name: str
    watched_time_sec: int = 0
    completion_percent: float = 0.0
    lesson_completed: bool = False
    face_emotion_captured: bool = False
    text_feedback_sent: bool = False
    audio_feedback_sent: bool = False
    watch_progress_completed: bool = False
    no_face_detected: int = 0
    updated_at: Optional[datetime] = None


class LessonProgressAnalyticsResponse(BaseModel):
    lesson_id: str
    completion_count: int = 0
    total_students_with_progress: int = 0
    completion_rate_percent: float = 0.0
    students: list[LessonProgressAnalyticsItem] = Field(default_factory=list)


class LiveClassStartRequest(BaseModel):
    class_id: Optional[NonEmptyId] = None
    lesson_id: Optional[NonEmptyId] = None
    title: Optional[Annotated[str, Field(min_length=1, max_length=200)]] = None


class LiveClassSessionResponse(BaseModel):
    live_session_id: str
    class_id: Optional[str] = None
    lesson_id: Optional[str] = None
    teacher_id: str
    title: str
    status: Literal["active", "ended"] = "active"
    started_at: datetime
    ended_at: Optional[datetime] = None
    created_at: datetime
    active_students_count: int = 0


class LiveClassParticipantResponse(BaseModel):
    live_session_id: str
    user_id: str
    role: Literal["teacher", "student"]
    is_active: bool
    joined_at: datetime
    last_joined_at: datetime
    left_at: Optional[datetime] = None
    watch_time_seconds: int = 0


class LiveClassEndResponse(BaseModel):
    live_session_id: str
    status: Literal["ended"] = "ended"
    ended_at: datetime
    active_students_count: int = 0
    participant_count: int = 0


class LiveModalityAnalyticsResponse(BaseModel):
    live_session_id: str
    modality: Literal["face", "text", "voice"]
    total_events: int = 0
    dominant_emotion: str = "unknown"
    emotion_counts: dict[str, int] = Field(default_factory=dict)
    emotion_percentages: dict[str, float] = Field(default_factory=dict)
    timeline_buckets: list[ModalityTimelineBucket] = Field(default_factory=list)
    top_negative_comments: list[TextCommentAnalyticsItem] = Field(default_factory=list)
    feedback_items: list[VoiceFeedbackAnalyticsItem] = Field(default_factory=list)


class LiveOverallAnalyticsResponse(BaseModel):
    live_session_id: str
    class_id: Optional[str] = None
    lesson_id: Optional[str] = None
    title: Optional[str] = None
    status: Literal["active", "ended"] = "active"
    total_events: int = 0
    dominant_emotion: str = "unknown"
    emotion_counts: dict[str, int] = Field(default_factory=dict)
    emotion_percentages: dict[str, float] = Field(default_factory=dict)
    modality_breakdown: dict[str, int] = Field(default_factory=dict)
    modality_percentages: dict[str, float] = Field(default_factory=dict)
    engagement_score: float = 0.0
    active_students_count: int = 0
    low_attention_alerts: int = 0
    attention_summary: AttentionSummaryResponse = Field(default_factory=AttentionSummaryResponse)


class LiveStudentAnalyticsRow(BaseModel):
    user_id: str
    student_name: str
    watch_time_seconds: int = 0
    watched_time_min: float = 0.0
    dominant_emotion: str = "unknown"
    dominant_face_emotion: str = "unknown"
    dominant_text_emotion: str = "unknown"
    dominant_voice_emotion: str = "unknown"
    attention_state: str = "unknown"
    attention_state_breakdown: dict[str, int] = Field(default_factory=dict)
    attention_state_percentages: dict[str, float] = Field(default_factory=dict)
    no_face_count: int = 0
    last_seen: Optional[datetime] = None


class LiveStudentsAnalyticsResponse(BaseModel):
    live_session_id: str
    students: list[LiveStudentAnalyticsRow] = Field(default_factory=list)


class LessonAssignRequest(BaseModel):
    class_ids: list[NonEmptyId] = Field(default_factory=list)
    publish_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    is_published: Optional[bool] = None


class LessonAssignmentResponse(BaseModel):
    assignment_id: str
    class_id: str
    lesson_id: str
    publish_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    is_published: bool = True
    created_at: datetime


class LessonManageResponse(BaseModel):
    lesson_id: str
    title: str
    description: str
    course_id: str
    teacher_id: str
    teacher_email: Optional[EmailStr] = None
    video_url: Optional[str] = None
    video_embed_url: Optional[str] = None
    media_type: Optional[str] = None
    uploaded_file_name: Optional[str] = None
    duration_sec: int = 0
    resources: list[str] = Field(default_factory=list)
    content: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    assignments: list[LessonAssignmentResponse] = Field(default_factory=list)


class SessionStartRequest(BaseModel):
    session_name: Annotated[str, Field(min_length=1, max_length=200)]
    course: Optional[Annotated[str, Field(min_length=1, max_length=128)]] = None
    class_id: Optional[NonEmptyId] = None
    lesson_id: Optional[NonEmptyId] = None


class SessionStartResponse(BaseModel):
    id: str
    session_name: str
    course: Optional[str] = None
    created_by: str
    created_at: datetime


class EmotionPredictRequest(BaseModel):
    session_id: NonEmptyId
    student_id: NonEmptyId
    text: MessageText
    modality: Optional[Annotated[str, Field(min_length=1, max_length=32)]] = "text"
    lesson_id: Optional[NonEmptyId] = None


class EmotionPredictResponse(BaseModel):
    emotion: str
    scores: dict[str, float]
    timestamp: datetime


class FaceEmotionBatchEvent(BaseModel):
    userId: NonEmptyId
    courseId: Optional[NonEmptyId] = None
    lessonId: Optional[NonEmptyId] = None
    sessionId: NonEmptyId
    liveSessionId: Optional[NonEmptyId] = None
    timestamp: datetime
    emotion: EmotionLabel
    confidence: float = Field(ge=0.0, le=1.0)


class FaceEmotionBatchRequest(BaseModel):
    events: list[FaceEmotionBatchEvent] = Field(default_factory=list)


class TextEmotionMessageRequest(BaseModel):
    userId: NonEmptyId
    courseId: Optional[NonEmptyId] = None
    classId: Optional[NonEmptyId] = None
    lessonId: Optional[NonEmptyId] = None
    sessionId: Optional[NonEmptyId] = None
    liveSessionId: Optional[NonEmptyId] = None
    text: MessageText
    timestamp: datetime


class VoiceEmotionUploadMeta(BaseModel):
    userId: NonEmptyId
    courseId: Optional[NonEmptyId] = None
    classId: Optional[NonEmptyId] = None
    lessonId: Optional[NonEmptyId] = None
    sessionId: Optional[NonEmptyId] = None
    liveSessionId: Optional[NonEmptyId] = None
    timestamp: datetime


class TextEmotionMessageResponse(BaseModel):
    emotion: str
    confidence: float = Field(ge=0.0, le=1.0)
    suggestion: str
    comment_id: Optional[str] = None
    lesson_id: Optional[str] = None
    class_id: Optional[str] = None
    created_at: Optional[datetime] = None


class VoiceEmotionResponse(BaseModel):
    emotion: str
    confidence: float = Field(ge=0.0, le=1.0)
    feedback_id: Optional[str] = None
    lesson_id: Optional[str] = None
    class_id: Optional[str] = None
    file_ref: Optional[str] = None
    created_at: Optional[datetime] = None


class LessonCommentResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    lesson_id: str
    class_id: Optional[str] = None
    session_id: str
    text: str
    predicted_emotion: str
    confidence: float = Field(ge=0.0, le=1.0)
    created_at: datetime


class VoiceFeedbackItemResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    lesson_id: str
    class_id: Optional[str] = None
    session_id: str
    file_ref: str
    predicted_emotion: str
    confidence: float = Field(ge=0.0, le=1.0)
    created_at: datetime


class ReportSuggestions(BaseModel):
    teacher: str
    student: str


class TimelineBucket(BaseModel):
    minute: str
    total: int
    emotions: dict[str, int] = Field(default_factory=dict)


class ReportTotals(BaseModel):
    logs: int = 0
    sessions: int = 0
    students: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: float = 0.0
    engagement_score: float = 0.0


class SessionReportResponse(BaseModel):
    session_id: str
    course_id: Optional[str] = None
    totals: ReportTotals
    emotion_counts: dict[str, int] = Field(default_factory=dict)
    emotion_percentages: dict[str, float] = Field(default_factory=dict)
    timeline_buckets: list[TimelineBucket] = Field(default_factory=list)
    dominant_emotion_overall: str = "unknown"
    dominant_emotion_last_5m: str = "unknown"
    suggestions: ReportSuggestions


class CourseSessionSummary(BaseModel):
    session_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    logs: int = 0
    dominant_emotion: str = "unknown"
    engagement_score: float = 0.0


class CourseReportResponse(BaseModel):
    course_id: str
    totals: ReportTotals
    emotion_counts: dict[str, int] = Field(default_factory=dict)
    emotion_percentages: dict[str, float] = Field(default_factory=dict)
    timeline_buckets: list[TimelineBucket] = Field(default_factory=list)
    dominant_emotion_overall: str = "unknown"
    dominant_emotion_last_5m: str = "unknown"
    suggestions: ReportSuggestions
    sessions: list[CourseSessionSummary] = Field(default_factory=list)


class StudentStat(BaseModel):
    student_id: str
    top_emotion: str
    engagement_score: float
    sample_count: int = 0
    modality_counts: dict[str, int] = Field(default_factory=dict)


class DashboardSummaryResponse(BaseModel):
    session_id: str
    emotion_counts: dict[str, int]
    emotion_percentages: dict[str, float]
    modality_counts: dict[str, int] = Field(default_factory=dict)
    modality_emotion_counts: dict[str, dict[str, int]] = Field(default_factory=dict)
    engagement_score: float
    confusion_index: float
    timeline_buckets: dict[str, int]
    student_stats: list[StudentStat] = Field(default_factory=list)


class StudentDashboardResponse(BaseModel):
    session_id: str
    student_id: str
    timeline: dict[str, int]
    emotion_distribution: dict[str, int]


class LessonCreateRequest(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]
    description: Annotated[str, Field(min_length=1, max_length=2000)]
    content: Annotated[str, Field(min_length=1)]


class LessonResponse(BaseModel):
    lesson_id: str
    title: str
    description: str
    content: str
    created_by: str
    created_at: datetime
