import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Filter, BookOpen, PlayCircle, Clock, TrendingUp } from "lucide-react";

import { apiRequest } from "../services/api";
import {
  buildCourseCatalog,
  buildCourseSummaryMeta,
  getAllCourseLessons,
  getCourseCategories,
} from "../courseCatalog";
import { Card, CardContent } from "../components/ui/Card";

function CourseCard({ course, index }) {
  const firstLesson = getAllCourseLessons(course)[0];
  const meta = buildCourseSummaryMeta(course);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group safe-card overflow-hidden transition-all duration-300 flex flex-col h-full"
    >
      <div className="h-40 bg-gradient-to-br from-slate-800 to-brand-950 relative overflow-hidden border-b border-slate-700/70">
        <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:scale-110 group-hover:opacity-40 transition-all duration-500">
          <BookOpen className="w-16 h-16 text-blue-600" />
        </div>
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="px-2.5 py-1 bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-slate-200 tracking-wider uppercase rounded-lg shadow-sm border border-slate-700">
            {course.category}
          </span>
          <span className={`px-2.5 py-1 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase rounded-lg shadow-sm ${course.isLive ? "bg-red-500/90 text-white" : "bg-blue-600/90 text-white"}`}>
            {course.isLive ? "LIVE" : course.level}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-slate-50 leading-tight mb-2 group-hover:text-brand-300 transition-colors line-clamp-2">
          {course.title}
        </h3>
        <p className="text-sm text-slate-400 mb-4 line-clamp-2 flex-1">
          {course.subtitle}
        </p>

        <div className="flex flex-wrap gap-2 mb-5">
          {(course.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-slate-700">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800">
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
            {meta.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i === 0 ? <Clock className="w-3.5 h-3.5 text-slate-400" /> : <PlayCircle className="w-3.5 h-3.5 text-slate-400" />}
                {item}
              </span>
            ))}
          </div>
          
          <Link 
            to={`/student/courses/${course.id}${firstLesson ? `/lessons/${firstLesson.lesson_id}` : ''}`}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-500/15 text-brand-300 group-hover:bg-brand-600 group-hover:text-white transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

export default function CourseCatalogPage({ user }) {
  const [lessons, setLessons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    let isMounted = true;

    async function loadLessons() {
      const token = localStorage.getItem("token") || "";
      setIsLoading(true);
      try {
        const data = await apiRequest("/lessons", "GET", null, token);
        if (!isMounted) return;
        setLessons(Array.isArray(data) ? data : []);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadLessons();
    return () => { isMounted = false; };
  }, []);

  const courses = useMemo(() => buildCourseCatalog(lessons), [lessons]);
  const categories = useMemo(() => getCourseCategories(), []);

  const filteredCourses = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesCategory = activeCategory === "All" || course.category === activeCategory;
      if (!matchesCategory) return false;
      if (!query) return true;

      const haystack = [
        course.title,
        course.subtitle,
        course.instructor,
        ...(course.tags || []),
        ...(course.skills || []),
      ].join(" ").toLowerCase();

      return haystack.includes(query);
    });
  }, [courses, activeCategory, searchValue]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[32px] bg-[#0A192F] text-white p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold tracking-wider mb-6 border border-white/10">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            STUDENT DASHBOARD
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-5 leading-[1.1] tracking-tight">
            Explore curated learning paths and start your next lesson.
          </h1>
          <p className="text-slate-300 text-lg mb-8 max-w-xl leading-relaxed">
            Browse courses, open lesson modules, and track your learning flow with our AI-powered emotion-aware experience.
          </p>
          
          <div className="flex flex-wrap gap-4">
            <div className="px-6 py-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex flex-col">
              <span className="text-3xl font-extrabold text-white">{courses.length}</span>
              <span className="text-sm font-semibold text-slate-400 tracking-wide uppercase mt-1">Courses</span>
            </div>
            <div className="px-6 py-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex flex-col">
              <span className="text-3xl font-extrabold text-white">{lessons.length}</span>
              <span className="text-sm font-semibold text-slate-400 tracking-wide uppercase mt-1">Lessons</span>
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <section className="safe-card p-4 sm:p-6 flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
        <div className="relative w-full lg:w-[400px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search by title, tag, skill..."
            className="safe-input pl-12 py-3.5"
          />
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          <Filter className="w-5 h-5 text-slate-400 shrink-0 hidden sm:block mr-2" />
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                activeCategory === category
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 border border-slate-700"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* Course Grid */}
      {errorMessage && (
        <div className="p-4 bg-red-950/40 border border-red-500/40 text-red-200 rounded-xl text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-[380px] safe-card animate-pulse flex flex-col overflow-hidden">
               <div className="h-40 bg-slate-800 rounded-t-2xl" />
               <div className="p-5 space-y-3">
                  <div className="h-6 bg-slate-800 rounded-md w-3/4" />
                  <div className="h-4 bg-slate-800 rounded-md w-full" />
                  <div className="h-4 bg-slate-800 rounded-md w-5/6" />
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCourses.map((course, idx) => (
            <CourseCard key={course.id} course={course} index={idx} />
          ))}
          {filteredCourses.length === 0 && (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-center safe-card">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-5">
                <Search className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-50">No courses found</h3>
              <p className="text-slate-400 mt-2 max-w-sm">
                We couldn't find any courses matching your current search or category filter. Try adjusting them.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
