from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models import CourseReportResponse, SessionReportResponse
from app.services.report_service import report_service


router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/session/{session_id}", response_model=SessionReportResponse)
async def get_session_report(
    session_id: str,
) -> SessionReportResponse:
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session id")

    report = await report_service.build_session_report(session_id)
    if not report:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionReportResponse(**report)


@router.get("/course/{course_id}", response_model=CourseReportResponse)
async def get_course_report(
    course_id: str,
) -> CourseReportResponse:
    report = await report_service.build_course_report(course_id)
    return CourseReportResponse(**report)
