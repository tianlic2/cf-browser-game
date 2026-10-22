import assert from 'node:assert/strict';
import { brushContainsPoint, canMoveThroughBrushes, intersectsBrush } from '../scripts/brush_collision.js';
import { lingyinLayout } from '../scripts/lingyin_layout.js';

const map = lingyinLayout();
assert.ok(map.colliders.every(c => Number.isFinite(c.h) && c.h > c.y0),
  'every solid must have a finite top above its base');
const blocked = (x, z, feet = 0) => map.colliders.some(c =>
  intersectsBrush(c, x, z, feet, .36, .5, 1.78, map.colliders, map.surfaceAt));

// Both scenic exits have visible physical barriers, while the five temple
// rooms retain a usable centre aisle. A former gate wall blocked this aisle.
assert.ok(blocked(27.5, 28), 'closed bridge doors must stop the player');
assert.equal(blocked(-2, 45.7, .88), false,
  'the north terrace opens over the visible gate staircase');
assert.equal(blocked(6, 45.7), false,
  'the removed gate-side timber fence leaves no invisible barrier');
assert.equal(blocked(-35.5,7,.98),false,'west gate must be open at the raised hall passage');
assert.ok(blocked(-35.5,14),'west perimeter stays solid outside the new gate');
assert.equal(blocked(0, 42.9, 1.05), false, 'gate room centre remains open');
assert.equal(blocked(.35, 42.9, 1.05), false,
  'gate front must not have the former invisible wide wall stubs');
for (let z=48;z>32;z-=.25) {
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
assert.ok(blocked(-6.3,42,1.05)&&blocked(2.3,42,1.05),
  'closed timber side bays have matching collision');
assert.ok(blocked(-10.5,47,.38)&&blocked(7.5,45.5,.64),
  'new tree trunks are physical obstacles beside the open stair');
for(const [x,z] of [[-23.8,58],[19.8,58],[-2,74.3]])
  assert.ok(blocked(x,z),'the outer air wall stays inside the visible boundary grove');
assert.equal(blocked(-2,58),false,'the centre of the outer flagstone court remains open');

// Visible props are solid where they are drawn, without their old phantom
// blockers near the main-hall steps and the middle of the courtyard.
for (const x of [-10.5, 6.5])
  assert.ok(blocked(x, 41.5), 'stone lion is solid at its visible location');
assert.equal(blocked(-10.5, -1.2), false, 'old lion air wall is gone');
assert.ok(blocked(7.5, 33), 'stone stele is solid');
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
assert.equal(blocked(-2, -2.05, .88), false,
  'the central main-hall stair opening is clear');
assert.ok(blocked(-10, -2.05), 'main-hall side rail is solid');
assert.ok(blocked(-14.5, -3), 'main-hall perimeter column is solid');
assert.ok(blocked(-14.8, -10, 1.05), 'main-hall side wall is solid');
assert.equal(blocked(-2,-10.25,1.35),false,
  'the removed Buddha must leave no invisible block in the centre aisle');
assert.ok(blocked(-2,-13.7,1.35),
  'the new altar has a matching solid combat proxy');
assert.ok(blocked(-2,-16.7,1.35),
  'the three-figure dais has a matching solid combat proxy');

console.log(`Lingyin alignment: ${map.colliders.length} visible-matched brushes, exits and rooms checked`);
