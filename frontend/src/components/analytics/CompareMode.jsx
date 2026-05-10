export default function CompareMode({ enabled, data }) {
  if (!enabled) return null;
  return (
    <section className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-5">
      <h2 className="text-base font-bold text-violet-100">Compare Mode</h2>
      <p className="mt-1 text-sm text-violet-200/80">Compare mode is active. Use the class and lesson filters to inspect how engagement shifts across cohorts.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {(data?.class_comparison || []).slice(0, 3).map((row) => (
          <div key={row.class_id} className="rounded-lg border border-violet-300/20 bg-slate-950/40 p-3">
            <p className="truncate text-sm font-bold text-slate-100">{row.class_id}</p>
            <p className="mt-2 text-2xl font-black text-violet-200">{Number(row.engagement || 0).toFixed(1)}</p>
            <p className="text-xs text-slate-400">{row.students} students · {row.events} events</p>
          </div>
        ))}
      </div>
    </section>
  );
}
