from app.schemas.core_schema import *  # noqa: F401,F403

from app.models.class_model import ClassDocument, EnrollmentDocument
from app.models.emotion_model import AttentionEventDocument, EmotionEventDocument, SessionDocument
from app.models.lesson_model import LessonAssignmentDocument, LessonDocument
from app.models.notification_model import NotificationDocument
from app.models.user_model import AuthCredential, UserDocument
from app.models.analytics_model import StudentEmotionHistory

MODEL_DOCUMENT_EXPORTS = [
    "UserDocument",
    "AuthCredential",
    "ClassDocument",
    "EnrollmentDocument",
    "LessonDocument",
    "LessonAssignmentDocument",
    "SessionDocument",
    "EmotionEventDocument",
    "AttentionEventDocument",
    "NotificationDocument",
    "StudentEmotionHistory",
]
