import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../scripts/map_material_warmup.js',import.meta.url),'utf8');
const {prepareMapMaterials,prepareMapTextures}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const make=()=>{
 const root={parent:null},sibling={};
 const scene={children:[root,sibling],remove(o){this.children.splice(this.children.indexOf(o),1);o.parent=null},
  add(o){this.children.push(o);o.parent=this}};
 root.parent=scene;return {map:{visuals:[root]},scene,root,sibling};
};
let calls=0;
const ready=make(),camera={};
assert.equal(await prepareMapMaterials(ready.map,{async compileAsync(root,c,target){
 calls++;assert.equal(root.parent,null,'map lights must not also be in targetScene');
 assert.equal(c,camera);assert.equal(target,ready.scene);
}},camera,ready.scene),true);
assert.equal(ready.map.materialProgramsReady,true);
assert.equal(ready.root.parent,ready.scene);
assert.deepEqual(ready.scene.children,[ready.root,ready.sibling]);
assert.equal(await prepareMapMaterials(ready.map,{async compileAsync(){calls++}},camera,ready.scene),false);
assert.equal(calls,1,'cached map does not recompile on every entry');
const failed=make();
await assert.rejects(prepareMapMaterials(failed.map,{async compileAsync(){throw Error('GPU lost')}},camera,failed.scene),/GPU lost/);
assert.equal(failed.root.parent,failed.scene,'root restored after compile failure');
assert.deepEqual(failed.scene.children,[failed.root,failed.sibling]);
assert.ok(!failed.map.materialProgramsReady,'failed warmup must remain retryable');
assert.equal(await prepareMapMaterials(failed.map,{},camera,failed.scene),false);
console.log('map material warmup passed: correct lights, cached compile, restored parent/order, retryable failure');
const textures=Array.from({length:8},()=>({isTexture:true}));
const selected={visuals:[{traverse(fn){fn({material:{map:textures[0],normalMap:textures[0]}});fn({material:[{map:textures[1]},{uniforms:Object.fromEntries(textures.slice(2).map((t,i)=>[i,{value:t}]))}]});}}]};
const uploaded=[];let yields=0;
assert.equal(await prepareMapTextures(selected,{initTexture:t=>uploaded.push(t)},async()=>{yields++}),8);
assert.equal(new Set(uploaded).size,8);assert.equal(yields,1);
assert.equal(await prepareMapTextures(selected,{initTexture(){throw Error('duplicate')}}),0,'only selected-map images upload once');
const retry={...selected,texturesUploaded:false};
await assert.rejects(prepareMapTextures(retry,{initTexture(){throw Error('texture upload failed')}}),/texture upload failed/);
assert.equal(retry.texturesUploaded,false,'failed texture uploads remain retryable');
console.log('map texture warmup passed: deduplicated material/uniform textures, hidden LODs, yielded batches, retryable failure');
