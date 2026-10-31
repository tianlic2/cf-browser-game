import assert from 'node:assert/strict';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/?debug=lingyin-new-match&debugMap=lingyin&debugAutoStart=1');
 await page.waitForFunction(()=>window.__tactical?.enemyManager?.enemies?.length>0,null,{timeout:120000});
 await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
 const before=await page.evaluate(()=>__tactical.enemyManager.enemies.map(e=>e.group.position.toArray()));
 await page.waitForTimeout(10000);
 const after=await page.evaluate(()=>({positions:__tactical.enemyManager.enemies.map(e=>e.group.position.toArray()),stats:__tactical.renderStats()}));
 assert.ok(after.positions.length>0&&after.positions.every(p=>p.every(Number.isFinite)));assert.ok(after.positions.some((p,i)=>before[i]&&Math.hypot(p[0]-before[i][0],p[2]-before[i][2])>.1),'NPCs move during active match');assert.deepEqual(errors,[]);
 await page.screenshot({path:'/private/tmp/lingyin-new-match.png'});console.log(JSON.stringify({count:after.positions.length,stats:after.stats,errors}));
}finally{await browser.close()}
