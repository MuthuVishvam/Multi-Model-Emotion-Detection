import { Mic } from "lucide-react";

import AudioFeedbackRecorder from "./AudioFeedbackRecorder";

export default function AudioFeedback(props) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
      <div className="mb-4 flex items-center gap-2">
        <Mic className="h-5 w-5 text-cyan-300" aria-hidden="true" />
        <h2 className="text-base font-semibold text-slate-50">Audio Feedback</h2>
      </div>
      <AudioFeedbackRecorder {...props} />
    </section>
  );
}
