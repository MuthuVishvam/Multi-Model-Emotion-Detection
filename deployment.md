# Deployment Placeholders

Use this file as a fill-in template before production deployment.

## 1) MongoDB Atlas (Placeholder)

- Cluster name: `<ATLAS_CLUSTER_NAME>`
- Database name: `<ATLAS_DB_NAME>`
- Database user: `<ATLAS_DB_USER>`
- Network access/IP allowlist: `<ATLAS_IP_RULES>`
- Connection string (`MONGO_URI`): `<ATLAS_MONGO_URI>`

## 2) Backend on Render (Placeholder)

- Service name: `<RENDER_BACKEND_SERVICE_NAME>`
- Region: `<RENDER_REGION>`
- Branch: `<GIT_BRANCH>`
- Root directory: `backend`
- Build command:

```bash
pip install -r requirements.txt
```

- Start command:

```bash
python run.py
```

- Required environment variables:

```env
MONGO_URI=<ATLAS_MONGO_URI>
DB_NAME=<ATLAS_DB_NAME>
SECRET_KEY=<BACKEND_SECRET_KEY>
FRONTEND_ORIGIN=https://<VERCEL_DOMAIN>
PORT=10000
```

## 3) Frontend on Vercel (Placeholder)

- Project name: `<VERCEL_PROJECT_NAME>`
- Branch: `<GIT_BRANCH>`
- Root directory: `frontend`
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

- Required environment variables:

```env
VITE_API_URL=https://<RENDER_BACKEND_DOMAIN>
```

## 4) Post-Deploy Checks (Placeholder)

- Backend health URL: `https://<RENDER_BACKEND_DOMAIN>/health`
- API docs URL: `https://<RENDER_BACKEND_DOMAIN>/docs`
- Frontend URL: `https://<VERCEL_DOMAIN>`
- CORS check: frontend requests to backend succeed
- Auth check: login + protected routes pass

## 5) Optional CI/CD Notes (Placeholder)

- GitHub Actions workflow file: `<.github/workflows/...>`
- Auto-deploy branch rules: `<DEPLOY_RULES>`
- Secret storage location: `<GITHUB/RENDER/VERCEL_SECRETS>`
