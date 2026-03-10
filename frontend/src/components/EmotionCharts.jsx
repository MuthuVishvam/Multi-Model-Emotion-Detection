import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { getChartColor } from "../chartColors";

export default function EmotionCharts({ data = [] }) {
  const safeData = Array.isArray(data) ? data : [];
  return (
    <div className="chart-card">
      <h3>Emotion Charts</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={safeData} dataKey="value" nameKey="label" outerRadius={75} label>
            {safeData.map((entry, index) => (
              <Cell key={`${entry.label || "emotion"}-${index}`} fill={getChartColor(entry.label, index)} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
