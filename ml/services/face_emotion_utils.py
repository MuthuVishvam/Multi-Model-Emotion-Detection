from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import Dataset


FER2013_LABELS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]


class FER2013CNN(nn.Module):
    def __init__(self, num_classes: int = 7):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.BatchNorm2d(32),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.BatchNorm2d(64),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.BatchNorm2d(128),
            nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 6 * 6, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        return self.classifier(x)


def parse_pixels(pixel_str: str) -> np.ndarray:
    pixels = np.fromstring(pixel_str, dtype=np.float32, sep=" ")
    if pixels.size != 48 * 48:
        raise ValueError("FER2013 pixel row is not 48x48")
    pixels = pixels.reshape(48, 48) / 255.0
    return pixels


def preprocess_image_array(image: np.ndarray) -> torch.Tensor:
    if image.ndim != 2:
        raise ValueError("Expected grayscale image array (H, W)")
    if image.shape != (48, 48):
        raise ValueError("Expected shape (48, 48)")
    tensor = torch.tensor(image, dtype=torch.float32).unsqueeze(0)
    return tensor


@dataclass
class FERDataSplit:
    x: torch.Tensor
    y: torch.Tensor


class FER2013Dataset(Dataset):
    def __init__(self, x: torch.Tensor, y: torch.Tensor):
        self.x = x
        self.y = y

    def __len__(self) -> int:
        return self.x.size(0)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        return self.x[idx], self.y[idx]


def load_fer2013(dataset_path: Path, usage: str | None = None) -> FERDataSplit:
    df = pd.read_csv(dataset_path)
    required_cols = {"emotion", "pixels"}
    if not required_cols.issubset(df.columns):
        raise ValueError("FER2013 CSV must contain 'emotion' and 'pixels' columns")

    if usage and "Usage" in df.columns:
        df = df[df["Usage"] == usage]

    x_np = np.stack([parse_pixels(p) for p in df["pixels"].astype(str)])
    y_np = df["emotion"].astype(int).to_numpy()

    x = torch.tensor(x_np, dtype=torch.float32).unsqueeze(1)
    y = torch.tensor(y_np, dtype=torch.long)
    return FERDataSplit(x=x, y=y)
