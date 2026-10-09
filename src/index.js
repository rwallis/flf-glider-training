import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGliderTrainingConfig } from './config.js';
import { closeGliderPool, createGliderPool, ensureGliderSchema } from './db.js';
import { registerGliderApi } from './routes.js';
import { seedGliderContent } from './seed.js';
import { createStore } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SERVICE_STARTED_AT = new Date().toISOString();

async function main() {
  const config = loadGliderTrainingConfig();
  const pool = await createGliderPool(config);
  if (pool) {
    await ensureGliderSchema(pool);
    const seeded = await seedGliderContent(pool);
    console.log(
      `[glider-training] seed tracks=${seeded.tracks} topics=${seeded.topics} new_cards=${seeded.cards}`
    );
  }

  const store = await createStore(pool);
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '1h' }));

  app.get('/healthz', (_req, res) => {
    res.json({
      service: 'glider-training',
      ok: true,
      started_at: SERVICE_STARTED_AT,
      database_configured: Boolean(config.database.url),
      import_password_required: Boolean(config.importPassword)
    });
  });

  registerGliderApi(app, { store, config });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  const server = app.listen(config.port, () => {
    console.log(`[glider-training] listening on port ${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`[glider-training] ${signal}; shutting down`);
    server.close();
    await closeGliderPool(pool);
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('[glider-training] startup failed:', error);
  process.exit(1);
});
