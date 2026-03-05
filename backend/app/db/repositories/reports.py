from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from pymongo import DESCENDING, ReturnDocument

from app.db.repositories.base import BaseRepository, make_object_id_string, utc_now
from app.db.schemas import ReportCreate, ReportDocument


class ReportRepository(BaseRepository):
    def __init__(self):
        super().__init__("reports")

    async def create_report(self, payload: ReportCreate) -> ReportDocument:
        document = payload.model_dump()
        document["reportId"] = payload.reportId or make_object_id_string()
        await self.collection.insert_one(document)
        return ReportDocument(**document)

    async def get_by_report_id(self, report_id: str) -> ReportDocument | None:
        doc = await self.collection.find_one({"reportId": report_id})
        clean = self._strip_mongo_id(doc)
        return ReportDocument(**clean) if clean else None

    async def get_latest(self, scope_type: str, scope_id: str) -> ReportDocument | None:
        doc = await self.collection.find_one(
            {"scopeType": scope_type, "scopeId": scope_id},
            sort=[("generatedAt", DESCENDING)],
        )
        clean = self._strip_mongo_id(doc)
        return ReportDocument(**clean) if clean else None

    async def upsert_cached_report(
        self,
        *,
        scope_type: str,
        scope_id: str,
        data: dict[str, Any],
        generated_at: datetime | None = None,
        ttl_seconds: int | None = None,
    ) -> ReportDocument:
        now = generated_at or utc_now()
        expires_at = now + timedelta(seconds=ttl_seconds) if ttl_seconds and ttl_seconds > 0 else None

        report_id = make_object_id_string()
        updated = await self.collection.find_one_and_update(
            {"scopeType": scope_type, "scopeId": scope_id},
            {
                "$set": {
                    "scopeType": scope_type,
                    "scopeId": scope_id,
                    "generatedAt": now,
                    "data": data,
                    "expiresAt": expires_at,
                },
                "$setOnInsert": {"reportId": report_id},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        clean = self._strip_mongo_id(updated)
        return ReportDocument(**clean)  # guaranteed by upsert

    async def delete_report(self, report_id: str) -> bool:
        return await self.delete_one({"reportId": report_id})


report_repository = ReportRepository()
