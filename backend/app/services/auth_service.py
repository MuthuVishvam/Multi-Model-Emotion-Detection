from datetime import timedelta

from app.database import db
from app.security import create_access_token, verify_password


async def authenticate_user(identifier: str, password: str) -> dict | None:
    query = {"$or": [{"email": identifier}, {"username": identifier}]}
    user = await db.users.find_one(query)
    if not user:
        return None
    if not verify_password(password, user.get("password_hash", "")):
        return None
    return user


def issue_access_token(subject_email: str, expires_minutes: int = 60) -> str:
    return create_access_token(data={"sub": subject_email}, expires_delta=timedelta(minutes=max(1, expires_minutes)))


__all__ = ["authenticate_user", "issue_access_token"]
