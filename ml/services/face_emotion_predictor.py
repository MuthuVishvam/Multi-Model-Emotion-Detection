from __future__ import annotations

import base64
import io
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from services.face_emotion_utils import FER2013CNN, FER2013_LABELS


DEFAULT_FACE_MODEL_PATH = Path(__file__).resolve().parents[1] / "artifacts" / "fer2013_cnn.pt"


class FER2013EmotionPredictor:
    def __init__(self, model_path: str | None = None):
        self.model_path = Path(model_path) if model_path else DEFAULT_FACE_MODEL_PATH
        self.model: FER2013CNN | None = None
        self.class_names = FER2013_LABELS

    def _ensure_model(self) -> None:
        if self.model is not None:
            return
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"FER2013 model not found at {self.model_path}. Train with ml/train_face_emotion.py first."
            )

        checkpoint = torch.load(self.model_path, map_location="cpu")
        class_names = checkpoint.get("class_names")
        if class_names:
            self.class_names = class_names

        model = FER2013CNN(num_classes=len(self.class_names))
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
        self.model = model

    def _prepare(self, image_array: np.ndarray) -> torch.Tensor:
        if image_array.ndim == 3:
            image_array = image_array.mean(axis=2)
        pil = Image.fromarray(image_array.astype(np.uint8)).convert("L").resize((48, 48))
        arr = np.asarray(pil, dtype=np.float32) / 255.0
        return torch.tensor(arr, dtype=torch.float32).unsqueeze(0).unsqueeze(0)

    def predict_from_array(self, image_array: np.ndarray) -> dict:
        self._ensure_model()
        x = self._prepare(image_array)
        with torch.no_grad():
            logits = self.model(x)
            probs = torch.softmax(logits, dim=1)[0].cpu().numpy()
        scores = {self.class_names[i]: float(probs[i]) for i in range(len(self.class_names))}
        emotion = max(scores, key=scores.get)
        return {"emotion": emotion, "scores": scores}

    def predict_from_base64(self, image_base64: str) -> dict:
        raw = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        arr = np.asarray(image, dtype=np.uint8)
        return self.predict_from_array(arr)


