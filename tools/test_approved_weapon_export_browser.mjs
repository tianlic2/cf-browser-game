import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});
 await page.goto('http://127.0.0.1:8123/?debug&debugMode=training&debugMap=transport&debugAutoStart=1&debugNoEnemies=1&qa=export-20261029');
 await page.waitForFunction(()=>window.__tactical?.ready()&&__tactical.admittedView('kn57')?.bones?.length===94,null,{timeout:120000});await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
 const result=await page.evaluate(()=>{
  const t=__tactical;t.pause();const packs=[];
  for(const bp of [0,3,4,6,7]){t.switchBackpack(bp);t.clearSwitch();const id=t.curId();const v={bp,id,ammo:t.getAmmo(),stats:t.weaponStats(id),tracer:t.playerTracerEnabled(),head:t.headshotDamage(id,.5),inacc:{...t.activeWeaponConfig().inacc},reset:t.activeWeaponConfig().recoilReset,hold:t.activeWeaponConfig().punchHold,pattern:t.activeWeaponConfig().pattern.slice(0,3)};
   const before=t.impactFx().tracers;t.owned[id].state.nextFireAt=0;t.forceFire();v.afterAmmo=t.getAmmo().mag;v.traceDelta=t.impactFx().tracers-before;packs.push(v);
  }
  t.switchBackpack(7);t.clearSwitch();const before=t.impactFx().tracers;const save=t.enemyManager.enemies,oldRandom=Math.random;Math.random=()=>.99;let emitted=false;
  try{for(const [x,z] of [[0,2],[2,0],[0,-2],[-2,0]]){
    const eye=t.player.pos.clone().add(new t.THREE.Vector3(0,t.EYE,0)),from=eye.clone().add(new t.THREE.Vector3(x,0,z));
    const e={wantShoot:true,dead:false,blindT:0,eyeline:from,onShot:()=>true,recoil(){},muzzleWorld(out){return out.copy(from)},gunId:'ak',damage:1};t.enemyManager.enemies=[e];t.enemiesShoot();
    if(t.impactFx().tracers>before){emitted=true;break;}
   }}finally{Math.random=oldRandom;t.enemyManager.enemies=save}
  return {packs,enemyTracer:emitted,errors:t.loopErrors()};
 });
 for(const x of result.packs){assert.equal(x.afterAmmo,x.ammo.mag-1,`backpack ${x.bp} still fires`);assert.equal(x.traceDelta,x.bp===0?1:0,`backpack ${x.bp} tracer`);assert.equal(x.tracer,x.bp===0);}
 const kn=result.packs.at(-1);assert.equal(kn.ammo.mag,70);assert.equal(kn.ammo.reserve,210);assert.equal(kn.stats.dmg,500);assert.equal(kn.head,1000);
 assert.equal(kn.inacc.stand,.0173);assert.equal(kn.inacc.crouch,.0036);assert.equal(kn.inacc.fire,.0303);assert.equal(kn.hold,.25);assert.deepEqual(kn.pattern[1],[.0714,.918]);
 const iron=result.packs.find(x=>x.bp===3),gold=result.packs.find(x=>x.bp===6);assert.equal(iron.inacc.stand,.0313);assert.equal(iron.inacc.fire,.0198);assert.equal(gold.inacc.stand,.0248);assert.equal(gold.inacc.fire,.0174);assert.equal(gold.reset,.68);
 assert.ok(result.enemyTracer,'enemy shots still create visible tracer while player tracer is disabled');assert.equal(result.errors,0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log(JSON.stringify(result));
}finally{await browser.close()}
