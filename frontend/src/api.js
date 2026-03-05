export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
        `${API_BASE_URL}${path}`,
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
      if (error?.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }
      throw new Error(error?.message || "Network error");
    }
  }

  if (!response) {
    throw new Error("Request failed");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed");
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
        `${API_BASE_URL}${path}`,
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
      if (error?.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }
      throw new Error(error?.message || "Network error");
    }
  }

  if (!response) {
    throw new Error("Request failed");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed");
  }

  return response.json();
}

export async function fetchCurrentUser() {
  const token = localStorage.getItem("token") || "";
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
  const token = localStorage.getItem("token") || "";
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
  const token = localStorage.getItem("token") || "";
  return apiRequest(`/classes/${classId}/lessons`, "GET", null, token);
}

export async function fetchLessonById(lessonId, classId = "") {
  const token = localStorage.getItem("token") || "";
  const suffix = classId ? `?class_id=${encodeURIComponent(classId)}` : "";
  return apiRequest(`/lessons/${lessonId}${suffix}`, "GET", null, token);
}

function buildAnalyticsQuery({ classId = "", startAt = "", endAt = "" } = {}) {
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
