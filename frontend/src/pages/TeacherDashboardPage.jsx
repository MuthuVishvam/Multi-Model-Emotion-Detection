import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Users, BookOpen, Video, Calendar, Filter } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchClassLessons,
  fetchLessonModalityAnalytics,
  fetchLessonOverallAnalytics,
  fetchLessonProgressAnalytics,
  fetchLessonStudentsAnalytics,
  fetchMyClasses,
} from "../services/api";
import { CHART_AXIS_COLOR, CHART_GRID_COLOR, getChartColor } from "../chartColors";
import EmotionFilterBar, {
  buildEmotionFilterOptions,
  formatEmotionLabel,
} from "../components/EmotionFilterBar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import PowerBIDashboard from "../powerbi/PowerBIEmbed";
import StudentAnalyticsDashboard from "./StudentAnalyticsDashboard";

function buildIsoStart(dateValue) {
  if (!dateValue) {
    return "";
  }
  return `${dateValue}T00:00:00Z`;
}

function buildIsoEnd(dateValue) {
  if (!dateValue) {
    return "";
  }
  return `${dateValue}T23:59:59Z`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "0%";
  }
  return `${Number(value).toFixed(1)}%`;
}

function toDistributionData(percentages = {}, counts = {}) {
  const keys = Object.keys(percentages || {});
  if (keys.length > 0) {
    return keys.map((label) => ({
      label,
      value: Number(percentages[label] || 0),
      count: Number(counts[label] || 0),
    }));
  }
  return Object.entries(counts || {}).map(([label, count]) => ({
    label,
    value: Number(count || 0),
    count: Number(count || 0),
  }));
}

function toTimelineData(timelineBuckets = []) {
  return timelineBuckets.map((bucket) => ({
    minute: bucket.minute,
    total: Number(bucket.total || 0),
    ...(bucket.emotions || {}),
  }));
}



export default function TeacherDashboardPage() {
  const [classes, setClasses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEmotion, setSelectedEmotion] = useState("");

  const [overall, setOverall] = useState(null);
  const [face, setFace] = useState(null);
  const [text, setText] = useState(null);
  const [voice, setVoice] = useState(null);
  const [students, setStudents] = useState([]);
  const [progress, setProgress] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [message, setMessage] = useState("");

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => String(lesson.lesson_id) === String(selectedLessonId)) || null,
    [lessons, selectedLessonId]
  );

  const analyticsFilters = useMemo(
    () => ({
      classId: selectedClassId,
      startAt: buildIsoStart(startDate),
      endAt: buildIsoEnd(endDate),
      emotionLabel: selectedEmotion,
    }),
    [selectedClassId, startDate, endDate, selectedEmotion]
  );
  const emotionOptions = useMemo(
    () => buildEmotionFilterOptions(
      [
        overall?.emotion_counts,
        face?.emotion_counts,
        text?.emotion_counts,
        voice?.emotion_counts,
      ],
      selectedEmotion
    ),
    [overall, face, text, voice, selectedEmotion]
  );

  const overallPieData = useMemo(
    () => toDistributionData(overall?.emotion_percentages || {}, overall?.emotion_counts || {}),
    [overall]
  );
  const facePieData = useMemo(
    () => toDistributionData(face?.emotion_percentages || {}, face?.emotion_counts || {}),
    [face]
  );
  const textPieData = useMemo(
    () => toDistributionData(text?.emotion_percentages || {}, text?.emotion_counts || {}),
    [text]
  );
  const voicePieData = useMemo(
    () => toDistributionData(voice?.emotion_percentages || {}, voice?.emotion_counts || {}),
    [voice]
  );

  const faceTimelineData = useMemo(() => toTimelineData(face?.timeline_buckets || []), [face]);
  const faceEmotionLines = useMemo(
    () => Object.keys(face?.emotion_counts || {}).slice(0, 3),
    [face]
  );
  const textBarData = useMemo(
    () => Object.entries(text?.emotion_counts || {}).map(([emotion, count]) => ({ emotion, count: Number(count || 0) })),
    [text]
  );

  const attentionSummaryData = useMemo(() => {
    const percentages = overall?.attention_summary?.percentages || {};
    return [
      { label: "focused", value: Number(percentages.focused || 0) },
      { label: "no_face", value: Number(percentages.no_face || 0) },
      { label: "away", value: Number(percentages.away || 0) },
    ];
  }, [overall]);
  const completionPieData = useMemo(() => {
    const total = Number(progress?.total_students_with_progress || 0);
    const completed = Number(progress?.completion_count || 0);
    return [
      { label: "Completed", value: completed },
      { label: "Pending", value: Math.max(0, total - completed) },
    ];
  }, [progress]);
  const studentTableRows = useMemo(() => {
    const progressRows = Array.isArray(progress?.students) ? progress.students : [];
    const progressByUserId = new Map(progressRows.map((row) => [String(row.user_id), row]));
    const rows = [];
    const seenUserIds = new Set();

    for (const row of students) {
      const userId = String(row.user_id || "");
      const progressRow = progressByUserId.get(userId) || null;
      seenUserIds.add(userId);
      rows.push({
        ...row,
        watched_time_sec: Number(progressRow?.watched_time_sec ?? row.watch_time_seconds ?? 0),
        completion_percent: Number(progressRow?.completion_percent ?? row.completion_percent ?? 0),
        lesson_completed: Boolean(progressRow?.lesson_completed ?? row.lesson_completed),
        no_face_detected: Number(progressRow?.no_face_detected ?? row.no_face_detected ?? 0),
      });
    }

    for (const row of progressRows) {
      const userId = String(row.user_id || "");
      if (!userId || seenUserIds.has(userId)) {
        continue;
      }
      rows.push({
        user_id: userId,
        student_name: row.student_name || userId,
        watched_time_sec: Number(row.watched_time_sec || 0),
        watched_time_min: Number((Number(row.watched_time_sec || 0) / 60).toFixed(2)),
        completion_percent: Number(row.completion_percent || 0),
        lesson_completed: Boolean(row.lesson_completed),
        dominant_face_emotion: "unknown",
        dominant_text_emotion: "unknown",
        dominant_voice_emotion: "unknown",
        no_face_detected: Number(row.no_face_detected || 0),
        attention_state_summary: "-",
        last_seen: row.updated_at || null,
      });
    }

    return rows.sort((a, b) => Number(b.completion_percent || 0) - Number(a.completion_percent || 0));
  }, [students, progress]);

  async function loadClasses() {
    setIsLoadingClasses(true);
    try {
      const classRows = await fetchMyClasses();
      const safeRows = Array.isArray(classRows) ? classRows : [];
      setClasses(safeRows);
      const firstClassId = safeRows[0]?.class_id || "";
      setSelectedClassId(firstClassId);
      setMessage("");
    } catch (error) {
      setClasses([]);
      setSelectedClassId("");
      setMessage(error.message || "Failed to load classes.");
    } finally {
      setIsLoadingClasses(false);
    }
  }

  async function loadLessons(classId) {
    if (!classId) {
      setLessons([]);
      setSelectedLessonId("");
      return;
    }
    setIsLoadingLessons(true);
    try {
      const lessonRows = await fetchClassLessons(classId);
      const safeRows = Array.isArray(lessonRows) ? lessonRows : [];
      setLessons(safeRows);
      setSelectedLessonId((current) => (
        safeRows.some((row) => String(row.lesson_id) === String(current))
          ? String(current)
          : String(safeRows[0]?.lesson_id || "")
      ));
      setMessage("");
    } catch (error) {
      setLessons([]);
      setSelectedLessonId("");
      setMessage(error.message || "Failed to load class lessons.");
    } finally {
      setIsLoadingLessons(false);
    }
  }

  async function loadAnalytics(filters = analyticsFilters) {
    if (!selectedLessonId) {
      setOverall(null);
      setFace(null);
      setText(null);
      setVoice(null);
      setStudents([]);
      setProgress(null);
      return;
    }

    setIsLoadingAnalytics(true);
    try {
      const [overallData, faceData, textData, voiceData, studentData, progressData] = await Promise.all([
        fetchLessonOverallAnalytics(selectedLessonId, filters),
        fetchLessonModalityAnalytics(selectedLessonId, "face", filters),
        fetchLessonModalityAnalytics(selectedLessonId, "text", filters),
        fetchLessonModalityAnalytics(selectedLessonId, "voice", filters),
        fetchLessonStudentsAnalytics(selectedLessonId, filters),
        fetchLessonProgressAnalytics(selectedLessonId, filters),
      ]);

      setOverall(overallData);
      setFace(faceData);
      setText(textData);
      setVoice(voiceData);
      setStudents(Array.isArray(studentData?.students) ? studentData.students : []);
      setProgress(progressData || null);
      setMessage("");
    } catch (error) {
      setOverall(null);
      setFace(null);
      setText(null);
      setVoice(null);
      setStudents([]);
      setProgress(null);
      setMessage(error.message || "Failed to load analytics.");
    } finally {
      setIsLoadingAnalytics(false);
    }
  }

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    loadLessons(selectedClassId);
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedLessonId || !selectedClassId || isLoadingLessons) {
      return;
    }
    loadAnalytics(analyticsFilters);
  }, [selectedClassId, selectedLessonId, isLoadingLessons, selectedEmotion]);

  function handleApplyFilters() {
    loadAnalytics(analyticsFilters);
  }

  function handleResetDateRange() {
    setStartDate("");
    setEndDate("");
    loadAnalytics({ classId: selectedClassId, startAt: "", endAt: "", emotionLabel: selectedEmotion });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-8 sm:p-12 shadow-xl">
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full blur-[80px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-72 h-72 bg-blue-500/20 rounded-full blur-[80px]" />
        
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold tracking-wider mb-6 border border-white/10">
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
            TEACHER DASHBOARD
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight">
            Multi-modal Lesson Dashboard
          </h1>
          <p className="text-slate-300 text-lg mb-8 max-w-xl">
            Track engagement, attention, and lesson completion across all your classes from a unified workspace.
          </p>

          <div className="flex flex-wrap gap-4 mb-8">
            <div className="px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <p className="text-sm text-indigo-200 font-medium">Classes</p>
              <p className="text-2xl font-bold">{classes.length}</p>
            </div>
            <div className="px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <p className="text-sm text-indigo-200 font-medium">Lessons</p>
              <p className="text-2xl font-bold">{lessons.length}</p>
            </div>
            <div className="px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <p className="text-sm text-indigo-200 font-medium">Date range</p>
              <p className="text-2xl font-bold text-indigo-400">{startDate || endDate ? "Custom" : "All time"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/30" to="/teacher/classes">
              <Users className="w-4 h-4" /> My Classes
            </Link>
            <Link className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold backdrop-blur-md border border-white/10 transition-colors flex items-center gap-2" to="/teacher/lessons">
              <BookOpen className="w-4 h-4" /> Lesson Studio
            </Link>
            <Link className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold backdrop-blur-md border border-white/10 transition-colors flex items-center gap-2" to="/teacher/live/control">
              <Video className="w-4 h-4" /> Live Control
            </Link>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-500" />
            Analytics Filters
          </CardTitle>
          <CardDescription>Filter by class, lesson, and date range to review engagement and per-student drilldowns.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Class</label>
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                disabled={isLoadingClasses}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              >
                <option value="">Select class</option>
                {classes.map((row) => (
                  <option key={row.class_id} value={String(row.class_id)}>
                    {row.class_name} ({row.section})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Lesson</label>
              <select
                value={selectedLessonId}
                onChange={(event) => setSelectedLessonId(event.target.value)}
                disabled={!selectedClassId || isLoadingLessons}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              >
                <option value="">Select lesson</option>
                {lessons.map((row) => (
                  <option key={row.lesson_id} value={String(row.lesson_id)}>
                    {row.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Start Date</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(event) => setStartDate(event.target.value)} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">End Date</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(event) => setEndDate(event.target.value)} 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button 
              onClick={handleApplyFilters} 
              disabled={!selectedLessonId || isLoadingAnalytics}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingAnalytics ? "Loading..." : "Apply Filters"}
            </button>
            <button 
              onClick={handleResetDateRange} 
              disabled={!selectedLessonId || isLoadingAnalytics}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear Dates
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <EmotionFilterBar
              selectedEmotion={selectedEmotion}
              onSelectEmotion={setSelectedEmotion}
              options={emotionOptions}
              title="Emotion Focus"
              description="Choose one emotion such as boredom or interest and every multimodal dashboard panel will refresh with that same filter."
            />
          </div>

          {selectedLesson && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-sm text-indigo-800">
              Showing analytics for <strong>{selectedLesson.title}</strong>
              {selectedEmotion ? ` with ${formatEmotionLabel(selectedEmotion)} selected.` : "."}
            </div>
          )}
        </CardContent>
      </Card>

      {message && <div className="card inline-message">{message}</div>}

      {(isLoadingClasses || isLoadingLessons) && (
        <section className="card">
          <p>Loading classes and lessons...</p>
        </section>
      )}

      {selectedLessonId && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Combined Emotions</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={overallPieData} dataKey="value" nameKey="label" outerRadius={85} label>
                      {overallPieData.map((entry, index) => (
                        <Cell key={`overall-${index}`} fill={getChartColor(entry.label, index)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-none shadow-md">
              <CardHeader className="pb-2 text-white/90">
                <CardTitle className="text-base font-semibold">Engagement Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-5xl font-black">{Number(overall?.engagement_score || 0).toFixed(1)}</p>
                <div className="text-indigo-100 text-sm mt-2 font-medium">Dominant: <span className="font-bold text-white capitalize">{overall?.dominant_emotion || "unknown"}</span></div>
                <div className="text-indigo-100 text-sm">Events logged: <span className="font-bold text-white">{overall?.total_events || 0}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Attention Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {attentionSummaryData.map((row) => (
                  <div key={row.label} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span className="capitalize text-slate-700">{row.label.replace('_', ' ')}</span>
                      <span className="text-indigo-600">{formatPercent(row.value)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${row.label === 'focused' ? 'bg-emerald-500' : row.label === 'away' ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${Math.min(100, row.value)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Lesson Completion</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={completionPieData} dataKey="value" nameKey="label" outerRadius={60} label>
                      {completionPieData.map((entry, index) => (
                        <Cell key={`completion-${index}`} fill={getChartColor(entry.label, index)} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full flex justify-between items-center text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">Completed</span>
                    <span className="text-slate-900 font-bold">{Number(progress?.completion_count || 0)} / {Number(progress?.total_students_with_progress || 0)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-slate-400">Rate</span>
                    <span className="text-emerald-600 font-bold">{formatPercent(progress?.completion_rate_percent || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Video className="w-4 h-4 text-indigo-500" /> Face Modality</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={facePieData} dataKey="value" nameKey="label" outerRadius={75} label>
                      {facePieData.map((entry, index) => (
                        <Cell key={`face-${index}`} fill={getChartColor(entry.label, index)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-500" /> Text Modality</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={textBarData}>
                    <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
                    <XAxis dataKey="emotion" stroke={CHART_AXIS_COLOR} tick={{fontSize: 12}} />
                    <YAxis stroke={CHART_AXIS_COLOR} tick={{fontSize: 12}} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {textBarData.map((entry, index) => (
                        <Cell key={`text-bar-${entry.emotion}-${index}`} fill={getChartColor(entry.emotion, index)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><LayoutDashboard className="w-4 h-4 text-indigo-500" /> Voice Modality</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={voicePieData} dataKey="value" nameKey="label" outerRadius={80} label>
                      {voicePieData.map((entry, index) => (
                        <Cell key={`voice-${index}`} fill={getChartColor(entry.label, index)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Emotion Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={faceTimelineData}>
                    <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
                    <XAxis dataKey="minute" minTickGap={20} stroke={CHART_AXIS_COLOR} tick={{fontSize: 12}} />
                    <YAxis stroke={CHART_AXIS_COLOR} tick={{fontSize: 12}} />
                    <Tooltip />
                    <Legend wrapperStyle={{fontSize: 12}} />
                    <Line type="monotone" dataKey="total" stroke={getChartColor("total")} strokeWidth={2} dot={false} />
                    {faceEmotionLines.map((emotion, index) => (
                      <Line key={emotion} type="monotone" dataKey={emotion} stroke={getChartColor(emotion, index + 1)} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Text Emotion Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={textPieData} dataKey="value" nameKey="label" outerRadius={85} label>
                      {textPieData.map((entry, index) => (
                        <Cell key={`text-${index}`} fill={getChartColor(entry.label, index)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Voice Feedback Transcripts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {(voice?.feedback_items || []).map((item, index) => (
                    <article key={`${item.timestamp}-${index}`} className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm">
                      <p className="text-slate-800 mb-2">"{item.feedback}"</p>
                      <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                        <span className="text-slate-500">{formatDateTime(item.timestamp)}</span>
                        <span className="px-2 py-1 bg-white rounded border border-slate-200 font-medium text-slate-700">{item.student_name}</span>
                        <span className="font-semibold text-indigo-600 uppercase tracking-wider text-[10px]">{item.emotion_label}</span>
                      </div>
                    </article>
                  ))}
                  {(voice?.feedback_items || []).length === 0 && <p className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded-lg text-center border border-slate-100">No voice feedback.</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-600">Top Negative Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {(text?.top_negative_comments || []).map((item, index) => (
                    <article key={`${item.timestamp}-${index}`} className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                      <p className="text-slate-800 font-medium mb-1">{item.comment}</p>
                      <p className="text-xs text-slate-500 flex justify-between">
                        <span>{item.student_name}</span>
                        <span className="font-semibold text-red-600">{item.emotion_label} ({(Number(item.confidence || 0)*100).toFixed(0)}%)</span>
                      </p>
                    </article>
                  ))}
                  {(text?.top_negative_comments || []).length === 0 && <p className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded-lg text-center border border-slate-100">No negative comments.</p>}
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Student Roster</CardTitle>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">{students.length} students</span>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Student</th>
                    <th className="px-6 py-4 font-semibold">Watched Time</th>
                    <th className="px-6 py-4 font-semibold">Completion</th>
                    <th className="px-6 py-4 font-semibold">Completed</th>
                    <th className="px-6 py-4 font-semibold">Face</th>
                    <th className="px-6 py-4 font-semibold">Text</th>
                    <th className="px-6 py-4 font-semibold">Voice</th>
                    <th className="px-6 py-4 font-semibold">No Face</th>
                    <th className="px-6 py-4 font-semibold">Attention</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentTableRows.map((row) => (
                    <tr key={row.user_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{row.student_name}</td>
                      <td className="px-6 py-4 text-slate-600">{Number((Number(row.watched_time_sec || 0) / 60).toFixed(1))} min</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{width: `${row.completion_percent}%`}} />
                          </div>
                          <span className="text-xs font-medium text-slate-600">{formatPercent(row.completion_percent)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {row.lesson_completed ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Yes</span> : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">No</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600 capitalize">{row.dominant_face_emotion}</td>
                      <td className="px-6 py-4 text-slate-600 capitalize">{row.dominant_text_emotion}</td>
                      <td className="px-6 py-4 text-slate-600 capitalize">{row.dominant_voice_emotion}</td>
                      <td className="px-6 py-4 text-slate-600">{Number(row.no_face_detected || 0)}</td>
                      <td className="px-6 py-4 text-slate-600 capitalize">{row.attention_state_summary || "-"}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors" onClick={() => setSelectedStudent(row)}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {studentTableRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-8 text-center text-slate-500 bg-slate-50/50">No student analytics data for this lesson.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          
          <div className="mt-8">
            <PowerBIDashboard 
              title="MELD Advanced Engagement Analytics (Power BI)" 
              reportId={null} 
              embedUrl={null} 
              accessToken={null} 
              activeFilters={
                selectedEmotion ? [{
                  $schema: "http://powerbi.com/product/schema#basic",
                  target: { table: "EmotionAnalytics", column: "Emotion" },
                  operator: "In",
                  values: [selectedEmotion]
                }] : []
              }
            />
          </div>
        </>
      )}

      {selectedStudent && (
        <StudentAnalyticsDashboard
          studentId={selectedStudent.user_id}
          studentName={selectedStudent.student_name}
          classId={selectedClassId}
          lessonId={selectedLessonId}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
