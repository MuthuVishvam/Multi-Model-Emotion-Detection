from socketio import AsyncServer, ASGIApp
from fastapi import FastAPI
import logging

from app.config import settings

logger = logging.getLogger(__name__)

sio: AsyncServer = None

def setup_socketio(app: FastAPI) -> AsyncServer:
    """Setup Socket.IO for real-time communication"""
    global sio
    
    sio = AsyncServer(
        async_mode="asgi",
        cors_allowed_origins=settings.cors_origins or "*",
        ping_timeout=60,
        ping_interval=25,
    )
    
    # Event handlers
    @sio.event
    async def connect(sid, environ):
        logger.info(f"Client {sid} connected")
        await sio.emit("connected", {"data": "Connected to MELD server"}, to=sid)
    
    @sio.event
    async def disconnect(sid):
        logger.info(f"Client {sid} disconnected")
    
    # Live class events
    @sio.event
    async def join_class(sid, data):
        room = f"class_{data.get('classId')}"
        await sio.enter_room(sid, room)
        await sio.emit("user_joined", {
            "userId": data.get('userId'),
            "name": data.get('name')
        }, room=room)

    @sio.event
    async def join_lesson(sid, data):
        lesson_id = str(data.get("lessonId") or "").strip()
        if not lesson_id:
            return
        room = f"lesson_{lesson_id}"
        await sio.enter_room(sid, room)
        await sio.emit("lesson_joined", {"lessonId": lesson_id}, to=sid)
    
    @sio.event
    async def leave_class(sid, data):
        room = f"class_{data.get('classId')}"
        await sio.leave_room(sid, room)
        await sio.emit("user_left", {
            "userId": data.get('userId'),
            "name": data.get('name')
        }, room=room)
    
    # Chat events
    @sio.event
    async def send_message(sid, data):
        room = f"class_{data['classId']}"
        await sio.emit("new_message", {
            "userId": data['userId'],
            "name": data['name'],
            "text": data['text'],
            "timestamp": data['timestamp']
        }, room=room)
    
    # Emotion events
    @sio.event
    async def emotion_detected(sid, data):
        payload = {
            "userId": data.get("userId"),
            "lessonId": data.get("lessonId"),
            "classId": data.get("classId"),
            "emotion": data.get("emotion"),
            "confidence": data.get("confidence"),
            "timestamp": data.get("timestamp"),
        }
        class_id = str(data.get("classId") or "").strip()
        lesson_id = str(data.get("lessonId") or "").strip()
        if class_id:
            await sio.emit("emotion_update", payload, room=f"class_{class_id}")
        if lesson_id:
            await sio.emit("emotion_update", payload, room=f"lesson_{lesson_id}")

    # WebRTC signaling
    @sio.event
    async def webrtc_offer(sid, data):
        target_sid = data['targetSid']
        await sio.emit("webrtc_offer", {
            "from": sid,
            "offer": data['offer']
        }, room=target_sid)
    
    @sio.event
    async def webrtc_answer(sid, data):
        target_sid = data['targetSid']
        await sio.emit("webrtc_answer", {
            "from": sid,
            "answer": data['answer']
        }, room=target_sid)
    
    @sio.event
    async def webrtc_ice_candidate(sid, data):
        target_sid = data['targetSid']
        await sio.emit("webrtc_ice_candidate", {
            "from": sid,
            "candidate": data['candidate']
        }, room=target_sid)
    
    # Raise hand events
    @sio.event
    async def raise_hand(sid, data):
        room = f"class_{data['classId']}"
        await sio.emit("hand_raised", {
            "userId": data['userId'],
            "name": data['name']
        }, room=room)
    
    @sio.event
    async def lower_hand(sid, data):
        room = f"class_{data['classId']}"
        await sio.emit("hand_lowered", {
            "userId": data['userId']
        }, room=room)
    
    # Screen share events
    @sio.event
    async def screen_share_started(sid, data):
        room = f"class_{data['classId']}"
        await sio.emit("screen_share_started", {
            "userId": data['userId'],
            "name": data['name']
        }, room=room)
    
    @sio.event
    async def screen_share_stopped(sid, data):
        room = f"class_{data['classId']}"
        await sio.emit("screen_share_stopped", {
            "userId": data['userId']
        }, room=room)
    
    # Wrap with ASGI
    asgi_app = ASGIApp(sio, app)
    
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
