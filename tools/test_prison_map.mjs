// Run with: node tools/test_prison_map.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GroundNavigation } from '../scripts/navigation.js';
import { brushSupport, brushTop, intersectsBrush } from '../scripts/brush_collision.js';
import { expandPrisonLayout } from '../scripts/prison_scale.js';
import { preservePrisonTexelScale } from '../scripts/prison_uv.js';

const base = new URL('../assets/classic/prison/', import.meta.url);
const source = JSON.parse(readFileSync(new URL('map.json', base)));
const map = expandPrisonLayout(source);
const runtime = readFileSync(new URL('../scripts/prison_map.js', import.meta.url), 'utf8');
const HORIZONTAL = 1;
const VERTICAL = 1;
const binary = readFileSync(new URL('map.bin', base));
assert.match(runtime, /navigationStep:\s*\.45\b/, 'runtime uses a grid fine enough for source-width passages');
assert.doesNotMatch(runtime, /preservePrisonTexelScale/, 'runtime renders source texture coordinates unchanged');
assert.equal(map.horizontalScale, HORIZONTAL);
assert.equal(map.verticalScale, VERTICAL);
assert.equal(map.bounds.hw, source.bounds.hw * HORIZONTAL);
assert.equal(map.bounds.hl, source.bounds.hl * HORIZONTAL);
assert.equal(map.floorY, source.floorY * VERTICAL);
for (const team of Object.keys(source.spawns)) {
  for (let i = 0; i < source.spawns[team].length; i++) {
    const before = source.spawns[team][i];
    const after = map.spawns[team][i];
    assert.deepEqual(after, [before[0] * HORIZONTAL, before[1] * VERTICAL, before[2] * HORIZONTAL],
      `${team} spawn scales with the map on all axes`);
  }
}
for (let i = 0; i < source.colliders.length; i++) {
  const before = source.colliders[i];
  const after = map.colliders[i];
  for (const key of ['x', 'z', 'hx', 'hz'])
    assert.equal(after[key], before[key] * HORIZONTAL, `collider ${i} ${key}`);
  assert.equal(after.h, before.h * VERTICAL, `collider ${i} height`);
  if (before.y0 !== undefined) assert.equal(after.y0, before.y0 * VERTICAL, `collider ${i} base height`);
  for (let j = 0; j < (before.planes || []).length; j++) {
    const a = before.planes[j], b = after.planes[j];
    assert.ok(Math.abs(b[0] - a[0] / HORIZONTAL) < 1e-9, `collider ${i} plane ${j} x`);
    assert.ok(Math.abs(b[1] - a[1] / VERTICAL) < 1e-9, `collider ${i} plane ${j} y`);
    assert.ok(Math.abs(b[2] - a[2] / HORIZONTAL) < 1e-9, `collider ${i} plane ${j} z`);
    assert.equal(b[3], a[3], `collider ${i} plane ${j} offset`);
  }
  const baseTop = brushTop(before, before.x, before.z);
  const scaledTop = brushTop(after, after.x, after.z);
  if (Number.isFinite(baseTop))
    assert.ok(Math.abs(scaledTop - baseTop * VERTICAL) < 1e-7,
      `collider ${i} support surface follows visual stretch`);
}
for (let i = 0; i < source.topdown.length; i++) {
  const before = source.topdown[i], after = map.topdown[i];
  for (const key of ['x', 'z', 'hx', 'hz'])
    assert.equal(after[key], before[key] * HORIZONTAL, `radar shape ${i} ${key}`);
  if (before.y0 !== undefined) assert.equal(after.y0, before.y0 * VERTICAL, `radar shape ${i} height`);
}
assert.equal(map.spawns.player.length, 12);
assert.equal(map.spawns.enemy.length, 12);
assert.ok(map.colliders.length > 200, 'BSP collision brushes were imported');
assert.ok(map.parts.length > 15, 'BSP materials and visible geometry were imported');
for (const part of map.parts) {
  assert.ok(part.count > 0 && part.count % 3 === 0, 'triangles are complete');
  const values = new Float32Array(binary.buffer, binary.byteOffset + part.offset, part.count * 7);
  assert.ok(values.every(Number.isFinite), 'map positions and UVs are finite');
  const adjusted = preservePrisonTexelScale(new Float32Array(values), HORIZONTAL, VERTICAL);
  assert.deepEqual(adjusted, values, 'source dimensions leave position, diffuse UVs and lightmap UVs unchanged');
}
const wallUv = new Float32Array([
  0, 0, 0, 0, 0, .1, .2,
  1, 0, 0, 1, 0, .3, .2,
  0, 1, 0, 0, 1, .1, .4,
]);
preservePrisonTexelScale(wallUv, HORIZONTAL, VERTICAL);
assert.equal(wallUv[10], 1, 'source-width bricks retain source UVs');
assert.equal(wallUv[18], 1, 'source-height bricks retain source UVs');
for (const [team, points] of Object.entries(map.spawns)) {
  for (const [x, y, z] of points) {
    const support = Math.max(...map.colliders.map(c => brushSupport(c, x, z))
      .filter(h => h <= y + .5));
    assert.ok(Math.abs(support - y) <= .5, `${team} spawn has floor support`);
    assert.ok(!map.colliders.some(c => intersectsBrush(c, x, z, y, .45, .5, 1.78, map.colliders)),
      `${team} spawn remains clear for a full-size player capsule`);
  }
}
const nav = new GroundNavigation(map.colliders, map.bounds,
  { maxHeight: 3.3 * map.verticalScale, step: .45, climb: .5 * map.verticalScale });
assert.equal(nav.climb, .5, 'stairs retain the source-size climb threshold');
for (const goal of [map.spawns.player[0], map.spawns.enemy[0]]) {
  nav.update({ x: goal[0], y: goal[1], z: goal[2] });
  for (const [team, points] of Object.entries(map.spawns)) {
    for (const [x, y, z] of points)
      assert.ok(nav.distance[nav.nearest(x, z, y)] >= 0,
        `${team} spawn can route to the opposite end`);
  }
  assert.ok(nav.points.some((point, i) => point.y > 3 && nav.distance[i] >= 0),
    'source upper-level floor remains reachable');
}
console.log('PASS: original CF Prison dimensions and UVs, 24 supported spawns, cross-map and upper-level navigation');
