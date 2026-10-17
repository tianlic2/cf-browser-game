// Run with: node --experimental-default-type=module tools/test_survivor_map.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { GroundNavigation } from '../scripts/navigation.js';
import { brushSupport, brushSupportIsExposed, brushTop, intersectsBrush } from '../scripts/brush_collision.js';
import { GOLDSRC_COLLISION_SURFACE_MODE, prepareGoldsrcCollision } from '../scripts/goldsrc_surface.js';
import { readChunkedMap } from './read_chunked_asset.mjs';

const base = new URL('../assets/classic/survivor/', import.meta.url);
const { map, binary } = readChunkedMap(base);
const binaryArrayBuffer = binary.buffer.slice(binary.byteOffset,
  binary.byteOffset + binary.byteLength);
const generatedLocalStep=map.colliders.every(c=>c.localStep===true);
const { surfaceAt, surfacesAt, blockerAt } = prepareGoldsrcCollision(map, binaryArrayBuffer);

assert.equal(map.name, '雪地求生');
assert.equal(map.source, 'goldsrc-de-survivor');
assert.equal(map.collisionSurfaceMode,GOLDSRC_COLLISION_SURFACE_MODE);
assert.ok(generatedLocalStep,
  'every imported GoldSrc collider opts into local/exposed step handling');
assert.equal(map.spawns.player.length, 10, 'all ten original CT spawns were imported');
assert.equal(map.spawns.enemy.length, 10, 'all ten original T spawns were imported');
assert.ok(map.parts.length >= 100, 'brush and GoldSrc MDL materials were imported');
assert.ok(map.parts.filter(part => part.material.unlit).length >= 20,
  'external scenery models are present, not just the BSP shell');
assert.ok(map.colliders.length >= 1000, 'GoldSrc BSP solid leaves became convex collision cells');
assert.ok(map.topdown.length >= 500, 'radar received the visible floor/roof layout');
assert.deepEqual(map.missingSourceSprites.sort(),
  ['3dmflaora.spr', '3dmflared.spr', 'flare1.spr', 'snow.spr'].sort());

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
    const support = Math.max(...map.colliders.map(c => brushSupport(c, x, z))
      .filter(height => Number.isFinite(height) && height <= y + .52));
    assert.ok(Number.isFinite(support) && Math.abs(support - y) <= .52,
      `${team} spawn has reachable floor support`);
    const visibleSupport=surfaceAt(x,z,y+.52);
    assert.ok(Number.isFinite(visibleSupport)&&Math.abs(visibleSupport-y)<=.03,
      `${team} spawn feet align with the rendered snow/floor surface`);
  }
}

let hiddenInternalTops=0;
for(let x=-map.bounds.hw;x<=map.bounds.hw;x+=1.2)
  for(let z=-map.bounds.hl;z<=map.bounds.hl;z+=1.2)
    for(const collider of map.colliders) {
      const top=brushTop(collider,x,z);
      if(Number.isFinite(top)&&top<=9&&
          !brushSupportIsExposed(map.colliders,collider,x,z,top))hiddenInternalTops++;
    }
assert.ok(hiddenInternalTops>5_000,
  'the real snowy BSP fixture contains hidden leaf caps that must not support actors');

const navigation = new GroundNavigation(map.colliders, map.bounds,
  { maxHeight: 9, step: .9, climb: .52, surfaceAt, surfacesAt, blockerAt });
assert.ok(navigation.points.length > 5_000, 'navigation samples the visible snowy arena');
for(const point of navigation.points) {
  const visibleSupport=surfaceAt(point.x,point.z,point.y+.02);
  assert.ok(Number.isFinite(visibleSupport)&&Math.abs(visibleSupport-point.y)<.03,
    'every snowy navigation node is aligned to a rendered walkable triangle');
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

console.log(`PASS: GoldSrc de_survivor TDM import — ${map.parts.length} parts, ` +
  `${map.colliders.length} collision cells, ${hiddenInternalTops} hidden tops rejected, ` +
  `${navigation.points.length} visible navigation nodes, 20 spawns`);
