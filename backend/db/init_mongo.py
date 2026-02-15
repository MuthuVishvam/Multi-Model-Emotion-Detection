import json
from pathlib import Path

from pymongo import ASCENDING, DESCENDING, MongoClient

from app.config import settings


SCHEMA_DIR = Path(__file__).resolve().parent / "schema"


def load_validator(file_name: str) -> dict:
    with (SCHEMA_DIR / file_name).open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def ensure_collection_with_validator(db, name: str, validator: dict) -> None:
    if name in db.list_collection_names():
        db.command(
            {
                "collMod": name,
                "validator": validator,
                "validationLevel": "moderate",
            }
        )
    else:
        db.create_collection(name, validator=validator, validationLevel="moderate")


def create_indexes(db) -> None:
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.sessions.create_index([("created_by", ASCENDING), ("created_at", DESCENDING)])
    db.emotion_logs.create_index([("session_id", ASCENDING), ("created_at", DESCENDING)])
    db.emotion_logs.create_index([("student_id", ASCENDING)])
    db.lessons.create_index([("created_by", ASCENDING), ("created_at", DESCENDING)])


def main() -> None:
    client = MongoClient(settings.mongo_uri)
    db = client[settings.db_name]

    ensure_collection_with_validator(db, "users", load_validator("users.validator.json"))
    ensure_collection_with_validator(db, "sessions", load_validator("sessions.validator.json"))
    ensure_collection_with_validator(db, "emotion_logs", load_validator("emotion_logs.validator.json"))
    ensure_collection_with_validator(db, "lessons", load_validator("lessons.validator.json"))

    create_indexes(db)

    print(f"Mongo initialized for DB '{settings.db_name}' at {settings.mongo_uri}")


if __name__ == "__main__":
    main()
