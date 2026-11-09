/** Shared 3D HUD layout for the canvas and the WebGL field. No second renderer and no device claims. */
export const PALETTE = Object.freeze({
  bg: '#07121f',
  surface: '#0a2130',
  fg: '#e7f6f2',
  muted: '#8aa8a4',
  primary: '#00f3ff',
  danger: '#ff5d4a',
  border: '#214858'
});
export const MODULES = Object.freeze(['radar', 'vision', 'devices', 'telemetry', 'controls']);

/** UI glow stays 0–100. Only the shader consumes the 0–1 fraction. */
export function shaderGlow(percent) {
  if (!Number.isFinite(percent)) throw new RangeError('glow percent required');
  return Math.min(100, Math.max(0, percent)) / 100;
}

export function buildHudLayout({
  anchors = [],
  selectedId = null,
  appearance = {},
  calibrationScale = null,
  safety = {},
  reducedMotion = false,
  origin = [0, 0, 0]
} = {}) {
  const glowPercent = Number.isFinite(appearance.glow) ? appearance.glow : 72;
  const sceneScale = Number.isFinite(appearance.sceneScale) ? appearance.sceneScale : (Number.isFinite(appearance.scale) ? appearance.scale : 65);
  const opacityPercent = Number.isFinite(appearance.opacity) ? appearance.opacity : 82;
  const stopped = safety.stopped === true;
  const armed = safety.armed === true && !stopped;
  const callouts = anchors.map(anchor => ({
    id: anchor.id,
    sourceMeters: [anchor.position[0], anchor.position[1], anchor.position[2]],
    selected: anchor.id === selectedId,
    sim: true
  }));
  const panels = [
    { id: 'status', role: 'status', textPx: 36, italic: false, font: 'sans-serif', widthM: 0.72, heightM: 0.24, position: [origin[0], origin[1] + 0.12, origin[2] - 1.6] },
    { id: 'safety', role: 'safety', textPx: 28, italic: false, font: 'sans-serif', widthM: 0.36, heightM: 0.12, position: [origin[0] + 0.42, origin[1] + 0.28, origin[2] - 1.55], label: stopped ? 'STOP LATCHED' : armed ? 'SIM ARMED' : 'SIM DISARMED' },
    { id: 'estop', role: 'estop', textPx: 24, italic: false, font: 'sans-serif', widthM: 0.28, heightM: 0.1, position: [origin[0] + 0.42, origin[1] - 0.04, origin[2] - 1.55], label: 'ESTOP' }
  ];
  return {
    simulated: true,
    banner: 'SIMULATION / NOT A ROOM SCAN',
    reducedMotion: reducedMotion === true,
    spin: reducedMotion === true ? 0 : 1,
    appearance: { glowPercent, sceneScale, opacityPercent, shaderGlow: shaderGlow(glowPercent) },
    calibrationScale,
    panels,
    callouts,
    modules: MODULES,
    palette: PALETTE,
    evidence: Object.freeze({
      agreed: false,
      quest3s: 'unverified',
      androidChrome: 'unverified',
      chromiumVisual: 'unverified',
      ble: 'unverified',
      camera: 'unverified',
      hardware: 'unverified'
    })
  };
}
