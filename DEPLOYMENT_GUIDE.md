# MELD Platform - Deployment Guide

## Production Checklist

- [ ] Update all environment variables
- [ ] Enable HTTPS
- [ ] Setup monitoring (Sentry, DataDog)
- [ ] Configure backups
- [ ] Setup CI/CD pipeline
- [ ] Security audit
- [ ] Load testing
- [ ] Performance testing

---

## Frontend Deployment (Vercel)

### Step 1: Prepare for Production
```bash
# Build and test locally
npm run build
npm run preview

# Check build size
npm run build -- --report
```

### Step 2: Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard:
# VITE_API_URL=https://api.yourdomain.com
# VITE_SOCKET_URL=https://api.yourdomain.com
# VITE_GOOGLE_CLIENT_ID=xxx
```

### Vercel Configuration (vercel.json)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ],
  "env": {
    "VITE_API_URL": "@api_url",
    "VITE_SOCKET_URL": "@socket_url",
    "VITE_GOOGLE_CLIENT_ID": "@google_client_id"
  }
}
```

---

## Backend Deployment (Render.com)

Render now defaults new Python services to Python 3.14.x. This backend is pinned to Python 3.11.9 because media/crypto/scientific wheels are stable there and `av`/`aiortc` do not need to compile from source.

### Files That Control Render

```text
runtime.txt              # python-3.11.9 for legacy/runtime-aware platforms
.python-version          # 3.11.9 for Render native Python runtime
backend/runtime.txt      # python-3.11.9 when backend/ is the service root
backend/.python-version  # 3.11.9 when backend/ is the service root
render.yaml              # Render Blueprint with rootDir, build, start, health check, env
backend/requirements.txt # production API deps only
```

### Default Native Render Service
1. Connect GitHub repo
2. Select "New Web Service"
3. Configure:
   - Name: `meld-api`
   - Root Directory: `backend`
   - Runtime: `Python 3`
   - Build Command: `python -m pip install --upgrade pip setuptools wheel && pip install --only-binary=:all: -r requirements.txt`
   - Start Command: `uvicorn app.main:application --host 0.0.0.0 --port $PORT --workers 1 --proxy-headers --forwarded-allow-ips='*'`
   - Health Check Path: `/health`

4. Set Environment Variables:
   - `PYTHON_VERSION`: `3.11.9`
   - `MONGODB_URI`: Your Atlas connection string
   - `SECRET_KEY`: Strong random string
   - `JWT_SECRET`: Strong random string used for access tokens
   - `CORS_ORIGINS`: `["https://your-vercel-app.vercel.app"]`
   - `FRONTEND_ORIGIN`: `https://your-vercel-app.vercel.app`
   - `DEBUG`: `False`
   - Power BI backend-only secrets listed below, if embedding is enabled

The repository also includes `render.yaml`, so you can deploy from a Render Blueprint instead of clicking settings manually. In Blueprint mode, Render uses `rootDir: backend`, `runtime: python`, `plan: free`, `healthCheckPath: /health`, and the same build/start commands above.

### Why `av` No Longer Fails

The production `backend/requirements.txt` intentionally excludes `aiortc` and `av`. The current backend uses Socket.IO for WebRTC signaling, while browser clients own the camera/microphone media path. Login, JWT auth, lessons, analytics, feedback storage, Power BI token generation, and Socket.IO signaling all work without Python-side media decoding.

Optional files are available:

```bash
# Only for paid instances/Docker images that need server-side WebRTC media handling:
pip install -r backend/requirements-webrtc.txt

# Only for local or paid-instance ML inference:
pip install -r backend/requirements-ml.txt
```

`requirements-webrtc.txt` pins `aiortc==1.9.0` and `av==12.3.0` and includes `--only-binary=av,aiortc` so pip refuses source builds instead of trying to compile FFmpeg/libav on Render.

### Production Runtime Notes

- Use one Uvicorn worker on the free tier: `--workers 1`.
- Keep `RELOAD=0` in production.
- Keep heavy ML packages out of the free-tier build unless you truly need backend inference.
- The text and voice emotion services include lightweight fallbacks, so missing optional ML packages do not prevent the API from booting.
- `/health` returns `{"status":"ok"}` and is safe for Render health checks.

### Step 3: Setup Custom Domain
- Add domain in Render dashboard
- Update DNS records
- Enable auto-renewal for SSL

---

## Database Setup (MongoDB Atlas)

### Step 1: Create Cluster
1. Go to mongodb.com/cloud
2. Create new cluster
3. Select shared tier (free)
4. Choose region closest to users
5. Create database user

### Step 2: Configure Network Access
- Add IP: `0.0.0.0/0` (restrict in production)
- Enable auto-backup

### Step 3: Create Collections & Indexes
```javascript
// Run these commands in MongoDB shell
use meld_platform

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ googleId: 1 })
db.classes.createIndex({ code: 1 }, { unique: true })
db.classes.createIndex({ teacherId: 1 })
db.live_sessions.createIndex({ classId: 1 })
db.emotion_events.createIndex({ sessionId: 1 })
db.emotion_events.createIndex({ timestamp: -1 })
db.emotion_events.createIndex({ teacher_id: 1, timestamp: -1 })
db.emotion_events.createIndex({ student_id: 1, timestamp: -1 })
db.emotion_events.createIndex({ lesson_id: 1, timestamp: -1 })
db.emotion_events.createIndex({ lesson_id: 1, modality: 1, timestamp: -1 })
db.emotion_events.createIndex({ emotion_label: 1, timestamp: -1 })
db.emotion_events.createIndex({ engagement_score: -1, timestamp: -1 })
db.attention_events.createIndex({ lesson_id: 1, timestamp: -1 })
db.attention_events.createIndex({ user_id: 1, lesson_id: 1, timestamp: -1 })
```

The FastAPI app now also calls `ensure_platform_indexes()` on startup, so these indexes are created automatically when the Render service has MongoDB permissions.

---

## Teacher Analytics Dashboard

The teacher dashboard is available at `/teacher` for approved teachers. It includes:

- Dashboard Overview: total attendees, engagement score, dominant emotions, confusion and boredom rates.
- Live Classroom Monitoring: Socket.IO-triggered refresh plus 10-second polling for active students, cameras, microphones, confusion alerts, and low-engagement alerts.
- Student Analytics: searchable roster, individual drilldown, emotional timelines, webcam/audio history, attendance, completion, and CSV export.
- Lesson Analytics: face, text, voice, completion, attendance, performance, and heatmap charts.
- Power BI Analytics: secure backend embed-token generation and frontend report embedding.

Main backend routes:

```text
GET /analytics/overview
GET /analytics/lessons
GET /analytics/students
GET /analytics/student/{student_id}
GET /analytics/student/{student_id}/history
GET /analytics/realtime
GET /analytics/attendance
GET /analytics/emotions
GET /analytics/export
GET /analytics/powerbi/embed-token
```

All routes require JWT authentication. Teachers are scoped to their classes/lessons, students are scoped to personal analytics, and admins can query platform-wide analytics.

---

## Lesson Streaming, Camera, and Emotion Tracking

Teacher lessons now normalize media in the backend before returning data to students:

- `youtube.com/watch?v=...`
- `youtu.be/...`
- `youtube.com/embed/...`
- `youtube.com/shorts/...`
- `youtube.com/live/...`

are exposed to the frontend as `video_embed_url` / `content` using the proper `https://www.youtube.com/embed/{videoId}` format. Raw `video_url` is preserved for teacher editing.

Student lesson playback uses:

- `GET /classes/{class_id}/lessons` for assigned lessons.
- `GET /lessons/{lesson_id}?class_id=...` as a direct fallback.
- `POST /sessions/start` automatically when the student presses Play.
- `POST /emotions/batch` for face events.
- `POST /attention/batch` for attention and watch behavior.
- Socket.IO `join_lesson`, `join_class`, and `emotion_update` events for realtime dashboards.

Camera access requires a user gesture and HTTPS. On Vercel this works automatically because Vercel serves HTTPS. Local development works on `localhost`. Non-HTTPS custom domains will not be allowed to use `navigator.mediaDevices.getUserMedia`.

### face-api.js Models

The frontend loads face-api.js models from:

```text
frontend/public/models
```

Required files:

```text
tiny_face_detector_model-weights_manifest.json
tiny_face_detector_model-shard1
face_expression_model-weights_manifest.json
face_expression_model-shard1
```

The tracker tries `/models` first and then falls back to the public face-api.js CDN. Production should serve these files from Vercel to avoid CDN/CORS failures.

### Socket.IO Production

Set frontend env:

```env
VITE_API_URL=https://your-render-api.onrender.com
VITE_API_BASE_URL=https://your-render-api.onrender.com
```

Set backend env:

```env
CORS_ORIGINS=["https://your-vercel-app.vercel.app"]
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
```

The backend uses the same FastAPI ASGI app for REST and Socket.IO, so Render start command remains:

```bash
uvicorn app.main:application --host 0.0.0.0 --port $PORT --workers 1 --proxy-headers --forwarded-allow-ips='*'
```

---

## Power BI Production Embedding

Create an Azure AD app registration with Power BI API access, add it to the Power BI workspace, and enable service principal access in the Power BI admin portal. Store all secrets on Render only:

```env
POWERBI_TENANT_ID=your-azure-tenant-id
POWERBI_CLIENT_ID=your-service-principal-client-id
POWERBI_CLIENT_SECRET=your-service-principal-secret
POWERBI_WORKSPACE_ID=your-powerbi-workspace-id
POWERBI_REPORT_ID=your-default-report-id
POWERBI_DATASET_ID=optional-dataset-id
```

The frontend never receives Azure credentials. It receives only the short-lived embed token, report id, dataset id, expiration, and embed URL from `/analytics/powerbi/embed-token`.

---

## Redis Setup (Redis Cloud)

### Step 1: Create Redis Instance
1. Go to redis.com/cloud
2. Create new database
3. Select cloud provider and region
4. Note the connection URL

### Step 2: Configure Backend
```python
# in .env
REDIS_URL=redis://:password@host:port
```

---

## CDN Setup (Cloudflare)

### Step 1: Point Domain to Cloudflare
1. Update nameservers in domain registrar
2. Configure DNS records in Cloudflare

### Step 2: Configure Page Rules
```
Caching Level: Cache Everything
Browser TTL: 1 hour
Edge TTL: 1 month
```

### Step 3: Enable Security
- Enable DDoS protection
- Setup Web Application Firewall (WAF)
- Enable rate limiting

---

## Monitoring & Logging

### Sentry (Error Tracking)
```python
import sentry_sdk

sentry_sdk.init(
    dsn="https://your-sentry-dsn@sentry.io/project-id",
    traces_sample_rate=1.0,
    environment="production"
)
```

### DataDog (Performance Monitoring)
```python
from datadog import initialize, api

options = {
    "api_key": "your-api-key",
    "app_key": "your-app-key"
}

initialize(**options)
```

---

## SSL/HTTPS Setup

### Auto Renewal
- Render: Automatic
- Vercel: Automatic
- Custom: Use Let's Encrypt with Certbot

```bash
# On Ubuntu/Debian
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --webroot -w /var/www/yourdomain -d yourdomain.com
```

---

## Backup Strategy

### MongoDB Backups
- Atlas: Automatic daily backups (14-30 days retention)
- Manual: Export to S3 weekly

### Code Backups
- Git repository (GitHub primary)
- Regular backups to external storage

---

## Performance Optimization

### Frontend
```bash
# Enable gzip compression
# Enable image optimization
# Enable code splitting
# Setup CDN caching headers
```

### Backend
```bash
# Enable query caching
# Setup database connection pooling
# Enable response compression
# Setup rate limiting
```

---

## Scaling Strategy

### Phase 1: Single Server
- Backend on Render
- Frontend on Vercel
- Database on MongoDB Atlas shared

### Phase 2: Multi-Region
- Multiple backend instances
- Load balancer (AWS ALB)
- Regional databases (MongoDB Atlas multi-region)
- CDN for static assets (Cloudflare)

### Phase 3: Enterprise
- Kubernetes cluster
- Multi-region active-active
- Advanced caching layers
- Dedicated database nodes

---

## Security Hardening

### API Security
```python
# Add rate limiting
from fastapi_limiter import FastAPILimiter

# Add CORS restrictions
allow_origins = [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
]

# Add helmet-like headers
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

### Database Security
- Use strong passwords
- Enable authentication
- Restrict network access
- Enable encryption at rest

### API Keys
- Use environment variables
- Rotate regularly
- Use short expiration times for tokens
- Monitor key usage

---

## Rollback Plan

```bash
# If something goes wrong:

# Frontend rollback (Vercel)
vercel rollback

# Backend rollback (Render)
# Revert to previous deployment from dashboard

# Database rollback (MongoDB)
# Restore from backup in Atlas dashboard
```

---

## Monitoring Commands

### Check API Status
```bash
curl https://api.yourdomain.com/health
```

### View Logs
```bash
# Render
render logs --service-id=xxx

# Docker
docker logs container-id
```

### Database Monitoring
```javascript
// In MongoDB Atlas dashboard
db.currentOp()  // Show active operations
db.stats()      // Show database stats
```

---

## Contact & Support

- GitHub Issues: Report bugs
- Email: support@yourdomain.com
- Documentation: docs.yourdomain.com

---

Last Updated: May 2026
Version: 2.0.0
