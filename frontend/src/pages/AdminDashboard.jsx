import { useEffect, useMemo, useState } from "react";

import {
  approveTeacherById,
  disableTeacherById,
  enableTeacherById,
  getAllTeachers,
  getPendingTeachers,
  rejectTeacherById,
} from "../services/adminApi";

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

function toBoolLabel(value) {
  return value ? "true" : "false";
}

export default function AdminDashboard() {
  const [pendingTeachers, setPendingTeachers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingTeacherId, setActingTeacherId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadTeachers() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [pendingRows, teacherRows] = await Promise.all([getPendingTeachers(), getAllTeachers()]);
      setPendingTeachers(Array.isArray(pendingRows) ? pendingRows : []);
      setTeachers(Array.isArray(teacherRows) ? teacherRows : []);
    } catch (error) {
      setPendingTeachers([]);
      setTeachers([]);
      setErrorMessage(error.message || "Failed to load teachers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeachers();
  }, []);

  const summary = useMemo(() => {
    const totalTeachers = teachers.length;
    const pendingCount = teachers.filter((row) => (row.status || "pending") === "pending").length;
    const approvedCount = teachers.filter((row) => (row.status || "pending") === "approved").length;
    const disabledCount = teachers.filter((row) => row.is_active === false).length;

    return {
      totalTeachers,
      pendingCount,
      approvedCount,
      disabledCount,
    };
  }, [teachers]);

  async function handleTeacherAction(teacherId, actionName) {
    setActingTeacherId(teacherId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (actionName === "approve") {
        await approveTeacherById(teacherId);
        setSuccessMessage("Teacher approved.");
      } else if (actionName === "reject") {
        await rejectTeacherById(teacherId);
        setSuccessMessage("Teacher rejected.");
      } else if (actionName === "disable") {
        await disableTeacherById(teacherId);
        setSuccessMessage("Teacher disabled.");
      } else if (actionName === "enable") {
        await enableTeacherById(teacherId);
        setSuccessMessage("Teacher enabled.");
      }
      await loadTeachers();
    } catch (error) {
      setErrorMessage(error.message || "Teacher action failed.");
    } finally {
      setActingTeacherId("");
    }
  }

  return (
    <div className="learning-page">
      <section className="card">
        <div className="section-header-row">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Admin Dashboard</h2>
          </div>
          <button className="secondary" onClick={loadTeachers} disabled={loading}>
            Refresh
          </button>
        </div>

        {errorMessage && <div className="inline-message inline-message-soft">{errorMessage}</div>}
        {successMessage && <div className="inline-message inline-message-soft">{successMessage}</div>}

        <div className="stats-row">
          <article className="card stat-card">Total Teachers: {summary.totalTeachers}</article>
          <article className="card stat-card">Pending Teachers: {summary.pendingCount}</article>
          <article className="card stat-card">Approved Teachers: {summary.approvedCount}</article>
          <article className="card stat-card">Disabled Teachers: {summary.disabledCount}</article>
        </div>
      </section>

      <section className="card">
        <div className="section-header-row">
          <h3>Pending Teachers</h3>
          <span>{pendingTeachers.length} total</span>
        </div>

        {loading ? (
          <p className="small-note">Loading pending teachers...</p>
        ) : (
          <table className="student-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingTeachers.map((teacher) => {
                const isBusy = actingTeacherId === teacher.id;
                const isActive = teacher.is_active !== false;
                return (
                  <tr key={teacher.id}>
                    <td>{teacher.full_name || "-"}</td>
                    <td>{teacher.email || "-"}</td>
                    <td>{teacher.department || "-"}</td>
                    <td>{formatDateTime(teacher.created_at)}</td>
                    <td>
                      <button onClick={() => handleTeacherAction(teacher.id, "approve")} disabled={isBusy}>
                        Approve
                      </button>
                      <button className="danger" onClick={() => handleTeacherAction(teacher.id, "reject")} disabled={isBusy}>
                        Reject
                      </button>
                      <button
                        className="secondary"
                        onClick={() => handleTeacherAction(teacher.id, isActive ? "disable" : "enable")}
                        disabled={isBusy}
                      >
                        {isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pendingTeachers.length === 0 && (
                <tr>
                  <td colSpan={5}>No pending teachers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="section-header-row">
          <h3>All Teachers</h3>
          <span>{teachers.length} total</span>
        </div>

        {loading ? (
          <p className="small-note">Loading teachers...</p>
        ) : (
          <table className="student-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Is Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => {
                const isBusy = actingTeacherId === teacher.id;
                const isActive = teacher.is_active !== false;
                return (
                  <tr key={teacher.id}>
                    <td>{teacher.full_name || "-"}</td>
                    <td>{teacher.email || "-"}</td>
                    <td>{teacher.status || "pending"}</td>
                    <td>{toBoolLabel(Boolean(teacher.verified))}</td>
                    <td>{toBoolLabel(isActive)}</td>
                    <td>
                      <button onClick={() => handleTeacherAction(teacher.id, "approve")} disabled={isBusy}>
                        Approve
                      </button>
                      <button className="danger" onClick={() => handleTeacherAction(teacher.id, "reject")} disabled={isBusy}>
                        Reject
                      </button>
                      <button
                        className="secondary"
                        onClick={() => handleTeacherAction(teacher.id, isActive ? "disable" : "enable")}
                        disabled={isBusy}
                      >
                        {isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={6}>No teachers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
