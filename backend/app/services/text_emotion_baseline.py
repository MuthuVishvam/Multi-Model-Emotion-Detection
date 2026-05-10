from __future__ import annotations

from dataclasses import dataclass


TRAINING_DATA: list[tuple[str, str]] = [
    ("this is really interesting and I want to learn more", "interest"),
    ("great explanation, I finally understand this topic", "interest"),
    ("the demo is useful and I am excited to continue", "interest"),
    ("I am confused about this step and need help", "confusion"),
    ("I do not understand the command output", "confusion"),
    ("can you explain this part again", "confusion"),
    ("this is boring and repetitive", "boredom"),
    ("I am losing focus and this lesson feels slow", "boredom"),
    ("the section is dull and not engaging", "boredom"),
    ("I feel stressed and under pressure about this deadline", "stress"),
    ("this error is frustrating and making me anxious", "stress"),
    ("I am overwhelmed with the amount of information", "stress"),
    ("okay", "neutral"),
    ("noted", "neutral"),
    ("thanks", "neutral"),
]

SUGGESTION_BY_EMOTION = {
    "interest": "Keep exploring. Try the next exercise while this momentum is high.",
    "confusion": "Pause and revisit the previous concept, then ask a focused question.",
    "boredom": "Switch to a hands-on example or a shorter practice task.",
    "stress": "Take a short break, then continue with one small step at a time.",
    "neutral": "Continue and add a specific reflection to improve signal quality.",
}


@dataclass
class TextEmotionPrediction:
    emotion: str
    confidence: float
    suggestion: str


class TextEmotionBaselineService:
    """
    Lightweight baseline model for discussion/command text emotion tagging.
    TODO: replace with the production ML artifact once the dedicated text-emotion model is available.
    """

    def __init__(self) -> None:
        self._pipeline = None

    def _get_pipeline(self):
        if self._pipeline is not None:
            return self._pipeline

        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.linear_model import LogisticRegression
            from sklearn.pipeline import Pipeline
        except ImportError:
            return None

        texts = [text for text, _ in TRAINING_DATA]
        labels = [label for _, label in TRAINING_DATA]

        self._pipeline = Pipeline(
            steps=[
                ("tfidf", TfidfVectorizer(ngram_range=(1, 2), lowercase=True)),
                ("clf", LogisticRegression(max_iter=600)),
            ]
        )
        self._pipeline.fit(texts, labels)
        return self._pipeline

    @staticmethod
    def _keyword_fallback(message: str) -> TextEmotionPrediction:
        normalized = message.lower()
        keyword_map = {
            "confusion": ("confused", "confusing", "don't understand", "do not understand", "explain", "lost", "stuck"),
            "boredom": ("boring", "bored", "slow", "repetitive", "dull", "losing focus"),
            "stress": ("stress", "stressed", "anxious", "overwhelmed", "frustrating", "pressure"),
            "interest": ("interesting", "great", "useful", "excited", "understand", "helpful"),
        }
        for emotion, keywords in keyword_map.items():
            if any(keyword in normalized for keyword in keywords):
                return TextEmotionPrediction(
                    emotion=emotion,
                    confidence=0.62,
                    suggestion=SUGGESTION_BY_EMOTION.get(emotion, SUGGESTION_BY_EMOTION["neutral"]),
                )
        return TextEmotionPrediction(
            emotion="neutral",
            confidence=0.55,
            suggestion=SUGGESTION_BY_EMOTION["neutral"],
        )

    def predict(self, text: str) -> TextEmotionPrediction:
        message = (text or "").strip()
        if not message:
            return TextEmotionPrediction(
                emotion="neutral",
                confidence=1.0,
                suggestion=SUGGESTION_BY_EMOTION["neutral"],
            )

        model = self._get_pipeline()
        if model is None:
            return self._keyword_fallback(message)

        probabilities = model.predict_proba([message])[0]
        labels = list(model.classes_)
        best_index = max(range(len(probabilities)), key=lambda idx: probabilities[idx])

        emotion = labels[best_index]
        confidence = float(probabilities[best_index])
        suggestion = SUGGESTION_BY_EMOTION.get(emotion, SUGGESTION_BY_EMOTION["neutral"])

        return TextEmotionPrediction(
            emotion=emotion,
            confidence=confidence,
            suggestion=suggestion,
        )


text_emotion_baseline_service = TextEmotionBaselineService()
