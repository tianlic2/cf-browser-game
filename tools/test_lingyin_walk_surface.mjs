import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {intersectsBrush,canMoveThroughBrushes} from '../scripts/brush_collision.js';
import {GroundNavigation} from '../scripts/navigation.js';
import {lingyinLayout,railBeamBrush} from '../scripts/lingyin_layout.js';
import {RIDGE_TRAILS,RIDGE_LOOKOUTS,RIDGE_HALF_WIDTH,RIDGE_SURFACE_LIFT,ridgeRouteFrames,
  ridgeTrailSurfaceAt} from '../scripts/lingyin_hillside_route.js';
import {triangulatedWalkSurface} from '../scripts/lingyin_walk_surface.js';

// Use the real terrain height calculation that the visual road builds from.
const root=resolve(import.meta.dirname,'../lingyin-map');
const scratch=mkdtempSync(join(tmpdir(),'lingyin-road-test-'));
let heightAt,terrainRenderedHeightAt;
try {
  const file=join(scratch,'heightfield.mjs');
  execFileSync(join(root,'node_modules/.bin/rolldown'),[
    'src/world/heightfield.ts','-o',file,'-f','esm','-p','node',
  ],{cwd:root,stdio:'pipe'});
  ({heightAt,terrainRenderedHeightAt}=await import(pathToFileURL(file).href));
} finally {rmSync(scratch,{recursive:true,force:true});}

const positions=[],indices=[];
for(const route of RIDGE_TRAILS) {
  const frames=ridgeRouteFrames(route),base=positions.length/3;
  for(const [j,f] of frames.entries()) {
    for(const side of [-1,0,1]) {
      const x=f.x+f.nx*RIDGE_HALF_WIDTH*side,z=f.z+f.nz*RIDGE_HALF_WIDTH*side;
      positions.push(x,Math.max(heightAt(x,z)+RIDGE_SURFACE_LIFT,
        terrainRenderedHeightAt(x,z)+.055)-3.25,z);
    }
    if(j<frames.length-1) {
      const k=base+j*3;
      indices.push(k,k+1,k+3,k+1,k+4,k+3,
        k+1,k+2,k+4,k+2,k+5,k+4);
    }
  }
}
const position={getX:i=>positions[i*3],getY:i=>positions[i*3+1],
  getZ:i=>positions[i*3+2]};
const index={count:indices.length,getX:i=>indices[i]};
const exact=triangulatedWalkSurface({getAttribute:()=>position,getIndex:()=>index});
const map=lingyinLayout();
map.setTrailSurface(exact);
for(const spawn of map.spawns.player)assert.ok(
  map.surfacesAt(spawn[0],spawn[2],spawn[1]+.05)
    .some(y=>Math.abs(y-spawn[1])<.02),`distributed spawn rests on real paving: ${spawn}`);
let oldHole=0,oldHeightError=0,samples=0;
for(let i=0;i<indices.length;i+=3) {
  const a=indices[i],b=indices[i+1],c=indices[i+2];
  for(const w of [[1/3,1/3,1/3],[.72,.14,.14],[.14,.72,.14]]) {
    const x=w[0]*positions[a*3]+w[1]*positions[b*3]+w[2]*positions[c*3];
    const z=w[0]*positions[a*3+2]+w[1]*positions[b*3+2]+w[2]*positions[c*3+2];
    const y=w[0]*positions[a*3+1]+w[1]*positions[b*3+1]+w[2]*positions[c*3+1];
    assert.ok(exact(x,z).some(h=>Math.abs(h-y)<1e-3),
      `rendered paving is supported at ${x.toFixed(2)},${z.toFixed(2)}`);
    assert.ok(map.surfacesAt(x,z,y+.52).some(h=>Math.abs(h-y)<1e-3));
    assert.ok(map.canTraverse(x,z,y,.52),'visible road is legal to traverse');
    const old=ridgeTrailSurfaceAt(x,z);
    if(old===null)oldHole++;
    else if(Math.abs(old-y)>.25)oldHeightError++;
    samples++;
  }
}
assert.ok(oldHole>0&&oldHeightError>0,'audit must exercise the original defects');
assert.equal(map.canTraverse(-83,62,18,.52),false,
  'an unpaved cliff does not become a new invisible floor');
for(const route of RIDGE_TRAILS)for(let i=0;i<route.length-1;i++) {
  const a=route[i],b=route[i+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const steps=Math.ceil(length/.3);
  for(let j=0;j<steps;j++) {
    const t=j/steps,u=(j+1)/steps;
    const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    const nx=a[0]+(b[0]-a[0])*u,nz=a[1]+(b[1]-a[1])*u;
    const y=map.surfaceAt(x,z,30),next=map.surfaceAt(nx,nz,30);
    assert.ok(Number.isFinite(y)&&Number.isFinite(next));
    assert.ok(Math.abs(next-y)<=map.stepHeight,
      `road step at ${x.toFixed(2)},${z.toFixed(2)}`);
    assert.ok(canMoveThroughBrushes(map.colliders,x,z,nx,nz,y,.45,map.stepHeight,1.78,map.surfaceAt),
      `road capsule at ${x.toFixed(2)},${z.toFixed(2)}`);
  }
}
const nav=new GroundNavigation(map.colliders,map.bounds,{
  maxHeight:map.navigationMaxHeight,step:map.navigationStep,climb:map.stepHeight,
  surfaceAt:map.surfaceAt,surfacesAt:map.surfacesAt,
});
for(const spawn of [map.spawns.player[0],map.spawns.enemy[0]]) {
  nav.update({x:spawn[0],y:spawn[1],z:spawn[2]});
  for(const candidate of map.spawns.player) {
    const node=nav.nearest(candidate[0],candidate[2],candidate[1]);
    assert.ok(node>=0&&nav.distance[node]>=0,
      `distributed spawn reachable on rendered road: ${candidate}`);
  }
  for(const lookout of RIDGE_LOOKOUTS) {
    const node=nav.nearest(lookout.x,lookout.z,lookout.y);
    assert.ok(node>=0&&nav.distance[node]>0,
      `spawn ${spawn} cannot reach ${lookout.x},${lookout.z}: node ${node}, distance ${nav.distance[node]}`);
  }
}

// The old diagonal beam proxy blocked the full AABB corner. The new narrow
// oriented prism leaves that visibly empty space traversable, but stops an
// actor at the timber itself.
const diagonal=railBeamBrush({x:0,z:0,y:0},{x:1,z:1,y:0},1.03);
assert.equal(intersectsBrush(diagonal,.9,.1,0,.1,.52,1.78),false);
assert.equal(intersectsBrush(diagonal,.5,.5,0,.1,.52,1.78),true);
assert.equal(canMoveThroughBrushes([diagonal],.85,.05,.9,.1,0,.1,.52,1.78),true);

console.log(`Lingyin paving: ${samples} triangle samples, ${oldHole} old holes, ${oldHeightError} old height mismatches`);
