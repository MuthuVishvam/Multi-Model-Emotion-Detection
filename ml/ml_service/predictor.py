import torch


EMOTIONS = ["joy", "sadness", "anger", "fear", "surprise", "neutral", "disgust"]


class DummyTextEmotionPredictor:
    def predict(self, text: str) -> dict[str, float]:
        # Deterministic pseudo-logits from text hash for stable local testing.
        seed = abs(hash(text)) % (2**31)
        generator = torch.Generator().manual_seed(seed)
        logits = torch.randn(len(EMOTIONS), generator=generator)
        probs = torch.softmax(logits, dim=0)
        return {emotion: float(probs[idx]) for idx, emotion in enumerate(EMOTIONS)}
