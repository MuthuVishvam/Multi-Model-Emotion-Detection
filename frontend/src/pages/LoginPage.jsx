import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { getGoogleAuthUrl } from "../api/authApi";
import AuthLayout from "../components/AuthLayout";
import OAuthButton from "../components/OAuthButton";
import useAuth from "../hooks/useAuth";

const INPUT_CLASS =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white";

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" className="fill-none stroke-white/30" strokeWidth="4" />
      <path className="fill-none stroke-white" strokeWidth="4" strokeLinecap="round" d="M22 12a10 10 0 0 0-10-10" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (errorText) {
      setErrorText("");
    }
  }, [identifier, password]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorText("");

    try {
      await login({ identifier, password });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorText(error.message || "Invalid credentials");
    }
  }

  async function handleGoogleSignIn() {
    setErrorText("");

    try {
      const response = await fetch(getGoogleAuthUrl(), {
        method: "GET",
        credentials: "include",
      });

      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }

      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.url) {
        window.location.assign(payload.url);
        return;
      }

      throw new Error("Google sign-in is not configured yet.");
    } catch (error) {
      setErrorText(error.message || "Google sign-in is not configured yet.");
    }
  }

  const heroFeatures = [
    "AI-powered student engagement tracking",
    "Personalized learning analytics dashboard",
    "Secure student, teacher, and admin portals",
    "Real-time emotion and attention insights",
    "Smart classroom performance monitoring",
    "Teacher approval and verification system",
  ];

  return (
    <AuthLayout
      heroLabel="SMART AI LEARNING PLATFORM"
      heroTitle="Transform Learning Through Emotion Intelligence"
      heroDescription="Empower students and educators with AI-driven insights that improve engagement, monitor learning behavior, and create personalized educational experiences in real time."
      heroFeatures={heroFeatures}
    >
      <div className="mb-8 text-center sm:text-left">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h2>
        <p className="text-slate-500">Sign in to continue your personalized learning journey.</p>
      </div>

      <div className="space-y-5">
        <OAuthButton onClick={handleGoogleSignIn} disabled={isLoading} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white/80 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 backdrop-blur-sm rounded-full">
              Or continue with email
            </span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="login-identifier" className="block text-sm font-semibold text-slate-700">
              Email Address
            </label>
            <input
              id="login-identifier"
              type="text"
              required
              placeholder="you@example.com"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className={INPUT_CLASS}
              aria-invalid={Boolean(errorText)}
              aria-describedby={errorText ? "login-error" : undefined}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <a
                href="mailto:support@emotisense.ai?subject=MELD%20password%20reset"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Forgot password?
              </a>
            </div>
            <input
              id="login-password"
              type="password"
              required
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={INPUT_CLASS}
              aria-invalid={Boolean(errorText)}
              aria-describedby={errorText ? "login-error" : undefined}
            />
          </div>

          {errorText ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              id="login-error"
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50/80 backdrop-blur-sm px-4 py-3 text-sm text-red-600"
            >
              {errorText}
            </motion.p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isLoading ? <Spinner /> : null}
            <span>{isLoading ? "Signing in..." : "Sign In"}</span>
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6 pt-4">
          New to MELD Learn?{" "}
          <Link to="/register" className="font-semibold text-blue-600 hover:text-indigo-600 transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
