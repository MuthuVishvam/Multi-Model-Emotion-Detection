import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Loader2 } from "lucide-react";

import {
  buildEmotionWorkspaceExportUrl,
  fetchClassLessons,
  fetchEmotionWorkspaceAnalytics,
  fetchEmotionWorkspaceLive,
  fetchEmotionWorkspaceReport,
  fetchMyClasses,
} from "../services/api";
import { getStoredToken } from "../api/tokenStorage";
import AIInsightPanel from "../components/analytics/AIInsightPanel";
import CompareMode from "../components/analytics/CompareMode";
import DashboardLayout from "../components/analytics/DashboardLayout";
import EmotionCharts from "../components/analytics/EmotionCharts";
import ExportControls from "../components/analytics/ExportControls";
import FilterBar from "../components/analytics/FilterBar";
import KPISection from "../components/analytics/KPISection";
import LiveMonitoring from "../components/analytics/LiveMonitoring";
import ReportGenerator from "../components/analytics/ReportGenerator";

function toIsoStart(value) {
  return value ? `${value}T00:00:00Z` : "";
}

function toIsoEnd(value) {
  return value ? `${value}T23:59:59Z` : "";
}

function buildApiFilters(filters, reportType = "") {
  return {
    classId: filters.classId,
    lessonId: filters.lessonId,
    studentId: filters.studentId,
    startAt: toIsoStart(filters.startDate),
    endAt: toIsoEnd(filters.endDate),
    emotions: filters.emotions,
    confidenceThreshold: filters.confidenceThreshold,
    reportType,
  };
}

const DEFAULT_FILTERS = {
  startDate: "",
  endDate: "",
  classId: "",
  lessonId: "",
  studentId: "",
  emotions: [],
  confidenceThreshold: 0,
  compareMode: false,
  chartType: "line",
};

export default function AnalyticsDashboard({ user, mode = "teacher" }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [classes, setClasses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [report, setReport] = useState(null);
  const [live, setLive] = useState(null);
  const [reportType, setReportType] = useState("teacher");
  const [isLoading, setIsLoading] = useState(true);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [message, setMessage] = useState("");

  const students = useMemo(() => {
    const map = new Map();
    for (const row of analytics?.heatmap || []) {
      map.set(row.student_id, { student_id: row.student_id, student_name: row.student_id });
    }
    for (const row of analytics?.live_stream || []) {
      if (row.student_id) map.set(row.student_id, { student_id: row.student_id, student_name: row.student_id });
    }
    return [...map.values()];
  }, [analytics]);

  const apiFilters = useMemo(() => buildApiFilters(filters, reportType), [filters, reportType]);

  const updateFilters = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  async function loadClasses() {
    try {
      const rows = await fetchMyClasses();
      const safeRows = Array.isArray(rows) ? rows : [];
      setClasses(safeRows);
      if (!filters.classId && safeRows[0]?.class_id) {
        setFilters((current) => ({ ...current, classId: safeRows[0].class_id }));
      }
    } catch {
      setClasses([]);
    }
  }

  async function loadLessons(classId) {
    if (!classId) {
      setLessons([]);
      return;
    }
    try {
      const rows = await fetchClassLessons(classId);
      setLessons(Array.isArray(rows) ? rows : []);
    } catch {
      setLessons([]);
    }
  }

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const [analyticsData, reportData, liveData] = await Promise.all([
        fetchEmotionWorkspaceAnalytics(apiFilters),
        fetchEmotionWorkspaceReport(apiFilters),
        fetchEmotionWorkspaceLive(apiFilters),
      ]);
      setAnalytics(analyticsData);
      setReport(reportData);
      setLive(liveData);
    } catch (error) {
      setMessage(error?.message || "Unable to load analytics workspace.");
      setAnalytics(null);
      setReport(null);
      setLive(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiFilters]);

  useEffect(() => {
    void loadClasses();
  }, []);

  useEffect(() => {
    void loadLessons(filters.classId);
  }, [filters.classId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchEmotionWorkspaceLive(apiFilters).then(setLive).catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [apiFilters]);

  async function refreshReport(nextType) {
    setReportType(nextType);
    setIsReportLoading(true);
    try {
      setReport(await fetchEmotionWorkspaceReport(buildApiFilters(filters, nextType)));
    } finally {
      setIsReportLoading(false);
    }
  }

  async function handleExport(format) {
    const token = getStoredToken();
    const url = buildEmotionWorkspaceExportUrl({ ...apiFilters, format });
    const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) {
      setMessage("Export failed.");
      return;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `meld-analytics.${format === "pdf" ? "pdf" : "csv"}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  const insightPanel = <AIInsightPanel report={report} loading={isReportLoading || isLoading} />;

  return (
    <DashboardLayout role={mode} insights={insightPanel}>
      <div className="space-y-5">
        <motion.section
          className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-slate-950/30"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-200">
                <Brain className="h-4 w-4" aria-hidden="true" />
                AI Learning Intelligence Platform
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-50 md:text-5xl">Educational Intelligence Workspace</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                Monitor engagement, attention, confusion spikes, lesson effectiveness, and student learning signals in one analytics-first dashboard.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-100 hover:border-cyan-400/50"
              onClick={loadWorkspace}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Refresh
            </button>
          </div>
        </motion.section>

        <FilterBar
          filters={filters}
          classes={classes}
          lessons={lessons}
          students={students}
          onChange={updateFilters}
          onExport={handleExport}
        />

        {message && <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{message}</div>}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl bg-slate-900" />)}
          </div>
        ) : (
          <>
            <KPISection kpis={analytics?.kpis || {}} trend={analytics?.engagement_trend || []} />
            <CompareMode enabled={filters.compareMode} data={analytics} />
            <EmotionCharts data={analytics || {}} chartType={filters.chartType} />
            <LiveMonitoring live={live} />
            <ReportGenerator report={report} reportType={reportType} onReportTypeChange={refreshReport} />
            <ExportControls onExport={handleExport} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
