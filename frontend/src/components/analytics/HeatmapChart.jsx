export default function HeatmapChart({ rows = [] }) {
  const normalized = rows.slice(0, 10);
  const slots = [...new Set(normalized.flatMap((row) => Object.keys(row.slots || {})))].slice(-14);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px] space-y-2">
        {normalized.map((row) => (
          <div key={row.student_id} className="grid grid-cols-[150px_repeat(14,minmax(34px,1fr))] gap-1.5">
            <div className="truncate text-xs font-semibold text-slate-400">{row.student_id}</div>
            {slots.map((slot) => {
              const value = Number((row.slots || {})[slot] || 0);
              return (
                <div
                  key={`${row.student_id}-${slot}`}
                  className="h-8 rounded-md border border-slate-800"
                  title={`${row.student_id} ${slot}: ${value}%`}
                  style={{ background: `rgba(${34 + value}, ${90 + value}, ${180 + value / 2}, ${Math.max(0.18, value / 100)})` }}
                />
              );
            })}
          </div>
        ))}
        {normalized.length === 0 && <p className="text-sm text-slate-500">No attention timeline data yet.</p>}
      </div>
    </div>
  );
}
