from pathlib import Path

import joblib


DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[1] / "artifacts" / "text_emotion_model.joblib"


class TextEmotionPredictor:
    def __init__(self, model_path: str | None = None):
        self.model_path = Path(model_path) if model_path else DEFAULT_MODEL_PATH
        self.model = None

    def _ensure_model(self) -> None:
        if self.model is None:
            if not self.model_path.exists():
                raise FileNotFoundError(
                    f"Model artifact not found at {self.model_path}. Train with ml/train_text_emotion.py first."
                )
            self.model = joblib.load(self.model_path)

    def predict(self, text: str) -> dict:
        self._ensure_model()
        labels = list(self.model.classes_)
        probs = self.model.predict_proba([text])[0]
        scores = {labels[idx]: float(probs[idx]) for idx in range(len(labels))}
        emotion = max(scores, key=scores.get)
        return {"emotion": emotion, "scores": scores}

