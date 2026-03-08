from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, require_teacher
from app.models import (
    LiveClassEndResponse,
    LiveClassParticipantResponse,
    LiveClassSessionResponse,
    LiveClassStartRequest,
)
from app.services.live_class_service import live_class_service


router = APIRouter(prefix="/live-classes", tags=["live-classes"])


@router.post("/start", response_model=LiveClassSessionResponse)
async def start_live_class(
    payload: LiveClassStartRequest,
    teacher_user: dict = Depends(require_teacher),
) -> LiveClassSessionResponse:
    result = await live_class_service.start_live_class(
        teacher_user=teacher_user,
        payload=payload.model_dump(),
    )
    return LiveClassSessionResponse(**result)


@router.post("/{live_session_id}/end", response_model=LiveClassEndResponse)
async def end_live_class(
    live_session_id: str,
    teacher_user: dict = Depends(require_teacher),
) -> LiveClassEndResponse:
    result = await live_class_service.end_live_class(
        live_session_id=live_session_id,
        teacher_user=teacher_user,
    )
    return LiveClassEndResponse(**result)


@router.post("/{live_session_id}/join", response_model=LiveClassParticipantResponse)
async def join_live_class(
    live_session_id: str,
    current_user: dict = Depends(get_current_user),
) -> LiveClassParticipantResponse:
    result = await live_class_service.join_live_class(
        live_session_id=live_session_id,
        current_user=current_user,
    )
    return LiveClassParticipantResponse(**result)


@router.post("/{live_session_id}/leave", response_model=LiveClassParticipantResponse)
async def leave_live_class(
    live_session_id: str,
    current_user: dict = Depends(get_current_user),
) -> LiveClassParticipantResponse:
    result = await live_class_service.leave_live_class(
        live_session_id=live_session_id,
        current_user=current_user,
    )
    return LiveClassParticipantResponse(**result)


@router.get("/{live_session_id}", response_model=LiveClassSessionResponse)
async def get_live_class(
    live_session_id: str,
    current_user: dict = Depends(get_current_user),
) -> LiveClassSessionResponse:
    result = await live_class_service.get_live_class_for_user(
        live_session_id=live_session_id,
        current_user=current_user,
    )
    return LiveClassSessionResponse(**result)
