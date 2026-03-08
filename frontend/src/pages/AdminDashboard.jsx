import { useEffect, useMemo, useState } from "react";

import StatCard from "../components/StatCard";
import TeacherApprovalTable from "../components/TeacherApprovalTable";
import {
  approveTeacherById,
  disableTeacherById,
  enableTeacherById,
  getAllTeachers,
  getPendingTeachers,
  rejectTeacherById,
} from "../services/adminApi";

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
        <p className="eyebrow">Admin</p>
        <div className="section-header-row">
          <div>
            <h2>Admin Dashboard</h2>
            <p className="small-note">Review teacher onboarding, approvals, and account states.</p>
          </div>
          <button className="secondary" onClick={loadTeachers} disabled={loading}>
            Refresh
          </button>
        </div>

        {errorMessage && <div className="inline-message inline-message-soft">{errorMessage}</div>}
        {successMessage && <div className="inline-message inline-message-soft">{successMessage}</div>}

        <div className="stats-row">
          <StatCard label="Total Teachers" value={summary.totalTeachers} tone="info" />
          <StatCard label="Pending" value={summary.pendingCount} tone="warning" />
          <StatCard label="Approved" value={summary.approvedCount} tone="success" />
          <StatCard label="Disabled" value={summary.disabledCount} tone="danger" />
        </div>
      </section>

      <TeacherApprovalTable
        title="Pending Teachers"
        teachers={pendingTeachers}
        loading={loading}
        mode="pending"
        actingTeacherId={actingTeacherId}
        onApprove={(id) => handleTeacherAction(id, "approve")}
        onReject={(id) => handleTeacherAction(id, "reject")}
        onDisable={(id) => handleTeacherAction(id, "disable")}
        onEnable={(id) => handleTeacherAction(id, "enable")}
      />

      <TeacherApprovalTable
        title="All Teachers"
        teachers={teachers}
        loading={loading}
        mode="all"
        actingTeacherId={actingTeacherId}
        onApprove={(id) => handleTeacherAction(id, "approve")}
        onReject={(id) => handleTeacherAction(id, "reject")}
        onDisable={(id) => handleTeacherAction(id, "disable")}
        onEnable={(id) => handleTeacherAction(id, "enable")}
      />
    </div>
  );
}
