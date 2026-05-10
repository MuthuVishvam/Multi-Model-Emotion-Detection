import { useEffect, useMemo, useRef, useState } from "react";
import * as faceapi from "face-api.js";

import { apiRequest, buildApiUrl } from "../services/api";

const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
const FACE_CAPTURE_INTERVAL_MS = 4000;
const FACE_MIN_CONFIDENCE = 0.35;

function mapFaceToLearningEmotion(expressions) {
  const surprised = expressions.surprised || 0;
  const happy = expressions.happy || 0;
  const neutral = expressions.neutral || 0;
  const confusedSignal = (expressions.fearful || 0) + (expressions.sad || 0) + (expressions.angry || 0);
  const boredSignal = neutral + (expressions.sad || 0) * 0.45;
  const focusedSignal = neutral * 0.6 + happy * 0.25;

  if (surprised >= 0.35) {
    return {
      emotion: "surprised",
      scores: {
        interest: Number((happy * 0.4).toFixed(3)),
        bored: Number((boredSignal * 0.35).toFixed(3)),
        focused: Number((focusedSignal * 0.4).toFixed(3)),
        confused: Number((confusedSignal * 0.35).toFixed(3)),
        surprised: Number(surprised.toFixed(3)),
      },
    };
  }

  if (confusedSignal >= 0.55) {
    return {
      emotion: "confused",
      scores: {
        interest: Number((happy * 0.25).toFixed(3)),
        bored: Number((boredSignal * 0.3).toFixed(3)),
        focused: Number((focusedSignal * 0.3).toFixed(3)),
        confused: Number(Math.min(1, confusedSignal).toFixed(3)),
        surprised: Number((surprised * 0.3).toFixed(3)),
      },
    };
  }

  if (boredSignal >= 0.55) {
    return {
      emotion: "bored",
      scores: {
        interest: Number((happy * 0.25).toFixed(3)),
        bored: Number(Math.min(1, boredSignal).toFixed(3)),
        focused: Number((focusedSignal * 0.3).toFixed(3)),
        confused: Number((confusedSignal * 0.3).toFixed(3)),
        surprised: Number((surprised * 0.25).toFixed(3)),
      },
    };
  }

  if (focusedSignal >= 0.45) {
    return {
      emotion: "focused",
      scores: {
        interest: Number((happy * 0.35).toFixed(3)),
        bored: Number((boredSignal * 0.25).toFixed(3)),
        focused: Number(Math.min(1, focusedSignal).toFixed(3)),
        confused: Number((confusedSignal * 0.2).toFixed(3)),
        surprised: Number((surprised * 0.2).toFixed(3)),
      },
    };
  }

  return {
    emotion: "interest",
    scores: {
      interest: Number(Math.min(1, happy + neutral * 0.4).toFixed(3)),
      bored: Number((boredSignal * 0.25).toFixed(3)),
      focused: Number((focusedSignal * 0.35).toFixed(3)),
      confused: Number((confusedSignal * 0.25).toFixed(3)),
      surprised: Number((surprised * 0.2).toFixed(3)),
    },
  };
}

function extractYouTubeVideoId(urlString) {
  if (!urlString) {
    return "";
  }

  try {
    const url = new URL(urlString);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v") || "";
      }
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
        return url.pathname.split("/").filter(Boolean)[1] || "";
      }
    }
  } catch {
    return "";
  }

  return "";
}

function inferLessonMedia(url) {
  if (!url) {
    return { type: "none" };
  }

  const sourceUrl = String(url || "").trim();
  const youtubeId = extractYouTubeVideoId(url);
  if (youtubeId) {
    return {
      type: "youtube",
      src: `https://www.youtube.com/embed/${youtubeId}`,
    };
  }

  const src = sourceUrl.startsWith("/") ? buildApiUrl(sourceUrl) : sourceUrl;
  const lower = sourceUrl.toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(lower)) {
    return { type: "video", src };
  }

  return { type: "link", src };
}

function getTopScore(scores) {
  if (!scores) {
    return 0;
  }
  return Math.max(0, ...Object.values(scores));
}

export default function StudentSessionPage({ user }) {
  const [sessionName, setSessionName] = useState("Online Class A");
  const [sessionId, setSessionId] = useState("");
  const [text, setText] = useState("I understand this concept now.");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [lessons, setLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [faceStatus, setFaceStatus] = useState("Camera not started");

  const webcamRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const modelsLoadedRef = useRef(false);
  const captureBusyRef = useRef(false);
  const faceHistoryRef = useRef([]);

  const topScores = useMemo(() => {
    if (!result?.scores) {
      return [];
    }
    return Object.entries(result.scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [result]);

  const lessonMedia = useMemo(() => inferLessonMedia(selectedLesson?.content || ""), [selectedLesson]);

  async function loadLessons() {
    const token = localStorage.getItem("token") || "";
    try {
      const data = await apiRequest("/lessons", "GET", null, token);
      setLessons(data);
      if (data.length > 0 && !selectedLesson) {
        setSelectedLesson(data[0]);
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function startSession() {
    const token = localStorage.getItem("token") || "";
    try {
      const data = await apiRequest(
        "/sessions/start",
        "POST",
        {
          session_name: sessionName,
          lesson_id: selectedLesson?.lesson_id || null,
        },
        token
      );
      setSessionId(data.id);
      setMessage(`Session started: ${data.id}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitUtterance() {
    const token = localStorage.getItem("token") || "";
    try {
      const data = await apiRequest(
        "/emotion/predict_text",
        "POST",
        {
          session_id: sessionId,
          student_id: user.email,
          text,
          modality: "text",
          lesson_id: selectedLesson?.lesson_id || null,
        },
        token
      );
      setResult(data);
      setMessage("Text emotion predicted and stored.");
    } catch (error) {
      setMessage(error.message);
      setResult(null);
    }
  }

  async function loadFaceModels() {
    if (modelsLoadedRef.current) {
      return;
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    modelsLoadedRef.current = true;
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFaceStatus("Camera not supported in this browser");
      return;
    }

    try {
      if (streamRef.current) {
        setCameraReady(true);
        setFaceStatus("Camera already running");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        await webcamRef.current.play().catch(() => {});
      }

      await loadFaceModels();
      setCameraReady(true);
      setFaceStatus(showCameraPreview ? "Camera ready (preview on)" : "Camera ready (preview hidden)");
    } catch (error) {
      setFaceStatus(`Camera error: ${error.message}`);
    }
  }

  function stopCamera() {
    stopTracking();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (webcamRef.current) {
      webcamRef.current.srcObject = null;
    }
    setCameraReady(false);
    setFaceStatus("Camera stopped");
  }

  function stopTracking() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    captureBusyRef.current = false;
    faceHistoryRef.current = [];
    setFaceStatus((prev) => (prev.startsWith("Camera") ? prev : "Capture stopped"));
  }

  function getSmoothedEmotion(currentEmotion) {
    const history = [...faceHistoryRef.current, currentEmotion].slice(-3);
    faceHistoryRef.current = history;

    const counts = history.reduce((acc, emotion) => {
      acc[emotion] = (acc[emotion] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || currentEmotion;
  }

  async function startTracking() {
    if (!sessionId) {
      setFaceStatus("Start or set session ID first");
      return;
    }
    if (!cameraReady || !webcamRef.current) {
      setFaceStatus("Start camera first");
      return;
    }

    const token = localStorage.getItem("token") || "";
    stopTracking();
    setFaceStatus("Tracking facial engagement in background...");

    timerRef.current = setInterval(async () => {
      if (captureBusyRef.current) {
        return;
      }
      if (!webcamRef.current || webcamRef.current.readyState < 2) {
        setFaceStatus("Waiting for camera feed...");
        return;
      }

      captureBusyRef.current = true;
      try {
        const detection = await faceapi
          .detectSingleFace(webcamRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (!detection?.expressions) {
          setFaceStatus("No face detected");
          return;
        }

        const mapped = mapFaceToLearningEmotion(detection.expressions);
        const topScore = getTopScore(mapped.scores);

        if (topScore < FACE_MIN_CONFIDENCE) {
          setFaceStatus(`Low confidence (${topScore.toFixed(2)}), skipped`);
          return;
        }

        const smoothedEmotion = getSmoothedEmotion(mapped.emotion);
        await apiRequest(
          `/sessions/${sessionId}/log_emotion`,
          "POST",
          {
            student_id: user.email,
            lesson_id: selectedLesson?.lesson_id || null,
            modality: "face",
            text: `[face_capture lesson:${selectedLesson?.title || "video"}]`,
            emotion: smoothedEmotion,
            scores: mapped.scores,
          },
          token
        );

        setFaceStatus(`Captured: ${smoothedEmotion} (confidence ${topScore.toFixed(2)})`);
      } catch (error) {
        setFaceStatus(`Tracking error: ${error.message}`);
      } finally {
        captureBusyRef.current = false;
      }
    }, FACE_CAPTURE_INTERVAL_MS);
  }

  useEffect(() => {
    loadLessons();
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="layout-grid">
      <aside className="card sidebar-card">
        <h3>Student Details</h3>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Role:</strong> {user.role}</p>

        <h3>Lessons</h3>
        {lessons.length === 0 && <p>No lessons posted yet.</p>}
        <ul className="lesson-list">
          {lessons.map((lesson) => (
            <li key={lesson.lesson_id}>
              <button
                className={selectedLesson?.lesson_id === lesson.lesson_id ? "lesson-btn active" : "lesson-btn"}
                onClick={() => setSelectedLesson(lesson)}
              >
                {lesson.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="card main-card">
        <h2>Student Learning Session</h2>

        <label>Session Name</label>
        <input value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
        <button onClick={startSession}>Start Session</button>

        <label>Session ID</label>
        <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} />

        {selectedLesson && (
          <div className="chart-card">
            <h3>Watching Lesson: {selectedLesson.title}</h3>
            <p>{selectedLesson.description}</p>

            {lessonMedia.type === "youtube" && (
              <iframe
                className="lesson-iframe"
                src={lessonMedia.src}
                title={`Lesson video: ${selectedLesson.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}

            {lessonMedia.type === "video" && (
              <video className="lesson-video" controls src={lessonMedia.src}>
                Your browser does not support video playback.
              </video>
            )}

            {lessonMedia.type === "link" && (
              <div className="result-panel">
                <p>This URL is not a direct video file.</p>
                <p>
                  Open lesson link:{" "}
                  <a href={lessonMedia.src} target="_blank" rel="noreferrer">
                    {lessonMedia.src}
                  </a>
                </p>
              </div>
            )}

            <p className="small-note">
              YouTube links are supported now. Direct `.mp4/.webm/.ogg` links still play in the built-in video player.
            </p>
          </div>
        )}

        <div className="chart-card">
          <h3>Background Facial Engagement Capture</h3>
          <p className="small-note">
            Camera access is used for emotion capture. Preview is hidden by default so your face is not shown while watching.
          </p>
          <div className="capture-grid">
            <div>
              <p>{showCameraPreview ? "Webcam preview" : "Webcam preview hidden"}</p>
              <video
                className={showCameraPreview ? "webcam-video" : "webcam-video webcam-video-hidden"}
                ref={webcamRef}
                autoPlay
                muted
                playsInline
              />
              {!showCameraPreview && (
                <div className="privacy-placeholder">
                  Camera is active in background (preview hidden)
                </div>
              )}
            </div>
            <div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showCameraPreview}
                  onChange={(event) => setShowCameraPreview(event.target.checked)}
                />
                Show camera preview on screen
              </label>
              <button onClick={startCamera}>Start Camera</button>
              <button onClick={startTracking}>Start Capture</button>
              <button className="secondary" onClick={stopTracking}>Stop Capture</button>
              <button className="secondary" onClick={stopCamera}>Stop Camera</button>
              <p>Status: {faceStatus}</p>
              <p>Reported states: interest, bored, surprised, focused, confused.</p>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <h3>Text Emotion Check</h3>
          <label>Student text</label>
          <input value={text} onChange={(event) => setText(event.target.value)} />
          <button onClick={submitUtterance}>Submit Text</button>
          <p>{message}</p>
          {result && (
            <div className="result-panel">
              <p>
                Detected Emotion: <strong>{result.emotion}</strong>
              </p>
              <p>Timestamp: {new Date(result.timestamp).toLocaleString()}</p>
              <ul>
                {topScores.map(([emotion, score]) => (
                  <li key={emotion}>{emotion}: {(score * 100).toFixed(1)}%</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

