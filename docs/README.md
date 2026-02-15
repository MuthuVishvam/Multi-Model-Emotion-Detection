# Step 4: MongoDB Compass + Lesson CRUD + One Command Run

## 1) Backend environment

Create `backend/.env` from template:

```bash
copy backend\.env.template backend\.env
```

Required values:

```env
MONGO_URI=mongodb://localhost:27017
DB_NAME=emotion_platform
JWT_SECRET=your_secret
```

## 2) Initialize DB schema and seed data

From `backend/`:

```bash
python -m db.init_mongo
python -m db.seed_demo
```

## 3) One command start (Windows)

From project root:

```bash
.\run_dev.ps1
```

This launches:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

Alternative Docker startup:

```bash
docker compose -f docker/docker-compose.yml --profile frontend up --build
```

## 4) Verify Compass + backend connection

- Check backend terminal for log: `DB connected`
- In MongoDB Compass, open DB `emotion_platform`
- Confirm collections: `users`, `sessions`, `emotion_logs`, `lessons`
- Insert flow: post `/emotion/predict_text` and confirm new document in `emotion_logs`

## 5) Lesson CRUD endpoints

- `POST /lessons` (teacher only)
- `GET /lessons`
- `GET /lessons/{id}`
- `DELETE /lessons/{id}` (teacher only)

Stored lesson fields:

- `lesson_id`
- `title`
- `description`
- `content`
- `created_by`
- `created_at`
