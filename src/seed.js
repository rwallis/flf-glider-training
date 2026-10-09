import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'content', 'seed.json');

export async function loadSeedFile() {
  const raw = await readFile(SEED_PATH, 'utf8');
  return JSON.parse(raw);
}

/** Upsert tracks/topics/cards from seed. Does not delete user-imported cards. */
export async function seedGliderContent(db, { force = false } = {}) {
  if (!db) return { skipped: true, reason: 'no_db' };
  const seed = await loadSeedFile();
  let tracks = 0;
  let topics = 0;
  let cards = 0;

  for (const t of seed.tracks || []) {
    await db.query(
      `INSERT INTO glider_tracks (id, title, description, sort_order, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order,
         status = EXCLUDED.status`,
      [t.id, t.title, t.description || '', t.sort_order || 0, t.status || 'ready']
    );
    tracks += 1;
  }

  for (const topic of seed.topics || []) {
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
        topic.id,
        topic.track_id,
        topic.title,
        topic.description || '',
        topic.pts_ref || '',
        topic.sort_order || 0
      ]
    );
    topics += 1;
  }

  for (const card of seed.cards || []) {
    if (!force) {
      const existing = await db.query('SELECT 1 FROM glider_cards WHERE id = $1', [card.id]);
      if (existing.rowCount) continue;
    }
    await db.query(
      `INSERT INTO glider_cards (id, track_id, topic_id, question, answer, choices, source, tags, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         track_id = EXCLUDED.track_id,
         topic_id = EXCLUDED.topic_id,
         question = EXCLUDED.question,
         answer = EXCLUDED.answer,
         choices = EXCLUDED.choices,
         source = EXCLUDED.source,
         tags = EXCLUDED.tags,
         updated_at = NOW()`,
      [
        card.id,
        card.track_id,
        card.topic_id,
        card.question,
        card.answer,
        card.choices ? JSON.stringify(card.choices) : null,
        card.source || '',
        card.tags || []
      ]
    );
    cards += 1;
  }

  return { tracks, topics, cards, force };
}
