import { useState } from "react";

import { apiRequest } from "../api";

export default function StudentSessionPage() {
  const [sessionName, setSessionName] = useState("Online Class A");
  const [sessionId, setSessionId] = useState("");
  const [userId, setUserId] = useState("student-1");
  const [text, setText] = useState("I understand this concept now.");
  const [emotion, setEmotion] = useState("joy");
  const [message, setMessage] = useState("");

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

  async function logEmotion() {
    const token = localStorage.getItem("token") || "";
    try {
      await apiRequest(`/sessions/${sessionId}/log_emotion`, "POST", {
        user_id: userId,
        text,
        emotion,
        probabilities: {
          joy: emotion === "joy" ? 0.7 : 0.1,
          neutral: emotion === "neutral" ? 0.7 : 0.1,
          sadness: emotion === "sadness" ? 0.7 : 0.1,
        },
      }, token);
      setMessage("Emotion logged.");
    } catch (error) {
      setMessage(error.message);
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

      <label>User ID</label>
      <input value={userId} onChange={(event) => setUserId(event.target.value)} />

      <label>Text</label>
      <input value={text} onChange={(event) => setText(event.target.value)} />

      <label>Emotion</label>
      <select value={emotion} onChange={(event) => setEmotion(event.target.value)}>
        <option value="joy">joy</option>
        <option value="neutral">neutral</option>
        <option value="sadness">sadness</option>
        <option value="anger">anger</option>
      </select>

      <button onClick={logEmotion}>Log Emotion</button>
      <p>{message}</p>
    </div>
  );
}
