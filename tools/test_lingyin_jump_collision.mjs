import assert from 'node:assert/strict';
import {railBeamBrush} from '../scripts/lingyin_layout.js';
import {intersectsBrush,brushHorizontalEscape,canMoveThroughBrushes,stairLandingSupport} from '../scripts/brush_collision.js';

let samples=0,oldMaximum=0,newMaximum=0;
for(const slope of [0,.2,.65])for(const angle of [.07,.45,.9,1.3])for(const side of [-1,1]){
 const a={x:-40,y:4.35,z:-27},length=39;
 const b={x:a.x+Math.sin(angle)*length,y:a.y+slope*length,z:a.z+Math.cos(angle)*length};
 const nx=-Math.cos(angle),nz=Math.sin(angle),mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;
 const c={...railBeamBrush(a,b,1.02),preciseEscape:true};
 const feet=(a.y+b.y)/2;
 for(const depth of [.002,.03,.12]){
  const x=mx+nx*side*(.53-depth),z=mz+nz*side*(.53-depth);
  assert.ok(intersectsBrush(c,x,z,feet,.45,0,1.78));
  const old=brushHorizontalEscape({...c,preciseEscape:false},x,z,.45,feet);
  const push=brushHorizontalEscape(c,x,z,.45,feet);
  oldMaximum=Math.max(oldMaximum,Math.hypot(old.x,old.z));
  newMaximum=Math.max(newMaximum,Math.hypot(push.x,push.z));
  assert.ok(Math.abs(Math.hypot(push.x,push.z)-depth)<.0001,'convex recovery is the real contact depth');
  assert.equal(intersectsBrush(c,x+push.x,z+push.z,feet,.45,0,1.78),false);
  assert.equal(canMoveThroughBrushes([c],x+push.x,z+push.z,x,z,feet,.45,0,1.78),false,
   'minimal recovery must not weaken the guard or allow re-entry');
  assert.equal(canMoveThroughBrushes([c],x,z,x-nx*side*.01,z-nz*side*.01,feet,.45,0,1.78),false,
   'already touching a diagonal guard cannot move deeper just because its AABB gets shallower');
  samples++;
 }
}
assert.ok(oldMaximum>5);assert.ok(newMaximum<.121);
const tread=(z,h)=>({x:0,z,hx:2,hz:.1335,y0:h-.24,h,stepSurface:true,
 planes:[[1,0,0,2],[-1,0,0,2],[0,0,1,z+.1335],[0,0,-1,-z+.1335],[0,1,0,h],[0,-1,0,.24-h]]});
const treads=[tread(0,1),tread(.267,1.174),tread(.534,1.348)];
assert.equal(stairLandingSupport(treads,0,0,1.2),1.174,'toe contact catches an actual tread before centre support');
assert.equal(stairLandingSupport(treads,0,0,1.1),1,'a higher stair cannot pull a rising actor upwards');
assert.equal(stairLandingSupport(treads,3,0,2),null,'contact patch cannot become an invisible floor outside the stairs');
assert.equal(stairLandingSupport(treads.map(t=>({...t,stepSurface:false})),0,0,2),null,'crates/guards/walls do not inherit stair landing');
console.log(`Lingyin jump collision: ${samples} sloped/diagonal guard contacts; old push ${oldMaximum.toFixed(2)}m, new <=${newMaximum.toFixed(3)}m; guard re-entry blocked`);
