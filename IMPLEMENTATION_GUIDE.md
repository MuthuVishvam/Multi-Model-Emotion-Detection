# MELD Premium Platform - Developer Implementation Guide

## Phase 1: Local Development Setup (Week 1)

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB (local or Atlas)
- Redis (local or cloud)
- Git

### 1. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

#### Key Files to Update:
- `src/App.jsx` - Main router configuration
- `src/pages/` - All page implementations
- `src/components/` - Reusable component library
- `src/services/api.js` - API integration

#### Tasks:
- [ ] Fix all TypeScript errors
- [ ] Implement all missing page components
- [ ] Connect API endpoints
- [ ] Test authentication flow
- [ ] Implement WebRTC video component
- [ ] Setup Socket.IO connection
- [ ] Implement emotion detection UI

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
# API at http://localhost:8000
# Docs at http://localhost:8000/docs
```

#### Key Files to Implement:
- `app/api/v1/auth.py` - Authentication endpoints
- `app/api/v1/users.py` - User management
- `app/api/v1/classes.py` - Class CRUD
- `app/api/v1/lessons.py` - Lesson management
- `app/api/v1/live_classes.py` - Live class sessions
- `app/api/v1/emotion.py` - Emotion recording
- `app/api/v1/analytics.py` - Analytics endpoints
- `app/websocket/events.py` - WebSocket handlers
- `app/services/` - Business logic services

#### Tasks:
- [ ] Complete all API endpoint implementations
- [ ] Implement MongoDB models
- [ ] Setup JWT authentication
- [ ] Implement WebRTC signaling
- [ ] Setup Socket.IO handlers
- [ ] Implement emotion processing
- [ ] Create admin dashboard endpoints

### 3. Database Setup

#### MongoDB Collections:

```javascript
// Users
db.users.insertOne({
  _id: ObjectId(),
  googleId: "...",
  email: "user@example.com",
  name: "John Doe",
  role: "student", // or teacher, admin
  verified: true,
  profileImage: "...",
  createdAt: ISODate()
})

// Classes
db.classes.insertOne({
  _id: ObjectId(),
  code: "CS101",
  title: "Introduction to CS",
  teacherId: ObjectId(),
  students: [ObjectId(), ObjectId()],
  schedule: {
    dayOfWeek: 3,
    startTime: "10:00",
    endTime: "11:30"
  },
  createdAt: ISODate()
})

// And more...
```

---

## Phase 2: Feature Implementation (Weeks 2-4)

### Priority 1: Authentication & User Management
- [ ] Google OAuth integration
- [ ] JWT token management
- [ ] User profile endpoints
- [ ] Role-based access control
- [ ] Email verification (optional)

### Priority 2: Live Class System
- [ ] WebRTC peer connections
- [ ] Socket.IO signaling
- [ ] Video streaming
- [ ] Screen sharing
- [ ] Chat system
- [ ] Participant management

### Priority 3: Emotion Detection
- [ ] Face emotion detection integration
- [ ] Voice emotion detection integration
- [ ] Real-time emotion visualization
- [ ] Emotion analytics storage
- [ ] Engagement scoring

### Priority 4: Analytics & Power BI
- [ ] Dashboard data aggregation
- [ ] Power BI embed token generation
- [ ] Custom analytics endpoints
- [ ] Report generation
- [ ] Export functionality

---

## Phase 3: Testing & Optimization (Week 5)

### Frontend Testing
```bash
npm run lint
npm run type-check
# Add unit tests with Vitest
```

### Backend Testing
```bash
pytest tests/
# Add API integration tests
```

### Performance Optimization
- [ ] Implement lazy loading
- [ ] Code splitting
- [ ] Image optimization
- [ ] Database query optimization
- [ ] API response caching with Redis
- [ ] WebRTC bandwidth optimization

---

## Phase 4: Deployment (Week 6)

### Deploy Frontend
```bash
# Build for production
npm run build

# Deploy to Vercel
vercel deploy --prod

# Or deploy to Netlify
netlify deploy --prod
```

### Deploy Backend
```bash
# On Render.com / Railway.app:
# Set environment variables
# Deploy with Docker

# Or on AWS:
docker build -t meld-backend .
docker tag meld-backend:latest YOUR_ECR_URI/meld-backend:latest
docker push YOUR_ECR_URI/meld-backend:latest
```

---

## Architecture Decisions

### Frontend State Management
- **Zustand** for simple state (easier than Redux)
- **React Query** for server state
- **Context API** for auth
- **Socket.IO client** for real-time

### Backend Architecture
- **FastAPI** for type-safe async API
- **MongoDB** for flexible schema
- **Redis** for caching & real-time
- **Socket.IO** for WebSockets
- **WebRTC** with STUN/TURN servers

### Database Design
- Denormalized collections for performance
- Proper indexing on frequently queried fields
- TTL indexes for temporary data (sessions, notifications)

---

## Common Issues & Solutions

### Issue: Camera not working
**Solution**: Ensure HTTPS in production, check permissions

### Issue: WebRTC connection fails
**Solution**: Check STUN/TURN servers, verify firewall settings

### Issue: Emotion detection inaccurate
**Solution**: Ensure proper lighting, update ML models, collect more training data

### Issue: Real-time events not syncing
**Solution**: Check Socket.IO connection, verify room names

---

## Environment Variables

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:8000
VITE_SOCKET_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### Backend (.env)
```
DEBUG=True
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net
DB_NAME=meld_platform
SECRET_KEY=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
POWERBI_TENANT_ID=your-tenant-id
POWERBI_CLIENT_ID=your-client-id
POWERBI_CLIENT_SECRET=your-client-secret
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/live-classes

# Make changes
git add .
git commit -m "feat: implement live class system"

# Push and create PR
git push origin feature/live-classes

# After review and merge
git checkout main
git pull origin main
```

---

## Performance Benchmarks

- Page Load: < 3 seconds
- API Response: < 200ms
- Video Start: < 1 second
- Emotion Detection: < 500ms
- Dashboard Refresh: < 1 second

---

## Next Steps

1. **Week 1**: Complete Phase 1 setup
2. **Week 2-4**: Implement features by priority
3. **Week 5**: Testing & optimization
4. **Week 6**: Deploy to production

Start with authentication, then live classes, then everything else!
