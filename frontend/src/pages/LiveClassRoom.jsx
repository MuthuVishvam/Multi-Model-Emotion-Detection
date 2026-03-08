import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import AudioFeedbackRecorder from "../components/AudioFeedbackRecorder";
import {
  apiRequest,
  fetchLiveClass,
  fetchLiveOverallAnalytics,
  joinLiveClass,
  leaveLiveClass,
} from "../services/api";
import useAttentionTracker from "../hooks/useAttentionTracker";
import useEmotionTracker from "../hooks/useEmotionTracker";

function safeUserId(user) {
  return user?.id || user?.email || "";
}

export default function LiveClassRoom({ user }) {
  const [searchParams] = useSearchParams();
  const initialSessionId = String(searchParams.get("session") || "").trim();

  const [inputSessionId, setInputSessionId] = useState(initialSessionId);
  const [liveSessionId, setLiveSessionId] = useState("");
  const [liveClass, setLiveClass] = useState(null);
  const [overall, setOverall] = useState(null);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isLoadingOverall, setIsLoadingOverall] = useState(false);
  const [liveWatchSeconds, setLiveWatchSeconds] = useState(0);
  const [isLiveStarted, setIsLiveStarted] = useState(false);
  const leaveInCleanupRef = useRef(false);

  const isJoined = Boolean(liveSessionId);
  const userId = safeUserId(user);
  const lessonId = (liveClass?.lesson_id || (liveSessionId ? `live:${liveSessionId}` : "")).trim();
  const classId = (liveClass?.class_id || "").trim();

  const emotionTracker = useEmotionTracker({
    userId,
    courseId: classId || "",
    classId,
    lessonId,
    sessionId: "",
    liveSessionId: liveSessionId || "",
  });

  const attentionStats = useMemo(
    () => ({
      ...(emotionTracker.faceStats || {}),
      userId,
      isPlaying: Boolean(isJoined && isLiveStarted),
      tabVisible: !document.hidden,
      watchedSeconds: liveWatchSeconds,
    }),
    [emotionTracker.faceStats, userId, isJoined, isLiveStarted, liveWatchSeconds]
  );
  const attentionTracker = useAttentionTracker("", lessonId, attentionStats, { liveSessionId });

  async function refreshLiveContext(nextSessionId = liveSessionId) {
    if (!nextSessionId) {
      return;
    }
    setIsLoadingOverall(true);
    try {
      const [liveMeta, overallData] = await Promise.all([
        fetchLiveClass(nextSessionId),
        fetchLiveOverallAnalytics(nextSessionId),
      ]);
      setLiveClass(liveMeta || null);
      setOverall(overallData || null);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Unable to refresh live class status.");
    } finally {
      setIsLoadingOverall(false);
    }
  }

  async function handleJoin() {
    const candidate = String(inputSessionId || "").trim();
    if (!candidate) {
      setMessage("Enter a live session ID.");
      return;
    }
    setIsJoining(true);
    try {
      await joinLiveClass(candidate);
      setLiveSessionId(candidate);
      setLiveWatchSeconds(0);
      setIsLiveStarted(false);
      await refreshLiveContext(candidate);
      setMessage("Joined live class.");
    } catch (error) {
      setMessage(error.message || "Unable to join live class.");
    } finally {
      setIsJoining(false);
    }
  }

  async function handleLeave({ silent = false } = {}) {
    if (!liveSessionId) {
      return;
    }
    if (!silent) {
      setIsLeaving(true);
    }
    try {
      await leaveLiveClass(liveSessionId);
    } catch {
      // Ignore leave race errors during unmount.
    } finally {
      setLiveSessionId("");
      setLiveClass(null);
      setOverall(null);
      setIsLiveStarted(false);
      setLiveWatchSeconds(0);
      emotionTracker.stopTracking({ flush: true });
      if (!silent) {
        setIsLeaving(false);
        setMessage("Left live class.");
      }
    }
  }

  function handleStartLive() {
    setIsLiveStarted(true);
    emotionTracker.handleLessonPlay();
    if (!emotionTracker.trackingEnabled) {
      emotionTracker.setTrackingEnabled(true);
    }
  }

  async function handleSendChat() {
    if (!liveSessionId) {
      setMessage("Join a live class first.");
      return;
    }
    const trimmed = String(chatText || "").trim();
    if (!trimmed) {
      setMessage("Type a chat message first.");
      return;
    }

    setIsSendingChat(true);
    try {
      const token = localStorage.getItem("token") || "";
      const timestamp = new Date().toISOString();
      const response = await apiRequest(
        "/emotions/text",
        "POST",
        {
          userId,
          classId: classId || null,
          lessonId: lessonId || `live:${liveSessionId}`,
          sessionId: null,
          liveSessionId,
          text: trimmed,
          timestamp,
        },
        token
      );
      setChatMessages((current) => [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          text: trimmed,
          emotion: response?.emotion || "unknown",
          confidence: Number(response?.confidence || 0),
          timestamp,
          source: "text",
        },
        ...current,
      ]);
      setChatText("");
      setMessage(`Chat tagged as ${response?.emotion || "unknown"}.`);
    } catch (error) {
      setMessage(error.message || "Unable to send chat.");
    } finally {
      setIsSendingChat(false);
    }
  }

  function handleVoicePrediction(prediction) {
    setChatMessages((current) => [
      {
        id: `voice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        text: "[Voice feedback recording]",
        emotion: prediction?.emotion || "unknown",
        confidence: Number(prediction?.confidence || 0),
        timestamp: prediction?.timestamp || new Date().toISOString(),
        source: "voice",
      },
      ...current,
    ]);
  }

  useEffect(() => {
    if (!isJoined || !isLiveStarted) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        setLiveWatchSeconds((current) => current + 1);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isJoined, isLiveStarted]);

  useEffect(() => {
    if (!isJoined) {
      return undefined;
    }
    void refreshLiveContext(liveSessionId);
    const timer = window.setInterval(() => {
      void refreshLiveContext(liveSessionId);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [isJoined, liveSessionId]);

  useEffect(() => {
    leaveInCleanupRef.current = isJoined;
  }, [isJoined]);

  useEffect(() => () => {
    if (leaveInCleanupRef.current && liveSessionId) {
      void leaveLiveClass(liveSessionId).catch(() => {});
    }
  }, [liveSessionId]);

  return (
    <div className="learning-page live-room-page">
      <section className="card live-room-header">
        <p className="eyebrow">Student Live Class</p>
        <h2>Live Class Room</h2>
        <p className="small-note">Join with session ID, enable camera tracking, and send live text/voice feedback.</p>

        <div className="live-room-join">
          <input
            placeholder="Enter live session ID"
            value={inputSessionId}
            onChange={(event) => setInputSessionId(event.target.value)}
            disabled={isJoined || isJoining}
          />
          {!isJoined ? (
            <button type="button" onClick={handleJoin} disabled={isJoining || !inputSessionId.trim()}>
              {isJoining ? "Joining..." : "Join Live Class"}
            </button>
          ) : (
            <button type="button" className="danger" onClick={() => void handleLeave()} disabled={isLeaving}>
              {isLeaving ? "Leaving..." : "Leave Live Class"}
            </button>
          )}
        </div>

        {message && <div className="inline-message inline-message-soft">{message}</div>}
      </section>

      <section className="live-room-metrics">
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
        <article className="card metric-pill">
          <span>Attention state</span>
          <strong>{attentionTracker.lastState}</strong>
        </article>
      </section>

      <section className="live-room-layout">
        <article className="card live-room-main">
          <h3>Live Tracking</h3>
          <div className="status-badge-row">
            <span className={emotionTracker.cameraState === "on" ? "tracking-indicator tracking-indicator-on" : "tracking-indicator"}>
              Camera: {emotionTracker.cameraState === "on" ? "On" : "Off"}
            </span>
            <span className={emotionTracker.faceDetectionState === "running" ? "tracking-indicator tracking-indicator-on" : "tracking-indicator"}>
              Face: {emotionTracker.faceDetectionState === "running" ? "Detected" : "Not detected"}
            </span>
            <span className={attentionTracker.trackingOn ? "tracking-indicator tracking-indicator-on" : "tracking-indicator"}>
              Attention stream: {attentionTracker.trackingOn ? "On" : "Off"}
            </span>
          </div>

          <div className="live-room-actions">
            <button type="button" onClick={handleStartLive} disabled={!isJoined || isLiveStarted}>
              {isLiveStarted ? "Live Running" : "Start Live Tracking"}
            </button>
            <button
              type="button"
              className={emotionTracker.trackingEnabled ? "secondary" : ""}
              onClick={emotionTracker.toggleTracking}
              disabled={!isJoined}
            >
              {emotionTracker.trackingEnabled ? "Stop Camera Emotion" : "Enable Camera Emotion"}
            </button>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={emotionTracker.showCameraPreview}
                onChange={(event) => emotionTracker.setShowCameraPreview(event.target.checked)}
              />
              Show webcam preview
            </label>
          </div>

          <div className="camera-preview-card">
            <video
              className={emotionTracker.showCameraPreview ? "webcam-video" : "webcam-video webcam-video-hidden"}
              ref={emotionTracker.webcamRef}
              autoPlay
              muted
              playsInline
            />
            {!emotionTracker.showCameraPreview && (
              <div className="privacy-placeholder">
                Camera preview hidden while tracking remains active.
              </div>
            )}
          </div>

          <p className="small-note">
            Face events buffered: {emotionTracker.queueSize} | Sent: {emotionTracker.faceEventsSent} | Watch time: {liveWatchSeconds}s
          </p>
          {emotionTracker.flushError && <p className="small-note">Face batch retry: {emotionTracker.flushError}</p>}
          {attentionTracker.lastFlushError && <p className="small-note">Attention batch retry: {attentionTracker.lastFlushError}</p>}
          {isLoadingOverall && <p className="small-note">Refreshing live analytics...</p>}
        </article>

        <article className="card live-room-chat">
          <h3>Live Chat + Voice Feedback</h3>
          <label>Message</label>
          <textarea
            className="notes-textarea notes-textarea--compact"
            placeholder="Type your live feedback..."
            value={chatText}
            onChange={(event) => setChatText(event.target.value)}
            disabled={!isJoined}
          />
          <button type="button" onClick={handleSendChat} disabled={!isJoined || isSendingChat}>
            {isSendingChat ? "Sending..." : "Send Chat"}
          </button>

          <AudioFeedbackRecorder
            userId={userId}
            courseId=""
            classId={classId}
            lessonId={lessonId}
            sessionId=""
            liveSessionId={liveSessionId}
            onPrediction={handleVoicePrediction}
            onStatusMessage={setMessage}
          />

          <div className="discussion-thread">
            {chatMessages.length === 0 && <p className="small-note">No chat or voice entries yet.</p>}
            {chatMessages.map((entry) => (
              <article key={entry.id} className="discussion-message">
                <div className="discussion-message__row">
                  <p>{entry.text}</p>
                  <span className={`emotion-tag emotion-tag--${entry.emotion}`}>
                    {entry.emotion} {Number(entry.confidence || 0).toFixed(2)}
                  </span>
                </div>
                <p className="small-note">{new Date(entry.timestamp).toLocaleTimeString()} | {entry.source}</p>
              </article>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
