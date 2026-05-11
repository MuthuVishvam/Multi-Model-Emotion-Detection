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

function upsertParticipant(list, candidate) {
  const nextCandidate = {
    sid: String(candidate?.sid || ""),
    username: String(candidate?.username || "Student"),
    role: String(candidate?.role || "student"),
  };
  if (!nextCandidate.sid) return list;
  const filtered = list.filter((item) => item.sid !== nextCandidate.sid);
  return [...filtered, nextCandidate];
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [showChatPane, setShowChatPane] = useState(false);
  const [showParticipantsPane, setShowParticipantsPane] = useState(true);

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
    if (!liveSessionId) return;
    try {
      const [liveData, overallData] = await Promise.all([
        fetchLiveClass(liveSessionId),
        fetchLiveOverallAnalytics(liveSessionId),
      ]);
      setLiveClass(liveData || null);
      setOverall(overallData || null);
    } catch (error) {
      console.error(error);
    }
  }

  function closePeerConnection(studentSid) {
    const connection = peerConnectionsRef.current[studentSid];
    if (!connection) return;
    connection.close();
    delete peerConnectionsRef.current[studentSid];
  }

  function closeAllPeerConnections() {
    Object.keys(peerConnectionsRef.current).forEach(closePeerConnection);
  }

  async function createPeerConnection(studentSid) {
    if (!localStreamRef.current || !studentSid) return;
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
      if (!event.candidate || !socketRef.current) return;
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
    if (!connection) return;
    await connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function handleIceCandidate({ from, candidate }) {
    const connection = peerConnectionsRef.current[from];
    if (!connection || !candidate) return;
    await connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async function handleStartStreaming() {
    if (meetingEnded) {
      setMessage("This class has ended.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
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
      setMessage(error?.message || "Unable to access camera/mic.");
    }
  }

  function handleStopStreaming() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    
    closeAllPeerConnections();
    socketRef.current?.emit("stop_streaming", {});
    streamingRef.current = false;
    setIsStreaming(false);
    setIsMicEnabled(false);
    setIsCameraEnabled(false);
    setMessage("Stream stopped.");
  }

  function toggleTrack(kind) {
    if (!localStreamRef.current) return;
    const tracks = kind === "audio"
      ? localStreamRef.current.getAudioTracks()
      : localStreamRef.current.getVideoTracks();

    if (tracks.length === 0) return;

    const nextEnabled = !tracks[0].enabled;
    tracks.forEach((track) => track.enabled = nextEnabled);

    if (kind === "audio") setIsMicEnabled(nextEnabled);
    else setIsCameraEnabled(nextEnabled);
  }

  async function handleSendChat() {
    if (meetingEnded) {
      setMessage("This class has ended.");
      return;
    }
    const trimmed = String(chatText || "").trim();
    if (!trimmed) return;
    if (!socketRef.current?.connected) return;

    socketRef.current.emit("meeting_chat", {
      room_id: roomId,
      live_session_id: liveSessionId,
      text: trimmed,
      timestamp: new Date().toISOString(),
      source: "chat",
      username: userDisplayName,
      role: "teacher"
    });
    setChatText("");
  }

  async function handleCopyJoinLink() {
    if (!liveSessionId) return;
    const joinUrl = `${window.location.origin}/student/live?session=${encodeURIComponent(liveSessionId)}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setMessage("Student join link copied.");
    } catch {
      setMessage("Unable to copy the join link.");
    }
  }

  async function handleEndMeeting() {
    if (!liveSessionId) return;
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
      setMessage("Unable to end live class.");
    } finally {
      setIsEnding(false);
    }
  }

  useEffect(() => {
    if (!liveSessionId || !user?.id) return;
    shouldLeaveRef.current = true;
    void joinLiveClass(liveSessionId).catch(() => {});
    void refreshRoom();

    const socket = io(socketUrl, { transports: ["websocket"] });
    socketRef.current = socket;
    setSocketState("connecting");

    socket.on("connect", () => {
      setSocketState("connected");
      socket.emit("teacher-join", {
        sessionId: liveSessionId,
        user_id: user.id,
        username: userDisplayName,
      });
    });

    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("connect_error", () => setSocketState("error"));

    socket.on("room_participants", (payload) => {
      const nextStudents = Array.isArray(payload?.participants)
        ? payload.participants.filter((item) => item.role === "student")
        : [];
      setStudents(nextStudents);
    });

    socket.on("student_joined", (payload) => {
      setStudents((current) => upsertParticipant(current, { ...payload, role: "student" }));
      if (streamingRef.current && localStreamRef.current) {
        void createPeerConnection(payload.sid);
      }
    });

    socket.on("student-joined", (payload) => {
      setStudents((current) => upsertParticipant(current, { ...payload, sid: payload.sid || payload.socketId, role: "student" }));
      if (streamingRef.current && localStreamRef.current) {
        void createPeerConnection(payload.sid || payload.socketId);
      }
    });

    socket.on("dashboard-update", (payload) => {
      const nextStudents = Array.isArray(payload?.students)
        ? payload.students.map((item) => ({ ...item, sid: item.sid || item.socketId, username: item.username || item.name, role: "student" }))
        : [];
      setStudents(nextStudents);
      setOverall((current) => ({
        ...(current || {}),
        active_students_count: Number(payload?.active_students_count ?? nextStudents.length),
        dominant_emotion: payload?.dominant_emotion || payload?.dominantEmotion || "unknown",
        low_attention_alerts: Number(payload?.low_attention_alerts ?? payload?.lowAttentionCount ?? 0),
      }));
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

    socket.on("webrtc_answer", (payload) => void handleAnswer(payload));
    socket.on("webrtc_ice_candidate", (payload) => void handleIceCandidate(payload));

    socket.on("student_emotion", (payload) => {
      const studentSid = payload.student_sid || payload.sid || payload.socketId;
      setStudentEmotions((current) => ({
        ...current,
        [studentSid]: {
          emotion: payload.emotion,
          confidence: Number(payload.confidence || 0),
          username: payload.student_username,
        },
      }));
    });

    socket.on("live-emotion-update", (payload) => {
      const studentSid = payload.student_sid || payload.sid || payload.socketId;
      setStudentEmotions((current) => ({
        ...current,
        [studentSid]: {
          emotion: payload.emotion,
          confidence: Number(payload.confidence || 0),
          username: payload.student_username || payload.name,
        },
      }));
    });

    socket.on("meeting_chat", (payload) => {
      setChatMessages((current) => [normalizeChatMessage(payload), ...current].slice(0, 100));
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
    if (!liveSessionId) return;
    const timer = window.setInterval(() => void refreshRoom(), 10000);
    return () => window.clearInterval(timer);
  }, [liveSessionId]);

  return (
    <div className="fixed inset-0 top-[72px] lg:left-64 z-40 bg-slate-950 flex flex-col overflow-hidden font-sans">
      
      {/* Top Banner */}
      <div className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-sm font-bold text-slate-200">{isStreaming ? 'LIVE' : 'STANDBY'}</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <h2 className="text-sm font-semibold text-slate-300 truncate">{liveClass?.title || `Session: ${liveSessionId}`}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCopyJoinLink}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
          >
            <span>🔗</span> Copy Join Link
          </button>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${socketState === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
            {socketState === 'connected' ? 'Socket Connected' : 'Connecting...'}
          </div>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Main Stage (Teacher Local Video) */}
        <div className="flex-1 flex flex-col p-4 relative z-0">
          
          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 border-slate-700/50">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Students</span>
              <span className="text-lg font-black text-slate-200">{students.length}</span>
            </div>
            <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 border-slate-700/50">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Dominant</span>
              <span className="text-lg font-black text-brand-400 capitalize">{overall?.dominant_emotion || "neutral"}</span>
            </div>
            <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 border-slate-700/50">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Alerts</span>
              <span className={`text-lg font-black ${Number(overall?.low_attention_alerts) > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                {Number(overall?.low_attention_alerts || 0)}
              </span>
            </div>
          </div>

          {/* Teacher Broadcast Video */}
          <div className="flex-1 bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-slate-800 flex items-center justify-center group">
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className={`w-full h-full object-contain ${isStreaming ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
            />
            
            {!isStreaming && (
              <div className="flex flex-col items-center justify-center text-center max-w-md p-8">
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-6 border border-slate-700 shadow-xl">
                  <span className="text-4xl">🎥</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-200 mb-3">You are not broadcasting</h3>
                <p className="text-slate-400 mb-8">Start your camera and microphone to begin the live class stream to your students.</p>
                <button
                  onClick={handleStartStreaming}
                  disabled={meetingEnded}
                  className="px-8 py-3.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all hover:scale-105"
                >
                  Start Stream
                </button>
              </div>
            )}
            
            {isStreaming && (
              <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-xs font-bold text-white border border-white/10">
                  {userDisplayName} (Host)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebars Area */}
        <div className="flex shrink-0">
          
          {/* Participants & Emotion Panel */}
          <div className={`w-72 border-l border-slate-800 bg-slate-900 flex flex-col transition-transform duration-300 ${showParticipantsPane ? 'translate-x-0' : 'translate-x-full absolute right-0 top-0 bottom-0 z-20'}`}>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200">Students ({students.length})</h3>
              <button onClick={() => setShowParticipantsPane(false)} className="text-slate-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {students.length === 0 && (
                <div className="text-center text-slate-500 text-sm mt-8">No students joined yet.</div>
              )}
              {students.map((student) => {
                const emotion = studentEmotions[student.sid];
                return (
                  <div key={student.sid} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-200 text-sm truncate pr-2">{student.username}</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    {emotion ? (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Emotion:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${emotion.emotion === 'negative' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'}`}>
                          {emotion.emotion} {Math.round(emotion.confidence * 100)}%
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 mt-1 italic">Waiting for camera feed...</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat Panel */}
          <div className={`w-80 border-l border-slate-800 bg-slate-900 flex flex-col transition-transform duration-300 ${showChatPane ? 'translate-x-0' : 'translate-x-full absolute right-0 top-0 bottom-0 z-20'}`}>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200">Live Chat</h3>
              <button onClick={() => setShowChatPane(false)} className="text-slate-400 hover:text-white lg:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {chatMessages.length === 0 && (
                <div className="text-center text-slate-500 text-sm mt-8">No messages yet.</div>
              )}
              {chatMessages.map(msg => (
                <div key={msg.id} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-bold ${msg.role === 'teacher' ? 'text-brand-400' : 'text-slate-300'}`}>
                      {msg.username}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200">{msg.text}</p>
                  {(msg.emotion && msg.emotion !== 'unknown') && (
                    <div className="mt-2 flex gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-900 border border-slate-700 text-slate-400">
                        {msg.emotion}
                      </span>
                      {msg.source === 'voice' && <span className="text-[10px]">🎤</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900">
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-1 focus:ring-brand-500/50 outline-none text-sm text-slate-200 placeholder-slate-500"
                  placeholder="Message everyone..."
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendChat();
                  }}
                  disabled={meetingEnded}
                />
                <button 
                  onClick={handleSendChat}
                  disabled={meetingEnded || !chatText.trim()}
                  className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-6 shrink-0 z-30">
        <div className="w-64 flex flex-col justify-center">
          {message && (
            <div className="text-sm text-slate-400 truncate max-w-full">
              {message}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMicEnabled ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30"}`}
            onClick={() => toggleTrack('audio')}
            disabled={!isStreaming || meetingEnded}
          >
            {isMicEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <button 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isCameraEnabled ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30"}`}
            onClick={() => toggleTrack('video')}
            disabled={!isStreaming || meetingEnded}
          >
            {isCameraEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {isStreaming ? (
            <button
              onClick={handleStopStreaming}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg shadow-red-500/20"
              title="Stop Broadcast"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleStartStreaming}
              disabled={meetingEnded}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white transition-all shadow-lg shadow-brand-500/20"
              title="Start Broadcast"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          <div className="w-px h-8 bg-slate-700 mx-2" />

          <button 
            className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all ${showParticipantsPane ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            onClick={() => setShowParticipantsPane(!showParticipantsPane)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            Students
          </button>

          <button 
            className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all ${showChatPane ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            onClick={() => setShowChatPane(!showChatPane)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            Chat
          </button>
        </div>

        <div className="w-64 flex justify-end">
          <button 
            onClick={handleEndMeeting}
            disabled={isEnding || meetingEnded}
            className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 disabled:opacity-50 font-bold rounded-xl border border-red-500/20 transition-all"
          >
            {isEnding ? "Ending..." : "End Class"}
          </button>
        </div>
      </div>
    </div>
  );
}
