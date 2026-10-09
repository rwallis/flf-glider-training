import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPolar() {
  const code = readFileSync(path.join(__dirname, 'public/aircraft/polar-233.js'), 'utf8');
  const sandbox = { window: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox.Sgs233Polar;
}

test('dual calm near best L/D is about 23:1', () => {
  const polar = loadPolar();
  const r = polar.evaluate({ config: 'dual', airspeedMph: 54, windMph: 0 });
  assert.ok(r.ok);
  assert.ok(r.air_ld > 22 && r.air_ld < 24);
  assert.ok(Math.abs(r.ground_ld - r.air_ld) < 0.05);
});

test('headwind reduces ground L/D; tailwind increases it', () => {
  const polar = loadPolar();
  const calm = polar.evaluate({ config: 'dual', airspeedMph: 60, windMph: 0 });
  const head = polar.evaluate({ config: 'dual', airspeedMph: 60, windMph: -15 });
  const tail = polar.evaluate({ config: 'dual', airspeedMph: 60, windMph: 15 });
  assert.ok(head.ground_ld < calm.ground_ld);
  assert.ok(tail.ground_ld > calm.ground_ld);
});

test('extreme headwind marks cannot penetrate', () => {
  const polar = loadPolar();
  const r = polar.evaluate({ config: 'solo', airspeedMph: 42, windMph: -50 });
  assert.equal(r.can_penetrate, false);
});

test('content polar json matches dual peak', () => {
  const require = createRequire(import.meta.url);
  const data = require('./content/sgs-233-polar.json');
  const dual = data.configs.dual.points.find((p) => p.mph === 54);
  assert.equal(dual.ld, 23);
});
