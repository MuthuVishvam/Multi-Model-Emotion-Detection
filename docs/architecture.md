# Architecture

## Overview

Emotion Learning Platform is a monorepo with React frontend and FastAPI backend.

- RBAC: `student`, `teacher`, `admin`
- Teachers require admin approval (`status=approved`, `verified=true`) before login.
- Student accounts are auto-approved.

## Backend Layers

- `routes/`: API route grouping
- `schemas/`: request/response contracts
- `models/`: document models and compatibility exports
- `services/`: business logic orchestration
- `database/`: MongoDB access wrappers
- `middleware/`: auth middleware exports
- `utils/`: JWT + logging helpers
- `ml/`: emotion engine wrappers

## Data Flow

1. Student starts session in lesson player.
2. Browser-side trackers emit face/text/voice + attention events.
3. Backend stores events in MongoDB (`emotion_events`, `attention_events`, comments, voice feedback).
4. Analytics services aggregate by lesson/class/date filters.
5. Teacher dashboard renders modality charts and per-student drilldowns.

## Security

- JWT bearer authentication
- Role checks via dependencies (`require_role`, `require_teacher`, `require_admin`)
- Disabled accounts blocked globally
- Pending/unverified teachers blocked at login

## Deployability

- Env-based config (`MONGO_URI`, `SECRET_KEY`, `FRONTEND_ORIGIN`, `PORT`)
- CORS configured for local + Vercel origin
- Uvicorn binds to `0.0.0.0` and Render `PORT`
