# MELD Platform API Quick Reference

## Base URL
```
http://localhost:8000/api/v1
```

## API Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

---

## Authentication Endpoints

### Register
```
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "John Doe",
  "role": "student"  // student, teacher, or admin
}

Response: { access_token, refresh_token, user }
```

### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}

Response: { access_token, refresh_token, user }
```

### Get Current User
```
GET /auth/me
Authorization: Bearer <access_token>

Response: { user }
```

### Refresh Token
```
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "token_value"
}

Response: { access_token, refresh_token }
```

### Google OAuth
```
POST /auth/google
Content-Type: application/json

{
  "token": "google_id_token"
}

Response: { access_token, refresh_token, user }
```

---

## User Management

### Get My Profile
```
GET /users/profile
Authorization: Bearer <access_token>
```

### Update Profile
```
PUT /users/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "New Name",
  "bio": "My bio",
  "avatar_url": "https://..."
}
```

### Upload Avatar
```
POST /users/upload-avatar
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <image_file>
```

### Get User by ID
```
GET /users/{user_id}
```

### List All Users (Admin)
```
GET /users/
Authorization: Bearer <admin_token>
?skip=0&limit=10&role=student
```

---

## Classes Management

### Create Class (Teacher)
```
POST /classes/
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "name": "Math 101",
  "subject": "Mathematics",
  "code": "MATH101",
  "description": "Introduction to Mathematics",
  "schedule": "Mondays & Wednesdays, 2-3 PM"
}
```

### Get All My Classes
```
GET /classes/
Authorization: Bearer <access_token>
?skip=0&limit=10
```

### Get Class Details
```
GET /classes/{class_id}
Authorization: Bearer <access_token>
```

### Update Class (Teacher)
```
PUT /classes/{class_id}
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description",
  "schedule": "New schedule"
}
```

### Delete Class (Teacher)
```
DELETE /classes/{class_id}
Authorization: Bearer <teacher_token>
```

### Join Class (Student)
```
POST /classes/{class_id}/join
Authorization: Bearer <student_token>

{
  "class_code": "MATH101"
}
```

### Get Class Students
```
GET /classes/{class_id}/students
Authorization: Bearer <access_token>
?skip=0&limit=10
```

---

## Lessons Management

### Create Lesson (Teacher)
```
POST /lessons/
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "class_id": "class_id",
  "title": "Lesson 1: Basics",
  "description": "Introduction to basics",
  "video_url": "https://youtube.com/...",
  "duration": 3600,
  "order": 1
}
```

### Get Class Lessons
```
GET /lessons/class/{class_id}
Authorization: Bearer <access_token>
?skip=0&limit=20
```

### Get Lesson Details
```
GET /lessons/{lesson_id}
Authorization: Bearer <access_token>
```

### Update Lesson (Teacher)
```
PUT /lessons/{lesson_id}
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description"
}
```

### Delete Lesson (Teacher)
```
DELETE /lessons/{lesson_id}
Authorization: Bearer <teacher_token>
```

### Upload Lesson Video
```
POST /lessons/{lesson_id}/video
Authorization: Bearer <teacher_token>
Content-Type: multipart/form-data

file: <video_file>
```

---

## Live Classes

### Start Live Session (Teacher)
```
POST /live_classes/{class_id}/start
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "title": "Today's Lesson"
}
```

### End Live Session (Teacher)
```
POST /live_classes/{session_id}/end
Authorization: Bearer <teacher_token>
```

### Get Active Sessions
```
GET /live_classes/active
```

### Get Session Details
```
GET /live_classes/{session_id}
Authorization: Bearer <access_token>
```

### Join Session (Student)
```
POST /live_classes/{session_id}/join
Authorization: Bearer <student_token>
```

### Leave Session (Student)
```
POST /live_classes/{session_id}/leave
Authorization: Bearer <student_token>
```

### Record Attendance (Teacher)
```
PUT /live_classes/{session_id}/attendance
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "present_students": ["user_id1", "user_id2"]
}
```

### Get Session Participants
```
GET /live_classes/{session_id}/participants
Authorization: Bearer <access_token>
?skip=0&limit=50
```

---

## Emotion Analytics

### Record Emotion Event
```
POST /emotion/{session_id}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "emotion": "happy",
  "confidence": 0.95,
  "engagement": 0.8
}
```

### Get Session Emotions
```
GET /emotion/session/{session_id}
Authorization: Bearer <access_token>
```

### Get User Emotion History
```
GET /emotion/user/{user_id}
Authorization: Bearer <access_token>
?days=7
```

### Get Class Emotion Analytics
```
GET /emotion/class/{class_id}/analytics
Authorization: Bearer <teacher_token>
```

---

## Analytics & Dashboards

### Get Dashboard (Role-Based)
```
GET /analytics/dashboard
Authorization: Bearer <access_token>

# Teacher gets: classes, students, sessions, engagement
# Student gets: enrolled classes, emotions, progress
# Admin gets: system stats, user counts, sessions
```

### Get Session Emotions
```
GET /analytics/emotions/{session_id}
Authorization: Bearer <access_token>
```

### Get Engagement Metrics
```
GET /analytics/engagement/{class_id}
Authorization: Bearer <teacher_token>
```

### Get Student Progress
```
GET /analytics/progress/{student_id}
Authorization: Bearer <access_token>
?days=30
```

---

## Admin Functions

### Get All Users (Admin)
```
GET /admin/users
Authorization: Bearer <admin_token>
?skip=0&limit=10&role=teacher
```

### Get System Statistics
```
GET /admin/stats
Authorization: Bearer <admin_token>
```

### Approve Teacher
```
POST /admin/teachers/{teacher_id}/approve
Authorization: Bearer <admin_token>
```

### Reject Teacher
```
POST /admin/teachers/{teacher_id}/reject
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "Does not meet requirements"
}
```

### Delete User
```
DELETE /admin/users/{user_id}
Authorization: Bearer <admin_token>
```

### Force Delete Class
```
POST /admin/classes/{class_id}/delete
Authorization: Bearer <admin_token>
```

### Get All Sessions
```
GET /admin/sessions
Authorization: Bearer <admin_token>
?skip=0&limit=20&status=active
```

---

## Power BI Integration

### Get Reports
```
GET /powerbi/reports
Authorization: Bearer <access_token>
```

### Get Report Embed Token
```
GET /powerbi/token/{report_id}
Authorization: Bearer <access_token>
```

### Get Dashboards
```
GET /powerbi/dashboards
Authorization: Bearer <access_token>
```

### Get Dashboard Embed Token
```
GET /powerbi/dashboard-token/{dashboard_id}
Authorization: Bearer <access_token>
```

### Refresh Power BI Data
```
POST /powerbi/refresh
Authorization: Bearer <admin_token>
```

---

## Error Responses

All errors follow this format:
```json
{
  "detail": "Error message",
  "status_code": 400
}
```

### Common Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate, etc.)
- `500` - Server Error

---

## Environment Variables

Create a `.env` file in the backend root:

```env
# Database
MONGODB_URI=mongodb://localhost:27017
DB_NAME=meld_platform

# JWT
SECRET_KEY=your-super-secret-key-change-this
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Power BI
POWERBI_TENANT_ID=your-tenant-id
POWERBI_CLIENT_ID=your-client-id
POWERBI_CLIENT_SECRET=your-client-secret
POWERBI_WORKSPACE_ID=your-workspace-id

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Upload
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE=524288000

# Debug
DEBUG=True
```

---

## Testing with cURL

```bash
# Register
curl -X POST "http://localhost:8000/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User","role":"student"}'

# Login and save token
TOKEN=$(curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' | jq -r '.access_token')

# Get current user
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN"

# Create class (as teacher)
curl -X POST "http://localhost:8000/api/v1/classes/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Math 101","subject":"Mathematics","code":"MATH101","description":"Intro to Math"}'
```

---

## WebSocket Events (Socket.IO)

Coming soon:
- `session:join` - User joined live session
- `session:leave` - User left session
- `emotion:update` - Real-time emotion update
- `chat:message` - Chat message broadcast
- `participant:list` - Update participant list
- `screen:share` - Screen sharing started

---

Generated: May 10, 2026  
Version: 2.0.0  
Status: ✅ Production Ready
