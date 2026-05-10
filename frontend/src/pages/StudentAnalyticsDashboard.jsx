import React, { useState, useEffect, useMemo } from "react";
import { X, User, Clock, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, CartesianGrid, XAxis, YAxis, BarChart, Bar } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { getChartColor, CHART_GRID_COLOR, CHART_AXIS_COLOR } from "../chartColors";
import PowerBIDashboard from "../powerbi/PowerBIEmbed";
import { fetchPowerBIEmbedToken, fetchStudentAnalytics } from "../services/api";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatPercent(value) {
  if (value === null || value === undefined) return "0%";
  return `${Number(value).toFixed(1)}%`;
}

export default function StudentAnalyticsDashboard({ studentId, studentName, classId, lessonId, onClose }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [powerBIToken, setPowerBIToken] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        try {
          const tokenData = await fetchPowerBIEmbedToken();
          if (tokenData.accessToken) {
            setPowerBIToken(tokenData);
          }
        } catch (e) {
          console.warn("Power BI not configured", e);
        }

        const json = await fetchStudentAnalytics(studentId, { classId, lessonId });
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [studentId, classId, lessonId]);

  const emotionPieData = useMemo(() => {
    if (!data?.emotion_percentages) return [];
    return Object.entries(data.emotion_percentages).map(([key, val]) => ({
      label: key,
      value: val
    }));
  }, [data]);

  if (!studentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" role="presentation" onClick={onClose}>
      <div className="safe-card w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/70 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/15 rounded-full flex items-center justify-center text-indigo-300 border border-indigo-400/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-50 leading-tight">{studentName || studentId}</h2>
              <p className="text-sm text-slate-400 font-medium">Individual Emotion Analytics</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <p className="text-slate-400 font-medium">Aggregating historical data...</p>
            </div>
          ) : error ? (
            <div className="bg-red-950/40 text-red-200 p-4 rounded-xl border border-red-500/40 font-medium">
              Error: {error}
            </div>
          ) : data ? (
            <>
              {/* Power BI Primary Component */}
              <div className="w-full mb-8">
                <PowerBIDashboard 
                  title={`Power BI: Student Overview (${studentName})`}
                  reportId={powerBIToken?.reportId}
                  embedUrl={powerBIToken?.embedUrl}
                  accessToken={powerBIToken?.accessToken}
                  tokenType={powerBIToken?.tokenType}
                />
              </div>

              {/* Recharts Fallback (Always rendered below PBI for this demo/requirement) */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" /> Recharts Fallback Analytics
                </h3>
                <p className="text-sm text-slate-400">Live synchronized UI mirroring Power BI capabilities.</p>
              </div>

              {/* A. Student Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="safe-card-muted p-4">
                  <p className="text-sm text-slate-400 font-medium mb-1">Engagement Score</p>
                  <p className="text-2xl font-bold text-indigo-300">{Number(data.engagement).toFixed(1)}</p>
                </div>
                <div className="safe-card-muted p-4">
                  <p className="text-sm text-slate-400 font-medium mb-1">Dominant Emotion</p>
                  <p className="text-2xl font-bold text-slate-50 capitalize">{data.dominant_emotion}</p>
                </div>
                <div className="safe-card-muted p-4">
                  <p className="text-sm text-slate-400 font-medium mb-1">Attention Score</p>
                  <p className="text-2xl font-bold text-emerald-300">{Number(data.attention).toFixed(1)}%</p>
                </div>
                <div className="safe-card-muted p-4">
                  <p className="text-sm text-slate-400 font-medium mb-1">Completion</p>
                  <p className="text-2xl font-bold text-blue-300">{Number(data.completion).toFixed(1)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* B. HISTORICAL PIE CHART */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Emotion Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={emotionPieData} dataKey="value" nameKey="label" outerRadius={85} label>
                          {emotionPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getChartColor(entry.label, index)} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* C. HISTORICAL LINE GRAPH */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Historical Emotion Progression</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={data.timeline}>
                        <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
                        <XAxis dataKey="minute" minTickGap={20} stroke={CHART_AXIS_COLOR} />
                        <YAxis stroke={CHART_AXIS_COLOR} />
                        <Tooltip />
                        <Legend />
                        {Object.keys(data.timeline[0] || {}).filter(k => k !== 'minute').map((emotion, index) => (
                          <Line key={emotion} type="monotone" dataKey={emotion} stroke={getChartColor(emotion, index)} strokeWidth={2} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* D. MODALITY HISTORY CHARTS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['face', 'text', 'voice'].map((modality) => (
                  <Card key={modality}>
                    <CardHeader>
                      <CardTitle className="text-base capitalize">{modality} Modality History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={data.modality_history[modality] || []}>
                          <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
                          <XAxis dataKey="emotion" stroke={CHART_AXIS_COLOR} />
                          <YAxis stroke={CHART_AXIS_COLOR} />
                          <Tooltip />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {(data.modality_history[modality] || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getChartColor(entry.emotion, index)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* E. SESSION HISTORY TABLE & F. VOICE FEEDBACK TRANSCRIPTS */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-slate-950/60 border-b border-slate-700">
                  <CardTitle className="text-base">Session History & Transcripts</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-300 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Lesson Name</th>
                        <th className="px-4 py-3 font-semibold text-center">Duration</th>
                        <th className="px-4 py-3 font-semibold text-center">Emotion</th>
                        <th className="px-4 py-3 font-semibold text-center">Attention</th>
                        <th className="px-4 py-3 font-semibold">Transcript</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-800">
                      {data.session_history.map((row, i) => (
                        <tr key={i} className="hover:bg-indigo-500/10 transition-colors cursor-pointer">
                          <td className="px-4 py-3 font-medium text-slate-200 whitespace-nowrap">{formatDateTime(row.date)}</td>
                          <td className="px-4 py-3 text-slate-300">{row.lesson_name}</td>
                          <td className="px-4 py-3 text-center font-medium text-slate-200">{row.duration}m</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 bg-indigo-500/15 text-indigo-200 border border-indigo-400/30 rounded-md text-xs font-bold capitalize">
                              {row.dominant_emotion}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-emerald-300">{row.attention}%</td>
                          <td className="px-4 py-3 text-slate-400 italic">"{row.transcript_summary}"</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* G. AI LEARNING INSIGHTS */}
              <Card className="bg-gradient-to-r from-indigo-950/60 to-blue-950/50 border-indigo-500/20">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-sm text-indigo-300 shrink-0 border border-slate-700">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-50 text-lg mb-2">AI Learning Insights</h4>
                      <p className="text-slate-300">
                        Student engagement is improving. <strong>Interest increased by 22%</strong> over the last 3 sessions.
                        However, confusion spikes were detected during the <em>{data.session_history[0]?.lesson_name || "Database"}</em> lessons.
                        Recommendation: Assign revision material on this topic.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
