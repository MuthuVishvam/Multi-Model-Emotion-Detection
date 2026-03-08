from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import ReturnDocument

from app.database import db
from app.dependencies import get_current_user
from app.models import ProfileUpdateRequest, UserMeResponse


router = APIRouter(tags=["users"])


def _to_me_payload(user: dict) -> dict:
    role = user.get("role")
    status_value = user.get("status")
    verified_value = user.get("verified")
    if role == "teacher":
        status_value = status_value or "pending"
        if verified_value is None:
            verified_value = status_value == "approved"

    return {
        "id": user.get("id") or str(user.get("_id")),
        "email": user.get("email"),
        "role": role,
        "username": user.get("username"),
        "full_name": user.get("full_name"),
        "phone": user.get("phone"),
        "department": user.get("department"),
        "year": user.get("year"),
        "avatar_url": user.get("avatar_url"),
        "bio": user.get("bio"),
        "designation": user.get("designation"),
        "experience_years": user.get("experience_years"),
        "verified": verified_value,
        "verified_at": user.get("verified_at"),
        "status": status_value,
        "is_active": user.get("is_active", user.get("isActive", True)),
    }


@router.get("/users/me", response_model=UserMeResponse)
async def get_me(current_user: dict = Depends(get_current_user)) -> UserMeResponse:
    return UserMeResponse(**_to_me_payload(current_user))


@router.put("/profiles/me", response_model=UserMeResponse)
async def update_my_profile(
    payload: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
) -> UserMeResponse:
    role = current_user.get("role")
    common_fields = {"email", "username", "full_name", "phone", "department", "avatar_url", "bio"}
    role_fields = {
        "student": {"year"},
        "teacher": {"designation", "experience_years"},
        "admin": set(),
    }
    allowed_fields = common_fields | role_fields.get(role, set())

    requested = payload.model_dump(exclude_unset=True)
    updates = {key: value for key, value in requested.items() if key in allowed_fields}
    if not updates:
        return UserMeResponse(**_to_me_payload(current_user))

    for key, value in list(updates.items()):
        if isinstance(value, str):
            updates[key] = value.strip() or None

    next_email = updates.get("email")
    if next_email and next_email != current_user.get("email"):
        if await db.users.find_one({"email": next_email}):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already used")

    next_username = updates.get("username")
    if next_username and next_username != current_user.get("username"):
        if await db.users.find_one({"username": next_username}):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already used")

    updates["updated_at"] = datetime.now(timezone.utc)
    updated = await db.users.find_one_and_update(
        {"_id": ObjectId(current_user["id"])},
        {"$set": updates},
        projection={"password_hash": 0},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    updated["id"] = str(updated["_id"])
    return UserMeResponse(**_to_me_payload(updated))
