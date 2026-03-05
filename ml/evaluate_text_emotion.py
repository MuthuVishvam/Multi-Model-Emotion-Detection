import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score


DEFAULT_MODEL = Path("ml/artifacts/text_emotion_model.joblib")
DEFAULT_DATASET = Path("data/sample_emotions.csv")


def evaluate(model_path: Path, dataset_path: Path) -> None:
    model = joblib.load(model_path)
    data = pd.read_csv(dataset_path)

    x = data["text"].astype(str)
    y = data["emotion"].astype(str)

    preds = model.predict(x)

    accuracy = accuracy_score(y, preds)
    macro_f1 = f1_score(y, preds, average="macro")
    labels = sorted(set(y))
    cm = confusion_matrix(y, preds, labels=labels)

    print(f"Accuracy: {accuracy:.4f}")
    print(f"Macro-F1: {macro_f1:.4f}")
    print("Labels:", labels)
    print("Confusion matrix:")
    print(cm)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate text emotion classifier")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    evaluate(args.model, args.dataset)
