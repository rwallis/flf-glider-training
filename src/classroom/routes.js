import { resolveIsAdmin, resolveUserKey } from '../auth/middleware.js';
import { getSessionUser } from '../auth/session.js';
import {
  getSessionPackage,
  listSessionPackageSummaries,
  publicCard
} from './packages.js';

function identityFromRequest(req, config) {
  const userKey = resolveUserKey(req, config);
  if (!userKey) return null;
  const sessionUser = getSessionUser(req);
  if (sessionUser) {
    return {
      userKey,
      name: sessionUser.name || '',
      email: sessionUser.email || '',
      picture: sessionUser.picture || null
    };
  }
  // Auth off / local mock identity
  return {
    userKey,
    name: userKey === (config.defaultUserKey || 'ron') ? 'Ron (local)' : userKey,
    email: '',
    picture: null
  };
}

function sendError(res, error) {
  const status = Number(error?.status) || 500;
  res.status(status).json({ error: error?.message || String(error) });
}

export function registerClassroomApi(app, { liveSessions, config }) {
  app.get('/api/sessions/packages', async (_req, res) => {
    try {
      const packages = await listSessionPackageSummaries();
      res.json({ packages });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/sessions/packages/:id', async (req, res) => {
    try {
      const pkg = await getSessionPackage(req.params.id);
      if (!pkg) {
        res.status(404).json({ error: 'Session package not found' });
        return;
      }
      const isAdmin = resolveIsAdmin(req, config);
      res.json({
        package: {
          id: pkg.id,
          slug: pkg.slug,
          title: pkg.title,
          course: pkg.course,
          week: pkg.week,
          length_minutes: pkg.length_minutes,
          max_students: pkg.max_students,
          objective: pkg.objective,
          elements: pkg.elements,
          schedule: pkg.schedule,
          phases: pkg.phases,
          completion_standards: pkg.completion_standards,
          outline: pkg.outline,
          risk_pauses: isAdmin ? pkg.risk_pauses : undefined,
          signoff: pkg.signoff,
          tags: pkg.tags,
          homework: {
            title: pkg.homework?.title,
            tasks: pkg.homework?.tasks || [],
            card_ids: (pkg.homework?.cards || []).map((c) => c.id)
          },
          quizzes: Object.fromEntries(
            Object.entries(pkg.quizzes || {}).map(([key, quiz]) => [
              key,
              {
                id: quiz.id,
                title: quiz.title,
                pass_pct: quiz.pass_pct,
                cards: (quiz.cards || []).map((c) =>
                  publicCard(c, { revealAnswer: Boolean(isAdmin) })
                )
              }
            ])
          )
        }
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/live-sessions/current', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const session = await liveSessions.getForUser(identity.userKey, {
        isAdmin: resolveIsAdmin(req, config)
      });
      res.json({ session });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/live-sessions', async (req, res) => {
    try {
      if (!resolveIsAdmin(req, config)) {
        res.status(403).json({ error: 'Instructor/admin access required to open a live session' });
        return;
      }
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const session = await liveSessions.open({
        packageId: req.body?.package_id || req.body?.packageId || 'weather-for-soaring',
        instructor: identity,
        remote: Boolean(req.body?.remote)
      });
      res.status(201).json({ ok: true, session });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/live-sessions/join', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Sign in (or local mock user) required to join' });
        return;
      }
      const session = await liveSessions.join({
        code: req.body?.code,
        user: identity,
        remote: Boolean(req.body?.remote)
      });
      res.json({ ok: true, session });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/live-sessions/:id', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const session = await liveSessions.getById(req.params.id, identity.userKey, {
        isAdmin: resolveIsAdmin(req, config)
      });
      if (!session) {
        res.status(404).json({ error: 'Live session not found' });
        return;
      }
      res.json({ session });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.patch('/api/live-sessions/:id', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const session = await liveSessions.patch(req.params.id, identity.userKey, req.body || {}, {
        isAdmin: resolveIsAdmin(req, config)
      });
      res.json({ ok: true, session });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/live-sessions/:id/answers', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const result = await liveSessions.submitAnswer(req.params.id, identity.userKey, {
        cardId: req.body?.card_id || req.body?.cardId,
        choice: req.body?.choice
      });
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/live-sessions/:id/heatmap', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const heatmap = await liveSessions.heatMap(req.params.id, identity.userKey, {
        isAdmin: resolveIsAdmin(req, config)
      });
      res.json({ heatmap });
    } catch (error) {
      sendError(res, error);
    }
  });
}
