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

test('dual MacCready metrics include mph STF and knot sink', () => {
  const polar = loadPolar();
  const r = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 2, windMph: 0 });
  assert.equal(r.ok, true);
  assert.ok(r.tangent.mph > 40 && r.tangent.mph < 80);
  assert.ok(r.metrics.sink_kt > 1);
  assert.ok(r.metrics.air_ld > 15);
  assert.equal(r.wind_mph, 0);
});

test('solo and dual speed-to-fly differ at same MC', () => {
  const polar = loadPolar();
  const solo = polar.findMacCreadyTangent({ config: 'solo', macCreadyKt: 2, windMph: 0 });
  const dual = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 2, windMph: 0 });
  assert.notEqual(Math.round(solo.tangent.mph), Math.round(dual.tangent.mph));
});

test('headwind increases dual speed to fly', () => {
  const polar = loadPolar();
  const calm = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 2, windMph: 0 });
  const head = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 2, windMph: -10 });
  assert.equal(head.origin_mph, 10);
  assert.ok(head.tangent.mph >= calm.tangent.mph);
});

test('tailwind decreases dual speed to fly and pivots left of zero', () => {
  const polar = loadPolar();
  const calm = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 2, windMph: 0 });
  const tail = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 2, windMph: 10 });
  assert.equal(tail.origin_mph, -10);
  assert.ok(tail.tangent.mph <= calm.tangent.mph);
});

test('polar x stays in IAS (does not shift with wind)', () => {
  const polar = loadPolar();
  const calm = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 0, windMph: 0 });
  const head = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 0, windMph: -15 });
  assert.equal(calm.polar_gs[0].x_mph, calm.polar_gs[0].mph);
  assert.equal(head.polar_gs[0].x_mph, head.polar_gs[0].mph);
  assert.equal(calm.polar_gs[0].x_mph, head.polar_gs[0].x_mph);
});

test('STF IAS moves continuously as MacCready increases (no 3 mph snaps)', () => {
  const polar = loadPolar();
  let prev = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: 0, windMph: 0 }).tangent.mph;
  let maxStep = 0;
  for (let mc = 0.05; mc <= 3.0001; mc += 0.05) {
    const mph = polar.findMacCreadyTangent({ config: 'dual', macCreadyKt: mc, windMph: 0 }).tangent.mph;
    maxStep = Math.max(maxStep, Math.abs(mph - prev));
    assert.ok(mph + 1e-6 >= prev, `STF should not fall as MC rises (${prev} -> ${mph} at MC=${mc})`);
    prev = mph;
  }
  // Sink-graph anchors are ~6 mph apart; allow modest continuous steps, not table snaps.
  assert.ok(maxStep < 1.6, `max step ${maxStep} mph too large — still snapping`);
});

test('wind label uses mph', () => {
  const polar = loadPolar();
  assert.match(polar.windLabel(0), /mph/);
  assert.match(polar.windLabel(-8), /8 mph headwind/);
});

test('bezier path starts with M and contains C', () => {
  const polar = loadPolar();
  const pts = polar.getConfig('dual').smooth.slice(0, 20).map((p) => ({ x_mph: p.mph, vs_kt: p.vs_kt }));
  const d = polar.polarToBezierPath(pts, (p) => p.x_mph, (p) => p.vs_kt);
  assert.match(d, /^M /);
  assert.match(d, / C /);
});

test('L/D probe clamps to stall for solo and dual', () => {
  const polar = loadPolar();
  const solo = polar.getConfig('solo');
  const dual = polar.getConfig('dual');
  assert.equal(solo.stall_mph, 34);
  assert.equal(dual.stall_mph, 38);
  assert.equal(polar.clampProbeMph('solo', 20), 34);
  assert.equal(polar.clampProbeMph('dual', 20), 38);
  const atStall = polar.probeAtAirspeed({ config: 'dual', airspeedMph: 10 });
  assert.equal(atStall.mph, 38);
  assert.ok(atStall.ld > 0);
  assert.ok(atStall.sink_kt > 0);
  assert.equal(atStall.at_stall, true);
});

test('polar sink matches POH sink-graph anchors', () => {
  const polar = loadPolar();
  const dualRef = [
    [38, 3.5],
    [42, 3.35],
    [48, 3.4],
    [54, 3.75],
    [60, 4.25],
    [66, 5.0],
    [72, 6.0],
    [78, 7.5],
    [84, 9.0],
    [87, 10.0]
  ];
  const soloRef = [
    [34, 3.0],
    [36, 2.9],
    [42, 2.95],
    [48, 3.6],
    [54, 4.25],
    [60, 5.25],
    [66, 6.0],
    [72, 7.25]
  ];
  for (const [mph, fps] of dualRef) {
    const p = polar.probeAtAirspeed({ config: 'dual', airspeedMph: mph });
    assert.ok(Math.abs(p.sink_fps - fps) < 0.02, `dual ${mph}: ${p.sink_fps} vs ${fps}`);
  }
  for (const [mph, fps] of soloRef) {
    const p = polar.probeAtAirspeed({ config: 'solo', airspeedMph: mph });
    assert.ok(Math.abs(p.sink_fps - fps) < 0.02, `solo ${mph}: ${p.sink_fps} vs ${fps}`);
  }
});
