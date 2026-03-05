import { Navigate } from "react-router-dom";

function getRoleHomePath(user) {
  if (!user) {
    return "/";
  }
  if (user.role === "admin") {
    return "/admin/dashboard";
  }
  if (user.role === "teacher") {
    const teacherStatus = user.status ?? "approved";
    const teacherVerified = user.verified ?? true;
    return teacherStatus === "approved" && teacherVerified ? "/teacher" : "/profile/teacher";
  }
  return "/student";
}

export default function RequireRole({ user, allow = [], children }) {
  if (!user) {
    return <Navigate to="/" replace />;
  }
  if (!allow.includes(user.role)) {
    return <Navigate to={getRoleHomePath(user)} replace />;
  }
  return children;
}
