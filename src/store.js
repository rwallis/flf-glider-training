import { randomUUID } from 'node:crypto';
import { loadSeedFile } from './seed.js';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
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
    imports: []
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
    async importCards({ trackId, topicTitle, rows, filename, note }) {
      const topicId = `${trackId}_${slugify(topicTitle || 'imported')}_${Date.now().toString(36)}`;
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
        state.cards.push({
          id,
          track_id: trackId,
          topic_id: row.topic_id || topicId,
          question: row.question,
          answer: row.answer,
          choices: row.choices || null,
          source: row.source || filename || 'import',
          tags: row.tags || ['imported']
        });
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
      return {
        cards,
        studied: prog.length,
        due,
        tracks: state.tracks.length
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
      for (const key of ['question', 'answer', 'source']) {
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
    async importCards({ trackId, topicTitle, rows, filename, note }) {
      const topicId = `${trackId}_${slugify(topicTitle || 'imported')}_${Date.now().toString(36)}`;
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
             ON CONFLICT (id) DO NOTHING`,
            [row.topic_id, trackId, row.topic_title]
          );
        }
        await db.query(
          `INSERT INTO glider_cards (id, track_id, topic_id, question, answer, choices, source, tags, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,NOW())
           ON CONFLICT (id) DO UPDATE SET
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
      return {
        cards: cards.rows[0].n,
        studied: studied.rows[0].n,
        due: due.rows[0].n,
        tracks: tracks.rows[0].n
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
  return {
    trackId,
    topicTitle: body.topic_title || body.topic || 'Imported deck',
    rows: normalized,
    filename: body.filename || '',
    note: body.note || ''
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
