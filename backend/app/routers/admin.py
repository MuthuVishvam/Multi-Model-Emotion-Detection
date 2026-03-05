from fastapi import APIRouter, Depends

from app.dependencies import require_admin
from app.models import AdminClassOverviewResponse, AdminUserStatusResponse, TeacherAdminResponse
from app.services.admin_management import admin_management_service


router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/teachers/pending", response_model=list[TeacherAdminResponse])
async def list_pending_teachers() -> list[TeacherAdminResponse]:
    rows = await admin_management_service.list_pending_teachers()
    return [TeacherAdminResponse(**row) for row in rows]


@router.get("/teachers", response_model=list[TeacherAdminResponse])
async def list_teachers() -> list[TeacherAdminResponse]:
    rows = await admin_management_service.list_teachers()
    return [TeacherAdminResponse(**row) for row in rows]


@router.post("/teachers/{teacher_id}/approve", response_model=TeacherAdminResponse)
async def approve_teacher(teacher_id: str) -> TeacherAdminResponse:
    row = await admin_management_service.set_teacher_status(teacher_id=teacher_id, action="approve")
    return TeacherAdminResponse(**row)


@router.post("/teachers/{teacher_id}/reject", response_model=TeacherAdminResponse)
async def reject_teacher(teacher_id: str) -> TeacherAdminResponse:
    row = await admin_management_service.set_teacher_status(teacher_id=teacher_id, action="reject")
    return TeacherAdminResponse(**row)


@router.post("/users/{id}/disable", response_model=AdminUserStatusResponse)
async def disable_user(id: str) -> AdminUserStatusResponse:
    row = await admin_management_service.disable_user(id)
    return AdminUserStatusResponse(**row)


@router.get("/classes", response_model=list[AdminClassOverviewResponse])
async def list_classes() -> list[AdminClassOverviewResponse]:
    rows = await admin_management_service.list_classes_overview()
    return [AdminClassOverviewResponse(**row) for row in rows]
