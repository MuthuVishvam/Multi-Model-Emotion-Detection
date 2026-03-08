from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from app.database import db
from app.security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def _is_user_active(user: dict) -> bool:
    if "is_active" in user:
        return bool(user.get("is_active"))
    if "isActive" in user:
        return bool(user.get("isActive"))
    return True


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    try:
        payload = decode_access_token(token)
        email = payload.get("sub")
        if not email:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = await db.users.find_one({"email": email}, {"password_hash": 0})
    if not user:
        raise credentials_exception
    if not _is_user_active(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled by admin")
    user["id"] = str(user.pop("_id"))
    return user


def require_role(*roles: str):
    allowed_roles = {role.strip() for role in roles if isinstance(role, str) and role.strip()}
    if not allowed_roles:
        raise ValueError("require_role requires at least one role")

    async def _dependency(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = str(current_user.get("role") or "").strip()
        if user_role not in allowed_roles:
            role_label = ", ".join(sorted(allowed_roles))
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires role: {role_label}")
        return current_user

    return _dependency


async def require_teacher(current_user: dict = Depends(get_current_user)) -> dict:
    current_user = await require_role("teacher")(current_user=current_user)
    status_value = current_user.get("status", "pending")
    verified_value = current_user.get("verified", False)
    if status_value == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account rejected by admin",
        )
    if status_value != "approved" or not verified_value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending admin approval",
        )
    return current_user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    return await require_role("admin")(current_user=current_user)
