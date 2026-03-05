class FaceEmotionEngine:
    def predict(self, *_args, **_kwargs):
        raise NotImplementedError("Face emotion inference is executed in the frontend tracker for this platform.")


__all__ = ["FaceEmotionEngine"]
