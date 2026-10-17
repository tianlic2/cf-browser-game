// Run with: node --experimental-default-type=module tools/test_bio_tactical_ai.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chooseIntent, createDirector, directorProfile, humanRole, seededTraits,
  updateDirector, zombieRole, zombieTargetScore } from '../scripts/bio_ai.js';

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
check('integration exposes sensory memory, roles, and player gunshot noise',()=>{
  const bio=readFileSync(new URL('../scripts/bio_mode.js',import.meta.url),'utf8');
  const main=readFileSync(new URL('../scripts/main.js',import.meta.url),'utf8');
  assert.match(bio,/ZOMBIE_MEMORY_SECONDS/);
  assert.match(bio,/zombieTargetScore/);
  assert.match(bio,/packSightings/);
  assert.match(bio,/chooseIntent/);
  assert.match(main,/bioMode\?\.onPlayerNoise\(player\.pos, 'shot'\)/);
  assert.doesNotMatch(bio,/for \(const t of targets\) \{\s*const d = Math\.hypot\(t\.pos\.x - p\.x/);
});

for(const row of results)console.log(row.join(' | '));
const failed=results.filter(r=>r[0]==='FAIL');
console.log(`bio tactical AI: ${results.length-failed.length}/${results.length} passed`);
if(failed.length)process.exitCode=1;
