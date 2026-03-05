import csv
import io

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.database import db
from app.dependencies import get_current_user
from app.models import DashboardSummaryResponse, StudentDashboardResponse, StudentStat
from app.services.analytics import (
    bucket_by_minute,
    build_student_stats,
    compute_confusion_index,
    compute_distribution,
    compute_engagement_score,
    compute_modality_counts,
    compute_modality_emotion_counts,
    compute_percentages,
)


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _validate_session_id(session_id: str) -> ObjectId:
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session id")
    return ObjectId(session_id)


async def _ensure_session_exists(session_id: str) -> None:
    session = await db.sessions.find_one({"_id": _validate_session_id(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_summary(
    session_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
) -> DashboardSummaryResponse:
    await _ensure_session_exists(session_id)
    logs = await db.emotion_logs.find({"session_id": session_id}).to_list(length=None)

    distribution = compute_distribution(logs)
    total = len(logs)

    return DashboardSummaryResponse(
        session_id=session_id,
        emotion_counts=dict(distribution),
        emotion_percentages=compute_percentages(distribution, total),
        modality_counts=dict(compute_modality_counts(logs)),
        modality_emotion_counts=compute_modality_emotion_counts(logs),
        engagement_score=compute_engagement_score(distribution, total),
        confusion_index=compute_confusion_index(distribution, total),
        timeline_buckets=bucket_by_minute(logs),
        student_stats=[StudentStat(**row) for row in build_student_stats(logs)],
    )


@router.get("/student", response_model=StudentDashboardResponse)
async def get_student_summary(
    session_id: str = Query(...),
    student_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
) -> StudentDashboardResponse:
    await _ensure_session_exists(session_id)
    logs = await db.emotion_logs.find({"session_id": session_id, "student_id": student_id}).to_list(length=None)

    distribution = compute_distribution(logs)

    return StudentDashboardResponse(
        session_id=session_id,
        student_id=student_id,
        timeline=bucket_by_minute(logs),
        emotion_distribution=dict(distribution),
    )


@router.get("/export_csv")
async def export_csv(
    session_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    await _ensure_session_exists(session_id)
    logs = await db.emotion_logs.find({"session_id": session_id}).sort("created_at", 1).to_list(length=None)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "student_id", "modality", "lesson_id", "text", "emotion"])

    for log in logs:
        created_at = log.get("created_at")
        timestamp = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at)
        writer.writerow([
            timestamp,
            log.get("student_id", ""),
            log.get("modality", ""),
            log.get("lesson_id", ""),
            log.get("text", ""),
            log.get("emotion", ""),
        ])

    output.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=session_{session_id}_emotion_logs.csv"}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)
