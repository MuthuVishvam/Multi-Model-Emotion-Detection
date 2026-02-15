import { useMemo, useState } from "react";

import { apiRequest } from "../api";

export default function StudentSessionPage() {
  const [sessionName, setSessionName] = useState("Online Class A");
  const [sessionId, setSessionId] = useState("");
  const [studentId, setStudentId] = useState("student-1");
  const [text, setText] = useState("I understand this concept now.");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");

  const topScores = useMemo(() => {
    if (!result?.scores) {
      return [];
    }
    return Object.entries(result.scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [result]);

  async function startSession() {
    const token = localStorage.getItem("token") || "";
    try {
      const data = await apiRequest("/sessions/start", "POST", { session_name: sessionName }, token);
      setSessionId(data.id);
      setMessage(`Session started: ${data.id}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitUtterance() {
    const token = localStorage.getItem("token") || "";
    try {
      const data = await apiRequest(
        "/emotion/predict_text",
        "POST",
        { session_id: sessionId, student_id: studentId, text },
        token
      );
      setResult(data);
      setMessage("Emotion predicted and stored.");
    } catch (error) {
      setMessage(error.message);
      setResult(null);
    }
  }

  return (
    <div className="card">
      <h2>Student Session</h2>
      <label>Session Name</label>
      <input value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
      <button onClick={startSession}>Start Session</button>

      <label>Session ID</label>
      <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} />

      <label>Student ID</label>
      <input value={studentId} onChange={(event) => setStudentId(event.target.value)} />

      <label>Text</label>
      <input value={text} onChange={(event) => setText(event.target.value)} />

      <button onClick={submitUtterance}>Submit Text</button>
      <p>{message}</p>

      {result && (
        <div className="result-panel">
          <p>
            Detected Emotion: <strong>{result.emotion}</strong>
          </p>
          <p>Timestamp: {new Date(result.timestamp).toLocaleString()}</p>
          <p>Top Scores:</p>
          <ul>
            {topScores.map(([emotion, score]) => (
              <li key={emotion}>
                {emotion}: {(score * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
