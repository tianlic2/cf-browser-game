import assert from 'node:assert/strict';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const root=process.env.CF_PUBLIC_ROOT || '/private/tmp/cf-public-release';
const evidence='/private/tmp/cf-public-evidence';await mkdir(evidence,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary',
'.woff':'font/woff','.woff2':'font/woff2','.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
try{
 for(const map of (process.argv[2]?.split(',') || ['transport','blacktown','lingyin'])){
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
  const before=await page.evaluate(()=>__tactical.player.pos.toArray());
  await page.keyboard.down('w');await page.waitForTimeout(1000);await page.keyboard.up('w');
  const after=await page.evaluate(()=>__tactical.player.pos.toArray());
  if(map!=='lingyin'){
   await page.mouse.down();await page.waitForTimeout(550);await page.mouse.up();
   await page.keyboard.press('r');await page.waitForTimeout(2800);
   await page.keyboard.press('2');await page.waitForTimeout(650);
   await page.keyboard.press('1');await page.waitForTimeout(650);
  }
  await page.evaluate(()=>__tactical.renderStats());await page.waitForTimeout(2500);
  const metrics=await page.evaluate(()=>({render:__tactical.renderStats(),map:__tactical.mapState(),weapon:__tactical.curId()}));
  assert(before.every(Number.isFinite)&&after.every(Number.isFinite));
  assert(Math.hypot(...before.map((x,i)=>x-after[i]))>.1,'real keyboard movement');
  assert.deepEqual(errors,[]);
  assert(!requests.some(p=>/harbor_|\/hbr7\/|\/m4_ironbeast\/|\/kukri_dragon\/|\/assets\/local\/(?!fox_npc)/.test(p)));
  await page.screenshot({path:resolve(evidence,map+'.png')});
  const result={map,bootMs,bootMiB:+(bootBytes/1048576).toFixed(2),totalMiB:+(bytes/1048576).toFixed(2),requests:requests.length,
   movement:Math.hypot(...before.map((x,i)=>x-after[i])),errors,metrics};
  report.push(result);await writeFile(resolve(evidence,map+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await context.close();
 }
 await writeFile(resolve(evidence,'report.json'),JSON.stringify(report,null,2));
 console.log('PASS: requested public maps, real movement, combat/reload/switching, no missing or complex weapon requests.');
}finally{await browser.close()}
