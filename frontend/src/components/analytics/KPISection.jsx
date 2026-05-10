import { motion } from "framer-motion";
import { Activity, Brain, CircleGauge, Eye, Smile, Users } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

const KPI_META = [
  ["average_engagement", "Average Engagement", Activity, "text-emerald-300"],
  ["confusion_rate", "Confusion Rate", Brain, "text-blue-300"],
  ["attention_span", "Attention Span", Eye, "text-cyan-300"],
  ["boredom_rate", "Boredom Rate", Smile, "text-amber-300"],
  ["active_students", "Active Students", Users, "text-violet-300"],
  ["emotion_accuracy", "Emotion Accuracy", CircleGauge, "text-fuchsia-300"],
];

function formatValue(key, value) {
  if (key === "active_students") return Number(value || 0).toLocaleString();
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function KPISection({ kpis = {}, trend = [] }) {
  const spark = trend.slice(-16).map((item, index) => ({ index, value: Number(item.engagement || item.total || 0) }));

  return (
    <section id="dashboard-overview" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {KPI_META.map(([key, label, Icon, tone], index) => (
        <motion.article
          key={key}
          className="min-w-0 rounded-[8px] border border-slate-800/90 bg-slate-900/70 p-3 shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-slate-900/90 hover:shadow-cyan-950/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-black leading-tight text-slate-50">{formatValue(key, kpis[key])}</p>
            </div>
            <span className={`rounded-[8px] border border-slate-700 bg-slate-950/70 p-2 ${tone}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark}>
                <Line type="monotone" dataKey="value" stroke={index % 2 ? "#a78bfa" : "#22d3ee"} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 truncate text-[11px] font-semibold text-slate-500">{Number(kpis[key] || 0) >= 75 ? "Trending healthy" : "Needs attention"}</p>
        </motion.article>
      ))}
    </section>
  );
}
