import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failed=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});
  page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:8123/?debug&debugMode=training&debugMap=blacktown&debugAutoStart=1&qa=gamebanana-admitted-1');
  await page.waitForFunction(()=>window.__tactical?.ready()&&__tactical.mapState().loaded.length>0,null,{timeout:120000});
  await page.waitForFunction(()=>__tactical.admittedView('m200')?.bones?.length===88&&
    __tactical.admittedView('akgold')?.bones?.length===59,null,{timeout:30000});
  const sniperInputGrace=await page.evaluate(async()=>{
    const t=__tactical;t.switchBackpack(5);t.clearSwitch();
    const state=t.owned.m200.state,before=state.mag;
    state.boltT=0;state.nextFireAt=0;state.cooldown=0;
    t.quickSwitchFromInput();
    const heldOnSniper=t.curId()==='m200',pendingAfterQ=t.sniperQuickSwitchGrace();
    await new Promise(resolve=>setTimeout(resolve,15));
    t.primaryFireFromInput();
    const afterShot=state.mag,switchedOut=t.curId()!=='m200';
    t.clearSwitch();
    t.quickSwitchFromInput();
    const returnedImmediately=t.curId()==='m200',pendingOnReturn=t.sniperQuickSwitchGrace();
    t.clearSwitch();state.mag=before;state.boltT=0;state.nextFireAt=0;state.cooldown=0;
    return {before,afterShot,heldOnSniper,pendingAfterQ,switchedOut,returnedImmediately,pendingOnReturn};
  });
  assert.equal(sniperInputGrace.pendingAfterQ.ms,50);
  assert.equal(sniperInputGrace.heldOnSniper,true,'Q from a sniper must wait for the short fire-priority window');
  assert.equal(sniperInputGrace.afterShot,sniperInputGrace.before-1,
    'a click arriving inside the sniper Q window must be settled before switching');
  assert.equal(sniperInputGrace.switchedOut,true,'queued Q must switch after the protected sniper shot');
  assert.equal(sniperInputGrace.returnedImmediately,true,'switching another weapon back to a sniper must remain immediate');
  assert.equal(sniperInputGrace.pendingOnReturn.pending,null,'returning to a sniper must not create a grace delay');
  const m200Cadence=await page.evaluate(async()=>{
    const t=__tactical;t.switchBackpack(5);t.clearSwitch();
    const state=t.owned.m200.state,before=state.mag;
    state.nextFireAt=0;t.forceFire();const afterFirst=state.mag;
    await new Promise(resolve=>setTimeout(resolve,1650));
    t.forceFire();const afterSecond=state.mag,boltT=state.boltT;
    state.mag=before;state.boltT=0;state.nextFireAt=0;state.cooldown=0;
    return {before,afterFirst,afterSecond,boltT};
  });
  assert.equal(m200Cadence.afterFirst,m200Cadence.before-1,'M200 first shot must consume one round');
  assert.equal(m200Cadence.afterSecond,m200Cadence.before-2,
    'M200 must fire a second shot after its bolt cycle without switching weapons');
  const results={};
  for(const [id,bp,mag,reload,bones] of [['m200',5,15,3.42,88],['akgold',6,41,2.71,59]]){
    results[id]=await page.evaluate(({id,bp})=>{
      const t=__tactical;t.sfx.ensure();t.switchBackpack(bp);t.clearSwitch();const v=t.admittedView(id),meshes=[];
      v.root.traverse(m=>{if(m.isMesh)meshes.push({vertices:m.geometry.attributes.position.count,map:!!m.material.map,flipY:m.material.map?.flipY});});
      const reload=t.getReloadDur();
      t.pause();t.owned[id].state.nextFireAt=0;t.forceFire();const afterShot=t.getAmmo().mag;
      t.startReload();t.poseReload(.5);
      const reloadState={clip:v.clip,seconds:v.seconds,scheduled:t.audioState().scheduled
        .filter(h=>h.method==='reload').map(h=>h.delay)};
      t.clearReload();t.switchWeapon('deagle');t.clearSwitch();const hidden=!v.root.visible;
      t.switchWeapon(id);t.clearSwitch();t.dropWeapon();const item=t.groundItems().find(i=>i.id===id);
      return {id:t.curId(),packs:t.backpackState().list,name:t.skinState().name,bones:v.bones.length,meshes,
        reload,afterShot,reloadState,hidden,item,audio:t.audioState(),loopErrors:t.loopErrors()};
    },{id,bp});
    const r=results[id];
    assert.deepEqual(r.packs,['ak','m4','barrett','m4','scar','m200','akgold','kn57']);
    assert.equal(r.bones,bones);assert.equal(r.meshes.length,id==='m200'?48:3);
    assert.ok(r.meshes.every(m=>m.map&&m.flipY===false),JSON.stringify(r.meshes));assert.ok(Math.abs(r.reload-reload)<1e-7);
    assert.equal(r.afterShot,mag-1);assert.equal(r.reloadState.clip,'reload');assert.equal(r.hidden,true);
    assert.ok(r.item?.inScene&&r.item.meshes>0,JSON.stringify(r.item));assert.equal(r.loopErrors,0);
    assert.deepEqual(r.audio.failed,[]);
  }
  assert.deepEqual(results.m200.reloadState.scheduled,[.08,.38,1.1,1.75]);
  for(const frame of [9,19,25])assert.ok(results.akgold.reloadState.scheduled.includes(Math.round(frame/34*2.71*1000)/1000));
  assert.ok(requests.some(u=>u.includes('/assets/local/m200/view.json')));
  assert.ok(requests.some(u=>u.includes('/assets/local/akgold/view.json')));
  assert.ok(!requests.some(u=>u.includes('/assets/preview/gamebanana-weapons/')),'formal gameplay must not request candidate paths');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log(JSON.stringify({results,sniperInputGrace,m200Cadence,formalRequests:requests.filter(u=>u.includes('/assets/local/m200/')||u.includes('/assets/local/akgold/')),errors,failed},null,2));
}finally{await browser.close();}
