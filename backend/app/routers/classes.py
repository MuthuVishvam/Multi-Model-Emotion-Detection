from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user, require_teacher
from app.models import (
    ClassCreateRequest,
    ClassDetailResponse,
    ClassInviteRequest,
    ClassInviteResponse,
    ClassJoinRequest,
    ClassResponse,
    LessonManageResponse,
)
from app.services.class_management import class_management_service
from app.services.lesson_management import lesson_management_service


router = APIRouter(prefix="/classes", tags=["classes"])


@router.post("", response_model=ClassResponse)
async def create_class(
    payload: ClassCreateRequest,
    teacher_user: dict = Depends(require_teacher),
) -> ClassResponse:
    result = await class_management_service.create_class(
        teacher_user=teacher_user,
        payload=payload.model_dump(),
    )
    return ClassResponse(**result)


@router.post("/join", response_model=ClassResponse)
async def join_class_by_code(
    payload: ClassJoinRequest,
    current_user: dict = Depends(get_current_user),
) -> ClassResponse:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student role required")

    result = await class_management_service.join_class(
        student_user=current_user,
        join_code=payload.join_code,
    )
    return ClassResponse(**result)


@router.get("/my", response_model=list[ClassResponse])
async def list_my_classes(current_user: dict = Depends(get_current_user)) -> list[ClassResponse]:
    rows = await class_management_service.list_my_classes(current_user)
    return [ClassResponse(**row) for row in rows]


@router.post("/{class_id}/invite", response_model=ClassInviteResponse)
async def invite_students_to_class(
    class_id: str,
    payload: ClassInviteRequest,
    teacher_user: dict = Depends(require_teacher),
) -> ClassInviteResponse:
    if not (payload.student_user_ids or payload.emails or payload.usernames):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one student_user_ids, emails, or usernames value",
        )
    result = await class_management_service.invite_students(
        teacher_user=teacher_user,
        class_id=class_id,
        payload=payload.model_dump(),
    )
    return ClassInviteResponse(**result)


@router.get("/{class_id}", response_model=ClassDetailResponse)
async def get_class_detail(class_id: str, current_user: dict = Depends(get_current_user)) -> ClassDetailResponse:
    result = await class_management_service.get_class_detail(user=current_user, class_id=class_id)
    return ClassDetailResponse(**result)


@router.get("/{class_id}/lessons", response_model=list[LessonManageResponse])
async def get_class_lessons(class_id: str, current_user: dict = Depends(get_current_user)) -> list[LessonManageResponse]:
    rows = await lesson_management_service.list_class_lessons(current_user=current_user, class_id=class_id)
    return [LessonManageResponse(**row) for row in rows]
