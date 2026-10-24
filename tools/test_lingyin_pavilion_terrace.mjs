import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from '../lingyin-map/node_modules/typescript/lib/typescript.js';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('lingyin-map/src/world/pavilion_terrace.ts',root),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {pavilionTerraceLayout}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const entry={x:-49.5,z:61,y:13},previous={x:-47,z:59,y:11.95};
const t=pavilionTerraceLayout(entry,previous);
const dot=(a,b)=>a.x*b.x+a.z*b.z;
const local=p=>({u:dot({x:p.x-entry.x,z:p.z-entry.z},t.forward),
  v:dot({x:p.x-entry.x,z:p.z-entry.z},t.normal)});
assert.equal(t.outline.length,8);
assert.ok(Math.abs(Math.hypot(t.pavilion.x-entry.x,t.pavilion.z-entry.z)-8.71)<.02,
  'pavilion is beyond a real arrival court, not centred on the last tread');
assert.ok(t.signedDistance(t.pavilion.x,t.pavilion.z)<-4.1,'roof and columns fit inside terrace guards');
assert.ok(t.signedDistance(entry.x+t.forward.x*2,entry.z+t.forward.z*2)<-1.8,'clear entrance court');
assert.ok(t.outline.every(p=>p.y===13));
assert.ok(t.guard.every(p=>p.y===13&&t.signedDistance(p.x,p.z)<0),'guards stay on stone');
assert.ok(t.rails.every(r=>{
  const a=local(r.a),b=local(r.b);
  return !(Math.abs(a.u)<1e-5&&Math.abs(b.u)<1e-5&&a.v*b.v<0);
}),'no rail or sill may close the entrance');
assert.ok(Math.abs(local(t.guard[0]).v+2.05)<1e-8);
assert.ok(Math.abs(local(t.guard.at(-1)).v-2.05)<1e-8);
let area=0;
for(let i=0;i<t.outline.length;i++) {
 const a=t.outline[i],b=t.outline[(i+1)%t.outline.length];area+=a.x*b.z-a.z*b.x;
}
assert.ok(area/2>130&&area/2<150,'reference-like spacious stone platform');
const blockout=await readFile(new URL('lingyin-map/src/world/masterplan_blockout.ts',root),'utf8');
assert.doesNotMatch(blockout,/footings.push\(cyl\(4\.45/,'old disc must not bury the stair end');
assert.match(blockout,/phase1-pavilion-terrace-paving/);
assert.match(blockout,/terrace\.signedDistance/,'terrain and plants respect the whole terrace footprint');
assert.match(blockout,/pavilionCanopy\(\)/,'roof uses curved panels instead of a stretched primitive cone');
assert.match(blockout,/if\(d>0&&distance<3\.6\)next=Math\.min\(next,top-\.70\)/,
  'stair clearance uses the source-space top once; do not add the platform Y twice');
const walkSource=await readFile(new URL('lingyin-map/src/world/boardwalk_layout.ts',root),'utf8');
const walkJs=ts.transpileModule(walkSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {boardwalkLayout}=await import(`data:text/javascript;base64,${Buffer.from(walkJs).toString('base64')}`);
const nodes=Function(`return ${blockout.match(/const nodes = (\[[\s\S]*?\n    \]);/)[1]}`)();
const walk=boardwalkLayout(nodes,new Set([0,3,5,7,9]));
const rails=[...walk.rails,...t.rails],degrees=new Map();
const key=p=>[p.x,p.y,p.z].map(v=>v.toFixed(5)).join(',');
const cross=(a,b)=>a.x*b.z-a.z*b.x,sub=(a,b)=>({x:a.x-b.x,z:a.z-b.z});
for(let i=0;i<rails.length;i++) {
 const a=rails[i],r=sub(a.b,a.a);
 for(const p of [a.a,a.b])degrees.set(key(p),(degrees.get(key(p))||0)+1);
 for(let j=i+1;j<rails.length;j++) {
  const b=rails[j],s=sub(b.b,b.a),den=cross(r,s);
  if(Math.abs(den)<1e-8)continue;
  const q=sub(b.a,a.a),v=cross(q,s)/den,w=cross(q,r)/den;
  assert.ok(!(v>1e-6&&v<1-1e-6&&w>1e-6&&w<1-1e-6),'terrace guards must not cross any stair guard');
 }
}
assert.equal([...degrees.values()].filter(n=>n===1).length,2,'only the courtyard entrance remains open');
assert.ok([...degrees.values()].every(n=>n<=2),'no duplicated join at terrace entrance');
const materials=await readFile(new URL('lingyin-map/src/world/reference_materials.ts',root),'utf8');
assert.match(materials,/terraceStone=courtyardPavingMaterial\(\)\.clone\(\)/,'stone slab scans share existing GPU maps');
console.log(`pavilion terrace passed: ${(area/2).toFixed(1)}m², 4.1m open entrance, complete perimeter guard`);
