// Run with: node tools/test_prison_map.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GroundNavigation } from '../scripts/navigation.js';
import { brushSupport, brushTop } from '../scripts/brush_collision.js';
import { expandPrisonLayout } from '../scripts/prison_scale.js';
import { preservePrisonTexelScale } from '../scripts/prison_uv.js';

const base = new URL('../assets/classic/prison/', import.meta.url);
const source = JSON.parse(readFileSync(new URL('map.json', base)));
const map = expandPrisonLayout(source);
const binary = readFileSync(new URL('map.bin', base));
assert.equal(map.horizontalScale, 2);
assert.equal(map.verticalScale, 1.3);
assert.equal(map.bounds.hw, source.bounds.hw * 2);
assert.equal(map.bounds.hl, source.bounds.hl * 2);
assert.equal(map.floorY, source.floorY * 1.3);
for (const team of Object.keys(source.spawns)) {
  for (let i = 0; i < source.spawns[team].length; i++) {
    const before = source.spawns[team][i];
    const after = map.spawns[team][i];
    assert.deepEqual(after, [before[0] * 2, before[1] * 1.3, before[2] * 2],
      `${team} spawn scales with the map on all axes`);
  }
}
for (let i = 0; i < source.colliders.length; i++) {
  const before = source.colliders[i];
  const after = map.colliders[i];
  for (const key of ['x', 'z', 'hx', 'hz'])
    assert.equal(after[key], before[key] * 2, `collider ${i} ${key}`);
  assert.equal(after.h, before.h * 1.3, `collider ${i} height`);
  if (before.y0 !== undefined) assert.equal(after.y0, before.y0 * 1.3, `collider ${i} base height`);
  for (let j = 0; j < (before.planes || []).length; j++) {
    const a = before.planes[j], b = after.planes[j];
    assert.ok(Math.abs(b[0] - a[0] / 2) < 1e-9, `collider ${i} plane ${j} x`);
    assert.ok(Math.abs(b[1] - a[1] / 1.3) < 1e-9, `collider ${i} plane ${j} y`);
    assert.ok(Math.abs(b[2] - a[2] / 2) < 1e-9, `collider ${i} plane ${j} z`);
    assert.equal(b[3], a[3], `collider ${i} plane ${j} offset`);
  }
  const baseTop = brushTop(before, before.x, before.z);
  const scaledTop = brushTop(after, after.x, after.z);
  if (Number.isFinite(baseTop))
    assert.ok(Math.abs(scaledTop - baseTop * 1.3) < 1e-7,
      `collider ${i} support surface follows visual stretch`);
}
for (let i = 0; i < source.topdown.length; i++) {
  const before = source.topdown[i], after = map.topdown[i];
  for (const key of ['x', 'z', 'hx', 'hz'])
    assert.equal(after[key], before[key] * 2, `radar shape ${i} ${key}`);
  if (before.y0 !== undefined) assert.equal(after.y0, before.y0 * 1.3, `radar shape ${i} height`);
}
assert.equal(map.spawns.player.length, 12);
assert.equal(map.spawns.enemy.length, 12);
assert.ok(map.colliders.length > 200, 'BSP collision brushes were imported');
assert.ok(map.parts.length > 15, 'BSP materials and visible geometry were imported');
for (const part of map.parts) {
  assert.ok(part.count > 0 && part.count % 3 === 0, 'triangles are complete');
  const values = new Float32Array(binary.buffer, binary.byteOffset + part.offset, part.count * 7);
  assert.ok(values.every(Number.isFinite), 'map positions and UVs are finite');
  const adjusted = preservePrisonTexelScale(new Float32Array(values), 2, 1.3);
  assert.ok(adjusted.every(Number.isFinite), 'stretched texture UVs remain finite');
  for (let i = 0; i < values.length; i++)
    if (i % 7 !== 3 && i % 7 !== 4)
      assert.equal(adjusted[i], values[i], 'texture scaling leaves positions and baked lightmap UVs intact');
}
const wallUv = new Float32Array([
  0, 0, 0, 0, 0, .1, .2,
  1, 0, 0, 1, 0, .3, .2,
  0, 1, 0, 0, 1, .1, .4,
]);
preservePrisonTexelScale(wallUv, 2, 1.3);
assert.equal(wallUv[10], 2, 'horizontal brick repeat follows the 2x stretch');
assert.ok(Math.abs(wallUv[18] - 1.3) < 1e-6,
  'vertical brick repeat follows the 1.3x stretch');
for (const [team, points] of Object.entries(map.spawns)) {
  for (const [x, y, z] of points) {
    const support = Math.max(...map.colliders.map(c => brushSupport(c, x, z))
      .filter(h => h <= y + .5));
    assert.ok(Math.abs(support - y) <= .5, `${team} spawn has floor support`);
  }
}
const nav = new GroundNavigation(map.colliders, map.bounds,
  { maxHeight: 3.3 * map.verticalScale, step: .75, climb: .5 * map.verticalScale });
assert.equal(nav.climb, .65, 'vertical stair reach scales with geometry');
for (const goal of [map.spawns.player[0], map.spawns.enemy[0]]) {
  nav.update({ x: goal[0], y: goal[1], z: goal[2] });
  for (const [team, points] of Object.entries(map.spawns)) {
    for (const [x, y, z] of points)
      assert.ok(nav.distance[nav.nearest(x, z, y)] >= 0,
        `${team} spawn can route to the opposite end`);
  }
  assert.ok(nav.points.some((point, i) => point.y > 3.3 && nav.distance[i] >= 0),
    'upper-level floor remains reachable after the vertical stretch');
}
console.log('PASS: 2x horizontal and 1.3x vertical CF Prison layout, lightmap UVs, 24 supported spawns and cross-map navigation');
