import { MessageCircle, Send } from "lucide-react";

function EmotionTag({ emotion, confidence }) {
  if (!emotion || emotion === "unknown") {
    return null;
  }

  return (
    <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold capitalize text-blue-200">
      {emotion} {Math.round(Number(confidence || 0) * 100)}%
    </span>
  );
}

export default function CommentSection({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  disabled = false,
  statusMessage,
  comments,
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-blue-300" aria-hidden="true" />
        <h2 className="text-base font-semibold text-slate-50">Comments</h2>
      </div>

      <div className="flex flex-col gap-3">
        <textarea
          className="min-h-24 resize-y rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/15"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Share a question or thought about this lesson..."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Comments are tagged with learning emotion after submission.</p>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onSubmit}
            disabled={disabled || isSubmitting || !value.trim()}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "Sending" : "Send"}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">
          {statusMessage}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {comments.length === 0 && (
          <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-500">
            No comments yet.
          </p>
        )}
        {comments.map((comment) => (
          <article key={comment.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-6 text-slate-200">{comment.text}</p>
              <EmotionTag emotion={comment.emotion} confidence={comment.confidence} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {comment.authorName || "Student"} · {comment.timestamp ? new Date(comment.timestamp).toLocaleString() : "Just now"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
