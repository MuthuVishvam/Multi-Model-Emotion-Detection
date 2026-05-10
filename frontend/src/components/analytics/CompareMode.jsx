export default function CompareMode({ enabled, data }) {
  if (!enabled) return null;

  const rows = (data?.class_comparison || []).slice(0, 3);

  return (
    <section className="rounded-[8px] border border-cyan-400/25 bg-cyan-400/10 p-4 shadow-lg shadow-cyan-950/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-cyan-100">Compare Mode</h2>
          <p className="mt-1 text-xs font-medium text-cyan-100/70">Cohort comparison is active for the selected filters.</p>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-slate-950/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-cyan-200">
          Enabled
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {rows.map((row) => (
          <div key={row.class_id} className="min-w-0 rounded-[8px] border border-cyan-300/15 bg-slate-950/45 p-3">
            <p className="truncate text-sm font-bold text-slate-100">{row.class_id}</p>
            <p className="mt-1 text-2xl font-black text-cyan-100">{Number(row.engagement || 0).toFixed(1)}</p>
            <p className="truncate text-xs text-slate-400">{row.students} students / {row.events} events</p>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="rounded-[8px] border border-cyan-300/15 bg-slate-950/45 px-3 py-2 text-sm text-slate-400 md:col-span-3">
            No comparison rows are available for the current filter set.
          </p>
        )}
      </div>
    </section>
  );
}
