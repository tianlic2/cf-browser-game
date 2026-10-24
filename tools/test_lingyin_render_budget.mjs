// Browser regression: run with the local preview server listening on :8123.
import assert from 'node:assert/strict';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/?debug=render-budget-regression&debugMap=lingyin&debugAutoStart=1&debugNoEnemies=1&debugPlayer=-2,0,20,0,0');
 await page.waitForFunction(()=>window.__tactical?.scene.getObjectByName('lingyin-authored-world')?.visible,null,{timeout:120000});
 await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
 await page.waitForTimeout(600);
 const initial=await page.evaluate(()=>({textures:__tactical.renderer.info.memory.textures,programs:__tactical.renderer.info.programs.length}));
 const stats={};
 for(const [name,p] of Object.entries({court:[-2,0,20,0],hall:[-2,1.35,-18,0],gate:[-2,0,67,0],bridge:[36,.6,28,Math.PI/2]})){
  await page.evaluate(p=>{const t=__tactical;t.player.pos.set(...p.slice(0,3));t.player.vel.set(0,0,0);t.player.yaw=p[3];t.player.pitch=0;t.renderStats()},p);
  await page.waitForTimeout(900);
  stats[name]=await page.evaluate(()=>__tactical.renderStats());
  assert.ok(stats[name].frames>0,'both rendering passes must continue');
  assert.equal(stats[name].textures,initial.textures,'turning must not trigger first-time map image uploads');
  assert.equal(stats[name].programs,initial.programs,'selected-map shader variants were prepared');
  assert.ok(stats[name].resolutionBudget.pixelRatio>=1&&stats[name].resolutionBudget.pixelRatio<=1.75);
 }
 const lod=await page.evaluate(()=>{
  const w=__tactical.scene.getObjectByName('lingyin-authored-world'),l=w.getObjectByName('hall-central-buddha');
  return {terrain:w.getObjectByName('terrain').geometry.index.count/3,levels:l.levels.map(level=>{
   let triangles=0;level.object.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3});
   return {distance:level.distance,triangles};
  })};
 });
 assert.equal(lod.terrain,49960);assert.equal(lod.levels[0].triangles,147890);assert.equal(lod.levels[1].triangles,29578);
 assert.equal(lod.levels[2].distance,40);assert.ok(lod.levels[2].triangles<5000);
 const scoped=await page.evaluate(()=>{
  const t=__tactical,c=t.camera,position=c.position.clone(),fov=c.fov;t.pause();
  c.position.set(-2,3,65);c.fov=11;c.updateProjectionMatrix();t.renderer.render(t.scene,c);
  const out={level:t.scene.getObjectByName('hall-central-buddha').getCurrentLevel(),zoom:c.zoom};
  c.position.copy(position);c.fov=fov;c.updateProjectionMatrix();t.resume();return out;
 });
 assert.equal(scoped.level,0,'scope magnification restores detailed distant decoration');assert.equal(scoped.zoom,1,'real aim zoom is unchanged');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({initial,stats,lod,scoped,errors},null,2));
}finally{await browser.close()}
