from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.dependencies import get_current_user
from app.models import SessionStartRequest, SessionStartResponse


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=SessionStartResponse)
async def start_session(
    payload: SessionStartRequest,
    current_user: dict = Depends(get_current_user),
) -> SessionStartResponse:
    now = datetime.now(timezone.utc)
    session_object_id = ObjectId()
    session_doc = {
        "_id": session_object_id,
        "session_id": str(session_object_id),
        "session_name": payload.session_name,
        "course": payload.course,
        "class_id": payload.class_id,
        "lesson_id": payload.lesson_id,
        "user_id": current_user["id"],
        "started_at": now,
        "ended_at": None,
        "watch_time_sec": 0,
        "created_by": current_user["email"],
        "created_at": now,
    }
    await db.sessions.insert_one(session_doc)
    session_doc["id"] = str(session_object_id)
    return SessionStartResponse(**session_doc)


@router.post("/{session_id}/log_emotion")
async def log_emotion(
    session_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
) -> dict:
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session id")

    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    payload = payload or {}
    log_doc = {
        "session_id": session_id,
        "student_id": payload.get("student_id", payload.get("user_id", "unknown")),
        "text": payload.get("text", ""),
        "emotion": payload.get("emotion", "neutral"),
        "scores": payload.get("scores", payload.get("probabilities", {})),
        "modality": payload.get("modality", payload.get("source", "unknown")),
        "lesson_id": payload.get("lesson_id"),
        "logged_by": current_user["email"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.emotion_logs.insert_one(log_doc)
    return {"message": "Emotion logged"}
