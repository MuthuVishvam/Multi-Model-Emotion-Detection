import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getChartColor } from "../../chartColors";
import HeatmapChart from "./HeatmapChart";

const tooltipStyle = { backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#fff" };

function toTimelineRows(rows = []) {
  return rows.map((item) => ({ minute: item.minute, total: item.total, engagement: item.engagement, ...(item.emotions || {}) }));
}

export default function EmotionCharts({ data, chartType }) {
  const timeline = toTimelineRows(data?.engagement_trend || []);
  const distribution = data?.emotion_distribution || [];
  const emotionKeys = distribution.map((item) => item.emotion).slice(0, 5);

  return (
    <section id="emotion-trends" className="grid gap-5 2xl:grid-cols-2">
      <article className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100">Engagement and Emotion Timeline</h2>
          <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-bold capitalize text-cyan-200">{chartType}</span>
        </div>
        <div className="h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "area" ? (
              <AreaChart data={timeline}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="minute" minTickGap={24} stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {emotionKeys.map((emotion, index) => (
                  <Area key={emotion} type="monotone" dataKey={emotion} stackId="1" fill={getChartColor(emotion, index)} stroke={getChartColor(emotion, index)} fillOpacity={0.45} />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={timeline}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="minute" minTickGap={24} stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="engagement" stroke="#22d3ee" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="total" stroke="#a78bfa" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
        <h2 className="mb-4 text-base font-bold text-slate-100">Emotion Distribution</h2>
        <div className="h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={distribution} dataKey="count" nameKey="emotion" innerRadius={70} outerRadius={115} paddingAngle={3}>
                {distribution.map((item, index) => <Cell key={item.emotion} fill={getChartColor(item.emotion, index)} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
        <h2 className="mb-4 text-base font-bold text-slate-100">Student Attention Heatmap</h2>
        <HeatmapChart rows={data?.heatmap || []} />
      </article>

      <article className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
        <h2 className="mb-4 text-base font-bold text-slate-100">Multi-Metric Comparison</h2>
        <div className="h-[310px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data?.radar || []}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
              <Radar dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.28} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20 2xl:col-span-2">
        <h2 className="mb-4 text-base font-bold text-slate-100">Class Performance Comparison</h2>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.class_comparison || []}>
              <CartesianGrid stroke="#1e293b" />
              <XAxis dataKey="class_id" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="engagement" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              <Bar dataKey="students" fill="#a78bfa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
