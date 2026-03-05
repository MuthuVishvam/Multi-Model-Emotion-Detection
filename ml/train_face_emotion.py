import argparse
from pathlib import Path

import torch
from sklearn.metrics import accuracy_score
from torch import nn
from torch.utils.data import DataLoader

from services.face_emotion_utils import FER2013CNN, FER2013Dataset, FER2013_LABELS, load_fer2013


DEFAULT_DATASET = Path("data/fer2013.csv")
DEFAULT_OUTPUT = Path("ml/artifacts/fer2013_cnn.pt")


def train(
    dataset_path: Path,
    output_path: Path,
    epochs: int = 8,
    batch_size: int = 64,
    lr: float = 1e-3,
) -> None:
    train_split = load_fer2013(dataset_path, usage="Training")
    val_split = load_fer2013(dataset_path, usage="PublicTest")

    train_loader = DataLoader(FER2013Dataset(train_split.x, train_split.y), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(FER2013Dataset(val_split.x, val_split.y), batch_size=batch_size, shuffle=False)

    model = FER2013CNN(num_classes=len(FER2013_LABELS))
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0

        for x_batch, y_batch in train_loader:
            optimizer.zero_grad()
            logits = model(x_batch)
            loss = criterion(logits, y_batch)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        model.eval()
        preds = []
        targets = []
        with torch.no_grad():
            for x_batch, y_batch in val_loader:
                logits = model(x_batch)
                y_pred = torch.argmax(logits, dim=1)
                preds.extend(y_pred.tolist())
                targets.extend(y_batch.tolist())

        val_acc = accuracy_score(targets, preds)
        avg_loss = total_loss / max(1, len(train_loader))
        print(f"Epoch {epoch}/{epochs} - loss: {avg_loss:.4f} - val_acc: {val_acc:.4f}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "class_names": FER2013_LABELS,
            "epochs": epochs,
            "dataset": str(dataset_path),
        },
        output_path,
    )
    print(f"Saved FER2013 model to: {output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train FER2013 face emotion model")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch_size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    train(args.dataset, args.output, args.epochs, args.batch_size, args.lr)


