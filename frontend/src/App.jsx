import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { fetchNotifications } from "./services/api";
import PrivateRoute from "./components/PrivateRoute";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import useAuth from "./hooks/useAuth";
import AppLayout from "./layouts/AppLayout";
import AdminClassesPage from "./pages/AdminClassesPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTeachersPage from "./pages/AdminTeachersPage";
import StudentDashboard from "./pages/StudentDashboard";
import CourseDetailPage from "./pages/CourseDetailPage";
import ClassLessonsPage from "./pages/ClassLessonsPage";
import LessonPlayer from "./pages/LessonPlayer";
import LiveClassControl from "./pages/LiveClassControl";
import LiveClassRoom from "./pages/LiveClassRoom";
import LiveEmotionDashboard from "./pages/LiveEmotionDashboard";
import LessonUploadPage from "./pages/LessonUploadPage";
import LoginPage from "./pages/LoginPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import StudentClassesPage from "./pages/StudentClassesPage";
import StudentProfilePage from "./pages/StudentProfilePage";
import StudentLiveClass from "./pages/StudentLiveClass";
import TeacherClassesPage from "./pages/TeacherClassesPage";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherLiveClass from "./pages/TeacherLiveClass";
import TeacherProfilePage from "./pages/TeacherProfilePage";

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


export default function App() {
  const { user, setUser, logout, isLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const teacherStatus = user?.status ?? "pending";
  const teacherVerified = user?.verified ?? false;
  const teacherApproved = teacherStatus === "approved" && teacherVerified;
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/register";

  async function loadUnreadCount() {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const result = await fetchNotifications(1);
      setUnreadCount(result.unread_count || 0);
    } catch {
      setUnreadCount(0);
    }
  }

  useEffect(() => {
    loadUnreadCount();
    if (!user) {
      return undefined;
    }
    const timer = setInterval(() => {
      loadUnreadCount();
    }, 30000);
    return () => clearInterval(timer);
  }, [user?.id]);

  function handleProfileUpdated(profile) {
    setUser(profile);
  }

  async function handleLogout() {
    await logout();
    setUnreadCount(0);
    navigate("/login", { replace: true });
  }

  if (isLoading) {
    return (
      <div className="container">
        <div className="card">Loading...</div>
      </div>
    );
  }

  const appRoutes = (
    <Routes>
      <Route path="/" element={<Navigate to={user ? getRoleHomePath(user) : "/login"} replace />} />
      <Route
        path="/dashboard"
        element={(
          <PrivateRoute>
            <Navigate to={getRoleHomePath(user)} replace />
          </PrivateRoute>
        )}
      />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />

      <Route
        path="/student"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["student"]}>
              <StudentDashboard user={user} />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/student/classes"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["student"]}>
              <StudentClassesPage />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/student/classes/:classId/lessons"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["student"]}>
              <ClassLessonsPage />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/student/classes/:classId/lessons/:lessonId"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["student"]}>
              <LessonPlayer user={user} />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/student/live"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["student"]}>
              <StudentLiveClass user={user} />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/student/live/insights"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["student"]}>
              <LiveClassRoom user={user} />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/student/courses/:courseId"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["student"]}>
              <CourseDetailPage user={user} />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/student/courses/:courseId/lessons/:lessonId"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["student"]}>
              <LessonPlayer user={user} />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/profile"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["student", "teacher"]}>
              <ProfilePage user={user} onProfileUpdated={handleProfileUpdated} />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/profile/student"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["student"]}>
              <StudentProfilePage user={user} onProfileUpdated={handleProfileUpdated} />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/teacher"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["teacher"]}>
              {teacherApproved
                ? <TeacherDashboard user={user} />
                : <Navigate to="/profile/teacher" replace />}
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/teacher/classes"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["teacher"]}>
              {teacherApproved
                ? <TeacherClassesPage />
                : <Navigate to="/profile/teacher" replace />}
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/teacher/lessons"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["teacher"]}>
              {teacherApproved
                ? <LessonUploadPage />
                : <Navigate to="/profile/teacher" replace />}
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/teacher/live/control"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["teacher"]}>
              {teacherApproved
                ? <LiveClassControl />
                : <Navigate to="/profile/teacher" replace />}
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/teacher/live/dashboard/:liveSessionId"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["teacher"]}>
              {teacherApproved
                ? <LiveEmotionDashboard />
                : <Navigate to="/profile/teacher" replace />}
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/teacher/live/room/:liveSessionId"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["teacher"]}>
              {teacherApproved
                ? <TeacherLiveClass user={user} />
                : <Navigate to="/profile/teacher" replace />}
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/profile/teacher"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["teacher"]}>
              <TeacherProfilePage user={user} onProfileUpdated={handleProfileUpdated} />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/admin"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["admin"]}>
              <Navigate to="/admin/dashboard" replace />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/admin/dashboard"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["admin"]}>
              <AdminDashboard />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/admin/teachers"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["admin"]}>
              <AdminTeachersPage />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/admin/classes"
        element={(
          <RequireAuth user={user}>
            <RequireRole user={user} allow={["admin"]}>
              <AdminClassesPage />
            </RequireRole>
          </RequireAuth>
        )}
      />
      <Route
        path="/notifications"
        element={(
          <RequireAuth user={user}>
            <NotificationsPage onUnreadCountChange={setUnreadCount} />
          </RequireAuth>
        )}
      />
      <Route path="*" element={<Navigate to={user ? getRoleHomePath(user) : "/login"} replace />} />
    </Routes>
  );

  if (isAuthRoute && !user) {
    return appRoutes;
  }

  return (
    <AppLayout user={user} unreadCount={unreadCount} onLogout={handleLogout}>
      {appRoutes}
    </AppLayout>
  );
}
