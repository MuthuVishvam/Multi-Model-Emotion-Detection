"""
Live Classes API endpoints - Complete Implementation
"""
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
import uuid

from app.models.models import LiveSessionResponse, LiveSessionCreate
from app.api.v1.auth import get_current_user
from app.database.mongodb import get_db

router = APIRouter()


@router.post("/{class_id}/start", response_model=LiveSessionResponse, tags=["Live Classes"])
async def start_live_class(class_id: str, current_user: dict = Depends(get_current_user)):
    """Start a live class session (teacher only)"""
    db = get_db()
    
    try:
        class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Verify teacher
    if class_doc["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only class teacher can start session")
    
    # Check for existing active session
    existing = await db["live_sessions"].find_one({
        "class_id": class_id,
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Class already has an active session")
    
    session_data = {
        "class_id": class_id,
        "teacher_id": current_user["id"],
        "title": f"Live Class - {class_doc['name']}",
        "status": "active",
        "participants": [current_user["id"]],
        "started_at": datetime.utcnow(),
        "ended_at": None,
        "recording_url": None
    }
    
    result = await db["live_sessions"].insert_one(session_data)
    
    return LiveSessionResponse(
        id=str(result.inserted_id),
        class_id=session_data["class_id"],
        teacher_id=session_data["teacher_id"],
        title=session_data["title"],
        status=session_data["status"],
        participants=session_data["participants"],
        started_at=session_data["started_at"],
        ended_at=None,
        recording_url=None
    )


@router.post("/{session_id}/end", tags=["Live Classes"])
async def end_live_class(session_id: str, current_user: dict = Depends(get_current_user)):
    """End a live class session (teacher only)"""
    db = get_db()
    
    try:
        session = await db["live_sessions"].find_one({"_id": ObjectId(session_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify teacher
    if session["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only teacher can end session")
    
    await db["live_sessions"].update_one(
        {"_id": ObjectId(session_id)},
        {
            "$set": {
                "status": "ended",
                "ended_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Live class ended successfully"}


@router.get("/active", tags=["Live Classes"])
async def get_active_classes(current_user: dict = Depends(get_current_user)):
    """Get all active live classes"""
    db = get_db()
    
    sessions = []
    cursor = db["live_sessions"].find({"status": "active"})
    async for session in cursor:
        sessions.append({
            "id": str(session["_id"]),
            "class_id": session["class_id"],
            "teacher_id": session["teacher_id"],
            "title": session["title"],
            "participants": session.get("participants", []),
            "started_at": session.get("started_at"),
            "participant_count": len(session.get("participants", []))
        })
    
    return {
        "sessions": sessions,
        "count": len(sessions)
    }


@router.get("/{session_id}", response_model=LiveSessionResponse, tags=["Live Classes"])
async def get_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get live session details"""
    db = get_db()
    
    try:
        session = await db["live_sessions"].find_one({"_id": ObjectId(session_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return LiveSessionResponse(
        id=str(session["_id"]),
        class_id=session["class_id"],
        teacher_id=session["teacher_id"],
        title=session["title"],
        status=session["status"],
        participants=session.get("participants", []),
        started_at=session.get("started_at"),
        ended_at=session.get("ended_at"),
        recording_url=session.get("recording_url")
    )


@router.post("/{session_id}/join", tags=["Live Classes"])
async def join_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Join a live class session"""
    db = get_db()
    
    try:
        session = await db["live_sessions"].find_one({"_id": ObjectId(session_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is not active")
    
    # Check if already in session
    if current_user["id"] not in session.get("participants", []):
        await db["live_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$push": {"participants": current_user["id"]}}
        )
    
    session = await db["live_sessions"].find_one({"_id": ObjectId(session_id)})
    
    return {
        "message": "Joined session successfully",
        "session_id": session_id,
        "participants": session.get("participants", []),
        "status": session["status"]
    }


@router.post("/{session_id}/leave", tags=["Live Classes"])
async def leave_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Leave a live class session"""
    db = get_db()
    
    try:
        session = await db["live_sessions"].find_one({"_id": ObjectId(session_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db["live_sessions"].update_one(
        {"_id": ObjectId(session_id)},
        {"$pull": {"participants": current_user["id"]}}
    )
    
    return {"message": "Left session successfully"}


@router.put("/{session_id}/attendance", tags=["Live Classes"])
async def update_attendance(
    session_id: str,
    attendance_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update participant attendance"""
    db = get_db()
    
    try:
        session = await db["live_sessions"].find_one({"_id": ObjectId(session_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify teacher
    if session["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only teacher can update attendance")
    
    # Store attendance data
    await db["live_sessions"].update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"attendance": attendance_data}}
    )
    
    return {"message": "Attendance updated successfully"}


@router.get("/{session_id}/participants", tags=["Live Classes"])
async def get_participants(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get session participants"""
    db = get_db()
    
    try:
        session = await db["live_sessions"].find_one({"_id": ObjectId(session_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    participant_ids = session.get("participants", [])
    participants = []
    
    for pid in participant_ids:
        try:
            user = await db["users"].find_one({"_id": ObjectId(pid)})
            if user:
                participants.append({
                    "id": str(user["_id"]),
                    "email": user["email"],
                    "name": user["name"],
                    "avatar_url": user.get("avatar_url"),
                    "role": user.get("role", "student")
                })
        except:
            pass
    
    return {
        "session_id": session_id,
        "participants": participants,
        "count": len(participants)
    }
