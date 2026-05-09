from datetime import datetime
from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user, require_teacher
from app.models import (
    LessonModalityAnalyticsResponse,
    LessonOverallAnalyticsResponse,
    LessonProgressAnalyticsResponse,
    LessonStudentsAnalyticsResponse,
    LiveModalityAnalyticsResponse,
    LiveOverallAnalyticsResponse,
    LiveStudentsAnalyticsResponse,
)
from app.services.emotion_event_analytics import emotion_event_analytics_service
from app.services.lesson_management import lesson_management_service
from app.services.live_class_service import live_class_service


router = APIRouter(prefix="/analytics", tags=["analytics"])


async def _ensure_lesson_access(current_user: dict, lesson_id: str, class_id: str | None) -> None:
    await lesson_management_service.get_lesson_for_user(
        current_user=current_user,
        lesson_id=lesson_id,
        class_id=class_id,
    )


@router.get("/lesson/{lesson_id}/overall", response_model=LessonOverallAnalyticsResponse)
async def get_lesson_overall_analytics(
    lesson_id: str,
    class_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> LessonOverallAnalyticsResponse:
    await _ensure_lesson_access(current_user, lesson_id, class_id)
    result = await emotion_event_analytics_service.get_overall_analytics(
        lesson_id=lesson_id,
        class_id=class_id,
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LessonOverallAnalyticsResponse(**result)


@router.get("/lesson/{lesson_id}/face", response_model=LessonModalityAnalyticsResponse)
async def get_lesson_face_analytics(
    lesson_id: str,
    class_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> LessonModalityAnalyticsResponse:
    await _ensure_lesson_access(current_user, lesson_id, class_id)
    result = await emotion_event_analytics_service.get_modality_analytics(
        lesson_id=lesson_id,
        modality="face",
        class_id=class_id,
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LessonModalityAnalyticsResponse(**result)


@router.get("/lesson/{lesson_id}/text", response_model=LessonModalityAnalyticsResponse)
async def get_lesson_text_analytics(
    lesson_id: str,
    class_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> LessonModalityAnalyticsResponse:
    await _ensure_lesson_access(current_user, lesson_id, class_id)
    result = await emotion_event_analytics_service.get_modality_analytics(
        lesson_id=lesson_id,
        modality="text",
        class_id=class_id,
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LessonModalityAnalyticsResponse(**result)


@router.get("/lesson/{lesson_id}/voice", response_model=LessonModalityAnalyticsResponse)
async def get_lesson_voice_analytics(
    lesson_id: str,
    class_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> LessonModalityAnalyticsResponse:
    await _ensure_lesson_access(current_user, lesson_id, class_id)
    result = await emotion_event_analytics_service.get_modality_analytics(
        lesson_id=lesson_id,
        modality="voice",
        class_id=class_id,
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LessonModalityAnalyticsResponse(**result)


@router.get("/lesson/{lesson_id}/students", response_model=LessonStudentsAnalyticsResponse)
async def get_lesson_students_analytics(
    lesson_id: str,
    class_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    teacher_user: dict = Depends(require_teacher),
) -> LessonStudentsAnalyticsResponse:
    await _ensure_lesson_access(teacher_user, lesson_id, class_id=class_id)
    result = await emotion_event_analytics_service.get_students_lesson_analytics(
        lesson_id=lesson_id,
        class_id=class_id,
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LessonStudentsAnalyticsResponse(**result)


@router.get("/lesson/{lesson_id}/progress", response_model=LessonProgressAnalyticsResponse)
async def get_lesson_progress_analytics(
    lesson_id: str,
    class_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    teacher_user: dict = Depends(require_teacher),
) -> LessonProgressAnalyticsResponse:
    await _ensure_lesson_access(teacher_user, lesson_id, class_id=class_id)
    result = await emotion_event_analytics_service.get_lesson_progress_analytics(
        lesson_id=lesson_id,
        class_id=class_id,
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LessonProgressAnalyticsResponse(**result)


@router.get("/live/{live_session_id}/overall", response_model=LiveOverallAnalyticsResponse)
async def get_live_overall_analytics(
    live_session_id: str,
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> LiveOverallAnalyticsResponse:
    await live_class_service.get_live_class_for_user(
        live_session_id=live_session_id,
        current_user=current_user,
    )
    result = await emotion_event_analytics_service.get_live_overall_analytics(
        live_session_id=live_session_id,
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LiveOverallAnalyticsResponse(**result)


@router.get("/live/{live_session_id}/face", response_model=LiveModalityAnalyticsResponse)
async def get_live_face_analytics(
    live_session_id: str,
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> LiveModalityAnalyticsResponse:
    await live_class_service.get_live_class_for_user(
        live_session_id=live_session_id,
        current_user=current_user,
    )
    result = await emotion_event_analytics_service.get_live_modality_analytics(
        live_session_id=live_session_id,
        modality="face",
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LiveModalityAnalyticsResponse(**result)


@router.get("/live/{live_session_id}/text", response_model=LiveModalityAnalyticsResponse)
async def get_live_text_analytics(
    live_session_id: str,
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> LiveModalityAnalyticsResponse:
    await live_class_service.get_live_class_for_user(
        live_session_id=live_session_id,
        current_user=current_user,
    )
    result = await emotion_event_analytics_service.get_live_modality_analytics(
        live_session_id=live_session_id,
        modality="text",
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LiveModalityAnalyticsResponse(**result)


@router.get("/live/{live_session_id}/voice", response_model=LiveModalityAnalyticsResponse)
async def get_live_voice_analytics(
    live_session_id: str,
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> LiveModalityAnalyticsResponse:
    await live_class_service.get_live_class_for_user(
        live_session_id=live_session_id,
        current_user=current_user,
    )
    result = await emotion_event_analytics_service.get_live_modality_analytics(
        live_session_id=live_session_id,
        modality="voice",
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LiveModalityAnalyticsResponse(**result)


@router.get("/live/{live_session_id}/students", response_model=LiveStudentsAnalyticsResponse)
async def get_live_students_analytics(
    live_session_id: str,
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    emotion_label: str | None = Query(default=None),
    teacher_user: dict = Depends(require_teacher),
) -> LiveStudentsAnalyticsResponse:
    await live_class_service.get_live_class_for_user(
        live_session_id=live_session_id,
        current_user=teacher_user,
    )
    result = await emotion_event_analytics_service.get_students_live_analytics(
        live_session_id=live_session_id,
        start_at=start_at,
        end_at=end_at,
        emotion_label=emotion_label,
    )
    return LiveStudentsAnalyticsResponse(**result)


@router.get("/student/{student_id}/history")
async def get_student_emotion_history(
    student_id: str,
    lesson_id: str | None = Query(default=None),
    class_id: str | None = Query(default=None),
    teacher_user: dict = Depends(require_teacher),
):
    # This is a stub for the student drill down
    # In a real scenario, this would aggregate data specifically for the student
    # over the selected time ranges using the existing emotion_events and attention_events collections.
    
    # We will build a dummy fallback response for now that perfectly matches the frontend Recharts expectations
    return {
        "student_id": student_id,
        "lesson_id": lesson_id or "all",
        "class_id": class_id or "all",
        "engagement": 85.0,
        "attention": 78.5,
        "completion": 100.0,
        "dominant_emotion": "interest",
        "emotion_percentages": {
            "interest": 45,
            "neutral": 30,
            "confusion": 15,
            "happiness": 10
        },
        "modality_history": {
            "face": [{"emotion": "interest", "count": 20}, {"emotion": "neutral", "count": 10}],
            "text": [{"emotion": "confusion", "count": 5}],
            "voice": [{"emotion": "happiness", "count": 2}]
        },
        "timeline": [
            {"minute": "2026-05-09T10:00:00Z", "interest": 80, "confusion": 20},
            {"minute": "2026-05-09T10:15:00Z", "interest": 90, "confusion": 10},
            {"minute": "2026-05-09T10:30:00Z", "interest": 70, "confusion": 30}
        ],
        "session_history": [
            {
                "date": "2026-05-09T10:00:00Z",
                "lesson_name": "Database Normalization",
                "duration": 45.0,
                "dominant_emotion": "interest",
                "attention": 82.0,
                "completion": 100.0,
                "transcript_summary": "I'm confused with joins"
            }
        ]
    }


@router.get("/powerbi/embed-token")
async def get_powerbi_embed_token(
    teacher_user: dict = Depends(require_teacher),
):
    # Stub for Azure AD Power BI token generation
    return {
        "accessToken": None, # Force fallback
        "embedUrl": "https://app.powerbi.com/reportEmbed?reportId=dummy",
        "reportId": "dummy-report-id"
    }
