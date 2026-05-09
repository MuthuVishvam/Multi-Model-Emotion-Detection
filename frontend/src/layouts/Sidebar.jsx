import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  BookOpen, 
  Video, 
  BarChart3, 
  Settings, 
  Users,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useState } from "react";

export default function Sidebar({ user }) {
  const [collapsed, setCollapsed] = useState(false);

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
    <motion.aside 
      initial={{ width: 256 }}
      animate={{ width: collapsed ? 80 : 256 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="glass-panel border-r-0 border-y-0 h-full hidden md:flex flex-col z-20 relative shadow-[4px_0_24px_rgba(0,0,0,0.2)]"
    >
      <div className="h-16 flex items-center px-4 border-b border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            M
          </div>
          {!collapsed && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 tracking-tight"
            >
              MELD AI
            </motion.span>
          )}
        </div>
      </div>
      
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-full p-1 shadow-lg z-30 transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-3 space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-300 group
              ${isActive 
                ? "bg-gradient-to-r from-brand-600/20 to-indigo-600/20 text-brand-400 border border-brand-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"}
            `}
          >
            <link.icon className={`w-5 h-5 shrink-0 transition-colors duration-300`} />
            {!collapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="whitespace-nowrap"
              >
                {link.name}
              </motion.span>
            )}
            
            {collapsed && (
              <div className="absolute left-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {link.name}
              </div>
            )}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-slate-800 text-center">
        {!collapsed && (
          <p className="text-xs text-slate-500 font-medium">MELD v2.0 Enterprise</p>
        )}
      </div>
    </motion.aside>
  );
}
