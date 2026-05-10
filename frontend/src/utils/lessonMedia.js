import { buildApiUrl } from "../services/api";

export function extractYouTubeVideoId(urlString) {
  if (!urlString) return "";

  try {
    const url = new URL(String(urlString).trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v") || "";
      }
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
        return url.pathname.split("/").filter(Boolean)[1] || "";
      }
    }
  } catch {
    return "";
  }

  return "";
}

export function toYouTubeEmbedUrl(urlString) {
  const youtubeId = extractYouTubeVideoId(urlString);
  return youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : "";
}

export function inferLessonMedia(lessonOrUrl) {
  const lesson = typeof lessonOrUrl === "object" && lessonOrUrl !== null ? lessonOrUrl : null;
  const rawUrl = lesson
    ? (lesson.video_embed_url || lesson.content || lesson.video_url || "")
    : String(lessonOrUrl || "");

  if (!rawUrl) {
    return { type: "none", src: "" };
  }

  const sourceUrl = String(rawUrl || "").trim();
  const youtubeEmbedUrl = lesson?.media_type === "youtube"
    ? (lesson.video_embed_url || toYouTubeEmbedUrl(sourceUrl))
    : toYouTubeEmbedUrl(sourceUrl);

  if (youtubeEmbedUrl) {
    return {
      type: "youtube",
      src: youtubeEmbedUrl,
    };
  }

  const src = sourceUrl.startsWith("/") ? buildApiUrl(sourceUrl) : sourceUrl;
  const lower = sourceUrl.toLowerCase();
  if (lesson?.media_type === "video" || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(lower)) {
    return { type: "video", src };
  }

  return { type: "link", src };
}
