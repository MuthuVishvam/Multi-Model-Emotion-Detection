import { useState } from "react";

import { apiRequest } from "../api";

export default function LoginPage() {
  const [email, setEmail] = useState("student@example.com");
  const [password, setPassword] = useState("password123");
  const [message, setMessage] = useState("");

  async function handleRegister() {
    try {
      const data = await apiRequest("/auth/register", "POST", { email, password, role: "student" });
      localStorage.setItem("token", data.access_token);
      setMessage("Registered and logged in.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLogin() {
    try {
      const data = await apiRequest("/auth/login", "POST", { email, password });
      localStorage.setItem("token", data.access_token);
      setMessage("Logged in.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="card">
      <h2>Login</h2>
      <label>Email</label>
      <input value={email} onChange={(event) => setEmail(event.target.value)} />
      <label>Password</label>
      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <button onClick={handleRegister}>Register</button>
      <button className="secondary" onClick={handleLogin}>
        Login
      </button>
      <p>{message}</p>
    </div>
  );
}
