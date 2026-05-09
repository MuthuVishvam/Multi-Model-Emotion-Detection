const DEFAULT_EMOTION_OPTIONS = [
  "interest",
  "boredom",
  "confusion",
  "stress",
  "neutral",
  "joy",
  "sadness",
  "anger",
  "surprise",
  "fear",
  "disgust",
  "no_face_detected",
];

function normalizeEmotionLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function formatEmotionLabel(value) {
  const normalized = normalizeEmotionLabel(value);
  if (!normalized) {
    return "All emotions";
  }
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildEmotionFilterOptions(sourceMaps = [], selectedEmotion = "") {
  const labels = new Set(DEFAULT_EMOTION_OPTIONS);

  sourceMaps.forEach((source) => {
    Object.keys(source || {}).forEach((label) => {
      const normalized = normalizeEmotionLabel(label);
      if (normalized) {
        labels.add(normalized);
      }
    });
  });

  const normalizedSelected = normalizeEmotionLabel(selectedEmotion);
  if (normalizedSelected) {
    labels.add(normalizedSelected);
  }

  return Array.from(labels);
}

export default function EmotionFilterBar({
  selectedEmotion = "",
  onSelectEmotion,
  options = DEFAULT_EMOTION_OPTIONS,
  title = "Emotion Filter",
  description = "Select one emotion to refresh all multimodal dashboard panels with the same focus.",
}) {
  const normalizedSelected = normalizeEmotionLabel(selectedEmotion);

  return (
    <section className="dashboard-emotion-filter">
      <div className="dashboard-emotion-filter__header">
        <div>
          <h4>{title}</h4>
          <p className="small-note">{description}</p>
        </div>
        <div className="dashboard-emotion-filter__summary">
          <span>Active</span>
          <strong>{formatEmotionLabel(normalizedSelected)}</strong>
        </div>
      </div>

      <div className="filter-chip-row">
        <button
          type="button"
          className={normalizedSelected ? "filter-chip" : "filter-chip active"}
          onClick={() => onSelectEmotion("")}
        >
          All emotions
        </button>

        {options.map((emotion) => {
          const normalized = normalizeEmotionLabel(emotion);
          return (
            <button
              key={normalized}
              type="button"
              className={normalizedSelected === normalized ? "filter-chip active" : "filter-chip"}
              onClick={() => onSelectEmotion(normalized)}
            >
              {formatEmotionLabel(normalized)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
