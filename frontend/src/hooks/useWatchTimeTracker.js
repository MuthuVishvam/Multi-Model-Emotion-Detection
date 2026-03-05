import { useEffect, useRef, useState } from "react";

const WATCH_TICK_MS = 1000;

export default function useWatchTimeTracker(videoRef, sessionId, lessonId) {
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden);

  const watchedSecondsRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isTabVisibleRef = useRef(!document.hidden);
  const boundVideoRef = useRef(null);

  useEffect(() => {
    watchedSecondsRef.current = 0;
    setWatchedSeconds(0);
  }, [sessionId, lessonId]);

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

      videoElement.addEventListener("play", onPlay);
      videoElement.addEventListener("playing", onPlaying);
      videoElement.addEventListener("pause", onPause);
      videoElement.addEventListener("ended", onEnded);
      videoElement.addEventListener("waiting", onWaiting);
      videoElement.addEventListener("stalled", onStalled);
      videoElement.addEventListener("emptied", onEmptied);
      syncPlayingState(!videoElement.paused && !videoElement.ended);

      return () => {
        videoElement.removeEventListener("play", onPlay);
        videoElement.removeEventListener("playing", onPlaying);
        videoElement.removeEventListener("pause", onPause);
        videoElement.removeEventListener("ended", onEnded);
        videoElement.removeEventListener("waiting", onWaiting);
        videoElement.removeEventListener("stalled", onStalled);
        videoElement.removeEventListener("emptied", onEmptied);
      };
    }

    let unbind = () => {};
    const syncTimer = window.setInterval(() => {
      const currentVideo = videoRef?.current || null;
      if (currentVideo === boundVideoRef.current) {
        return;
      }

      unbind();
      boundVideoRef.current = currentVideo;
      if (!currentVideo) {
        syncPlayingState(false);
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
      if (!isPlayingRef.current || !isTabVisibleRef.current) {
        return;
      }

      watchedSecondsRef.current += 1;
      setWatchedSeconds(watchedSecondsRef.current);
    }, WATCH_TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [sessionId, lessonId]);

  return {
    watchedSeconds,
    watchedMinutes: Number((watchedSeconds / 60).toFixed(2)),
    isPlaying,
    isTabVisible,
  };
}
