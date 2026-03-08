import json
from pathlib import Path

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import OperationFailure

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


def ensure_collection_exists(db, name: str) -> None:
    if name in db.list_collection_names():
        return
    db.create_collection(name)


def create_indexes(db) -> None:
    def _create_index(collection, keys, **kwargs):
        try:
            collection.create_index(keys, **kwargs)
        except OperationFailure as exc:
            # Safe reruns when an equivalent index already exists under a different name/options.
            if exc.code == 85:
                return
            raise

    _create_index(db.users, [("email", ASCENDING)], unique=True)
    _create_index(db.users, [("username", ASCENDING)], unique=True, sparse=True)
    _create_index(db.users, [("role", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)])
    _create_index(db.users, [("role", ASCENDING), ("verified", ASCENDING)])
    _create_index(db.sessions, [("created_by", ASCENDING), ("created_at", DESCENDING)])
    _create_index(db.emotion_logs, [("session_id", ASCENDING), ("created_at", DESCENDING)])
    _create_index(db.emotion_logs, [("student_id", ASCENDING)])
    _create_index(db.emotion_events, [("lesson_id", ASCENDING), ("timestamp", DESCENDING)])
    _create_index(db.emotion_events, [("lesson_id", ASCENDING), ("modality", ASCENDING), ("timestamp", DESCENDING)])
    _create_index(db.emotion_events, [("user_id", ASCENDING), ("lesson_id", ASCENDING)])
    _create_index(db.attention_events, [("lesson_id", ASCENDING), ("timestamp", DESCENDING)])
    _create_index(db.attention_events, [("user_id", ASCENDING), ("lesson_id", ASCENDING), ("timestamp", DESCENDING)])
    _create_index(db.attention_events, [("session_id", ASCENDING), ("timestamp", DESCENDING)])
    _create_index(db.lessons, [("created_by", ASCENDING), ("created_at", DESCENDING)])
    _create_index(db.lessons, [("lesson_id", ASCENDING)], unique=True, sparse=True)
    _create_index(db.lessons, [("teacher_id", ASCENDING), ("created_at", DESCENDING)])
    _create_index(db.lessons, [("course_id", ASCENDING), ("created_at", DESCENDING)])
    _create_index(db.classes, [("class_id", ASCENDING)], unique=True)
    _create_index(db.classes, [("join_code", ASCENDING)], unique=True)
    _create_index(db.class_members, [("class_id", ASCENDING), ("user_id", ASCENDING)], unique=True)
    _create_index(db.class_members, [("user_id", ASCENDING), ("status", ASCENDING)])
    _create_index(db.enrollments, [("class_id", ASCENDING), ("student_id", ASCENDING)], unique=True)
    _create_index(db.enrollments, [("student_id", ASCENDING), ("status", ASCENDING), ("updated_at", DESCENDING)])
    _create_index(db.notifications, [("user_id", ASCENDING), ("read", ASCENDING)])
    _create_index(db.notifications, [("to_user_id", ASCENDING), ("is_read", ASCENDING)])
    _create_index(db.lesson_assignments, [("class_id", ASCENDING), ("lesson_id", ASCENDING)], unique=True)
    _create_index(db.lesson_assignments, [("class_id", ASCENDING), ("is_published", ASCENDING), ("publish_at", ASCENDING)])
    _create_index(db.lesson_assignments, [("lesson_id", ASCENDING)])


def main() -> None:
    client = MongoClient(settings.mongo_uri)
    db = client[settings.db_name]

    ensure_collection_with_validator(db, "users", load_validator("users.validator.json"))
    ensure_collection_with_validator(db, "sessions", load_validator("sessions.validator.json"))
    ensure_collection_with_validator(db, "emotion_logs", load_validator("emotion_logs.validator.json"))
    ensure_collection_with_validator(db, "lessons", load_validator("lessons.validator.json"))
    ensure_collection_exists(db, "classes")
    ensure_collection_exists(db, "class_members")
    ensure_collection_exists(db, "enrollments")
    ensure_collection_exists(db, "lesson_assignments")
    ensure_collection_exists(db, "emotion_events")
    ensure_collection_exists(db, "attention_events")
    ensure_collection_exists(db, "notifications")
    ensure_collection_exists(db, "comments")
    ensure_collection_exists(db, "voice_feedback")
    ensure_collection_exists(db, "lesson_progress")
    ensure_collection_exists(db, "lesson_completions")

    create_indexes(db)

    print(f"Mongo initialized for DB '{settings.db_name}' at {settings.mongo_uri}")


if __name__ == "__main__":
    main()
