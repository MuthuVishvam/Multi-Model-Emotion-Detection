from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from ml_service.predictor import TextEmotionPredictor


app = FastAPI(title="ML Text Emotion API")
predictor = TextEmotionPredictor()


class PredictRequest(BaseModel):
    text: str


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/predict_text")
async def predict_text(payload: PredictRequest) -> dict:
    try:
        return predictor.predict(payload.text)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
