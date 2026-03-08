import { apiRequest } from "./api";

function adminToken() {
  return localStorage.getItem("token") || "";
}

export async function getPendingTeachers() {
  return apiRequest("/admin/teachers/pending", "GET", null, adminToken());
}

export async function getAllTeachers() {
  return apiRequest("/admin/teachers", "GET", null, adminToken());
}

export async function approveTeacherById(teacherId) {
  return apiRequest(`/admin/teachers/${teacherId}/approve`, "POST", null, adminToken());
}

export async function rejectTeacherById(teacherId) {
  return apiRequest(`/admin/teachers/${teacherId}/reject`, "POST", null, adminToken());
}

export async function disableTeacherById(teacherId) {
  return apiRequest(`/admin/teachers/${teacherId}/disable`, "POST", null, adminToken());
}

export async function enableTeacherById(teacherId) {
  return apiRequest(`/admin/teachers/${teacherId}/enable`, "POST", null, adminToken());
}
