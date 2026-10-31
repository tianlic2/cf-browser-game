import assert from 'node:assert/strict';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/?debug=well&debugMap=lingyin&debugAutoStart=1&debugNoEnemies=1');
 await page.waitForFunction(()=>window.__tactical?.enemyManager.navigation,null,{timeout:120000});
 await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
 const audit=await page.evaluate(async()=>{
  const t=__tactical;t.pause();const {LINGYIN_WELL:W}=await import('/scripts/lingyin_well_layout.js');const {intersectsBrush}=await import('/scripts/brush_collision.js');const colliders=t.colliders(), nav=t.enemyManager.navigation,w=t.scene.getObjectByName('lingyin-old-well');t.scene.updateMatrixWorld(true);
  const named=colliders.filter(c=>c.name?.startsWith('old-well'));const center=new t.THREE.Box3().setFromObject(w);const samples=[];
  for(let i=0;i<16;i++){const a=i*Math.PI/8,x=W.x+Math.cos(a)*.9,z=W.z+Math.sin(a)*.9;samples.push(colliders.some(c=>c.name==='old-well-body'&&intersectsBrush(c,x,z,0,.45,.52,1.78,colliders,nav.surfaceAt)))}
  nav.update({x:-25,y:0,z:28});const around=[[-31,19],[-26,19],[-31,25],[-26,25]].map(([x,z])=>{const i=nav.nearest(x,z,0);return {index:i,distance:nav.distance[i],point:nav.point(i)}});
  const disconnected=t.mapState().spawns.player.filter(([x,y,z])=>nav.distance[nav.nearest(x,z,y)]<0);
  const prox=t.obstacles().filter(o=>o.name.startsWith('old-well'));const ray=new t.THREE.Raycaster(new t.THREE.Vector3(W.x-2,.3,W.z),new t.THREE.Vector3(1,0,0),0,3);const hit=ray.intersectObjects(prox,false)[0];
  return {bounds:[center.min.toArray(),center.max.toArray()],names:named.map(c=>c.name),samples,around,disconnected,hit:hit?.point.toArray(),materials:w.children.map(o=>o.material.name),stats:t.renderStats()};
 });
 assert.equal(audit.names.length,4);assert.ok(audit.samples.every(Boolean));assert.ok(audit.around.every(n=>n.index>=0&&n.distance>=0));assert.deepEqual(audit.disconnected,[]);assert.ok(audit.hit&&Math.abs(audit.hit[0]-(-29-.67))<.12);assert.ok(audit.bounds[0][0]<-29.7&&audit.bounds[1][0]>-28.3);assert.deepEqual(errors,[]);
 await page.evaluate(()=>{const t=__tactical;t.player.pos.set(-33.5,0,22);t.player.yaw=-Math.PI/2;t.player.pitch=0;t.resume()});
 await page.waitForTimeout(500);await page.screenshot({path:'/private/tmp/lingyin-well-overview.png'});
 await page.evaluate(()=>{Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.getElementById('viewport')});document.dispatchEvent(new Event('pointerlockchange'));const t=__tactical;t.player.pos.set(-32,0,22);t.player.vel.set(0,0,0);t.player.yaw=-Math.PI/2;t.player.pitch=0;t.player.onGround=true;t.resume()});
 await page.bringToFront();await page.keyboard.down('w');await page.waitForTimeout(1800);await page.keyboard.up('w');
 const position=await page.evaluate(()=>{__tactical.pause();return __tactical.player.pos.toArray()});assert.ok(position[0]<-29.8&&position[0]>-31.7,`player stops against well: ${position}`);
 await page.screenshot({path:'/private/tmp/lingyin-well-game.png'});console.log(JSON.stringify({audit,position,errors},null,2));
}finally{await browser.close()}
