from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging

from bson import ObjectId

from app.database import db


logger = logging.getLogger("emotion_backend")

NEGATIVE_TEXT_EMOTIONS = {
    "confusion",
    "stress",
    "sadness",
    "anger",
    "fear",
    "disgust",
    "boredom",
    "frustration",
    "anxiety",
}

ATTENTION_STATE_ORDER = (
    "focused",
    "no_face",
    "no_face_detected",
    "away",
    "tab_hidden",
    "idle",
    "possible_distraction",
    "multi_face",
    "possible_game",
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime | None) -> datetime | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _percentages(counts: dict[str, int], total: int) -> dict[str, float]:
    if total <= 0:
        return {}
    return {label: round((count / total) * 100.0, 2) for label, count in counts.items()}


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _dominant_label(counts: dict[str, int]) -> str:
    if not counts:
        return "unknown"
    return max(counts, key=counts.get)


def _extract_text_comment(extra: dict) -> str:
    if not isinstance(extra, dict):
        return ""
    candidates = (
        extra.get("text"),
        extra.get("comment"),
        extra.get("message"),
        extra.get("feedback_text"),
        extra.get("transcript"),
    )
    for value in candidates:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _build_attention_summary_text(percentages: dict[str, float]) -> str:
    parts: list[str] = []
    for key in ATTENTION_STATE_ORDER:
        value = percentages.get(key)
        if value is None or value <= 0:
            continue
        parts.append(f"{key} {value:.1f}%")
    return ", ".join(parts)


def _normalize_emotion_label(value: str | None) -> str | None:
    normalized = str(value or "").strip().lower()
    return normalized or None


class EmotionEventAnalyticsService:
    @staticmethod
    def _build_time_query(start_at: datetime | None, end_at: datetime | None) -> dict[str, datetime]:
        start_utc = _as_utc(start_at)
        end_utc = _as_utc(end_at)
        if start_utc and end_utc and start_utc > end_utc:
            start_utc, end_utc = end_utc, start_utc

        timestamp_query: dict[str, datetime] = {}
        if start_utc:
            timestamp_query["$gte"] = start_utc
        if end_utc:
            timestamp_query["$lte"] = end_utc
        return timestamp_query

    @classmethod
    def _emotion_match(
        cls,
        *,
        lesson_id: str,
        modality: str | None = None,
        class_id: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        emotion_label: str | None = None,
    ) -> dict:
        match_query: dict = {"lesson_id": lesson_id}
        if modality:
            match_query["modality"] = modality
        if class_id:
            match_query["class_id"] = class_id
        normalized_emotion_label = _normalize_emotion_label(emotion_label)
        if normalized_emotion_label:
            match_query["emotion_label"] = normalized_emotion_label

        timestamp_query = cls._build_time_query(start_at, end_at)
        if timestamp_query:
            match_query["timestamp"] = timestamp_query
        return match_query

    @classmethod
    def _attention_match(
        cls,
        *,
        lesson_id: str,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> dict:
        match_query: dict = {"lesson_id": lesson_id}
        timestamp_query = cls._build_time_query(start_at, end_at)
        if timestamp_query:
            match_query["timestamp"] = timestamp_query
        return match_query

    @staticmethod
    def _apply_user_scope(match_query: dict, user_ids: set[str] | None) -> dict:
        scoped_match = dict(match_query)
        if user_ids is not None:
            scoped_match["user_id"] = {"$in": sorted(user_ids)}
        return scoped_match

    @staticmethod
    def _timeline_pipeline(match_query: dict) -> list[dict]:
        return [
            {"$match": match_query},
            {
                "$group": {
                    "_id": {
                        "minute": {
                            "$dateToString": {
                                "format": "%Y-%m-%dT%H:%M:00Z",
                                "date": "$timestamp",
                                "timezone": "UTC",
                            }
                        },
                        "emotion": "$emotion_label",
                    },
                    "count": {"$sum": 1},
                }
            },
            {
                "$group": {
                    "_id": "$_id.minute",
                    "total": {"$sum": "$count"},
                    "emotions": {"$push": {"k": "$_id.emotion", "v": "$count"}},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "minute": "$_id",
                    "total": 1,
                    "emotions": {"$arrayToObject": "$emotions"},
                }
            },
            {"$sort": {"minute": 1}},
        ]

    @staticmethod
    def _emotion_counts_pipeline(match_query: dict) -> list[dict]:
        return [
            {"$match": match_query},
            {"$group": {"_id": "$emotion_label", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]

    @staticmethod
    def _modality_counts_pipeline(match_query: dict) -> list[dict]:
        return [
            {"$match": match_query},
            {"$group": {"_id": "$modality", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]

    @staticmethod
    async def _resolve_student_labels(user_ids: list[str]) -> dict[str, str]:
        if not user_ids:
            return {}

        object_ids: list[ObjectId] = []
        text_ids: list[str] = []
        for user_id in user_ids:
            if ObjectId.is_valid(user_id):
                object_ids.append(ObjectId(user_id))
            elif user_id:
                text_ids.append(user_id)

        or_filters: list[dict] = []
        if object_ids:
            or_filters.append({"_id": {"$in": object_ids}})
        if text_ids:
            or_filters.append({"email": {"$in": text_ids}})
            or_filters.append({"username": {"$in": text_ids}})

        if not or_filters:
            return {}

        rows = await db.users.find(
            {"$or": or_filters},
            {"full_name": 1, "username": 1, "email": 1},
        ).to_list(length=None)

        mapping: dict[str, str] = {}
        for row in rows:
            display_name = (
                row.get("full_name")
                or row.get("username")
                or row.get("email")
                or str(row.get("_id", ""))
            )
            mapping[str(row.get("_id"))] = display_name
            email = row.get("email")
            username = row.get("username")
            if isinstance(email, str) and email:
                mapping[email] = display_name
            if isinstance(username, str) and username:
                mapping[username] = display_name
        return mapping

    @staticmethod
    async def _resolve_user_scope(match_query: dict) -> set[str]:
        rows = await db.emotion_events.aggregate(
            [
                {"$match": match_query},
                {"$group": {"_id": "$user_id"}},
            ]
        ).to_list(length=None)
        return {str(row.get("_id")) for row in rows if row.get("_id")}

    async def ingest_emotion_events(self, *, events: list[dict], current_user: dict) -> dict:
        if not events:
            return {"inserted_count": 0, "skipped_count": 0}

        now = _utc_now()
        rows: list[dict] = []
        skipped_count = 0
        for event in events:
            teacher_id = event.get("teacher_id")
            if not teacher_id and current_user.get("role") == "teacher":
                teacher_id = current_user.get("id")

            row = {
                "user_id": event.get("user_id"),
                "teacher_id": teacher_id,
                "class_id": event.get("class_id"),
                "course_id": event.get("course_id"),
                "lesson_id": event.get("lesson_id"),
                "session_id": event.get("session_id"),
                "live_session_id": event.get("live_session_id"),
                "modality": event.get("modality"),
                "emotion_label": event.get("emotion_label"),
                "confidence": float(event.get("confidence") or 0.0),
                "engagement_score": float(
                    event.get("engagement_score")
                    if event.get("engagement_score") is not None
                    else (float(event.get("confidence") or 0.0) * 100.0)
                ),
                "timestamp": event.get("timestamp") or now,
                "extra": event.get("extra") or {},
                "created_at": now,
            }
            if not row.get("lesson_id") and not row.get("live_session_id"):
                skipped_count += 1
                continue
            rows.append(row)

        if not rows:
            return {"inserted_count": 0, "skipped_count": max(skipped_count, len(events))}

        try:
            await db.emotion_events.insert_many(rows)
            return {"inserted_count": len(rows), "skipped_count": skipped_count}
        except (AttributeError, RuntimeError) as exc:
            logger.warning("Skipping emotion_events ingest reason=%s", str(exc))
            return {"inserted_count": 0, "skipped_count": len(rows) + skipped_count}

    async def ingest_attention_events(self, *, events: list[dict]) -> dict:
        if not events:
            return {"inserted_count": 0, "skipped_count": 0}

        now = _utc_now()
        rows = []
        for event in events:
            state = str(event.get("state") or "").strip() or "focused"
            if state == "no_face":
                state = "no_face_detected"

            row = {
                "user_id": event.get("user_id"),
                "lesson_id": event.get("lesson_id"),
                "session_id": event.get("session_id"),
                "live_session_id": event.get("live_session_id"),
                "timestamp": event.get("timestamp") or now,
                "state": state,
                "evidence": event.get("evidence") or {},
                "created_at": now,
            }
            if not row.get("lesson_id") and not row.get("live_session_id"):
                continue
            rows.append(row)

        if not rows:
            return {"inserted_count": 0, "skipped_count": len(events)}
        try:
            await db.attention_events.insert_many(rows)
            return {"inserted_count": len(rows), "skipped_count": 0}
        except (AttributeError, RuntimeError) as exc:
            logger.warning("Skipping attention_events ingest reason=%s", str(exc))
            return {"inserted_count": 0, "skipped_count": len(rows)}

    async def get_modality_analytics(
        self,
        *,
        lesson_id: str,
        modality: str,
        class_id: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        emotion_label: str | None = None,
    ) -> dict:
        match_query = self._emotion_match(
            lesson_id=lesson_id,
            modality=modality,
            class_id=class_id,
            start_at=start_at,
            end_at=end_at,
            emotion_label=emotion_label,
        )

        emotion_counts_rows, timeline_rows = await asyncio.gather(
            db.emotion_events.aggregate(self._emotion_counts_pipeline(match_query)).to_list(length=None),
            db.emotion_events.aggregate(self._timeline_pipeline(match_query)).to_list(length=None),
        )

        emotion_counts = {row["_id"]: _safe_int(row["count"]) for row in emotion_counts_rows if row.get("_id")}
        total_events = int(sum(emotion_counts.values()))
        dominant_emotion = _dominant_label(emotion_counts)

        timeline_buckets = [
            {
                "minute": row.get("minute"),
                "total": _safe_int(row.get("total")),
                "emotions": {k: _safe_int(v) for k, v in (row.get("emotions") or {}).items()},
            }
            for row in timeline_rows
        ]

        top_negative_comments: list[dict] = []
        feedback_items: list[dict] = []

        if modality == "text":
            negative_match = dict(match_query)
            negative_match["emotion_label"] = {"$in": sorted(NEGATIVE_TEXT_EMOTIONS)}
            negative_rows = await db.emotion_events.aggregate(
                [
                    {"$match": negative_match},
                    {
                        "$project": {
                            "_id": 0,
                            "user_id": 1,
                            "emotion_label": 1,
                            "confidence": 1,
                            "timestamp": 1,
                            "extra": 1,
                        }
                    },
                    {"$sort": {"confidence": -1, "timestamp": -1}},
                    {"$limit": 50},
                ]
            ).to_list(length=None)
            comment_user_ids = [str(row.get("user_id")) for row in negative_rows if row.get("user_id")]
            labels = await self._resolve_student_labels(comment_user_ids)

            for row in negative_rows:
                user_id = str(row.get("user_id") or "")
                comment = _extract_text_comment(row.get("extra") or {})
                if not user_id or not comment:
                    continue
                top_negative_comments.append(
                    {
                        "user_id": user_id,
                        "student_name": labels.get(user_id, user_id),
                        "comment": comment,
                        "emotion_label": row.get("emotion_label") or "unknown",
                        "confidence": _safe_float(row.get("confidence")),
                        "timestamp": row.get("timestamp") or _utc_now(),
                    }
                )
                if len(top_negative_comments) >= 10:
                    break

        if modality == "voice":
            voice_rows = await db.emotion_events.aggregate(
                [
                    {"$match": match_query},
                    {
                        "$project": {
                            "_id": 0,
                            "user_id": 1,
                            "emotion_label": 1,
                            "confidence": 1,
                            "timestamp": 1,
                            "extra": 1,
                        }
                    },
                    {"$sort": {"timestamp": -1}},
                    {"$limit": 50},
                ]
            ).to_list(length=None)
            voice_user_ids = [str(row.get("user_id")) for row in voice_rows if row.get("user_id")]
            labels = await self._resolve_student_labels(voice_user_ids)

            for row in voice_rows:
                user_id = str(row.get("user_id") or "")
                if not user_id:
                    continue
                extra = row.get("extra") or {}
                feedback = _extract_text_comment(extra) or "Voice feedback sample"
                feedback_items.append(
                    {
                        "user_id": user_id,
                        "student_name": labels.get(user_id, user_id),
                        "feedback": feedback,
                        "emotion_label": row.get("emotion_label") or "unknown",
                        "confidence": _safe_float(row.get("confidence")),
                        "timestamp": row.get("timestamp") or _utc_now(),
                        "audio_duration": _safe_float(extra.get("audio_duration"), default=0.0) or None,
                    }
                )

        return {
            "lesson_id": lesson_id,
            "modality": modality,
            "total_events": total_events,
            "dominant_emotion": dominant_emotion,
            "emotion_counts": emotion_counts,
            "emotion_percentages": _percentages(emotion_counts, total_events),
            "timeline_buckets": timeline_buckets,
            "top_negative_comments": top_negative_comments,
            "feedback_items": feedback_items,
        }

    async def get_overall_analytics(
        self,
        *,
        lesson_id: str,
        class_id: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        emotion_label: str | None = None,
    ) -> dict:
        emotion_match = self._emotion_match(
            lesson_id=lesson_id,
            class_id=class_id,
            start_at=start_at,
            end_at=end_at,
            emotion_label=emotion_label,
        )
        attention_match = self._attention_match(
            lesson_id=lesson_id,
            start_at=start_at,
            end_at=end_at,
        )
        if emotion_label:
            attention_match = self._apply_user_scope(
                attention_match,
                await self._resolve_user_scope(emotion_match),
            )

        modality_rows, emotion_rows, attention_rows = await asyncio.gather(
            db.emotion_events.aggregate(self._modality_counts_pipeline(emotion_match)).to_list(length=None),
            db.emotion_events.aggregate(self._emotion_counts_pipeline(emotion_match)).to_list(length=None),
            db.attention_events.aggregate(
                [
                    {"$match": attention_match},
                    {"$group": {"_id": "$state", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                ]
            ).to_list(length=None),
        )

        modality_breakdown = {row["_id"]: _safe_int(row["count"]) for row in modality_rows if row.get("_id")}
        modality_total = int(sum(modality_breakdown.values()))
        modality_percentages = _percentages(modality_breakdown, modality_total)

        emotion_counts = {row["_id"]: _safe_int(row["count"]) for row in emotion_rows if row.get("_id")}
        total_events = int(sum(emotion_counts.values()))
        dominant_emotion = _dominant_label(emotion_counts)

        emotion_weight_map = {
            "joy": 1.0,
            "interest": 0.95,
            "neutral": 0.7,
            "surprise": 0.65,
            "confusion": 0.4,
            "stress": 0.3,
            "sadness": 0.25,
            "anger": 0.2,
            "fear": 0.2,
            "disgust": 0.2,
            "boredom": 0.1,
        }
        weighted_sum = sum(
            emotion_weight_map.get(label.lower(), 0.5) * count for label, count in emotion_counts.items()
        )
        emotion_component = (weighted_sum / total_events) * 100.0 if total_events > 0 else 0.0

        attention_counts = {row["_id"]: _safe_int(row["count"]) for row in attention_rows if row.get("_id")}
        attention_total = int(sum(attention_counts.values()))
        attention_percentages = _percentages(attention_counts, attention_total)
        focused_count = int(attention_counts.get("focused", 0))
        attention_component = ((focused_count / attention_total) * 100.0) if attention_total > 0 else 0.0

        if attention_total > 0:
            engagement_score = round((emotion_component * 0.7) + (attention_component * 0.3), 2)
        else:
            engagement_score = round(emotion_component, 2)

        return {
            "lesson_id": lesson_id,
            "total_events": total_events,
            "dominant_emotion": dominant_emotion,
            "emotion_counts": emotion_counts,
            "emotion_percentages": _percentages(emotion_counts, total_events),
            "modality_breakdown": modality_breakdown,
            "modality_percentages": modality_percentages,
            "engagement_score": engagement_score,
            "attention_summary": {
                "total_events": attention_total,
                "counts": attention_counts,
                "percentages": attention_percentages,
            },
        }

    @classmethod
    def _live_emotion_match(
        cls,
        *,
        live_session_id: str,
        modality: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        emotion_label: str | None = None,
    ) -> dict:
        match_query: dict = {"live_session_id": live_session_id}
        if modality:
            match_query["modality"] = modality
        normalized_emotion_label = _normalize_emotion_label(emotion_label)
        if normalized_emotion_label:
            match_query["emotion_label"] = normalized_emotion_label
        timestamp_query = cls._build_time_query(start_at, end_at)
        if timestamp_query:
            match_query["timestamp"] = timestamp_query
        return match_query

    @classmethod
    def _live_attention_match(
        cls,
        *,
        live_session_id: str,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> dict:
        match_query: dict = {"live_session_id": live_session_id}
        timestamp_query = cls._build_time_query(start_at, end_at)
        if timestamp_query:
            match_query["timestamp"] = timestamp_query
        return match_query

    async def get_live_modality_analytics(
        self,
        *,
        live_session_id: str,
        modality: str,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        emotion_label: str | None = None,
    ) -> dict:
        match_query = self._live_emotion_match(
            live_session_id=live_session_id,
            modality=modality,
            start_at=start_at,
            end_at=end_at,
            emotion_label=emotion_label,
        )

        emotion_counts_rows, timeline_rows = await asyncio.gather(
            db.emotion_events.aggregate(self._emotion_counts_pipeline(match_query)).to_list(length=None),
            db.emotion_events.aggregate(self._timeline_pipeline(match_query)).to_list(length=None),
        )
        emotion_counts = {row["_id"]: _safe_int(row["count"]) for row in emotion_counts_rows if row.get("_id")}
        total_events = int(sum(emotion_counts.values()))
        dominant_emotion = _dominant_label(emotion_counts)

        timeline_buckets = [
            {
                "minute": row.get("minute"),
                "total": _safe_int(row.get("total")),
                "emotions": {k: _safe_int(v) for k, v in (row.get("emotions") or {}).items()},
            }
            for row in timeline_rows
        ]

        top_negative_comments: list[dict] = []
        feedback_items: list[dict] = []

        if modality == "text":
            negative_match = dict(match_query)
            negative_match["emotion_label"] = {"$in": sorted(NEGATIVE_TEXT_EMOTIONS)}
            negative_rows = await db.emotion_events.aggregate(
                [
                    {"$match": negative_match},
                    {
                        "$project": {
                            "_id": 0,
                            "user_id": 1,
                            "emotion_label": 1,
                            "confidence": 1,
                            "timestamp": 1,
                            "extra": 1,
                        }
                    },
                    {"$sort": {"confidence": -1, "timestamp": -1}},
                    {"$limit": 50},
                ]
            ).to_list(length=None)
            comment_user_ids = [str(row.get("user_id")) for row in negative_rows if row.get("user_id")]
            labels = await self._resolve_student_labels(comment_user_ids)
            for row in negative_rows:
                user_id = str(row.get("user_id") or "")
                comment = _extract_text_comment(row.get("extra") or {})
                if not user_id or not comment:
                    continue
                top_negative_comments.append(
                    {
                        "user_id": user_id,
                        "student_name": labels.get(user_id, user_id),
                        "comment": comment,
                        "emotion_label": row.get("emotion_label") or "unknown",
                        "confidence": _safe_float(row.get("confidence")),
                        "timestamp": row.get("timestamp") or _utc_now(),
                    }
                )
                if len(top_negative_comments) >= 10:
                    break

        if modality == "voice":
            voice_rows = await db.emotion_events.aggregate(
                [
                    {"$match": match_query},
                    {
                        "$project": {
                            "_id": 0,
                            "user_id": 1,
                            "emotion_label": 1,
                            "confidence": 1,
                            "timestamp": 1,
                            "extra": 1,
                        }
                    },
                    {"$sort": {"timestamp": -1}},
                    {"$limit": 50},
                ]
            ).to_list(length=None)
            voice_user_ids = [str(row.get("user_id")) for row in voice_rows if row.get("user_id")]
            labels = await self._resolve_student_labels(voice_user_ids)
            for row in voice_rows:
                user_id = str(row.get("user_id") or "")
                if not user_id:
                    continue
                extra = row.get("extra") or {}
                feedback = _extract_text_comment(extra) or "Voice feedback sample"
                feedback_items.append(
                    {
                        "user_id": user_id,
                        "student_name": labels.get(user_id, user_id),
                        "feedback": feedback,
                        "emotion_label": row.get("emotion_label") or "unknown",
                        "confidence": _safe_float(row.get("confidence")),
                        "timestamp": row.get("timestamp") or _utc_now(),
                        "audio_duration": _safe_float(extra.get("audio_duration"), default=0.0) or None,
                    }
                )

        return {
            "live_session_id": live_session_id,
            "modality": modality,
            "total_events": total_events,
            "dominant_emotion": dominant_emotion,
            "emotion_counts": emotion_counts,
            "emotion_percentages": _percentages(emotion_counts, total_events),
            "timeline_buckets": timeline_buckets,
            "top_negative_comments": top_negative_comments,
            "feedback_items": feedback_items,
        }

    async def get_live_overall_analytics(
        self,
        *,
        live_session_id: str,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        emotion_label: str | None = None,
    ) -> dict:
        emotion_match = self._live_emotion_match(
            live_session_id=live_session_id,
            start_at=start_at,
            end_at=end_at,
            emotion_label=emotion_label,
        )
        attention_match = self._live_attention_match(
            live_session_id=live_session_id,
            start_at=start_at,
            end_at=end_at,
        )
        if emotion_label:
            attention_match = self._apply_user_scope(
                attention_match,
                await self._resolve_user_scope(emotion_match),
            )

        live_class, modality_rows, emotion_rows, attention_rows, active_students_count, attention_user_rows = await asyncio.gather(
            db.live_classes.find_one({"live_session_id": live_session_id}),
            db.emotion_events.aggregate(self._modality_counts_pipeline(emotion_match)).to_list(length=None),
            db.emotion_events.aggregate(self._emotion_counts_pipeline(emotion_match)).to_list(length=None),
            db.attention_events.aggregate(
                [
                    {"$match": attention_match},
                    {"$group": {"_id": "$state", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                ]
            ).to_list(length=None),
            db.live_participants.count_documents(
                {"live_session_id": live_session_id, "role": "student", "is_active": True}
            ),
            db.attention_events.aggregate(
                [
                    {"$match": attention_match},
                    {"$group": {"_id": {"user_id": "$user_id", "state": "$state"}, "count": {"$sum": 1}}},
                ]
            ).to_list(length=None),
        )

        modality_breakdown = {row["_id"]: _safe_int(row["count"]) for row in modality_rows if row.get("_id")}
        modality_total = int(sum(modality_breakdown.values()))
        modality_percentages = _percentages(modality_breakdown, modality_total)

        emotion_counts = {row["_id"]: _safe_int(row["count"]) for row in emotion_rows if row.get("_id")}
        total_events = int(sum(emotion_counts.values()))
        dominant_emotion = _dominant_label(emotion_counts)

        attention_counts = {row["_id"]: _safe_int(row["count"]) for row in attention_rows if row.get("_id")}
        attention_total = int(sum(attention_counts.values()))
        attention_percentages = _percentages(attention_counts, attention_total)

        emotion_weight_map = {
            "joy": 1.0,
            "interest": 0.95,
            "neutral": 0.7,
            "surprise": 0.65,
            "confusion": 0.4,
            "stress": 0.3,
            "sadness": 0.25,
            "anger": 0.2,
            "fear": 0.2,
            "disgust": 0.2,
            "boredom": 0.1,
        }
        weighted_sum = sum(
            emotion_weight_map.get(label.lower(), 0.5) * count for label, count in emotion_counts.items()
        )
        emotion_component = (weighted_sum / total_events) * 100.0 if total_events > 0 else 0.0
        focused_count = int(attention_counts.get("focused", 0))
        attention_component = ((focused_count / attention_total) * 100.0) if attention_total > 0 else 0.0
        engagement_score = round((emotion_component * 0.7) + (attention_component * 0.3), 2) if attention_total > 0 else round(emotion_component, 2)

        attention_by_user: dict[str, dict[str, int]] = {}
        for row in attention_user_rows:
            key = row.get("_id") or {}
            user_id = str(key.get("user_id") or "")
            state = str(key.get("state") or "")
            if not user_id or not state:
                continue
            attention_by_user.setdefault(user_id, {})
            attention_by_user[user_id][state] = _safe_int(row.get("count"))

        low_attention_alerts = 0
        for _, state_counts in attention_by_user.items():
            focused = _safe_int(state_counts.get("focused"))
            non_focused = (
                _safe_int(state_counts.get("no_face_detected"))
                + _safe_int(state_counts.get("tab_hidden"))
                + _safe_int(state_counts.get("idle"))
                + _safe_int(state_counts.get("multi_face"))
                + _safe_int(state_counts.get("possible_distraction"))
            )
            if non_focused >= 3 and non_focused >= focused:
                low_attention_alerts += 1

        class_id = str((live_class or {}).get("class_id") or "") or None
        lesson_id = str((live_class or {}).get("lesson_id") or "") or None
        title = str((live_class or {}).get("title") or "") or None
        status_value = str((live_class or {}).get("status") or "active")
        if status_value not in {"active", "ended"}:
            status_value = "active"

        return {
            "live_session_id": live_session_id,
            "class_id": class_id,
            "lesson_id": lesson_id,
            "title": title,
            "status": status_value,
            "total_events": total_events,
            "dominant_emotion": dominant_emotion,
            "emotion_counts": emotion_counts,
            "emotion_percentages": _percentages(emotion_counts, total_events),
            "modality_breakdown": modality_breakdown,
            "modality_percentages": modality_percentages,
            "engagement_score": engagement_score,
            "active_students_count": _safe_int(active_students_count),
            "low_attention_alerts": low_attention_alerts,
            "attention_summary": {
                "total_events": attention_total,
                "counts": attention_counts,
                "percentages": attention_percentages,
            },
        }

    async def get_students_live_analytics(
        self,
        *,
        live_session_id: str,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        emotion_label: str | None = None,
    ) -> dict:
        emotion_match = self._live_emotion_match(
            live_session_id=live_session_id,
            start_at=start_at,
            end_at=end_at,
            emotion_label=emotion_label,
        )
        attention_match = self._live_attention_match(
            live_session_id=live_session_id,
            start_at=start_at,
            end_at=end_at,
        )

        (
            live_class,
            emotion_user_rows,
            modality_emotion_rows,
            emotion_span_rows,
            attention_rows,
            face_no_face_rows,
            live_participants_rows,
        ) = await asyncio.gather(
            db.live_classes.find_one({"live_session_id": live_session_id}),
            db.emotion_events.aggregate(
                [
                    {"$match": emotion_match},
                    {"$group": {"_id": {"user_id": "$user_id", "emotion": "$emotion_label"}, "count": {"$sum": 1}}},
                ]
            ).to_list(length=None),
            db.emotion_events.aggregate(
                [
                    {"$match": emotion_match},
                    {"$group": {"_id": {"user_id": "$user_id", "modality": "$modality", "emotion": "$emotion_label"}, "count": {"$sum": 1}}},
                ]
            ).to_list(length=None),
            db.emotion_events.aggregate(
                [
                    {"$match": emotion_match},
                    {"$group": {"_id": "$user_id", "min_ts": {"$min": "$timestamp"}, "max_ts": {"$max": "$timestamp"}}},
                ]
            ).to_list(length=None),
            db.attention_events.aggregate(
                [
                    {"$match": attention_match},
                    {"$group": {"_id": {"user_id": "$user_id", "state": "$state"}, "count": {"$sum": 1}}},
                ]
            ).to_list(length=None),
            db.emotion_events.aggregate(
                [
                    {"$match": {**emotion_match, "modality": "face", "emotion_label": "no_face_detected"}},
                    {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
                ]
            ).to_list(length=None),
            db.live_participants.find({"live_session_id": live_session_id}).to_list(length=None),
        )

        teacher_id = str((live_class or {}).get("teacher_id") or "")
        now = _utc_now()

        emotion_by_user: dict[str, dict[str, int]] = {}
        for row in emotion_user_rows:
            key = row.get("_id") or {}
            user_id = str(key.get("user_id") or "")
            emotion = str(key.get("emotion") or "")
            if not user_id or not emotion or user_id == teacher_id:
                continue
            emotion_by_user.setdefault(user_id, {})
            emotion_by_user[user_id][emotion] = _safe_int(row.get("count"))

        user_scope = set(emotion_by_user.keys()) if emotion_label else None

        modality_emotions_by_user: dict[str, dict[str, dict[str, int]]] = {}
        for row in modality_emotion_rows:
            key = row.get("_id") or {}
            user_id = str(key.get("user_id") or "")
            modality = str(key.get("modality") or "")
            emotion = str(key.get("emotion") or "")
            if not user_id or not modality or not emotion or user_id == teacher_id:
                continue
            if user_scope is not None and user_id not in user_scope:
                continue
            modality_emotions_by_user.setdefault(user_id, {})
            modality_emotions_by_user[user_id].setdefault(modality, {})
            modality_emotions_by_user[user_id][modality][emotion] = _safe_int(row.get("count"))

        emotion_span_by_user: dict[str, dict] = {}
        for row in emotion_span_rows:
            user_id = str(row.get("_id") or "")
            if not user_id or user_id == teacher_id:
                continue
            if user_scope is not None and user_id not in user_scope:
                continue
            emotion_span_by_user[user_id] = {
                "min_ts": row.get("min_ts"),
                "max_ts": row.get("max_ts"),
            }

        attention_by_user: dict[str, dict[str, int]] = {}
        for row in attention_rows:
            key = row.get("_id") or {}
            user_id = str(key.get("user_id") or "")
            state = str(key.get("state") or "")
            if not user_id or not state or user_id == teacher_id:
                continue
            if user_scope is not None and user_id not in user_scope:
                continue
            attention_by_user.setdefault(user_id, {})
            attention_by_user[user_id][state] = _safe_int(row.get("count"))

        face_no_face_by_user: dict[str, int] = {}
        for row in face_no_face_rows:
            user_id = str(row.get("_id") or "")
            if not user_id or user_id == teacher_id:
                continue
            if user_scope is not None and user_id not in user_scope:
                continue
            face_no_face_by_user[user_id] = _safe_int(row.get("count"))

        participant_watch_by_user: dict[str, int] = {}
        participant_last_seen_by_user: dict[str, datetime | None] = {}
        for row in live_participants_rows:
            user_id = str(row.get("user_id") or "")
            role = str(row.get("role") or "")
            if not user_id or role != "student" or user_id == teacher_id:
                continue
            if user_scope is not None and user_id not in user_scope:
                continue

            watch_time = _safe_int(row.get("watch_time_seconds"))
            is_active = bool(row.get("is_active"))
            if is_active:
                joined_ref = row.get("last_joined_at") or row.get("joined_at")
                watch_time += _safe_watch_seconds(joined_ref, now)

            participant_watch_by_user[user_id] = max(participant_watch_by_user.get(user_id, 0), watch_time)
            last_seen = row.get("left_at") or row.get("last_joined_at") or row.get("joined_at")
            if isinstance(last_seen, datetime):
                previous_last_seen = participant_last_seen_by_user.get(user_id)
                if not previous_last_seen or last_seen > previous_last_seen:
                    participant_last_seen_by_user[user_id] = last_seen

        all_user_ids = sorted(
            {
                *emotion_by_user.keys(),
                *modality_emotions_by_user.keys(),
                *attention_by_user.keys(),
                *face_no_face_by_user.keys(),
                *participant_watch_by_user.keys(),
                *emotion_span_by_user.keys(),
            }
        )
        student_labels = await self._resolve_student_labels(all_user_ids)

        students: list[dict] = []
        for user_id in all_user_ids:
            overall_counts = emotion_by_user.get(user_id, {})
            modality_counts = modality_emotions_by_user.get(user_id, {})
            attention_counts = attention_by_user.get(user_id, {})

            dominant_overall = _dominant_label(overall_counts)
            dominant_face = _dominant_label(modality_counts.get("face", {}))
            dominant_text = _dominant_label(modality_counts.get("text", {}))
            dominant_voice = _dominant_label(modality_counts.get("voice", {}))
            dominant_attention = _dominant_label(attention_counts)

            no_face_count = (
                _safe_int(attention_counts.get("no_face_detected"))
                + _safe_int(attention_counts.get("no_face"))
                + _safe_int(face_no_face_by_user.get(user_id))
            )
            attention_total = int(sum(attention_counts.values()))
            attention_percentages = _percentages(attention_counts, attention_total)

            watch_time_seconds = _safe_int(participant_watch_by_user.get(user_id, 0))
            span = emotion_span_by_user.get(user_id, {})
            min_ts = span.get("min_ts")
            max_ts = span.get("max_ts")
            if watch_time_seconds <= 0 and isinstance(min_ts, datetime) and isinstance(max_ts, datetime):
                watch_time_seconds = max(0, int((max_ts - min_ts).total_seconds()))

            last_seen_candidates = []
            last_seen_participant = participant_last_seen_by_user.get(user_id)
            if isinstance(last_seen_participant, datetime):
                last_seen_candidates.append(last_seen_participant)
            if isinstance(max_ts, datetime):
                last_seen_candidates.append(max_ts)
            last_seen = max(last_seen_candidates) if last_seen_candidates else None

            students.append(
                {
                    "user_id": user_id,
                    "student_name": student_labels.get(user_id, user_id),
                    "watch_time_seconds": watch_time_seconds,
                    "watched_time_min": round(watch_time_seconds / 60.0, 2),
                    "dominant_emotion": dominant_overall,
                    "dominant_face_emotion": dominant_face,
                    "dominant_text_emotion": dominant_text,
                    "dominant_voice_emotion": dominant_voice,
                    "attention_state": dominant_attention,
                    "attention_state_breakdown": attention_counts,
                    "attention_state_percentages": attention_percentages,
                    "no_face_count": no_face_count,
                    "last_seen": last_seen,
                }
            )

        students.sort(key=lambda item: item.get("watch_time_seconds", 0), reverse=True)
        return {"live_session_id": live_session_id, "students": students}

    async def _get_lesson_duration_seconds(self, lesson_id: str) -> int:
        lesson = await db.lessons.find_one({"lesson_id": lesson_id}, {"duration_sec": 1, "durationSec": 1})
        if not lesson:
            lesson = await db.lessons.find_one({"lessonId": lesson_id}, {"duration_sec": 1, "durationSec": 1})
        if not lesson:
            return 0
        duration_value = lesson.get("duration_sec")
        if duration_value is None:
            duration_value = lesson.get("durationSec")
        return max(0, _safe_int(duration_value))

    async def get_students_lesson_analytics(
        self,
        *,
        lesson_id: str,
        class_id: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        emotion_label: str | None = None,
    ) -> dict:
        emotion_match = self._emotion_match(
            lesson_id=lesson_id,
            class_id=class_id,
            start_at=start_at,
            end_at=end_at,
            emotion_label=emotion_label,
        )
        attention_match = self._attention_match(
            lesson_id=lesson_id,
            start_at=start_at,
            end_at=end_at,
        )

        (
            emotion_user_rows,
            modality_emotion_rows,
            span_rows,
            attention_rows,
            face_no_face_rows,
            attention_watch_rows,
            attention_last_rows,
            emotion_timeline_rows,
            attention_timeline_rows,
            text_rows,
            voice_rows,
            progress_rows,
            completion_rows,
            lesson_duration_seconds,
        ) = await asyncio.gather(
            db.emotion_events.aggregate(
                [
                    {"$match": emotion_match},
                    {
                        "$group": {
                            "_id": {"user_id": "$user_id", "emotion": "$emotion_label"},
                            "count": {"$sum": 1},
                        }
                    },
                ]
            ).to_list(length=None),
            db.emotion_events.aggregate(
                [
                    {"$match": emotion_match},
                    {
                        "$group": {
                            "_id": {
                                "user_id": "$user_id",
                                "modality": "$modality",
                                "emotion": "$emotion_label",
                            },
                            "count": {"$sum": 1},
                        }
                    },
                ]
            ).to_list(length=None),
            db.emotion_events.aggregate(
                [
                    {"$match": emotion_match},
                    {
                        "$group": {
                            "_id": "$user_id",
                            "min_ts": {"$min": "$timestamp"},
                            "max_ts": {"$max": "$timestamp"},
                            "event_count": {"$sum": 1},
                        }
                    },
                ]
            ).to_list(length=None),
            db.attention_events.aggregate(
                [
                    {"$match": attention_match},
                    {
                        "$group": {
                            "_id": {"user_id": "$user_id", "state": "$state"},
                            "count": {"$sum": 1},
                        }
                    },
                ]
            ).to_list(length=None),
            db.emotion_events.aggregate(
                [
                    {"$match": {**emotion_match, "modality": "face", "emotion_label": "no_face_detected"}},
                    {
                        "$group": {
                            "_id": "$user_id",
                            "count": {"$sum": 1},
                        }
                    },
                ]
            ).to_list(length=None),
            db.attention_events.aggregate(
                [
                    {"$match": attention_match},
                    {
                        "$group": {
                            "_id": "$user_id",
                            "watch_seconds": {
                                "$sum": {"$ifNull": ["$evidence.watchSecondsDelta", 0]}
                            },
                        }
                    },
                ]
            ).to_list(length=None),
            db.attention_events.aggregate(
                [
                    {"$match": attention_match},
                    {
                        "$group": {
                            "_id": "$user_id",
                            "max_ts": {"$max": "$timestamp"},
                        }
                    },
                ]
            ).to_list(length=None),
            db.emotion_events.aggregate(
                [
                    {"$match": emotion_match},
                    {
                        "$group": {
                            "_id": {
                                "user_id": "$user_id",
                                "minute": {
                                    "$dateToString": {
                                        "format": "%Y-%m-%dT%H:%M:00Z",
                                        "date": "$timestamp",
                                        "timezone": "UTC",
                                    }
                                },
                                "emotion": "$emotion_label",
                            },
                            "count": {"$sum": 1},
                        }
                    },
                    {"$sort": {"_id.minute": 1}},
                ]
            ).to_list(length=None),
            db.attention_events.aggregate(
                [
                    {"$match": attention_match},
                    {
                        "$group": {
                            "_id": {
                                "user_id": "$user_id",
                                "minute": {
                                    "$dateToString": {
                                        "format": "%Y-%m-%dT%H:%M:00Z",
                                        "date": "$timestamp",
                                        "timezone": "UTC",
                                    }
                                },
                                "state": "$state",
                            },
                            "count": {"$sum": 1},
                        }
                    },
                    {"$sort": {"_id.minute": 1}},
                ]
            ).to_list(length=None),
            db.emotion_events.find(
                {**emotion_match, "modality": "text"},
                {
                    "_id": 0,
                    "user_id": 1,
                    "emotion_label": 1,
                    "confidence": 1,
                    "timestamp": 1,
                    "extra": 1,
                },
            ).sort("timestamp", -1).to_list(length=2000),
            db.emotion_events.find(
                {**emotion_match, "modality": "voice"},
                {
                    "_id": 0,
                    "user_id": 1,
                    "emotion_label": 1,
                    "confidence": 1,
                    "timestamp": 1,
                    "extra": 1,
                },
            ).sort("timestamp", -1).to_list(length=2000),
            db.lesson_progress.find(
                {
                    "lesson_id": lesson_id,
                    **({"class_id": class_id} if class_id else {}),
                },
                {"_id": 0},
            ).to_list(length=None),
            db.lesson_completions.find(
                {
                    "lesson_id": lesson_id,
                    **({"class_id": class_id} if class_id else {}),
                },
                {"_id": 0},
            ).to_list(length=None),
            self._get_lesson_duration_seconds(lesson_id),
        )

        emotion_by_user: dict[str, dict[str, int]] = {}
        for row in emotion_user_rows:
            raw_user = row.get("_id", {}).get("user_id")
            emotion = row.get("_id", {}).get("emotion")
            if not raw_user or not emotion:
                continue
            user_id = str(raw_user)
            emotion_by_user.setdefault(user_id, {})
            emotion_by_user[user_id][emotion] = _safe_int(row.get("count"))

        user_scope = set(emotion_by_user.keys()) if emotion_label else None

        modality_emotions_by_user: dict[str, dict[str, dict[str, int]]] = {}
        for row in modality_emotion_rows:
            key = row.get("_id") or {}
            raw_user = key.get("user_id")
            modality = key.get("modality")
            emotion = key.get("emotion")
            if not raw_user or not modality or not emotion:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            modality_emotions_by_user.setdefault(user_id, {})
            modality_emotions_by_user[user_id].setdefault(modality, {})
            modality_emotions_by_user[user_id][modality][emotion] = _safe_int(row.get("count"))

        span_by_user: dict[str, dict] = {}
        for row in span_rows:
            raw_user = row.get("_id")
            if not raw_user:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            span_by_user[user_id] = {
                "min_ts": row.get("min_ts"),
                "max_ts": row.get("max_ts"),
                "event_count": _safe_int(row.get("event_count")),
            }

        attention_by_user: dict[str, dict[str, int]] = {}
        for row in attention_rows:
            key = row.get("_id") or {}
            raw_user = key.get("user_id")
            state = key.get("state")
            if not raw_user or not state:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            attention_by_user.setdefault(user_id, {})
            attention_by_user[user_id][state] = _safe_int(row.get("count"))

        no_face_from_face_events: dict[str, int] = {}
        for row in face_no_face_rows:
            raw_user = row.get("_id")
            if not raw_user:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            no_face_from_face_events[user_id] = _safe_int(row.get("count"))

        watch_seconds_by_user: dict[str, int] = {}
        for row in attention_watch_rows:
            raw_user = row.get("_id")
            if not raw_user:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            watch_seconds_by_user[user_id] = max(0, _safe_int(row.get("watch_seconds")))

        attention_last_seen: dict[str, datetime] = {}
        for row in attention_last_rows:
            raw_user = row.get("_id")
            max_ts = row.get("max_ts")
            if not raw_user or not isinstance(max_ts, datetime):
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            attention_last_seen[user_id] = max_ts

        timeline_by_user: dict[str, dict[str, dict]] = {}
        for row in emotion_timeline_rows:
            key = row.get("_id") or {}
            raw_user = key.get("user_id")
            minute = key.get("minute")
            emotion = key.get("emotion")
            count = _safe_int(row.get("count"))
            if not raw_user or not minute or not emotion:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            timeline_by_user.setdefault(user_id, {})
            timeline_by_user[user_id].setdefault(
                minute,
                {
                    "minute": minute,
                    "emotion_total": 0,
                    "attention_total": 0,
                    "emotion_counts": {},
                    "attention_counts": {},
                },
            )
            slot = timeline_by_user[user_id][minute]
            slot["emotion_counts"][emotion] = count
            slot["emotion_total"] += count

        for row in attention_timeline_rows:
            key = row.get("_id") or {}
            raw_user = key.get("user_id")
            minute = key.get("minute")
            state = key.get("state")
            count = _safe_int(row.get("count"))
            if not raw_user or not minute or not state:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            timeline_by_user.setdefault(user_id, {})
            timeline_by_user[user_id].setdefault(
                minute,
                {
                    "minute": minute,
                    "emotion_total": 0,
                    "attention_total": 0,
                    "emotion_counts": {},
                    "attention_counts": {},
                },
            )
            slot = timeline_by_user[user_id][minute]
            slot["attention_counts"][state] = count
            slot["attention_total"] += count

        text_by_user: dict[str, list[dict]] = {}
        for row in text_rows:
            raw_user = row.get("user_id")
            if not raw_user:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            comment = _extract_text_comment(row.get("extra") or {})
            if not comment:
                continue
            text_by_user.setdefault(user_id, [])
            text_by_user[user_id].append(
                {
                    "user_id": user_id,
                    "student_name": user_id,
                    "comment": comment,
                    "emotion_label": row.get("emotion_label") or "unknown",
                    "confidence": _safe_float(row.get("confidence")),
                    "timestamp": row.get("timestamp") or _utc_now(),
                }
            )

        voice_by_user: dict[str, list[dict]] = {}
        for row in voice_rows:
            raw_user = row.get("user_id")
            if not raw_user:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            extra = row.get("extra") or {}
            feedback = _extract_text_comment(extra) or "Voice feedback sample"
            voice_by_user.setdefault(user_id, [])
            voice_by_user[user_id].append(
                {
                    "user_id": user_id,
                    "student_name": user_id,
                    "feedback": feedback,
                    "emotion_label": row.get("emotion_label") or "unknown",
                    "confidence": _safe_float(row.get("confidence")),
                    "timestamp": row.get("timestamp") or _utc_now(),
                    "audio_duration": _safe_float(extra.get("audio_duration"), default=0.0) or None,
                }
            )

        progress_by_user: dict[str, dict] = {}
        for row in progress_rows:
            raw_user = row.get("user_id")
            if not raw_user:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            existing = progress_by_user.get(user_id)
            candidate_updated = _as_utc(row.get("updated_at")) or _utc_now()
            existing_updated = _as_utc((existing or {}).get("updated_at")) if existing else None
            if not existing or not existing_updated or candidate_updated >= existing_updated:
                progress_by_user[user_id] = row

        completion_by_user: dict[str, bool] = {}
        for row in completion_rows:
            raw_user = row.get("user_id")
            if not raw_user:
                continue
            user_id = str(raw_user)
            if user_scope is not None and user_id not in user_scope:
                continue
            completion_by_user[user_id] = bool(row.get("completed", True))

        all_user_ids = sorted(
            {
                *emotion_by_user.keys(),
                *span_by_user.keys(),
                *attention_by_user.keys(),
                *watch_seconds_by_user.keys(),
                *timeline_by_user.keys(),
                *text_by_user.keys(),
                *voice_by_user.keys(),
                *progress_by_user.keys(),
                *completion_by_user.keys(),
            }
        )
        student_labels = await self._resolve_student_labels(all_user_ids)

        students: list[dict] = []
        max_watch_time_seconds = 0
        for user_id in all_user_ids:
            span = span_by_user.get(user_id, {})
            min_ts = span.get("min_ts")
            max_ts = span.get("max_ts")
            event_count = _safe_int(span.get("event_count"))

            watch_time_seconds = 0
            if isinstance(min_ts, datetime) and isinstance(max_ts, datetime):
                watch_time_seconds = max(0, int((max_ts - min_ts).total_seconds()))
                if watch_time_seconds == 0 and event_count > 0:
                    watch_time_seconds = event_count * 5
            watched_from_attention = watch_seconds_by_user.get(user_id, 0)
            if watched_from_attention > 0:
                watch_time_seconds = max(watch_time_seconds, watched_from_attention)
            max_watch_time_seconds = max(max_watch_time_seconds, watch_time_seconds)

            overall_counts = emotion_by_user.get(user_id, {})
            modality_counts = modality_emotions_by_user.get(user_id, {})
            dominant_overall = _dominant_label(overall_counts)
            dominant_face = _dominant_label(modality_counts.get("face", {}))
            dominant_text = _dominant_label(modality_counts.get("text", {}))
            dominant_voice = _dominant_label(modality_counts.get("voice", {}))

            attention_states = attention_by_user.get(user_id, {})
            attention_total = int(sum(attention_states.values()))
            attention_percentages = _percentages(attention_states, attention_total)
            focused_percent = attention_percentages.get("focused", 0.0)
            dominant_attention = _dominant_label(attention_states)
            attention_summary = _build_attention_summary_text(attention_percentages)
            no_face_detected = _safe_int(attention_states.get("no_face", 0)) + _safe_int(
                attention_states.get("no_face_detected", 0)
            )
            no_face_detected += _safe_int(no_face_from_face_events.get(user_id, 0))

            last_seen_candidates: list[datetime] = []
            if isinstance(max_ts, datetime):
                last_seen_candidates.append(max_ts)
            attention_last = attention_last_seen.get(user_id)
            if isinstance(attention_last, datetime):
                last_seen_candidates.append(attention_last)
            last_seen = max(last_seen_candidates) if last_seen_candidates else None

            flags: list[str] = []
            if attention_percentages.get("no_face", 0.0) >= 50.0:
                flags.append("No face detected most of time")
            if attention_states.get("tab_hidden", 0) > 0:
                flags.append("Tab hidden")
            if attention_states.get("idle", 0) > 0:
                flags.append("Idle")
            if (
                attention_states.get("possible_distraction", 0) > 0
                or attention_states.get("possible_game", 0) > 0
                or attention_percentages.get("away", 0.0) >= 25.0
            ):
                flags.append("Possible distraction")

            timeline_rows_for_user = []
            for minute in sorted((timeline_by_user.get(user_id) or {}).keys()):
                row = timeline_by_user[user_id][minute]
                timeline_rows_for_user.append(
                    {
                        "minute": minute,
                        "emotion_total": _safe_int(row.get("emotion_total")),
                        "attention_total": _safe_int(row.get("attention_total")),
                        "emotion_counts": {
                            key: _safe_int(value) for key, value in (row.get("emotion_counts") or {}).items()
                        },
                        "attention_counts": {
                            key: _safe_int(value) for key, value in (row.get("attention_counts") or {}).items()
                        },
                    }
                )

            student_name = student_labels.get(user_id) or user_id
            progress_doc = progress_by_user.get(user_id, {})
            progress_watch_seconds = _safe_int(progress_doc.get("watched_time_sec"), default=0)
            progress_completed = bool(progress_doc.get("completed", False))
            if progress_watch_seconds > watch_time_seconds:
                watch_time_seconds = progress_watch_seconds
            lesson_completed = bool(completion_by_user.get(user_id, False) or progress_completed)
            text_comments = text_by_user.get(user_id, [])[:50]
            for item in text_comments:
                item["student_name"] = student_name

            voice_feedback = voice_by_user.get(user_id, [])[:50]
            for item in voice_feedback:
                item["student_name"] = student_name

            students.append(
                {
                    "user_id": user_id,
                    "student_name": student_name,
                    "watch_time_seconds": watch_time_seconds,
                    "watched_time_min": round(watch_time_seconds / 60.0, 2),
                    "completion_percent": 0.0,
                    "dominant_emotion": dominant_overall,
                    "dominant_emotion_overall": dominant_overall,
                    "dominant_face_emotion": dominant_face,
                    "dominant_text_emotion": dominant_text,
                    "dominant_voice_emotion": dominant_voice,
                    "attention_score": round(focused_percent, 2),
                    "dominant_attention_state": dominant_attention,
                    "attention_state_summary": attention_summary,
                    "no_face_detected": no_face_detected,
                    "lesson_completed": lesson_completed,
                    "emotion_event_count": event_count,
                    "attention_state_breakdown": attention_states,
                    "attention_state_percentages": attention_percentages,
                    "last_seen": last_seen,
                    "text_comments": text_comments,
                    "voice_feedback": voice_feedback,
                    "flags": flags,
                    "timeline": timeline_rows_for_user,
                }
            )

        for student in students:
            watch_time_seconds = _safe_int(student.get("watch_time_seconds"))
            progress_doc = progress_by_user.get(student.get("user_id", ""), {})
            progress_completion_percent = _safe_float(progress_doc.get("completion_percent"), default=0.0)
            if lesson_duration_seconds > 0:
                completion_percent = min(100.0, round((watch_time_seconds / lesson_duration_seconds) * 100.0, 2))
            elif max_watch_time_seconds > 0:
                completion_percent = round((watch_time_seconds / max_watch_time_seconds) * 100.0, 2)
            else:
                completion_percent = 0.0
            if progress_completion_percent > completion_percent:
                completion_percent = progress_completion_percent
            student["completion_percent"] = completion_percent
            student["lesson_completed"] = bool(
                student.get("lesson_completed") or completion_by_user.get(student.get("user_id", ""), False)
            )

        students.sort(key=lambda item: item.get("watch_time_seconds", 0), reverse=True)
        return {"lesson_id": lesson_id, "students": students}

    async def get_lesson_progress_analytics(
        self,
        *,
        lesson_id: str,
        class_id: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        emotion_label: str | None = None,
    ) -> dict:
        progress_match = {"lesson_id": lesson_id}
        if class_id:
            progress_match["class_id"] = class_id

        progress_user_scope: set[str] | None = None
        if start_at or end_at or emotion_label:
            progress_user_scope = await self._resolve_user_scope(
                self._emotion_match(
                    lesson_id=lesson_id,
                    class_id=class_id,
                    start_at=start_at,
                    end_at=end_at,
                    emotion_label=emotion_label,
                )
            )

        no_face_match = {
            "lesson_id": lesson_id,
            "state": {"$in": ["no_face", "no_face_detected"]},
        }
        timestamp_query = self._build_time_query(start_at, end_at)
        if timestamp_query:
            no_face_match["timestamp"] = timestamp_query
        no_face_match = self._apply_user_scope(no_face_match, progress_user_scope)

        no_face_emotion_match = {
            "lesson_id": lesson_id,
            "modality": "face",
            "emotion_label": "no_face_detected",
            **({"class_id": class_id} if class_id else {}),
        }
        if timestamp_query:
            no_face_emotion_match["timestamp"] = timestamp_query
        no_face_emotion_match = self._apply_user_scope(no_face_emotion_match, progress_user_scope)

        progress_rows, completion_rows, no_face_rows, no_face_emotion_rows = await asyncio.gather(
            db.lesson_progress.find(progress_match, {"_id": 0}).to_list(length=None),
            db.lesson_completions.find({**progress_match, "completed": True}, {"_id": 0, "user_id": 1}).to_list(length=None),
            db.attention_events.aggregate(
                [
                    {"$match": no_face_match},
                    {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
                ]
            ).to_list(length=None),
            db.emotion_events.aggregate(
                [
                    {"$match": no_face_emotion_match},
                    {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
                ]
            ).to_list(length=None),
        )

        if progress_user_scope is not None:
            progress_rows = [
                row for row in progress_rows
                if str(row.get("user_id") or "") in progress_user_scope
            ]
            completion_rows = [
                row for row in completion_rows
                if str(row.get("user_id") or "") in progress_user_scope
            ]

        completion_user_ids = {str(row.get("user_id")) for row in completion_rows if row.get("user_id")}
        no_face_map: dict[str, int] = {}
        for row in no_face_rows:
            raw_user = row.get("_id")
            if not raw_user:
                continue
            no_face_map[str(raw_user)] = _safe_int(row.get("count"))
        for row in no_face_emotion_rows:
            raw_user = row.get("_id")
            if not raw_user:
                continue
            user_id = str(raw_user)
            no_face_map[user_id] = _safe_int(no_face_map.get(user_id, 0)) + _safe_int(row.get("count"))

        known_user_ids = {str(row.get("user_id")) for row in progress_rows if row.get("user_id")} | completion_user_ids
        student_labels = await self._resolve_student_labels(sorted(known_user_ids))

        students: list[dict] = []
        seen_user_ids: set[str] = set()
        for row in progress_rows:
            raw_user = row.get("user_id")
            if not raw_user:
                continue
            user_id = str(raw_user)
            seen_user_ids.add(user_id)
            watched_time_sec = max(0, _safe_int(row.get("watched_time_sec")))
            completion_percent = max(0.0, min(100.0, _safe_float(row.get("completion_percent"))))
            lesson_completed = bool(row.get("completed", False) or user_id in completion_user_ids)
            students.append(
                {
                    "user_id": user_id,
                    "student_name": student_labels.get(user_id, user_id),
                    "watched_time_sec": watched_time_sec,
                    "completion_percent": completion_percent,
                    "lesson_completed": lesson_completed,
                    "face_emotion_captured": bool(row.get("face_emotion_captured", False)),
                    "text_feedback_sent": bool(row.get("text_feedback_sent", False)),
                    "audio_feedback_sent": bool(row.get("audio_feedback_sent", False)),
                    "watch_progress_completed": bool(row.get("watch_progress_completed", False)),
                    "no_face_detected": no_face_map.get(user_id, 0),
                    "updated_at": row.get("updated_at"),
                }
            )

        for user_id in sorted(completion_user_ids):
            if user_id in seen_user_ids:
                continue
            students.append(
                {
                    "user_id": user_id,
                    "student_name": student_labels.get(user_id, user_id),
                    "watched_time_sec": 0,
                    "completion_percent": 100.0,
                    "lesson_completed": True,
                    "face_emotion_captured": False,
                    "text_feedback_sent": False,
                    "audio_feedback_sent": False,
                    "watch_progress_completed": True,
                    "no_face_detected": no_face_map.get(user_id, 0),
                    "updated_at": None,
                }
            )

        students.sort(
            key=lambda row: (
                int(bool(row.get("lesson_completed"))),
                _safe_float(row.get("completion_percent")),
                _safe_int(row.get("watched_time_sec")),
            ),
            reverse=True,
        )

        completion_count = sum(1 for row in students if row.get("lesson_completed"))
        total_students_with_progress = len(students)
        completion_rate_percent = round((completion_count / total_students_with_progress) * 100.0, 2) if total_students_with_progress else 0.0

        return {
            "lesson_id": lesson_id,
            "completion_count": completion_count,
            "total_students_with_progress": total_students_with_progress,
            "completion_rate_percent": completion_rate_percent,
            "students": students,
        }


emotion_event_analytics_service = EmotionEventAnalyticsService()
