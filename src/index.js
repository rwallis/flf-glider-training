import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './auth/middleware.js';
import { registerAuthRoutes } from './auth/routes.js';
import {
  createSessionMiddleware,
  createTestSessionMiddleware
} from './auth/session.js';
import { getAppBuildMeta, getDeployStatusPayload, readInstanceBuildMeta } from './buildMeta.js';
import { loadGliderTrainingConfig } from './config.js';
import {
  bootstrapGliderAdmins,
  closeGliderPool,
  createGliderPool,
  ensureGliderSchema
} from './db.js';
import { registerGliderApi } from './routes.js';
import { seedGliderContent } from './seed.js';
import { createStore } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEX_PATH = path.join(PUBLIC_DIR, 'index.html');
const SERVICE_STARTED_AT = new Date().toISOString();

function assetVersionToken() {
  const instance = readInstanceBuildMeta();
  return (
    instance.deployment_id ||
    instance.git_commit ||
    getAppBuildMeta().version ||
    String(SERVICE_STARTED_AT)
  );
}

function loadIndexHtml() {
  const raw = fs.readFileSync(INDEX_PATH, 'utf8');
  const v = encodeURIComponent(assetVersionToken());
  // Cache-bust relative app assets so Refresh after deploy cannot keep stale JS/CSS.
  return raw.replace(
    /(src|href)=["'](\/(?:aircraft\/)?[^"']+\.(?:js|css))["']/g,
    (_m, attr, url) => `${attr}="${url}?v=${v}"`
  );
}

function setStaticCacheHeaders(res, filePath) {
  const lower = String(filePath || '').toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.js') || lower.endsWith('.css') || lower.endsWith('.json')) {
    res.setHeader('Cache-Control', 'no-store');
    return;
  }
  // Images/fonts can be cached briefly; query-bust still works when HTML changes.
  res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
}

function logSeedSummary(seeded) {
  console.log(
    `[glider-training] seed tracks=${seeded.tracks} topics=${seeded.topics} new_cards=${seeded.cards}` +
      (seeded.foi_cards != null ? ` foi_cards=${seeded.foi_cards}` : '') +
      (seeded.private_cards != null ? ` private_cards=${seeded.private_cards}` : '') +
      (seeded.answers_aligned != null ? ` answers_aligned=${seeded.answers_aligned}` : '') +
      (seeded.answer_selection_flags != null
        ? ` answer_flags=${seeded.answer_selection_flags}`
        : '') +
      (seeded.cfi_g_topic_remaps != null ? ` cfi_g_topic_remaps=${seeded.cfi_g_topic_remaps}` : '') +
      (seeded.card_details_upserted != null
        ? ` card_details=${seeded.card_details_upserted}`
        : '') +
      (seeded.card_figures_upserted != null
        ? ` card_figures=${seeded.card_figures_upserted}`
        : '') +
      (seeded.corrections_applied != null
        ? ` corrections=${seeded.corrections_applied}`
        : '') +
      (seeded.flags_resolved != null ? ` flags_resolved=${seeded.flags_resolved}` : '') +
      (seeded.content_unchanged ? ' content_unchanged=1' : '')
  );
}

async function main() {
  const config = loadGliderTrainingConfig();
  const pool = await createGliderPool(config);
  let seeding = false;
  let seedError = null;

  if (pool) {
    await ensureGliderSchema(pool);
    const adminBoot = await bootstrapGliderAdmins(pool, config.adminBootstrapEmails);
    console.log(
      `[glider-training] admins=${adminBoot.admins}` +
        (adminBoot.bootstrapped ? ' (bootstrap applied)' : '')
    );
  }

  const store = await createStore(pool);
  const app = express();
  app.set('trust proxy', 1);
  const indexHtml = loadIndexHtml();

  if (config.auth.enabled) {
    app.use(createSessionMiddleware(config.auth));
    app.use(createTestSessionMiddleware(config.auth));
  }

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));

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
      seeding,
      seed_error: seedError,
      database_configured: Boolean(config.database.url),
      import_password_required: Boolean(config.importPassword),
      auth_enabled: Boolean(config.auth.enabled)
    });
  });

  app.get('/api/v1/app/meta', (_req, res) => {
    res.json({
      ...getAppBuildMeta('glider-training'),
      seeding,
      seed_error: seedError
    });
  });

  app.get('/api/deploy-status', (req, res) => {
    const payload = getDeployStatusPayload({
      pageLoadDeploymentId: req.query.page_load_deployment_id ?? null
    });
    res.json({
      ...payload,
      seeding,
      seed_error: seedError
    });
  });

  registerAuthRoutes(app, {
    authConfig: config.auth,
    db: pool,
    bootstrapEmails: config.adminBootstrapEmails
  });

  // Gate SPA + APIs when Google auth is on (public auth/health routes already registered)
  app.use(requireAuth(config.auth));

  app.use(
    express.static(PUBLIC_DIR, {
      index: false,
      etag: false,
      lastModified: false,
      maxAge: 0,
      setHeaders: setStaticCacheHeaders
    })
  );

  registerGliderApi(app, { store, config });

  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(indexHtml);
  });

  const server = app.listen(config.port, () => {
    console.log(
      `[glider-training] listening on port ${config.port} auth=${config.auth.enabled ? 'on' : 'off'}`
    );
  });

  // Seed after listen so Railway health / browser reconnect while content syncs.
  if (pool) {
    seeding = true;
    console.log('[glider-training] seeding content in background…');
    seedGliderContent(pool)
      .then((seeded) => {
        seeding = false;
        seedError = null;
        logSeedSummary(seeded);
      })
      .catch((error) => {
        seeding = false;
        seedError = error?.message || String(error);
        console.error('[glider-training] background seed failed:', error);
      });
  }

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
