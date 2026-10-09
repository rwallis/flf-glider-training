import crypto from 'node:crypto';
import { buildGoogleAuthUrl, exchangeGoogleCode, fetchGoogleUserInfo } from './googleOAuth.js';
import { renderLoginPage } from './loginPage.js';
import {
  attachSessionUser,
  clearSessionUser,
  getSessionUser,
  isSessionAuthenticated
} from './session.js';

async function upsertGliderUser(db, profile) {
  if (!db || !profile?.sub) return;
  await db.query(
    `INSERT INTO glider_users (google_sub, email, name, picture, last_login_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (google_sub) DO UPDATE SET
       email = EXCLUDED.email,
       name = EXCLUDED.name,
       picture = EXCLUDED.picture,
       last_login_at = NOW()`,
    [profile.sub, profile.email, profile.name, profile.picture]
  );
}

export function registerAuthRoutes(app, { authConfig, db, defaultReturnPath = '/' } = {}) {
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
      await upsertGliderUser(db, profile);
      attachSessionUser(request, profile);

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

  app.get('/auth/me', (request, response) => {
    if (!isSessionAuthenticated(request)) {
      response.status(401).json({ ok: false, authenticated: false });
      return;
    }
    const user = getSessionUser(request);
    response.json({
      ok: true,
      authenticated: true,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
        userKey: user.userKey,
        loginAt: user.loginAt
      }
    });
  });
}
