export default function ClassList({ classes = [], selectedClassId = "", onSelectClass }) {
  return (
    <section className="card">
      <div className="section-header-row">
        <h3>Class List</h3>
        <span>{classes.length} classes</span>
      </div>

      <table className="student-table">
        <thead>
          <tr>
            <th>Class</th>
            <th>Section</th>
            <th>Semester</th>
            <th>Members</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((classRow) => (
            <tr key={classRow.class_id}>
              <td>{classRow.class_name}</td>
              <td>{classRow.section}</td>
              <td>{classRow.semester}</td>
              <td>{classRow.member_count}</td>
              <td>
                <button
                  className={selectedClassId === classRow.class_id ? "secondary" : ""}
                  onClick={() => onSelectClass(classRow.class_id)}
                >
                  {selectedClassId === classRow.class_id ? "Selected" : "View"}
                </button>
              </td>
            </tr>
          ))}
          {classes.length === 0 && (
            <tr>
              <td colSpan={5}>No classes created yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
