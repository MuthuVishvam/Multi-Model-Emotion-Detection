import { Navigate } from "react-router-dom";

import StudentProfilePage from "./StudentProfilePage";
import TeacherProfilePage from "./TeacherProfilePage";


export default function ProfilePage({ user, onProfileUpdated }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "teacher") {
    return <TeacherProfilePage user={user} onProfileUpdated={onProfileUpdated} />;
  }

  if (user.role === "student") {
    return <StudentProfilePage user={user} onProfileUpdated={onProfileUpdated} />;
  }

  return <Navigate to="/admin/dashboard" replace />;
}
