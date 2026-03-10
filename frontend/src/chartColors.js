const FALLBACK_CHART_COLORS = [
  "#2563eb",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

const CHART_COLOR_BY_LABEL = {
  active: "#22c55e",
  anger: "#dc2626",
  angry: "#dc2626",
  away: "#f97316",
  boredom: "#f59e0b",
  bored: "#f59e0b",
  calm: "#14b8a6",
  completed: "#22c55e",
  completion: "#22c55e",
  confusion: "#3b82f6",
  confused: "#3b82f6",
  disgust: "#84cc16",
  emotion_total: "#06b6d4",
  engaged: "#10b981",
  excitement: "#8b5cf6",
  excited: "#8b5cf6",
  face: "#2563eb",
  focused: "#10b981",
  frustrated: "#ef4444",
  happiness: "#22c55e",
  happy: "#22c55e",
  idle: "#a855f7",
  interest: "#14b8a6",
  neutral: "#64748b",
  no_face: "#94a3b8",
  pending: "#f59e0b",
  sad: "#ec4899",
  sadness: "#ec4899",
  stress: "#ef4444",
  stressed: "#ef4444",
  surprise: "#8b5cf6",
  surprised: "#8b5cf6",
  text: "#f59e0b",
  total: "#2563eb",
  voice: "#7c3aed",
};

export const CHART_AXIS_COLOR = "#64748b";
export const CHART_GRID_COLOR = "#dbe4f0";

function normalizeChartKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function getChartColor(label, fallbackIndex = 0) {
  const normalized = normalizeChartKey(label);
  return CHART_COLOR_BY_LABEL[normalized] || FALLBACK_CHART_COLORS[fallbackIndex % FALLBACK_CHART_COLORS.length];
}
