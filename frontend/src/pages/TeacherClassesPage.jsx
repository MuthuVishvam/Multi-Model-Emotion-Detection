import { useEffect, useState } from "react";

import ClassDetail from "../components/ClassDetail";
import ClassList from "../components/ClassList";
import CreateClassForm from "../components/CreateClassForm";
import { createClass, fetchClassDetail, fetchMyClasses, inviteStudentsToClass } from "../services/api";

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedClassDetail, setSelectedClassDetail] = useState(null);
  const [message, setMessage] = useState("");

  async function loadClasses(nextSelectedClassId = "") {
    try {
      const rows = await fetchMyClasses();
      const classRows = Array.isArray(rows) ? rows : [];
      setClasses(classRows);
      const chosenId = nextSelectedClassId || selectedClassId || classRows[0]?.class_id || "";
      setSelectedClassId(chosenId);
      if (chosenId) {
        const detail = await fetchClassDetail(chosenId);
        setSelectedClassDetail(detail);
      } else {
        setSelectedClassDetail(null);
      }
      setMessage("");
    } catch (error) {
      setMessage(error.message);
      setClasses([]);
      setSelectedClassDetail(null);
    }
  }

  useEffect(() => {
    loadClasses();
  }, []);

  async function handleCreateClass(payload) {
    const created = await createClass(payload);
    await loadClasses(created.class_id);
  }

  async function handleSelectClass(classId) {
    setSelectedClassId(classId);
    try {
      const detail = await fetchClassDetail(classId);
      setSelectedClassDetail(detail);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
      setSelectedClassDetail(null);
    }
  }

  async function handleInvite(classId, payload) {
    const result = await inviteStudentsToClass(classId, payload);
    await loadClasses(classId);
    return result;
  }

  return (
    <div className="learning-page">
      {message && <div className="card inline-message">{message}</div>}
      <CreateClassForm onCreateClass={handleCreateClass} />
      <ClassList classes={classes} selectedClassId={selectedClassId} onSelectClass={handleSelectClass} />
      <ClassDetail classDetail={selectedClassDetail} onInvite={handleInvite} />
    </div>
  );
}

