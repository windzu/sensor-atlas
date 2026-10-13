import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../docs/assets/vendor/three.module.js';
import { LowPolyScene } from '../docs/assets/lowpoly-scene.js';
import { returnsFor, copy, baselineValue } from '../web/assets/scene-data.js';

function scene(kind, value = 60, targetKind = 'person') {
  const s = Object.create(LowPolyScene.prototype);
  Object.assign(s, { kind, value, targetKind, isHero: kind === 'hero', materials: new Map(), scene: new THREE.Scene(), cloudScene: new THREE.Scene(), copy: copy[kind] });
  s.setupWorld();
  return s;
}
function variance(points, axis) {
  const mean = points.reduce((sum, p) => sum + p[axis], 0) / points.length;
  return points.reduce((sum, p) => sum + (p[axis] - mean) ** 2, 0) / points.length;
}

test('all scenes generate finite returns within the shared buffer capacity', () => {
  for (const kind of Object.keys(copy)) {
    const s = scene(kind, kind === 'glass' ? 60 : 80);
    for (const value of [baselineValue(kind), kind === 'glass' ? 60 : 80]) {
      const result = returnsFor(kind, s.samples, value);
      assert.ok(result.valid.length > 0, kind);
      assert.ok(result.valid.length <= 4096 && result.anomalous.length <= 2048, kind);
      assert.ok([...result.valid, ...result.anomalous].flat().every(Number.isFinite), kind);
    }
    assert.equal(returnsFor(kind, s.samples, baselineValue(kind)).anomalous.length, 0, kind + ' baseline');
  }
});

test('increasing range reduces every target silhouette without introducing false points', () => {
  for (const target of ['person', 'car', 'rider', 'cone']) {
    const s = scene('range', 35, target);
    const near = returnsFor('range', s.samples, 5), far = returnsFor('range', s.samples, 80);
    assert.ok(far.valid.length < near.valid.length, target);
    assert.equal(far.anomalous.length, 0);
  }
});

test('precision changes plane normal spread rather than inventing distant ghosts', () => {
  const samples = scene('precision').samples.filter((point) => point.tag === 'wall');
  const near = returnsFor('precision', samples, 10), far = returnsFor('precision', samples, 80);
  assert.ok(variance(far.valid, 0) > variance(near.valid, 0) * 5);
  assert.equal(far.valid.length, near.valid.length);
  assert.equal(far.anomalous.length, 0);
});

test('tail points stay between the foreground edge and background wall', () => {
  const result = returnsFor('tail', scene('tail').samples, 100);
  assert.ok(result.anomalous.length > 0);
  assert.ok(result.anomalous.every(([x]) => x > .37 && x < 2.06));
});

test('wet-ground false returns are below the ground plane and absent in the dry baseline', () => {
  const samples = scene('wet').samples;
  const wet = returnsFor('wet', samples, 100), dry = returnsFor('wet', samples, 0);
  assert.ok(wet.valid.length < dry.valid.length);
  assert.ok(wet.anomalous.length > 0 && wet.anomalous.every((p) => p[1] < 0));
  assert.equal(dry.anomalous.length, 0);
});

test('fog both removes target returns and introduces points in the air', () => {
  const samples = scene('fog').samples;
  const clear = returnsFor('fog', samples, 0), fog = returnsFor('fog', samples, 100);
  assert.ok(fog.valid.length < clear.valid.length);
  assert.ok(fog.anomalous.length > 0 && fog.anomalous.every((p) => p[1] > 0));
});

test('dirt removes only the affected angular sector and cleaning restores it', () => {
  const samples = scene('dirt').samples;
  const dirty = returnsFor('dirt', samples, 100), clean = returnsFor('dirt', samples, 0);
  assert.equal(clean.valid.length, samples.length);
  const outside = samples.filter(({ p }) => p[2] <= -.95 || p[2] >= .18 || p[1] <= .4 || p[1] >= 2.12);
  const keys = new Set(dirty.valid.map((p) => p.join(',')));
  assert.ok(outside.every(({ p }) => keys.has(p.join(','))));
  assert.ok(dirty.valid.length < clean.valid.length);
});

test('glass retains transmitted target returns and ghost includes a separate empty region', () => {
  const glass = scene('glass'), ghost = scene('ghost');
  assert.ok(returnsFor('glass', glass.samples, 60).valid.length > 0);
  assert.ok(returnsFor('glass', glass.samples, 60).anomalous.length > 0);
  assert.ok(returnsFor('ghost', ghost.samples, 100).anomalous.some((p) => p[2] > 1.1));
});

test('glass surface returns remain on the same rotated physical panel', () => {
  const samples = scene('glass').samples.filter((point) => point.tag === 'glass');
  for (const degrees of [0, 35, 60]) {
    const angle = degrees * Math.PI / 180;
    const result = returnsFor('glass', samples, degrees);
    assert.ok(result.valid.length > 0);
    for (const point of result.valid) {
      const normalDistance = (point[0] - .45) * Math.cos(angle) - (point[2] + .35) * Math.sin(angle);
      assert.ok(Math.abs(normalDistance) < .019, degrees + ' degrees');
    }
  }
});

test('pause freezes animation time across delayed frames while allowing camera controls', () => {
  let draws = 0;
  const s = Object.create(LowPolyScene.prototype);
  Object.assign(s, { paused: true, visible: true, time: 4.5, lastFrame: 1000, lastDraw: 0, canvas: { closest: () => null }, draw: () => { draws++; } });
  s.tick(9000); s.tick(16000);
  assert.equal(s.time, 4.5);
  assert.equal(draws, 0);
  s.paused = false; s.tick(16020);
  assert.ok(s.time > 4.5 && s.time <= 4.53);
});
