/** Pure, versioned Aether workspace validation. No browser storage or device APIs. */
import { ANCHORS } from './core.mjs';

export const WORKSPACE_VERSION = 1;
export const WORKSPACE_UNITS = Object.freeze(['m', 'cm', 'mm', 'ft', 'in']);
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,15}$/;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => finite(value) && value > 0;

export const LEGACY_ANCHORS = Object.freeze(ANCHORS.map(anchor => Object.freeze({
  id: anchor.id,
  position: Object.freeze({ x: anchor.position[0], y: anchor.position[1], z: anchor.position[2] }),
  frame: 'lab'
})));

function requireRecord(value, label) {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
  return value;
}
function normalizeSettings(value = {}) {
  requireRecord(value, 'settings');
  const out = {
    glow: value.glow ?? 72,
    sceneScale: value.sceneScale ?? 65,
    voice: value.voice ?? false,
    showSim: value.showSim ?? true,
    reducedMotion: value.reducedMotion ?? false,
    units: value.units ?? 'm',
    pointSigmaM: value.pointSigmaM ?? 0.02
  };
  if (!finite(out.glow) || out.glow < 0 || out.glow > 100) throw new RangeError('settings.glow must be between 0 and 100');
  if (!finite(out.sceneScale) || out.sceneScale < 20 || out.sceneScale > 100) throw new RangeError('settings.sceneScale must be between 20 and 100');
  for (const key of ['voice', 'showSim', 'reducedMotion']) if (typeof out[key] !== 'boolean') throw new TypeError(`settings.${key} must be boolean`);
  if (!WORKSPACE_UNITS.includes(out.units)) throw new RangeError('settings.units is unsupported');
  if (!finite(out.pointSigmaM) || out.pointSigmaM < 0.001 || out.pointSigmaM > 0.5) throw new RangeError('settings.pointSigmaM must be between 0.001 and 0.5 meters');
  // voiceAuthority is intentionally omitted: C02 makes it session-only and non-persistent.
  return out;
}
function normalizeCalibration(value = {}) {
  requireRecord(value, 'calibration');
  // Accept the Round 03 `scale` spelling as an import alias, but emit only calibrationScale.
  const calibrationScale = value.calibrationScale ?? value.scale ?? 1;
  if (!positive(calibrationScale)) throw new RangeError('calibration.calibrationScale must be finite and greater than zero');
  const hasKnown = value.knownM !== undefined && value.knownM !== null;
  const hasMeasured = value.measuredM !== undefined && value.measuredM !== null;
  if (hasKnown !== hasMeasured) throw new TypeError('calibration.knownM and measuredM must be supplied together');
  if (hasKnown && (!positive(value.knownM) || !positive(value.measuredM))) throw new RangeError('calibration knownM and measuredM must be finite and greater than zero');
  return {
    calibrationScale,
    ...(hasKnown ? { knownM: value.knownM, measuredM: value.measuredM } : {})
  };
}
function normalizeAnchors(value = []) {
  if (!Array.isArray(value)) throw new TypeError('anchors must be an array');
  const seen = new Set();
  return value.map((anchor, index) => {
    requireRecord(anchor, `anchors[${index}]`);
    if (typeof anchor.id !== 'string' || !ID_PATTERN.test(anchor.id)) throw new TypeError(`anchors[${index}].id is invalid`);
    if (seen.has(anchor.id)) throw new TypeError(`Duplicate anchor ID: ${anchor.id}`);
    seen.add(anchor.id);
    const position = requireRecord(anchor.position, `anchors[${index}].position`);
    if (![position.x, position.y, position.z].every(finite)) throw new TypeError(`anchors[${index}].position requires finite x, y, z coordinates`);
    const frame = anchor.frame ?? 'lab';
    if (frame !== 'lab') throw new RangeError(`anchors[${index}].frame must be lab`);
    return { id: anchor.id, position: { x: position.x, y: position.y, z: position.z }, frame: 'lab' };
  });
}
function normalizeAnnotations(value = []) {
  if (!Array.isArray(value)) throw new TypeError('annotations must be an array');
  return value.map((annotation, index) => {
    requireRecord(annotation, `annotations[${index}]`);
    if (!finite(annotation.u) || annotation.u < 0 || annotation.u > 1 || !finite(annotation.v) || annotation.v < 0 || annotation.v > 1) {
      throw new RangeError(`annotations[${index}] u and v must be finite values from 0 to 1`);
    }
    if (annotation.source !== 'operator') throw new TypeError(`annotations[${index}].source must be operator`);
    return { u: annotation.u, v: annotation.v, source: 'operator' };
  });
}

export function normalizeWorkspace(input) {
  requireRecord(input, 'workspace');
  if (input.version !== WORKSPACE_VERSION) throw new RangeError(`Unsupported workspace version: ${String(input.version)}`);
  const estopLatched = input.estopLatched === true;
  if (input.estopLatched !== undefined && typeof input.estopLatched !== 'boolean') throw new TypeError('estopLatched must be boolean');
  if (input.armed !== undefined && typeof input.armed !== 'boolean') throw new TypeError('armed must be boolean');
  return {
    version: WORKSPACE_VERSION,
    settings: normalizeSettings(input.settings ?? {}),
    calibration: normalizeCalibration(input.calibration ?? {}),
    anchors: normalizeAnchors(input.anchors ?? []),
    annotations: normalizeAnnotations(input.annotations ?? []),
    estopLatched,
    // Workspace imports never arm an action gate, even when the file says armed:true.
    armed: false
  };
}

export function parseWorkspaceJSON(jsonText) {
  if (typeof jsonText !== 'string') throw new TypeError('Workspace input must be JSON text');
  return normalizeWorkspace(JSON.parse(jsonText));
}

export function serializeWorkspace(workspace, space = 2) {
  return JSON.stringify(normalizeWorkspace(workspace), null, space);
}

/** Optional fixture for importing the original A1/B2/C3/D4 demonstration anchors. */
export function legacyWorkspaceFixture() {
  return normalizeWorkspace({ version: 1, anchors: LEGACY_ANCHORS });
}