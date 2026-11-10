import { randomBytes, randomUUID } from 'node:crypto';
import {
  getSessionPackage,
  homeworkCards,
  publicCard,
  quizCardsForPhase
} from './packages.js';

export const LIVE_SESSION_CAP = 10;

function nowIso() {
  return new Date().toISOString();
}

function makeJoinCode() {
  // 6-char uppercase code without ambiguous 0/O/1/I
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

function displayNameFromUser({ name, email, userKey } = {}) {
  const raw = String(name || '').trim();
  if (raw) return raw.split(/\s+/)[0].slice(0, 24);
  const local = String(email || '').split('@')[0];
  if (local) return local.slice(0, 24);
  const key = String(userKey || '');
  if (!key || key.startsWith('g:') || key.startsWith('e:')) return 'Learner';
  return key.slice(0, 24);
}

function emptyHeat(cards) {
  const byTag = new Map();
  for (const card of cards) {
    for (const tag of card.tags || []) {
      if (tag === 'warmup' || tag === 'check' || tag.startsWith('session:')) continue;
      byTag.set(tag, { tag, wrong: 0, total: 0 });
    }
  }
  return byTag;
}

function sessionView(session, { viewerKey = null, isInstructor = false, pkg = null } = {}) {
  const roster = [...session.roster.values()].map((s) => ({
    user_key: s.userKey,
    display_name: s.displayName,
    role: s.role,
    joined_at: s.joinedAt,
    remote: Boolean(s.remote)
  }));
  const member = viewerKey ? session.roster.get(viewerKey) : null;
  const phase = (pkg?.phases || []).find((p) => p.id === session.phase) || {
    id: session.phase,
    title: session.phase
  };
  const revealAnswers =
    isInstructor || session.answersFrozen || ['debrief', 'close'].includes(session.phase);
  let quizCards = [];
  if (phase.quiz) {
    quizCards = quizCardsForPhase(pkg, session.phase).map((c) => {
      const pub = publicCard(c, { revealAnswer: revealAnswers });
      const ans = member?.answers?.get(c.id);
      return {
        ...pub,
        your_choice: ans?.choice ?? null,
        your_correct: revealAnswers ? ans?.correct ?? null : null
      };
    });
  }
  const homework =
    session.phase === 'close' || isInstructor
      ? {
          title: pkg?.homework?.title || 'Homework',
          tasks: pkg?.homework?.tasks || [],
          cards: homeworkCards(pkg).map((c) => publicCard(c, { revealAnswer: true }))
        }
      : null;

  return {
    id: session.id,
    code: session.code,
    scheduled_class_id: session.scheduledClassId || null,
    package_id: session.packageId,
    title: pkg?.title || session.title,
    objective: pkg?.objective || '',
    max_students: session.maxStudents,
    phase: session.phase,
    phase_title: phase.title || session.phase,
    phases: pkg?.phases || [],
    answers_frozen: Boolean(session.answersFrozen),
    status: session.status,
    created_at: session.createdAt,
    created_by: session.createdBy,
    roster,
    roster_count: roster.filter((r) => r.role === 'student').length,
    you: member
      ? {
          user_key: member.userKey,
          display_name: member.displayName,
          role: member.role,
          joined_at: member.joinedAt
        }
      : null,
    outline: isInstructor || ['teach', 'debrief', 'close'].includes(session.phase) ? pkg?.outline || [] : [],
    risk_pauses: isInstructor ? pkg?.risk_pauses || [] : [],
    schedule: pkg?.schedule || [],
    elements: pkg?.elements || [],
    completion_standards: pkg?.completion_standards || [],
    signoff: pkg?.signoff || null,
    quiz: quizCards.length
      ? {
          id: phase.quiz,
          title: pkg?.quizzes?.[phase.quiz]?.title || phase.quiz,
          frozen: Boolean(session.answersFrozen),
          cards: quizCards
        }
      : null,
    homework,
    instructor_notes: isInstructor ? session.instructorNotes || '' : undefined
  };
}

function buildHeatMap(session, pkg) {
  const phaseQuiz = session.phase === 'warmup' || session.phase === 'check' ? session.phase : 'warmup';
  const cards = quizCardsForPhase(pkg, phaseQuiz);
  const byTag = emptyHeat(cards);
  const byCard = cards.map((card) => ({
    card_id: card.id,
    question: card.question,
    wrong: 0,
    total: 0
  }));
  const cardIndex = new Map(byCard.map((row, i) => [row.card_id, i]));

  for (const student of session.roster.values()) {
    if (student.role !== 'student') continue;
    for (const card of cards) {
      const ans = student.answers?.get(card.id);
      if (!ans) continue;
      const idx = cardIndex.get(card.id);
      byCard[idx].total += 1;
      if (!ans.correct) byCard[idx].wrong += 1;
      for (const tag of card.tags || []) {
        if (tag === 'warmup' || tag === 'check' || tag.startsWith('session:')) continue;
        const row = byTag.get(tag) || { tag, wrong: 0, total: 0 };
        row.total += 1;
        if (!ans.correct) row.wrong += 1;
        byTag.set(tag, row);
      }
    }
  }

  const tags = [...byTag.values()]
    .map((row) => ({
      ...row,
      miss_pct: row.total ? Math.round((100 * row.wrong) / row.total) : 0
    }))
    .sort((a, b) => b.miss_pct - a.miss_pct || b.wrong - a.wrong || a.tag.localeCompare(b.tag));

  return {
    phase: phaseQuiz,
    answered_students: [...session.roster.values()].filter(
      (s) => s.role === 'student' && [...(s.answers?.keys() || [])].some((id) => cardIndex.has(id))
    ).length,
    tags,
    cards: byCard.map((row) => ({
      ...row,
      miss_pct: row.total ? Math.round((100 * row.wrong) / row.total) : 0
    }))
  };
}

export function createLiveSessionManager() {
  /** @type {Map<string, any>} */
  const byId = new Map();
  /** @type {Map<string, string>} */
  const byCode = new Map();
  /** userKey -> live session id they last joined/created that is still open */
  const byUser = new Map();

  async function requirePackage(packageId) {
    const pkg = await getSessionPackage(packageId);
    if (!pkg) {
      const err = new Error('Session package not found');
      err.status = 404;
      throw err;
    }
    return pkg;
  }

  function getOpenForUser(userKey) {
    const id = byUser.get(userKey);
    if (!id) return null;
    const session = byId.get(id);
    if (!session || session.status !== 'open') {
      byUser.delete(userKey);
      return null;
    }
    return session;
  }

  return {
    async open({ packageId, instructor, remote = false, scheduledClassId = null } = {}) {
      const pkg = await requirePackage(packageId || 'weather-for-soaring');
      const userKey = String(instructor?.userKey || '').trim();
      if (!userKey) {
        const err = new Error('Instructor identity required');
        err.status = 401;
        throw err;
      }

      // One open live session per instructor for this package / scheduled class.
      for (const existing of byId.values()) {
        if (existing.status !== 'open' || existing.createdBy !== userKey) continue;
        const sameClass =
          scheduledClassId && existing.scheduledClassId === scheduledClassId;
        const samePackage =
          !scheduledClassId && existing.packageId === pkg.id && !existing.scheduledClassId;
        if (sameClass || samePackage) {
          existing.status = 'closed';
          existing.closedAt = nowIso();
        }
      }

      let code = makeJoinCode();
      while (byCode.has(code)) code = makeJoinCode();
      const id = randomUUID();
      const session = {
        id,
        code,
        scheduledClassId: scheduledClassId ? String(scheduledClassId) : null,
        packageId: pkg.id,
        title: pkg.title,
        maxStudents: Math.min(LIVE_SESSION_CAP, Number(pkg.max_students) || LIVE_SESSION_CAP),
        phase: 'open',
        answersFrozen: false,
        status: 'open',
        createdAt: nowIso(),
        createdBy: userKey,
        instructorNotes: '',
        roster: new Map([
          [
            userKey,
            {
              userKey,
              displayName: displayNameFromUser(instructor),
              email: instructor.email || '',
              role: 'instructor',
              joinedAt: nowIso(),
              remote: Boolean(remote),
              answers: new Map()
            }
          ]
        ])
      };
      byId.set(id, session);
      byCode.set(code, id);
      byUser.set(userKey, id);
      return sessionView(session, { viewerKey: userKey, isInstructor: true, pkg });
    },

    async getForScheduledClass(scheduledClassId, userKey, { isAdmin = false } = {}) {
      const needle = String(scheduledClassId || '');
      if (!needle) return null;
      let session = null;
      for (const s of byId.values()) {
        if (s.status === 'open' && s.scheduledClassId === needle) {
          session = s;
          break;
        }
      }
      if (!session) return null;
      const pkg = await requirePackage(session.packageId);
      const member = session.roster.get(userKey);
      const isInstructor =
        Boolean(isAdmin) || member?.role === 'instructor' || session.createdBy === userKey;
      return sessionView(session, { viewerKey: userKey, isInstructor, pkg });
    },

    async admitEnrolled({ sessionId, user, remote = false } = {}) {
      const session = byId.get(String(sessionId || ''));
      if (!session || session.status !== 'open') {
        const err = new Error('Live session not found');
        err.status = 404;
        throw err;
      }
      const pkg = await requirePackage(session.packageId);
      const userKey = String(user?.userKey || '').trim();
      if (!userKey) {
        const err = new Error('Sign in required');
        err.status = 401;
        throw err;
      }
      const existing = session.roster.get(userKey);
      if (existing) {
        existing.remote = Boolean(remote);
        byUser.set(userKey, session.id);
        const isInstructor = existing.role === 'instructor' || session.createdBy === userKey;
        return sessionView(session, { viewerKey: userKey, isInstructor, pkg });
      }
      session.roster.set(userKey, {
        userKey,
        displayName: displayNameFromUser(user),
        email: user.email || '',
        role: session.createdBy === userKey ? 'instructor' : 'student',
        joinedAt: nowIso(),
        remote: Boolean(remote),
        answers: new Map()
      });
      byUser.set(userKey, session.id);
      return sessionView(session, {
        viewerKey: userKey,
        isInstructor: session.createdBy === userKey,
        pkg
      });
    },

    async join({ code, user, remote = false } = {}) {
      const normalized = normalizeCode(code);
      if (!normalized) {
        const err = new Error('Session code required');
        err.status = 400;
        throw err;
      }
      const id = byCode.get(normalized);
      const session = id ? byId.get(id) : null;
      if (!session || session.status !== 'open') {
        const err = new Error('No open live session for that code');
        err.status = 404;
        throw err;
      }
      const pkg = await requirePackage(session.packageId);
      const userKey = String(user?.userKey || '').trim();
      if (!userKey) {
        const err = new Error('Sign in required to join a live session');
        err.status = 401;
        throw err;
      }

      const existing = session.roster.get(userKey);
      if (existing) {
        existing.remote = Boolean(remote);
        byUser.set(userKey, session.id);
        const isInstructor = existing.role === 'instructor' || session.createdBy === userKey;
        return sessionView(session, { viewerKey: userKey, isInstructor, pkg });
      }

      const studentCount = [...session.roster.values()].filter((s) => s.role === 'student').length;
      if (studentCount >= session.maxStudents) {
        const err = new Error(`This live session is full (max ${session.maxStudents} students)`);
        err.status = 403;
        throw err;
      }

      session.roster.set(userKey, {
        userKey,
        displayName: displayNameFromUser(user),
        email: user.email || '',
        role: session.createdBy === userKey ? 'instructor' : 'student',
        joinedAt: nowIso(),
        remote: Boolean(remote),
        answers: new Map()
      });
      byUser.set(userKey, session.id);
      const isInstructor = session.createdBy === userKey;
      return sessionView(session, { viewerKey: userKey, isInstructor, pkg });
    },

    async getForUser(userKey, { isAdmin = false } = {}) {
      const session = getOpenForUser(userKey);
      if (!session) return null;
      const pkg = await requirePackage(session.packageId);
      const member = session.roster.get(userKey);
      const isInstructor =
        Boolean(isAdmin) || member?.role === 'instructor' || session.createdBy === userKey;
      return sessionView(session, { viewerKey: userKey, isInstructor, pkg });
    },

    async getById(sessionId, userKey, { isAdmin = false } = {}) {
      const session = byId.get(String(sessionId || ''));
      if (!session) return null;
      const member = session.roster.get(userKey);
      if (!member && !isAdmin) {
        const err = new Error('Not authorized for this live session — join with the session code');
        err.status = 403;
        throw err;
      }
      const pkg = await requirePackage(session.packageId);
      const isInstructor =
        Boolean(isAdmin) || member?.role === 'instructor' || session.createdBy === userKey;
      return sessionView(session, { viewerKey: userKey, isInstructor, pkg });
    },

    async patch(sessionId, userKey, body = {}, { isAdmin = false } = {}) {
      const session = byId.get(String(sessionId || ''));
      if (!session || session.status !== 'open') {
        const err = new Error('Live session not found');
        err.status = 404;
        throw err;
      }
      const member = session.roster.get(userKey);
      const isInstructor =
        Boolean(isAdmin) || member?.role === 'instructor' || session.createdBy === userKey;
      if (!isInstructor) {
        const err = new Error('Only the instructor can update the live session');
        err.status = 403;
        throw err;
      }
      const pkg = await requirePackage(session.packageId);

      if (body.phase != null) {
        const next = String(body.phase).trim();
        const allowed = new Set((pkg.phases || []).map((p) => p.id));
        if (!allowed.has(next)) {
          const err = new Error(`Invalid phase: ${next}`);
          err.status = 400;
          throw err;
        }
        session.phase = next;
        if (next === 'warmup' || next === 'check') session.answersFrozen = false;
        if (next === 'debrief' || next === 'close') session.answersFrozen = true;
      }
      if (typeof body.answers_frozen === 'boolean') {
        session.answersFrozen = body.answers_frozen;
      }
      if (body.instructor_notes != null) {
        session.instructorNotes = String(body.instructor_notes).slice(0, 4000);
      }
      if (body.status === 'closed') {
        session.status = 'closed';
        session.closedAt = nowIso();
      }

      return sessionView(session, { viewerKey: userKey, isInstructor: true, pkg });
    },

    async submitAnswer(sessionId, userKey, { cardId, choice } = {}) {
      const session = byId.get(String(sessionId || ''));
      if (!session || session.status !== 'open') {
        const err = new Error('Live session not found');
        err.status = 404;
        throw err;
      }
      const member = session.roster.get(userKey);
      if (!member) {
        const err = new Error('Join this live session before answering');
        err.status = 403;
        throw err;
      }
      if (session.answersFrozen) {
        const err = new Error('Answers are frozen for this quiz');
        err.status = 403;
        throw err;
      }
      if (!['warmup', 'check'].includes(session.phase)) {
        const err = new Error('Quiz answering is only open during warm-up or check phases');
        err.status = 400;
        throw err;
      }
      const pkg = await requirePackage(session.packageId);
      const cards = quizCardsForPhase(pkg, session.phase);
      const card = cards.find((c) => c.id === String(cardId || ''));
      if (!card) {
        const err = new Error('Card not in the current quiz');
        err.status = 404;
        throw err;
      }
      const chosen = String(choice ?? '').trim();
      if (!chosen) {
        const err = new Error('choice required');
        err.status = 400;
        throw err;
      }
      const correct =
        chosen.replace(/\s+/g, ' ').toLowerCase() ===
        String(card.answer || '')
          .replace(/\s+/g, ' ')
          .toLowerCase();
      member.answers.set(card.id, {
        choice: chosen,
        correct,
        at: nowIso()
      });
      return {
        ok: true,
        card_id: card.id,
        correct: session.answersFrozen || ['debrief', 'close'].includes(session.phase) ? correct : null,
        frozen: Boolean(session.answersFrozen)
      };
    },

    async heatMap(sessionId, userKey, { isAdmin = false } = {}) {
      const session = byId.get(String(sessionId || ''));
      if (!session) {
        const err = new Error('Live session not found');
        err.status = 404;
        throw err;
      }
      const member = session.roster.get(userKey);
      const isInstructor =
        Boolean(isAdmin) || member?.role === 'instructor' || session.createdBy === userKey;
      if (!isInstructor) {
        const err = new Error('Instructor only');
        err.status = 403;
        throw err;
      }
      const pkg = await requirePackage(session.packageId);
      return buildHeatMap(session, pkg);
    },

    /** Test helper */
    _debugState() {
      return { byId, byCode, byUser };
    }
  };
}
