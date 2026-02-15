from datetime import datetime, timezone
from pathlib import Path
import sys

from bson import ObjectId
from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

import app.main as main_module
from app.dependencies import get_current_user
from app.main import app
from app.routers import dashboard, emotion, sessions


class FakeInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class FakeCursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, key, direction):
        reverse = direction == -1
        self.docs = sorted(self.docs, key=lambda item: item.get(key), reverse=reverse)
        return self

    async def to_list(self, length=None):
        return list(self.docs)


class FakeCollection:
    def __init__(self):
        self.docs = []

    async def find_one(self, query, projection=None):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                if projection:
                    result = dict(doc)
                    if projection.get("password_hash") == 0:
                        result.pop("password_hash", None)
                    return result
                return dict(doc)
        return None

    async def insert_one(self, doc):
        stored = dict(doc)
        if "_id" not in stored:
            stored["_id"] = ObjectId()
        self.docs.append(stored)
        return FakeInsertResult(stored["_id"])

    def find(self, query):
        matched = []
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                matched.append(dict(doc))
        return FakeCursor(matched)


class FakeDB:
    def __init__(self):
        self.users = FakeCollection()
        self.sessions = FakeCollection()
        self.emotion_logs = FakeCollection()
        self.lessons = FakeCollection()


def patch_lifespan_db(monkeypatch):
    async def noop_async():
        return None

    monkeypatch.setattr(main_module, "init_mongo_connection", lambda: None)
    monkeypatch.setattr(main_module, "ping_database", noop_async)
    monkeypatch.setattr(main_module, "close_mongo_connection", noop_async)


def setup_fake_db():
    fake_db = FakeDB()

    session_id = ObjectId()
    fake_db.sessions.docs.append(
        {
            "_id": session_id,
            "session_name": "Test Session",
            "created_by": "teacher@example.com",
            "created_at": datetime.now(timezone.utc),
        }
    )

    emotion.db = fake_db
    dashboard.db = fake_db
    sessions.db = fake_db

    return fake_db, str(session_id)


def test_health_endpoint(monkeypatch):
    patch_lifespan_db(monkeypatch)
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_predict_text_endpoint_stores_log(monkeypatch):
    patch_lifespan_db(monkeypatch)
    fake_db, session_id = setup_fake_db()

    def fake_predict(text: str):
        return "joy", {"joy": 0.9, "neutral": 0.1}

    monkeypatch.setattr(emotion.predictor_service, "predict", fake_predict)

    app.dependency_overrides[get_current_user] = lambda: {"email": "teacher@example.com"}

    with TestClient(app) as client:
        response = client.post(
            "/emotion/predict_text",
            json={
                "session_id": session_id,
                "student_id": "student-1",
                "text": "I am happy",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["emotion"] == "joy"
    assert "scores" in payload
    assert len(fake_db.emotion_logs.docs) == 1
    assert fake_db.emotion_logs.docs[0]["student_id"] == "student-1"

    app.dependency_overrides.clear()
