from app.services.text_emotion_baseline import text_emotion_baseline_service


class TextEmotionEngine:
    def predict(self, text: str):
        return text_emotion_baseline_service.predict(text)


__all__ = ["TextEmotionEngine"]
