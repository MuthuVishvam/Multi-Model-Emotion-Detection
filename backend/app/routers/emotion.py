from collections import defaultdict
from datetime import datetime, timezone
import logging

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
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
