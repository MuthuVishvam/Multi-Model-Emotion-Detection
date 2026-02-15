# Step 1 Scaffold Documentation

## Folder Structure

- `backend/`: FastAPI app with auth, sessions, dashboard, and health endpoints.
- `frontend/`: React + Vite UI with Login, Student Session, Teacher Dashboard pages.
- `ml/`: PyTorch dummy text emotion predictor and a placeholder model API.
- `docs/`: Project documentation.
- `docker/`: Docker Compose stack definitions.

## Backend Endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /sessions/start`
- `POST /sessions/{id}/log_emotion`
- `GET /dashboard/summary?session_id=...`

## ML Placeholder Endpoints

- `GET /health`
- `POST /predict_text`

## One-Command Run

From repository root:

```bash
docker compose -f docker/docker-compose.yml up --build
```

With frontend enabled:

```bash
docker compose -f docker/docker-compose.yml --profile frontend up --build
```

## Service URLs

- Backend API: `http://localhost:8000`
- Frontend: `http://localhost:5173` (when profile `frontend` is enabled)
- ML API: `http://localhost:8001`
- MongoDB: `mongodb://localhost:27017`
