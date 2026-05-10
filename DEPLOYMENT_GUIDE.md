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

### Step 1: Prepare Docker
```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 2: Deploy on Render
1. Connect GitHub repo
2. Select "New Web Service"
3. Configure:
   - Name: `meld-api`
   - Root Directory: `backend`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:application --host 0.0.0.0 --port $PORT`

4. Set Environment Variables:
   - `PYTHON_VERSION`: `3.11.9`
   - `MONGODB_URI`: Your Atlas connection string
   - `SECRET_KEY`: Strong random string
   - `DEBUG`: `False`
   - All other required env vars

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
```

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
