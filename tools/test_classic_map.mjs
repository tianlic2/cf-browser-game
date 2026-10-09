// Run with: node tools/test_classic_map.mjs (no browser or dependencies required).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {intersectsBrush,brushSupport,brushBottom} from '../scripts/brush_collision.js';
import {GroundNavigation} from '../scripts/navigation.js';
import {mmVisible} from '../scripts/minimap.js';
const map=JSON.parse(readFileSync(new URL('../assets/classic/transport/map.json',import.meta.url)));
for(const c of map.colliders){c.x=-c.x;for(const plane of c.planes)plane[0]=-plane[0];}
const cs=map.colliders,floor=Math.min(...cs.map(c=>c.h));
assert.equal(cs.filter(c=>c.stair).length,22,'both authored stair flights retained');
assert.ok(Math.abs(floor+2.4384)<1e-6,'underground floor retained');
for(const team of Object.values(map.spawns))for(const [x,y,z] of team)
  assert.ok(!cs.some(c=>intersectsBrush(c,-x,z,y)),'mirrored spawn unobstructed');
const support=(x,z,y)=>Math.max(floor,...cs.map(c=>brushSupport(c,x,z)).filter(h=>h<=y+.5));
for(const [x,z,direction] of [[13.12,36.8,1],[-12.77,-38.5,-1]]) {
  let y=floor;
  for(let distance=0;distance<7;distance+=.04) {
    const next=z+direction*distance;
    assert.ok(!cs.some(c=>intersectsBrush(c,x,next,y)),'ascending stair clearance');
    y=support(x,next,y);
  }
  assert.ok(y>=0,'stair flight reaches deck');
}
const roof=Math.min(...cs.map(c=>brushBottom(c,13.12,24,.45)).filter(y=>y>floor+1.78));
assert.ok(Math.abs(roof+.2032)<.001,'tunnel ceiling matches visible roof');
const nav=new GroundNavigation(cs,map.bounds);
for(const goal of [{x:13.12,y:floor,z:24},{x:-12.77,y:floor,z:-24},{x:0,y:0,z:40}]) {
  nav.update(goal);
  for(const team of Object.values(map.spawns))for(const [x,y,z] of team)
    assert.ok(nav.distance[nav.nearest(-x,z,y)]>=0,'both teams can route to either tunnel and deck');
}
assert.equal(nav.clear({x:13.12,y:0,z:29},{x:13.12,y:floor,z:25}),false,'cannot route through roof');
assert.equal(nav.clear({x:23,y:floor,z:29},{x:23,y:floor,z:25}),false,'no navigation floor outside ship');
const view={px:13.12,py:floor,pz:29,yaw:0,time:100,colliders:cs};
assert.equal(mmVisible({x:13.12,y:floor,z:25,combatAt:-999},view),'fov');
assert.equal(mmVisible({x:13.12,y:0,z:25,combatAt:-999},view),null,'radar cannot see through deck');
console.log('PASS: 32 spawns, both stairs, tunnel ceiling, layered navigation and radar occlusion');
