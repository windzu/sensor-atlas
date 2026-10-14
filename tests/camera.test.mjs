import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cameraMeta, cameraCondition, rowDisplacement } from '../web/assets/camera-data.js';
import { CameraScene } from '../web/assets/camera-scene.js';

test('camera baselines are stable across animation time and all effects stay bounded', () => {
  for (const { id } of cameraMeta) {
    assert.deepEqual(cameraCondition(id, 0, 1), cameraCondition(id, 0, 7), id);
    for (const value of [-10, 0, 60, 100, 500, NaN]) {
      const condition = cameraCondition(id, value, 3);
      assert.ok(Object.values(condition).every((v) => typeof v === 'boolean' || Number.isFinite(v)), id);
      assert.ok(condition.amount >= 0 && condition.amount <= 1);
      assert.ok(condition.resolution >= 1 && condition.resolution <= 480);
      assert.ok(condition.led >= 0 && condition.led <= 1);
    }
  }
});

test('exposure blur and line timing remain distinct; reversing motion reverses row skew', () => {
  const blur = cameraCondition('motion', 100), rolling = cameraCondition('shutter', 100);
  assert.ok(blur.smear > 0); assert.equal(blur.rowShift, 0);
  assert.ok(rolling.rowShift > 0); assert.equal(rolling.smear, 0);
  assert.ok(cameraCondition('shutter', 100, Math.PI / .7).rowShift < 0);
  assert.ok(cameraCondition('motion', 100, Math.PI / 1.4).smear < 1e-10);
  assert.equal(rowDisplacement(0, 271, 60), -30);
  assert.equal(rowDisplacement(135, 271, 60), 0);
  assert.equal(rowDisplacement(270, 271, 60), 30);
  for (const row of [0, 71, 180, 270]) assert.equal(rowDisplacement(row, 271, -60), -rowDisplacement(row, 271, 60));
});

test('LED can be missed at one phase while scene illumination remains independent', () => {
  const dim = cameraCondition('flicker', 100, Math.PI / 6), bright = cameraCondition('flicker', 100, Math.PI / 2);
  assert.equal(dim.led, 0); assert.equal(bright.led, 1);
  assert.equal(dim.darkness, 0); assert.equal(dim.clipping, 0);
  assert.ok(cameraCondition('timing', 30).offset > 0);
  assert.equal(cameraCondition('timing', 30).missing, false);
  assert.equal(cameraCondition('timing', 100).missing, true);
});

test('camera pause and hidden panels freeze time and avoid delayed-frame jumps', () => {
  let draws = 0;
  const scene = Object.create(CameraScene.prototype);
  Object.assign(scene, { paused: true, visible: true, time: 2, lastFrame: 100, lastDraw: 0, canvas: { closest: () => null }, draw: () => { draws++; } });
  scene.tick(5000); assert.equal(scene.time, 2); assert.equal(draws, 0);
  scene.paused = false; scene.tick(5020); assert.ok(scene.time <= 2.03);
  scene.canvas.closest = () => ({});
  const current = scene.time; scene.tick(9000); assert.equal(scene.time, current);
});

test('camera guide, download and generated navigation preserve all ten full protocols', async () => {
  const [source, download, json, html] = await Promise.all([
    readFile(new URL('../content/camera/hardware-evaluation.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/downloads/camera-hardware-evaluation.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/assets/camera-topics.json', import.meta.url), 'utf8'),
    readFile(new URL('../docs/camera.html', import.meta.url), 'utf8')
  ]);
  assert.equal(download, source);
  const topics = JSON.parse(json);
  assert.equal(topics.length, 10); assert.equal(new Set(topics.map(({ id }) => id)).size, 10);
  for (const topic of topics) {
    for (const key of ['principle', 'objects', 'judgment', 'review', 'report']) assert.ok(topic[key].length > 10, topic.id + ' / ' + key);
    assert.ok(topic.steps.length >= 4, topic.id);
    assert.ok(html.includes('aria-controls="' + topic.id + '"') && html.includes('data-camera="' + topic.id + '"'), topic.id);
  }
  assert.equal(html.includes('{{'), false);
  assert.equal(html.includes('data-scene='), false);
  assert.ok(html.includes('camera-hardware-evaluation.md'));
});
