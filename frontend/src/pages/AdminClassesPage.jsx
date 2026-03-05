import { useEffect, useState } from "react";

import { disableUserAccount, fetchAdminClasses } from "../services/api";

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

export default function AdminClassesPage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingTeacherId, setActingTeacherId] = useState("");
  const [message, setMessage] = useState("");

  async function loadClasses() {
    setLoading(true);
    try {
      const rows = await fetchAdminClasses();
      setClasses(Array.isArray(rows) ? rows : []);
      setMessage("");
    } catch (error) {
      setClasses([]);
      setMessage(error.message || "Failed to load classes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClasses();
  }, []);

  async function handleDisableTeacher(teacherId) {
    setActingTeacherId(teacherId);
    try {
      await disableUserAccount(teacherId);
      await loadClasses();
      setMessage("Teacher account disabled.");
    } catch (error) {
      setMessage(error.message || "Failed to disable teacher.");
    } finally {
      setActingTeacherId("");
    }
  }

  return (
    <section className="card">
      <div className="section-header-row">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>All Classes</h2>
        </div>
        <button className="secondary" onClick={loadClasses} disabled={loading}>Refresh</button>
      </div>

      {message && <div className="inline-message inline-message-soft">{message}</div>}

      {loading ? (
        <p className="small-note">Loading class overview...</p>
      ) : (
        <table className="student-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Section</th>
              <th>Semester</th>
              <th>Teacher</th>
              <th>Teacher Email</th>
              <th>Teacher Status</th>
              <th>Teacher Account</th>
              <th>Student Count</th>
              <th>Created At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((row) => {
              const isBusy = actingTeacherId === row.teacher_id;
              const teacherEnabled = row.teacher_is_active !== false;
              const canDisable = Boolean(row.teacher_id) && teacherEnabled;
              return (
                <tr key={row.class_id}>
                  <td>{row.class_name}</td>
                  <td>{row.section}</td>
                  <td>{row.semester}</td>
                  <td>{row.teacher_full_name || "-"}</td>
                  <td>{row.teacher_email || "-"}</td>
                  <td>{row.teacher_status || "-"}</td>
                  <td>{teacherEnabled ? "active" : "disabled"}</td>
                  <td>{Number(row.student_count || 0)}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>
                    <button
                      className="secondary"
                      disabled={isBusy || !canDisable}
                      onClick={() => handleDisableTeacher(row.teacher_id)}
                    >
                      {teacherEnabled ? "Disable Teacher" : "Disabled"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {classes.length === 0 && (
              <tr>
                <td colSpan={10}>No classes available.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

