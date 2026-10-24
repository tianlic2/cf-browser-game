import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from '../lingyin-map/node_modules/typescript/lib/typescript.js';

const source=await readFile(new URL('../lingyin-map/src/world/masterplan_blockout.ts',import.meta.url),'utf8');
const layoutSource=await readFile(new URL('../lingyin-map/src/world/boardwalk_layout.ts',import.meta.url),'utf8');
const js=ts.transpileModule(layoutSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {boardwalkLayout}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const nodes=Function(`return ${source.match(/const nodes = (\[[\s\S]*?\n    \]);/)[1]}`)();
const stairs=new Set([0,3,5,7,9]);
const layout=boardwalkLayout(nodes,stairs);
const cross=(a,b)=>a.x*b.z-a.z*b.x;
const sub=(a,b)=>({x:a.x-b.x,z:a.z-b.z});
const near=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y)<1e-5;
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2});
const key=p=>[p.x,p.y,p.z].map(v=>v.toFixed(5)).join(',');
const segments=new Set();
for(let i=0;i<layout.rails.length;i++) {
  const a=layout.rails[i],r=sub(a.b,a.a),id=[key(a.a),key(a.b)].sort().join('|');
  assert.ok(!segments.has(id),'duplicate guard beam');segments.add(id);
  for(let j=i+1;j<layout.rails.length;j++) {
    const b=layout.rails[j],s=sub(b.b,b.a),den=cross(r,s);
    if(Math.abs(den)<1e-8)continue;
    const q=sub(b.a,a.a),t=cross(q,s)/den,u=cross(q,r)/den;
    if(t<=1e-6||t>=1-1e-6||u<=1e-6||u>=1-1e-6)continue;
    const dy=a.a.y+(a.b.y-a.a.y)*t-b.a.y-(b.b.y-b.a.y)*u;
    assert.ok(Math.abs(dy)>.2,`crossed rails ${i}/${j}`);
  }
}
// Each side is a single connected chain with only the entrance/pavilion open.
const degrees=new Map();
for(const rail of layout.rails)for(const p of [rail.a,rail.b])degrees.set(key(p),(degrees.get(key(p))||0)+1);
assert.equal([...degrees.values()].filter(n=>n===1).length,4);
assert.ok([...degrees.values()].every(n=>n<=2),'branch or repeated guard at corner');
assert.equal(layout.landings.length,nodes.length-2);
for(let i=0;i<layout.spans.length;i++) {
  const s=layout.spans[i],run=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z);
  assert.ok(run>.2,'flight consumed by landing');
  if(s.stair) {
    const steps=Math.max(5,Math.ceil(run/.48),Math.ceil(Math.abs(s.b.y-s.a.y)/.18));
    assert.ok(Math.abs(s.b.y-s.a.y)/steps<=.18);
  } else assert.equal(s.a.y,s.b.y,'gallery must be level');
  if(i<layout.spans.length-1) {
    const points=layout.landings[i];
    assert.ok(points.every(p=>p.y===nodes[i+1].y),'landing must not cover sloping treads');
    assert.ok(near(midpoint(points[0],points[5]),s.b),'landing begins at the stair edge');
    assert.ok(near(midpoint(points[2],points[3]),layout.spans[i+1].a),'landing ends at the next flight');
  }
}
assert.ok(Math.abs(layout.spans[0].b.z+24.675)<1e-8,'entry stair stops at platform edge');
assert.doesNotMatch(source,/if\(i===1\)/,'all corners must use the same join rule');
const temple=await readFile(new URL('../lingyin-map/src/world/temple.ts',import.meta.url),'utf8');
assert.match(temple,/cx\+side\*nx\*\.88[\s\S]*cz\+side\*nz\*\.88/,
  'enclosure fascia must occupy opposite sides rather than duplicate one side');
console.log(`boardwalk joins passed: ${layout.landings.length} turns, ${layout.rails.length} unique rails, no crossings`);
