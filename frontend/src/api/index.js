import { getStoredToken } from "./tokenStorage.js";

function normalizeApiBaseUrl(rawUrl = "") {
  const value = String(rawUrl || "").trim();
  if (!value) {
    return "";
  }
  return value.replace(/\/+$/, "");
}

function getRuntimeDefaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }
  const host = String(window.location?.hostname || "").toLowerCase();
  const protocol = String(window.location?.protocol || "http:");
  const port = String(window.location?.port || "");
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:8000";
  }
  if (port === "5173" || port === "4173") {
    return `${protocol}//${host}:8000`;
  }
  return "";
}

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || getRuntimeDefaultApiBaseUrl()
);

export function buildApiUrl(path) {
  const safePath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
  return API_BASE_URL ? `${API_BASE_URL}${safePath}` : safePath;
}

export function formatErrorDetail(detail, fallback = "Request failed") {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => {
        if (!item) {
          return "";
        }
        if (typeof item === "string") {
          return item;
        }
        const loc = Array.isArray(item.loc) ? item.loc.join(".") : "";
        const msg = typeof item.msg === "string" ? item.msg : "";
        if (loc && msg) {
          return `${loc}: ${msg}`;
        }
        if (msg) {
          return msg;
        }
        try {
          return JSON.stringify(item);
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    if (messages.length > 0) {
      return messages.join("; ");
    }
  }
  if (detail && typeof detail === "object") {
    if (typeof detail.message === "string" && detail.message.trim()) {
      return detail.message;
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeRequestErrorMessage(error, fallback = "Network error") {
  if (error?.name === "AbortError") {
    return "Request timed out. Please try again.";
  }

  const rawMessage = String(error?.message || "").trim();
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    normalizedMessage === "failed to fetch"
    || normalizedMessage.includes("networkerror")
    || normalizedMessage.includes("load failed")
    || normalizedMessage.includes("fetch")
  ) {
    return "Cannot connect to the backend API. Make sure the backend server is running on http://localhost:8000.";
  }

  return rawMessage || fallback;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiRequest(path, method = "GET", body = null, token = "", options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const retryCount = options.retryCount ?? (method === "GET" ? 1 : 0);

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      response = await fetchWithTimeout(
        buildApiUrl(path),
        {
          method,
          headers,
          body: body ? JSON.stringify(body) : null,
        },
        timeoutMs
      );
      break;
    } catch (error) {
      const isLastAttempt = attempt === retryCount;
      if (!isLastAttempt) {
        continue;
      }
      throw new Error(normalizeRequestErrorMessage(error));
    }
  }

  if (!response) {
    throw new Error("Request failed");
  }

  if (!response.ok) {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    let detail = null;

    if (contentType.includes("application/json")) {
      const error = await response.json().catch(() => ({}));
      detail = error?.detail;
    } else {
      const text = await response.text().catch(() => "");
      detail = text || null;
    }

    throw new Error(formatErrorDetail(detail, `Request failed (${response.status})`));
  }

  return response.json();
}

export async function apiMultipartRequest(path, method = "POST", formData, token = "", options = {}) {
  const timeoutMs = options.timeoutMs ?? 20000;
  const retryCount = options.retryCount ?? 0;

  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      response = await fetchWithTimeout(
        buildApiUrl(path),
        {
          method,
          headers,
          body: formData,
        },
        timeoutMs
      );
      break;
    } catch (error) {
      const isLastAttempt = attempt === retryCount;
      if (!isLastAttempt) {
        continue;
      }
      throw new Error(normalizeRequestErrorMessage(error));
    }
  }

  if (!response) {
    throw new Error("Request failed");
  }

  if (!response.ok) {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    let detail = null;

    if (contentType.includes("application/json")) {
      const error = await response.json().catch(() => ({}));
      detail = error?.detail;
    } else {
      const text = await response.text().catch(() => "");
      detail = text || null;
    }

    throw new Error(formatErrorDetail(detail, `Request failed (${response.status})`));
  }

  return response.json();
}

export async function fetchCurrentUser() {
  const token = getStoredToken();
  if (!token) {
    return null;
  }
  try {
    return await apiRequest("/users/me", "GET", null, token);
  } catch {
    try {
      return await apiRequest("/auth/me", "GET", null, token);
    } catch {
      return null;
    }
  }
}

export async function loginUser({ email = "", username = "", password = "" }) {
  const payload = { password };
  if (email) {
    payload.email = email;
  }
  if (username) {
    payload.username = username;
  }
  return apiRequest("/auth/login", "POST", payload);
}

export async function registerUser({ email, password, role = "student", full_name = "", username = "" }) {
  const payload = { email, password, role };
  if (full_name) {
    payload.full_name = full_name;
  }
  if (username) {
    payload.username = username;
  }
  return apiRequest("/auth/register", "POST", payload);
}

export async function updateMyProfile(payload) {
  const token = localStorage.getItem("token") || "";
  return apiRequest("/profiles/me", "PUT", payload, token);
}

export async function fetchPendingTeachers() {
  const token = localStorage.getItem("token") || "";
  return apiRequest("/admin/teachers/pending", "GET", null, token);
}

export async function fetchAdminTeachers() {
  const token = localStorage.getItem("token") || "";
  return apiRequest("/admin/teachers", "GET", null, token);
}

export async function approveTeacher(teacherId) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/admin/teachers/${teacherId}/approve`, "POST", null, token);
}

export async function rejectTeacher(teacherId) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/admin/teachers/${teacherId}/reject`, "POST", null, token);
}

export async function disableUserAccount(userId) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/admin/users/${userId}/disable`, "POST", null, token);
}

export async function fetchAdminClasses() {
  const token = localStorage.getItem("token") || "";
  return apiRequest("/admin/classes", "GET", null, token);
}

export async function createClass(payload) {
  const token = localStorage.getItem("token") || "";
  return apiRequest("/classes", "POST", payload, token);
}

export async function inviteStudentsToClass(classId, payload) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/classes/${classId}/invite`, "POST", payload, token);
}

export async function joinClassByCode(joinCode) {
  const token = localStorage.getItem("token") || "";
  return apiRequest("/classes/join", "POST", { join_code: joinCode }, token);
}

export async function fetchMyClasses() {
  const token = getStoredToken();
  return apiRequest("/classes/my", "GET", null, token);
}

export async function fetchClassDetail(classId) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/classes/${classId}`, "GET", null, token);
}

export async function fetchNotifications(limit = 50) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/notifications?limit=${limit}`, "GET", null, token);
}

export async function markNotificationRead(notificationId) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/notifications/${notificationId}/read`, "POST", null, token);
}

export async function createLesson(payload, uploadedFile = null) {
  const token = localStorage.getItem("token") || "";
  if (uploadedFile) {
    const formData = new FormData();
    formData.append("title", payload.title || "");
    formData.append("description", payload.description || "");
    formData.append("course_id", payload.course_id || "");
    formData.append("video_url", payload.video_url || "");
    formData.append("duration_sec", String(payload.duration_sec || 0));
    formData.append("resources", payload.resources || "");
    formData.append("uploaded_file", uploadedFile);
    return apiMultipartRequest("/lessons", "POST", formData, token);
  }
  return apiRequest("/lessons", "POST", payload, token);
}

export async function updateLesson(lessonId, payload, uploadedFile = null) {
  const token = localStorage.getItem("token") || "";
  if (uploadedFile) {
    const formData = new FormData();
    formData.append("title", payload.title || "");
    formData.append("description", payload.description || "");
    formData.append("course_id", payload.course_id || "");
    formData.append("video_url", payload.video_url || "");
    formData.append("duration_sec", String(payload.duration_sec || 0));
    formData.append("resources", payload.resources || "");
    formData.append("uploaded_file", uploadedFile);
    return apiMultipartRequest(`/lessons/${lessonId}`, "PUT", formData, token);
  }
  return apiRequest(`/lessons/${lessonId}`, "PUT", payload, token);
}

export async function deleteLesson(lessonId) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/lessons/${lessonId}`, "DELETE", null, token);
}

export async function fetchMyLessons() {
  const token = localStorage.getItem("token") || "";
  return apiRequest("/lessons/my", "GET", null, token);
}

export async function assignLessonToClasses(lessonId, payload) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/lessons/${lessonId}/assign`, "POST", payload, token);
}

export async function fetchClassLessons(classId) {
  const token = getStoredToken();
  return apiRequest(`/classes/${classId}/lessons`, "GET", null, token);
}

export async function fetchLessonById(lessonId, classId = "") {
  const token = localStorage.getItem("token") || "";
  const suffix = classId ? `?class_id=${encodeURIComponent(classId)}` : "";
  return apiRequest(`/lessons/${lessonId}${suffix}`, "GET", null, token);
}

function buildAnalyticsQuery({ classId = "", startAt = "", endAt = "", emotionLabel = "" } = {}) {
  const params = new URLSearchParams();
  if (classId) {
    params.set("class_id", classId);
  }
  if (startAt) {
    params.set("start_at", startAt);
  }
  if (endAt) {
    params.set("end_at", endAt);
  }
  if (emotionLabel) {
    params.set("emotion_label", emotionLabel);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildTeacherAnalyticsQuery({
  classId = "",
  lessonId = "",
  studentId = "",
  liveSessionId = "",
  startAt = "",
  endAt = "",
  emotionLabel = "",
  search = "",
  page = "",
  limit = "",
} = {}) {
  const params = new URLSearchParams();
  if (classId) params.set("class_id", classId);
  if (lessonId) params.set("lesson_id", lessonId);
  if (studentId) params.set("student_id", studentId);
  if (liveSessionId) params.set("live_session_id", liveSessionId);
  if (startAt) params.set("start_at", startAt);
  if (endAt) params.set("end_at", endAt);
  if (emotionLabel) params.set("emotion_label", emotionLabel);
  if (search) params.set("search", search);
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchLessonOverallAnalytics(lessonId, filters = {}) {
  const token = localStorage.getItem("token") || "";
  const query = buildAnalyticsQuery(filters);
  return apiRequest(`/analytics/lesson/${lessonId}/overall${query}`, "GET", null, token);
}

export async function fetchLessonModalityAnalytics(lessonId, modality, filters = {}) {
  const token = localStorage.getItem("token") || "";
  const query = buildAnalyticsQuery(filters);
  return apiRequest(`/analytics/lesson/${lessonId}/${modality}${query}`, "GET", null, token);
}

export async function fetchLessonStudentsAnalytics(lessonId, filters = {}) {
  const token = localStorage.getItem("token") || "";
  const query = buildAnalyticsQuery(filters);
  return apiRequest(`/analytics/lesson/${lessonId}/students${query}`, "GET", null, token);
}

export async function fetchLessonProgressAnalytics(lessonId, filters = {}) {
  const token = localStorage.getItem("token") || "";
  const query = buildAnalyticsQuery(filters);
  return apiRequest(`/analytics/lesson/${lessonId}/progress${query}`, "GET", null, token);
}

export async function fetchTeacherAnalyticsOverview(filters = {}) {
  const token = getStoredToken();
  const query = buildTeacherAnalyticsQuery(filters);
  return apiRequest(`/analytics/overview${query}`, "GET", null, token);
}

export async function fetchTeacherAnalyticsLessons(filters = {}) {
  const token = getStoredToken();
  const query = buildTeacherAnalyticsQuery(filters);
  return apiRequest(`/analytics/lessons${query}`, "GET", null, token);
}

export async function fetchTeacherAnalyticsStudents(filters = {}) {
  const token = getStoredToken();
  const query = buildTeacherAnalyticsQuery(filters);
  return apiRequest(`/analytics/students${query}`, "GET", null, token);
}

export async function fetchTeacherRealtimeAnalytics(filters = {}) {
  const token = getStoredToken();
  const query = buildTeacherAnalyticsQuery(filters);
  return apiRequest(`/analytics/realtime${query}`, "GET", null, token);
}

export async function fetchTeacherAttendanceAnalytics(filters = {}) {
  const token = getStoredToken();
  const query = buildTeacherAnalyticsQuery(filters);
  return apiRequest(`/analytics/attendance${query}`, "GET", null, token);
}

export async function fetchTeacherEmotionTrends(filters = {}) {
  const token = getStoredToken();
  const query = buildTeacherAnalyticsQuery(filters);
  return apiRequest(`/analytics/emotions${query}`, "GET", null, token);
}

export async function fetchStudentAnalytics(studentId, filters = {}) {
  const token = getStoredToken();
  const query = buildTeacherAnalyticsQuery(filters);
  return apiRequest(`/analytics/student/${studentId}${query}`, "GET", null, token);
}

export async function fetchPowerBIEmbedToken(reportId = "") {
  const token = getStoredToken();
  const query = reportId ? `?report_id=${encodeURIComponent(reportId)}` : "";
  return apiRequest(`/analytics/powerbi/embed-token${query}`, "GET", null, token);
}

export function buildAnalyticsExportUrl(filters = {}) {
  return buildApiUrl(`/analytics/export${buildTeacherAnalyticsQuery(filters)}`);
}

export async function updateLessonProgress(lessonId, payload) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/lessons/${lessonId}/progress`, "POST", payload, token);
}

function buildFeedbackQuery({ lessonId = "", classId = "", limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (lessonId) {
    params.set("lesson_id", lessonId);
  }
  if (classId) {
    params.set("class_id", classId);
  }
  params.set("limit", String(limit));
  return `?${params.toString()}`;
}

export async function fetchLessonComments({ lessonId, classId = "", limit = 100 }) {
  const token = localStorage.getItem("token") || "";
  const query = buildFeedbackQuery({ lessonId, classId, limit });
  return apiRequest(`/feedback/comments${query}`, "GET", null, token);
}

export async function fetchLessonVoiceFeedback({ lessonId, classId = "", limit = 100 }) {
  const token = localStorage.getItem("token") || "";
  const query = buildFeedbackQuery({ lessonId, classId, limit });
  return apiRequest(`/feedback/voice${query}`, "GET", null, token);
}

export async function startLiveClass(payload) {
  const token = getStoredToken();
  return apiRequest("/live-classes/start", "POST", payload, token);
}

export async function endLiveClass(liveSessionId) {
  const token = getStoredToken();
  return apiRequest(`/live-classes/${liveSessionId}/end`, "POST", null, token);
}

export async function joinLiveClass(liveSessionId) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/live-classes/${liveSessionId}/join`, "POST", null, token);
}

export async function leaveLiveClass(liveSessionId) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/live-classes/${liveSessionId}/leave`, "POST", null, token);
}

export async function fetchLiveClass(liveSessionId) {
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/live-classes/${liveSessionId}`, "GET", null, token);
}

function buildLiveAnalyticsQuery({ startAt = "", endAt = "", emotionLabel = "" } = {}) {
  const params = new URLSearchParams();
  if (startAt) {
    params.set("start_at", startAt);
  }
  if (endAt) {
    params.set("end_at", endAt);
  }
  if (emotionLabel) {
    params.set("emotion_label", emotionLabel);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchLiveOverallAnalytics(liveSessionId, filters = {}) {
  const token = getStoredToken();
  const query = buildLiveAnalyticsQuery(filters);
  return apiRequest(`/analytics/live/${liveSessionId}/overall${query}`, "GET", null, token);
}

export async function fetchLiveModalityAnalytics(liveSessionId, modality, filters = {}) {
  const token = localStorage.getItem("token") || "";
  const query = buildLiveAnalyticsQuery(filters);
  return apiRequest(`/analytics/live/${liveSessionId}/${modality}${query}`, "GET", null, token);
}

function buildEmotionWorkspaceQuery(filters = {}) {
  const params = new URLSearchParams();
  if (filters.classId) params.set("class_id", filters.classId);
  if (filters.lessonId) params.set("lesson_id", filters.lessonId);
  if (filters.studentId) params.set("student_id", filters.studentId);
  if (filters.startAt) params.set("start_at", filters.startAt);
  if (filters.endAt) params.set("end_at", filters.endAt);
  if (Array.isArray(filters.emotions) && filters.emotions.length > 0) {
    params.set("emotions", filters.emotions.join(","));
  }
  if (filters.confidenceThreshold !== undefined && filters.confidenceThreshold !== null) {
    params.set("confidence_threshold", String(filters.confidenceThreshold));
  }
  if (filters.reportType) params.set("report_type", filters.reportType);
  if (filters.format) params.set("format", filters.format);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchEmotionWorkspaceAnalytics(filters = {}) {
  const token = getStoredToken();
  return apiRequest(`/api/emotions/analytics${buildEmotionWorkspaceQuery(filters)}`, "GET", null, token);
}

export async function fetchEmotionWorkspaceReport(filters = {}) {
  const token = getStoredToken();
  return apiRequest(`/api/emotions/report${buildEmotionWorkspaceQuery(filters)}`, "GET", null, token);
}

export async function fetchEmotionWorkspaceSummary(filters = {}) {
  const token = getStoredToken();
  return apiRequest(`/api/emotions/summary${buildEmotionWorkspaceQuery(filters)}`, "GET", null, token);
}

export async function fetchEmotionWorkspaceLive(filters = {}) {
  const token = getStoredToken();
  return apiRequest(`/api/emotions/live${buildEmotionWorkspaceQuery(filters)}`, "GET", null, token);
}

export function buildEmotionWorkspaceExportUrl(filters = {}) {
  return buildApiUrl(`/api/emotions/export${buildEmotionWorkspaceQuery(filters)}`);
}

export async function fetchLiveStudentsAnalytics(liveSessionId, filters = {}) {
  const token = localStorage.getItem("token") || "";
  const query = buildLiveAnalyticsQuery(filters);
  return apiRequest(`/analytics/live/${liveSessionId}/students${query}`, "GET", null, token);
}
