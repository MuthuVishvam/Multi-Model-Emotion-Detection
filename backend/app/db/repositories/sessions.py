from __future__ import annotations

from datetime import datetime

from pymongo import DESCENDING, ReturnDocument

from app.db.repositories.base import BaseRepository, make_object_id_string, utc_now
from app.db.schemas import SessionCreateDocument, SessionDocument, SessionUpdate


class SessionRepository(BaseRepository):
    def __init__(self):
        super().__init__("sessions")

    async def create_session(self, payload: SessionCreateDocument) -> SessionDocument:
        now = utc_now()
        document = payload.model_dump()
        document["sessionId"] = payload.sessionId or make_object_id_string()
        document["startedAt"] = now
        document["endedAt"] = None
        document["updatedAt"] = now
        await self.collection.insert_one(document)
        return SessionDocument(**document)

    async def get_by_session_id(self, session_id: str) -> SessionDocument | None:
        doc = await self.collection.find_one({"sessionId": session_id})
        clean = self._strip_mongo_id(doc)
        return SessionDocument(**clean) if clean else None

    async def list_for_user(self, user_id: str, limit: int = 300) -> list[SessionDocument]:
        rows = await self.list_many({"userId": user_id}, limit=limit, sort=[("startedAt", DESCENDING)])
        return [SessionDocument(**row) for row in rows]

    async def list_for_course(self, course_id: str, limit: int = 500) -> list[SessionDocument]:
        rows = await self.list_many({"courseId": course_id}, limit=limit, sort=[("startedAt", DESCENDING)])
        return [SessionDocument(**row) for row in rows]

    async def list_for_course_lesson(
        self,
        course_id: str,
        lesson_id: str,
        *,
        limit: int = 500,
    ) -> list[SessionDocument]:
        rows = await self.list_many(
            {"courseId": course_id, "lessonId": lesson_id},
            limit=limit,
            sort=[("startedAt", DESCENDING)],
        )
        return [SessionDocument(**row) for row in rows]

    async def update_session(self, session_id: str, payload: SessionUpdate) -> SessionDocument | None:
        updates = payload.model_dump(exclude_none=True)
        if not updates:
            return await self.get_by_session_id(session_id)

        updates["updatedAt"] = utc_now()
        updated = await self.collection.find_one_and_update(
            {"sessionId": session_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        clean = self._strip_mongo_id(updated)
        return SessionDocument(**clean) if clean else None

    async def finish_session(self, session_id: str, ended_at: datetime | None = None) -> SessionDocument | None:
        end_time = ended_at or utc_now()
        updated = await self.collection.find_one_and_update(
            {"sessionId": session_id},
            {"$set": {"status": "finished", "endedAt": end_time, "updatedAt": end_time}},
            return_document=ReturnDocument.AFTER,
        )
        clean = self._strip_mongo_id(updated)
        return SessionDocument(**clean) if clean else None

    async def delete_session(self, session_id: str) -> bool:
        return await self.delete_one({"sessionId": session_id})


session_repository = SessionRepository()
