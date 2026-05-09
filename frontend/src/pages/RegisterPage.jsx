import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, GraduationCap, Presentation } from "lucide-react";

import AuthLayout from "../components/AuthLayout";
import useAuth from "../hooks/useAuth";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white";

const ERROR_INPUT_CLASS = "border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/10";

const ROLE_OPTIONS = [
  {
    id: "teacher",
    label: "Teacher / Trainer",
    hint: "Run classes and review analytics",
    apiRole: "teacher",
    icon: Presentation,
  },
  {
    id: "student",
    label: "Student",
    hint: "Participate in live classes",
    apiRole: "student",
    icon: GraduationCap,
  },
];

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" className="fill-none stroke-white/30" strokeWidth="4" />
      <path className="fill-none stroke-white" strokeWidth="4" strokeLinecap="round" d="M22 12a10 10 0 0 0-10-10" />
    </svg>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  const [formValues, setFormValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorText, setErrorText] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const selectedRole = ROLE_OPTIONS.find((option) => option.id === formValues.role) || ROLE_OPTIONS[1];

  useEffect(() => {
    setErrorText("");
  }, [formValues]);

  function setFieldValue(field, value) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      return {
        ...current,
        [field]: "",
      };
    });
  }

  function validateForm() {
    const nextErrors = {};

    if (!formValues.firstName.trim()) {
      nextErrors.firstName = "First name is required.";
    }
    if (!formValues.lastName.trim()) {
      nextErrors.lastName = "Last name is required.";
    }
    if (!formValues.email.trim()) {
      nextErrors.email = "Email is required.";
    }
    if (!formValues.password) {
      nextErrors.password = "Password is required.";
    } else if (formValues.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    if (!formValues.confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (formValues.password !== formValues.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    setErrorText("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await register({
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        email: formValues.email.trim().toLowerCase(),
        password: formValues.password,
        role: selectedRole.apiRole,
        full_name: `${formValues.firstName} ${formValues.lastName}`.trim(),
      });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorText(error.message || "Registration failed.");
      if (String(error.message || "").toLowerCase().includes("email")) {
        setFieldErrors((current) => ({
          ...current,
          email: error.message,
        }));
      }
    }
  }

  const heroFeatures = [
    "Role-based access for students and teachers",
    "Emotion-aware learning analytics",
    "Secure JWT authentication system",
    "Admin approval workflow for teachers",
    "Personalized dashboard experience",
    "Real-time engagement monitoring",
  ];

  return (
    <AuthLayout
      heroLabel="NEXT-GENERATION EDUCATION EXPERIENCE"
      heroTitle="Create Your Smart Learning Workspace"
      heroDescription="Join an intelligent learning ecosystem designed for students, teachers, and administrators to collaborate, track progress, and enhance educational outcomes using AI-powered emotion analytics."
      heroFeatures={heroFeatures}
    >
      <div className="mb-6 text-center sm:text-left">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Create Account</h2>
        <p className="text-slate-500">Get started with your AI-powered learning platform.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="register-first-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
              First Name
            </label>
            <input
              id="register-first-name"
              type="text"
              value={formValues.firstName}
              onChange={(event) => setFieldValue("firstName", event.target.value)}
              className={`${INPUT_CLASS} ${fieldErrors.firstName ? ERROR_INPUT_CLASS : ""}`}
              aria-invalid={Boolean(fieldErrors.firstName)}
            />
            {fieldErrors.firstName && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">{fieldErrors.firstName}</p>
            )}
          </div>

          <div>
            <label htmlFor="register-last-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Last Name
            </label>
            <input
              id="register-last-name"
              type="text"
              value={formValues.lastName}
              onChange={(event) => setFieldValue("lastName", event.target.value)}
              className={`${INPUT_CLASS} ${fieldErrors.lastName ? ERROR_INPUT_CLASS : ""}`}
              aria-invalid={Boolean(fieldErrors.lastName)}
            />
            {fieldErrors.lastName && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">{fieldErrors.lastName}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="register-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Email Address
          </label>
          <input
            id="register-email"
            type="email"
            required
            placeholder="you@example.com"
            value={formValues.email}
            onChange={(event) => setFieldValue("email", event.target.value)}
            className={`${INPUT_CLASS} ${fieldErrors.email ? ERROR_INPUT_CLASS : ""}`}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email && (
            <p className="mt-1.5 text-xs text-red-600 font-medium">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="register-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              required
              placeholder="Minimum 8 characters"
              value={formValues.password}
              onChange={(event) => setFieldValue("password", event.target.value)}
              className={`${INPUT_CLASS} pr-10 ${fieldErrors.password ? ERROR_INPUT_CLASS : ""}`}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1.5 text-xs text-red-600 font-medium">{fieldErrors.password}</p>
          )}
        </div>

        <div>
          <label htmlFor="register-confirm-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="register-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              required
              placeholder="Repeat your password"
              value={formValues.confirmPassword}
              onChange={(event) => setFieldValue("confirmPassword", event.target.value)}
              className={`${INPUT_CLASS} pr-10 ${fieldErrors.confirmPassword ? ERROR_INPUT_CLASS : ""}`}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="mt-1.5 text-xs text-red-600 font-medium">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        <div>
          <span className="block text-sm font-semibold text-slate-700 mb-2">Select Role</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((option) => {
              const isActive = option.id === formValues.role;
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFieldValue("role", option.id)}
                  aria-pressed={isActive}
                  className={`relative flex flex-col items-start gap-3 overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 ${
                    isActive
                      ? "border-blue-500 bg-blue-50/50 shadow-[0_0_0_1px_rgba(59,130,246,1)] ring-4 ring-blue-500/10"
                      : "border-slate-200 bg-white/50 hover:border-blue-300 hover:bg-slate-50"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isActive ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={`block text-sm font-bold ${isActive ? "text-blue-700" : "text-slate-700"}`}>
                      {option.label}
                    </span>
                    <span className={`mt-1 block text-xs leading-relaxed ${isActive ? "text-blue-600/80" : "text-slate-500"}`}>
                      {option.hint}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {errorText && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50/80 backdrop-blur-sm px-4 py-3 text-sm text-red-600"
            >
              {errorText}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {isLoading ? <Spinner /> : null}
          <span>{isLoading ? "Creating Account..." : "Create Account"}</span>
        </button>

        <p className="text-center text-sm text-slate-500 pt-4">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-indigo-600 transition-colors">
            Sign In
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
