// Run with: node --experimental-default-type=module tools/test_blacktown_map.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { GroundNavigation } from '../scripts/navigation.js';
import { brushSupport, brushSupportIsExposed, intersectsBrush } from '../scripts/brush_collision.js';
import { GOLDSRC_COLLISION_SURFACE_MODE, prepareGoldsrcCollision } from '../scripts/goldsrc_surface.js';
import { readChunkedMap } from './read_chunked_asset.mjs';

const base = new URL('../assets/classic/blacktown/', import.meta.url);
const { map, binary } = readChunkedMap(base);
const binaryArrayBuffer = binary.buffer.slice(binary.byteOffset,
  binary.byteOffset + binary.byteLength);
const generatedLocalStep=map.colliders.every(c=>c.localStep===true);
const { surfaceAt, surfacesAt, blockerAt } = prepareGoldsrcCollision(map, binaryArrayBuffer);

assert.equal(map.name, '黑色城镇');
assert.equal(map.source, 'goldsrc-de-blackwidow');
assert.equal(map.collisionSurfaceMode,GOLDSRC_COLLISION_SURFACE_MODE);
assert.ok(generatedLocalStep,
  'every imported GoldSrc collider opts into local/exposed step handling');
assert.ok(map.bounds.hw > 66 && map.bounds.hl > 66,
  'Black Town keeps the requested uniform 1.2x gameplay scale');
assert.equal(map.spawns.player.length, 16, 'all sixteen original CT spawns were imported');
assert.equal(map.spawns.enemy.length, 16, 'all sixteen original T spawns were imported');
assert.equal(map.spawnYaws.player.length, 16, 'all original CT facing angles were imported');
assert.equal(map.spawnYaws.enemy.length, 16, 'all original T facing angles were imported');
assert.ok(map.spawnYaws.player.every(Number.isFinite) && map.spawnYaws.enemy.every(Number.isFinite),
  'spawn facing angles are finite');
assert.equal(map.parts.length, 84, 'all embedded BSP texture batches were imported');
assert.ok(map.colliders.length >= 1400, 'GoldSrc BSP solid leaves became convex collision cells');
assert.ok(map.topdown.length >= 900, 'radar received the authored floor and roof layout');
assert.deepEqual(map.missingSourceSprites, [], 'the source package has no missing sprite dependency');

let end = 0;
for (const part of map.parts) {
  assert.ok(part.count > 0 && part.count % 3 === 0, 'every mesh part contains triangles');
  assert.ok(Number.isInteger(part.offset) && part.offset >= end, 'mesh offsets are ordered');
  end = part.offset + part.count * 7 * 4;
  if (part.material.map)
    assert.ok(existsSync(new URL(part.material.map, base)), `texture exists: ${part.material.map}`);
}
assert.equal(end, binary.byteLength, 'map.bin exactly matches the declared mesh ranges');
assert.ok(statSync(new URL('lightmap.png', base)).size > 100_000, 'baked RGB lightmap is present');
for (const face of ['up', 'dn', 'ft', 'bk', 'lf', 'rt'])
  assert.ok(existsSync(new URL(map.sky[face], base)), `skybox ${face} face exists`);

for (const collider of map.colliders) {
  for (const key of ['x', 'z', 'hx', 'hz', 'h', 'y0'])
    assert.ok(Number.isFinite(collider[key]), `collider ${key} is finite`);
  assert.ok(collider.hx > 0 && collider.hz > 0 && collider.h > collider.y0);
  assert.ok(collider.planes.length >= 6);
  assert.ok(collider.planes.every(plane => plane.length === 4 && plane.every(Number.isFinite)));
}

for (const [team, spawns] of Object.entries(map.spawns)) {
  for (const [x, y, z] of spawns) {
    assert.ok(Math.abs(x) < map.bounds.hw && Math.abs(z) < map.bounds.hl,
      `${team} spawn is inside map bounds`);
    assert.ok(!map.colliders.some(c => intersectsBrush(c, x, z, y, .45, .52, 1.78,
      map.colliders, surfaceAt, blockerAt)),
      `${team} spawn has player-sized clearance`);
    const support = Math.max(...map.colliders.map(c => [brushSupport(c, x, z), c])
      .filter(([height, c]) => Number.isFinite(height) && height <= y + .52 &&
        brushSupportIsExposed(map.colliders, c, x, z, height)).map(([height]) => height));
    assert.ok(Number.isFinite(support) && Math.abs(support - y) <= .52,
      `${team} spawn has reachable floor support`);
    const visibleSupport=surfaceAt(x,z,y+.52);
    assert.ok(Number.isFinite(visibleSupport)&&Math.abs(visibleSupport-y)<=.03,
      `${team} spawn feet align with the rendered floor`);
  }
}

const navigation = new GroundNavigation(map.colliders, map.bounds,
  { maxHeight: 20, step: .85, climb: .56, surfaceAt, surfacesAt, blockerAt });
assert.ok(navigation.points.length > 10_000,
  'navigation samples the enlarged urban arena without hidden internal BSP floors');
for (const point of navigation.points) {
  const visibleSupport=surfaceAt(point.x,point.z,point.y+.02);
  assert.ok(Number.isFinite(visibleSupport)&&Math.abs(visibleSupport-point.y)<.03,
    'every navigation node is aligned to a rendered walkable triangle');
}
for (const goal of [map.spawns.player[0], map.spawns.enemy[0]]) {
  navigation.update({ x: goal[0], y: goal[1], z: goal[2] });
  for (const [team, spawns] of Object.entries(map.spawns)) {
    for (const [x, y, z] of spawns) {
      const node = navigation.nearest(x, z, y);
      assert.ok(node >= 0 && navigation.distance[node] >= 0,
        `${team} spawn can route across the map`);
    }
  }
}

console.log(`PASS: GoldSrc de_blackwidow TDM import — ${map.parts.length} parts, ` +
  `${map.colliders.length} collision cells, ${navigation.points.length} navigation nodes, 32 spawns`);
