from app.services.emotion_event_analytics import emotion_event_analytics_service
from app.services.text_emotion_baseline import text_emotion_baseline_service
from app.services.voice_emotion_baseline import voice_emotion_baseline_service

emotion_service = {
    "analytics": emotion_event_analytics_service,
    "text": text_emotion_baseline_service,
    "voice": voice_emotion_baseline_service,
}

__all__ = ["emotion_service", "emotion_event_analytics_service", "text_emotion_baseline_service", "voice_emotion_baseline_service"]
