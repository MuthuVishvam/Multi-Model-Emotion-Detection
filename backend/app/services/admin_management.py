from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument

from app.database import db


def _is_user_active(user: dict) -> bool:
    if "is_active" in user:
        return bool(user.get("is_active"))
    if "isActive" in user:
        return bool(user.get("isActive"))
    return True


class AdminManagementService:
    @staticmethod
    def _validate_user_id(user_id: str) -> ObjectId:
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id")
        return ObjectId(user_id)

    @staticmethod
    def serialize_teacher(user: dict) -> dict:
        return {
            "id": str(user.get("_id")),
            "role": "teacher",
            "email": user.get("email"),
            "username": user.get("username"),
            "full_name": user.get("full_name"),
            "phone": user.get("phone"),
            "department": user.get("department"),
            "avatar_url": user.get("avatar_url"),
            "bio": user.get("bio"),
            "designation": user.get("designation"),
            "experience_years": user.get("experience_years"),
            "verified": bool(user.get("verified", False)),
            "verified_at": user.get("verified_at"),
            "status": user.get("status", "pending"),
            "is_active": _is_user_active(user),
            "created_at": user.get("created_at") or user.get("createdAt"),
        }

    async def list_pending_teachers(self) -> list[dict]:
        docs = await db.users.find(
            {
                "role": "teacher",
                "$or": [
                    {"status": "pending"},
                    {"status": {"$exists": False}},
                    {"status": None},
                ],
            },
            {"password_hash": 0},
        ).sort("created_at", -1).to_list(length=None)
        return [self.serialize_teacher(doc) for doc in docs]

    async def list_teachers(self) -> list[dict]:
        docs = await db.users.find({"role": "teacher"}, {"password_hash": 0}).sort("created_at", -1).to_list(length=None)
        return [self.serialize_teacher(doc) for doc in docs]

    async def set_teacher_status(self, *, teacher_id: str, action: str) -> dict:
        now = datetime.now(timezone.utc)
        teacher_oid = self._validate_user_id(teacher_id)

        if action == "approve":
            updates = {
                "status": "approved",
                "verified": True,
                "verified_at": now,
                "updated_at": now,
            }
        elif action == "reject":
            updates = {
                "status": "rejected",
                "verified": False,
                "verified_at": None,
                "updated_at": now,
            }
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid teacher action")

        updated = await db.users.find_one_and_update(
            {"_id": teacher_oid, "role": "teacher"},
            {"$set": updates},
            projection={"password_hash": 0},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
        return self.serialize_teacher(updated)

    async def set_teacher_active(self, *, teacher_id: str, is_active: bool) -> dict:
        now = datetime.now(timezone.utc)
        teacher_oid = self._validate_user_id(teacher_id)

        updated = await db.users.find_one_and_update(
            {"_id": teacher_oid, "role": "teacher"},
            {"$set": {"is_active": bool(is_active), "isActive": bool(is_active), "updated_at": now}},
            projection={"password_hash": 0},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
        return self.serialize_teacher(updated)

    async def disable_user(self, user_id: str) -> dict:
        now = datetime.now(timezone.utc)
        user_oid = self._validate_user_id(user_id)

        target_user = await db.users.find_one({"_id": user_oid}, {"password_hash": 0})
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if target_user.get("role") == "admin":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin account cannot be disabled")

        updated = await db.users.find_one_and_update(
            {"_id": user_oid},
            {"$set": {"is_active": False, "isActive": False, "updated_at": now}},
            projection={"password_hash": 0},
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        return {
            "id": str(updated.get("_id")),
            "role": updated.get("role", "teacher"),
            "email": updated.get("email"),
            "username": updated.get("username"),
            "full_name": updated.get("full_name"),
            "is_active": _is_user_active(updated),
            "status": updated.get("status"),
            "verified": updated.get("verified"),
            "verified_at": updated.get("verified_at"),
        }

    async def list_classes_overview(self) -> list[dict]:
        pipeline = [
            {"$sort": {"created_at": -1}},
            {
                "$lookup": {
                    "from": "users",
                    "let": {"teacher_id": "$teacher_id"},
                    "pipeline": [
                        {"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$teacher_id"]}}},
                        {
                            "$project": {
                                "_id": 1,
                                "email": 1,
                                "username": 1,
                                "full_name": 1,
                                "status": 1,
                                "is_active": 1,
                                "isActive": 1,
                            }
                        },
                    ],
                    "as": "teacher_docs",
                }
            },
            {
                "$lookup": {
                    "from": "class_members",
                    "let": {"class_id": "$class_id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {"$eq": ["$class_id", "$$class_id"]},
                                        {"$eq": ["$member_role", "student"]},
                                        {"$eq": ["$status", "joined"]},
                                    ]
                                }
                            }
                        },
                        {"$count": "count"},
                    ],
                    "as": "student_counts",
                }
            },
            {
                "$addFields": {
                    "teacher_doc": {"$ifNull": [{"$first": "$teacher_docs"}, {}]},
                    "student_count": {"$ifNull": [{"$first": "$student_counts.count"}, 0]},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "class_id": 1,
                    "class_name": 1,
                    "section": 1,
                    "semester": 1,
                    "description": 1,
                    "course_ids": 1,
                    "created_at": 1,
                    "teacher_id": 1,
                    "teacher_email": {"$ifNull": ["$teacher_doc.email", "$teacher_email"]},
                    "teacher_username": "$teacher_doc.username",
                    "teacher_full_name": "$teacher_doc.full_name",
                    "teacher_status": "$teacher_doc.status",
                    "teacher_is_active": "$teacher_doc.is_active",
                    "teacher_is_active_legacy": "$teacher_doc.isActive",
                    "student_count": 1,
                }
            },
        ]

        rows = await db.classes.aggregate(pipeline).to_list(length=None)
        response: list[dict] = []
        for row in rows:
            teacher_is_active = row.get("teacher_is_active")
            if teacher_is_active is None:
                legacy_active = row.get("teacher_is_active_legacy")
                teacher_is_active = True if legacy_active is None else bool(legacy_active)

            response.append(
                {
                    "class_id": row.get("class_id"),
                    "class_name": row.get("class_name"),
                    "section": row.get("section"),
                    "semester": row.get("semester"),
                    "description": row.get("description"),
                    "course_ids": [str(item) for item in (row.get("course_ids") or [])],
                    "created_at": row.get("created_at"),
                    "teacher_id": row.get("teacher_id"),
                    "teacher_email": row.get("teacher_email"),
                    "teacher_username": row.get("teacher_username"),
                    "teacher_full_name": row.get("teacher_full_name"),
                    "teacher_status": row.get("teacher_status"),
                    "teacher_is_active": bool(teacher_is_active),
                    "student_count": int(row.get("student_count", 0) or 0),
                }
            )
        return response


admin_management_service = AdminManagementService()
