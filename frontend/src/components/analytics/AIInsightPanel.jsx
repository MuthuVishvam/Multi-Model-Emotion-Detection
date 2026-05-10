import { AlertTriangle, Brain, Lightbulb, Sparkles } from "lucide-react";

export default function AIInsightPanel({ report, loading }) {
  const source = report?.report || report?.summary || {};
  const alerts = source.alerts || [];

  return (
    <section id="analytics-reports" className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/15 p-2 text-fuchsia-200">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-50">AI Insight Panel</h2>
          <p className="text-xs text-slate-500">Generated from lesson telemetry</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-28 animate-pulse rounded-lg bg-slate-900" />
        </div>
      ) : (
        <div className="space-y-5">
          <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-cyan-200">
              <Brain className="h-4 w-4" aria-hidden="true" />
              <h3 className="text-sm font-bold">Concise Teacher Summary</h3>
            </div>
            <p className="text-sm leading-6 text-slate-300">{source.concise_teacher_summary || "No analytics summary is available yet."}</p>
          </article>

          <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-violet-200">
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              <h3 className="text-sm font-bold">Recommendations</h3>
            </div>
            <div className="space-y-2">
              {(source.recommendations || []).map((item) => (
                <p key={item} className="rounded-md bg-slate-950/60 px-3 py-2 text-sm text-slate-300">{item}</p>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-amber-200">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <h3 className="text-sm font-bold">Active Alerts</h3>
            </div>
            <div className="space-y-2">
              {alerts.length === 0 && <p className="text-sm text-slate-500">No high-risk learning signals detected.</p>}
              {alerts.map((alert, index) => (
                <div key={`${alert.message}-${index}`} className="rounded-md border border-amber-400/20 bg-amber-500/10 px-3 py-2">
                  <p className="text-xs font-bold uppercase text-amber-200">{alert.level || "medium"} {alert.minute ? `· ${alert.minute}` : ""}</p>
                  <p className="text-sm text-slate-300">{alert.message}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
            <h3 className="mb-2 text-sm font-bold text-slate-100">Student-Friendly Feedback</h3>
            <p className="text-sm leading-6 text-slate-400">{source.student_friendly_feedback || "Feedback will appear once activity is recorded."}</p>
          </article>
        </div>
      )}
    </section>
  );
}
