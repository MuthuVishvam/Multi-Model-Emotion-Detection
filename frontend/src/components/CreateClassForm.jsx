import { useState } from "react";

const initialForm = {
  class_name: "",
  section: "",
  semester: "",
  description: "",
  course_ids: "",
};

export default function CreateClassForm({ onCreateClass }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function submitForm() {
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        class_name: form.class_name.trim(),
        section: form.section.trim(),
        semester: form.semester.trim(),
        description: form.description.trim() || null,
        course_ids: form.course_ids
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      };
      await onCreateClass(payload);
      setForm(initialForm);
      setMessage("Class created.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <p className="eyebrow">Create Class</p>
      <label>Class Name</label>
      <input value={form.class_name} onChange={(event) => setField("class_name", event.target.value)} />

      <label>Section</label>
      <input value={form.section} onChange={(event) => setField("section", event.target.value)} />

      <label>Semester</label>
      <input value={form.semester} onChange={(event) => setField("semester", event.target.value)} />

      <label>Description</label>
      <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} />

      <label>Course IDs (optional, comma separated)</label>
      <input value={form.course_ids} onChange={(event) => setField("course_ids", event.target.value)} />

      <button onClick={submitForm} disabled={saving}>
        {saving ? "Creating..." : "Create Class"}
      </button>
      {message && <p className="small-note">{message}</p>}
    </section>
  );
}
