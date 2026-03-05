from __future__ import annotations

from datetime import datetime

from pymongo import DESCENDING

from app.db.repositories.base import BaseRepository, make_object_id_string, utc_now
from app.db.schemas import EmotionEventCreate, EmotionEventDocument


class EmotionEventRepository(BaseRepository):
    def __init__(self):
        super().__init__("emotion_events")

    async def create_event(self, payload: EmotionEventCreate) -> EmotionEventDocument:
        now = utc_now()
        document = payload.model_dump()
        document["eventId"] = payload.eventId or make_object_id_string()
        document["createdAt"] = now
        await self.collection.insert_one(document)
        return EmotionEventDocument(**document)

    async def create_events(self, payloads: list[EmotionEventCreate]) -> int:
        if not payloads:
            return 0

        now = utc_now()
        documents = []
        for payload in payloads:
            row = payload.model_dump()
            row["eventId"] = payload.eventId or make_object_id_string()
            row["createdAt"] = now
            documents.append(row)

        await self.collection.insert_many(documents)
        return len(documents)

    async def get_by_event_id(self, event_id: str) -> EmotionEventDocument | None:
        doc = await self.collection.find_one({"eventId": event_id})
        clean = self._strip_mongo_id(doc)
        return EmotionEventDocument(**clean) if clean else None

    async def list_for_session(
        self,
        session_id: str,
        *,
        modality: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 1000,
    ) -> list[EmotionEventDocument]:
        query: dict = {"sessionId": session_id}
        if modality:
            query["modality"] = modality
        if start or end:
            timestamp_query: dict[str, datetime] = {}
            if start:
                timestamp_query["$gte"] = start
            if end:
                timestamp_query["$lte"] = end
            query["timestamp"] = timestamp_query

        rows = await self.list_many(query, limit=limit, sort=[("timestamp", DESCENDING)])
        return [EmotionEventDocument(**row) for row in rows]

    async def list_for_user_course(
        self,
        user_id: str,
        course_id: str,
        *,
        limit: int = 1000,
    ) -> list[EmotionEventDocument]:
        rows = await self.list_many(
            {"userId": user_id, "courseId": course_id},
            limit=limit,
            sort=[("timestamp", DESCENDING)],
        )
        return [EmotionEventDocument(**row) for row in rows]

    async def list_for_course_lesson(
        self,
        course_id: str,
        lesson_id: str,
        *,
        limit: int = 1000,
    ) -> list[EmotionEventDocument]:
        rows = await self.list_many(
            {"courseId": course_id, "lessonId": lesson_id},
            limit=limit,
            sort=[("timestamp", DESCENDING)],
        )
        return [EmotionEventDocument(**row) for row in rows]

    async def delete_event(self, event_id: str) -> bool:
        return await self.delete_one({"eventId": event_id})

    async def delete_for_session(self, session_id: str) -> int:
        result = await self.collection.delete_many({"sessionId": session_id})
        return result.deleted_count


emotion_event_repository = EmotionEventRepository()
