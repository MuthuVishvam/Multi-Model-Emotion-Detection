import { useEffect, useState } from "react";

export default function AssignLessonModal({ isOpen, lesson, classes = [], onAssign, onClose }) {
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [publishAt, setPublishAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSelectedClassIds([]);
    setPublishAt("");
    setDueAt("");
    setIsPublished(true);
    setMessage("");
  }, [isOpen, lesson?.lesson_id]);

  if (!isOpen || !lesson) {
    return null;
  }

  function toggleClassId(classId) {
    setSelectedClassIds((current) => (
      current.includes(classId)
        ? current.filter((id) => id !== classId)
        : [...current, classId]
    ));
  }

  async function submitAssign() {
    if (selectedClassIds.length === 0) {
      setMessage("Select at least one class.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        class_ids: selectedClassIds,
        publish_at: publishAt ? new Date(publishAt).toISOString() : null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        is_published: isPublished,
      };
      await onAssign(lesson.lesson_id, payload);
      onClose();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card card">
        <div className="section-header-row">
          <h3>Assign Lesson</h3>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>

        <p className="small-note">
          <strong>{lesson.title}</strong>
        </p>

        <label>Choose Classes</label>
        <div className="modal-checkbox-list">
          {classes.map((classRow) => (
            <label key={classRow.class_id} className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedClassIds.includes(classRow.class_id)}
                onChange={() => toggleClassId(classRow.class_id)}
              />
              {classRow.class_name} ({classRow.section})
            </label>
          ))}
          {classes.length === 0 && <p className="small-note">No classes found. Create classes first.</p>}
        </div>

        <label>Publish At (optional)</label>
        <input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />

        <label>Due At (optional)</label>
        <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />

        <label className="checkbox-label">
          <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
          Publish immediately
        </label>

        <button onClick={submitAssign} disabled={saving}>
          {saving ? "Assigning..." : "Assign to Classes"}
        </button>
        {message && <p className="small-note">{message}</p>}
      </div>
    </div>
  );
}
