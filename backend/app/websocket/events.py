from socketio import AsyncServer, ASGIApp
from fastapi import FastAPI
import logging

logger = logging.getLogger(__name__)

sio: AsyncServer = None

def setup_socketio(app: FastAPI) -> AsyncServer:
    """Setup Socket.IO for real-time communication"""
    global sio
    
    sio = AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*",
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
        room = f"class_{data['classId']}"
        sio.enter_room(sid, room)
        await sio.emit("user_joined", {
            "userId": data['userId'],
            "name": data['name']
        }, room=room)
    
    @sio.event
    async def leave_class(sid, data):
        room = f"class_{data['classId']}"
        sio.leave_room(sid, room)
        await sio.emit("user_left", {
            "userId": data['userId'],
            "name": data['name']
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
        room = f"class_{data['classId']}"
        await sio.emit("emotion_update", {
            "userId": data['userId'],
            "emotion": data['emotion'],
            "confidence": data['confidence'],
            "timestamp": data['timestamp']
        }, room=room)
    
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
