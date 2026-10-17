// Usage: node --experimental-default-type=module tools/audit_goldsrc_collision.mjs <asset-id> [max-height] [sample-step]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brushSupportIsExposed, brushTop, intersectsBrush } from '../scripts/brush_collision.js';
import { GOLDSRC_COLLISION_SURFACE_MODE, prepareGoldsrcCollision } from '../scripts/goldsrc_surface.js';

const assetId=process.argv[2];
if(!assetId)throw new Error('usage: audit_goldsrc_collision.mjs <asset-id> [max-height] [sample-step]');
const maxHeight=Number(process.argv[3]??20);
const sampleStep=Number(process.argv[4]??1.2);
assert.ok(Number.isFinite(maxHeight)&&Number.isFinite(sampleStep)&&sampleStep>0);

const base=new URL(`../assets/classic/${assetId}/`,import.meta.url);
const map=JSON.parse(readFileSync(new URL('map.json',base),'utf8'));
const binary=readFileSync(new URL('map.bin',base));
assert.equal(map.collisionSurfaceMode,GOLDSRC_COLLISION_SURFACE_MODE,
  'imported map must declare visible-mesh collision support');
assert.ok(map.colliders.length&&map.colliders.every(c=>c.localStep===true),
  'every imported GoldSrc convex leaf must use local/exposed step handling');
const arrayBuffer=binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength);
const {surfaceAt,blockerAt}=prepareGoldsrcCollision(map,arrayBuffer);

let candidates=0,hiddenInternalTops=0,collisionVisualMismatches=0;
let walkableSamples=0,phantomHorizontalBlockers=0,visibleHorizontalBlockers=0;
for(let x=-map.bounds.hw;x<=map.bounds.hw;x+=sampleStep)
  for(let z=-map.bounds.hl;z<=map.bounds.hl;z+=sampleStep)
    for(const collider of map.colliders) {
      const top=brushTop(collider,x,z);
      if(!Number.isFinite(top)||top>maxHeight)continue;
      candidates++;
      if(!brushSupportIsExposed(map.colliders,collider,x,z,top)) {
        hiddenInternalTops++;
        continue;
      }
      const visible=surfaceAt(x,z,top+.08);
      if(!Number.isFinite(visible)||Math.abs(visible-top)>.08)collisionVisualMismatches++;
    }

for(let x=-map.bounds.hw;x<=map.bounds.hw;x+=sampleStep)
  for(let z=-map.bounds.hl;z<=map.bounds.hl;z+=sampleStep) {
    const feet=surfaceAt(x,z,maxHeight);
    if(!Number.isFinite(feet))continue;
    walkableSamples++;
    const oldBlocked=map.colliders.some(c=>intersectsBrush(c,x,z,feet,.45,.52,1.78,
      map.colliders,surfaceAt));
    const newBlocked=map.colliders.some(c=>intersectsBrush(c,x,z,feet,.45,.52,1.78,
      map.colliders,surfaceAt,blockerAt));
    if(oldBlocked&&!newBlocked)phantomHorizontalBlockers++;
    if(newBlocked)visibleHorizontalBlockers++;
  }

let spawnCount=0;
for(const spawns of Object.values(map.spawns||{}))for(const [x,y,z] of spawns) {
  spawnCount++;
  const visible=surfaceAt(x,z,y+.55);
  assert.ok(Number.isFinite(visible)&&Math.abs(visible-y)<=.03,
    `spawn at ${x},${y},${z} does not align with a rendered floor`);
}
assert.ok(candidates>0&&spawnCount>0,'audit requires collision samples and spawns');
assert.ok(visibleHorizontalBlockers>0,
  'visible wall index must retain real horizontal blockers');
console.log(`PASS: ${map.name} GoldSrc collision contract — ${map.colliders.length} leaves, `+
  `${hiddenInternalTops}/${candidates} sampled internal caps rejected, `+
  `${collisionVisualMismatches} exposed collision caps delegated to visible mesh, `+
  `${phantomHorizontalBlockers} phantom horizontal blockers removed, `+
  `${visibleHorizontalBlockers}/${walkableSamples} visible-wall samples retained, `+
  `${spawnCount} spawns aligned`);
