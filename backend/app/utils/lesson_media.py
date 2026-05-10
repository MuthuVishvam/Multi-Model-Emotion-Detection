from __future__ import annotations

from pathlib import PurePosixPath
from urllib.parse import parse_qs, urlparse


VIDEO_EXTENSIONS = (".mp4", ".webm", ".ogg", ".mov", ".m4v")


def extract_youtube_video_id(url_value: str | None) -> str:
    raw = str(url_value or "").strip()
    if not raw:
        return ""

    try:
        parsed = urlparse(raw)
    except ValueError:
        return ""

    host = parsed.netloc.lower().removeprefix("www.")
    path_parts = [part for part in PurePosixPath(parsed.path or "").parts if part != "/"]

    if host == "youtu.be":
        return path_parts[0] if path_parts else ""

    if host in {"youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"}:
        if parsed.path == "/watch":
            return (parse_qs(parsed.query).get("v") or [""])[0]
        if len(path_parts) >= 2 and path_parts[0] in {"embed", "shorts", "live"}:
            return path_parts[1]

    return ""


def normalize_lesson_media_url(url_value: str | None) -> dict[str, str | None]:
    source_url = str(url_value or "").strip()
    if not source_url:
        return {
            "source_url": None,
            "playable_url": None,
            "embed_url": None,
            "media_type": "none",
        }

    youtube_id = extract_youtube_video_id(source_url)
    if youtube_id:
        embed_url = f"https://www.youtube.com/embed/{youtube_id}"
        return {
            "source_url": source_url,
            "playable_url": embed_url,
            "embed_url": embed_url,
            "media_type": "youtube",
        }

    path = urlparse(source_url).path.lower()
    if source_url.startswith("/") or path.endswith(VIDEO_EXTENSIONS):
        return {
            "source_url": source_url,
            "playable_url": source_url,
            "embed_url": None,
            "media_type": "video",
        }

    return {
        "source_url": source_url,
        "playable_url": source_url,
        "embed_url": None,
        "media_type": "link",
    }
