import { useState } from "react";
import { Link } from "react-router-dom";

import { fetchCurrentUser, loginUser } from "../services/api";

function mapLoginError(message) {
  const value = String(message || "").toLowerCase();
  if (value.includes("failed to fetch") || value.includes("network error") || value.includes("timed out")) {
    return "Cannot connect to backend API. Start backend and verify VITE_API_URL.";
  }
  if (value.includes("request failed (404)") || value.includes("request failed (502)") || value.includes("request failed (503)")) {
    return "Backend API endpoint is unavailable. Check backend URL and deployment.";
  }
  if (value.includes("invalid credentials")) {
    return "Invalid credentials. Check email and password.";
  }
  if (value.includes("pending")) {
    return "Account pending admin approval.";
  }
  if (value.includes("rejected")) {
    return "Account rejected by admin.";
  }
  if (value.includes("disabled")) {
    return "Account disabled by admin.";
  }
  return message || "Login failed. Please try again.";
}

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function completeLogin(token) {
    localStorage.setItem("token", token);
    const profile = await fetchCurrentUser();
    if (!profile) {
      throw new Error("Unable to load user profile");
    }
    onLogin(profile);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await loginUser({ email: email.trim().toLowerCase(), password });
      await completeLogin(data.access_token);
    } catch (err) {
      setError(mapLoginError(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-layout">
      <article className="card auth-hero auth-hero--login">
        <p className="eyebrow">Emotion-Based Learning Platform</p>
        <h2>Learn smarter with real-time emotion insights</h2>
        <p>
          Track engagement, manage classes, and deliver adaptive lessons through one modern learning workspace.
        </p>
        <ul className="auth-hero__list">
          <li>Student and teacher role-based portals</li>
          <li>Multi-modal emotion analytics dashboards</li>
          <li>Admin-controlled teacher verification flow</li>
        </ul>
      </article>

      <article className="card auth-card">
        <h2>Login</h2>
        <form className="form-grid" onSubmit={handleLogin}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
            />
          </label>

          <button type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {error && <div className="inline-message inline-message-soft">{error}</div>}

        <p className="small-note">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </article>
    </section>
  );
}
