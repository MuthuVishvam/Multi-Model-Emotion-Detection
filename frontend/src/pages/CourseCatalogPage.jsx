import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiRequest } from "../services/api";
import {
  buildCourseCatalog,
  buildCourseSummaryMeta,
  getAllCourseLessons,
  getCourseCategories,
} from "../courseCatalog";

function CourseCard({ course }) {
  const firstLesson = getAllCourseLessons(course)[0];
  const meta = buildCourseSummaryMeta(course);

  return (
    <article className={`course-card ${course.bannerTheme || ""}`}>
      <div className="course-card__banner">
        <span className="badge">{course.category}</span>
        <span className="badge badge-soft">{course.isLive ? "Live" : course.level}</span>
      </div>

      <div className="course-card__body">
        <h3>{course.title}</h3>
        <p>{course.subtitle}</p>

        <div className="course-card__meta">
          {meta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div className="course-card__tags">
          {(course.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
        </div>
      </div>

      <div className="course-card__actions">
        <Link className="button-link" to={`/student/courses/${course.id}`}>
          View course
        </Link>
        {firstLesson && (
          <Link className="button-link button-link-secondary" to={`/student/courses/${course.id}/lessons/${firstLesson.lesson_id}`}>
            Start lesson
          </Link>
        )}
      </div>
    </article>
  );
}

export default function CourseCatalogPage({ user }) {
  const [lessons, setLessons] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

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

  const courses = useMemo(() => buildCourseCatalog(lessons), [lessons]);
  const categories = useMemo(() => getCourseCategories(), []);

  const filteredCourses = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesCategory = activeCategory === "All" || course.category === activeCategory;
      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        course.title,
        course.subtitle,
        course.instructor,
        ...(course.tags || []),
        ...(course.skills || []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [courses, activeCategory, searchValue]);

  return (
    <div className="learning-page">
      <section className="catalog-hero card">
        <div>
          <p className="eyebrow">Browse Courses</p>
          <h2>Learn with a structured, Coursera-style flow</h2>
          <p className="catalog-hero__subtitle">
            Search courses, open a syllabus, then launch the lesson player with notes, discussion, and resources.
          </p>
        </div>
        <div className="catalog-hero__summary">
          <div className="metric-pill">
            <span>Signed in</span>
            <strong>{user.email}</strong>
          </div>
          <div className="metric-pill">
            <span>Courses</span>
            <strong>{courses.length}</strong>
          </div>
          <div className="metric-pill">
            <span>Uploaded lessons</span>
            <strong>{lessons.length}</strong>
          </div>
        </div>
      </section>

      <section className="catalog-toolbar card">
        <div className="catalog-toolbar__search">
          <label htmlFor="course-search">Search courses</label>
          <input
            id="course-search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by title, tag, skill..."
          />
        </div>

        <div className="catalog-toolbar__filters">
          <span>Category</span>
          <div className="filter-chip-row">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={activeCategory === category ? "filter-chip active" : "filter-chip"}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {errorMessage && <div className="card inline-message">{errorMessage}</div>}

      <section className="course-grid">
        {filteredCourses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
        {filteredCourses.length === 0 && (
          <div className="card empty-state">
            <h3>No matching courses</h3>
            <p>Try a different category or search term.</p>
          </div>
        )}
      </section>
    </div>
  );
}

