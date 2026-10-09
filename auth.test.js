import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicPath, resolveUserKey } from './src/auth/middleware.js';
import { attachSessionUser, userKeyFromProfile } from './src/auth/session.js';
import { renderLoginPage } from './src/auth/loginPage.js';

test('userKeyFromProfile prefers google sub', () => {
  assert.equal(userKeyFromProfile({ sub: 'abc123', email: 'a@b.com' }), 'g:abc123');
});

test('resolveUserKey uses session when auth enabled', () => {
  const req = { session: {}, header: () => null };
  attachSessionUser(req, { sub: '99', email: 'pilot@example.com', name: 'Pilot' });
  const uk = resolveUserKey(req, { auth: { enabled: true }, defaultUserKey: 'ron' });
  assert.equal(uk, 'g:99');
});

test('resolveUserKey falls back to default when auth off', () => {
  const req = { header: () => null };
  const uk = resolveUserKey(req, { auth: { enabled: false }, defaultUserKey: 'ron' });
  assert.equal(uk, 'ron');
});

test('login and health paths are public', () => {
  assert.equal(isPublicPath('/login'), true);
  assert.equal(isPublicPath('/healthz'), true);
  assert.equal(isPublicPath('/auth/google/callback'), true);
  assert.equal(isPublicPath('/api/study'), false);
});

test('login page includes new-user instructions and Google CTA', () => {
  const html = renderLoginPage({ returnUrl: '/' });
  assert.match(html, /Sign in with Google/);
  assert.match(html, /New here/);
  assert.match(html, /your account/i);
  assert.match(html, /Commercial/);
});
