import assert from 'node:assert/strict';
import { brushContainsPoint, canMoveThroughBrushes, intersectsBrush } from '../scripts/brush_collision.js';
import { lingyinLayout } from '../scripts/lingyin_layout.js';
import {MAIN_HALL,mainHallPoint} from '../scripts/lingyin_main_hall.js';

const map = lingyinLayout();
assert.ok(map.colliders.every(c => Number.isFinite(c.h) && c.h > c.y0),
  'every solid must have a finite top above its base');
const blocked = (x, z, feet = 0) => map.colliders.some(c =>
  intersectsBrush(c, x, z, feet, .36, .5, 1.78, map.colliders, map.surfaceAt));

for(const [x,z] of [[-35.5,-21.1],[-4,-47],[27.5,-12]])
  assert.ok(map.colliders.some(c=>Math.abs(c.x-x)<.01&&Math.abs(c.z-z)<1&&
    Math.abs(c.y0+.02)<.01&&Math.abs(c.h-3.76)<.01),
  'the ochre enclosure wall has a full-height matching combat proxy');

// The east bridge door is visibly open and physically traversable, while the
// swung leaves remain solid beside the route. The five temple rooms retain a
// usable centre aisle.
assert.equal(blocked(27.5, 28),false,'open east bridge bay must not stop the player');
assert.ok(blocked(29.68,23.4,.5),'the south swung timber leaf remains solid');
assert.ok(blocked(29.68,32.6,.5),'the north swung timber leaf remains solid');
let bridgeFeet=map.surfaceAt(26.8,28,1);
for(let x=26.8;x<42.8;x+=.2) {
  const nextX=Math.min(42.8,x+.2),nextFeet=map.surfaceAt(nextX,28,bridgeFeet+.52);
  assert.ok(Number.isFinite(nextFeet),`east bridge has continuous footing at x=${nextX.toFixed(2)}`);
  assert.ok(canMoveThroughBrushes(map.colliders,x,28,nextX,28,
    bridgeFeet,.45,.52,1.78,map.surfaceAt),
  `player can walk from the courtyard onto the east bridge at x=${x.toFixed(2)}`);
  bridgeFeet=nextFeet;
}
assert.equal(blocked(-2, 45.7, .88), false,
  'the north terrace opens over the visible gate staircase');
assert.equal(blocked(6, 45.75), true,
  'the visible gate-wing extension replaces the former low stone rail');
assert.equal(blocked(-35.5,7,.98),true,
  'the stone fence must close the old west gate for players, NPCs and bullets');
assert.equal(canMoveThroughBrushes(map.colliders,-35.2,7,-35.8,7,
  .98,.45,.52,1.78,map.surfaceAt),false,
  'a full-size player capsule cannot cross the closed west gate');
assert.ok(blocked(-35.5,14),'west perimeter stays solid outside the new gate');
assert.equal(blocked(0, 49.75, 1.05), false, 'relocated gate room centre remains open');
assert.equal(blocked(.35, 49.75, 1.05), false,
  'gate front must not have the former invisible wide wall stubs');
for (let z=55;z>38;z-=.25) {
  const here=map.surfaceAt(-2,z,20);
  const next=map.surfaceAt(-2,z-.25,20);
  assert.ok(Number.isFinite(here)&&Number.isFinite(next),
    `replacement gate and mountain approach have continuous footing at z=${z}`);
  assert.ok(canMoveThroughBrushes(map.colliders,-2,z,-2,z-.25,
    here,.45,.52,1.78,map.surfaceAt),
    `player can descend through the replacement gate at z=${z}`);
  assert.ok(canMoveThroughBrushes(map.colliders,-2,z-.25,-2,z,
    next,.45,.52,1.78,map.surfaceAt),
    `player can climb back through the replacement gate at z=${z}`);
}
assert.ok(blocked(-6.3,48.85,1.05)&&blocked(2.3,48.85,1.05),
  'closed timber side bays have matching collision');
assert.ok(blocked(-10.5,48.7,.38)&&blocked(7.5,48.7,.64),
  'new tree trunks are physical obstacles beside the open stair');
for(const [x,z] of [[-23.8,58],[19.8,58],[-2,74.3]])
  assert.ok(blocked(x,z),'the outer air wall stays inside the visible boundary grove');
assert.equal(blocked(-2,58),false,'the centre of the outer flagstone court remains open');

// Visible props are solid where they are drawn, without their old phantom
// blockers near the main-hall steps and the middle of the courtyard.
for (const x of [-10.5, 6.5])
  assert.ok(blocked(x, 41.5), 'stone lion is solid at its visible location');
assert.equal(blocked(-10.5, -1.2), false, 'old lion air wall is gone');
assert.ok(blocked(7.5, 36.5), 'stone stele is solid at its shifted visible location');
assert.ok(blocked(-14.8, 39.5) && blocked(10.6, 38.3),
  'gateward courtyard trees retain collision at their shifted trunks');
assert.ok(blocked(5, 10), 'visible eastern lantern is solid');
assert.equal(blocked(-7.5, 14), false, 'old lantern air wall is gone');
assert.equal(blocked(-2, 22), false, 'standing actors can pass between the censer legs');
assert.ok(blocked(-.275, 22), 'the east censer leg remains solid');
assert.ok(blocked(-2, 22, 3.15), 'censer lid must retain a solid hit proxy');
assert.equal(map.colliders.some(c => brushContainsPoint(c, -2, 1.6, 22)), false,
  'a chest-high shot can pass through the middle of the tripod');
for (let z = 24.5; z >= 19.5; z -= .05) {
  assert.ok(canMoveThroughBrushes(map.colliders, -2, z, -2, z - .05,
    0, .45, .52, 1.78, map.surfaceAt),
  `a full-size player capsule can cross the tripod at z=${z.toFixed(2)}`);
}

// The main stair gap is open, but its flanking stone rail and exposed columns
// stop actors from walking through solid architecture.
const railZ=MAIN_HALL.z+MAIN_HALL.d/2+1.45;
assert.equal(blocked(-2, railZ, .88), false,
  'the central main-hall stair opening is clear');
assert.ok(blocked(-10, railZ), 'main-hall side rail is solid');
assert.ok(blocked(MAIN_HALL.x-MAIN_HALL.w/2+1,MAIN_HALL.z+MAIN_HALL.d/2-.9,1.35), 'main-hall perimeter column is solid');
assert.ok(blocked(MAIN_HALL.x-MAIN_HALL.w/2+1.35,MAIN_HALL.z,1.35), 'main-hall side wall is solid');
assert.equal(blocked(-2,mainHallPoint(0,1.75).z,1.35),false,
  'the removed Buddha must leave no invisible block in the centre aisle');
assert.ok(blocked(-2,mainHallPoint(0,-1.7).z,1.35),
  'the new altar has a matching solid combat proxy');
assert.ok(blocked(-2,mainHallPoint(0,-4.7).z,1.35),
  'the three-figure dais has a matching solid combat proxy');

console.log(`Lingyin alignment: ${map.colliders.length} visible-matched brushes, exits and rooms checked`);
