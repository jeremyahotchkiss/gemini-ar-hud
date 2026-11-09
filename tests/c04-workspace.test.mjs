import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionGate, exportWorkspace, importWorkspace, parseWorkspace } from '../core.mjs';

test('C04 accepts workspace version 1, ignores unknown keys, and does not touch visual settings', () => {
  const visual = { opacity: 82, glow: 72, scale: 65, range: 5, grid: true, particles: true, labels: true, audio: true };
  const before = { ...visual };
  const result = importWorkspace({
    version: 1,
    apiKey: 'sk-test-should-not-leak',
    token: 'secret',
    mystery: { nested: true },
    glow: 0.72,
    sceneScale: 65,
    calibrationScale: 1.02,
    estopLatched: false,
    armed: true
  }, { visualSettings: visual });
  assert.deepEqual(visual, before);
  assert.equal(result.visualSettings, visual);
  assert.equal(result.workspace.version, 1);
  assert.equal(result.workspace.sceneScale, 65);
  assert.equal(result.workspace.calibrationScale, 1.02);
  assert.notEqual(result.workspace.sceneScale, result.workspace.calibrationScale);
  assert.equal(result.workspace.armed, false);
  assert.equal(result.workspace.estopLatched, false);
  assert.equal(result.workspace.glow, undefined);
  assert.equal(result.workspace.apiKey, undefined);
  const dumped = JSON.stringify(result.workspace);
  assert.equal(dumped.includes('sk-test'), false);
  assert.equal(dumped.includes('secret'), false);
});

test('C04 estopLatched forces armed false on import', () => {
  const gate = new ActionGate();
  assert.equal(gate.arm('operator').ok, true);
  const result = importWorkspace({ version: 1, estopLatched: true, armed: true }, { gate });
  assert.equal(result.workspace.estopLatched, true);
  assert.equal(result.workspace.armed, false);
  assert.equal(gate.stopped, true);
  assert.equal(gate.armed, false);
  assert.equal(gate.activate(true, 'relay-1', { source: 'operator' }).ok, false);
});

test('C04 rejects other versions, bad ids, non-finite coordinates, and non-positive scale', () => {
  assert.throws(() => parseWorkspace({ version: 2 }), /version/i);
  assert.throws(() => parseWorkspace({ version: '1' }), /version/i);
  assert.throws(() => parseWorkspace({ version: 1, anchors: [{ id: '1bad', position: [0, 0, 0] }] }), /id/i);
  assert.throws(() => parseWorkspace({ version: 1, anchors: [{ id: 'A1', position: [0, NaN, 0] }] }), /finite/i);
  assert.throws(() => parseWorkspace({ version: 1, anchors: [{ id: 'A1', position: [0, Infinity, 1] }] }), /finite/i);
  assert.throws(() => parseWorkspace({ version: 1, calibrationScale: 0 }), /scale/i);
  assert.throws(() => parseWorkspace({ version: 1, calibrationScale: -1 }), /scale/i);
  assert.throws(() => parseWorkspace({ version: 1, sceneScale: 0 }), /scale/i);
  assert.throws(() => parseWorkspace({ version: 1, sceneScale: Number.NaN }), /scale/i);
});

test('C04 preserves A1-D4 as an optional legacy fixture', () => {
  const parsed = parseWorkspace({ version: 1 });
  assert.equal(parsed.anchors, null);
  assert.deepEqual(parsed.legacyAnchors.map(anchor => anchor.id), ['A1', 'B2', 'C3', 'D4']);
  const custom = parseWorkspace({ version: 1, anchors: [{ id: 'Z9', position: { x: 1, y: 2, z: -3 } }] });
  assert.equal(custom.anchors[0].id, 'Z9');
  assert.deepEqual(custom.anchors[0].position, [1, 2, -3]);
  assert.deepEqual(custom.legacyAnchors.map(anchor => anchor.id), ['A1', 'B2', 'C3', 'D4']);
  assert.deepEqual(custom.legacyAnchors[0].position, [-1.8, 0.45, -2.9]);
});

test('C04 workspace round-trip keeps distinct scales and drops secrets', () => {
  const exported = exportWorkspace({
    sceneScale: 80,
    calibrationScale: 1.02,
    estopLatched: true,
    anchors: [{ id: 'A1', position: [-1.8, 0.45, -2.9] }],
    apiKey: 'nope'
  });
  assert.equal(exported.version, 1);
  assert.equal(exported.apiKey, undefined);
  const again = parseWorkspace(JSON.stringify(exported));
  assert.equal(again.sceneScale, 80);
  assert.equal(again.calibrationScale, 1.02);
  assert.equal(again.estopLatched, true);
  assert.equal(again.armed, false);
  assert.equal(again.anchors[0].id, 'A1');
  assert.deepEqual(again.anchors[0].position, [-1.8, 0.45, -2.9]);
});
