from __future__ import annotations

from pymongo import DESCENDING, ReturnDocument

from app.db.repositories.base import BaseRepository, make_object_id_string, utc_now
from app.db.schemas import UserCreate, UserDocument, UserUpdate


class UserRepository(BaseRepository):
    def __init__(self):
        super().__init__("users")

    async def create_user(self, payload: UserCreate) -> UserDocument:
        now = utc_now()
        document = payload.model_dump()
        document["userId"] = payload.userId or make_object_id_string()
        document["createdAt"] = now
        document["updatedAt"] = now
        await self.collection.insert_one(document)
        return UserDocument(**document)

    async def get_by_user_id(self, user_id: str) -> UserDocument | None:
        doc = await self.collection.find_one({"userId": user_id})
        clean = self._strip_mongo_id(doc)
        return UserDocument(**clean) if clean else None

    async def get_by_email(self, email: str) -> UserDocument | None:
        doc = await self.collection.find_one({"email": email})
        clean = self._strip_mongo_id(doc)
        return UserDocument(**clean) if clean else None

    async def list_users(self, role: str | None = None, limit: int = 100) -> list[UserDocument]:
        query = {"role": role} if role else {}
        rows = await self.list_many(query, limit=limit, sort=[("createdAt", DESCENDING)])
        return [UserDocument(**row) for row in rows]

    async def update_user(self, user_id: str, payload: UserUpdate) -> UserDocument | None:
        updates = payload.model_dump(exclude_none=True)
        if not updates:
            return await self.get_by_user_id(user_id)

        updates["updatedAt"] = utc_now()
        updated = await self.collection.find_one_and_update(
            {"userId": user_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        clean = self._strip_mongo_id(updated)
        return UserDocument(**clean) if clean else None

    async def delete_user(self, user_id: str) -> bool:
        return await self.delete_one({"userId": user_id})


user_repository = UserRepository()
