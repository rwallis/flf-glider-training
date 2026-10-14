import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'content', 'seed.json');
const CFI_G_IMPORT_PATH = path.join(
  __dirname,
  '..',
  'content',
  'cfi-g-import',
  'cfi-g-import.json'
);
const COMMERCIAL_IMPORT_PATH = path.join(
  __dirname,
  '..',
  'content',
  'commercial-import',
  'commercial-import.json'
);
const CARD_DETAILS_PATH = path.join(__dirname, '..', 'content', 'card-details.json');
const CARD_FIGURES_PATH = path.join(__dirname, '..', 'content', 'card-figures.json');

export async function loadSeedFile() {
  const raw = await readFile(SEED_PATH, 'utf8');
  return JSON.parse(raw);
}

async function loadTopicAssignments(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.cards) ? data.cards : [];
  } catch {
    return [];
  }
}

export async function loadCardDetails() {
  try {
    const raw = await readFile(CARD_DETAILS_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.details) ? data.details : [];
  } catch {
    return [];
  }
}

export function normalizeCardDetails(raw, { source } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const summary = String(raw.summary || '').trim();
  const links = Array.isArray(raw.links)
    ? raw.links
        .map((link) => ({
          label: String(link?.label || link?.title || '').trim(),
          url: String(link?.url || '').trim()
        }))
        .filter((link) => link.label && /^https?:\/\//i.test(link.url))
    : [];
  if (!summary && !links.length) return null;
  const out = { summary, links };
  const resolvedSource = source || raw.source;
  if (resolvedSource === 'manual') out.source = 'manual';
  return out;
}

export async function loadCardFigures() {
  try {
    const raw = await readFile(CARD_FIGURES_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.cards) ? data.cards : [];
  } catch {
    return [];
  }
}

export function normalizeCardFigure(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const number = Number(raw.figure ?? raw.number);
  const title = String(raw.title || '').trim() || (Number.isFinite(number) ? `Figure ${number}` : '');
  const url = String(raw.url || '').trim();
  if (!Number.isFinite(number) || number <= 0) return null;
  if (!url || !/^\/figures\//i.test(url)) return null;
  return { number, title, url };
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

  // Re-apply syllabus topic_ids from classified import banks.
  let topicRemaps = 0;
  const bankRemaps = [
    { trackId: 'cfi_g', cards: await loadTopicAssignments(CFI_G_IMPORT_PATH) },
    { trackId: 'commercial', cards: await loadTopicAssignments(COMMERCIAL_IMPORT_PATH) }
  ];
  for (const { trackId, cards: bankCards } of bankRemaps) {
    for (const card of bankCards) {
      if (!card?.id || !card?.topic_id) continue;
      const result = await db.query(
        `UPDATE glider_cards
         SET topic_id = $2, updated_at = NOW()
         WHERE id = $1 AND track_id = $3 AND topic_id IS DISTINCT FROM $2`,
        [String(card.id), String(card.topic_id), trackId]
      );
      topicRemaps += result.rowCount || 0;
    }
  }

  // Retire obsolete CFI-G placeholder topics (stubs now point at syllabus topics).
  const stubFixes = [
    ['cfi_stub_1', 'cfi_endorsements'],
    ['cfi_foi_levels', 'cfi_foi']
  ];
  for (const [cardId, topicId] of stubFixes) {
    const result = await db.query(
      `UPDATE glider_cards
       SET topic_id = $2, updated_at = NOW()
       WHERE id = $1 AND topic_id IS DISTINCT FROM $2`,
      [cardId, topicId]
    );
    topicRemaps += result.rowCount || 0;
  }
  await db.query(
    `DELETE FROM glider_topics t
     WHERE t.track_id = 'cfi_g'
       AND (
         t.id IN ('cfi_placeholder', 'cfi_foi_stub')
         OR t.id LIKE 'cfi_g_cfi_g_written_question_bank_%'
       )
       AND NOT EXISTS (SELECT 1 FROM glider_cards c WHERE c.topic_id = t.id)`
  );
  await db.query(
    `DELETE FROM glider_topics t
     WHERE t.track_id = 'commercial'
       AND t.id LIKE 'commercial_commercial_written_%'
       AND NOT EXISTS (SELECT 1 FROM glider_cards c WHERE c.topic_id = t.id)`
  );

  // Upsert per-question study details / reference links.
  const detailRows = await loadCardDetails();
  let detailsUpserted = 0;
  for (const row of detailRows) {
    const cardId = String(row?.card_id || '').trim();
    const details = normalizeCardDetails(row);
    if (!cardId || !details) continue;
    // Do not overwrite Details that were edited in the app (source=manual).
    const result = force
      ? await db.query(
          `UPDATE glider_cards
           SET details = $2::jsonb, updated_at = NOW()
           WHERE id = $1`,
          [cardId, JSON.stringify(details)]
        )
      : await db.query(
          `UPDATE glider_cards
           SET details = $2::jsonb, updated_at = NOW()
           WHERE id = $1
             AND (details IS NULL OR COALESCE(details->>'source', '') <> 'manual')`,
          [cardId, JSON.stringify(details)]
        );
    detailsUpserted += result.rowCount || 0;
  }

  // Upsert GPGS / FAA testing-supplement figure links.
  const figureRows = await loadCardFigures();
  let figuresUpserted = 0;
  for (const row of figureRows) {
    const cardId = String(row?.card_id || '').trim();
    const figure = normalizeCardFigure(row);
    if (!cardId || !figure) continue;
    const result = await db.query(
      `UPDATE glider_cards
       SET figure = $2::jsonb, updated_at = NOW()
       WHERE id = $1`,
      [cardId, JSON.stringify(figure)]
    );
    figuresUpserted += result.rowCount || 0;
  }

  // Keep live DB wording aligned: SFM → POH (Pilot's Operating Handbook).
  const renamed = await db.query(
    `UPDATE glider_cards SET
       question = REPLACE(question, 'SFM', 'POH'),
       answer = REPLACE(answer, 'SFM', 'POH'),
       source = REPLACE(source, 'SFM', 'POH'),
       choices = CASE
         WHEN choices IS NULL THEN NULL
         ELSE (
           SELECT COALESCE(jsonb_agg(to_jsonb(REPLACE(value, 'SFM', 'POH'))), '[]'::jsonb)
           FROM jsonb_array_elements_text(choices) AS value
         )
       END,
       updated_at = NOW()
     WHERE question LIKE '%SFM%'
        OR answer LIKE '%SFM%'
        OR source LIKE '%SFM%'
        OR choices::text LIKE '%SFM%'`
  );
  await db.query(
    `UPDATE glider_topics SET
       description = REPLACE(description, 'SFM', 'POH'),
       pts_ref = REPLACE(pts_ref, 'SFM', 'POH')
     WHERE description LIKE '%SFM%' OR pts_ref LIKE '%SFM%'`
  );
  await db.query(
    `UPDATE glider_tracks SET
       description = REPLACE(description, 'SFM', 'POH')
     WHERE description LIKE '%SFM%'`
  );

  return {
    tracks,
    topics,
    cards,
    force,
    cfi_g_topic_remaps: topicRemaps,
    card_details_upserted: detailsUpserted,
    card_figures_upserted: figuresUpserted,
    renamed_sfm_to_poh: renamed.rowCount || 0
  };
}
