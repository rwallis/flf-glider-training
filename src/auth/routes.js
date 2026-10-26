import crypto from 'node:crypto';
import { buildGoogleAuthUrl, exchangeGoogleCode, fetchGoogleUserInfo } from './googleOAuth.js';
import { renderLoginPage } from './loginPage.js';
import {
  attachSessionUser,
  clearSessionUser,
  getSessionUser,
  isSessionAuthenticated
} from './session.js';

async function upsertGliderUser(db, profile, { bootstrapEmails = [] } = {}) {
  if (!db || !profile?.sub) return { isAdmin: false };
  const email = String(profile.email || '').trim().toLowerCase();
  const bootstrap = bootstrapEmails.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
  const bootstrapAdmin = Boolean(email && bootstrap.includes(email));

  await db.query(
    `INSERT INTO glider_users (google_sub, email, name, picture, is_admin, last_login_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (google_sub) DO UPDATE SET
       email = EXCLUDED.email,
       name = EXCLUDED.name,
       picture = EXCLUDED.picture,
       last_login_at = NOW(),
       is_admin = CASE
         WHEN glider_users.is_admin THEN TRUE
         WHEN EXCLUDED.is_admin THEN TRUE
         ELSE glider_users.is_admin
       END`,
    [profile.sub, profile.email, profile.name, profile.picture, bootstrapAdmin]
  );

  const { rows } = await db.query(
    `SELECT is_admin FROM glider_users WHERE google_sub = $1`,
    [profile.sub]
  );
  return { isAdmin: Boolean(rows[0]?.is_admin) };
}

async function loadIsAdmin(db, profile) {
  if (!db || !profile?.sub) return false;
  const { rows } = await db.query(
    `SELECT is_admin FROM glider_users WHERE google_sub = $1`,
    [profile.sub]
  );
  return Boolean(rows[0]?.is_admin);
}

export function registerAuthRoutes(app, { authConfig, db, defaultReturnPath = '/', bootstrapEmails = [] } = {}) {
  if (!authConfig?.enabled) return;

  function safeReturnPath(value) {
    const raw = String(value || '').trim();
    if (!raw.startsWith('/') || raw.startsWith('//')) return defaultReturnPath;
    return raw;
  }

  app.get('/login', (request, response) => {
    if (isSessionAuthenticated(request)) {
      response.redirect(safeReturnPath(request.query.return));
      return;
    }
    response
      .type('html')
      .send(
        renderLoginPage({
          error: request.query.error ? String(request.query.error) : '',
          returnUrl: safeReturnPath(request.query.return)
        })
      );
  });

  app.get('/auth/google', (request, response) => {
    const state = crypto.randomBytes(16).toString('hex');
    request.session.oauthState = state;
    request.session.oauthReturn = safeReturnPath(request.query.return);
    response.redirect(buildGoogleAuthUrl(authConfig, state));
  });

  app.get('/auth/google/callback', async (request, response) => {
    try {
      if (!request.query.code) throw new Error('Missing authorization code');
      if (request.query.state !== request.session.oauthState) {
        throw new Error('Invalid OAuth state');
      }

      const tokenPayload = await exchangeGoogleCode(authConfig, String(request.query.code));
      const profile = await fetchGoogleUserInfo(tokenPayload.access_token);
      const { isAdmin } = await upsertGliderUser(db, profile, { bootstrapEmails });
      attachSessionUser(request, profile, { isAdmin });

      const returnPath = safeReturnPath(request.session.oauthReturn);
      delete request.session.oauthState;
      delete request.session.oauthReturn;
      response.redirect(returnPath);
    } catch (error) {
      console.warn('[glider-auth] callback failed:', error.message);
      response.redirect(`/login?error=${encodeURIComponent('Sign-in failed. Try again.')}`);
    }
  });

  async function logout(request, response) {
    clearSessionUser(request);
    if (String(request.headers.accept || '').includes('text/html') || request.method === 'GET') {
      response.redirect('/login');
      return;
    }
    response.json({ ok: true });
  }

  app.post('/logout', logout);
  app.get('/logout', logout);

  app.get('/auth/me', async (request, response) => {
    if (!isSessionAuthenticated(request)) {
      response.status(401).json({ ok: false, authenticated: false });
      return;
    }
    const user = getSessionUser(request);
    let isAdmin = Boolean(user.isAdmin);
    try {
      isAdmin = await loadIsAdmin(db, user);
      if (request.session?.user) request.session.user.isAdmin = isAdmin;
    } catch {
      /* keep session flag */
    }
    response.json({
      ok: true,
      authenticated: true,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
        userKey: user.userKey,
        sub: user.sub,
        isAdmin,
        loginAt: user.loginAt
      }
    });
  });
}
