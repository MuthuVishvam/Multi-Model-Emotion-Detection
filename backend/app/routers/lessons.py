from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.dependencies import get_current_user, require_teacher
from app.models import LessonCreateRequest, LessonResponse


router = APIRouter(prefix="/lessons", tags=["lessons"])


@router.post("", response_model=LessonResponse)
async def create_lesson(
    payload: LessonCreateRequest,
    teacher_user: dict = Depends(require_teacher),
) -> LessonResponse:
    lesson_doc = {
        "title": payload.title,
        "description": payload.description,
        "content": payload.content,
        "created_by": teacher_user["email"],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.lessons.insert_one(lesson_doc)
    lesson_doc["id"] = str(result.inserted_id)
    return LessonResponse(**lesson_doc)


@router.get("", response_model=list[LessonResponse])
async def get_lessons(current_user: dict = Depends(get_current_user)) -> list[LessonResponse]:
    docs = await db.lessons.find().sort("created_at", -1).to_list(length=None)
    rows = []
    for doc in docs:
        row = {
            "id": str(doc["_id"]),
            "title": doc["title"],
            "description": doc["description"],
            "content": doc["content"],
            "created_by": doc["created_by"],
            "created_at": doc["created_at"],
        }
        rows.append(LessonResponse(**row))
    return rows


@router.get("/{lesson_id}", response_model=LessonResponse)
async def get_lesson(lesson_id: str, current_user: dict = Depends(get_current_user)) -> LessonResponse:
    if not ObjectId.is_valid(lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson id")

    lesson = await db.lessons.find_one({"_id": ObjectId(lesson_id)})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return LessonResponse(
        id=str(lesson["_id"]),
        title=lesson["title"],
        description=lesson["description"],
        content=lesson["content"],
        created_by=lesson["created_by"],
        created_at=lesson["created_at"],
    )
