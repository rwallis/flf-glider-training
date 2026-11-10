import { resolveIsAdmin, resolveUserKey } from '../auth/middleware.js';
import { getSessionUser } from '../auth/session.js';
import {
  getSessionPackage,
  listCourseCatalog,
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

export function registerClassroomApi(app, { liveSessions, scheduledClasses, config }) {
  app.get('/api/sessions/packages', async (_req, res) => {
    try {
      const packages = await listSessionPackageSummaries();
      res.json({ packages });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/sessions/catalog', async (_req, res) => {
    try {
      const courses = await listCourseCatalog();
      res.json({ courses });
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

  // --- Scheduled classes (Classes tab + Admin Class) ---

  app.get('/api/classes', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const includeCancelled =
        resolveIsAdmin(req, config) &&
        ['1', 'true', 'yes'].includes(String(req.query.include_cancelled || '').toLowerCase());
      const classes = await scheduledClasses.listClasses({
        viewerKey: identity.userKey,
        includeCancelled
      });
      res.json({ classes });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/classes/:id', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const isAdmin = resolveIsAdmin(req, config);
      const cls = await scheduledClasses.getClass(req.params.id, {
        viewerKey: identity.userKey,
        includeRoster: isAdmin
      });
      if (!cls) {
        res.status(404).json({ error: 'Scheduled class not found' });
        return;
      }
      // Instructors who scheduled it also get roster
      if (!isAdmin && cls.created_by === identity.userKey) {
        const withRoster = await scheduledClasses.getClass(req.params.id, {
          viewerKey: identity.userKey,
          includeRoster: true
        });
        res.json({ class: withRoster });
        return;
      }
      res.json({ class: cls });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/classes', async (req, res) => {
    try {
      if (!resolveIsAdmin(req, config)) {
        res.status(403).json({ error: 'Instructor/admin access required to schedule a class' });
        return;
      }
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const scheduled = await scheduledClasses.schedule({
        packageId: req.body?.package_id || req.body?.packageId,
        startsAt: req.body?.starts_at || req.body?.startsAt,
        studentLimit: req.body?.student_limit ?? req.body?.studentLimit,
        instructor: identity
      });
      res.status(201).json({ ok: true, class: scheduled });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/classes/:id/enroll', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Sign in required to enroll' });
        return;
      }
      const enrolled = await scheduledClasses.enroll(req.params.id, identity, {
        remote: Boolean(req.body?.remote)
      });
      res.json({ ok: true, class: enrolled });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/classes/:id/cancel', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const cancelled = await scheduledClasses.cancel(req.params.id, identity.userKey, {
        isAdmin: resolveIsAdmin(req, config)
      });
      res.json({ ok: true, class: cancelled });
    } catch (error) {
      sendError(res, error);
    }
  });

  // --- Live session runner (enrolled / instructor; no join code required) ---

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
      const classId = req.body?.class_id || req.body?.classId || null;
      let packageId = req.body?.package_id || req.body?.packageId || 'weather-for-soaring';
      if (classId) {
        const cls = await scheduledClasses.getClass(classId, {
          viewerKey: identity.userKey,
          includeRoster: true
        });
        if (!cls) {
          res.status(404).json({ error: 'Scheduled class not found' });
          return;
        }
        packageId = cls.package_id;
      }
      const session = await liveSessions.open({
        packageId,
        instructor: identity,
        remote: Boolean(req.body?.remote),
        scheduledClassId: classId
      });
      res.status(201).json({ ok: true, session });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/live-sessions/enter', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Sign in required' });
        return;
      }
      const classId = req.body?.class_id || req.body?.classId;
      if (!classId) {
        res.status(400).json({ error: 'class_id required' });
        return;
      }
      const cls = await scheduledClasses.getClass(classId, {
        viewerKey: identity.userKey,
        includeRoster: true
      });
      if (!cls) {
        res.status(404).json({ error: 'Scheduled class not found' });
        return;
      }
      const isAdmin = resolveIsAdmin(req, config);
      const isInstructor = isAdmin || cls.created_by === identity.userKey;
      if (!cls.you_enrolled && !isInstructor) {
        res.status(403).json({ error: 'Enroll in this class before entering the live session' });
        return;
      }
      // Prefer an existing open live session for this scheduled class
      let session = await liveSessions.getForScheduledClass?.(classId, identity.userKey, {
        isAdmin: isInstructor
      });
      if (!session && isInstructor) {
        session = await liveSessions.open({
          packageId: cls.package_id,
          instructor: identity,
          remote: Boolean(req.body?.remote),
          scheduledClassId: classId
        });
      } else if (!session) {
        res.status(404).json({ error: 'Instructor has not started the live session yet' });
        return;
      } else if (!session.you) {
        // Auto-admit enrolled student into live roster
        session = await liveSessions.admitEnrolled({
          sessionId: session.id,
          user: identity,
          remote: Boolean(req.body?.remote)
        });
      }
      res.json({ ok: true, session });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/live-sessions/join', async (req, res) => {
    try {
      const identity = identityFromRequest(req, config);
      if (!identity) {
        res.status(401).json({ error: 'Sign in required to join' });
        return;
      }
      // Legacy code join kept for compatibility; prefer enroll + enter
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
