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
  const manualFaceInputRef = useRef(null);

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

  async function handleManualFaceUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    await emotionTracker.captureFaceFromImage(file);
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
    <div className="max-w-7xl mx-auto space-y-6 py-6 px-4">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-cyan-400"></div>
        <p className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold tracking-wider mb-4 border border-indigo-100 uppercase">Student Live Class</p>
        <h2 className="text-3xl font-extrabold text-slate-900 mb-3">Live Class Room</h2>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Join with session ID, enable camera tracking, and send live text/voice feedback. Camera and live microphone
          prompts work on HTTPS or localhost. On plain HTTP, use the selfie/audio upload fallbacks below.
        </p>

        <div className="flex flex-col sm:flex-row max-w-md mx-auto gap-3 mt-8">
          <input
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            placeholder="Enter live session ID"
            value={inputSessionId}
            onChange={(event) => setInputSessionId(event.target.value)}
            disabled={isJoined || isJoining}
          />
          {!isJoined ? (
            <button 
              type="button" 
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50 whitespace-nowrap"
              onClick={handleJoin} 
              disabled={isJoining || !inputSessionId.trim()}
            >
              {isJoining ? "Joining..." : "Join Live Class"}
            </button>
          ) : (
            <button 
              type="button" 
              className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold border border-red-200 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
              onClick={() => void handleLeave()} 
              disabled={isLeaving}
            >
              {isLeaving ? "Leaving..." : "Leave Class"}
            </button>
          )}
        </div>

        {message && <div className="mt-6 text-sm text-indigo-700 bg-indigo-50 p-3 rounded-lg border border-indigo-100 inline-block">{message}</div>}
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <article className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Active students</span>
          <strong className="text-3xl font-black text-slate-900">{Number(overall?.active_students_count || 0)}</strong>
        </article>
        <article className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Dominant emotion</span>
          <strong className="text-2xl font-bold text-indigo-600 capitalize">{overall?.dominant_emotion || "unknown"}</strong>
        </article>
        <article className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Low-attention alerts</span>
          <strong className="text-3xl font-black text-amber-500">{Number(overall?.low_attention_alerts || 0)}</strong>
        </article>
        <article className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Attention state</span>
          <strong className="text-2xl font-bold text-emerald-600 capitalize">{attentionTracker.lastState}</strong>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <article className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Live Tracking Controls</h3>
          <div className="flex flex-wrap gap-2 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${emotionTracker.cameraState === "on" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
              Camera: {emotionTracker.cameraState === "on" ? "On" : "Off"}
            </span>
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${emotionTracker.faceDetectionState === "running" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
              Face: {emotionTracker.faceDetectionState === "running" ? "Detected" : "Not detected"}
            </span>
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${attentionTracker.trackingOn ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
              Attention stream: {attentionTracker.trackingOn ? "On" : "Off"}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <button 
              type="button" 
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
              onClick={handleStartLive} 
              disabled={!isJoined || isLiveStarted}
            >
              {isLiveStarted ? "Live Running" : "Start Live Tracking"}
            </button>
            <button
              type="button"
              className={`px-5 py-2.5 text-sm font-semibold rounded-xl border transition-colors disabled:opacity-50 ${emotionTracker.trackingEnabled ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
              onClick={emotionTracker.toggleTracking}
              disabled={!isJoined}
            >
              {emotionTracker.trackingEnabled ? "Stop Camera Tracking" : "Enable Camera Tracking"}
            </button>
            <button
              type="button"
              className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              onClick={() => void emotionTracker.requestCameraPermission()}
              disabled={!isJoined || emotionTracker.isRequestingCamera}
            >
              {emotionTracker.isRequestingCamera ? "Checking..." : "Allow Camera"}
            </button>
            <button
              type="button"
              className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              onClick={() => manualFaceInputRef.current?.click()}
              disabled={!isJoined || emotionTracker.isAnalyzingFaceImage}
            >
              {emotionTracker.isAnalyzingFaceImage ? "Analyzing..." : "Upload Selfie"}
            </button>
            <label className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 font-medium cursor-pointer hover:bg-slate-50 rounded-lg">
              <input
                type="checkbox"
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                checked={emotionTracker.showCameraPreview}
                onChange={(event) => emotionTracker.setShowCameraPreview(event.target.checked)}
              />
              Show preview
            </label>
          </div>

          {emotionTracker.cameraSupportIssue && (
            <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 text-sm mb-6">
              {emotionTracker.cameraSupportIssue} Open the app over HTTPS for live camera tracking, or use Upload Selfie.
            </div>
          )}

          <div className="aspect-video w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 relative flex items-center justify-center mb-6 shadow-inner">
            <video
              className={`w-full h-full object-cover ${emotionTracker.showCameraPreview ? "opacity-100" : "opacity-0 absolute inset-0 -z-10"}`}
              ref={emotionTracker.webcamRef}
              autoPlay
              muted
              playsInline
            />
            {!emotionTracker.showCameraPreview && (
              <div className="text-slate-400 font-medium text-sm z-10 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                  <span className="text-xl">📷</span>
                </div>
                Camera preview hidden while tracking remains active.
              </div>
            )}
          </div>
          <input
            ref={manualFaceInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(event) => {
              void handleManualFaceUpload(event);
            }}
          />

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span>Buffered: <span className="text-slate-900">{emotionTracker.queueSize}</span></span>
            <span>Sent: <span className="text-slate-900">{emotionTracker.faceEventsSent}</span></span>
            <span>Watch time: <span className="text-slate-900">{liveWatchSeconds}s</span></span>
          </div>
          
          {emotionTracker.flushError && <p className="mt-3 text-xs text-red-600 font-medium">Face batch retry: {emotionTracker.flushError}</p>}
          {attentionTracker.lastFlushError && <p className="mt-1 text-xs text-red-600 font-medium">Attention batch retry: {attentionTracker.lastFlushError}</p>}
          {isLoadingOverall && <p className="mt-3 text-xs text-indigo-500 font-medium animate-pulse">Refreshing live analytics...</p>}
        </article>

        <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 flex flex-col h-full lg:max-h-[850px]">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">Live Chat Feedback</h3>
          <div className="flex flex-col gap-3 flex-shrink-0 mb-6">
            <textarea
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm resize-none h-24"
              placeholder="Type your live feedback..."
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              disabled={!isJoined}
            />
            <button 
              type="button" 
              className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
              onClick={handleSendChat} 
              disabled={!isJoined || isSendingChat}
            >
              {isSendingChat ? "Sending..." : "Send Feedback"}
            </button>
            <div className="pt-2">
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

          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
            {chatMessages.length === 0 && <p className="text-sm text-slate-400 font-medium text-center italic mt-4">No chat or voice entries yet.</p>}
            {chatMessages.map((entry) => (
              <article key={entry.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <p className="text-sm text-slate-800 font-medium">{entry.text}</p>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider shrink-0 border ${entry.emotion === 'negative' ? 'bg-red-50 text-red-600 border-red-200' : entry.emotion === 'positive' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {entry.emotion} {(Number(entry.confidence || 0)*100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  <span>{new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  <span className="flex items-center gap-1">
                    {entry.source === 'voice' ? '🎤' : '💬'} {entry.source}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
