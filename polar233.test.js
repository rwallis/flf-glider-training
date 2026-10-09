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

test('smooth polar has dense points for a continuous curve', () => {
  const polar = loadPolar();
  assert.ok(polar.SMOOTH_POLAR.length >= 80);
  assert.ok(polar.SMOOTH_POLAR[0].ias_kt < 30);
  assert.ok(polar.SMOOTH_POLAR[polar.SMOOTH_POLAR.length - 1].ias_kt >= 74);
});

test('MacCready 2.0 kt calm tangent near 51 kt', () => {
  const polar = loadPolar();
  const r = polar.findMacCreadyTangent({ macCreadyKt: 2, windKt: 0 });
  assert.equal(r.ok, true);
  assert.ok(r.tangent.ias_kt >= 48 && r.tangent.ias_kt <= 54, `got ${r.tangent.ias_kt}`);
});

test('higher MacCready increases speed to fly', () => {
  const polar = loadPolar();
  const low = polar.findMacCreadyTangent({ macCreadyKt: 0.5, windKt: 0 });
  const high = polar.findMacCreadyTangent({ macCreadyKt: 4, windKt: 0 });
  assert.ok(high.tangent.ias_kt > low.tangent.ias_kt);
});

test('headwind increases speed to fly vs calm', () => {
  const polar = loadPolar();
  const calm = polar.findMacCreadyTangent({ macCreadyKt: 2, windKt: 0 });
  const head = polar.findMacCreadyTangent({ macCreadyKt: 2, windKt: -10 });
  assert.ok(head.tangent.ias_kt >= calm.tangent.ias_kt);
});

test('legacy dual calm L/D near 23 still works', () => {
  const polar = loadPolar();
  const r = polar.evaluate({ config: 'dual', airspeedMph: 54, windMph: 0 });
  assert.ok(r.ok);
  assert.ok(r.air_ld > 22 && r.air_ld < 24);
});
