import { resolveIsAdmin, resolveUserKey } from './auth/middleware.js';
import { getSessionUser } from './auth/session.js';
import {
  nextProgress,
  parseImportPayload,
  resolveStudyCorrect,
  xpForCorrectness
} from './store.js';

function requireUserKey(req, res, config) {
  const uk = resolveUserKey(req, config);
  if (!uk) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return uk;
}

function requireAdmin(req, res, config) {
  if (!requireUserKey(req, res, config)) return false;
  if (!resolveIsAdmin(req, config)) {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

export function registerGliderApi(app, { store, config }) {
  async function listCoursesWithCounts() {
    const tracks = await store.listTracks();
    return Promise.all(
      tracks.map(async (t) => {
        const cards = await store.listCards({ trackId: t.id });
        return { ...t, card_count: cards.length };
      })
    );
  }

  app.get('/api/tracks', async (_req, res) => {
    const tracks = await listCoursesWithCounts();
    res.json({ tracks });
  });

  app.get('/api/courses', async (_req, res) => {
    const courses = await listCoursesWithCounts();
    res.json({ courses, tracks: courses });
  });

  app.get('/api/topics', async (req, res) => {
    const topics = await store.listTopics(req.query.track || undefined);
    res.json({ topics });
  });

  app.get('/api/cards', async (req, res) => {
    const hasFigureRaw = String(req.query.has_figure || '').trim().toLowerCase();
    let hasFigure;
    if (['1', 'true', 'yes', 'only'].includes(hasFigureRaw)) hasFigure = true;
    else if (['0', 'false', 'no', 'none'].includes(hasFigureRaw)) hasFigure = false;
    const limitRaw = Number(req.query.limit);
    const cards = await store.listCards({
      trackId: req.query.track || undefined,
      topicId: req.query.topic || undefined,
      q: req.query.q || undefined,
      hasFigure,
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined
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

  app.get('/api/progress-by-track', async (req, res) => {
    const uk = requireUserKey(req, res, config);
    if (!uk) return;
    const requested = String(req.query.user || req.query.user_key || '').trim();
    let target = uk;
    if (requested && requested !== uk) {
      if (!/^[a-zA-Z0-9:._@+-]{1,128}$/.test(requested)) {
        res.status(400).json({ error: 'invalid user' });
        return;
      }
      target = requested;
    }
    const tracks = await store.progressByTrack(target);
    let displayName = target === uk ? 'You' : null;
    let picture = null;
    if (target !== uk && typeof store.getProfileByUserKey === 'function') {
      const profile = await store.getProfileByUserKey(target);
      if (profile) {
        displayName = profile.name || profile.email || target;
        picture = profile.picture || null;
      }
    }
    if (!displayName) displayName = target === uk ? 'You' : 'Learner';
    res.json({
      tracks,
      user_key: target,
      is_you: target === uk,
      display_name: displayName,
      picture
    });
  });

  app.get('/api/study', async (req, res) => {
    const uk = requireUserKey(req, res, config);
    if (!uk) return;
    const trackId = req.query.track || undefined;
    const topicId = req.query.topic || undefined;
    const mode = req.query.mode || 'due'; // due | new | all | weak
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(200, Math.max(1, Math.floor(limitRaw)))
      : 20;
    const grades = String(req.query.grades || '')
      .split(',')
      .map((g) => g.trim().toLowerCase())
      .filter((g) => ['again', 'hard', 'good', 'easy'].includes(g));
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
        if (!p) return false;
        return new Date(p.due_at).getTime() <= now;
      });
    } else if (mode === 'new') {
      deck = deck.filter((c) => !c.progress);
    } else if (mode === 'weak') {
      deck = deck.filter((c) => c.progress && (c.progress.lapses > 0 || c.progress.ease < 2.2));
    }

    if (grades.length) {
      const want = new Set(grades);
      deck = deck.filter((c) => want.has(String(c.progress?.last_result || '').toLowerCase()));
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
      grades,
      limit,
      matched: deck.length,
      count: Math.min(deck.length, limit),
      cards: deck.slice(0, limit)
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
    const schedule = await store.getStudySchedule();
    const patch = nextProgress(prev, grade, schedule);
    const correct = resolveStudyCorrect({
      card,
      choice: req.body?.choice,
      correct: req.body?.correct,
      grade
    });
    const row = await store.upsertProgress(uk, card.id, patch, { correct });
    const xp = xpForCorrectness(correct);
    const activity = await store.recordAnswer(uk, xp);
    res.json({ progress: row, activity, correct, xp });
  });

  app.get('/api/league', async (req, res) => {
    const uk = requireUserKey(req, res, config);
    if (!uk) return;
    const daysRaw = Number(req.query.days);
    const days = Number.isFinite(daysRaw) ? daysRaw : 7;
    const summary = await store.leagueSummary(uk, { days });
    res.json(summary);
  });

  app.patch('/api/cards/:cardId', async (req, res) => {
    if (!requireAdmin(req, res, config)) return;
    try {
      const card = await store.updateCard(req.params.cardId, req.body || {});
      if (!card) return res.status(404).json({ error: 'card not found' });
      res.json({ ok: true, card });
    } catch (error) {
      res.status(400).json({ error: error.message || String(error) });
    }
  });

  app.get('/api/study-schedule', async (req, res) => {
    if (!requireUserKey(req, res, config)) return;
    const schedule = await store.getStudySchedule();
    res.json({ schedule });
  });

  app.put('/api/study-schedule', async (req, res) => {
    if (!requireAdmin(req, res, config)) return;
    try {
      const schedule = await store.setStudySchedule(req.body?.schedule || req.body || {});
      res.json({ ok: true, schedule });
    } catch (error) {
      res.status(400).json({ error: error.message || String(error) });
    }
  });

  function assertImportMutationAccess(req, res) {
    if (!requireAdmin(req, res, config)) return false;
    if (config.importPassword) {
      const provided = String(req.header('x-glider-import-password') || req.body?.password || '');
      if (provided !== config.importPassword) {
        res.status(401).json({ error: 'import password required' });
        return false;
      }
    }
    return true;
  }

  app.get('/api/imports', async (req, res) => {
    if (!requireAdmin(req, res, config)) return;
    const imports = await store.listImports();
    res.json({ imports });
  });

  app.post('/api/import', async (req, res) => {
    try {
      if (!assertImportMutationAccess(req, res)) return;
      const payload = parseImportPayload(req.body || {});
      const result = await store.importCards(payload);
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(400).json({ error: error.message || String(error) });
    }
  });

  app.get('/api/prefs', async (req, res) => {
    const uk = requireUserKey(req, res, config);
    if (!uk) return;
    const prefs = await store.getUserPrefs(uk);
    res.json({ prefs });
  });

  app.put('/api/prefs', async (req, res) => {
    const uk = requireUserKey(req, res, config);
    if (!uk) return;
    const body = req.body?.prefs && typeof req.body.prefs === 'object' ? req.body.prefs : req.body || {};
    const prefs = await store.setUserPrefs(uk, body);
    res.json({ ok: true, prefs });
  });

  app.post('/api/cards/:cardId/flag', async (req, res) => {
    const uk = requireUserKey(req, res, config);
    if (!uk) return;
    const cardId = String(req.params.cardId || '').trim();
    if (!cardId) {
      res.status(400).json({ error: 'cardId required' });
      return;
    }
    const note = String(req.body?.note || '').trim();
    const flag = await store.flagCard(uk, cardId, note);
    if (!flag) {
      res.status(404).json({ error: 'card not found' });
      return;
    }
    res.json({ ok: true, flag });
  });

  app.get('/api/admin/flags', async (req, res) => {
    if (!requireAdmin(req, res, config)) return;
    const status = String(req.query.status || 'open').trim() || 'open';
    const flags = await store.listCardFlags({ status, limit: Number(req.query.limit) || 100 });
    res.json({ flags });
  });

  app.get('/api/admin/users', async (req, res) => {
    if (!requireAdmin(req, res, config)) return;
    const users = await store.listUsers();
    res.json({ users });
  });

  app.patch('/api/admin/users/:googleSub', async (req, res) => {
    if (!requireAdmin(req, res, config)) return;
    const googleSub = String(req.params.googleSub || '').trim();
    if (!googleSub) {
      res.status(400).json({ error: 'googleSub required' });
      return;
    }
    const isAdmin = Boolean(req.body?.is_admin ?? req.body?.isAdmin);
    const me = getSessionUser(req);
    if (me?.sub && me.sub === googleSub && !isAdmin) {
      res.status(400).json({ error: 'You cannot remove your own admin access' });
      return;
    }
    const users = await store.listUsers();
    const target = users.find((u) => u.google_sub === googleSub);
    if (!target) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    if (target.is_admin && !isAdmin) {
      const adminCount = users.filter((u) => u.is_admin).length;
      if (adminCount <= 1) {
        res.status(400).json({ error: 'At least one admin is required' });
        return;
      }
    }
    const user = await store.setUserAdmin(googleSub, isAdmin);
    if (!user) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    res.json({ ok: true, user });
  });
}
