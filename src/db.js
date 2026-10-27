import pg from 'pg';

const { Pool } = pg;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS glider_tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready'
);

CREATE TABLE IF NOT EXISTS glider_topics (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES glider_tracks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  pts_ref TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS glider_cards (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES glider_tracks(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES glider_topics(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  choices JSONB,
  source TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS glider_cards_track_idx ON glider_cards (track_id);
CREATE INDEX IF NOT EXISTS glider_cards_topic_idx ON glider_cards (topic_id);

CREATE TABLE IF NOT EXISTS glider_progress (
  user_key TEXT NOT NULL,
  card_id TEXT NOT NULL REFERENCES glider_cards(id) ON DELETE CASCADE,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reps INT NOT NULL DEFAULT 0,
  lapses INT NOT NULL DEFAULT 0,
  last_result TEXT,
  last_studied_at TIMESTAMPTZ,
  PRIMARY KEY (user_key, card_id)
);

CREATE INDEX IF NOT EXISTS glider_progress_due_idx ON glider_progress (user_key, due_at);

CREATE TABLE IF NOT EXISTS glider_imports (
  id BIGSERIAL PRIMARY KEY,
  track_id TEXT NOT NULL,
  filename TEXT NOT NULL DEFAULT '',
  card_count INT NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS glider_users (
  google_sub TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  picture TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS glider_users_email_idx ON glider_users (email);

CREATE TABLE IF NOT EXISTS glider_daily_activity (
  user_key TEXT NOT NULL,
  activity_date DATE NOT NULL,
  answers INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_key, activity_date)
);

CREATE INDEX IF NOT EXISTS glider_daily_activity_date_idx
  ON glider_daily_activity (activity_date DESC);

CREATE TABLE IF NOT EXISTS glider_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const PROGRESS_ACCURACY_SQL = `
ALTER TABLE glider_progress
  ADD COLUMN IF NOT EXISTS last_correct BOOLEAN,
  ADD COLUMN IF NOT EXISTS answers_correct INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS answers_total INT NOT NULL DEFAULT 0;

UPDATE glider_progress
SET
  last_correct = (last_result IN ('hard', 'good', 'easy')),
  answers_total = 1,
  answers_correct = CASE WHEN last_result IN ('hard', 'good', 'easy') THEN 1 ELSE 0 END
WHERE last_result IS NOT NULL
  AND answers_total = 0;
`;

const CARD_DETAILS_SQL = `
ALTER TABLE glider_cards
  ADD COLUMN IF NOT EXISTS details JSONB;
`;

const CARD_FIGURE_SQL = `
ALTER TABLE glider_cards
  ADD COLUMN IF NOT EXISTS figure JSONB;
`;

const USER_ADMIN_SQL = `
ALTER TABLE glider_users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
`;

const USER_PREFS_SQL = `
ALTER TABLE glider_users
  ADD COLUMN IF NOT EXISTS prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
`;

const CARD_FLAGS_SQL = `
CREATE TABLE IF NOT EXISTS glider_card_flags (
  id BIGSERIAL PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES glider_cards(id) ON DELETE CASCADE,
  user_key TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS glider_card_flags_status_idx
  ON glider_card_flags (status, created_at DESC);

CREATE INDEX IF NOT EXISTS glider_card_flags_card_idx
  ON glider_card_flags (card_id);
`;

/**
 * Grant admin to bootstrap emails. On first run, demote everyone else so only
 * the bootstrap account(s) are admins. Later runs only ensure bootstrap emails
 * remain admin (UI-granted admins are kept).
 */
export async function bootstrapGliderAdmins(db, bootstrapEmails = []) {
  if (!db) return { bootstrapped: false, admins: 0 };
  const emails = [...new Set(
    (bootstrapEmails || [])
      .map((e) => String(e || '').trim().toLowerCase())
      .filter(Boolean)
  )];
  if (!emails.length) return { bootstrapped: false, admins: 0 };

  const { rows: flagRows } = await db.query(
    `SELECT value FROM glider_settings WHERE key = 'admin_bootstrap_v1'`
  );
  const already = Boolean(flagRows[0]?.value);

  if (!already) {
    await db.query(
      `UPDATE glider_users
       SET is_admin = (lower(email) = ANY($1::text[]))`,
      [emails]
    );
    await db.query(
      `INSERT INTO glider_settings (key, value, updated_at)
       VALUES ('admin_bootstrap_v1', 'true'::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
    );
  } else {
    await db.query(
      `UPDATE glider_users
       SET is_admin = TRUE
       WHERE lower(email) = ANY($1::text[])`,
      [emails]
    );
  }

  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM glider_users WHERE is_admin = TRUE`
  );
  return { bootstrapped: !already, admins: rows[0]?.n || 0 };
}

export async function createGliderPool(config) {
  if (!config.database.url) {
    console.warn('[glider-training] DATABASE_URL not set; running without Postgres');
    return null;
  }
  return new Pool({
    connectionString: config.database.url,
    max: config.database.maxPoolSize || 3,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined
  });
}

export async function ensureGliderSchema(db) {
  if (!db) return false;
  await db.query(SCHEMA_SQL);
  await db.query(PROGRESS_ACCURACY_SQL);
  await db.query(CARD_DETAILS_SQL);
  await db.query(CARD_FIGURE_SQL);
  await db.query(USER_ADMIN_SQL);
  await db.query(USER_PREFS_SQL);
  await db.query(CARD_FLAGS_SQL);
  return true;
}

export async function closeGliderPool(db) {
  if (db) await db.end();
}
