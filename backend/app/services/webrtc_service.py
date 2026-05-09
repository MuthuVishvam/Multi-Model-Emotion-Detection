import base64
from datetime import datetime
from uuid import uuid4

import socketio


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
)

active_rooms = {}
user_connections = {}


def _ensure_room(room_id: str) -> dict:
    if room_id not in active_rooms:
        active_rooms[room_id] = {
            "participants": [],
            "teacher": None,
            "students": [],
            "created_at": datetime.utcnow(),
            "is_streaming": False,
        }
    return active_rooms[room_id]


def _remove_participant_from_room(room: dict, sid: str) -> None:
    room["participants"] = [item for item in room.get("participants", []) if item != sid]
    room["students"] = [item for item in room.get("students", []) if item != sid]
    if room.get("teacher") == sid:
        room["teacher"] = None
        room["is_streaming"] = False


def _infer_emotion_stub(frame_base64: str):
    """
    Lightweight fallback emotion predictor so the Socket.IO service
    does not crash when ML artifacts are unavailable.
    """
    if not frame_base64:
        return "neutral", 0.0, {"neutral": 1.0}

    try:
        base64.b64decode(frame_base64, validate=True)
    except Exception:
        return "neutral", 0.0, {"neutral": 1.0}

    return "neutral", 0.0, {"neutral": 1.0}


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

    connection = user_connections.pop(sid, None)
    if not connection:
        return

    room_id = connection.get("room_id")
    room = active_rooms.get(room_id)
    if not room:
        return

    was_teacher = connection.get("role") == "teacher"
    _remove_participant_from_room(room, sid)
    if was_teacher:
        await sio.emit("teacher_stopped", {}, room=room_id, skip_sid=sid)
    await sio.emit("user_left", {"sid": sid}, room=room_id, skip_sid=sid)

    if len(room["participants"]) == 0:
        del active_rooms[room_id]


@sio.event
async def join_room(sid, data):
    """
    Join a live class room
    data: {
        "room_id": "...",
        "user_id": "...",
        "role": "teacher" or "student",
        "username": "..."
    }
    """
    room_id = data["room_id"]
    user_id = data["user_id"]
    role = data["role"]
    username = data.get("username", "Anonymous")

    room = _ensure_room(room_id)

    await sio.enter_room(sid, room_id)
    if sid not in room["participants"]:
        room["participants"].append(sid)

    user_connections[sid] = {
        "user_id": user_id,
        "room_id": room_id,
        "role": role,
        "username": username,
    }

    if role == "teacher":
        room["teacher"] = sid
        await sio.emit(
            "teacher_joined",
            {"sid": sid, "username": username},
            room=room_id,
            skip_sid=sid,
        )
    else:
        if sid not in room["students"]:
            room["students"].append(sid)
        await sio.emit(
            "student_joined",
            {"sid": sid, "username": username},
            room=room_id,
            skip_sid=sid,
        )

    participants = []
    for participant_sid in room["participants"]:
        if participant_sid != sid and participant_sid in user_connections:
            participants.append({
                "sid": participant_sid,
                "username": user_connections[participant_sid]["username"],
                "role": user_connections[participant_sid]["role"],
            })

    await sio.emit(
        "room_participants",
        {
            "participants": participants,
            "teacher_sid": room["teacher"],
            "teacher_streaming": bool(room.get("is_streaming")),
        },
        to=sid,
    )

    print(f"User {username} ({role}) joined room {room_id}")


@sio.event
async def webrtc_offer(sid, data):
    target_sid = data["target"]
    offer = data["offer"]

    await sio.emit("webrtc_offer", {"from": sid, "offer": offer}, to=target_sid)


@sio.event
async def webrtc_answer(sid, data):
    target_sid = data["target"]
    answer = data["answer"]

    await sio.emit("webrtc_answer", {"from": sid, "answer": answer}, to=target_sid)


@sio.event
async def webrtc_ice_candidate(sid, data):
    target_sid = data["target"]
    candidate = data["candidate"]

    await sio.emit("webrtc_ice_candidate", {"from": sid, "candidate": candidate}, to=target_sid)


@sio.event
async def meeting_chat(sid, data):
    connection = user_connections.get(sid)
    if not connection:
        return

    text = str(data.get("text") or "").strip()
    if not text:
        return

    room_id = connection["room_id"]
    payload = {
        "message_id": str(uuid4()),
        "room_id": room_id,
        "live_session_id": data.get("live_session_id"),
        "text": text,
        "timestamp": data.get("timestamp") or datetime.utcnow().isoformat(),
        "emotion": data.get("emotion"),
        "confidence": data.get("confidence", 0),
        "source": data.get("source") or "chat",
        "user_id": connection["user_id"],
        "username": connection["username"],
        "role": connection["role"],
    }
    await sio.emit("meeting_chat", payload, room=room_id)


@sio.event
async def student_local_emotion(sid, data):
    connection = user_connections.get(sid)
    if not connection or connection.get("role") != "student":
        return

    room_id = connection["room_id"]
    room = active_rooms.get(room_id)
    if not room or not room.get("teacher"):
        return

    await sio.emit(
        "student_emotion",
        {
            "student_sid": sid,
            "student_username": connection["username"],
            "emotion": data.get("emotion") or "unknown",
            "confidence": data.get("confidence", 0),
        },
        to=room["teacher"],
    )


@sio.event
async def emotion_frame(sid, data):
    """
    Receive frame for emotion detection.
    This path is stubbed to avoid crashes when ML models are not packaged.
    """
    try:
        frame_base64 = data.get("frame", "")
        emotion, confidence, all_predictions = _infer_emotion_stub(frame_base64)

        await sio.emit(
            "emotion_result",
            {"emotion": emotion, "confidence": confidence, "all_predictions": all_predictions},
            to=sid,
        )

        connection = user_connections.get(sid)
        if connection:
            room = active_rooms.get(connection["room_id"])
            if room and room.get("teacher"):
                await sio.emit(
                    "student_emotion",
                    {
                        "student_sid": sid,
                        "student_username": connection["username"],
                        "emotion": emotion,
                        "confidence": confidence,
                    },
                    to=room["teacher"],
                )
    except Exception as error:
        print(f"Error processing emotion: {error}")
        await sio.emit("emotion_error", {"error": str(error)}, to=sid)


@sio.event
async def start_streaming(sid, data):
    if sid in user_connections:
        room_id = user_connections[sid]["room_id"]
        room = _ensure_room(room_id)
        room["is_streaming"] = True
        await sio.emit("teacher_streaming", {"teacher_sid": sid}, room=room_id, skip_sid=sid)


@sio.event
async def stop_streaming(sid, data):
    if sid in user_connections:
        room_id = user_connections[sid]["room_id"]
        room = active_rooms.get(room_id)
        if room:
            room["is_streaming"] = False
        await sio.emit("teacher_stopped", {}, room=room_id, skip_sid=sid)


@sio.event
async def live_class_ended(sid, data):
    connection = user_connections.get(sid)
    if not connection or connection.get("role") != "teacher":
        return

    room_id = connection["room_id"]
    room = active_rooms.get(room_id)
    if room:
        room["is_streaming"] = False

    await sio.emit(
        "live_class_ended",
        {
            "teacher_sid": sid,
            "live_session_id": data.get("live_session_id"),
            "ended_at": data.get("ended_at") or datetime.utcnow().isoformat(),
        },
        room=room_id,
        skip_sid=sid,
    )
