from __future__ import annotations

from pymongo import DESCENDING, ReturnDocument

from app.db.repositories.base import BaseRepository, make_object_id_string, utc_now
from app.db.schemas import EnrollmentCreate, EnrollmentDocument, EnrollmentUpdate


class EnrollmentRepository(BaseRepository):
    def __init__(self):
        super().__init__("enrollments")

    async def create_enrollment(self, payload: EnrollmentCreate) -> EnrollmentDocument:
        now = utc_now()
        document = payload.model_dump()
        document["enrollmentId"] = payload.enrollmentId or make_object_id_string()
        document["enrolledAt"] = now
        document["updatedAt"] = now
        await self.collection.insert_one(document)
        return EnrollmentDocument(**document)

    async def get_enrollment(self, user_id: str, course_id: str) -> EnrollmentDocument | None:
        doc = await self.collection.find_one({"userId": user_id, "courseId": course_id})
        clean = self._strip_mongo_id(doc)
        return EnrollmentDocument(**clean) if clean else None

    async def list_for_user(self, user_id: str, limit: int = 300) -> list[EnrollmentDocument]:
        rows = await self.list_many({"userId": user_id}, limit=limit, sort=[("enrolledAt", DESCENDING)])
        return [EnrollmentDocument(**row) for row in rows]

    async def list_for_course(self, course_id: str, limit: int = 500) -> list[EnrollmentDocument]:
        rows = await self.list_many({"courseId": course_id}, limit=limit, sort=[("enrolledAt", DESCENDING)])
        return [EnrollmentDocument(**row) for row in rows]

    async def update_enrollment(self, user_id: str, course_id: str, payload: EnrollmentUpdate) -> EnrollmentDocument | None:
        updates = payload.model_dump(exclude_none=True)
        if not updates:
            return await self.get_enrollment(user_id, course_id)

        updates["updatedAt"] = utc_now()
        updated = await self.collection.find_one_and_update(
            {"userId": user_id, "courseId": course_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        clean = self._strip_mongo_id(updated)
        return EnrollmentDocument(**clean) if clean else None

    async def delete_enrollment(self, user_id: str, course_id: str) -> bool:
        return await self.delete_one({"userId": user_id, "courseId": course_id})


enrollment_repository = EnrollmentRepository()
