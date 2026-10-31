import assert from 'node:assert/strict';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/?debug=bio-head-height&debugMap=bio&debugAutoStart=1');
 await page.waitForFunction(()=>window.__tactical?.bioMode?.phase==='prepare',null,{timeout:120000});
 await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
 const results=await page.evaluate(async()=>{
  const t=__tactical,mode=t.bioMode;t.pause();const {isHeadshotIntersection:head}=await import('/scripts/head_hit.js?v=zombie-head-height-1');
  const p=mode.humans[0].group.position;const out=[];
  for(const mother of [false,true]){
   const z=mode.spawnZombie(p.x,p.y,p.z,mother,'test');if(!z)throw Error('zombie spawn failed');
   const synthetic=(height,part='body')=>head({object:{userData:{enemy:z,part}},point:new t.THREE.Vector3(0,z.group.position.y+height,0)});
   const boundary=[synthetic(1.479),synthetic(1.48),synthetic(1.481),synthetic(1.4,'head')];
   z.group.position.y+=4;const elevated=[synthetic(1.479),synthetic(1.481)];
   const frames=[];
   for(const action of ['idle','run','attack']){
    const clip=z.actions.get(action);if(!clip)continue;z.mixer.stopAllAction();clip.reset().play();z.mixer.update(.2);z.group.updateMatrixWorld(true);
    for(const y of [1.2,1.6])for(const axis of [0,1]){
      const origin=new t.THREE.Vector3(z.group.position.x+(axis?0:4),z.group.position.y+y,z.group.position.z+(axis?4:0));const dir=new t.THREE.Vector3(axis?0:-1,0,axis?-1:0);const ray=new t.THREE.Raycaster(origin,dir,0,8);const hit=ray.intersectObjects(z.meshes,false)[0];if(hit)frames.push({action,y,axis,part:hit.object.userData.part,head:head(hit),actualY:hit.point.y-z.group.position.y});
    }
   }
   out.push({mother,hazmat:z.hazmat,height:z.headshotHeight,boundary,elevated,frames});
  }
  return out;
 });
 for(const z of results){assert.deepEqual(z.boundary,[false,true,true,false]);assert.deepEqual(z.elevated,[false,true]);assert.ok(z.frames.some(f=>f.y===1.6&&f.head));assert.ok(z.frames.some(f=>f.y===1.2&&!f.head));assert.ok(z.frames.every(f=>f.head===(f.actualY>=z.height)));}
 assert.deepEqual(results.map(x=>x.hazmat),[false,true]);assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors},null,2));
} finally {await browser.close()}
