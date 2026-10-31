import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const catalog=JSON.parse(await readFile(new URL('../assets/preview/gamebanana-weapons/catalog.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 page.on('requestfailed',r=>failed.push(`${r.url()} ${r.failure()?.errorText}`));
 await page.goto('http://127.0.0.1:8123/preview/gamebanana-weapons.html');
 await page.waitForFunction(()=>window.__weaponCandidates?.state().ready,null,{timeout:60000});
 await page.locator('[data-clip="select"]').click();
 await page.waitForFunction(()=>__weaponCandidates.state().audioState==='running',null,{timeout:5000});
 const results=[];
 for(const entry of catalog.entries){
  if(entry.id!=='an94')await page.evaluate(id=>__weaponCandidates.select(id),entry.id);
  const uvAudit=await page.evaluate(async id=>{
   const api=__weaponCandidates,v=api.view();
   const base=`/assets/preview/gamebanana-weapons/${id}/`;
   const d=await (await fetch(base+'view.json?v=native-uv-2')).json();
   const a=new Float32Array(await (await fetch(base+'view.bin?v=native-uv-2')).arrayBuffer());
   const meshes=v.root.children.flatMap(r=>r.children.filter(o=>o.isMesh));let checked=0;
   for(let n=0;n<d.parts.length;n++){
    const part=d.parts[n],mesh=meshes[n];
    if(mesh.material.map.flipY!==false)throw Error('unexpected texture upload flip');
    for(let i=0;i<part.count;i++){
     const at=part.offset/4+i*16;
     if(Math.abs(mesh.geometry.attributes.uv.getX(i)-a[at+6])>1e-6||Math.abs(mesh.geometry.attributes.uv.getY(i)-(1-a[at+7]))>1e-6)throw Error('GPU UV mismatch');
     checked++;
    }
   }
   return {vertices:checked,uvConvention:api.state().uvConvention,version:api.state().assetVersion,
    effects:v.effects.map(m=>({visible:m.visible,additive:m.material.blending===2,depthWrite:m.material.depthWrite})),
    status:document.querySelector('#status').textContent};
  },entry.id);
  assert.equal(uvAudit.uvConvention,'classic-smd-v');assert.equal(uvAudit.version,'native-uv-2');
  assert.match(uvAudit.status,/贴图方向已校正/);assert.equal(uvAudit.vertices,entry.triangles*3);
  if(entry.id==='scar-light')assert.ok(uvAudit.effects.length>0&&uvAudit.effects.every(e=>e.visible&&e.additive&&!e.depthWrite),'native bright scope/effect must not be removed or made opaque');
  const test=await page.evaluate(()=>{
   const api=__weaponCandidates,v=api.view(),actions=[];
   for(const name of ['idle_0','select','fire','reload']){
    api.sample(name,0);const first=v.bones.map(b=>b.position.toArray().concat(b.quaternion.toArray()));
    api.sample(name,v.duration(name)*.55);const second=v.bones.map(b=>b.position.toArray().concat(b.quaternion.toArray()));
    const changed=first.filter((r,i)=>r.some((a,k)=>Math.abs(a-second[i][k])>.0001)).length;
    actions.push({name,changed,duration:v.duration(name)});
   }
   api.sample('idle_0',.4);return {id:api.state().id,bounds:api.state().bounds,actions,audio:api.auditAudio(),state:api.state().audioState};
  });
  assert.equal(test.id,entry.id);assert.ok(test.actions.every(a=>a.changed>=1),'every original action changes actual rig poses');
  assert.ok(test.audio.every(a=>a.peak>.0001&&a.duration>0),'every supplied sound decodes and contains non-silent audio');
  assert.ok(test.bounds.every(Number.isFinite));assert.ok(test.bounds[2]<-.2,'gun faces into the scene rather than behind the camera');
  assert.equal(test.state,'running');
  await page.locator('[data-clip="reload"]').click();await page.waitForTimeout(90);
  assert.equal(await page.evaluate(()=>__weaponCandidates.state().playing),true);
  await page.locator('#pause').click();
  await page.evaluate(()=>__weaponCandidates.sample('idle_0',0));
  await page.waitForTimeout(300);
  if(['an94','dsr1','remington870','scar-light'].includes(entry.id))await page.screenshot({path:`/private/tmp/gamebanana-${entry.id}-final.png`});
  results.push({id:entry.id,actions:test.actions,sounds:test.audio.length,peak:Math.max(...test.audio.map(a=>a.peak)),uvVertices:uvAudit.vertices});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log(JSON.stringify({loaded:results.length,results,errors,failed},null,2));
}finally{await browser.close()}
