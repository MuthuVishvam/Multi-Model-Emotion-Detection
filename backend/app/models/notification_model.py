from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NotificationDocument(BaseModel):
    to_user_id: str
    type: str
    payload: dict = Field(default_factory=dict)
    is_read: bool = False
    created_at: datetime
    read_at: Optional[datetime] = None
