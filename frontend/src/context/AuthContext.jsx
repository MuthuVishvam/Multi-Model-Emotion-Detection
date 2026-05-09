import { createContext, useContext, useEffect, useState } from "react";

import { fetchCurrentUser } from "../services/api";
import { getAuthApiErrorMessage, loginRequest, registerRequest } from "../api/authApi";
import { clearStoredToken, getStoredToken } from "../api/tokenStorage";

const AuthContext = createContext({
  user: null,
  token: "",
  error: "",
  isLoading: true,
  login: async () => null,
  register: async () => null,
  logout: async () => {},
  refreshUser: async () => null,
  setUser: () => {},
});

function mapAuthError(message, { isRegister = false } = {}) {
  const value = String(message || "").toLowerCase();

  if (value.includes("failed to fetch") || value.includes("network error") || value.includes("timed out")) {
    return "Cannot connect to the EmotiSense API right now. Please try again.";
  }
  if (value.includes("invalid credentials")) {
    return "Invalid credentials";
  }
  if (value.includes("email already used")) {
    return "This email is already registered.";
  }
  if (value.includes("username already used")) {
    return "This workspace handle is already taken.";
  }
  if (value.includes("pending")) {
    return "Your account is waiting for approval.";
  }
  if (value.includes("rejected")) {
    return "Your account was rejected by an administrator.";
  }
  if (value.includes("disabled")) {
    return "Your account is disabled.";
  }
  return message || (isRegister ? "Registration failed." : "Login failed.");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredToken());
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function refreshUser() {
    const profile = await fetchCurrentUser();
    if (!profile) {
      throw new Error("Unable to load user profile.");
    }
    setUser(profile);
    setToken(getStoredToken());
    return profile;
  }

  async function login(credentials) {
    setIsLoading(true);
    setError("");

    try {
      const identifier = String(credentials?.identifier || credentials?.email || "").trim();
      const payload = {
        password: String(credentials?.password || ""),
      };
      if (identifier.includes("@")) {
        payload.email = identifier.toLowerCase();
      } else {
        payload.username = identifier;
      }
      const response = await loginRequest(payload);
      setToken(String(response?.access_token || ""));
      return await refreshUser();
    } catch (authError) {
      clearStoredToken();
      setUser(null);
      setToken("");
      const nextError = mapAuthError(getAuthApiErrorMessage(authError, "Login failed"));
      setError(nextError);
      throw new Error(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  async function register(payload) {
    setIsLoading(true);
    setError("");

    try {
      const response = await registerRequest({
        email: String(payload?.email || "").trim().toLowerCase(),
        password: String(payload?.password || ""),
        role: String(payload?.role || "student"),
        full_name: String(payload?.full_name || "").trim(),
      });
      setToken(String(response?.access_token || ""));
      return await refreshUser();
    } catch (authError) {
      clearStoredToken();
      setUser(null);
      setToken("");
      const nextError = mapAuthError(getAuthApiErrorMessage(authError, "Registration failed"), { isRegister: true });
      setError(nextError);
      throw new Error(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    clearStoredToken();
    setUser(null);
    setToken("");
    setError("");
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      const storedToken = getStoredToken();
      if (!storedToken) {
        if (mounted) {
          setToken("");
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const profile = await fetchCurrentUser();
        if (!mounted) {
          return;
        }
        if (!profile) {
          clearStoredToken();
          setToken("");
          setUser(null);
        } else {
          setToken(storedToken);
          setUser(profile);
        }
      } catch {
        if (!mounted) {
          return;
        }
        clearStoredToken();
        setToken("");
        setUser(null);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        error,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
