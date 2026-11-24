import assert from 'node:assert/strict';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const root=process.env.CF_PUBLIC_ROOT || '/private/tmp/cf-public-release';
const evidence='/private/tmp/cf-transport-cinematic/'+(process.argv.includes('--before')?'before':'after');await mkdir(evidence,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary',
'.woff':'font/woff','.woff2':'font/woff2','.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
const inspectorPath=process.argv.find(a=>a.startsWith('--inspector='))?.slice(12);
const inspector=inspectorPath?await import(pathToFileURL(inspectorPath).href):null;
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
  await page.goto('https://tianlic2.github.io/cf-browser-game/?debug=transport-cinematic');
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
  const views=[{name:'lane',eye:[7,1.7,-15],target:[7,1,-2]},{name:'cabin',eye:[-6.69,1.7,41.87],target:[-5.5,1.5,30]},{name:'harbour',eye:[21,5,15],target:[65,12,35]},{name:'terminal',eye:[0,10,32],target:[15,22,101]},{name:'sea',eye:[-21,3,12],target:[-47,-3.42,-2]}];const captures=[];
  const proofs=[];
  for(const view of views){
    const stats=await page.evaluate(view=>{
      const t=__tactical;t.camera.position.fromArray(view.eye);t.camera.lookAt(...view.target);t.camera.updateMatrixWorld(true);
      t.scene.getObjectByName('transport-cargo-relief').userData.updateDetailLod(t.camera.position,0,true);t.renderer.info.reset();
      const ref=t.scene.getObjectByName('transport-wet-reflections');
      const state=()=>({target:t.renderer.getRenderTarget(),auto:t.renderer.autoClear,tone:t.renderer.toneMapping,
        shadow:t.renderer.shadowMap.enabled,clip:t.renderer.clippingPlanes.length,camera:t.camera.matrixWorld.toArray()});
      const before=state();ref?.userData.capture(t.renderer,t.scene,t.camera,true);const after=state();
      t.renderer.clear();t.renderer.render(t.scene,t.camera);
      return {calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,
        reflection:ref?.userData.stats(),textures:t.renderer.info.memory.textures,geometries:t.renderer.info.memory.geometries,
        restored:JSON.stringify(before)===JSON.stringify(after)};
    },view);
    assert(stats.restored,'reflection restores camera and renderer state');assert(stats.calls<300&&stats.triangles<800000);
    await page.screenshot({path:resolve(evidence,view.name+'.png')});
    const item={view,...stats};
    if(inspector){
      await page.evaluate(s=>{window.__THREE_GAME_DIAGNOSTICS__={renderer:{calls:s.calls,triangles:s.triangles,geometries:s.geometries,textures:s.textures}};},stats);
      const cwd=process.cwd();process.chdir(fileURLToPath(new URL('../lingyin-map/',import.meta.url)));
      try{
        const loadedPage=new Proxy(page,{get:(target,key)=>key==='goto'?async()=>{}:typeof target[key]==='function'?target[key].bind(target):target[key]});
        item.inspection=await inspector.inspectPage(loadedPage,{url:page.url(),state:null,wait:0,mobile:false,
          out:evidence,screenshotPath:resolve(evidence,view.name+'-inspected.png'),runId:'transport-cinematic-20261124'});
        assert(item.inspection.result.ok,'canvas is nonblank and visually varied');
      }finally{process.chdir(cwd);}
    }
    captures.push(item);
    if(!process.argv.includes('--before')&&['lane','cabin','harbour'].includes(view.name)){
      const proof=await page.evaluate(name=>{
        const t=__tactical,r=t.scene.getObjectByName('transport-wet-reflections'),gl=t.renderer.getContext();
        const x=name==='cabin'?30:200,y=name==='cabin'?70:100,w=name==='cabin'?400:800,h=name==='cabin'?140:240;
        const pixels=()=>{const a=new Uint8Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
        const draw=()=>{t.renderer.clear();t.renderer.render(t.scene,t.camera);};
        r.userData.setEnabled(false);draw();const off=pixels();r.userData.setEnabled(true);r.userData.capture(t.renderer,t.scene,t.camera,true);draw();const on=pixels();
        let changed=0,difference=0;for(let i=0;i<on.length;i+=4){const d=Math.abs(on[i]-off[i])+Math.abs(on[i+1]-off[i+1])+Math.abs(on[i+2]-off[i+2]);difference+=d;if(d>3)changed++;}
        const start=r.userData.stats().frames;for(let i=0;i<20;i++)r.userData.capture(t.renderer,t.scene,t.camera);const updates=r.userData.stats().frames-start;
        return {name,changed,difference,updates,mode:r.userData.stats().mode};
      },view.name);
      if(view.name==='cabin')assert(proof.changed<100,'sheltered cabin floor does not become a mirror');
      else assert(proof.changed>500,'reflection changes rendered wet-surface pixels');
      assert(proof.updates<3,'stationary repeated draws reuse reflection cache');proofs.push(proof);
    }
  }
  let active=null,switching=null;
  if(!process.argv.includes('--before')){
    const map=await page.evaluate(()=>__tactical.mapState());assert.equal(map.colliders,754);assert.equal(map.obstacles,54);
    assert(!requests.some(p=>/transportship_texture_23[23]\.png/.test(p)),'new placards do not download the old adverts');
    await page.evaluate(()=>{const t=__tactical;t.player.pos.set(7,0,-15);t.player.vel.set(0,0,0);t.player.yaw=Math.PI;t.player.pitch=.06;t.player.invuln=999;t.resume();});
    await page.waitForTimeout(500);const start=await page.evaluate(()=>__tactical.player.pos.toArray());
    await page.keyboard.down('w');await page.waitForTimeout(850);await page.keyboard.up('w');
    const end=await page.evaluate(()=>__tactical.player.pos.toArray());assert(Math.hypot(...start.map((v,i)=>end[i]-v))>.2);
    const mag=await page.evaluate(()=>__tactical.getAmmo().mag);await page.mouse.down();await page.waitForTimeout(180);await page.mouse.up();
    assert(await page.evaluate(()=>__tactical.getAmmo().mag)<mag);await page.keyboard.press('r');await page.waitForTimeout(3200);
    assert.equal(await page.evaluate(()=>__tactical.getAmmo().mag),mag);
    await page.evaluate(()=>__tactical.renderStats());await page.waitForTimeout(2000);
    active=await page.evaluate(()=>({render:__tactical.renderStats(),errors:__tactical.loopErrors(),reflection:__tactical.scene.getObjectByName('transport-wet-reflections').userData.stats()}));
    assert.equal(active.errors,0);assert(active.render.callsPerFrame<300&&active.render.trisPerFrame<800000);
    await page.screenshot({path:resolve(evidence,'active.png')});
    await page.evaluate(()=>__tactical.quitMatchToLobby());
    const stopped=await page.evaluate(()=>__tactical.scene.getObjectByName('transport-wet-reflections').userData.stats().frames);
    await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__tactical.scene.getObjectByName('transport-wet-reflections').userData.stats().frames),stopped);
    await page.locator('[data-map="blacktown"]').click();await page.locator('#startBtn').click();
    await page.waitForFunction(()=>__tactical.mapState().id==='blacktown'&&__tactical.gameMenuState().state==='playing',null,{timeout:180000});
    switching=await page.evaluate(()=>({target:__tactical.renderer.getRenderTarget(),refVisible:__tactical.scene.getObjectByName('transport-wet-reflections').visible,
      mode:__tactical.scene.getObjectByName('transport-wet-reflections').userData.stats().mode,errors:__tactical.loopErrors()}));
    assert.equal(switching.target,null);assert(!switching.refVisible);assert.equal(switching.mode,0);assert.equal(switching.errors,0);
  }
  assert.deepEqual(errors,[]);const video=page.video();await context.close();await video.saveAs(resolve(evidence,'motion.webm'));
  await writeFile(resolve(evidence,'report.json'),JSON.stringify({captures,proofs,active,switching,errors},null,2));console.log(JSON.stringify({captures:captures.map(c=>({view:c.view.name,calls:c.calls,triangles:c.triangles,metrics:c.inspection?.result.metrics})),proofs,active,switching,errors}));
 }
 console.log('PASS cinematic transport captures');
}finally{await browser.close()}
