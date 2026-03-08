import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchCurrentUser, registerUser } from "../services/api";

function mapRegisterError(message) {
  const value = String(message || "").toLowerCase();
  if (value.includes("failed to fetch") || value.includes("network error") || value.includes("timed out")) {
    return "Cannot connect to backend API. Start backend and verify VITE_API_URL.";
  }
  if (value.includes("request failed (404)") || value.includes("request failed (502)") || value.includes("request failed (503)")) {
    return "Backend API endpoint is unavailable. Check backend URL and deployment.";
  }
  if (value.includes("email already used")) {
    return "This email is already registered.";
  }
  if (value.includes("username already used")) {
    return "This username is already taken.";
  }
  return message || "Registration failed. Please try again.";
}

export default function RegisterPage({ onLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function completeLogin(token) {
    localStorage.setItem("token", token);
    const profile = await fetchCurrentUser();
    if (!profile) {
      throw new Error("Unable to load user profile");
    }
    onLogin(profile);
  }

  async function handleRegister(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      };
      const result = await registerUser(payload);
      if (role === "student") {
        await completeLogin(result.access_token);
        return;
      }

      localStorage.removeItem("token");
      setMessage("Teacher registration submitted. Wait for admin approval before login.");
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1400);
    } catch (err) {
      setError(mapRegisterError(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-layout">
      <article className="card auth-hero auth-hero--register">
        <p className="eyebrow">Create account</p>
        <h2>Start your learning workspace</h2>
        <p>
          Students can start instantly. Teachers can create accounts and request approval from admin.
        </p>
        <ul className="auth-hero__list">
          <li>Role-based access control</li>
          <li>Emotion-aware learning analytics</li>
          <li>Secure JWT authentication</li>
        </ul>
      </article>

      <article className="card auth-card">
        <h2>Register</h2>
        <form className="form-grid" onSubmit={handleRegister}>
          <label>
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter your name"
              required
            />
          </label>

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
              placeholder="Minimum 6 characters"
              minLength={6}
              required
            />
          </label>

          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </label>

          <button type="submit" disabled={busy}>
            {busy ? "Creating account..." : "Create account"}
          </button>
        </form>

        {message && <div className="inline-message inline-message-soft">{message}</div>}
        {error && <div className="inline-message inline-message-soft">{error}</div>}

        <p className="small-note">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </article>
    </section>
  );
}
