import argparse
from pathlib import Path

import torch
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from torch.utils.data import DataLoader

from services.face_emotion_utils import FER2013CNN, FER2013Dataset, FER2013_LABELS, load_fer2013


DEFAULT_DATASET = Path("data/fer2013.csv")
DEFAULT_MODEL = Path("ml/artifacts/fer2013_cnn.pt")


def evaluate(dataset_path: Path, model_path: Path, usage: str = "PrivateTest", batch_size: int = 64) -> None:
    split = load_fer2013(dataset_path, usage=usage)
    loader = DataLoader(FER2013Dataset(split.x, split.y), batch_size=batch_size, shuffle=False)

    checkpoint = torch.load(model_path, map_location="cpu")
    class_names = checkpoint.get("class_names", FER2013_LABELS)
    model = FER2013CNN(num_classes=len(class_names))
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    preds = []
    targets = []
    with torch.no_grad():
        for x_batch, y_batch in loader:
            logits = model(x_batch)
            y_pred = torch.argmax(logits, dim=1)
            preds.extend(y_pred.tolist())
            targets.extend(y_batch.tolist())

    acc = accuracy_score(targets, preds)
    macro_f1 = f1_score(targets, preds, average="macro")
    cm = confusion_matrix(targets, preds)

    print(f"Usage split: {usage}")
    print(f"Accuracy: {acc:.4f}")
    print(f"Macro-F1: {macro_f1:.4f}")
    print("Labels:", class_names)
    print("Confusion matrix:")
    print(cm)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate FER2013 face emotion model")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--usage", type=str, default="PrivateTest")
    parser.add_argument("--batch_size", type=int, default=64)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    evaluate(args.dataset, args.model, args.usage, args.batch_size)


