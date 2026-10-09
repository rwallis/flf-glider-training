import 'dotenv/config';

function readBoolean(name, defaultValue = false) {
  const value = process.env[name];
  if (value == null || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function shouldUseDatabaseSsl(databaseUrl) {
  if (readBoolean('DATABASE_SSL', false) || process.env.PGSSLMODE?.toLowerCase() === 'require') {
    return true;
  }
  return /sslmode=require/i.test(databaseUrl);
}

function loadAuthConfig() {
  const enabled = readBoolean('AUTH_ENABLED', false);
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  const sessionSecret = process.env.SESSION_SECRET?.trim() || '';
  const appBaseUrl = (process.env.APP_BASE_URL?.trim() || '').replace(/\/$/, '');
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);

  if (enabled) {
    if (!sessionSecret) {
      throw new Error('SESSION_SECRET is required when AUTH_ENABLED=true');
    }
    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when AUTH_ENABLED=true');
    }
    if (!appBaseUrl) {
      throw new Error('APP_BASE_URL is required when AUTH_ENABLED=true');
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
