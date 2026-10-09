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
`;

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
  return true;
}

export async function closeGliderPool(db) {
  if (db) await db.end();
}
