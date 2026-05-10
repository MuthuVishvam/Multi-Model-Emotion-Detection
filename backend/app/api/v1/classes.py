"""
Classes API endpoints - Complete Implementation
"""
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
import uuid

from app.models.models import ClassCreate, ClassResponse, ClassUpdate
from app.api.v1.auth import get_current_user
from app.database.mongodb import get_db

router = APIRouter()


@router.post("/", response_model=ClassResponse, tags=["Classes"])
async def create_class(request: ClassCreate, current_user: dict = Depends(get_current_user)):
    """Create new class (teacher only)"""
    if current_user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create classes")
    
    db = get_db()
    
    # Check if code already exists
    existing = await db["classes"].find_one({"code": request.code})
    if existing:
        raise HTTPException(status_code=400, detail="Class code already exists")
    
    class_data = {
        "name": request.name,
        "description": request.description,
        "subject": request.subject,
        "code": request.code,
        "teacher_id": current_user["id"],
        "students": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db["classes"].insert_one(class_data)
    
    return ClassResponse(
        id=str(result.inserted_id),
        name=class_data["name"],
        description=class_data["description"],
        subject=class_data["subject"],
        code=class_data["code"],
        teacher_id=class_data["teacher_id"],
        students=class_data["students"],
        created_at=class_data["created_at"],
        updated_at=class_data["updated_at"],
        student_count=0
    )


@router.get("/{class_id}", response_model=ClassResponse, tags=["Classes"])
async def get_class(class_id: str, current_user: dict = Depends(get_current_user)):
    """Get class details"""
    db = get_db()
    
    try:
        class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    return ClassResponse(
        id=str(class_doc["_id"]),
        name=class_doc["name"],
        description=class_doc.get("description"),
        subject=class_doc["subject"],
        code=class_doc["code"],
        teacher_id=class_doc["teacher_id"],
        students=class_doc.get("students", []),
        created_at=class_doc.get("created_at"),
        updated_at=class_doc.get("updated_at"),
        student_count=len(class_doc.get("students", []))
    )


@router.get("/", tags=["Classes"])
async def list_classes(skip: int = 0, limit: int = 10, current_user: dict = Depends(get_current_user)):
    """List classes for current user"""
    db = get_db()
    
    # Filter based on role
    if current_user.get("role") == "teacher":
        query = {"teacher_id": current_user["id"]}
    else:  # Student sees classes they joined
        query = {"students": current_user["id"]}
    
    classes = []
    cursor = db["classes"].find(query).skip(skip).limit(limit)
    async for class_doc in cursor:
        classes.append(ClassResponse(
            id=str(class_doc["_id"]),
            name=class_doc["name"],
            description=class_doc.get("description"),
            subject=class_doc["subject"],
            code=class_doc["code"],
            teacher_id=class_doc["teacher_id"],
            students=class_doc.get("students", []),
            created_at=class_doc.get("created_at"),
            updated_at=class_doc.get("updated_at"),
            student_count=len(class_doc.get("students", []))
        ))
    
    return {
        "classes": classes,
        "count": len(classes),
        "skip": skip,
        "limit": limit
    }


@router.put("/{class_id}", response_model=ClassResponse, tags=["Classes"])
async def update_class(class_id: str, request: ClassUpdate, current_user: dict = Depends(get_current_user)):
    """Update class (teacher only)"""
    db = get_db()
    
    try:
        class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Check if user is teacher
    if class_doc["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only class teacher can update")
    
    update_data = {}
    if request.name:
        update_data["name"] = request.name
    if request.description is not None:
        update_data["description"] = request.description
    if request.subject:
        update_data["subject"] = request.subject
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db["classes"].update_one(
            {"_id": ObjectId(class_id)},
            {"$set": update_data}
        )
        class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    
    return ClassResponse(
        id=str(class_doc["_id"]),
        name=class_doc["name"],
        description=class_doc.get("description"),
        subject=class_doc["subject"],
        code=class_doc["code"],
        teacher_id=class_doc["teacher_id"],
        students=class_doc.get("students", []),
        created_at=class_doc.get("created_at"),
        updated_at=class_doc.get("updated_at"),
        student_count=len(class_doc.get("students", []))
    )


@router.delete("/{class_id}", tags=["Classes"])
async def delete_class(class_id: str, current_user: dict = Depends(get_current_user)):
    """Delete class (teacher only)"""
    db = get_db()
    
    try:
        class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Check if user is teacher
    if class_doc["teacher_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only class teacher can delete")
    
    await db["classes"].delete_one({"_id": ObjectId(class_id)})
    
    return {"message": "Class deleted successfully"}


@router.post("/{class_id}/join", tags=["Classes"])
async def join_class(class_id: str, current_user: dict = Depends(get_current_user)):
    """Join a class (student only)"""
    db = get_db()
    
    try:
        class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Check if already joined
    if current_user["id"] in class_doc.get("students", []):
        raise HTTPException(status_code=400, detail="Already joined this class")
    
    # Add student to class
    await db["classes"].update_one(
        {"_id": ObjectId(class_id)},
        {
            "$push": {"students": current_user["id"]},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    
    return ClassResponse(
        id=str(class_doc["_id"]),
        name=class_doc["name"],
        description=class_doc.get("description"),
        subject=class_doc["subject"],
        code=class_doc["code"],
        teacher_id=class_doc["teacher_id"],
        students=class_doc.get("students", []),
        created_at=class_doc.get("created_at"),
        updated_at=class_doc.get("updated_at"),
        student_count=len(class_doc.get("students", []))
    )


@router.get("/{class_id}/students", tags=["Classes"])
async def get_class_students(class_id: str, current_user: dict = Depends(get_current_user)):
    """Get list of students in class"""
    db = get_db()
    
    try:
        class_doc = await db["classes"].find_one({"_id": ObjectId(class_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    
    student_ids = class_doc.get("students", [])
    students = []
    
    for student_id in student_ids:
        try:
            student = await db["users"].find_one({"_id": ObjectId(student_id)})
            if student:
                students.append({
                    "id": str(student["_id"]),
                    "email": student["email"],
                    "name": student["name"],
                    "avatar_url": student.get("avatar_url")
                })
        except:
            pass
    
    return {
        "class_id": class_id,
        "students": students,
        "count": len(students)
    }
