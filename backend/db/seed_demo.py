from datetime import datetime, timedelta, timezone
import random

from bson import ObjectId
from pymongo import MongoClient

from app.config import settings
from app.security import get_password_hash


EMOTIONS = ["joy", "neutral", "sadness", "anger", "surprise", "fear", "disgust"]


def upsert_user(
    db,
    email: str,
    password: str,
    role: str,
    *,
    full_name: str | None = None,
    username: str | None = None,
    phone: str | None = None,
    designation: str | None = None,
    department: str | None = None,
    year: str | None = None,
    experience_years: int | None = None,
    status: str | None = None,
    verified: bool | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    default_status = status or ("pending" if role == "teacher" else "approved")
    default_verified = verified if verified is not None else (default_status == "approved")
    default_verified_at = now if default_verified else None
    default_username = username or email.split("@")[0]
    default_full_name = full_name or default_username

    defaults = {
        "role": role,
        "username": default_username,
        "full_name": default_full_name,
        "phone": phone,
        "designation": designation,
        "department": department,
        "year": year,
        "experience_years": experience_years,
        "avatar_url": None,
        "bio": None,
        "status": default_status,
        "verified": default_verified,
        "verified_at": default_verified_at,
        "is_active": True,
        "isActive": True,
        "updated_at": now,
    }

    existing = db.users.find_one({"email": email})
    if existing:
        patch = {
            "password_hash": get_password_hash(password),
        }
        for key, value in defaults.items():
            if existing.get(key) != value:
                patch[key] = value
        if patch:
            db.users.update_one({"_id": existing["_id"]}, {"$set": patch})
            existing.update(patch)
        return existing

    doc = {
        "email": email,
        "password_hash": get_password_hash(password),
        "created_at": now,
        **defaults,
    }
    result = db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def create_or_get_demo_session(db, teacher_email: str) -> str:
    existing = db.sessions.find_one({"session_name": "Demo Session", "created_by": teacher_email})
    if existing:
        return str(existing["_id"])

    session_doc = {
        "session_name": "Demo Session",
        "course": "AI in Education",
        "created_by": teacher_email,
        "created_at": datetime.now(timezone.utc),
    }
    result = db.sessions.insert_one(session_doc)
    return str(result.inserted_id)


def seed_logs(db, session_id: str, student_ids: list[str]) -> None:
    existing_count = db.emotion_logs.count_documents({"session_id": session_id})
    if existing_count >= 10:
        return

    base_time = datetime.now(timezone.utc) - timedelta(minutes=30)
    logs = []
    random.seed(42)
    for idx in range(15):
        emotion = random.choice(EMOTIONS)
        top_score = round(random.uniform(0.55, 0.9), 3)
        scores = {label: round((1 - top_score) / (len(EMOTIONS) - 1), 3) for label in EMOTIONS}
        scores[emotion] = top_score
        logs.append(
            {
                "session_id": session_id,
                "student_id": random.choice(student_ids),
                "text": f"Demo classroom utterance {idx + 1}",
                "emotion": emotion,
                "scores": scores,
                "created_at": base_time + timedelta(minutes=idx * 2),
                "logged_by": "teacher@test.com",
            }
        )

    db.emotion_logs.insert_many(logs)


def seed_lessons(db, teacher_email: str) -> None:
    lessons = [
        {
            "title": "Introduction to Emotion AI",
            "description": "Foundational concepts for affect-aware systems",
            "content": "Emotion AI uses signals from text, audio, and visuals to infer affective states.",
            "created_by": teacher_email,
            "created_at": datetime.now(timezone.utc),
        },
        {
            "title": "Building Dashboards for Learning Analytics",
            "description": "How to interpret session-level engagement trends",
            "content": "Dashboards should show distribution, temporal patterns, and student-wise indicators.",
            "created_by": teacher_email,
            "created_at": datetime.now(timezone.utc),
        },
    ]

    for lesson in lessons:
        existing = db.lessons.find_one({"title": lesson["title"], "created_by": teacher_email})
        if not existing:
            lesson_id = ObjectId()
            lesson["_id"] = lesson_id
            lesson["lesson_id"] = str(lesson_id)
            db.lessons.insert_one(lesson)


def main() -> None:
    client = MongoClient(settings.mongo_uri)
    db = client[settings.db_name]

    teacher = upsert_user(
        db,
        "teacher@test.com",
        "123456",
        "teacher",
        full_name="Demo Teacher",
        username="demo_teacher",
        designation="Lecturer",
        department="Computer Science",
        experience_years=5,
        status="approved",
        verified=True,
    )
    pending_teacher = upsert_user(
        db,
        "teacher_pending@test.com",
        "123456",
        "teacher",
        full_name="Pending Teacher",
        username="pending_teacher",
        designation="Teaching Assistant",
        department="Computer Science",
        experience_years=2,
        status="pending",
        verified=False,
    )
    student1 = upsert_user(
        db,
        "student1@test.com",
        "123456",
        "student",
        full_name="Student One",
        username="student_one",
        department="Computer Science",
        year="2nd",
        status="approved",
        verified=True,
    )
    student2 = upsert_user(
        db,
        "student2@test.com",
        "123456",
        "student",
        full_name="Student Two",
        username="student_two",
        department="Computer Science",
        year="3rd",
        status="approved",
        verified=True,
    )
    admin = upsert_user(
        db,
        "admin@test.com",
        "123456",
        "admin",
        full_name="Platform Admin",
        username="admin_user",
        status="approved",
        verified=True,
    )

    session_id = create_or_get_demo_session(db, teacher["email"])
    seed_logs(db, session_id, [student1["email"], student2["email"]])
    seed_lessons(db, teacher["email"])

    print("Demo seed complete")
    print("Teacher: teacher@test.com / 123456 (approved)")
    print("Pending teacher: teacher_pending@test.com / 123456")
    print("Admin: admin@test.com / 123456")
    print(f"Session ID: {session_id}")


if __name__ == "__main__":
    main()
