from datetime import datetime, timedelta, timezone
import re

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import db
from app.dependencies import get_current_user
from app.models import TokenResponse, UserLogin, UserMeResponse, UserRegister
from app.security import create_access_token, get_password_hash, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


def _is_user_active(user: dict) -> bool:
    if "is_active" in user:
        return bool(user.get("is_active"))
    if "isActive" in user:
        return bool(user.get("isActive"))
    return True


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
        "is_active": _is_user_active(user),
    }


async def _generate_unique_username(base_value: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_.-]", "", (base_value or "").strip())[:64]
    if len(clean) < 3:
        clean = f"user_{int(datetime.now(timezone.utc).timestamp())}"

    candidate = clean
    suffix = 1
    while await db.users.find_one({"username": candidate}):
        suffix += 1
        candidate = f"{clean[:58]}_{suffix}"
    return candidate


@router.post("/register", response_model=TokenResponse)
async def register(payload: UserRegister) -> TokenResponse:
    existing = await db.users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already used")

    if payload.username and await db.users.find_one({"username": payload.username}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already used")

    username = await _generate_unique_username(payload.username or payload.email.split("@")[0])
    now = datetime.now(timezone.utc)
    is_teacher = payload.role == "teacher"

    user_doc = {
        "email": payload.email,
        "password_hash": get_password_hash(payload.password),
        "role": payload.role,
        "username": username,
        "full_name": payload.full_name or username,
        "phone": None,
        "department": None,
        "year": None,
        "avatar_url": None,
        "bio": None,
        "designation": None,
        "experience_years": None,
        "verified": False if is_teacher else True,
        "verified_at": None if is_teacher else now,
        "status": "pending" if is_teacher else "approved",
        "is_active": True,
        "isActive": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)

    token = create_access_token(data={"sub": payload.email}, expires_delta=timedelta(hours=1))
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin) -> TokenResponse:
    query_terms: list[dict] = []
    if payload.email:
        query_terms.append({"email": payload.email})
    if payload.username:
        query_terms.append({"username": payload.username})
    if not query_terms:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Provide email or username")

    user_query = query_terms[0] if len(query_terms) == 1 else {"$or": query_terms}
    user = await db.users.find_one(user_query)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not _is_user_active(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled by admin")
    if user.get("role") == "teacher":
        teacher_status = user.get("status", "pending")
        teacher_verified = bool(user.get("verified", False))
        if teacher_status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account rejected by admin",
            )
        if teacher_status != "approved" or not teacher_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account pending admin approval",
            )

    subject_email = user.get("email")
    if not subject_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid account")

    token = create_access_token(data={"sub": subject_email}, expires_delta=timedelta(hours=1))
    return TokenResponse(access_token=token)


import httpx
from pydantic import BaseModel

class GoogleAuthRequest(BaseModel):
    token: str
    role: str | None = None

@router.post("/google/verify", response_model=TokenResponse)
async def google_verify(payload: GoogleAuthRequest) -> TokenResponse:
    # Verify token with Google's tokeninfo endpoint
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.token}")
    
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")
        
    google_data = resp.json()
    email = google_data.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email not provided by Google")
        
    # Check if user exists
    user = await db.users.find_one({"email": email})
    
    if not user:
        # User doesn't exist, create them
        role = payload.role if payload.role in ["student", "teacher"] else "student"
        is_teacher = role == "teacher"
        now = datetime.now(timezone.utc)
        
        first_name = google_data.get("given_name", email.split("@")[0])
        last_name = google_data.get("family_name", "")
        username = await _generate_unique_username(email.split("@")[0])
        
        user_doc = {
            "email": email,
            "password_hash": "", # No password for Google users
            "role": role,
            "username": username,
            "full_name": f"{first_name} {last_name}".strip(),
            "phone": None,
            "department": None,
            "year": None,
            "avatar_url": google_data.get("picture"),
            "bio": None,
            "designation": None,
            "experience_years": None,
            "verified": False if is_teacher else True,
            "verified_at": None if is_teacher else now,
            "status": "pending" if is_teacher else "approved",
            "is_active": True,
            "isActive": True,
            "created_at": now,
            "updated_at": now,
        }
        await db.users.insert_one(user_doc)
        user = user_doc

    if not _is_user_active(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled by admin")
        
    if user.get("role") == "teacher":
        teacher_status = user.get("status", "pending")
        teacher_verified = bool(user.get("verified", False))
        if teacher_status == "rejected":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account rejected by admin")
        if teacher_status != "approved" or not teacher_verified:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account pending admin approval")

    token = create_access_token(data={"sub": email}, expires_delta=timedelta(hours=1))
    return TokenResponse(access_token=token)

@router.get("/me", response_model=UserMeResponse)
async def me(current_user: dict = Depends(get_current_user)) -> UserMeResponse:
    return UserMeResponse(**_to_me_payload(current_user))
