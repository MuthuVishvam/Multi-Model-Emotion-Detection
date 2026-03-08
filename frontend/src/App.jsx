import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";

import AppSidebar from "./components/AppSidebar";
import { fetchCurrentUser, fetchNotifications } from "./services/api";
import NotificationBell from "./components/NotificationBell";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import AdminClassesPage from "./pages/AdminClassesPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTeachersPage from "./pages/AdminTeachersPage";
import StudentDashboard from "./pages/StudentDashboard";
import CourseDetailPage from "./pages/CourseDetailPage";
import ClassLessonsPage from "./pages/ClassLessonsPage";
import LessonPlayer from "./pages/LessonPlayer";
import LessonUploadPage from "./pages/LessonUploadPage";
import LoginPage from "./pages/LoginPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import StudentClassesPage from "./pages/StudentClassesPage";
import StudentProfilePage from "./pages/StudentProfilePage";
import TeacherClassesPage from "./pages/TeacherClassesPage";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherProfilePage from "./pages/TeacherProfilePage";

function getRoleHomePath(user) {
  if (!user) {
    return "/";
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

function AppNavbar({ user, unreadCount, onLogout }) {
  const homePath = getRoleHomePath(user);
  const teacherStatus = user?.status ?? "pending";
  const teacherVerified = user?.verified ?? false;
  const teacherApproved = teacherStatus === "approved" && teacherVerified;

  return (
    <header className="top-navbar">
      <div className="top-navbar__brand">
        <Link to={homePath}>MELD Learn</Link>
        <span className="top-navbar__subtitle">Emotion-aware course experience</span>
      </div>

      {user ? (
        <nav className="top-navbar__nav" aria-label="Primary">
          {user.role === "student" && (
            <>
              <NavLink to="/student" end className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
                Catalog
              </NavLink>
              <NavLink to="/student/classes" className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
                My Classes
              </NavLink>
              <NavLink to="/profile/student" className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
                Profile
              </NavLink>
            </>
          )}
          {user.role === "teacher" && (
            <>
              {teacherApproved && (
                <>
                  <NavLink to="/teacher" end className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
                    Analytics
                  </NavLink>
                  <NavLink to="/teacher/classes" className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
                    Classes
                  </NavLink>
                  <NavLink to="/teacher/lessons" className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
                    Lessons
                  </NavLink>
                </>
              )}
              <NavLink to="/profile/teacher" className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
                Profile
              </NavLink>
            </>
          )}
          {user.role === "admin" && (
            <>
              <NavLink to="/admin/dashboard" className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
                Admin Dashboard
              </NavLink>
              <NavLink to="/admin/teachers" className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
                Teachers
              </NavLink>
              <NavLink to="/admin/classes" className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
                Classes
              </NavLink>
            </>
          )}
        </nav>
      ) : (
        <nav className="top-navbar__nav" aria-label="Primary">
          <NavLink to="/login" className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
            Login
          </NavLink>
          <NavLink to="/register" className={({ isActive }) => isActive ? "nav-pill active" : "nav-pill"}>
            Register
          </NavLink>
        </nav>
      )}

      {user && (
        <div className="user-chip">
          <NotificationBell unreadCount={unreadCount} />
          <span>{user.email} ({user.role})</span>
          <button className="secondary" onClick={onLogout}>Logout</button>
        </div>
      )}
    </header>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const teacherStatus = user?.status ?? "pending";
  const teacherVerified = user?.verified ?? false;
  const teacherApproved = teacherStatus === "approved" && teacherVerified;

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
    async function loadUser() {
      const profile = await fetchCurrentUser();
      setUser(profile);
      setLoading(false);
    }
    loadUser();
  }, []);

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

  function handleLogin(profile) {
    setUser(profile);
    navigate(getRoleHomePath(profile), { replace: true });
  }

  function handleProfileUpdated(profile) {
    setUser(profile);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setUser(null);
    setUnreadCount(0);
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container app-shell">
      <AppNavbar user={user} unreadCount={unreadCount} onLogout={handleLogout} />

      <div className={user ? "app-body app-body--with-sidebar" : "app-body"}>
        {user && <AppSidebar user={user} />}

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to={user ? getRoleHomePath(user) : "/login"} replace />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />

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
            <Route path="*" element={<Navigate to={getRoleHomePath(user)} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
