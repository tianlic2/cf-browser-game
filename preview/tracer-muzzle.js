import * as THREE from 'three';
import { ClassicView } from '../scripts/classic_view.js';

const STORAGE_KEY='cf-tracer-muzzle-calibration-v1';
const WEAPONS=[
  {id:'ak',label:'AK-47',asset:'ak/view',fire:'fire',pose:{x:.38,y:-.18,z:.01,pitch:.01,yaw:.02,roll:0,scale:2.63}},
  {id:'m4',label:'M4A1-C',asset:'m4c_view',fire:'fire1',pose:{x:-.42,y:-.20,z:-.18,pitch:0,yaw:-1.58,roll:0,scale:1.230}},
  {id:'ironbeast',label:'炫金雷神',asset:'m4_ironbeast',fire:'fire',pose:{x:0,y:0,z:.03,pitch:0,yaw:0,roll:0,scale:1}},
  {id:'barrett',label:'巴雷特 M82A1',asset:'barrett',fire:'fire',pose:{x:.99,y:-.12,z:.12,pitch:0,yaw:.01,roll:0,scale:4.826}},
  {id:'deagle',label:'沙漠之鹰',asset:'deagle_festa',fire:'fire',pose:{x:.23,y:-.19,z:-.55,pitch:0,yaw:-.04,roll:0,scale:1.368}},
];
const APPROVED={
  ak:{x:0,y:0,z:0,yaw:3.7,pitch:2.6},m4:{x:0,y:0,z:0,yaw:1.3,pitch:.6},
  ironbeast:{x:0,y:0,z:0,yaw:.6,pitch:.5},barrett:{x:0,y:0,z:0,yaw:4.1,pitch:1.4},
  deagle:{x:0,y:0,z:0,yaw:.9,pitch:1},
};
const DEFAULT=id=>({...APPROVED[id]});
const saved=readSaved();
const params=Object.fromEntries(WEAPONS.map(w=>[w.id,{...DEFAULT(w.id),...(saved[w.id]||{})}]));

const canvas=document.querySelector('#view'),stage=document.querySelector('#stage');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x101b23,7,18);
const camera=new THREE.PerspectiveCamera(75,1,.008,40);
camera.position.set(0,0,0);
camera.lookAt(0,0,-1);
scene.add(new THREE.HemisphereLight(0xbde9ff,0x332719,2.1));
const key=new THREE.DirectionalLight(0xffe4b0,3.2);key.position.set(-2,4,2);scene.add(key);
const rim=new THREE.DirectionalLight(0x75cfff,2);rim.position.set(3,1,-2);scene.add(rim);

// A distant calibration wall makes the relationship between direction and reticle visible.
const wall=new THREE.Mesh(new THREE.PlaneGeometry(28,16),new THREE.MeshStandardMaterial({color:0x1c2b34,roughness:.96,metalness:.02}));
wall.position.z=-12;scene.add(wall);
const rings=new THREE.Group();rings.position.z=-11.97;scene.add(rings);
for(const [radius,color] of [[2.2,0x38515f],[1.2,0x557483],[.35,0xe4b34e]]){
  const ring=new THREE.Mesh(new THREE.RingGeometry(radius-.025,radius+.025,72),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,side:THREE.DoubleSide}));rings.add(ring);
}
const gridMat=new THREE.LineBasicMaterial({color:0x49616c,transparent:true,opacity:.18});
const gridPoints=[];for(let n=-8;n<=8;n++){gridPoints.push(new THREE.Vector3(n,-5,-11.95),new THREE.Vector3(n,5,-11.95));}
for(let n=-5;n<=5;n++){gridPoints.push(new THREE.Vector3(-8,n,-11.95),new THREE.Vector3(8,n,-11.95));}
const gridGeo=new THREE.BufferGeometry().setFromPoints(gridPoints);scene.add(new THREE.LineSegments(gridGeo,gridMat));

const detectedMarker=new THREE.Mesh(new THREE.SphereGeometry(.018,18,12),new THREE.MeshBasicMaterial({color:0x67ddff,depthTest:false}));
detectedMarker.renderOrder=20;scene.add(detectedMarker);
const tunedMarker=new THREE.Mesh(new THREE.SphereGeometry(.025,20,14),new THREE.MeshBasicMaterial({color:0xffc45d,depthTest:false}));
tunedMarker.renderOrder=21;scene.add(tunedMarker);
const halo=new THREE.Mesh(new THREE.RingGeometry(.032,.043,28),new THREE.MeshBasicMaterial({color:0xffd88b,transparent:true,opacity:.9,side:THREE.DoubleSide,depthTest:false}));
halo.renderOrder=22;scene.add(halo);

const directionLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xffd16f,transparent:true,opacity:.72,depthTest:false}));
directionLine.renderOrder=19;scene.add(directionLine);
const impact=new THREE.Mesh(new THREE.RingGeometry(.07,.10,28),new THREE.MeshBasicMaterial({color:0xffc45d,side:THREE.DoubleSide,depthTest:false}));
impact.renderOrder=19;scene.add(impact);
const tracer=new THREE.Mesh(new THREE.CylinderGeometry(.006,.012,1,8,1,true),new THREE.MeshBasicMaterial({color:0xffedb2,transparent:true,opacity:.92,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false}));
tracer.renderOrder=30;scene.add(tracer);

const loaded=new Map();
let current=WEAPONS[0],activeView=null,fireStart=-Infinity,lastAutoFire=-Infinity,drag=null;
const autoMuzzle=new THREE.Vector3(),origin=new THREE.Vector3(),direction=new THREE.Vector3(),lineEnd=new THREE.Vector3();
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),dragPlane=new THREE.Plane(),dragPoint=new THREE.Vector3();
const up=new THREE.Vector3(0,1,0),clock=new THREE.Clock();

const fields=[
  {key:'x',label:'左右 X',min:-50,max:50,step:.1,unit:'cm',scale:100},
  {key:'y',label:'上下 Y',min:-50,max:50,step:.1,unit:'cm',scale:100},
  {key:'z',label:'前后 Z',min:-50,max:50,step:.1,unit:'cm',scale:100},
];
const angles=[
  {key:'yaw',label:'左右偏航',min:-45,max:45,step:.1,unit:'°',scale:1},
  {key:'pitch',label:'上下俯仰',min:-45,max:45,step:.1,unit:'°',scale:1},
];
const controls=new Map();
buildTabs();buildControls(document.querySelector('#positionControls'),fields);buildControls(document.querySelector('#directionControls'),angles);
document.querySelector('#fire').addEventListener('click',triggerFire);
document.querySelector('#autoFire').addEventListener('change',()=>lastAutoFire=-Infinity);
document.querySelector('#showDetected').addEventListener('change',e=>detectedMarker.visible=e.target.checked);
document.querySelector('#resetCurrent').addEventListener('click',()=>{params[current.id]=DEFAULT(current.id);syncControls();persist();flash('已恢复当前正式校准参数。')});
document.querySelector('#copyCurrent').addEventListener('click',()=>copyPayload(exportPayload([current])));
document.querySelector('#copyAll').addEventListener('click',()=>copyPayload(exportPayload(WEAPONS)));
window.addEventListener('resize',resize);
canvas.addEventListener('pointerdown',pointerDown);
canvas.addEventListener('pointermove',pointerMove);
canvas.addEventListener('pointerup',pointerUp);
canvas.addEventListener('pointercancel',pointerUp);
resize();selectWeapon(current.id);requestAnimationFrame(frame);

function buildTabs(){
  const host=document.querySelector('#weaponTabs');
  for(const weapon of WEAPONS){
    const button=document.createElement('button');button.type='button';button.textContent=weapon.label;button.dataset.weapon=weapon.id;
    button.addEventListener('click',()=>selectWeapon(weapon.id));host.append(button);
  }
}
function buildControls(host,specs){
  for(const spec of specs){
    const row=document.createElement('div');row.className='control';
    const label=document.createElement('label');label.textContent=spec.label;
    const range=document.createElement('input');range.type='range';range.min=spec.min;range.max=spec.max;range.step=spec.step;
    const number=document.createElement('input');number.type='number';number.min=spec.min;number.max=spec.max;number.step=spec.step;
    const apply=value=>{const n=THREE.MathUtils.clamp(Number(value)||0,spec.min,spec.max);params[current.id][spec.key]=n/spec.scale;range.value=n;number.value=n.toFixed(1);persist();updateOutput();};
    range.addEventListener('input',()=>apply(range.value));number.addEventListener('input',()=>apply(number.value));
    row.append(label,range,number);host.append(row);controls.set(spec.key,{spec,range,number});
  }
}
async function selectWeapon(id){
  current=WEAPONS.find(w=>w.id===id)||WEAPONS[0];
  document.querySelectorAll('#weaponTabs button').forEach(b=>b.classList.toggle('active',b.dataset.weapon===id));
  document.querySelector('#stageWeapon').textContent=current.label;syncControls();
  if(activeView)activeView.root.visible=false;
  const requested=current,view=await ensureLoaded(requested);
  if(current.id!==requested.id)return;
  activeView=view;
  if(activeView){activeView.root.visible=true;activeView.sample('idle_0',0);activeView.root.updateMatrixWorld(true);}
  fireStart=-Infinity;lastAutoFire=-Infinity;document.querySelector('#loading').classList.add('hidden');
  document.querySelector('#status').textContent=`${current.label} 已加载；校准草稿会自动保存在本机浏览器。`;
}
async function ensureLoaded(weapon){
  if(loaded.has(weapon.id))return loaded.get(weapon.id);
  const loading=document.querySelector('#loading');loading.classList.remove('hidden');loading.querySelector('b').textContent=`正在读取 ${weapon.label} 视模`;
  const view=await ClassicView.load(weapon.asset);
  if(!view){loading.querySelector('b').textContent=`${weapon.label} 加载失败`;document.querySelector('#status').textContent='请使用本地 HTTP 服务打开本页，不能直接用 file://。';return null;}
  const p=weapon.pose;view.root.position.set(p.x,p.y,p.z);view.root.rotation.set(p.pitch,p.yaw,p.roll);view.root.scale.setScalar(p.scale);view.root.visible=false;scene.add(view.root);loaded.set(weapon.id,view);return view;
}
function syncControls(){
  const p=params[current.id];for(const [key,c] of controls){const n=p[key]*c.spec.scale;c.range.value=n;c.number.value=n.toFixed(1);}updateOutput();
}
function triggerFire(){fireStart=clock.elapsedTime;lastAutoFire=clock.elapsedTime;}
function frame(){
  requestAnimationFrame(frame);const time=clock.getElapsedTime();
  if(activeView){
    if(document.querySelector('#autoFire').checked&&time-lastAutoFire>1.05)triggerFire();
    const fireAge=time-fireStart,fireDuration=activeView.duration(current.fire);
    if(fireAge>=0&&fireAge<fireDuration)activeView.sample(current.fire,fireAge);else activeView.sample('idle_0',time%activeView.duration('idle_0'));
    activeView.root.updateMatrixWorld(true);activeView.muzzle(autoMuzzle);
    const p=params[current.id];
    if(!drag){origin.copy(autoMuzzle).add(new THREE.Vector3(p.x,p.y,p.z));tunedMarker.position.copy(origin);}
    else origin.copy(tunedMarker.position);
    detectedMarker.position.copy(autoMuzzle);halo.position.copy(origin);halo.quaternion.copy(camera.quaternion);
    direction.set(0,0,-1).applyEuler(new THREE.Euler(THREE.MathUtils.degToRad(p.pitch),THREE.MathUtils.degToRad(p.yaw),0,'YXZ')).normalize();
    lineEnd.copy(origin).addScaledVector(direction,11.5);setLine(directionLine,origin,lineEnd);
    const wallT=(-11.96-origin.z)/direction.z;impact.position.copy(origin).addScaledVector(direction,Math.max(.1,wallT));
    const cycle=(time%0.62)/.62,center=.5+cycle*9.5;setCylinder(tracer,origin.clone().addScaledVector(direction,center-.55),origin.clone().addScaledVector(direction,center+.55));
    const pulse=1+Math.sin(time*7)*.13;tunedMarker.scale.setScalar(pulse);halo.scale.setScalar(pulse);
    updateReadout();
  }
  renderer.render(scene,camera);
}
function setLine(line,a,b){const pos=line.geometry.attributes.position;pos.setXYZ(0,a.x,a.y,a.z);pos.setXYZ(1,b.x,b.y,b.z);pos.needsUpdate=true;}
function setCylinder(mesh,a,b){const middle=a.clone().add(b).multiplyScalar(.5);mesh.position.copy(middle);mesh.scale.set(1,a.distanceTo(b),1);mesh.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());}
function updateReadout(){
  const f=v=>`${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)} m`;
  document.querySelector('#detectedReadout').textContent=f(autoMuzzle);document.querySelector('#originReadout').textContent=f(origin);
}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();}
function pointerCoords(event){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);}
function pointerDown(event){
  if(!activeView)return;pointerCoords(event);if(!raycaster.intersectObject(tunedMarker,false).length)return;
  event.preventDefault();canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,lastY:event.clientY,startZ:tunedMarker.position.z};
  dragPlane.set(new THREE.Vector3(0,0,1),-tunedMarker.position.z);canvas.style.cursor='grabbing';
}
function pointerMove(event){
  if(!drag||event.pointerId!==drag.id)return;pointerCoords(event);
  if(event.shiftKey){tunedMarker.position.z+=-(event.clientY-drag.lastY)*.003;drag.lastY=event.clientY;}
  else if(raycaster.ray.intersectPlane(dragPlane,dragPoint)){tunedMarker.position.x=dragPoint.x;tunedMarker.position.y=dragPoint.y;}
  const p=params[current.id];p.x=tunedMarker.position.x-autoMuzzle.x;p.y=tunedMarker.position.y-autoMuzzle.y;p.z=tunedMarker.position.z-autoMuzzle.z;
  for(const key of ['x','y','z']){const c=controls.get(key),n=p[key]*100;c.range.value=THREE.MathUtils.clamp(n,c.spec.min,c.spec.max);c.number.value=n.toFixed(1);}persist();updateOutput();
}
function pointerUp(event){if(!drag||event.pointerId!==drag.id)return;drag=null;canvas.releasePointerCapture?.(event.pointerId);canvas.style.cursor='crosshair';}
function updateOutput(){document.querySelector('#output').value=JSON.stringify(exportPayload(WEAPONS),null,2);}
function exportPayload(weapons){
  return {version:1,units:{position:'meter',angle:'degree'},basis:'animated model muzzle + camera-local correction',weapons:Object.fromEntries(weapons.map(w=>[w.id,{label:w.label,offset:{x:round(params[w.id].x),y:round(params[w.id].y),z:round(params[w.id].z)},direction:{yawDeg:round(params[w.id].yaw),pitchDeg:round(params[w.id].pitch)}}]))};
}
function round(n){return Math.round(n*10000)/10000;}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(params));}
function readSaved(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return {}}}
async function copyPayload(payload){const text=JSON.stringify(payload,null,2);document.querySelector('#output').value=text;try{await navigator.clipboard.writeText(text);flash('参数已经复制，可以直接发给我。')}catch{document.querySelector('#output').select();document.execCommand('copy');flash('参数已经复制，可以直接发给我。')}}
function flash(text){const el=document.querySelector('#result');el.textContent=text;clearTimeout(flash.timer);flash.timer=setTimeout(()=>el.textContent='曳光末端与准心重合时，方向修正为正确；起点应位于枪管最前端。',2400);}
