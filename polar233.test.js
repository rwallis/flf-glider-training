import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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

test('solo and dual configs both have dense smooth polars', () => {
  const polar = loadPolar();
  assert.ok(polar.getConfig('solo').smooth.length >= 100);
  assert.ok(polar.getConfig('dual').smooth.length >= 100);
});

test('dual MacCready metrics include relative L/D and sink', () => {
  const polar = loadPolar();
  const r = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 2, windKt: 0 });
  assert.equal(r.ok, true);
  assert.ok(r.metrics.air_ld > 15);
  assert.ok(r.metrics.ground_ld > 10);
  assert.ok(r.metrics.sink_kt > 1);
  assert.ok(r.metrics.air_ld_vs_best_pct <= 100.5);
});

test('solo and dual speed-to-fly differ at same MC', () => {
  const polar = loadPolar();
  const solo = polar.findMacCreadyTangent({ config: 'solo', macCreadyKt: 2, windKt: 0 });
  const dual = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 2, windKt: 0 });
  assert.notEqual(Math.round(solo.tangent.ias_kt), Math.round(dual.tangent.ias_kt));
});

test('headwind increases dual speed to fly', () => {
  const polar = loadPolar();
  const calm = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 2, windKt: 0 });
  const head = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 2, windKt: -10 });
  assert.ok(head.tangent.ias_kt >= calm.tangent.ias_kt);
});

test('bezier path starts with M and contains C', () => {
  const polar = loadPolar();
  const pts = polar.getConfig('dual').smooth.slice(0, 20).map((p) => ({ x_kt: p.ias_kt, vs_kt: p.vs_kt }));
  const d = polar.polarToBezierPath(pts, (p) => p.x_kt, (p) => p.vs_kt);
  assert.match(d, /^M /);
  assert.match(d, / C /);
});
