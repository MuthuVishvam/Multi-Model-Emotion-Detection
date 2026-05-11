from __future__ import annotations

from datetime import datetime
from uuid import uuid4
import logging

from fastapi import FastAPI
from socketio import AsyncServer

from app.config import settings

logger = logging.getLogger(__name__)

sio: AsyncServer | None = None

active_live_rooms: dict[str, dict] = {}
socket_connections: dict[str, dict] = {}


def _normalize_room_id(value: object) -> str:
    room_id = str(value or "").strip()
    if room_id.startswith("live_"):
        room_id = room_id.removeprefix("live_").strip()
    return room_id


def _extract_session_id(data: dict | None) -> str:
    data = data or {}
    return _normalize_room_id(
        data.get("sessionId")
        or data.get("liveSessionId")
        or data.get("live_session_id")
        or data.get("room_id")
        or data.get("roomId")
    )


def _ensure_live_room(session_id: str) -> dict:
    if session_id not in active_live_rooms:
        active_live_rooms[session_id] = {
            "teacher": None,
            "students": {},
            "is_streaming": False,
            "created_at": datetime.utcnow().isoformat(),
        }
    return active_live_rooms[session_id]


def _student_payload(student: dict) -> dict:
    return {
        "studentId": student.get("studentId"),
        "user_id": student.get("studentId"),
        "name": student.get("name") or "Student",
        "username": student.get("name") or "Student",
        "socketId": student.get("socketId"),
        "sid": student.get("socketId"),
        "role": "student",
        "emotion": student.get("emotion") or "unknown",
        "confidence": float(student.get("confidence") or 0),
        "attention": student.get("attention"),
        "timestamp": student.get("timestamp"),
        "lowAttention": bool(student.get("lowAttention")),
    }


def _dashboard_payload(session_id: str) -> dict:
    room = _ensure_live_room(session_id)
    students = [_student_payload(student) for student in room["students"].values()]

    emotion_counts: dict[str, int] = {}
    for student in students:
        emotion = str(student.get("emotion") or "unknown").strip() or "unknown"
        if emotion == "unknown":
            continue
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

    dominant_emotion = "unknown"
    if emotion_counts:
        dominant_emotion = max(emotion_counts.items(), key=lambda item: item[1])[0]

    low_attention_count = sum(1 for student in students if student.get("lowAttention"))

    return {
        "sessionId": session_id,
        "live_session_id": session_id,
        "students": students,
        "active_students_count": len(students),
        "dominantEmotion": dominant_emotion,
        "dominant_emotion": dominant_emotion,
        "lowAttentionCount": low_attention_count,
        "low_attention_alerts": low_attention_count,
        "teacherOnline": bool(room.get("teacher")),
        "teacher_streaming": bool(room.get("is_streaming")),
    }


async def _emit_dashboard_update(session_id: str) -> None:
    if not sio or not session_id:
        return
    payload = _dashboard_payload(session_id)
    await sio.emit("dashboard-update", payload, room=session_id)
    await sio.emit("dashboard_update", payload, room=session_id)


async def _join_teacher(sid: str, data: dict | None) -> None:
    session_id = _extract_session_id(data)
    if not session_id or not sio:
        return

    room = _ensure_live_room(session_id)
    await sio.enter_room(sid, session_id)
    room["teacher"] = sid
    socket_connections[sid] = {
        "sessionId": session_id,
        "role": "teacher",
        "userId": (data or {}).get("user_id") or (data or {}).get("userId"),
        "name": (data or {}).get("username") or (data or {}).get("name") or "Teacher",
    }

    await sio.emit("teacher_joined", {"sid": sid, "socketId": sid}, room=session_id, skip_sid=sid)
    await sio.emit("teacher-joined", {"socketId": sid}, room=session_id, skip_sid=sid)
    await sio.emit("room_participants", {
        "participants": [_student_payload(student) for student in room["students"].values()],
        "teacher_sid": sid,
        "teacher_streaming": bool(room.get("is_streaming")),
    }, to=sid)
    await _emit_dashboard_update(session_id)


async def _join_student(sid: str, data: dict | None) -> None:
    data = data or {}
    session_id = _extract_session_id(data)
    if not session_id or not sio:
        return

    room = _ensure_live_room(session_id)
    await sio.enter_room(sid, session_id)

    student = {
        "studentId": str(data.get("studentId") or data.get("user_id") or data.get("userId") or sid),
        "name": str(data.get("name") or data.get("username") or "Student"),
        "socketId": sid,
        "emotion": "unknown",
        "confidence": 0,
        "attention": None,
        "timestamp": datetime.utcnow().isoformat(),
        "lowAttention": False,
    }
    room["students"][sid] = {**room["students"].get(sid, {}), **student}
    socket_connections[sid] = {
        "sessionId": session_id,
        "role": "student",
        "userId": student["studentId"],
        "name": student["name"],
    }

    joined_payload = {
        "studentId": student["studentId"],
        "name": student["name"],
        "socketId": sid,
        "sid": sid,
        "username": student["name"],
        "role": "student",
    }
    await sio.emit("student-joined", joined_payload, room=session_id)
    await sio.emit("student_joined", joined_payload, room=session_id)
    await sio.emit("room_participants", {
        "participants": [_student_payload(item) for item in room["students"].values()],
        "teacher_sid": room.get("teacher"),
        "teacher_streaming": bool(room.get("is_streaming")),
    }, to=sid)
    await _emit_dashboard_update(session_id)


async def _handle_emotion_update(sid: str, data: dict | None) -> None:
    data = data or {}
    session_id = _extract_session_id(data) or socket_connections.get(sid, {}).get("sessionId", "")
    if not session_id or not sio:
        return

    room = _ensure_live_room(session_id)
    student = room["students"].get(sid, {})
    attention_value = data.get("attention")
    try:
        attention = None if attention_value is None else float(attention_value)
    except (TypeError, ValueError):
        attention = None

    student.update({
        "studentId": str(data.get("studentId") or data.get("user_id") or data.get("userId") or student.get("studentId") or sid),
        "name": str(data.get("name") or data.get("username") or student.get("name") or socket_connections.get(sid, {}).get("name") or "Student"),
        "socketId": sid,
        "emotion": str(data.get("emotion") or student.get("emotion") or "unknown"),
        "confidence": float(data.get("confidence") or student.get("confidence") or 0),
        "attention": attention,
        "timestamp": data.get("timestamp") or datetime.utcnow().isoformat(),
        "lowAttention": attention is not None and attention < 0.4,
    })
    room["students"][sid] = student

    payload = {
        **data,
        "sessionId": session_id,
        "live_session_id": session_id,
        "studentId": student["studentId"],
        "name": student["name"],
        "socketId": sid,
        "student_sid": sid,
        "student_username": student["name"],
        "emotion": student["emotion"],
        "confidence": student["confidence"],
        "attention": student["attention"],
        "timestamp": student["timestamp"],
        "lowAttention": student["lowAttention"],
    }
    await sio.emit("live-emotion-update", payload, room=session_id)
    await sio.emit("live_emotion_update", payload, room=session_id)
    await sio.emit("student_emotion", payload, room=session_id)
    await _emit_dashboard_update(session_id)


def setup_socketio(app: FastAPI) -> AsyncServer:
    """Setup Socket.IO for real-time live classroom communication."""
    del app
    global sio

    sio = AsyncServer(
        async_mode="asgi",
        cors_allowed_origins=settings.cors_origins or "*",
        ping_timeout=60,
        ping_interval=25,
    )

    @sio.event
    async def connect(sid, environ):
        logger.info("Client %s connected", sid)
        await sio.emit("connected", {"data": "Connected to MELD server"}, to=sid)

    @sio.event
    async def disconnect(sid):
        logger.info("Client %s disconnected", sid)
        connection = socket_connections.pop(sid, None)
        if not connection:
            return

        session_id = connection.get("sessionId")
        room = active_live_rooms.get(session_id)
        if not room:
            return

        if connection.get("role") == "teacher" and room.get("teacher") == sid:
            room["teacher"] = None
            room["is_streaming"] = False
            await sio.emit("teacher_stopped", {}, room=session_id)
            await sio.emit("teacher_stopped_streaming", {}, room=session_id)
        else:
            room["students"].pop(sid, None)
            await sio.emit("user_left", {"sid": sid, "socketId": sid}, room=session_id)

        await _emit_dashboard_update(session_id)
        if not room.get("teacher") and not room["students"]:
            active_live_rooms.pop(session_id, None)

    @sio.on("teacher-join")
    async def teacher_join(sid, data):
        await _join_teacher(sid, data)

    @sio.on("student-join")
    async def student_join(sid, data):
        await _join_student(sid, data)

    @sio.event
    async def join_room(sid, data):
        role = str((data or {}).get("role") or "").strip().lower()
        if role == "teacher":
            await _join_teacher(sid, data)
        else:
            await _join_student(sid, data)

    @sio.on("emotion-update")
    async def emotion_update(sid, data):
        await _handle_emotion_update(sid, data)

    @sio.event
    async def student_local_emotion(sid, data):
        await _handle_emotion_update(sid, data)

    @sio.event
    async def meeting_chat(sid, data):
        connection = socket_connections.get(sid)
        if not connection:
            return
        text = str((data or {}).get("text") or "").strip()
        if not text:
            return

        session_id = connection["sessionId"]
        payload = {
            "message_id": str(uuid4()),
            "room_id": session_id,
            "live_session_id": session_id,
            "text": text,
            "timestamp": (data or {}).get("timestamp") or datetime.utcnow().isoformat(),
            "emotion": (data or {}).get("emotion"),
            "confidence": (data or {}).get("confidence", 0),
            "source": (data or {}).get("source") or "chat",
            "user_id": connection.get("userId"),
            "username": connection.get("name"),
            "role": connection.get("role"),
        }
        await sio.emit("meeting_chat", payload, room=session_id)

    @sio.event
    async def start_streaming(sid, data):
        connection = socket_connections.get(sid)
        if not connection:
            return
        session_id = connection["sessionId"]
        room = _ensure_live_room(session_id)
        room["is_streaming"] = True
        await sio.emit("teacher_streaming", {"teacher_sid": sid}, room=session_id, skip_sid=sid)
        await sio.emit("teacher_started_streaming", {"teacher_sid": sid}, room=session_id, skip_sid=sid)
        await _emit_dashboard_update(session_id)

    @sio.event
    async def stop_streaming(sid, data):
        connection = socket_connections.get(sid)
        if not connection:
            return
        session_id = connection["sessionId"]
        room = _ensure_live_room(session_id)
        room["is_streaming"] = False
        await sio.emit("teacher_stopped", {}, room=session_id, skip_sid=sid)
        await sio.emit("teacher_stopped_streaming", {}, room=session_id, skip_sid=sid)
        await _emit_dashboard_update(session_id)

    @sio.event
    async def live_class_ended(sid, data):
        connection = socket_connections.get(sid)
        if not connection or connection.get("role") != "teacher":
            return
        session_id = connection["sessionId"]
        room = _ensure_live_room(session_id)
        room["is_streaming"] = False
        await sio.emit("live_class_ended", {
            "teacher_sid": sid,
            "live_session_id": session_id,
            "ended_at": (data or {}).get("ended_at") or datetime.utcnow().isoformat(),
        }, room=session_id, skip_sid=sid)
        await _emit_dashboard_update(session_id)

    @sio.event
    async def webrtc_offer(sid, data):
        target_sid = (data or {}).get("target") or (data or {}).get("targetSid")
        if target_sid:
            await sio.emit("webrtc_offer", {"from": sid, "offer": (data or {}).get("offer")}, to=target_sid)

    @sio.event
    async def webrtc_answer(sid, data):
        target_sid = (data or {}).get("target") or (data or {}).get("targetSid")
        if target_sid:
            await sio.emit("webrtc_answer", {"from": sid, "answer": (data or {}).get("answer")}, to=target_sid)

    @sio.event
    async def webrtc_ice_candidate(sid, data):
        target_sid = (data or {}).get("target") or (data or {}).get("targetSid")
        if target_sid:
            await sio.emit("webrtc_ice_candidate", {"from": sid, "candidate": (data or {}).get("candidate")}, to=target_sid)

    return sio


async def emit_lesson_emotion_update(payload: dict) -> None:
    if not sio:
        return
    class_id = str(payload.get("classId") or payload.get("class_id") or "").strip()
    lesson_id = str(payload.get("lessonId") or payload.get("lesson_id") or "").strip()
    normalized = {
        "userId": payload.get("userId") or payload.get("user_id"),
        "lessonId": lesson_id or None,
        "classId": class_id or None,
        "emotion": payload.get("emotion") or payload.get("emotion_label"),
        "confidence": payload.get("confidence"),
        "timestamp": payload.get("timestamp"),
    }
    if class_id:
        await sio.emit("emotion_update", normalized, room=f"class_{class_id}")
    if lesson_id:
        await sio.emit("emotion_update", normalized, room=f"lesson_{lesson_id}")
