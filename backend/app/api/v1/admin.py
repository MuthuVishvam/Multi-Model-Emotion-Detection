"""
Admin API endpoints - Complete Implementation
"""
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime

from app.models.models import UserResponse
from app.api.v1.auth import get_current_user
from app.database.mongodb import get_db

router = APIRouter()


def check_admin(current_user: dict):
    """Check if user is admin"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/users", tags=["Admin"])
async def get_all_users(
    skip: int = 0,
    limit: int = 10,
    role: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all users (admin only)"""
    check_admin(current_user)
    
    db = get_db()
    
    # Build query
    query = {}
    if role:
        query["role"] = role
    
    users = []
    cursor = db["users"].find(query).skip(skip).limit(limit)
    async for user in cursor:
        users.append(UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            name=user["name"],
            role=user.get("role", "student"),
            created_at=user.get("created_at"),
            updated_at=user.get("updated_at"),
            avatar_url=user.get("avatar_url"),
            is_verified=user.get("is_verified", False),
            google_id=user.get("google_id")
        ))
    
    total = await db["users"].count_documents(query)
    
    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/stats", tags=["Admin"])
async def get_system_stats(current_user: dict = Depends(get_current_user)):
    """Get system statistics"""
    check_admin(current_user)
    
    db = get_db()
    
    # Count collections
    total_users = await db["users"].count_documents({})
    teachers = await db["users"].count_documents({"role": "teacher"})
    students = await db["users"].count_documents({"role": "student"})
    admins = await db["users"].count_documents({"role": "admin"})
    
    total_classes = await db["classes"].count_documents({})
    total_lessons = await db["lessons"].count_documents({})
    total_sessions = await db["live_sessions"].count_documents({})
    active_sessions = await db["live_sessions"].count_documents({"status": "active"})
    total_emotions = await db["emotion_events"].count_documents({})
    
    return {
        "users": {
            "total": total_users,
            "teachers": teachers,
            "students": students,
            "admins": admins
        },
        "content": {
            "classes": total_classes,
            "lessons": total_lessons
        },
        "sessions": {
            "total": total_sessions,
            "active": active_sessions
        },
        "analytics": {
            "total_emotions": total_emotions
        }
    }


@router.post("/teachers/{teacher_id}/approve", tags=["Admin"])
async def approve_teacher(
    teacher_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Approve teacher"""
    check_admin(current_user)
    
    db = get_db()
    
    try:
        teacher = await db["users"].find_one({"_id": ObjectId(teacher_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid teacher ID")
    
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    if teacher.get("role") != "teacher":
        raise HTTPException(status_code=400, detail="User is not a teacher")
    
    await db["users"].update_one(
        {"_id": ObjectId(teacher_id)},
        {
            "$set": {
                "is_verified": True,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": f"Teacher {teacher_id} approved"}


@router.post("/teachers/{teacher_id}/reject", tags=["Admin"])
async def reject_teacher(
    teacher_id: str,
    reason: str = "Not specified",
    current_user: dict = Depends(get_current_user)
):
    """Reject teacher"""
    check_admin(current_user)
    
    db = get_db()
    
    try:
        teacher = await db["users"].find_one({"_id": ObjectId(teacher_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid teacher ID")
    
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    if teacher.get("role") != "teacher":
        raise HTTPException(status_code=400, detail="User is not a teacher")
    
    await db["users"].update_one(
        {"_id": ObjectId(teacher_id)},
        {
            "$set": {
                "is_verified": False,
                "rejection_reason": reason,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": f"Teacher {teacher_id} rejected"}


@router.delete("/users/{user_id}", tags=["Admin"])
async def delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete user (admin only)"""
    check_admin(current_user)
    
    db = get_db()
    
    try:
        user = await db["users"].find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db["users"].delete_one({"_id": ObjectId(user_id)})
    
    return {"message": f"User {user_id} deleted"}


@router.post("/classes/{class_id}/delete", tags=["Admin"])
async def force_delete_class(
    class_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Force delete class (admin only)"""
    check_admin(current_user)
    
    db = get_db()
    
    try:
        class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Delete class and related sessions/lessons
    await db["classes"].delete_one({"_id": ObjectId(class_id)})
    await db["lessons"].delete_many({"class_id": class_id})
    await db["live_sessions"].delete_many({"class_id": class_id})
    
    return {"message": f"Class {class_id} and related data deleted"}


@router.get("/sessions", tags=["Admin"])
async def get_all_sessions(
    skip: int = 0,
    limit: int = 10,
    status: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all live sessions"""
    check_admin(current_user)
    
    db = get_db()
    
    # Build query
    query = {}
    if status:
        query["status"] = status
    
    sessions = []
    cursor = db["live_sessions"].find(query).skip(skip).limit(limit).sort("started_at", -1)
    async for session in cursor:
        sessions.append({
            "id": str(session["_id"]),
            "class_id": session["class_id"],
            "teacher_id": session["teacher_id"],
            "title": session["title"],
            "status": session["status"],
            "participants": len(session.get("participants", [])),
            "started_at": session.get("started_at"),
            "ended_at": session.get("ended_at")
        })
    
    total = await db["live_sessions"].count_documents(query)
    
    return {
        "sessions": sessions,
        "total": total,
        "skip": skip,
        "limit": limit
    }
