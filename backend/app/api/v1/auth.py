"""
Authentication API endpoints - Complete Implementation
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from bson import ObjectId

from app.models.models import (
    LoginRequest, SignupRequest, TokenResponse, UserResponse, GoogleAuthRequest
)
from app.core.config import settings
from app.database.mongodb import get_db

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

router = APIRouter()


def hash_password(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str, expires_delta: timedelta | None = None) -> str:
    """Create JWT access token"""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
    
    to_encode = {
        "sub": user_id,
        "exp": int(expire.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp())
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_id: str) -> str:
    """Create JWT refresh token"""
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    
    to_encode = {
        "sub": user_id,
        "type": "refresh",
        "exp": int(expire.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp())
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_current_user(credentials: HTTPAuthCredentials = Depends(security)):
    """Get current user from token"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    user["id"] = str(user["_id"])
    return user


@router.post("/login", response_model=TokenResponse, tags=["Authentication"])
async def login(request: LoginRequest):
    """User login endpoint - returns JWT token"""
    db = get_db()
    
    user = await db["users"].find_one({"email": request.email.lower()})
    
    if not user or not verify_password(request.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(str(user["_id"]))
    refresh_token = create_refresh_token(str(user["_id"]))
    
    user_response = UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        role=user.get("role", "student"),
        created_at=user.get("created_at", datetime.utcnow()),
        updated_at=user.get("updated_at", datetime.utcnow()),
        avatar_url=user.get("avatar_url"),
        is_verified=user.get("is_verified", False),
        google_id=user.get("google_id")
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_response,
        expires_in=86400
    )


@router.post("/signup", response_model=TokenResponse, tags=["Authentication"])
async def signup(request: SignupRequest):
    """User signup endpoint - creates new account"""
    db = get_db()
    
    existing_user = await db["users"].find_one({"email": request.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_data = {
        "email": request.email.lower(),
        "name": request.name,
        "role": request.role,
        "password_hash": hash_password(request.password),
        "is_verified": False,
        "avatar_url": None,
        "google_id": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db["users"].insert_one(user_data)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    
    user_response = UserResponse(
        id=user_id,
        email=user_data["email"],
        name=user_data["name"],
        role=user_data["role"],
        created_at=user_data["created_at"],
        updated_at=user_data["updated_at"],
        avatar_url=None,
        is_verified=False,
        google_id=None
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_response,
        expires_in=86400
    )


@router.post("/google", response_model=TokenResponse, tags=["Authentication"])
async def google_auth(request: GoogleAuthRequest):
    """Google OAuth endpoint"""
    try:
        from google.auth.transport import requests
        from google.oauth2 import id_token
        
        idinfo = id_token.verify_oauth2_token(
            request.token,
            requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
        
        email = idinfo.get("email", "").lower()
        name = idinfo.get("name", "")
        google_id = idinfo.get("sub")
        picture = idinfo.get("picture")
        
        if not email:
            raise HTTPException(status_code=400, detail="Could not get email from Google")
        
        db = get_db()
        user = await db["users"].find_one({"email": email})
        
        if not user:
            user_data = {
                "email": email,
                "name": name,
                "role": "student",
                "google_id": google_id,
                "password_hash": None,
                "is_verified": True,
                "avatar_url": picture,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            result = await db["users"].insert_one(user_data)
            user_id = str(result.inserted_id)
        else:
            user_id = str(user["_id"])
            await db["users"].update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "google_id": google_id,
                        "avatar_url": picture or user.get("avatar_url"),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            user = await db["users"].find_one({"_id": ObjectId(user_id)})
        
        access_token = create_access_token(user_id)
        refresh_token = create_refresh_token(user_id)
        
        user_response = UserResponse(
            id=user_id,
            email=email,
            name=name,
            role=user.get("role", "student"),
            created_at=user.get("created_at", datetime.utcnow()),
            updated_at=user.get("updated_at", datetime.utcnow()),
            avatar_url=picture or user.get("avatar_url"),
            is_verified=True,
            google_id=google_id
        )
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user_response,
            expires_in=86400
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google auth failed: {str(e)}")


@router.get("/me", response_model=UserResponse, tags=["Authentication"])
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user"""
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


@router.post("/logout", tags=["Authentication"])
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout endpoint"""
    return {"message": "Logged out successfully"}


@router.post("/refresh", response_model=TokenResponse, tags=["Authentication"])
async def refresh(credentials: HTTPAuthCredentials = Depends(security)):
    """Refresh access token"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type", "")
        
        if token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
            
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    new_access_token = create_access_token(user_id)
    new_refresh_token = create_refresh_token(user_id)
    
    user_response = UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        role=user.get("role", "student"),
        created_at=user.get("created_at", datetime.utcnow()),
        updated_at=user.get("updated_at", datetime.utcnow()),
        avatar_url=user.get("avatar_url"),
        is_verified=user.get("is_verified", False),
        google_id=user.get("google_id")
    )
    
    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=user_response,
        expires_in=86400
    )
