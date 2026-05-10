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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getChartColor } from "../../chartColors";
import HeatmapChart from "./HeatmapChart";

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "8px",
  color: "#fff",
};

const chartName = {
  area: "Area Chart",
  bar: "Bar Chart",
  donut: "Donut Chart",
  heatmap: "Heatmap",
  line: "Line Chart",
};

function toTimelineRows(rows = []) {
  return rows.map((item) => ({ minute: item.minute, total: item.total, engagement: item.engagement, ...(item.emotions || {}) }));
}

function EmptyState({ label = "No chart data available yet." }) {
  return (
    <div className="flex h-full items-center justify-center rounded-[8px] border border-dashed border-slate-700/80 bg-slate-950/30 text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}

function ChartCard({ title, meta, children }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-[8px] border border-slate-800/90 bg-slate-900/75 p-4 shadow-xl shadow-slate-950/20">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-sm font-black text-slate-100 md:text-base">{title}</h2>
        {meta && (
          <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-cyan-200">
            {meta}
          </span>
        )}
      </div>
      <div className="h-[320px] min-w-0 overflow-hidden md:h-[340px]">{children}</div>
    </article>
  );
}

function TimelineLine({ data }) {
  if (!data.length) return <EmptyState label="No engagement timeline yet." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="minute" minTickGap={24} stroke="#64748b" tick={{ fontSize: 11 }} />
        <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={36} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="engagement" stroke="#22d3ee" strokeWidth={3} dot={false} />
        <Line type="monotone" dataKey="total" stroke="#818cf8" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TimelineArea({ data, emotionKeys }) {
  if (!data.length) return <EmptyState label="No emotion area data yet." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="minute" minTickGap={24} stroke="#64748b" tick={{ fontSize: 11 }} />
        <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={36} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {emotionKeys.length ? (
          emotionKeys.map((emotion, index) => (
            <Area
              key={emotion}
              type="monotone"
              dataKey={emotion}
              stackId="1"
              fill={getChartColor(emotion, index)}
              stroke={getChartColor(emotion, index)}
              fillOpacity={0.36}
            />
          ))
        ) : (
          <Area type="monotone" dataKey="engagement" stroke="#22d3ee" fill="#0891b2" fillOpacity={0.3} strokeWidth={3} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TimelineBar({ data }) {
  if (!data.length) return <EmptyState label="No timeline bars yet." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="minute" minTickGap={24} stroke="#64748b" tick={{ fontSize: 11 }} />
        <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={36} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="engagement" fill="#22d3ee" radius={[6, 6, 0, 0]} />
        <Bar dataKey="total" fill="#818cf8" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ data }) {
  if (!data.length) return <EmptyState label="No emotion distribution yet." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Pie data={data} dataKey="count" nameKey="emotion" innerRadius="58%" outerRadius="78%" paddingAngle={3}>
          {data.map((item, index) => <Cell key={item.emotion} fill={getChartColor(item.emotion, index)} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function HeatmapPanel({ rows }) {
  if (!rows.length) return <EmptyState label="No student heatmap yet." />;

  return (
    <div className="h-full overflow-auto pr-1">
      <HeatmapChart rows={rows} />
    </div>
  );
}

function PrimaryChart({ type, timeline, distribution, heatmap, emotionKeys }) {
  if (type === "area") return <TimelineArea data={timeline} emotionKeys={emotionKeys} />;
  if (type === "bar") return <TimelineBar data={timeline} />;
  if (type === "donut") return <DonutChart data={distribution} />;
  if (type === "heatmap") return <HeatmapPanel rows={heatmap} />;
  return <TimelineLine data={timeline} />;
}

export default function EmotionCharts({ data, chartType = "line" }) {
  const timeline = toTimelineRows(data?.engagement_trend || []);
  const distribution = data?.emotion_distribution || [];
  const emotionKeys = distribution.map((item) => item.emotion).slice(0, 5);
  const selectedType = chartName[chartType] ? chartType : "line";

  return (
    <section id="emotion-trends" className="grid min-w-0 gap-4 lg:grid-cols-2">
      <ChartCard title="Selected Analytics View" meta={chartName[selectedType]}>
        <PrimaryChart
          type={selectedType}
          timeline={timeline}
          distribution={distribution}
          heatmap={data?.heatmap || []}
          emotionKeys={emotionKeys}
        />
      </ChartCard>

      <ChartCard title="Emotion Distribution" meta="Donut">
        <DonutChart data={distribution} />
      </ChartCard>

      <ChartCard title="Student Attention Heatmap" meta="Heatmap">
        <HeatmapPanel rows={data?.heatmap || []} />
      </ChartCard>

      <ChartCard title="Class Performance Comparison" meta="Bar">
        {(data?.class_comparison || []).length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.class_comparison || []} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="class_id" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={36} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="engagement" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              <Bar dataKey="students" fill="#818cf8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState label="No class comparison data yet." />
        )}
      </ChartCard>
    </section>
  );
}
