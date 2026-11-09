import { ANCHORS, ActionGate, appendAdvisory, authorizedCommand, calibrate, clamp, convertLength, distance3, exportWorkspace, formatMeters, importWorkspace, sigma, virtualPixelDistance } from './core.mjs';
import { PALETTE, buildHudLayout } from './hud.mjs';
import { XRField } from './xr.mjs';

const $ = id => document.getElementById(id);
const storeKey = 'aether-hud-settings-v2';
const defaults = Object.freeze({ opacity:82, glow:72, scale:65, range:5, grid:true, particles:true, labels:true, audio:true });
function savedSettings(){try {return {...defaults,...JSON.parse(localStorage.getItem(storeKey)||'{}')};} catch {return {...defaults};}}
const state={ settings:savedSettings(), anchors:ANCHORS.map(anchor=>({...anchor,position:[...anchor.position]})), panel:'radar', tool:'select', selected:'A1', measurements:[], strokes:[], activeStroke:null, events:[], voiceAuthority:false, speaking:false, listening:false, camera:null, ble:null, heading:null, xrMode:'unknown', scanPulse:0, displayUnit:'m', calibration:null, uncertainty:null, pendingAction:'relay-1', advisory:[], showSim:true, tags:[] };
const gate = new ActionGate();
const radar=$('radar-canvas'),overlay=$('overlay-canvas'),scene=$('scene-card');
const context=radar.getContext('2d',{alpha:true}), overlayContext=overlay.getContext('2d');
let dpr=1,lastFrame=performance.now(),frameSamples=0,frameStart=performance.now(),lastPaint=0,notificationTimer=0;
const xr=new XRField({ anchors:state.anchors, getSettings:()=>state.settings, getSafety:()=>({armed:gate.armed,stopped:gate.stopped}), onSelect:id=>{state.selected=id;drawAnchorList();logEvent('XR','Selected '+id);}, onEvent:txt=>logEvent('XR',txt)});

function save(){try{localStorage.setItem(storeKey,JSON.stringify(state.settings));}catch{}}
function resize(){const r=radar.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);for(const canvas of [radar,overlay]){canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));}redrawOverlay();}
const coords=(x,y,z,angle, W,H)=>{
 const spin=Math.cos(angle),sin=Math.sin(angle);
 const rx=x*spin-z*sin,rz=x*sin+z*spin;
 const perspective=4.6/(4.6+rz*.25);
 const s=Math.min(W,H)*(.125+state.settings.scale/1000)*perspective;
 return [W*.50+rx*s,H*.50-y*s+rz*s*.25,perspective];
};
const rngSeed=(n)=>{let x=Math.sin(n*93.756+19.23)*43758.545;return x-Math.floor(x);};
const particles=Array.from({length:90},(_,i)=>[(rngSeed(i+1)-.5)*6,(rngSeed(i+200)-.5)*3.3,(rngSeed(i+400)-.5)*6]);
function paint(time){
 const W=radar.width/dpr,H=radar.height/dpr;
 context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,W,H);
 if(state.panel==='vision'&&state.camera){requestAnimationFrame(paint);return;}
 const layout=buildHudLayout({anchors:state.anchors,selectedId:state.selected,appearance:{opacity:state.settings.opacity,glow:state.settings.glow,sceneScale:state.settings.scale},calibrationScale:state.calibration?.calibrationScale??null,safety:{armed:gate.armed,stopped:gate.stopped},reducedMotion:prefersReducedMotion()});
 const t=layout.spin===0?0:time*.001, angle=t*.10+.15+state.scanPulse*.15;
 context.globalCompositeOperation='screen';const alpha=state.settings.opacity/100;
 if(state.settings.grid){
   context.lineWidth=1;context.strokeStyle=`rgba(63,169,181,${.095*alpha})`;
   for(let q=-12;q<=12;q++){const x=W/2+q*41;context.beginPath();context.moveTo(x,0);context.lineTo(x,H);context.stroke();}
   for(let q=-9;q<=9;q++){const y=H/2+q*41;context.beginPath();context.moveTo(0,y);context.lineTo(W,y);context.stroke();}
   for(let j=-5;j<=5;j++){
     const a=coords(-4,-1,j*.72,angle,W,H),b=coords(4,-1,j*.72,angle,W,H);
     const c=coords(j*.72,-1,-4,angle,W,H),d=coords(j*.72,-1,4,angle,W,H);
     context.strokeStyle='rgba(70,211,214,.14)';context.beginPath();context.moveTo(...a.slice(0,2));context.lineTo(...b.slice(0,2));context.moveTo(...c.slice(0,2));context.lineTo(...d.slice(0,2));context.stroke();
   }
 }
 const cx=W*.5,cy=H*.5;
 const grad=context.createRadialGradient(cx,cy,8,cx,cy,Math.min(W,H)*.42);grad.addColorStop(0,`rgba(45,236,236,${.15*alpha})`);grad.addColorStop(.6,'rgba(42,146,164,.045)');grad.addColorStop(1,'rgba(0,20,30,0)');context.fillStyle=grad;context.beginPath();context.arc(cx,cy,Math.min(W,H)*.45,0,7);context.fill();
 for(let r=1;r<=4;r++){
   const rad=Math.min(W,H)*(.14+.057*r);
   context.strokeStyle=`rgba(78,208,218,${(.18-r*.025)*alpha})`;context.lineWidth=r===4?1.3:.8;
   context.setLineDash(r%2?[4,7]:[1,9]);context.beginPath();context.ellipse(cx,cy,rad,rad*.43,-.22+Math.sin(t*.1)*.06,0,Math.PI*2);context.stroke();context.setLineDash([]);
 }
 // Sphere composed of distinct 3D great circles and floating scanning arcs.
 const orbitScale=Math.min(W,H)*(.125+state.settings.scale/1000);
 context.save();context.translate(cx,cy);context.rotate(t*.065);
 const bloom=context.createRadialGradient(0,0,2,0,0,orbitScale*.84);bloom.addColorStop(0,'rgba(134,255,250,.3)');bloom.addColorStop(.35,'rgba(36,188,206,.12)');bloom.addColorStop(1,'rgba(0,90,130,0)');context.fillStyle=bloom;context.beginPath();context.arc(0,0,orbitScale*.96,0,7);context.fill();
 for(let k=0;k<11;k++){
   const theta=(k/11)*Math.PI*2+t*.1;
   context.strokeStyle=`rgba(${k%3===0?'161,234,251':'67,217,226'},${(.16+.1*Math.sin(theta+t))*alpha})`;context.lineWidth=.9;
   context.beginPath();context.ellipse(0,0,orbitScale,orbitScale*Math.abs(Math.sin(theta))*.63,theta*.3,0,Math.PI*2);context.stroke();
 }
 context.rotate(-t*.12);context.strokeStyle=`rgba(158,242,255,${.83*alpha})`;context.lineWidth=1.5;context.shadowBlur=state.settings.glow*.35;context.shadowColor='#5ae8fa';
 for(let side=0;side<3;side++){context.beginPath();context.arc(0,0,orbitScale*.87,t*.31+side*Math.PI*2/3,t*.31+side*Math.PI*2/3+Math.PI*.38);context.stroke();}
 context.restore();context.shadowBlur=0;
 // Scanner sweep: a translucent moving plane, not a claim of sensing.
 const sweep=t*.47%(Math.PI*2);context.beginPath();context.moveTo(cx,cy);context.arc(cx,cy,Math.min(W,H)*.36,sweep-.5,sweep);context.closePath();context.fillStyle=`rgba(51,237,225,${.055*alpha})`;context.fill();
 if(state.settings.particles){for(let i=0;i<particles.length;i++){
   const p=particles[i],q=coords(p[0]+Math.sin(t*.3+i)*.025,p[1],p[2],angle,W,H);
   context.fillStyle=`rgba(112,235,238,${(.12+.37*rngSeed(i))*alpha})`;context.beginPath();context.arc(q[0],q[1],.6+rngSeed(i*8)*1.1,0,Math.PI*2);context.fill();
 }}
 state.screenAnchors=[];
 for(const a of state.anchors){const p=coords(...a.position,angle,W,H);state.screenAnchors.push({...a,screen:p});let selected=a.id===state.selected;
   const r=selected?11:7;context.strokeStyle=selected?'#f1c880':'#71dbe4';context.lineWidth=selected?2:1.4;context.shadowBlur=state.settings.glow*.2;context.shadowColor=selected?'#ffc070':'#2aeae7';
   context.beginPath();context.arc(p[0],p[1],r+2+Math.sin(t*2+(Number(a.quality)||0)*20)*1.5,0,7);context.stroke();context.beginPath();context.moveTo(p[0]-r-9,p[1]);context.lineTo(p[0]-r-3,p[1]);context.moveTo(p[0]+r+3,p[1]);context.lineTo(p[0]+r+9,p[1]);context.moveTo(p[0],p[1]-r-9);context.lineTo(p[0],p[1]-r-3);context.moveTo(p[0],p[1]+r+3);context.lineTo(p[0],p[1]+r+9);context.stroke();context.shadowBlur=0;
   if(state.settings.labels&&state.showSim){context.fillStyle=selected?PALETTE.primary:PALETTE.fg;context.font='18px sans-serif';context.fillText(`${a.id}  ${String(a.name||a.id).toUpperCase()}`,p[0]+16,p[1]-14);context.fillStyle=PALETTE.muted;context.fillText(Number.isFinite(a.quality)?`SIM QUALITY ${(a.quality*100).toFixed(0)}%`:'SIM PLACED',p[0]+16,p[1]+8);}
 }
 context.globalCompositeOperation='source-over';
 context.strokeStyle=PALETTE.primary;context.lineWidth=1.6;context.globalAlpha=.9*(state.settings.opacity/100);const inset=16,armLen=26;for(const [x,y,sx,sy] of [[inset,inset,1,1],[W-inset,inset,-1,1],[inset,H-inset,1,-1],[W-inset,H-inset,-1,-1]]){context.beginPath();context.moveTo(x,y+sy*armLen);context.lineTo(x,y);context.lineTo(x+sx*armLen,y);context.stroke();}context.globalAlpha=1;
 frameSamples++;if(time-frameStart>1000){$('fps').textContent=`${Math.round(frameSamples*1000/(time-frameStart))} FPS`;$('scene-frame').textContent=`F${Math.floor(time/16.66)%99999}`;frameStart=time;frameSamples=0;}
 lastPaint=time;requestAnimationFrame(paint);
}
function redrawOverlay(){const W=overlay.width/dpr,H=overlay.height/dpr;overlayContext.setTransform(dpr,0,0,dpr,0,0);overlayContext.clearRect(0,0,W,H);overlayContext.lineCap='round';overlayContext.lineJoin='round';
 [...state.strokes,...(state.activeStroke?[state.activeStroke]:[])].forEach(points=>{
 if(points.length<1)return;overlayContext.strokeStyle='#edbb79';overlayContext.lineWidth=2.5;overlayContext.shadowBlur=10;overlayContext.shadowColor='#efbd82';overlayContext.beginPath();overlayContext.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>overlayContext.lineTo(p.x,p.y));if(points.length===1)overlayContext.lineTo(points[0].x+.1,points[0].y+.1);overlayContext.stroke();overlayContext.shadowBlur=0;
 });
 if(state.measurements.length){for(const p of state.measurements){overlayContext.fillStyle='#fbc67e';overlayContext.strokeStyle='#102331';overlayContext.lineWidth=3;overlayContext.beginPath();overlayContext.arc(p.x,p.y,6,0,7);overlayContext.fill();overlayContext.stroke();}
 if(state.measurements.length===2){const [a,b]=state.measurements;const dist=virtualPixelDistance(a,b,W,state.settings.range);overlayContext.strokeStyle='#ffe5b5';overlayContext.lineWidth=2;overlayContext.setLineDash([7,4]);overlayContext.beginPath();overlayContext.moveTo(a.x,a.y);overlayContext.lineTo(b.x,b.y);overlayContext.stroke();overlayContext.setLineDash([]);overlayContext.fillStyle=PALETTE.fg;overlayContext.font='bold 18px sans-serif';overlayContext.fillText(formatMeters(dist),(a.x+b.x)/2+8,(a.y+b.y)/2-12);}}
}
function scenePoint(e){const r=overlay.getBoundingClientRect();return {x:clamp(e.clientX-r.left,0,r.width),y:clamp(e.clientY-r.top,0,r.height)};}
function setTool(tool){state.tool=tool;scene.classList.toggle('drawing',tool==='draw');scene.classList.toggle('measuring',tool==='measure');document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('scene-stat-label').textContent=tool==='measure'?'VIRTUAL MEASUREMENT':'FIELD DISTANCE';if(tool==='measure')reply('Tap two positions to measure a virtual calibrated plane. This is not real-world LiDAR.');}
function prefersReducedMotion(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}
function findAnchor(id){return state.anchors.find(anchor=>anchor.id.toLowerCase()===String(id||'').toLowerCase())||null;}
function formatLength(meters){if(!state.displayUnit||state.displayUnit==='m')return formatMeters(meters);const converted=convertLength(meters,'m',state.displayUnit);return `${converted.toFixed(state.displayUnit==='mm'?0:2)} ${state.displayUnit}`;}
function selectAnchor(a){if(!a)return;state.selected=a.id;drawAnchorList();const origin=state.anchors[0]||a;$('scene-distance').textContent=formatLength(distance3(origin.position,a.position));$('scene-stat-sub').textContent=`3D RANGE ${origin.id} → ${a.id} (SIM)`;reply(`${a.name}: simulated XYZ (${a.position.join(', ')}) meters. Not a room scan.`);logEvent('FOCUS',a.id+' · '+a.name);}
function drawAnchorList(){const root=$('anchor-list');root.replaceChildren();for(const a of state.anchors){const b=document.createElement('button');b.className='anchor-item'+(state.selected===a.id?' active':'');b.type='button';b.innerHTML=`<span class="anchor-dot">◇</span><span><b></b><small></small></span><span class="quality"></span>`;b.querySelector('b').textContent=a.name;b.querySelector('small').textContent=`${a.id} / ${a.kind}`;b.querySelector('.quality').textContent=Number.isFinite(a.quality)?`${(a.quality*100).toFixed(0)}%`:'SIM';b.addEventListener('click',()=>selectAnchor(a));root.append(b);}}
function logEvent(label,message){const event={time:new Date().toISOString(),type:label,message};state.events.unshift(event);state.events=state.events.slice(0,60);const list=$('event-list');list.replaceChildren();for(const e of state.events.slice(0,4)){const el=document.createElement('div');el.className='event';const tm=document.createElement('time'),text=document.createElement('span');tm.textContent=e.time.slice(11,19);text.textContent=e.message;el.append(tm,text);list.append(el);}}
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(notificationTimer);notificationTimer=setTimeout(()=>t.classList.remove('show'),2700);}
function reply(message){$('agent-reply').textContent=message;if(state.speaking&&'speechSynthesis'in window){const msg=new SpeechSynthesisUtterance(message);msg.rate=1.03;window.speechSynthesis.cancel();window.speechSynthesis.speak(msg);}return message;}
function audioClick(freq=620){if(!state.settings.audio)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ac=audioClick.context||(audioClick.context=new AC());const osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.setValueAtTime(freq,ac.currentTime);osc.frequency.exponentialRampToValueAtTime(freq*.74,ac.currentTime+.085);gain.gain.setValueAtTime(.028,ac.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+.095);osc.connect(gain).connect(ac.destination);osc.start();osc.stop(ac.currentTime+.1);}catch{}}
function applySettings(){const s=state.settings;document.documentElement.style.setProperty('--op',(s.opacity/100).toFixed(2));document.documentElement.style.setProperty('--glow',(s.glow/100).toFixed(2));for(const k of ['opacity','glow','scale','range']){$(k).value=s[k];$(k+'-output').textContent=s[k]+(k==='range'?' m':'%');}for(const k of ['grid','particles','labels','audio'])$('toggle-'+k).checked=s[k];redrawOverlay();}
function setSettings(key,value){if(key in defaults){state.settings[key]=typeof defaults[key]==='boolean'?Boolean(value):clamp(value,key==='range'?1:key==='scale'?20:key==='opacity'?20:0,key==='range'?15:100);applySettings();save();return true;}return false;}
function showPanel(panel){if(panel==='controls'){$('btn-settings').click();return;}state.panel=panel;document.querySelectorAll('[data-panel]').forEach(b=>{const v=b.dataset.panel===panel;b.classList.toggle('selected',v);b.setAttribute('aria-pressed',String(v));});const titles={radar:['01 / SPATIAL RADAR','Environmental command center','A simulated 3D sensor scene. Select beacons, measure virtual distances, or annotate the field.'],vision:['02 / CAMERA & ANNOTATIONS','Vision workspace','Opt-in live camera, manually tagged imagery, and screen drawing. No automatic recognition.'],devices:['03 / DEVICE SYSTEMS','Bluetooth device bridge','User-selected BLE connections where supported. No passive scanning or claimed ranging.'],telemetry:['04 / TELEMETRY','Device diagnostics','Real browser capabilities plus explicitly labeled synthetic anchor telemetry.'],controls:['05 / CONTROLS','Operator settings','Tune the HUD and action interlocks.']};const [k,t,sub]=titles[panel];$('section-kicker').textContent=k;$('section-title').textContent=t;$('section-subtitle').textContent=sub;$('scene-mode-label').textContent=panel==='radar'?'ACTIVE SPATIAL FIELD':panel.toUpperCase()+' / MODULE';$('camera-video').hidden=!(panel==='vision'&&state.camera);
 let contextButton=$('context-action');if(contextButton)contextButton.remove();const b=document.createElement('button');b.id='context-action';b.className='btn btn-primary';b.style.cssText='position:absolute;z-index:7;top:16px;right:16px;font-size:18px;min-height:48px;min-width:48px';let handler=null;
 if(panel==='vision'){b.textContent=state.camera?'STOP CAMERA':'START CAMERA';handler=toggleCamera;}
 else if(panel==='devices'){b.textContent=state.ble?'BLE CONNECTED':'SELECT BLE DEVICE';handler=chooseBluetooth;}
 else if(panel==='telemetry'){b.textContent='ENABLE ORIENTATION';handler=startOrientation;}
 else if(panel==='radar'){b.textContent='SWEEP FIELD';handler=()=>{state.scanPulse+=1;toast('Virtual radar sweep initiated');logEvent('SCAN','Visual sweep; simulated targets only');};}
 if(handler){b.addEventListener('click',handler);scene.append(b);}logEvent('VIEW',panel.toUpperCase()+' module opened');}
async function toggleCamera(){if(state.camera){state.camera.getTracks().forEach(t=>t.stop());state.camera=null;$('camera-video').srcObject=null;showPanel('vision');reply('Camera stopped. No frames were stored.');return;}
 if(!navigator.mediaDevices?.getUserMedia){reply('Camera unavailable: HTTPS and browser permission are required.');return;}
 try{state.camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});$('camera-video').srcObject=state.camera;$('camera-video').hidden=false;showPanel('vision');reply('Live camera enabled. You may manually draw or mark visible regions. Automatic object ID is not connected.');}catch(e){reply(`Camera permission or device failed: ${e.name}`);}
}
async function chooseBluetooth(){if(!navigator.bluetooth?.requestDevice){reply('Web Bluetooth not supported in this browser. Android native adapter is a later module.');return;}
 try{const d=await navigator.bluetooth.requestDevice({acceptAllDevices:true});state.ble=d;reply(`BLE device selected: ${d.name||'unnamed'} (not positioned). No RSSI ranging available here.`);logEvent('BLE','User selected '+(d.name||'unnamed peripheral'));showPanel('devices');}catch(e){reply(e.name==='NotFoundError'?'No BLE device selected.':`BLE selection failed: ${e.name}`);}}
async function startOrientation(){if(!('DeviceOrientationEvent' in window)){reply('Device orientation API unavailable on this device/browser.');return;}
 try{if(typeof DeviceOrientationEvent.requestPermission==='function'){const p=await DeviceOrientationEvent.requestPermission();if(p!=='granted')throw Error('permission rejected');}
 window.addEventListener('deviceorientation',e=>{if(Number.isFinite(e.alpha)){state.heading=e.alpha;$('heading-readout').innerHTML=`${Math.round(e.alpha)}° <span>/ orientation</span>`;}},{passive:true});reply('Orientation listener enabled. Browser axes may differ from magnetic north.');}catch(e){reply('Orientation permission denied or unavailable.');}}
async function requestXR(){audioClick(820);try{const mode=await xr.enter();state.xrMode=mode;reply(`Entered ${mode==='immersive-ar'?'AR passthrough':'VR'} environment. Press the headset system control to exit.`);logEvent('XR',mode+' session started');}catch(e){reply(`XR unavailable: ${e.message}`);toast('Open this HTTPS page in the Quest Browser and check XR support.');}}
function syncSafetyUI(){
 const indicator=$('safety-state');
 indicator.textContent=gate.stopped?'STOP LATCHED':gate.armed?'SIM ARMED':'SIM DISARMED';
 indicator.classList.toggle('latched',gate.stopped);
 const topIndicator=$('top-safety-state');
 topIndicator.textContent=gate.stopped?'STOP':gate.armed?'ARMED':'SAFE';
 topIndicator.classList.toggle('latched',gate.stopped);
 $('btn-confirm-sim').disabled=gate.stopped||!gate.armed;
 $('toggle-voice-authority').checked=state.voiceAuthority;
}
function run(text,source='operator'){
 const authorized=authorizedCommand(text,{source,voiceAuthority:state.voiceAuthority});
 if(!authorized.ok){
   gate.recordDeniedInput(source,authorized.reason);
   const msg='COMMAND DENIED: '+authorized.reason;
   reply(msg);logEvent('DENIED',`${source}: ${msg}`);syncSafetyUI();return msg;
 }
 const c=authorized.command;let msg='';audioClick();switch(c.type){
 case 'help':msg='Try “grid off”, “measure”, “draw”, “scan”, “camera”, “status”, or “emergency stop”.';break;
 case 'toggle':setSettings(c.key,c.value);msg=`${c.key} ${c.value?'enabled':'disabled'}.`;break;
 case 'slider':setSettings(c.key,c.value);msg=`${c.key} set to ${state.settings[c.key]}${c.key==='range'?' meters':' percent'}.`;break;
 case 'measure':if(c.from&&c.to){const left=findAnchor(c.from),right=findAnchor(c.to);if(!left||!right)msg=`No demo anchors for ${c.from} to ${c.to}. distance3 was not guessed.`;else{const meters=distance3(left.position,right.position);$('scene-distance').textContent=formatLength(meters);$('scene-stat-sub').textContent=`distance3 ${left.id} → ${right.id} (SIM COORDINATES)`;msg=`Authoritative distance3 is ${formatMeters(meters)} between simulated anchors. Not a room scan.`;}}else{showPanel('radar');setTool('measure');msg='Measurement active. Tap two points on the simulated scene to compute calibrated canvas distance.';}break;
 case 'draw':setTool('draw');msg='Annotation active. Drag on the scene to draw a line. Local only.';break;
 case 'scan':state.scanPulse+=1;msg=`Sweep complete: ${state.anchors.length} synthetic targets. No real radio scan was performed.`;break;
 case 'panel':showPanel(c.value);msg=c.value+' module opened.';break;
 case 'focus':selectAnchor(findAnchor(c.id));return;
 case 'select':selectAnchor(findAnchor(c.id));msg=findAnchor(c.id)?`Selected ${c.id}. Demo target only.`:`No demo anchor ${c.id}.`;break;
 case 'status':msg=`Local engine operational. ${state.anchors.length} demo anchors. Browser WebXR: ${state.xrMode}. BLE: ${state.ble?'selected':'not connected'}. Action gate: ${gate.stopped?'STOPPED':gate.armed?'ARMED':'safe'}. Hardware connected: false.`;break;
 case 'arm':msg=gate.arm(source,state.voiceAuthority).message;break;
 case 'disarm':msg=gate.disarm(source,state.voiceAuthority).message;break;
 case 'gate':state.pendingAction='relay-1';msg=gate.activate(false,'relay-1',{source,voiceAuthority:state.voiceAuthority}).message+' Use the SIM confirmation button as operator.';break;
 case 'action':state.pendingAction=c.id;msg=gate.activate(false,c.id,{source,voiceAuthority:state.voiceAuthority}).message+` Pending SIM target ${c.id}. Operator confirmation required.`;break;
 case 'stop':
 case 'estop':msg=gate.stop(source).message;toast('SIMULATION EMERGENCY STOP LATCHED');break;
 case 'reset':
 case 'reset-estop':msg=gate.reset(source).message;break;
 case 'clear-log':state.events=[];msg='Visible event stream cleared; safety audit retained.';break;
 case 'units':state.displayUnit=c.unit;msg=`Display unit set to ${c.unit}. distance3 remains meters. This does not change the scene-scale slider.`;break;
 case 'calibrate':try{state.calibration=calibrate(c.knownM,c.measuredM);msg=`Operator estimate calibrationScale ${state.calibration.calibrationScale.toFixed(4)}. Scene scale stays ${state.settings.scale}. Not a survey.`;}catch(err){msg=err.message;}break;
 case 'sigma':try{const scale=state.calibration?.calibrationScale??1;state.uncertainty=sigma(c.pointSigma,scale);msg=`Operator estimate sigma ${state.uncertainty.meters.toFixed(4)} m using calibrationScale ${scale}. Not authoritative.`;}catch(err){msg=err.message;}break;
 case 'place':{const existing=findAnchor(c.id);if(existing){existing.position=[...c.position];msg=`Moved demo anchor ${c.id} in the lab frame. Source meters were not rescaled.`;}else{state.anchors.push({id:c.id,name:c.id,kind:'PLACED SIM',position:[...c.position],quality:null});msg=`Placed demo anchor ${c.id}. Not a tracked room feature.`;}drawAnchorList();break;}
 case 'remove':{const index=state.anchors.findIndex(anchor=>anchor.id.toLowerCase()===c.id.toLowerCase());if(index<0)msg=`No anchor ${c.id}.`;else{state.anchors.splice(index,1);if(state.selected===c.id)state.selected=state.anchors[0]?.id||'';drawAnchorList();msg=`Removed demo anchor ${c.id}. Legacy fixture A1–D4 is unchanged.`;}break;}
 case 'sim':state.showSim=c.value;msg=c.value?'Simulation markers shown.':'Simulation flag off. This does not enable live sensors. The banner stays.';break;
 case 'voice':state.speaking=c.value;$('btn-speech').classList.toggle('enabled',state.speaking);$('btn-speech').setAttribute('aria-pressed',String(state.speaking));msg=c.value?'Spoken replies enabled.':'Spoken replies disabled.';break;
 case 'voice-authority':if(source!=='operator'){msg='Voice authority is changed only by the operator.';break;}state.voiceAuthority=c.value===true;gate.disarm('operator');msg=state.voiceAuthority?'Voice authority on for this session. Gate disarmed.':'Voice authority off. Gate disarmed.';break;
 case 'tag':state.tags.push({label:c.label,source:'operator'});msg=`Operator tag “${c.label}” stored. Not an object detection.`;break;
 case 'ask':appendAdvisory(state.advisory,c.text);msg='Ask text stored as advisory. No model is connected and it was not parsed as a command.';break;
 case 'note':msg=`Note stored: ${c.text}`;break;
 case 'unknown':msg=`No executable local command recognized: “${text}”. This is a rule-based parser, not a remote AI model.`;break;
 }reply(msg);logEvent('CMD',`${source}: ${msg}`);syncSafetyUI();return msg;}
function downloadJson(filename,payload){const href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=href;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
function exportData(){downloadJson('aether-hud-session.json',{version:'aether-hud-v2',createdAt:new Date().toISOString(),simulated:true,settings:state.settings,events:state.events,safetyAudit:gate.getAudit(),advisory:state.advisory,estopLatched:gate.stopped,anchors:state.anchors,annotations:state.strokes,measurements:state.measurements,hardwareConnected:false});toast('Session JSON exported');}
function exportWorkspaceFile(){const payload=exportWorkspace({sceneScale:state.settings.scale,calibrationScale:state.calibration?.calibrationScale,estopLatched:gate.stopped,anchors:state.anchors.map(anchor=>({id:anchor.id,position:[...anchor.position]})),units:state.displayUnit});downloadJson('aether-workspace.json',payload);toast('Workspace JSON exported');}
function importWorkspaceFile(file){const reader=new FileReader();reader.onload=()=>{try{const visual={...state.settings};const result=importWorkspace(JSON.parse(String(reader.result)),{visualSettings:state.settings,gate});state.settings.opacity=visual.opacity;state.settings.glow=visual.glow;state.settings.scale=visual.scale;state.settings.range=visual.range;state.settings.grid=visual.grid;state.settings.particles=visual.particles;state.settings.labels=visual.labels;state.settings.audio=visual.audio;if(Array.isArray(result.workspace.anchors)){state.anchors.splice(0,state.anchors.length,...result.workspace.anchors.map(anchor=>({id:anchor.id,name:anchor.id,kind:'WORKSPACE SIM',position:[...anchor.position],quality:null})));state.selected=state.anchors[0]?.id||'';drawAnchorList();}applySettings();syncSafetyUI();reply(`Workspace v1 imported. Visual settings were kept. Armed is ${gate.armed}. E-stop latched: ${gate.stopped}. Hardware connected: false.`);logEvent('WORKSPACE','Imported aether-workspace.json without replacing visual settings');}catch(err){reply(`Workspace rejected: ${err.message}`);}};reader.readAsText(file);}
function configure(){const open=$('settings-drawer').classList.contains('open');$('settings-drawer').classList.toggle('open',!open);$('settings-drawer').setAttribute('aria-hidden',String(open));$('drawer-backdrop').hidden=open;}
// Event wiring.
document.querySelectorAll('.rail-item').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.panel)));
$('btn-settings').addEventListener('click',configure);$('btn-close-settings').addEventListener('click',configure);$('drawer-backdrop').addEventListener('click',configure);
$('command-form').addEventListener('submit',e=>{e.preventDefault();const el=$('command-input');run(el.value,'operator');el.value='';});
$('btn-xr').addEventListener('click',requestXR);$('btn-export').addEventListener('click',exportData);
$('btn-clear').addEventListener('click',()=>{state.strokes=[];state.measurements=[];redrawOverlay();$('scene-distance').textContent='--.-- m';toast('Annotations cleared');logEvent('DRAW','Overlay cleared');});
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
for(const k of ['opacity','glow','scale','range'])$(k).addEventListener('input',e=>setSettings(k,+e.target.value));
for(const k of ['grid','particles','labels','audio'])$('toggle-'+k).addEventListener('change',e=>setSettings(k,e.target.checked));
$('btn-reset-settings').addEventListener('click',()=>{state.settings={...defaults};applySettings();save();toast('Defaults restored');});
$('btn-stop').addEventListener('click',()=>run('emergency stop','operator'));
$('btn-estop-quick').addEventListener('click',()=>run('emergency stop','operator'));
$('btn-reset-safety').addEventListener('click',()=>run('reset safety','operator'));
$('btn-confirm-sim').addEventListener('click',()=>{
 const result=gate.activate(true,state.pendingAction||'relay-1',{source:'operator'});
 reply(result.message);logEvent(result.ok?'SIM ACTION':'DENIED',result.message);syncSafetyUI();
});
$('btn-export-workspace').addEventListener('click',exportWorkspaceFile);
$('workspace-file').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importWorkspaceFile(file);event.target.value='';});
$('toggle-voice-authority').addEventListener('change',e=>{
 state.voiceAuthority=e.target.checked===true;
 gate.disarm('operator'); // Changing authority invalidates an existing arm.
 syncSafetyUI();logEvent('SAFETY',state.voiceAuthority?'Voice critical commands enabled for THIS session (SIM only)':'Voice authority disabled');
});
$('btn-speech').addEventListener('click',()=>{state.speaking=!state.speaking;$('btn-speech').classList.toggle('enabled',state.speaking);$('btn-speech').setAttribute('aria-pressed',String(state.speaking));reply(state.speaking?'Spoken replies enabled.':'Spoken replies disabled.');});
$('btn-mic').addEventListener('click',()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){reply('Speech recognition is unavailable. Use the command field. Some browser speech engines process audio remotely.');return;}if(state.listening)return;const recog=new SR();recog.lang='en-US';recog.interimResults=false;recog.continuous=false;recog.onresult=e=>{const phrase=e.results[0][0].transcript;run(phrase,'speech');};recog.onerror=e=>reply(`Voice input error: ${e.error}`);recog.onend=()=>{state.listening=false;$('btn-mic').classList.remove('listening')};state.listening=true;$('btn-mic').classList.add('listening');recog.start();});
scene.addEventListener('pointerdown',e=>{if(state.tool!=='select'||e.target.closest('button'))return;const p=scenePoint(e);const closest=state.screenAnchors?.map(a=>({a,d:Math.hypot(a.screen[0]-p.x,a.screen[1]-p.y)})).sort((a,b)=>a.d-b.d)[0];if(closest&&closest.d<65)selectAnchor(closest.a);});
overlay.addEventListener('pointerdown',e=>{const p=scenePoint(e);if(state.tool==='measure'){if(state.measurements.length===2)state.measurements=[];state.measurements.push(p);if(state.measurements.length===2){const dist=virtualPixelDistance(...state.measurements,overlay.width/dpr,state.settings.range);$('scene-distance').textContent=formatMeters(dist);$('scene-stat-sub').textContent=`VIRTUAL ${state.settings.range} m WIDTH CALIBRATION`;reply(`Simulated plane measurement: ${formatMeters(dist)} at ${state.settings.range} meters across viewport. Not a surveyed physical distance.`);logEvent('MEASURE',formatMeters(dist)+' virtual');}redrawOverlay();}
 else if(state.tool==='draw'){state.activeStroke=[p];overlay.setPointerCapture(e.pointerId);redrawOverlay();}});
overlay.addEventListener('pointermove',e=>{if(state.tool==='draw'&&state.activeStroke){state.activeStroke.push(scenePoint(e));redrawOverlay();}});
function completeStroke(){if(state.activeStroke){state.strokes.push(state.activeStroke);state.activeStroke=null;redrawOverlay();logEvent('DRAW','Stroke recorded locally');}}
overlay.addEventListener('pointerup',completeStroke);overlay.addEventListener('pointercancel',completeStroke);
window.addEventListener('resize',resize,{passive:true});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('settings-drawer').classList.contains('open'))configure();if(e.key==='/'&&document.activeElement?.tagName!=='INPUT'){e.preventDefault();$('command-input').focus();}});
async function detectCapabilities(){if(!navigator.xr?.isSessionSupported){$('xr-support').textContent='UNAVAILABLE';state.xrMode='unavailable';return;}const [ar,vr]=await Promise.allSettled([navigator.xr.isSessionSupported('immersive-ar'),navigator.xr.isSessionSupported('immersive-vr')]);const canAR=ar.status==='fulfilled'&&ar.value;const canVR=vr.status==='fulfilled'&&vr.value;state.xrMode=canAR?'AR READY':canVR?'VR READY':'UNSUPPORTED';$('xr-support').textContent=state.xrMode;}
function init(){syncSafetyUI();applySettings();resize();showPanel('radar');drawAnchorList();selectAnchor(ANCHORS[0]);$('scene-distance').textContent='0.00 m';$('scene-stat-sub').textContent='SIM REFERENCE: A1';$('clock').textContent=new Date().toLocaleTimeString();setInterval(()=>$('clock').textContent=new Date().toLocaleTimeString(),1000);detectCapabilities();if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});requestAnimationFrame(paint);logEvent('BOOT','Aether HUD v2 · no cloud services connected');}
// Public read-only diagnostic API for smoke testing; no secrets or hardware actions.
window.aetherDiagnostics=()=>({panel:state.panel,tool:state.tool,settings:{...state.settings},events:state.events.length,camera:!!state.camera,ble:!!state.ble,xr:state.xrMode,armed:gate.armed,stopped:gate.stopped,voiceAuthority:state.voiceAuthority,safetyAuditCount:gate.getAudit().length});
init();
