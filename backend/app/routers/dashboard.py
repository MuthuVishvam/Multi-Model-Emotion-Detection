from collections import Counter

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import db
from app.dependencies import get_current_user
from app.models import DashboardSummaryResponse


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_summary(
    session_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
) -> DashboardSummaryResponse:
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session id")

    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    logs = await db.emotion_logs.find({"session_id": session_id}).to_list(length=None)
    distribution = Counter(log.get("emotion", "unknown") for log in logs)

    return DashboardSummaryResponse(
        session_id=session_id,
        total_logs=len(logs),
        emotion_distribution=dict(distribution),
    )
