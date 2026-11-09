import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKSPACE_VERSION, LEGACY_ANCHORS, normalizeWorkspace, parseWorkspaceJSON, serializeWorkspace, legacyWorkspaceFixture } from '../workspace.mjs';

const sample = () => ({
  version: 1,
  settings: { glow: 72, sceneScale: 65, units: 'm', pointSigmaM: 0.02, voice: false, showSim: true, reducedMotion: false },
  calibration: { calibrationScale: 1.02, knownM: 1.02, measuredM: 1 },
  anchors: [{ id: 'P1', position: { x: 1, y: 2, z: 3 }, frame: 'lab' }],
  annotations: [{ u: 0.25, v: 0.75, source: 'operator' }],
  estopLatched: false,
  armed: true
});

test('workspace v1 round-trips through JSON with safe normalized shape', () => {
  const input = sample();
  const parsed = parseWorkspaceJSON(serializeWorkspace(input));
  assert.equal(parsed.version, WORKSPACE_VERSION);
  assert.deepEqual(parsed.anchors, input.anchors);
  assert.deepEqual(parsed.calibration, input.calibration);
  assert.equal(parsed.armed, false);
});
test('workspace rejects versions other than v1', () => {
  assert.throws(() => normalizeWorkspace({ version: 2 }), /Unsupported workspace version/);
  assert.throws(() => normalizeWorkspace({ version: 0 }), /Unsupported workspace version/);
});
test('unknown top-level and nested keys are ignored', () => {
  const input = sample();
  input.apiKeys = { secret: 'never-export' };
  input.cameraStream = 'not-persisted';
  input.xrSession = { active: true };
  input.imuSamples = [1, 2, 3];
  input.settings.unrecognized = 'ignored';
  input.settings.voiceAuthority = true;
  const normalized = normalizeWorkspace(input);
  assert.equal('apiKeys' in normalized, false);
  assert.equal('cameraStream' in normalized, false);
  assert.equal('xrSession' in normalized, false);
  assert.equal('imuSamples' in normalized, false);
  assert.equal('unrecognized' in normalized.settings, false);
  assert.equal('voiceAuthority' in normalized.settings, false);
  assert.equal(JSON.stringify(normalized).includes('never-export'), false);
});
test('invalid anchor IDs and duplicate IDs are rejected', () => {
  const bad = sample(); bad.anchors[0].id = 'bad id';
  assert.throws(() => normalizeWorkspace(bad), /id is invalid/);
  const duplicate = sample(); duplicate.anchors.push({ ...duplicate.anchors[0] });
  assert.throws(() => normalizeWorkspace(duplicate), /Duplicate anchor ID/);
});
test('non-finite anchor coordinates are rejected', () => {
  const bad = sample(); bad.anchors[0].position.z = Infinity;
  assert.throws(() => normalizeWorkspace(bad), /finite x, y, z/);
});
test('non-positive or non-finite calibration scale is rejected', () => {
  for (const value of [0, -1, Infinity, NaN]) {
    const bad = sample(); bad.calibration.calibrationScale = value;
    assert.throws(() => normalizeWorkspace(bad), /calibrationScale/);
  }
});
test('Round 03 calibration.scale is accepted but normalized to calibrationScale', () => {
  const normalized = normalizeWorkspace({ version: 1, calibration: { scale: 1.25 } });
  assert.deepEqual(normalized.calibration, { calibrationScale: 1.25 });
  assert.equal('scale' in normalized.calibration, false);
});
test('estopLatched forces armed false during import', () => {
  const normalized = normalizeWorkspace({ version: 1, estopLatched: true, armed: true });
  assert.equal(normalized.estopLatched, true);
  assert.equal(normalized.armed, false);
});
test('all workspace imports force armed false even without a latched stop', () => {
  const normalized = normalizeWorkspace({ version: 1, estopLatched: false, armed: true });
  assert.equal(normalized.armed, false);
});
test('legacy A1/B2/C3/D4 anchors remain an optional fixture', () => {
  assert.deepEqual(LEGACY_ANCHORS.map(anchor => anchor.id), ['A1', 'B2', 'C3', 'D4']);
  assert.deepEqual(legacyWorkspaceFixture().anchors.map(anchor => anchor.id), ['A1', 'B2', 'C3', 'D4']);
});
test('workspace parser rejects non-JSON text and invalid unit labels', () => {
  assert.throws(() => parseWorkspaceJSON('{broken'), SyntaxError);
  assert.throws(() => normalizeWorkspace({ version: 1, settings: { units: 'yards' } }), /unsupported/);
});
test('workspace module exposes only serializable workspace state and no voice authority', () => {
  const serialized = serializeWorkspace({ ...sample(), settings: { ...sample().settings, voiceAuthority: true } });
  const parsed = JSON.parse(serialized);
  assert.equal('voiceAuthority' in parsed.settings, false);
  assert.equal('localStorage' in parsed, false);
});