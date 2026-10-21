import assert from 'node:assert/strict';
import { GroundNavigation } from '../scripts/navigation.js';
import { canMoveThroughBrushes } from '../scripts/brush_collision.js';
import { lingyinLayout } from '../scripts/lingyin_layout.js';
import { RIDGE_LOOKOUTS, RIDGE_SURFACE_LIFT, RIDGE_TRAILS, WEST_RIDGE_TRAIL,
  ridgeGuardSections, ridgeRouteFrames } from '../scripts/lingyin_hillside_route.js';

const map=lingyinLayout();
assert.ok(map.bounds.hw>=80&&map.bounds.hl>=68,'mountain lies inside playable bounds');
assert.ok(Math.abs(map.surfaceAt(-2,45.7,1.5)-.64)<.01,
  'the gate staircase leads through the terrace opening');
assert.ok(map.surfaceAt(-2,47.2,.52)!==null,'stairs meet the graded trail');
assert.ok(Math.abs(map.surfaceAt(-35.5,7,1.5)-(.95+RIDGE_SURFACE_LIFT))<.02,
  'the west hall bridge continues through its perimeter gate');

// The continuous mitered strip must have exactly one cross-section at each
// authored bend; rail bays on that strip stop at the lookout deck entrance.
for(const [routeIndex,route] of RIDGE_TRAILS.entries()) {
  const frames=ridgeRouteFrames(route);
  for(const corner of route)assert.equal(frames.filter(p=>
    Math.hypot(p.x-corner[0],p.z-corner[1])<1e-5).length,1,
    'each bend has one shared paving cross-section');
  for(const section of ridgeGuardSections(routeIndex)) {
    assert.ok(section.points.length>1&&
      section.points.at(-1).along-section.points[0].along>2,
      'no isolated fence post or tiny stray bay');
    for(let i=0;i<section.points.length-1;i++) {
      const a=section.points[i],b=section.points[i+1];
      const x=(a.x+b.x)/2,z=(a.z+b.z)/2;
      assert.ok(RIDGE_LOOKOUTS.every(p=>
        Math.abs(x-p.x)>=p.hx+.3||Math.abs(z-p.z)>=p.hz+.3),
        'no stray guard crosses an overlook platform');
    }
  }
}

// The west hall is a real passage rather than a decorative door: a full
// capsule must cross its front bay, rear bay, stone link and western gate.
for(let x=-18.2;x>-38;x-=.25) {
  const y=map.surfaceAt(x,7,2),next=map.surfaceAt(x-.25,7,2);
  assert.ok(Number.isFinite(y)&&Number.isFinite(next),`west passage support at ${x}`);
  assert.ok(canMoveThroughBrushes(map.colliders,x,7,x-.25,7,y,.45,.52,1.78,map.surfaceAt),
    `west temple doorway and mountain approach stay open at ${x}`);
}

for(const route of RIDGE_TRAILS) {
  for(let i=0;i<route.length-1;i++) {
    const a=route[i],b=route[i+1];
    const distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const steps=Math.ceil(distance/.35);
    for(let j=0;j<steps;j++) {
      const t=j/steps,u=(j+1)/steps;
      const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      const nx=a[0]+(b[0]-a[0])*u,nz=a[1]+(b[1]-a[1])*u;
      const feet=map.surfaceAt(x,z,30),next=map.surfaceAt(nx,nz,30);
      assert.ok(Number.isFinite(feet)&&Number.isFinite(next),'graded path has support');
      assert.ok(Math.abs(next-feet)<=.52,`no oversized step near ${x.toFixed(1)},${z.toFixed(1)}`);
      assert.ok(canMoveThroughBrushes(map.colliders,x,z,nx,nz,feet,.45,.52,1.78,map.surfaceAt),
        `full-size capsule can follow the mountain path at ${x.toFixed(1)},${z.toFixed(1)}`);
    }
  }
}

const nav=new GroundNavigation(map.colliders,map.bounds,{
  maxHeight:map.navigationMaxHeight,step:map.navigationStep,climb:map.stepHeight,
  surfaceAt:map.surfaceAt,surfacesAt:map.surfacesAt,
});
for(const spawn of [map.spawns.player[0],map.spawns.enemy[0]]) {
  nav.update({x:spawn[0],y:spawn[1],z:spawn[2]});
  for(const p of RIDGE_LOOKOUTS) {
    const node=nav.nearest(p.x,p.z,p.y);
    assert.ok(node>=0&&nav.distance[node]>0,
      `both teams can reach lookout ${p.x},${p.z}`);
  }
  const westEntry=WEST_RIDGE_TRAIL[3];
  const westNode=nav.nearest(westEntry[0],westEntry[1],westEntry[2]);
  assert.ok(westNode>=0&&nav.distance[westNode]>0,
    'the west ascent joins the same reachable mountain network');
}
console.log(`Lingyin hillside: ${RIDGE_TRAILS.length} routes, ${RIDGE_LOOKOUTS.length} lookouts, ${nav.points.length} nav nodes`);
