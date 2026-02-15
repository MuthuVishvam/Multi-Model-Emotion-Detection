# Step 3: MongoDB Setup + Lessons API

## Environment (`backend/.env`)

Use this template from `backend/.env.example`:

```env
PYTHONPATH=.
MONGO_URI=mongodb://localhost:27017
DB_NAME=emotion_platform
JWT_SECRET=change_me
CORS_ORIGINS=["http://localhost:5173"]
MODEL_ARTIFACT_PATH=../ml/artifacts/text_emotion_model.joblib
```

## Option 1: Local MongoDB installation

1. Install MongoDB Community Server.
2. Start MongoDB service (`mongod`) on default port `27017`.
3. Verify:

```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

## Option 2: Docker MongoDB

From repository root:

```bash
docker compose -f docker/docker-compose.yml up -d mongodb
```

## Initialize schema + indexes

From `backend/`:

```bash
python -m db.init_mongo
```

This creates validators and indexes for:

- `users` (unique `email`)
- `sessions` (`created_by`, `created_at`)
- `emotion_logs` (`session_id`, `created_at`) and (`student_id`)
- `lessons` (`created_by`, `created_at`)

## Seed demo data

From `backend/`:

```bash
python -m db.seed_demo
```

Seeded:

- Teacher: `teacher@test.com` / `123456`
- Students: `student1@test.com`, `student2@test.com`
- 1 demo session
- 15 demo emotion logs
- 2 sample lessons

## Run backend

From `backend/`:

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Quick test flow

1. Login as teacher:

```bash
curl -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d '{"email":"teacher@test.com","password":"123456"}'
```

2. Create lesson (teacher-only):

```bash
curl -X POST http://localhost:8000/lessons -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"title":"Week 1","description":"Intro","content":"Emotion AI basics"}'
```

3. Start session:

```bash
curl -X POST http://localhost:8000/sessions/start -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"session_name":"Live Class"}'
```

4. Predict text (stores in `emotion_logs`):

```bash
curl -X POST http://localhost:8000/emotion/predict_text -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"session_id":"<SESSION_ID>","student_id":"student1@test.com","text":"I understand this now"}'
```

5. Verify logs inserted:

```bash
mongosh --eval "use emotion_platform; db.emotion_logs.find().limit(3).pretty()"
```

6. Open dashboard summary:

```bash
curl -H "Authorization: Bearer <TOKEN>" "http://localhost:8000/dashboard/summary?session_id=<SESSION_ID>"
```
