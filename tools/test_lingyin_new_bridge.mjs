import assert from 'node:assert/strict';
import {lingyinLayout} from '../scripts/lingyin_layout.js';
import {canMoveThroughBrushes,intersectsBrush} from '../scripts/brush_collision.js';
const map=lingyinLayout({approvedLandscape:true});
for(const z of [25,28,31]){
 let x=30,y=map.surfaceAt(x,z,1);assert.ok(Number.isFinite(y));
 while(x<42){const next=Math.min(42,x+.1),ny=map.surfaceAt(next,z,y+.52);assert.ok(Number.isFinite(ny),`missing footing at ${next},${z}`);assert.ok(Math.abs(ny-y)<.53);assert.ok(canMoveThroughBrushes(map.colliders,x,z,next,z,y,.45,.52,1.78,map.surfaceAt),`blocked at ${next},${z}`);x=next;y=ny;}
}
for(const z of [24.05,31.95]) assert.ok(map.colliders.some(c=>intersectsBrush(c,36,z,.66,.45,.52,1.78,map.colliders,map.surfaceAt)),`rail at ${z}`);
assert.ok(!map.colliders.some(c=>intersectsBrush(c,36,25.9,.66,.45,.52,1.78,map.colliders,map.surfaceAt)),'old bridge rail no longer blocks the widened deck');
assert.equal(map.surfaceAt(36,32.2,1),null);console.log('PASS: widened east bridge supports three lanes; both new rails block and old rails are gone.');
