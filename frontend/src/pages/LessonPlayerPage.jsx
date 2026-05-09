import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  apiRequest,
  fetchClassLessons,
  fetchLessonComments,
  fetchLessonVoiceFeedback,
  updateLessonProgress,
} from "../services/api";
import Discussion from "../components/Discussion";
import { getAllCourseLessons, getCourseById, getLessonById } from "../courseCatalog";
import useAttentionTracker from "../hooks/useAttentionTracker";
import useEmotionTracker from "../hooks/useEmotionTracker";
import useWatchTimeTracker from "../hooks/useWatchTimeTracker";

const LESSON_COMPLETION_RULES = {
  watchThresholdPercent: 90,
  requireAtLeastOneModality: true,
};

function formatClock(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseLessonDurationSeconds(lesson) {
  if (!lesson) {
    return 0;
  }

  const numericCandidates = [
    Number(lesson.duration_sec || 0),
    Number(lesson.durationSec || 0),
  ];
  for (const value of numericCandidates) {
    if (Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
  }

  const durationText = String(lesson.duration || "");
  const match = durationText.match(/(\d+)\s*min/i);
  if (match) {
    return Number(match[1] || 0) * 60;
  }
  return 0;
}

function extractYouTubeVideoId(urlString) {
  if (!urlString) {
    return "";
  }

  try {
    const url = new URL(urlString);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v") || "";
      }
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/").filter(Boolean)[1] || "";
      }
    }
  } catch {
    return "";
  }

  return "";
}

function inferLessonMedia(url) {
  if (!url) {
    return { type: "none" };
  }

  const youtubeId = extractYouTubeVideoId(url);
  if (youtubeId) {
    return {
      type: "youtube",
      src: `https://www.youtube.com/embed/${youtubeId}`,
    };
  }

  const lower = url.toLowerCase();
  if (/\.(mp4|webm|ogg)(\?|#|$)/.test(lower)) {
    return { type: "video", src: url };
  }

  return { type: "link", src: url };
}

function buildTimelineRows(lesson) {
  if (!lesson) {
    return [];
  }

  const descriptionWords = (lesson.description || "").split(/\s+/).filter(Boolean);
  const descriptionPreview = descriptionWords.slice(0, 5).join(" ");

  return [
    { time: "00:00", label: "Overview", detail: "Lesson goals and context" },
    { time: "25%", label: "Core concept", detail: descriptionPreview || "Main explanation" },
    { time: "65%", label: "Practice", detail: "Examples and guided walkthrough" },
    { time: "90%", label: "Wrap-up", detail: "Summary and next steps" },
  ];
}

function mapAssignedLesson(lesson, index) {
  const durationSec = Number(lesson.duration_sec || 0);
  return {
    lesson_id: String(lesson.lesson_id ?? lesson.lessonId ?? `class-lesson-${index + 1}`),
    title: lesson.title || `Lesson ${index + 1}`,
    description: lesson.description || "Assigned lesson",
    content: lesson.video_url || lesson.videoUrl || lesson.content || "",
    duration: durationSec > 0 ? `${Math.max(1, Math.round(durationSec / 60))} min` : "10 min",
    resources: Array.isArray(lesson.resources) && lesson.resources.length > 0
      ? lesson.resources
      : ["Lesson notes", "Discussion prompts", "Practice checklist"],
    course_id: lesson.course_id || lesson.courseId || "",
    duration_sec: durationSec,
  };
}

function TrackingIndicator({ tracker }) {
  const isOn = tracker.trackingActive;
  return (
    <div className={isOn ? "tracking-indicator tracking-indicator-on" : "tracking-indicator"}>
      <span className="tracking-indicator__dot" aria-hidden="true" />
      <span>{isOn ? "Emotion tracking ON" : "Emotion tracking OFF"}</span>
    </div>
  );
}

function NotesPanel({ notesValue, setNotesValue }) {
  return (
    <div className="side-panel-section">
      <h4>Lesson Notes</h4>
      <p className="small-note">Notes are saved locally for this lesson in your browser.</p>
      <textarea
        className="notes-textarea"
        value={notesValue}
        onChange={(event) => setNotesValue(event.target.value)}
        placeholder="Capture key ideas, questions, and action items..."
      />
    </div>
  );
}

function DiscussionPanel({
  userId,
  courseId,
  classId,
  lessonId,
  sessionId,
  setSessionId,
  sessionName,
  setSessionName,
  startSession,
  text,
  setText,
  submitDiscussionMessage,
  statusMessage,
  isSubmitting,
  discussionMessages,
  sessionEmotionCounts,
  setStatusMessage,
  onVoicePrediction,
}) {
  return (
    <Discussion
      userId={userId}
      courseId={courseId}
      classId={classId}
      lessonId={lessonId}
      sessionId={sessionId}
      setSessionId={setSessionId}
      sessionName={sessionName}
      setSessionName={setSessionName}
      startSession={startSession}
      text={text}
      setText={setText}
      submitDiscussionMessage={submitDiscussionMessage}
      statusMessage={statusMessage}
      isSubmitting={isSubmitting}
      discussionMessages={discussionMessages}
      sessionEmotionCounts={sessionEmotionCounts}
      setStatusMessage={setStatusMessage}
      onVoicePrediction={onVoicePrediction}
    />
  );
}

function ResourcesPanel({
  selectedLesson,
  lessonStarted,
  onStartLesson,
  tracker,
  watchTracker,
  attentionTracker,
}) {
  const manualFaceInputRef = useRef(null);

  async function handleManualFaceUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    await tracker.captureFaceFromImage(file);
  }

  return (
    <div className="side-panel-section">
      <h4>Resources & Commands</h4>

      <TrackingIndicator tracker={tracker} />
      <div className="status-badge-row">
        <span className={tracker.cameraState === "on" ? "tracking-indicator tracking-indicator-on" : "tracking-indicator"}>
          Camera: {tracker.cameraState === "on" ? "On" : "Off"}
        </span>
        <span className={tracker.faceDetectionState === "running" ? "tracking-indicator tracking-indicator-on" : "tracking-indicator"}>
          Face Detection: {tracker.faceDetectionState === "running" ? "Running" : "Not Detected"}
        </span>
      </div>
      <div className={attentionTracker.trackingOn ? "tracking-indicator tracking-indicator-on" : "tracking-indicator"}>
        <span className="tracking-indicator__dot" aria-hidden="true" />
        <span>
          {attentionTracker.trackingOn ? "Tracking on (watch-time + attention)" : "Tracking idle"}
        </span>
      </div>
      <p className="small-note">
        Privacy: only playback time, tab visibility, inactivity duration, and optional face presence counts are tracked.
      </p>
      <p className="small-note">
        No keystroke capture, screen recording, or direct game detection is performed.
      </p>

      <div className="command-group">
        <h5>Lesson controls</h5>
        <button type="button" onClick={onStartLesson}>
          {lessonStarted ? "Lesson Playing" : "Play Lesson"}
        </button>
        <button
          type="button"
          className={tracker.trackingEnabled ? "secondary" : ""}
          onClick={tracker.toggleTracking}
        >
          {tracker.trackingEnabled ? "Stop Emotion Tracking" : "Start Emotion Tracking"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void tracker.requestCameraPermission()}
          disabled={tracker.isRequestingCamera}
        >
          {tracker.isRequestingCamera ? "Checking Camera..." : "Allow Camera"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => manualFaceInputRef.current?.click()}
          disabled={!tracker.canLogFaceEvents || tracker.isAnalyzingFaceImage}
        >
          {tracker.isAnalyzingFaceImage ? "Analyzing Selfie..." : "Upload Selfie"}
        </button>
        <p className="small-note">{tracker.statusText}</p>
        {!lessonStarted && tracker.trackingEnabled && (
          <p className="small-note">Camera permission will be requested only after you press Play.</p>
        )}
        {tracker.cameraSupportIssue && (
          <div className="inline-message inline-message-soft">
            {tracker.cameraSupportIssue} Use HTTPS for live camera tracking, or use Upload Selfie as a fallback.
          </div>
        )}
        {tracker.permissionDenied && (
          <p className="small-note">Camera permission was denied. Lesson playback continues without tracking.</p>
        )}
        {!tracker.canLogFaceEvents && (
          <p className="small-note">Start a lesson session first if you want uploaded face captures to be stored.</p>
        )}
        <p className="small-note">
          Buffered detections: {tracker.queueSize}
          {tracker.lastEmotion ? ` | Last: ${tracker.lastEmotion} (${Math.round(tracker.lastConfidence * 100)}%)` : ""}
        </p>
        {tracker.flushError && <p className="small-note">Batch upload retrying: {tracker.flushError}</p>}
        {tracker.faceEventsSent > 0 && (
          <p className="small-note">Face events sent: {tracker.faceEventsSent}</p>
        )}
        <p className="small-note">
          Watch time: {watchTracker.watchedSeconds}s | Tab: {watchTracker.isTabVisible ? "visible" : "hidden"} |
          Video: {watchTracker.isPlaying ? "playing" : "paused"}
        </p>
        <p className="small-note">
          Attention state: {attentionTracker.lastState} | Idle: {attentionTracker.idleSeconds}s | Pending events: {attentionTracker.pendingCount}
        </p>
        {attentionTracker.lastFlushError && (
          <p className="small-note">Attention batch retrying: {attentionTracker.lastFlushError}</p>
        )}
      </div>

      <div className="resource-list">
        {(selectedLesson?.resources || ["Lesson notes", "Discussion prompts", "Practice checklist"]).map((item) => (
          <div key={item} className="resource-row">
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="command-group">
        <h5>Camera preview</h5>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={tracker.showCameraPreview}
            onChange={(event) => tracker.setShowCameraPreview(event.target.checked)}
          />
          Show preview on screen
        </label>
      </div>

      <div className="camera-preview-card">
        <p>{tracker.showCameraPreview ? "Camera preview" : "Camera preview hidden"}</p>
        <video
          className={tracker.showCameraPreview ? "webcam-video" : "webcam-video webcam-video-hidden"}
          ref={tracker.webcamRef}
          autoPlay
          muted
          playsInline
        />
        {!tracker.showCameraPreview && (
          <div className="privacy-placeholder">
            Camera runs in the background only while emotion tracking is ON.
          </div>
        )}
      </div>

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
    </div>
  );
}

export default function LessonPlayerPage({ user }) {
  const { courseId, classId, lessonId } = useParams();
  const navigate = useNavigate();

  const [lessonsFromApi, setLessonsFromApi] = useState([]);
  const [classLessonsFromApi, setClassLessonsFromApi] = useState([]);
  const [courseLoadError, setCourseLoadError] = useState("");
  const [openModules, setOpenModules] = useState({});
  const [activeTab, setActiveTab] = useState("notes");
  const [lessonStarted, setLessonStarted] = useState(false);

  const [sessionName, setSessionName] = useState("Online Class A");
  const [sessionId, setSessionId] = useState("");
  const [text, setText] = useState("I understand this concept now.");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
  const [discussionMessages, setDiscussionMessages] = useState([]);
  const [isLoadingDiscussion, setIsLoadingDiscussion] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [textFeedbackSent, setTextFeedbackSent] = useState(false);
  const [audioFeedbackSent, setAudioFeedbackSent] = useState(false);
  const [completionSaved, setCompletionSaved] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const [progressUpdateError, setProgressUpdateError] = useState("");
  const [isProgressSyncing, setIsProgressSyncing] = useState(false);
  const lessonVideoRef = useRef(null);
  const lastProgressSyncRef = useRef(0);
  const completionMarkedRef = useRef(false);
  const classScopedCourse = useMemo(() => {
    if (!classId) {
      return null;
    }
    const classLessons = classLessonsFromApi.map(mapAssignedLesson);
    return {
      id: `class-${classId}`,
      title: "Class Lessons",
      subtitle: "Assigned by your teacher",
      modules: [
        {
          id: "assigned-lessons",
          title: "Assigned Lessons",
          items: classLessons,
        },
      ],
    };
  }, [classId, classLessonsFromApi]);

  const course = useMemo(() => {
    if (classId) {
      return classScopedCourse;
    }
    return getCourseById(courseId, lessonsFromApi);
  }, [classId, classScopedCourse, courseId, lessonsFromApi]);
  const allCourseLessons = useMemo(() => getAllCourseLessons(course), [course]);
  const selectedLesson = useMemo(
    () => getLessonById(course, lessonId) || allCourseLessons[0] || null,
    [course, lessonId, allCourseLessons]
  );
  const selectedMedia = useMemo(() => inferLessonMedia(selectedLesson?.content || ""), [selectedLesson]);
  const timelineRows = useMemo(() => buildTimelineRows(selectedLesson), [selectedLesson]);
  const selectedLessonDurationSec = useMemo(
    () => parseLessonDurationSeconds(selectedLesson),
    [selectedLesson]
  );

  const sessionEmotionCounts = useMemo(() => {
    const counts = {};
    for (const entry of discussionMessages) {
      const emotion = entry?.emotion || "unknown";
      counts[emotion] = (counts[emotion] || 0) + 1;
    }
    return counts;
  }, [discussionMessages]);

  const visibleDiscussionMessages = useMemo(
    () => discussionMessages,
    [discussionMessages]
  );

  const emotionTracker = useEmotionTracker({
    userId: user?.id || user?.email || "",
    courseId: classId ? (selectedLesson?.course_id || classId || "") : (course?.id || ""),
    classId: classId || "",
    lessonId: selectedLesson ? String(selectedLesson.lesson_id || "") : "",
    sessionId,
  });
  const watchTracker = useWatchTimeTracker(
    lessonVideoRef,
    sessionId,
    selectedLesson ? String(selectedLesson.lesson_id || "") : "",
    {
      fallbackDurationSec: selectedLessonDurationSec,
      completionThresholdPercent: LESSON_COMPLETION_RULES.watchThresholdPercent,
      externalPlaying: lessonStarted && selectedMedia.type !== "video",
    }
  );
  const attentionStats = useMemo(
    () => ({
      ...(emotionTracker.faceStats || {}),
      userId: user?.id || user?.email || "",
      isPlaying: watchTracker.isPlaying,
      tabVisible: watchTracker.isTabVisible,
      watchedSeconds: watchTracker.watchedSeconds,
    }),
    [emotionTracker.faceStats, user?.id, user?.email, watchTracker.isPlaying, watchTracker.isTabVisible, watchTracker.watchedSeconds]
  );
  const attentionTracker = useAttentionTracker(
    sessionId,
    selectedLesson ? String(selectedLesson.lesson_id || "") : "",
    attentionStats
  );
  const watchProgressCompleted = watchTracker.completionPercent >= LESSON_COMPLETION_RULES.watchThresholdPercent;
  const faceEmotionCaptured = emotionTracker.hasFaceCapture || emotionTracker.faceEventsSent > 0;
  const hasModalityCapture = faceEmotionCaptured || textFeedbackSent || audioFeedbackSent;
  const lessonCompleted = watchProgressCompleted
    && (
      LESSON_COMPLETION_RULES.requireAtLeastOneModality
        ? hasModalityCapture
        : true
    );
  const progressSyncAllowed = Boolean(classId || selectedLesson?.source === "api" || selectedLesson?.course_id);

  async function loadLessonDiscussion(lessonIdValue, classIdValue = "") {
    if (!lessonIdValue) {
      setDiscussionMessages([]);
      return;
    }
    setIsLoadingDiscussion(true);
    try {
      const [commentRowsResult, voiceRowsResult] = await Promise.all([
        fetchLessonComments({ lessonId: lessonIdValue, classId: classIdValue || "", limit: 200 }),
        fetchLessonVoiceFeedback({ lessonId: lessonIdValue, classId: classIdValue || "", limit: 200 }),
      ]);
      const commentRows = Array.isArray(commentRowsResult) ? commentRowsResult : [];
      let voiceRows = Array.isArray(voiceRowsResult) ? voiceRowsResult : [];
      if (classIdValue && voiceRows.length === 0) {
        const legacyVoiceRows = await fetchLessonVoiceFeedback({
          lessonId: lessonIdValue,
          classId: "",
          limit: 200,
        });
        if (Array.isArray(legacyVoiceRows) && legacyVoiceRows.length > 0) {
          voiceRows = legacyVoiceRows;
        }
      }

      const normalizedComments = commentRows.map((row) => ({
        id: `comment-${row.id}`,
        sessionId: row.session_id || "",
        text: row.text || "",
        emotion: row.predicted_emotion || "unknown",
        confidence: Number(row.confidence || 0),
        timestamp: row.created_at,
        authorName: row.user_name || row.user_id || "Student",
      }));
      const normalizedVoice = voiceRows.map((row) => ({
        id: `voice-${row.id}`,
        sessionId: row.session_id || "",
        text: `[Voice feedback] ${row.file_ref || "recording"}`,
        emotion: row.predicted_emotion || "unknown",
        confidence: Number(row.confidence || 0),
        timestamp: row.created_at,
        authorName: row.user_name || row.user_id || "Student",
      }));
      const merged = [...normalizedComments, ...normalizedVoice].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setDiscussionMessages(merged);
    } catch (error) {
      setStatusMessage(error.message || "Failed to load lesson discussion.");
    } finally {
      setIsLoadingDiscussion(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadLessons() {
      const token = localStorage.getItem("token") || "";
      try {
        if (classId) {
          const data = await fetchClassLessons(classId);
          if (!isMounted) {
            return;
          }
          setClassLessonsFromApi(Array.isArray(data) ? data : []);
          setLessonsFromApi([]);
          setCourseLoadError("");
          return;
        }

        const data = await apiRequest("/lessons", "GET", null, token);
        if (!isMounted) {
          return;
        }
        setLessonsFromApi(Array.isArray(data) ? data : []);
        setClassLessonsFromApi([]);
        setCourseLoadError("");
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setCourseLoadError(error.message);
      }
    }

    loadLessons();
    return () => {
      isMounted = false;
    };
  }, [classId]);

  useEffect(() => {
    const lessonKey = selectedLesson ? String(selectedLesson.lesson_id || "") : "";
    if (!lessonKey) {
      setDiscussionMessages([]);
      return;
    }
    loadLessonDiscussion(lessonKey, classId || "");
  }, [selectedLesson?.lesson_id, classId]);

  useEffect(() => {
    if (!course?.modules?.length) {
      return;
    }
    setOpenModules((current) => {
      const next = { ...current };
      for (const module of course.modules) {
        if (!(module.id in next)) {
          next[module.id] = true;
        }
      }
      return next;
    });
  }, [course]);

  useEffect(() => {
    if (!course || !selectedLesson) {
      return;
    }
    if (String(selectedLesson.lesson_id) !== String(lessonId)) {
      if (classId) {
        navigate(`/student/classes/${classId}/lessons/${selectedLesson.lesson_id}`, { replace: true });
        return;
      }
      navigate(`/student/courses/${course.id}/lessons/${selectedLesson.lesson_id}`, { replace: true });
    }
  }, [course, selectedLesson, lessonId, classId, navigate]);

  useEffect(() => {
    setLessonStarted(false);
    emotionTracker.resetLessonStart();
    setTextFeedbackSent(false);
    setAudioFeedbackSent(false);
    setCompletionSaved(false);
    setCompletionMessage("");
    setProgressUpdateError("");
    completionMarkedRef.current = false;
    lastProgressSyncRef.current = 0;
  }, [selectedLesson?.lesson_id]);

  useEffect(() => {
    if (!sessionId) {
      setCompletionSaved(false);
      setCompletionMessage("");
      setProgressUpdateError("");
      completionMarkedRef.current = false;
      lastProgressSyncRef.current = 0;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!course || !selectedLesson) {
      setNotesValue("");
      return;
    }
    const key = `meld_notes_${course.id}_${selectedLesson.lesson_id}`;
    setNotesValue(localStorage.getItem(key) || "");
  }, [course, selectedLesson]);

  useEffect(() => {
    if (!course || !selectedLesson) {
      return;
    }
    const key = `meld_notes_${course.id}_${selectedLesson.lesson_id}`;
    localStorage.setItem(key, notesValue);
  }, [course, selectedLesson, notesValue]);

  function toggleModule(moduleId) {
    setOpenModules((current) => ({ ...current, [moduleId]: !current[moduleId] }));
  }

  function selectLesson(nextLessonId) {
    if (!course) {
      return;
    }
    if (classId) {
      navigate(`/student/classes/${classId}/lessons/${nextLessonId}`);
      return;
    }
    navigate(`/student/courses/${course.id}/lessons/${nextLessonId}`);
  }

  function handleStartLesson() {
    if (!lessonStarted) {
      setLessonStarted(true);
    }
    emotionTracker.handleLessonPlay();
  }

  async function syncLessonProgress({ force = false, completedOverride = null } = {}) {
    const selectedLessonId = selectedLesson ? String(selectedLesson.lesson_id || "") : "";
    if (!sessionId || !selectedLessonId || !progressSyncAllowed) {
      return;
    }
    if (isProgressSyncing) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastProgressSyncRef.current < 15000) {
      return;
    }

    const payload = {
      session_id: sessionId,
      watched_time_sec: Math.max(0, Math.floor(watchTracker.watchedSeconds || 0)),
      completion_percent: Number((watchTracker.completionPercent || 0).toFixed(2)),
      completed: completedOverride === null ? lessonCompleted : Boolean(completedOverride),
      class_id: classId || null,
      face_emotion_captured: faceEmotionCaptured,
      text_feedback_sent: textFeedbackSent,
      audio_feedback_sent: audioFeedbackSent,
      watch_progress_completed: watchProgressCompleted,
    };

    try {
      setIsProgressSyncing(true);
      await updateLessonProgress(selectedLessonId, payload);
      lastProgressSyncRef.current = Date.now();
      setProgressUpdateError("");
      console.debug("[MELD][Progress] synced", {
        lessonId: selectedLessonId,
        sessionId,
        completionPercent: payload.completion_percent,
        completed: payload.completed,
      });
    } catch (error) {
      setProgressUpdateError(error?.message || "Failed to sync lesson progress.");
    } finally {
      setIsProgressSyncing(false);
    }
  }

  async function startSession() {
    const token = localStorage.getItem("token") || "";
    try {
      const data = await apiRequest(
        "/sessions/start",
        "POST",
        {
          session_name: sessionName,
          course: classId ? (selectedLesson?.course_id || classId) : (course?.id || null),
          class_id: classId || null,
          lesson_id: selectedLesson ? String(selectedLesson.lesson_id || "") : null,
        },
        token
      );
      setSessionId(data.id);
      setTextFeedbackSent(false);
      setAudioFeedbackSent(false);
      setCompletionSaved(false);
      setCompletionMessage("");
      completionMarkedRef.current = false;
      lastProgressSyncRef.current = 0;
      setStatusMessage(`Session started: ${data.id}`);
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function submitDiscussionMessage() {
    if (!sessionId) {
      setStatusMessage("Start a session first before sending discussion messages.");
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setStatusMessage("Type a comment or command first.");
      return;
    }

    const token = localStorage.getItem("token") || "";
    setIsSubmittingMessage(true);

    try {
      const timestamp = new Date().toISOString();
      const data = await apiRequest(
        "/emotions/text",
        "POST",
        {
          userId: user?.id || user?.email || "",
          courseId: classId ? (selectedLesson?.course_id || classId) : (course?.id || ""),
          classId: classId || null,
          lessonId: selectedLesson ? String(selectedLesson.lesson_id) : "",
          sessionId,
          text: trimmed,
          timestamp,
        },
        token
      );

      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sessionId,
        text: trimmed,
        timestamp,
        emotion: data.emotion,
        confidence: Number(data.confidence || 0),
        suggestion: data.suggestion || "",
      };

      setDiscussionMessages((current) => [entry, ...current]);

      setText("");
      setStatusMessage(`Tagged as ${data.emotion} (${Number(data.confidence || 0).toFixed(2)}).`);
      setTextFeedbackSent(true);
      void syncLessonProgress({ force: true });
      console.debug("[MELD][Text] submitted", {
        lessonId: selectedLesson ? String(selectedLesson.lesson_id) : "",
        sessionId,
        emotion: data?.emotion,
      });
    } catch (error) {
      const value = String(error?.message || "");
      if (value.toLowerCase().includes("network") || value.toLowerCase().includes("failed")) {
        setStatusMessage("Unable to submit text emotion right now. Check connection and try again.");
      } else {
        setStatusMessage(value || "Unable to submit text emotion.");
      }
    } finally {
      setIsSubmittingMessage(false);
    }
  }

  function handleVoicePrediction({ emotion, confidence, timestamp }) {
    if (!sessionId) {
      return;
    }

    const entry = {
      id: `voice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sessionId,
      text: "[Voice feedback recording]",
      timestamp: timestamp || new Date().toISOString(),
      emotion: emotion || "neutral",
      confidence: Number(confidence || 0),
      suggestion: "Voice emotion detected from recorded student feedback.",
      messageType: "voice",
    };

    setDiscussionMessages((current) => [entry, ...current]);
    setAudioFeedbackSent(true);
    void syncLessonProgress({ force: true });
  }

  useEffect(() => {
    if (!sessionId || !selectedLesson?.lesson_id) {
      return;
    }
    void syncLessonProgress();
  }, [
    sessionId,
    selectedLesson?.lesson_id,
    watchTracker.watchedSeconds,
    watchTracker.completionPercent,
    faceEmotionCaptured,
    textFeedbackSent,
    audioFeedbackSent,
    watchProgressCompleted,
    lessonCompleted,
    progressSyncAllowed,
  ]);

  useEffect(() => {
    if (!lessonCompleted || completionMarkedRef.current) {
      return;
    }
    completionMarkedRef.current = true;
    setCompletionSaved(true);
    setCompletionMessage("Lesson Completed Successfully");
    void syncLessonProgress({ force: true, completedOverride: true });
  }, [lessonCompleted, sessionId, selectedLesson?.lesson_id]);

  if (!course) {
    return (
      <div className="learning-page">
        <div className="card empty-state">
          <h2>Course not found</h2>
          <p>Open the course catalog and select a valid course.</p>
          <Link className="button-link" to="/student">Back to catalog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="learning-page p-0 md:p-4 w-full max-w-[1800px] mx-auto">
      {courseLoadError && <div className="card inline-message mb-4">{courseLoadError}</div>}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content Area (Player + Info + Discussion) */}
        <main className="flex-1 flex flex-col min-w-0 w-full lg:w-2/3 xl:w-3/4">
          
          {selectedLesson ? (
            <>
              {/* THEATER MODE PLAYER */}
              <div className="w-full bg-black rounded-xl overflow-hidden shadow-2xl relative aspect-video flex items-center justify-center">
                {!lessonStarted && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-slate-900/90 to-black/95 z-10 backdrop-blur-sm">
                    <div className="h-16 w-16 bg-brand-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(37,99,235,0.6)] cursor-pointer hover:scale-110 transition-transform" onClick={handleStartLesson}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h4 className="text-3xl font-bold text-white mb-3">Ready to learn?</h4>
                    <p className="text-slate-400 max-w-md mx-auto mb-8 text-sm">
                      Press play to start. Make sure your environment is well-lit for optimal emotion tracking.
                    </p>
                    
                    <div className="flex flex-wrap gap-4 justify-center">
                      {!emotionTracker.trackingEnabled && (
                        <button 
                          type="button" 
                          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-full border border-slate-700 transition-all shadow-lg"
                          onClick={emotionTracker.toggleTracking}
                        >
                          Arm Emotion Tracking
                        </button>
                      )}
                      <button
                        type="button"
                        className="px-6 py-2.5 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 text-sm font-semibold rounded-full border border-brand-500/30 transition-all disabled:opacity-50"
                        onClick={() => void emotionTracker.requestCameraPermission()}
                        disabled={emotionTracker.isRequestingCamera}
                      >
                        {emotionTracker.isRequestingCamera ? "Checking..." : "Allow Camera"}
                      </button>
                    </div>
                  </div>
                )}

                {lessonStarted && selectedMedia.type === "youtube" && (
                  <iframe
                    className="w-full h-full border-0"
                    src={selectedMedia.src}
                    title={`Lesson video: ${selectedLesson.title}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}

                {lessonStarted && selectedMedia.type === "video" && (
                  <video
                    ref={lessonVideoRef}
                    className="w-full h-full object-contain bg-black"
                    controls
                    autoPlay
                    src={selectedMedia.src}
                    onPlay={handleStartLesson}
                  >
                    Your browser does not support video playback.
                  </video>
                )}

                {lessonStarted && selectedMedia.type === "none" && (
                  <div className="text-slate-400 text-sm">
                    No media URL is attached to this lesson yet.
                  </div>
                )}
              </div>

              {/* VIDEO INFO BAR */}
              <div className="mt-4 mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 leading-tight mb-2">{selectedLesson.title}</h1>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
                        {course.title.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-200 leading-none">{course.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{course.subtitle || "Course"}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 glass-panel rounded-full flex items-center gap-2 border-brand-500/20">
                      <span className={`w-2 h-2 rounded-full ${attentionTracker.trackingOn ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-slate-600"}`} />
                      <span className="text-xs font-bold text-slate-300">
                        {attentionTracker.trackingOn ? "Tracking Active" : "Tracking Idle"}
                      </span>
                    </div>
                    <span className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-full border border-slate-700">
                      {selectedLesson.duration || "10 min"}
                    </span>
                  </div>
                </div>
              </div>

              {/* TABS & DESCRIPTION */}
              <div className="glass-panel rounded-2xl p-6">
                <div className="flex w-full border-b border-slate-800 mb-6">
                  {["Notes", "Discussion", "Progress"].map((label) => {
                    const value = label.toLowerCase();
                    const isActive = activeTab === value;
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${isActive ? "border-brand-500 text-brand-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}
                        onClick={() => setActiveTab(value)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {activeTab === "notes" && (
                  <div className="space-y-4 text-slate-300">
                    <p className="text-sm leading-relaxed">{selectedLesson.description}</p>
                    <div className="mt-8">
                      <NotesPanel notesValue={notesValue} setNotesValue={setNotesValue} />
                    </div>
                  </div>
                )}

                {activeTab === "discussion" && (
                  <DiscussionPanel
                    userId={user?.id || user?.email || ""}
                    courseId={course?.id || ""}
                    classId={classId || ""}
                    lessonId={selectedLesson ? String(selectedLesson.lesson_id) : ""}
                    sessionId={sessionId}
                    setSessionId={setSessionId}
                    sessionName={sessionName}
                    setSessionName={setSessionName}
                    startSession={startSession}
                    text={text}
                    setText={setText}
                    submitDiscussionMessage={submitDiscussionMessage}
                    statusMessage={statusMessage}
                    isSubmitting={isSubmittingMessage}
                    discussionMessages={visibleDiscussionMessages}
                    sessionEmotionCounts={sessionEmotionCounts}
                    setStatusMessage={setStatusMessage}
                    onVoicePrediction={handleVoicePrediction}
                  />
                )}

                {activeTab === "progress" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-slate-200">Session Progress</h4>
                      <span className="text-xs font-bold text-brand-400 bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/20">{Number(watchTracker.completionPercent || 0).toFixed(1)}% watched</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(watchTracker.completionPercent || 0)}>
                      <div
                        className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(100, Number(watchTracker.completionPercent || 0))}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className={`p-4 rounded-xl border flex flex-col gap-2 ${faceEmotionCaptured ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800/50 border-slate-700/50 text-slate-500"}`}>
                        <span className="text-xs font-bold uppercase tracking-wider">Face</span>
                        <span className="text-xl">{faceEmotionCaptured ? "✅" : "⏳"}</span>
                      </div>
                      <div className={`p-4 rounded-xl border flex flex-col gap-2 ${textFeedbackSent ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800/50 border-slate-700/50 text-slate-500"}`}>
                        <span className="text-xs font-bold uppercase tracking-wider">Text</span>
                        <span className="text-xl">{textFeedbackSent ? "✅" : "⏳"}</span>
                      </div>
                      <div className={`p-4 rounded-xl border flex flex-col gap-2 ${audioFeedbackSent ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800/50 border-slate-700/50 text-slate-500"}`}>
                        <span className="text-xs font-bold uppercase tracking-wider">Audio</span>
                        <span className="text-xl">{audioFeedbackSent ? "✅" : "⏳"}</span>
                      </div>
                      <div className={`p-4 rounded-xl border flex flex-col gap-2 ${watchProgressCompleted ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800/50 border-slate-700/50 text-slate-500"}`}>
                        <span className="text-xs font-bold uppercase tracking-wider">Watch</span>
                        <span className="text-xl">{watchProgressCompleted ? "✅" : "⏳"}</span>
                      </div>
                    </div>
                    {(lessonCompleted || completionSaved) && (
                      <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-center py-4 rounded-xl font-bold shadow-lg shadow-emerald-500/10 animate-pulse mt-4">
                        Lesson Completed! 🎉
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 glass-panel rounded-2xl min-h-[500px]">
              <div className="w-20 h-20 mb-6 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 shadow-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-200 mb-2">No lesson selected</h3>
              <p className="text-slate-500 text-center max-w-md">Select a lesson from the Up Next sidebar to begin your learning session.</p>
            </div>
          )}
        </main>

        {/* Up Next Sidebar (Like YouTube) */}
        <aside className="w-full lg:w-1/3 xl:w-1/4 flex flex-col gap-6 flex-shrink-0">
          <div className="glass-panel rounded-2xl overflow-hidden shadow-lg border border-slate-700/50">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Up Next</h3>
              <span className="text-xs font-semibold text-brand-400 bg-brand-500/10 px-2 py-1 rounded-md">
                {classId ? "Class" : "Course"}
              </span>
            </div>
            
            <div className="overflow-y-auto max-h-[600px] flex flex-col">
              {(course.modules || []).map((module) => (
                <div key={module.id} className="border-b border-slate-800/50 last:border-0">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors"
                    onClick={() => toggleModule(module.id)}
                  >
                    <span className="text-sm font-bold text-slate-300">{module.title}</span>
                    <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-xs border border-slate-700">{module.items.length}</span>
                  </button>
                  {openModules[module.id] && (
                    <div className="flex flex-col bg-slate-900/50">
                      {module.items.map((lesson, idx) => {
                        const isActive = String(selectedLesson?.lesson_id) === String(lesson.lesson_id);
                        return (
                          <button
                            key={lesson.lesson_id}
                            type="button"
                            className={`w-full flex gap-3 px-4 py-3 text-left transition-all hover:bg-slate-800/80 ${isActive ? "bg-brand-500/10 border-l-2 border-brand-500" : "border-l-2 border-transparent"}`}
                            onClick={() => selectLesson(lesson.lesson_id)}
                          >
                            <div className="relative shrink-0 w-32 h-20 bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                              <div className="absolute inset-0 flex items-center justify-center opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                </svg>
                              </div>
                              <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                {lesson.duration || "10:00"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 py-0.5">
                              <h4 className={`text-sm leading-tight mb-1 line-clamp-2 ${isActive ? "font-bold text-brand-400" : "font-semibold text-slate-200"}`}>
                                {lesson.title}
                              </h4>
                              <p className="text-xs text-slate-500">MELD Learn</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 shadow-lg border border-slate-700/50">
            <ResourcesPanel
              selectedLesson={selectedLesson}
              lessonStarted={lessonStarted}
              onStartLesson={handleStartLesson}
              tracker={emotionTracker}
              watchTracker={watchTracker}
              attentionTracker={attentionTracker}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
