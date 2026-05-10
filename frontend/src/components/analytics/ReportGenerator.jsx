export default function ReportGenerator({ report, reportType, onReportTypeChange }) {
  const content = report?.report || {};

  return (
    <section id="analytics-reports" className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100">Auto-Generated Lesson Report</h2>
          <p className="text-sm text-slate-500">Switch report style for different audiences.</p>
        </div>
        <select value={reportType} onChange={(event) => onReportTypeChange(event.target.value)} className="max-w-56">
          <option value="teacher">Concise Teacher Summary</option>
          <option value="technical">Technical Analytics Report</option>
          <option value="student">Student-Friendly Feedback</option>
        </select>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <h3 className="mb-2 text-sm font-bold text-cyan-200">Teacher Summary</h3>
          <p className="text-sm leading-6 text-slate-300">{content.concise_teacher_summary || "No report generated yet."}</p>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <h3 className="mb-2 text-sm font-bold text-violet-200">Technical Report</h3>
          <p className="text-sm leading-6 text-slate-300">{content.technical_analytics_report || "No technical report yet."}</p>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <h3 className="mb-2 text-sm font-bold text-emerald-200">Student Feedback</h3>
          <p className="text-sm leading-6 text-slate-300">{content.student_friendly_feedback || "No student feedback yet."}</p>
        </article>
      </div>
    </section>
  );
}
