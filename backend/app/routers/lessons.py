from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import db
from app.dependencies import get_current_user, require_teacher
from app.models import LessonCreateRequest, LessonResponse


router = APIRouter(prefix="/lessons", tags=["lessons"])


@router.post("", response_model=LessonResponse)
async def create_lesson(
    payload: LessonCreateRequest,
    teacher_user: dict = Depends(require_teacher),
) -> LessonResponse:
    lesson_object_id = ObjectId()
    lesson_doc = {
        "_id": lesson_object_id,
        "lesson_id": str(lesson_object_id),
        "title": payload.title,
        "description": payload.description,
        "content": payload.content,
        "created_by": teacher_user["email"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.lessons.insert_one(lesson_doc)
    return LessonResponse(**{k: v for k, v in lesson_doc.items() if k != "_id"})


@router.get("", response_model=list[LessonResponse])
async def get_lessons(current_user: dict = Depends(get_current_user)) -> list[LessonResponse]:
    docs = await db.lessons.find().sort("created_at", -1).to_list(length=None)
    rows = []
    for doc in docs:
        lesson_id = doc.get("lesson_id", str(doc["_id"]))
        row = {
            "lesson_id": lesson_id,
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
    lesson = None
    if ObjectId.is_valid(lesson_id):
        lesson = await db.lessons.find_one({"_id": ObjectId(lesson_id)})
    if not lesson:
        lesson = await db.lessons.find_one({"lesson_id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return LessonResponse(
        lesson_id=lesson.get("lesson_id", str(lesson["_id"])),
        title=lesson["title"],
        description=lesson["description"],
        content=lesson["content"],
        created_by=lesson["created_by"],
        created_at=lesson["created_at"],
    )


@router.delete("/{lesson_id}")
async def delete_lesson(lesson_id: str, teacher_user: dict = Depends(require_teacher)) -> dict:
    query = {"lesson_id": lesson_id}
    if ObjectId.is_valid(lesson_id):
        query = {"$or": [{"_id": ObjectId(lesson_id)}, {"lesson_id": lesson_id}]}

    result = await db.lessons.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

    return {"message": "Lesson deleted"}
