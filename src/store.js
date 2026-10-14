import { randomUUID } from 'node:crypto';
import { loadSeedFile } from './seed.js';

const ACTIVITY_TZ = 'America/Chicago';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

/** Calendar date YYYY-MM-DD in America/Chicago. */
export function activityDateKey(when = new Date(), timeZone = ACTIVITY_TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(when instanceof Date ? when : new Date(when));
}

export function normalizeAnswerText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[.?!,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** 2 XP correct, 1 XP answered wrong. */
export function xpForCorrectness(correct) {
  return correct ? 2 : 1;
}

/**
 * Resolve whether the learner got the card right.
 * Prefer explicit correct / choice match; flashcards without a choice treat "again" as wrong.
 */
export function resolveStudyCorrect({ card, choice, correct, grade } = {}) {
  if (typeof correct === 'boolean') return correct;
  if (choice != null && String(choice).trim() !== '') {
    return normalizeAnswerText(choice) === normalizeAnswerText(card?.answer);
  }
  const g = String(grade || '').toLowerCase();
  if (g === 'again') return false;
  if (['hard', 'good', 'easy'].includes(g)) return true;
  return false;
}

export function displayNameFromProfile({ name, email, userKey } = {}) {
  const raw = String(name || '').trim();
  if (raw) {
    const first = raw.split(/\s+/)[0];
    return first.slice(0, 24);
  }
  const local = String(email || '').split('@')[0];
  if (local) return local.slice(0, 24);
  const key = String(userKey || '');
  if (!key || key.startsWith('g:') || key.startsWith('e:')) return 'Learner';
  return key.slice(0, 24);
}

function listRecentDateKeys(days, when = new Date()) {
  const n = Math.max(1, Math.min(30, Number(days) || 7));
  const today = activityDateKey(when);
  const [y, m, d] = today.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    // Noon UTC on the CT calendar date avoids most DST edge cases when formatting back to CT.
    const anchor = new Date(Date.UTC(y, m - 1, d - i, 17, 0, 0));
    out.push(activityDateKey(anchor));
  }
  return out;
}

function buildLeagueSummary({ userKey, days, profilesByKey, countsByUserDate }) {
  const dates = listRecentDateKeys(days);
  const today = dates[dates.length - 1];
  const seriesFor = (uk) => dates.map((date) => Number(countsByUserDate.get(`${uk}::${date}`) || 0));
  const allKeys = new Set([userKey, ...[...countsByUserDate.keys()].map((k) => k.split('::')[0])]);
  const people = [...allKeys].map((uk) => {
    const series = seriesFor(uk);
    const weekTotal = series.reduce((a, b) => a + b, 0);
    const profile = profilesByKey.get(uk) || { userKey: uk };
    return {
      user_key: uk,
      display_name: uk === userKey ? 'You' : displayNameFromProfile(profile),
      picture: profile.picture || null,
      is_you: uk === userKey,
      today: series[series.length - 1] || 0,
      week_total: weekTotal,
      series
    };
  });
  people.sort((a, b) => b.week_total - a.week_total || b.today - a.today || a.display_name.localeCompare(b.display_name));
  const you = people.find((p) => p.is_you) || {
    user_key: userKey,
    display_name: 'You',
    picture: null,
    is_you: true,
    today: 0,
    week_total: 0,
    series: dates.map(() => 0)
  };
  const peers = people.filter((p) => !p.is_you && p.week_total > 0).slice(0, 5);
  const chart = [you, ...peers];
  const leaderboard = [...people]
    .filter((p) => p.is_you || p.today > 0 || p.week_total > 0)
    .sort((a, b) => b.today - a.today || b.week_total - a.week_total)
    .slice(0, 12)
    .map((p, i) => ({ rank: i + 1, ...p }));
  return {
    timezone: ACTIVITY_TZ,
    days: dates.length,
    dates,
    today,
    you,
    chart,
    leaderboard
  };
}

/** Normalize a card edit payload (question / answer / choices / source). */
export function normalizeCardPatch(body = {}) {
  const patch = {};
  if (body.question !== undefined) {
    const question = String(body.question ?? '').trim();
    if (!question) throw new Error('question is required');
    patch.question = question;
  }
  if (body.answer !== undefined) {
    const answer = String(body.answer ?? '').trim();
    if (!answer) throw new Error('answer is required');
    patch.answer = answer;
  }
  if (body.source !== undefined) {
    patch.source = String(body.source ?? '').trim();
  }
  if (body.topic_id !== undefined) {
    const topicId = String(body.topic_id ?? '').trim();
    if (!topicId) throw new Error('topic_id is required when provided');
    patch.topic_id = topicId;
  }
  if (body.choices !== undefined) {
    if (body.choices == null || body.choices === '') {
      patch.choices = null;
    } else if (!Array.isArray(body.choices)) {
      throw new Error('choices must be an array of strings');
    } else {
      const choices = body.choices.map((c) => String(c ?? '').trim()).filter(Boolean);
      patch.choices = choices.length ? choices : null;
    }
  }
  if (!Object.keys(patch).length) throw new Error('no fields to update');
  return patch;
}

/** Simple SM-2-ish update for study reps. */
export function nextProgress(prev, grade) {
  // grade: again | hard | good | easy
  const now = new Date();
  let ease = prev?.ease ?? 2.5;
  let interval = prev?.interval_days ?? 0;
  let reps = prev?.reps ?? 0;
  let lapses = prev?.lapses ?? 0;

  if (grade === 'again') {
    reps = 0;
    lapses += 1;
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps += 1;
    if (grade === 'hard') ease = Math.max(1.3, ease - 0.15);
    if (grade === 'easy') ease = ease + 0.15;
    if (reps === 1) interval = grade === 'easy' ? 3 : 1;
    else if (reps === 2) interval = grade === 'easy' ? 7 : 3;
    else interval = Math.max(1, Math.round(interval * ease));
  }

  const due = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  if (grade === 'again') due.setTime(now.getTime() + 10 * 60 * 1000);

  return {
    ease,
    interval_days: interval,
    due_at: due.toISOString(),
    reps,
    lapses,
    last_result: grade,
    last_studied_at: now.toISOString()
  };
}

export function createMemoryStore(seed) {
  const state = {
    tracks: [...(seed.tracks || [])],
    topics: [...(seed.topics || [])],
    cards: [...(seed.cards || [])],
    progress: new Map(),
    imports: [],
    dailyActivity: new Map(), // `${userKey}::YYYY-MM-DD` -> answers
    profiles: new Map() // userKey -> { name, email, picture, userKey }
  };

  return {
    async listTracks() {
      return state.tracks.sort((a, b) => a.sort_order - b.sort_order);
    },
    async listTopics(trackId) {
      return state.topics
        .filter((t) => !trackId || t.track_id === trackId)
        .sort((a, b) => a.sort_order - b.sort_order);
    },
    async listCards({ trackId, topicId } = {}) {
      return state.cards.filter((c) => {
        if (trackId && c.track_id !== trackId) return false;
        if (topicId && c.topic_id !== topicId) return false;
        return true;
      });
    },
    async getCard(id) {
      return state.cards.find((c) => c.id === id) || null;
    },
    async updateCard(id, body) {
      const card = state.cards.find((c) => c.id === id);
      if (!card) return null;
      const patch = normalizeCardPatch(body);
      Object.assign(card, patch, { updated_at: new Date().toISOString() });
      return { ...card };
    },
    async getProgress(userKey) {
      const out = [];
      for (const [key, value] of state.progress.entries()) {
        if (key.startsWith(`${userKey}::`)) out.push(value);
      }
      return out;
    },
    async upsertProgress(userKey, cardId, patch) {
      const key = `${userKey}::${cardId}`;
      const row = { user_key: userKey, card_id: cardId, ...patch };
      state.progress.set(key, row);
      return row;
    },
    async getProgressOne(userKey, cardId) {
      return state.progress.get(`${userKey}::${cardId}`) || null;
    },
    async recordAnswer(userKey, pointsOrWhen = 1, maybeWhen) {
      const points = typeof pointsOrWhen === 'number'
        ? Math.max(0, Math.floor(pointsOrWhen))
        : 1;
      const when = typeof pointsOrWhen === 'number'
        ? (maybeWhen instanceof Date ? maybeWhen : new Date())
        : (pointsOrWhen instanceof Date ? pointsOrWhen : new Date());
      const date = activityDateKey(when);
      const key = `${userKey}::${date}`;
      const next = Number(state.dailyActivity.get(key) || 0) + points;
      state.dailyActivity.set(key, next);
      return { user_key: userKey, activity_date: date, answers: next, xp_awarded: points };
    },
    async setUserProfile(profile) {
      if (!profile?.userKey) return;
      state.profiles.set(profile.userKey, {
        userKey: profile.userKey,
        name: profile.name || '',
        email: profile.email || '',
        picture: profile.picture || null
      });
    },
    async leagueSummary(userKey, { days = 7 } = {}) {
      return buildLeagueSummary({
        userKey,
        days,
        profilesByKey: state.profiles,
        countsByUserDate: state.dailyActivity
      });
    },
    async importCards({ trackId, topicTitle, rows, filename, note, topics }) {
      const topicId = `${trackId}_${slugify(topicTitle || 'imported')}_${Date.now().toString(36)}`;
      for (const t of topics || []) {
        if (!t?.id) continue;
        const existing = state.topics.find((x) => x.id === t.id);
        if (existing) {
          Object.assign(existing, {
            track_id: t.track_id || trackId,
            title: t.title || existing.title,
            description: t.description || existing.description || '',
            pts_ref: t.pts_ref || existing.pts_ref || '',
            sort_order: t.sort_order ?? existing.sort_order ?? 100
          });
        } else {
          state.topics.push({
            id: t.id,
            track_id: t.track_id || trackId,
            title: t.title || 'Imported',
            description: t.description || 'Uploaded study deck',
            pts_ref: t.pts_ref || '',
            sort_order: t.sort_order ?? 100
          });
        }
      }
      if (!state.topics.some((t) => t.id === topicId)) {
        state.topics.push({
          id: topicId,
          track_id: trackId,
          title: topicTitle || 'Imported',
          description: 'Uploaded study deck',
          pts_ref: '',
          sort_order: 100
        });
      }
      let count = 0;
      for (const row of rows) {
        const id = row.id || `imp_${randomUUID().slice(0, 8)}`;
        const next = {
          id,
          track_id: trackId,
          topic_id: row.topic_id || topicId,
          question: row.question,
          answer: row.answer,
          choices: row.choices || null,
          source: row.source || filename || 'import',
          tags: row.tags || ['imported']
        };
        if (row.topic_title && row.topic_id && !state.topics.some((t) => t.id === row.topic_id)) {
          state.topics.push({
            id: row.topic_id,
            track_id: trackId,
            title: row.topic_title,
            description: 'Uploaded',
            pts_ref: '',
            sort_order: 100
          });
        }
        const idx = state.cards.findIndex((c) => c.id === id);
        if (idx >= 0) state.cards[idx] = { ...state.cards[idx], ...next };
        else state.cards.push(next);
        count += 1;
      }
      const track = state.tracks.find((t) => t.id === trackId);
      if (track && track.status === 'upload_later') track.status = 'ready';
      state.imports.push({
        id: state.imports.length + 1,
        track_id: trackId,
        filename: filename || '',
        card_count: count,
        note: note || '',
        created_at: new Date().toISOString()
      });
      return { topicId, count };
    },
    async listImports() {
      return [...state.imports].reverse();
    },
    async stats(userKey) {
      const cards = state.cards.length;
      const prog = await this.getProgress(userKey);
      const due = prog.filter((p) => new Date(p.due_at) <= new Date()).length;
      const todayKey = activityDateKey();
      const todayXp = Number(state.dailyActivity.get(`${userKey}::${todayKey}`) || 0);
      return {
        cards,
        studied: prog.length,
        due,
        tracks: state.tracks.length,
        courses: state.tracks.length,
        today_xp: todayXp
      };
    },
    async progressByTrack(userKey) {
      const prog = await this.getProgress(userKey);
      const byCard = new Map(prog.map((p) => [p.card_id, p]));
      const now = Date.now();
      return state.tracks
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((t) => {
          const cards = state.cards.filter((c) => c.track_id === t.id);
          const grades = { again: 0, hard: 0, good: 0, easy: 0 };
          let studied = 0;
          let due = 0;
          for (const c of cards) {
            const p = byCard.get(c.id);
            if (!p) continue;
            studied += 1;
            if (new Date(p.due_at).getTime() <= now) due += 1;
            const g = String(p.last_result || '').toLowerCase();
            if (grades[g] != null) grades[g] += 1;
          }
          return {
            id: t.id,
            title: t.title,
            status: t.status,
            card_count: cards.length,
            studied,
            due,
            new: Math.max(0, cards.length - studied),
            ...grades
          };
        });
    }
  };
}

export function createPgStore(db) {
  return {
    async listTracks() {
      const { rows } = await db.query(
        'SELECT * FROM glider_tracks ORDER BY sort_order, title'
      );
      return rows;
    },
    async listTopics(trackId) {
      const { rows } = trackId
        ? await db.query(
            'SELECT * FROM glider_topics WHERE track_id = $1 ORDER BY sort_order, title',
            [trackId]
          )
        : await db.query('SELECT * FROM glider_topics ORDER BY sort_order, title');
      return rows;
    },
    async listCards({ trackId, topicId } = {}) {
      const clauses = [];
      const params = [];
      if (trackId) {
        params.push(trackId);
        clauses.push(`track_id = $${params.length}`);
      }
      if (topicId) {
        params.push(topicId);
        clauses.push(`topic_id = $${params.length}`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const { rows } = await db.query(
        `SELECT * FROM glider_cards ${where} ORDER BY topic_id, id`,
        params
      );
      return rows.map((r) => ({
        ...r,
        choices: r.choices || null
      }));
    },
    async getCard(id) {
      const { rows } = await db.query('SELECT * FROM glider_cards WHERE id = $1', [id]);
      return rows[0] || null;
    },
    async updateCard(id, body) {
      const patch = normalizeCardPatch(body);
      const fields = [];
      const params = [];
      for (const key of ['question', 'answer', 'source', 'topic_id']) {
        if (patch[key] !== undefined) {
          params.push(patch[key]);
          fields.push(`${key} = $${params.length}`);
        }
      }
      if (patch.choices !== undefined) {
        params.push(patch.choices ? JSON.stringify(patch.choices) : null);
        fields.push(`choices = $${params.length}::jsonb`);
      }
      params.push(id);
      const { rows } = await db.query(
        `UPDATE glider_cards SET ${fields.join(', ')}, updated_at = NOW()
         WHERE id = $${params.length}
         RETURNING *`,
        params
      );
      if (!rows[0]) return null;
      return {
        ...rows[0],
        choices: rows[0].choices || null
      };
    },
    async getProgress(userKey) {
      const { rows } = await db.query(
        'SELECT * FROM glider_progress WHERE user_key = $1',
        [userKey]
      );
      return rows;
    },
    async getProgressOne(userKey, cardId) {
      const { rows } = await db.query(
        'SELECT * FROM glider_progress WHERE user_key = $1 AND card_id = $2',
        [userKey, cardId]
      );
      return rows[0] || null;
    },
    async upsertProgress(userKey, cardId, patch) {
      const { rows } = await db.query(
        `INSERT INTO glider_progress
          (user_key, card_id, ease, interval_days, due_at, reps, lapses, last_result, last_studied_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_key, card_id) DO UPDATE SET
           ease = EXCLUDED.ease,
           interval_days = EXCLUDED.interval_days,
           due_at = EXCLUDED.due_at,
           reps = EXCLUDED.reps,
           lapses = EXCLUDED.lapses,
           last_result = EXCLUDED.last_result,
           last_studied_at = EXCLUDED.last_studied_at
         RETURNING *`,
        [
          userKey,
          cardId,
          patch.ease,
          patch.interval_days,
          patch.due_at,
          patch.reps,
          patch.lapses,
          patch.last_result,
          patch.last_studied_at
        ]
      );
      return rows[0];
    },
    async recordAnswer(userKey, pointsOrWhen = 1, maybeWhen) {
      const points = typeof pointsOrWhen === 'number'
        ? Math.max(0, Math.floor(pointsOrWhen))
        : 1;
      const when = typeof pointsOrWhen === 'number'
        ? (maybeWhen instanceof Date ? maybeWhen : new Date())
        : (pointsOrWhen instanceof Date ? pointsOrWhen : new Date());
      const date = activityDateKey(when);
      const { rows } = await db.query(
        `INSERT INTO glider_daily_activity (user_key, activity_date, answers)
         VALUES ($1, $2::date, $3)
         ON CONFLICT (user_key, activity_date) DO UPDATE SET
           answers = glider_daily_activity.answers + EXCLUDED.answers
         RETURNING user_key, activity_date::text AS activity_date, answers`,
        [userKey, date, points]
      );
      return { ...rows[0], xp_awarded: points };
    },
    async leagueSummary(userKey, { days = 7 } = {}) {
      const n = Math.max(1, Math.min(30, Number(days) || 7));
      const dates = listRecentDateKeys(n);
      const start = dates[0];
      const { rows } = await db.query(
        `SELECT user_key, activity_date::text AS activity_date, answers
         FROM glider_daily_activity
         WHERE activity_date >= $1::date`,
        [start]
      );
      const countsByUserDate = new Map();
      for (const row of rows) {
        countsByUserDate.set(`${row.user_key}::${row.activity_date}`, Number(row.answers) || 0);
      }
      const userKeys = [...new Set(rows.map((r) => r.user_key).concat(userKey))];
      const profilesByKey = new Map();
      if (userKeys.length) {
        const { rows: users } = await db.query(
          `SELECT google_sub, email, name, picture
           FROM glider_users
           WHERE ('g:' || google_sub) = ANY($1::text[])`,
          [userKeys]
        );
        for (const u of users) {
          const key = `g:${u.google_sub}`;
          profilesByKey.set(key, {
            userKey: key,
            email: u.email,
            name: u.name,
            picture: u.picture
          });
        }
      }
      return buildLeagueSummary({
        userKey,
        days: n,
        profilesByKey,
        countsByUserDate
      });
    },
    async importCards({ trackId, topicTitle, rows, filename, note, topics }) {
      const topicId = `${trackId}_${slugify(topicTitle || 'imported')}_${Date.now().toString(36)}`;
      for (const t of topics || []) {
        if (!t?.id) continue;
        await db.query(
          `INSERT INTO glider_topics (id, track_id, title, description, pts_ref, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             track_id = EXCLUDED.track_id,
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             pts_ref = EXCLUDED.pts_ref,
             sort_order = EXCLUDED.sort_order`,
          [
            t.id,
            t.track_id || trackId,
            t.title || 'Imported',
            t.description || 'Uploaded study deck',
            t.pts_ref || '',
            t.sort_order ?? 100
          ]
        );
      }
      await db.query(
        `INSERT INTO glider_topics (id, track_id, title, description, pts_ref, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [topicId, trackId, topicTitle || 'Imported', 'Uploaded study deck', '', 100]
      );
      let count = 0;
      for (const row of rows) {
        const id = row.id || `imp_${randomUUID().slice(0, 8)}`;
        const topic = row.topic_id || topicId;
        if (row.topic_title && row.topic_id) {
          await db.query(
            `INSERT INTO glider_topics (id, track_id, title, description, pts_ref, sort_order)
             VALUES ($1,$2,$3,'Uploaded','',100)
             ON CONFLICT (id) DO UPDATE SET
               title = COALESCE(NULLIF(EXCLUDED.title, ''), glider_topics.title)`,
            [row.topic_id, trackId, row.topic_title]
          );
        }
        await db.query(
          `INSERT INTO glider_cards (id, track_id, topic_id, question, answer, choices, source, tags, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,NOW())
           ON CONFLICT (id) DO UPDATE SET
             topic_id = EXCLUDED.topic_id,
             question = EXCLUDED.question,
             answer = EXCLUDED.answer,
             choices = EXCLUDED.choices,
             source = EXCLUDED.source,
             tags = EXCLUDED.tags,
             updated_at = NOW()`,
          [
            id,
            trackId,
            topic,
            row.question,
            row.answer,
            row.choices ? JSON.stringify(row.choices) : null,
            row.source || filename || 'import',
            row.tags || ['imported']
          ]
        );
        count += 1;
      }
      await db.query(
        `UPDATE glider_tracks SET status = 'ready' WHERE id = $1 AND status = 'upload_later'`,
        [trackId]
      );
      await db.query(
        `INSERT INTO glider_imports (track_id, filename, card_count, note)
         VALUES ($1,$2,$3,$4)`,
        [trackId, filename || '', count, note || '']
      );
      return { topicId, count };
    },
    async listImports() {
      const { rows } = await db.query(
        'SELECT * FROM glider_imports ORDER BY created_at DESC LIMIT 50'
      );
      return rows;
    },
    async stats(userKey) {
      const cards = await db.query('SELECT COUNT(*)::int AS n FROM glider_cards');
      const studied = await db.query(
        'SELECT COUNT(*)::int AS n FROM glider_progress WHERE user_key = $1',
        [userKey]
      );
      const due = await db.query(
        `SELECT COUNT(*)::int AS n FROM glider_progress
         WHERE user_key = $1 AND due_at <= NOW()`,
        [userKey]
      );
      const tracks = await db.query('SELECT COUNT(*)::int AS n FROM glider_tracks');
      const today = activityDateKey();
      const xp = await db.query(
        `SELECT COALESCE(answers, 0)::int AS n
         FROM glider_daily_activity
         WHERE user_key = $1 AND activity_date = $2::date`,
        [userKey, today]
      );
      return {
        cards: cards.rows[0].n,
        studied: studied.rows[0].n,
        due: due.rows[0].n,
        tracks: tracks.rows[0].n,
        courses: tracks.rows[0].n,
        today_xp: xp.rows[0]?.n || 0
      };
    },
    async progressByTrack(userKey) {
      const { rows } = await db.query(
        `SELECT
           t.id,
           t.title,
           t.status,
           t.sort_order,
           COUNT(c.id)::int AS card_count,
           COUNT(p.card_id)::int AS studied,
           COUNT(*) FILTER (WHERE p.card_id IS NOT NULL AND p.due_at <= NOW())::int AS due,
           COUNT(*) FILTER (WHERE p.last_result = 'again')::int AS again,
           COUNT(*) FILTER (WHERE p.last_result = 'hard')::int AS hard,
           COUNT(*) FILTER (WHERE p.last_result = 'good')::int AS good,
           COUNT(*) FILTER (WHERE p.last_result = 'easy')::int AS easy
         FROM glider_tracks t
         LEFT JOIN glider_cards c ON c.track_id = t.id
         LEFT JOIN glider_progress p ON p.card_id = c.id AND p.user_key = $1
         GROUP BY t.id, t.title, t.status, t.sort_order
         ORDER BY t.sort_order, t.title`,
        [userKey]
      );
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        card_count: r.card_count,
        studied: r.studied,
        due: r.due,
        new: Math.max(0, r.card_count - r.studied),
        again: r.again,
        hard: r.hard,
        good: r.good,
        easy: r.easy
      }));
    }
  };
}

export async function createStore(db) {
  if (db) return createPgStore(db);
  const seed = await loadSeedFile();
  console.warn('[glider-training] using in-memory seed store (no DATABASE_URL)');
  return createMemoryStore(seed);
}

export function parseImportPayload(body) {
  const trackId = String(body.track_id || body.track || '').trim();
  if (!['private', 'cfi_g', 'commercial', 'common', 'aircraft_233'].includes(trackId)) {
    throw new Error('track_id must be one of: private, cfi_g, commercial, common, aircraft_233');
  }
  let rows = body.cards || body.rows || [];
  if (typeof body.csv === 'string' && body.csv.trim()) {
    rows = parseCsv(body.csv);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Provide cards[] or csv with question,answer columns');
  }
  const normalized = rows.map((r, i) => {
    const question = String(r.question || r.q || '').trim();
    const answer = String(r.answer || r.a || '').trim();
    if (!question || !answer) {
      throw new Error(`Row ${i + 1} missing question or answer`);
    }
    return {
      id: r.id ? String(r.id) : undefined,
      topic_id: r.topic_id ? String(r.topic_id) : undefined,
      topic_title: r.topic || r.topic_title || undefined,
      question,
      answer,
      choices: Array.isArray(r.choices) ? r.choices : null,
      source: r.source || '',
      tags: Array.isArray(r.tags) ? r.tags : ['imported']
    };
  });
  const topics = Array.isArray(body.topics)
    ? body.topics
        .filter((t) => t && t.id)
        .map((t) => ({
          id: String(t.id),
          track_id: t.track_id ? String(t.track_id) : trackId,
          title: String(t.title || t.id),
          description: String(t.description || ''),
          pts_ref: String(t.pts_ref || ''),
          sort_order: Number.isFinite(Number(t.sort_order)) ? Number(t.sort_order) : 100
        }))
    : [];
  return {
    trackId,
    topicTitle: body.topic_title || body.topic || 'Imported deck',
    rows: normalized,
    filename: body.filename || '',
    note: body.note || '',
    topics
  };
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const qIdx = headers.indexOf('question') >= 0 ? headers.indexOf('question') : headers.indexOf('q');
  const aIdx =
    headers.indexOf('answer') >= 0
      ? headers.indexOf('answer')
      : headers.indexOf('correct answer') >= 0
        ? headers.indexOf('correct answer')
        : headers.indexOf('a');
  const topicIdx = headers.indexOf('topic');
  const idIdx = headers.indexOf('id');
  const choiceA = headers.indexOf('choice a');
  const choiceB = headers.indexOf('choice b');
  const choiceC = headers.indexOf('choice c');
  const choiceD = headers.indexOf('choice d');
  const answerKeyIdx = headers.indexOf('answer key');
  const sourceIdx = headers.indexOf('source pdf') >= 0 ? headers.indexOf('source pdf') : headers.indexOf('source');
  if (qIdx < 0 || aIdx < 0) throw new Error('CSV needs question,answer headers');
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const choices = [choiceA, choiceB, choiceC, choiceD]
      .filter((idx) => idx >= 0)
      .map((idx) => String(cols[idx] || '').trim())
      .filter(Boolean);
    let answer = cols[aIdx];
    if ((!answer || !String(answer).trim()) && answerKeyIdx >= 0 && choices.length) {
      const key = String(cols[answerKeyIdx] || '')
        .trim()
        .toUpperCase();
      const map = { A: 0, B: 1, C: 2, D: 3 };
      if (map[key] != null && choices[map[key]]) answer = choices[map[key]];
    }
    return {
      id: idIdx >= 0 ? cols[idIdx] : undefined,
      topic_title: topicIdx >= 0 ? cols[topicIdx] : undefined,
      question: cols[qIdx],
      answer,
      choices: choices.length ? choices : null,
      source: sourceIdx >= 0 ? cols[sourceIdx] : undefined
    };
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
