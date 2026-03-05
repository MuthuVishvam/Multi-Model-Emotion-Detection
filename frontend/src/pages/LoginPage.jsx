import { useState } from "react";

import { apiRequest, fetchCurrentUser } from "../services/api";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("teacher@test.com");
  const [password, setPassword] = useState("123456");
  const [roleChoice, setRoleChoice] = useState("teacher");
  const [message, setMessage] = useState("");

  async function completeLogin(token) {
    localStorage.setItem("token", token);
    const profile = await fetchCurrentUser();
    if (!profile) {
      throw new Error("Unable to load user profile");
    }
    onLogin(profile);
  }

  async function handleRegister() {
    try {
      const data = await apiRequest("/auth/register", "POST", { email, password, role: roleChoice });
      await completeLogin(data.access_token);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLogin() {
    try {
      const data = await apiRequest("/auth/login", "POST", { email, password });
      await completeLogin(data.access_token);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="card auth-card">
      <h2>Login</h2>
      <p>Select your role, then login to continue.</p>

      <label>Role</label>
      <select value={roleChoice} onChange={(event) => setRoleChoice(event.target.value)}>
        <option value="teacher">Teacher</option>
        <option value="student">Student</option>
      </select>

      <label>Email</label>
      <input value={email} onChange={(event) => setEmail(event.target.value)} />

      <label>Password</label>
      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />

      <button onClick={handleLogin}>Login</button>
      <button className="secondary" onClick={handleRegister}>Register as {roleChoice}</button>
      {message && <p>{message}</p>}

      <div className="hint-box">
        <p>Seeded teacher (approved): teacher@test.com / 123456</p>
        <p>Seeded teacher (pending): teacher_pending@test.com / 123456</p>
        <p>Seeded students: student1@test.com / 123456 and student2@test.com / 123456</p>
        <p>Seeded admin: admin@test.com / 123456</p>
      </div>
    </div>
  );
}

