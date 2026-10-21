import assert from 'node:assert/strict';
import {chooseDistributedSpawnIndex} from '../scripts/distributed_spawns.js';
import {lingyinLayout} from '../scripts/lingyin_layout.js';

const points=[
  [0,0,0,'court'],[24,0,0,'hall'],[0,0,25,'hill'],[26,0,26,'lookout'],
];
const live={pos:{x:0,y:0,z:0}};
for(const roll of [0,.25,.5,.75,.999]) {
  const index=chooseDistributedSpawnIndex(points,[live],null,()=>roll,11);
  assert.notEqual(index,0,'do not respawn beside a live opponent');
}
assert.equal(chooseDistributedSpawnIndex(points,[live],'hall',()=>0,11),2,
  'the next life rotates away from the previous zone when safe alternatives exist');
assert.equal(chooseDistributedSpawnIndex(points,[{...live,dead:true}],null,()=>0,11),0,
  'dead opponents do not reserve their former position');
const crowded=[{pos:{x:0,z:0}},{pos:{x:24,z:0}},{pos:{x:0,z:25}}];
assert.equal(chooseDistributedSpawnIndex(points,crowded,null,()=>0,40),3,
  'if no point meets the ideal gap, choose among the farthest sites');
assert.equal(chooseDistributedSpawnIndex([],[],null,()=>0),-1);
const map=lingyinLayout();
assert.equal(map.spawnSafeDistance,18);
for(const playerIndex of [0,9,20,28,35]) {
  const p=map.spawns.player[playerIndex];
  const opponent={pos:{x:p[0],y:p[1],z:p[2]}};
  for(const roll of [0,.2,.4,.6,.8,.999]) {
    const index=chooseDistributedSpawnIndex(map.spawns.enemy,[opponent],null,
      ()=>roll,map.spawnSafeDistance);
    const enemy=map.spawns.enemy[index];
    assert.ok(Math.hypot(enemy[0]-p[0],enemy[2]-p[2])>=18,
      'a Lingyin NPC can spawn in another sector away from the player');
  }
}
console.log('Distributed spawns: opponent distance, zone rotation and crowded fallback pass');
