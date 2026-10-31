import assert from 'node:assert/strict';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/?debug=streak-icon&debugMap=transport&debugAutoStart=1&debugNoEnemies=1');
 await page.waitForFunction(()=>window.__tactical?.onKill,null,{timeout:120000});await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
 const result=await page.evaluate(async()=>{
  const t=__tactical;t.pause();const calls=[{head:true,gold:false,details:{}},{head:true,gold:true,details:{}},{head:false,gold:false,details:{grenade:true}},{head:true,gold:true,details:{penetratedWood:true}},{head:false,gold:false,details:{}},{head:true,gold:false,details:{}},{head:true,gold:true,details:{penetratedWood:true}},{head:false,gold:false,details:{grenade:true}}],out=[];
  for(const c of calls){t.onKill(c.head,'敌人','测试武器',c.gold,c.details);const el=document.querySelector('#killIcon'),img=el.querySelector('img');if(img&&!img.complete)await new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})});const row={streak:t.streak().count,src:img?.getAttribute('src'),loaded:!!img?.naturalWidth,className:el.className,diag:t.killIcon()};if(t.streak().count===2){img.dispatchEvent(new Event('error'));row.fallback={tier:el.querySelector('svg')?.dataset.tier,head:!!el.querySelector('.ki-hs')};}out.push(row);}
  return out;
 });
 assert.equal(result[0].src,'./assets/ui/ember-kills/head.png');assert.deepEqual(result[1].fallback,{tier:'2',head:false});
 for(let i=1;i<6;i++){assert.equal(result[i].src,`./assets/ui/ember-kills/streak-${i+1}.png`);assert.equal(result[i].diag.kind,'hit');assert.equal(result[i].diag.tier,i+1)}
 for(const i of [6,7]){assert.equal(result[i].src,'./assets/ui/streak_eagle.png');assert.equal(result[i].diag.highStreakEagle,true)}
 assert.ok(result.every(x=>x.loaded),'all selected images load');assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
