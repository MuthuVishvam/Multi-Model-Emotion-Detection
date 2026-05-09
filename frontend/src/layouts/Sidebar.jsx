import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  BookOpen, 
  Video, 
  BarChart3, 
  Settings, 
  Users
} from "lucide-react";

export default function Sidebar({ user }) {
  if (!user) return null;

  const getLinks = () => {
    if (user.role === "student") {
      return [
        { name: "Catalog", to: "/student", end: true, icon: BookOpen },
        { name: "My Classes", to: "/student/classes", icon: Users },
        { name: "Live Class", to: "/student/live", icon: Video },
        { name: "Profile", to: "/profile/student", icon: Settings },
      ];
    }
    if (user.role === "teacher") {
      const teacherApproved = user.status === "approved" && user.verified;
      if (!teacherApproved) {
        return [{ name: "Profile", to: "/profile/teacher", icon: Settings }];
      }
      return [
        { name: "Analytics", to: "/teacher", end: true, icon: BarChart3 },
        { name: "Classes", to: "/teacher/classes", icon: Users },
        { name: "Lessons", to: "/teacher/lessons", icon: BookOpen },
        { name: "Live Control", to: "/teacher/live/control", icon: Video },
        { name: "Profile", to: "/profile/teacher", icon: Settings },
      ];
    }
    if (user.role === "admin") {
      return [
        { name: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
        { name: "Teachers", to: "/admin/teachers", icon: Users },
        { name: "Classes", to: "/admin/classes", icon: BookOpen },
      ];
    }
    return [];
  };

  const links = getLinks();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col z-20">
      <div className="h-16 flex items-center px-6 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
            M
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-800 tracking-tight">
            MELD Learn
          </span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive 
                ? "bg-blue-50 text-blue-700" 
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}
            `}
          >
            <link.icon className="w-5 h-5" />
            {link.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
