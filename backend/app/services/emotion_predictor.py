from pathlib import Path

import joblib

from app.config import settings


class TextEmotionPredictorService:
    def __init__(self, artifact_path: str | None = None):
        self.artifact_path = Path(artifact_path or settings.model_artifact_path)
        self.model = None

    def _load_model(self):
        if self.model is None:
            if not self.artifact_path.exists():
                raise FileNotFoundError(
                    f"Model artifact not found at {self.artifact_path}. Train via `python ml/train_text_emotion.py`."
                )
            self.model = joblib.load(self.artifact_path)
        return self.model

    def predict(self, text: str) -> tuple[str, dict[str, float]]:
        model = self._load_model()
        labels = list(model.classes_)
        probs = model.predict_proba([text])[0]
        scores = {labels[idx]: float(probs[idx]) for idx in range(len(labels))}
        emotion = max(scores, key=scores.get)
        return emotion, scores


predictor_service = TextEmotionPredictorService()

