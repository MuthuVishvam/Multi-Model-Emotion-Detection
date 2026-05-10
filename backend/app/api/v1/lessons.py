"""
Lessons API endpoints - Complete Implementation
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from bson import ObjectId
from datetime import datetime
import uuid
import os

from app.models.models import LessonCreate, LessonResponse, LessonUpdate
from app.api.v1.auth import get_current_user
from app.database.mongodb import get_db

router = APIRouter()


@router.post("/", response_model=LessonResponse, tags=["Lessons"])
async def create_lesson(request: LessonCreate, current_user: dict = Depends(get_current_user)):
    """Create new lesson (teacher only)"""
    db = get_db()
    
    # Verify teacher owns the class
    class_doc = await db["classes"].find_one({"_id": ObjectId(request.class_id)})
    if not class_doc or class_doc["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to create lesson in this class")
    
    lesson_data = {
        "title": request.title,
        "description": request.description,
        "class_id": request.class_id,
        "video_url": request.video_url,
        "duration_seconds": request.duration_seconds,
        "order": request.order,
        "view_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db["lessons"].insert_one(lesson_data)
    
    return LessonResponse(
        id=str(result.inserted_id),
        title=lesson_data["title"],
        description=lesson_data["description"],
        class_id=lesson_data["class_id"],
        video_url=lesson_data["video_url"],
        duration_seconds=lesson_data["duration_seconds"],
        order=lesson_data["order"],
        created_at=lesson_data["created_at"],
        updated_at=lesson_data["updated_at"],
        view_count=0
    )


@router.get("/class/{class_id}", tags=["Lessons"])
async def get_class_lessons(class_id: str, current_user: dict = Depends(get_current_user)):
    """Get lessons for a class"""
    db = get_db()
    
    # Verify user is in class
    class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    is_teacher = class_doc["teacher_id"] == current_user["id"]
    is_student = current_user["id"] in class_doc.get("students", [])
    
    if not is_teacher and not is_student:
        raise HTTPException(status_code=403, detail="Not authorized to view lessons")
    
    lessons = []
    cursor = db["lessons"].find({"class_id": class_id}).sort("order", 1)
    async for lesson in cursor:
        lessons.append(LessonResponse(
            id=str(lesson["_id"]),
            title=lesson["title"],
            description=lesson.get("description"),
            class_id=lesson["class_id"],
            video_url=lesson.get("video_url"),
            duration_seconds=lesson.get("duration_seconds", 0),
            order=lesson.get("order", 0),
            created_at=lesson.get("created_at"),
            updated_at=lesson.get("updated_at"),
            view_count=lesson.get("view_count", 0)
        ))
    
    return {
        "lessons": lessons,
        "count": len(lessons)
    }


@router.get("/{lesson_id}", response_model=LessonResponse, tags=["Lessons"])
async def get_lesson(lesson_id: str, current_user: dict = Depends(get_current_user)):
    """Get lesson details"""
    db = get_db()
    
    try:
        lesson = await db["lessons"].find_one({"_id": ObjectId(lesson_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid lesson ID")
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Increment view count
    await db["lessons"].update_one(
        {"_id": ObjectId(lesson_id)},
        {"$inc": {"view_count": 1}}
    )
    
    return LessonResponse(
        id=str(lesson["_id"]),
        title=lesson["title"],
        description=lesson.get("description"),
        class_id=lesson["class_id"],
        video_url=lesson.get("video_url"),
        duration_seconds=lesson.get("duration_seconds", 0),
        order=lesson.get("order", 0),
        created_at=lesson.get("created_at"),
        updated_at=lesson.get("updated_at"),
        view_count=lesson.get("view_count", 1)
    )


@router.put("/{lesson_id}", response_model=LessonResponse, tags=["Lessons"])
async def update_lesson(lesson_id: str, request: LessonUpdate, current_user: dict = Depends(get_current_user)):
    """Update lesson"""
    db = get_db()
    
    try:
        lesson = await db["lessons"].find_one({"_id": ObjectId(lesson_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid lesson ID")
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Verify teacher
    class_doc = await db["classes"].find_one({"_id": ObjectId(lesson["class_id"])})
    if not class_doc or class_doc["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {}
    if request.title:
        update_data["title"] = request.title
    if request.description is not None:
        update_data["description"] = request.description
    if request.video_url is not None:
        update_data["video_url"] = request.video_url
    if request.duration_seconds is not None:
        update_data["duration_seconds"] = request.duration_seconds
    if request.order is not None:
        update_data["order"] = request.order
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db["lessons"].update_one(
            {"_id": ObjectId(lesson_id)},
            {"$set": update_data}
        )
        lesson = await db["lessons"].find_one({"_id": ObjectId(lesson_id)})
    
    return LessonResponse(
        id=str(lesson["_id"]),
        title=lesson["title"],
        description=lesson.get("description"),
        class_id=lesson["class_id"],
        video_url=lesson.get("video_url"),
        duration_seconds=lesson.get("duration_seconds", 0),
        order=lesson.get("order", 0),
        created_at=lesson.get("created_at"),
        updated_at=lesson.get("updated_at"),
        view_count=lesson.get("view_count", 0)
    )


@router.delete("/{lesson_id}", tags=["Lessons"])
async def delete_lesson(lesson_id: str, current_user: dict = Depends(get_current_user)):
    """Delete lesson"""
    db = get_db()
    
    try:
        lesson = await db["lessons"].find_one({"_id": ObjectId(lesson_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid lesson ID")
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Verify teacher
    class_doc = await db["classes"].find_one({"_id": ObjectId(lesson["class_id"])})
    if not class_doc or class_doc["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db["lessons"].delete_one({"_id": ObjectId(lesson_id)})
    
    return {"message": "Lesson deleted successfully"}


@router.post("/{lesson_id}/video", tags=["Lessons"])
async def upload_lesson_video(
    lesson_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload lesson video"""
    db = get_db()
    
    try:
        lesson = await db["lessons"].find_one({"_id": ObjectId(lesson_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid lesson ID")
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Verify teacher
    class_doc = await db["classes"].find_one({"_id": ObjectId(lesson["class_id"])})
    if not class_doc or class_doc["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save file
    upload_dir = "uploads/videos"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = file.filename.split(".")[-1]
    file_name = f"{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(upload_dir, file_name)
    
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Update lesson with video URL
    video_url = f"/uploads/videos/{file_name}"
    
    await db["lessons"].update_one(
        {"_id": ObjectId(lesson_id)},
        {
            "$set": {
                "video_url": video_url,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": "Video uploaded successfully",
        "video_url": video_url
    }
