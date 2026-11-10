import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(__dirname, '..', '..', 'content', 'sessions');
const COURSES_DIR = path.join(__dirname, '..', '..', 'content', 'courses');

let packageCache = null;
let courseCache = null;

function packageSummary(pkg) {
  return {
    id: pkg.id,
    slug: pkg.slug || pkg.id,
    title: pkg.title,
    course: pkg.course || '',
    course_id: pkg.course_id || '',
    week: pkg.week ?? null,
    length_minutes: pkg.length_minutes ?? null,
    max_students: pkg.max_students ?? 10,
    objective: pkg.objective || '',
    content_status: pkg.content_status || (pkg.quizzes?.check?.cards?.length ? 'ready' : 'outline'),
    phases: Array.isArray(pkg.phases) ? pkg.phases : [],
    tags: Array.isArray(pkg.tags) ? pkg.tags : []
  };
}

function allCardsFromPackage(pkg) {
  const cards = [];
  for (const quiz of Object.values(pkg.quizzes || {})) {
    for (const card of quiz.cards || []) cards.push(card);
  }
  for (const card of pkg.homework?.cards || []) cards.push(card);
  return cards;
}

export async function loadSessionPackages({ force = false } = {}) {
  if (packageCache && !force) return packageCache;
  let names = [];
  try {
    names = await readdir(SESSIONS_DIR);
  } catch {
    packageCache = [];
    return packageCache;
  }
  const packages = [];
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    try {
      const raw = await readFile(path.join(SESSIONS_DIR, name), 'utf8');
      const pkg = JSON.parse(raw);
      if (pkg?.id && pkg?.title) packages.push(pkg);
    } catch (error) {
      console.warn(`[classroom] skip session package ${name}:`, error.message || error);
    }
  }
  packages.sort((a, b) => {
    const wa = Number(a.week) || 999;
    const wb = Number(b.week) || 999;
    if (wa !== wb) return wa - wb;
    return String(a.title).localeCompare(String(b.title));
  });
  packageCache = packages;
  return packageCache;
}

export async function loadCourses({ force = false } = {}) {
  if (courseCache && !force) return courseCache;
  let names = [];
  try {
    names = await readdir(COURSES_DIR);
  } catch {
    courseCache = [];
    return courseCache;
  }
  const courses = [];
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    try {
      const raw = await readFile(path.join(COURSES_DIR, name), 'utf8');
      const course = JSON.parse(raw);
      if (course?.id && course?.title) courses.push(course);
    } catch (error) {
      console.warn(`[classroom] skip course ${name}:`, error.message || error);
    }
  }
  courseCache = courses;
  return courseCache;
}

export async function listSessionPackageSummaries() {
  const packages = await loadSessionPackages();
  return packages.map(packageSummary);
}

export async function listCourseCatalog() {
  const [courses, packages] = await Promise.all([loadCourses(), loadSessionPackages()]);
  const byId = new Map(packages.map((p) => [p.id, packageSummary(p)]));

  const catalog = courses.map((course) => {
    const sessionIds = Array.isArray(course.session_ids) ? course.session_ids : [];
    const sessions = sessionIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => (Number(a.week) || 999) - (Number(b.week) || 999));
    // Also include any packages tagged to this course_id but missing from session_ids
    for (const pkg of packages) {
      if (pkg.course_id === course.id && !sessions.some((s) => s.id === pkg.id)) {
        sessions.push(packageSummary(pkg));
      }
    }
    sessions.sort((a, b) => (Number(a.week) || 999) - (Number(b.week) || 999));
    return {
      id: course.id,
      title: course.title,
      description: course.description || '',
      length_minutes: course.length_minutes ?? 90,
      weeks: course.weeks ?? sessions.length,
      max_students_default: course.max_students_default ?? 10,
      sessions
    };
  });

  // Orphan packages (no course file) grouped under their course title string
  const knownIds = new Set(catalog.flatMap((c) => c.sessions.map((s) => s.id)));
  const orphans = packages.filter((p) => !knownIds.has(p.id));
  if (orphans.length) {
    const byCourseTitle = new Map();
    for (const pkg of orphans) {
      const key = pkg.course_id || pkg.course || 'other';
      if (!byCourseTitle.has(key)) byCourseTitle.set(key, []);
      byCourseTitle.get(key).push(packageSummary(pkg));
    }
    for (const [key, sessions] of byCourseTitle) {
      if (catalog.some((c) => c.id === key)) continue;
      sessions.sort((a, b) => (Number(a.week) || 999) - (Number(b.week) || 999));
      catalog.push({
        id: key,
        title: sessions[0]?.course || 'Other courses',
        description: '',
        length_minutes: 90,
        weeks: sessions.length,
        max_students_default: 10,
        sessions
      });
    }
  }

  return catalog;
}

export async function getSessionPackage(id) {
  const packages = await loadSessionPackages();
  const needle = String(id || '').trim();
  return packages.find((p) => p.id === needle || p.slug === needle) || null;
}

export async function collectSessionSeedContent() {
  const packages = await loadSessionPackages();
  const tracksById = new Map();
  const topicsById = new Map();
  const cardsById = new Map();
  for (const pkg of packages) {
    if (pkg.track?.id) tracksById.set(pkg.track.id, { ...pkg.track });
    for (const topic of pkg.topics || []) {
      if (topic?.id) topicsById.set(topic.id, { ...topic });
    }
    for (const card of allCardsFromPackage(pkg)) {
      if (!card?.id) continue;
      cardsById.set(card.id, {
        ...card,
        choices: Array.isArray(card.choices) ? card.choices : null,
        tags: Array.isArray(card.tags) ? card.tags : [],
        details: card.details || null
      });
    }
  }
  return {
    tracks: [...tracksById.values()],
    topics: [...topicsById.values()],
    cards: [...cardsById.values()]
  };
}

export function quizCardsForPhase(pkg, phaseId) {
  const phase = (pkg.phases || []).find((p) => p.id === phaseId);
  if (!phase?.quiz) return [];
  const quiz = pkg.quizzes?.[phase.quiz];
  return Array.isArray(quiz?.cards) ? quiz.cards : [];
}

export function homeworkCards(pkg) {
  return Array.isArray(pkg?.homework?.cards) ? pkg.homework.cards : [];
}

export function publicCard(card, { revealAnswer = false } = {}) {
  if (!card) return null;
  const out = {
    id: card.id,
    track_id: card.track_id,
    topic_id: card.topic_id,
    question: card.question,
    choices: Array.isArray(card.choices) ? card.choices : null,
    source: card.source || '',
    tags: Array.isArray(card.tags) ? card.tags : []
  };
  if (revealAnswer) {
    out.answer = card.answer;
    out.details = card.details || null;
  }
  return out;
}
