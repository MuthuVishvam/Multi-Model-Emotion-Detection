from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.dependencies import get_current_user
from app.models import EmotionLogRequest, SessionStartRequest, SessionStartResponse


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=SessionStartResponse)
async def start_session(
    payload: SessionStartRequest,
    current_user: dict = Depends(get_current_user),
) -> SessionStartResponse:
    now = datetime.now(timezone.utc)
    session_doc = {
        "session_name": payload.session_name,
        "course": payload.course,
        "started_by": current_user["email"],
        "created_at": now,
    }
    result = await db.sessions.insert_one(session_doc)
    session_doc["id"] = str(result.inserted_id)
    return SessionStartResponse(**session_doc)


@router.post("/{session_id}/log_emotion")
async def log_emotion(
    session_id: str,
    payload: EmotionLogRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session id")

    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    log_doc = {
        "session_id": session_id,
        "user_id": payload.user_id,
        "text": payload.text,
        "emotion": payload.emotion,
        "probabilities": payload.probabilities,
        "logged_by": current_user["email"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.emotion_logs.insert_one(log_doc)
    return {"message": "Emotion logged"}
