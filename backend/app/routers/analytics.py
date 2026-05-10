import csv
from datetime import datetime, timedelta, timezone
from io import StringIO

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.config import settings
from app.database import db
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


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _date_match(start_at: datetime | None, end_at: datetime | None) -> dict:
    match: dict = {}
    if start_at:
        match["$gte"] = start_at
    if end_at:
        match["$lte"] = end_at
    return match


def _dominant(counts: dict[str, int]) -> str:
    return max(counts, key=counts.get) if counts else "unknown"


def _percent(count: int | float, total: int | float) -> float:
    return round((float(count) / float(total)) * 100.0, 2) if total else 0.0


async def _teacher_scope(current_user: dict) -> dict:
    role = str(current_user.get("role") or "")
    user_id = str(current_user.get("id") or "")
    if role == "admin":
        return {}
    if role == "student":
        return {"user_id": user_id}

    class_rows = await db.classes.find({"teacher_id": user_id}, {"_id": 0, "class_id": 1}).to_list(length=None)
    class_ids = [row.get("class_id") for row in class_rows if row.get("class_id")]

    lesson_rows = await db.lessons.find({"teacher_id": user_id}, {"_id": 0, "lesson_id": 1}).to_list(length=None)
    lesson_ids = [row.get("lesson_id") for row in lesson_rows if row.get("lesson_id")]
    if class_ids:
        assignment_rows = await db.lesson_assignments.find(
            {"class_id": {"$in": class_ids}},
            {"_id": 0, "lesson_id": 1},
        ).to_list(length=None)
        lesson_ids.extend(row.get("lesson_id") for row in assignment_rows if row.get("lesson_id"))

    scope_or = [{"teacher_id": user_id}]
    if class_ids:
        scope_or.append({"class_id": {"$in": sorted(set(class_ids))}})
    if lesson_ids:
        scope_or.append({"lesson_id": {"$in": sorted(set(lesson_ids))}})
    return {"$or": scope_or}


async def _analytics_match(
    *,
    current_user: dict,
    class_id: str | None = None,
    lesson_id: str | None = None,
    student_id: str | None = None,
    live_session_id: str | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    emotion_label: str | None = None,
) -> dict:
    match: dict = {}
    scope = await _teacher_scope(current_user)
    if scope:
        match.update(scope)
    if class_id:
        match["class_id"] = class_id
    if lesson_id:
        match["lesson_id"] = lesson_id
    if student_id:
        if current_user.get("role") == "student" and str(current_user.get("id")) != str(student_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students can only view personal analytics")
        match["user_id"] = student_id
    if live_session_id:
        match["live_session_id"] = live_session_id
    if emotion_label:
        match["emotion_label"] = emotion_label
    timestamp = _date_match(start_at, end_at)
    if timestamp:
        match["timestamp"] = timestamp
    return match


async def _emotion_counts(match: dict) -> dict[str, int]:
    rows = await db.emotion_events.aggregate(
        [
            {"$match": match},
            {"$group": {"_id": "$emotion_label", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
    ).to_list(length=None)
    return {str(row["_id"]): _safe_int(row["count"]) for row in rows if row.get("_id")}


async def _timeline(match: dict, *, limit: int = 500) -> list[dict]:
    return await db.emotion_events.aggregate(
        [
            {"$match": match},
            {
                "$group": {
                    "_id": {
                        "minute": {
                            "$dateToString": {
                                "format": "%Y-%m-%dT%H:%M:00Z",
                                "date": "$timestamp",
                                "timezone": "UTC",
                            }
                        },
                        "emotion": "$emotion_label",
                    },
                    "count": {"$sum": 1},
                    "avg_confidence": {"$avg": "$confidence"},
                    "avg_engagement": {"$avg": {"$ifNull": ["$engagement_score", "$confidence"]}},
                }
            },
            {
                "$group": {
                    "_id": "$_id.minute",
                    "total": {"$sum": "$count"},
                    "avg_confidence": {"$avg": "$avg_confidence"},
                    "avg_engagement": {"$avg": "$avg_engagement"},
                    "emotions": {"$push": {"k": "$_id.emotion", "v": "$count"}},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "minute": "$_id",
                    "total": 1,
                    "avg_confidence": {"$round": ["$avg_confidence", 3]},
                    "engagement_score": {"$round": [{"$multiply": ["$avg_engagement", 100]}, 2]},
                    "emotions": {"$arrayToObject": "$emotions"},
                }
            },
            {"$sort": {"minute": 1}},
            {"$limit": limit},
        ]
    ).to_list(length=None)


async def _student_labels(user_ids: list[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    object_ids = [ObjectId(user_id) for user_id in user_ids if ObjectId.is_valid(user_id)]
    or_filters: list[dict] = [{"email": {"$in": user_ids}}, {"username": {"$in": user_ids}}]
    if object_ids:
        or_filters.append({"_id": {"$in": object_ids}})
    rows = await db.users.find(
        {"$or": or_filters},
        {"full_name": 1, "username": 1, "email": 1},
    ).to_list(length=None)
    labels = {}
    for row in rows:
        label = row.get("full_name") or row.get("username") or row.get("email") or str(row.get("_id"))
        labels[str(row.get("_id"))] = label
        if row.get("email"):
            labels[row["email"]] = label
        if row.get("username"):
            labels[row["username"]] = label
    return labels


async def _lesson_accessible(current_user: dict, lesson_id: str | None, class_id: str | None = None) -> None:
    if not lesson_id:
        return
    if current_user.get("role") == "admin":
        return
    await _ensure_lesson_access(current_user, lesson_id, class_id)


async def _live_accessible(current_user: dict, live_session_id: str | None) -> None:
    if not live_session_id or current_user.get("role") == "admin":
        return
    await live_class_service.get_live_class_for_user(live_session_id=live_session_id, current_user=current_user)


@router.get("/overview")
async def get_analytics_overview(
    class_id: str | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    await _lesson_accessible(current_user, lesson_id, class_id)
    match = await _analytics_match(
        current_user=current_user,
        class_id=class_id,
        lesson_id=lesson_id,
        start_at=start_at,
        end_at=end_at,
    )
    counts = await _emotion_counts(match)
    total_events = sum(counts.values())
    student_count = len(await db.emotion_events.distinct("user_id", match))
    confusion_count = counts.get("confusion", 0)
    boredom_count = counts.get("boredom", 0)
    attention_match = {"lesson_id": lesson_id} if lesson_id else {}
    if class_id:
        attention_match["class_id"] = class_id
    ts = _date_match(start_at, end_at)
    if ts:
        attention_match["timestamp"] = ts
    attention_rows = await db.attention_events.aggregate(
        [{"$match": attention_match}, {"$group": {"_id": "$state", "count": {"$sum": 1}}}]
    ).to_list(length=None)
    attention_counts = {row["_id"]: _safe_int(row["count"]) for row in attention_rows if row.get("_id")}
    attention_total = sum(attention_counts.values())
    focused = attention_counts.get("focused", 0)
    progress_match = {}
    if lesson_id:
        progress_match["lesson_id"] = lesson_id
    if class_id:
        progress_match["class_id"] = class_id
    progress_rows = await db.lesson_progress.find(progress_match, {"_id": 0, "completion_percent": 1, "completed": 1}).to_list(length=None)
    completed = sum(1 for row in progress_rows if row.get("completed") or _safe_float(row.get("completion_percent")) >= 100)
    return {
        "total_students_attended": student_count,
        "total_events": total_events,
        "average_engagement_score": round((_percent(focused, attention_total) * 0.45) + (_percent(total_events - confusion_count - boredom_count, total_events) * 0.55), 2),
        "dominant_emotion": _dominant(counts),
        "emotion_counts": counts,
        "emotion_percentages": {key: _percent(value, total_events) for key, value in counts.items()},
        "confusion_percentage": _percent(confusion_count, total_events),
        "boredom_percentage": _percent(boredom_count, total_events),
        "attention_focus_percentage": _percent(focused, attention_total),
        "lesson_completion_rate": _percent(completed, len(progress_rows)),
        "realtime_participation": student_count,
        "audio_sentiment_events": await db.emotion_events.count_documents({**match, "modality": "voice"}),
        "camera_activity_events": await db.emotion_events.count_documents({**match, "modality": "face"}),
        "timeline": await _timeline(match),
    }


@router.get("/lessons")
async def get_lesson_analytics_index(
    class_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    match = await _analytics_match(current_user=current_user, class_id=class_id)
    rows = await db.emotion_events.aggregate(
        [
            {"$match": match},
            {"$group": {"_id": "$lesson_id", "events": {"$sum": 1}, "students": {"$addToSet": "$user_id"}, "last_seen": {"$max": "$timestamp"}}},
            {"$sort": {"last_seen": -1}},
            {"$skip": (page - 1) * limit},
            {"$limit": limit},
        ]
    ).to_list(length=None)
    lesson_ids = [row["_id"] for row in rows if row.get("_id")]
    lesson_docs = await db.lessons.find({"lesson_id": {"$in": lesson_ids}}, {"_id": 0, "lesson_id": 1, "title": 1}).to_list(length=None)
    titles = {row["lesson_id"]: row.get("title") or row["lesson_id"] for row in lesson_docs}
    return {
        "page": page,
        "limit": limit,
        "lessons": [
            {
                "lesson_id": row.get("_id"),
                "title": titles.get(row.get("_id"), row.get("_id") or "Unknown lesson"),
                "event_count": _safe_int(row.get("events")),
                "students_attended": len(row.get("students") or []),
                "last_seen": row.get("last_seen"),
            }
            for row in rows
        ],
    }


@router.get("/students")
async def get_students_analytics_index(
    class_id: str | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    await _lesson_accessible(current_user, lesson_id, class_id)
    match = await _analytics_match(current_user=current_user, class_id=class_id, lesson_id=lesson_id)
    rows = await db.emotion_events.aggregate(
        [
            {"$match": match},
            {"$group": {"_id": "$user_id", "events": {"$sum": 1}, "last_seen": {"$max": "$timestamp"}, "avg_confidence": {"$avg": "$confidence"}}},
            {"$sort": {"last_seen": -1}},
        ]
    ).to_list(length=None)
    labels = await _student_labels([str(row["_id"]) for row in rows if row.get("_id")])
    students = []
    for row in rows:
        student_id = str(row.get("_id") or "")
        name = labels.get(student_id, student_id)
        if search and search.lower() not in name.lower() and search.lower() not in student_id.lower():
            continue
        students.append(
            {
                "student_id": student_id,
                "student_name": name,
                "event_count": _safe_int(row.get("events")),
                "average_engagement_score": round(_safe_float(row.get("avg_confidence")) * 100, 2),
                "last_seen": row.get("last_seen"),
            }
        )
    start = (page - 1) * limit
    return {"page": page, "limit": limit, "total": len(students), "students": students[start:start + limit]}


@router.get("/student/{student_id}")
async def get_student_analytics(
    student_id: str,
    class_id: str | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    await _lesson_accessible(current_user, lesson_id, class_id)
    match = await _analytics_match(
        current_user=current_user,
        class_id=class_id,
        lesson_id=lesson_id,
        student_id=student_id,
        start_at=start_at,
        end_at=end_at,
    )
    counts = await _emotion_counts(match)
    total = sum(counts.values())
    modality_rows = await db.emotion_events.aggregate(
        [{"$match": match}, {"$group": {"_id": {"modality": "$modality", "emotion": "$emotion_label"}, "count": {"$sum": 1}}}]
    ).to_list(length=None)
    modality_history = {"face": [], "text": [], "voice": []}
    for row in modality_rows:
        key = row.get("_id") or {}
        modality = key.get("modality")
        if modality in modality_history:
            modality_history[modality].append({"emotion": key.get("emotion") or "unknown", "count": _safe_int(row.get("count"))})
    attention_rows = await db.attention_events.aggregate(
        [
            {"$match": {k: v for k, v in {"user_id": student_id, "lesson_id": lesson_id, "timestamp": _date_match(start_at, end_at)}.items() if v}},
            {"$group": {"_id": "$state", "count": {"$sum": 1}}},
        ]
    ).to_list(length=None)
    attention_counts = {row["_id"]: _safe_int(row["count"]) for row in attention_rows if row.get("_id")}
    attention_total = sum(attention_counts.values())
    progress = await db.lesson_progress.find_one({k: v for k, v in {"user_id": student_id, "lesson_id": lesson_id, "class_id": class_id}.items() if v}, {"_id": 0})
    lesson_doc = await db.lessons.find_one({"lesson_id": lesson_id}, {"_id": 0, "title": 1}) if lesson_id else None
    voice_rows = await db.emotion_events.find({**match, "modality": "voice"}, {"_id": 0, "timestamp": 1, "emotion_label": 1, "extra": 1}).sort("timestamp", -1).limit(20).to_list(length=None)
    return {
        "student_id": student_id,
        "student_name": (await _student_labels([student_id])).get(student_id, student_id),
        "lesson_id": lesson_id or "all",
        "class_id": class_id or "all",
        "engagement": round(_safe_float(progress.get("completion_percent") if progress else 0) * 0.35 + _percent(attention_counts.get("focused", 0), attention_total) * 0.65, 2),
        "attention": _percent(attention_counts.get("focused", 0), attention_total),
        "completion": _safe_float((progress or {}).get("completion_percent"), default=0.0),
        "dominant_emotion": _dominant(counts),
        "confusion_frequency": counts.get("confusion", 0),
        "boredom_frequency": counts.get("boredom", 0),
        "webcam_activity_events": sum(item["count"] for item in modality_history["face"]),
        "audio_sentiment_events": sum(item["count"] for item in modality_history["voice"]),
        "attendance_percentage": 100.0 if total else 0.0,
        "emotion_percentages": {key: _percent(value, total) for key, value in counts.items()},
        "modality_history": modality_history,
        "timeline": await _timeline(match),
        "session_history": [
            {
                "date": (progress or {}).get("updated_at") or _utc_now(),
                "lesson_name": (lesson_doc or {}).get("title") or lesson_id or "All lessons",
                "duration": round(_safe_int((progress or {}).get("watched_time_sec")) / 60, 1),
                "dominant_emotion": _dominant(counts),
                "attention": _percent(attention_counts.get("focused", 0), attention_total),
                "completion": _safe_float((progress or {}).get("completion_percent"), default=0.0),
                "transcript_summary": "; ".join(str((row.get("extra") or {}).get("transcript") or (row.get("extra") or {}).get("feedback") or "").strip() for row in voice_rows[:3] if row.get("extra")) or "No audio transcript captured.",
            }
        ],
    }


@router.get("/student/{student_id}/history")
async def get_student_emotion_history(
    student_id: str,
    lesson_id: str | None = Query(default=None),
    class_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    teacher_user: dict = Depends(require_teacher),
):
    return await get_student_analytics(
        student_id=student_id,
        class_id=class_id,
        lesson_id=lesson_id,
        start_at=start_at,
        end_at=end_at,
        current_user=teacher_user,
    )


@router.get("/realtime")
async def get_realtime_analytics(
    live_session_id: str | None = Query(default=None),
    class_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    await _live_accessible(current_user, live_session_id)
    since = _utc_now() - timedelta(minutes=5)
    match = await _analytics_match(current_user=current_user, class_id=class_id, live_session_id=live_session_id, start_at=since)
    counts = await _emotion_counts(match)
    total = sum(counts.values())
    participant_match = {"is_active": True}
    if live_session_id:
        participant_match["live_session_id"] = live_session_id
    active_students = await db.live_participants.count_documents({**participant_match, "role": "student"})
    camera_events = await db.emotion_events.count_documents({**match, "modality": "face"})
    mic_events = await db.emotion_events.count_documents({**match, "modality": "voice"})
    attention_score = _percent(total - counts.get("confusion", 0) - counts.get("boredom", 0), total)
    return {
        "generated_at": _utc_now(),
        "current_attention_score": attention_score,
        "live_emotion_counts": counts,
        "active_students": active_students,
        "active_cameras": camera_events,
        "active_microphones": mic_events,
        "low_engagement_alerts": max(0, counts.get("boredom", 0) + counts.get("frustration", 0)),
        "confusion_alerts": counts.get("confusion", 0),
        "timeline": await _timeline(match, limit=60),
    }


@router.get("/attendance")
async def get_attendance_analytics(
    class_id: str | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    await _lesson_accessible(current_user, lesson_id, class_id)
    progress_match = {k: v for k, v in {"class_id": class_id, "lesson_id": lesson_id}.items() if v}
    rows = await db.lesson_progress.aggregate(
        [
            {"$match": progress_match},
            {
                "$group": {
                    "_id": "$lesson_id",
                    "attended": {"$addToSet": "$user_id"},
                    "completed": {"$sum": {"$cond": [{"$gte": ["$completion_percent", 100]}, 1, 0]}},
                    "avg_completion": {"$avg": "$completion_percent"},
                }
            },
        ]
    ).to_list(length=None)
    return {
        "lessons": [
            {
                "lesson_id": row.get("_id"),
                "students_attended": len(row.get("attended") or []),
                "completed": _safe_int(row.get("completed")),
                "average_completion": round(_safe_float(row.get("avg_completion")), 2),
            }
            for row in rows
        ]
    }


@router.get("/emotions")
async def get_emotion_trends(
    class_id: str | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    await _lesson_accessible(current_user, lesson_id, class_id)
    match = await _analytics_match(current_user=current_user, class_id=class_id, lesson_id=lesson_id, start_at=start_at, end_at=end_at)
    counts = await _emotion_counts(match)
    total = sum(counts.values())
    return {"emotion_counts": counts, "emotion_percentages": {key: _percent(value, total) for key, value in counts.items()}, "timeline": await _timeline(match)}


@router.get("/export")
async def export_analytics_report(
    class_id: str | None = Query(default=None),
    lesson_id: str | None = Query(default=None),
    student_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    await _lesson_accessible(current_user, lesson_id, class_id)
    match = await _analytics_match(current_user=current_user, class_id=class_id, lesson_id=lesson_id, student_id=student_id)
    rows = await db.emotion_events.find(match, {"_id": 0}).sort("timestamp", -1).limit(10000).to_list(length=None)
    stream = StringIO()
    writer = csv.DictWriter(stream, fieldnames=["timestamp", "class_id", "lesson_id", "user_id", "modality", "emotion_label", "confidence"])
    writer.writeheader()
    for row in rows:
        writer.writerow({key: row.get(key, "") for key in writer.fieldnames})
    stream.seek(0)
    filename = f"analytics-{lesson_id or class_id or student_id or 'report'}.csv"
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@router.get("/powerbi/embed-token")
async def get_powerbi_embed_token(
    report_id: str | None = Query(default=None),
    teacher_user: dict = Depends(require_teacher),
):
    tenant_id = settings.powerbi_tenant_id
    client_id = settings.powerbi_client_id
    client_secret = settings.powerbi_client_secret
    workspace_id = settings.powerbi_workspace_id
    resolved_report_id = report_id or settings.powerbi_report_id

    if not all([tenant_id, client_id, client_secret, workspace_id, resolved_report_id]):
        return {
            "configured": False,
            "accessToken": None,
            "embedUrl": None,
            "reportId": resolved_report_id,
            "message": "Power BI environment variables are not configured.",
        }

    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    async with httpx.AsyncClient(timeout=20.0) as client:
        aad_response = await client.post(
            token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
                "scope": "https://analysis.windows.net/powerbi/api/.default",
            },
        )
        if aad_response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Unable to authenticate with Power BI")
        aad_token = aad_response.json().get("access_token")

        report_response = await client.get(
            f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{resolved_report_id}",
            headers={"Authorization": f"Bearer {aad_token}"},
        )
        if report_response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Unable to load Power BI report metadata")
        report_payload = report_response.json()
        dataset_id = settings.powerbi_dataset_id or report_payload.get("datasetId")

        embed_response = await client.post(
            f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{resolved_report_id}/GenerateToken",
            headers={"Authorization": f"Bearer {aad_token}", "Content-Type": "application/json"},
            json={
                "accessLevel": "View",
                **({"datasets": [{"id": dataset_id}]} if dataset_id else {}),
            },
        )
        if embed_response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Unable to generate Power BI embed token")

    embed_payload = embed_response.json()
    return {
        "configured": True,
        "accessToken": embed_payload.get("token"),
        "embedUrl": report_payload.get("embedUrl"),
        "reportId": resolved_report_id,
        "datasetId": dataset_id,
        "expiresAt": embed_payload.get("expiration"),
        "tokenType": "Embed",
    }
