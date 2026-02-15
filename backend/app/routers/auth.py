from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status

from app.database import db
from app.models import TokenResponse, UserLogin, UserRegister
from app.security import create_access_token, get_password_hash, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(payload: UserRegister) -> TokenResponse:
    existing = await db.users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already used")

    user_doc = {
        "email": payload.email,
        "password_hash": get_password_hash(payload.password),
        "role": payload.role,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)

    token = create_access_token(data={"sub": payload.email}, expires_delta=timedelta(hours=1))
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin) -> TokenResponse:
    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(data={"sub": payload.email}, expires_delta=timedelta(hours=1))
    return TokenResponse(access_token=token)
