import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import io from "socket.io-client";

import AudioFeedbackRecorder from "../components/AudioFeedbackRecorder";
import useEmotionTracker from "../hooks/useEmotionTracker";
import { apiRequest, fetchLiveClass, fetchLiveOverallAnalytics, joinLiveClass, leaveLiveClass } from "../services/api";
import {
  getCameraSupportIssue,
  getMediaSupportSnapshot,
  getMicrophoneSupportIssue,
} from "../services/mediaSupport";
import { buildLiveRoomId, getRealtimeBaseUrl, getUserDisplayName } from "../services/realtime";
import "../styles/LiveClass.css";

function formatTime(value) {
  if (!value) {
    return "Just now";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeChatMessage(payload = {}) {
  return {
    id: String(payload.message_id || `${payload.user_id || "user"}-${payload.timestamp || Date.now()}`),
    text: String(payload.text || ""),
    username: String(payload.username || "Participant"),
    role: String(payload.role || "student"),
    timestamp: payload.timestamp || new Date().toISOString(),
    emotion: String(payload.emotion || "").trim(),
    confidence: Number(payload.confidence || 0),
    source: String(payload.source || "chat"),
  };
}

export default function StudentLiveClass({ user }) {
  const [searchParams] = useSearchParams();
  const initialSessionId = String(searchParams.get("session") || "").trim();

  const [inputSessionId, setInputSessionId] = useState(initialSessionId);
  const [liveSessionId, setLiveSessionId] = useState("");
  const [liveClass, setLiveClass] = useState(null);
  const [overall, setOverall] = useState(null);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [teacherStreaming, setTeacherStreaming] = useState(false);
  const [socketState, setSocketState] = useState("idle");
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);

  const teacherVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const cleanupSessionRef = useRef("");
  const lastEmotionSentRef = useRef("");
  const manualFaceInputRef = useRef(null);
  const autoJoinAttemptedRef = useRef(false);

  const userDisplayName = useMemo(() => getUserDisplayName(user), [user]);
  const roomId = useMemo(() => buildLiveRoomId(liveSessionId), [liveSessionId]);
  const socketUrl = useMemo(() => getRealtimeBaseUrl(), []);
  const classId = String(liveClass?.class_id || "").trim();
  const lessonId = String(liveClass?.lesson_id || (liveSessionId ? `live:${liveSessionId}` : "")).trim();
  const mediaSnapshot = getMediaSupportSnapshot();
  const cameraSupportIssue = getCameraSupportIssue(mediaSnapshot);
  const voiceSupportIssue = getMicrophoneSupportIssue(mediaSnapshot, { requireRecorder: false });
  const meetingEnded = liveClass?.status === "ended" || overall?.status === "ended";

  const emotionTracker = useEmotionTracker({
    userId: user?.id || "",
    courseId: classId || "",
    classId,
    lessonId,
    sessionId: "",
    liveSessionId,
  });

  const isJoined = Boolean(liveSessionId);

  async function refreshRoom(nextSessionId = liveSessionId) {
    if (!nextSessionId) {
      return;
    }
    setIsLoadingRoom(true);
    try {
      const [liveData, overallData] = await Promise.all([
        fetchLiveClass(nextSessionId),
        fetchLiveOverallAnalytics(nextSessionId),
      ]);
      setLiveClass(liveData || null);
      setOverall(overallData || null);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Unable to refresh the meeting room.");
    } finally {
      setIsLoadingRoom(false);
    }
  }

  function closePeerConnection() {
    if (!peerConnectionRef.current) {
      return;
    }
    peerConnectionRef.current.close();
    peerConnectionRef.current = null;
  }

  async function setupPeerConnection(teacherSid) {
    if (!teacherSid) {
      return null;
    }

    closePeerConnection();

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peerConnectionRef.current = peerConnection;

    peerConnection.ontrack = (event) => {
      if (teacherVideoRef.current) {
        teacherVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current) {
        return;
      }
      socketRef.current.emit("webrtc_ice_candidate", {
        target: teacherSid,
        candidate: event.candidate,
      });
    };

    return peerConnection;
  }

  async function handleOffer({ from, offer }) {
    const connection = peerConnectionRef.current || await setupPeerConnection(from);
    if (!connection) {
      return;
    }

    await connection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    socketRef.current?.emit("webrtc_answer", {
      target: from,
      answer,
    });

    setTeacherStreaming(true);
  }

  async function handleJoin(nextSessionId = inputSessionId) {
    const candidate = String(nextSessionId || "").trim();
    if (!candidate) {
      setMessage("Enter a live session ID.");
      return;
    }

    setIsJoining(true);
    try {
      await joinLiveClass(candidate);
      cleanupSessionRef.current = candidate;
      setLiveSessionId(candidate);
      setChatMessages([]);
      setTeacherStreaming(false);
      await refreshRoom(candidate);
      setMessage("Joined live meeting.");
    } catch (error) {
      setMessage(error.message || "Unable to join live meeting.");
    } finally {
      setIsJoining(false);
    }
  }

  async function handleLeave({ silent = false } = {}) {
    if (!cleanupSessionRef.current) {
      return;
    }

    if (!silent) {
      setIsLeaving(true);
    }

    try {
      await leaveLiveClass(cleanupSessionRef.current);
    } catch {
      // Ignore leave race during teardown.
    } finally {
      closePeerConnection();
      socketRef.current?.disconnect();
      socketRef.current = null;
      if (teacherVideoRef.current) {
        teacherVideoRef.current.srcObject = null;
      }
      emotionTracker.stopTracking({ flush: true });
      setLiveSessionId("");
      setLiveClass(null);
      setOverall(null);
      setTeacherStreaming(false);
      cleanupSessionRef.current = "";
      if (!silent) {
        setMessage("Left live meeting.");
        setIsLeaving(false);
      }
    }
  }

  async function handleEnableEmotionCamera() {
    if (!isJoined) {
      setMessage("Join the live class first.");
      return;
    }
    if (meetingEnded) {
      setMessage("This class has ended. Emotion tracking is now closed.");
      return;
    }

    if (!emotionTracker.trackingEnabled) {
      emotionTracker.setTrackingEnabled(true);
    }

    const granted = await emotionTracker.requestCameraPermission();
    if (granted) {
      emotionTracker.handleLessonPlay();
      setMessage("Emotion camera is ready.");
    }
  }

  async function handleSendChat() {
    if (!liveSessionId) {
      setMessage("Join a live class first.");
      return;
    }
    if (meetingEnded) {
      setMessage("Chat has closed because the class has ended.");
      return;
    }
    const trimmed = String(chatText || "").trim();
    if (!trimmed) {
      setMessage("Type a message first.");
      return;
    }
    if (!socketRef.current?.connected) {
      setMessage("Meeting chat is offline right now.");
      return;
    }

    setIsSendingChat(true);
    const timestamp = new Date().toISOString();
    let emotion = "";
    let confidence = 0;

    try {
      try {
        const token = localStorage.getItem("token") || "";
        const result = await apiRequest(
          "/emotions/text",
          "POST",
          {
            userId: user?.id || "",
            classId: classId || null,
            lessonId: lessonId || `live:${liveSessionId}`,
            sessionId: null,
            liveSessionId,
            text: trimmed,
            timestamp,
          },
          token
        );
        emotion = String(result?.emotion || "");
        confidence = Number(result?.confidence || 0);
        setMessage(`Message sent and tagged as ${emotion || "unknown"}.`);
      } catch (error) {
        setMessage(error.message || "Message sent without emotion tag.");
      }

      socketRef.current.emit("meeting_chat", {
        room_id: roomId,
        live_session_id: liveSessionId,
        text: trimmed,
        timestamp,
        emotion,
        confidence,
        source: "chat",
      });
      setChatText("");
    } finally {
      setIsSendingChat(false);
    }
  }

  function handleVoicePrediction(prediction) {
    socketRef.current?.emit("meeting_chat", {
      room_id: roomId,
      live_session_id: liveSessionId,
      text: "[Voice feedback shared]",
      timestamp: prediction?.timestamp || new Date().toISOString(),
      emotion: prediction?.emotion || "",
      confidence: Number(prediction?.confidence || 0),
      source: "voice",
    });
  }

  async function handleManualFaceUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    await emotionTracker.captureFaceFromImage(file);
  }

  useEffect(() => {
    if (!liveSessionId || !user?.id) {
      return undefined;
    }

    const socket = io(socketUrl, {
      transports: ["websocket"],
    });

    socketRef.current = socket;
    setSocketState("connecting");

    socket.on("connect", () => {
      setSocketState("connected");
      socket.emit("student-join", {
        sessionId: liveSessionId,
        studentId: user.id,
        name: userDisplayName,
      });
    });

    socket.on("disconnect", () => {
      setSocketState("disconnected");
    });

    socket.on("connect_error", () => {
      setSocketState("error");
    });

    socket.on("room_participants", (payload) => {
      setTeacherStreaming(Boolean(payload?.teacher_streaming));
    });

    socket.on("teacher_streaming", () => {
      setTeacherStreaming(true);
    });

    socket.on("teacher_stopped", () => {
      setTeacherStreaming(false);
      closePeerConnection();
      if (teacherVideoRef.current) {
        teacherVideoRef.current.srcObject = null;
      }
    });

    socket.on("webrtc_offer", (payload) => {
      void handleOffer(payload);
    });

    socket.on("webrtc_ice_candidate", ({ candidate }) => {
      if (!peerConnectionRef.current || !candidate) {
        return;
      }
      void peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });

    socket.on("meeting_chat", (payload) => {
      setChatMessages((current) => [normalizeChatMessage(payload), ...current].slice(0, 30));
    });

    socket.on("live_class_ended", (payload) => {
      setTeacherStreaming(false);
      closePeerConnection();
      if (teacherVideoRef.current) {
        teacherVideoRef.current.srcObject = null;
      }
      emotionTracker.stopTracking({ flush: true });
      setLiveClass((current) => (current ? {
        ...current,
        status: "ended",
        ended_at: payload?.ended_at || new Date().toISOString(),
      } : current));
      setOverall((current) => (current ? {
        ...current,
        status: "ended",
      } : current));
      setMessage("Class finished. Optional voice reflection is available below.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketState("idle");
      closePeerConnection();
    };
  }, [liveSessionId, roomId, socketUrl, user?.id, userDisplayName]);

  useEffect(() => {
    cleanupSessionRef.current = liveSessionId;
    lastEmotionSentRef.current = "";
  }, [liveSessionId]);

  useEffect(() => () => {
    if (cleanupSessionRef.current) {
      void leaveLiveClass(cleanupSessionRef.current).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!liveSessionId) {
      return undefined;
    }
    void refreshRoom(liveSessionId);
    const timer = window.setInterval(() => {
      void refreshRoom(liveSessionId);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [liveSessionId]);

  useEffect(() => {
    if (!initialSessionId || liveSessionId || isJoining || autoJoinAttemptedRef.current) {
      return;
    }
    autoJoinAttemptedRef.current = true;
    void handleJoin(initialSessionId);
  }, [initialSessionId, isJoining, liveSessionId]);

  useEffect(() => {
    if (!liveSessionId || !socketRef.current?.connected || !emotionTracker.lastEmotion) {
      return;
    }

    const nextEmotionKey = `${emotionTracker.lastEmotion}:${Number(emotionTracker.lastConfidence || 0).toFixed(3)}`;
    if (lastEmotionSentRef.current === nextEmotionKey) {
      return;
    }

    lastEmotionSentRef.current = nextEmotionKey;
    const attention = emotionTracker.faceStats?.faceDetected
      ? Math.max(0.4, Number(emotionTracker.lastConfidence || 0))
      : 0.2;
    socketRef.current.emit("emotion-update", {
      sessionId: liveSessionId,
      studentId: user?.id || "",
      name: userDisplayName,
      emotion: emotionTracker.lastEmotion,
      attention,
      confidence: Number(emotionTracker.lastConfidence || 0),
      timestamp: Date.now(),
    });
    socketRef.current.emit("student_local_emotion", {
      emotion: emotionTracker.lastEmotion,
      confidence: Number(emotionTracker.lastConfidence || 0),
      attention,
    });
  }, [emotionTracker.faceStats?.faceDetected, emotionTracker.lastConfidence, emotionTracker.lastEmotion, liveSessionId, socketState, user?.id, userDisplayName]);

  useEffect(() => {
    if (!meetingEnded) {
      return;
    }
    setTeacherStreaming(false);
    closePeerConnection();
    if (teacherVideoRef.current) {
      teacherVideoRef.current.srcObject = null;
    }
    emotionTracker.stopTracking({ flush: true });
  }, [meetingEnded]);

  return (
    <div className="meeting-page meeting-page--student">
      <section className="card meeting-hero">
        <div className="meeting-hero__grid">
          <div>
            <p className="eyebrow">Student Live Meeting</p>
            <h2>{liveClass?.title || "Join your class like a real meeting room"}</h2>
            <p className="meeting-hero__copy">
              Watch the teacher stream, send live chat and voice feedback, and keep your emotion camera active for engagement tracking.
            </p>
          </div>
          <div className="meeting-link-row">
            <Link className="dashboard-action-link" to="/student/live/insights">
              Open analytics room
            </Link>
          </div>
        </div>

        <div className="meeting-join-strip">
          <label>
            Live session ID
            <input
              placeholder="Paste session ID"
              value={inputSessionId}
              onChange={(event) => setInputSessionId(event.target.value)}
              disabled={isJoined || isJoining}
            />
          </label>

          {!isJoined ? (
            <button type="button" onClick={() => void handleJoin()} disabled={isJoining || !inputSessionId.trim()}>
              {isJoining ? "Joining..." : "Join Meeting"}
            </button>
          ) : (
            <button type="button" className="danger" onClick={() => void handleLeave()} disabled={isLeaving}>
              {isLeaving ? "Leaving..." : "Leave Meeting"}
            </button>
          )}
        </div>

        <div className="meeting-status-row">
          <span className={`meeting-status-pill ${socketState === "connected" ? "meeting-status-pill--ok" : ""}`}>
            Socket {socketState}
          </span>
          <span className={`meeting-status-pill ${meetingEnded ? "meeting-status-pill--ended" : ""}`}>
            {meetingEnded ? "Class ended" : "Class active"}
          </span>
          <span className={`meeting-status-pill ${teacherStreaming ? "meeting-status-pill--live" : ""}`}>
            Teacher {teacherStreaming ? "live" : "offline"}
          </span>
          <span className="meeting-status-pill">
            Students {Number(overall?.active_students_count || 0)}
          </span>
          <span className="meeting-status-pill">
            Dominant emotion {overall?.dominant_emotion || "unknown"}
          </span>
        </div>

        {meetingEnded && (
          <div className="meeting-end-banner">
            <strong>Class finished</strong>
            <p>You can review the final room state and optionally submit a short voice reflection before leaving.</p>
          </div>
        )}
        {message && <div className="inline-message inline-message-soft">{message}</div>}
      </section>

      <section className="meeting-metric-grid">
        <article className="card meeting-metric">
          <span>Low attention alerts</span>
          <strong>{Number(overall?.low_attention_alerts || 0)}</strong>
        </article>
        <article className="card meeting-metric">
          <span>My latest emotion</span>
          <strong>{emotionTracker.lastEmotion || "waiting"}</strong>
        </article>
        <article className="card meeting-metric">
          <span>Face events sent</span>
          <strong>{emotionTracker.faceEventsSent}</strong>
        </article>
        <article className="card meeting-metric">
          <span>Room refresh</span>
          <strong>{isLoadingRoom ? "Updating..." : "Live"}</strong>
        </article>
      </section>

      <div className="meeting-layout">
        <section className="card meeting-stage">
          <div className="meeting-stage__header">
            <div>
              <p className="eyebrow">Teacher Stage</p>
              <h3>{liveClass?.title || "Live class stream"}</h3>
            </div>
            <span className="meeting-room-chip">
              {meetingEnded ? "Session complete" : (teacherStreaming ? "Broadcast live" : "Waiting for teacher")}
            </span>
          </div>

          <div className="meeting-setup-grid">
            <article className="meeting-setup-card">
              <span>Join step</span>
              <strong>{isJoined ? "Connected" : "Join with code"}</strong>
              <p>Enter the session ID from your teacher, then the room will load automatically.</p>
            </article>
            <article className="meeting-setup-card">
              <span>Emotion camera</span>
              <strong>{cameraSupportIssue ? "Needs attention" : (emotionTracker.cameraState === "on" ? "Ready" : "Allow camera")}</strong>
              <p>{cameraSupportIssue || "Turn on your front camera so EmotiSense can read facial expression signals during class."}</p>
            </article>
            <article className="meeting-setup-card">
              <span>Feedback flow</span>
              <strong>{meetingEnded ? "Reflection open" : "Opens after class"}</strong>
              <p>Text chat is analyzed live. Optional voice reflection is unlocked when the class ends.</p>
            </article>
          </div>

          <div className="meeting-stage__screen">
            <video ref={teacherVideoRef} autoPlay playsInline className="meeting-stage__video" />
            {!teacherStreaming && (
              <div className="meeting-stage__empty">
                <strong>{meetingEnded ? "This class has ended" : "Waiting for the teacher to start the stream"}</strong>
                <p>
                  {meetingEnded
                    ? "You can still send an optional voice reflection below before leaving the room."
                    : "Stay in the room. The video will appear as soon as class begins."}
                </p>
              </div>
            )}
          </div>

          <div className="meeting-toolbar meeting-toolbar--student">
            <button
              type="button"
              className="meeting-control-btn"
              onClick={() => void handleEnableEmotionCamera()}
              disabled={!isJoined || meetingEnded}
            >
              {emotionTracker.trackingEnabled ? "Refresh Emotion Camera" : "Enable Emotion Camera"}
            </button>
            <button
              type="button"
              className={`meeting-control-btn ${emotionTracker.trackingEnabled ? "meeting-control-btn--muted" : ""}`}
              onClick={emotionTracker.toggleTracking}
              disabled={!isJoined || meetingEnded}
            >
              {emotionTracker.trackingEnabled ? "Pause Emotion Tracking" : "Arm Tracking"}
            </button>
            <button
              type="button"
              className="meeting-control-btn"
              onClick={() => manualFaceInputRef.current?.click()}
              disabled={!isJoined || meetingEnded || emotionTracker.isAnalyzingFaceImage}
            >
              {emotionTracker.isAnalyzingFaceImage ? "Analyzing..." : "Upload Selfie"}
            </button>
          </div>
        </section>

        <aside className="meeting-side">
          <article className="card meeting-panel">
            <div className="meeting-panel__header">
              <h3>Your Camera</h3>
              <span>{emotionTracker.cameraState === "on" ? "Ready" : "Off"}</span>
            </div>
            <div className="meeting-self-view">
              <video
                ref={emotionTracker.webcamRef}
                autoPlay
                muted
                playsInline
                className={emotionTracker.showCameraPreview ? "meeting-self-view__video" : "meeting-self-view__video webcam-video-hidden"}
              />
              {!emotionTracker.showCameraPreview && (
                <div className="meeting-stage__empty meeting-stage__empty--compact">
                  <strong>Preview hidden</strong>
                  <p>Tracking can continue while your self-view stays private.</p>
                </div>
              )}
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={emotionTracker.showCameraPreview}
                onChange={(event) => emotionTracker.setShowCameraPreview(event.target.checked)}
                disabled={meetingEnded}
              />
              Show self preview
            </label>
            <p className="small-note">
              Face {emotionTracker.faceDetectionState} | Queue {emotionTracker.queueSize} | Last emotion {emotionTracker.lastEmotion || "waiting"}
            </p>
            {cameraSupportIssue && (
              <div className="inline-message inline-message-soft">{cameraSupportIssue}</div>
            )}
            {emotionTracker.cameraSupportIssue && (
              <div className="inline-message inline-message-soft">{emotionTracker.cameraSupportIssue}</div>
            )}
            {emotionTracker.flushError && <p className="small-note">Retry pending: {emotionTracker.flushError}</p>}
            <input
              ref={manualFaceInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="media-file-input"
              onChange={(event) => {
                void handleManualFaceUpload(event);
              }}
            />
          </article>

          <article className="card meeting-panel">
            <div className="meeting-panel__header">
              <h3>Meeting Chat</h3>
              <span>{chatMessages.length} items</span>
            </div>
            <div className="meeting-chat-form">
              <textarea
                className="notes-textarea notes-textarea--compact"
                placeholder="Send a chat message..."
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                disabled={!isJoined || meetingEnded}
              />
              <button
                type="button"
                onClick={() => void handleSendChat()}
                disabled={!isJoined || isSendingChat || meetingEnded}
              >
                {isSendingChat ? "Sending..." : "Send Message"}
              </button>
            </div>
            <div className="meeting-chat-list">
              {chatMessages.length === 0 && <p className="small-note">No messages yet.</p>}
              {chatMessages.map((entry) => (
                <article key={entry.id} className={`meeting-chat-bubble ${entry.username === userDisplayName ? "meeting-chat-bubble--self" : ""}`}>
                  <div className="meeting-chat-bubble__meta">
                    <strong>{entry.username}</strong>
                    <span>{formatTime(entry.timestamp)}</span>
                  </div>
                  <p>{entry.text}</p>
                  {(entry.emotion || entry.source !== "chat") && (
                    <div className="meeting-chat-bubble__tags">
                      {entry.emotion && (
                        <span className={`emotion-tag emotion-tag--${entry.emotion}`}>
                          {entry.emotion} {entry.confidence ? entry.confidence.toFixed(2) : ""}
                        </span>
                      )}
                      {entry.source !== "chat" && <span className="meeting-room-chip">{entry.source}</span>}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </article>

          <article className="card meeting-panel">
            <div className="meeting-panel__header">
              <h3>Voice Feedback</h3>
              <span>{meetingEnded ? "Optional reflection" : "Opens after class"}</span>
            </div>
            {meetingEnded ? (
              <>
                <p className="small-note">
                  Share a final 10-30 second reflection. EmotiSense will analyze the voice feedback and attach it to this finished session.
                </p>
                {voiceSupportIssue && (
                  <div className="inline-message inline-message-soft">{voiceSupportIssue}</div>
                )}
                <AudioFeedbackRecorder
                  userId={user?.id || ""}
                  courseId=""
                  classId={classId}
                  lessonId={lessonId}
                  sessionId=""
                  liveSessionId={liveSessionId}
                  onPrediction={handleVoicePrediction}
                  onStatusMessage={setMessage}
                />
              </>
            ) : (
              <div className="meeting-end-banner meeting-end-banner--neutral">
                <strong>Voice reflection unlocks when class ends</strong>
                <p>Stay in the room during class for live video, emotion camera, and chat analysis. When the teacher ends the session, you can optionally record a short voice reflection here.</p>
              </div>
            )}
          </article>
        </aside>
      </div>
    </div>
  );
}
