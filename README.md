# Multi-Model Emotion Detection Platform

Monorepo with:
- `backend/`: FastAPI + MongoDB Atlas + JWT auth
- `frontend/`: React (Vite) learning platform UI

## Monorepo Structure

```text
Multi-Model-Emotion-Detection/
├── backend/
├── frontend/
├── ml/
├── docs/
├── docker/
├── data/
├── logs/
├── images/
├── deployment.md
└── README.md
```

## Local Development

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

- UI: `http://localhost:5173`

## Environment Variables

### Backend `.env` (`backend/.env`)

```env
MONGO_URI=<your-atlas-uri>
DB_NAME=emotion_platform
SECRET_KEY=<your-strong-secret>
JWT_EXPIRE_MINUTES=120
FRONTEND_ORIGIN=http://localhost:5173
PORT=8000
```

Notes:
- `SECRET_KEY` is used for JWT signing.
- `JWT_EXPIRE_MINUTES` is supported by backend settings.
- `FRONTEND_ORIGIN` is appended to CORS allow list.

### Frontend `.env` (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

`VITE_API_URL` is used by `frontend/src/api.js` for all API calls.

## Auth + Admin Workflow

- Student register/login: direct access after registration.
- Teacher register: stored as pending and blocked from teacher features until admin approval.
- Teacher lifecycle:
  - `pending`
  - `approved`
  - `rejected`
- Admin can approve/reject/disable/enable teachers from dashboard.

## Key Admin APIs

- `GET /admin/teachers/pending`
- `GET /admin/teachers`
- `POST /admin/teachers/{teacher_id}/approve`
- `POST /admin/teachers/{teacher_id}/reject`
- `POST /admin/teachers/{teacher_id}/disable`
- `POST /admin/teachers/{teacher_id}/enable`

## Production Targets

- Backend: Render
- Frontend: Vercel
- Database: MongoDB Atlas

See [deployment.md](./deployment.md) for exact step-by-step deployment and redeployment instructions.
