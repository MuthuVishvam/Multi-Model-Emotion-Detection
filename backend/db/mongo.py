import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

from app.config import settings


logger = logging.getLogger("emotion_backend")
_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def init_mongo_connection() -> AsyncIOMotorDatabase:
    global _client, _db
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongo_uri)
        _db = _client[settings.db_name]
    return _db


async def close_mongo_connection() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        return init_mongo_connection()
    return _db


async def ping_database() -> None:
    await get_db().command("ping")


def get_user_collection() -> AsyncIOMotorCollection:
    return get_db()["users"]


def get_sessions_collection() -> AsyncIOMotorCollection:
    return get_db()["sessions"]


def get_emotion_logs_collection() -> AsyncIOMotorCollection:
    return get_db()["emotion_logs"]


def get_emotion_events_collection() -> AsyncIOMotorCollection:
    return get_db()["emotion_events"]


def get_attention_events_collection() -> AsyncIOMotorCollection:
    return get_db()["attention_events"]


def get_lessons_collection() -> AsyncIOMotorCollection:
    return get_db()["lessons"]


def get_classes_collection() -> AsyncIOMotorCollection:
    return get_db()["classes"]


def get_class_members_collection() -> AsyncIOMotorCollection:
    return get_db()["class_members"]


def get_notifications_collection() -> AsyncIOMotorCollection:
    return get_db()["notifications"]


def get_lesson_assignments_collection() -> AsyncIOMotorCollection:
    return get_db()["lesson_assignments"]


def get_comments_collection() -> AsyncIOMotorCollection:
    return get_db()["comments"]


def get_voice_feedback_collection() -> AsyncIOMotorCollection:
    return get_db()["voice_feedback"]


def get_lesson_progress_collection() -> AsyncIOMotorCollection:
    return get_db()["lesson_progress"]


def get_lesson_completions_collection() -> AsyncIOMotorCollection:
    return get_db()["lesson_completions"]


def get_live_classes_collection() -> AsyncIOMotorCollection:
    return get_db()["live_classes"]


def get_live_participants_collection() -> AsyncIOMotorCollection:
    return get_db()["live_participants"]


def get_live_chat_collection() -> AsyncIOMotorCollection:
    return get_db()["live_chat"]


class Collections:
    @property
    def users(self) -> AsyncIOMotorCollection:
        return get_user_collection()

    @property
    def sessions(self) -> AsyncIOMotorCollection:
        return get_sessions_collection()

    @property
    def emotion_logs(self) -> AsyncIOMotorCollection:
        return get_emotion_logs_collection()

    @property
    def emotion_events(self) -> AsyncIOMotorCollection:
        return get_emotion_events_collection()

    @property
    def attention_events(self) -> AsyncIOMotorCollection:
        return get_attention_events_collection()

    @property
    def lessons(self) -> AsyncIOMotorCollection:
        return get_lessons_collection()

    @property
    def classes(self) -> AsyncIOMotorCollection:
        return get_classes_collection()

    @property
    def class_members(self) -> AsyncIOMotorCollection:
        return get_class_members_collection()

    @property
    def notifications(self) -> AsyncIOMotorCollection:
        return get_notifications_collection()

    @property
    def lesson_assignments(self) -> AsyncIOMotorCollection:
        return get_lesson_assignments_collection()

    @property
    def comments(self) -> AsyncIOMotorCollection:
        return get_comments_collection()

    @property
    def voice_feedback(self) -> AsyncIOMotorCollection:
        return get_voice_feedback_collection()

    @property
    def lesson_progress(self) -> AsyncIOMotorCollection:
        return get_lesson_progress_collection()

    @property
    def lesson_completions(self) -> AsyncIOMotorCollection:
        return get_lesson_completions_collection()

    @property
    def live_classes(self) -> AsyncIOMotorCollection:
        return get_live_classes_collection()

    @property
    def live_participants(self) -> AsyncIOMotorCollection:
        return get_live_participants_collection()

    @property
    def live_chat(self) -> AsyncIOMotorCollection:
        return get_live_chat_collection()


collections = Collections()
