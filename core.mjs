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
/** Two-step demonstration action gate: no physical output is ever connected by this class. */
export class ActionGate {
  constructor() {this.armed=false; this.stopped=false; this.activations=0;}
  arm(){if(this.stopped)return {ok:false,message:'Emergency stop latched. Reset first.'};this.armed=true;return {ok:true,message:'SIM gate armed. Confirmation required.'};}
  activate(confirmed=false){if(this.stopped) return {ok:false,message:'Blocked: emergency stop.'};if(!this.armed)return {ok:false,message:'Blocked: gate is disarmed.'};if(!confirmed)return {ok:false,message:'Blocked: explicit confirmation required.'};this.armed=false;this.activations++;return {ok:true,message:'SIM relay pulse issued. Gate disarmed.'};}
  disarm(){this.armed=false;return {ok:true,message:'Gate disarmed.'};}
  stop(){this.stopped=true;this.armed=false;return {ok:true,message:'EMERGENCY STOP latched. All actions blocked.'};}
  reset(){this.stopped=false;this.armed=false;return {ok:true,message:'Safety reset. Gate remains disarmed.'};}
}
export function formatMeters(n){return n < 1 ? `${(n*100).toFixed(1)} cm` : `${n.toFixed(2)} m`;}
