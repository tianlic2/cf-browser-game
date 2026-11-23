import assert from 'node:assert/strict';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const root=process.env.CF_PUBLIC_ROOT || '/private/tmp/cf-public-release';
const evidence='/private/tmp/cf-transport-precision/'+(process.argv.includes('--before')?'before':'after');await mkdir(evidence,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary',
'.woff':'font/woff','.woff2':'font/woff2','.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
try{
 for(const map of (['transport'])){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,
    recordVideo:{dir:evidence,size:{width:960,height:540}}});
  const page=await context.newPage();const errors=[],requests=[];let bytes=0;
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('CONSOLE',m.text().slice(0,500))}});
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico')){errors.push(r.status()+' '+r.url());console.error('HTTP',r.status(),r.url())}});
  await page.addInitScript(()=>{let owner=null;Object.defineProperty(document,'pointerLockElement',{get:()=>owner});
   HTMLElement.prototype.requestPointerLock=function(){owner=this;document.dispatchEvent(new Event('pointerlockchange'));return Promise.resolve()};
   document.exitPointerLock=()=>{owner=null;document.dispatchEvent(new Event('pointerlockchange'))};});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());requests.push(url.pathname);
   if(url.hostname!=='tianlic2.github.io')return route.abort();
   const rel=decodeURIComponent(url.pathname).replace(/^\/cf-browser-game\//,'');
   const path=resolve(root,rel||'index.html');
   try{const s=await stat(path);if(!path.startsWith(root+'/')||!s.isFile())throw Error('missing');bytes+=s.size;
    await route.fulfill({path,contentType:mime[extname(path)]||'application/octet-stream'});
   }catch{await route.fulfill({status:404,body:'missing'});}
  });
  const start=Date.now();
  await page.goto('https://tianlic2.github.io/cf-browser-game/?debug=transport-precision');
  await page.waitForFunction(()=>window.__tactical?.ready() || document.querySelector('#bootScreen.is-error'),null,{timeout:150000});
  assert.equal(await page.locator('#bootScreen.is-error').count(),0,await page.locator('#bootScreen').textContent().catch(()=>''));
  console.log(map,'boot ready');
  await page.waitForSelector('#bootScreen',{state:'detached',timeout:45000});
  if(await page.locator('#nicknameGate').isVisible()){await page.locator('#nicknameInput').fill('发布验收');await page.locator('#nicknameEnter').click();}
  const bootMs=Date.now()-start,bootBytes=bytes;
  const lobby=await page.evaluate(()=>({packs:__tactical.lobbyData().inventory?.packs?.length,
   maps:[...document.querySelectorAll('[data-map]')].filter(n=>!n.hidden).map(n=>n.dataset.map)}));
  assert.deepEqual(lobby.maps,['transport','blacktown']);
  assert.deepEqual(await page.evaluate(()=>__tactical.mapState().available),['transport','blacktown','lingyin']);
  assert(!requests.some(p=>/harbor_|\/hbr7\/|\/m4_ironbeast\/|\/kukri_dragon\/|\/assets\/local\/(?!fox_npc)/.test(p)), 'no complex weapon downloads');
  if(map==='lingyin')await page.locator('[data-mode="browse"]').click();
  if(map!=='transport')await page.locator(`[data-map="${map}"]`).click();
  console.log(map,'starting map');
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>document.querySelector('#mapLoadScreen.is-error') || (__tactical.mapState().colliders>0 && __tactical.gameMenuState().state==='playing'),null,{timeout:180000});
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>document.querySelector('#viewport').requestPointerLock());
  await page.waitForTimeout(1500);

  await page.evaluate(()=>{__tactical.freezeEnemies(true);__tactical.pause();});
  const audit=await page.evaluate(()=>{const t=__tactical;return {map:t.mapState(),meshes:t.scene.children.flatMap(root=>{const out=[];root.traverse(o=>{if(o.geometry&&(/transport-(cargo-castings|case-corner|timber-fasteners)/.test(o.name)||o.userData.precisionRelief))out.push({name:o.name,vertices:o.geometry.attributes.position.count,triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1),relief:o.userData.precisionRelief});});return out;})};});
  console.log('AUDIT',JSON.stringify(audit.meshes));
  let validation=null;
  if(!process.argv.includes('--before')){
    validation=await page.evaluate(()=>{
      const t=__tactical,root=t.scene.getObjectByName('transport-cargo-relief'),near=t.scene.getObjectByName('transport-cargo-castings');
      const material=new t.THREE.MeshBasicMaterial({side:t.THREE.DoubleSide});
      const casting=new t.THREE.Mesh(near.geometry,material),ray=new t.THREE.Raycaster();
      ray.set(new t.THREE.Vector3(0,0,2),new t.THREE.Vector3(0,0,-1));const hole=ray.intersectObject(casting,false).length;
      ray.ray.origin.x=.41;const rim=ray.intersectObject(casting,false).length;material.dispose();
      root.userData.updateDetailLod(new t.THREE.Vector3(400,20,0),0,true);const distant=root.userData.precisionLod();
      root.userData.updateDetailLod(new t.THREE.Vector3(12,2,-4),0,true);const close=root.userData.precisionLod();
      root.userData.updateDetailLod(t.camera.position,0,true);
      let finite=true;t.scene.traverse(o=>{if(o.geometry&&(o.userData.precisionRelief||/transport-(case-corner|cargo-castings|timber-fasteners)/.test(o.name))){
        for(const attr of Object.values(o.geometry.attributes))finite&&=Array.from(attr.array).every(Number.isFinite);}});
      const covers=t.scene.getObjectByName('transport-flush-inspection-covers');covers.geometry.computeBoundingBox();
      return {hole,rim,distant,close,finite,coverRange:[covers.geometry.boundingBox.min.z,covers.geometry.boundingBox.max.z],
        nails:t.scene.getObjectByName('transport-timber-fasteners').count,braces:t.scene.getObjectByName('transport-timber-braces').count,
        plates:t.scene.getObjectByName('transport-case-corner-plates').userData.plates};
    });
    assert.equal(validation.hole,0,'handling aperture has an actual opening');assert(validation.rim>0);
    assert.equal(validation.distant.near,0);assert(validation.close.near>0&&validation.close.far>0);
    assert.equal(validation.close.near+validation.close.far,validation.close.total);
    assert(validation.finite&&validation.coverRange[0]>-.005&&validation.coverRange[1]<.01);
    assert.equal(validation.nails,validation.braces*2);assert(validation.plates>500);
    assert.equal(audit.map.colliders,754);assert.equal(audit.map.obstacles,54);
  }
  const views=await page.evaluate(()=>{const t=__tactical,cs=t.colliders().filter(c=>c.roundedFootprint&&c.textures.includes('transportship/texture_234')&&Math.min(c.hx,c.hz)>.45&&c.h-c.y0>.85&&c.y0<.1).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));let choice;for(const c of cs){for(const s of [-1,1]){const eye=[c.x+s*(c.hx+1.4),c.y0+1.65,c.z+c.hz+1.8];if(t.skillPlayerMoveAllowed([eye[0],eye[2]],[eye[0]+.001,eye[2]],c.y0)){choice={name:'wood',eye,target:[c.x,(c.h+c.y0)*.5,c.z],box:c};break;}}if(choice)break;}return [choice,{name:'cabinet',eye:[9.4,1.7,-12],target:[12,1.5,-12]},{name:'lane',eye:[7,1.7,-15],target:[7,1,-2]},{name:'hatch',eye:[7,1.35,-12.8],target:[7,.025,-11]}].filter(Boolean);});
  console.log('VIEWS',JSON.stringify(views));const metrics=[];
  if(!process.argv.includes('--before')){
    views.push(await page.evaluate(()=>{
      const t=__tactical,root=t.scene.getObjectByName('transport-cargo-relief');root.userData.updateDetailLod(new t.THREE.Vector3(12,2,-4),0,true);
      const near=t.scene.getObjectByName('transport-cargo-castings'),m=new t.THREE.Matrix4(),centres=[];
      for(let i=0;i<near.count;i++){near.getMatrixAt(i,m);const p=new t.THREE.Vector3().setFromMatrixPosition(m);if(p.y<1)centres.push(p);}
      centres.sort((a,b)=>a.distanceToSquared(new t.THREE.Vector3(11,0,-4))-b.distanceToSquared(new t.THREE.Vector3(11,0,-4)));
      for(const p of centres)for(let i=0;i<8;i++){
        const a=i*Math.PI/4,x=p.x+Math.cos(a)*.75,z=p.z+Math.sin(a)*.75;
        if(t.skillPlayerMoveAllowed([x,z],[x+.001,z],.0254))return {name:'casting',eye:[x,p.y+.3,z],target:p.toArray()};
      }throw Error('no clear near-casting view');
    }));
  }
  for(const v of views){await page.evaluate(v=>{const t=__tactical;t.camera.position.fromArray(v.eye);t.camera.lookAt(...v.target);t.camera.updateMatrixWorld(true);t.scene.getObjectByName('transport-cargo-relief').userData.updateDetailLod?.(t.camera.position,0,true);t.renderer.info.reset();t.renderer.render(t.scene,t.camera);},v);await page.screenshot({path:resolve(evidence,v.name+'.png')});metrics.push(await page.evaluate(()=>({draws:__tactical.renderer.info.render.calls,triangles:__tactical.renderer.info.render.triangles})));}
  assert(metrics.every(m=>m.draws<300&&m.triangles<650000));
  await page.evaluate(()=>{const t=__tactical;t.player.pos.set(7,0,-15);t.player.vel.set(0,0,0);t.player.yaw=Math.PI;t.player.pitch=.05;t.player.invuln=999;t.resume();});
  await page.waitForTimeout(500);const pos=await page.evaluate(()=>__tactical.player.pos.toArray());
  await page.keyboard.down('w');await page.waitForTimeout(800);await page.keyboard.up('w');
  const end=await page.evaluate(()=>__tactical.player.pos.toArray());assert(Math.hypot(...pos.map((v,i)=>end[i]-v))>.2);
  const mag=await page.evaluate(()=>__tactical.getAmmo().mag);
  await page.mouse.down();await page.waitForTimeout(180);await page.mouse.up();assert(await page.evaluate(()=>__tactical.getAmmo().mag)<mag);
  await page.keyboard.press('r');await page.waitForTimeout(3200);assert.equal(await page.evaluate(()=>__tactical.getAmmo().mag),mag);
  await page.evaluate(()=>__tactical.renderStats());await page.waitForTimeout(1500);const active=await page.evaluate(()=>__tactical.renderStats());
  assert(active.callsPerFrame<300&&active.trisPerFrame<750000);
  await page.screenshot({path:resolve(evidence,'active.png')});
  assert.deepEqual(errors,[]);const video=page.video();await context.close();await video.saveAs(resolve(evidence,'motion.webm'));
  await writeFile(resolve(evidence,'report.json'),JSON.stringify({views,metrics,errors,audit,validation,active,movement:Math.hypot(...pos.map((v,i)=>end[i]-v))},null,2));
 }
 console.log('PASS transport precision capture');
}finally{await browser.close()}
