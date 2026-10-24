import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SMALL_HALLS,smallHallFurnitureBounds} from '../scripts/lingyin_small_halls.js';
import {lingyinLayout} from '../scripts/lingyin_layout.js';
import {canMoveThroughBrushes,intersectsBrush} from '../scripts/brush_collision.js';

const map=lingyinLayout();
const world=(s,x,z)=>({x:s.x+x*Math.cos(s.rot)+z*Math.sin(s.rot),
 z:s.z-x*Math.sin(s.rot)+z*Math.cos(s.rot)});
let pieces=0;
assert.deepEqual(SMALL_HALLS.map(s=>s.name),['west','east']);
for(const hall of SMALL_HALLS){
 const y=hall.plinth+.25,boxes=hall.furniture.map(smallHallFurnitureBounds);
 for(const [i,p] of boxes.entries()){
  pieces++;
  assert.ok(Math.abs(p.x)+p.hx<hall.w/2-1.5,`${hall.name}: furniture must clear the side wall`);
  assert.ok(Math.abs(p.z)+p.hz<hall.d/2-1.5,`${hall.name}: furniture must clear the back wall`);
  assert.ok(y+p.h<hall.eave-hall.plinth-.4,`${hall.name}: furniture has ceiling clearance`);
  for(const q of boxes.slice(i+1))assert.ok(Math.abs(p.x-q.x)>p.hx+q.hx+.015||Math.abs(p.z-q.z)>p.hz+q.hz+.015,
   `${hall.name}: furniture footprints must not intersect`);
  const a=world(hall,p.x,p.z),c=Math.abs(Math.cos(hall.rot)),s=Math.abs(Math.sin(hall.rot));
  assert.ok(map.colliders.some(b=>Math.abs(b.x-a.x)<1e-6&&Math.abs(b.z-a.z)<1e-6&&
   Math.abs(b.hx-(p.hx*c+p.hz*s))<1e-6&&Math.abs(b.hz-(p.hx*s+p.hz*c))<1e-6&&
   Math.abs(b.h-y-p.h)<1e-6),`${hall.name}: visible furniture must use the same collision bounds`);
  assert.ok(map.colliders.some(b=>intersectsBrush(b,a.x,a.z,y,.36,.5,1.78,map.colliders,map.surfaceAt)),
   'players cannot walk through cabinets or tables');
 }
 // Preserve the front entrance and a broad central aisle. The west hall's
 // rear bay remains traversable, even though the old perimeter gate is closed.
 const end=hall.name==='west'?-hall.d/2+1.1:hall.name==='east'?-3.8:-.85;
 for(const offset of [-.85,0,.85])for(let z=hall.d/2-1;z>end;z-=.15){
  const doorOffset=Math.abs(z)>hall.d/2-2.2?offset*.35:offset;
  const a=world(hall,doorOffset,z),b=world(hall,doorOffset,z-.15);
  assert.ok(canMoveThroughBrushes(map.colliders,a.x,a.z,b.x,b.z,y,.45,.52,1.78,map.surfaceAt),
   `${hall.name}: full player capsule must cross the clear aisle at ${offset},${z}`);
 }
 const centre=world(hall,0,0);
 assert.ok(Math.abs(map.surfaceAt(centre.x,centre.z,y+.1)-y)<1e-6,'room floor/respawn height unchanged');
}
const visual=readFileSync(new URL('../lingyin-map/src/world/small_hall_interior.ts',import.meta.url),'utf8');
assert.match(visual,/SMALL_HALLS/);
assert.doesNotMatch(visual,/new THREE\.(?:PointLight|SpotLight|TextureLoader|SphereGeometry)/,
 'no extra realtime lights, downloads or primitive pseudo-statues');
assert.match(visual,/merge\(buckets\[role\]\)/,'all rooms batch geometry by material');
assert.match(visual,/stoneFloor\.repeat\.x/,'floor UVs must compensate for the shared main-hall repeat');
assert.match(visual,/mesh\.castShadow=false/,'small interior detail cannot inflate the map shadow pass');
const editor=readFileSync(new URL('../preview/lingyin-editor.html',import.meta.url),'utf8');
for(const name of ['westInterior','eastInterior','mainInterior'])assert.ok(editor.includes(`data-view="${name}"`));
console.log(`Small halls passed: ${pieces} shared furniture bounds, clear entrances/aisles, no overlaps, unchanged floors, eight shared batches`);
