import cookieSession from 'cookie-session';

export function userKeyFromProfile(profile) {
  if (profile?.sub) return `g:${profile.sub}`.slice(0, 128);
  if (profile?.email) return `e:${String(profile.email).toLowerCase()}`.slice(0, 128);
  return null;
}

export function getSessionUser(request) {
  return request.session?.user ?? null;
}

export function attachSessionUser(request, profile) {
  const userKey = userKeyFromProfile(profile);
  request.session.user = {
    sub: profile.sub || null,
    email: profile.email,
    name: profile.name || profile.email,
    picture: profile.picture || null,
    userKey,
    loginAt: new Date().toISOString()
  };
  return request.session.user;
}

export function clearSessionUser(request) {
  request.session = null;
}

export function isSessionAuthenticated(request) {
  const user = getSessionUser(request);
  return Boolean(user?.email && user?.userKey);
}

export function createSessionMiddleware(authConfig) {
  return cookieSession({
    name: 'flf_glider_session',
    keys: [authConfig.sessionSecret],
    maxAge: authConfig.sessionMaxAgeMs,
    httpOnly: true,
    secure: authConfig.isProduction,
    sameSite: 'lax',
    signed: true
  });
}

export function createTestSessionMiddleware(authConfig) {
  if (!authConfig.allowTestSessionHeader) {
    return (_request, _response, next) => next();
  }

  return (request, _response, next) => {
    const email = request.headers['x-test-auth-email'];
    const sub = request.headers['x-test-auth-sub'] || `test-${email}`;
    if (email) {
      attachSessionUser(request, {
        sub: String(sub),
        email: String(email).toLowerCase(),
        name: 'Test User',
        picture: null
      });
    }
    next();
  };
}
