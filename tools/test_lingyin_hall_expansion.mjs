import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAIN_HALL,MAIN_HALL_FLOOR_Y,MAIN_HALL_RAISE,MAIN_HALL_SCALE,
  MAIN_HALL_STAIRS,mainHallPoint,mainHallStair} from '../scripts/lingyin_main_hall.js';
import {SMALL_HALLS} from '../scripts/lingyin_small_halls.js';
import {lingyinLayout} from '../scripts/lingyin_layout.js';
import {canMoveThroughBrushes,intersectsBrush} from '../scripts/brush_collision.js';
const map=lingyinLayout();
assert.equal(MAIN_HALL.w*MAIN_HALL.d,756);
assert.equal(MAIN_HALL.z,-26);assert.ok(MAIN_HALL.z-MAIN_HALL.d/2-2>-46);
assert.deepEqual(SMALL_HALLS.map(s=>s.name),['west','east']);
assert.equal(map.spawns.player.some(s=>s[3]==='rear-hall'),false);
assert.equal(map.surfaceAt(-2,-41,.1),0,'removed rear-hall platform cannot leave an invisible floor');
assert.equal(map.surfaceAt(-2,-5,.1),0,'the old main-hall front court is now open ground');
const blocked=(x,z,y)=>map.colliders.some(c=>intersectsBrush(c,x,z,y,.45,.52,1.78,map.colliders,map.surfaceAt));
assert.equal(blocked(-2,-5,0),false,'no former main-hall solid remains in the courtyard');
const altar=mainHallPoint(0,-2.06),dais=mainHallPoint(0,-4.72);
assert.equal(MAIN_HALL_RAISE,1);assert.equal(MAIN_HALL_FLOOR_Y,2.35);
assert.equal(MAIN_HALL_STAIRS.count,12);
assert.ok(blocked(altar.x,altar.z,MAIN_HALL_FLOOR_Y));
assert.ok(blocked(dais.x,dais.z,MAIN_HALL_FLOOR_Y));
const treads=map.colliders.filter(c=>c.name==='main-hall-grand-stair-tread');
const rails=map.colliders.filter(c=>c.name==='main-hall-grand-stair-rail');
assert.equal(treads.length,MAIN_HALL_STAIRS.count);
assert.equal(rails.length,MAIN_HALL_STAIRS.count*2);
for(let i=0;i<treads.length;i++){
 const step=mainHallStair(i),tread=treads[i];
 assert.ok(Math.abs(tread.z-(MAIN_HALL.z+step.z))<1e-6);
 assert.ok(Math.abs(tread.h-step.top)<1e-6);
}
// Follow the actual stairs rather than teleporting onto the higher floor.
let y=0;
// Enter through the actual central door, then use the clear lane beside the
// now-solid incense vessel instead of requiring movement through that prop.
const path=[[-2,-8],[-2,-23],[-3.6,-23],[-3.6,-27]];
for(let i=1;i<path.length;i++){
 const a=path[i-1],b=path[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.1);
 let x=a[0],z=a[1];
 for(let j=1;j<=steps;j++){
  const nx=a[0]+(b[0]-a[0])*j/steps,nz=a[1]+(b[1]-a[1])*j/steps;
  const next=map.surfaceAt(nx,nz,y+.52);
  assert.ok(next!==null&&next-y<=.52,'continuous staircase and interior floor');
  assert.ok(canMoveThroughBrushes(map.colliders,x,z,nx,nz,y,.45,.52,1.78,map.surfaceAt),`entry blocked at ${x},${z}`);
  y=next;x=nx;z=nz;
 }
}
assert.ok(Math.abs(y-MAIN_HALL_FLOOR_Y)<1e-6);
assert.equal(MAIN_HALL_SCALE.x,31.5/27);assert.equal(MAIN_HALL_SCALE.z,24/17);
const temple=readFileSync(new URL('../lingyin-map/src/world/temple.ts',import.meta.url),'utf8');
assert.doesNotMatch(temple,/this\.buildHall\([^\n]*name: 'rear'/,'rear hall visual is removed');
const interior=readFileSync(new URL('../lingyin-map/src/world/main_hall_study.ts',import.meta.url),'utf8');
assert.match(interior,/pivot\.scale\.set\(1\/sx,1,1\/sz\)/,'Buddhas/halos/censer keep their original proportions');
assert.match(interior,/floorMat\.vertexColors=false/,'photo floor cannot inherit nonexistent shell vertex colours');
console.log('Hall expansion passed: 756m² shell, raised 1m on a 12-tread grand stair, shared interior/collision and continuous access');
