import { useMemo, useState } from "react";

export default function ClassDetail({ classDetail, onInvite }) {
  const [inviteForm, setInviteForm] = useState({ emails: "", usernames: "", student_user_ids: "" });
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");

  const joinCodeText = classDetail?.join_code || "-";
  const inviteLink = classDetail?.invite_link || "-";
  const members = useMemo(() => classDetail?.members || [], [classDetail]);

  async function submitInvite() {
    if (!classDetail?.class_id) {
      return;
    }
    setInviting(true);
    setMessage("");
    try {
      const payload = {
        emails: inviteForm.emails.split(",").map((v) => v.trim()).filter(Boolean),
        usernames: inviteForm.usernames.split(",").map((v) => v.trim()).filter(Boolean),
        student_user_ids: inviteForm.student_user_ids.split(",").map((v) => v.trim()).filter(Boolean),
      };
      const result = await onInvite(classDetail.class_id, payload);
      setInviteForm({ emails: "", usernames: "", student_user_ids: "" });
      setMessage(`Invited ${result.invited_count} student(s).`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setInviting(false);
    }
  }

  if (!classDetail) {
    return (
      <section className="card">
        <h3>Class Detail</h3>
        <p className="small-note">Select a class to view members and invite students.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>{classDetail.class_name}</h3>
      <p className="small-note">
        Section {classDetail.section} | Semester {classDetail.semester}
      </p>
      <p className="small-note">Join Code: <strong>{joinCodeText}</strong></p>
      <p className="small-note">Invite Link: <strong>{inviteLink}</strong></p>

      <label>Invite by emails (comma separated)</label>
      <input
        value={inviteForm.emails}
        onChange={(event) => setInviteForm((prev) => ({ ...prev, emails: event.target.value }))}
      />

      <label>Invite by usernames (comma separated)</label>
      <input
        value={inviteForm.usernames}
        onChange={(event) => setInviteForm((prev) => ({ ...prev, usernames: event.target.value }))}
      />

      <label>Invite by user IDs (comma separated)</label>
      <input
        value={inviteForm.student_user_ids}
        onChange={(event) => setInviteForm((prev) => ({ ...prev, student_user_ids: event.target.value }))}
      />

      <button onClick={submitInvite} disabled={inviting}>
        {inviting ? "Inviting..." : "Send Invites"}
      </button>
      {message && <p className="small-note">{message}</p>}

      <h4>Members</h4>
      <table className="student-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={`${member.user_id}-${member.member_role}`}>
              <td>{member.full_name || member.username || "-"}</td>
              <td>{member.email || "-"}</td>
              <td>{member.member_role}</td>
              <td>{member.status}</td>
              <td>{member.source || "-"}</td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={5}>No members yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
