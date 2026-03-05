from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status

from app.dependencies import get_current_user, require_teacher
from app.models import LessonAssignRequest, LessonAssignmentResponse, LessonManageResponse
from app.services.lesson_management import lesson_management_service


router = APIRouter(prefix="/lessons", tags=["lessons"])


async def _extract_create_payload(
    request: Request,
    *,
    title: str | None,
    description: str | None,
    course_id: str | None,
    video_url: str | None,
    duration_sec: int | None,
    resources,
) -> dict:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        body = await request.json()
        return {
            "title": body.get("title"),
            "description": body.get("description"),
            "course_id": body.get("course_id") or body.get("course") or "live-classroom-studio",
            "video_url": body.get("video_url") or body.get("content"),
            "duration_sec": body.get("duration_sec"),
            "resources": body.get("resources", []),
        }

    return {
        "title": title,
        "description": description,
        "course_id": course_id,
        "video_url": video_url,
        "duration_sec": duration_sec,
        "resources": resources,
    }


async def _extract_update_payload(
    request: Request,
    *,
    title: str | None,
    description: str | None,
    course_id: str | None,
    video_url: str | None,
    duration_sec: int | None,
    resources,
) -> dict:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        body = await request.json()
        return {
            "title": body.get("title"),
            "description": body.get("description"),
            "course_id": body.get("course_id") or body.get("course"),
            "video_url": body.get("video_url") or body.get("content"),
            "duration_sec": body.get("duration_sec"),
            "resources": body.get("resources"),
        }

    return {
        "title": title,
        "description": description,
        "course_id": course_id,
        "video_url": video_url,
        "duration_sec": duration_sec,
        "resources": resources,
    }


@router.post("", response_model=LessonManageResponse)
async def create_lesson(
    request: Request,
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    course_id: str | None = Form(default=None),
    video_url: str | None = Form(default=None),
    duration_sec: int | None = Form(default=None),
    resources: str | None = Form(default=None),
    uploaded_file: UploadFile | None = File(default=None),
    teacher_user: dict = Depends(require_teacher),
) -> LessonManageResponse:
    payload = await _extract_create_payload(
        request,
        title=title,
        description=description,
        course_id=course_id,
        video_url=video_url,
        duration_sec=duration_sec,
        resources=resources,
    )
    result = await lesson_management_service.create_lesson(
        teacher_user=teacher_user,
        title=payload.get("title") or "",
        description=payload.get("description") or "",
        course_id=payload.get("course_id") or "",
        video_url=payload.get("video_url"),
        duration_sec=payload.get("duration_sec"),
        resources_raw=payload.get("resources"),
        uploaded_file=uploaded_file,
    )
    return LessonManageResponse(**result)


@router.put("/{lesson_id}", response_model=LessonManageResponse)
async def update_lesson(
    lesson_id: str,
    request: Request,
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    course_id: str | None = Form(default=None),
    video_url: str | None = Form(default=None),
    duration_sec: int | None = Form(default=None),
    resources: str | None = Form(default=None),
    uploaded_file: UploadFile | None = File(default=None),
    teacher_user: dict = Depends(require_teacher),
) -> LessonManageResponse:
    payload = await _extract_update_payload(
        request,
        title=title,
        description=description,
        course_id=course_id,
        video_url=video_url,
        duration_sec=duration_sec,
        resources=resources,
    )
    result = await lesson_management_service.update_lesson(
        teacher_user=teacher_user,
        lesson_id=lesson_id,
        title=payload.get("title"),
        description=payload.get("description"),
        course_id=payload.get("course_id"),
        video_url=payload.get("video_url"),
        duration_sec=payload.get("duration_sec"),
        resources_raw=payload.get("resources"),
        uploaded_file=uploaded_file,
    )
    return LessonManageResponse(**result)


@router.get("/my", response_model=list[LessonManageResponse])
async def list_my_lessons(teacher_user: dict = Depends(require_teacher)) -> list[LessonManageResponse]:
    rows = await lesson_management_service.list_teacher_lessons(teacher_user=teacher_user)
    return [LessonManageResponse(**row) for row in rows]


@router.post("/{lesson_id}/assign", response_model=list[LessonAssignmentResponse])
async def assign_lesson_to_classes(
    lesson_id: str,
    payload: LessonAssignRequest,
    teacher_user: dict = Depends(require_teacher),
) -> list[LessonAssignmentResponse]:
    if not payload.class_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="class_ids is required")
    rows = await lesson_management_service.assign_lesson_to_classes(
        teacher_user=teacher_user,
        lesson_id=lesson_id,
        class_ids=payload.class_ids,
        publish_at=payload.publish_at,
        due_at=payload.due_at,
        is_published=payload.is_published,
    )
    return [LessonAssignmentResponse(**row) for row in rows]


@router.get("", response_model=list[LessonManageResponse])
async def list_accessible_lessons(current_user: dict = Depends(get_current_user)) -> list[LessonManageResponse]:
    rows = await lesson_management_service.list_accessible_lessons(current_user=current_user)
    return [LessonManageResponse(**row) for row in rows]


@router.get("/{lesson_id}", response_model=LessonManageResponse)
async def get_lesson(
    lesson_id: str,
    class_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> LessonManageResponse:
    row = await lesson_management_service.get_lesson_for_user(
        current_user=current_user,
        lesson_id=lesson_id,
        class_id=class_id,
    )
    return LessonManageResponse(**row)


@router.delete("/{lesson_id}")
async def delete_lesson(
    lesson_id: str,
    teacher_user: dict = Depends(require_teacher),
) -> dict:
    deleted = await lesson_management_service.delete_lesson(
        teacher_user=teacher_user,
        lesson_id=lesson_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    return {"message": "Lesson deleted"}
