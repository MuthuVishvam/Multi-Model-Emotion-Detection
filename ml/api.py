from fastapi import FastAPI
from pydantic import BaseModel

from ml_service.predictor import DummyTextEmotionPredictor


app = FastAPI(title="ML Placeholder API")
predictor = DummyTextEmotionPredictor()


class PredictRequest(BaseModel):
    text: str


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/predict_text")
async def predict_text(payload: PredictRequest) -> dict:
    probs = predictor.predict(payload.text)
    top_emotion = max(probs, key=probs.get)
    return {"top_emotion": top_emotion, "probabilities": probs}
