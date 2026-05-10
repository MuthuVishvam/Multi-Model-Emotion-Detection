import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  Radio,
  Settings,
  Users,
} from "lucide-react";

const NAV_ITEMS = [
  ["Dashboard Overview", LayoutDashboard],
  ["Live Monitoring", Radio],
  ["Classes", GraduationCap],
  ["Lessons", BookOpen],
  ["Students", Users],
  ["Analytics Reports", BarChart3],
  ["Emotion Trends", Activity],
  ["Settings", Settings],
];

export default function DashboardLayout({ role = "teacher", children, insights }) {
  return (
    <div className="mx-auto grid max-w-[1800px] gap-5 xl:grid-cols-[240px_minmax(0,1fr)_360px]">
      <motion.aside
        className="hidden rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-2xl shadow-slate-950/30 backdrop-blur-xl xl:block"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <div className="mb-4 rounded-lg border border-cyan-400/20 bg-cyan-500/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200">
              <Brain className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-50">MELD Intel</p>
              <p className="text-xs capitalize text-slate-400">{role} workspace</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1" aria-label="Analytics workspace">
          {NAV_ITEMS.map(([label, Icon], index) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replaceAll(" ", "-")}`}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                index === 0
                  ? "border border-blue-400/30 bg-blue-500/15 text-blue-100 shadow-lg shadow-blue-950/20"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </motion.aside>

      <main className="min-w-0">{children}</main>

      <aside className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
        {insights}
      </aside>
    </div>
  );
}
