import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(__dirname, '..', '..', 'content', 'sessions');

let cache = null;

function packageSummary(pkg) {
  return {
    id: pkg.id,
    slug: pkg.slug || pkg.id,
    title: pkg.title,
    course: pkg.course || '',
    week: pkg.week ?? null,
    length_minutes: pkg.length_minutes ?? null,
    max_students: pkg.max_students ?? 10,
    objective: pkg.objective || '',
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
  if (cache && !force) return cache;
  let names = [];
  try {
    names = await readdir(SESSIONS_DIR);
  } catch {
    cache = [];
    return cache;
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
  cache = packages;
  return cache;
}

export async function listSessionPackageSummaries() {
  const packages = await loadSessionPackages();
  return packages.map(packageSummary);
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
