from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json
import secrets

from fastapi import HTTPException, UploadFile, status

from app.db.repositories.class_members import class_member_repository
from app.db.repositories.classes import class_repository
from app.db.repositories.lesson_assignments import lesson_assignment_repository
from app.db.repositories.teacher_lessons import teacher_lesson_repository
from app.utils.lesson_media import normalize_lesson_media_url


UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "lessons"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc_naive(value: datetime | None) -> datetime | None:
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _now_naive_utc() -> datetime:
    return _as_utc_naive(_now()) or datetime.utcnow()


class LessonManagementService:
    @staticmethod
    def _is_lesson_owned_by_teacher(lesson: dict, teacher_user: dict) -> bool:
        lesson_teacher_id = lesson.get("teacher_id") or lesson.get("createdBy")
        lesson_teacher_email = lesson.get("teacher_email") or lesson.get("created_by")
        return (
            lesson_teacher_id == teacher_user.get("id")
            or lesson_teacher_email == teacher_user.get("email")
            or lesson.get("created_by") == teacher_user.get("email")
        )

    @staticmethod
    def _parse_resources(resources_raw) -> list[str]:
        if resources_raw is None:
            return []
        if isinstance(resources_raw, list):
            return [str(item).strip() for item in resources_raw if str(item).strip()]
        if isinstance(resources_raw, str):
            candidate = resources_raw.strip()
            if not candidate:
                return []
            if candidate.startswith("[") and candidate.endswith("]"):
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except json.JSONDecodeError:
                    pass
            return [part.strip() for part in candidate.split(",") if part.strip()]
        return []

    @staticmethod
    def _serialize_assignment(row: dict) -> dict:
        return {
            "assignment_id": row.get("assignment_id"),
            "class_id": row.get("class_id"),
            "lesson_id": row.get("lesson_id"),
            "publish_at": row.get("publish_at"),
            "due_at": row.get("due_at"),
            "is_published": bool(row.get("is_published", True)),
            "created_at": row.get("created_at"),
        }

    def _serialize_lesson(self, lesson_doc: dict, assignments: list[dict] | None = None) -> dict:
        lesson_id = lesson_doc.get("lesson_id") or lesson_doc.get("lessonId") or str(lesson_doc.get("_id") or "")
        course_id = lesson_doc.get("course_id") or lesson_doc.get("courseId") or ""
        teacher_id = lesson_doc.get("teacher_id") or lesson_doc.get("createdBy") or ""
        teacher_email = lesson_doc.get("teacher_email")
        if not teacher_email:
            created_by_value = lesson_doc.get("created_by")
            if isinstance(created_by_value, str) and "@" in created_by_value:
                teacher_email = created_by_value
        raw_video_url = lesson_doc.get("video_url") or lesson_doc.get("videoUrl")
        stored_content = lesson_doc.get("content")
        media = normalize_lesson_media_url(raw_video_url or stored_content)
        video_url = media.get("source_url")
        video_embed_url = lesson_doc.get("video_embed_url") or lesson_doc.get("videoEmbedUrl") or media.get("embed_url")
        playable_url = video_embed_url or media.get("playable_url") or stored_content
        media_type = lesson_doc.get("media_type") or lesson_doc.get("mediaType") or media.get("media_type") or "link"
        duration_value = lesson_doc.get("duration_sec")
        if duration_value is None:
            duration_value = lesson_doc.get("durationSec")
        resources_value = lesson_doc.get("resources")
        resources = resources_value if isinstance(resources_value, list) else []
        created_at = lesson_doc.get("created_at") or lesson_doc.get("createdAt") or _now()
        created_by = lesson_doc.get("created_by") or lesson_doc.get("createdBy") or teacher_email
        return {
            "lesson_id": lesson_id,
            "title": lesson_doc.get("title", ""),
            "description": lesson_doc.get("description", ""),
            "course_id": course_id,
            "teacher_id": teacher_id,
            "teacher_email": teacher_email,
            "video_url": video_url,
            "video_embed_url": video_embed_url,
            "media_type": media_type,
            "uploaded_file_name": lesson_doc.get("uploaded_file_name") or lesson_doc.get("uploadedFileName"),
            "duration_sec": int(duration_value or 0),
            "resources": resources,
            "content": playable_url,
            "created_by": created_by,
            "created_at": created_at,
            "assignments": [self._serialize_assignment(row) for row in (assignments or [])],
        }

    async def _store_uploaded_file(self, uploaded_file: UploadFile) -> tuple[str, str]:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        suffix = Path(uploaded_file.filename or "lesson_file").suffix
        safe_name = f"{secrets.token_hex(8)}{suffix or ''}"
        save_path = UPLOAD_DIR / safe_name
        content = await uploaded_file.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
        with save_path.open("wb") as handle:
            handle.write(content)
        return safe_name, f"/uploads/lessons/{safe_name}"

    async def create_lesson(
        self,
        *,
        teacher_user: dict,
        title: str,
        description: str,
        course_id: str,
        video_url: str | None,
        duration_sec: int | None,
        resources_raw,
        uploaded_file: UploadFile | None,
    ) -> dict:
        title_clean = (title or "").strip()
        description_clean = (description or "").strip()
        course_id_clean = (course_id or "").strip()
        if not title_clean:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="title is required")
        if not description_clean:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="description is required")
        if not course_id_clean:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="course_id is required")

        video_url_clean = (video_url or "").strip() or None
        uploaded_file_name = None
        if uploaded_file and uploaded_file.filename:
            uploaded_file_name, uploaded_url = await self._store_uploaded_file(uploaded_file)
            if not video_url_clean:
                video_url_clean = uploaded_url

        if not video_url_clean:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Provide either video_url or uploaded_file",
            )

        resources = self._parse_resources(resources_raw)
        media = normalize_lesson_media_url(video_url_clean)
        lesson_doc = await teacher_lesson_repository.create_lesson(
            title=title_clean,
            description=description_clean,
            course_id=course_id_clean,
            teacher_id=teacher_user["id"],
            teacher_email=teacher_user.get("email"),
            video_url=media.get("source_url"),
            video_embed_url=media.get("embed_url"),
            media_type=str(media.get("media_type") or "link"),
            uploaded_file_name=uploaded_file_name,
            duration_sec=int(duration_sec or 0),
            resources=resources,
        )
        return self._serialize_lesson(lesson_doc, [])

    async def update_lesson(
        self,
        *,
        teacher_user: dict,
        lesson_id: str,
        title: str | None,
        description: str | None,
        course_id: str | None,
        video_url: str | None,
        duration_sec: int | None,
        resources_raw,
        uploaded_file: UploadFile | None,
    ) -> dict:
        lesson = await teacher_lesson_repository.get_by_lesson_id(lesson_id)
        if not lesson:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
        if not self._is_lesson_owned_by_teacher(lesson, teacher_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another teacher's lesson")

        existing_video_url = lesson.get("video_url") or lesson.get("videoUrl") or lesson.get("content")
        existing_duration = lesson.get("duration_sec")
        if existing_duration is None:
            existing_duration = lesson.get("durationSec")
        existing_resources = lesson.get("resources") if isinstance(lesson.get("resources"), list) else []

        title_clean = (title if title is not None else lesson.get("title", "")).strip()
        description_clean = (description if description is not None else lesson.get("description", "")).strip()
        course_id_clean = (course_id if course_id is not None else (lesson.get("course_id") or lesson.get("courseId") or "")).strip()
        video_url_clean = (video_url if video_url is not None else (existing_video_url or "")).strip() or None
        uploaded_file_name = lesson.get("uploaded_file_name") or lesson.get("uploadedFileName")

        if uploaded_file and uploaded_file.filename:
            uploaded_file_name, uploaded_url = await self._store_uploaded_file(uploaded_file)
            if not video_url_clean:
                video_url_clean = uploaded_url

        if not title_clean:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="title is required")
        if not description_clean:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="description is required")
        if not course_id_clean:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="course_id is required")
        if not video_url_clean:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Provide either video_url or uploaded_file",
            )

        if duration_sec is None:
            duration_clean = int(existing_duration or 0)
        else:
            duration_clean = max(0, int(duration_sec))
        resources = self._parse_resources(resources_raw) if resources_raw is not None else existing_resources
        media = normalize_lesson_media_url(video_url_clean)

        updated = await teacher_lesson_repository.update_lesson(
            lesson_id,
            {
                "title": title_clean,
                "description": description_clean,
                "course_id": course_id_clean,
                "video_url": media.get("source_url"),
                "video_embed_url": media.get("embed_url"),
                "media_type": media.get("media_type") or "link",
                "uploaded_file_name": uploaded_file_name,
                "duration_sec": duration_clean,
                "duration": duration_clean,
                "resources": resources,
                "content": media.get("playable_url") or video_url_clean,
            },
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

        assignments = await lesson_assignment_repository.list_for_lesson(lesson_id)
        return self._serialize_lesson(updated, assignments)

    async def list_teacher_lessons(self, *, teacher_user: dict) -> list[dict]:
        lesson_rows = await teacher_lesson_repository.list_by_teacher(
            teacher_user["id"],
            teacher_email=teacher_user.get("email"),
        )
        result: list[dict] = []
        for lesson in lesson_rows:
            lesson_id = lesson.get("lesson_id") or lesson.get("lessonId")
            if not lesson_id:
                continue
            assignments = await lesson_assignment_repository.list_for_lesson(lesson_id)
            result.append(self._serialize_lesson(lesson, assignments))
        return result

    async def assign_lesson_to_classes(
        self,
        *,
        teacher_user: dict,
        lesson_id: str,
        class_ids: list[str],
        publish_at: datetime | None,
        due_at: datetime | None,
        is_published: bool | None,
    ) -> list[dict]:
        lesson = await teacher_lesson_repository.get_by_lesson_id(lesson_id)
        if not lesson:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
        if not self._is_lesson_owned_by_teacher(lesson, teacher_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot assign another teacher's lesson")

        class_id_set = [class_id.strip() for class_id in class_ids if class_id and class_id.strip()]
        if not class_id_set:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="class_ids is required")

        now = _now_naive_utc()
        publish_at_cmp = _as_utc_naive(publish_at)
        effective_published = bool(is_published) if is_published is not None else not (publish_at_cmp and publish_at_cmp > now)

        assignments: list[dict] = []
        for class_id in class_id_set:
            class_doc = await class_repository.get_by_class_id(class_id)
            if not class_doc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Class not found: {class_id}")
            if class_doc.get("teacher_id") != teacher_user["id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"You do not own class: {class_id}",
                )

            assignment = await lesson_assignment_repository.upsert_assignment(
                class_id=class_id,
                lesson_id=lesson_id,
                publish_at=publish_at,
                due_at=due_at,
                is_published=effective_published,
                assigned_by=teacher_user["id"],
            )
            assignments.append(self._serialize_assignment(assignment))
        return assignments

    async def _ensure_class_access(self, *, current_user: dict, class_id: str) -> tuple[dict, dict | None]:
        class_doc = await class_repository.get_by_class_id(class_id)
        if not class_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

        role = current_user.get("role")
        membership = await class_member_repository.get_member(class_id, current_user["id"])

        if role == "teacher":
            if class_doc.get("teacher_id") != current_user["id"]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this class")
        elif role == "student":
            if not membership or membership.get("status") != "joined":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in this class")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only student/teacher can access class lessons")
        return class_doc, membership

    async def list_class_lessons(self, *, current_user: dict, class_id: str) -> list[dict]:
        await self._ensure_class_access(current_user=current_user, class_id=class_id)
        role = current_user.get("role")
        assignments = await lesson_assignment_repository.list_for_class(class_id)
        now = _now_naive_utc()

        visible_assignments: list[dict] = []
        for assignment in assignments:
            published = bool(assignment.get("is_published", True))
            publish_at = _as_utc_naive(assignment.get("publish_at"))
            if role == "student":
                if not published:
                    continue
                if publish_at and publish_at > now:
                    continue
            visible_assignments.append(assignment)

        lesson_ids = [row.get("lesson_id") for row in visible_assignments if row.get("lesson_id")]
        lesson_rows = await teacher_lesson_repository.list_by_lesson_ids(lesson_ids)
        lesson_map = {(row.get("lesson_id") or row.get("lessonId")): row for row in lesson_rows}

        result: list[dict] = []
        for assignment in visible_assignments:
            lesson = lesson_map.get(assignment.get("lesson_id"))
            if not lesson:
                continue
            lesson_payload = self._serialize_lesson(lesson, [assignment])
            result.append(lesson_payload)
        return result

    async def get_lesson_for_user(self, *, current_user: dict, lesson_id: str, class_id: str | None = None) -> dict:
        lesson = await teacher_lesson_repository.get_by_lesson_id(lesson_id)
        if not lesson:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

        role = current_user.get("role")
        if role == "teacher":
            if not self._is_lesson_owned_by_teacher(lesson, current_user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this lesson")
            assignments = await lesson_assignment_repository.list_for_lesson(lesson_id)
            return self._serialize_lesson(lesson, assignments)

        if role == "student":
            class_ids: list[str]
            if class_id:
                _, membership = await self._ensure_class_access(current_user=current_user, class_id=class_id)
                if not membership:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in class")
                class_ids = [class_id]
            else:
                class_ids = await class_member_repository.list_joined_class_ids_for_user(current_user["id"])

            assignments = await lesson_assignment_repository.list_for_class_ids(class_ids)
            now = _now_naive_utc()
            allowed = []
            for row in assignments:
                if row.get("lesson_id") != lesson_id:
                    continue
                if not bool(row.get("is_published", True)):
                    continue
                publish_at = _as_utc_naive(row.get("publish_at"))
                if publish_at and publish_at > now:
                    continue
                allowed.append(row)
            if not allowed:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Lesson not assigned to your classes")
            return self._serialize_lesson(lesson, allowed)

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unsupported role for lesson access")

    async def list_accessible_lessons(self, *, current_user: dict) -> list[dict]:
        role = current_user.get("role")
        if role == "teacher":
            return await self.list_teacher_lessons(teacher_user=current_user)
        if role != "student":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unsupported role")

        class_ids = await class_member_repository.list_joined_class_ids_for_user(current_user["id"])
        assignments = await lesson_assignment_repository.list_for_class_ids(class_ids)
        now = _now_naive_utc()
        lesson_ids = []
        filtered_assignments: dict[str, list[dict]] = {}
        for row in assignments:
            if not bool(row.get("is_published", True)):
                continue
            publish_at = _as_utc_naive(row.get("publish_at"))
            if publish_at and publish_at > now:
                continue
            lesson_id = row.get("lesson_id")
            if not lesson_id:
                continue
            if lesson_id not in filtered_assignments:
                filtered_assignments[lesson_id] = []
                lesson_ids.append(lesson_id)
            filtered_assignments[lesson_id].append(row)

        lesson_rows = await teacher_lesson_repository.list_by_lesson_ids(lesson_ids)
        result: list[dict] = []
        for row in lesson_rows:
            lesson_id = row.get("lesson_id") or row.get("lessonId")
            result.append(self._serialize_lesson(row, filtered_assignments.get(lesson_id, [])))
        return result

    async def delete_lesson(self, *, teacher_user: dict, lesson_id: str) -> bool:
        lesson = await teacher_lesson_repository.get_by_lesson_id(lesson_id)
        if not lesson:
            return False
        if not self._is_lesson_owned_by_teacher(lesson, teacher_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another teacher's lesson")

        await lesson_assignment_repository.delete_for_lesson(lesson_id)
        return await teacher_lesson_repository.delete_by_lesson_id(lesson_id)


lesson_management_service = LessonManagementService()
