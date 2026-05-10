# MELD Premium Platform - Architecture v2.0

## Executive Summary
This is a complete redesign of the MELD E-Learning platform into a premium, production-ready SaaS system combining Zoom, YouTube, Google Classroom, and AI analytics into a single unified platform.

---

## 1. Technology Stack

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + CSS-in-JS (Emotion/Styled-components optional)
- **State Management**: Zustand + React Query
- **Real-time**: Socket.IO client
- **WebRTC**: simple-peer / PeerConnection API
- **Video**: HLS.js, FFmpeg.wasm
- **UI Components**: Custom component library (glassmorphism + animations)
- **Animations**: Framer Motion
- **Charts**: Recharts, Chart.js
- **Forms**: React Hook Form
- **Routing**: React Router v6
- **Auth**: JWT + Google OAuth

### Backend
- **Framework**: FastAPI (async)
- **Database**: MongoDB Atlas
- **Caching**: Redis (for WebRTC signaling, session management)
- **Real-time**: Socket.IO (via python-socketio)
- **WebRTC**: aiortc library
- **ML/AI**: TensorFlow/PyTorch, face-api.js, librosa
- **Authentication**: JWT + OAuth2
- **File Upload**: Multer alternative (FastAPI MultipartForm)
- **API Documentation**: OpenAPI/Swagger

### ML Services
- **Face Emotion**: TensorFlow.js / Custom CNN
- **Voice Emotion**: Librosa + Scikit-learn
- **Engagement Tracking**: Custom algorithms
- **Sentiment Analysis**: Transformers / HuggingFace

### DevOps
- **Containerization**: Docker + Docker Compose
- **Cloud DB**: MongoDB Atlas
- **Backend Deployment**: Render / Railway / AWS EC2
- **Frontend Deployment**: Vercel / Netlify
- **CDN**: Cloudflare
- **Monitoring**: Sentry, DataDog

---

## 2. Frontend Architecture

### New Folder Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── common/              # Reusable UI components
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── LoadingSkeleton.jsx
│   │   │   ├── Toast.jsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Navbar.jsx       # Header with notifications, profile
│   │   │   ├── Sidebar.jsx      # Collapsible sidebar
│   │   │   ├── AppShell.jsx     # Main layout wrapper
│   │   │   └── Footer.jsx
│   │   ├── auth/
│   │   │   ├── LoginForm.jsx
│   │   │   ├── RegisterForm.jsx
│   │   │   ├── GoogleAuthButton.jsx
│   │   │   └── AuthGuard.jsx
│   │   ├── live-class/
│   │   │   ├── VideoGrid.jsx        # Grid layout for participants
│   │   │   ├── SpeakerView.jsx      # Featured speaker view
│   │   │   ├── ParticipantCard.jsx
│   │   │   ├── ControlBar.jsx       # Mic, camera, share buttons
│   │   │   ├── ScreenShareViewer.jsx
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── ParticipantList.jsx
│   │   │   ├── RaiseHandPanel.jsx
│   │   │   └── EmotionIndicator.jsx
│   │   ├── emotion-detector/
│   │   │   ├── FaceDetectionWidget.jsx
│   │   │   ├── VoiceDetectionWidget.jsx
│   │   │   ├── EmotionChart.jsx
│   │   │   └── EngagementMeter.jsx
│   │   ├── dashboard/
│   │   │   ├── StatCard.jsx         # KPI cards
│   │   │   ├── ChartContainer.jsx
│   │   │   ├── AnalyticsGrid.jsx
│   │   │   └── PowerBiEmbed.jsx
│   │   └── lesson/
│   │       ├── VideoPlayer.jsx
│   │       ├── LessonInfo.jsx
│   │       ├── CommentSection.jsx
│   │       └── RelatedLessons.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── LiveClass.jsx
│   │   ├── Lesson.jsx
│   │   ├── Analytics.jsx
│   │   ├── Students.jsx
│   │   ├── Login.jsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useWebRTC.js
│   │   ├── useEmotionDetection.js
│   │   ├── useSocket.js
│   │   ├── usePeerConnection.js
│   │   └── useLocalStorage.js
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   ├── SocketContext.jsx
│   │   ├── EmotionContext.jsx
│   │   └── UIContext.jsx
│   ├── services/
│   │   ├── api.js               # All REST API calls
│   │   ├── socket.js            # Socket.IO client
│   │   ├── webrtc.js            # WebRTC peer management
│   │   ├── screenShare.js       # Screen sharing logic
│   │   ├── emotionDetection.js  # Face/voice emotion detection
│   │   ├── auth.js              # Auth service
│   │   └── storage.js           # localStorage helpers
│   ├── store/
│   │   ├── authStore.js         # Zustand stores
│   │   ├── liveClassStore.js
│   │   ├── emotionStore.js
│   │   └── uiStore.js
│   ├── utils/
│   │   ├── constants.js
│   │   ├── validators.js
│   │   ├── formatters.js
│   │   └── logger.js
│   ├── styles/
│   │   ├── globals.css
│   │   ├── theme.css
│   │   ├── animations.css
│   │   ├── tailwind.config.js
│   │   └── components.css
│   ├── assets/
│   │   ├── icons/
│   │   ├── logos/
│   │   └── illustrations/
│   ├── App.jsx
│   └── main.jsx
└── package.json
```

### Design System
- **Color Palette**: Dark theme with accent colors (blue, cyan, purple)
- **Typography**: Modern sans-serif (Inter, Manrope)
- **Spacing**: 4px base unit (4, 8, 12, 16, 24, 32, 48px)
- **Shadows**: Glassmorphism with subtle depth
- **Animations**: Smooth 200-400ms transitions
- **Breakpoints**: Mobile-first (sm: 640px, md: 768px, lg: 1024px, xl: 1280px)

---

## 3. Backend Architecture

### New Folder Structure
```
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── classes.py
│   │   │   ├── lessons.py
│   │   │   ├── emotion.py
│   │   │   ├── analytics.py
│   │   │   ├── powerbi.py
│   │   │   └── __init__.py
│   │   └── __init__.py
│   ├── core/
│   │   ├── config.py            # Configuration from env
│   │   ├── security.py          # JWT, OAuth handlers
│   │   ├── constants.py
│   │   └── __init__.py
│   ├── database/
│   │   ├── mongodb.py           # Connection manager
│   │   ├── models.py            # Data models (Pydantic)
│   │   ├── indexes.py           # Database indexes
│   │   └── __init__.py
│   ├── services/
│   │   ├── user_service.py
│   │   ├── class_service.py
│   │   ├── lesson_service.py
│   │   ├── emotion_service.py   # Emotion detection API calls
│   │   ├── analytics_service.py
│   │   ├── webrtc_service.py    # WebRTC signaling
│   │   ├── auth_service.py
│   │   └── __init__.py
│   ├── ml/
│   │   ├── emotion_processor.py
│   │   ├── face_emotion.py
│   │   ├── voice_emotion.py
│   │   ├── engagement_tracker.py
│   │   └── __init__.py
│   ├── websocket/
│   │   ├── events.py            # Socket.IO event handlers
│   │   ├── rooms.py             # Room management
│   │   ├── namespaces.py        # Namespace handlers
│   │   └── __init__.py
│   ├── middleware/
│   │   ├── auth.py
│   │   ├── error_handler.py
│   │   ├── rate_limiter.py
│   │   └── __init__.py
│   ├── utils/
│   │   ├── logger.py
│   │   ├── validators.py
│   │   ├── jwt_handler.py
│   │   └── __init__.py
│   ├── main.py                  # FastAPI app factory
│   └── __init__.py
├── migrations/
│   ├── init_indexes.py
│   ├── seed_data.py
│   └── __init__.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── run.py
```

### Core Modules

#### Authentication
- Google OAuth2 with FastAPI
- JWT token management
- Role-based access control (RBAC)
- Session management with Redis

#### Real-time Communication
- Socket.IO for live events
- WebRTC for peer-to-peer
- Signaling server for connections
- Room-based management

#### Emotion Detection
- Face recognition via ML service
- Voice analysis via separate service
- Engagement scoring algorithm
- Real-time emotion aggregation

#### Analytics & Power BI
- Event aggregation
- Dashboard querying
- Power BI token generation
- Custom report endpoints

---

## 4. Database Schema

### Collections

#### Users
```
{
  _id: ObjectId,
  googleId: string,
  email: string (unique),
  name: string,
  profileImage: string,
  role: enum["student", "teacher", "admin"],
  status: enum["pending", "approved", "rejected"],
  verified: boolean,
  bio: string,
  avatar: string,
  preferences: {
    theme: string,
    notifications: boolean,
    emailNotifications: boolean
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### Classes
```
{
  _id: ObjectId,
  code: string (unique),
  title: string,
  description: string,
  teacherId: ObjectId (ref: Users),
  schedule: {
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    timezone: string
  },
  students: [ObjectId],
  lessons: [ObjectId],
  settings: {
    recordSessions: boolean,
    trackEmotion: boolean,
    allowChat: boolean
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### Lessons
```
{
  _id: ObjectId,
  classId: ObjectId (ref: Classes),
  title: string,
  description: string,
  videoUrl: string,
  duration: number,
  thumbnail: string,
  transcript: string,
  resources: [string],
  order: number,
  status: enum["draft", "published"],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### LiveSessions
```
{
  _id: ObjectId,
  classId: ObjectId,
  startTime: timestamp,
  endTime: timestamp,
  teacherId: ObjectId,
  participants: [{
    userId: ObjectId,
    joinedAt: timestamp,
    leftAt: timestamp,
    emotions: [{
      emotion: string,
      confidence: float,
      timestamp: timestamp
    }],
    focusScore: float
  }],
  recordingUrl: string,
  transcription: string,
  status: enum["live", "ended", "scheduled"],
  analytics: {
    avgEngagement: float,
    avgFocus: float,
    emotionDistribution: object
  }
}
```

#### EmotionEvents
```
{
  _id: ObjectId,
  sessionId: ObjectId,
  userId: ObjectId,
  emotion: string,
  confidence: float,
  source: enum["face", "voice"],
  timestamp: timestamp
}
```

#### Notifications
```
{
  _id: ObjectId,
  userId: ObjectId,
  title: string,
  message: string,
  type: enum["info", "warning", "success", "error"],
  read: boolean,
  createdAt: timestamp
}
```

---

## 5. WebRTC & Real-time Communication

### Architecture
- **Signaling Server**: FastAPI with Socket.IO
- **STUN/TURN**: Google's free STUN, TURN server for NAT traversal
- **Peer Connections**: simple-peer or native WebRTC API
- **Screen Sharing**: Captured stream encoded and transmitted

### Data Flow
1. Peer connects to signaling server
2. Exchange SDP offers/answers
3. Exchange ICE candidates
4. Establish peer connection
5. Stream video/audio/screen
6. Monitor connection quality

### Rooms
- 1 room per class session
- Teacher can see all students
- Students see teacher + peers
- Selective streaming to reduce bandwidth

---

## 6. Emotion Detection Pipeline

### Face Emotion
1. **Capture**: Get camera feed
2. **Detect**: Run face detection model
3. **Extract**: Get facial landmarks
4. **Classify**: Predict emotion from features
5. **Aggregate**: Calculate session emotion stats
6. **Store**: Save to database
7. **Visualize**: Display in real-time charts

### Voice Emotion
1. **Record**: Audio from microphone
2. **Process**: Convert to MFCC features
3. **Classify**: Feed to classifier model
4. **Score**: Get emotion confidence
5. **Aggregate**: Track over session
6. **Analyze**: Generate insights

### Engagement Scoring
- Combine face + voice + behavior
- Attention duration tracking
- Participation frequency
- Response timing
- Overall focus metric (0-100)

---

## 7. Deployment Architecture

### Local Development
```
Frontend: npm run dev → localhost:5173
Backend: uvicorn → localhost:8000
MongoDB: Local or Atlas
Redis: Local or cloud
```

### Production (Recommended)
```
Frontend:
- Vercel (auto-deploy from GitHub)
- Cloudflare CDN
- Gzip + minification

Backend:
- Render / Railway / AWS
- MongoDB Atlas (managed)
- Redis Cloud
- Environment variables via CI/CD

ML Services:
- Separate container (GPU if available)
- Or integrated in main backend
```

### Docker Compose
- Frontend Vite container
- Backend FastAPI container
- MongoDB service (or use Atlas)
- Redis service
- Optional: ML service container

---

## 8. Key Features Implementation Order

### Phase 1: Foundation
1. ✅ Modern responsive UI components
2. ✅ Authentication (Google OAuth + JWT)
3. ✅ User dashboards (Teacher, Student, Admin)

### Phase 2: Live Classes
1. ✅ WebRTC peer connections
2. ✅ Socket.IO signaling
3. ✅ Basic video streaming
4. ✅ Screen sharing
5. ✅ Chat/reactions

### Phase 3: Emotion Detection
1. ✅ Face emotion detection
2. ✅ Voice emotion detection
3. ✅ Real-time visualization
4. ✅ Session analytics storage

### Phase 4: Analytics
1. ✅ Teacher dashboard with Power BI
2. ✅ Student progress tracking
3. ✅ Admin system metrics
4. ✅ Export/reporting

### Phase 5: Production
1. ✅ Deployment automation
2. ✅ Monitoring & logging
3. ✅ Performance optimization
4. ✅ Security hardening

---

## 9. Security Considerations

### Authentication
- Google OAuth2 for signup/login
- JWT tokens with 24hr expiry
- Refresh tokens stored securely
- Password hashing not needed (OAuth)

### Authorization
- Role-based access control
- Class membership verification
- Teacher-only endpoints
- Admin-only endpoints

### Data Protection
- HTTPS only
- CORS whitelist
- Rate limiting
- Input validation
- SQL injection N/A (MongoDB)
- XSS protection (React + sanitization)

### Privacy
- GDPR compliance
- Data minimization
- Consent management
- Right to deletion

---

## 10. Performance Targets

- Page load: < 3 seconds
- API response: < 200ms
- Video stream startup: < 1 second
- Emotion detection: < 500ms per frame
- Dashboard refresh: < 1 second
- Mobile responsiveness: 60 FPS

---

## 11. Monitoring & Logging

- Structured logging (JSON)
- Error tracking (Sentry)
- Performance monitoring (DataDog)
- User behavior analytics (Posthog)
- Video quality monitoring
- API performance metrics

---

## 12. Future Enhancements

- AI-generated transcripts with timestamps
- Meeting recordings with emotion timeline
- AI tutoring recommendations
- Gamification (badges, streaks)
- Mobile app (React Native)
- 1:1 mentoring sessions
- Asynchronous peer feedback
- Assessment integration

---

This architecture ensures scalability, maintainability, and a premium user experience comparable to industry-leading platforms.
