import { useEffect, useMemo, useState } from "react";
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
  fetchLessonStudentsAnalytics,
  fetchMyClasses,
} from "../services/api";

const PIE_COLORS = ["#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#f97316", "#ef4444", "#8b5cf6", "#64748b"];

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

function StudentDetailModal({ student, onClose }) {
  if (!student) {
    return null;
  }

  const timelineData = (student.timeline || []).map((row) => ({
    minute: row.minute,
    emotion_total: Number(row.emotion_total || 0),
    focused: Number(row.attention_counts?.focused || 0),
    no_face: Number(row.attention_counts?.no_face || 0),
    away: Number(row.attention_counts?.away || 0),
    idle: Number(row.attention_counts?.idle || 0),
  }));

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <section className="card modal-card analytics-student-modal" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="section-header-row">
          <h3>{student.student_name}</h3>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>

        <div className="analytics-summary-grid">
          <div className="chart-card">
            <p className="small-note">Dominant overall</p>
            <strong>{student.dominant_emotion_overall || "unknown"}</strong>
          </div>
          <div className="chart-card">
            <p className="small-note">Completion</p>
            <strong>{formatPercent(student.completion_percent)}</strong>
          </div>
          <div className="chart-card">
            <p className="small-note">Last seen</p>
            <strong>{formatDateTime(student.last_seen)}</strong>
          </div>
        </div>

        <div className="chart-card">
          <h4>Emotion + Attention Timeline</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="minute" minTickGap={20} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="emotion_total" stroke="#2563eb" strokeWidth={2} />
              <Line type="monotone" dataKey="focused" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="no_face" stroke="#f97316" />
              <Line type="monotone" dataKey="away" stroke="#ef4444" />
              <Line type="monotone" dataKey="idle" stroke="#8b5cf6" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="analytics-detail-grid">
          <div className="chart-card">
            <h4>Text Comments</h4>
            <div className="analytics-list-scroll">
              {(student.text_comments || []).map((item, index) => (
                <article key={`${item.timestamp}-${index}`} className="analytics-list-item">
                  <p>{item.comment}</p>
                  <p className="small-note">
                    {formatDateTime(item.timestamp)} | {item.emotion_label} ({Number(item.confidence || 0).toFixed(2)})
                  </p>
                </article>
              ))}
              {(student.text_comments || []).length === 0 && <p className="small-note">No text comments.</p>}
            </div>
          </div>

          <div className="chart-card">
            <h4>Voice Feedback</h4>
            <div className="analytics-list-scroll">
              {(student.voice_feedback || []).map((item, index) => (
                <article key={`${item.timestamp}-${index}`} className="analytics-list-item">
                  <p>{item.feedback}</p>
                  <p className="small-note">
                    {formatDateTime(item.timestamp)} | {item.emotion_label} ({Number(item.confidence || 0).toFixed(2)})
                  </p>
                </article>
              ))}
              {(student.voice_feedback || []).length === 0 && <p className="small-note">No voice feedback.</p>}
            </div>
          </div>
        </div>

        <div className="chart-card">
          <h4>Flags</h4>
          <div className="analytics-flags">
            {(student.flags || []).map((flag) => (
              <span key={flag} className="emotion-count-chip">{flag}</span>
            ))}
            {(student.flags || []).length === 0 && <p className="small-note">No flags for this student.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function TeacherDashboardPage() {
  const [classes, setClasses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [overall, setOverall] = useState(null);
  const [face, setFace] = useState(null);
  const [text, setText] = useState(null);
  const [voice, setVoice] = useState(null);
  const [students, setStudents] = useState([]);
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
    }),
    [selectedClassId, startDate, endDate]
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
      return;
    }

    setIsLoadingAnalytics(true);
    try {
      const [overallData, faceData, textData, voiceData, studentData] = await Promise.all([
        fetchLessonOverallAnalytics(selectedLessonId, filters),
        fetchLessonModalityAnalytics(selectedLessonId, "face", filters),
        fetchLessonModalityAnalytics(selectedLessonId, "text", filters),
        fetchLessonModalityAnalytics(selectedLessonId, "voice", filters),
        fetchLessonStudentsAnalytics(selectedLessonId, filters),
      ]);

      setOverall(overallData);
      setFace(faceData);
      setText(textData);
      setVoice(voiceData);
      setStudents(Array.isArray(studentData?.students) ? studentData.students : []);
      setMessage("");
    } catch (error) {
      setOverall(null);
      setFace(null);
      setText(null);
      setVoice(null);
      setStudents([]);
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
    loadAnalytics();
  }, [selectedClassId, selectedLessonId, isLoadingLessons]);

  function handleApplyFilters() {
    loadAnalytics({
      classId: selectedClassId,
      startAt: buildIsoStart(startDate),
      endAt: buildIsoEnd(endDate),
    });
  }

  function handleResetDateRange() {
    setStartDate("");
    setEndDate("");
    loadAnalytics({ classId: selectedClassId, startAt: "", endAt: "" });
  }

  return (
    <div className="learning-page teacher-analytics-page teacher-dashboard-page">
      <section className="card">
        <p className="eyebrow">Teacher Dashboard</p>
        <h2>Multi-modal Lesson Dashboard</h2>
        <p className="small-note">Filter by class, lesson, and date range to review engagement and per-student drilldowns.</p>

        <div className="teacher-analytics-filters">
          <label>
            Class
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              disabled={isLoadingClasses}
            >
              <option value="">Select class</option>
              {classes.map((row) => (
                <option key={row.class_id} value={String(row.class_id)}>
                  {row.class_name} ({row.section})
                </option>
              ))}
            </select>
          </label>

          <label>
            Lesson
            <select
              value={selectedLessonId}
              onChange={(event) => setSelectedLessonId(event.target.value)}
              disabled={!selectedClassId || isLoadingLessons}
            >
              <option value="">Select lesson</option>
              {lessons.map((row) => (
                <option key={row.lesson_id} value={String(row.lesson_id)}>
                  {row.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            Start Date
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>

          <label>
            End Date
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>

          <div className="teacher-analytics-filter-actions">
            <button onClick={handleApplyFilters} disabled={!selectedLessonId || isLoadingAnalytics}>
              {isLoadingAnalytics ? "Loading..." : "Apply Filters"}
            </button>
            <button className="secondary" onClick={handleResetDateRange} disabled={!selectedLessonId || isLoadingAnalytics}>
              Clear Dates
            </button>
          </div>
        </div>

        {selectedLesson && (
          <p className="small-note">
            Showing analytics for <strong>{selectedLesson.title}</strong>.
          </p>
        )}
      </section>

      {message && <div className="card inline-message">{message}</div>}

      {(isLoadingClasses || isLoadingLessons) && (
        <section className="card">
          <p>Loading classes and lessons...</p>
        </section>
      )}

      {selectedLessonId && (
        <>
          <section className="analytics-summary-grid">
            <div className="chart-card">
              <h3>Combined Emotions</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={overallPieData} dataKey="value" nameKey="label" outerRadius={85} label />
                  {overallPieData.map((_, index) => (
                    <Cell key={`overall-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card analytics-score-card">
              <h3>Engagement Score</h3>
              <p className="analytics-score-number">{Number(overall?.engagement_score || 0).toFixed(1)}</p>
              <p className="small-note">Dominant emotion: {overall?.dominant_emotion || "unknown"}</p>
              <p className="small-note">Events: {overall?.total_events || 0}</p>
            </div>

            <div className="chart-card">
              <h3>Attention Summary</h3>
              <div className="analytics-attention-stack">
                {attentionSummaryData.map((row) => (
                  <div key={row.label}>
                    <div className="section-header-row">
                      <span>{row.label}</span>
                      <span>{formatPercent(row.value)}</span>
                    </div>
                    <div className="analytics-progress">
                      <div className="analytics-progress-fill" style={{ width: `${Math.min(100, row.value)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="analytics-modality-grid">
            <div className="chart-card">
              <h3>Face</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={facePieData} dataKey="value" nameKey="label" outerRadius={75} label />
                  {facePieData.map((_, index) => (
                    <Cell key={`face-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={faceTimelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="minute" minTickGap={20} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} />
                  {faceEmotionLines.map((emotion, index) => (
                    <Line key={emotion} type="monotone" dataKey={emotion} stroke={PIE_COLORS[(index + 2) % PIE_COLORS.length]} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>Text</h3>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={textBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="emotion" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={textPieData} dataKey="value" nameKey="label" outerRadius={70} label />
                  {textPieData.map((_, index) => (
                    <Cell key={`text-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
              <h4>Top Negative Comments</h4>
              <div className="analytics-list-scroll">
                {(text?.top_negative_comments || []).map((item, index) => (
                  <article key={`${item.timestamp}-${index}`} className="analytics-list-item">
                    <p>{item.comment}</p>
                    <p className="small-note">
                      {item.student_name} | {item.emotion_label} ({Number(item.confidence || 0).toFixed(2)})
                    </p>
                  </article>
                ))}
                {(text?.top_negative_comments || []).length === 0 && <p className="small-note">No negative comments.</p>}
              </div>
            </div>

            <div className="chart-card">
              <h3>Voice</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={voicePieData} dataKey="value" nameKey="label" outerRadius={80} label />
                  {voicePieData.map((_, index) => (
                    <Cell key={`voice-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
              <h4>Voice Feedback</h4>
              <div className="analytics-list-scroll">
                {(voice?.feedback_items || []).map((item, index) => (
                  <article key={`${item.timestamp}-${index}`} className="analytics-list-item">
                    <p>{item.feedback}</p>
                    <p className="small-note">
                      {formatDateTime(item.timestamp)} | {item.student_name} | {item.emotion_label}
                    </p>
                  </article>
                ))}
                {(voice?.feedback_items || []).length === 0 && <p className="small-note">No voice feedback.</p>}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="section-header-row">
              <h3>Students</h3>
              <span>{students.length} students</span>
            </div>
            <table className="student-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Watched (min)</th>
                  <th>Completion %</th>
                  <th>Overall</th>
                  <th>Face</th>
                  <th>Text</th>
                  <th>Voice</th>
                  <th>Attention Summary</th>
                  <th>Last Seen</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((row) => (
                  <tr key={row.user_id}>
                    <td>{row.student_name}</td>
                    <td>{Number(row.watched_time_min || 0).toFixed(1)}</td>
                    <td>{formatPercent(row.completion_percent)}</td>
                    <td>{row.dominant_emotion_overall || row.dominant_emotion}</td>
                    <td>{row.dominant_face_emotion}</td>
                    <td>{row.dominant_text_emotion}</td>
                    <td>{row.dominant_voice_emotion}</td>
                    <td>{row.attention_state_summary || "-"}</td>
                    <td>{formatDateTime(row.last_seen)}</td>
                    <td>
                      <button className="secondary" onClick={() => setSelectedStudent(row)}>
                        View Student Details
                      </button>
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={10}>No student analytics data for this lesson.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}

      <StudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
    </div>
  );
}

