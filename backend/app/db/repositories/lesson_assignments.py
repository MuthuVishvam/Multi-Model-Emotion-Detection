from __future__ import annotations

from pymongo import ASCENDING, ReturnDocument

from app.db.repositories.base import BaseRepository, make_object_id_string, utc_now


class LessonAssignmentRepository(BaseRepository):
    def __init__(self):
        super().__init__("lesson_assignments")

    async def upsert_assignment(
        self,
        *,
        class_id: str,
        lesson_id: str,
        publish_at,
        due_at,
        is_published: bool,
        assigned_by: str,
    ) -> dict:
        now = utc_now()
        assignment_id = make_object_id_string()
        return await self.collection.find_one_and_update(
            {"class_id": class_id, "lesson_id": lesson_id},
            {
                "$set": {
                    "publish_at": publish_at,
                    "due_at": due_at,
                    "is_published": bool(is_published),
                    "assigned_by": assigned_by,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "assignment_id": assignment_id,
                    "class_id": class_id,
                    "lesson_id": lesson_id,
                    "created_at": now,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

    async def list_for_class(self, class_id: str, limit: int = 500) -> list[dict]:
        return await self.collection.find({"class_id": class_id}).sort("created_at", ASCENDING).limit(limit).to_list(length=limit)

    async def list_for_lesson(self, lesson_id: str, limit: int = 500) -> list[dict]:
        return await self.collection.find({"lesson_id": lesson_id}).sort("created_at", ASCENDING).limit(limit).to_list(length=limit)

    async def list_for_class_ids(self, class_ids: list[str], limit: int = 1000) -> list[dict]:
        if not class_ids:
            return []
        return await self.collection.find({"class_id": {"$in": class_ids}}).sort("created_at", ASCENDING).limit(limit).to_list(length=limit)

    async def delete_for_lesson(self, lesson_id: str) -> int:
        result = await self.collection.delete_many({"lesson_id": lesson_id})
        return int(result.deleted_count or 0)


lesson_assignment_repository = LessonAssignmentRepository()
