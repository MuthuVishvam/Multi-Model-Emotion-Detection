from __future__ import annotations

import secrets
import string

from bson import ObjectId
from fastapi import HTTPException, status

from app.database import db
from app.db.repositories.class_members import class_member_repository
from app.db.repositories.classes import class_repository
from app.db.repositories.notifications import notification_repository
from app.db.repositories.base import utc_now


JOIN_CODE_ALPHABET = string.ascii_uppercase + string.digits


def _build_invite_link(join_code: str) -> str:
    return f"/classes/join?join_code={join_code}"


class ClassManagementService:
    async def _generate_join_code(self, length: int = 6, max_attempts: int = 30) -> str:
        for _ in range(max_attempts):
            candidate = "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(length))
            existing = await class_repository.get_by_join_code(candidate)
            if not existing:
                return candidate
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate join code")

    @staticmethod
    def _serialize_class(document: dict, *, member_count: int = 0, membership_status: str | None = None) -> dict:
        return {
            "class_id": document.get("class_id"),
            "class_name": document.get("class_name"),
            "section": document.get("section"),
            "semester": document.get("semester"),
            "description": document.get("description"),
            "course_ids": document.get("course_ids", []),
            "teacher_id": document.get("teacher_id"),
            "teacher_email": document.get("teacher_email"),
            "join_code": document.get("join_code"),
            "invite_link": _build_invite_link(document.get("join_code", "")),
            "member_count": member_count,
            "my_membership_status": membership_status,
            "created_at": document.get("created_at"),
        }

    async def create_class(self, *, teacher_user: dict, payload: dict) -> dict:
        join_code = await self._generate_join_code()
        class_doc = await class_repository.create_class(
            class_name=payload["class_name"].strip(),
            section=payload["section"].strip(),
            semester=payload["semester"].strip(),
            description=(payload.get("description") or "").strip() or None,
            course_ids=[str(course_id).strip() for course_id in payload.get("course_ids", []) if str(course_id).strip()],
            teacher_id=teacher_user["id"],
            teacher_email=teacher_user.get("email"),
            join_code=join_code,
        )
        await class_member_repository.join_member(
            class_id=class_doc["class_id"],
            user_id=teacher_user["id"],
            source="owner",
            member_role="teacher",
        )
        return self._serialize_class(class_doc, member_count=0)

    async def _resolve_student_users(self, *, student_user_ids: list[str], emails: list[str], usernames: list[str]) -> list[dict]:
        or_filters: list[dict] = []
        object_ids: list[ObjectId] = []
        for user_id in student_user_ids:
            if ObjectId.is_valid(user_id):
                object_ids.append(ObjectId(user_id))
        if object_ids:
            or_filters.append({"_id": {"$in": object_ids}})

        normalized_emails = [email.strip().lower() for email in emails if email.strip()]
        if normalized_emails:
            or_filters.append({"email": {"$in": normalized_emails}})

        normalized_usernames = [username.strip() for username in usernames if username.strip()]
        if normalized_usernames:
            or_filters.append({"username": {"$in": normalized_usernames}})

        if not or_filters:
            return []

        rows = await db.users.find(
            {"role": "student", "$or": or_filters},
            {"password_hash": 0},
        ).to_list(length=None)
        return rows

    async def invite_students(self, *, teacher_user: dict, class_id: str, payload: dict) -> dict:
        class_doc = await class_repository.get_by_class_id(class_id)
        if not class_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
        if class_doc.get("teacher_id") != teacher_user["id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to invite for this class")

        students = await self._resolve_student_users(
            student_user_ids=[str(x) for x in payload.get("student_user_ids", [])],
            emails=[str(x) for x in payload.get("emails", [])],
            usernames=[str(x) for x in payload.get("usernames", [])],
        )
        if not students:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No matching student accounts found")

        now = utc_now()
        invited_count = 0
        notification_rows: list[dict] = []
        inviter_name = teacher_user.get("full_name") or teacher_user.get("username") or teacher_user.get("email")

        for student in students:
            student_id = str(student["_id"])
            existing = await class_member_repository.get_member(class_id, student_id)
            if existing and existing.get("status") in {"invited", "joined"}:
                continue

            await class_member_repository.invite_member(
                class_id=class_id,
                user_id=student_id,
                invited_by=teacher_user["id"],
            )
            invited_count += 1
            notification_rows.append(
                {
                    "user_id": student_id,
                    "to_user_id": student_id,
                    "type": "class_invite",
                    "title": "Class Join Notification",
                    "message": f"{inviter_name} invited you to join {class_doc.get('class_name')} ({class_doc.get('section')}).",
                    "data": {"class_id": class_id, "join_code": class_doc.get("join_code")},
                    "payload": {"class_id": class_id, "join_code": class_doc.get("join_code")},
                    "read": False,
                    "is_read": False,
                    "created_at": now,
                    "read_at": None,
                }
            )

        notification_count = await notification_repository.create_notifications(notification_rows)
        return {
            "class_id": class_id,
            "invited_count": invited_count,
            "notification_count": notification_count,
        }

    async def join_class(self, *, student_user: dict, join_code: str) -> dict:
        class_doc = await class_repository.get_by_join_code(join_code.strip().upper())
        if not class_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid join code")

        class_id = class_doc["class_id"]
        existing = await class_member_repository.get_member(class_id, student_user["id"])
        if existing and existing.get("status") == "joined":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already joined this class")

        await class_member_repository.join_member(
            class_id=class_id,
            user_id=student_user["id"],
            source="join_code",
            member_role="student",
        )

        student_name = student_user.get("full_name") or student_user.get("username") or student_user.get("email")
        await notification_repository.create_notification(
            {
                "user_id": class_doc.get("teacher_id"),
                "to_user_id": class_doc.get("teacher_id"),
                "type": "student_joined_class",
                "title": "Student Joined Class",
                "message": f"{student_name} joined your class {class_doc.get('class_name')} ({class_doc.get('section')}).",
                "data": {"class_id": class_id, "student_user_id": student_user["id"]},
                "payload": {"class_id": class_id, "student_user_id": student_user["id"]},
                "read": False,
                "is_read": False,
                "created_at": utc_now(),
                "read_at": None,
            }
        )

        member_count = await class_member_repository.count_joined_students(class_id)
        return self._serialize_class(class_doc, member_count=member_count, membership_status="joined")

    async def list_my_classes(self, user: dict) -> list[dict]:
        role = user.get("role")
        if role == "teacher":
            classes = await class_repository.list_by_teacher(user["id"])
            rows: list[dict] = []
            for class_doc in classes:
                member_count = await class_member_repository.count_joined_students(class_doc["class_id"])
                rows.append(self._serialize_class(class_doc, member_count=member_count))
            return rows

        if role == "student":
            class_ids = await class_member_repository.list_joined_class_ids_for_user(user["id"])
            classes = await class_repository.list_by_class_ids(class_ids)
            rows = []
            for class_doc in classes:
                member_count = await class_member_repository.count_joined_students(class_doc["class_id"])
                rows.append(self._serialize_class(class_doc, member_count=member_count, membership_status="joined"))
            return rows

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students or teachers can access classes")

    async def get_class_detail(self, *, user: dict, class_id: str) -> dict:
        class_doc = await class_repository.get_by_class_id(class_id)
        if not class_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

        role = user.get("role")
        my_membership = await class_member_repository.get_member(class_id, user["id"])
        if role == "teacher":
            if class_doc.get("teacher_id") != user["id"]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this class")
        elif role == "student":
            if not my_membership:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in this class")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students or teachers can access class details")

        members = await class_member_repository.list_members_by_class(class_id)
        user_ids = [member.get("user_id") for member in members if member.get("user_id")]
        object_ids = [ObjectId(user_id) for user_id in user_ids if ObjectId.is_valid(user_id)]
        user_map: dict[str, dict] = {}
        if object_ids:
            user_rows = await db.users.find({"_id": {"$in": object_ids}}, {"password_hash": 0}).to_list(length=None)
            user_map = {str(row["_id"]): row for row in user_rows}

        member_rows: list[dict] = []
        for member in members:
            profile = user_map.get(member.get("user_id", ""), {})
            member_rows.append(
                {
                    "user_id": member.get("user_id"),
                    "email": profile.get("email"),
                    "username": profile.get("username"),
                    "full_name": profile.get("full_name"),
                    "member_role": member.get("member_role", "student"),
                    "status": member.get("status", "joined"),
                    "source": member.get("source"),
                    "joined_at": member.get("joined_at"),
                    "invited_at": member.get("invited_at"),
                }
            )

        member_count = await class_member_repository.count_joined_students(class_id)
        class_row = self._serialize_class(
            class_doc,
            member_count=member_count,
            membership_status=my_membership.get("status") if my_membership else None,
        )
        class_row["members"] = member_rows
        return class_row

    async def list_notifications_for_user(self, user_id: str, *, limit: int = 100) -> dict:
        rows = await notification_repository.list_for_user(user_id, limit=limit)
        notifications = []
        for row in rows:
            notifications.append(
                {
                    "id": str(row.get("_id")),
                    "type": row.get("type", "general"),
                    "title": row.get("title", "Notification"),
                    "message": row.get("message", ""),
                    "data": row.get("data", row.get("payload", {})),
                    "read": bool(row.get("read", row.get("is_read", False))),
                    "created_at": row.get("created_at"),
                    "read_at": row.get("read_at"),
                }
            )
        unread_count = await notification_repository.count_unread(user_id)
        return {"notifications": notifications, "unread_count": unread_count}

    async def mark_notification_read(self, *, user_id: str, notification_id: str) -> dict:
        updated = await notification_repository.mark_read(notification_id, user_id)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
        return {
            "id": str(updated.get("_id")),
            "type": updated.get("type", "general"),
            "title": updated.get("title", "Notification"),
            "message": updated.get("message", ""),
            "data": updated.get("data", updated.get("payload", {})),
            "read": bool(updated.get("read", updated.get("is_read", False))),
            "created_at": updated.get("created_at"),
            "read_at": updated.get("read_at"),
        }


class_management_service = ClassManagementService()
