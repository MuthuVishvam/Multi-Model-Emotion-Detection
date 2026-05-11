import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  endLiveClass,
  fetchLiveModalityAnalytics,
  fetchLiveOverallAnalytics,
  fetchLiveStudentsAnalytics,
} from "../services/api";
import { CHART_AXIS_COLOR, CHART_GRID_COLOR, getChartColor } from "../chartColors";
import EmotionFilterBar, {
  buildEmotionFilterOptions,
  formatEmotionLabel,
} from "../components/EmotionFilterBar";
import { getRealtimeBaseUrl } from "../services/realtime";

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

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function LiveEmotionDashboard() {
  const { liveSessionId } = useParams();
  const navigate = useNavigate();

  const [overall, setOverall] = useState(null);
  const [face, setFace] = useState(null);
  const [text, setText] = useState(null);
  const [voice, setVoice] = useState(null);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedEmotion, setSelectedEmotion] = useState("");

  const overallPie = useMemo(
    () => toDistributionData(overall?.emotion_percentages || {}, overall?.emotion_counts || {}),
    [overall]
  );
  const facePie = useMemo(
    () => toDistributionData(face?.emotion_percentages || {}, face?.emotion_counts || {}),
    [face]
  );
  const textBar = useMemo(
    () => Object.entries(text?.emotion_counts || {}).map(([emotion, count]) => ({ emotion, count: Number(count || 0) })),
    [text]
  );
  const voicePie = useMemo(
    () => toDistributionData(voice?.emotion_percentages || {}, voice?.emotion_counts || {}),
    [voice]
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

  async function loadAnalytics(filters = {}) {
    if (!liveSessionId) {
      return;
    }
    setIsLoading(true);
    try {
      const [overallData, faceData, textData, voiceData, studentsData] = await Promise.all([
        fetchLiveOverallAnalytics(liveSessionId, filters),
        fetchLiveModalityAnalytics(liveSessionId, "face", filters),
        fetchLiveModalityAnalytics(liveSessionId, "text", filters),
        fetchLiveModalityAnalytics(liveSessionId, "voice", filters),
        fetchLiveStudentsAnalytics(liveSessionId, filters),
      ]);
      setOverall(overallData || null);
      setFace(faceData || null);
      setText(textData || null);
      setVoice(voiceData || null);
      setStudents(Array.isArray(studentsData?.students) ? studentsData.students : []);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Unable to load live analytics.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEndClass() {
    if (!liveSessionId) {
      return;
    }
    setIsEnding(true);
    try {
      await endLiveClass(liveSessionId);
      setMessage("Live class ended. Showing summary.");
      await loadAnalytics(selectedEmotion ? { emotionLabel: selectedEmotion } : {});
    } catch (error) {
      setMessage(error.message || "Unable to end live class.");
    } finally {
      setIsEnding(false);
    }
  }

  useEffect(() => {
    void loadAnalytics(selectedEmotion ? { emotionLabel: selectedEmotion } : {});
  }, [liveSessionId, selectedEmotion]);

  useEffect(() => {
    if (!liveSessionId) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void loadAnalytics(selectedEmotion ? { emotionLabel: selectedEmotion } : {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [liveSessionId, selectedEmotion]);

  useEffect(() => {
    const sessionId = String(liveSessionId || "").trim();
    if (!sessionId) {
      return undefined;
    }

    const socket = io(getRealtimeBaseUrl(), { transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("teacher-join", { sessionId });
    });
    socket.on("dashboard-update", (payload) => {
      setOverall((current) => ({
        ...(current || {}),
        active_students_count: Number(payload?.active_students_count ?? payload?.students?.length ?? 0),
        dominant_emotion: payload?.dominant_emotion || payload?.dominantEmotion || "unknown",
        low_attention_alerts: Number(payload?.low_attention_alerts ?? payload?.lowAttentionCount ?? 0),
      }));
      if (Array.isArray(payload?.students)) {
        setStudents(payload.students.map((student) => ({
          user_id: student.studentId || student.user_id || student.socketId,
          student_name: student.name || student.username || "Student",
          dominant_emotion: student.emotion || "unknown",
          attention_state: student.lowAttention ? "low_attention" : "focused",
          attention_state_percentages: {
            focused: student.lowAttention ? 0 : 100,
          },
        })));
      }
    });
    socket.on("live-emotion-update", () => {
      void loadAnalytics(selectedEmotion ? { emotionLabel: selectedEmotion } : {});
    });

    return () => socket.disconnect();
  }, [liveSessionId, selectedEmotion]);

  return (
    <div className="learning-page live-dashboard-page">
      <section className="card">
        <p className="eyebrow">Teacher Live Dashboard</p>
        <h2>Live Emotion Dashboard</h2>
        <p className="small-note">Session ID: {liveSessionId}</p>
        <div className="live-control-actions">
          <button type="button" className="secondary" onClick={() => navigate("/teacher/live/control")}>
            Back to Live Control
          </button>
          <button type="button" className="danger" onClick={handleEndClass} disabled={isEnding || overall?.status === "ended"}>
            {isEnding ? "Ending..." : (overall?.status === "ended" ? "Class Ended" : "End Live Class")}
          </button>
        </div>
        {message && <div className="inline-message inline-message-soft">{message}</div>}
      </section>

      <section className="card">
        <EmotionFilterBar
          selectedEmotion={selectedEmotion}
          onSelectEmotion={setSelectedEmotion}
          options={emotionOptions}
          title="Live Emotion Focus"
          description="Choose one emotion and the overall, face, text, voice, and student views will all refresh together."
        />
        <p className="small-note">
          {selectedEmotion
            ? `Showing live analytics for ${formatEmotionLabel(selectedEmotion)}.`
            : "Showing live analytics for all captured emotions."}
        </p>
      </section>

      <section className="live-room-metrics">
        <article className="card metric-pill">
          <span>Active students</span>
          <strong>{Number(overall?.active_students_count || 0)}</strong>
        </article>
        <article className="card metric-pill">
          <span>Dominant emotion</span>
          <strong>{overall?.dominant_emotion || "unknown"}</strong>
        </article>
        <article className="card metric-pill">
          <span>Low-attention alerts</span>
          <strong>{Number(overall?.low_attention_alerts || 0)}</strong>
        </article>
        <article className="card metric-pill">
          <span>Engagement score</span>
          <strong>{Number(overall?.engagement_score || 0).toFixed(1)}</strong>
        </article>
      </section>

      <section className="analytics-modality-grid">
        <article className="card chart-card">
          <h3>Overall Emotions</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={overallPie} dataKey="value" nameKey="label" outerRadius={80} label>
                {overallPie.map((entry, index) => (
                  <Cell key={`overall-${index}`} fill={getChartColor(entry.label, index)} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </article>

        <article className="card chart-card">
          <h3>Face</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={facePie} dataKey="value" nameKey="label" outerRadius={80} label>
                {facePie.map((entry, index) => (
                  <Cell key={`face-${index}`} fill={getChartColor(entry.label, index)} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </article>

        <article className="card chart-card">
          <h3>Text</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={textBar}>
              <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
              <XAxis dataKey="emotion" stroke={CHART_AXIS_COLOR} />
              <YAxis stroke={CHART_AXIS_COLOR} />
              <Tooltip />
              <Bar dataKey="count">
                {textBar.map((entry, index) => (
                  <Cell key={`text-bar-${entry.emotion}-${index}`} fill={getChartColor(entry.emotion, index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="card chart-card">
          <h3>Voice</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={voicePie} dataKey="value" nameKey="label" outerRadius={80} label>
                {voicePie.map((entry, index) => (
                  <Cell key={`voice-${index}`} fill={getChartColor(entry.label, index)} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </article>
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
              <th>Watch time</th>
              <th>Dominant emotion</th>
              <th>Attention state</th>
              <th>No-face count</th>
              <th>Focused %</th>
            </tr>
          </thead>
          <tbody>
            {students.map((row) => (
              <tr key={row.user_id}>
                <td>{row.student_name}</td>
                <td>{Number(row.watched_time_min || 0).toFixed(1)} min</td>
                <td>{row.dominant_emotion || "unknown"}</td>
                <td>{row.attention_state || "unknown"}</td>
                <td>{Number(row.no_face_count || 0)}</td>
                <td>{formatPercent(row.attention_state_percentages?.focused || 0)}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={6}>{isLoading ? "Loading..." : "No live student analytics yet."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
