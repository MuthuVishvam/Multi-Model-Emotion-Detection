import { Navigate } from "react-router-dom";

function getRoleHomePath(user) {
  if (!user) {
    return "/login";
  }
  if (user.role === "admin") {
    return "/admin/dashboard";
  }
  if (user.role === "teacher") {
    const teacherStatus = user.status ?? "pending";
    const teacherVerified = user.verified ?? false;
    return teacherStatus === "approved" && teacherVerified ? "/teacher" : "/profile/teacher";
  }
  return "/student";
}

export default function RequireRole({ user, allow = [], children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!allow.includes(user.role)) {
    return <Navigate to={getRoleHomePath(user)} replace />;
  }
  return children;
}
