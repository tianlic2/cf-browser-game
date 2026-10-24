import assert from 'node:assert/strict';
import {lingyinLayout} from '../scripts/lingyin_layout.js';
import {MAIN_HALL,MAIN_HALL_SCALE,mainHallPoint} from '../scripts/lingyin_main_hall.js';
import {MAIN_INTERIOR_COLUMNS,MAIN_COLUMN_PARTS,MAIN_CENSER,MAIN_HALL_FIXTURES,hallPerimeterColumns} from '../scripts/lingyin_columns.js';
import {SMALL_HALLS} from '../scripts/lingyin_small_halls.js';
import {intersectsBrush,canMoveThroughBrushes,brushContainsPoint,brushBottom} from '../scripts/brush_collision.js';
const map=lingyinLayout(),feet=1.35;
const blocked=(x,z,y=feet,r=.45)=>map.colliders.some(c=>intersectsBrush(c,x,z,y,r,.52,1.78,map.colliders,map.surfaceAt));
for(const [i,[x,z]] of MAIN_INTERIOR_COLUMNS.entries()){
 const p=mainHallPoint(x,z),parts=map.colliders.filter(c=>c.name?.startsWith(`main-interior-column-${i}-`));
 assert.equal(parts.length,MAIN_COLUMN_PARTS.length);
 assert.ok(blocked(p.x,p.z),'every red column blocks player/NPC bodies');
 for(const part of parts){
  assert.equal(part.round.sx,MAIN_HALL_SCALE.x);assert.equal(part.round.sz,MAIN_HALL_SCALE.z);
  assert.ok(brushContainsPoint(part,p.x,(part.h+part.y0)/2,p.z));
 }
 const shaft=parts[1];
 for(let n=0;n<16;n++){
  const a=n*Math.PI/8,dx=Math.sin(a),dz=Math.cos(a),r=2;
  let at={x:p.x+dx*r,z:p.z+dz*r},hit=false;
  for(let d=r-.02;d>=0;d-=.02){
   const next={x:p.x+dx*d,z:p.z+dz*d};
   if(!canMoveThroughBrushes(parts,at.x,at.z,next.x,next.z,feet,.45,.52,1.78,map.surfaceAt)){hit=true;break;}
   at=next;
  }
  assert.ok(hit,`column ${i} direction ${n}: cannot cross`);
 }
 assert.equal(intersectsBrush(shaft,p.x+shaft.hx+.4,p.z+shaft.hz+.4,feet,.45,.52,1.78),false,
  'empty corners outside the ellipse must not turn into square air walls');
}
let perimeter=0;
for(const s of [MAIN_HALL,...SMALL_HALLS])for(const [i,col] of hallPerimeterColumns(s).entries()){
 const c=map.colliders.find(c=>c.name===`${s.name}-perimeter-column-${i}`);perimeter++;
 assert.ok(c?.round);assert.ok(Math.abs(c.h-(.25+col.height))<1e-6);
 assert.ok(blocked(c.x,c.z,s.plinth+.25),'perimeter shafts retain physical collision');
}
const censer=mainHallPoint(MAIN_CENSER.x,MAIN_CENSER.z);
assert.ok(blocked(censer.x,censer.z),'interior censer cannot be walked through');
for(const part of MAIN_HALL_FIXTURES){
 const c=map.colliders.find(c=>c.name===`main-fixture-${part.name}`);
 assert.ok(c);assert.ok(Math.abs(c.h-(feet+part.y+part.h/2))<1e-6,'fixture height matches the actual source box');
 if(part.support){
  const p=mainHallPoint(part.x,part.z);
  assert.ok(map.surfacesAt(p.x,p.z,c.h+.001).some(y=>Math.abs(y-c.h)<1e-6),'jump landing uses the real top face');
 }
}
for(const hall of SMALL_HALLS){
 const c=map.colliders.filter(c=>Math.abs(c.x-hall.x)<.001&&Math.abs(c.z-hall.z)<.001);
 const ceiling=hall.eave-hall.plinth-.38;
 assert.ok(c.some(c=>Math.abs(c.y0-ceiling)<1e-6),'room has a real ceiling brush');
 const bottom=Math.min(...c.map(c=>brushBottom(c,hall.x,hall.z,.45)).filter(y=>y>hall.plinth+2));
 assert.ok(bottom<ceiling-.4,'hanging lantern has a matching jump/head contact');
 assert.equal(blocked(hall.x,hall.z,hall.plinth+.25),false,'normal central aisle stays open');
}
console.log(`Static solids passed: 6 expanded red columns, ${perimeter} perimeter shafts, interior censer and 2 side-room ceilings/lanterns; round corners and aisles preserved`);
