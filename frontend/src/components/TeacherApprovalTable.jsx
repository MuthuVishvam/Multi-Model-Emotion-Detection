function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString();
}

function boolText(value) {
  return value ? "true" : "false";
}

export default function TeacherApprovalTable({
  title,
  teachers = [],
  loading = false,
  mode = "all",
  actingTeacherId = "",
  onApprove = () => {},
  onReject = () => {},
  onDisable = () => {},
  onEnable = () => {},
}) {
  const showPendingColumns = mode === "pending";

  return (
    <section className="card">
      <div className="section-header-row">
        <h3>{title}</h3>
        <span>{teachers.length} total</span>
      </div>

      {loading ? (
        <p className="small-note">Loading teacher records...</p>
      ) : (
        <div className="table-wrap">
          <table className="student-table">
            <thead>
              {showPendingColumns ? (
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              ) : (
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Verified</th>
                  <th>Is Active</th>
                  <th>Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {teachers.map((teacher) => {
                const isBusy = actingTeacherId === teacher.id;
                const isActive = teacher.is_active !== false;
                return (
                  <tr key={teacher.id}>
                    <td>{teacher.full_name || "-"}</td>
                    <td>{teacher.email || "-"}</td>
                    {showPendingColumns ? (
                      <>
                        <td>{teacher.department || "-"}</td>
                        <td>{formatDateTime(teacher.created_at)}</td>
                      </>
                    ) : (
                      <>
                        <td>{teacher.status || "pending"}</td>
                        <td>{boolText(Boolean(teacher.verified))}</td>
                        <td>{boolText(isActive)}</td>
                      </>
                    )}
                    <td>
                      <div className="table-actions">
                        <button onClick={() => onApprove(teacher.id)} disabled={isBusy}>Approve</button>
                        <button className="danger" onClick={() => onReject(teacher.id)} disabled={isBusy}>Reject</button>
                        {isActive ? (
                          <button className="secondary" onClick={() => onDisable(teacher.id)} disabled={isBusy}>Disable</button>
                        ) : (
                          <button className="secondary" onClick={() => onEnable(teacher.id)} disabled={isBusy}>Enable</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={showPendingColumns ? 5 : 6}>
                    {showPendingColumns ? "No pending teachers found." : "No teachers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
