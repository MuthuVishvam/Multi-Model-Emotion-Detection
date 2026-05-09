import axios from "axios";

import { buildApiUrl, formatErrorDetail } from "./index.js";
import { clearStoredToken, getStoredToken, persistToken } from "./tokenStorage.js";

const authClient = axios.create({
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

authClient.interceptors.request.use((config) => {
  const nextConfig = { ...config };
  const token = getStoredToken();
  nextConfig.url = buildApiUrl(nextConfig.url || "");
  nextConfig.headers = {
    ...(nextConfig.headers || {}),
  };
  if (token) {
    nextConfig.headers.Authorization = `Bearer ${token}`;
  }
  return nextConfig;
});

export function getAuthApiErrorMessage(error, fallback = "Request failed") {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    const status = error.response?.status;
    const networkCode = String(error.code || "").toUpperCase();

    if (networkCode === "ECONNABORTED") {
      return "Request timed out. Please try again.";
    }
    if (!status) {
      return error.message || "Network error";
    }
    return formatErrorDetail(detail, `${fallback} (${status})`);
  }
  return error?.message || fallback;
}

function normalizeTokenResponse(data = {}) {
  const accessToken = String(data?.access_token || "").trim();
  if (!accessToken) {
    throw new Error("Authentication token missing from response.");
  }
  persistToken(accessToken);
  return data;
}

export async function loginRequest(payload) {
  try {
    const { data } = await authClient.post("/auth/login", payload);
    return normalizeTokenResponse(data);
  } catch (error) {
    clearStoredToken();
    throw new Error(getAuthApiErrorMessage(error, "Login failed"));
  }
}

export async function registerRequest(payload) {
  try {
    const { data } = await authClient.post("/auth/register", payload);
    return normalizeTokenResponse(data);
  } catch (error) {
    clearStoredToken();
    throw new Error(getAuthApiErrorMessage(error, "Registration failed"));
  }
}

export function getGoogleAuthUrl() {
  return buildApiUrl("/auth/google");
}
