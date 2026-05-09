import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";

import { endLiveClass, fetchLiveClass, fetchLiveOverallAnalytics, joinLiveClass, leaveLiveClass } from "../services/api";
import {
  getCameraSupportIssue,
  getMediaSupportSnapshot,
  getMicrophoneSupportIssue,
} from "../services/mediaSupport";
import { buildLiveRoomId, getRealtimeBaseUrl, getUserDisplayName } from "../services/realtime";
import "../styles/LiveClass.css";

function upsertParticipant(list, candidate) {
  const nextCandidate = {
    sid: String(candidate?.sid || ""),
    username: String(candidate?.username || "Student"),
    role: String(candidate?.role || "student"),
  };
  if (!nextCandidate.sid) {
    return list;
  }
  const filtered = list.filter((item) => item.sid !== nextCandidate.sid);
  return [...filtered, nextCandidate];
}

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

export default function TeacherLiveClass({ user }) {
  const navigate = useNavigate();
  const { liveSessionId } = useParams();

  const [liveClass, setLiveClass] = useState(null);
  const [overall, setOverall] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentEmotions, setStudentEmotions] = useState({});
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [socketState, setSocketState] = useState("connecting");
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isEnding, setIsEnding] = useState(false);

  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const shouldLeaveRef = useRef(false);
  const streamingRef = useRef(false);

  const roomId = useMemo(() => buildLiveRoomId(liveSessionId), [liveSessionId]);
  const socketUrl = useMemo(() => getRealtimeBaseUrl(), []);
  const userDisplayName = useMemo(() => getUserDisplayName(user), [user]);
  const activeEmotionCount = Object.keys(studentEmotions).length;
  const mediaSnapshot = getMediaSupportSnapshot();
  const cameraSupportIssue = getCameraSupportIssue(mediaSnapshot);
  const microphoneSupportIssue = getMicrophoneSupportIssue(mediaSnapshot, { requireRecorder: false });
  const meetingEnded = liveClass?.status === "ended" || overall?.status === "ended";

  async function refreshRoom() {
    if (!liveSessionId) {
      return;
    }
    setIsLoading(true);
    try {
      const [liveData, overallData] = await Promise.all([
        fetchLiveClass(liveSessionId),
        fetchLiveOverallAnalytics(liveSessionId),
      ]);
      setLiveClass(liveData || null);
      setOverall(overallData || null);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Unable to load the meeting room.");
    } finally {
      setIsLoading(false);
    }
  }

  function closePeerConnection(studentSid) {
    const connection = peerConnectionsRef.current[studentSid];
    if (!connection) {
      return;
    }
    connection.close();
    delete peerConnectionsRef.current[studentSid];
  }

  function closeAllPeerConnections() {
    Object.keys(peerConnectionsRef.current).forEach((studentSid) => {
      closePeerConnection(studentSid);
    });
  }

  async function createPeerConnection(studentSid) {
    if (!localStreamRef.current || !studentSid) {
      return;
    }

    closePeerConnection(studentSid);

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peerConnectionsRef.current[studentSid] = peerConnection;

    localStreamRef.current.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current);
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current) {
        return;
      }
      socketRef.current.emit("webrtc_ice_candidate", {
        target: studentSid,
        candidate: event.candidate,
      });
    };

    peerConnection.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(peerConnection.connectionState)) {
        closePeerConnection(studentSid);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socketRef.current?.emit("webrtc_offer", {
      target: studentSid,
      offer,
    });
  }

  async function handleAnswer({ from, answer }) {
    const connection = peerConnectionsRef.current[from];
    if (!connection) {
      return;
    }
    await connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function handleIceCandidate({ from, candidate }) {
    const connection = peerConnectionsRef.current[from];
    if (!connection || !candidate) {
      return;
    }
    await connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async function handleStartStreaming() {
    if (meetingEnded) {
      setMessage("This live class has already ended.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsMicEnabled(true);
      setIsCameraEnabled(true);
      streamingRef.current = true;
      setIsStreaming(true);
      socketRef.current?.emit("start_streaming", {});

      students.forEach((student) => {
        void createPeerConnection(student.sid);
      });

      setMessage("Meeting stream is live.");
    } catch (error) {
      setMessage(error?.message || "Unable to access camera or microphone.");
    }
  }

  function handleStopStreaming() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    closeAllPeerConnections();
    socketRef.current?.emit("stop_streaming", {});
    streamingRef.current = false;
    setIsStreaming(false);
    setIsMicEnabled(false);
    setIsCameraEnabled(false);
    setMessage("Meeting stream stopped.");
  }

  function toggleTrack(kind) {
    if (!localStreamRef.current) {
      return;
    }

    const tracks = kind === "audio"
      ? localStreamRef.current.getAudioTracks()
      : localStreamRef.current.getVideoTracks();

    if (tracks.length === 0) {
      return;
    }

    const nextEnabled = !tracks[0].enabled;
    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });

    if (kind === "audio") {
      setIsMicEnabled(nextEnabled);
      setMessage(nextEnabled ? "Microphone unmuted." : "Microphone muted.");
      return;
    }

    setIsCameraEnabled(nextEnabled);
    setMessage(nextEnabled ? "Camera enabled." : "Camera paused.");
  }

  async function handleSendChat() {
    if (meetingEnded) {
      setMessage("This class has ended. Chat is now read-only.");
      return;
    }
    const trimmed = String(chatText || "").trim();
    if (!trimmed) {
      setMessage("Type a message first.");
      return;
    }
    if (!socketRef.current?.connected) {
      setMessage("Meeting chat is offline. Reconnect and try again.");
      return;
    }

    socketRef.current.emit("meeting_chat", {
      room_id: roomId,
      live_session_id: liveSessionId,
      text: trimmed,
      timestamp: new Date().toISOString(),
      source: "chat",
    });
    setChatText("");
  }

  async function handleCopyJoinLink() {
    if (!liveSessionId) {
      return;
    }
    const joinUrl = `${window.location.origin}/student/live?session=${encodeURIComponent(liveSessionId)}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setMessage("Student join link copied.");
    } catch {
      setMessage("Unable to copy the join link.");
    }
  }

  async function handleEndMeeting() {
    if (!liveSessionId) {
      return;
    }

    setIsEnding(true);
    try {
      await endLiveClass(liveSessionId);
      socketRef.current?.emit("live_class_ended", {
        live_session_id: liveSessionId,
        ended_at: new Date().toISOString(),
      });
      handleStopStreaming();
      shouldLeaveRef.current = false;
      setMessage("Live class ended.");
      navigate(`/teacher/live/dashboard/${liveSessionId}`, { replace: true });
    } catch (error) {
      setMessage(error.message || "Unable to end live class.");
    } finally {
      setIsEnding(false);
    }
  }

  useEffect(() => {
    if (!liveSessionId || !user?.id) {
      return undefined;
    }

    shouldLeaveRef.current = true;

    void joinLiveClass(liveSessionId).catch(() => {});
    void refreshRoom();

    const socket = io(socketUrl, {
      transports: ["websocket"],
    });

    socketRef.current = socket;
    setSocketState("connecting");

    socket.on("connect", () => {
      setSocketState("connected");
      socket.emit("join_room", {
        room_id: roomId,
        live_session_id: liveSessionId,
        user_id: user.id,
        role: "teacher",
        username: userDisplayName,
      });
    });

    socket.on("disconnect", () => {
      setSocketState("disconnected");
    });

    socket.on("connect_error", () => {
      setSocketState("error");
    });

    socket.on("room_participants", (payload) => {
      const nextStudents = Array.isArray(payload?.participants)
        ? payload.participants.filter((item) => item.role === "student")
        : [];
      setStudents(nextStudents);
      if (payload?.teacher_streaming) {
        streamingRef.current = true;
        setIsStreaming(true);
      }
    });

    socket.on("student_joined", (payload) => {
      setStudents((current) => upsertParticipant(current, { ...payload, role: "student" }));
      if (streamingRef.current && localStreamRef.current) {
        void createPeerConnection(payload.sid);
      }
    });

    socket.on("user_left", ({ sid }) => {
      setStudents((current) => current.filter((item) => item.sid !== sid));
      setStudentEmotions((current) => {
        const next = { ...current };
        delete next[sid];
        return next;
      });
      closePeerConnection(sid);
    });

    socket.on("webrtc_answer", (payload) => {
      void handleAnswer(payload);
    });

    socket.on("webrtc_ice_candidate", (payload) => {
      void handleIceCandidate(payload);
    });

    socket.on("student_emotion", (payload) => {
      setStudentEmotions((current) => ({
        ...current,
        [payload.student_sid]: {
          emotion: payload.emotion,
          confidence: Number(payload.confidence || 0),
          username: payload.student_username,
        },
      }));
    });

    socket.on("meeting_chat", (payload) => {
      setChatMessages((current) => [normalizeChatMessage(payload), ...current].slice(0, 30));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      closeAllPeerConnections();
      handleStopStreaming();
      if (shouldLeaveRef.current) {
        void leaveLiveClass(liveSessionId).catch(() => {});
      }
    };
  }, [liveSessionId, roomId, socketUrl, user?.id, userDisplayName]);

  useEffect(() => {
    if (!liveSessionId) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void refreshRoom();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [liveSessionId]);

  return (
    <div className="meeting-page meeting-page--teacher">
      <section className="card meeting-hero">
        <div className="meeting-hero__grid">
          <div>
            <p className="eyebrow">Teacher Meeting Room</p>
            <h2>{liveClass?.title || "Live class meeting room"}</h2>
            <p className="meeting-hero__copy">
              Stream your class, keep an eye on participant emotion signals, and manage the session from one focused room.
            </p>
          </div>
          <div className="meeting-link-row">
            <button type="button" className="secondary" onClick={() => navigate("/teacher/live/control")}>
              Back to Control
            </button>
            <button type="button" className="secondary" onClick={() => navigate(`/teacher/live/dashboard/${liveSessionId}`)}>
              Open Dashboard
            </button>
            <button type="button" className="secondary" onClick={() => void handleCopyJoinLink()}>
              Copy Student Join Link
            </button>
            <button type="button" className="danger" onClick={() => void handleEndMeeting()} disabled={isEnding}>
              {isEnding ? "Ending..." : "End Meeting"}
            </button>
          </div>
        </div>

        <div className="meeting-status-row">
          <span className="meeting-status-pill">Session {liveSessionId}</span>
          <span className={`meeting-status-pill ${socketState === "connected" ? "meeting-status-pill--ok" : ""}`}>
            Socket {socketState}
          </span>
          <span className={`meeting-status-pill ${meetingEnded ? "meeting-status-pill--ended" : ""}`}>
            {meetingEnded ? "Class ended" : "Class active"}
          </span>
          <span className={`meeting-status-pill ${isStreaming ? "meeting-status-pill--live" : ""}`}>
            {isStreaming ? "Broadcasting live" : "Not broadcasting"}
          </span>
          <span className="meeting-status-pill">
            Active students {Number(overall?.active_students_count || students.length)}
          </span>
        </div>

        {meetingEnded && (
          <div className="meeting-end-banner">
            <strong>Class finished</strong>
            <p>Your live analytics summary is ready. Students can now leave the room or submit optional post-class voice reflections.</p>
          </div>
        )}
        {(cameraSupportIssue || microphoneSupportIssue) && !meetingEnded && (
          <div className="meeting-end-banner meeting-end-banner--neutral">
            <strong>Media setup guidance</strong>
            <p>{cameraSupportIssue || microphoneSupportIssue}</p>
          </div>
        )}
        {message && <div className="inline-message inline-message-soft">{message}</div>}
      </section>

      <section className="meeting-metric-grid">
        <article className="card meeting-metric">
          <span>Students in room</span>
          <strong>{students.length}</strong>
        </article>
        <article className="card meeting-metric">
          <span>Dominant emotion</span>
          <strong>{overall?.dominant_emotion || "unknown"}</strong>
        </article>
        <article className="card meeting-metric">
          <span>Low attention alerts</span>
          <strong>{Number(overall?.low_attention_alerts || 0)}</strong>
        </article>
        <article className="card meeting-metric">
          <span>Emotion pings live</span>
          <strong>{activeEmotionCount}</strong>
        </article>
      </section>

      <div className="meeting-layout">
        <section className="card meeting-stage">
          <div className="meeting-stage__header">
            <div>
              <p className="eyebrow">Main Stage</p>
              <h3>You are presenting</h3>
            </div>
            <span className="meeting-room-chip">{isLoading ? "Syncing room..." : `Started ${formatTime(liveClass?.started_at)}`}</span>
          </div>

          <div className="meeting-setup-grid">
            <article className="meeting-setup-card">
              <span>Camera</span>
              <strong>{cameraSupportIssue ? "Needs attention" : (isStreaming && isCameraEnabled ? "Live" : "Ready")}</strong>
              <p>{cameraSupportIssue || "Start the session to broadcast your video feed to students."}</p>
            </article>
            <article className="meeting-setup-card">
              <span>Microphone</span>
              <strong>{microphoneSupportIssue ? "Needs attention" : (isStreaming && isMicEnabled ? "Live" : "Ready")}</strong>
              <p>{microphoneSupportIssue || "Your meeting audio is sent through the same teacher broadcast."}</p>
            </article>
            <article className="meeting-setup-card">
              <span>Student flow</span>
              <strong>{students.length > 0 ? "Students connected" : "Waiting"}</strong>
              <p>Students can join by link, enable their emotion camera, chat live, and submit optional reflections after class.</p>
            </article>
          </div>

          <div className="meeting-stage__screen">
            <video ref={localVideoRef} autoPlay muted playsInline className="meeting-stage__video" />
            {!isStreaming && (
              <div className="meeting-stage__empty">
                <strong>Camera feed is offline</strong>
                <p>Start camera and microphone when you are ready to present the class.</p>
              </div>
            )}
            <div className="meeting-stage__overlay">
              <span>{userDisplayName}</span>
              <span>{isStreaming ? "Live" : "Standby"}</span>
            </div>
          </div>

          <div className="meeting-toolbar">
            {!isStreaming ? (
              <button
                type="button"
                className="meeting-control-btn"
                onClick={() => void handleStartStreaming()}
                disabled={meetingEnded}
              >
                Start Camera & Mic
              </button>
            ) : (
              <button
                type="button"
                className="meeting-control-btn meeting-control-btn--danger"
                onClick={handleStopStreaming}
                disabled={meetingEnded}
              >
                Stop Broadcast
              </button>
            )}
            <button
              type="button"
              className={`meeting-control-btn ${isMicEnabled ? "" : "meeting-control-btn--muted"}`}
              onClick={() => toggleTrack("audio")}
              disabled={!isStreaming || meetingEnded}
            >
              {isMicEnabled ? "Mute Mic" : "Unmute Mic"}
            </button>
            <button
              type="button"
              className={`meeting-control-btn ${isCameraEnabled ? "" : "meeting-control-btn--muted"}`}
              onClick={() => toggleTrack("video")}
              disabled={!isStreaming || meetingEnded}
            >
              {isCameraEnabled ? "Pause Camera" : "Resume Camera"}
            </button>
          </div>
        </section>

        <aside className="meeting-side">
          <article className="card meeting-panel">
            <div className="meeting-panel__header">
              <h3>Participants</h3>
              <span>{students.length} students</span>
            </div>
            <div className="meeting-roster">
              {students.length === 0 && (
                <div className="meeting-roster-card meeting-roster-card--empty">
                  <strong>No students yet</strong>
                  <p>Share the join link or session ID to bring learners into the room.</p>
                </div>
              )}
              {students.map((student) => {
                const emotion = studentEmotions[student.sid];
                return (
                  <article key={student.sid} className="meeting-roster-card">
                    <div className="meeting-roster-card__header">
                      <strong>{student.username}</strong>
                      <span className="meeting-presence-dot" />
                    </div>
                    <p className="small-note">
                      {emotion
                        ? `Live emotion: ${emotion.emotion} (${(emotion.confidence * 100).toFixed(0)}%)`
                        : "Waiting for emotion signal"}
                    </p>
                    {emotion && (
                      <span className={`emotion-tag emotion-tag--${emotion.emotion}`}>
                        {emotion.emotion} {emotion.confidence.toFixed(2)}
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          </article>

          <article className="card meeting-panel">
            <div className="meeting-panel__header">
              <h3>Meeting Chat</h3>
              <span>{chatMessages.length} updates</span>
            </div>

            <div className="meeting-chat-form">
              <textarea
                className="notes-textarea notes-textarea--compact"
                placeholder="Send a message to everyone in the room..."
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
              />
              <button type="button" onClick={() => void handleSendChat()}>
                Send Message
              </button>
            </div>

            <div className="meeting-chat-list">
              {chatMessages.length === 0 && <p className="small-note">No messages yet.</p>}
              {chatMessages.map((entry) => (
                <article key={entry.id} className={`meeting-chat-bubble ${entry.role === "teacher" ? "meeting-chat-bubble--self" : ""}`}>
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
        </aside>
      </div>
    </div>
  );
}
