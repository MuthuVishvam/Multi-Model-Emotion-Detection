import { Link } from "react-router-dom";

export default function MyClasses({ classes = [] }) {
  return (
    <section className="card">
      <div className="section-header-row">
        <h3>My Classes</h3>
        <span>{classes.length} joined</span>
      </div>

      <table className="student-table">
        <thead>
          <tr>
            <th>Class</th>
            <th>Section</th>
            <th>Semester</th>
            <th>Teacher</th>
            <th>Members</th>
            <th>Lessons</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((classRow) => (
            <tr key={classRow.class_id}>
              <td>{classRow.class_name}</td>
              <td>{classRow.section}</td>
              <td>{classRow.semester}</td>
              <td>{classRow.teacher_email || "-"}</td>
              <td>{classRow.member_count}</td>
              <td>
                <Link className="button-link button-link-secondary" to={`/student/classes/${classRow.class_id}/lessons`}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
          {classes.length === 0 && (
            <tr>
              <td colSpan={6}>No classes joined yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
