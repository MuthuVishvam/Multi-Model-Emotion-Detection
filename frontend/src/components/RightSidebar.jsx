import { Camera, CheckCircle2, Circle, PlayCircle } from "lucide-react";

export default function RightSidebar({
  lessons,
  activeLessonId,
  onSelectLesson,
  cameraRef,
  cameraState,
  permissionDenied,
}) {
  return (
    <aside className="space-y-5 lg:sticky lg:top-0 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
      <section className="rounded-xl border border-slate-800 bg-slate-900/85 p-4 shadow-xl shadow-slate-950/25">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Assigned Lessons</h2>
          <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-400">
            {lessons.length}
          </span>
        </div>

        <div className="space-y-2">
          {lessons.map((lesson, index) => {
            const lessonId = String(lesson.lesson_id || lesson.id || "");
            const isActive = String(activeLessonId || "") === lessonId;
            const isComplete = Boolean(lesson.completed || lesson.progress?.completed);
            return (
              <button
                key={lessonId || `${lesson.title}-${index}`}
                type="button"
                className={`w-full rounded-lg border p-3 text-left transition ${
                  isActive
                    ? "border-blue-400/50 bg-blue-500/15 text-blue-100"
                    : "border-slate-800 bg-slate-950/35 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70"
                }`}
                onClick={() => onSelectLesson(lessonId)}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-slate-400">
                    {isActive ? <PlayCircle className="h-4 w-4 text-blue-300" /> : isComplete ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Circle className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{lesson.title || `Lesson ${index + 1}`}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {isComplete ? "Completed" : isActive ? "Current lesson" : lesson.duration || "Assigned"}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/85 p-4 shadow-xl shadow-slate-950/25">
        <div className="mb-3 flex items-center gap-2">
          <Camera className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-100">Camera Preview</h2>
        </div>
        <div className="aspect-video overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <video
            ref={cameraRef}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {permissionDenied
            ? "Camera permission was denied."
            : cameraState === "on"
              ? "Preview is running during the lesson."
              : "Camera will start automatically when permission is granted."}
        </p>
      </section>
    </aside>
  );
}
