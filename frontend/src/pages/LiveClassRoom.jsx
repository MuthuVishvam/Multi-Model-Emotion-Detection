import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import io from "socket.io-client";

import AudioFeedbackRecorder from "../components/AudioFeedbackRecorder";
import {
  apiRequest,
  fetchLiveClass,
  fetchLiveOverallAnalytics,
  joinLiveClass,
  leaveLiveClass,
} from "../services/api";
import { buildLiveRoomId, getRealtimeBaseUrl, getUserDisplayName } from "../services/realtime";
import useAttentionTracker from "../hooks/useAttentionTracker";
import useEmotionTracker from "../hooks/useEmotionTracker";

function safeUserId(user) {
  return user?.id || user?.email || "";
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
  const [liveWatchSeconds, setLiveWatchSeconds] = useState(0);
  const [isLiveStarted, setIsLiveStarted] = useState(false);
  const [showChatPane, setShowChatPane] = useState(false);
  const [socketState, setSocketState] = useState("connecting");
  const [teacherStreaming, setTeacherStreaming] = useState(false);
  
  const leaveInCleanupRef = useRef(false);
  const manualFaceInputRef = useRef(null);
  const lastEmotionSentRef = useRef("");
  
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const isJoined = Boolean(liveSessionId);
  const userId = safeUserId(user);
  const lessonId = (liveClass?.lesson_id || (liveSessionId ? `live:${liveSessionId}` : "")).trim();
  const classId = (liveClass?.class_id || "").trim();
  const roomId = useMemo(() => buildLiveRoomId(liveSessionId), [liveSessionId]);
  const socketUrl = useMemo(() => getRealtimeBaseUrl(), []);
  const userDisplayName = useMemo(() => getUserDisplayName(user), [user]);

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
    if (!nextSessionId) return;
    try {
      const [liveMeta, overallData] = await Promise.all([
        fetchLiveClass(nextSessionId),
        fetchLiveOverallAnalytics(nextSessionId),
      ]);
      setLiveClass(liveMeta || null);
      setOverall(overallData || null);
    } catch (error) {
      console.error(error);
    }
  }

  function closePeerConnection() {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }

  async function handleOffer({ from, offer }) {
    closePeerConnection();
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    peerConnectionRef.current = peerConnection;

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc_ice_candidate", {
          target: from,
          candidate: event.candidate,
        });
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socketRef.current?.emit("webrtc_answer", {
      target: from,
      answer,
    });
  }

  async function handleIceCandidate({ candidate }) {
    if (!peerConnectionRef.current || !candidate) return;
    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
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
    if (!liveSessionId) return;
    if (!silent) setIsLeaving(true);
    try {
      await leaveLiveClass(liveSessionId);
    } catch {
      // ignore
    } finally {
      closePeerConnection();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setLiveSessionId("");
      setLiveClass(null);
      setOverall(null);
      setIsLiveStarted(false);
      setLiveWatchSeconds(0);
      setTeacherStreaming(false);
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
    if (!liveSessionId) return;
    const trimmed = String(chatText || "").trim();
    if (!trimmed) return;

    if (!socketRef.current?.connected) {
      setMessage("Meeting chat is offline.");
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
      
      const payload = {
        room_id: roomId,
        live_session_id: liveSessionId,
        text: trimmed,
        timestamp,
        source: "chat",
        emotion: response?.emotion || "unknown",
        confidence: response?.confidence || 0,
      };

      socketRef.current.emit("meeting_chat", payload);
      setChatText("");
    } catch (error) {
      setMessage("Unable to send chat.");
    } finally {
      setIsSendingChat(false);
    }
  }

  function handleVoicePrediction(prediction) {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("meeting_chat", {
      room_id: roomId,
      live_session_id: liveSessionId,
      text: "[Voice feedback recording]",
      timestamp: prediction?.timestamp || new Date().toISOString(),
      source: "voice",
      emotion: prediction?.emotion || "unknown",
      confidence: prediction?.confidence || 0,
    });
  }

  useEffect(() => {
    if (!isJoined || !isLiveStarted) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setLiveWatchSeconds(c => c + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isJoined, isLiveStarted]);

  useEffect(() => {
    if (!isJoined) return;
    void refreshLiveContext(liveSessionId);
    const timer = window.setInterval(() => {
      void refreshLiveContext(liveSessionId);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [isJoined, liveSessionId]);

  useEffect(() => {
    if (!isJoined) return;
    
    const socket = io(socketUrl, { transports: ["websocket"] });
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

    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("connect_error", () => setSocketState("error"));

    socket.on("room_participants", (payload) => {
      if (payload?.teacher_streaming) setTeacherStreaming(true);
    });

    socket.on("teacher_started_streaming", () => {
      setTeacherStreaming(true);
    });

    socket.on("teacher_stopped_streaming", () => {
      setTeacherStreaming(false);
      closePeerConnection();
    });

    socket.on("webrtc_offer", (payload) => {
      void handleOffer(payload);
    });

    socket.on("webrtc_ice_candidate", (payload) => {
      void handleIceCandidate(payload);
    });

    socket.on("meeting_chat", (payload) => {
      setChatMessages((current) => [normalizeChatMessage(payload), ...current].slice(0, 100));
    });

    socket.on("live_class_ended", () => {
      setMessage("The teacher has ended this live class.");
      handleLeave({ silent: false });
    });

    return () => {
      closePeerConnection();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isJoined, liveSessionId, roomId, socketUrl, user?.id, userDisplayName]);

  useEffect(() => {
    leaveInCleanupRef.current = isJoined;
    if (!isJoined) {
      lastEmotionSentRef.current = "";
    }
  }, [isJoined]);

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
      studentId: userId,
      name: userDisplayName,
      emotion: emotionTracker.lastEmotion,
      attention,
      confidence: Number(emotionTracker.lastConfidence || 0),
      timestamp: Date.now(),
    });
  }, [emotionTracker.faceStats?.faceDetected, emotionTracker.lastConfidence, emotionTracker.lastEmotion, liveSessionId, socketState, userDisplayName, userId]);

  useEffect(() => () => {
    if (leaveInCleanupRef.current && liveSessionId) {
      void leaveLiveClass(liveSessionId).catch(() => {});
    }
  }, [liveSessionId]);

  if (!isJoined) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="glass-panel max-w-lg w-full p-8 rounded-2xl text-center">
          <div className="w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-100 mb-2">Join Live Class</h2>
          <p className="text-slate-400 mb-8">Enter your session ID below to join the interactive live classroom.</p>
          
          <div className="flex flex-col gap-4">
            <input
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all text-white placeholder-slate-500 text-center text-lg tracking-widest"
              placeholder="SESSION ID"
              value={inputSessionId}
              onChange={(e) => setInputSessionId(e.target.value.toUpperCase())}
              disabled={isJoining}
            />
            <button 
              type="button" 
              className="w-full px-6 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-600/20 transition-all disabled:opacity-50"
              onClick={handleJoin} 
              disabled={isJoining || !inputSessionId.trim()}
            >
              {isJoining ? "Joining..." : "Join Classroom"}
            </button>
          </div>
          {message && <div className="mt-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3">{message}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 top-[72px] lg:left-64 z-40 bg-slate-950 flex flex-col overflow-hidden">
      {/* Top Banner */}
      <div className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-200">LIVE</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <h2 className="text-sm font-semibold text-slate-300">{liveClass?.title || `Session: ${liveSessionId}`}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${socketState === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
            {socketState === 'connected' ? 'Connected' : 'Reconnecting...'}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Video Grid Area */}
        <div className="flex-1 flex flex-col p-4 relative z-0">
          <div className="flex-1 bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-slate-800 flex items-center justify-center">
            
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-contain ${teacherStreaming ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
            />
            
            {!teacherStreaming && (
              <div className="flex flex-col items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
                  <span className="text-4xl">👨‍🏫</span>
                </div>
                <h3 className="text-xl font-bold text-slate-300 mb-2">Teacher is not broadcasting</h3>
                <p className="text-slate-500">Wait for the teacher to start their video stream.</p>
              </div>
            )}

            {/* Student Local Picture-in-Picture */}
            <div className="absolute bottom-4 right-4 w-48 aspect-video bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl">
              <video 
                ref={emotionTracker.webcamRef} 
                autoPlay 
                muted 
                playsInline 
                className={`w-full h-full object-cover ${emotionTracker.cameraState === "on" ? "opacity-100" : "opacity-0"}`}
              />
              {emotionTracker.cameraState !== "on" && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <span className="text-2xl">👤</span>
                </div>
              )}
              {emotionTracker.lastEmotion && (
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-bold text-white uppercase tracking-wider">
                  {emotionTracker.lastEmotion} {Math.round(emotionTracker.lastConfidence * 100)}%
                </div>
              )}
            </div>
            
            {/* Start Tracking Overlay */}
            {!isLiveStarted && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="glass-panel p-8 rounded-2xl text-center max-w-md">
                  <h3 className="text-2xl font-bold text-white mb-4">Join active session</h3>
                  <p className="text-slate-300 mb-6 text-sm">Join the interactive layer to track attention, capture emotions, and engage with the class.</p>
                  <button 
                    onClick={handleStartLive}
                    className="w-full px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105"
                  >
                    Enter Live Class
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat / Sidebar Area */}
        <div className={`w-80 border-l border-slate-800 bg-slate-900 flex flex-col shrink-0 transition-transform duration-300 ${showChatPane ? 'translate-x-0' : 'translate-x-full absolute right-0 top-0 bottom-0 z-20'}`}>
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
                  <div className="mt-2 flex">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-900 border border-slate-700 text-slate-400">
                      {msg.emotion}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900">
            <textarea
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-1 focus:ring-brand-500/50 outline-none text-sm text-slate-200 resize-none h-16 mb-2 placeholder-slate-500"
              placeholder="Type your message..."
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              disabled={!isLiveStarted}
            />
            <div className="flex gap-2">
              <button 
                onClick={handleSendChat}
                disabled={!isLiveStarted || isSendingChat || !chatText.trim()}
                className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-colors"
              >
                Send
              </button>
              <div className="flex-1">
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-6 shrink-0 z-30">
        <div className="w-64 flex flex-col justify-center">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Emotion AI</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${emotionTracker.cameraState === "on" ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="text-sm font-bold text-slate-200">
              {emotionTracker.cameraState === "on" ? "Tracking Active" : "Camera Off"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${emotionTracker.cameraState === "on" ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30"}`}
            onClick={emotionTracker.toggleTracking}
          >
            {emotionTracker.cameraState === "on" ? (
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

          <button 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${showChatPane ? "bg-brand-600 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
            onClick={() => setShowChatPane(!showChatPane)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </button>

          <button 
            className="w-12 h-12 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg shadow-red-500/20 ml-4"
            onClick={() => handleLeave()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-135" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </button>
        </div>

        <div className="w-64 flex justify-end">
          {message && (
            <div className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700 truncate max-w-full">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
