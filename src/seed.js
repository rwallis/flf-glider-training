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
const FOI_IMPORT_PATH = path.join(__dirname, '..', 'content', 'foi-import', 'foi-import.json');
const PRIVATE_IMPORT_PATH = path.join(
  __dirname,
  '..',
  'content',
  'private-import',
  'private-import.json'
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

async function loadImportBank(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    return {
      trackId: String(data.track_id || '').trim(),
      topics: Array.isArray(data.topics) ? data.topics : [],
      cards: Array.isArray(data.cards) ? data.cards : []
    };
  } catch {
    return { trackId: '', topics: [], cards: [] };
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
    const tags = Array.isArray(card.tags) ? card.tags : [];
    // Examiner airspeed cards always refresh so MCQ answer text stays exact-match with a choice.
    const alwaysRefresh = tags.includes('examiner');
    if (!force && !alwaysRefresh) {
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
        tags
      ]
    );
    cards += 1;
  }

  // Seed Fundamentals of Instruction (FOI) bank from import JSON.
  const foiBank = await loadImportBank(FOI_IMPORT_PATH);
  let foiCards = 0;
  if (foiBank.trackId === 'foi') {
    for (const topic of foiBank.topics) {
      if (!topic?.id) continue;
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
          String(topic.id),
          'foi',
          String(topic.title || topic.id),
          String(topic.description || ''),
          String(topic.pts_ref || ''),
          Number.isFinite(Number(topic.sort_order)) ? Number(topic.sort_order) : 100
        ]
      );
      topics += 1;
    }
    for (const card of foiBank.cards) {
      if (!card?.id || !card?.question || !card?.answer) continue;
      const tags = Array.isArray(card.tags) ? card.tags : ['imported', 'foi_written', 'multiple_choice', 'foi'];
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
          String(card.id),
          'foi',
          card.topic_id ? String(card.topic_id) : null,
          String(card.question),
          String(card.answer),
          card.choices ? JSON.stringify(card.choices) : null,
          String(card.source || 'FOI written · IMG_0002.pdf'),
          tags
        ]
      );
      cards += 1;
      foiCards += 1;
    }
  }

  // Seed Private Pilot Glider bank from import JSON.
  const privateBank = await loadImportBank(PRIVATE_IMPORT_PATH);
  let privateCards = 0;
  if (privateBank.trackId === 'private') {
    for (const topic of privateBank.topics) {
      if (!topic?.id) continue;
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
          String(topic.id),
          'private',
          String(topic.title || topic.id),
          String(topic.description || ''),
          String(topic.pts_ref || ''),
          Number.isFinite(Number(topic.sort_order)) ? Number(topic.sort_order) : 100
        ]
      );
      topics += 1;
    }
    for (const card of privateBank.cards) {
      if (!card?.id || !card?.question || !card?.answer) continue;
      if (String(card.answer).startsWith('[missing')) continue;
      const tags = Array.isArray(card.tags)
        ? card.tags
        : ['imported', 'private_written', 'multiple_choice', 'private'];
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
          String(card.id),
          'private',
          card.topic_id ? String(card.topic_id) : null,
          String(card.question),
          String(card.answer),
          card.choices ? JSON.stringify(card.choices) : null,
          String(card.source || 'Private written · IMG_0003.pdf'),
          tags
        ]
      );
      cards += 1;
      privateCards += 1;
    }
  }

  // Drop retired 1,080 lb examiner airspeed cards (progress cascades).
  const retired1080 = [
    'a233_vs_1080',
    'a233_vso_1080',
    'a233_stall30_1080',
    'a233_buffet_1080',
    'a233_minsink_1080',
    'a233_bestglide_1080',
    'a233_thermal_1080',
    'a233_aerotow_max_1080',
    'a233_winch_max_1080'
  ];
  const retired = await db.query(
    `DELETE FROM glider_cards WHERE id = ANY($1::text[])`,
    [retired1080]
  );
  const cardsRetired = retired.rowCount || 0;

  // Re-apply syllabus topic_ids from classified import banks.
  let topicRemaps = 0;
  const bankRemaps = [
    { trackId: 'cfi_g', cards: await loadTopicAssignments(CFI_G_IMPORT_PATH) },
    { trackId: 'commercial', cards: await loadTopicAssignments(COMMERCIAL_IMPORT_PATH) },
    { trackId: 'foi', cards: foiBank.cards },
    { trackId: 'private', cards: privateBank.cards }
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
  await db.query(
    `DELETE FROM glider_topics t
     WHERE t.track_id = 'private'
       AND t.id = 'priv_placeholder'
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

  // Keep MC seed answers aligned with a selectable choice (grading requires exact match).
  let answersAligned = 0;
  for (const card of seed.cards || []) {
    const choices = Array.isArray(card.choices)
      ? card.choices.map((c) => String(c ?? '').trim()).filter(Boolean)
      : [];
    const answer = String(card.answer || '').trim();
    if (choices.length < 2 || !answer) continue;
    const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!choices.some((ch) => norm(ch) === norm(answer))) continue;
    const result = await db.query(
      `UPDATE glider_cards
       SET answer = $2, choices = $3::jsonb, updated_at = NOW()
       WHERE id = $1
         AND (
           answer IS DISTINCT FROM $2
           OR choices IS DISTINCT FROM $3::jsonb
         )`,
      [card.id, answer, JSON.stringify(choices)]
    );
    answersAligned += result.rowCount || 0;
  }

  // Flag MC cards whose answer is not one of the choices (study grading cannot select it).
  let answerFlags = 0;
  const { rows: mcRows } = await db.query(
    `SELECT id, track_id, question, answer, choices
     FROM glider_cards
     WHERE choices IS NOT NULL
       AND jsonb_typeof(choices) = 'array'
       AND jsonb_array_length(choices) >= 2`
  );
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  for (const row of mcRows) {
    const choices = Array.isArray(row.choices)
      ? row.choices.map((c) => String(c ?? '').trim())
      : [];
    const answer = String(row.answer || '').trim();
    const ok =
      Boolean(answer) &&
      choices.some((ch) => norm(ch) === norm(answer)) &&
      !choices.some((ch) => !ch || /\[missing\]|\[truncated\]/i.test(ch));
    if (ok) continue;
    const note = !answer
      ? 'Audit: multiple-choice card has no answer selected.'
      : 'Audit: answer text is not one of the listed choices (cannot be selected).';
    const existing = await db.query(
      `SELECT 1 FROM glider_card_flags
       WHERE card_id = $1
         AND user_key = 'system:answer-audit'
         AND status = 'open'
       LIMIT 1`,
      [row.id]
    );
    if (existing.rowCount) continue;
    await db.query(
      `INSERT INTO glider_card_flags (card_id, user_key, note, status)
       VALUES ($1, 'system:answer-audit', $2, 'open')`,
      [row.id, note]
    );
    answerFlags += 1;
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

  // Push reviewed question fixes into cards that were inserted on an earlier boot
  // (import banks skip existing rows unless force is set).
  const correctedIds = [
    'private_written_174',
    'private_written_175',
    'private_written_176',
    'private_written_248',
    'private_written_256',
    'private_written_284',
    'private_written_288',
    'private_written_293',
    'private_written_298',
    'private_written_301',
    'private_written_310',
    'private_written_331',
    'private_written_332',
    'private_written_334',
    'private_written_339',
    'private_written_349',
    'private_written_350',
    'private_written_352',
    'private_written_360',
    'private_written_368',
    'private_written_373',
    'private_written_374',
    'private_written_384',
    'private_written_404',
    'private_written_408',
    'private_written_409',
    'private_written_410',
    'private_written_411',
    'cfi_g_bank_135',
    'cfi_g_bank_141',
    'cfi_g_bank_156',
    'cfi_g_bank_178',
    'cfi_g_bank_188',
    'cfi_g_bank_190',
    'cfi_g_bank_209',
    'cfi_g_bank_213',
    'cfi_g_bank_216',
    'cfi_g_bank_356',
    'cfi_g_bank_443',
    'cfi_g_bank_658',
    'cfi_g_bank_677'
  ];
  const retiredCorrectionIds = [
    'private_written_016',
    'private_written_211',
    'private_written_234',
    'private_written_263',
    'private_written_274',
    'private_written_359',
    'private_written_372',
    'cfi_g_bank_533',
    'cfi_g_bank_A moist air mass',
    'foi_written_154'
  ];
  const flaggedIds = [
    'private_written_136',
    'private_written_175',
    'private_written_192',
    'private_written_193',
    'private_written_284',
    'private_written_293',
    'private_written_332',
    'private_written_334',
    'private_written_349',
    'private_written_350',
    'private_written_352',
    'private_written_368',
    'private_written_372',
    'private_written_373',
    'private_written_442'
  ];
  const cfiBank = await loadImportBank(CFI_G_IMPORT_PATH);
  const correctedById = new Map();
  for (const card of [...privateBank.cards, ...cfiBank.cards, ...foiBank.cards]) {
    if (card?.id) correctedById.set(String(card.id), card);
  }
  let correctionsApplied = 0;
  for (const id of correctedIds) {
    const card = correctedById.get(id);
    if (!card?.question || !card?.answer) continue;
    const result = await db.query(
      `UPDATE glider_cards
       SET question = $2, answer = $3, choices = $4::jsonb, updated_at = NOW()
       WHERE id = $1
         AND (
           question IS DISTINCT FROM $2
           OR answer IS DISTINCT FROM $3
           OR choices IS DISTINCT FROM $4::jsonb
         )`,
      [
        id,
        String(card.question),
        String(card.answer),
        card.choices ? JSON.stringify(card.choices) : null
      ]
    );
    correctionsApplied += result.rowCount || 0;
  }
  const retiredCorrections = await db.query(
    `DELETE FROM glider_cards WHERE id = ANY($1::text[])`,
    [retiredCorrectionIds]
  );
  const flagKey = 'question_corrections_flags_v1';
  const flagSetting = await db.query('SELECT 1 FROM glider_settings WHERE key = $1', [flagKey]);
  let flagsResolved = 0;
  if (!flagSetting.rowCount) {
    const resolved = await db.query(
      `UPDATE glider_card_flags
       SET status = 'resolved'
       WHERE status = 'open' AND card_id = ANY($1::text[])`,
      [[...new Set([...flaggedIds, ...correctedIds, ...retiredCorrectionIds])]]
    );
    flagsResolved = resolved.rowCount || 0;
    await db.query(
      `INSERT INTO glider_settings (key, value) VALUES ($1, 'true'::jsonb)
       ON CONFLICT (key) DO NOTHING`,
      [flagKey]
    );
  }

  return {
    tracks,
    topics,
    cards,
    foi_cards: foiCards,
    private_cards: privateCards,
    cards_retired: cardsRetired,
    force,
    cfi_g_topic_remaps: topicRemaps,
    card_details_upserted: detailsUpserted,
    card_figures_upserted: figuresUpserted,
    answers_aligned: answersAligned,
    answer_selection_flags: answerFlags,
    renamed_sfm_to_poh: renamed.rowCount || 0,
    corrections_applied: correctionsApplied,
    correction_cards_retired: retiredCorrections.rowCount || 0,
    flags_resolved: flagsResolved
  };
}
