from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.dependencies import get_current_user
from app.models import EmotionPredictRequest, EmotionPredictResponse
from app.services.emotion_predictor import predictor_service


router = APIRouter(prefix="/emotion", tags=["emotion"])


@router.post("/predict_text", response_model=EmotionPredictResponse)
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
            "created_at": timestamp,
            "logged_by": current_user["email"],
        }
    )

    return EmotionPredictResponse(emotion=emotion, scores=scores, timestamp=timestamp)
