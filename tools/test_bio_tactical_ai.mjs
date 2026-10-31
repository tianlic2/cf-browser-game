// Run with: node --experimental-default-type=module tools/test_bio_tactical_ai.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attackSlotCandidates, chooseAttackSlot, chooseIntent, combatPositionScore,
  createDirector, directorProfile, humanRole, localAvoidanceVector, recoveryStage,
  seededTraits, updateDirector, zombieRole, zombieTargetScore } from '../scripts/bio_ai.js';

const results=[];
function check(name,fn){try{fn();results.push(['PASS',name]);}catch(error){results.push(['FAIL',name,error.message]);}}

check('human squad receives complementary roles',()=>{
  assert.deepEqual(Array.from({length:5},(_,i)=>humanRole(i,5)),
    ['anchor','support','scout','rear_guard','anchor']);
});
check('zombie roles rotate at each assault',()=>{
  assert.notEqual(zombieRole(0,0),zombieRole(0,1));
  assert.equal(new Set(Array.from({length:4},(_,i)=>zombieRole(i,0))).size,4);
});
check('personalities are stable but not identical',()=>{
  assert.deepEqual(seededTraits(2,'human'),seededTraits(2,'human'));
  assert.notDeepEqual(seededTraits(1,'human'),seededTraits(2,'human'));
});
check('intent hysteresis prevents ordinary dithering',()=>{
  assert.equal(chooseIntent('hold',.4,{hold:.5,engage:.9,evade:0}),'hold');
  assert.equal(chooseIntent('hold',.4,{hold:.5,engage:.6,evade:1.2}),'evade');
});
check('zombies cannot target without sight, sound, or memory',()=>{
  assert.equal(zombieTargetScore({distance:4,visible:false,heard:false,memory:0,
    load:0,persistent:0,isolated:1,reloading:1,role:'opportunist'}),Infinity);
});
check('opportunists prefer an isolated reloading target',()=>{
  const base={distance:12,visible:true,heard:false,memory:0,load:0,persistent:0,role:'opportunist'};
  assert.ok(zombieTargetScore({...base,isolated:1,reloading:1})<
    zombieTargetScore({...base,isolated:0,reloading:0}));
});
check('director cycles through a real assault and recovery',()=>{
  const d=createDirector();let sawAssault=false,sawRecover=false;
  for(let i=0;i<80;i++){
    updateDirector(d,{nearestThreat:8,humansAlive:4,humansTotal:6,combatHeat:.7},.5);
    sawAssault ||= d.phase==='assault';sawRecover ||= d.phase==='recover';
  }
  assert.equal(sawAssault,true);assert.equal(sawRecover,true);assert.ok(d.serial>=1);
  assert.ok(directorProfile({phase:'assault'}).aggression>directorProfile({phase:'recover'}).aggression);
});
check('crowd steering separates an oncoming neighbor without reversing the goal',()=>{
  const result=localAvoidanceVector({position:{x:0,z:0},desired:{x:0,z:1},speed:4,
    sideBias:1,neighbors:[{x:0,z:1.1,vx:0,vz:-2,radius:.45}]});
  assert.ok(Math.abs(result.x)>.35,'agent must choose a visible side step');
  assert.ok(result.z>-.2,'avoidance must not blindly turn away from the route');
  assert.ok(result.pressure>.2);
});
check('attack slots are unique and preserve a valid previous lane',()=>{
  const reserved=new Set([0,1,2]);
  const slot=chooseAttackSlot({agent:{x:0,z:-4},target:{x:0,y:0,z:0},reserved,
    count:8,radius:1.27,preferredIndex:3,canOccupy:()=>true});
  assert.equal(slot.index,3);
  reserved.add(slot.index);
  const next=chooseAttackSlot({agent:{x:0,z:-4},target:{x:0,y:0,z:0},reserved,
    count:8,radius:1.27,preferredIndex:3,canOccupy:()=>true});
  assert.notEqual(next.index,slot.index);
  assert.equal(attackSlotCandidates({x:0,y:0,z:0},8,1.27).length,8);
});
check('stuck recovery escalates through side step, back-out and repath',()=>{
  assert.deepEqual([recoveryStage(.1),recoveryStage(.3),recoveryStage(.7),recoveryStage(1.2)],
    [0,1,2,3]);
});
check('combat positions reject blind firing and reward cover with separation',()=>{
  const base={pathCost:7,targetDistance:15,preferredDistance:15,visible:true,
    cover:0,crowd:0,danger:12,repeated:0,flank:.4};
  assert.ok(combatPositionScore({...base,cover:1})>combatPositionScore(base));
  assert.ok(combatPositionScore({...base,crowd:1})<combatPositionScore(base));
  assert.equal(combatPositionScore({...base,visible:false}),-Infinity);
});
check('integration exposes sensory memory, roles, and player gunshot noise',()=>{
  const bio=readFileSync(new URL('../scripts/bio_mode.js',import.meta.url),'utf8');
  const main=readFileSync(new URL('../scripts/main.js',import.meta.url),'utf8');
  assert.match(bio,/ZOMBIE_MEMORY_SECONDS/);
  assert.match(bio,/zombieTargetScore/);
  assert.match(bio,/packSightings/);
  assert.match(bio,/chooseIntent/);
  assert.match(bio,/_attackSlot\(z, chosen, targetMotion, attackReservations\)/);
  assert.match(bio,/_humanCombatGoal\(h,q,threatPositions,humanReservations\)/);
  assert.match(bio,/_friendInLineOfFire\(h,q,aliveHumans\)/);
  assert.match(bio,/_recoverySteer\(z, vx, vz, 'zombie'\)/);
  assert.match(main,/bioMode\?\.onPlayerNoise\(player\.pos, 'shot'\)/);
  assert.doesNotMatch(bio,/for \(const t of targets\) \{\s*const d = Math\.hypot\(t\.pos\.x - p\.x/);
});

for(const row of results)console.log(row.join(' | '));
const failed=results.filter(r=>r[0]==='FAIL');
console.log(`bio tactical AI: ${results.length-failed.length}/${results.length} passed`);
if(failed.length)process.exitCode=1;
