import { useEffect, useRef, useState } from "react";

import { apiRequest } from "../services/api";

const IDLE_THRESHOLD_SECONDS = 60;
const NO_FACE_INTERVAL_THRESHOLD = 3;
const POSSIBLE_DISTRACTION_IDLE_SECONDS = 120;
const SAMPLE_INTERVAL_MS = 5000;
const FLUSH_INTERVAL_MS = 30000;

function nowIso() {
  return new Date().toISOString();
}

export default function useAttentionTracker(sessionId, lessonId, faceStats = {}, options = {}) {
  const liveSessionId = String(options.liveSessionId || "");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastState, setLastState] = useState("focused");
  const [lastFlushError, setLastFlushError] = useState("");
  const [idleSeconds, setIdleSeconds] = useState(0);

  const queueRef = useRef([]);
  const flushBusyRef = useRef(false);
  const lastActivityAtRef = useRef(Date.now());
  const faceStatsRef = useRef(faceStats || {});
  const hiddenStreakSecondsRef = useRef(0);
  const idleStreakSecondsRef = useRef(0);
  const lastWatchSecondsRef = useRef(0);

  useEffect(() => {
    faceStatsRef.current = faceStats || {};
  }, [faceStats]);

  useEffect(() => {
    lastWatchSecondsRef.current = 0;
  }, [sessionId, lessonId, liveSessionId]);

  useEffect(() => {
    function markActive() {
      lastActivityAtRef.current = Date.now();
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, markActive));
    };
  }, []);

  async function flushQueue() {
    if (flushBusyRef.current || queueRef.current.length === 0) {
      return;
    }
    if ((!sessionId && !liveSessionId) || (!lessonId && !liveSessionId)) {
      return;
    }

    const batch = [...queueRef.current];
    queueRef.current = [];
    setPendingCount(0);
    flushBusyRef.current = true;

    try {
      const token = localStorage.getItem("token") || "";
      await apiRequest("/attention/batch", "POST", { events: batch }, token, { timeoutMs: 12000, retryCount: 0 });
      setLastFlushError("");
    } catch (error) {
      queueRef.current = [...batch, ...queueRef.current];
      setPendingCount(queueRef.current.length);
      setLastFlushError(error?.message || "Attention batch failed");
    } finally {
      flushBusyRef.current = false;
    }
  }

  useEffect(() => {
    const sampleTimer = window.setInterval(() => {
      if ((!sessionId && !liveSessionId) || (!lessonId && !liveSessionId)) {
        return;
      }

      const snapshot = faceStatsRef.current || {};
      const userId = snapshot.userId || snapshot.user_id || "";
      if (!userId) {
        return;
      }

      const tabHidden = Boolean(document.hidden || snapshot.tabVisible === false);
      const currentIdleSeconds = Math.max(0, Math.floor((Date.now() - lastActivityAtRef.current) / 1000));
      setIdleSeconds(currentIdleSeconds);

      const faceTrackingOn = Boolean(snapshot.trackerActive || snapshot.trackingEnabled);
      const noFaceIntervals = Number(snapshot.noFaceIntervals || 0);
      const facesCount = Number(snapshot.facesCount || 0);
      const isPlaying = Boolean(snapshot.isPlaying);

      hiddenStreakSecondsRef.current = tabHidden
        ? hiddenStreakSecondsRef.current + Math.floor(SAMPLE_INTERVAL_MS / 1000)
        : 0;
      idleStreakSecondsRef.current = currentIdleSeconds >= IDLE_THRESHOLD_SECONDS
        ? idleStreakSecondsRef.current + Math.floor(SAMPLE_INTERVAL_MS / 1000)
        : 0;

      const watchedSeconds = Number(snapshot.watchedSeconds || 0);
      const watchSecondsDelta = Math.max(0, watchedSeconds - lastWatchSecondsRef.current);
      lastWatchSecondsRef.current = watchedSeconds;

      const noFaceLong = faceTrackingOn && noFaceIntervals >= NO_FACE_INTERVAL_THRESHOLD;
      const multiFace = faceTrackingOn && facesCount > 1;
      const possibleDistraction = tabHidden
        && idleStreakSecondsRef.current >= POSSIBLE_DISTRACTION_IDLE_SECONDS
        && noFaceLong;

      let state = "focused";
      if (possibleDistraction) {
        state = "possible_distraction";
      } else if (tabHidden) {
        state = "tab_hidden";
      } else if (currentIdleSeconds >= IDLE_THRESHOLD_SECONDS) {
        state = "idle";
      } else if (multiFace) {
        state = "multi_face";
      } else if (noFaceLong) {
        state = "no_face_detected";
      }

      const event = {
        user_id: userId,
        lesson_id: lessonId || (liveSessionId ? `live:${liveSessionId}` : null),
        session_id: sessionId || null,
        live_session_id: liveSessionId || null,
        timestamp: nowIso(),
        state,
        evidence: {
          tabHidden,
          idleSeconds: currentIdleSeconds,
          hiddenStreakSeconds: hiddenStreakSecondsRef.current,
          idleStreakSeconds: idleStreakSecondsRef.current,
          faceTrackingOn,
          noFaceIntervals,
          facesCount,
          isPlaying,
          watchSecondsDelta,
          watchedSecondsTotal: watchedSeconds,
          possibleDistraction,
        },
      };

      queueRef.current.push(event);
      setPendingCount(queueRef.current.length);
      setLastState(state);
    }, SAMPLE_INTERVAL_MS);

    const flushTimer = window.setInterval(() => {
      void flushQueue();
    }, FLUSH_INTERVAL_MS);

    return () => {
      window.clearInterval(sampleTimer);
      window.clearInterval(flushTimer);
      void flushQueue();
    };
  }, [sessionId, lessonId, liveSessionId]);

  return {
    trackingOn: Boolean((sessionId || liveSessionId) && (lessonId || liveSessionId)),
    pendingCount,
    lastState,
    idleSeconds,
    lastFlushError,
  };
}

