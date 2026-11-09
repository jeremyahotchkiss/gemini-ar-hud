/** Aether HUD core: pure math, command routing, safety state. No browser globals. */
export const ANCHORS = Object.freeze([
  { id: 'A1', name: 'Beacon Alpha', kind: 'BLE SIM', position: [-1.8, 0.45, -2.9], quality: 0.93 },
  { id: 'B2', name: 'Workstation', kind: 'OBJECT DEMO', position: [1.6, 0.75, -3.2], quality: 0.87 },
  { id: 'C3', name: 'Cargo Node', kind: 'ROUTE DEMO', position: [0.15, -0.35, -1.7], quality: 0.96 },
  { id: 'D4', name: 'Power Relay', kind: 'DEVICE SIM', position: [-0.9, -0.55, -4.0], quality: 0.91 }
]);
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
  if (!t) return {type:'help'};
  if (/\b(emergency stop|e-stop|halt|abort)\b/.test(t)) return {type:'stop'};
  if (t === 'clear-log') return {type:'clear-log'};
  if (/\b(reset safety|reset stop)\b/.test(t)) return {type:'reset'};
  if (/\b(arm action|arm device|arm gate)\b/.test(t)) return {type:'arm'};
  if (/\b(disarm|safe mode)\b/.test(t)) return {type:'disarm'};
  if (/\b(open gate|activate relay)\b/.test(t)) return {type:'gate'};
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
export function authorizedCommand(text, { source = 'operator', voiceAuthority = false } = {}) {
  if (source === 'model') return { ok: false, command: null, reason: 'Model advisory is never executable.' };
  if (source !== 'operator' && source !== 'speech') return { ok: false, command: null, reason: 'Untrusted command source.' };
  const parsed = command(text);
  if (source === 'speech') {
    if (parsed.type === 'reset') return { ok: false, command: null, reason: 'Speech cannot reset the emergency stop.' };
    if (['arm', 'disarm', 'gate'].includes(parsed.type) && voiceAuthority !== true) {
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
  constructor({ allowlist = ['relay-1'] } = {}) {
    if (!Array.isArray(allowlist) || !allowlist.length || !allowlist.every(v => typeof v === 'string' && /^[a-z][a-z0-9-]*$/.test(v))) {
      throw new TypeError('Invalid simulated action allowlist');
    }
    this.#allowed = new Set(allowlist);
    this.armed = false;
    this.stopped = false;
    this.activations = 0;
  }
  #record(actor, event, result, detail = '') {
    this.#audit.push(Object.freeze({ id: ++this.#seq, at: new Date().toISOString(), actor, event, result, detail }));
  }
  getAudit() { return this.#audit.map(entry => ({ ...entry })); }
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
