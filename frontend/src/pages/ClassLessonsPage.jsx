import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchClassDetail, fetchClassLessons } from "../services/api";

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

export default function ClassLessonsPage() {
  const { classId } = useParams();
  const [classDetail, setClassDetail] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [message, setMessage] = useState("");

  async function loadPageData() {
    if (!classId) {
      return;
    }
    try {
      const [classData, lessonRows] = await Promise.all([
        fetchClassDetail(classId),
        fetchClassLessons(classId),
      ]);
      setClassDetail(classData);
      setLessons(Array.isArray(lessonRows) ? lessonRows : []);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
      setClassDetail(null);
      setLessons([]);
    }
  }

  useEffect(() => {
    loadPageData();
  }, [classId]);

  return (
    <div className="learning-page">
      <section className="card">
        <p className="eyebrow">Class Lessons</p>
        <h2>{classDetail?.class_name || "Class"}</h2>
        <p className="small-note">
          {classDetail ? `${classDetail.section} | ${classDetail.semester}` : "Loading class details..."}
        </p>
      </section>

      {message && <div className="card inline-message">{message}</div>}

      <section className="card">
        <div className="section-header-row">
          <h3>Assigned Lessons</h3>
          <button className="secondary" onClick={loadPageData}>Refresh</button>
        </div>

        <table className="student-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Course ID</th>
              <th>Publish At</th>
              <th>Due At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => {
              const assignment = lesson.assignments?.[0] || {};
              return (
                <tr key={lesson.lesson_id}>
                  <td>{lesson.title}</td>
                  <td>{lesson.course_id}</td>
                  <td>{formatDate(assignment.publish_at)}</td>
                  <td>{formatDate(assignment.due_at)}</td>
                  <td>
                    <Link className="button-link button-link-secondary" to={`/student/classes/${classId}/lessons/${lesson.lesson_id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
            {lessons.length === 0 && (
              <tr>
                <td colSpan={5}>No assigned lessons for this class yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

