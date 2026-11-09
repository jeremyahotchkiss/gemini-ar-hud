/** Aether HUD core: pure math, command routing, safety state. No browser globals. */
export const ANCHORS = Object.freeze([
  { id: 'A1', name: 'Beacon Alpha', kind: 'BLE SIM', position: [-1.8, 0.45, -2.9], quality: 0.93 },
  { id: 'B2', name: 'Workstation', kind: 'OBJECT DEMO', position: [1.6, 0.75, -3.2], quality: 0.87 },
  { id: 'C3', name: 'Cargo Node', kind: 'ROUTE DEMO', position: [0.15, -0.35, -1.7], quality: 0.96 },
  { id: 'D4', name: 'Power Relay', kind: 'DEVICE SIM', position: [-0.9, -0.55, -4.0], quality: 0.91 }
]);
/** Simulated targets only. No physical relay, beacon, or GPIO is connected. */
export const HARDWARE_ALLOWLIST = Object.freeze(['beacon', 'relay-1', 'marker-pulse']);
const WORKSPACE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,15}$/;
const COMMAND_ID = '[a-z][a-z0-9_-]{0,15}';
const COMMAND_NUM = '[-+]?(?:\\d+\\.\\d+|\\d+)';
const LENGTH_TO_METERS = Object.freeze({ m: 1, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254 });
export const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v)));
export function distance3(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 3 || b.length !== 3 || ![...a,...b].every(Number.isFinite)) throw new TypeError('Three finite coordinates required');
  return Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
}
export function virtualPixelDistance(a, b, width, metersAcross) {
  if (![a?.x,a?.y,b?.x,b?.y,width,metersAcross].every(Number.isFinite) || width <= 0 || metersAcross <= 0) throw new RangeError('Invalid calibration');
  return Math.hypot(a.x-b.x, a.y-b.y) / width * metersAcross;
}
export function rssiDistance(rssi, referenceRssi = -59, pathLoss = 2) {
  if (![rssi,referenceRssi,pathLoss].every(Number.isFinite) || pathLoss <= 0) throw new RangeError('Invalid radio model');
  return 10 ** ((referenceRssi-rssi)/(10*pathLoss));
}
export function estimate2D(anchors, distances) {
  // Linear least squares from range-squared differences. Use >=3 non-collinear anchors.
  if (anchors.length < 3 || anchors.length !== distances.length) throw new Error('Need >=3 anchors and equal ranges');
  const [p0, ...rest] = anchors; const d0 = distances[0];
  let aa=0,ab=0,bb=0,ay=0,by=0;
  rest.forEach((p,i)=>{
    const a=2*(p[0]-p0[0]), b=2*(p[1]-p0[1]);
    const y=d0*d0-distances[i+1]**2 + p[0]**2-p0[0]**2 + p[1]**2-p0[1]**2;
    aa+=a*a;ab+=a*b;bb+=b*b;ay+=a*y;by+=b*y;
  });
  const det=aa*bb-ab*ab;
  if(Math.abs(det)<1e-9) throw new Error('Degenerate anchor geometry');
  return [(ay*bb-by*ab)/det,(aa*by-ab*ay)/det];
}
export function command(text) {
  const t=String(text||'').trim().toLowerCase();
  if (!t || t === 'help') return {type:'help'};
  if (t === 'reset-estop' || /\breset-estop\b/.test(t)) return {type:'reset-estop'};
  if (/\b(emergency stop|e-stop|halt|abort)\b/.test(t)) return {type:'stop'};
  if (t === 'estop' || /\bestop\b/.test(t)) return {type:'estop'};
  if (t === 'clear-log') return {type:'clear-log'};
  if (/\b(reset safety|reset stop)\b/.test(t)) return {type:'reset'};
  if (/\b(disarm|safe mode)\b/.test(t)) return {type:'disarm'};
  if (t === 'arm' || /\b(arm action|arm device|arm gate)\b/.test(t) || /\barm\b/.test(t)) return {type:'arm'};
  if (/\b(open gate|activate relay)\b/.test(t)) return {type:'gate'};
  const action=t.match(new RegExp(`^action\\s+(${COMMAND_ID})$`));
  if (action) return HARDWARE_ALLOWLIST.includes(action[1]) ? {type:'action',id:action[1]} : {type:'unknown',query:t,reason:'not on allowlist'};
  const authority=t.match(/\bvoice-authority\s+(on|off)\b/);
  if (authority) return {type:'voice-authority',value:authority[1]==='on'};
  const voice=t.match(/\bvoice\s+(on|off)\b/);
  if (voice) return {type:'voice',value:voice[1]==='on'};
  const sim=t.match(/\bsim\s+(on|off)\b/);
  if (sim) return {type:'sim',value:sim[1]==='on'};
  const units=t.match(new RegExp(`\\bunits\\s+(${Object.keys(LENGTH_TO_METERS).join('|')})\\b`));
  if (units) return {type:'units',unit:units[1]};
  const place=t.match(new RegExp(`^place\\s+(${COMMAND_ID})\\s+(${COMMAND_NUM})\\s+(${COMMAND_NUM})\\s+(${COMMAND_NUM})$`));
  if (place) return {type:'place',id:place[1].toUpperCase(),position:[Number(place[2]),Number(place[3]),Number(place[4])]};
  const selected=t.match(new RegExp(`^select\\s+(${COMMAND_ID})$`));
  if (selected) return {type:'select',id:selected[1].toUpperCase()};
  const removed=t.match(new RegExp(`^remove\\s+(${COMMAND_ID})$`));
  if (removed) return {type:'remove',id:removed[1].toUpperCase()};
  const calibrated=t.match(new RegExp(`^calibrate\\s+(${COMMAND_NUM})\\s+(${COMMAND_NUM})$`));
  if (calibrated) return {type:'calibrate',knownM:Number(calibrated[1]),measuredM:Number(calibrated[2])};
  const uncertainty=t.match(new RegExp(`^sigma\\s+(${COMMAND_NUM})$`));
  if (uncertainty) return {type:'sigma',pointSigma:Number(uncertainty[1])};
  const pair=t.match(new RegExp(`^measure\\s+(${COMMAND_ID})\\s+(${COMMAND_ID})$`));
  if (pair) return {type:'measure',from:pair[1].toUpperCase(),to:pair[2].toUpperCase()};
  const tagged=t.match(/^tag\s+(.+)$/);
  if (tagged) return {type:'tag',label:tagged[1]};
  const asked=t.match(/^ask\s+(.+)$/);
  if (asked) return {type:'ask',text:asked[1]};
  const noted=t.match(/^note\s+(.+)$/);
  if (noted) return {type:'note',text:noted[1]};
  if (/\b(grid|particles|labels)\s+(on|off)\b/.test(t)) {const m=t.match(/\b(grid|particles|labels)\s+(on|off)\b/); return {type:'toggle',key:m[1],value:m[2]==='on'};}
  if (/\b(?:opacity|scale|range|glow)\s+(\d{1,3})\b/.test(t)) {const m=t.match(/\b(opacity|scale|range|glow)\s+(\d{1,3})\b/); return {type:'slider',key:m[1],value:Number(m[2])};}
  if (/\b(measure|distance)\b/.test(t)) return {type:'measure'};
  if (/\b(draw|annotate|mark)\b/.test(t)) return {type:'draw'};
  if (/\b(scan|radar|sweep)\b/.test(t)) return {type:'scan'};
  if (/\b(vision|camera)\b/.test(t)) return {type:'panel',value:'vision'};
  if (/\b(telemetry|sensors)\b/.test(t)) return {type:'panel',value:'telemetry'};
  if (/\b(devices|bluetooth|ble)\b/.test(t)) return {type:'panel',value:'devices'};
  if (/\b(settings|controls)\b/.test(t)) return {type:'panel',value:'controls'};
  if (/\b(system status|diagnostics|status)\b/.test(t)) return {type:'status'};
  const target=ANCHORS.find(a=>t.includes(a.id.toLowerCase())||t.includes(a.name.toLowerCase()));
  if(target) return {type:'focus',id:target.id};
  return {type:'unknown',query:t};
}
/**
 * Source boundary for local text commands. AI/model output is advisory-only and
 * never reaches command(). The speech path is restricted before dispatch.
 */
export function authorizedCommand(text, { source, voiceAuthority = false } = {}) {
  if (source === 'model') return { ok: false, command: null, reason: 'Model advisory is never executable.' };
  if (source !== 'operator' && source !== 'speech') return { ok: false, command: null, reason: 'Untrusted command source.' };
  const parsed = command(text);
  if (source === 'speech') {
    if (parsed.type === 'reset' || parsed.type === 'reset-estop') return { ok: false, command: null, reason: 'Speech cannot reset the emergency stop.' };
    if (parsed.type === 'voice-authority') return { ok: false, command: null, reason: 'Voice authority is changed only by the operator.' };
    if (['arm', 'disarm', 'gate', 'action'].includes(parsed.type) && voiceAuthority !== true) {
      return { ok: false, command: null, reason: 'Voice authority is off. Use the operator controls.' };
    }
  }
  return { ok: true, command: parsed, reason: '' };
}

/**
 * SIMULATED relay interlock. This class does not send any physical I/O.
 * Separate, append-only-within-session safety audit; visible UI events can be
 * cleared without clearing the audit. Import never un-latches a stop.
 */
export class ActionGate {
  #audit = [];
  #seq = 0;
  #allowed;
  constructor({ allowlist = HARDWARE_ALLOWLIST } = {}) {
    if (!Array.isArray(allowlist) || !allowlist.length || !allowlist.every(v => typeof v === 'string' && /^[a-z][a-z0-9-]*$/.test(v))) {
      throw new TypeError('Invalid simulated action allowlist');
    }
    this.#allowed = new Set(allowlist);
    this.hardwareAllowlist = Object.freeze([...allowlist]);
    this.armed = false;
    this.stopped = false;
    this.activations = 0;
  }
  /** Physical hardware is not connected. This cannot be switched on by workspace data. */
  get connected() { return false; }
  #record(actor, event, result, detail = '') {
    this.#audit.push(Object.freeze({ id: ++this.#seq, at: new Date().toISOString(), actor, event, result, detail }));
  }
  getAudit() { return this.#audit.map(entry => ({ ...entry })); }
  recordDeniedInput(source, reason) { this.#record(source, 'input-deny', 'denied', String(reason)); }
  #access(source, authority = false, event = 'action') {
    if (source === 'model') return 'Model advisory cannot control simulated hardware.';
    if (source !== 'operator' && source !== 'speech') return 'Untrusted hardware command source.';
    if (source === 'speech' && event === 'reset') return 'Speech cannot reset the stop latch.';
    if (source === 'speech' && event !== 'stop' && authority !== true) return 'Voice authority is off.';
    return '';
  }
  arm(source = 'operator', voiceAuthority = false) {
    const denied = this.#access(source, voiceAuthority, 'arm');
    if (denied) { this.#record(source, 'arm', 'denied', denied); return { ok: false, message: denied }; }
    if (this.stopped) { this.#record(source, 'arm', 'latched'); return { ok: false, message: 'Emergency stop latched. Reset first.' }; }
    this.armed = true;
    this.#record(source, 'arm', 'ok');
    return { ok: true, message: 'SIM gate armed. Confirmation required.' };
  }
  activate(confirmed = false, id = 'relay-1', { source = 'operator', voiceAuthority = false, signal } = {}) {
    const denied = this.#access(source, voiceAuthority, 'action');
    if (denied) { this.#record(source, 'action-deny', 'denied', denied); return { ok: false, message: denied }; }
    if (this.stopped) { this.#record(source, 'action-deny', 'latched'); return { ok: false, message: 'Blocked: emergency stop.' }; }
    if (!this.armed) { this.#record(source, 'action-deny', 'denied', 'disarmed'); return { ok: false, message: 'Blocked: gate is disarmed.' }; }
    if (!this.#allowed.has(id)) { this.#record(source, 'action-deny', 'denied', 'unknown target'); return { ok: false, message: 'Blocked: action not on allowlist.' }; }
    if (signal?.aborted) { this.#record(source, 'action-deny', 'denied', 'aborted'); return { ok: false, message: 'Blocked: operation aborted.' }; }
    if (confirmed !== true) { this.#record(source, 'action-deny', 'denied', 'confirmation required'); return { ok: false, message: 'Blocked: explicit confirmation required.' }; }
    this.armed = false;
    this.activations += 1;
    this.#record(source, 'action-accept', 'ok', `SIM ${id}`);
    return { ok: true, message: 'SIM relay pulse issued. Gate disarmed.' };
  }
  disarm(source = 'operator', voiceAuthority = false) {
    const denied = this.#access(source, voiceAuthority, 'disarm');
    if (denied) { this.#record(source, 'disarm', 'denied', denied); return { ok: false, message: denied }; }
    this.armed = false;
    this.#record(source, 'disarm', 'ok');
    return { ok: true, message: 'Gate disarmed.' };
  }
  stop(source = 'operator') {
    const denied = this.#access(source, false, 'stop');
    if (denied) { this.#record(source, 'estop', 'denied', denied); return { ok: false, message: denied }; }
    this.stopped = true;
    this.armed = false;
    this.#record(source, 'estop', 'latched');
    return { ok: true, message: 'EMERGENCY STOP latched. All actions blocked.' };
  }
  reset(source = 'operator') {
    const denied = this.#access(source, false, 'reset');
    if (denied) { this.#record(source, 'reset-estop', 'denied', denied); return { ok: false, message: denied }; }
    this.stopped = false;
    this.armed = false;
    this.#record(source, 'reset-estop', 'ok');
    return { ok: true, message: 'Safety reset. Gate remains disarmed.' };
  }
  /** Only preserve or strengthen a stop, never clear it by importing data. */
  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new TypeError('Invalid safety snapshot');
    this.stopped = this.stopped || snapshot.stopped === true || snapshot.estopLatched === true;
    this.armed = false;
    this.#record('system', 'restore', this.stopped ? 'latched' : 'ok', 'import cannot arm or reset');
    return { stopped: this.stopped, armed: this.armed };
  }
}
export function formatMeters(n){return n < 1 ? `${(n*100).toFixed(1)} cm` : `${n.toFixed(2)} m`;}

/** Model text is stored as advisory and is never passed to command(). */
export function appendAdvisory(log, text) {
  if (!Array.isArray(log)) throw new TypeError('Advisory log must be an array');
  const entry = Object.freeze({ kind: 'advisory', source: 'model', text: String(text ?? ''), executable: false });
  log.push(entry);
  return entry;
}

function legacyAnchorFixture() {
  return ANCHORS.map(anchor => ({
    id: anchor.id,
    name: anchor.name,
    kind: anchor.kind,
    position: [...anchor.position],
    quality: anchor.quality,
    legacy: true
  }));
}
function readVec3(position) {
  const source = Array.isArray(position) ? position : position && typeof position === 'object' ? [position.x, position.y, position.z] : null;
  if (!source || source.length !== 3 || source.some(value => typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Non-finite coordinates');
  return [source[0], source[1], source[2]];
}
function readScale(value, present) {
  if (!present) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new RangeError('Non-positive scale');
  return value;
}
/** aether-workspace.json version 1. Unknown keys are ignored. Visual settings are not applied here. */
export function parseWorkspace(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Invalid workspace');
  if (data.version !== 1) throw new Error('Unsupported workspace version');
  const scenePresent = Object.prototype.hasOwnProperty.call(data, 'sceneScale') || Boolean(data.appearance && Object.prototype.hasOwnProperty.call(data.appearance, 'sceneScale'));
  const sceneValue = Object.prototype.hasOwnProperty.call(data, 'sceneScale') ? data.sceneScale : data.appearance?.sceneScale;
  const calibrationPresent = Object.prototype.hasOwnProperty.call(data, 'calibrationScale') || Boolean(data.calibration && Object.prototype.hasOwnProperty.call(data.calibration, 'scale'));
  const calibrationValue = Object.prototype.hasOwnProperty.call(data, 'calibrationScale') ? data.calibrationScale : data.calibration?.scale;
  let anchors = null;
  if (Object.prototype.hasOwnProperty.call(data, 'anchors')) {
    if (!Array.isArray(data.anchors)) throw new TypeError('Invalid anchors');
    const seen = new Set();
    anchors = data.anchors.map(raw => {
      if (!raw || typeof raw.id !== 'string' || !WORKSPACE_ID.test(raw.id) || seen.has(raw.id)) throw new Error('Bad anchor id');
      seen.add(raw.id);
      return { id: raw.id, position: readVec3(raw.position), frame: 'lab' };
    });
  }
  if (data.units != null && !Object.prototype.hasOwnProperty.call(LENGTH_TO_METERS, data.units)) throw new Error('Bad unit');
  return {
    version: 1,
    filename: 'aether-workspace.json',
    estopLatched: data.estopLatched === true,
    armed: false,
    anchors,
    legacyAnchors: legacyAnchorFixture(),
    sceneScale: readScale(sceneValue, scenePresent),
    calibrationScale: readScale(calibrationValue, calibrationPresent),
    units: data.units ?? null
  };
}
export function importWorkspace(input, { visualSettings = null, gate = null } = {}) {
  const workspace = parseWorkspace(input);
  if (gate) gate.restore({ estopLatched: workspace.estopLatched, stopped: workspace.estopLatched, armed: false });
  return { workspace, visualSettings };
}
export function exportWorkspace(state = {}) {
  const payload = { version: 1, estopLatched: state.estopLatched === true };
  if (state.sceneScale !== undefined) payload.sceneScale = state.sceneScale;
  if (state.calibrationScale !== undefined) payload.calibrationScale = state.calibrationScale;
  if (state.anchors !== undefined) payload.anchors = state.anchors;
  if (state.units !== undefined) payload.units = state.units;
  const parsed = parseWorkspace(payload);
  return {
    version: 1,
    sceneScale: parsed.sceneScale,
    calibrationScale: parsed.calibrationScale,
    estopLatched: parsed.estopLatched,
    armed: false,
    anchors: parsed.anchors,
    units: parsed.units
  };
}

/** Operator estimate. Does not replace distance3 or virtualPixelDistance. */
export function calibrate(knownM, measuredM) {
  if (!Number.isFinite(measuredM) || measuredM <= 0) throw new RangeError('measuredM must be finite and positive');
  if (!Number.isFinite(knownM) || knownM <= 0) throw new RangeError('knownM must be finite and positive');
  const calibrationScale = knownM / measuredM;
  return Object.freeze({ knownM, measuredM, calibrationScale, scale: calibrationScale, label: 'operator-estimate', authoritative: false });
}
/** First-order isotropic point uncertainty. Operator estimate, not a survey. */
export function sigma(pointSigma, calibrationScale) {
  if (!Number.isFinite(pointSigma)) throw new RangeError('pointSigma must be finite');
  if (!Number.isFinite(calibrationScale) || calibrationScale <= 0) throw new RangeError('calibrationScale must be finite and positive');
  return Object.freeze({
    meters: pointSigma * Math.sqrt(2) * calibrationScale,
    pointSigma,
    calibrationScale,
    label: 'operator-estimate',
    authoritative: false
  });
}
export function convertLength(value, fromUnit, toUnit) {
  if (!Number.isFinite(value)) throw new RangeError('non-finite length');
  if (!Object.prototype.hasOwnProperty.call(LENGTH_TO_METERS, fromUnit) || !Object.prototype.hasOwnProperty.call(LENGTH_TO_METERS, toUnit)) throw new RangeError('unsupported unit');
  return value * LENGTH_TO_METERS[fromUnit] / LENGTH_TO_METERS[toUnit];
}
