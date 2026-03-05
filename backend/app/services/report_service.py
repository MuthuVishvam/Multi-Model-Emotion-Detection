from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.database import db


EMOTION_NORMALIZATION = {
    "bored": "boredom",
}


def _normalize_emotion(raw_emotion: str | None) -> str:
    if not raw_emotion:
        return "unknown"
    normalized = str(raw_emotion).strip().lower()
    if not normalized:
        return "unknown"
    return EMOTION_NORMALIZATION.get(normalized, normalized)


def _ensure_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _distribution_percentages(counts: dict[str, int], total_logs: int) -> dict[str, float]:
    if total_logs <= 0:
        return {}
    return {
        emotion: round((count / total_logs) * 100.0, 2)
        for emotion, count in counts.items()
    }


def _engagement_score(percentages: dict[str, float]) -> float:
    interest = percentages.get("interest", 0.0)
    boredom = percentages.get("boredom", 0.0)
    stress = percentages.get("stress", 0.0)
    score = interest - boredom - stress
    return round(max(0.0, min(100.0, score)), 2)


def _dominant_emotion(counts: dict[str, int]) -> str:
    if not counts:
        return "unknown"
    return max(counts.items(), key=lambda pair: pair[1])[0]


def _duration_minutes(start_time: datetime | None, end_time: datetime | None) -> float:
    if not start_time or not end_time:
        return 0.0
    seconds = max(0.0, (end_time - start_time).total_seconds())
    return round(seconds / 60.0, 2)


def _build_suggestions(
    dominant_emotion_overall: str,
    dominant_emotion_last_5m: str,
    engagement_score: float,
) -> dict[str, str]:
    teacher_tip_by_emotion = {
        "interest": "Learners are engaged. Increase challenge with a practical application task.",
        "boredom": "Signals suggest disengagement. Add a short interactive activity or checkpoint.",
        "stress": "Stress is elevated. Slow pacing and clarify one concept at a time.",
        "confusion": "Confusion is dominant. Re-explain with a simpler example and quick recap.",
        "neutral": "Signals are neutral. Ask targeted questions to raise active participation.",
    }
    student_tip_by_emotion = {
        "interest": "Keep momentum by writing one concrete takeaway and next action.",
        "boredom": "Switch to active practice: summarize aloud and solve one short exercise.",
        "stress": "Take a short break, then continue with one small, clear objective.",
        "confusion": "List your exact blocking question and revisit the prior minute.",
        "neutral": "Add a quick reflection note to improve focus and recall.",
    }

    focus_emotion = dominant_emotion_last_5m if dominant_emotion_last_5m != "unknown" else dominant_emotion_overall
    teacher_suggestion = teacher_tip_by_emotion.get(
        focus_emotion,
        "Monitor responses and adjust pacing based on learner feedback.",
    )
    student_suggestion = student_tip_by_emotion.get(
        focus_emotion,
        "Continue and add a brief reflection note to reinforce learning.",
    )

    if engagement_score < 30.0:
        teacher_suggestion = f"{teacher_suggestion} Engagement is low; reduce lecture time and add interaction now."
        student_suggestion = f"{student_suggestion} Engagement is low; pause and restate the key idea in your own words."
    elif engagement_score >= 70.0:
        teacher_suggestion = f"{teacher_suggestion} Engagement is high; use a deeper follow-up question."

    return {
        "teacher": teacher_suggestion,
        "student": student_suggestion,
    }


class ReportService:
    async def _aggregate_emotion_counts(self, match_filter: dict) -> dict[str, int]:
        pipeline = [
            {"$match": match_filter},
            {"$group": {"_id": "$emotion", "count": {"$sum": 1}}},
        ]
        rows = await db.emotion_logs.aggregate(pipeline).to_list(length=None)

        merged_counts: dict[str, int] = defaultdict(int)
        for row in rows:
            emotion = _normalize_emotion(row.get("_id"))
            merged_counts[emotion] += int(row.get("count", 0))

        return dict(sorted(merged_counts.items(), key=lambda pair: pair[1], reverse=True))

    async def _aggregate_meta(self, match_filter: dict) -> dict:
        pipeline = [
            {"$match": match_filter},
            {
                "$group": {
                    "_id": None,
                    "logs": {"$sum": 1},
                    "start_time": {"$min": "$created_at"},
                    "end_time": {"$max": "$created_at"},
                    "students": {"$addToSet": "$student_id"},
                }
            },
        ]
        rows = await db.emotion_logs.aggregate(pipeline).to_list(length=None)
        if not rows:
            return {
                "logs": 0,
                "start_time": None,
                "end_time": None,
                "students": 0,
            }

        row = rows[0]
        unique_students = [value for value in row.get("students", []) if value]
        return {
            "logs": int(row.get("logs", 0)),
            "start_time": _ensure_utc(row.get("start_time")),
            "end_time": _ensure_utc(row.get("end_time")),
            "students": len(unique_students),
        }

    async def _aggregate_timeline(self, match_filter: dict) -> list[dict]:
        pipeline = [
            {"$match": match_filter},
            {
                "$project": {
                    "minute": {
                        "$dateToString": {
                            "format": "%Y-%m-%d %H:%M",
                            "date": {"$toDate": "$created_at"},
                            "timezone": "UTC",
                        }
                    },
                    "emotion": {"$ifNull": ["$emotion", "unknown"]},
                }
            },
            {
                "$group": {
                    "_id": {"minute": "$minute", "emotion": "$emotion"},
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id.minute": 1}},
        ]
        rows = await db.emotion_logs.aggregate(pipeline).to_list(length=None)

        grouped: dict[str, dict] = {}
        for row in rows:
            minute = row.get("_id", {}).get("minute")
            emotion = _normalize_emotion(row.get("_id", {}).get("emotion"))
            count = int(row.get("count", 0))
            if not minute:
                continue

            if minute not in grouped:
                grouped[minute] = {"minute": minute, "total": 0, "emotions": defaultdict(int)}
            grouped[minute]["total"] += count
            grouped[minute]["emotions"][emotion] += count

        timeline = []
        for minute in sorted(grouped.keys()):
            row = grouped[minute]
            timeline.append(
                {
                    "minute": minute,
                    "total": row["total"],
                    "emotions": dict(sorted(row["emotions"].items(), key=lambda pair: pair[1], reverse=True)),
                }
            )
        return timeline

    async def _aggregate_course_session_summaries(self, session_ids: list[str]) -> list[dict]:
        if not session_ids:
            return []

        emotion_pipeline = [
            {"$match": {"session_id": {"$in": session_ids}}},
            {"$group": {"_id": {"session_id": "$session_id", "emotion": "$emotion"}, "count": {"$sum": 1}}},
        ]
        emotion_rows = await db.emotion_logs.aggregate(emotion_pipeline).to_list(length=None)

        meta_pipeline = [
            {"$match": {"session_id": {"$in": session_ids}}},
            {
                "$group": {
                    "_id": "$session_id",
                    "logs": {"$sum": 1},
                    "start_time": {"$min": "$created_at"},
                    "end_time": {"$max": "$created_at"},
                }
            },
        ]
        meta_rows = await db.emotion_logs.aggregate(meta_pipeline).to_list(length=None)

        counts_by_session: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for row in emotion_rows:
            session_id = row.get("_id", {}).get("session_id")
            emotion = _normalize_emotion(row.get("_id", {}).get("emotion"))
            count = int(row.get("count", 0))
            if not session_id:
                continue
            counts_by_session[session_id][emotion] += count

        meta_by_session = {
            row.get("_id"): {
                "logs": int(row.get("logs", 0)),
                "start_time": _ensure_utc(row.get("start_time")),
                "end_time": _ensure_utc(row.get("end_time")),
            }
            for row in meta_rows
            if row.get("_id")
        }

        summaries = []
        for session_id in session_ids:
            counts = dict(counts_by_session.get(session_id, {}))
            meta = meta_by_session.get(session_id, {"logs": 0, "start_time": None, "end_time": None})
            logs = meta["logs"]
            percentages = _distribution_percentages(counts, logs)

            summaries.append(
                {
                    "session_id": session_id,
                    "start_time": meta["start_time"],
                    "end_time": meta["end_time"],
                    "logs": logs,
                    "dominant_emotion": _dominant_emotion(counts),
                    "engagement_score": _engagement_score(percentages),
                }
            )

        return sorted(summaries, key=lambda row: row.get("start_time") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

    async def build_session_report(self, session_id: str) -> dict | None:
        session = await db.sessions.find_one({"_id": ObjectId(session_id)})
        if not session:
            return None

        match_filter = {"session_id": session_id}
        emotion_counts = await self._aggregate_emotion_counts(match_filter)
        timeline_buckets = await self._aggregate_timeline(match_filter)
        meta = await self._aggregate_meta(match_filter)

        start_time = meta["start_time"] or _ensure_utc(session.get("created_at"))
        end_time = meta["end_time"] or _ensure_utc(session.get("ended_at")) or start_time
        if start_time and end_time and end_time < start_time:
            end_time = start_time

        total_logs = meta["logs"]
        emotion_percentages = _distribution_percentages(emotion_counts, total_logs)
        engagement_score = _engagement_score(emotion_percentages)
        dominant_overall = _dominant_emotion(emotion_counts)

        dominant_last_5m = "unknown"
        if end_time:
            five_minutes_ago = end_time - timedelta(minutes=5)
            recent_counts = await self._aggregate_emotion_counts(
                {"session_id": session_id, "created_at": {"$gte": five_minutes_ago, "$lte": end_time}}
            )
            dominant_last_5m = _dominant_emotion(recent_counts)

        suggestions = _build_suggestions(dominant_overall, dominant_last_5m, engagement_score)

        return {
            "session_id": session_id,
            "course_id": session.get("course"),
            "totals": {
                "logs": total_logs,
                "sessions": 1,
                "students": meta["students"],
                "start_time": start_time,
                "end_time": end_time,
                "duration_minutes": _duration_minutes(start_time, end_time),
                "engagement_score": engagement_score,
            },
            "emotion_counts": emotion_counts,
            "emotion_percentages": emotion_percentages,
            "timeline_buckets": timeline_buckets,
            "dominant_emotion_overall": dominant_overall,
            "dominant_emotion_last_5m": dominant_last_5m,
            "suggestions": suggestions,
        }

    async def build_course_report(self, course_id: str) -> dict:
        sessions = await db.sessions.find({"course": course_id}).sort("created_at", 1).to_list(length=None)
        session_ids = [str(row.get("_id")) for row in sessions if row.get("_id")]

        if session_ids:
            base_match_filter = {"$or": [{"session_id": {"$in": session_ids}}, {"course_id": course_id}]}
        else:
            base_match_filter = {"course_id": course_id}

        emotion_counts = await self._aggregate_emotion_counts(base_match_filter)
        timeline_buckets = await self._aggregate_timeline(base_match_filter)
        meta = await self._aggregate_meta(base_match_filter)

        total_logs = meta["logs"]
        emotion_percentages = _distribution_percentages(emotion_counts, total_logs)
        engagement_score = _engagement_score(emotion_percentages)
        dominant_overall = _dominant_emotion(emotion_counts)

        start_time = meta["start_time"]
        if not start_time and sessions:
            session_start_times = [_ensure_utc(row.get("created_at")) for row in sessions]
            session_start_times = [value for value in session_start_times if value]
            if session_start_times:
                start_time = min(session_start_times)

        end_time = meta["end_time"]
        if not end_time and sessions:
            session_end_times = [_ensure_utc(row.get("ended_at") or row.get("created_at")) for row in sessions]
            session_end_times = [value for value in session_end_times if value]
            if session_end_times:
                end_time = max(session_end_times)

        dominant_last_5m = "unknown"
        if end_time:
            five_minutes_ago = end_time - timedelta(minutes=5)
            if "$or" in base_match_filter:
                recent_filter = {
                    "$and": [
                        {"$or": base_match_filter["$or"]},
                        {"created_at": {"$gte": five_minutes_ago, "$lte": end_time}},
                    ]
                }
            else:
                recent_filter = {
                    **base_match_filter,
                    "created_at": {"$gte": five_minutes_ago, "$lte": end_time},
                }
            recent_counts = await self._aggregate_emotion_counts(recent_filter)
            dominant_last_5m = _dominant_emotion(recent_counts)

        suggestions = _build_suggestions(dominant_overall, dominant_last_5m, engagement_score)
        session_summaries = await self._aggregate_course_session_summaries(session_ids)

        return {
            "course_id": course_id,
            "totals": {
                "logs": total_logs,
                "sessions": len(session_ids),
                "students": meta["students"],
                "start_time": start_time,
                "end_time": end_time,
                "duration_minutes": _duration_minutes(start_time, end_time),
                "engagement_score": engagement_score,
            },
            "emotion_counts": emotion_counts,
            "emotion_percentages": emotion_percentages,
            "timeline_buckets": timeline_buckets,
            "dominant_emotion_overall": dominant_overall,
            "dominant_emotion_last_5m": dominant_last_5m,
            "suggestions": suggestions,
            "sessions": session_summaries,
        }


report_service = ReportService()
