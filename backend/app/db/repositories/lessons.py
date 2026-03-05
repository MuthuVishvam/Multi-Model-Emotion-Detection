from __future__ import annotations

from pymongo import ASCENDING, DESCENDING, ReturnDocument

from app.db.repositories.base import BaseRepository, make_object_id_string, utc_now
from app.db.schemas import LessonCreateDocument, LessonDocument, LessonUpdate


class LessonRepository(BaseRepository):
    def __init__(self):
        super().__init__("lessons")

    async def create_lesson(self, payload: LessonCreateDocument) -> LessonDocument:
        now = utc_now()
        document = payload.model_dump()
        document["lessonId"] = payload.lessonId or make_object_id_string()
        document["createdAt"] = now
        document["updatedAt"] = now
        await self.collection.insert_one(document)
        return LessonDocument(**document)

    async def get_by_lesson_id(self, lesson_id: str) -> LessonDocument | None:
        doc = await self.collection.find_one({"lessonId": lesson_id})
        clean = self._strip_mongo_id(doc)
        return LessonDocument(**clean) if clean else None

    async def list_for_course(self, course_id: str, limit: int = 500) -> list[LessonDocument]:
        rows = await self.list_many(
            {"courseId": course_id},
            limit=limit,
            sort=[("orderIndex", ASCENDING), ("createdAt", DESCENDING)],
        )
        return [LessonDocument(**row) for row in rows]

    async def update_lesson(self, lesson_id: str, payload: LessonUpdate) -> LessonDocument | None:
        updates = payload.model_dump(exclude_none=True)
        if not updates:
            return await self.get_by_lesson_id(lesson_id)

        updates["updatedAt"] = utc_now()
        updated = await self.collection.find_one_and_update(
            {"lessonId": lesson_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        clean = self._strip_mongo_id(updated)
        return LessonDocument(**clean) if clean else None

    async def delete_lesson(self, lesson_id: str) -> bool:
        return await self.delete_one({"lessonId": lesson_id})


lesson_repository = LessonRepository()
