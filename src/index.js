import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAppBuildMeta, getDeployStatusPayload, readInstanceBuildMeta } from './buildMeta.js';
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
  // Avoid caching the SPA shell so version bumps show after Refresh
  app.use(express.static(PUBLIC_DIR, {
    index: false,
    maxAge: 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store');
      }
    }
  }));

  app.get('/healthz', (_req, res) => {
    const instance = readInstanceBuildMeta();
    res.json({
      ok: true,
      service: 'glider-training',
      version: getAppBuildMeta().version,
      git_sha: instance.git_commit,
      deployment_id: instance.deployment_id,
      environment: instance.environment,
      started_at: SERVICE_STARTED_AT,
      database_configured: Boolean(config.database.url),
      import_password_required: Boolean(config.importPassword)
    });
  });

  app.get('/api/v1/app/meta', (_req, res) => {
    res.json(getAppBuildMeta('glider-training'));
  });

  app.get('/api/deploy-status', (req, res) => {
    res.json(
      getDeployStatusPayload({
        pageLoadDeploymentId: req.query.page_load_deployment_id ?? null
      })
    );
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
