from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models import NotificationListResponse, NotificationResponse
from app.services.class_management import class_management_service


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def get_my_notifications(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
) -> NotificationListResponse:
    result = await class_management_service.list_notifications_for_user(current_user["id"], limit=limit)
    return NotificationListResponse(**result)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
) -> NotificationResponse:
    result = await class_management_service.mark_notification_read(
        user_id=current_user["id"],
        notification_id=notification_id,
    )
    return NotificationResponse(**result)
