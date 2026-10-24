import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from '../lingyin-map/node_modules/typescript/lib/typescript.js';
import * as THREE from '../lingyin-map/node_modules/three/build/three.module.js';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('lingyin-map/src/world/surface_finish.ts',root),'utf8');
let js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
js=js.replace(/from ['"]three['"]/,`from '${new URL('lingyin-map/node_modules/three/build/three.module.js',root).href}'`);
const {bakeSurfaceFinish}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
for(const kind of ['stone','wood','plaster','bark']) {
 const geometry=new THREE.BoxGeometry(2,4,2);geometry.translate(0,2,0);
 const positions=geometry.attributes.position.array.slice(),normals=geometry.attributes.normal.array.slice();
 const indices=geometry.index.array.slice();
 bakeSurfaceFinish(geometry,kind,0);
 assert.deepEqual(geometry.attributes.position.array,positions,'visual finish cannot change physical positions');
 assert.deepEqual(geometry.attributes.normal.array,normals,'finish does not fake geometric normals');
 assert.deepEqual(geometry.index.array,indices,'no extra triangles or changes to topology');
 const color=geometry.attributes.color;
 assert.equal(color.count,geometry.attributes.position.count);assert.equal(color.normalized,true);
 assert.ok(color.array instanceof Uint8Array,'compact baked colour, not a float triplet per vertex');
 const copy=geometry.clone();copy.deleteAttribute('color');bakeSurfaceFinish(copy,kind,0);
 assert.deepEqual(copy.attributes.color.array,color.array,'weathering must be deterministic');
 let low=0,high=0,nlow=0,nhigh=0;
 for(let i=0;i<color.count;i++) {
  assert.ok(color.getX(i)>=0&&color.getX(i)<=1);
  if(Math.abs(geometry.attributes.normal.getY(i))>.1)continue;
  if(geometry.attributes.position.getY(i)<1){low+=color.getX(i);nlow++;}
  else{high+=color.getX(i);nhigh++;}
 }
 assert.ok(low/nlow<high/nhigh,'damp base must be darker than upper surface');
}
const mainHall=await readFile(new URL('lingyin-map/src/world/main_hall_study.ts',root),'utf8');
assert.match(mainHall,/merge\(paintedFaces\)/,'painted eaves share one draw');
assert.match(mainHall,/floorMat\.bumpMap=assets\.stoneFloor/,'floor relief must match its albedo');
assert.doesNotMatch(mainHall,/floorMat\.normalMap = floorMat\.normalMap\.clone/,'no unrelated stone normal texture clone');
const ground=await readFile(new URL('lingyin-map/src/gate-kit/world/ground.ts',root),'utf8');
assert.match(ground,/if\(!this\.gameMap\)this\.buildMoss\(\)/,'photographed stone is not covered by raised green polyhedra');
console.log('surface finish passed: unchanged topology/positions, deterministic compact wear, shared maps and merged eaves');
