import { buildApiUrl } from "../services/api";
import { getYoutubeEmbedUrl, getYoutubeVideoId } from "./getYoutubeEmbedUrl";

export function extractYouTubeVideoId(urlString) {
  return getYoutubeVideoId(urlString);
}

export function toYouTubeEmbedUrl(urlString) {
  return getYoutubeEmbedUrl(urlString);
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
