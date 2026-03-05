import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchAdminClasses, fetchAdminTeachers, fetchPendingTeachers } from "../services/api";

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString();
}

export default function AdminDashboardPage() {
  const [pendingTeachers, setPendingTeachers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [pendingRows, teacherRows, classRows] = await Promise.all([
        fetchPendingTeachers(),
        fetchAdminTeachers(),
        fetchAdminClasses(),
      ]);
      setPendingTeachers(Array.isArray(pendingRows) ? pendingRows : []);
      setTeachers(Array.isArray(teacherRows) ? teacherRows : []);
      setClasses(Array.isArray(classRows) ? classRows : []);
      setMessage("");
    } catch (error) {
      setPendingTeachers([]);
      setTeachers([]);
      setClasses([]);
      setMessage(error.message || "Failed to load admin dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const summary = useMemo(() => {
    let totalStudents = 0;

    classes.forEach((row) => {
      totalStudents += Number(row.student_count || 0);
    });

    const teacherCount = teachers.length;
    const disabledTeacherCount = teachers.filter((row) => row.is_active === false).length;

    return {
      pending_count: pendingTeachers.length,
      class_count: classes.length,
      teacher_count: teacherCount,
      disabled_teacher_count: disabledTeacherCount,
      total_students: totalStudents,
    };
  }, [pendingTeachers, teachers, classes]);

  return (
    <div className="learning-page">
      <section className="card">
        <div className="section-header-row">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>System Overview</h2>
          </div>
          <button className="secondary" onClick={loadDashboardData} disabled={loading}>Refresh</button>
        </div>
        {message && <div className="inline-message inline-message-soft">{message}</div>}

        <div className="stats-row">
          <article className="card stat-card">
            Pending teachers: {summary.pending_count}
          </article>
          <article className="card stat-card">
            Total classes: {summary.class_count}
          </article>
          <article className="card stat-card">
            Active teachers: {Math.max(summary.teacher_count - summary.disabled_teacher_count, 0)}
          </article>
          <article className="card stat-card">
            Disabled teachers: {summary.disabled_teacher_count}
          </article>
        </div>

        <p className="small-note">
          Joined student memberships across classes: {summary.total_students}
        </p>

        <div className="lesson-page-header__actions">
          <Link className="button-link button-link-secondary" to="/admin/teachers">
            Manage Teachers
          </Link>
          <Link className="button-link button-link-secondary" to="/admin/classes">
            View Classes
          </Link>
        </div>
      </section>

      <section className="card">
        <div className="section-header-row">
          <h3>Recent Classes</h3>
          <span>{classes.length} total</span>
        </div>

        {loading ? (
          <p className="small-note">Loading classes...</p>
        ) : (
          <table className="student-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Teacher</th>
                <th>Students</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {classes.slice(0, 10).map((row) => (
                <tr key={row.class_id}>
                  <td>{row.class_name}</td>
                  <td>{row.section}</td>
                  <td>{row.teacher_full_name || row.teacher_email || "-"}</td>
                  <td>{Number(row.student_count || 0)}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
              {classes.length === 0 && (
                <tr>
                  <td colSpan={5}>No classes found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

