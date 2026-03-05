# API Spec (Core)

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /users/me`

## Admin

- `GET /admin/teachers/pending`
- `POST /admin/teachers/{id}/approve`
- `POST /admin/teachers/{id}/reject`
- `POST /admin/users/{id}/disable`

## Classes & Lessons

- `POST /classes`
- `POST /classes/join`
- `GET /classes/my`
- `GET /classes/{class_id}/lessons`
- `POST /lessons`
- `PUT /lessons/{lesson_id}`
- `POST /lessons/{lesson_id}/assign`

## Emotion & Attention

- `POST /emotions/batch` (face/multimodal batch)
- `POST /emotions/text`
- `POST /emotions/voice`
- `POST /attention/batch`

## Analytics

- `GET /analytics/lesson/{lesson_id}/overall`
- `GET /analytics/lesson/{lesson_id}/face`
- `GET /analytics/lesson/{lesson_id}/text`
- `GET /analytics/lesson/{lesson_id}/voice`
- `GET /analytics/lesson/{lesson_id}/students`

## Notifications

- `GET /notifications`
- `POST /notifications/{notification_id}/read`
