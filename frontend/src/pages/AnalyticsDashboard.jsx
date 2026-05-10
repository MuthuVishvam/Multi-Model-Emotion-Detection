import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";

import {
  buildEmotionWorkspaceExportUrl,
  fetchClassLessons,
  fetchEmotionWorkspaceAnalytics,
  fetchMyClasses,
} from "../services/api";
import { getStoredToken } from "../api/tokenStorage";
import CompareMode from "../components/analytics/CompareMode";
import DashboardLayout from "../components/analytics/DashboardLayout";
import EmotionCharts from "../components/analytics/EmotionCharts";
import FilterBar from "../components/analytics/FilterBar";
import KPISection from "../components/analytics/KPISection";

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

export default function AnalyticsDashboard({ mode = "teacher" }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [classes, setClasses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
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

  const apiFilters = useMemo(() => buildApiFilters(filters), [filters]);

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
      const analyticsData = await fetchEmotionWorkspaceAnalytics(apiFilters);
      setAnalytics(analyticsData);
    } catch (error) {
      setMessage(error?.message || "Unable to load analytics workspace.");
      setAnalytics(null);
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

  return (
    <DashboardLayout role={mode}>
      <div className="mx-auto w-full max-w-none space-y-4 2xl:space-y-5">
        <motion.section
          className="rounded-[8px] border border-blue-400/10 bg-slate-950/75 p-4 shadow-xl shadow-slate-950/25 backdrop-blur-xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan-200">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                Analytics Workspace
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-50 md:text-3xl">MELD Analytics Dashboard</h1>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-400">
                Lesson engagement, emotion distribution, confidence thresholds, and cohort comparison in one focused analytics view.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-700 bg-slate-900/90 px-3 text-sm font-bold text-slate-100 shadow-lg shadow-slate-950/20 hover:border-cyan-400/50 hover:bg-slate-800"
              onClick={loadWorkspace}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
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
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-28 animate-pulse rounded-[8px] bg-slate-900/80" />)}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[1, 2, 3, 4].map((item) => <div key={item} className="h-[360px] animate-pulse rounded-[8px] bg-slate-900/80" />)}
            </div>
          </div>
        ) : (
          <>
            <KPISection kpis={analytics?.kpis || {}} trend={analytics?.engagement_trend || []} />
            <CompareMode enabled={filters.compareMode} data={analytics} />
            <EmotionCharts data={analytics || {}} chartType={filters.chartType} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
