from collections import defaultdict
from datetime import datetime, timezone
from io import BytesIO, StringIO
import logging
import csv

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from pydantic import ValidationError

from app.config import settings
from app.database import db
from app.dependencies import get_current_user
from app.models import (
    EmotionEventBatchRequest,
    EmotionPredictRequest,
    EmotionPredictResponse,
    EventBatchIngestResponse,
    FaceEmotionBatchRequest,
    TextEmotionMessageRequest,
    TextEmotionMessageResponse,
    VoiceEmotionUploadMeta,
    VoiceEmotionResponse,
)
from app.rate_limit import enforce_emotion_ingest_rate_limit
from app.services.emotion_event_analytics import emotion_event_analytics_service
from app.services.live_class_service import live_class_service
from app.services.emotion_predictor import predictor_service
from app.services.text_emotion_baseline import text_emotion_baseline_service
from app.services.voice_emotion_baseline import voice_emotion_baseline_service
from app.websocket.events import emit_lesson_emotion_update


router = APIRouter(
    prefix="/emotion",
    tags=["emotion"],
    dependencies=[Depends(get_current_user)],
)
batch_router = APIRouter(
    prefix="/emotions",
    tags=["emotion"],
    dependencies=[Depends(get_current_user)],
)
session_text_emotion_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
logger = logging.getLogger("emotion_backend")
NEGATIVE_LEARNING_EMOTIONS = {"confusion", "boredom", "stress", "frustration", "anger", "fear", "sadness"}
POSITIVE_LEARNING_EMOTIONS = {"happy", "happiness", "joy", "interest", "engaged", "calm", "surprise", "neutral"}


class EmotionTrackRequest(BaseModel):
    userId: str = Field(min_length=1)
    lessonId: str = Field(min_length=1)
    emotion: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: datetime | None = None
    classId: str | None = None
    courseId: str | None = None
    sessionId: str | None = None
    liveSessionId: str | None = None
    modality: str = "face"
    extra: dict = Field(default_factory=dict)


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


def _percent(value: int | float, total: int | float) -> float:
    return round((float(value) / float(total)) * 100.0, 2) if total else 0.0


def _dominant(counts: dict[str, int]) -> str:
    return max(counts, key=counts.get) if counts else "unknown"


def _parse_csv_filter(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip().lower() for item in value.split(",") if item.strip()]


def _time_query(start_at: datetime | None, end_at: datetime | None) -> dict:
    query: dict = {}
    if start_at:
        query["$gte"] = start_at
    if end_at:
        query["$lte"] = end_at
    return query


async def _emotion_scope(current_user: dict) -> dict:
    if current_user.get("role") == "admin":
        return {}
    user_id = str(current_user.get("id") or "")
    if current_user.get("role") == "student":
        return {"user_id": user_id}

    class_rows = await db.classes.find(
        {"teacher_id": user_id},
        {"_id": 0, "class_id": 1},
    ).to_list(length=None)
    class_ids = [row.get("class_id") for row in class_rows if row.get("class_id")]
    lesson_rows = await db.lessons.find(
        {"teacher_id": user_id},
        {"_id": 0, "lesson_id": 1},
    ).to_list(length=None)
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


async def _build_emotion_match(
    *,
    current_user: dict,
    class_id: str | None = None,
    lesson_id: str | None = None,
    student_id: str | None = None,
    emotions: str | None = None,
    confidence_threshold: float = 0.0,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
) -> dict:
    match = await _emotion_scope(current_user)
    if class_id:
        match["class_id"] = class_id
    if lesson_id:
        match["lesson_id"] = lesson_id
    if student_id:
        if current_user.get("role") == "student" and str(current_user.get("id")) != str(student_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students can only view personal analytics")
        match["user_id"] = student_id
    emotion_values = _parse_csv_filter(emotions)
    if emotion_values:
        match["emotion_label"] = {"$in": emotion_values}
    if confidence_threshold > 0:
        match["confidence"] = {"$gte": confidence_threshold}
    timestamp_query = _time_query(start_at, end_at)
    if timestamp_query:
        match["timestamp"] = timestamp_query
    return match


async def _emotion_counts(match: dict) -> dict[str, int]:
    rows = await db.emotion_events.aggregate(
        [
            {"$match": match},
            {"$group": {"_id": "$emotion_label", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
    ).to_list(length=None)
    return {str(row.get("_id")): _safe_int(row.get("count")) for row in rows if row.get("_id")}


async def _workspace_timeline(match: dict, limit: int = 240) -> list[dict]:
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
                    "avg_engagement": {"$avg": "$engagement_score"},
                }
            },
            {
                "$group": {
                    "_id": "$_id.minute",
                    "total": {"$sum": "$count"},
                    "avg_confidence": {"$avg": "$avg_confidence"},
                    "engagement": {"$avg": "$avg_engagement"},
                    "emotions": {"$push": {"k": "$_id.emotion", "v": "$count"}},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "minute": "$_id",
                    "total": 1,
                    "avg_confidence": {"$round": ["$avg_confidence", 3]},
                    "engagement": {"$round": ["$engagement", 2]},
                    "emotions": {"$arrayToObject": "$emotions"},
                }
            },
            {"$sort": {"minute": 1}},
            {"$limit": limit},
        ]
    ).to_list(length=None)


async def _attention_counts(class_id: str | None, lesson_id: str | None, start_at: datetime | None, end_at: datetime | None) -> dict[str, int]:
    match = {}
    if class_id:
        match["class_id"] = class_id
    if lesson_id:
        match["lesson_id"] = lesson_id
    timestamp_query = _time_query(start_at, end_at)
    if timestamp_query:
        match["timestamp"] = timestamp_query
    rows = await db.attention_events.aggregate(
        [{"$match": match}, {"$group": {"_id": "$state", "count": {"$sum": 1}}}]
    ).to_list(length=None)
    return {str(row.get("_id")): _safe_int(row.get("count")) for row in rows if row.get("_id")}


async def _dashboard_payload(
    *,
    current_user: dict,
    class_id: str | None = None,
    lesson_id: str | None = None,
    student_id: str | None = None,
    emotions: str | None = None,
    confidence_threshold: float = 0.0,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
) -> dict:
    match = await _build_emotion_match(
        current_user=current_user,
        class_id=class_id,
        lesson_id=lesson_id,
        student_id=student_id,
        emotions=emotions,
        confidence_threshold=confidence_threshold,
        start_at=start_at,
        end_at=end_at,
    )
    counts = await _emotion_counts(match)
    total = sum(counts.values())
    negative_total = sum(counts.get(label, 0) for label in NEGATIVE_LEARNING_EMOTIONS)
    confusion = counts.get("confusion", 0) + counts.get("confused", 0)
    boredom = counts.get("boredom", 0) + counts.get("bored", 0)
    attention = await _attention_counts(class_id, lesson_id, start_at, end_at)
    attention_total = sum(attention.values())
    focused = attention.get("focused", 0)
    student_ids = await db.emotion_events.distinct("user_id", match)
    confidence_row = await db.emotion_events.aggregate(
        [{"$match": match}, {"$group": {"_id": None, "avg": {"$avg": "$confidence"}}}]
    ).to_list(length=1)
    avg_confidence = _safe_float((confidence_row[0] if confidence_row else {}).get("avg"))
    engagement_rate = round((_percent(total - negative_total, total) * 0.58) + (_percent(focused, attention_total) * 0.42), 2)
    timeline = await _workspace_timeline(match)
    heatmap_rows = await db.attention_events.aggregate(
        [
            {"$match": {k: v for k, v in {"class_id": class_id, "lesson_id": lesson_id, "timestamp": _time_query(start_at, end_at)}.items() if v}},
            {
                "$group": {
                    "_id": {
                        "student": "$user_id",
                        "minute": {
                            "$dateToString": {
                                "format": "%H:%M",
                                "date": "$timestamp",
                                "timezone": "UTC",
                            }
                        },
                        "state": "$state",
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id.minute": 1}},
            {"$limit": 500},
        ]
    ).to_list(length=None)
    heatmap: dict[str, dict[str, int]] = {}
    for row in heatmap_rows:
        key = row.get("_id") or {}
        student = str(key.get("student") or "unknown")
        minute = str(key.get("minute") or "")
        state = str(key.get("state") or "focused")
        heatmap.setdefault(student, {})
        heatmap[student][minute] = max(0, 100 - (35 if state in {"idle", "tab_hidden", "no_face_detected"} else 0))

    class_rows = await db.emotion_events.aggregate(
        [
            {"$match": match},
            {"$group": {"_id": "$class_id", "events": {"$sum": 1}, "engagement": {"$avg": "$engagement_score"}, "students": {"$addToSet": "$user_id"}}},
            {"$sort": {"events": -1}},
            {"$limit": 12},
        ]
    ).to_list(length=None)

    spikes = []
    for bucket in timeline:
        emotions_map = bucket.get("emotions") or {}
        spike_count = sum(_safe_int(emotions_map.get(label)) for label in ["confusion", "boredom", "stress", "frustration"])
        if spike_count:
            spikes.append({"minute": bucket.get("minute"), "severity": min(100, spike_count * 12), "label": "Confusion or disengagement spike", "count": spike_count})

    return {
        "generated_at": datetime.now(timezone.utc),
        "filters": {
            "class_id": class_id,
            "lesson_id": lesson_id,
            "student_id": student_id,
            "emotions": _parse_csv_filter(emotions),
            "confidence_threshold": confidence_threshold,
        },
        "kpis": {
            "average_engagement": engagement_rate,
            "confusion_rate": _percent(confusion, total),
            "attention_span": _percent(focused, attention_total),
            "boredom_rate": _percent(boredom, total),
            "active_students": len(student_ids),
            "emotion_accuracy": round(avg_confidence * 100, 2),
        },
        "emotion_distribution": [{"emotion": key, "count": value, "percentage": _percent(value, total)} for key, value in counts.items()],
        "emotion_counts": counts,
        "attention_counts": attention,
        "engagement_trend": timeline,
        "heatmap": [{"student_id": student, "slots": slots} for student, slots in heatmap.items()],
        "radar": [
            {"metric": "Engagement", "value": engagement_rate},
            {"metric": "Attention", "value": _percent(focused, attention_total)},
            {"metric": "Clarity", "value": max(0, 100 - _percent(confusion, total))},
            {"metric": "Energy", "value": max(0, 100 - _percent(boredom, total))},
            {"metric": "Confidence", "value": round(avg_confidence * 100, 2)},
        ],
        "class_comparison": [
            {
                "class_id": row.get("_id") or "unassigned",
                "events": _safe_int(row.get("events")),
                "engagement": round(_safe_float(row.get("engagement")), 2),
                "students": len(row.get("students") or []),
            }
            for row in class_rows
        ],
        "spikes": spikes[-20:],
        "live_stream": [
            {
                "timestamp": row.get("timestamp"),
                "student_id": row.get("user_id"),
                "lesson_id": row.get("lesson_id"),
                "emotion": row.get("emotion_label"),
                "confidence": row.get("confidence"),
                "modality": row.get("modality"),
            }
            for row in await db.emotion_events.find(match, {"_id": 0}).sort("timestamp", -1).limit(25).to_list(length=None)
        ],
    }


def _report_from_payload(payload: dict, report_type: str = "teacher") -> dict:
    kpis = payload.get("kpis") or {}
    spikes = payload.get("spikes") or []
    distribution = payload.get("emotion_distribution") or []
    dominant = distribution[0]["emotion"] if distribution else "unknown"
    engagement = _safe_float(kpis.get("average_engagement"))
    attention = _safe_float(kpis.get("attention_span"))
    confusion = _safe_float(kpis.get("confusion_rate"))
    boredom = _safe_float(kpis.get("boredom_rate"))
    score = round(max(0, min(10, (engagement * 0.45 + attention * 0.35 + (100 - confusion - boredom) * 0.2) / 10)), 1)
    concise = (
        f"Students showed {engagement:.1f}% average engagement with {attention:.1f}% focused attention. "
        f"The dominant emotion was {dominant}. Confusion reached {confusion:.1f}% and boredom reached {boredom:.1f}%. "
        f"{len(spikes)} notable confusion or disengagement spikes were detected. Overall lesson effectiveness score: {score}/10."
    )
    technical = (
        f"Analytics model processed {sum(item.get('count', 0) for item in distribution)} emotion events. "
        f"Negative learning-signal rate is {(confusion + boredom):.1f}% across confusion and boredom. "
        f"Emotion confidence averaged {_safe_float(kpis.get('emotion_accuracy')):.1f}%. "
        "Review spike timestamps and modality-specific distribution before reteaching the lowest-performing segment."
    )
    student = (
        "Your class stayed engaged through most of the lesson. Some parts may need another pass, "
        "especially where confusion increased. Rewatch the difficult segment and add one short reflection."
    )
    return {
        "type": report_type,
        "effectiveness_score": score,
        "concise_teacher_summary": concise,
        "technical_analytics_report": technical,
        "student_friendly_feedback": student,
        "recommendations": [
            "Open the confusion spike timeline and review the lesson segment near the highest spike.",
            "Use a quick formative question after dense concepts to separate confusion from low confidence.",
            "Follow up with students who show repeated idle or no-face attention signals.",
        ],
        "alerts": [
            {"level": "high" if item.get("severity", 0) >= 60 else "medium", "message": item.get("label"), "minute": item.get("minute")}
            for item in spikes[-5:]
        ],
    }


@router.post(
    "/predict_text",
    response_model=EmotionPredictResponse,
    dependencies=[Depends(enforce_emotion_ingest_rate_limit)],
)
async def predict_text_emotion(
    payload: EmotionPredictRequest,
    current_user: dict = Depends(get_current_user),
) -> EmotionPredictResponse:
    if not ObjectId.is_valid(payload.session_id):
        raise HTTPException(status_code=400, detail="Invalid session id")

    session = await db.sessions.find_one({"_id": ObjectId(payload.session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        emotion, scores = predictor_service.predict(payload.text)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    timestamp = datetime.now(timezone.utc)
    await db.emotion_logs.insert_one(
        {
            "session_id": payload.session_id,
            "student_id": payload.student_id,
            "text": payload.text,
            "emotion": emotion,
            "scores": scores,
            "modality": payload.modality or "text",
            "lesson_id": payload.lesson_id,
            "created_at": timestamp,
            "logged_by": current_user["email"],
        }
    )
    await emotion_event_analytics_service.ingest_emotion_events(
        events=[
            {
                "user_id": payload.student_id,
                "teacher_id": current_user.get("id") if current_user.get("role") == "teacher" else None,
                "class_id": None,
                "course_id": None,
                "lesson_id": payload.lesson_id or "unknown",
                "session_id": payload.session_id,
                "modality": payload.modality or "text",
                "emotion_label": emotion,
                "confidence": float(scores.get(emotion, 0.0)) if isinstance(scores, dict) else 0.0,
                "timestamp": timestamp,
                "extra": {"text_length": len(payload.text or ""), "text": payload.text},
            }
        ],
        current_user=current_user,
    )

    return EmotionPredictResponse(emotion=emotion, scores=scores, timestamp=timestamp)


@batch_router.post(
    "/track",
    response_model=EventBatchIngestResponse,
    dependencies=[Depends(enforce_emotion_ingest_rate_limit)],
)
async def track_emotion_event(
    payload: EmotionTrackRequest,
    current_user: dict = Depends(get_current_user),
) -> EventBatchIngestResponse:
    timestamp = payload.timestamp or datetime.now(timezone.utc)
    event = {
        "user_id": payload.userId,
        "teacher_id": current_user.get("id") if current_user.get("role") == "teacher" else None,
        "class_id": (payload.classId or "").strip() or None,
        "course_id": (payload.courseId or "").strip() or None,
        "lesson_id": payload.lessonId,
        "session_id": (payload.sessionId or "").strip() or None,
        "live_session_id": (payload.liveSessionId or "").strip() or None,
        "modality": (payload.modality or "face").strip() or "face",
        "emotion_label": payload.emotion,
        "confidence": payload.confidence,
        "engagement_score": round(payload.confidence * 100.0, 2),
        "timestamp": timestamp,
        "extra": payload.extra or {},
    }
    result = await emotion_event_analytics_service.ingest_emotion_events(
        events=[event],
        current_user=current_user,
    )
    await emit_lesson_emotion_update(event)
    return EventBatchIngestResponse(**result)


@batch_router.get("/analytics")
async def get_emotion_analytics_workspace(
    class_id: str | None = None,
    lesson_id: str | None = None,
    student_id: str | None = None,
    emotions: str | None = None,
    confidence_threshold: float = 0.0,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return await _dashboard_payload(
        current_user=current_user,
        class_id=class_id,
        lesson_id=lesson_id,
        student_id=student_id,
        emotions=emotions,
        confidence_threshold=confidence_threshold,
        start_at=start_at,
        end_at=end_at,
    )


@batch_router.get("/summary")
async def get_emotion_summary_workspace(
    class_id: str | None = None,
    lesson_id: str | None = None,
    student_id: str | None = None,
    emotions: str | None = None,
    confidence_threshold: float = 0.0,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    current_user: dict = Depends(get_current_user),
) -> dict:
    payload = await _dashboard_payload(
        current_user=current_user,
        class_id=class_id,
        lesson_id=lesson_id,
        student_id=student_id,
        emotions=emotions,
        confidence_threshold=confidence_threshold,
        start_at=start_at,
        end_at=end_at,
    )
    return {"generated_at": payload["generated_at"], "summary": _report_from_payload(payload)}


@batch_router.get("/report")
async def get_emotion_report_workspace(
    class_id: str | None = None,
    lesson_id: str | None = None,
    student_id: str | None = None,
    report_type: str = "teacher",
    emotions: str | None = None,
    confidence_threshold: float = 0.0,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    current_user: dict = Depends(get_current_user),
) -> dict:
    payload = await _dashboard_payload(
        current_user=current_user,
        class_id=class_id,
        lesson_id=lesson_id,
        student_id=student_id,
        emotions=emotions,
        confidence_threshold=confidence_threshold,
        start_at=start_at,
        end_at=end_at,
    )
    report = _report_from_payload(payload, report_type=report_type)
    return {"generated_at": payload["generated_at"], "report": report, "source": payload}


@batch_router.get("/live")
async def get_emotion_live_workspace(
    class_id: str | None = None,
    lesson_id: str | None = None,
    current_user: dict = Depends(get_current_user),
) -> dict:
    payload = await _dashboard_payload(
        current_user=current_user,
        class_id=class_id,
        lesson_id=lesson_id,
        start_at=None,
        end_at=None,
    )
    return {
        "generated_at": payload["generated_at"],
        "health": payload["kpis"]["average_engagement"],
        "active_students": payload["kpis"]["active_students"],
        "stream": payload["live_stream"],
        "timeline": payload["engagement_trend"][-60:],
        "alerts": _report_from_payload(payload).get("alerts", []),
    }


@batch_router.get("/alerts")
async def get_emotion_alerts_workspace(
    class_id: str | None = None,
    lesson_id: str | None = None,
    current_user: dict = Depends(get_current_user),
) -> dict:
    payload = await _dashboard_payload(
        current_user=current_user,
        class_id=class_id,
        lesson_id=lesson_id,
    )
    report = _report_from_payload(payload)
    alerts = report["alerts"]
    if payload["kpis"]["confusion_rate"] >= 25:
        alerts.insert(0, {"level": "high", "message": "Confusion rate is above the recommended threshold.", "minute": None})
    if payload["kpis"]["boredom_rate"] >= 20:
        alerts.insert(0, {"level": "medium", "message": "Boredom is trending high for this filter set.", "minute": None})
    return {"generated_at": payload["generated_at"], "alerts": alerts}


@batch_router.get("/export")
async def export_emotion_workspace(
    class_id: str | None = None,
    lesson_id: str | None = None,
    student_id: str | None = None,
    format: str = "csv",
    current_user: dict = Depends(get_current_user),
):
    payload = await _dashboard_payload(
        current_user=current_user,
        class_id=class_id,
        lesson_id=lesson_id,
        student_id=student_id,
    )
    if format.lower() == "pdf":
        report = _report_from_payload(payload)
        text = "\n\n".join(
            [
                "MELD AI Learning Intelligence Report",
                report["concise_teacher_summary"],
                report["technical_analytics_report"],
                "Recommendations:",
                *[f"- {item}" for item in report["recommendations"]],
            ]
        )
        return Response(
            content=text.encode("utf-8"),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="meld-analytics-report.pdf"'},
        )

    stream = StringIO()
    writer = csv.DictWriter(stream, fieldnames=["metric", "value"])
    writer.writeheader()
    for key, value in (payload.get("kpis") or {}).items():
        writer.writerow({"metric": key, "value": value})
    for item in payload.get("emotion_distribution") or []:
        writer.writerow({"metric": f"emotion_{item['emotion']}", "value": item["count"]})
    stream.seek(0)
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="meld-analytics-export.csv"'},
    )


@batch_router.post(
    "/batch",
    response_model=EventBatchIngestResponse,
    dependencies=[Depends(enforce_emotion_ingest_rate_limit)],
)
async def batch_emotion_events(
    payload: FaceEmotionBatchRequest | EmotionEventBatchRequest,
    current_user: dict = Depends(get_current_user),
) -> EventBatchIngestResponse:
    # Backward compatibility: keep old face-only payload support while accepting the new unified schema.
    if isinstance(payload, EmotionEventBatchRequest):
        unified_events = [event.model_dump() for event in payload.events]
        result = await emotion_event_analytics_service.ingest_emotion_events(
            events=unified_events,
            current_user=current_user,
        )
        for event in unified_events[-25:]:
            await emit_lesson_emotion_update(event)
        logger.info(
            "Emotion batch ingested (unified) actor=%s inserted=%s skipped=%s",
            current_user.get("email"),
            result.get("inserted_count", 0),
            result.get("skipped_count", 0),
        )
        return EventBatchIngestResponse(**result)

    events = payload.events or []
    if not events:
        return EventBatchIngestResponse(inserted_count=0, skipped_count=0)

    valid_session_object_ids: list[ObjectId] = []
    session_id_lookup: dict[str, ObjectId] = {}
    invalid_session_ids: set[str] = set()
    skipped_count = 0

    for event in events:
        if not ObjectId.is_valid(event.sessionId):
            invalid_session_ids.add(event.sessionId)
            continue
        if event.sessionId in session_id_lookup:
            continue
        object_id = ObjectId(event.sessionId)
        session_id_lookup[event.sessionId] = object_id
        valid_session_object_ids.append(object_id)

    existing_session_ids: set[str] = set()
    if valid_session_object_ids:
        existing_sessions = await db.sessions.find({"_id": {"$in": valid_session_object_ids}}).to_list(length=None)
        existing_session_ids = {str(session["_id"]) for session in existing_sessions}

    now = datetime.now(timezone.utc)
    docs: list[dict] = []
    for event in events:
        if event.sessionId in invalid_session_ids:
            skipped_count += 1
            continue
        if event.sessionId not in existing_session_ids:
            skipped_count += 1
            continue

        docs.append(
            {
                "session_id": event.sessionId,
                "student_id": event.userId,
                "course_id": event.courseId,
                "lesson_id": event.lessonId,
                "text": "[face_capture_batch]",
                "emotion": event.emotion,
                "confidence": event.confidence,
                "scores": {"confidence": event.confidence},
                "modality": "face",
                "client_timestamp": event.timestamp,
                "logged_by": current_user["email"],
                "created_at": now,
            }
        )

    if docs:
        await db.emotion_logs.insert_many(docs)

    unified_events = [
        {
            "user_id": event.userId,
            "teacher_id": current_user.get("id") if current_user.get("role") == "teacher" else None,
            "class_id": None,
            "course_id": event.courseId,
            "lesson_id": event.lessonId or "unknown",
            "session_id": event.sessionId,
            "modality": "face",
            "emotion_label": event.emotion,
            "confidence": event.confidence,
            "timestamp": event.timestamp,
            "extra": {"face_detected": True, "faces_count": 1},
        }
        for event in events
        if event.sessionId in existing_session_ids and event.sessionId not in invalid_session_ids
    ]
    unified_result = await emotion_event_analytics_service.ingest_emotion_events(
        events=unified_events,
        current_user=current_user,
    )
    for event in unified_events[-25:]:
        await emit_lesson_emotion_update(event)
    logger.info(
        "Emotion batch ingested (face-legacy) actor=%s inserted=%s skipped=%s",
        current_user.get("email"),
        unified_result.get("inserted_count", 0),
        skipped_count + unified_result.get("skipped_count", 0),
    )
    return EventBatchIngestResponse(
        inserted_count=unified_result.get("inserted_count", 0),
        skipped_count=skipped_count + unified_result.get("skipped_count", 0),
    )


@batch_router.post(
    "/text",
    response_model=TextEmotionMessageResponse,
    dependencies=[Depends(enforce_emotion_ingest_rate_limit)],
)
async def detect_text_emotion_for_message(
    payload: TextEmotionMessageRequest,
    current_user: dict = Depends(get_current_user),
) -> TextEmotionMessageResponse:
    session_id = (payload.sessionId or "").strip() or None
    live_session_id = (payload.liveSessionId or "").strip() or None
    if not session_id and not live_session_id:
        raise HTTPException(status_code=422, detail="sessionId or liveSessionId is required")

    class_id = (payload.classId or "").strip() or None
    lesson_id = (payload.lessonId or "").strip()
    live_class: dict | None = None

    if session_id:
        if not ObjectId.is_valid(session_id):
            raise HTTPException(status_code=400, detail="Invalid session id")
        session = await db.sessions.find_one({"_id": ObjectId(session_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    elif live_session_id:
        live_class = await live_class_service.get_live_class_for_user(
            live_session_id=live_session_id,
            current_user=current_user,
        )
        if not class_id:
            class_id = (live_class.get("class_id") or "").strip() or None
        if not lesson_id:
            lesson_id = (live_class.get("lesson_id") or "").strip()

    if not lesson_id:
        if live_session_id:
            lesson_id = f"live:{live_session_id}"
        else:
            raise HTTPException(status_code=422, detail="lessonId is required")

    prediction = text_emotion_baseline_service.predict(payload.text)
    counts_key = session_id or live_session_id or "unknown"
    session_text_emotion_counts[counts_key][prediction.emotion] += 1
    created_at = datetime.now(timezone.utc)

    comment_doc = {
        "user_id": payload.userId,
        "lesson_id": lesson_id,
        "class_id": class_id,
        "session_id": session_id,
        "live_session_id": live_session_id,
        "text": payload.text,
        "predicted_emotion": prediction.emotion,
        "confidence": prediction.confidence,
        "created_at": created_at,
    }
    if live_session_id:
        comment_result = await db.live_chat.insert_one(comment_doc)
    else:
        comment_result = await db.comments.insert_one(comment_doc)

    await db.emotion_logs.insert_one(
        {
            "session_id": session_id,
            "live_session_id": live_session_id,
            "student_id": payload.userId,
            "course_id": payload.courseId,
            "lesson_id": lesson_id,
            "class_id": class_id,
            "text": payload.text,
            "emotion": prediction.emotion,
            "confidence": prediction.confidence,
            "scores": {"confidence": prediction.confidence},
            "modality": "text_command",
            "client_timestamp": payload.timestamp,
            "suggestion": prediction.suggestion,
            "session_text_emotion_counts": dict(session_text_emotion_counts[counts_key]),
            "logged_by": current_user["email"],
            "created_at": created_at,
        }
    )
    await emotion_event_analytics_service.ingest_emotion_events(
        events=[
            {
                "user_id": payload.userId,
                "teacher_id": current_user.get("id") if current_user.get("role") == "teacher" else None,
                "class_id": class_id,
                "course_id": payload.courseId,
                "lesson_id": lesson_id,
                "session_id": session_id,
                "live_session_id": live_session_id,
                "modality": "text",
                "emotion_label": prediction.emotion,
                "confidence": prediction.confidence,
                "timestamp": payload.timestamp,
                "extra": {
                    "text_length": len(payload.text or ""),
                    "text": payload.text,
                    "comment_id": str(comment_result.inserted_id),
                },
            }
        ],
        current_user=current_user,
    )
    await emit_lesson_emotion_update(
        {
            "user_id": payload.userId,
            "class_id": class_id,
            "lesson_id": lesson_id,
            "emotion_label": prediction.emotion,
            "confidence": prediction.confidence,
            "timestamp": payload.timestamp,
        }
    )
    logger.info(
        "Text emotion processed user_id=%s lesson_id=%s session_id=%s live_session_id=%s emotion=%s confidence=%.3f",
        payload.userId,
        lesson_id,
        session_id,
        live_session_id,
        prediction.emotion,
        float(prediction.confidence),
    )

    return TextEmotionMessageResponse(
        emotion=prediction.emotion,
        confidence=prediction.confidence,
        suggestion=prediction.suggestion,
        comment_id=str(comment_result.inserted_id),
        lesson_id=lesson_id,
        class_id=class_id,
        created_at=created_at,
    )


@batch_router.post(
    "/voice",
    response_model=VoiceEmotionResponse,
    dependencies=[Depends(enforce_emotion_ingest_rate_limit)],
)
async def detect_voice_emotion_for_feedback(
    userId: str = Form(...),
    courseId: str | None = Form(None),
    classId: str | None = Form(None),
    lessonId: str | None = Form(None),
    sessionId: str | None = Form(None),
    liveSessionId: str | None = Form(None),
    timestamp: str = Form(...),
    audio_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> VoiceEmotionResponse:
    normalized_user_id = (userId or "").strip()
    normalized_course_id = (courseId or "").strip() or None
    normalized_class_id = (classId or "").strip() or None
    normalized_lesson_id = (lessonId or "").strip() or None
    normalized_session_id = (sessionId or "").strip() or None
    normalized_live_session_id = (liveSessionId or "").strip() or None

    try:
        payload = VoiceEmotionUploadMeta(
            userId=normalized_user_id,
            courseId=normalized_course_id,
            classId=normalized_class_id,
            lessonId=normalized_lesson_id,
            sessionId=normalized_session_id,
            liveSessionId=normalized_live_session_id,
            timestamp=timestamp,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc

    session_id = (payload.sessionId or "").strip() or None
    live_session_id = (payload.liveSessionId or "").strip() or None
    if not session_id and not live_session_id:
        raise HTTPException(status_code=422, detail="sessionId or liveSessionId is required")

    lesson_id = (payload.lessonId or "").strip()
    class_id = (payload.classId or "").strip() or None

    if session_id:
        if not ObjectId.is_valid(session_id):
            raise HTTPException(status_code=400, detail="Invalid session id")
        session = await db.sessions.find_one({"_id": ObjectId(session_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    elif live_session_id:
        live_class = await live_class_service.get_live_class_for_user(
            live_session_id=live_session_id,
            current_user=current_user,
        )
        if live_class.get("status") == "ended":
            raise HTTPException(status_code=400, detail="Live class has ended")
        if not class_id:
            class_id = (live_class.get("class_id") or "").strip() or None
        if not lesson_id:
            lesson_id = (live_class.get("lesson_id") or "").strip()

    if not lesson_id:
        if live_session_id:
            lesson_id = f"live:{live_session_id}"
        else:
            raise HTTPException(status_code=422, detail="lessonId is required")

    audio_content_type_raw = (audio_file.content_type or "").lower().strip()
    audio_content_type = audio_content_type_raw.split(";", 1)[0].strip() if audio_content_type_raw else ""
    if audio_content_type and audio_content_type not in settings.allowed_audio_content_types:
        raise HTTPException(status_code=400, detail="Unsupported audio format")

    audio_bytes = await audio_file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(audio_bytes) > settings.max_voice_upload_bytes:
        raise HTTPException(status_code=413, detail="Audio file is too large")

    try:
        prediction = voice_emotion_baseline_service.predict_from_bytes(
            audio_bytes=audio_bytes,
            filename=audio_file.filename or "feedback.wav",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    logger.info(
        "Voice emotion processed userId=%s sessionId=%s liveSessionId=%s emotion=%s confidence=%.3f",
        payload.userId,
        session_id,
        live_session_id,
        prediction.emotion,
        prediction.confidence,
    )
    created_at = datetime.now(timezone.utc)
    original_name = (audio_file.filename or "feedback.wav").strip() or "feedback.wav"
    safe_name = original_name.replace(" ", "_")
    file_scope_id = live_session_id or session_id or "unknown"
    file_ref = f"voice_feedback/{file_scope_id}/{int(created_at.timestamp())}_{safe_name}"

    voice_feedback_doc = {
        "user_id": payload.userId,
        "lesson_id": lesson_id,
        "class_id": class_id,
        "session_id": session_id,
        "live_session_id": live_session_id,
        "file_ref": file_ref,
        "predicted_emotion": prediction.emotion,
        "confidence": prediction.confidence,
        "created_at": created_at,
    }
    voice_feedback_result = await db.voice_feedback.insert_one(voice_feedback_doc)

    await db.emotion_logs.insert_one(
        {
            "session_id": session_id,
            "live_session_id": live_session_id,
            "student_id": payload.userId,
            "course_id": payload.courseId,
            "lesson_id": lesson_id,
            "class_id": class_id,
            "text": "[voice_feedback]",
            "emotion": prediction.emotion,
            "confidence": prediction.confidence,
            "scores": prediction.scores,
            "audio_features": prediction.features,
            "audio_meta": {
                "content_type": audio_content_type_raw or audio_content_type,
                "size_bytes": len(audio_bytes),
            },
            "modality": "voice",
            # Store extracted features + prediction only; never persist raw audio bytes.
            "client_timestamp": payload.timestamp,
            "logged_by": current_user["email"],
            "file_ref": file_ref,
            "created_at": created_at,
        }
    )
    await emotion_event_analytics_service.ingest_emotion_events(
        events=[
            {
                "user_id": payload.userId,
                "teacher_id": current_user.get("id") if current_user.get("role") == "teacher" else None,
                "class_id": class_id,
                "course_id": payload.courseId,
                "lesson_id": lesson_id,
                "session_id": session_id,
                "live_session_id": live_session_id,
                "modality": "voice",
                "emotion_label": prediction.emotion,
                "confidence": prediction.confidence,
                "timestamp": payload.timestamp,
                "extra": {
                    "audio_duration": prediction.features.get("duration_seconds") or prediction.features.get("duration_sec"),
                    "audio_size_bytes": len(audio_bytes),
                    "feedback_text": "[voice_feedback]",
                    "file_ref": file_ref,
                    "feedback_id": str(voice_feedback_result.inserted_id),
                },
            }
        ],
        current_user=current_user,
    )
    await emit_lesson_emotion_update(
        {
            "user_id": payload.userId,
            "class_id": class_id,
            "lesson_id": lesson_id,
            "emotion_label": prediction.emotion,
            "confidence": prediction.confidence,
            "timestamp": payload.timestamp,
        }
    )

    return VoiceEmotionResponse(
        emotion=prediction.emotion,
        confidence=prediction.confidence,
        feedback_id=str(voice_feedback_result.inserted_id),
        lesson_id=lesson_id,
        class_id=class_id,
        file_ref=file_ref,
        created_at=created_at,
    )
