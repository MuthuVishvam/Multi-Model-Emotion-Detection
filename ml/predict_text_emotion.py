import argparse
from pathlib import Path

import joblib


DEFAULT_MODEL = Path("ml/artifacts/text_emotion_model.joblib")


def predict(model_path: Path, text: str) -> dict:
    model = joblib.load(model_path)
    labels = list(model.classes_)
    probs = model.predict_proba([text])[0]
    scores = {labels[idx]: float(probs[idx]) for idx in range(len(labels))}
    emotion = max(scores, key=scores.get)
    return {"emotion": emotion, "scores": scores}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict emotion from text")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--text", type=str, required=True)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    result = predict(args.model, args.text)
    print(result)
