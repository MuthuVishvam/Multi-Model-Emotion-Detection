import { getYoutubeEmbedUrl } from "../utils/getYoutubeEmbedUrl";
import { buildApiUrl } from "../services/api";

function resolveMediaSource(lesson) {
  const rawUrl = String(
    lesson?.video_embed_url
      || lesson?.videoEmbedUrl
      || lesson?.video_url
      || lesson?.videoUrl
      || lesson?.content
      || ""
  ).trim();

  if (!rawUrl) {
    return { type: "none", src: "" };
  }

  const youtubeUrl = getYoutubeEmbedUrl(rawUrl, { autoplay: true });
  if (youtubeUrl) {
    return { type: "youtube", src: youtubeUrl };
  }

  const source = rawUrl.startsWith("/") ? buildApiUrl(rawUrl) : rawUrl;
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(source) || lesson?.media_type === "video") {
    return { type: "video", src: source };
  }

  return { type: "link", src: source };
}

export default function LessonPlayer({ lesson, videoRef, onPlaybackStart }) {
  const media = resolveMediaSource(lesson);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-black shadow-2xl shadow-slate-950/40">
      {media.type === "youtube" && (
        <iframe
          className="h-full w-full border-0"
          src={media.src}
          title={lesson?.title ? `Lesson video: ${lesson.title}` : "Lesson video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={onPlaybackStart}
        />
      )}

      {media.type === "video" && (
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain"
          src={media.src}
          controls
          autoPlay
          playsInline
          onPlay={onPlaybackStart}
        >
          Your browser does not support video playback.
        </video>
      )}

      {media.type === "link" && (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-slate-300">Video unavailable in the embedded player.</p>
          <a
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            href={media.src}
            target="_blank"
            rel="noreferrer"
          >
            Open lesson video
          </a>
        </div>
      )}

      {media.type === "none" && (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
          Video unavailable
        </div>
      )}
    </div>
  );
}
