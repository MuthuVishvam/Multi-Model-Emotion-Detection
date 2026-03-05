from __future__ import annotations

from pymongo import DESCENDING, ReturnDocument

from app.db.repositories.base import BaseRepository, make_object_id_string, utc_now


class ClassRepository(BaseRepository):
    def __init__(self):
        super().__init__("classes")

    async def create_class(
        self,
        *,
        class_name: str,
        section: str,
        semester: str,
        description: str | None,
        course_ids: list[str],
        teacher_id: str,
        teacher_email: str | None,
        join_code: str,
    ) -> dict:
        now = utc_now()
        document = {
            "class_id": make_object_id_string(),
            "class_name": class_name,
            "title": class_name,
            "section": section,
            "semester": semester,
            "description": description,
            "course_ids": course_ids,
            "teacher_id": teacher_id,
            "teacher_email": teacher_email,
            "join_code": join_code,
            "created_at": now,
            "updated_at": now,
        }
        await self.collection.insert_one(document)
        return document

    async def get_by_class_id(self, class_id: str) -> dict | None:
        return await self.collection.find_one({"class_id": class_id})

    async def get_by_join_code(self, join_code: str) -> dict | None:
        return await self.collection.find_one({"join_code": join_code})

    async def list_by_teacher(self, teacher_id: str, limit: int = 200) -> list[dict]:
        return await self.collection.find({"teacher_id": teacher_id}).sort("created_at", DESCENDING).limit(limit).to_list(length=limit)

    async def list_by_class_ids(self, class_ids: list[str], limit: int = 500) -> list[dict]:
        if not class_ids:
            return []
        rows = await self.collection.find({"class_id": {"$in": class_ids}}).sort("created_at", DESCENDING).limit(limit).to_list(length=limit)
        order_map = {class_id: idx for idx, class_id in enumerate(class_ids)}
        return sorted(rows, key=lambda row: order_map.get(row.get("class_id", ""), len(order_map)))

    async def update_class(self, class_id: str, updates: dict) -> dict | None:
        if not updates:
            return await self.get_by_class_id(class_id)
        updates["updated_at"] = utc_now()
        return await self.collection.find_one_and_update(
            {"class_id": class_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )


class_repository = ClassRepository()
