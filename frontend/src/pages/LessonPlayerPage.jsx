import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";

import {
  apiRequest,
  fetchClassLessons,
  fetchLessonById,
  fetchLessonComments,
  fetchLessonVoiceFeedback,
  updateLessonProgress,
} from "../services/api";
import AudioFeedback from "../components/AudioFeedback";
import CommentSection from "../components/CommentSection";
import LessonPlayer from "../components/LessonPlayer";
import RightSidebar from "../components/RightSidebar";
import { getAllCourseLessons, getCourseById, getLessonById } from "../courseCatalog";
import useAttentionTracker from "../hooks/useAttentionTracker";
import useEmotionTracker from "../hooks/useEmotionTracker";
import useWatchTimeTracker from "../hooks/useWatchTimeTracker";

const COMPLETION_THRESHOLD = 90;

function normalizeLesson(lesson, index = 0) {
  if (!lesson) {
    return null;
  }

  const lessonId = String(lesson?.lesson_id ?? lesson?.lessonId ?? lesson?.id ?? `_lesson_${index + 1}`);
  const durationSec = Number(lesson?.duration_sec || lesson?.durationSec || lesson?.duration_seconds || 0);

  return {
    ...lesson,
    lesson_id: lessonId,
    title: lesson?.title || `Lesson ${index + 1}`,
    description: lesson?.description || "No description has been added for this lesson yet.",
    video_url: lesson?.video_url || lesson?.videoUrl || lesson?.content || "",
    video_embed_url: lesson?.video_embed_url || lesson?.videoEmbedUrl || "",
    media_type: lesson?.media_type || lesson?.mediaType || "",
    duration: lesson?.duration || (durationSec > 0 ? `${Math.max(1, Math.round(durationSec / 60))} min` : "10 min"),
    duration_sec: durationSec,
    course_id: lesson?.course_id || lesson?.courseId || "",
    completed: Boolean(lesson?.completed || lesson?.progress?.completed),
  };
}

function getLessonDurationSeconds(lesson) {
  const numeric = Number(lesson?.duration_sec || lesson?.durationSec || lesson?.duration_seconds || 0);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const match = String(lesson?.duration || "").match(/(\d+)\s*min/i);
  return match ? Number(match[1]) * 60 : 0;
}

function buildSessionName(lesson) {
  const title = String(lesson?.title || "Lesson").slice(0, 80);
  return `Student lesson: ${title}`;
}

function FeedbackSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((item) => (
        <div key={item} className="h-28 animate-pulse rounded-xl border border-slate-800 bg-slate-900/80" />
      ))}
    </div>
  );
}

export default function LessonPlayerPage({ user }) {
  const { courseId, classId, lessonId } = useParams();
  const navigate = useNavigate();
  const lessonVideoRef = useRef(null);
  const lastProgressSyncRef = useRef(0);

  const [lessonsFromApi, setLessonsFromApi] = useState([]);
  const [classLessonsFromApi, setClassLessonsFromApi] = useState([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [commentStatus, setCommentStatus] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [textFeedbackSent, setTextFeedbackSent] = useState(false);
  const [audioFeedbackSent, setAudioFeedbackSent] = useState(false);
  const [lessonPlaybackActive, setLessonPlaybackActive] = useState(false);

  const classCourse = useMemo(() => {
    if (!classId) {
      return null;
    }

    const lessons = classLessonsFromApi.map(normalizeLesson);
    return {
      id: `class-${classId}`,
      title: "Assigned Lessons",
      subtitle: "From your class",
      modules: [{ id: "assigned", title: "Assigned Lessons", items: lessons }],
    };
  }, [classId, classLessonsFromApi]);

  const course = useMemo(() => (
    classId ? classCourse : getCourseById(courseId, lessonsFromApi)
  ), [classId, classCourse, courseId, lessonsFromApi]);

  const assignedLessons = useMemo(
    () => getAllCourseLessons(course).map(normalizeLesson).filter(Boolean),
    [course]
  );

  const selectedLesson = useMemo(() => {
    const fromCourse = getLessonById(course, lessonId);
    return normalizeLesson(fromCourse || assignedLessons[0] || null);
  }, [assignedLessons, course, lessonId]);

  const selectedLessonId = selectedLesson?.lesson_id || "";
  const userId = String(user?.id || user?._id || user?.email || "");

  const watchTracker = useWatchTimeTracker(
    lessonVideoRef,
    sessionId,
    selectedLessonId,
    {
      fallbackDurationSec: getLessonDurationSeconds(selectedLesson),
      completionThresholdPercent: COMPLETION_THRESHOLD,
      externalPlaying: lessonPlaybackActive,
    }
  );

  const emotionTracker = useEmotionTracker({
    userId,
    courseId: selectedLesson?.course_id || course?.id || "",
    classId: classId || "",
    lessonId: selectedLessonId,
    sessionId,
    autoStart: Boolean(userId && selectedLessonId),
  });

  const attentionStats = useMemo(() => ({
    ...(emotionTracker.faceStats || {}),
    userId,
    isPlaying: watchTracker.isPlaying,
    tabVisible: watchTracker.isTabVisible,
    watchedSeconds: watchTracker.watchedSeconds,
  }), [
    emotionTracker.faceStats,
    userId,
    watchTracker.isPlaying,
    watchTracker.isTabVisible,
    watchTracker.watchedSeconds,
  ]);

  useAttentionTracker(sessionId, selectedLessonId, attentionStats);

  async function loadComments(nextLessonId, nextClassId = "") {
    if (!nextLessonId) {
      setComments([]);
      return;
    }

    try {
      const [textRows, voiceRows] = await Promise.all([
        fetchLessonComments({ lessonId: nextLessonId, classId: nextClassId, limit: 100 }),
        fetchLessonVoiceFeedback({ lessonId: nextLessonId, classId: nextClassId, limit: 50 }),
      ]);
      const normalizedText = (Array.isArray(textRows) ? textRows : []).map((row) => ({
        id: `comment-${row.id}`,
        text: row.text || "",
        emotion: row.predicted_emotion || "unknown",
        confidence: Number(row.confidence || 0),
        timestamp: row.created_at,
        authorName: row.user_name || row.user_id || "Student",
      }));
      const normalizedVoice = (Array.isArray(voiceRows) ? voiceRows : []).map((row) => ({
        id: `voice-${row.id}`,
        text: "Audio feedback submitted",
        emotion: row.predicted_emotion || "unknown",
        confidence: Number(row.confidence || 0),
        timestamp: row.created_at,
        authorName: row.user_name || row.user_id || "Student",
      }));
      setComments([...normalizedText, ...normalizedVoice].sort(
        (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      ));
    } catch (error) {
      setCommentStatus(error?.message || "Unable to load comments.");
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadLessons() {
      setIsLoadingLessons(true);
      setLoadError("");
      try {
        if (classId) {
          let data = await fetchClassLessons(classId);
          if ((!Array.isArray(data) || data.length === 0) && lessonId) {
            const singleLesson = await fetchLessonById(lessonId, classId);
            data = singleLesson ? [singleLesson] : [];
          }
          if (isMounted) {
            setClassLessonsFromApi(Array.isArray(data) ? data : []);
            setLessonsFromApi([]);
          }
          return;
        }

        const token = localStorage.getItem("token") || "";
        const data = await apiRequest("/lessons/my", "GET", null, token);
        if (isMounted) {
          setLessonsFromApi(Array.isArray(data) ? data : []);
          setClassLessonsFromApi([]);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error?.message || "Unable to load this lesson.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingLessons(false);
        }
      }
    }

    void loadLessons();

    return () => {
      isMounted = false;
    };
  }, [classId, lessonId]);

  useEffect(() => {
    setCommentText("");
    setCommentStatus("");
    setTextFeedbackSent(false);
    setAudioFeedbackSent(false);
    setLessonPlaybackActive(false);
    lastProgressSyncRef.current = 0;
    emotionTracker.resetLessonStart?.();
    void loadComments(selectedLessonId, classId || "");
  }, [selectedLessonId, classId]);

  useEffect(() => {
    let cancelled = false;

    async function startHiddenSession() {
      if (!selectedLessonId || !userId) {
        setSessionId("");
        return;
      }

      try {
        const token = localStorage.getItem("token") || "";
        const response = await apiRequest(
          "/sessions/start",
          "POST",
          {
            session_name: buildSessionName(selectedLesson),
            course: selectedLesson?.course_id || course?.id || courseId || "",
            class_id: classId || null,
            lesson_id: selectedLessonId,
          },
          token
        );
        if (!cancelled) {
          setSessionId(response.id || response.session_id || "");
        }
      } catch {
        if (!cancelled) {
          setSessionId("");
        }
      }
    }

    void startHiddenSession();

    return () => {
      cancelled = true;
    };
  }, [selectedLessonId, userId, classId, course?.id, courseId]);

  useEffect(() => {
    if (!sessionId || !selectedLessonId) {
      return;
    }

    const now = Date.now();
    if (now - lastProgressSyncRef.current < 10000 && watchTracker.completionPercent < COMPLETION_THRESHOLD) {
      return;
    }
    lastProgressSyncRef.current = now;

    const payload = {
      user_id: userId,
      class_id: classId || null,
      course_id: selectedLesson?.course_id || course?.id || null,
      session_id: sessionId,
      watched_time_sec: watchTracker.watchedSeconds,
      completion_percent: watchTracker.completionPercent,
      completed: watchTracker.completionPercent >= COMPLETION_THRESHOLD,
      face_emotion_captured: emotionTracker.hasFaceCapture || emotionTracker.faceEventsSent > 0,
      text_feedback_sent: textFeedbackSent,
      audio_feedback_sent: audioFeedbackSent,
      watch_progress_completed: watchTracker.completionPercent >= COMPLETION_THRESHOLD,
    };

    void updateLessonProgress(selectedLessonId, payload).catch(() => {});
  }, [
    audioFeedbackSent,
    classId,
    course?.id,
    emotionTracker.faceEventsSent,
    emotionTracker.hasFaceCapture,
    selectedLesson?.course_id,
    selectedLessonId,
    sessionId,
    textFeedbackSent,
    userId,
    watchTracker.completionPercent,
    watchTracker.watchedSeconds,
  ]);

  function selectLesson(nextLessonId) {
    if (!nextLessonId || String(nextLessonId) === String(selectedLessonId)) {
      return;
    }
    const prefix = classId
      ? `/student/classes/${classId}/lessons`
      : `/student/courses/${courseId}/lessons`;
    navigate(`${prefix}/${nextLessonId}`);
  }

  async function submitComment() {
    const text = commentText.trim();
    if (!text || !selectedLessonId || !userId) {
      return;
    }

    setIsSubmittingComment(true);
    setCommentStatus("");
    try {
      const token = localStorage.getItem("token") || "";
      const response = await apiRequest(
        "/emotions/text",
        "POST",
        {
          userId,
          courseId: selectedLesson?.course_id || course?.id || "",
          classId: classId || "",
          lessonId: selectedLessonId,
          sessionId,
          text,
          timestamp: new Date().toISOString(),
        },
        token
      );
      setCommentText("");
      setTextFeedbackSent(true);
      setComments((current) => [
        {
          id: response.comment_id || `local-${Date.now()}`,
          text,
          emotion: response.emotion || "unknown",
          confidence: Number(response.confidence || 0),
          timestamp: response.created_at || new Date().toISOString(),
          authorName: user?.full_name || user?.name || user?.email || "Student",
        },
        ...current,
      ]);
      setCommentStatus("Comment sent.");
    } catch (error) {
      setCommentStatus(error?.message || "Unable to send comment.");
    } finally {
      setIsSubmittingComment(false);
    }
  }

  function handleVoicePrediction(prediction) {
    setAudioFeedbackSent(true);
    setComments((current) => [
      {
        id: prediction?.feedbackId || `voice-${Date.now()}`,
        text: "Audio feedback submitted",
        emotion: prediction?.emotion || "unknown",
        confidence: Number(prediction?.confidence || 0),
        timestamp: prediction?.timestamp || new Date().toISOString(),
        authorName: user?.full_name || user?.name || user?.email || "Student",
      },
      ...current,
    ]);
  }

  function handlePlaybackStart() {
    setLessonPlaybackActive(true);
    emotionTracker.handleLessonPlay();
  }

  if (isLoadingLessons) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <div className="aspect-video animate-pulse rounded-xl bg-slate-900" />
            <div className="h-32 animate-pulse rounded-xl bg-slate-900" />
            <FeedbackSkeleton />
          </div>
          <div className="h-96 animate-pulse rounded-xl bg-slate-900" />
        </div>
      </div>
    );
  }

  if (loadError || !selectedLessonId) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-800 bg-slate-900/85 p-8 text-center">
        <BookOpen className="mx-auto mb-4 h-10 w-10 text-slate-500" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-slate-100">Lesson unavailable</h1>
        <p className="mt-2 text-sm text-slate-400">{loadError || "No lesson was found for this class or course."}</p>
        <Link className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to="/student">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      className="mx-auto max-w-[1500px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
        {!sessionId && (
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Preparing feedback
          </span>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-5">
          <LessonPlayer
            lesson={selectedLesson}
            videoRef={lessonVideoRef}
            onPlaybackStart={handlePlaybackStart}
          />

          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
            <h1 className="text-2xl font-bold leading-tight text-slate-50 sm:text-3xl">{selectedLesson.title}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">{selectedLesson.description}</p>
          </section>

          <CommentSection
            value={commentText}
            onChange={setCommentText}
            onSubmit={submitComment}
            isSubmitting={isSubmittingComment}
            disabled={!sessionId}
            statusMessage={commentStatus}
            comments={comments}
          />

          <AudioFeedback
            userId={userId}
            courseId={selectedLesson?.course_id || course?.id || ""}
            classId={classId || ""}
            lessonId={selectedLessonId}
            sessionId={sessionId}
            onPrediction={handleVoicePrediction}
            onStatusMessage={setCommentStatus}
          />
        </main>

        <RightSidebar
          lessons={assignedLessons}
          activeLessonId={selectedLessonId}
          onSelectLesson={selectLesson}
          cameraRef={emotionTracker.webcamRef}
          cameraState={emotionTracker.cameraState}
          permissionDenied={emotionTracker.permissionDenied}
        />
      </div>
    </motion.div>
  );
}
