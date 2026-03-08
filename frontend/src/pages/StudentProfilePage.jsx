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
      <div className="profile-page__header">
        <div>
          <p className="eyebrow">Student Profile</p>
          <h2>My Profile</h2>
        </div>
        <span className="status-chip status-chip--student">Student</span>
      </div>

      <form
        className="profile-form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <label>
          Full Name
          <input value={form.full_name} onChange={(event) => onFieldChange("full_name", event.target.value)} />
        </label>

        <label>
          Email
          <input value={form.email} onChange={(event) => onFieldChange("email", event.target.value)} />
        </label>

        <label>
          Username
          <input value={form.username} onChange={(event) => onFieldChange("username", event.target.value)} />
        </label>

        <label>
          Phone
          <input value={form.phone} onChange={(event) => onFieldChange("phone", event.target.value)} />
        </label>

        <label>
          Department
          <input value={form.department} onChange={(event) => onFieldChange("department", event.target.value)} />
        </label>

        <label>
          Year
          <input value={form.year} onChange={(event) => onFieldChange("year", event.target.value)} />
        </label>

        <label>
          Avatar URL
          <input value={form.avatar_url} onChange={(event) => onFieldChange("avatar_url", event.target.value)} />
        </label>

        <label className="profile-form-grid__full">
          Bio
          <textarea value={form.bio} onChange={(event) => onFieldChange("bio", event.target.value)} />
        </label>

        <div className="profile-form-grid__full">
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
          {message && <p className="small-note">{message}</p>}
        </div>
      </form>
    </section>
  );
}

