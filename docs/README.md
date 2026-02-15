# AI Emotion Detection MVP (Step 2)

## What is implemented

- Text emotion classifier pipeline (TF-IDF + Logistic Regression) with train/predict/evaluate scripts.
- Backend prediction endpoint: `POST /emotion/predict_text` (stores every prediction in MongoDB `emotion_logs`).
- Dashboard analytics endpoints:
  - `GET /dashboard/summary?session_id=...`
  - `GET /dashboard/student?session_id=...&student_id=...`
  - `GET /dashboard/export_csv?session_id=...`
- Frontend student flow: submit text and see predicted emotion.
- Frontend teacher dashboard: bar chart, pie chart, timeline line chart, student table, CSV download.

## 1) Train model (one command)

From repository root:

```bash
python ml/train_text.py --dataset data/sample_emotions.csv --output ml/artifacts/text_emotion_model.joblib
```

Optional checks:

```bash
python ml/evaluate_text.py --model ml/artifacts/text_emotion_model.joblib --dataset data/sample_emotions.csv
python ml/predict_text.py --model ml/artifacts/text_emotion_model.joblib --text "I am happy with this class"
```

## 2) Run backend + DB + frontend

```bash
docker compose -f docker/docker-compose.yml --profile frontend up --build
```

Service URLs:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- MongoDB: `mongodb://localhost:27017`

## 3) Test flow end-to-end

1. Open `http://localhost:5173` and register/login.
2. In Student Session page, click `Start Session`.
3. Enter `Session ID`, `Student ID`, and text utterance.
4. Click `Submit Text` to get emotion prediction.
5. Open Teacher Dashboard page with same `Session ID` and click `Load Summary`.
6. Use `Download CSV` to export session logs.

## 4) Backend tests

```bash
cd backend
pytest -q
```

Covers:

- `/health`
- `/emotion/predict_text` (with DB + predictor mocked)
