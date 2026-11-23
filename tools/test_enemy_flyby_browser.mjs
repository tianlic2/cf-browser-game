import assert from 'node:assert/strict';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const root=process.env.CF_PUBLIC_ROOT || '/private/tmp/cf-public-release';
const evidence='/private/tmp/cf-flyby-evidence';await mkdir(evidence,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary',
'.woff':'font/woff','.woff2':'font/woff2','.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
try{
 for(const map of (process.argv[2]?.split(',') || ['transport'])){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page=await context.newPage();const errors=[],requests=[];let bytes=0;
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});
  page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',m.text().slice(0,500))});
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
  await page.goto('https://tianlic2.github.io/cf-browser-game/?debug=public-release');
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
  await page.evaluate(()=>{const t=__tactical;t.freezeEnemies(true);t.pause();t.clearImpactFx();});
  await page.screenshot({path:resolve(evidence,`${map}-baseline.png`)});
  const visual=await page.evaluate(()=>{
   const t=__tactical,f=t.camera.getWorldDirection(new t.THREE.Vector3()),r=new t.THREE.Vector3().crossVectors(f,t.camera.up).normalize();
   const center=t.camera.position.clone().addScaledVector(f,2),a=center.clone().addScaledVector(r,-8),b=center.clone().addScaledVector(r,8);
   t.enemyRoundFx(a.toArray(),b.toArray(),'ak');t.stepImpactFx(.012);
   t.renderer.info.reset();t.renderer.render(t.scene,t.camera);return {draws:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,fx:t.enemyBulletState()};
  });
  await page.screenshot({path:resolve(evidence,`${map}-streak.png`)});
  console.log('visual',JSON.stringify(visual));
  await page.evaluate(()=>{const t=__tactical;t.freezeEnemies(true);t.pause();t.sfx.ensure();t.clearImpactFx();
    t.player.pos.set(0,40,0);t.player.eyeH=t.EYE;t.player.stepLift=t.player.viewDip=0;
    t.sfx.updateListener({x:0,y:40+t.EYE,z:0},0);});
  const bank=await page.evaluate(()=>{const t=__tactical;return ['whiz','bullet_crack'].map(id=>({id,
   clips:(t.sfx._buffers.get(id)||[]).map(b=>{const x=b.getChannelData(0);return {duration:b.duration,peak:Math.max(...x),samples:x.length}})}));});
  assert(bank.every(b=>b.clips.length===3&&b.clips.every(c=>c.peak>.3&&c.duration<.27)),'six short decoded recordings');
  const synthetic=await page.evaluate(()=>{
   const t=__tactical,y=40+t.EYE;
   t.sfx.cancelFlybys();t.enemyRoundFx([.6,y,-20],[.6,y,20],'cfv_m4a1');
   const state=t.enemyBulletState(),audio=t.audioState();
   t.stepImpactFx(.025);const moved=t.enemyBulletState();
   return {state,audio:audio.flyby,scheduled:audio.scheduled.filter(h=>h.method==='flyby'),moved};
  });
  assert.equal(synthetic.state.tracers.length,1);
  const round=synthetic.state.tracers[0];assert.equal(round.speed,880);assert(round.radius<.006&&round.segment<5);
  assert(synthetic.audio.last.played===2&&Math.abs(synthetic.audio.last.distance-.6)<.001);
  assert(synthetic.scheduled.length===2&&synthetic.scheduled.every(s=>s.delay>.015&&s.delay<.04),'audio reaches the near-pass point with the projectile');
  assert(synthetic.moved.tracers[0].head>20,'fast, moving streak rather than a slow laser');
  await page.waitForTimeout(350);
  const expired=await page.evaluate(()=>{__tactical.stepImpactFx(.5);return {fx:__tactical.enemyBulletState(),audio:__tactical.audioState().flyby}});
  assert.equal(expired.fx.tracers.length,0);assert.equal(expired.audio.active,0,'short-lived audio nodes drain');
  const rejected=await page.evaluate(()=>{const t=__tactical,y=40+t.EYE,played=t.enemyBulletState().played;
   t.sfx.cancelFlybys();t.enemyRoundFx([4,y,-20],[4,y,20],'ak');
   t.enemyRoundFx([.5,y,-20],[.5,y,-2],'ak');t.enemyRoundFx([0,y,-20],[0,y,0],'ak');
   return {playedBefore:played,playedAfter:t.enemyBulletState().played};});
  assert.equal(rejected.playedAfter,rejected.playedBefore,'far miss, stopped-before-listener and direct hit are silent');
  const occluded=await page.evaluate(()=>{
   const t=__tactical;
   for(const c of t.colliders()){
    if(c.dynamicCover||c.hx>.6||c.hz<1||c.h-(c.y0||0)<2)continue;
    const y=(c.y0||0)+.1,x=c.x+c.hx+.5,z=c.z;
    if(!t.skillPlayerMoveAllowed([x,z],[x+.001,z],y))continue;
    t.player.pos.set(x,y,z);const ear=y+t.EYE,before=t.enemyBulletState().occluded;
    t.sfx.cancelFlybys();t.enemyRoundFx([c.x-c.hx-.5,ear,z-2],[c.x-c.hx-.5,ear,z+2],'ak');
    const after=t.enemyBulletState().occluded;
    if(after>before)return {before,after};
   }
   return null;
  });
  assert(occluded,'actual wall between flypast and ears suppresses audio');
  // Isolated stereo render verifies left/right HRTF energy rather than merely checking a node property.
  const stereo=await page.evaluate(async()=>{
   const buffer=__tactical.sfx._buffers.get('whiz')[0],out=[];
   for(const x of [-.7,.7]){
    const c=new OfflineAudioContext(2,24000,48000),src=c.createBufferSource(),pan=c.createPanner();
    src.buffer=buffer;pan.panningModel='HRTF';pan.positionX.value=x;pan.positionZ.value=-.2;
    src.connect(pan).connect(c.destination);src.start();const b=await c.startRendering();
    out.push([0,1].map(ch=>b.getChannelData(ch).reduce((n,s)=>n+s*s,0)));
   }return out;
  });
  assert(stereo[0][0]>stereo[0][1]*1.15&&stereo[1][1]>stereo[1][0]*1.15,'left/right near-passes spatialize to the correct ear');
  const actual=await page.evaluate(()=>{
   const t=__tactical;t.player.pos.set(0,40,0);t.player.eyeH=t.EYE;t.player.stepLift=t.player.viewDip=0;
   const e=t.enemyManager.enemies.find(e=>!e.dead),saved=t.enemyManager.enemies.map(e=>e.wantShoot);
   t.enemyManager.enemies.forEach(e=>e.wantShoot=false);e.group.position.set(0,40,-24);e.eyeline.set(0,41.68,-24);e.group.updateMatrixWorld(true);e.wantShoot=true;e.blindT=0;e.aimFocus=1;
   const shot=e.onShot,random=Math.random;e.onShot=()=>true;Math.random=()=>.5;
   const before=t.enemyBulletState().played;
   try{t.sfx.cancelFlybys();t.enemiesShoot();}finally{Math.random=random;e.onShot=shot;t.enemyManager.enemies.forEach((e,i)=>e.wantShoot=saved[i]);}
   return {before,after:t.enemyBulletState().played,fx:t.enemyBulletState(),audio:t.audioState().flyby};
  });
  assert(actual.after>actual.before,'formal NPC miss triggers a clipped near-pass');
  assert(actual.fx.tracers.length>0&&actual.audio.last.delay>0);
  const budget=await page.evaluate(()=>{const t=__tactical;t.sfx.cancelFlybys();const y=40+t.EYE;
    for(let i=0;i<50;i++)t.enemyRoundFx([.5,y,-20],[.5,y,20],'ak');
    const active=t.audioState().flyby.active;t.sfx.cancelFlybys();t.clearImpactFx();return {active,pool:t.enemyBulletState().tracers.length};});
  assert(budget.active<=6&&budget.pool===0,'bounded voices and clean reset under bursts');
  await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__tactical.audioState().flyby.active),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({map,bank,round,scheduled:synthetic.scheduled,occluded,stereo,actual:{played:actual.after-actual.before,delay:actual.audio.last.delay},budget,errors}));
  report.push({map,bank,round,stereo,occluded,budget,visual});await context.close();
 }
 await writeFile(resolve(evidence,'report.json'),JSON.stringify(report,null,2));
 console.log('PASS: NPC tracer speed/lifetime, decoded recordings, arrival scheduling, stereo direction, real-wall occlusion, real NPC miss and burst cleanup.');
}finally{await browser.close()}
