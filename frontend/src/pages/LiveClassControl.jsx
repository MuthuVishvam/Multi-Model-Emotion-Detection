import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";

import {
  endLiveClass,
  fetchClassLessons,
  fetchLiveOverallAnalytics,
  fetchMyClasses,
  startLiveClass,
} from "../services/api";
import { getRealtimeBaseUrl } from "../services/realtime";

const ACTIVE_LIVE_STORAGE_KEY = "meld_active_live_session_id";

function formatLiveControlError(message) {
  const value = String(message || "").trim();
  const normalized = value.toLowerCase();

  if (normalized.includes("cannot connect to the backend api")) {
    return value;
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network error")) {
    return "Cannot connect to the backend API. Make sure the backend server is running, then reload this page.";
  }
  if (normalized.includes("only students or teachers can access classes")) {
    return "This account cannot access classes. Sign in with a teacher account to use live control.";
  }
  if (normalized.includes("not authenticated") || normalized.includes("401") || normalized.includes("not enough segments")) {
    return "Your session is missing or expired. Sign out and sign in again.";
  }
  if (normalized.includes("403")) {
    return "This teacher account does not have permission to open live control for the selected class.";
  }
  return value || "Unable to load live control.";
}

export default function LiveClassControl() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [title, setTitle] = useState("");
  const [activeSessionId, setActiveSessionId] = useState(localStorage.getItem(ACTIVE_LIVE_STORAGE_KEY) || "");
  const [overall, setOverall] = useState(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [message, setMessage] = useState("");

  async function loadClasses() {
    setIsLoadingClasses(true);
    try {
      const rows = await fetchMyClasses();
      const safeRows = Array.isArray(rows) ? rows : [];
      setClasses(safeRows);
      const initialClass = safeRows[0]?.class_id || "";
      setSelectedClassId((current) => current || initialClass);
      setMessage(
        safeRows.length === 0
          ? "No teacher classes found yet. Create a class first, then come back to start a live session."
          : ""
      );
    } catch (error) {
      setClasses([]);
      setSelectedClassId("");
      setMessage(formatLiveControlError(error.message));
    } finally {
      setIsLoadingClasses(false);
    }
  }

  async function loadLessons(classId) {
    if (!classId) {
      setLessons([]);
      setSelectedLessonId("");
      return;
    }
    setIsLoadingLessons(true);
    try {
      const rows = await fetchClassLessons(classId);
      const safeRows = Array.isArray(rows) ? rows : [];
      setLessons(safeRows);
      setSelectedLessonId((current) => (
        safeRows.some((item) => String(item.lesson_id) === String(current))
          ? current
          : String(safeRows[0]?.lesson_id || "")
      ));
      setMessage((current) => (
        current.startsWith("No teacher classes found")
          ? current
          : ""
      ));
    } catch (error) {
      setLessons([]);
      setSelectedLessonId("");
      setMessage(formatLiveControlError(error.message || "Unable to load class lessons."));
    } finally {
      setIsLoadingLessons(false);
    }
  }

  async function refreshOverall(sessionId = activeSessionId) {
    if (!sessionId) {
      setOverall(null);
      return;
    }
    try {
      const data = await fetchLiveOverallAnalytics(sessionId);
      setOverall(data || null);
    } catch (error) {
      setOverall(null);
      setMessage(formatLiveControlError(error.message || "Unable to fetch live analytics."));
    }
  }

  async function handleStartLiveClass() {
    setIsStarting(true);
    try {
      const payload = {
        class_id: selectedClassId || null,
        lesson_id: selectedLessonId || null,
        title: title.trim() || null,
      };
      const started = await startLiveClass(payload);
      const nextSessionId = started?.live_session_id || "";
      setActiveSessionId(nextSessionId);
      localStorage.setItem(ACTIVE_LIVE_STORAGE_KEY, nextSessionId);
      setOverall(null);
      await refreshOverall(nextSessionId);
      setMessage(`Live class started. Session ID: ${nextSessionId}`);
    } catch (error) {
      setMessage(formatLiveControlError(error.message || "Unable to start live class."));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleEndLiveClass() {
    if (!activeSessionId) {
      return;
    }
    setIsEnding(true);
    try {
      await endLiveClass(activeSessionId);
      setMessage("Live class ended.");
      setOverall((current) => ({ ...(current || {}), status: "ended", active_students_count: 0 }));
      localStorage.removeItem(ACTIVE_LIVE_STORAGE_KEY);
      setActiveSessionId("");
    } catch (error) {
      setMessage(formatLiveControlError(error.message || "Unable to end live class."));
    } finally {
      setIsEnding(false);
    }
  }

  async function handleCopySessionId() {
    if (!activeSessionId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(activeSessionId);
      setMessage("Live session ID copied.");
    } catch {
      setMessage("Unable to copy session ID.");
    }
  }

  async function handleCopyJoinLink() {
    if (!activeSessionId) {
      return;
    }
    try {
      const joinUrl = `${window.location.origin}/student/live?session=${encodeURIComponent(activeSessionId)}`;
      await navigator.clipboard.writeText(joinUrl);
      setMessage("Student join link copied.");
    } catch {
      setMessage("Unable to copy student join link.");
    }
  }

  useEffect(() => {
    void loadClasses();
  }, []);

  useEffect(() => {
    void loadLessons(selectedClassId);
  }, [selectedClassId]);

  useEffect(() => {
    if (!activeSessionId) {
      return undefined;
    }
    void refreshOverall(activeSessionId);
    const timer = window.setInterval(() => {
      void refreshOverall(activeSessionId);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [activeSessionId]);

  useEffect(() => {
    const sessionId = String(activeSessionId || "").trim();
    if (!sessionId) {
      return undefined;
    }

    const socket = io(getRealtimeBaseUrl(), { transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("teacher-join", { sessionId });
    });
    socket.on("dashboard-update", (payload) => {
      setOverall((current) => ({
        ...(current || {}),
        active_students_count: Number(payload?.active_students_count ?? payload?.students?.length ?? 0),
        dominant_emotion: payload?.dominant_emotion || payload?.dominantEmotion || "unknown",
        low_attention_alerts: Number(payload?.low_attention_alerts ?? payload?.lowAttentionCount ?? 0),
      }));
    });

    return () => socket.disconnect();
  }, [activeSessionId]);

  return (
    <div className="learning-page live-control-page">
      <section className="card">
        <p className="eyebrow">Teacher Live Control</p>
        <h2>Start and Manage Live Class</h2>
        <p className="small-note">Create a live session, share the session ID with students, and monitor attendance/emotions.</p>

        <div className="live-control-form">
          <label>
            Class
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              disabled={isLoadingClasses || isStarting || Boolean(activeSessionId)}
            >
              <option value="">Select class</option>
              {classes.map((row) => (
                <option key={row.class_id} value={String(row.class_id)}>
                  {row.class_name} ({row.section})
                </option>
              ))}
            </select>
          </label>

          <label>
            Lesson
            <select
              value={selectedLessonId}
              onChange={(event) => setSelectedLessonId(event.target.value)}
              disabled={!selectedClassId || isLoadingLessons || isStarting || Boolean(activeSessionId)}
            >
              <option value="">Optional lesson</option>
              {lessons.map((row) => (
                <option key={row.lesson_id} value={String(row.lesson_id)}>
                  {row.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            Live title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Midterm revision live class"
              disabled={isStarting || Boolean(activeSessionId)}
            />
          </label>
        </div>

        <div className="live-control-actions">
          {!activeSessionId ? (
            <button
              type="button"
              onClick={handleStartLiveClass}
              disabled={isStarting || !selectedClassId}
            >
              {isStarting ? "Starting..." : "Start Live Class"}
            </button>
          ) : (
            <>
              <button type="button" className="danger" onClick={handleEndLiveClass} disabled={isEnding}>
                {isEnding ? "Ending..." : "End Live Class"}
              </button>
            <button type="button" className="secondary" onClick={handleCopySessionId}>
              Copy Session ID
            </button>
            <button type="button" className="secondary" onClick={() => void handleCopyJoinLink()}>
              Copy Join Link
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigate(`/teacher/live/room/${activeSessionId}`)}
            >
              Open Meeting Room
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigate(`/teacher/live/dashboard/${activeSessionId}`)}
              >
                Open Live Dashboard
              </button>
            </>
          )}
        </div>

        {message && <div className="inline-message inline-message-soft">{message}</div>}
      </section>

      <section className="live-room-metrics">
        <article className="card metric-pill">
          <span>Active session ID</span>
          <strong>{activeSessionId || "-"}</strong>
        </article>
        <article className="card metric-pill">
          <span>Active students</span>
          <strong>{Number(overall?.active_students_count || 0)}</strong>
        </article>
        <article className="card metric-pill">
          <span>Dominant live emotion</span>
          <strong>{overall?.dominant_emotion || "unknown"}</strong>
        </article>
        <article className="card metric-pill">
          <span>Low-attention alerts</span>
          <strong>{Number(overall?.low_attention_alerts || 0)}</strong>
        </article>
      </section>
    </div>
  );
}
