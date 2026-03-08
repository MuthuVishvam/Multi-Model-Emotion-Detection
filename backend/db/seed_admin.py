from datetime import datetime, timezone
import os
import sys
from pathlib import Path

from pymongo import MongoClient

# Ensure `app` package imports work when script is executed as `python db/seed_admin.py`.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.config import settings
from app.security import get_password_hash


def main() -> None:
    email = os.getenv("ADMIN_EMAIL", "admin@example.com").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "change_me_please")
    full_name = os.getenv("ADMIN_FULL_NAME", "Platform Admin").strip()

    if not email or not password:
        raise ValueError("ADMIN_EMAIL and ADMIN_PASSWORD are required")

    now = datetime.now(timezone.utc)
    client = MongoClient(settings.mongo_uri)
    db = client[settings.db_name]

    updates = {
        "email": email,
        "password_hash": get_password_hash(password),
        "role": "admin",
        "full_name": full_name,
        "status": "approved",
        "verified": True,
        "verified_at": now,
        "is_active": True,
        "isActive": True,
        "updated_at": now,
    }

    db.users.update_one(
        {"email": email},
        {
            "$set": updates,
            "$setOnInsert": {
                "created_at": now,
                "username": email.split("@")[0],
            },
        },
        upsert=True,
    )

    print(f"Admin user ready: {email}")


if __name__ == "__main__":
    main()
