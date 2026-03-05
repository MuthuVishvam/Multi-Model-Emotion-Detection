import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from services.face_emotion_predictor import FER2013EmotionPredictor


DEFAULT_MODEL = Path("ml/artifacts/fer2013_cnn.pt")


def predict(model_path: Path, image_path: Path) -> dict:
    predictor = FER2013EmotionPredictor(str(model_path))
    image = Image.open(image_path).convert("RGB")
    arr = np.asarray(image, dtype=np.uint8)
    return predictor.predict_from_array(arr)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict facial emotion from image")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--image", type=Path, required=True)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    result = predict(args.model, args.image)
    print(result)


