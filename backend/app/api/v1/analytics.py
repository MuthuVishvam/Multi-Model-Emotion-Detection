"""
Analytics API endpoints - Complete Implementation
"""
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime, timedelta

from app.api.v1.auth import get_current_user
from app.database.mongodb import get_db

router = APIRouter()


@router.get("/dashboard", tags=["Analytics"])
async def get_dashboard_analytics(current_user: dict = Depends(get_current_user)):
    """Get dashboard analytics based on user role"""
    db = get_db()
    
    if current_user.get("role") == "teacher":
        return await get_teacher_dashboard(db, current_user["id"])
    elif current_user.get("role") == "student":
        return await get_student_dashboard(db, current_user["id"])
    elif current_user.get("role") == "admin":
        return await get_admin_dashboard(db)
    else:
        raise HTTPException(status_code=403, detail="Unknown role")


async def get_teacher_dashboard(db, teacher_id: str):
    """Get teacher dashboard metrics"""
    # Get all classes
    classes = []
    cursor = db["classes"].find({"teacher_id": teacher_id})
    async for cls in cursor:
        classes.append(str(cls["_id"]))
    
    # Calculate metrics
    total_students = 0
    total_sessions = 0
    total_emotions = 0
    avg_engagement = 0
    
    for class_id in classes:
        # Count students
        class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
        total_students += len(class_doc.get("students", []))
        
        # Count sessions
        sessions = []
        cursor = db["live_sessions"].find({"class_id": class_id})
        async for session in cursor:
            sessions.append(str(session["_id"]))
            total_sessions += 1
        
        # Get emotions
        for session_id in sessions:
            emotions = []
            cursor = db["emotion_events"].find({"session_id": session_id})
            async for emotion in cursor:
                emotions.append(emotion)
                total_emotions += 1
            
            if emotions:
                session_engagement = sum(e["engagement_score"] for e in emotions) / len(emotions)
                avg_engagement += session_engagement
    
    if total_sessions > 0:
        avg_engagement = avg_engagement / total_sessions
    
    return {
        "user_role": "teacher",
        "total_classes": len(classes),
        "total_students": total_students,
        "active_sessions": total_sessions,
        "average_engagement": round(avg_engagement, 2),
        "total_emotions": total_emotions
    }


async def get_student_dashboard(db, student_id: str):
    """Get student dashboard metrics"""
    # Get enrolled classes
    classes = []
    cursor = db["classes"].find({"students": student_id})
    async for cls in cursor:
        classes.append(str(cls["_id"]))
    
    # Get user's emotion events
    emotions = []
    cursor = db["emotion_events"].find({"user_id": student_id}).sort("timestamp", -1).limit(100)
    async for event in cursor:
        emotions.append(event)
    
    # Calculate metrics
    avg_engagement = 0
    emotion_counts = {}
    
    if emotions:
        avg_engagement = sum(e["engagement_score"] for e in emotions) / len(emotions)
        for emotion in emotions:
            e = emotion["emotion"]
            emotion_counts[e] = emotion_counts.get(e, 0) + 1
    
    top_emotion = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "neutral"
    
    return {
        "user_role": "student",
        "classes_enrolled": len(classes),
        "average_engagement": round(avg_engagement, 2),
        "total_emotions_recorded": len(emotions),
        "top_emotion": top_emotion,
        "emotion_distribution": emotion_counts
    }


async def get_admin_dashboard(db):
    """Get admin dashboard metrics"""
    # Count all users by role
    total_users = await db["users"].count_documents({})
    teachers = await db["users"].count_documents({"role": "teacher"})
    students = await db["users"].count_documents({"role": "student"})
    
    # Count classes and sessions
    total_classes = await db["classes"].count_documents({})
    active_sessions = await db["live_sessions"].count_documents({"status": "active"})
    total_emotions = await db["emotion_events"].count_documents({})
    
    return {
        "user_role": "admin",
        "total_users": total_users,
        "teachers": teachers,
        "students": students,
        "total_classes": total_classes,
        "active_sessions": active_sessions,
        "total_emotions": total_emotions
    }


@router.get("/emotions/{session_id}", tags=["Analytics"])
async def get_emotion_data(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get emotion data for a session"""
    db = get_db()
    
    try:
        session = await db["live_sessions"].find_one({"_id": ObjectId(session_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get emotions
    emotions = []
    cursor = db["emotion_events"].find({"session_id": session_id}).sort("timestamp", -1)
    async for event in cursor:
        emotions.append({
            "emotion": event["emotion"],
            "confidence": event["confidence"],
            "engagement_score": event["engagement_score"],
            "timestamp": event["timestamp"],
            "user_id": event["user_id"]
        })
    
    # Calculate statistics
    emotion_counts = {}
    engagement_scores = []
    
    for emotion in emotions:
        e = emotion["emotion"]
        emotion_counts[e] = emotion_counts.get(e, 0) + 1
        engagement_scores.append(emotion["engagement_score"])
    
    avg_engagement = sum(engagement_scores) / len(engagement_scores) if engagement_scores else 0
    
    return {
        "session_id": session_id,
        "emotions": emotions,
        "count": len(emotions),
        "average_engagement": round(avg_engagement, 2),
        "emotion_distribution": emotion_counts
    }


@router.get("/engagement/{class_id}", tags=["Analytics"])
async def get_engagement_data(
    class_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get engagement data for a class"""
    db = get_db()
    
    try:
        class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Verify access
    if (class_doc["teacher_id"] != current_user["id"] and 
        current_user.get("role") != "admin" and
        current_user["id"] not in class_doc.get("students", [])):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get sessions
    sessions = []
    cursor = db["live_sessions"].find({"class_id": class_id})
    async for session in cursor:
        sessions.append(str(session["_id"]))
    
    # Get emotions from all sessions
    user_engagement = {}
    session_engagement = {}
    
    for session_id in sessions:
        emotions = []
        cursor = db["emotion_events"].find({"session_id": session_id})
        async for event in cursor:
            emotions.append(event)
        
        if emotions:
            session_avg = sum(e["engagement_score"] for e in emotions) / len(emotions)
            session_engagement[session_id] = round(session_avg, 2)
            
            for emotion in emotions:
                user_id = emotion["user_id"]
                if user_id not in user_engagement:
                    user_engagement[user_id] = []
                user_engagement[user_id].append(emotion["engagement_score"])
    
    # Calculate user averages
    user_averages = {}
    for user_id, scores in user_engagement.items():
        user_averages[user_id] = round(sum(scores) / len(scores), 2)
    
    return {
        "class_id": class_id,
        "session_engagement": session_engagement,
        "user_engagement": user_averages,
        "average_engagement": round(sum(user_averages.values()) / len(user_averages.values()), 2) if user_averages else 0
    }


@router.get("/progress/{student_id}", tags=["Analytics"])
async def get_student_progress(
    student_id: str,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get student progress over time"""
    # Authorization check
    if current_user["id"] != student_id and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db = get_db()
    
    # Get emotions over time period
    start_date = datetime.utcnow() - timedelta(days=days)
    emotions = []
    cursor = db["emotion_events"].find({
        "user_id": student_id,
        "timestamp": {"$gte": start_date}
    }).sort("timestamp", -1)
    async for event in cursor:
        emotions.append(event)
    
    # Aggregate by day
    daily_data = {}
    for emotion in emotions:
        day = emotion["timestamp"].date()
        day_str = str(day)
        
        if day_str not in daily_data:
            daily_data[day_str] = {
                "engagement_scores": [],
                "emotions": {}
            }
        
        daily_data[day_str]["engagement_scores"].append(emotion["engagement_score"])
        e = emotion["emotion"]
        daily_data[day_str]["emotions"][e] = daily_data[day_str]["emotions"].get(e, 0) + 1
    
    # Calculate daily averages
    progress = []
    for day_str in sorted(daily_data.keys()):
        data = daily_data[day_str]
        avg_engagement = sum(data["engagement_scores"]) / len(data["engagement_scores"])
        progress.append({
            "date": day_str,
            "average_engagement": round(avg_engagement, 2),
            "emotion_distribution": data["emotions"]
        })
    
    return {
        "student_id": student_id,
        "period_days": days,
        "total_events": len(emotions),
        "progress": progress
    }
