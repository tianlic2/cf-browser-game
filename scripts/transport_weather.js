import * as THREE from 'three';
import { freightGust } from './transport_wind.js';

// A column follows the wind all the way to its first exposed surface. Intersect
// the imported convex hulls once at load time, including sloping roofs.
const seaY = -3.42;
const ceiling = 21;
const windX = -.085;
const windZ = .035;

function rainStop(brushes, x, z, dx, dz) {
  let highest = seaY;
  const travel = ceiling - seaY;
  for (const b of brushes) {
    if (b.h <= highest || Math.abs(x - b.x) > b.hx + Math.abs(dx)*travel ||
        Math.abs(z - b.z) > b.hz + Math.abs(dz)*travel) continue;
    let enter = 0, leave = travel;
    for (const [nx,ny,nz,d] of b.planes) {
      const slope = nx*dx + ny + nz*dz;
      const room = d - nx*x - ny*seaY - nz*z;
      if (slope > .00001) leave = Math.min(leave, room/slope);
      else if (slope < -.00001) enter = Math.max(enter, room/slope);
      else if (room < 0) { leave = -1; break; }
      if (leave < enter) break;
    }
    if (leave >= enter) highest = Math.max(highest, seaY + leave);
  }
  return highest;
}

// Read the same roof and dry-margin atlas as the wetness shader once on load.
function rainReceivers(image) {
  const canvas=document.createElement('canvas');
  canvas.width=image.width; canvas.height=image.height;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,image.width,image.height).data;
  return (x,y,z)=>{
    const col=Math.floor((x+18)/36*image.width);
    const row=Math.floor((z+49)/98*image.height);
    if (col<0 || row<0 || col>=image.width || row>=image.height) return 0;
    const i=4*(row*image.width+col);
    const roof=pixels[i]/255*40-4;
    if (Math.abs(roof-y)>.18) return -1;
    if (y<.16 && pixels[i+1]/255*1.5<.42) return -1;
    return pixels[i+2]===255 ? 2 : pixels[i+2]===128 ? 1 : 0;
  };
}

export function createTransportRain(brushes, cover) {
  const surfaceAt=rainReceivers(cover.image);
  const physical=brushes.filter(b=>!b.textures.every(t=>t.startsWith('tools/')));
  const cells=new Map();
  const cellKey=(x,z)=>(x+32)*128+z+64;
  const spread=[];
  const positions = [], drops = [], impacts = [], impactTiming = [];
  let seed = 81223;
  function random() {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return seed/4294967296;
  }
  for (let i=0; i<9500; i++) {
    const x = (random()-.5)*48, z = (random()-.5)*106;
    const floor = rainStop(physical,x,z,windX,windZ) + .016;
    if (floor >= ceiling-.5) continue;
    const phase = random(), speed = 9 + random()*4, length = .16 + random()*.22;
    for (const end of [0,1]) {
      positions.push(x,floor,z);
      drops.push(phase,speed,length,end);
    }
    if (floor<=seaY+.03) continue;
    const px=x+windX*(floor-seaY), pz=z+windZ*(floor-seaY);
    const kind=surfaceAt(px,floor-.016,pz);
    if (kind<0 || (kind===0 && i%3!==0) || (kind===1 && i%2!==0)) continue;
    const count=kind===1 ? 3 : 1;
    for (let j=0;j<count;j++) {
      impacts.push(px,floor+.012,pz);
      impactTiming.push(phase,speed,length);
      spread.push(kind,j,phase*6.283+j*2.094);
    }
    // Only the larger drops get individual voices over the field recording.
    if (kind>0 && length>(kind===1?.334:.284)) {
      const key=cellKey(Math.floor(px/4),Math.floor(pz/4));
      if (!cells.has(key)) cells.set(key,[]);
      cells.get(key).push({kind,x:px,y:floor,z:pz,period:(ceiling-floor)/speed,phase,size:length});
    }
  }
  const root = new THREE.Group();
  root.name = 'transport-rain';
  const time = {value:0};
  const gust = {value:0};
  const gear = {transparent:true, depthWrite:false, toneMapped:false};
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  lines.setAttribute('drop',new THREE.Float32BufferAttribute(drops,4));
  const drift = 'vec2('+windX+','+windZ+')';
  const rain = new THREE.LineSegments(lines,new THREE.ShaderMaterial({
    ...gear, uniforms:{clock:time,gust,roof:{value:cover}}, vertexShader:`
      attribute vec4 drop;
      uniform float gust;
      uniform sampler2D roof;
      uniform float clock;
      varying float alpha;
      void main() {
        float span = ${ceiling.toFixed(1)}-position.y;
        float height = mod(drop.x*span-clock*drop.y,span);
        float y = position.y+min(span,height+drop.z*drop.w);
        vec2 xz = position.xz+${drift}*(y+3.42);
        // Bend the flight path around its real receiver. The head still
        // reaches the splash and its positional sound at the same instant.
        xz += gust*vec2(.34,-.08)*(y-position.y);
        vec2 roofUv=(xz+vec2(18.,49.))/vec2(36.,98.);
        float top=texture2D(roof,clamp(roofUv,0.,1.)).r*40.-4.;
        bool inHull=all(greaterThanEqual(roofUv,vec2(0.))) && all(lessThanEqual(roofUv,vec2(1.)));
        float visible=inHull ? smoothstep(-.06,.16,y-top) : 1.;
        vec4 eye = modelViewMatrix*vec4(xz.x,y,xz.y,1.);
        alpha = (.17+.25*drop.x)*(1.-.82*drop.w)*smoothstep(.3,1.6,-eye.z)
          *(1.-smoothstep(19.,56.,-eye.z))*smoothstep(0.,.24,height)*mix(1.,visible,smoothstep(0.,.08,gust));
        gl_Position = projectionMatrix*eye;
      }`, fragmentShader:`varying float alpha;
      void main(){gl_FragColor=vec4(.76,.84,.89,alpha);}`,
  }));
  const splashes = new THREE.BufferGeometry();
  splashes.setAttribute('position',new THREE.Float32BufferAttribute(impacts,3));
  splashes.setAttribute('timing',new THREE.Float32BufferAttribute(impactTiming,3));
  splashes.setAttribute('spread',new THREE.Float32BufferAttribute(spread,3));
  const spray = new THREE.Points(splashes,new THREE.ShaderMaterial({
    ...gear, uniforms:{clock:time}, vertexShader:`
      attribute vec3 timing,spread;
      uniform float clock;
      varying float alpha, fabric;
      void main(){
        float span=${ceiling.toFixed(1)}-position.y+.012;
        float age=mod(clock-timing.x*span/timing.y,span/timing.y);
        fabric=step(1.5,spread.x);
        float steel=step(.5,spread.x)*(1.-fabric);
        float duration=mix(.13,.15+timing.x*.055,steel)*(1.-.47*fabric);
        float u=clamp(age/duration,0.,1.);
        // Hard plate splits the crown into three unequal ballistic beads.
        // Canvas takes up the impact in one low, soft spread.
        vec2 side=vec2(cos(spread.z),sin(spread.z));
        float radius=steel*(.045+.045*timing.x+.016*spread.y)*u;
        float lift=4.*u*(1.-u)*mix(.022,.042+.034*timing.x+.012*spread.y,steel)*(1.-.82*fabric);
        vec3 world=position+vec3(side.x*radius,lift,side.y*radius);
        vec4 eye=modelViewMatrix*vec4(world,1.);
        alpha=(1.-smoothstep(.11,1.,u))*(1.-smoothstep(8.,24.,-eye.z))
          *mix(.64,.44,fabric);
        gl_Position=projectionMatrix*eye;
        gl_PointSize=clamp((steel>.5 ? 12.+4.*timing.x : 15.+18.*u)/max(.5,-eye.z),1.6,8.);
      }`, fragmentShader:`varying float alpha,fabric;
      void main(){vec2 p=gl_PointCoord-.5;
        float r=length(p*vec2(1.,1.+fabric));
        gl_FragColor=vec4(mix(vec3(.86,.91,.94),vec3(.69,.74,.74),fabric),alpha*(1.-smoothstep(.16,.5,r)));}`,
  }));
  // Shader moves vertices beyond their static bounds. Both batches span the map.
  for (const batch of [rain,spray]) {batch.frustumCulled=false; batch.raycast=()=>{}; root.add(batch);}
  let lastX=Infinity, lastZ=Infinity, roof=seaY;
  let previousTime=null, nextSteel=0, nextCanvas=0;
  function soundHits(eye,emit) {
    const now=time.value, last=previousTime;
    previousTime=now;
    // Returning to play / resuming skips inaudible hits during the gap.
    if (!emit || last===null || now<=last || now-last>.16) return;
    let steel,canvas,steelScore=0,canvasScore=0;
    for (let x=Math.floor((eye.x-10)/4);x<=Math.floor((eye.x+10)/4);x++)
      for (let z=Math.floor((eye.z-10)/4);z<=Math.floor((eye.z+10)/4);z++) {
        const drops=cells.get(cellKey(x,z));
        if (!drops) continue;
        for (const d of drops) {
          if (Math.floor(now/d.period-d.phase)===Math.floor(last/d.period-d.phase)) continue;
          const distance=(d.x-eye.x)**2+(d.y-eye.y)**2+(d.z-eye.z)**2;
          if (distance>100) continue;
          const score=d.size/(3+distance);
          if (d.kind===1 && score>steelScore) {steel=d;steelScore=score;}
          if (d.kind===2 && score>canvasScore) {canvas=d;canvasScore=score;}
        }
      }
    if (steel && now>=nextSteel) {emit(steel);nextSteel=now+.14+steel.phase*.14;}
    if (canvas && now>=nextCanvas) {emit(canvas);nextCanvas=now+.13+canvas.phase*.10;}
  }
  return {root, soundHits, receiverAt:surfaceAt, update(t){time.value=t; gust.value=freightGust(t);}, sheltered(p) {
    if (Math.abs(p.x-lastX)+Math.abs(p.z-lastZ)>.14) {
      roof=rainStop(physical,p.x,p.z,0,0); lastX=p.x; lastZ=p.z;
    }
    return roof>p.y+.12;
  }};
}

// Centre and half-width of the four clear openings at ear height in the BSP.
const freightDoorways = [
  {z:36.33, openings:[[6.87,1.65],[-4.91,1.27]]},
  {z:-37.64, openings:[[5.16,1.26],[-6.66,1.65]]},
];

// The weather shares the game's master/mute and flashbang filter. Audio-clock
// envelopes keep the patter and the thunder roll smooth between rendered frames.
export function createTransportStormAudio() {
  let graph=null, rainBuffer=null, rollBuffer=null;
  let audibleHits=false, cabin=null;
  const doorWeights=[0,0];
  function recording(file,store) {
    const url=new URL('../audio/weather/'+file,import.meta.url);
    let loaded=false,loading=false,retryAfter=0;
    return ctx=>{
      if (loaded || loading || ctx.currentTime<retryAfter) return;
      loading=true;
      fetch(url).then(response=>{
        if (!response.ok) throw Error(file+': '+response.status);
        return response.arrayBuffer();
      }).then(bytes=>ctx.decodeAudioData(bytes)).then(buffer=>{store(buffer);loaded=true;})
        .catch(error=>{retryAfter=ctx.currentTime+20;console.warn('运输船雨声加载失败',error);})
        .finally(()=>{loading=false;});
    };
  }
  const loadRain=recording('ship-rain.mp3',buffer=>{rainBuffer=buffer;});
  let taps=null;
  const loadTaps=recording('rain-impacts.wav',buffer=>{taps=buffer;});
  const lastVariant=[-1,-1];
  function impact(sfx,hit) {
    if (!graph || !taps || !audibleHits) return;
    if (cabin) {
      // Only exposed hits with a clear line through either opening enter the cabin.
      const dz=hit.z-graph.eyeZ;
      const t=dz ? (cabin.z-graph.eyeZ)/dz : -1;
      if (t<0 || t>1) return;
      const crossing=graph.eyeX+t*(hit.x-graph.eyeX);
      if (!cabin.openings.some(([x,w])=>Math.abs(crossing-x)<w)) return;
    }
    const steel=hit.kind===1, family=steel?0:1;
    const variant=(lastVariant[family]+1+Math.floor(Math.random()*5))%6;
    lastVariant[family]=variant;
    const ctx=graph.ctx, source=ctx.createBufferSource(), level=ctx.createGain();
    const pan=sfx.panner(hit.x,hit.y,hit.z);
    pan.refDistance=2.8;pan.rolloffFactor=.83;
    source.buffer=taps;source.playbackRate.value=.96+.08*Math.random();
    level.gain.value=(steel?.95:1.16)*(.70+.28*hit.phase);
    source.connect(level).connect(pan).connect(graph.tapBus);
    source.onended=()=>{source.disconnect();level.disconnect();pan.disconnect();};
    // Six independent recorded transients per surface, each padded to 160 ms.
    source.start(0,(family*6+variant)*.16,.155);
  }
  let nextFlash=0, flashAt=-100, power=0;
  const thunderVoices=new Set();
  function stop() {
    if (!graph) return;
    const {ctx,source,bus}=graph, now=ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setTargetAtTime(0,now,.018);
    if (source) {
      source.onended=()=>bus.disconnect();
      source.stop(now+.1);
    } else bus.disconnect();
    for (const voice of thunderVoices) voice.stop(now+.1);
    thunderVoices.clear();
    graph=null;
    cabin=null;audibleHits=false;
  }
  function start(sfx) {
    const ctx=sfx.ctx;
    if (!rollBuffer) rollBuffer=sfx.noiseBuffer(5);
    const bus=ctx.createGain(), filter=ctx.createBiquadFilter();
    bus.gain.value=0;
    bus.gain.setTargetAtTime(1,ctx.currentTime,.15);
    filter.type='lowpass'; filter.Q.value=.45;
    const level=ctx.createGain();
    level.gain.value=0;
    filter.connect(level).connect(bus).connect(sfx.master);
    const tapBus=ctx.createGain();
    const tapFilter=ctx.createBiquadFilter();
    tapFilter.type='lowpass';tapFilter.Q.value=.55;
    tapBus.connect(tapFilter).connect(bus);
    // Use the same loop and clock for all paths. The broad stereo bed remains
    // audible under cover; direct upper frequencies arrive at the doorways.
    const doorFilter=ctx.createBiquadFilter();
    doorFilter.type='highpass';doorFilter.frequency.value=650;doorFilter.Q.value=.55;
    const doors=doorWeights.map(()=>{
      const level=ctx.createGain(), pan=sfx.panner(0,1.1,0);
      level.gain.value=0;level.channelCount=1;level.channelCountMode='explicit';
      pan.rolloffFactor=0;
      doorFilter.connect(level).connect(pan).connect(bus);
      return {level,pan};
    });
    graph={ctx,bus,source:null,filter,level,tapBus,tapFilter,doorFilter,doors,targets:new Map(),side:null};
    nextFlash=ctx.currentTime+4+Math.random()*2;
    flashAt=-100;
  }
  function roll(at, strength, inside) {
    const {ctx,bus}=graph;
    const src=ctx.createBufferSource(), low=ctx.createBiquadFilter(), gain=ctx.createGain();
    src.buffer=rollBuffer;
    src.playbackRate.value=.86+Math.random()*.12;
    low.type='lowpass'; low.Q.value=.74;
    low.frequency.setValueAtTime(inside?440:1050,at);
    low.frequency.exponentialRampToValueAtTime(105,at+.85);
    low.frequency.exponentialRampToValueAtTime(60,at+3.9);
    const peak=(inside?.69:1)*strength, env=gain.gain;
    env.setValueAtTime(.0001,at);
    for (const [delay,amplitude] of [[.08,1.25],[.32,.39],[.77,.92],[1.24,.33],[1.76,.61],[2.6,.32],[4.4,.001]])
      env.exponentialRampToValueAtTime(peak*amplitude,at+delay);
    src.connect(low).connect(gain).connect(bus);
    thunderVoices.add(src);
    src.onended=()=>{thunderVoices.delete(src);gain.disconnect();};
    src.start(at);src.stop(at+4.5);
  }
  return {stop, impact, canHearHits:()=>audibleHits, update(sfx,inside,eye) {
    if (!sfx.ctx || !sfx.enabled || sfx.ctx.state!=='running') {stop(); return 0;}
    if (!graph) start(sfx);
    const now=graph.ctx.currentTime;
    loadTaps(graph.ctx);
    if (!graph.source) {
      if (!rainBuffer) loadRain(graph.ctx);
      else {
        const source=graph.ctx.createBufferSource();
        source.buffer=rainBuffer; source.loop=true;
        source.connect(graph.filter);source.connect(graph.doorFilter);
        source.start(0,now%rainBuffer.duration);
        graph.source=source;
      }
    }
    const side=eye.z>=0 ? freightDoorways[0] : freightDoorways[1];
    const depth=(eye.z-side.z)*Math.sign(side.z);
    const nearCabin=Math.abs(eye.x)<15.4 && eye.y<3.16 && depth> -2.8;
    // At roof height an outdoor player still hears the open-deck mix.
    const threshold=nearCabin ? THREE.MathUtils.smoothstep(depth,-2.8,1.7) : 0;
    cabin=nearCabin && depth>.05 && inside ? side : null;
    graph.eyeX=eye.x;graph.eyeZ=eye.z;
    let total=0;
    for(let i=0;i<2;i++) {
      const [x,width]=side.openings[i];
      const lateral=Math.max(0,Math.abs(eye.x-x)-width);
      const distance=Math.hypot(Math.max(0,depth),1.7*lateral);
      doorWeights[i]=threshold/(1+.17*distance+.043*distance*distance);
      total+=doorWeights[i];
      if(graph.side!==side) {
        const pan=graph.doors[i].pan;
        pan.setPosition(x,1.1,side.z-1.3*Math.sign(side.z));
      }
    }
    graph.side=side;
    const cover=nearCabin ? threshold : Number(inside);
    const direct=Math.min(1,total);
    const gain=(param,value,lag)=>{
      const previous=graph.targets.get(param);
      if (previous!==undefined && Math.abs(previous-value)<Math.max(.001,value*.004)) return;
      graph.targets.set(param,value);
      param.setTargetAtTime(value,now,lag);
    };
    for(let i=0;i<2;i++)
      gain(graph.doors[i].level.gain,.63*doorWeights[i]/Math.max(1,total),.095);
    gain(graph.filter.frequency,12500*Math.pow(1100/12500,cover),.14);
    gain(graph.level.gain,.74-.57*cover,.15);
    const tapGain=1-cover+.60*direct;
    gain(graph.tapBus.gain,Math.min(1,tapGain),.095);
    gain(graph.tapFilter.frequency,1800+13000*Math.min(1,1-cover+direct),.13);
    audibleHits=tapGain>.08;
    if (now>=nextFlash) {
      power=.58+Math.random()*.4;flashAt=now;
      nextFlash=now+30+Math.random()*30;
      roll(now+.65+1.35*(1-power),power,inside);
    }
    return power*Math.exp(-Math.max(0,now-flashAt)*5.6);
  }};
}
