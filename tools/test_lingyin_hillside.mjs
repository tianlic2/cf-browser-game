import assert from 'node:assert/strict';
import { GroundNavigation } from '../scripts/navigation.js';
import { canMoveThroughBrushes, intersectsBrush } from '../scripts/brush_collision.js';
import { lingyinLayout } from '../scripts/lingyin_layout.js';
import { FRONT_GATE_FORECOURT, RIDGE_LOOKOUTS, RIDGE_SURFACE_LIFT, RIDGE_TRAILS, WEST_RIDGE_TRAIL,
  ridgeGuardSections, ridgeRouteFrames } from '../scripts/lingyin_hillside_route.js';

const map=lingyinLayout();
assert.ok(map.bounds.hw>=80&&map.bounds.hl>=68,'mountain lies inside playable bounds');
assert.ok(Math.abs(map.surfaceAt(-2,45.7,1.5)-1.05)<.01,
  'the relocated gate floor crosses the former terrace opening');
assert.equal(RIDGE_TRAILS.length,1,'only the west-gate mountain route remains');
assert.equal(RIDGE_TRAILS[0],WEST_RIDGE_TRAIL);
assert.equal(RIDGE_LOOKOUTS.length,1,'the west ascent ends at one pavilion terrace');
const pavilion=RIDGE_LOOKOUTS[0];
assert.equal(pavilion.entrySide,'east','the final trail enters the pavilion from its east edge');
assert.deepEqual(WEST_RIDGE_TRAIL.at(-1).slice(0,2),[pavilion.entryX,pavilion.entryZ],
  'the visible stone road terminates exactly at the pavilion opening');
for(const [x,z] of [[-2,58],[10,67]])
  assert.ok(map.surfacesAt(x,z,.52).includes(FRONT_GATE_FORECOURT.y),
    'the former front climb is a level supported forecourt');
assert.equal(map.surfaceAt(-20,58,.52),FRONT_GATE_FORECOURT.y,
  'the removed front hillside is replaced by the same level forecourt');
for(const [x,z] of [[-23.2,58],[19.2,58],[-2,73.7]]) {
  assert.equal(map.surfaceAt(x,z,.52),FRONT_GATE_FORECOURT.y,
    'every visible outer paving edge has level walk support');
  assert.ok(map.canTraverse(x,z,0,.52),
    'outer paving never becomes a grounded-movement air wall');
}
for(let x=-23.2;x<18.8;x+=.25)
  assert.ok(canMoveThroughBrushes(map.colliders,x,58,x+.25,58,
    0,.45,.52,1.78,map.surfaceAt),`outer paving is laterally open at x=${x}`);
// The relocated gate occupies z≈40..54; the open forecourt begins beyond its
// front stair and stays level to the outer boundary.
for(let z=54.5;z<73.5;z+=.25)
  assert.ok(canMoveThroughBrushes(map.colliders,-2,z,-2,z+.25,
    map.surfaceAt(-2,z,.52),.45,.52,1.78,map.surfaceAt),
  `outer paving is continuously walkable without jumping at z=${z}`);
for(const [x,z] of [[-23.8,58],[19.8,58],[-2,74.3]])
  assert.equal(canMoveThroughBrushes(map.colliders,-2,58,x,z,
    0,.45,.52,1.78,map.surfaceAt),false,
  'the dense tree line has a continuous movement boundary');
assert.ok(Math.abs(map.surfaceAt(-35.5,7,1.5)-(.95+RIDGE_SURFACE_LIFT))<.02,
  'the old west gate retains grounded scenery behind its closing fence');

// The continuous mitered strip must have exactly one cross-section at each
// authored bend; only the west-gate route contributes paving and rails.
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

let maxGrade=0;
for(let i=0;i<WEST_RIDGE_TRAIL.length-1;i++) {
  const a=WEST_RIDGE_TRAIL[i],b=WEST_RIDGE_TRAIL[i+1];
  const grade=Math.abs(b[2]-a[2])/Math.hypot(b[0]-a[0],b[1]-a[1]);
  maxGrade=Math.max(maxGrade,grade);
}
assert.ok(maxGrade<=.185,`west ascent remains a walkable gentle grade (${maxGrade})`);

for(let x=pavilion.entryX;x>=pavilion.entryX-1.4;x-=.25) {
  const feet=map.surfaceAt(x,pavilion.entryZ,30);
  const next=map.surfaceAt(x-.25,pavilion.entryZ,30);
  assert.ok(Number.isFinite(feet)&&Number.isFinite(next),
    `pavilion entry has continuous support at x=${x}`);
  assert.ok(canMoveThroughBrushes(map.colliders,x,pavilion.entryZ,x-.25,pavilion.entryZ,
    feet,.45,.52,1.78,map.surfaceAt),
  `pavilion entry has no rail air wall at x=${x}`);
}
const blocked=(x,z,feet=pavilion.y)=>map.colliders.some(c=>
  intersectsBrush(c,x,z,feet,.36,.5,1.78,map.colliders,map.surfaceAt));
assert.equal(blocked(pavilion.x,pavilion.z),false,
  'the pavilion centre remains open and usable');
const columnAngle=Math.PI/8;
assert.equal(blocked(pavilion.x+Math.cos(columnAngle)*2.9,
  pavilion.z-.45+Math.sin(columnAngle)*2.9),true,
  'a visible pavilion column has matching collision');

// The hall and stone link remain grounded, but the old west perimeter gate is
// intentionally closed by a matching stone fence.
for(let x=-18.2;x>-34.45;x-=.25) {
  const y=map.surfaceAt(x,7,2),next=map.surfaceAt(x-.25,7,2);
  assert.ok(Number.isFinite(y)&&Number.isFinite(next),`west passage support at ${x}`);
  assert.ok(canMoveThroughBrushes(map.colliders,x,7,x-.25,7,y,.45,.52,1.78,map.surfaceAt),
    `west hall remains usable up to the closing fence at ${x}`);
}
assert.equal(canMoveThroughBrushes(map.colliders,-35.2,7,-35.8,7,
  .98,.45,.52,1.78,map.surfaceAt),false,
  'the old west-gate fence separates the temple from the retired ascent');

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
    assert.ok(node>=0&&nav.distance[node]<0,
      `the retired lookout ${p.x},${p.z} stays outside the closed combat network`);
  }
  const westEntry=WEST_RIDGE_TRAIL[3];
  const westNode=nav.nearest(westEntry[0],westEntry[1],westEntry[2]);
  assert.ok(westNode>=0&&nav.distance[westNode]<0,
    'the retired west ascent is no longer reachable through the sealed gate');
}
console.log(`Lingyin hillside: ${RIDGE_TRAILS.length} routes, ${RIDGE_LOOKOUTS.length} lookouts, ${nav.points.length} nav nodes`);
