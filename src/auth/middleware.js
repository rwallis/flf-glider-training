import { getSessionUser, isSessionAuthenticated } from './session.js';

const PUBLIC_EXACT = new Set([
  '/healthz',
  '/login',
  '/logout',
  '/auth/google',
  '/auth/google/callback',
  '/auth/me',
  '/api/v1/app/meta',
  '/api/deploy-status'
]);

export function isPublicPath(pathname) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/auth/')) return true;
  return false;
}

export function requireAuth(authConfig) {
  return (request, response, next) => {
    if (!authConfig?.enabled) {
      next();
      return;
    }
    if (isPublicPath(request.path)) {
      next();
      return;
    }
    if (isSessionAuthenticated(request)) {
      next();
      return;
    }

    const accept = String(request.headers.accept || '');
    const wantsJson =
      accept.includes('application/json') ||
      request.path.startsWith('/api/') ||
      request.path === '/auth/me';

    if (wantsJson) {
      response.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }

    const returnUrl = encodeURIComponent(request.originalUrl || request.path || '/');
    response.redirect(`/login?return=${returnUrl}`);
  };
}

export function resolveUserKey(request, config) {
  if (config.auth?.enabled) {
    const user = getSessionUser(request);
    if (user?.userKey) return user.userKey;
    // Auth on but no session — callers should have been blocked by requireAuth
    return null;
  }
  // Local / auth-off: optional header for scripts, else default
  return String(request.header('x-glider-user') || config.defaultUserKey || 'ron').slice(0, 128);
}
