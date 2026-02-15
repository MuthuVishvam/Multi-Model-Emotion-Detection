import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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

import { API_BASE_URL, apiRequest } from "../api";

export default function TeacherDashboardPage() {
  const [sessionId, setSessionId] = useState("");
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [lessons, setLessons] = useState([]);
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", content: "" });

  const distributionData = useMemo(() => {
    if (!summary) {
      return [];
    }
    return Object.entries(summary.emotion_counts).map(([emotion, count]) => ({ emotion, count }));
  }, [summary]);

  const timelineData = useMemo(() => {
    if (!summary) {
      return [];
    }
    return Object.entries(summary.timeline_buckets).map(([time, count]) => ({ time, count }));
  }, [summary]);

  async function loadSummary() {
    const token = localStorage.getItem("token") || "";
    try {
      const data = await apiRequest(`/dashboard/summary?session_id=${sessionId}`, "GET", null, token);
      setSummary(data);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
      setSummary(null);
    }
  }

  async function loadLessons() {
    const token = localStorage.getItem("token") || "";
    try {
      const data = await apiRequest("/lessons", "GET", null, token);
      setLessons(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createLesson() {
    const token = localStorage.getItem("token") || "";
    try {
      await apiRequest("/lessons", "POST", lessonForm, token);
      setLessonForm({ title: "", description: "", content: "" });
      setMessage("Lesson created.");
      await loadLessons();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteLesson(lessonId) {
    const token = localStorage.getItem("token") || "";
    try {
      await apiRequest(`/lessons/${lessonId}`, "DELETE", null, token);
      setMessage("Lesson deleted.");
      await loadLessons();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function downloadCsv() {
    const token = localStorage.getItem("token") || "";
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/export_csv?session_id=${sessionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error("CSV download failed");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `session_${sessionId}_emotion_logs.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadLessons();
  }, []);

  return (
    <div className="card">
      <h2>Teacher Dashboard</h2>
      <label>Session ID</label>
      <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} />
      <button onClick={loadSummary}>Load Summary</button>
      <button className="secondary" onClick={downloadCsv}>
        Download CSV
      </button>

      {message && <p>{message}</p>}

      {summary && (
        <>
          <div className="stats-row">
            <div className="card stat-card">Engagement Score: {summary.engagement_score}</div>
            <div className="card stat-card">Confusion Index: {summary.confusion_index}</div>
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <h3>Emotion Distribution (Bar)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="emotion" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>Emotion Distribution (Pie)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={distributionData} dataKey="count" nameKey="emotion" outerRadius={90} fill="#0ea5e9" label />
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <h3>Timeline</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Student Table</h3>
            <table className="student-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Top Emotion</th>
                  <th>Engagement Score</th>
                </tr>
              </thead>
              <tbody>
                {summary.student_stats.map((row) => (
                  <tr key={row.student_id}>
                    <td>{row.student_id}</td>
                    <td>{row.top_emotion}</td>
                    <td>{row.engagement_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="chart-card">
        <h3>Lessons</h3>
        <label>Title</label>
        <input
          value={lessonForm.title}
          onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })}
        />
        <label>Description</label>
        <input
          value={lessonForm.description}
          onChange={(event) => setLessonForm({ ...lessonForm, description: event.target.value })}
        />
        <label>Content</label>
        <input
          value={lessonForm.content}
          onChange={(event) => setLessonForm({ ...lessonForm, content: event.target.value })}
        />
        <button onClick={createLesson}>Create Lesson</button>
        <button className="secondary" onClick={loadLessons}>Refresh Lessons</button>

        <table className="student-table lessons-table">
          <thead>
            <tr>
              <th>Lesson ID</th>
              <th>Title</th>
              <th>Created By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => (
              <tr key={lesson.lesson_id}>
                <td>{lesson.lesson_id}</td>
                <td>{lesson.title}</td>
                <td>{lesson.created_by}</td>
                <td>
                  <button className="danger" onClick={() => deleteLesson(lesson.lesson_id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
