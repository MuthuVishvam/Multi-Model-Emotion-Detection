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
