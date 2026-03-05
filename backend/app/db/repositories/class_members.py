from __future__ import annotations

from pymongo import ReturnDocument

from app.db.repositories.base import BaseRepository, utc_now


class ClassMemberRepository(BaseRepository):
    def __init__(self):
        super().__init__("class_members")

    @property
    def enrollment_collection(self):
        return self.collection.database["enrollments"]

    async def _sync_enrollment(
        self,
        *,
        class_id: str,
        user_id: str,
        status: str,
        source: str,
        joined_at=None,
        invited_at=None,
    ) -> None:
        now = utc_now()
        await self.enrollment_collection.find_one_and_update(
            {"class_id": class_id, "student_id": user_id},
            {
                "$set": {
                    "class_id": class_id,
                    "student_id": user_id,
                    "status": status,
                    "source": source,
                    "joined_at": joined_at,
                    "invited_at": invited_at,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

    async def get_member(self, class_id: str, user_id: str) -> dict | None:
        return await self.collection.find_one({"class_id": class_id, "user_id": user_id})

    async def invite_member(
        self,
        *,
        class_id: str,
        user_id: str,
        invited_by: str,
    ) -> dict:
        now = utc_now()
        record = await self.collection.find_one_and_update(
            {"class_id": class_id, "user_id": user_id},
            {
                "$set": {
                    "status": "invited",
                    "member_role": "student",
                    "source": "invite",
                    "invited_by": invited_by,
                    "invited_at": now,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "class_id": class_id,
                    "user_id": user_id,
                    "created_at": now,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_enrollment(
            class_id=class_id,
            user_id=user_id,
            status="invited",
            source="invite",
            invited_at=now,
        )
        return record

    async def join_member(
        self,
        *,
        class_id: str,
        user_id: str,
        source: str,
        member_role: str = "student",
    ) -> dict:
        now = utc_now()
        record = await self.collection.find_one_and_update(
            {"class_id": class_id, "user_id": user_id},
            {
                "$set": {
                    "status": "joined",
                    "member_role": member_role,
                    "source": source,
                    "joined_at": now,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "class_id": class_id,
                    "user_id": user_id,
                    "created_at": now,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        if member_role == "student":
            await self._sync_enrollment(
                class_id=class_id,
                user_id=user_id,
                status="joined",
                source=source,
                joined_at=now,
            )
        return record

    async def list_members_by_class(self, class_id: str, limit: int = 1000) -> list[dict]:
        return await self.collection.find({"class_id": class_id}).sort("created_at", 1).limit(limit).to_list(length=limit)

    async def list_joined_class_ids_for_user(self, user_id: str, limit: int = 500) -> list[str]:
        rows = await self.collection.find(
            {"user_id": user_id, "status": "joined", "member_role": "student"}
        ).limit(limit).to_list(length=limit)
        return [row.get("class_id") for row in rows if row.get("class_id")]

    async def count_joined_students(self, class_id: str) -> int:
        return await self.collection.count_documents(
            {"class_id": class_id, "status": "joined", "member_role": "student"}
        )


class_member_repository = ClassMemberRepository()
