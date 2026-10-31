import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 for(const scenario of [{map:'bio',query:'debugMap=bio'},{map:'pyramid',query:'debugMap=pyramid&debugMode=bio'}]){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});
  await page.goto(`http://127.0.0.1:8123/?debug=bio-eight&${scenario.query}&debugAutoStart=1`);
  await page.waitForFunction(()=>window.__tactical?.bioMode?.phase==='prepare',null,{timeout:120000});
  await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
  const result=await page.evaluate(()=>{
   const t=__tactical,m=t.bioMode,player=t.player,rounds=[];t.pause();const oldRandom=Math.random;
   try {
    for(const seed of [17,29,51]){
      m.start(m.map,player);let state=seed;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
      m._chooseMother(player);
      rounds.push({phase:m.phase,playerZombie:m.playerZombie,health:player.hp,alive:m.humans.filter(h=>h.alive).length,zombies:m.zombies.length,names:m.zombies.map(z=>z.name),hp:m.zombies.map(z=>z.health),multiplier:m.humanDamageMultiplier});
    }
    Math.random=oldRandom;const [a,b]=m.zombies;
    a.takeDamage(10000);const first={kills:m.kills,mult:m.humanDamageMultiplier};m.onZombieDeath(a);const duplicate={kills:m.kills,mult:m.humanDamageMultiplier};
    b.takeDamage(1000);const sharedHit=b.health;b.takeDamage(20000);const second={kills:m.kills,mult:m.humanDamageMultiplier};
    m.update(0,player,0);const afterUpdate=m.humanDamageMultiplier;
    const respawn=m._respawnZombie(a),zombieHp=a.health;
    m.playerZombie=true;m.playerOut=false;player.hp=10000;const playerDeath=m.killPlayerZombie(player),playerDuplicate=m.killPlayerZombie(player);
    const third={kills:m.kills,mult:m.humanDamageMultiplier};const playerRespawn=m._respawnPlayerZombie(player),playerZombieHp=player.hp;
    m.start(m.map,player);const reset={kills:m.kills,mult:m.humanDamageMultiplier,playerZombie:m.playerZombie};
    return {rounds,first,duplicate,sharedHit,second,afterUpdate,respawn,zombieHp,playerDeath,playerDuplicate,third,playerRespawn,playerZombieHp,reset,loopErrors:t.loopErrors()};
   }finally{Math.random=oldRandom}
  });
  for(const r of result.rounds){assert.equal(r.phase,'live');assert.equal(r.playerZombie,false);assert.equal(r.health,1000);assert.equal(r.alive,4);assert.equal(r.zombies,8);assert.equal(new Set(r.names).size,8);assert.ok(r.hp.every(h=>h===10000));assert.equal(r.multiplier,1)}
  assert.ok(new Set(result.rounds.map(r=>r.names.join(','))).size>1,'different random seeds yield different selections');
  assert.deepEqual(result.first,{kills:1,mult:1.1});assert.deepEqual(result.duplicate,result.first);assert.equal(result.sharedHit,8900);assert.equal(result.second.kills,2);assert.ok(Math.abs(result.second.mult-1.2)<1e-10);assert.equal(result.afterUpdate,result.second.mult);
  assert.equal(result.respawn,true);assert.equal(result.zombieHp,10000);assert.equal(result.playerDeath,true);assert.equal(result.playerDuplicate,false);assert.equal(result.third.kills,3);assert.ok(Math.abs(result.third.mult-1.3)<1e-10);assert.equal(result.playerRespawn,true);assert.equal(result.playerZombieHp,10000);assert.deepEqual(result.reset,{kills:0,mult:1,playerZombie:false});assert.equal(result.loopErrors,0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log(`PASS ${scenario.map}`,JSON.stringify(result));await page.close();
 }
}finally{await browser.close()}
