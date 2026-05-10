import { Activity, AlertTriangle, Radio, Users } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function LiveMonitoring({ live }) {
  const timeline = (live?.timeline || []).map((item) => ({ minute: item.minute, engagement: item.engagement || item.total || 0 }));
  const stream = live?.stream || [];

  return (
    <section id="live-monitoring" className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <article className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
        <div className="mb-5 flex items-center gap-3">
          <Radio className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-100">Live Class Health</h2>
        </div>
        <div className="flex items-center justify-center">
          <div className="flex h-40 w-40 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 shadow-2xl shadow-emerald-950/20">
            <div className="text-center">
              <p className="text-4xl font-black text-emerald-200">{Number(live?.health || 0).toFixed(0)}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">Health</p>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <Users className="mb-2 h-4 w-4 text-cyan-300" />
            <p className="text-2xl font-black text-slate-50">{live?.active_students || 0}</p>
            <p className="text-xs text-slate-500">Active students</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <AlertTriangle className="mb-2 h-4 w-4 text-amber-300" />
            <p className="text-2xl font-black text-slate-50">{(live?.alerts || []).length}</p>
            <p className="text-xs text-slate-500">Alerts</p>
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-cyan-300" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-100">Real-Time Emotion Wave</h2>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="liveWave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="minute" minTickGap={24} stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }} />
              <Area type="monotone" dataKey="engagement" stroke="#22d3ee" fill="url(#liveWave)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 max-h-44 space-y-2 overflow-y-auto">
          {stream.slice(0, 8).map((item, index) => (
            <div key={`${item.timestamp}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
              <span className="truncate text-sm text-slate-300">{item.student_id || "Student"}</span>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-bold capitalize text-cyan-200">{item.emotion}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
