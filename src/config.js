import 'dotenv/config';

function readBoolean(name, defaultValue = false) {
  const value = process.env[name];
  if (value == null || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

/** Trim and strip accidental surrounding quotes from Railway / pasted secrets. */
function readEnv(...names) {
  for (const name of names) {
    const raw = process.env[name];
    if (raw == null) continue;
    let value = String(raw).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    if (value) return value;
  }
  return '';
}

function shouldUseDatabaseSsl(databaseUrl) {
  if (readBoolean('DATABASE_SSL', false) || process.env.PGSSLMODE?.toLowerCase() === 'require') {
    return true;
  }
  return /sslmode=require/i.test(databaseUrl);
}

function loadAuthConfig() {
  const enabled = readBoolean('AUTH_ENABLED', false);
  const clientId = readEnv('GOOGLE_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = readEnv('GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_CLIENT_SECRET');
  const sessionSecret = readEnv('SESSION_SECRET');
  const appBaseUrl = readEnv('APP_BASE_URL').replace(/\/$/, '');
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);

  if (enabled) {
    const missing = [];
    if (!clientId) missing.push('GOOGLE_CLIENT_ID');
    if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
    if (!sessionSecret) missing.push('SESSION_SECRET');
    if (!appBaseUrl) missing.push('APP_BASE_URL');
    if (missing.length) {
      throw new Error(
        `AUTH_ENABLED=true but missing/empty on this service: ${missing.join(', ')}. ` +
          'In Railway open flf-glider-training → Variables (not hotspots/Postgres), ' +
          'set those exact names, then Redeploy.'
      );
    }
  }

  return {
    enabled,
    clientId,
    clientSecret,
    sessionSecret: sessionSecret || 'dev-only-session-secret',
    appBaseUrl,
    isProduction,
    sessionMaxAgeMs: Number(process.env.SESSION_MAX_AGE_MS ?? 30 * 24 * 60 * 60 * 1000),
    allowTestSessionHeader: readBoolean('ALLOW_TEST_AUTH_HEADER', false)
  };
}

export function loadGliderTrainingConfig() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || '';

  return {
    port: Number(process.env.PORT ?? 3400),
    database: {
      url: databaseUrl,
      ssl: shouldUseDatabaseSsl(databaseUrl),
      maxPoolSize: Number(process.env.DATABASE_POOL_SIZE ?? 3)
    },
    /** Optional gate for Import page mutations. Empty = open for signed-in users. */
    importPassword: process.env.GLIDER_IMPORT_PASSWORD?.trim()
      || process.env.ADMIN_CONSOLE_PASSWORD?.trim()
      || '',
    defaultUserKey: process.env.GLIDER_DEFAULT_USER?.trim() || 'ron',
    auth: loadAuthConfig()
  };
}
