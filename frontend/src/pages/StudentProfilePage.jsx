import { useEffect, useState } from "react";

import { updateMyProfile } from "../services/api";

function toForm(user) {
  return {
    full_name: user?.full_name || "",
    email: user?.email || "",
    username: user?.username || "",
    phone: user?.phone || "",
    department: user?.department || "",
    year: user?.year || "",
    avatar_url: user?.avatar_url || "",
    bio: user?.bio || "",
  };
}

export default function StudentProfilePage({ user, onProfileUpdated }) {
  const [form, setForm] = useState(() => toForm(user));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(toForm(user));
  }, [user]);

  function onFieldChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const updated = await updateMyProfile(form);
      onProfileUpdated(updated);
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card profile-page">
      <p className="eyebrow">Student Profile</p>
      <h2>My Profile</h2>

      <label>Full Name</label>
      <input value={form.full_name} onChange={(event) => onFieldChange("full_name", event.target.value)} />

      <label>Email</label>
      <input value={form.email} onChange={(event) => onFieldChange("email", event.target.value)} />

      <label>Username</label>
      <input value={form.username} onChange={(event) => onFieldChange("username", event.target.value)} />

      <label>Phone (optional)</label>
      <input value={form.phone} onChange={(event) => onFieldChange("phone", event.target.value)} />

      <label>Department (optional)</label>
      <input value={form.department} onChange={(event) => onFieldChange("department", event.target.value)} />

      <label>Year (optional)</label>
      <input value={form.year} onChange={(event) => onFieldChange("year", event.target.value)} />

      <label>Avatar URL (optional)</label>
      <input value={form.avatar_url} onChange={(event) => onFieldChange("avatar_url", event.target.value)} />

      <label>Bio (optional)</label>
      <textarea value={form.bio} onChange={(event) => onFieldChange("bio", event.target.value)} />

      <button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Profile"}
      </button>
      {message && <p className="small-note">{message}</p>}
    </section>
  );
}

