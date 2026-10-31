// Run with: node --experimental-default-type=module tools/test_zone13_spatial_collision.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createZone13SpatialCollision } from '../scripts/zone13_collision.js';

const root = new URL('../assets/local/cf_bio_candidates/zone13/graybox/', import.meta.url);
const world = JSON.parse(readFileSync(new URL('zone13-graybox.json', root), 'utf8'));
const walk = JSON.parse(readFileSync(new URL('zone13-walkmesh.json', root), 'utf8'));
const bytes = readFileSync(new URL('zone13-graybox.bin', root));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const collision = createZone13SpatialCollision(world, buffer, walk.propColliders);

assert.ok(collision.stats.triangleCount > world.stats.triangles * .9 &&
  collision.stats.triangleCount <= world.stats.triangles,
  'the spatial index preserves authored BSP surfaces and discards only zero-area triangles');
assert.ok(collision.stats.wallCellCount > 100, 'vertical BSP walls are partitioned into local cells');

let sample = null;
for (const group of world.groups) {
  if (!group.vertexCount || sample) continue;
  const stride = group.strideFloats || 8;
  const packed = new Float32Array(buffer, group.byteOffset, group.byteLength / 4);
  for (let vertex = 0; vertex + 2 < group.vertexCount; vertex += 3) {
    const offsets = [vertex * stride, (vertex + 1) * stride, (vertex + 2) * stride];
    const points = offsets.map((offset) => [packed[offset], packed[offset + 1], packed[offset + 2]]);
    const [a, b, c] = points;
    const e1 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    const e2 = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    const normal = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
    const length = Math.hypot(...normal);
    const verticalSpan = Math.max(...points.map(p=>p[1])) - Math.min(...points.map(p=>p[1]));
    const horizontal = Math.hypot(normal[0], normal[2]);
    if (length > 1e-5 && Math.abs(normal[1]/length) < .3 && verticalSpan > 1.5 && horizontal > 1e-5) {
      const center = points.reduce((sum,p)=>sum.map((value,i)=>value+p[i]/3),[0,0,0]);
      sample = { center, nx: normal[0]/horizontal, nz: normal[2]/horizontal };
      break;
    }
  }
}
assert.ok(sample, 'the source map contains a tall wall suitable for collision validation');
const start = { x: sample.center[0] - sample.nx * .8, y: sample.center[1] - 1.2, z: sample.center[2] - sample.nz * .8 };
const end = { x: sample.center[0] + sample.nx * .8, y: sample.center[1] - 1.2, z: sample.center[2] + sample.nz * .8 };
assert.equal(collision.lineClear(start, end), false, 'a line crossing an authored BSP wall is blocked');
assert.equal(collision.lineClear({x: 200,y: 0,z: 200}, {x: 202,y: 0,z: 202}), true,
  'an empty segment outside the map remains clear');
assert.ok(collision.stats.maxCandidates < world.stats.triangles / 4,
  'short queries inspect a local triangle subset instead of the full BSP');

let sampledFloors = 0;
for (const group of world.groups) {
  if (!group.vertexCount) continue;
  const stride = group.strideFloats || 8;
  const packed = new Float32Array(buffer, group.byteOffset, group.byteLength / 4);
  for (let vertex = 0; vertex + 2 < group.vertexCount; vertex += 3) {
    const offsets = [vertex, vertex + 1, vertex + 2].map((index) => index * stride);
    const points = offsets.map((at) => [packed[at], packed[at + 1], packed[at + 2]]);
    const [a, b, c] = points;
    const e1 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    const e2 = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    const normalY = e1[2]*e2[0]-e1[0]*e2[2];
    const normalLength = Math.hypot(e1[1]*e2[2]-e1[2]*e2[1], normalY,
      e1[0]*e2[1]-e1[1]*e2[0]);
    if (normalLength < 1e-6 || Math.abs(normalY / normalLength) < .72) continue;
    const center = points.reduce((sum, point) => sum.map((value, index) =>
      value + point[index] / 3), [0, 0, 0]);
    const landed = collision.landingSurfaceAt(center[0], center[2], center[1] + .08, .02);
    assert.ok(Number.isFinite(landed) && landed >= center[1] - .035,
      `horizontal BSP surface at ${center.map((n) => n.toFixed(2)).join(',')} is landable`);
    sampledFloors++;
  }
}
assert.ok(sampledFloors > 1000,
  `the full map landing audit covers the ${sampledFloors} near-horizontal BSP triangles`);

collision.resetStats();
for (let i = 0; i < 200; i++) collision.blocksMovement(start.x, start.z, end.x, end.z, start.y, .38);
assert.equal(collision.stats.movementQueries, 200);
assert.ok(collision.stats.triangleTests < world.stats.triangles * 10,
  '200 movement checks stay well below even ten full-map scans');

function syntheticCollision(triangles) {
  const stride = 8;
  const packed = new Float32Array(triangles.flatMap((triangle) => triangle.flatMap((p) =>
    [p[0], p[1], p[2], 0, 1, 0, 0, 0])));
  return createZone13SpatialCollision({ groups: [{ vertexCount: packed.length / stride,
    strideFloats: stride, byteOffset: 0, byteLength: packed.byteLength }] }, packed.buffer);
}
const quadX = (x, y0, y1, z0 = -2, z1 = 2) => [
  [[x,y0,z0],[x,y1,z0],[x,y1,z1]], [[x,y0,z0],[x,y1,z1],[x,y0,z1]],
];
const quadY = (y, x0 = -.8, x1 = 1.8, z0 = -1, z1 = 1) => [
  [[x0,y,z0],[x1,y,z1],[x1,y,z0]], [[x0,y,z0],[x0,y,z1],[x1,y,z1]],
];
const curb = syntheticCollision(quadX(1, 0, .45));
assert.equal(curb.blocksMovement(0, 0, 2, 0, 0, .38, .46, 1.72), false,
  'a Source-height curb is crossed as a grounded step');
assert.equal(curb.blocksMovement(0, 0, 2, 0, 0, .38, 0, 1.72), true,
  'the same curb remains solid against an airborne capsule below its top');

const windowCollision = syntheticCollision([
  ...quadX(1, 0, .82), ...quadX(1, 2.04, 3.2), ...quadY(1.25),
]);
assert.equal(windowCollision.blocksMovement(0, 0, 2, 0, .88, .38, 0, 1.12), false,
  'a jump-duck hull passes between the window sill and lintel');
assert.equal(windowCollision.blocksMovement(0, 0, 2, 0, .88, .38, 0, 1.78), true,
  'the standing hull still collides with the same lintel');
assert.equal(windowCollision.hasVerticalClearance(0, 0, 0, 1.12, .38), true,
  'the crouched hull fits below a low ceiling');
assert.equal(windowCollision.hasVerticalClearance(0, 0, 0, 1.78, .38), false,
  'standing up below that ceiling is rejected');

const thinFloor = syntheticCollision(quadY(1.25));
assert.ok(Math.abs(thinFloor.landingSurfaceAt(.2, 0, 2.4, .38) - 1.25) < 1e-6,
  'a descending foot finds a thin BSP platform even when it is absent from NAV');
const propTop = createZone13SpatialCollision({ groups: [] }, new ArrayBuffer(0),
  [{ x: 0, z: 0, y0: 0, h: 1.1, hx: .7, hz: .5, yaw: Math.PI / 4 }]);
assert.ok(Math.abs(propTop.landingSurfaceAt(0, 0, 2, .38) - 1.1) < 1e-6,
  'a descending foot finds the top of a rotated static prop collider');
assert.ok(Math.abs(propTop.supportSurfaceAt(0, 0, 1.12, .38) - 1.1) < 1e-6,
  'a prop top remains persistent support after the landing frame');

const crateTop = syntheticCollision([
  ...quadY(1.05, -.7, .7, -.7, .7), ...quadX(-.7, 0, 1.05, -.7, .7),
  ...quadX(.7, 0, 1.05, -.7, .7),
]);
assert.ok(Math.abs(crateTop.supportSurfaceAt(0, 0, 1.08, .38) - 1.05) < 1e-6,
  'a visible BSP crate top omitted from NAV remains valid standing support');

// Real-map second-floor opening near NAV area 813: at jump height the crouch
// hull clears the opening while the standing hull meets the upper frame.
const upperWindowArea = walk.areas.find((area) => area.id === 813);
assert.ok(upperWindowArea, 'the authored second-floor window approach remains in the NAV data');
const [windowX, windowFloor, windowZ] = upperWindowArea.corners.reduce((sum, point) =>
  sum.map((value, index) => value + point[index] / 4), [0, 0, 0]);
const windowYaw = 23 * Math.PI / 180;
const windowFeet = windowFloor + .85;
const windowEndX = windowX + Math.cos(windowYaw) * 1.15;
const windowEndZ = windowZ + Math.sin(windowYaw) * 1.15;
assert.equal(collision.blocksMovement(windowX, windowZ, windowEndX, windowEndZ,
  windowFeet, .38, 0, 1.12), false, 'the real second-floor opening accepts jump-duck');
assert.equal(collision.blocksMovement(windowX, windowZ, windowEndX, windowEndZ,
  windowFeet, .38, 0, 1.78), true, 'the same opening still rejects a standing jump');

console.log(`PASS: Zone 13 spatial collision indexed ${collision.stats.triangleCount} triangles in ` +
  `${collision.stats.allCellCount} cells; audited ${sampledFloors} floor triangles; ` +
  `200 sweeps used ${collision.stats.triangleTests} triangle tests.`);
