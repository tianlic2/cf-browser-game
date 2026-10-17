// Run with: node --experimental-default-type=module tools/test_blacktown_collision.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brushTop, brushSupportIsExposed, intersectsBrush, jumpVelocityForHeightScale,
  shouldSnapDownToSupport, preserveCameraAcrossGroundStep,
  decayGroundViewOffset } from '../scripts/brush_collision.js';
import { readChunkedMap } from './read_chunked_asset.mjs';

// A ramp-supporting solid with y <= x: at x=0 the authored top is y=0,
// while its global AABB reaches y=2.  The old global-c.h shortcut treated the
// space above the low end as a two-metre invisible wall.
const ramp = {
  x: 0, z: 0, hx: 2, hz: 2, y0: -2, h: 2,
  localStep: true,
  planes: [
    [1, 0, 0, 2], [-1, 0, 0, 2], [0, 0, 1, 2], [0, 0, -1, 2],
    [-1, 1, 0, 0], [0, -1, 0, 2],
  ],
};
assert.equal(brushTop(ramp, 0, 0), 0);
assert.equal(intersectsBrush(ramp, 0, 0, 0, .45, .52, 1.78), false,
  'the low end of a ramp is walkable instead of becoming an air wall');
assert.equal(intersectsBrush(ramp, 2.2, 0, 0, .45, .52, 1.78), true,
  'the same solid still blocks a capsule approaching its real side wall');

// BSP solid leaves tile one continuous solid. The lower leaf's top is not a
// floor when a second solid leaf occupies the space immediately above it.
const lowerLeaf = {
  x: 0, z: 0, hx: 1, hz: 1, y0: -.5, h: .48, localStep: true,
  planes: [[1,0,0,1],[-1,0,0,1],[0,0,1,1],[0,0,-1,1],[0,1,0,.48],[0,-1,0,.5]],
};
const upperLeaf = {
  x: 0, z: 0, hx: 1, hz: 1, y0: .48, h: .96, localStep: true,
  planes: [[1,0,0,1],[-1,0,0,1],[0,0,1,1],[0,0,-1,1],[0,1,0,.96],[0,-1,0,-.48]],
};
const stackedLeaves = [lowerLeaf, upperLeaf];
assert.equal(brushSupportIsExposed(stackedLeaves, lowerLeaf, 0, 0, .48), false,
  'a boundary inside the BSP solid union is never accepted as standing support');
assert.equal(brushSupportIsExposed(stackedLeaves, upperLeaf, 0, 0, .96), true,
  'the outside top of the complete solid union remains valid support');
assert.equal(stackedLeaves.some(c =>
  intersectsBrush(c, 0, 0, 0, .45, .56, 1.78, stackedLeaves)), true,
  'the solid union above a hidden internal boundary still blocks the actor');

const { map } = readChunkedMap(new URL('../assets/classic/blacktown/', import.meta.url));
let locallyWalkable = 0;
let falseBlocked = 0;
let legacyAirWalls = 0;
let hiddenInternalTops = 0;
const legacyIntersects = (c, x, z, feet, radius = .45, step = .56, height = 1.78) => {
  if (c.h <= feet + step || (c.y0 ?? 0) >= feet + height) return false;
  if (Math.abs(x - c.x) >= c.hx + radius || Math.abs(z - c.z) >= c.hz + radius) return false;
  const cy = feet + (step + height) * .5;
  const hy = (height - step) * .5;
  return c.planes.every(([nx, ny, nz, d]) =>
    nx * x + ny * cy + nz * z < d + radius * Math.hypot(nx, nz) + Math.abs(ny) * hy - 1e-5);
};
for (let x = -map.bounds.hw; x <= map.bounds.hw; x += .4) {
  for (let z = -map.bounds.hl; z <= map.bounds.hl; z += .4) {
    for (const collider of map.colliders) {
      const top = brushTop(collider, x, z);
      if (!Number.isFinite(top) || collider.h <= top + .56) continue;
      locallyWalkable++;
      if (legacyIntersects(collider, x, z, top)) legacyAirWalls++;
      if (intersectsBrush(collider, x, z, top, .45, .56, 1.78)) falseBlocked++;
      if (!brushSupportIsExposed(map.colliders, collider, x, z, top)) hiddenInternalTops++;
    }
  }
}
assert.ok(locallyWalkable >= 400,
  'the imported map contains enough multi-height ramp/stair collision samples');
assert.ok(legacyAirWalls >= 400,
  'the regression fixture reproduces the former global-top air-wall bug');
assert.equal(falseBlocked, 0,
  'no ramp/stair supporting solid blocks the standing actor above its local surface');
assert.ok(hiddenInternalTops >= 100,
  'the real map fixture contains hidden BSP leaf tops that must not support actors');

// Black Town was enlarged uniformly by 1.2x.  A 48-unit crate is therefore
// 1.46304m high: the global 7.5m/s jump (1.339m at gravity 21) cannot reach it,
// while the height-scaled jump can.  A 64-unit / 1.95072m crate remains too tall
// for a direct jump, so the authored small-box route still matters.
const gravity = 21;
const baseVelocity = 7.5;
const scaledVelocity = jumpVelocityForHeightScale(baseVelocity, 1.2);
const baseApex = baseVelocity ** 2 / (2 * gravity);
const scaledApex = scaledVelocity ** 2 / (2 * gravity);
assert.ok(baseApex < 1.46304 && scaledApex > 1.46304,
  '1.2x jump height restores direct access to authored 48-unit crates');
assert.ok(scaledApex < 1.95072,
  '64-unit crates still require the intended smaller-box route');

assert.equal(shouldSnapDownToSupport(true, -.3, 3.32232, 3.07848, .56), true,
  'a descending stair tread remains grounded instead of becoming a short fall');
assert.equal(shouldSnapDownToSupport(true, -.3, 3.32232, 2.5908, .56), false,
  'a real ledge larger than the step-down allowance still starts a fall');
assert.equal(shouldSnapDownToSupport(false, -3, 3.32232, 3.07848, .56), false,
  'airborne players are never magnetized to a nearby floor');
const downOffset = preserveCameraAcrossGroundStep(0, 3.07848 - 3.32232);
assert.ok(Math.abs(downOffset - .24384) < 1e-9,
  'descending one authored 8-unit tread preserves the pre-step camera height');
assert.ok(decayGroundViewOffset(downOffset, .05) < downOffset,
  'the downward-step camera offset converges smoothly back to zero');

console.log(`PASS: Black Town ramp/stair collision — ${legacyAirWalls} former air-wall samples removed, ` +
  `${hiddenInternalTops} hidden internal tops rejected, ${locallyWalkable} local-height samples remain walkable; ` +
  `scaled jump and step-down preserved`);
