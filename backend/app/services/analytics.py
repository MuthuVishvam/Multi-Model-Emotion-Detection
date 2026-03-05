import math
from collections import Counter, defaultdict
from datetime import datetime


def compute_distribution(logs: list[dict]) -> Counter:
    return Counter(log.get("emotion", "unknown") for log in logs)


def compute_modality_counts(logs: list[dict]) -> Counter:
    return Counter(log.get("modality", "unknown") for log in logs)


def compute_modality_emotion_counts(logs: list[dict]) -> dict[str, dict[str, int]]:
    grouped: dict[str, Counter] = defaultdict(Counter)
    for log in logs:
        modality = log.get("modality", "unknown")
        emotion = log.get("emotion", "unknown")
        grouped[modality][emotion] += 1
    return {modality: dict(counter) for modality, counter in grouped.items()}


def compute_percentages(distribution: Counter, total: int) -> dict[str, float]:
    if total == 0:
        return {}
    return {emotion: round((count / total) * 100.0, 2) for emotion, count in distribution.items()}


def compute_engagement_score(distribution: Counter, total: int) -> float:
    if total == 0:
        return 0.0
    weighted_positive = distribution.get("joy", 0) + distribution.get("surprise", 0) + 0.5 * distribution.get("neutral", 0)
    return round((weighted_positive / total) * 100.0, 2)


def compute_confusion_index(distribution: Counter, total: int) -> float:
    if total == 0 or len(distribution) <= 1:
        return 0.0
    entropy = 0.0
    for count in distribution.values():
        p = count / total
        entropy -= p * math.log(p)
    max_entropy = math.log(len(distribution))
    return round(entropy / max_entropy, 3) if max_entropy else 0.0


def bucket_by_minute(logs: list[dict]) -> dict[str, int]:
    buckets = defaultdict(int)
    for log in logs:
        timestamp = log.get("created_at")
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp)
            except ValueError:
                continue
        if not isinstance(timestamp, datetime):
            continue
        key = timestamp.strftime("%Y-%m-%d %H:%M")
        buckets[key] += 1
    return dict(sorted(buckets.items(), key=lambda item: item[0]))


def build_student_stats(logs: list[dict]) -> list[dict]:
    grouped = defaultdict(list)
    for log in logs:
        grouped[log.get("student_id", "unknown")].append(log)

    rows = []
    for student_id, student_logs in grouped.items():
        distribution = compute_distribution(student_logs)
        total = len(student_logs)
        rows.append(
            {
                "student_id": student_id,
                "top_emotion": distribution.most_common(1)[0][0] if distribution else "unknown",
                "engagement_score": compute_engagement_score(distribution, total),
                "sample_count": total,
                "modality_counts": dict(compute_modality_counts(student_logs)),
            }
        )
    return sorted(rows, key=lambda row: row["student_id"])
