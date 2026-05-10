from __future__ import annotations

from pymongo import DESCENDING, ReturnDocument

from app.db.repositories.base import BaseRepository, make_object_id_string, utc_now


class TeacherLessonRepository(BaseRepository):
    def __init__(self):
        super().__init__("lessons")

    async def create_lesson(
        self,
        *,
        title: str,
        description: str,
        course_id: str,
        teacher_id: str,
        teacher_email: str | None,
        video_url: str | None,
        video_embed_url: str | None,
        media_type: str,
        uploaded_file_name: str | None,
        duration_sec: int,
        resources: list[str],
    ) -> dict:
        now = utc_now()
        document = {
            "lesson_id": make_object_id_string(),
            "title": title,
            "description": description,
            "course_id": course_id,
            "teacher_id": teacher_id,
            "teacher_email": teacher_email,
            "video_url": video_url,
            "video_embed_url": video_embed_url,
            "media_type": media_type,
            "uploaded_file_name": uploaded_file_name,
            "duration_sec": max(0, int(duration_sec or 0)),
            "duration": max(0, int(duration_sec or 0)),
            "resources": resources,
            "created_at": now,
            "updated_at": now,
            # Compatibility fields for older frontend flows.
            "content": video_embed_url or video_url or "",
            "created_by": teacher_email or teacher_id,
        }
        await self.collection.insert_one(document)
        return document

    async def get_by_lesson_id(self, lesson_id: str) -> dict | None:
        return await self.collection.find_one({"$or": [{"lesson_id": lesson_id}, {"lessonId": lesson_id}]})

    async def list_by_teacher(self, teacher_id: str, teacher_email: str | None = None, limit: int = 500) -> list[dict]:
        query = {"teacher_id": teacher_id}
        if teacher_email:
            query = {
                "$or": [
                    {"teacher_id": teacher_id},
                    {"teacher_email": teacher_email},
                    {"created_by": teacher_email},
                    {"createdBy": teacher_id},
                ]
            }
        return await self.collection.find(query).sort("created_at", DESCENDING).limit(limit).to_list(length=limit)

    async def list_by_lesson_ids(self, lesson_ids: list[str], limit: int = 1000) -> list[dict]:
        if not lesson_ids:
            return []
        rows = await self.collection.find(
            {
                "$or": [
                    {"lesson_id": {"$in": lesson_ids}},
                    {"lessonId": {"$in": lesson_ids}},
                ]
            }
        ).limit(limit).to_list(length=limit)
        order_map = {lesson_id: idx for idx, lesson_id in enumerate(lesson_ids)}
        return sorted(
            rows,
            key=lambda row: order_map.get(row.get("lesson_id") or row.get("lessonId") or "", len(order_map)),
        )

    async def list_recent(self, limit: int = 500) -> list[dict]:
        return await self.collection.find({}).sort("created_at", DESCENDING).limit(limit).to_list(length=limit)

    async def update_lesson(self, lesson_id: str, updates: dict) -> dict | None:
        if not updates:
            return await self.get_by_lesson_id(lesson_id)
        updates["updated_at"] = utc_now()
        return await self.collection.find_one_and_update(
            {"$or": [{"lesson_id": lesson_id}, {"lessonId": lesson_id}]},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )

    async def delete_by_lesson_id(self, lesson_id: str) -> bool:
        result = await self.collection.delete_one({"$or": [{"lesson_id": lesson_id}, {"lessonId": lesson_id}]})
        return result.deleted_count > 0


teacher_lesson_repository = TeacherLessonRepository()
