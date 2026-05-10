import { Camera, Download, FileText } from "lucide-react";

export default function ExportControls({ onExport }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100">Export Center</h2>
          <p className="text-sm text-slate-500">Download analytics for lesson review or reporting.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-bold text-white" onClick={() => onExport("csv")}>
            <Download className="h-4 w-4" /> CSV
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white" onClick={() => onExport("pdf")}>
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-bold text-slate-100" onClick={() => window.print()}>
            <Camera className="h-4 w-4" /> Screenshot
          </button>
        </div>
      </div>
    </section>
  );
}
