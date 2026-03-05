import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


DEFAULT_DATASET = Path("data/sample_emotions.csv")
DEFAULT_OUTPUT = Path("ml/artifacts/text_emotion_model.joblib")


def train_model(dataset_path: Path, output_path: Path) -> None:
    data = pd.read_csv(dataset_path)
    if not {"text", "emotion"}.issubset(data.columns):
        raise ValueError("Dataset must include 'text' and 'emotion' columns")

    x = data["text"].astype(str)
    y = data["emotion"].astype(str)

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )

    pipeline = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=5000)),
            ("clf", LogisticRegression(max_iter=1000, random_state=42)),
        ]
    )

    pipeline.fit(x_train, y_train)

    preds = pipeline.predict(x_test)
    acc = accuracy_score(y_test, preds)
    print(f"Validation accuracy: {acc:.4f}")
    print(classification_report(y_test, preds, zero_division=0))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, output_path)
    print(f"Model artifact saved to: {output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train text emotion classifier")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    train_model(args.dataset, args.output)
