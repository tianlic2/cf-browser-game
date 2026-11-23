import assert from 'node:assert/strict';
import {closestBulletPass,enemyRoundProfile} from '../scripts/enemy_ballistics.js';
const p=(x,y=0,z=0)=>({x,y,z});
const near=closestBulletPass(p(0),p(80),p(40,.5),800);
assert(Math.abs(near.along-40)<1e-9&&near.distance===.5);
assert(Math.abs(near.delay-(.05+.5/343))<1e-9);
assert(near.before<=near.along&&near.after<=40);
assert.equal(closestBulletPass(p(0),p(30),p(15,4)),null,'distant miss is silent');
assert.equal(closestBulletPass(p(0),p(30),p(15,0)),null,'direct hit is not a flypast');
assert.equal(closestBulletPass(p(0),p(4),p(5,.4)),null,'wall before listener suppresses near-pass');
assert.equal(closestBulletPass(p(0),p(30),p(-2,.5)),null,'shot travelling away is silent');
const stopped=closestBulletPass(p(0),p(5.2),p(5,.4),800);
assert(stopped.after<.201,'moving sound never travels past the resolved impact');
const rotated=closestBulletPass(p(0),p(0,0,80),p(.5,0,40),800);
assert.equal(rotated.distance,near.distance);assert.equal(rotated.delay,near.delay);
for(const id of ['ak','cfv_m4a1','barrett','deagle']){
 const r=enemyRoundProfile(id);assert(r.speed>=330&&r.speed<=900);assert(r.segment<5&&r.radius<.006);
}
assert.equal(enemyRoundProfile('m4').speed,enemyRoundProfile('cfv_m4a1').speed);
console.log('PASS: clipped near-pass geometry, timing, direction, hit rejection, wall rejection and bounded motion.');
