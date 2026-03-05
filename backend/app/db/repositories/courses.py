from __future__ import annotations

from pymongo import DESCENDING, ReturnDocument

from app.db.repositories.base import BaseRepository, make_object_id_string, utc_now
from app.db.schemas import CourseCreate, CourseDocument, CourseUpdate


class CourseRepository(BaseRepository):
    def __init__(self):
        super().__init__("courses")

    async def create_course(self, payload: CourseCreate) -> CourseDocument:
        now = utc_now()
        document = payload.model_dump()
        document["courseId"] = payload.courseId or make_object_id_string()
        document["createdAt"] = now
        document["updatedAt"] = now
        await self.collection.insert_one(document)
        return CourseDocument(**document)

    async def get_by_course_id(self, course_id: str) -> CourseDocument | None:
        doc = await self.collection.find_one({"courseId": course_id})
        clean = self._strip_mongo_id(doc)
        return CourseDocument(**clean) if clean else None

    async def list_courses(self, created_by: str | None = None, limit: int = 200) -> list[CourseDocument]:
        query = {"createdBy": created_by} if created_by else {}
        rows = await self.list_many(query, limit=limit, sort=[("createdAt", DESCENDING)])
        return [CourseDocument(**row) for row in rows]

    async def update_course(self, course_id: str, payload: CourseUpdate) -> CourseDocument | None:
        updates = payload.model_dump(exclude_none=True)
        if not updates:
            return await self.get_by_course_id(course_id)

        updates["updatedAt"] = utc_now()
        updated = await self.collection.find_one_and_update(
            {"courseId": course_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        clean = self._strip_mongo_id(updated)
        return CourseDocument(**clean) if clean else None

    async def delete_course(self, course_id: str) -> bool:
        return await self.delete_one({"courseId": course_id})


course_repository = CourseRepository()
