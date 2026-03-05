from __future__ import annotations

from bson import ObjectId
from pymongo import DESCENDING, ReturnDocument

from app.db.repositories.base import BaseRepository, utc_now


class NotificationRepository(BaseRepository):
    def __init__(self):
        super().__init__("notifications")

    @staticmethod
    def _normalize_row(row: dict) -> dict:
        normalized = dict(row or {})
        to_user_id = normalized.get("to_user_id") or normalized.get("user_id")
        if to_user_id:
            normalized["to_user_id"] = to_user_id
            normalized["user_id"] = to_user_id
        is_read = normalized.get("is_read")
        if is_read is None:
            is_read = bool(normalized.get("read", False))
        normalized["is_read"] = bool(is_read)
        normalized["read"] = bool(normalized.get("read", normalized["is_read"]))
        return normalized

    async def create_notifications(self, rows: list[dict]) -> int:
        if not rows:
            return 0
        normalized_rows = [self._normalize_row(row) for row in rows]
        await self.collection.insert_many(normalized_rows)
        return len(rows)

    async def create_notification(self, row: dict) -> str:
        result = await self.collection.insert_one(self._normalize_row(row))
        return str(result.inserted_id)

    async def list_for_user(self, user_id: str, limit: int = 100) -> list[dict]:
        query = {"$or": [{"user_id": user_id}, {"to_user_id": user_id}]}
        return await self.collection.find(query).sort("created_at", DESCENDING).limit(limit).to_list(length=limit)

    async def count_unread(self, user_id: str) -> int:
        return await self.collection.count_documents(
            {
                "$and": [
                    {"$or": [{"user_id": user_id}, {"to_user_id": user_id}]},
                    {"$or": [{"read": False}, {"is_read": False}, {"read": {"$exists": False}, "is_read": {"$exists": False}}]},
                ]
            }
        )

    async def mark_read(self, notification_id: str, user_id: str) -> dict | None:
        if not ObjectId.is_valid(notification_id):
            return None
        now = utc_now()
        return await self.collection.find_one_and_update(
            {"_id": ObjectId(notification_id), "$or": [{"user_id": user_id}, {"to_user_id": user_id}]},
            {"$set": {"read": True, "is_read": True, "read_at": now}},
            return_document=ReturnDocument.AFTER,
        )


notification_repository = NotificationRepository()
