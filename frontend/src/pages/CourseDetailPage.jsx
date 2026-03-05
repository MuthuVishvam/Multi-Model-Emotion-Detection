import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { apiRequest } from "../services/api";
import {
  buildCourseSummaryMeta,
  getAllCourseLessons,
  getCourseById,
} from "../courseCatalog";

const ENROLLED_STORAGE_KEY = "meld_enrolled_courses";

function readEnrolledCourses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ENROLLED_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEnrolledCourses(courseIds) {
  localStorage.setItem(ENROLLED_STORAGE_KEY, JSON.stringify(courseIds));
}

export default function CourseDetailPage({ user }) {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [openModules, setOpenModules] = useState({});
  const [enrolled, setEnrolled] = useState(() => readEnrolledCourses().includes(courseId));

  useEffect(() => {
    let isMounted = true;

    async function loadLessons() {
      const token = localStorage.getItem("token") || "";
      try {
        const data = await apiRequest("/lessons", "GET", null, token);
        if (!isMounted) {
          return;
        }
        setLessons(Array.isArray(data) ? data : []);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error.message);
      }
    }

    loadLessons();
    return () => {
      isMounted = false;
    };
  }, []);

  const course = useMemo(() => getCourseById(courseId, lessons), [courseId, lessons]);
  const allLessons = useMemo(() => getAllCourseLessons(course), [course]);
  const firstLesson = allLessons[0];
  const meta = useMemo(() => buildCourseSummaryMeta(course), [course]);

  useEffect(() => {
    if (!course?.modules?.length) {
      return;
    }
    setOpenModules((current) => {
      if (Object.keys(current).length > 0) {
        return current;
      }
      return course.modules.reduce((acc, module, index) => {
        acc[module.id] = index === 0;
        return acc;
      }, {});
    });
  }, [course]);

  useEffect(() => {
    setEnrolled(readEnrolledCourses().includes(courseId));
  }, [courseId]);

  function toggleModule(moduleId) {
    setOpenModules((current) => ({ ...current, [moduleId]: !current[moduleId] }));
  }

  function handleEnroll() {
    const current = readEnrolledCourses();
    if (current.includes(courseId)) {
      setEnrolled(true);
      return;
    }
    const next = [...current, courseId];
    writeEnrolledCourses(next);
    setEnrolled(true);
  }

  function handleContinue() {
    if (!firstLesson) {
      return;
    }
    navigate(`/student/courses/${courseId}/lessons/${firstLesson.lesson_id}`);
  }

  if (!course) {
    return (
      <div className="learning-page">
        <div className="card empty-state">
          <h2>Course not found</h2>
          <p>Return to the catalog and select a different course.</p>
          <Link className="button-link" to="/student">Back to catalog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="learning-page">
      <section className={`course-detail-hero card ${course.bannerTheme || ""}`}>
        <div className="course-detail-hero__content">
          <p className="eyebrow">Course overview</p>
          <h2>{course.title}</h2>
          <p>{course.subtitle}</p>

          <div className="hero-meta-row">
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          <p className="hero-instructor">
            Created by <strong>{course.instructor}</strong> for <strong>{user.email}</strong>
          </p>

          <div className="hero-action-row">
            <button type="button" onClick={handleEnroll}>
              {enrolled ? "Enrolled" : "Enroll"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleContinue}
              disabled={!firstLesson}
            >
              Continue to lessons
            </button>
            <Link className="button-link button-link-secondary" to="/student">
              Back to catalog
            </Link>
          </div>
        </div>

        <aside className="course-detail-hero__panel">
          <div className="hero-panel-card">
            <h3>What you will learn</h3>
            <ul className="simple-list">
              {(course.skills || []).map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </div>
          <div className="hero-panel-card">
            <h3>Course tags</h3>
            <div className="course-card__tags">
              {(course.tags || []).map((tag) => (
                <span key={tag} className="tag-chip">{tag}</span>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {errorMessage && <div className="card inline-message">{errorMessage}</div>}

      <section className="detail-grid">
        <div className="card">
          <div className="section-header-row">
            <h3>Syllabus</h3>
            <span>{allLessons.length} lessons total</span>
          </div>

          <div className="accordion-list">
            {(course.modules || []).map((module) => {
              const isOpen = Boolean(openModules[module.id]);
              return (
                <div key={module.id} className="accordion-item">
                  <button
                    type="button"
                    className={isOpen ? "accordion-trigger active" : "accordion-trigger"}
                    onClick={() => toggleModule(module.id)}
                  >
                    <span>{module.title}</span>
                    <span>{module.items.length} lessons</span>
                  </button>
                  {isOpen && (
                    <div className="accordion-content">
                      {module.items.map((lesson) => (
                        <div key={lesson.lesson_id} className="syllabus-row">
                          <div>
                            <p className="syllabus-row__title">{lesson.title}</p>
                            <p className="syllabus-row__desc">{lesson.description}</p>
                          </div>
                          <div className="syllabus-row__actions">
                            <span>{lesson.duration || "10 min"}</span>
                            <Link className="button-link button-link-secondary" to={`/student/courses/${course.id}/lessons/${lesson.lesson_id}`}>
                              Open
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3>Course description</h3>
          <p>
            This course keeps your existing MELD lesson/session APIs and presents them in a modern, guided learning
            experience with a catalog, syllabus, and focused lesson player.
          </p>
          <p>
            Use the lesson player to launch a session, run background facial engagement capture, and log text-based
            emotion checks while watching or reviewing lesson content.
          </p>
          <div className="callout-box">
            <strong>Tip:</strong> Teacher-posted lessons appear in the <em>Live Classroom Studio</em> course and are
            available immediately to students.
          </div>
        </div>
      </section>
    </div>
  );
}

