import assert from 'node:assert/strict';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const root=process.env.CF_PUBLIC_ROOT || '/private/tmp/cf-public-release';
const evidence='/private/tmp/cf-flight-evidence';await mkdir(evidence,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary',
'.woff':'font/woff','.woff2':'font/woff2','.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const browser=await chromium.launch({channel:'chrome',headless:true});
const report=[];
try{
 for(const map of (process.argv[2]?.split(',') || ['transport','blacktown'])){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page=await context.newPage();const errors=[],requests=[];let bytes=0;
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});
  page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',m.text().slice(0,500))});
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico')){errors.push(r.status()+' '+r.url());console.error('HTTP',r.status(),r.url())}});
  await page.addInitScript(()=>{localStorage.setItem('cf.playerSkillsEnabled','true');let owner=null;Object.defineProperty(document,'pointerLockElement',{get:()=>owner});
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
  await page.evaluate(()=>{__tactical.freezeEnemies(true);__tactical.pause();});
  const groundY=await page.evaluate(()=>__tactical.player.pos.y);
  await page.keyboard.press('z');
  await page.evaluate(()=>{for(let i=0;i<30;i++)__tactical.movementStep(1/60)});
  assert((await page.evaluate(()=>__tactical.player.pos.y))>groundY+.1,'Z makes a collision-safe takeoff');
  assert.equal(await page.evaluate(()=>__tactical.skillState().flight.active),true);
  // Open sky isolates lift/hover/steering from a spawn room's real ceiling.
  await page.evaluate(()=>{const t=__tactical;t.player.pos.y=40;t.player.onGround=false;t.player.vel.set(0,0,0);});
  const step=async(n=60,dt=1/60)=>page.evaluate(([n,dt])=>{for(let i=0;i<n;i++)__tactical.movementStep(dt);return __tactical.player.pos.toArray()},[n,dt]);
  const initial=await step(120);const hover=await step(120);
  assert(Math.abs(hover[1]-initial[1])<.02,'hands-free hover');
  await page.keyboard.down('Space');const up=await step();await page.keyboard.up('Space');await step(60);
  assert(up[1]>hover[1]+3,'Space ascends');
  await page.keyboard.down('Control');const down=await step();await page.keyboard.up('Control');await step(60);
  assert(down[1]<up[1]-2,'Ctrl descends without crouching');
  assert.equal(await page.evaluate(()=>__tactical.player.crouching),false);
  const speeds=await page.evaluate(()=>{const t=__tactical;t.player.yaw=0;t.player.pitch=0;t.player.pos.set(0,30,0);t.player.vel.set(0,0,0);return true});
  await page.keyboard.down('w');const slowStart=await step(60),slowEnd=await step(60);
  await page.keyboard.down('Shift');await step(60);const fastStart=await step(1),fastEnd=await step(60);
  await page.keyboard.up('Shift');await page.keyboard.up('w');await step(60);
  const slow=Math.hypot(...slowEnd.map((v,i)=>v-slowStart[i])),fast=Math.hypot(...fastEnd.map((v,i)=>v-fastStart[i]));
  assert(fast>slow*2,'Shift boosts flight speed');
  // Find actual solid map surfaces rather than inserting fake test walls.
  const contacts=await page.evaluate(async()=>{
   const t=__tactical,cols=t.colliders().filter(c=>!c.dynamicCover),bounds=t.bounds();
   const {brushBottom}=await import(new URL('./scripts/brush_collision.js',location.href).href);
   const clear=(x,z,y)=>Math.abs(x)<bounds.hw-.6 && Math.abs(z)<bounds.hl-.6 && t.skillPlayerMoveAllowed([x,z],[x+.001,z],y);
   let wall,ceiling,floor;
   for(const c of cols){
    if(!wall && c.h-(c.y0||0)>2.2 && c.hz>.55 && c.hx>.1){
     const x=c.x+c.hx+.45+.25,z=c.z,y=Math.max(c.y0||0,0)+.2;
     if(c.h>y+1.78 && clear(x,z,y)&&!t.skillPlayerMoveAllowed([x,z],[c.x,z],y))wall={name:c.name,x,z,y,edge:c.x+c.hx};
    }
    const bottom=brushBottom(c,c.x,c.z,.45),y=bottom-1.78-.2;
    if(!ceiling && Number.isFinite(bottom)&&c.hx>.55&&c.hz>.55 && y>t.supportAt(c.x,c.z,y,.001)+.05 && clear(c.x,c.z,y))
      ceiling={name:c.name,x:c.x,z:c.z,y,bottom};
    if(!floor && c.hx>.6&&c.hz>.6&&c.h>1&&c.h<12&&clear(c.x,c.z,c.h+.5) && Math.abs(t.supportAt(c.x,c.z,c.h+.5,.001)-c.h)<.02)
      floor={name:c.name,x:c.x,z:c.z,y:c.h+.5,top:c.h};
    if(wall&&ceiling&&floor)break;
   }
   return {wall,ceiling,floor};
  });
  assert(contacts.wall&&contacts.ceiling&&contacts.floor,'real wall, ceiling and platform were found: '+JSON.stringify(contacts));
  await page.evaluate(c=>{const p=__tactical.player;p.pos.set(c.x,c.y,c.z);p.vel.set(0,0,0);p.yaw=Math.PI/2;p.pitch=0;p.onGround=false},contacts.wall);
  await page.keyboard.down('w');await page.keyboard.down('Shift');const wallEnd=await step(80,.05);await page.keyboard.up('w');await page.keyboard.up('Shift');
  assert(wallEnd[0]>=contacts.wall.edge+.45-.002,'fast flight cannot cross the real wall');
  await page.evaluate(c=>{const p=__tactical.player;p.pos.set(c.x,c.y,c.z);p.vel.set(0,0,0);p.onGround=false},contacts.ceiling);
  await page.keyboard.down('Space');await page.keyboard.down('Shift');const ceilingEnd=await step(80,.05);await page.keyboard.up('Space');await page.keyboard.up('Shift');
  assert(ceilingEnd[1]+1.78<=contacts.ceiling.bottom+.002,'head cannot cross the real ceiling');
  assert(ceilingEnd[1]>contacts.ceiling.y+.1,'ascent actually reached the ceiling');
  await page.evaluate(c=>{const p=__tactical.player;p.pos.set(c.x,c.y,c.z);p.vel.set(0,0,0);p.onGround=false},contacts.floor);
  await page.keyboard.down('Control');await page.keyboard.down('Shift');const floorEnd=await step(80,.05);await page.keyboard.up('Control');await page.keyboard.up('Shift');
  assert(Math.abs(floorEnd[1]-contacts.floor.top)<.002,'descent lands on the real platform');
  await page.evaluate(()=>{const t=__tactical;t.player.pos.set(0,30,0);t.player.vel.set(0,0,0);t.player.onGround=false;});
  const ammo=await page.evaluate(()=>__tactical.getAmmo().mag);await page.mouse.click(640,360);await page.evaluate(()=>__tactical.simulationStep(.05));
  assert.equal(await page.evaluate(()=>__tactical.getAmmo().mag),ammo-1,'can shoot while flying');
  await page.keyboard.press('Escape');const menuStart=await step(1),menuEnd=await step(120);
  assert.equal(menuEnd[1],menuStart[1],'menu clears flight movement and retains hover');
  await page.locator('#gameMenuResume').click();
  await page.keyboard.press('z');assert.equal(await page.evaluate(()=>__tactical.skillState().flight.active),false);
  const offStart=await step(1),offEnd=await step(30);
  assert(offEnd[1]<offStart[1]-.2,'Z off restores gravity at the current location');
  assert(Math.hypot(offEnd[0],offEnd[2])<.001,'turning off does not teleport to takeoff');
  await page.keyboard.press('z');assert.equal(await page.evaluate(()=>__tactical.skillState().flight.active),true);
  await page.keyboard.press('Escape');await page.locator('#gameMenuSettingsOpen').click();await page.locator('#skillSettingToggle').click();
  assert.equal(await page.evaluate(()=>__tactical.skillState().flight.active),false,'disabling skills cancels flight');
  assert.deepEqual(errors,[]);
  const result={map,hover:true,ascent:true,descent:true,slow,fast,contacts,wallEnd,ceilingEnd,floorEnd,shooting:true,offGravity:true,errors};
  report.push(result);console.log(JSON.stringify(result));await context.close();
 }
 await writeFile(resolve(evidence,'report.json'),JSON.stringify(report,null,2));
 console.log('PASS: Z flight toggles, hover, controls, firing, real wall/ceiling/floor collision, menu and settings cleanup.');
}finally{await browser.close()}
