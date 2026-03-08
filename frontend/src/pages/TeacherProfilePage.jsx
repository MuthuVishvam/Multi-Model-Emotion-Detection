import { useEffect, useState } from "react";

import { updateMyProfile } from "../services/api";

function toForm(user) {
  return {
    full_name: user?.full_name || "",
    email: user?.email || "",
    username: user?.username || "",
    phone: user?.phone || "",
    designation: user?.designation || "",
    department: user?.department || "",
    experience_years: user?.experience_years ?? "",
    avatar_url: user?.avatar_url || "",
    bio: user?.bio || "",
  };
}

export default function TeacherProfilePage({ user, onProfileUpdated }) {
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
      const payload = {
        ...form,
        experience_years: form.experience_years === "" ? null : Number(form.experience_years),
      };
      const updated = await updateMyProfile(payload);
      onProfileUpdated(updated);
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  const statusText = user?.status || "pending";
  const verifiedText = user?.verified ? "Verified" : "Not verified";

  return (
    <section className="card profile-page">
      <div className="profile-page__header">
        <div>
          <p className="eyebrow">Teacher Profile</p>
          <h2>My Profile</h2>
          <p className="small-note">Complete your profile so admin and students can identify your teaching context.</p>
        </div>
        <div className="status-chip-row">
          <span className={`status-chip ${statusText === "approved" ? "status-chip--approved" : "status-chip--pending"}`}>
            {statusText}
          </span>
          <span className={`status-chip ${user?.verified ? "status-chip--approved" : "status-chip--neutral"}`}>
            {verifiedText}
          </span>
        </div>
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
          Designation
          <input value={form.designation} onChange={(event) => onFieldChange("designation", event.target.value)} />
        </label>

        <label>
          Department
          <input value={form.department} onChange={(event) => onFieldChange("department", event.target.value)} />
        </label>

        <label>
          Experience Years
          <input
            type="number"
            min="0"
            value={form.experience_years}
            onChange={(event) => onFieldChange("experience_years", event.target.value)}
          />
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

