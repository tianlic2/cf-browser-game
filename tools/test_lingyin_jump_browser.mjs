import assert from 'node:assert/strict';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/?debug=jump-regression&debugMap=lingyin&debugAutoStart=1&debugNoEnemies=1');
 await page.waitForFunction(()=>window.__tactical?.enemyManager.navigation,null,{timeout:120000});
 await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
 await page.evaluate(()=>{
  Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.getElementById('viewport')});
  document.dispatchEvent(new Event('pointerlockchange'));
 });
 const cases=await page.evaluate(()=>{
  const layout=__tactical.scene.getObjectByName('phase1-west-boardwalk-v3').userData.railLayout;
  const cases=[{name:'entry',x:-31.2,z:-20,yaw:0,dx:0,dz:-1},
   {name:'landing-turn',x:-31.2,z:-27,yaw:Math.PI/2,dx:-1,dz:0}];
  for(const i of [2,3,5,7,9])for(const reverse of (i===2?[false]:[false,true])){
   const s=layout.spans[i],len=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z),sign=reverse?-1:1;
   const dx=(s.b.x-s.a.x)/len*sign,dz=(s.b.z-s.a.z)/len*sign;
   cases.push({name:`span-${i}-${sign}`,x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2,
    yaw:Math.atan2(-dx,-dz),dx,dz});
  }
  return cases;
 });
 const results=[];
 for(const c of cases){
  await page.evaluate(c=>{
   const t=__tactical;t.pause();
   const y=t.enemyManager.navigation.surfaceAt(c.x,c.z,20);
   t.player.pos.set(c.x,y,c.z);t.player.vel.set(0,0,0);t.player.onGround=true;
   t.player.yaw=c.yaw;t.player.pitch=0;t.player.jumpBuf=0;t.player.coyote=0;t.player.stepLift=0;
   const token=window.__jumpToken=(window.__jumpToken||0)+1;window.__jumpFrames=[];
   const sample=()=>{if(window.__jumpToken!==token)return;
    __jumpFrames.push({p:t.player.pos.toArray(),ground:t.player.onGround,v:t.player.vel.y,ts:performance.now()});
    requestAnimationFrame(sample);};requestAnimationFrame(sample);t.resume();
  },c);
  await page.keyboard.down('w');await page.keyboard.down('Space');
  await page.waitForTimeout(1300);await page.keyboard.up('Space');await page.keyboard.up('w');
  const frames=await page.evaluate(()=>{__jumpToken++;__tactical.pause();return __jumpFrames});
  const first=frames[0].p,last=frames.at(-1).p;
  const hops=frames.slice(1).map((f,i)=>Math.hypot(f.p[0]-frames[i].p[0],f.p[2]-frames[i].p[2]));
  const result={name:c.name,maxHop:Math.max(...hops),progress:(last[0]-first[0])*c.dx+(last[2]-first[2])*c.dz,
   airborne:frames.filter(f=>!f.ground).length,start:first,end:last};results.push(result);
  assert.ok(result.maxHop<.75,`${c.name}: no AABB teleport or large recovery kick`);
  assert.ok(result.airborne>8,`${c.name}: real jumps, not upper-tread snap cancellation`);
  assert.ok(result.progress>1,`${c.name}: repeated jumps must not push the player back downhill`);
 }
 // Drop onto the long guard from above. A visible upper beam must catch the
 // feet, instead of swallowing them and triggering a sideways correction.
 const railLanding=await page.evaluate(async()=>{
  const t=__tactical,board=t.scene.getObjectByName('phase1-west-boardwalk-v3');
  const rail=board.userData.railLayout.rails.find(r=>Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z)>20);
  const x=(rail.a.x+rail.b.x)/2,z=(rail.a.z+rail.b.z)/2,y=(rail.a.y+rail.b.y)/2;
  t.player.pos.set(x,y+1.6,z);t.player.vel.set(0,0,0);t.player.onGround=false;t.player.jumpBuf=0;t.player.coyote=0;
  const expected=t.enemyManager.navigation.surfaceAt(x,z,y+1.3);t.resume();
  await new Promise(resolve=>setTimeout(resolve,900));t.pause();
  return {expected,position:t.player.pos.toArray(),x,z,ground:t.player.onGround};
 });
 assert.ok(Math.abs(railLanding.position[1]-railLanding.expected)<.02,'feet land on the visible guard top');
 assert.ok(Math.hypot(railLanding.position[0]-railLanding.x,railLanding.position[2]-railLanding.z)<.03,'guard landing does not kick the player sideways');
 assert.equal(railLanding.ground,true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({results,railLanding,errors},null,2));
}finally{await browser.close()}
