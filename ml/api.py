from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from services.face_emotion_predictor import FER2013EmotionPredictor
from services.text_emotion_predictor import TextEmotionPredictor


app = FastAPI(title="ML Emotion API")
text_predictor = TextEmotionPredictor()
face_predictor = FER2013EmotionPredictor()


class PredictTextRequest(BaseModel):
    text: str


class PredictFaceRequest(BaseModel):
    image_base64: str


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/predict_text")
async def predict_text(payload: PredictTextRequest) -> dict:
    try:
        return text_predictor.predict(payload.text)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/predict_face")
async def predict_face(payload: PredictFaceRequest) -> dict:
    try:
        return face_predictor.predict_from_base64(payload.image_base64)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image payload: {exc}") from exc


