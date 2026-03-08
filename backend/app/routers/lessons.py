from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from pymongo import ReturnDocument

from app.database import db
from app.dependencies import get_current_user, require_teacher
from app.models import (
    LessonAssignRequest,
    LessonAssignmentResponse,
    LessonManageResponse,
    LessonProgressUpdateRequest,
    LessonProgressUpdateResponse,
)
from app.services.lesson_management import lesson_management_service


router = APIRouter(prefix="/lessons", tags=["lessons"])
logger = logging.getLogger("emotion_backend")


async def _extract_create_payload(
    request: Request,
    *,
    title: str | None,
    description: str | None,
    course_id: str | None,
    video_url: str | None,
    duration_sec: int | None,
    resources,
) -> dict:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        body = await request.json()
        return {
            "title": body.get("title"),
            "description": body.get("description"),
            "course_id": body.get("course_id") or body.get("course") or "live-classroom-studio",
            "video_url": body.get("video_url") or body.get("content"),
            "duration_sec": body.get("duration_sec"),
            "resources": body.get("resources", []),
        }

    return {
        "title": title,
        "description": description,
        "course_id": course_id,
        "video_url": video_url,
        "duration_sec": duration_sec,
        "resources": resources,
    }


async def _extract_update_payload(
    request: Request,
    *,
    title: str | None,
    description: str | None,
    course_id: str | None,
    video_url: str | None,
    duration_sec: int | None,
    resources,
) -> dict:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        body = await request.json()
        return {
            "title": body.get("title"),
            "description": body.get("description"),
            "course_id": body.get("course_id") or body.get("course"),
            "video_url": body.get("video_url") or body.get("content"),
            "duration_sec": body.get("duration_sec"),
            "resources": body.get("resources"),
        }

    return {
        "title": title,
        "description": description,
        "course_id": course_id,
        "video_url": video_url,
        "duration_sec": duration_sec,
        "resources": resources,
    }


@router.post("", response_model=LessonManageResponse)
async def create_lesson(
    request: Request,
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    course_id: str | None = Form(default=None),
    video_url: str | None = Form(default=None),
    duration_sec: int | None = Form(default=None),
    resources: str | None = Form(default=None),
    uploaded_file: UploadFile | None = File(default=None),
    teacher_user: dict = Depends(require_teacher),
) -> LessonManageResponse:
    payload = await _extract_create_payload(
        request,
        title=title,
        description=description,
        course_id=course_id,
        video_url=video_url,
        duration_sec=duration_sec,
        resources=resources,
    )
    result = await lesson_management_service.create_lesson(
        teacher_user=teacher_user,
        title=payload.get("title") or "",
        description=payload.get("description") or "",
        course_id=payload.get("course_id") or "",
        video_url=payload.get("video_url"),
        duration_sec=payload.get("duration_sec"),
        resources_raw=payload.get("resources"),
        uploaded_file=uploaded_file,
    )
    return LessonManageResponse(**result)


@router.put("/{lesson_id}", response_model=LessonManageResponse)
async def update_lesson(
    lesson_id: str,
    request: Request,
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    course_id: str | None = Form(default=None),
    video_url: str | None = Form(default=None),
    duration_sec: int | None = Form(default=None),
    resources: str | None = Form(default=None),
    uploaded_file: UploadFile | None = File(default=None),
    teacher_user: dict = Depends(require_teacher),
) -> LessonManageResponse:
    payload = await _extract_update_payload(
        request,
        title=title,
        description=description,
        course_id=course_id,
        video_url=video_url,
        duration_sec=duration_sec,
        resources=resources,
    )
    result = await lesson_management_service.update_lesson(
        teacher_user=teacher_user,
        lesson_id=lesson_id,
        title=payload.get("title"),
        description=payload.get("description"),
        course_id=payload.get("course_id"),
        video_url=payload.get("video_url"),
        duration_sec=payload.get("duration_sec"),
        resources_raw=payload.get("resources"),
        uploaded_file=uploaded_file,
    )
    return LessonManageResponse(**result)


@router.get("/my", response_model=list[LessonManageResponse])
async def list_my_lessons(teacher_user: dict = Depends(require_teacher)) -> list[LessonManageResponse]:
    rows = await lesson_management_service.list_teacher_lessons(teacher_user=teacher_user)
    return [LessonManageResponse(**row) for row in rows]


@router.post("/{lesson_id}/assign", response_model=list[LessonAssignmentResponse])
async def assign_lesson_to_classes(
    lesson_id: str,
    payload: LessonAssignRequest,
    teacher_user: dict = Depends(require_teacher),
) -> list[LessonAssignmentResponse]:
    if not payload.class_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="class_ids is required")
    rows = await lesson_management_service.assign_lesson_to_classes(
        teacher_user=teacher_user,
        lesson_id=lesson_id,
        class_ids=payload.class_ids,
        publish_at=payload.publish_at,
        due_at=payload.due_at,
        is_published=payload.is_published,
    )
    return [LessonAssignmentResponse(**row) for row in rows]


@router.get("", response_model=list[LessonManageResponse])
async def list_accessible_lessons(current_user: dict = Depends(get_current_user)) -> list[LessonManageResponse]:
    rows = await lesson_management_service.list_accessible_lessons(current_user=current_user)
    return [LessonManageResponse(**row) for row in rows]


@router.get("/{lesson_id}", response_model=LessonManageResponse)
async def get_lesson(
    lesson_id: str,
    class_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> LessonManageResponse:
    row = await lesson_management_service.get_lesson_for_user(
        current_user=current_user,
        lesson_id=lesson_id,
        class_id=class_id,
    )
    return LessonManageResponse(**row)


@router.delete("/{lesson_id}")
async def delete_lesson(
    lesson_id: str,
    teacher_user: dict = Depends(require_teacher),
) -> dict:
    deleted = await lesson_management_service.delete_lesson(
        teacher_user=teacher_user,
        lesson_id=lesson_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    return {"message": "Lesson deleted"}


@router.post("/{lesson_id}/progress", response_model=LessonProgressUpdateResponse)
async def update_lesson_progress(
    lesson_id: str,
    payload: LessonProgressUpdateRequest,
    current_user: dict = Depends(get_current_user),
) -> LessonProgressUpdateResponse:
    await lesson_management_service.get_lesson_for_user(
        current_user=current_user,
        lesson_id=lesson_id,
        class_id=payload.class_id,
    )

    now = datetime.now(timezone.utc)
    user_id = str(current_user.get("id") or "")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid account")

    progress_query = {
        "lesson_id": lesson_id,
        "session_id": payload.session_id,
        "user_id": user_id,
    }
    progress_updates = {
        "class_id": payload.class_id,
        "watched_time_sec": int(payload.watched_time_sec),
        "completion_percent": float(payload.completion_percent),
        "completed": bool(payload.completed),
        "face_emotion_captured": bool(payload.face_emotion_captured),
        "text_feedback_sent": bool(payload.text_feedback_sent),
        "audio_feedback_sent": bool(payload.audio_feedback_sent),
        "watch_progress_completed": bool(payload.watch_progress_completed),
        "updated_at": now,
    }

    updated = await db.lesson_progress.find_one_and_update(
        progress_query,
        {
            "$set": progress_updates,
            "$setOnInsert": {
                "created_at": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    if payload.completed:
        await db.lesson_completions.find_one_and_update(
            progress_query,
            {
                "$set": {
                    **progress_updates,
                    "completed": True,
                    "completed_at": now,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

    logger.info(
        "lesson_progress updated user_id=%s lesson_id=%s session_id=%s completion=%.2f completed=%s",
        user_id,
        lesson_id,
        payload.session_id,
        float(payload.completion_percent),
        bool(payload.completed),
    )

    return LessonProgressUpdateResponse(
        lesson_id=updated.get("lesson_id", lesson_id),
        session_id=updated.get("session_id", payload.session_id),
        user_id=updated.get("user_id", user_id),
        class_id=updated.get("class_id"),
        watched_time_sec=int(updated.get("watched_time_sec", 0) or 0),
        completion_percent=float(updated.get("completion_percent", 0.0) or 0.0),
        completed=bool(updated.get("completed", False)),
        face_emotion_captured=bool(updated.get("face_emotion_captured", False)),
        text_feedback_sent=bool(updated.get("text_feedback_sent", False)),
        audio_feedback_sent=bool(updated.get("audio_feedback_sent", False)),
        watch_progress_completed=bool(updated.get("watch_progress_completed", False)),
        updated_at=updated.get("updated_at") or now,
    )
