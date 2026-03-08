import CourseCatalogPage from "./CourseCatalogPage";

export default function StudentDashboard(props) {
  return (
    <div className="student-dashboard-wrap">
      <CourseCatalogPage {...props} />
    </div>
  );
}
