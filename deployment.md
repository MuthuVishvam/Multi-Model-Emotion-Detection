# Deployment Guide (GitHub + Atlas + Render + Vercel)

This project is deployment-ready for:
- MongoDB Atlas (database)
- Render (FastAPI backend)
- Vercel (React/Vite frontend)

## 1. Push to GitHub

From repo root:

```bash
git add .
git commit -m "UI/auth/admin/deployment readiness update"
git push origin main
```

Use your deployment branch if not `main`.

## 2. MongoDB Atlas Setup

1. Create or use an Atlas cluster.
2. Create a DB user with read/write access.
3. Add network access:
   - during setup: `0.0.0.0/0`
   - later: lock down to Render egress if needed.
4. Copy connection string:
   - `MONGO_URI=mongodb+srv://<user>:<password>@<cluster>...`
5. Choose DB name:
   - `DB_NAME=emotion_platform` (or your preferred name).

## 3. Backend Deploy on Render

Create a new Web Service:
- Connect GitHub repo.
- Root directory: `backend`
- Runtime: Python
- Build command:

```bash
pip install -r requirements.txt
```

- Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set environment variables in Render:

```env
MONGO_URI=<atlas-connection-string>
DB_NAME=emotion_platform
SECRET_KEY=<long-random-secret>
JWT_EXPIRE_MINUTES=120
FRONTEND_ORIGIN=https://<your-vercel-domain>
PORT=10000
```

After first deploy:
- Check health: `https://<render-backend-domain>/health`
- Check docs: `https://<render-backend-domain>/docs`

## 4. Frontend Deploy on Vercel

Create new Vercel project:
- Import same GitHub repo.
- Root directory: `frontend`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Set environment variable in Vercel:

```env
VITE_API_URL=https://<render-backend-domain>
```

Deploy and open:
- `https://<your-vercel-domain>`

## 5. CORS + Auth Verification

1. Login from deployed frontend.
2. Confirm API requests go to Render backend (`VITE_API_URL`).
3. Verify role guards:
   - student -> student pages
   - teacher pending/rejected -> blocked from teacher features
   - admin -> admin dashboard + teacher approvals
4. Confirm teacher approval flow:
   - register teacher -> pending
   - approve in admin -> teacher can access teacher dashboard

## 6. Redeploy Flow

For each new change:

1. Push commit to GitHub branch tracked by Render/Vercel.
2. Render auto-redeploys backend.
3. Vercel auto-redeploys frontend.
4. Re-run quick checks:
   - `/health`
   - login
   - admin approve/reject/disable/enable actions
