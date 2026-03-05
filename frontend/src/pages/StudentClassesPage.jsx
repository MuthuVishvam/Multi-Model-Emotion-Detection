import { useEffect, useState } from "react";

import JoinClassByCode from "../components/JoinClassByCode";
import MyClasses from "../components/MyClasses";
import { fetchMyClasses, joinClassByCode } from "../services/api";

export default function StudentClassesPage() {
  const [classes, setClasses] = useState([]);
  const [message, setMessage] = useState("");

  async function loadMyClasses() {
    try {
      const rows = await fetchMyClasses();
      setClasses(Array.isArray(rows) ? rows : []);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
      setClasses([]);
    }
  }

  useEffect(() => {
    loadMyClasses();
  }, []);

  async function handleJoin(joinCode) {
    await joinClassByCode(joinCode);
    await loadMyClasses();
  }

  return (
    <div className="learning-page">
      {message && <div className="card inline-message">{message}</div>}
      <JoinClassByCode onJoin={handleJoin} />
      <MyClasses classes={classes} />
    </div>
  );
}

