from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class UserDocument(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Literal["student", "teacher", "admin"] = "student"
    status: Literal["pending", "approved", "rejected"] = "approved"
    verified: bool = True
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AuthCredential(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(default=None, min_length=3, max_length=64)
    password_hash: str
