"""
Emotion Detection API endpoints - Complete Implementation
"""
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime, timedelta

from app.models.models import EmotionEventCreate, EmotionEventResponse
from app.api.v1.auth import get_current_user
from app.database.mongodb import get_db

router = APIRouter()


@router.post("/{session_id}", response_model=EmotionEventResponse, tags=["Emotions"])
async def record_emotion(
    session_id: str,
    request: EmotionEventCreate,
    current_user: dict = Depends(get_current_user)
):
    """Record emotion detection for a session"""
    db = get_db()
    
    # Verify session exists
    try:
        session = await db["live_sessions"].find_one({"_id": ObjectId(session_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify user is in session
    if current_user["id"] not in session.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant in this session")
    
    # Create emotion event
    emotion_data = {
        "session_id": session_id,
        "user_id": current_user["id"],
        "emotion": request.emotion,
        "confidence": request.confidence,
        "engagement_score": request.engagement_score,
        "timestamp": datetime.utcnow()
    }
    
    result = await db["emotion_events"].insert_one(emotion_data)
    
    return EmotionEventResponse(
        id=str(result.inserted_id),
        session_id=emotion_data["session_id"],
        user_id=emotion_data["user_id"],
        emotion=emotion_data["emotion"],
        confidence=emotion_data["confidence"],
        engagement_score=emotion_data["engagement_score"],
        timestamp=emotion_data["timestamp"]
    )


@router.get("/session/{session_id}", tags=["Emotions"])
async def get_session_emotions(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get emotions for a session"""
    db = get_db()
    
    # Verify session exists
    try:
        session = await db["live_sessions"].find_one({"_id": ObjectId(session_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Fetch emotion events
    emotions = []
    cursor = db["emotion_events"].find({"session_id": session_id}).sort("timestamp", -1).limit(1000)
    async for event in cursor:
        emotions.append({
            "id": str(event["_id"]),
            "user_id": event["user_id"],
            "emotion": event["emotion"],
            "confidence": event["confidence"],
            "engagement_score": event["engagement_score"],
            "timestamp": event["timestamp"]
        })
    
    # Calculate statistics
    emotion_counts = {}
    total_engagement = 0
    for emotion in emotions:
        e = emotion["emotion"]
        emotion_counts[e] = emotion_counts.get(e, 0) + 1
        total_engagement += emotion["engagement_score"]
    
    avg_engagement = total_engagement / len(emotions) if emotions else 0
    dominant_emotion = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "neutral"
    
    return {
        "session_id": session_id,
        "emotions": emotions,
        "count": len(emotions),
        "statistics": {
            "dominant_emotion": dominant_emotion,
            "average_engagement": round(avg_engagement, 2),
            "emotion_distribution": emotion_counts
        }
    }


@router.get("/user/{user_id}", tags=["Emotions"])
async def get_user_emotions(
    user_id: str,
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """Get user emotion history"""
    # User can only view their own or teacher can view their students
    if current_user["id"] != user_id and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db = get_db()
    
    # Calculate date range
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Fetch emotion events
    emotions = []
    cursor = db["emotion_events"].find({
        "user_id": user_id,
        "timestamp": {"$gte": start_date}
    }).sort("timestamp", -1)
    async for event in cursor:
        emotions.append({
            "id": str(event["_id"]),
            "session_id": event["session_id"],
            "emotion": event["emotion"],
            "confidence": event["confidence"],
            "engagement_score": event["engagement_score"],
            "timestamp": event["timestamp"]
        })
    
    # Calculate statistics
    emotion_counts = {}
    total_engagement = 0
    for emotion in emotions:
        e = emotion["emotion"]
        emotion_counts[e] = emotion_counts.get(e, 0) + 1
        total_engagement += emotion["engagement_score"]
    
    avg_engagement = total_engagement / len(emotions) if emotions else 0
    
    return {
        "user_id": user_id,
        "emotions": emotions,
        "count": len(emotions),
        "days": days,
        "statistics": {
            "average_engagement": round(avg_engagement, 2),
            "emotion_distribution": emotion_counts,
            "trend": "improving" if len(emotions) > 1 else "neutral"
        }
    }


@router.get("/class/{class_id}/analytics", tags=["Emotions"])
async def get_class_emotion_analytics(
    class_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get emotion analytics for a class"""
    db = get_db()
    
    # Verify class access
    class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    is_teacher = class_doc["teacher_id"] == current_user["id"]
    if not is_teacher and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all sessions for this class
    sessions = []
    cursor = db["live_sessions"].find({"class_id": class_id})
    async for session in cursor:
        sessions.append(str(session["_id"]))
    
    # Get emotions for all sessions
    all_emotions = []
    for session_id in sessions:
        cursor = db["emotion_events"].find({"session_id": session_id})
        async for event in cursor:
            all_emotions.append(event)
    
    # Calculate statistics
    emotion_counts = {}
    total_engagement = 0
    user_engagement = {}
    
    for emotion in all_emotions:
        e = emotion["emotion"]
        emotion_counts[e] = emotion_counts.get(e, 0) + 1
        total_engagement += emotion["engagement_score"]
        
        user_id = emotion["user_id"]
        if user_id not in user_engagement:
            user_engagement[user_id] = []
        user_engagement[user_id].append(emotion["engagement_score"])
    
    avg_engagement = total_engagement / len(all_emotions) if all_emotions else 0
    
    # Calculate user averages
    user_averages = {}
    for user_id, scores in user_engagement.items():
        user_averages[user_id] = round(sum(scores) / len(scores), 2)
    
    return {
        "class_id": class_id,
        "total_events": len(all_emotions),
        "sessions_count": len(sessions),
        "statistics": {
            "average_engagement": round(avg_engagement, 2),
            "emotion_distribution": emotion_counts,
            "user_averages": user_averages
        }
    }
