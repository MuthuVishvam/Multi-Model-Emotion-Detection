"""
Users API endpoints - Complete Implementation
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from bson import ObjectId
from datetime import datetime

from app.models.models import UserResponse, UserUpdate
from app.api.v1.auth import get_current_user
from app.database.mongodb import get_db

router = APIRouter()


@router.get("/profile", response_model=UserResponse, tags=["Users"])
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return UserResponse(
        id=current_user.get("id"),
        email=current_user.get("email"),
        name=current_user.get("name"),
        role=current_user.get("role", "student"),
        created_at=current_user.get("created_at"),
        updated_at=current_user.get("updated_at"),
        avatar_url=current_user.get("avatar_url"),
        is_verified=current_user.get("is_verified", False),
        google_id=current_user.get("google_id")
    )


@router.put("/profile", response_model=UserResponse, tags=["Users"])
async def update_profile(request: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update current user profile"""
    db = get_db()
    
    update_data = {}
    if request.name:
        update_data["name"] = request.name
    if request.bio is not None:
        update_data["bio"] = request.bio
    if request.avatar_url is not None:
        update_data["avatar_url"] = request.avatar_url
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db["users"].update_one(
            {"_id": ObjectId(current_user["id"])},
            {"$set": update_data}
        )
    
    # Fetch updated user
    updated_user = await db["users"].find_one({"_id": ObjectId(current_user["id"])})
    
    return UserResponse(
        id=str(updated_user["_id"]),
        email=updated_user["email"],
        name=updated_user["name"],
        role=updated_user.get("role", "student"),
        created_at=updated_user.get("created_at"),
        updated_at=updated_user.get("updated_at"),
        avatar_url=updated_user.get("avatar_url"),
        is_verified=updated_user.get("is_verified", False),
        google_id=updated_user.get("google_id")
    )


@router.post("/upload-avatar", tags=["Users"])
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload user avatar"""
    import os
    import uuid
    
    # Save file
    upload_dir = "uploads/avatars"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = file.filename.split(".")[-1]
    file_name = f"{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(upload_dir, file_name)
    
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Update user with avatar URL
    avatar_url = f"/uploads/avatars/{file_name}"
    db = get_db()
    
    await db["users"].update_one(
        {"_id": ObjectId(current_user["id"])},
        {
            "$set": {
                "avatar_url": avatar_url,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": "Avatar uploaded successfully",
        "avatar_url": avatar_url
    }


@router.get("/{user_id}", response_model=UserResponse, tags=["Users"])
async def get_user(user_id: str):
    """Get user by ID"""
    db = get_db()
    
    try:
        user = await db["users"].find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        role=user.get("role", "student"),
        created_at=user.get("created_at"),
        updated_at=user.get("updated_at"),
        avatar_url=user.get("avatar_url"),
        is_verified=user.get("is_verified", False),
        google_id=user.get("google_id")
    )


@router.get("/", tags=["Users"])
async def list_users(skip: int = 0, limit: int = 10, current_user: dict = Depends(get_current_user)):
    """List users (admin only)"""
    # Check if user is admin
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_db()
    
    users = []
    cursor = db["users"].find().skip(skip).limit(limit)
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
    
    return {
        "users": users,
        "count": len(users),
        "skip": skip,
        "limit": limit
    }
