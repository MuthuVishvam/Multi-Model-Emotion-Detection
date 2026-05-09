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
  if (!dateValue) return "";
  return `${dateValue}T00:00:00Z`;
}

function buildIsoEnd(dateValue) {
  if (!dateValue) return "";
  return `${dateValue}T23:59:59Z`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatPercent(value) {
  if (value === null || value === undefined) return "0%";
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

  const overallPieData = useMemo(() => toDistributionData(overall?.emotion_percentages || {}, overall?.emotion_counts || {}), [overall]);
  const facePieData = useMemo(() => toDistributionData(face?.emotion_percentages || {}, face?.emotion_counts || {}), [face]);
  const textPieData = useMemo(() => toDistributionData(text?.emotion_percentages || {}, text?.emotion_counts || {}), [text]);
  const voicePieData = useMemo(() => toDistributionData(voice?.emotion_percentages || {}, voice?.emotion_counts || {}), [voice]);

  const faceTimelineData = useMemo(() => toTimelineData(face?.timeline_buckets || []), [face]);
  const faceEmotionLines = useMemo(() => Object.keys(face?.emotion_counts || {}).slice(0, 3), [face]);
  const textBarData = useMemo(() => Object.entries(text?.emotion_counts || {}).map(([emotion, count]) => ({ emotion, count: Number(count || 0) })), [text]);

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
      if (!userId || seenUserIds.has(userId)) continue;
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
      setMessage("Failed to load classes.");
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
      setMessage("Failed to load class lessons.");
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
      setMessage("Failed to load analytics.");
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
    if (!selectedLessonId || !selectedClassId || isLoadingLessons) return;
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
    <div className="max-w-7xl mx-auto space-y-8 p-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-900 border border-slate-800 text-white p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-[-50%] right-[-10%] w-96 h-96 bg-brand-500/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-72 h-72 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase mb-6 border border-slate-700">
            <LayoutDashboard className="w-4 h-4 text-brand-400" />
            Teacher Dashboard
          </span>
          <h1 className="text-4xl sm:text-5xl font-black mb-6 leading-tight tracking-tight">
            Multi-modal Analytics
          </h1>
          <p className="text-slate-400 text-lg mb-8 max-w-xl font-medium">
            Track engagement, attention, and lesson completion across all your classes from a unified real-time workspace.
          </p>

          <div className="flex flex-wrap gap-4 mb-10">
            <div className="px-6 py-4 rounded-2xl bg-slate-800/50 backdrop-blur-md border border-slate-700/50 flex flex-col gap-1">
              <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider">Classes</p>
              <p className="text-3xl font-black text-white">{classes.length}</p>
            </div>
            <div className="px-6 py-4 rounded-2xl bg-slate-800/50 backdrop-blur-md border border-slate-700/50 flex flex-col gap-1">
              <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider">Lessons</p>
              <p className="text-3xl font-black text-white">{lessons.length}</p>
            </div>
            <div className="px-6 py-4 rounded-2xl bg-slate-800/50 backdrop-blur-md border border-slate-700/50 flex flex-col gap-1">
              <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider">Date range</p>
              <p className="text-3xl font-black text-brand-400">{startDate || endDate ? "Custom" : "All time"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all flex items-center gap-2 shadow-lg shadow-brand-500/20" to="/teacher/classes">
              <Users className="w-5 h-5" /> My Classes
            </Link>
            <Link className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold backdrop-blur-md border border-slate-700 transition-all flex items-center gap-2" to="/teacher/lessons">
              <BookOpen className="w-5 h-5" /> Lesson Studio
            </Link>
            <Link className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold backdrop-blur-md border border-slate-700 transition-all flex items-center gap-2" to="/teacher/live/control">
              <Video className="w-5 h-5 text-red-400" /> Go Live
            </Link>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-brand-500" />
            Global Analytics Filters
          </CardTitle>
          <CardDescription>Filter by class, lesson, and date range to drill down into multi-modal engagement metrics.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Class</label>
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                disabled={isLoadingClasses}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-sm focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
              >
                <option value="">Select class</option>
                {classes.map((row) => (
                  <option key={row.class_id} value={String(row.class_id)}>
                    {row.class_name} ({row.section})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lesson</label>
              <select
                value={selectedLessonId}
                onChange={(event) => setSelectedLessonId(event.target.value)}
                disabled={!selectedClassId || isLoadingLessons}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-sm focus:ring-2 focus:ring-brand-500/50 outline-none transition-all disabled:opacity-50"
              >
                <option value="">Select lesson</option>
                {lessons.map((row) => (
                  <option key={row.lesson_id} value={String(row.lesson_id)}>
                    {row.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(event) => setStartDate(event.target.value)} 
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-sm focus:ring-2 focus:ring-brand-500/50 outline-none transition-all css-date-dark"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">End Date</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(event) => setEndDate(event.target.value)} 
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-sm focus:ring-2 focus:ring-brand-500/50 outline-none transition-all css-date-dark"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleApplyFilters} 
              disabled={!selectedLessonId || isLoadingAnalytics}
              className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingAnalytics ? "Syncing Data..." : "Apply Filters"}
            </button>
            <button 
              onClick={handleResetDateRange} 
              disabled={!selectedLessonId || isLoadingAnalytics}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear Dates
            </button>
          </div>

          <div className="pt-6 border-t border-slate-800/50">
            <EmotionFilterBar
              selectedEmotion={selectedEmotion}
              onSelectEmotion={setSelectedEmotion}
              options={emotionOptions}
              title="Targeted Emotion Drilldown"
              description="Isolate a specific emotion (e.g. frustration) across all widgets."
            />
          </div>

          {selectedLesson && (
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4 text-sm text-brand-300 font-medium">
              Actively viewing <strong>{selectedLesson.title}</strong>
              {selectedEmotion ? ` isolated to ${formatEmotionLabel(selectedEmotion)}.` : "."}
            </div>
          )}
        </CardContent>
      </Card>

      {message && <div className="p-4 bg-slate-800 text-brand-300 rounded-xl border border-slate-700">{message}</div>}

      {(isLoadingClasses || isLoadingLessons) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-medium tracking-wide">Synchronizing Platform Data...</p>
          </CardContent>
        </Card>
      )}

      {selectedLessonId && !isLoadingClasses && !isLoadingLessons && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-200">Aggregate Emotions</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={overallPieData} dataKey="value" nameKey="label" outerRadius={85} innerRadius={60} stroke="none" label>
                      {overallPieData.map((entry, index) => (
                        <Cell key={`overall-${index}`} fill={getChartColor(entry.label, index)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="glass-card bg-gradient-to-br from-brand-600 to-indigo-700 border-none shadow-2xl shadow-brand-500/20 relative overflow-hidden flex flex-col p-6">
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <h3 className="text-white/80 font-bold uppercase tracking-wider text-sm mb-4">Engagement Score</h3>
              <div className="mt-auto">
                <p className="text-6xl font-black text-white mb-4">{Number(overall?.engagement_score || 0).toFixed(1)}</p>
                <div className="text-white/80 text-sm font-medium mb-1">Dominant Status: <span className="font-bold text-white uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded ml-2">{overall?.dominant_emotion || "neutral"}</span></div>
                <div className="text-white/60 text-xs">Based on {overall?.total_events || 0} telemetry events</div>
              </div>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-200">Attention Spread</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                {attentionSummaryData.map((row) => (
                  <div key={row.label} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                      <span className="text-slate-400">{row.label.replace('_', ' ')}</span>
                      <span className="text-slate-200">{formatPercent(row.value)}</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
                      <div className={`h-full rounded-full transition-all duration-1000 ${row.label === 'focused' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : row.label === 'away' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-slate-500'}`} style={{ width: `${Math.min(100, row.value)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-base text-slate-200">Syllabus Progress</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={completionPieData} dataKey="value" nameKey="label" outerRadius={70} innerRadius={50} stroke="none" label>
                      {completionPieData.map((entry, index) => (
                        <Cell key={`completion-${index}`} fill={getChartColor(entry.label, index)} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 mt-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cohort</span>
                    <span className="text-white font-black text-lg">{Number(progress?.completion_count || 0)} / {Number(progress?.total_students_with_progress || 0)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Rate</span>
                    <span className="text-emerald-400 font-black text-lg">{formatPercent(progress?.completion_rate_percent || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-slate-200"><Video className="w-4 h-4 text-brand-400" /> WebRTC Facial</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={facePieData} dataKey="value" nameKey="label" outerRadius={85} innerRadius={50} stroke="none" label>
                      {facePieData.map((entry, index) => (
                        <Cell key={`face-${index}`} fill={getChartColor(entry.label, index)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-slate-200"><BookOpen className="w-4 h-4 text-brand-400" /> NLP Text</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={textBarData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="emotion" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                    <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#334155'}} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
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
                <CardTitle className="text-base flex items-center gap-2 text-slate-200"><LayoutDashboard className="w-4 h-4 text-brand-400" /> Audio Sentiment</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={voicePieData} dataKey="value" nameKey="label" outerRadius={85} innerRadius={50} stroke="none" label>
                      {voicePieData.map((entry, index) => (
                        <Cell key={`voice-${index}`} fill={getChartColor(entry.label, index)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-200">Temporal Emotion Trace</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={faceTimelineData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="minute" minTickGap={20} stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                    <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    <Legend wrapperStyle={{fontSize: 12, paddingTop: '10px'}} />
                    <Line type="monotone" dataKey="total" stroke="#f1f5f9" strokeWidth={3} dot={false} />
                    {faceEmotionLines.map((emotion, index) => (
                      <Line key={emotion} type="monotone" dataKey={emotion} stroke={getChartColor(emotion, index + 1)} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-200">Reflective Voice Transcripts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                  {(voice?.feedback_items || []).map((item, index) => (
                    <article key={`${item.timestamp}-${index}`} className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm">
                      <p className="text-slate-200 mb-3 leading-relaxed">"{item.feedback}"</p>
                      <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                        <span className="text-slate-500 font-medium">{formatDateTime(item.timestamp)}</span>
                        <div className="flex gap-2">
                          <span className="px-2.5 py-1 bg-slate-900 rounded-md border border-slate-700 font-bold text-slate-300">{item.student_name}</span>
                          <span className="px-2.5 py-1 bg-brand-500/20 text-brand-400 font-bold rounded-md uppercase tracking-wider text-[10px] border border-brand-500/20">{item.emotion_label}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                  {(voice?.feedback_items || []).length === 0 && <p className="text-sm text-slate-500 italic bg-slate-800/50 p-6 rounded-xl text-center border border-slate-700/50">No voice feedback gathered during this session.</p>}
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="overflow-hidden border-slate-800/80">
            <CardHeader className="bg-slate-900/50 border-b border-slate-800 pb-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white">Student Mastery Roster</CardTitle>
                <span className="px-3 py-1 bg-brand-500/20 text-brand-400 border border-brand-500/20 text-xs font-bold rounded-full uppercase tracking-wider">{students.length} Enrolled</span>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase tracking-wider bg-slate-900/80 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-5 font-bold">Student Identity</th>
                    <th className="px-6 py-5 font-bold">Time Invested</th>
                    <th className="px-6 py-5 font-bold">Mastery %</th>
                    <th className="px-6 py-5 font-bold">Status</th>
                    <th className="px-6 py-5 font-bold">Face Signal</th>
                    <th className="px-6 py-5 font-bold">Text Signal</th>
                    <th className="px-6 py-5 font-bold">Voice Signal</th>
                    <th className="px-6 py-5 font-bold text-right">Drilldown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950">
                  {studentTableRows.map((row) => (
                    <tr key={row.user_id} className="hover:bg-slate-900/80 transition-colors">
                      <td className="px-6 py-5 font-bold text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-xs uppercase">
                            {row.student_name.slice(0, 2)}
                          </div>
                          {row.student_name}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-slate-400 font-medium">{Number((Number(row.watched_time_sec || 0) / 60).toFixed(1))} min</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-brand-500 rounded-full" style={{width: `${row.completion_percent}%`}} />
                          </div>
                          <span className="text-xs font-bold text-slate-300">{formatPercent(row.completion_percent)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {row.lesson_completed ? <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Certified</span> : <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">In Progress</span>}
                      </td>
                      <td className="px-6 py-5 text-slate-400 capitalize font-medium">{row.dominant_face_emotion}</td>
                      <td className="px-6 py-5 text-slate-400 capitalize font-medium">{row.dominant_text_emotion}</td>
                      <td className="px-6 py-5 text-slate-400 capitalize font-medium">{row.dominant_voice_emotion}</td>
                      <td className="px-6 py-5 text-right">
                        <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-colors border border-slate-700" onClick={() => setSelectedStudent(row)}>
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                  {studentTableRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-medium">No telemetry data recorded for this lesson yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          
          <div className="mt-8 mb-12">
            <PowerBIDashboard 
              title="Enterprise Power BI Data Warehouse" 
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
