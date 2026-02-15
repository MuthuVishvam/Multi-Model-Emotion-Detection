from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

from app.config import settings


_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def init_mongo_connection() -> None:
    global _client, _db
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongo_uri)
        _db = _client[settings.db_name]


async def close_mongo_connection() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        init_mongo_connection()
    return _db


async def ping_database() -> None:
    database = get_db()
    await database.command("ping")


class Collections:
    @property
    def users(self) -> AsyncIOMotorCollection:
        return get_db()["users"]

    @property
    def sessions(self) -> AsyncIOMotorCollection:
        return get_db()["sessions"]

    @property
    def emotion_logs(self) -> AsyncIOMotorCollection:
        return get_db()["emotion_logs"]

    @property
    def lessons(self) -> AsyncIOMotorCollection:
        return get_db()["lessons"]


collections = Collections()
