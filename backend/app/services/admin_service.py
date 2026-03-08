from __future__ import annotations

from app.services.admin_management import admin_management_service


class AdminService:
    async def list_pending_teachers(self) -> list[dict]:
        return await admin_management_service.list_pending_teachers()

    async def list_teachers(self) -> list[dict]:
        return await admin_management_service.list_teachers()

    async def approve_teacher(self, teacher_id: str) -> dict:
        return await admin_management_service.set_teacher_status(teacher_id=teacher_id, action="approve")

    async def reject_teacher(self, teacher_id: str) -> dict:
        return await admin_management_service.set_teacher_status(teacher_id=teacher_id, action="reject")

    async def disable_teacher(self, teacher_id: str) -> dict:
        return await admin_management_service.set_teacher_active(teacher_id=teacher_id, is_active=False)

    async def enable_teacher(self, teacher_id: str) -> dict:
        return await admin_management_service.set_teacher_active(teacher_id=teacher_id, is_active=True)

    async def disable_user(self, user_id: str) -> dict:
        return await admin_management_service.disable_user(user_id)

    async def list_classes_overview(self) -> list[dict]:
        return await admin_management_service.list_classes_overview()


admin_service = AdminService()


__all__ = ["admin_service", "AdminService"]
