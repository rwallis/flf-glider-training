import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

test('index.html polar script can be cache-busted with deploy token', () => {
  const raw = readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const v = encodeURIComponent('dep-test');
  const out = raw.replace(
    /(src|href)=["'](\/(?:aircraft\/)?[^"']+\.(?:js|css))["']/g,
    (_m, attr, url) => `${attr}="${url}?v=${v}"`
  );
  assert.match(out, /\/aircraft\/polar-233\.js\?v=dep-test/);
});
