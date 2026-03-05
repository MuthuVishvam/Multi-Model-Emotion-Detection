import { useEffect, useState } from "react";

import {
  approveTeacher,
  disableUserAccount,
  fetchAdminTeachers,
  fetchAdminClasses,
  fetchPendingTeachers,
  rejectTeacher,
} from "../services/api";

function mapTeacherAccounts(teachers, classRows) {
  const classStatsByTeacher = new Map();
  (classRows || []).forEach((row) => {
    if (!row.teacher_id) {
      return;
    }
    const current = classStatsByTeacher.get(row.teacher_id) || { class_count: 0, student_count: 0 };
    current.class_count += 1;
    current.student_count += Number(row.student_count || 0);
    classStatsByTeacher.set(row.teacher_id, current);
  });

  return (teachers || [])
    .map((teacher) => {
      const stats = classStatsByTeacher.get(teacher.id) || { class_count: 0, student_count: 0 };
      return {
        teacher_id: teacher.id,
        teacher_name: teacher.full_name || "-",
        teacher_email: teacher.email || "-",
        teacher_username: teacher.username || "-",
        teacher_status: teacher.status || "-",
        teacher_is_active: teacher.is_active !== false,
        class_count: stats.class_count,
        student_count: stats.student_count,
      };
    })
    .sort((a, b) => a.teacher_name.localeCompare(b.teacher_name));
}

export default function AdminTeachersPage() {
  const [pendingTeachers, setPendingTeachers] = useState([]);
  const [teacherAccounts, setTeacherAccounts] = useState([]);
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [message, setMessage] = useState("");
  const [actingId, setActingId] = useState("");

  async function loadPendingTeachers() {
    setIsLoadingPending(true);
    try {
      const rows = await fetchPendingTeachers();
      setPendingTeachers(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setPendingTeachers([]);
      setMessage(error.message || "Failed to load pending teachers.");
    } finally {
      setIsLoadingPending(false);
    }
  }

  async function loadTeacherAccounts() {
    setIsLoadingAccounts(true);
    try {
      const [teacherRows, classRows] = await Promise.all([
        fetchAdminTeachers(),
        fetchAdminClasses(),
      ]);
      setTeacherAccounts(
        mapTeacherAccounts(
          Array.isArray(teacherRows) ? teacherRows : [],
          Array.isArray(classRows) ? classRows : []
        )
      );
    } catch (error) {
      setTeacherAccounts([]);
      setMessage(error.message || "Failed to load teacher accounts.");
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  async function refreshAll() {
    setMessage("");
    await Promise.all([loadPendingTeachers(), loadTeacherAccounts()]);
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function handleApprove(teacherId) {
    setActingId(teacherId);
    try {
      await approveTeacher(teacherId);
      await refreshAll();
      setMessage("Teacher approved.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActingId("");
    }
  }

  async function handleReject(teacherId) {
    setActingId(teacherId);
    try {
      await rejectTeacher(teacherId);
      await refreshAll();
      setMessage("Teacher rejected.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActingId("");
    }
  }

  async function handleDisable(teacherId) {
    setActingId(teacherId);
    try {
      await disableUserAccount(teacherId);
      await refreshAll();
      setMessage("Teacher account disabled.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActingId("");
    }
  }

  const pendingLoading = isLoadingPending;
  const accountsLoading = isLoadingAccounts;

  return (
    <div className="learning-page">
      <section className="card">
        <div className="section-header-row">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Teacher Verification Requests</h2>
          </div>
          <button className="secondary" onClick={refreshAll} disabled={pendingLoading || accountsLoading}>
            Refresh
          </button>
        </div>

        {message && <div className="inline-message inline-message-soft">{message}</div>}

        {pendingLoading ? (
          <p className="small-note">Loading pending teachers...</p>
        ) : (
          <table className="student-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Username</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingTeachers.map((teacher) => {
                const isBusy = actingId === teacher.id;
                return (
                  <tr key={teacher.id}>
                    <td>{teacher.full_name || "-"}</td>
                    <td>{teacher.email}</td>
                    <td>{teacher.username || "-"}</td>
                    <td>{teacher.designation || "-"}</td>
                    <td>{teacher.department || "-"}</td>
                    <td>{teacher.status}</td>
                    <td>
                      <button onClick={() => handleApprove(teacher.id)} disabled={isBusy}>Approve</button>
                      <button className="danger" onClick={() => handleReject(teacher.id)} disabled={isBusy}>Reject</button>
                      <button className="secondary" onClick={() => handleDisable(teacher.id)} disabled={isBusy || teacher.is_active === false}>
                        {teacher.is_active === false ? "Disabled" : "Disable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pendingTeachers.length === 0 && (
                <tr>
                  <td colSpan={7}>No pending teacher requests.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="section-header-row">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Teacher Accounts</h2>
          </div>
          <span>{teacherAccounts.length} teachers</span>
        </div>

        {accountsLoading ? (
          <p className="small-note">Loading teacher accounts...</p>
        ) : (
          <table className="student-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Username</th>
                <th>Account</th>
                <th>Verification</th>
                <th>Classes</th>
                <th>Students</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {teacherAccounts.map((row) => {
                const isBusy = actingId === row.teacher_id;
                return (
                  <tr key={row.teacher_id}>
                    <td>{row.teacher_name}</td>
                    <td>{row.teacher_email}</td>
                    <td>{row.teacher_username}</td>
                    <td>{row.teacher_is_active ? "active" : "disabled"}</td>
                    <td>{row.teacher_status}</td>
                    <td>{row.class_count}</td>
                    <td>{row.student_count}</td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() => handleDisable(row.teacher_id)}
                        disabled={isBusy || !row.teacher_is_active}
                      >
                        {row.teacher_is_active ? "Disable Teacher" : "Disabled"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {teacherAccounts.length === 0 && (
                <tr>
                  <td colSpan={8}>No teacher accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

