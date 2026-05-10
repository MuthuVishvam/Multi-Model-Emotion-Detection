import { Download, SlidersHorizontal } from "lucide-react";

const EMOTIONS = ["confusion", "boredom", "stress", "neutral", "happy", "interest", "surprise"];
const CHART_TYPES = ["line", "area", "donut", "heatmap", "radar", "bar", "timeline", "live"];

export default function FilterBar({
  filters,
  classes,
  lessons,
  students,
  onChange,
  onExport,
}) {
  function toggleEmotion(emotion) {
    const current = new Set(filters.emotions || []);
    if (current.has(emotion)) current.delete(emotion);
    else current.add(emotion);
    onChange({ emotions: [...current] });
  }

  return (
    <section className="sticky top-0 z-20 rounded-xl border border-slate-800 bg-slate-950/90 p-4 shadow-2xl shadow-slate-950/25 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-100">Analytics Filters</h2>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-100 hover:border-cyan-400/50"
          onClick={() => onExport("csv")}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
        <input
          aria-label="Start date"
          type="date"
          value={filters.startDate}
          onChange={(event) => onChange({ startDate: event.target.value })}
        />
        <input
          aria-label="End date"
          type="date"
          value={filters.endDate}
          onChange={(event) => onChange({ endDate: event.target.value })}
        />
        <select value={filters.classId} onChange={(event) => onChange({ classId: event.target.value, lessonId: "" })}>
          <option value="">All classes</option>
          {classes.map((item) => (
            <option key={item.class_id} value={item.class_id}>{item.class_name || item.name || item.class_id}</option>
          ))}
        </select>
        <select value={filters.lessonId} onChange={(event) => onChange({ lessonId: event.target.value })}>
          <option value="">All lessons</option>
          {lessons.map((item) => (
            <option key={item.lesson_id} value={item.lesson_id}>{item.title || item.lesson_id}</option>
          ))}
        </select>
        <select value={filters.studentId} onChange={(event) => onChange({ studentId: event.target.value })}>
          <option value="">All students</option>
          {students.map((item) => (
            <option key={item.student_id || item.user_id} value={item.student_id || item.user_id}>
              {item.student_name || item.name || item.user_id}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_170px_150px]">
        <div className="flex flex-wrap gap-2">
          {EMOTIONS.map((emotion) => {
            const active = (filters.emotions || []).includes(emotion);
            return (
              <button
                key={emotion}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${
                  active ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100"
                }`}
                onClick={() => toggleEmotion(emotion)}
              >
                {emotion}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
          <span className="whitespace-nowrap text-xs text-slate-400">Confidence</span>
          <input
            aria-label="Confidence threshold"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={filters.confidenceThreshold}
            onChange={(event) => onChange({ confidenceThreshold: Number(event.target.value) })}
          />
          <span className="w-8 text-right text-xs font-bold text-slate-200">{Math.round(filters.confidenceThreshold * 100)}</span>
        </label>
        <select value={filters.chartType} onChange={(event) => onChange({ chartType: event.target.value })}>
          {CHART_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300">
          Compare
          <input
            aria-label="Compare mode"
            type="checkbox"
            checked={filters.compareMode}
            onChange={(event) => onChange({ compareMode: event.target.checked })}
          />
        </label>
      </div>
    </section>
  );
}
