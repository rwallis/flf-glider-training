import { resolveUserKey } from './auth/middleware.js';
import { nextProgress, parseImportPayload } from './store.js';

function requireUserKey(req, res, config) {
  const uk = resolveUserKey(req, config);
  if (!uk) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return uk;
}

export function registerGliderApi(app, { store, config }) {
  app.get('/api/tracks', async (_req, res) => {
    const tracks = await store.listTracks();
    const withCounts = await Promise.all(
      tracks.map(async (t) => {
        const cards = await store.listCards({ trackId: t.id });
        return { ...t, card_count: cards.length };
      })
    );
    res.json({ tracks: withCounts });
  });

  app.get('/api/topics', async (req, res) => {
    const topics = await store.listTopics(req.query.track || undefined);
    res.json({ topics });
  });

  app.get('/api/cards', async (req, res) => {
    const cards = await store.listCards({
      trackId: req.query.track || undefined,
      topicId: req.query.topic || undefined
    });
    res.json({ cards });
  });

  app.get('/api/stats', async (req, res) => {
    const uk = requireUserKey(req, res, config);
    if (!uk) return;
    const stats = await store.stats(uk);
    res.json(stats);
  });

  app.get('/api/progress', async (req, res) => {
    const uk = requireUserKey(req, res, config);
    if (!uk) return;
    const rows = await store.getProgress(uk);
    res.json({ progress: rows });
  });

  app.get('/api/study', async (req, res) => {
    const uk = requireUserKey(req, res, config);
    if (!uk) return;
    const trackId = req.query.track || undefined;
    const topicId = req.query.topic || undefined;
    const mode = req.query.mode || 'due'; // due | all | weak
    const cards = await store.listCards({ trackId, topicId });
    const progress = await store.getProgress(uk);
    const byCard = new Map(progress.map((p) => [p.card_id, p]));
    const now = Date.now();

    let deck = cards.map((c) => ({
      ...c,
      progress: byCard.get(c.id) || null
    }));

    if (mode === 'due') {
      deck = deck.filter((c) => {
        const p = c.progress;
        if (!p) return true;
        return new Date(p.due_at).getTime() <= now;
      });
    } else if (mode === 'weak') {
      deck = deck.filter((c) => c.progress && (c.progress.lapses > 0 || c.progress.ease < 2.2));
    }

    // Prefer never-seen, then earliest due
    deck.sort((a, b) => {
      const ap = a.progress ? new Date(a.progress.due_at).getTime() : 0;
      const bp = b.progress ? new Date(b.progress.due_at).getTime() : 0;
      if (!a.progress && b.progress) return -1;
      if (a.progress && !b.progress) return 1;
      return ap - bp;
    });

    res.json({
      mode,
      track: trackId || null,
      topic: topicId || null,
      count: deck.length,
      cards: deck.slice(0, 80)
    });
  });

  app.post('/api/study/:cardId', async (req, res) => {
    const uk = requireUserKey(req, res, config);
    if (!uk) return;
    const grade = String(req.body?.grade || '').toLowerCase();
    if (!['again', 'hard', 'good', 'easy'].includes(grade)) {
      return res.status(400).json({ error: 'grade must be again|hard|good|easy' });
    }
    const card = await store.getCard(req.params.cardId);
    if (!card) return res.status(404).json({ error: 'card not found' });
    const prev = await store.getProgressOne(uk, card.id);
    const patch = nextProgress(prev, grade);
    const row = await store.upsertProgress(uk, card.id, patch);
    res.json({ progress: row });
  });

  app.get('/api/imports', async (_req, res) => {
    const imports = await store.listImports();
    res.json({ imports });
  });

  app.post('/api/import', async (req, res) => {
    try {
      if (config.importPassword) {
        const provided = String(req.header('x-glider-import-password') || req.body?.password || '');
        if (provided !== config.importPassword) {
          return res.status(401).json({ error: 'import password required' });
        }
      }
      const payload = parseImportPayload(req.body || {});
      const result = await store.importCards(payload);
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({ error: error.message || String(error) });
    }
  });
}
