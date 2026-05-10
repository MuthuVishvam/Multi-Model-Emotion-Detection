import { Download, SlidersHorizontal } from "lucide-react";
import ChartSelector from "./ChartSelector";

const controlClass =
  "h-10 min-w-0 rounded-[8px] border border-slate-700/80 bg-slate-950/70 px-2.5 py-2 text-xs font-semibold text-slate-100 shadow-none outline-none transition hover:border-slate-600 hover:bg-slate-900/80 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";

function FieldLabel({ children }) {
  return <span className="mb-1 block truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</span>;
}

export default function FilterBar({
  filters,
  classes,
  lessons,
  students,
  onChange,
  onExport,
}) {
  return (
    <section className="relative z-30 rounded-[8px] border border-slate-800/90 bg-slate-950/85 p-3 shadow-xl shadow-slate-950/25 backdrop-blur-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-100">Analytics Filters</h2>
        </div>
        <span className="text-xs font-medium text-slate-500">Live filters</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(168px,1.05fr)_minmax(94px,0.7fr)_minmax(120px,0.9fr)_minmax(108px,0.82fr)_minmax(120px,0.82fr)_minmax(110px,0.74fr)_74px_80px]">
        <label className="min-w-0">
          <FieldLabel>Date Range</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              aria-label="Start date"
              type="date"
              value={filters.startDate}
              className={`${controlClass} [color-scheme:dark]`}
              onChange={(event) => onChange({ startDate: event.target.value })}
            />
            <input
              aria-label="End date"
              type="date"
              value={filters.endDate}
              className={`${controlClass} [color-scheme:dark]`}
              onChange={(event) => onChange({ endDate: event.target.value })}
            />
          </div>
        </label>

        <label className="min-w-0">
          <FieldLabel>Class</FieldLabel>
          <select className={controlClass} value={filters.classId} onChange={(event) => onChange({ classId: event.target.value, lessonId: "" })}>
            <option value="">All classes</option>
            {classes.map((item) => (
              <option key={item.class_id} value={item.class_id}>{item.class_name || item.name || item.class_id}</option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <FieldLabel>Lesson</FieldLabel>
          <select className={controlClass} value={filters.lessonId} onChange={(event) => onChange({ lessonId: event.target.value })}>
            <option value="">All lessons</option>
            {lessons.map((item) => (
              <option key={item.lesson_id} value={item.lesson_id}>{item.title || item.lesson_id}</option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <FieldLabel>Student</FieldLabel>
          <select className={controlClass} value={filters.studentId} onChange={(event) => onChange({ studentId: event.target.value })}>
            <option value="">All students</option>
            {students.map((item) => (
              <option key={item.student_id || item.user_id} value={item.student_id || item.user_id}>
                {item.student_name || item.name || item.user_id}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <FieldLabel>Confidence</FieldLabel>
          <div className="flex h-10 min-w-0 items-center gap-2 rounded-[8px] border border-slate-700/80 bg-slate-950/70 px-2.5">
            <input
              aria-label="Confidence threshold"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={filters.confidenceThreshold}
              className="h-1 min-w-0 flex-1 cursor-pointer accent-cyan-400"
              onChange={(event) => onChange({ confidenceThreshold: Number(event.target.value) })}
            />
            <span className="w-8 text-right text-xs font-black text-cyan-100">{Math.round(filters.confidenceThreshold * 100)}%</span>
          </div>
        </label>

        <label className="min-w-0">
          <FieldLabel>Chart</FieldLabel>
          <ChartSelector value={filters.chartType} onChange={(chartType) => onChange({ chartType })} />
        </label>

        <label className="min-w-0">
          <FieldLabel>Compare</FieldLabel>
          <button
            type="button"
            aria-pressed={filters.compareMode}
            className={`flex h-10 w-full items-center justify-between gap-2 rounded-[8px] border px-2 text-xs font-bold transition ${
              filters.compareMode
                ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100"
                : "border-slate-700/80 bg-slate-950/70 text-slate-300 hover:border-slate-600 hover:bg-slate-900/80"
            }`}
            onClick={() => onChange({ compareMode: !filters.compareMode })}
          >
            <span>{filters.compareMode ? "On" : "Off"}</span>
            <span className={`relative h-4 w-7 rounded-full transition ${filters.compareMode ? "bg-cyan-400/70" : "bg-slate-700"}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${filters.compareMode ? "left-3.5" : "left-0.5"}`} />
            </span>
          </button>
        </label>

        <label className="min-w-0">
          <FieldLabel>Export</FieldLabel>
          <button
            type="button"
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-cyan-400/40 bg-cyan-500/15 px-2 text-xs font-black text-cyan-100 shadow-lg shadow-cyan-950/20 hover:border-cyan-300/70 hover:bg-cyan-400/20"
            onClick={() => onExport("csv")}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export
          </button>
        </label>
      </div>
    </section>
  );
}
