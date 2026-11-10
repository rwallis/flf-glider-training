import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { collectSessionSeedContent } from './classroom/packages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'content', 'seed.json');
const SESSIONS_DIR = path.join(__dirname, '..', 'content', 'sessions');
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

const FINGERPRINT_KEY = 'content_seed_fingerprint_v1';
const WRITE_BATCH = 100;

const RETIRED_1080_IDS = [
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

const CORRECTED_IDS = [
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
  'cfi_g_bank_677',
  'foi_written_255',
  'foi_written_276'
];

const RETIRED_CORRECTION_IDS = [
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

const FLAGGED_IDS = [
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

const STUB_FIXES = [
  ['cfi_stub_1', 'cfi_endorsements'],
  ['cfi_foi_levels', 'cfi_foi']
];

function seedLogicStamp() {
  return JSON.stringify({
    rev: 1,
    retired1080: RETIRED_1080_IDS,
    correctedIds: CORRECTED_IDS,
    retiredCorrectionIds: RETIRED_CORRECTION_IDS,
    flaggedIds: FLAGGED_IDS,
    stubFixes: STUB_FIXES
  });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalJson(value[key]);
    return out;
  }
  return value ?? null;
}

function jsonEqual(a, b) {
  return JSON.stringify(canonicalJson(a ?? null)) === JSON.stringify(canonicalJson(b ?? null));
}

function choiceText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function asTags(card, fallback) {
  return Array.isArray(card?.tags) ? card.tags : fallback;
}

function choicePayload(choices) {
  return choices ? choices : null;
}

function cardBody(card, { trackId, tags, source }) {
  return {
    id: String(card.id),
    track_id: trackId,
    topic_id: card.topic_id == null || card.topic_id === '' ? null : String(card.topic_id),
    question: card.question,
    answer: card.answer,
    choices: choicePayload(card.choices),
    source,
    tags,
    origin: trackId
  };
}

function bodyDiffers(existing, next) {
  return (
    existing.track_id !== next.track_id ||
    (existing.topic_id ?? null) !== (next.topic_id ?? null) ||
    existing.question !== next.question ||
    existing.answer !== next.answer ||
    (existing.source || '') !== (next.source || '') ||
    !jsonEqual(existing.choices ?? null, next.choices ?? null) ||
    !jsonEqual(existing.tags || [], next.tags || [])
  );
}

/**
 * Decide which cards to insert or update. Existing rows are left alone unless a
 * field this seed owns actually differs.
 */
export function planCardSeedWrites({
  force = false,
  existing = [],
  seedCards = [],
  foiCards = [],
  privateCards = [],
  topicRemaps = [],
  detailRows = [],
  figureRows = [],
  correctedById = new Map(),
  correctedIds = CORRECTED_IDS
} = {}) {
  const existingById = new Map(existing.map((row) => [String(row.id), row]));
  const inserts = [];
  const refreshes = [];

  const consider = (card, spec) => {
    if (!card?.id) return;
    const tags = asTags(card, spec.fallbackTags);
    const next = cardBody(card, {
      trackId: spec.trackId,
      tags,
      source: String(card.source || spec.sourceDefault || '')
    });
    const row = existingById.get(next.id);
    if (!row) {
      inserts.push(next);
      return;
    }
    if ((force || spec.alwaysRefresh) && bodyDiffers(row, next)) refreshes.push(next);
  };

  for (const card of seedCards) {
    const tags = asTags(card, []);
    consider(card, {
      trackId: card.track_id,
      fallbackTags: [],
      sourceDefault: '',
      alwaysRefresh: tags.includes('examiner')
    });
  }
  for (const card of foiCards) {
    if (!card?.question || !card?.answer) continue;
    consider(card, {
      trackId: 'foi',
      fallbackTags: ['imported', 'foi_written', 'multiple_choice', 'foi'],
      sourceDefault: 'FOI written · IMG_0002.pdf'
    });
  }
  for (const card of privateCards) {
    if (!card?.question || !card?.answer) continue;
    if (String(card.answer).startsWith('[missing')) continue;
    consider(card, {
      trackId: 'private',
      fallbackTags: ['imported', 'private_written', 'multiple_choice', 'private'],
      sourceDefault: 'Private written · IMG_0003.pdf'
    });
  }

  const placed = new Map();
  for (const row of existing) {
    placed.set(String(row.id), {
      track_id: row.track_id,
      topic_id: row.topic_id ?? null
    });
  }
  for (const row of [...inserts, ...refreshes]) {
    placed.set(row.id, { track_id: row.track_id, topic_id: row.topic_id });
  }

  const topicUpdates = [];
  for (const remap of topicRemaps) {
    if (!remap?.id || remap.topicId == null || remap.topicId === '') continue;
    const cur = placed.get(String(remap.id));
    if (!cur) continue;
    if (!remap.anyTrack && cur.track_id !== remap.trackId) continue;
    if ((cur.topic_id ?? null) === String(remap.topicId)) continue;
    const topicId = String(remap.topicId);
    topicUpdates.push({ id: String(remap.id), topic_id: topicId });
    cur.topic_id = topicId;
  }

  const liveIds = new Set([...existingById.keys(), ...inserts.map((row) => row.id)]);
  const detailUpdates = [];
  for (const row of detailRows) {
    const cardId = String(row?.card_id || '').trim();
    const details = normalizeCardDetails(row);
    if (!cardId || !details || !liveIds.has(cardId)) continue;
    const current = existingById.get(cardId);
    if (!force && current?.details && current.details.source === 'manual') continue;
    const currentNorm = current?.details ? normalizeCardDetails(current.details) : null;
    if (jsonEqual(currentNorm, details)) continue;
    detailUpdates.push({ id: cardId, details });
  }

  const figureUpdates = [];
  for (const row of figureRows) {
    const cardId = String(row?.card_id || '').trim();
    const figure = normalizeCardFigure(row);
    if (!cardId || !figure || !liveIds.has(cardId)) continue;
    const current = existingById.get(cardId);
    const currentNorm = current?.figure ? normalizeCardFigure(current.figure) : null;
    if (jsonEqual(currentNorm, figure)) continue;
    figureUpdates.push({ id: cardId, figure });
  }

  const answerAlignments = [];
  for (const card of seedCards) {
    if (!card?.id) continue;
    const choices = Array.isArray(card.choices)
      ? card.choices.map((choice) => String(choice ?? '').trim()).filter(Boolean)
      : [];
    const answer = String(card.answer || '').trim();
    if (choices.length < 2 || !answer) continue;
    if (!choices.some((choice) => choiceText(choice) === choiceText(answer))) continue;
    const current = existingById.get(String(card.id));
    if (!current) continue;
    const storedChoices = Array.isArray(current.choices) ? current.choices : [];
    if (current.answer === answer && jsonEqual(storedChoices, choices)) continue;
    answerAlignments.push({
      id: String(card.id),
      answer,
      choices
    });
  }

  const corrections = [];
  for (const id of correctedIds) {
    const card = correctedById.get(id);
    if (!card?.question || !card?.answer) continue;
    const current = existingById.get(id);
    if (!current) continue;
    const choices = choicePayload(card.choices);
    const question = String(card.question);
    const answer = String(card.answer);
    if (
      current.question === question &&
      current.answer === answer &&
      jsonEqual(current.choices ?? null, choices)
    ) {
      continue;
    }
    corrections.push({ id, question, answer, choices });
  }

  return {
    inserts,
    refreshes,
    topicUpdates,
    detailUpdates,
    figureUpdates,
    answerAlignments,
    corrections
  };
}

async function contentFingerprint() {
  const hash = createHash('sha256');
  hash.update(seedLogicStamp());
  const files = [
    SEED_PATH,
    CFI_G_IMPORT_PATH,
    COMMERCIAL_IMPORT_PATH,
    FOI_IMPORT_PATH,
    PRIVATE_IMPORT_PATH,
    CARD_DETAILS_PATH,
    CARD_FIGURES_PATH
  ];
  for (const file of files) {
    hash.update('\0');
    hash.update(file);
    try {
      hash.update(await readFile(file));
    } catch {
      hash.update('missing');
    }
  }
  try {
    const sessionFiles = (await readdir(SESSIONS_DIR))
      .filter((name) => name.endsWith('.json'))
      .sort();
    for (const name of sessionFiles) {
      const file = path.join(SESSIONS_DIR, name);
      hash.update('\0');
      hash.update(file);
      hash.update(await readFile(file));
    }
  } catch {
    hash.update('\0sessions-missing');
  }
  return hash.digest('hex');
}

function storedFingerprint(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.hash === 'string') return value.hash;
  return '';
}

function emptySeedResult(extra = {}) {
  return {
    tracks: 0,
    topics: 0,
    cards: 0,
    foi_cards: 0,
    private_cards: 0,
    cards_retired: 0,
    force: false,
    cfi_g_topic_remaps: 0,
    card_details_upserted: 0,
    card_figures_upserted: 0,
    answers_aligned: 0,
    answer_selection_flags: 0,
    renamed_sfm_to_poh: 0,
    corrections_applied: 0,
    correction_cards_retired: 0,
    flags_resolved: 0,
    content_unchanged: false,
    ...extra
  };
}

async function forEachBatch(rows, fn) {
  let count = 0;
  for (let i = 0; i < rows.length; i += WRITE_BATCH) {
    count += await fn(rows.slice(i, i + WRITE_BATCH));
  }
  return count;
}

async function upsertCardBodies(db, rows) {
  return forEachBatch(rows, async (chunk) => {
    const params = [];
    const values = chunk.map((row) => {
      const n = params.length;
      params.push(
        row.id,
        row.track_id,
        row.topic_id,
        row.question,
        row.answer,
        row.choices == null ? null : JSON.stringify(row.choices),
        row.source,
        row.tags
      );
      return `($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5}, $${n + 6}::jsonb, $${n + 7}, $${n + 8}, NOW())`;
    });
    await db.query(
      `INSERT INTO glider_cards (id, track_id, topic_id, question, answer, choices, source, tags, updated_at)
       VALUES ${values.join(', ')}
       ON CONFLICT (id) DO UPDATE SET
         track_id = EXCLUDED.track_id,
         topic_id = EXCLUDED.topic_id,
         question = EXCLUDED.question,
         answer = EXCLUDED.answer,
         choices = EXCLUDED.choices,
         source = EXCLUDED.source,
         tags = EXCLUDED.tags,
         updated_at = NOW()`,
      params
    );
    return chunk.length;
  });
}

async function updateTopics(db, rows) {
  return forEachBatch(rows, async (chunk) => {
    const result = await db.query(
      `UPDATE glider_cards AS c
       SET topic_id = v.topic_id, updated_at = NOW()
       FROM unnest($1::text[], $2::text[]) AS v(id, topic_id)
       WHERE c.id = v.id
         AND c.topic_id IS DISTINCT FROM v.topic_id`,
      [chunk.map((row) => row.id), chunk.map((row) => row.topic_id)]
    );
    return result.rowCount || 0;
  });
}

async function updateDetails(db, rows, { force }) {
  return forEachBatch(rows, async (chunk) => {
    const manualGuard = force
      ? ''
      : `AND (c.details IS NULL OR COALESCE(c.details->>'source', '') <> 'manual')`;
    const result = await db.query(
      `UPDATE glider_cards AS c
       SET details = v.details::jsonb, updated_at = NOW()
       FROM unnest($1::text[], $2::text[]) AS v(id, details)
       WHERE c.id = v.id
         ${manualGuard}
         AND c.details IS DISTINCT FROM v.details::jsonb`,
      [chunk.map((row) => row.id), chunk.map((row) => JSON.stringify(row.details))]
    );
    return result.rowCount || 0;
  });
}

async function updateFigures(db, rows) {
  return forEachBatch(rows, async (chunk) => {
    const result = await db.query(
      `UPDATE glider_cards AS c
       SET figure = v.figure::jsonb, updated_at = NOW()
       FROM unnest($1::text[], $2::text[]) AS v(id, figure)
       WHERE c.id = v.id
         AND c.figure IS DISTINCT FROM v.figure::jsonb`,
      [chunk.map((row) => row.id), chunk.map((row) => JSON.stringify(row.figure))]
    );
    return result.rowCount || 0;
  });
}

async function updateAnswers(db, rows) {
  return forEachBatch(rows, async (chunk) => {
    const result = await db.query(
      `UPDATE glider_cards AS c
       SET answer = v.answer, choices = v.choices::jsonb, updated_at = NOW()
       FROM unnest($1::text[], $2::text[], $3::text[]) AS v(id, answer, choices)
       WHERE c.id = v.id
         AND (
           c.answer IS DISTINCT FROM v.answer
           OR c.choices IS DISTINCT FROM v.choices::jsonb
         )`,
      [
        chunk.map((row) => row.id),
        chunk.map((row) => row.answer),
        chunk.map((row) => JSON.stringify(row.choices))
      ]
    );
    return result.rowCount || 0;
  });
}

async function updateCorrections(db, rows) {
  return forEachBatch(rows, async (chunk) => {
    const result = await db.query(
      `UPDATE glider_cards AS c
       SET question = v.question, answer = v.answer, choices = v.choices::jsonb, updated_at = NOW()
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) AS v(id, question, answer, choices)
       WHERE c.id = v.id
         AND (
           c.question IS DISTINCT FROM v.question
           OR c.answer IS DISTINCT FROM v.answer
           OR c.choices IS DISTINCT FROM v.choices::jsonb
         )`,
      [
        chunk.map((row) => row.id),
        chunk.map((row) => row.question),
        chunk.map((row) => row.answer),
        chunk.map((row) => (row.choices == null ? null : JSON.stringify(row.choices)))
      ]
    );
    return result.rowCount || 0;
  });
}

async function saveFingerprint(db, fingerprint) {
  await db.query(
    `INSERT INTO glider_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [FINGERPRINT_KEY, JSON.stringify({ hash: fingerprint })]
  );
}

/** Upsert tracks/topics/cards from seed. Does not delete user-imported cards. */
export async function seedGliderContent(db, { force = false } = {}) {
  if (!db) return { skipped: true, reason: 'no_db' };

  const fingerprint = await contentFingerprint();
  if (!force) {
    const stored = await db.query('SELECT value FROM glider_settings WHERE key = $1', [
      FINGERPRINT_KEY
    ]);
    if (storedFingerprint(stored.rows[0]?.value) === fingerprint) {
      return emptySeedResult({ content_unchanged: true });
    }
  }

  const seed = await loadSeedFile();
  const sessionSeed = await collectSessionSeedContent();
  const foiBank = await loadImportBank(FOI_IMPORT_PATH);
  const privateBank = await loadImportBank(PRIVATE_IMPORT_PATH);
  const cfiBank = await loadImportBank(CFI_G_IMPORT_PATH);
  const commercialBank = await loadImportBank(COMMERCIAL_IMPORT_PATH);
  let tracks = 0;
  let topics = 0;

  async function upsertTopic(topic, trackId) {
    if (!topic?.id) return;
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
        trackId,
        String(topic.title || topic.id),
        String(topic.description || ''),
        String(topic.pts_ref || ''),
        Number.isFinite(Number(topic.sort_order)) ? Number(topic.sort_order) : 0
      ]
    );
    topics += 1;
  }

  for (const t of [...(seed.tracks || []), ...(sessionSeed.tracks || [])]) {
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
    await upsertTopic(
      {
        ...topic,
        title: topic.title,
        description: topic.description || '',
        pts_ref: topic.pts_ref || '',
        sort_order: topic.sort_order || 0
      },
      topic.track_id
    );
  }
  for (const topic of sessionSeed.topics || []) {
    await upsertTopic(topic, topic.track_id);
  }

  if (foiBank.trackId === 'foi') {
    for (const topic of foiBank.topics) {
      if (!topic?.id) continue;
      await upsertTopic(
        {
          ...topic,
          sort_order: Number.isFinite(Number(topic.sort_order)) ? Number(topic.sort_order) : 100
        },
        'foi'
      );
    }
  }
  if (privateBank.trackId === 'private') {
    for (const topic of privateBank.topics) {
      if (!topic?.id) continue;
      await upsertTopic(
        {
          ...topic,
          sort_order: Number.isFinite(Number(topic.sort_order)) ? Number(topic.sort_order) : 100
        },
        'private'
      );
    }
  }

  const { rows: existing } = await db.query(
    `SELECT id, track_id, topic_id, question, answer, choices, source, tags, details, figure
     FROM glider_cards`
  );

  const topicRemapList = [];
  const pushRemaps = (trackId, cards) => {
    for (const card of cards || []) {
      if (!card?.id || !card?.topic_id) continue;
      topicRemapList.push({
        id: String(card.id),
        trackId,
        topicId: String(card.topic_id)
      });
    }
  };
  pushRemaps('cfi_g', cfiBank.cards);
  pushRemaps('commercial', commercialBank.cards);
  if (foiBank.trackId === 'foi') pushRemaps('foi', foiBank.cards);
  if (privateBank.trackId === 'private') pushRemaps('private', privateBank.cards);
  for (const [cardId, topicId] of STUB_FIXES) {
    topicRemapList.push({ id: cardId, topicId, anyTrack: true });
  }

  const correctedById = new Map();
  for (const card of [...privateBank.cards, ...cfiBank.cards, ...foiBank.cards]) {
    if (card?.id) correctedById.set(String(card.id), card);
  }

  const plan = planCardSeedWrites({
    force,
    existing,
    seedCards: [...(seed.cards || []), ...(sessionSeed.cards || [])],
    foiCards: foiBank.trackId === 'foi' ? foiBank.cards : [],
    privateCards: privateBank.trackId === 'private' ? privateBank.cards : [],
    topicRemaps: topicRemapList,
    detailRows: [
      ...(await loadCardDetails()),
      ...(sessionSeed.cards || [])
        .filter((card) => card.details)
        .map((card) => ({ card_id: card.id, ...card.details }))
    ],
    figureRows: await loadCardFigures(),
    correctedById
  });

  const writtenBodies = [...plan.inserts, ...plan.refreshes];
  const cards = await upsertCardBodies(db, writtenBodies);
  const retired = await db.query(`DELETE FROM glider_cards WHERE id = ANY($1::text[])`, [
    RETIRED_1080_IDS
  ]);
  const topicRemaps = await updateTopics(db, plan.topicUpdates);

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

  const detailsUpserted = await updateDetails(db, plan.detailUpdates, { force });
  const figuresUpserted = await updateFigures(db, plan.figureUpdates);
  const answersAligned = await updateAnswers(db, plan.answerAlignments);

  let answerFlags = 0;
  const { rows: mcRows } = await db.query(
    `SELECT id, answer, choices
     FROM glider_cards
     WHERE choices IS NOT NULL
       AND jsonb_typeof(choices) = 'array'
       AND jsonb_array_length(choices) >= 2`
  );
  const { rows: openFlags } = await db.query(
    `SELECT card_id
     FROM glider_card_flags
     WHERE user_key = 'system:answer-audit'
       AND status = 'open'`
  );
  const openFlagIds = new Set(openFlags.map((row) => row.card_id));
  const flagsToOpen = [];
  for (const row of mcRows) {
    const choices = Array.isArray(row.choices)
      ? row.choices.map((choice) => String(choice ?? '').trim())
      : [];
    const answer = String(row.answer || '').trim();
    const ok =
      Boolean(answer) &&
      choices.some((choice) => choiceText(choice) === choiceText(answer)) &&
      !choices.some((choice) => !choice || /\[missing\]|\[truncated\]/i.test(choice));
    if (ok || openFlagIds.has(row.id)) continue;
    flagsToOpen.push({
      id: row.id,
      note: !answer
        ? 'Audit: multiple-choice card has no answer selected.'
        : 'Audit: answer text is not one of the listed choices (cannot be selected).'
    });
  }
  if (flagsToOpen.length) {
    await db.query(
      `INSERT INTO glider_card_flags (card_id, user_key, note, status)
       SELECT id, 'system:answer-audit', note, 'open'
       FROM unnest($1::text[], $2::text[]) AS t(id, note)`,
      [flagsToOpen.map((row) => row.id), flagsToOpen.map((row) => row.note)]
    );
    answerFlags = flagsToOpen.length;
  }

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

  const correctionsApplied = await updateCorrections(db, plan.corrections);
  const retiredCorrections = await db.query(
    `DELETE FROM glider_cards WHERE id = ANY($1::text[])`,
    [RETIRED_CORRECTION_IDS]
  );
  const flagKey = 'question_corrections_flags_v1';
  const flagSetting = await db.query('SELECT 1 FROM glider_settings WHERE key = $1', [flagKey]);
  let flagsResolved = 0;
  if (!flagSetting.rowCount) {
    const resolved = await db.query(
      `UPDATE glider_card_flags
       SET status = 'resolved'
       WHERE status = 'open' AND card_id = ANY($1::text[])`,
      [[...new Set([...FLAGGED_IDS, ...CORRECTED_IDS, ...RETIRED_CORRECTION_IDS])]]
    );
    flagsResolved = resolved.rowCount || 0;
    await db.query(
      `INSERT INTO glider_settings (key, value) VALUES ($1, 'true'::jsonb)
       ON CONFLICT (key) DO NOTHING`,
      [flagKey]
    );
  }

  await saveFingerprint(db, fingerprint);

  return emptySeedResult({
    tracks,
    topics,
    cards,
    foi_cards: writtenBodies.filter((row) => row.origin === 'foi').length,
    private_cards: writtenBodies.filter((row) => row.origin === 'private').length,
    cards_retired: retired.rowCount || 0,
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
  });
}
