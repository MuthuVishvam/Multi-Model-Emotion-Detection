const COURSE_TEMPLATES = [
  {
    id: "emotion-ai-foundations",
    title: "Emotion-Aware Learning Foundations",
    subtitle: "Build interactive courses that adapt to learner sentiment and focus.",
    category: "Data & AI",
    level: "Intermediate",
    duration: "4 weeks",
    rating: 4.8,
    learners: "2,140",
    instructor: "MELD Lab Team",
    bannerTheme: "theme-emerald",
    tags: ["Emotion Analytics", "Teaching Design", "Realtime Feedback"],
    skills: ["Sentiment Signals", "Learning Analytics", "Session Design"],
    modules: [
      {
        id: "foundations",
        title: "Week 1: Foundations",
        items: [
          {
            lesson_id: "tmpl-foundations-1",
            title: "Why Emotion Signals Matter",
            description: "Understand how affective feedback changes pacing and learning outcomes.",
            content: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            duration: "12 min",
            resources: ["Slides", "Reading list", "Class rubric"],
          },
          {
            lesson_id: "tmpl-foundations-2",
            title: "Mapping Signals to Interventions",
            description: "Translate interest, confusion, and boredom into actionable teaching choices.",
            content: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
            duration: "16 min",
            resources: ["Intervention checklist", "Examples"],
          },
        ],
      },
      {
        id: "practice",
        title: "Week 2: Studio Practice",
        items: [
          {
            lesson_id: "tmpl-foundations-3",
            title: "Designing a Reflection Prompt",
            description: "Create a prompt flow that captures high-signal learner text responses.",
            content: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
            duration: "10 min",
            resources: ["Prompt templates"],
          },
        ],
      },
    ],
  },
  {
    id: "engagement-patterns",
    title: "Engagement Patterns for Online Classes",
    subtitle: "Detect attention drops and improve session flow using lightweight analytics.",
    category: "Teaching",
    level: "Beginner",
    duration: "3 weeks",
    rating: 4.7,
    learners: "1,360",
    instructor: "Instructor Success Team",
    bannerTheme: "theme-cobalt",
    tags: ["Engagement", "Remote Teaching", "Dashboards"],
    skills: ["Classroom Metrics", "Pacing", "Instructional Strategy"],
    modules: [
      {
        id: "session-flow",
        title: "Week 1: Session Flow",
        items: [
          {
            lesson_id: "tmpl-engagement-1",
            title: "Reading the Room Remotely",
            description: "Use simple metrics to identify where students disengage in a live session.",
            content: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            duration: "11 min",
            resources: ["Observation sheet"],
          },
          {
            lesson_id: "tmpl-engagement-2",
            title: "Interpreting Confusion Spikes",
            description: "Review examples of confusion spikes and choose the right intervention.",
            content: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
            duration: "14 min",
            resources: ["Decision tree"],
          },
        ],
      },
    ],
  },
  {
    id: "multimodal-classroom-lab",
    title: "Multimodal Classroom Signals Lab",
    subtitle: "Combine text, face, and voice-based signals for richer teaching insights.",
    category: "Data & AI",
    level: "Advanced",
    duration: "5 weeks",
    rating: 4.9,
    learners: "820",
    instructor: "Applied ML Studio",
    bannerTheme: "theme-sunset",
    tags: ["Multimodal AI", "Dashboards", "Education Ops"],
    skills: ["Signal Fusion", "Model Feedback", "Experiment Tracking"],
    modules: [
      {
        id: "modalities",
        title: "Week 1: Modalities",
        items: [
          {
            lesson_id: "tmpl-multi-1",
            title: "Text vs Face vs Voice: Tradeoffs",
            description: "Understand what each modality contributes in a learning environment.",
            content: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
            duration: "13 min",
            resources: ["Comparison worksheet"],
          },
        ],
      },
      {
        id: "fusion",
        title: "Week 2: Fusion Patterns",
        items: [
          {
            lesson_id: "tmpl-multi-2",
            title: "Building a Practical Fusion Workflow",
            description: "Design a robust, privacy-aware flow for classroom analytics collection.",
            content: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            duration: "18 min",
            resources: ["Architecture diagram", "Checklist"],
          },
        ],
      },
    ],
  },
];

const COURSE_CATEGORIES = ["All", "Data & AI", "Teaching"];

function chunk(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

function normalizeLessons(rawLessons = []) {
  return rawLessons.map((lesson, index) => ({
    lesson_id: String(lesson.lesson_id ?? lesson.lessonId ?? `lesson-${index + 1}`),
    title: lesson.title || `Lesson ${index + 1}`,
    description: lesson.description || "Teacher-posted lesson",
    content: lesson.content || lesson.video_url || lesson.videoUrl || "",
    duration: `${10 + (index % 4) * 4} min`,
    resources: Array.isArray(lesson.resources) && lesson.resources.length > 0
      ? lesson.resources
      : ["Lesson notes", "Discussion prompts", "Practice checklist"],
    source: "api",
  }));
}

function buildLiveCourse(rawLessons = []) {
  const lessons = normalizeLessons(rawLessons);
  const hasUploadedLessons = lessons.length > 0;
  const preparedLessons = hasUploadedLessons
    ? lessons
    : [
        {
          lesson_id: "starter-1",
          title: "Welcome to the Learning Lab",
          description: "A sample lesson appears here until a teacher posts lessons in the dashboard.",
          content: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
          duration: "8 min",
          resources: ["Setup checklist", "How to use notes"],
          source: "sample",
        },
        {
          lesson_id: "starter-2",
          title: "How Emotion Tracking Works",
          description: "Overview of text and background facial engagement capture in this app.",
          content: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
          duration: "9 min",
          resources: ["Privacy guidance", "Reporting guide"],
          source: "sample",
        },
      ];

  const modules = chunk(preparedLessons, 3).map((items, index) => ({
    id: `live-module-${index + 1}`,
    title: `Module ${index + 1}: ${index === 0 ? "Core Lessons" : "Practice & Review"}`,
    items,
  }));

  return {
    id: "live-classroom-studio",
    title: "Live Classroom Studio",
    subtitle: hasUploadedLessons
      ? "Teacher-posted lessons streamed into a Coursera-style learning experience."
      : "Sample course shell that becomes your live course once a teacher posts lessons.",
    category: "Teaching",
    level: "Beginner",
    duration: `${preparedLessons.length} lessons`,
    rating: 4.8,
    learners: hasUploadedLessons ? "Current classroom" : "Demo",
    instructor: "Your Course Instructor",
    bannerTheme: "theme-violet",
    tags: ["Live Lessons", "Emotion Tracking", "Interactive Learning"],
    skills: ["Lesson Playback", "Session Logging", "Engagement Review"],
    modules,
    isLive: true,
  };
}

export function buildCourseCatalog(rawLessons = []) {
  return [buildLiveCourse(rawLessons), ...COURSE_TEMPLATES];
}

export function getCourseCategories() {
  return COURSE_CATEGORIES;
}

export function getCourseById(courseId, rawLessons = []) {
  const catalog = buildCourseCatalog(rawLessons);
  return catalog.find((course) => course.id === courseId) || null;
}

export function getAllCourseLessons(course) {
  if (!course?.modules) {
    return [];
  }
  return course.modules.flatMap((module) =>
    module.items.map((item) => ({
      ...item,
      moduleId: module.id,
      moduleTitle: module.title,
    }))
  );
}

export function getLessonById(course, lessonId) {
  return getAllCourseLessons(course).find((lesson) => String(lesson.lesson_id) === String(lessonId)) || null;
}

export function formatLessonCount(course) {
  return getAllCourseLessons(course).length;
}

export function buildCourseSummaryMeta(course) {
  if (!course) {
    return [];
  }
  return [
    `${formatLessonCount(course)} lessons`,
    course.level,
    course.duration,
    `${course.rating} rating`,
  ].filter(Boolean);
}
