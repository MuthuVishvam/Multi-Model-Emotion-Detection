import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

import { apiRequest } from "../services/api";

const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
const DETECTION_INTERVAL_MS = 2000;
const FLUSH_INTERVAL_MS = 30000;
const MIN_CONFIDENCE = 0.35;

function getTopExpression(expressions) {
  if (!expressions) {
    return null;
  }

  const entries = Object.entries(expressions);
  if (entries.length === 0) {
    return null;
  }

  const [emotion, confidence] = entries.sort((a, b) => b[1] - a[1])[0];
  return {
    emotion,
    confidence: Number(confidence || 0),
  };
}

function getTopExpressionFromDetections(detections) {
  if (!Array.isArray(detections) || detections.length === 0) {
    return null;
  }
  let top = null;
  for (const detection of detections) {
    const candidate = getTopExpression(detection?.expressions);
    if (!candidate) {
      continue;
    }
    if (!top || candidate.confidence > top.confidence) {
      top = candidate;
    }
  }
  return top;
}

function isPermissionDeniedError(error) {
  return (
    error?.name === "NotAllowedError"
    || error?.name === "PermissionDeniedError"
    || String(error?.message || "").toLowerCase().includes("permission")
    || String(error?.message || "").toLowerCase().includes("denied")
  );
}

export default function useEmotionTracker({
  userId,
  courseId,
  lessonId,
  sessionId,
}) {
  const webcamRef = useRef(null);
  const streamRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const flushTimerRef = useRef(null);
  const captureBusyRef = useRef(false);
  const modelsLoadedRef = useRef(false);
  const queueRef = useRef([]);
  const flushBusyRef = useRef(false);
  const lessonStartedRef = useRef(false);
  const trackingEnabledRef = useRef(false);
  const permissionDeniedRef = useRef(false);
  const metadataRef = useRef({
    userId: userId || "",
    courseId: courseId || "",
    lessonId: lessonId || "",
    sessionId: sessionId || "",
  });

  const [trackingEnabled, setTrackingEnabledState] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [statusText, setStatusText] = useState("Emotion tracking OFF");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastEmotion, setLastEmotion] = useState("");
  const [lastConfidence, setLastConfidence] = useState(0);
  const [flushError, setFlushError] = useState("");
  const [faceStats, setFaceStats] = useState({
    userId: userId || "",
    trackerActive: false,
    trackingEnabled: false,
    faceDetected: false,
    facesCount: 0,
    noFaceIntervals: 0,
    updatedAt: null,
  });
  const noFaceIntervalsRef = useRef(0);

  useEffect(() => {
    metadataRef.current = {
      userId: userId || "",
      courseId: courseId || "",
      lessonId: lessonId || "",
      sessionId: sessionId || "",
    };
    setFaceStats((current) => ({ ...current, userId: userId || "" }));
  }, [userId, courseId, lessonId, sessionId]);

  useEffect(() => {
    permissionDeniedRef.current = permissionDenied;
  }, [permissionDenied]);

  function stopDetectionLoop() {
    if (detectionTimerRef.current) {
      window.clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    captureBusyRef.current = false;
    setTrackingActive(false);
    noFaceIntervalsRef.current = 0;
    setFaceStats((current) => ({
      ...current,
      trackerActive: false,
      trackingEnabled: trackingEnabledRef.current,
      faceDetected: false,
      facesCount: 0,
      noFaceIntervals: 0,
      updatedAt: new Date().toISOString(),
    }));
  }

  async function flushQueue() {
    if (flushBusyRef.current || queueRef.current.length === 0) {
      return;
    }

    const token = localStorage.getItem("token") || "";
    const batch = [...queueRef.current];
    queueRef.current = [];
    setQueueSize(0);
    flushBusyRef.current = true;

    try {
      await apiRequest("/emotions/batch", "POST", { events: batch }, token, { timeoutMs: 15000, retryCount: 0 });
      setFlushError("");
    } catch (error) {
      queueRef.current = [...batch, ...queueRef.current];
      setQueueSize(queueRef.current.length);
      setFlushError(error.message || "Batch send failed");
      setStatusText("Emotion tracking ON (batch retry pending)");
    } finally {
      flushBusyRef.current = false;
    }
  }

  async function ensureModelsLoaded() {
    if (modelsLoadedRef.current) {
      return;
    }

    setStatusText("Loading face models...");
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    modelsLoadedRef.current = true;
  }

  async function ensureCameraReady() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatusText("Camera not supported. Continuing without tracking.");
      return false;
    }

    if (streamRef.current) {
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      setPermissionDenied(false);

      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        await webcamRef.current.play().catch(() => {});
      }

      return true;
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        setPermissionDenied(true);
        setStatusText("Camera permission denied. Lesson continues without tracking.");
        setTrackingActive(false);
        return false;
      }

      setStatusText(`Camera error: ${error.message || "Unable to access camera"}`);
      return false;
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (webcamRef.current) {
      webcamRef.current.srcObject = null;
    }
  }

  function stopTracking({ flush = true } = {}) {
    stopDetectionLoop();
    if (flush) {
      void flushQueue();
    }
    stopCamera();
    setStatusText((prev) => (trackingEnabledRef.current ? prev : "Emotion tracking OFF"));
  }

  async function startDetectionLoop() {
    const meta = metadataRef.current;

    if (!trackingEnabledRef.current) {
      return;
    }

    if (!lessonStartedRef.current) {
      setStatusText("Tracking armed. Camera permission will be requested on Play.");
      return;
    }

    if (!meta.sessionId) {
      setStatusText("Tracking armed. Start a session first in Discussion.");
      return;
    }

    if (permissionDeniedRef.current) {
      setStatusText("Camera permission denied. Lesson continues without tracking.");
      return;
    }

    try {
      await ensureModelsLoaded();
      const cameraReady = await ensureCameraReady();
      if (!cameraReady) {
        return;
      }
    } catch (error) {
      setStatusText(`Tracker setup error: ${error.message || "Failed to initialize tracker"}`);
      return;
    }

    if (detectionTimerRef.current) {
      setTrackingActive(true);
      setStatusText("Emotion tracking ON");
      return;
    }

    setTrackingActive(true);
    setStatusText("Emotion tracking ON");

    detectionTimerRef.current = window.setInterval(async () => {
      if (captureBusyRef.current) {
        return;
      }
      if (!trackingEnabledRef.current || !lessonStartedRef.current) {
        return;
      }
      if (!webcamRef.current || webcamRef.current.readyState < 2) {
        return;
      }
      const currentMeta = metadataRef.current;

      if (!currentMeta.sessionId) {
        return;
      }

      captureBusyRef.current = true;

      try {
        const detections = await faceapi
          .detectAllFaces(webcamRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();
        const facesCount = Array.isArray(detections) ? detections.length : 0;

        if (facesCount === 0) {
          noFaceIntervalsRef.current += 1;
        } else {
          noFaceIntervalsRef.current = 0;
        }

        setFaceStats((current) => ({
          ...current,
          userId: currentMeta.userId || current.userId || "",
          trackerActive: true,
          trackingEnabled: trackingEnabledRef.current,
          faceDetected: facesCount > 0,
          facesCount,
          noFaceIntervals: noFaceIntervalsRef.current,
          updatedAt: new Date().toISOString(),
        }));

        const top = getTopExpressionFromDetections(detections);
        if (!top || top.confidence < MIN_CONFIDENCE) {
          return;
        }

        const event = {
          userId: currentMeta.userId,
          courseId: currentMeta.courseId,
          lessonId: currentMeta.lessonId,
          sessionId: currentMeta.sessionId,
          timestamp: new Date().toISOString(),
          emotion: top.emotion,
          confidence: Number(top.confidence.toFixed(4)),
          extra: {
            face_detected: facesCount > 0,
            faces_count: facesCount,
          },
        };

        queueRef.current.push(event);
        setQueueSize(queueRef.current.length);
        setLastEmotion(top.emotion);
        setLastConfidence(event.confidence);
      } catch (error) {
        setStatusText(`Tracker error: ${error.message || "Detection failed"}`);
      } finally {
        captureBusyRef.current = false;
      }
    }, DETECTION_INTERVAL_MS);
  }

  function setTrackingEnabled(nextValueOrUpdater) {
    setTrackingEnabledState((current) => {
      const nextValue = typeof nextValueOrUpdater === "function"
        ? nextValueOrUpdater(current)
        : nextValueOrUpdater;

      trackingEnabledRef.current = Boolean(nextValue);
      setFaceStats((currentFaceStats) => ({
        ...currentFaceStats,
        trackingEnabled: Boolean(nextValue),
      }));

      if (!trackingEnabledRef.current) {
        stopTracking();
      } else if (lessonStartedRef.current) {
        void startDetectionLoop();
      } else {
        setStatusText("Tracking armed. Camera permission will be requested on Play.");
        setFaceStats((current) => ({
          ...current,
          trackingEnabled: true,
          trackerActive: false,
          faceDetected: false,
          facesCount: 0,
          noFaceIntervals: 0,
          updatedAt: new Date().toISOString(),
        }));
      }

      return trackingEnabledRef.current;
    });
  }

  function toggleTracking() {
    setTrackingEnabled((current) => !current);
  }

  function handleLessonPlay() {
    lessonStartedRef.current = true;
    if (trackingEnabledRef.current) {
      void startDetectionLoop();
    }
  }

  function resetLessonStart() {
    lessonStartedRef.current = false;
    stopDetectionLoop();
    stopCamera();
    setStatusText(trackingEnabledRef.current ? "Tracking armed. Camera permission will be requested on Play." : "Emotion tracking OFF");
    noFaceIntervalsRef.current = 0;
    setFaceStats((current) => ({
      ...current,
      trackerActive: false,
      faceDetected: false,
      facesCount: 0,
      noFaceIntervals: 0,
      updatedAt: new Date().toISOString(),
    }));
  }

  useEffect(() => {
    if (!trackingEnabledRef.current) {
      return;
    }
    if (lessonStartedRef.current) {
      void startDetectionLoop();
    }
  }, [sessionId, userId, courseId, lessonId, permissionDenied]);

  useEffect(() => {
    if (flushTimerRef.current) {
      window.clearInterval(flushTimerRef.current);
    }

    flushTimerRef.current = window.setInterval(() => {
      void flushQueue();
    }, FLUSH_INTERVAL_MS);

    return () => {
      if (flushTimerRef.current) {
        window.clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      stopDetectionLoop();
      void flushQueue();
      stopCamera();
    };
  }, []);

  return {
    webcamRef,
    trackingEnabled,
    trackingActive,
    showCameraPreview,
    setShowCameraPreview,
    toggleTracking,
    setTrackingEnabled,
    handleLessonPlay,
    resetLessonStart,
    stopTracking,
    statusText,
    permissionDenied,
    queueSize,
    lastEmotion,
    lastConfidence,
    flushError,
    faceStats,
  };
}

