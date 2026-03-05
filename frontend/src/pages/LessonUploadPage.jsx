import { useEffect, useState } from "react";

import AssignLessonModal from "../components/AssignLessonModal";
import { assignLessonToClasses, createLesson, deleteLesson, fetchMyClasses, fetchMyLessons, updateLesson } from "../services/api";

const initialForm = {
  title: "",
  description: "",
  course_id: "",
  video_url: "",
  duration_sec: 0,
  resources: "",
};

export default function LessonUploadPage() {
  const [form, setForm] = useState(initialForm);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [classes, setClasses] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingLessonId, setDeletingLessonId] = useState("");
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState("");

  async function loadData() {
    const [lessonResult, classResult] = await Promise.allSettled([fetchMyLessons(), fetchMyClasses()]);
    const errors = [];

    if (lessonResult.status === "fulfilled") {
      setLessons(Array.isArray(lessonResult.value) ? lessonResult.value : []);
    } else {
      setLessons([]);
      errors.push(`Lessons: ${lessonResult.reason?.message || "Failed to fetch lessons"}`);
    }

    if (classResult.status === "fulfilled") {
      setClasses(Array.isArray(classResult.value) ? classResult.value : []);
    } else {
      setClasses([]);
      errors.push(`Classes: ${classResult.reason?.message || "Failed to fetch classes"}`);
    }

    setMessage(errors.join(" | "));
  }

  useEffect(() => {
    loadData();
  }, []);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSaveLesson() {
    setSaving(true);
    setMessage("");
    try {
      if (!form.title.trim()) {
        throw new Error("Title is required.");
      }
      if (!form.description.trim()) {
        throw new Error("Description is required.");
      }
      if (!form.course_id.trim()) {
        throw new Error("Course ID is required.");
      }
      if (!form.video_url.trim() && !uploadedFile) {
        throw new Error("Provide either Video URL or Upload File.");
      }

      if (editingLessonId) {
        await updateLesson(editingLessonId, form, uploadedFile);
        setMessage("Lesson updated.");
      } else {
        await createLesson(form, uploadedFile);
        setMessage("Lesson uploaded.");
      }
      setForm(initialForm);
      setUploadedFile(null);
      setEditingLessonId("");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignLesson(lessonId, payload) {
    await assignLessonToClasses(lessonId, payload);
    setMessage("Lesson assigned.");
    await loadData();
  }

  function handleEditLesson(lesson) {
    setEditingLessonId(String(lesson.lesson_id || ""));
    setForm({
      title: lesson.title || "",
      description: lesson.description || "",
      course_id: lesson.course_id || "",
      video_url: lesson.video_url || lesson.content || "",
      duration_sec: Number(lesson.duration_sec || 0),
      resources: Array.isArray(lesson.resources) ? lesson.resources.join(", ") : "",
    });
    setUploadedFile(null);
    setMessage("");
  }

  function handleCancelEdit() {
    setEditingLessonId("");
    setForm(initialForm);
    setUploadedFile(null);
    setMessage("");
  }

  async function handleDeleteLesson(lesson) {
    const lessonId = String(lesson.lesson_id || "");
    if (!lessonId) {
      return;
    }
    const confirmed = window.confirm(`Delete lesson "${lesson.title}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingLessonId(lessonId);
    setMessage("");
    try {
      await deleteLesson(lessonId);
      if (editingLessonId === lessonId) {
        handleCancelEdit();
      }
      if (selectedLesson?.lesson_id === lessonId) {
        setSelectedLesson(null);
      }
      setMessage("Lesson deleted.");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDeletingLessonId("");
    }
  }

  return (
    <div className="learning-page">
      <section className="card">
        <p className="eyebrow">Lesson Management</p>
        <h2>{editingLessonId ? "Edit Lesson" : "Upload Lesson"}</h2>
        <p className="small-note">
          Format: enter <strong>Title</strong>, <strong>Description</strong>, <strong>Course ID</strong>, then add
          either a <strong>Video URL</strong> or upload a <strong>video file</strong>. Example course ID:
          <code> live-classroom-studio</code>.
        </p>
        <p className="small-note">
          Resources format: comma-separated values, for example:
          <code> Slides.pdf, Worksheet.docx, Quiz Link</code>.
        </p>

        <label>Title</label>
        <input
          value={form.title}
          onChange={(event) => setField("title", event.target.value)}
          placeholder="Ex: Intro to Emotion AI"
        />

        <label>Description</label>
        <textarea
          value={form.description}
          onChange={(event) => setField("description", event.target.value)}
          placeholder="Write what students will learn in this lesson."
        />

        <label>Course ID</label>
        <input
          value={form.course_id}
          onChange={(event) => setField("course_id", event.target.value)}
          placeholder="Ex: live-classroom-studio"
        />

        <label>Video URL (optional if file uploaded)</label>
        <input
          value={form.video_url}
          onChange={(event) => setField("video_url", event.target.value)}
          placeholder="Ex: https://www.youtube.com/watch?v=..."
        />

        <label>Upload Video/File (optional if video URL given)</label>
        <input
          type="file"
          accept=".mp4,.webm,.ogg,.mov,.m4v,video/*"
          onChange={(event) => setUploadedFile(event.target.files?.[0] || null)}
        />

        <label>Duration (seconds)</label>
        <input
          type="number"
          min={0}
          value={form.duration_sec}
          onChange={(event) => setField("duration_sec", Number(event.target.value || 0))}
        />

        <label>Resources (comma separated)</label>
        <input value={form.resources} onChange={(event) => setField("resources", event.target.value)} />

        <button onClick={handleSaveLesson} disabled={saving}>
          {saving ? (editingLessonId ? "Saving..." : "Uploading...") : (editingLessonId ? "Save Changes" : "Upload Lesson")}
        </button>
        {editingLessonId && (
          <button className="secondary" onClick={handleCancelEdit} disabled={saving}>
            Cancel Edit
          </button>
        )}
      </section>

      {message && <div className="card inline-message">{message}</div>}

      <section className="card">
        <div className="section-header-row">
          <h3>My Lessons</h3>
          <button className="secondary" onClick={loadData}>Refresh</button>
        </div>

        <table className="student-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Course ID</th>
              <th>Duration</th>
              <th>Assignments</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => (
              <tr key={lesson.lesson_id}>
                <td>{lesson.title}</td>
                <td>{lesson.course_id}</td>
                <td>{lesson.duration_sec}s</td>
                <td>{lesson.assignments?.length || 0}</td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => handleEditLesson(lesson)}
                    disabled={deletingLessonId === lesson.lesson_id}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setSelectedLesson(lesson)}
                    disabled={deletingLessonId === lesson.lesson_id}
                  >
                    Assign
                  </button>
                  <button
                    className="danger"
                    onClick={() => handleDeleteLesson(lesson)}
                    disabled={deletingLessonId === lesson.lesson_id}
                    aria-label="Delete lesson"
                    title="Delete lesson"
                  >
                    {"\u{1F5D1}"}
                  </button>
                </td>
              </tr>
            ))}
            {lessons.length === 0 && (
              <tr>
                <td colSpan={5}>No lessons uploaded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <AssignLessonModal
        isOpen={Boolean(selectedLesson)}
        lesson={selectedLesson}
        classes={classes}
        onAssign={handleAssignLesson}
        onClose={() => setSelectedLesson(null)}
      />
    </div>
  );
}

