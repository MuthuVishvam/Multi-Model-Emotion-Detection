from db.mongo import (
    close_mongo_connection,
    collections,
    get_attention_events_collection,
    get_classes_collection,
    get_class_members_collection,
    get_comments_collection,
    get_db,
    get_emotion_events_collection,
    get_emotion_logs_collection,
    get_lesson_completions_collection,
    get_live_chat_collection,
    get_live_classes_collection,
    get_live_participants_collection,
    get_lessons_collection,
    get_lesson_assignments_collection,
    get_lesson_progress_collection,
    get_notifications_collection,
    get_sessions_collection,
    get_user_collection,
    get_voice_feedback_collection,
    init_mongo_connection,
    ping_database,
)


class DatabaseProxy:
    def __getattr__(self, item: str):
        return getattr(collections, item)


db = DatabaseProxy()


__all__ = [
    "db",
    "collections",
    "DatabaseProxy",
    "get_db",
    "init_mongo_connection",
    "close_mongo_connection",
    "ping_database",
    "get_user_collection",
    "get_sessions_collection",
    "get_emotion_logs_collection",
    "get_emotion_events_collection",
    "get_attention_events_collection",
    "get_lessons_collection",
    "get_classes_collection",
    "get_class_members_collection",
    "get_notifications_collection",
    "get_lesson_assignments_collection",
    "get_comments_collection",
    "get_voice_feedback_collection",
    "get_lesson_progress_collection",
    "get_lesson_completions_collection",
    "get_live_classes_collection",
    "get_live_participants_collection",
    "get_live_chat_collection",
]
