import { Link, Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import StudentSessionPage from "./pages/StudentSessionPage";
import TeacherDashboardPage from "./pages/TeacherDashboardPage";

export default function App() {
  return (
    <div className="container">
      <h1>AI Emotion Detection</h1>
      <nav>
        <Link to="/">Login</Link>
        <Link to="/student">Student Session</Link>
        <Link to="/teacher">Teacher Dashboard</Link>
      </nav>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/student" element={<StudentSessionPage />} />
        <Route path="/teacher" element={<TeacherDashboardPage />} />
      </Routes>
    </div>
  );
}
