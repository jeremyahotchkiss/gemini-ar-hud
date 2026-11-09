/** Dependency-free WebXR/WebGL immersive field. VR & AR sessions feature-detected. */
const VS=`attribute vec3 aPosition;attribute vec4 aColor;uniform mat4 uViewProjection;varying vec4 vColor;void main(){vColor=aColor;gl_Position=uViewProjection*vec4(aPosition,1.0);}`;
const FS=`precision mediump float;varying vec4 vColor;void main(){gl_FragColor=vColor;}`;
const TVS=`attribute vec3 aPosition;attribute vec2 aUV;uniform mat4 uViewProjection;varying vec2 vUV;void main(){vUV=aUV;gl_Position=uViewProjection*vec4(aPosition,1.0);}`;
const TFS=`precision mediump float;varying vec2 vUV;uniform sampler2D uSampler;void main(){gl_FragColor=texture2D(uSampler,vUV);}`;
function makeProgram(gl,vs,fs){function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('XR shader: '+gl.getShaderInfoLog(s));return s;}const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('XR program: '+gl.getProgramInfoLog(p));return p;}
function mul(a,b){const out=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)out[col*4+row]=a[row]*b[col*4]+a[4+row]*b[col*4+1]+a[8+row]*b[col*4+2]+a[12+row]*b[col*4+3];return out;}
const normalize=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
function quatRotate(q,v){const u=[q.x,q.y,q.z],s=q.w;const dot=u[0]*v[0]+u[1]*v[1]+u[2]*v[2];const dotUU=u[0]**2+u[1]**2+u[2]**2;const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return v.map((c,i)=>2*dot*u[i]+(s*s-dotUU)*c+2*s*cross[i]);}
export class XRField {
 constructor({anchors,getSettings,onSelect,onEvent}){Object.assign(this,{anchors,getSettings,onSelect,onEvent});this.session=null;this.base=null;this.selected=anchors[0]?.id||'';}
 async enter(){
  if(this.session)throw Error('XR already active');
  if(!navigator.xr?.isSessionSupported)throw Error('This browser has no WebXR API.');
  let mode=null;
  for(const m of ['immersive-ar','immersive-vr']){try{if(await navigator.xr.isSessionSupported(m)){mode=m;break;}}catch{}}
  if(!mode)throw Error('Neither immersive AR nor VR is supported on this browser.');
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:200;pointer-events:none';document.body.append(canvas);
  try{
   const gl=canvas.getContext('webgl',{alpha:true,antialias:true,xrCompatible:true});if(!gl)throw Error('WebGL unavailable');
   if(gl.makeXRCompatible)await gl.makeXRCompatible();
   const s=await navigator.xr.requestSession(mode,{optionalFeatures:['local-floor','hand-tracking','hit-test']});
   this.canvas=canvas;this.gl=gl;this.session=s;this.mode=mode;
   s.addEventListener('end',()=>this.cleanup());
   s.updateRenderState({baseLayer:new XRWebGLLayer(s,gl,{alpha:mode==='immersive-ar'})});
   try{this.refSpace=await s.requestReferenceSpace('local-floor');}catch{this.refSpace=await s.requestReferenceSpace('local');}
   this.buildGL();s.addEventListener('select',e=>this.selectByRay(e));s.requestAnimationFrame((time,frame)=>this.frame(time,frame));return mode;
  }catch(e){this.cleanup();throw e;}
 }
 buildGL(){const gl=this.gl;this.p=makeProgram(gl,VS,FS);this.tp=makeProgram(gl,TVS,TFS);this.lineBuf=gl.createBuffer();this.texBuf=gl.createBuffer();this.uvBuf=gl.createBuffer();
  this.infoCanvas=document.createElement('canvas');this.infoCanvas.width=1024;this.infoCanvas.height=320;this.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.infoCanvas);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 }
 generateLines(time){
  const s=this.getSettings(), base=this.base||[0,0,0], cx=base[0],cy=base[1],cz=base[2]-1.85;
  const v=[],put=(p,c)=>v.push(...p,...c),line=(a,b,c)=>{put(a,c);put(b,c);};const aqua=[.33,.95,.96,.72*s.opacity/100],dim=[.2,.64,.7,.26],gold=[1,.73,.35,.95],violet=[.61,.55,.98,.42];
  if(s.grid){for(let n=-5;n<=5;n++){const p=n*.22;line([cx-1.1,cy-.8,cz+p],[cx+1.1,cy-.8,cz+p],dim);line([cx+p,cy-.8,cz-1.1],[cx+p,cy-.8,cz+1.1],dim);}}
  const radius=.37*(.7+s.scale/100);
  for(let ring=0;ring<4;ring++)for(let i=0;i<64;i++){const a=i*Math.PI*2/64+time*.00017*(ring%2?1:-1),b=(i+1)*Math.PI*2/64+time*.00017*(ring%2?1:-1);const rad=radius*(1+ring*.18);const theta=ring*Math.PI/5;
   const point=ang=>[cx+Math.cos(ang)*rad,cy+Math.sin(ang)*rad*Math.cos(theta)*.52,cz+Math.sin(ang)*rad*Math.sin(theta)];line(point(a),point(b),ring%2?violet:aqua);
  }
  const locations=[];
  this.anchors.forEach((a,i)=>{const p=[cx+a.position[0]*.24,cy+a.position[1]*.25,cz+a.position[2]*.23+.46];locations.push({id:a.id,p});const rr=a.id===this.selected?.12:.07;const cc=a.id===this.selected?gold:aqua;
   for(let k=0;k<4;k++){let theta=k*Math.PI/2;let next=(k+1)*Math.PI/2;line([p[0]+rr*Math.cos(theta),p[1]+rr*Math.sin(theta),p[2]],[p[0]+rr*Math.cos(next),p[1]+rr*Math.sin(next),p[2]],cc);}
   line([p[0],p[1]-.10,p[2]],[p[0],p[1]+.10,p[2]],cc);line([p[0]-.10,p[1],p[2]],[p[0]+.10,p[1],p[2]],cc);
   if(s.labels)line(p,[p[0]+.14,p[1]+.17,p[2]],cc);
  });this.locations=locations;
  if(s.particles){for(let j=0;j<28;j++){const q=Math.sin(j*234.9)*14213.5%1;let t=j*2.4+time*.00008;const r=.6+j%5*.19;const p=[cx+Math.cos(t)*r,cy+Math.sin(j)*.5,cz+Math.sin(t)*r];line(p,[p[0]+.008,p[1]+.008,p[2]],dim);}}
  return new Float32Array(v);
 }
 drawPanelText(time){const gl=this.gl,c=this.infoCanvas,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='rgba(4,27,42,0.76)';ctx.fillRect(5,4,1014,308);ctx.strokeStyle='#4bdbdd';ctx.lineWidth=3;ctx.strokeRect(5,4,1014,308);ctx.fillStyle='#91f8f1';ctx.font='bold 49px monospace';ctx.fillText('AETHER / LIVE SPATIAL FIELD',38,75);ctx.font='30px monospace';ctx.fillStyle='#d6eaf4';ctx.fillText('SELECTED  '+this.selected+'   •   '+this.anchors.length+' SIM TARGETS',38,139);ctx.fillStyle='#efbf79';ctx.fillText('NO ROOM SCAN  |  DEMO ANCHORS',38,204);ctx.font='24px monospace';ctx.fillStyle='#72c5cf';ctx.fillText('Controller trigger / hand pinch: select target    •    Quest menu: exit',38,271);
 gl.bindTexture(gl.TEXTURE_2D,this.tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
 }
 drawLines(mvp,data){const gl=this.gl;gl.useProgram(this.p);const loc=gl.getAttribLocation(this.p,'aPosition'),color=gl.getAttribLocation(this.p,'aColor');gl.bindBuffer(gl.ARRAY_BUFFER,this.lineBuf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(color);gl.vertexAttribPointer(color,4,gl.FLOAT,false,28,12);gl.uniformMatrix4fv(gl.getUniformLocation(this.p,'uViewProjection'),false,mvp);gl.drawArrays(gl.LINES,0,data.length/7);}
 drawPanel(mvp){const gl=this.gl,base=this.base||[0,0,0],cx=base[0],cy=base[1]+.63,cz=base[2]-1.9,w=.95,h=.29;
 const quad=new Float32Array([cx-w,cy+h,cz,cx-w,cy-h,cz,cx+w,cy+h,cz,cx+w,cy+h,cz,cx-w,cy-h,cz,cx+w,cy-h,cz]);const uv=new Float32Array([0,1,0,0,1,1,1,1,0,0,1,0]);gl.useProgram(this.tp);gl.uniformMatrix4fv(gl.getUniformLocation(this.tp,'uViewProjection'),false,mvp);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.tex);gl.uniform1i(gl.getUniformLocation(this.tp,'uSampler'),0);gl.bindBuffer(gl.ARRAY_BUFFER,this.texBuf);gl.bufferData(gl.ARRAY_BUFFER,quad,gl.DYNAMIC_DRAW);const a=gl.getAttribLocation(this.tp,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,this.uvBuf);gl.bufferData(gl.ARRAY_BUFFER,uv,gl.STATIC_DRAW);const b=gl.getAttribLocation(this.tp,'aUV');gl.enableVertexAttribArray(b);gl.vertexAttribPointer(b,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,6);}
 frame(time,frame){const s=this.session,gl=this.gl;if(!s||!gl)return;s.requestAnimationFrame((t,f)=>this.frame(t,f));const pose=frame.getViewerPose(this.refSpace);if(!pose)return;
  if(!this.base){const p=pose.transform.position;this.base=[p.x,p.y,p.z];this.onEvent('Scene world-locked to initial headset pose. No real-room anchors.');}
  if(!this.lastInfo||time-this.lastInfo>650){this.drawPanelText(time);this.lastInfo=time;}
  const layer=s.renderState.baseLayer;gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.viewport(0,0,layer.framebufferWidth,layer.framebufferHeight);gl.clearColor(0,0,0,this.mode==='immersive-ar'?0:1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const verts=this.generateLines(time);gl.disable(gl.DEPTH_TEST);
  for(const view of pose.views){const vp=layer.getViewport(view);gl.viewport(vp.x,vp.y,vp.width,vp.height);const mvp=mul(view.projectionMatrix,view.transform.inverse.matrix);this.drawLines(mvp,verts);this.drawPanel(mvp);}
 }
 selectByRay(e){if(!this.refSpace||!this.locations)return;const raySpace=e.inputSource?.targetRaySpace;if(!raySpace)return;const pose=e.frame.getPose(raySpace,this.refSpace);if(!pose)return;const p=pose.transform.position;const dir=normalize(quatRotate(pose.transform.orientation,[0,0,-1]));let best=null,min=.15;for(const a of this.locations){const u=[a.p[0]-p.x,a.p[1]-p.y,a.p[2]-p.z],t=u.reduce((sum,v,i)=>sum+v*dir[i],0);if(t<0)continue;const dist=Math.hypot(...u.map((v,i)=>v-t*dir[i]));if(dist<min){min=dist;best=a;}}if(best){this.selected=best.id;this.onSelect?.(best.id);this.onEvent?.('Controller selected '+best.id);}else{this.onEvent?.('No target in pointer ray');}}
 cleanup(){try{this.canvas?.remove();}catch{};this.session=null;this.canvas=null;this.gl=null;this.base=null;this.lastInfo=0;this.onEvent?.('XR session ended');}
}
