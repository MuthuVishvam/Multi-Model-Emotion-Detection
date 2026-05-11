import { API_BASE_URL } from "./api";

function getWindowOriginFallback() {
  if (typeof window === "undefined") {
    return "";
  }

  const protocol = String(window.location?.protocol || "http:");
  const hostname = String(window.location?.hostname || "localhost");
  const port = String(window.location?.port || "");

  if (port === "5173" || port === "4173") {
    return `${protocol}//${hostname}:8000`;
  }

  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
}

export function getRealtimeBaseUrl() {
  return API_BASE_URL || getWindowOriginFallback();
}

export function buildLiveRoomId(liveSessionId) {
  return String(liveSessionId || "").trim();
}

export function getUserDisplayName(user) {
  return (
    String(user?.full_name || "").trim()
    || String(user?.username || "").trim()
    || String(user?.email || "").trim()
    || "Guest"
  );
}
