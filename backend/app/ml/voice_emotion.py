from app.services.voice_emotion_baseline import voice_emotion_baseline_service


class VoiceEmotionEngine:
    def predict_from_bytes(self, audio_bytes: bytes, filename: str = "feedback.wav"):
        return voice_emotion_baseline_service.predict_from_bytes(audio_bytes=audio_bytes, filename=filename)


__all__ = ["VoiceEmotionEngine"]
