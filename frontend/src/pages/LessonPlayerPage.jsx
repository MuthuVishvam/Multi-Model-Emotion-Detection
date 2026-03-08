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
        <p className="small-note">{tracker.statusText}</p>
        {!lessonStarted && tracker.trackingEnabled && (
          <p className="small-note">Camera permission will be requested only after you press Play.</p>
        )}
        {tracker.permissionDenied && (
          <p className="small-note">Camera permission was denied. Lesson playback continues without tracking.</p>
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
  }, [selectedLesson?.lesson_id]);

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
          userId: user.email,
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
    } catch (error) {
      setStatusMessage(error.message);
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
  }

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
    <div className="learning-page">
      <div className="lesson-page-header card">
        <div>
          <p className="eyebrow">Lesson Player</p>
          <h2>{course.title}</h2>
          <p>{selectedLesson?.title || "Select a lesson"}</p>
        </div>
        <div className="lesson-page-header__actions">
          <TrackingIndicator tracker={emotionTracker} />
          <div className={attentionTracker.trackingOn ? "tracking-indicator tracking-indicator-on" : "tracking-indicator"}>
            <span className="tracking-indicator__dot" aria-hidden="true" />
            <span>{attentionTracker.trackingOn ? "Tracking on" : "Tracking idle"}</span>
          </div>
          {classId ? (
            <Link className="button-link button-link-secondary" to={`/student/classes/${classId}/lessons`}>
              Class Lessons
            </Link>
          ) : (
            <Link className="button-link button-link-secondary" to={`/student/courses/${course.id}`}>
              Syllabus
            </Link>
          )}
          <Link className="button-link button-link-secondary" to="/student">
            Catalog
          </Link>
        </div>
      </div>

      {courseLoadError && <div className="card inline-message">{courseLoadError}</div>}

      <div className="lesson-player-layout">
        <aside className="card lesson-sidebar">
          <div className="lesson-sidebar__section">
            <p className="eyebrow">Course Sections</p>
            <h3>{course.title}</h3>
            <p className="small-note">{course.subtitle}</p>
          </div>

          <div className="lesson-sidebar__modules">
            {(course.modules || []).map((module) => (
              <div key={module.id} className="sidebar-module">
                <button
                  type="button"
                  className={openModules[module.id] ? "sidebar-module__trigger active" : "sidebar-module__trigger"}
                  onClick={() => toggleModule(module.id)}
                >
                  <span>{module.title}</span>
                  <span>{module.items.length}</span>
                </button>
                {openModules[module.id] && (
                  <ul className="lesson-list">
                    {module.items.map((lesson) => (
                      <li key={lesson.lesson_id}>
                        <button
                          type="button"
                          className={String(selectedLesson?.lesson_id) === String(lesson.lesson_id) ? "lesson-btn active" : "lesson-btn"}
                          onClick={() => selectLesson(lesson.lesson_id)}
                        >
                          <span className="lesson-btn__title">{lesson.title}</span>
                          <span className="lesson-btn__meta">{lesson.duration || "10 min"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </aside>

        <main className="card lesson-main">
          {selectedLesson ? (
            <>
              <div className="lesson-main__header">
                <div>
                  <h3>{selectedLesson.title}</h3>
                  <p>{selectedLesson.description}</p>
                </div>
                <span className="lesson-duration-pill">{selectedLesson.duration || "10 min"}</span>
              </div>

              <div className="player-frame">
                {!lessonStarted && (
                  <div className="lesson-start-panel">
                    <h4>Ready to start this lesson?</h4>
                    <p>
                      Press Play to start the lesson. If emotion tracking is enabled, camera permission is requested at
                      this moment only.
                    </p>
                    <div className="lesson-start-panel__actions">
                      <button type="button" onClick={handleStartLesson}>Play</button>
                      {!emotionTracker.trackingEnabled && (
                        <button type="button" className="secondary" onClick={emotionTracker.toggleTracking}>
                          Arm Emotion Tracking
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {lessonStarted && selectedMedia.type === "youtube" && (
                  <iframe
                    className="lesson-iframe"
                    src={selectedMedia.src}
                    title={`Lesson video: ${selectedLesson.title}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}

                {lessonStarted && selectedMedia.type === "video" && (
                  <video
                    ref={lessonVideoRef}
                    className="lesson-video"
                    controls
                    src={selectedMedia.src}
                    onPlay={handleStartLesson}
                  >
                    Your browser does not support video playback.
                  </video>
                )}

                {lessonStarted && selectedMedia.type === "link" && (
                  <div className="result-panel">
                    <p>This URL is not a direct video file.</p>
                    <p>
                      Open lesson link:{" "}
                      <a href={selectedMedia.src} target="_blank" rel="noreferrer" onClick={handleStartLesson}>
                        {selectedMedia.src}
                      </a>
                    </p>
                  </div>
                )}

                {lessonStarted && selectedMedia.type === "none" && (
                  <div className="privacy-placeholder">
                    No media URL is attached to this lesson yet. Use the teacher dashboard to post a video URL.
                  </div>
                )}
              </div>

              <section className="timeline-card">
                <div className="section-header-row">
                  <h4>Timeline</h4>
                  <span>{playbackProgress}% reviewed</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={playbackProgress}
                  onChange={(event) => setPlaybackProgress(Number(event.target.value))}
                />
                <div className="timeline-list">
                  {timelineRows.map((row) => (
                    <div key={`${row.time}-${row.label}`} className="timeline-row">
                      <span className="timeline-row__time">{row.time}</span>
                      <div>
                        <p className="timeline-row__label">{row.label}</p>
                        <p className="timeline-row__detail">{row.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="empty-state">
              <h3>No lesson selected</h3>
              <p>Select a lesson from the left sidebar to begin.</p>
            </div>
          )}
        </main>

        <aside className="card lesson-side-panel">
          <div className="tab-row">
            {["Discussion", "Notes", "Resources"].map((label) => {
              const value = label.toLowerCase();
              return (
                <button
                  key={label}
                  type="button"
                  className={activeTab === value ? "tab-btn active" : "tab-btn"}
                  onClick={() => setActiveTab(value)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {activeTab === "discussion" && (
            <DiscussionPanel
              userId={user.email}
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

          {activeTab === "notes" && (
            <NotesPanel notesValue={notesValue} setNotesValue={setNotesValue} />
          )}

          {activeTab === "resources" && (
            <ResourcesPanel
              selectedLesson={selectedLesson}
              lessonStarted={lessonStarted}
              onStartLesson={handleStartLesson}
              tracker={emotionTracker}
              watchTracker={watchTracker}
              attentionTracker={attentionTracker}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

