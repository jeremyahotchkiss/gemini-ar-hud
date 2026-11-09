import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, PALETTE, buildHudLayout, shaderGlow } from '../hud.mjs';

test('HUD palette, modules, and shader glow mapping stay distinct from calibration', () => {
  assert.deepEqual(PALETTE, {
    bg: '#07121f',
    surface: '#0a2130',
    fg: '#e7f6f2',
    muted: '#8aa8a4',
    primary: '#00f3ff',
    danger: '#ff5d4a',
    border: '#214858'
  });
  assert.deepEqual(MODULES, ['radar', 'vision', 'devices', 'telemetry', 'controls']);
  assert.equal(shaderGlow(72), 0.72);
  assert.equal(shaderGlow(0), 0);
  assert.equal(shaderGlow(100), 1);
});

test('3D HUD layout is a simulated overlay and does not mutate anchor meters', () => {
  const anchors = [{ id: 'A1', name: 'Beacon Alpha', position: [-1.8, 0.45, -2.9] }];
  const layout = buildHudLayout({
    anchors,
    selectedId: 'A1',
    appearance: { opacity: 82, glow: 72, sceneScale: 65 },
    calibrationScale: 1.02,
    safety: { armed: true, stopped: false },
    reducedMotion: true
  });
  assert.deepEqual(anchors[0].position, [-1.8, 0.45, -2.9]);
  assert.equal(layout.simulated, true);
  assert.equal(layout.banner, 'SIMULATION / NOT A ROOM SCAN');
  assert.equal(layout.reducedMotion, true);
  assert.equal(layout.spin, 0);
  assert.equal(layout.appearance.glowPercent, 72);
  assert.equal(layout.appearance.sceneScale, 65);
  assert.equal(layout.calibrationScale, 1.02);
  assert.notEqual(layout.appearance.sceneScale, layout.calibrationScale);
  assert.equal(layout.appearance.shaderGlow, 0.72);
  assert.ok(layout.panels.every(panel => panel.textPx >= 18 && panel.italic === false));
  assert.ok(layout.panels.some(panel => panel.role === 'safety'));
  assert.ok(layout.panels.some(panel => panel.role === 'estop'));
  const [x, y, z] = layout.panels[0].position;
  const distance = Math.hypot(x, y, z);
  assert.ok(distance > 1 && distance < 2.5);
  assert.equal(layout.evidence.agreed, false);
  assert.equal(layout.evidence.quest3s, 'unverified');
  assert.equal(layout.evidence.androidChrome, 'unverified');
  assert.equal(layout.evidence.chromiumVisual, 'unverified');
  assert.equal(layout.evidence.hardware, 'unverified');
  assert.equal(layout.callouts[0].sim, true);
});
