import { useEffect, useRef, useState } from "react";

const WATCH_TICK_MS = 1000;

function toSafeSeconds(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

export default function useWatchTimeTracker(videoRef, sessionId, lessonId, options = {}) {
  const fallbackDurationSec = toSafeSeconds(options.fallbackDurationSec);
  const completionThresholdPercent = Number(options.completionThresholdPercent || 90);
  const externalPlaying = Boolean(options.externalPlaying);

  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(fallbackDurationSec);

  const watchedSecondsRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isTabVisibleRef = useRef(!document.hidden);
  const boundVideoRef = useRef(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(fallbackDurationSec);
  const externalPlayingRef = useRef(externalPlaying);

  useEffect(() => {
    watchedSecondsRef.current = 0;
    currentTimeRef.current = 0;
    setWatchedSeconds(0);
    setCurrentTimeSec(0);
  }, [sessionId, lessonId]);

  useEffect(() => {
    if (durationRef.current > 0) {
      return;
    }
    if (fallbackDurationSec > 0) {
      durationRef.current = fallbackDurationSec;
      setDurationSec(fallbackDurationSec);
    }
  }, [fallbackDurationSec]);

  useEffect(() => {
    externalPlayingRef.current = externalPlaying;
    if (!videoRef?.current) {
      isPlayingRef.current = externalPlaying;
      setIsPlaying(externalPlaying);
    }
  }, [externalPlaying, videoRef]);

  useEffect(() => {
    function onVisibilityChange() {
      const visible = !document.hidden;
      isTabVisibleRef.current = visible;
      setIsTabVisible(visible);
    }

    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    function syncPlayingState(nextIsPlaying) {
      isPlayingRef.current = nextIsPlaying;
      setIsPlaying(nextIsPlaying);
    }

    function bindVideo(videoElement) {
      if (!videoElement) {
        return () => {};
      }

      const onPlay = () => syncPlayingState(true);
      const onPlaying = () => syncPlayingState(true);
      const onPause = () => syncPlayingState(false);
      const onEnded = () => syncPlayingState(false);
      const onWaiting = () => syncPlayingState(false);
      const onStalled = () => syncPlayingState(false);
      const onEmptied = () => syncPlayingState(false);
      const onTimeUpdate = () => {
        const next = toSafeSeconds(videoElement.currentTime);
        currentTimeRef.current = next;
        setCurrentTimeSec(next);
      };
      const onDurationChange = () => {
        const next = toSafeSeconds(videoElement.duration);
        if (next > 0) {
          durationRef.current = next;
          setDurationSec(next);
        }
      };

      videoElement.addEventListener("play", onPlay);
      videoElement.addEventListener("playing", onPlaying);
      videoElement.addEventListener("pause", onPause);
      videoElement.addEventListener("ended", onEnded);
      videoElement.addEventListener("waiting", onWaiting);
      videoElement.addEventListener("stalled", onStalled);
      videoElement.addEventListener("emptied", onEmptied);
      videoElement.addEventListener("loadedmetadata", onDurationChange);
      videoElement.addEventListener("durationchange", onDurationChange);
      videoElement.addEventListener("timeupdate", onTimeUpdate);
      onDurationChange();
      onTimeUpdate();
      syncPlayingState(!videoElement.paused && !videoElement.ended);

      return () => {
        videoElement.removeEventListener("play", onPlay);
        videoElement.removeEventListener("playing", onPlaying);
        videoElement.removeEventListener("pause", onPause);
        videoElement.removeEventListener("ended", onEnded);
        videoElement.removeEventListener("waiting", onWaiting);
        videoElement.removeEventListener("stalled", onStalled);
        videoElement.removeEventListener("emptied", onEmptied);
        videoElement.removeEventListener("loadedmetadata", onDurationChange);
        videoElement.removeEventListener("durationchange", onDurationChange);
        videoElement.removeEventListener("timeupdate", onTimeUpdate);
      };
    }

    let unbind = () => {};
      const syncTimer = window.setInterval(() => {
        const currentVideo = videoRef?.current || null;
        if (currentVideo === boundVideoRef.current) {
          if (!currentVideo) {
            syncPlayingState(externalPlayingRef.current);
          }
          return;
        }

        unbind();
        boundVideoRef.current = currentVideo;
        if (!currentVideo) {
          syncPlayingState(externalPlayingRef.current);
          return;
        }
        unbind = bindVideo(currentVideo);
      }, 300);

    return () => {
      window.clearInterval(syncTimer);
      unbind();
      boundVideoRef.current = null;
      syncPlayingState(false);
    };
  }, [videoRef]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!sessionId || !lessonId) {
        return;
      }
      if (!(isPlayingRef.current || externalPlayingRef.current) || !isTabVisibleRef.current) {
        return;
      }

      watchedSecondsRef.current += 1;
      setWatchedSeconds(watchedSecondsRef.current);
    }, WATCH_TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [sessionId, lessonId]);

  const effectiveDurationSec = durationSec > 0 ? durationSec : fallbackDurationSec;
  const completionPercent = effectiveDurationSec > 0
    ? Math.min(100, Number(((watchedSeconds / effectiveDurationSec) * 100).toFixed(2)))
    : 0;
  const watchProgressCompleted = completionPercent >= completionThresholdPercent;

  return {
    watchedSeconds,
    watchedMinutes: Number((watchedSeconds / 60).toFixed(2)),
    currentTimeSec: Number(currentTimeSec.toFixed(2)),
    durationSec: Number(effectiveDurationSec.toFixed(2)),
    completionPercent,
    watchProgressCompleted,
    isPlaying: isPlaying || externalPlaying,
    isTabVisible,
  };
}
