from __future__ import annotations

import logging

from pymongo import ASCENDING, DESCENDING
from pymongo.errors import PyMongoError

from db.mongo import get_db


logger = logging.getLogger("emotion_backend")


async def _create_index_safe(collection, keys, **kwargs) -> None:
    try:
        await collection.create_index(keys, **kwargs)
    except (PyMongoError, RuntimeError, AttributeError) as exc:
        # Keep startup resilient with existing demo/legacy data.
        logger.warning(
            "Index creation skipped collection=%s name=%s reason=%s",
            getattr(collection, "name", "unknown"),
            kwargs.get("name"),
            str(exc),
        )


async def ensure_platform_indexes() -> None:
    try:
        db = get_db()
    except RuntimeError as exc:
        logger.warning("Index creation skipped reason=%s", str(exc))
        return

    await _create_index_safe(
        db.users,
        [("userId", ASCENDING)],
        unique=True,
        name="users_userId_uq",
        partialFilterExpression={"userId": {"$type": "string"}},
    )
    await _create_index_safe(
        db.users,
        [("email", ASCENDING)],
        unique=True,
        name="users_email_uq",
        partialFilterExpression={"email": {"$type": "string"}},
    )
    await _create_index_safe(
        db.users,
        [("username", ASCENDING)],
        unique=True,
        name="users_username_uq",
        partialFilterExpression={"username": {"$type": "string"}},
    )
    await _create_index_safe(
        db.users,
        [("role", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)],
        name="users_role_status_created_at",
    )
    await _create_index_safe(
        db.users,
        [("role", ASCENDING), ("verified", ASCENDING)],
        name="users_role_verified",
    )
    await _create_index_safe(
        db.users,
        [("role", ASCENDING), ("is_active", ASCENDING)],
        name="users_role_is_active",
    )

    await _create_index_safe(
        db.courses,
        [("courseId", ASCENDING)],
        unique=True,
        name="courses_courseId_uq",
        partialFilterExpression={"courseId": {"$type": "string"}},
    )
    await _create_index_safe(db.courses, [("createdBy", ASCENDING), ("createdAt", DESCENDING)], name="courses_owner_createdAt")

    await _create_index_safe(
        db.lessons,
        [("lessonId", ASCENDING)],
        unique=True,
        name="lessons_lessonId_uq",
        partialFilterExpression={"lessonId": {"$type": "string"}},
    )
    await _create_index_safe(
        db.lessons,
        [("courseId", ASCENDING), ("lessonId", ASCENDING)],
        unique=True,
        name="lessons_courseId_lessonId",
        partialFilterExpression={"courseId": {"$type": "string"}, "lessonId": {"$type": "string"}},
    )
    await _create_index_safe(db.lessons, [("courseId", ASCENDING), ("orderIndex", ASCENDING)], name="lessons_courseId_order")
    await _create_index_safe(
        db.lessons,
        [("lesson_id", ASCENDING)],
        unique=True,
        name="lessons_lesson_id_uq",
        partialFilterExpression={"lesson_id": {"$type": "string"}},
    )
    await _create_index_safe(db.lessons, [("teacher_id", ASCENDING), ("created_at", DESCENDING)], name="lessons_teacher_created_at")
    await _create_index_safe(db.lessons, [("course_id", ASCENDING), ("created_at", DESCENDING)], name="lessons_course_created_at")

    await _create_index_safe(
        db.enrollments,
        [("enrollmentId", ASCENDING)],
        unique=True,
        name="enrollments_enrollmentId_uq",
        partialFilterExpression={"enrollmentId": {"$type": "string"}},
    )
    await _create_index_safe(
        db.enrollments,
        [("class_id", ASCENDING), ("student_id", ASCENDING)],
        unique=True,
        name="enrollments_class_student_uq",
        partialFilterExpression={"class_id": {"$type": "string"}, "student_id": {"$type": "string"}},
    )
    await _create_index_safe(
        db.enrollments,
        [("student_id", ASCENDING), ("status", ASCENDING), ("updated_at", DESCENDING)],
        name="enrollments_student_status_updated",
    )
    await _create_index_safe(
        db.enrollments,
        [("userId", ASCENDING), ("courseId", ASCENDING)],
        unique=True,
        name="enrollments_userId_courseId",
        partialFilterExpression={"userId": {"$type": "string"}, "courseId": {"$type": "string"}},
    )
    await _create_index_safe(db.enrollments, [("courseId", ASCENDING), ("status", ASCENDING)], name="enrollments_courseId_status")

    await _create_index_safe(
        db.emotion_events,
        [("eventId", ASCENDING)],
        unique=True,
        name="emotion_events_eventId_uq",
        partialFilterExpression={"eventId": {"$type": "string"}},
    )
    await _create_index_safe(db.emotion_events, [("sessionId", ASCENDING), ("timestamp", DESCENDING)], name="emotion_events_sessionId_timestamp")
    await _create_index_safe(db.emotion_events, [("userId", ASCENDING), ("courseId", ASCENDING)], name="emotion_events_userId_courseId")
    await _create_index_safe(db.emotion_events, [("courseId", ASCENDING), ("lessonId", ASCENDING)], name="emotion_events_courseId_lessonId")
    await _create_index_safe(db.emotion_events, [("class_id", ASCENDING), ("lesson_id", ASCENDING)], name="emotion_events_class_lesson")
    await _create_index_safe(db.emotion_events, [("lesson_id", ASCENDING), ("timestamp", DESCENDING)], name="emotion_events_lesson_id_timestamp")
    await _create_index_safe(db.emotion_events, [("lesson_id", ASCENDING), ("modality", ASCENDING), ("timestamp", DESCENDING)], name="emotion_events_lesson_modality_timestamp")
    await _create_index_safe(db.emotion_events, [("teacher_id", ASCENDING), ("timestamp", DESCENDING)], name="emotion_events_teacher_timestamp")
    await _create_index_safe(db.emotion_events, [("student_id", ASCENDING), ("timestamp", DESCENDING)], name="emotion_events_student_id_timestamp")
    await _create_index_safe(db.emotion_events, [("emotion", ASCENDING), ("timestamp", DESCENDING)], name="emotion_events_emotion_timestamp")
    await _create_index_safe(db.emotion_events, [("emotion_label", ASCENDING), ("timestamp", DESCENDING)], name="emotion_events_emotion_label_timestamp")
    await _create_index_safe(db.emotion_events, [("engagement_score", DESCENDING), ("timestamp", DESCENDING)], name="emotion_events_engagement_timestamp")
    await _create_index_safe(db.emotion_events, [("live_session_id", ASCENDING), ("timestamp", DESCENDING)], name="emotion_events_live_session_timestamp")
    await _create_index_safe(
        db.emotion_events,
        [("live_session_id", ASCENDING), ("modality", ASCENDING), ("timestamp", DESCENDING)],
        name="emotion_events_live_session_modality_timestamp",
    )
    await _create_index_safe(db.emotion_events, [("user_id", ASCENDING), ("lesson_id", ASCENDING)], name="emotion_events_user_lesson")
    await _create_index_safe(db.emotion_events, [("user_id", ASCENDING), ("live_session_id", ASCENDING)], name="emotion_events_user_live_session")
    await _create_index_safe(db.emotion_events, [("session_id", ASCENDING), ("timestamp", DESCENDING)], name="emotion_events_session_timestamp")

    await _create_index_safe(
        db.sessions,
        [("sessionId", ASCENDING)],
        unique=True,
        name="sessions_sessionId_uq",
        partialFilterExpression={"sessionId": {"$type": "string"}},
    )
    await _create_index_safe(db.sessions, [("userId", ASCENDING), ("courseId", ASCENDING)], name="sessions_userId_courseId")
    await _create_index_safe(db.sessions, [("courseId", ASCENDING), ("lessonId", ASCENDING)], name="sessions_courseId_lessonId")
    await _create_index_safe(db.sessions, [("class_id", ASCENDING), ("lesson_id", ASCENDING)], name="sessions_class_lesson")
    await _create_index_safe(db.sessions, [("user_id", ASCENDING), ("started_at", DESCENDING)], name="sessions_user_started_at")

    await _create_index_safe(
        db.reports,
        [("reportId", ASCENDING)],
        unique=True,
        name="reports_reportId_uq",
        partialFilterExpression={"reportId": {"$type": "string"}},
    )
    await _create_index_safe(db.reports, [("scopeType", ASCENDING), ("scopeId", ASCENDING), ("generatedAt", DESCENDING)], name="reports_scope_generated")
    await _create_index_safe(db.reports, [("expiresAt", ASCENDING)], expireAfterSeconds=0, name="reports_expiresAt_ttl", sparse=True)

    await _create_index_safe(
        db.classes,
        [("class_id", ASCENDING)],
        unique=True,
        name="classes_class_id_uq",
        partialFilterExpression={"class_id": {"$type": "string"}},
    )
    await _create_index_safe(
        db.classes,
        [("join_code", ASCENDING)],
        unique=True,
        name="classes_join_code_uq",
        partialFilterExpression={"join_code": {"$type": "string"}},
    )
    await _create_index_safe(db.classes, [("teacher_id", ASCENDING), ("created_at", DESCENDING)], name="classes_teacher_created_at")

    await _create_index_safe(
        db.class_members,
        [("class_id", ASCENDING), ("user_id", ASCENDING)],
        unique=True,
        name="class_members_class_user_uq",
        partialFilterExpression={"class_id": {"$type": "string"}, "user_id": {"$type": "string"}},
    )
    await _create_index_safe(db.class_members, [("user_id", ASCENDING), ("status", ASCENDING)], name="class_members_user_status")
    await _create_index_safe(
        db.class_members,
        [("class_id", ASCENDING), ("status", ASCENDING), ("member_role", ASCENDING)],
        name="class_members_class_status_role",
    )

    await _create_index_safe(db.notifications, [("user_id", ASCENDING), ("read", ASCENDING)], name="notifications_user_read")
    await _create_index_safe(db.notifications, [("to_user_id", ASCENDING), ("is_read", ASCENDING)], name="notifications_to_user_is_read")
    await _create_index_safe(db.notifications, [("user_id", ASCENDING), ("created_at", DESCENDING)], name="notifications_user_created_at")
    await _create_index_safe(db.notifications, [("to_user_id", ASCENDING), ("created_at", DESCENDING)], name="notifications_to_user_created_at")

    await _create_index_safe(db.attention_events, [("lesson_id", ASCENDING), ("timestamp", DESCENDING)], name="attention_events_lesson_timestamp")
    await _create_index_safe(db.attention_events, [("student_id", ASCENDING), ("timestamp", DESCENDING)], name="attention_events_student_id_timestamp")
    await _create_index_safe(db.attention_events, [("state", ASCENDING), ("timestamp", DESCENDING)], name="attention_events_state_timestamp")
    await _create_index_safe(db.attention_events, [("user_id", ASCENDING), ("lesson_id", ASCENDING), ("timestamp", DESCENDING)], name="attention_events_user_lesson_timestamp")
    await _create_index_safe(db.attention_events, [("session_id", ASCENDING), ("timestamp", DESCENDING)], name="attention_events_session_timestamp")
    await _create_index_safe(db.attention_events, [("live_session_id", ASCENDING), ("timestamp", DESCENDING)], name="attention_events_live_session_timestamp")
    await _create_index_safe(
        db.attention_events,
        [("user_id", ASCENDING), ("live_session_id", ASCENDING), ("timestamp", DESCENDING)],
        name="attention_events_user_live_session_timestamp",
    )

    await _create_index_safe(
        db.comments,
        [("lesson_id", ASCENDING), ("class_id", ASCENDING), ("created_at", DESCENDING)],
        name="comments_lesson_class_created_at",
    )
    await _create_index_safe(
        db.comments,
        [("user_id", ASCENDING), ("lesson_id", ASCENDING), ("created_at", DESCENDING)],
        name="comments_user_lesson_created_at",
    )
    await _create_index_safe(
        db.comments,
        [("session_id", ASCENDING), ("created_at", DESCENDING)],
        name="comments_session_created_at",
    )
    await _create_index_safe(
        db.comments,
        [("live_session_id", ASCENDING), ("created_at", DESCENDING)],
        name="comments_live_session_created_at",
    )

    await _create_index_safe(
        db.voice_feedback,
        [("lesson_id", ASCENDING), ("class_id", ASCENDING), ("created_at", DESCENDING)],
        name="voice_feedback_lesson_class_created_at",
    )
    await _create_index_safe(
        db.voice_feedback,
        [("user_id", ASCENDING), ("lesson_id", ASCENDING), ("created_at", DESCENDING)],
        name="voice_feedback_user_lesson_created_at",
    )
    await _create_index_safe(
        db.voice_feedback,
        [("session_id", ASCENDING), ("created_at", DESCENDING)],
        name="voice_feedback_session_created_at",
    )
    await _create_index_safe(
        db.voice_feedback,
        [("live_session_id", ASCENDING), ("created_at", DESCENDING)],
        name="voice_feedback_live_session_created_at",
    )

    await _create_index_safe(
        db.live_classes,
        [("live_session_id", ASCENDING)],
        unique=True,
        name="live_classes_live_session_id_uq",
        partialFilterExpression={"live_session_id": {"$type": "string"}},
    )
    await _create_index_safe(
        db.live_classes,
        [("teacher_id", ASCENDING), ("status", ASCENDING), ("started_at", DESCENDING)],
        name="live_classes_teacher_status_started_at",
    )
    await _create_index_safe(
        db.live_classes,
        [("class_id", ASCENDING), ("status", ASCENDING), ("started_at", DESCENDING)],
        name="live_classes_class_status_started_at",
    )
    await _create_index_safe(
        db.live_classes,
        [("status", ASCENDING), ("started_at", DESCENDING)],
        name="live_classes_status_started_at",
    )

    await _create_index_safe(
        db.live_participants,
        [("live_session_id", ASCENDING), ("user_id", ASCENDING)],
        unique=True,
        name="live_participants_session_user_uq",
        partialFilterExpression={"live_session_id": {"$type": "string"}, "user_id": {"$type": "string"}},
    )
    await _create_index_safe(
        db.live_participants,
        [("live_session_id", ASCENDING), ("is_active", ASCENDING), ("role", ASCENDING)],
        name="live_participants_session_active_role",
    )
    await _create_index_safe(
        db.live_participants,
        [("user_id", ASCENDING), ("joined_at", DESCENDING)],
        name="live_participants_user_joined_at",
    )

    await _create_index_safe(
        db.live_chat,
        [("live_session_id", ASCENDING), ("created_at", DESCENDING)],
        name="live_chat_session_created_at",
    )
    await _create_index_safe(
        db.live_chat,
        [("user_id", ASCENDING), ("live_session_id", ASCENDING), ("created_at", DESCENDING)],
        name="live_chat_user_session_created_at",
    )

    await _create_index_safe(
        db.lesson_progress,
        [("lesson_id", ASCENDING), ("session_id", ASCENDING), ("user_id", ASCENDING)],
        unique=True,
        name="lesson_progress_lesson_session_user_uq",
        partialFilterExpression={
            "lesson_id": {"$type": "string"},
            "session_id": {"$type": "string"},
            "user_id": {"$type": "string"},
        },
    )
    await _create_index_safe(
        db.lesson_progress,
        [("lesson_id", ASCENDING), ("class_id", ASCENDING), ("updated_at", DESCENDING)],
        name="lesson_progress_lesson_class_updated",
    )
    await _create_index_safe(
        db.lesson_completions,
        [("lesson_id", ASCENDING), ("session_id", ASCENDING), ("user_id", ASCENDING)],
        unique=True,
        name="lesson_completions_lesson_session_user_uq",
        partialFilterExpression={
            "lesson_id": {"$type": "string"},
            "session_id": {"$type": "string"},
            "user_id": {"$type": "string"},
        },
    )
    await _create_index_safe(
        db.lesson_completions,
        [("lesson_id", ASCENDING), ("class_id", ASCENDING), ("completed_at", DESCENDING)],
        name="lesson_completions_lesson_class_completed",
    )

    await _create_index_safe(
        db.lesson_assignments,
        [("class_id", ASCENDING), ("lesson_id", ASCENDING)],
        unique=True,
        name="lesson_assignments_class_lesson_uq",
        partialFilterExpression={"class_id": {"$type": "string"}, "lesson_id": {"$type": "string"}},
    )
    await _create_index_safe(db.lesson_assignments, [("class_id", ASCENDING), ("is_published", ASCENDING), ("publish_at", ASCENDING)], name="lesson_assignments_class_publish")
    await _create_index_safe(db.lesson_assignments, [("lesson_id", ASCENDING)], name="lesson_assignments_lesson")
