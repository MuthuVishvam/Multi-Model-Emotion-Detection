from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection

from db.mongo import get_db


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def make_object_id_string() -> str:
    return str(ObjectId())


class BaseRepository:
    def __init__(self, collection_name: str):
        self.collection_name = collection_name

    @property
    def collection(self) -> AsyncIOMotorCollection:
        return get_db()[self.collection_name]

    @staticmethod
    def _strip_mongo_id(document: dict[str, Any] | None) -> dict[str, Any] | None:
        if document is None:
            return None
        result = dict(document)
        result.pop("_id", None)
        return result

    async def delete_one(self, query: dict[str, Any]) -> bool:
        result = await self.collection.delete_one(query)
        return result.deleted_count > 0

    async def list_many(
        self,
        query: dict[str, Any] | None = None,
        *,
        limit: int = 100,
        sort: list[tuple[str, int]] | None = None,
    ) -> list[dict[str, Any]]:
        cursor = self.collection.find(query or {})
        if sort:
            cursor = cursor.sort(sort)
        if limit > 0:
            cursor = cursor.limit(limit)
        docs = await cursor.to_list(length=limit if limit > 0 else None)
        return [self._strip_mongo_id(doc) or {} for doc in docs]
