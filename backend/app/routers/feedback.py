from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, Query

from app.database import db
from app.dependencies import get_current_user
from app.models import LessonCommentResponse, VoiceFeedbackItemResponse
from app.services.lesson_management import lesson_management_service


router = APIRouter(prefix="/feedback", tags=["feedback"])


async def _resolve_user_names(user_ids: list[str]) -> dict[str, str]:
    if not user_ids:
        return {}

    object_ids: list[ObjectId] = []
    text_ids: list[str] = []
    for user_id in user_ids:
        if not user_id:
            continue
        if ObjectId.is_valid(user_id):
            object_ids.append(ObjectId(user_id))
        else:
            text_ids.append(user_id)

    or_filters: list[dict] = []
    if object_ids:
        or_filters.append({"_id": {"$in": object_ids}})
    if text_ids:
        or_filters.append({"email": {"$in": text_ids}})
        or_filters.append({"username": {"$in": text_ids}})

    if not or_filters:
        return {}

    rows = await db.users.find(
        {"$or": or_filters},
        {"full_name": 1, "username": 1, "email": 1},
    ).to_list(length=None)

    mapping: dict[str, str] = {}
    for row in rows:
        name = row.get("full_name") or row.get("username") or row.get("email") or str(row.get("_id", ""))
        mapping[str(row.get("_id"))] = name
        email = row.get("email")
        username = row.get("username")
        if isinstance(email, str) and email:
            mapping[email] = name
        if isinstance(username, str) and username:
            mapping[username] = name
    return mapping


async def _ensure_access(current_user: dict, lesson_id: str, class_id: str | None) -> None:
    await lesson_management_service.get_lesson_for_user(
        current_user=current_user,
        lesson_id=lesson_id,
        class_id=class_id,
    )


@router.get("/comments", response_model=list[LessonCommentResponse])
async def list_lesson_comments(
    lesson_id: str = Query(...),
    class_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
) -> list[LessonCommentResponse]:
    await _ensure_access(current_user, lesson_id, class_id)

    query: dict = {"lesson_id": lesson_id}
    if class_id:
        query["class_id"] = class_id

    rows = await db.comments.find(query).sort("created_at", -1).limit(limit).to_list(length=None)
    user_name_map = await _resolve_user_names([str(row.get("user_id") or "") for row in rows])

    result: list[LessonCommentResponse] = []
    for row in rows:
        user_id = str(row.get("user_id") or "")
        result.append(
            LessonCommentResponse(
                id=str(row.get("_id")),
                user_id=user_id,
                user_name=user_name_map.get(user_id, user_id),
                lesson_id=str(row.get("lesson_id") or ""),
                class_id=row.get("class_id"),
                session_id=str(row.get("session_id") or ""),
                text=str(row.get("text") or ""),
                predicted_emotion=str(row.get("predicted_emotion") or "unknown"),
                confidence=float(row.get("confidence") or 0.0),
                created_at=row.get("created_at"),
            )
        )
    return result


@router.get("/voice", response_model=list[VoiceFeedbackItemResponse])
async def list_lesson_voice_feedback(
    lesson_id: str = Query(...),
    class_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
) -> list[VoiceFeedbackItemResponse]:
    await _ensure_access(current_user, lesson_id, class_id)

    query: dict = {"lesson_id": lesson_id}
    if class_id:
        query["class_id"] = class_id

    rows = await db.voice_feedback.find(query).sort("created_at", -1).limit(limit).to_list(length=None)
    user_name_map = await _resolve_user_names([str(row.get("user_id") or "") for row in rows])

    result: list[VoiceFeedbackItemResponse] = []
    for row in rows:
        user_id = str(row.get("user_id") or "")
        result.append(
            VoiceFeedbackItemResponse(
                id=str(row.get("_id")),
                user_id=user_id,
                user_name=user_name_map.get(user_id, user_id),
                lesson_id=str(row.get("lesson_id") or ""),
                class_id=row.get("class_id"),
                session_id=str(row.get("session_id") or ""),
                file_ref=str(row.get("file_ref") or ""),
                predicted_emotion=str(row.get("predicted_emotion") or "unknown"),
                confidence=float(row.get("confidence") or 0.0),
                created_at=row.get("created_at"),
            )
        )
    return result
