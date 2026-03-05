from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models import AttentionEventBatchRequest, EventBatchIngestResponse
from app.rate_limit import enforce_emotion_ingest_rate_limit
from app.services.emotion_event_analytics import emotion_event_analytics_service


router = APIRouter(prefix="/attention", tags=["attention"])


@router.post(
    "/batch",
    response_model=EventBatchIngestResponse,
    dependencies=[Depends(enforce_emotion_ingest_rate_limit)],
)
async def batch_attention_events(
    payload: AttentionEventBatchRequest,
    current_user: dict = Depends(get_current_user),
) -> EventBatchIngestResponse:
    _ = current_user
    result = await emotion_event_analytics_service.ingest_attention_events(
        events=[event.model_dump() for event in payload.events]
    )
    return EventBatchIngestResponse(**result)
