import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { buildLingyinMap } from '../scripts/lingyin_map.js?v=static-solids-1';
import { LingyinMasterplanBlockout } from '../scripts/lingyin_world.js?v=85';
import { RenderBudget } from '../scripts/render_budget.js?v=1';
import { prepareMapMaterials,prepareMapTextures } from '../scripts/map_material_warmup.js?v=2';

const STORAGE_KEY='crossfire.lingyin.editor.v1';
const canvas=document.querySelector('#viewport');
const loading=document.querySelector('#loading');
const loadingProgress=document.querySelector('#loading-progress');
const list=document.querySelector('#object-list');
const selectedName=document.querySelector('#selected-name');
const selectionChip=document.querySelector('#selection-chip');
const toast=document.querySelector('#toast');
const fields=[...document.querySelectorAll('[data-field]')];

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
const renderBudget=new RenderBudget();
renderer.setPixelRatio(renderBudget.setViewport(innerWidth,innerHeight,devicePixelRatio));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x8193a0);
scene.fog=new THREE.FogExp2(0x8d9997,.0026);
const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.05,900);
camera.position.set(57,42,68);

const orbit=new OrbitControls(camera,canvas);
orbit.target.set(-2,5,-4);
orbit.enableDamping=true;
orbit.dampingFactor=.08;
orbit.screenSpacePanning=true;
orbit.maxPolarAngle=Math.PI*.495;
orbit.minDistance=2;
orbit.maxDistance=260;

const hemi=new THREE.HemisphereLight(0xbfd6df,0x313027,1.65);
scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe5bd,3.1);
sun.position.set(55,90,44);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=sun.shadow.camera.bottom=-85;
sun.shadow.camera.right=sun.shadow.camera.top=85;
sun.shadow.camera.far=260;
scene.add(sun);

const grid=new THREE.GridHelper(180,90,0x78969c,0x4c6065);
grid.position.y=.015;
grid.material.transparent=true;
grid.material.opacity=.22;
scene.add(grid);

const transform=new TransformControls(camera,canvas);
const transformHelper=typeof transform.getHelper==='function'?transform.getHelper():transform;
scene.add(transformHelper);
transform.setSize(.78);
transform.setTranslationSnap(.05);
transform.setRotationSnap(THREE.MathUtils.degToRad(1));
transform.setScaleSnap(.01);
transform.addEventListener('dragging-changed',event=>{ orbit.enabled=!event.value; if(event.value)beginEdit(); else commitEdit(); });
transform.addEventListener('objectChange',()=>{ syncFields(); updateSelectionBox(); saveState(false); });

let map,world,plan,selected=null,selectedId='',selectionBox=null;
let collisionOverlay=null;
let suppressHistory=false;
const entries=[];
const byObject=new Map();
const byId=new Map();
const originals=new Map();
const undoStack=[];
const redoStack=[];
let editStart='';

const LABELS={
  terrain:'中心地形',water:'水体与瀑布','hillside-pilgrimage-trail':'原西侧山路（对照）',
  'lingyin-gate-approach-ground':'山门前地面',temple:'寺院建筑主体',
  'lingyin-forest-gate':'新山门','lingyin-gate-framing-trees':'入口树景',
  'lingyin-interior-murals':'殿内壁画',vegetation:'中心植被',details:'庭院细节',mist:'雾与香烟',
  'lingyin-main-hall-interior':'大雄宝殿内景','hall-tripod-incense-burner':'殿内三足香炉',
  'lingyin-small-hall-interiors':'东西侧殿内景',
  'phase1-west-boardwalk-v3':'方案 · 西侧木栈道','phase1-east-river':'方案 · 东侧水景',
  'phase1-east-crossing':'方案 · 石桥与水亭'
};
const PREFERRED=[
  'terrain','water','hillside-pilgrimage-trail','lingyin-gate-approach-ground','temple',
  'lingyin-forest-gate','lingyin-gate-framing-trees','lingyin-interior-murals','vegetation','details','mist',
  'lingyin-main-hall-interior','hall-tripod-incense-burner','lingyin-small-hall-interiors',
  'phase1-west-boardwalk-v3','phase1-east-river','phase1-east-crossing'
];

function round(value,digits=3){const k=10**digits;return Math.round(value*k)/k}
function snapshotObject(object){return {p:object.position.toArray().map(v=>round(v)),r:[object.rotation.x,object.rotation.y,object.rotation.z].map(v=>round(v,5)),s:object.scale.toArray().map(v=>round(v)),v:object.visible}}
function applySnapshot(object,state){if(!state)return;object.position.fromArray(state.p);object.rotation.set(...state.r);object.scale.fromArray(state.s);object.visible=state.v!==false;object.updateMatrixWorld(true)}
function snapshotAll(){const data={};for(const e of entries)data[e.id]=snapshotObject(e.object);return data}
function applyAll(data){if(!data)return;suppressHistory=true;for(const [id,state] of Object.entries(data)){const entry=byId.get(id);if(entry)applySnapshot(entry.object,state)}suppressHistory=false;refreshRows();syncFields();updateSelectionBox()}
function encode(data){const bytes=new TextEncoder().encode(JSON.stringify(data));let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function decode(value){try{const raw=value.replaceAll('-','+').replaceAll('_','/');const binary=atob(raw);return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0))))}catch{return null}}
function changedState(){const data={};for(const e of entries){const now=snapshotObject(e.object),base=originals.get(e.id);if(JSON.stringify(now)!==JSON.stringify(base))data[e.id]=now}return data}
function saveState(showToast=true){if(!world)return;const data=changedState();localStorage.setItem(STORAGE_KEY,JSON.stringify(data));const url=new URL(location.href);url.searchParams.set('editor','lingyin');if(Object.keys(data).length)url.searchParams.set('le',encode(data));else url.searchParams.delete('le');history.replaceState(null,'',url);if(showToast)notify('调整已保存到本机和当前网址')}
function beginEdit(){editStart=JSON.stringify(snapshotAll())}
function commitEdit(){if(suppressHistory)return;const after=JSON.stringify(snapshotAll());if(editStart&&editStart!==after){undoStack.push(editStart);if(undoStack.length>60)undoStack.shift();redoStack.length=0}editStart='';saveState(false)}
function pushSingleEdit(mutator){beginEdit();mutator();commitEdit();refreshRows();syncFields();updateSelectionBox()}

function register(object,id,label){if(!object||byId.has(id))return;const entry={object,id,label};entries.push(entry);byObject.set(object,entry);byId.set(id,entry);originals.set(id,snapshotObject(object))}
function buildEntries(){
  for(const name of PREFERRED){
    const object=world.getObjectByName(name);
    if(object)register(object,name,LABELS[name]||name);
  }
  renderList();
}
function renderList(){
  list.innerHTML='';
  for(const entry of entries){
    const row=document.createElement('div');row.className='object-row';row.dataset.id=entry.id;
    const check=document.createElement('input');check.type='checkbox';check.checked=entry.object.visible;check.title='显示/隐藏';
    check.addEventListener('change',()=>pushSingleEdit(()=>{entry.object.visible=check.checked}));
    const button=document.createElement('button');button.type='button';button.textContent=entry.label;button.title=entry.id;
    button.addEventListener('click',()=>selectEntry(entry));
    row.append(check,button);list.append(row);
  }
  refreshRows();
}
function refreshRows(){for(const row of list.children){const entry=byId.get(row.dataset.id);row.classList.toggle('selected',entry?.id===selectedId);const check=row.querySelector('input');if(check&&entry)check.checked=entry.object.visible}}
function selectEntry(entry){
  selected=entry?.object||null;selectedId=entry?.id||'';
  if(selected){transform.attach(selected);selectedName.textContent=entry.label;selectionChip.textContent=`已选择 · ${entry.label}`}
  else{transform.detach();selectedName.textContent='未选择';selectionChip.textContent='未选择对象'}
  fields.forEach(input=>input.disabled=!selected);
  refreshRows();syncFields();updateSelectionBox();
}
function syncFields(){
  if(!selected){fields.forEach(input=>input.value='');return}
  const values={px:selected.position.x,py:selected.position.y,pz:selected.position.z,
    rx:THREE.MathUtils.radToDeg(selected.rotation.x),ry:THREE.MathUtils.radToDeg(selected.rotation.y),rz:THREE.MathUtils.radToDeg(selected.rotation.z),
    sx:selected.scale.x,sy:selected.scale.y,sz:selected.scale.z};
  fields.forEach(input=>input.value=round(values[input.dataset.field],input.dataset.field.startsWith('r')?2:3));
}
function updateSelectionBox(){
  if(selectionBox){scene.remove(selectionBox);selectionBox.geometry.dispose();selectionBox.material.dispose();selectionBox=null}
  if(selected&&selected.visible){selectionBox=new THREE.BoxHelper(selected,0xe5c56e);selectionBox.material.transparent=true;selectionBox.material.opacity=.72;scene.add(selectionBox)}
}
function focusSelected(){
  if(!selected)return;
  const box=new THREE.Box3().setFromObject(selected);if(box.isEmpty())return;
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length();
  orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(size*.65,size*.4,size*.65));orbit.update();
}
function notify(text){toast.textContent=text;toast.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),1800)}

function buildCollisionOverlay(proxies){
  proxies.updateMatrixWorld(true);const group=new THREE.Group();group.name='collision-preview';
  const material=new THREE.MeshBasicMaterial({color:0xff405c,wireframe:true,transparent:true,opacity:.34,depthTest:false});
  proxies.traverse(object=>{if(!object.isMesh||!object.geometry)return;const mesh=new THREE.Mesh(object.geometry,material);mesh.matrix.copy(object.matrixWorld);mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.renderOrder=999;group.add(mesh)});
  group.visible=false;scene.add(group);return group;
}

function applyField(input){
  if(!selected)return;const n=Number(input.value);if(!Number.isFinite(n))return;
  const f=input.dataset.field;
  const axis=f[1];
  if(f[0]==='p')selected.position[axis]=n;
  else if(f[0]==='r')selected.rotation[axis]=THREE.MathUtils.degToRad(n);
  else selected.scale[axis]=Math.max(.01,n);
  selected.updateMatrixWorld(true);updateSelectionBox();saveState(false);
}
fields.forEach(input=>input.addEventListener('focus',beginEdit));
fields.forEach(input=>input.addEventListener('input',()=>applyField(input)));
fields.forEach(input=>input.addEventListener('change',()=>{applyField(input);commitEdit()}));
fields.forEach(input=>input.addEventListener('blur',commitEdit));
fields.forEach(input=>input.addEventListener('keydown',event=>{if(event.key==='Enter')input.blur()}));

document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
  transform.setMode(button.dataset.mode);document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
}));
document.querySelector('#local-space').addEventListener('change',event=>transform.setSpace(event.target.checked?'local':'world'));
document.querySelector('#collision-toggle').addEventListener('change',event=>{if(collisionOverlay)collisionOverlay.visible=event.target.checked});
document.querySelector('#grid-toggle').addEventListener('change',event=>grid.visible=event.target.checked);
document.querySelector('#focus-selection').addEventListener('click',focusSelected);
document.querySelector('#reset-selection').addEventListener('click',()=>selectedId&&pushSingleEdit(()=>applySnapshot(selected,originals.get(selectedId))));
document.querySelector('#hide-selection').addEventListener('click',()=>selectedId&&pushSingleEdit(()=>{selected.visible=false}));
document.querySelector('#save-local').addEventListener('click',()=>saveState(true));
document.querySelector('#copy-config').addEventListener('click',async()=>{const text=JSON.stringify(changedState(),null,2);try{await navigator.clipboard.writeText(text);notify('修改参数已复制')}catch{notify('复制失败，请使用当前网址保存')}});
document.querySelector('#reset-all').addEventListener('click',()=>{beginEdit();for(const e of entries)applySnapshot(e.object,originals.get(e.id));commitEdit();saveState(false);refreshRows();syncFields();updateSelectionBox();notify('已恢复全部初始参数')});
document.querySelector('#undo').addEventListener('click',()=>{if(!undoStack.length)return;redoStack.push(JSON.stringify(snapshotAll()));applyAll(JSON.parse(undoStack.pop()));saveState(false)});
document.querySelector('#redo').addEventListener('click',()=>{if(!redoStack.length)return;undoStack.push(JSON.stringify(snapshotAll()));applyAll(JSON.parse(redoStack.pop()));saveState(false)});
document.querySelector('#toggle-panel').addEventListener('click',event=>{const hidden=document.querySelector('#editor-panel').classList.toggle('hidden');event.currentTarget.textContent=hidden?'显示面板':'隐藏面板'});

const VIEWS={reference:{p:[-2,64,104],t:[-3,5,2]},courtyard:{p:[54,34,64],t:[-2,5,-6]},top:{p:[-2,118,2],t:[-2,0,2]},gate:{p:[24,16,70],t:[-2,6,37]},wing:{p:[17,2.4,38.9],t:[7,1.45,38.9]},boundary:{p:[38,16,88],t:[-2,1.8,60]},trail:{p:[-56,32,4],t:[-43,13,-6]},boardwalk:{p:[-70,45,48],t:[-37,7,9]},boardwalkEntry:{p:[-12,18,-7],t:[-35,4,-25]},pavilion:{p:[-78,33,51],t:[-53,13,62]},river:{p:[67,31,20],t:[37,4,9]},westInterior:{p:[-20.4,2.65,6.7],t:[-28,1.9,7.6],fov:60},eastInterior:{p:[14,2.65,7.3],t:[23.2,2.05,7],fov:60},rearInterior:{p:[-1.7,2.85,-34.6],t:[-2,2.2,-40],fov:64}};
VIEWS.mainInterior={p:[-2,3.05,-17],t:[-2,4.2,-31],fov:70};
VIEWS.mainHall={p:[34,23,8],t:[-2,6,-26]};
// Old saved review URLs still open a useful view rather than the removed room.
VIEWS.rearInterior=VIEWS.mainInterior;
function applyView(name){const v=VIEWS[name];if(!v)return;camera.fov=v.fov??50;camera.updateProjectionMatrix();camera.position.fromArray(v.p);orbit.target.fromArray(v.t);orbit.update()}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>applyView(button.dataset.view)));

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let pointerStart=null;
canvas.addEventListener('pointerdown',event=>{if(event.button===0)pointerStart=[event.clientX,event.clientY]});
canvas.addEventListener('pointerup',event=>{
  if(!pointerStart||Math.hypot(event.clientX-pointerStart[0],event.clientY-pointerStart[1])>5)return;
  pointer.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObject(world,true);
  for(const hit of hits){let object=hit.object;while(object&&object!==world){if(byObject.has(object)){selectEntry(byObject.get(object));return}object=object.parent}}
});

addEventListener('keydown',event=>{
  if(event.target instanceof HTMLInputElement)return;
  if(event.key.toLowerCase()==='w')document.querySelector('[data-mode="translate"]').click();
  if(event.key.toLowerCase()==='e')document.querySelector('[data-mode="rotate"]').click();
  if(event.key.toLowerCase()==='r')document.querySelector('[data-mode="scale"]').click();
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();document.querySelector(event.shiftKey?'#redo':'#undo').click()}
  if(event.key==='Delete'&&selected)document.querySelector('#hide-selection').click();
});

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(renderBudget.setViewport(innerWidth,innerHeight,devicePixelRatio));renderer.setSize(innerWidth,innerHeight)});

async function init(){
  map=await buildLingyinMap(scene,p=>loadingProgress.textContent=`${Math.round(p*100)}%`,{editor:true});
  world=map.visuals[0];world.visible=true;world.updateMatrixWorld(true);map.setActive(true);
  plan=new LingyinMasterplanBlockout();
  plan.fitPreviewTerrain(world);
  // The blockout is authored in the same source coordinate system as the
  // temple. `world` already applies the -3.25m gameplay offset; applying it
  // again here buried the west boardwalk beneath the visible terrain.
  plan.group.position.y=0;
  plan.group.name='lingyin-phase1-masterplan';
  world.add(plan.group);
  const oldTrail=world.getObjectByName('hillside-pilgrimage-trail');
  if(oldTrail)oldTrail.visible=false;
  scene.background=map.background;scene.fog=map.fog;
  const look=map.renderLook;
  if(look){
    renderer.toneMappingExposure=look.exposure;
    hemi.color.setHex(look.hemiSky);hemi.groundColor.setHex(look.hemiGround);hemi.intensity=look.hemiIntensity;
    sun.position.fromArray(look.sunPosition);sun.color.setHex(look.sunColor);sun.intensity=look.sunIntensity;
  }
  buildEntries();collisionOverlay=buildCollisionOverlay(map.visuals[1]);
  const params=new URLSearchParams(location.search);const fromUrl=decode(params.get('le')||'');
  const fromLocal=(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}})();
  applyAll(fromUrl||fromLocal||{});
  selectEntry(byId.get('temple')||entries[0]);
  if(params.has('view'))applyView(params.get('view'));
  else applyView('reference');
  loadingProgress.textContent='正在准备显示资源…';
  await prepareMapMaterials(map,renderer,camera,scene);
  await prepareMapTextures(map,renderer);
  loading.classList.add('done');setTimeout(()=>loading.remove(),500);
}

let last=performance.now();
function frame(now){requestAnimationFrame(frame);const ms=now-last,dt=Math.min(.05,ms/1000);last=now;orbit.update();if(map)map.update(now/1000,dt,camera);if(plan)plan.update(now/1000);if(selectionBox)selectionBox.update();renderer.render(scene,camera);const ratio=renderBudget.sample(ms,now,!!map&&!document.hidden);if(ratio!==null)renderer.setPixelRatio(ratio)}
requestAnimationFrame(frame);
init().catch(error=>{console.error(error);loading.querySelector('strong').textContent='加载失败';loadingProgress.textContent=error.message||String(error)});
