from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path


EMOTION_LABELS = ("stress", "boredom", "neutral", "interest")


@dataclass
class VoiceEmotionPrediction:
    emotion: str
    confidence: float
    scores: dict[str, float]
    features: dict[str, float]


class VoiceEmotionBaselineService:
    """
    Baseline voice-emotion pipeline using MFCC and lightweight heuristics.
    TODO: replace with a trained production voice emotion model when available.
    """

    def _extract_features(self, audio, sample_rate: int) -> dict[str, float]:
        import librosa
        import numpy as np

        if audio.size == 0:
            raise ValueError("Audio is empty")

        duration_seconds = float(audio.shape[0] / max(sample_rate, 1))
        mfcc = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=13)
        mfcc_mean = np.mean(mfcc, axis=1)
        mfcc_std = np.std(mfcc, axis=1)
        rms = float(np.mean(librosa.feature.rms(y=audio)))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=audio)))
        spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=audio, sr=sample_rate)))

        return {
            "duration_seconds": duration_seconds,
            "rms": rms,
            "zcr": zcr,
            "spectral_centroid": spectral_centroid,
            "mfcc_mean_0": float(mfcc_mean[0]),
            "mfcc_mean_1": float(mfcc_mean[1]),
            "mfcc_mean_2": float(mfcc_mean[2]),
            "mfcc_std_0": float(mfcc_std[0]),
            "mfcc_std_1": float(mfcc_std[1]),
        }

    @staticmethod
    def _clip_0_1(value: float) -> float:
        return float(max(0.0, min(1.0, value)))

    def _normalize_scores(self, raw_scores: dict[str, float]) -> dict[str, float]:
        import numpy as np

        exps = {label: float(np.exp(score)) for label, score in raw_scores.items()}
        denom = sum(exps.values()) or 1.0
        return {label: exps[label] / denom for label in raw_scores}

    @staticmethod
    def _neutral_fallback(audio_bytes: bytes) -> VoiceEmotionPrediction:
        size_kb = len(audio_bytes) / 1024.0
        duration_guess = max(0.1, min(30.0, size_kb / 16.0))
        return VoiceEmotionPrediction(
            emotion="neutral",
            confidence=0.5,
            scores={"neutral": 0.5, "interest": 0.2, "boredom": 0.15, "stress": 0.15},
            features={
                "duration_seconds": duration_guess,
                "fallback": 1.0,
                "audio_size_bytes": float(len(audio_bytes)),
            },
        )

    def _classify_from_features(self, features: dict[str, float]) -> tuple[str, float, dict[str, float]]:
        energy = self._clip_0_1((features["rms"] - 0.02) / 0.1)
        zcr_norm = self._clip_0_1((features["zcr"] - 0.02) / 0.2)
        centroid_norm = self._clip_0_1((features["spectral_centroid"] - 900.0) / 2500.0)
        mfcc_motion = self._clip_0_1((features["mfcc_std_1"] + features["mfcc_std_0"]) / 120.0)

        stress_raw = 0.42 * energy + 0.28 * zcr_norm + 0.2 * centroid_norm + 0.1 * mfcc_motion
        boredom_raw = 0.58 * (1.0 - energy) + 0.26 * (1.0 - centroid_norm) + 0.16 * (1.0 - mfcc_motion)
        interest_raw = 0.4 * energy + 0.22 * centroid_norm + 0.28 * mfcc_motion + 0.1 * (1.0 - abs(zcr_norm - 0.38))
        neutral_raw = 0.45 * (1.0 - abs(energy - 0.45)) + 0.35 * (1.0 - abs(zcr_norm - 0.3)) + 0.2 * (1.0 - abs(centroid_norm - 0.42))

        raw_scores = {
            "stress": stress_raw,
            "boredom": boredom_raw,
            "neutral": neutral_raw,
            "interest": interest_raw,
        }
        scores = self._normalize_scores(raw_scores)
        emotion = max(scores, key=scores.get)
        confidence = float(scores[emotion])
        return emotion, confidence, scores

    def predict_from_bytes(self, audio_bytes: bytes, filename: str) -> VoiceEmotionPrediction:
        if not audio_bytes:
            raise ValueError("Audio payload is empty")

        suffix = Path(filename or "feedback.wav").suffix.lower() or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(audio_bytes)
            temp_path = tmp_file.name

        try:
            import librosa

            audio, sample_rate = librosa.load(temp_path, sr=16000, mono=True)
            if audio.size == 0:
                raise ValueError("Could not decode audio data")

            features = self._extract_features(audio, sample_rate)
            emotion, confidence, scores = self._classify_from_features(features)

            return VoiceEmotionPrediction(
                emotion=emotion,
                confidence=confidence,
                scores=scores,
                features=features,
            )
        except ValueError:
            raise
        except ImportError:
            return self._neutral_fallback(audio_bytes)
        except Exception as exc:
            raise ValueError("Unable to process audio file. Try recording again in Chrome.") from exc
        finally:
            try:
                os.remove(temp_path)
            except OSError:
                pass


voice_emotion_baseline_service = VoiceEmotionBaselineService()
