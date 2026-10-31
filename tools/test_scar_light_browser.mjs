import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failed=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});
 page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:8123/?debug&debugMode=training&debugMap=blacktown&debugAutoStart=1&qa=baihu-game-1');
 await page.waitForFunction(()=>window.__tactical?.ready()&&__tactical.mapState().loaded.length>0,null,{timeout:120000});
 await page.waitForFunction(()=>__tactical.scarLightView()?.bones?.length===52,null,{timeout:30000});
 await page.evaluate(()=>{const t=__tactical;t.sfx.ensure();t.switchBackpack(4);t.clearSwitch();});
 await page.waitForTimeout(1500);
 const state=await page.evaluate(()=>{
  const t=__tactical,v=t.scarLightView(),meshes=[];
  v.root.traverse(m=>{if(m.isMesh)meshes.push({vertices:m.geometry.attributes.position.count,map:!!m.material.map,flipY:m.material.map.flipY,color:m.material.color.getHex(),additive:m.material.blending===2});});
  return {id:t.curId(),packs:t.backpackState().list,name:t.skinState().name,view:v.root.visible,meshes,
   ammo:t.getAmmo(),duration:t.getReloadDur(),catalog:t.worldModels('scar'),audio:t.audioState(),bones:v.bones.length};
 });
 assert.equal(state.id,'scar');assert.deepEqual(state.packs,['ak','m4','barrett','m4','scar','m200','akgold','kn57']);
 assert.match(state.name,/白虎/);assert.equal(state.view,true);assert.equal(state.bones,52);
 assert.equal(state.meshes.length,4);assert.ok(state.meshes.every(m=>m.map&&m.flipY===false&&m.color===0xffffff));
 assert.ok(state.meshes.some(m=>m.additive));assert.equal(state.ammo.mag,41);assert.equal(state.ammo.reserve,123);
 assert.ok(state.catalog.length===1&&state.catalog.every(c=>c.world&&c.enemy));
 for(const key of ['scar_fire','scar_select','scar_clipin','scar_clipout'])assert.ok(state.audio.loaded.includes(key));
 assert.equal(state.audio.ctxState,'running');assert.deepEqual(state.audio.failed,[]);
 assert.ok(Math.abs(state.duration-2.47)<1e-7);
 await page.screenshot({path:'/private/tmp/scar-light-game-idle.png'});
 const actions=await page.evaluate(()=>{
  const t=__tactical,v=t.scarLightView();t.pause();t.clearSwitch();t.owned.scar.state.nextFireAt=0;
  let shotAudio;const original=t.sfx.shoot;
  t.sfx.shoot=function(...args){const result=original.apply(this,args);shotAudio=this.audioState().lastAttempt;return result;};
  t.forceFire();t.sfx.shoot=original;
  const afterShot=t.getAmmo().mag;t.startReload();
  return {afterShot,shotAudio,reloading:t.isReloading(),audio:t.audioState(),clips:['select','prefire','sequence_4','sequence_5','reload'].map(n=>({name:n,duration:v.duration(n)}))};
 });
 assert.equal(actions.afterShot,40);assert.equal(actions.reloading,true);
 assert.equal(actions.shotAudio.reason,'sample');assert.equal(actions.shotAudio.id,'scar');
 assert.equal(actions.audio.lastAttempt.reason,'sample');
 assert.deepEqual(actions.audio.scheduled.filter(h=>h.method==='reload').map(h=>h.delay),[.839,1.818]);
 const reloadPose=await page.evaluate(()=>{
  const t=__tactical,v=t.scarLightView();
  t.poseReload(.15);const first=v.bones.map(b=>b.position.toArray().concat(b.quaternion.toArray()));
  t.poseReload(.5);const second=v.bones.map(b=>b.position.toArray().concat(b.quaternion.toArray()));
  t.renderer.clear();t.renderer.render(t.scene,t.camera);t.renderer.clearDepth();t.renderer.render(t.vmScene,t.vmCamera);
  return {clip:v.clip,seconds:v.seconds,changed:first.filter((b,i)=>b.some((n,k)=>Math.abs(n-second[i][k])>.001)).length};
 });
 assert.equal(reloadPose.clip,'reload');assert.ok(reloadPose.changed>5);assert.ok(Math.abs(reloadPose.seconds-53/44)<1e-7);
 await page.screenshot({path:'/private/tmp/scar-light-game-reload.png'});
 const dropped=await page.evaluate(()=>{
  const t=__tactical;t.clearReload();t.switchWeapon('deagle');t.clearSwitch();
  const hidden=!t.scarLightView().root.visible;
  t.switchWeapon('scar');t.clearSwitch();t.dropWeapon();
  const items=t.groundItems(),pickup=t.pickUpNearest();
  return {hidden,items,pickup,id:t.curId(),errors:t.loopErrors?.()};
 });
 assert.equal(dropped.hidden,true);assert.ok(dropped.items.some(i=>i.id==='scar'&&i.inScene&&i.meshes===2),JSON.stringify(dropped));
 assert.equal(dropped.pickup?.id,'scar');assert.equal(dropped.id,'scar');
 const interrupted=await page.evaluate(()=>{
  const t=__tactical;t.clearSwitch();t.owned.scar.state.mag=20;t.startReload();
  t.switchWeapon('deagle');
  const reloadStopped=[...t.sfx._scheduled].filter(h=>h.method==='reload').every(h=>h.stopped);
  t.switchWeapon('scar');const v=t.scarLightView();t.switchStep(.12);
  const selectPose={clip:v.clip,seconds:v.seconds};
  t.switchWeapon('deagle');
  const futureDeploy=[...t.sfx._scheduled].filter(h=>h.method==='deploy'&&h.at>t.sfx.ctx.currentTime&&!h.stopped).length;
  return {reloadStopped,selectPose,futureDeploy,loopErrors:t.loopErrors()};
 });
 assert.equal(interrupted.reloadStopped,true);assert.equal(interrupted.selectPose.clip,'select');assert.ok(Math.abs(interrupted.selectPose.seconds-.12)<1e-7);
 // The new Desert Eagle deploy may remain; the cancelled BaiHu event may not.
 assert.ok(interrupted.futureDeploy<=1);assert.equal(interrupted.loopErrors,0);
 assert.ok(!requests.some(u=>/assets\/preview\/gamebanana|\/catalog.json/.test(u)),'no candidate assets/catalog may load in gameplay');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 for(const s of [state,actions])s.audio={ready:s.audio.ready,ctxState:s.audio.ctxState,loaded:s.audio.loaded.filter(k=>k.startsWith('scar_')),lastAttempt:s.audio.lastAttempt,scheduled:s.audio.scheduled,failed:s.audio.failed};
 console.log(JSON.stringify({state,actions,reloadPose,dropped,interrupted,requests:requests.filter(u=>u.includes('/scar_light/')),errors,failed},null,2));
}finally{await browser.close()}
