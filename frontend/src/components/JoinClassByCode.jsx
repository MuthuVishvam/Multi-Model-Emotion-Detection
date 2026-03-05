import { useState } from "react";

export default function JoinClassByCode({ onJoin }) {
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState("");

  async function handleJoin() {
    setJoining(true);
    setMessage("");
    try {
      await onJoin(joinCode.trim());
      setJoinCode("");
      setMessage("Joined class successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <section className="card">
      <p className="eyebrow">Join Class</p>
      <label>Enter Join Code</label>
      <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} />
      <button onClick={handleJoin} disabled={joining || !joinCode.trim()}>
        {joining ? "Joining..." : "Join"}
      </button>
      {message && <p className="small-note">{message}</p>}
    </section>
  );
}
