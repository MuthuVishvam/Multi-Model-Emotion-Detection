# ML Models Implementation Guide

This file contains the integration points for ML emotion detection models.

## Face Emotion Detection

### Implementation Steps:
1. Load the trained face_emotion model from artifacts/
2. Receive video frames from WebRTC stream
3. Extract faces using face-api.js or OpenCV
4. Run emotion inference
5. Return emotion + confidence scores

### Expected Output:
```json
{
  "emotion": "happy",
  "confidence": 0.95,
  "faces": 1,
  "timestamp": "2024-05-09T10:30:00Z"
}
```

## Voice Emotion Detection

### Implementation Steps:
1. Capture audio stream from microphone
2. Process with librosa for audio features
3. Run inference on trained model
4. Return emotion classification

### Expected Output:
```json
{
  "emotion": "confident",
  "stress_level": 0.3,
  "energy": 0.7,
  "timestamp": "2024-05-09T10:30:00Z"
}
```

## Engagement Scoring

### Algorithm:
- Face detection frequency (0-100)
- Sustained attention duration (0-100)
- Response timing (0-100)
- Participation level (0-100)

### Result:
Average of all factors = Engagement Score (0-100)

## Integration Points:
1. `/api/v1/emotions` endpoint - Record emotions
2. Socket.IO `emotion_detected` event - Real-time updates
3. Analytics dashboard - Show emotion trends
4. Power BI - Embed emotion analytics
