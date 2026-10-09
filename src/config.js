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

export function loadGliderTrainingConfig() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || '';
  const allowedEmails = (process.env.GLIDER_ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return {
    port: Number(process.env.PORT ?? 3400),
    database: {
      url: databaseUrl,
      ssl: shouldUseDatabaseSsl(databaseUrl),
      maxPoolSize: Number(process.env.DATABASE_POOL_SIZE ?? 3)
    },
    /** Optional gate for Import page mutations. Empty = open in local/dev. */
    importPassword: process.env.GLIDER_IMPORT_PASSWORD?.trim()
      || process.env.ADMIN_CONSOLE_PASSWORD?.trim()
      || '',
    allowedEmails,
    defaultUserKey: process.env.GLIDER_DEFAULT_USER?.trim() || 'ron'
  };
}
