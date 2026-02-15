import { useState } from "react";

import { apiRequest } from "../api";

export default function TeacherDashboardPage() {
  const [sessionId, setSessionId] = useState("");
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");

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

  return (
    <div className="card">
      <h2>Teacher Dashboard</h2>
      <label>Session ID</label>
      <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} />
      <button onClick={loadSummary}>Load Summary</button>
      {message && <p>{message}</p>}
      {summary && (
        <div>
          <p>Total logs: {summary.total_logs}</p>
          {Object.entries(summary.emotion_distribution).map(([key, value]) => (
            <div key={key} className="bar" style={{ width: `${Math.max(20, value * 40)}px` }}>
              {key}: {value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
