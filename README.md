# Emotion Learning Platform

Production-style monorepo for emotion-aware digital learning.

## Project Structure

```text
emotion-learning-platform/
+-- backend/
+-- frontend/
+-- docs/
+-- docker/
+-- data/
+-- logs/
+-- images/
+-- ml/
+-- utils/
+-- .gitignore
+-- README.md
+-- deployment.md
```

## Local Run

### 1) Backend (FastAPI)

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Backend:
- API base: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`

### 2) Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend:
- App URL: `http://localhost:5173`

## Environment Variables

### Backend (`backend/.env`)

```env
MONGO_URI=<your-mongodb-atlas-uri>
DB_NAME=emotion_platform
SECRET_KEY=<your-strong-secret>
JWT_EXPIRE_MINUTES=120
FRONTEND_ORIGIN=http://localhost:5173
PORT=8000
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

## Dependencies

- Python dependencies: `backend/requirements.txt`
- Frontend dependencies: `frontend/package.json`

## API Docs

- OpenAPI Swagger UI: `/docs` (example: `http://localhost:8000/docs`)

## Deployment

See [deployment.md](./deployment.md) for Render + Vercel + MongoDB Atlas setup placeholders.
