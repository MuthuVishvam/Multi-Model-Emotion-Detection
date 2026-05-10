import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

import { apiRequest } from "../services/api";
import {
  getCameraSupportIssue,
  getMediaSupportSnapshot,
  queryMediaPermissionState,
} from "../services/mediaSupport";

const LOCAL_MODEL_URL = `${import.meta.env.BASE_URL || "/"}models`;
const CDN_MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
const DETECTION_INTERVAL_MS = 2000;
const FLUSH_INTERVAL_MS = 6000;
const CAMERA_RETRY_DELAY_MS = 900;
const CAMERA_MAX_RETRIES = 2;
const NO_FACE_EVENT_STREAK = 3;
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

function waitForVideoMetadata(videoElement, timeoutMs = 5000) {
  if (!videoElement) {
    return Promise.reject(new Error("Camera preview unavailable"));
  }
  if (videoElement.readyState >= 1 && videoElement.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    function cleanup() {
      videoElement.removeEventListener("loadedmetadata", onReady);
      videoElement.removeEventListener("loadeddata", onReady);
      videoElement.removeEventListener("error", onError);
      window.clearTimeout(timeoutId);
    }

    function onReady() {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    }

    function onError() {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Unable to load camera metadata"));
    }

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Camera metadata timed out"));
    }, timeoutMs);

    videoElement.addEventListener("loadedmetadata", onReady, { once: true });
    videoElement.addEventListener("loadeddata", onReady, { once: true });
    videoElement.addEventListener("error", onError, { once: true });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function loadImageElementFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read the selected image."));
    };
    image.src = objectUrl;
  });
}

export default function useEmotionTracker({
  userId,
  courseId,
  classId,
  lessonId,
  sessionId,
  liveSessionId,
  autoStart = false,
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
    classId: classId || "",
    lessonId: lessonId || "",
    sessionId: sessionId || "",
    liveSessionId: liveSessionId || "",
  });
  const noFaceIntervalsRef = useRef(0);

  const [trackingEnabled, setTrackingEnabledState] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [statusText, setStatusText] = useState("Emotion tracking OFF");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastEmotion, setLastEmotion] = useState("");
  const [lastConfidence, setLastConfidence] = useState(0);
  const [flushError, setFlushError] = useState("");
  const [cameraState, setCameraState] = useState("off");
  const [cameraPermissionState, setCameraPermissionState] = useState("unknown");
  const [cameraSupportIssue, setCameraSupportIssue] = useState("");
  const [faceDetectionState, setFaceDetectionState] = useState("not_detected");
  const [faceEventsSent, setFaceEventsSent] = useState(0);
  const [hasFaceCapture, setHasFaceCapture] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isAnalyzingFaceImage, setIsAnalyzingFaceImage] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadError, setModelLoadError] = useState("");
  const [faceStats, setFaceStats] = useState({
    userId: userId || "",
    trackerActive: false,
    trackingEnabled: false,
    faceDetected: false,
    facesCount: 0,
    noFaceIntervals: 0,
    updatedAt: null,
  });

  useEffect(() => {
    metadataRef.current = {
      userId: userId || "",
      courseId: courseId || "",
      classId: classId || "",
      lessonId: lessonId || "",
      sessionId: sessionId || "",
      liveSessionId: liveSessionId || "",
    };
    setFaceStats((current) => ({ ...current, userId: userId || "" }));
  }, [userId, courseId, classId, lessonId, sessionId, liveSessionId]);

  useEffect(() => {
    permissionDeniedRef.current = permissionDenied;
  }, [permissionDenied]);

  useEffect(() => {
    let cancelled = false;

    async function refreshCameraDiagnostics() {
      const snapshot = getMediaSupportSnapshot();
      const nextPermissionState = await queryMediaPermissionState("camera");
      if (cancelled) {
        return;
      }
      setCameraSupportIssue(getCameraSupportIssue(snapshot));
      setCameraPermissionState(nextPermissionState);
    }

    void refreshCameraDiagnostics();

    return () => {
      cancelled = true;
    };
  }, [permissionDenied, userId, sessionId, liveSessionId]);

  function queueFaceEvent({ emotionLabel, confidence, extra }) {
    const meta = metadataRef.current;
    if (!meta.userId || (!meta.lessonId && !meta.liveSessionId)) {
      return;
    }

    const event = {
      user_id: meta.userId,
      class_id: meta.classId || null,
      course_id: meta.courseId || null,
      lesson_id: meta.lessonId || (meta.liveSessionId ? `live:${meta.liveSessionId}` : null),
      session_id: meta.sessionId || null,
      live_session_id: meta.liveSessionId || null,
      modality: "face",
      emotion_label: emotionLabel,
      confidence: Number(confidence || 0),
      engagement_score: Number((Number(confidence || 0) * 100).toFixed(2)),
      timestamp: new Date().toISOString(),
      extra: extra || {},
    };

    queueRef.current.push(event);
    setQueueSize(queueRef.current.length);
  }

  function stopDetectionLoop() {
    if (detectionTimerRef.current) {
      window.clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    captureBusyRef.current = false;
    setTrackingActive(false);
    setFaceDetectionState("not_detected");
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
      if (batch.length === 1) {
        const event = batch[0];
        await apiRequest(
          "/emotions/track",
          "POST",
          {
            userId: event.user_id,
            lessonId: event.lesson_id,
            emotion: event.emotion_label,
            confidence: event.confidence,
            timestamp: event.timestamp,
            classId: event.class_id,
            courseId: event.course_id,
            sessionId: event.session_id,
            liveSessionId: event.live_session_id,
            modality: event.modality,
            extra: event.extra,
          },
          token,
          { timeoutMs: 15000, retryCount: 0 }
        );
      } else {
        await apiRequest("/emotions/batch", "POST", { events: batch }, token, { timeoutMs: 15000, retryCount: 0 });
      }
      setFlushError("");
      setFaceEventsSent((current) => current + batch.length);
      console.debug("[MELD][FaceBatch] Sent", {
        count: batch.length,
        lessonId: metadataRef.current.lessonId,
        sessionId: metadataRef.current.sessionId,
        liveSessionId: metadataRef.current.liveSessionId,
      });
    } catch (error) {
      queueRef.current = [...batch, ...queueRef.current];
      setQueueSize(queueRef.current.length);
      setFlushError(error.message || "Batch send failed");
      setStatusText("Emotion tracking ON (batch retry pending)");
      console.warn("[MELD][FaceBatch] Send failed", error?.message || error);
    } finally {
      flushBusyRef.current = false;
    }
  }

  async function ensureModelsLoaded() {
    if (modelsLoadedRef.current) {
      return;
    }
    setIsModelLoading(true);
    setModelLoadError("");
    setStatusText("Loading face models...");
    const candidates = [LOCAL_MODEL_URL, CDN_MODEL_URL];
    let lastError = null;

    for (const modelUrl of candidates) {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
        await faceapi.nets.faceExpressionNet.loadFromUri(modelUrl);
        modelsLoadedRef.current = true;
        setIsModelLoading(false);
        setModelLoadError("");
        return;
      } catch (error) {
        lastError = error;
      }
    }

    setIsModelLoading(false);
    const message = `Face models failed to load. Ensure /models is deployed with face-api.js weights. ${lastError?.message || ""}`.trim();
    setModelLoadError(message);
    throw new Error(message);
  }

  async function ensureCameraReady() {
    const snapshot = getMediaSupportSnapshot();
    const supportIssue = getCameraSupportIssue(snapshot);
    setCameraSupportIssue(supportIssue);

    if (supportIssue) {
      setStatusText(supportIssue);
      setCameraState("off");
      return false;
    }

    if (streamRef.current && webcamRef.current?.srcObject) {
      setCameraState("on");
      return true;
    }

    let lastError = null;
    for (let attempt = 0; attempt <= CAMERA_MAX_RETRIES; attempt += 1) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 360 },
          },
          audio: false,
        });

        const videoElement = webcamRef.current;
        if (!videoElement) {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error("Camera preview element unavailable");
        }

        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.srcObject = stream;
        await waitForVideoMetadata(videoElement, 5000);
        await videoElement.play();

        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            setCameraState("off");
            setStatusText("Camera disconnected. Retrying...");
          };
        });

        streamRef.current = stream;
        setPermissionDenied(false);
        setCameraPermissionState("granted");
        setCameraState("on");
        setCameraSupportIssue("");
        setStatusText("Emotion tracking ON");
        console.debug("[MELD][Camera] started", {
          attempt: attempt + 1,
          hasPreview: Boolean(showCameraPreview),
        });
        return true;
      } catch (error) {
        lastError = error;
        if (isPermissionDeniedError(error)) {
          setPermissionDenied(true);
          setCameraPermissionState("denied");
          setCameraState("off");
          setStatusText("Camera permission denied. Lesson continues without tracking.");
          setTrackingActive(false);
          return false;
        }

        if (attempt < CAMERA_MAX_RETRIES) {
          await sleep(CAMERA_RETRY_DELAY_MS);
        }
      }
    }

    setCameraState("off");
    setStatusText(`Camera error: ${lastError?.message || "Unable to access camera"}`);
    return false;
  }

  async function requestCameraPermission() {
    setIsRequestingCamera(true);
    setPermissionDenied(false);
    permissionDeniedRef.current = false;

    try {
      const cameraReady = await ensureCameraReady();
      if (!cameraReady) {
        return false;
      }

      setStatusText("Camera permission granted. Start playback to begin live face tracking.");
      if (!trackingActive && !autoStart) {
        stopCamera();
      }
      return true;
    } finally {
      setIsRequestingCamera(false);
      const snapshot = getMediaSupportSnapshot();
      setCameraSupportIssue(getCameraSupportIssue(snapshot));
      setCameraPermissionState(await queryMediaPermissionState("camera"));
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
    setCameraState("off");
  }

  function stopTracking({ flush = true } = {}) {
    stopDetectionLoop();
    if (flush) {
      void flushQueue();
    }
    stopCamera();
    setStatusText((prev) => (trackingEnabledRef.current ? prev : "Emotion tracking OFF"));
  }

  async function captureFaceFromImage(file) {
    const meta = metadataRef.current;
    if (!file) {
      return null;
    }
    if (!meta.userId || (!meta.sessionId && !meta.liveSessionId)) {
      setStatusText("Start a lesson session or join a live class before uploading a face capture.");
      return null;
    }

    setIsAnalyzingFaceImage(true);
    try {
      await ensureModelsLoaded();
      const image = await loadImageElementFromFile(file);
      const detections = await faceapi
        .detectAllFaces(image, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();
      const facesCount = Array.isArray(detections) ? detections.length : 0;

      if (facesCount === 0) {
        queueFaceEvent({
          emotionLabel: "no_face_detected",
          confidence: 0,
          extra: {
            face_detected: false,
            faces_count: 0,
            upload_source: "manual_image",
          },
        });
        await flushQueue();
        setFaceDetectionState("not_detected");
        setLastEmotion("no_face_detected");
        setLastConfidence(0);
        setStatusText("No face detected in the uploaded image.");
        return {
          emotion: "no_face_detected",
          confidence: 0,
          facesCount: 0,
        };
      }

      const top = getTopExpressionFromDetections(detections);
      if (!top) {
        setStatusText("A face was found, but no expression could be classified from this image.");
        return null;
      }

      const confidence = Number(top.confidence.toFixed(4));
      queueFaceEvent({
        emotionLabel: top.emotion,
        confidence,
        extra: {
          face_detected: true,
          faces_count: facesCount,
          upload_source: "manual_image",
        },
      });
      await flushQueue();
      setHasFaceCapture(true);
      setFaceDetectionState("running");
      setLastEmotion(top.emotion);
      setLastConfidence(confidence);
      setStatusText(`Face image processed: ${top.emotion} (${Math.round(confidence * 100)}%).`);
      return {
        emotion: top.emotion,
        confidence,
        facesCount,
      };
    } catch (error) {
      setStatusText(error?.message || "Unable to analyze the selected face image.");
      return null;
    } finally {
      setIsAnalyzingFaceImage(false);
    }
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
    if (!meta.lessonId && !meta.liveSessionId) {
      setStatusText("Tracking will begin when the lesson is ready.");
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
      return;
    }

    setTrackingActive(true);
    setFaceDetectionState("running");
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
      if (!currentMeta.lessonId && !currentMeta.liveSessionId) {
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
          setFaceDetectionState("not_detected");
        } else {
          noFaceIntervalsRef.current = 0;
          setHasFaceCapture(true);
          setFaceDetectionState("running");
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

        if (facesCount === 0 && noFaceIntervalsRef.current >= NO_FACE_EVENT_STREAK && noFaceIntervalsRef.current % NO_FACE_EVENT_STREAK === 0) {
          queueFaceEvent({
            emotionLabel: "no_face_detected",
            confidence: 0,
            extra: {
              face_detected: false,
              faces_count: 0,
              no_face_intervals: noFaceIntervalsRef.current,
            },
          });
          setLastEmotion("no_face_detected");
          setLastConfidence(0);
          return;
        }

        const top = getTopExpressionFromDetections(detections);
        if (!top || top.confidence < MIN_CONFIDENCE) {
          return;
        }

        const confidence = Number(top.confidence.toFixed(4));
        queueFaceEvent({
          emotionLabel: top.emotion,
          confidence,
          extra: {
            face_detected: true,
            faces_count: facesCount,
            no_face_intervals: noFaceIntervalsRef.current,
          },
        });
        setLastEmotion(top.emotion);
        setLastConfidence(confidence);
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
        setFaceStats((currentFaceStats) => ({
          ...currentFaceStats,
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
    setFaceDetectionState("not_detected");
    setHasFaceCapture(false);
    setFaceEventsSent(0);
    setQueueSize(0);
    setFlushError("");
    queueRef.current = [];
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
  }, [sessionId, liveSessionId, userId, courseId, classId, lessonId, permissionDenied]);

  useEffect(() => {
    if (!autoStart || !userId || (!lessonId && !liveSessionId)) {
      return;
    }

    lessonStartedRef.current = true;
    setTrackingEnabled(true);
  }, [autoStart, userId, lessonId, liveSessionId]);

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
    cameraState,
    cameraPermissionState,
    cameraSupportIssue,
    faceDetectionState,
    faceEventsSent,
    hasFaceCapture,
    isRequestingCamera,
    isAnalyzingFaceImage,
    isModelLoading,
    modelLoadError,
    canLogFaceEvents: Boolean(userId && (lessonId || liveSessionId)),
    requestCameraPermission,
    captureFaceFromImage,
  };
}
