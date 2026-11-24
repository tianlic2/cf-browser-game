import assert from 'node:assert/strict';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const root=process.env.CF_PUBLIC_ROOT || '/private/tmp/cf-public-release';
const evidence='/private/tmp/cf-transport-dynamics/'+(process.argv.includes('--before')?'before':'after');await mkdir(evidence,{recursive:true});
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
  await page.goto('https://tianlic2.github.io/cf-browser-game/?debug=transport-dynamics');
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
  let audit=null;
  if(!process.argv.includes('--before')){
    audit=await page.evaluate(async()=>{
      const t=__tactical,d=t.scene.getObjectByName('transport-environment-dynamics');
      const runoff=d.getObjectByName('transport-roof-runoff'),gulls=d.getObjectByName('transport-harbour-gulls');
      const water=t.scene.getObjectByName('transport-open-water'),deck=t.scene.getObjectByName('transportship/texture_95');
      const p=gulls.instanceMatrix.array.slice();d.userData.update(12);const q=gulls.instanceMatrix.array.slice();
      const sources=runoff.userData.sources;
      const {harbourWaveHeight}=await import('./scripts/transport_dynamics.js');
      const waves=[];for(let x=-90;x<90;x+=5)for(let z=-90;z<90;z+=5)waves.push(harbourWaveHeight(x,z,12));
      return {...d.userData.stats(),sources,waterVertices:water.geometry.attributes.position.count,
        maxWave:Math.max(...waves.map(Math.abs)),receiverError:Math.max(...sources.map(s=>Math.abs(t.supportAt(s.x,s.z,s.bottom+.3,0)-(s.bottom-.016)))),
        changed:p.some((v,i)=>v!==q[i]),finite:[...q,...runoff.geometry.attributes.position.array].every(Number.isFinite),
        collider:t.obstacleMeshes.some(o=>o===water||o===runoff||o===gulls),deckShader:deck.material.customProgramCacheKey()};
    });
    console.log('DYNAMICS',JSON.stringify({...audit,sources:audit.sources.length}));
    assert(audit.runoffSources>5&&audit.runoffSources<150);assert(audit.gulls===9&&audit.changed&&audit.finite&&!audit.collider);
    assert(audit.waterVertices<15000&&audit.waterVertices>10000);assert.match(audit.deckShader,/wet-film-2/);
    assert(audit.maxWave<.257&&audit.maxWave>.15);assert(audit.receiverError<.03,'drips terminate on actual support surfaces');
  }

  await page.evaluate(()=>{__tactical.freezeEnemies(true);__tactical.renderStats();});
  await page.waitForTimeout(3000);
  const metrics=await page.evaluate(()=>({render:__tactical.renderStats(),map:__tactical.mapState()}));
  assert(metrics.render.callsPerFrame<300&&metrics.render.trisPerFrame<750000);
  assert.equal(metrics.map.colliders,754);assert.equal(metrics.map.obstacles,54);
  console.log(JSON.stringify(metrics));
  await page.evaluate(()=>{const t=__tactical;t.player.pos.set(7,0,-15);t.player.vel.set(0,0,0);t.player.yaw=Math.PI;t.player.pitch=.07;t.player.invuln=999;});
  await page.waitForTimeout(500);
  const startPos=await page.evaluate(()=>__tactical.player.pos.toArray());
  await page.keyboard.down('w');await page.waitForTimeout(850);await page.keyboard.up('w');
  const endPos=await page.evaluate(()=>__tactical.player.pos.toArray());
  assert(Math.hypot(...startPos.map((n,i)=>endPos[i]-n))>.2,'actual keyboard movement');
  await page.mouse.down();await page.waitForTimeout(180);await page.mouse.up();
  await page.keyboard.press('r');await page.waitForTimeout(3000);
  await page.screenshot({path:resolve(evidence,'active.png')});
  await page.evaluate(()=>__tactical.pause());
  for(const [name,eye,target] of [['sea',[-21,3,12],[-47,-3.42,-2]],['deck',[7,1.7,-15],[7,1,-2]],['cargo',[0,2,-6],[7,2,-3]]]) {
    await page.evaluate(({eye,target})=>{const t=__tactical;t.camera.position.fromArray(eye);t.camera.lookAt(...target);t.camera.updateMatrixWorld(true);t.renderer.info.reset();t.renderer.render(t.scene,t.camera);},{eye,target});
    await page.screenshot({path:resolve(evidence,name+'.png')});
    if(name==='sea'&&audit){
      const motion=await page.evaluate(()=>{
        const t=__tactical,d=t.scene.getObjectByName('transport-environment-dynamics'),gl=t.renderer.getContext();
        const pixels=()=>{const a=new Uint8Array(800*200*4);gl.readPixels(200,120,800,200,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
        d.userData.update(12);t.renderer.render(t.scene,t.camera);const a=pixels();
        d.userData.update(12.45);t.renderer.render(t.scene,t.camera);const b=pixels();
        let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>3)changed++;
        return changed;
      });
      assert(motion>1000,'water changes in rendered GPU pixels, with camera and rain frozen');audit.waterMotionPixels=motion;
      await page.screenshot({path:resolve(evidence,'sea-phase-b.png')});
    }
  }
  if(audit){
    const source=audit.sources.find(s=>s.x>5&&s.x<8&&s.z> -6&&s.z<0);
    await page.evaluate(s=>{const t=__tactical;t.camera.position.set(s.x-1.4,1.25,s.z-2.3);t.camera.lookAt(s.x,1.5,s.z);t.camera.updateMatrixWorld(true);t.renderer.render(t.scene,t.camera);},source);
    await page.screenshot({path:resolve(evidence,'runoff.png')});
  }
  assert.deepEqual(errors,[]);const video=page.video();await context.close();
  await video.saveAs(resolve(evidence,'motion.webm'));
  await writeFile(resolve(evidence,'report.json'),JSON.stringify({audit,metrics,startPos,endPos,errors,requests:requests.length},null,2));
 }
 console.log('PASS: transport dynamics capture');
}finally{await browser.close()}
