from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status

from app.database import db
from app.db.repositories.class_members import class_member_repository
from app.db.repositories.classes import class_repository


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_watch_seconds(start_at: datetime | None, end_at: datetime) -> int:
    if not isinstance(start_at, datetime):
        return 0
    return max(0, int((end_at - start_at).total_seconds()))


class LiveClassService:
    @staticmethod
    async def _load_live_class(live_session_id: str) -> dict:
        normalized = (live_session_id or "").strip()
        if not normalized:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="live_session_id is required")

        doc = await db.live_classes.find_one({"live_session_id": normalized})
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live class not found")
        return doc

    @staticmethod
    async def _ensure_access(
        *,
        live_class: dict,
        current_user: dict,
        require_teacher_owner: bool = False,
    ) -> None:
        current_user_id = str(current_user.get("id") or "")
        current_role = str(current_user.get("role") or "")
        teacher_id = str(live_class.get("teacher_id") or "")
        class_id = str(live_class.get("class_id") or "").strip()

        if require_teacher_owner:
            if current_role != "teacher" or current_user_id != teacher_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the live class teacher can perform this action")
            return

        if current_user_id == teacher_id:
            return

        if current_role != "student":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only enrolled students can join live class")

        if class_id:
            member = await class_member_repository.get_member(class_id, current_user_id)
            if not member or member.get("status") != "joined":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in the class for this live session")

    @staticmethod
    async def _count_active_students(live_session_id: str) -> int:
        return await db.live_participants.count_documents(
            {
                "live_session_id": live_session_id,
                "role": "student",
                "is_active": True,
            }
        )

    @staticmethod
    async def _persist_active_students(live_session_id: str) -> int:
        active_students_count = await LiveClassService._count_active_students(live_session_id)
        await db.live_classes.update_one(
            {"live_session_id": live_session_id},
            {"$set": {"active_students_count": active_students_count, "updated_at": _utc_now()}},
        )
        return active_students_count

    @staticmethod
    def _to_live_response(doc: dict, active_students_count: int | None = None) -> dict:
        return {
            "live_session_id": str(doc.get("live_session_id") or ""),
            "class_id": doc.get("class_id"),
            "lesson_id": doc.get("lesson_id"),
            "teacher_id": str(doc.get("teacher_id") or ""),
            "title": str(doc.get("title") or "Live Class"),
            "status": str(doc.get("status") or "active"),
            "started_at": doc.get("started_at") or _utc_now(),
            "ended_at": doc.get("ended_at"),
            "created_at": doc.get("created_at") or _utc_now(),
            "active_students_count": int(
                active_students_count
                if active_students_count is not None
                else doc.get("active_students_count") or 0
            ),
        }

    async def start_live_class(self, *, teacher_user: dict, payload: dict) -> dict:
        class_id = str(payload.get("class_id") or "").strip() or None
        lesson_id = str(payload.get("lesson_id") or "").strip() or None
        title = str(payload.get("title") or "").strip() or None

        if class_id:
            class_doc = await class_repository.get_by_class_id(class_id)
            if not class_doc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
            if str(class_doc.get("teacher_id") or "") != str(teacher_user.get("id") or ""):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this class")

        now = _utc_now()
        object_id = ObjectId()
        live_session_id = str(object_id)
        live_doc = {
            "_id": object_id,
            "live_session_id": live_session_id,
            "class_id": class_id,
            "lesson_id": lesson_id,
            "teacher_id": teacher_user["id"],
            "teacher_email": teacher_user.get("email"),
            "title": title or f"Live Class {now.strftime('%Y-%m-%d %H:%M UTC')}",
            "status": "active",
            "started_at": now,
            "ended_at": None,
            "active_students_count": 0,
            "created_at": now,
            "updated_at": now,
        }
        await db.live_classes.insert_one(live_doc)

        await db.live_participants.update_one(
            {"live_session_id": live_session_id, "user_id": teacher_user["id"]},
            {
                "$set": {
                    "role": "teacher",
                    "is_active": True,
                    "last_joined_at": now,
                    "left_at": None,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "live_session_id": live_session_id,
                    "user_id": teacher_user["id"],
                    "joined_at": now,
                    "watch_time_seconds": 0,
                    "created_at": now,
                },
            },
            upsert=True,
        )
        return self._to_live_response(live_doc, active_students_count=0)

    async def join_live_class(self, *, live_session_id: str, current_user: dict) -> dict:
        live_class = await self._load_live_class(live_session_id)
        if str(live_class.get("status") or "") != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Live class has ended")

        await self._ensure_access(live_class=live_class, current_user=current_user)

        user_id = str(current_user.get("id") or "")
        now = _utc_now()
        role = "teacher" if user_id == str(live_class.get("teacher_id") or "") else "student"

        await db.live_participants.update_one(
            {"live_session_id": live_session_id, "user_id": user_id},
            {
                "$set": {
                    "role": role,
                    "is_active": True,
                    "last_joined_at": now,
                    "left_at": None,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "live_session_id": live_session_id,
                    "user_id": user_id,
                    "joined_at": now,
                    "watch_time_seconds": 0,
                    "created_at": now,
                },
            },
            upsert=True,
        )

        participant = await db.live_participants.find_one({"live_session_id": live_session_id, "user_id": user_id})
        active_students_count = await self._persist_active_students(live_session_id)
        if not participant:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to join live class")

        return {
            "live_session_id": live_session_id,
            "user_id": user_id,
            "role": str(participant.get("role") or role),
            "is_active": bool(participant.get("is_active", False)),
            "joined_at": participant.get("joined_at") or now,
            "last_joined_at": participant.get("last_joined_at") or now,
            "left_at": participant.get("left_at"),
            "watch_time_seconds": int(participant.get("watch_time_seconds") or 0),
            "active_students_count": active_students_count,
        }

    async def leave_live_class(self, *, live_session_id: str, current_user: dict) -> dict:
        live_class = await self._load_live_class(live_session_id)
        await self._ensure_access(live_class=live_class, current_user=current_user)

        user_id = str(current_user.get("id") or "")
        participant = await db.live_participants.find_one({"live_session_id": live_session_id, "user_id": user_id})
        if not participant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")

        now = _utc_now()
        if bool(participant.get("is_active")):
            previous_watch = int(participant.get("watch_time_seconds") or 0)
            start_ref = participant.get("last_joined_at") or participant.get("joined_at")
            additional = _safe_watch_seconds(start_ref, now)
            updated_watch = max(0, previous_watch + additional)
            await db.live_participants.update_one(
                {"_id": participant["_id"]},
                {
                    "$set": {
                        "is_active": False,
                        "left_at": now,
                        "watch_time_seconds": updated_watch,
                        "updated_at": now,
                    }
                },
            )
            participant["is_active"] = False
            participant["left_at"] = now
            participant["watch_time_seconds"] = updated_watch

        await self._persist_active_students(live_session_id)
        return {
            "live_session_id": live_session_id,
            "user_id": user_id,
            "role": str(participant.get("role") or "student"),
            "is_active": bool(participant.get("is_active", False)),
            "joined_at": participant.get("joined_at") or now,
            "last_joined_at": participant.get("last_joined_at") or participant.get("joined_at") or now,
            "left_at": participant.get("left_at"),
            "watch_time_seconds": int(participant.get("watch_time_seconds") or 0),
        }

    async def end_live_class(self, *, live_session_id: str, teacher_user: dict) -> dict:
        live_class = await self._load_live_class(live_session_id)
        await self._ensure_access(live_class=live_class, current_user=teacher_user, require_teacher_owner=True)

        now = _utc_now()
        if str(live_class.get("status") or "") != "ended":
            active_participants = await db.live_participants.find(
                {"live_session_id": live_session_id, "is_active": True}
            ).to_list(length=None)
            for participant in active_participants:
                previous_watch = int(participant.get("watch_time_seconds") or 0)
                start_ref = participant.get("last_joined_at") or participant.get("joined_at")
                additional = _safe_watch_seconds(start_ref, now)
                updated_watch = max(0, previous_watch + additional)
                await db.live_participants.update_one(
                    {"_id": participant["_id"]},
                    {
                        "$set": {
                            "is_active": False,
                            "left_at": now,
                            "watch_time_seconds": updated_watch,
                            "updated_at": now,
                        }
                    },
                )

            await db.live_classes.update_one(
                {"live_session_id": live_session_id},
                {
                    "$set": {
                        "status": "ended",
                        "ended_at": now,
                        "active_students_count": 0,
                        "updated_at": now,
                    }
                },
            )

        participant_count = await db.live_participants.count_documents({"live_session_id": live_session_id})
        return {
            "live_session_id": live_session_id,
            "status": "ended",
            "ended_at": now,
            "active_students_count": 0,
            "participant_count": int(participant_count),
        }

    async def get_live_class_for_user(self, *, live_session_id: str, current_user: dict) -> dict:
        live_class = await self._load_live_class(live_session_id)
        await self._ensure_access(live_class=live_class, current_user=current_user)
        active_students_count = await self._persist_active_students(live_session_id)
        row = self._to_live_response(live_class, active_students_count=active_students_count)
        return row


live_class_service = LiveClassService()
