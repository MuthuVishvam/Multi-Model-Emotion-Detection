import { NavLink } from "react-router-dom";

function toSidebarLinks(user) {
  if (!user) {
    return [];
  }

  if (user.role === "admin") {
    return [
      { to: "/admin/dashboard", label: "Admin Dashboard" },
      { to: "/admin/teachers", label: "Manage Teachers" },
      { to: "/admin/classes", label: "Class Overview" },
      { to: "/notifications", label: "Notifications" },
    ];
  }

  if (user.role === "teacher") {
    const teacherApproved = (user.status || "pending") === "approved" && Boolean(user.verified);
    const items = [{ to: "/profile/teacher", label: "My Profile" }];
    if (teacherApproved) {
      return [
        { to: "/teacher", label: "Analytics" },
        { to: "/teacher/classes", label: "My Classes" },
        { to: "/teacher/lessons", label: "Lesson Studio" },
        { to: "/teacher/live/control", label: "Live Control" },
        ...items,
        { to: "/notifications", label: "Notifications" },
      ];
    }
    return [
      ...items,
      { to: "/notifications", label: "Notifications" },
    ];
  }

  return [
    { to: "/student", label: "Course Catalog" },
    { to: "/student/classes", label: "My Classes" },
    { to: "/student/live", label: "Live Class Room" },
    { to: "/profile/student", label: "My Profile" },
    { to: "/notifications", label: "Notifications" },
  ];
}

export default function AppSidebar({ user }) {
  const links = toSidebarLinks(user);
  if (!user || links.length === 0) {
    return null;
  }

  return (
    <aside className="app-sidebar card">
      <p className="eyebrow">Workspace</p>
      <h3>{user.role[0].toUpperCase() + user.role.slice(1)} panel</h3>
      <nav className="app-sidebar__nav" aria-label="Sidebar">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
