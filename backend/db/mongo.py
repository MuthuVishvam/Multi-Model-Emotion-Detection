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


def get_lessons_collection() -> AsyncIOMotorCollection:
    return get_db()["lessons"]


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
    def lessons(self) -> AsyncIOMotorCollection:
        return get_lessons_collection()


collections = Collections()
