import assert from 'node:assert/strict';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/?debug=static-solids-regression&debugMap=lingyin&debugAutoStart=1&debugNoEnemies=1');
 await page.waitForFunction(()=>window.__tactical?.enemyManager.navigation,null,{timeout:120000});
 await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
 const audit=await page.evaluate(async()=>{
  const t=__tactical,w=t.scene.getObjectByName('lingyin-authored-world');t.pause();w.updateMatrixWorld(true);
  const {MAIN_INTERIOR_COLUMNS}=await import('/scripts/lingyin_columns.js');
  const {mainHallPoint}=await import('/scripts/lingyin_main_hall.js');
  const {brushContainsPoint,intersectsBrush}=await import('/scripts/brush_collision.js');
  const body=w.getObjectByName('hall-structure-lacquer'),colliders=t.colliders(),rays=[];
  for(const [i,[x,z]] of MAIN_INTERIOR_COLUMNS.entries())for(const y of [2.1,3,5])for(let n=0;n<8;n++){
   const p=mainHallPoint(x,z),a=n*Math.PI/4,dx=Math.sin(a),dz=Math.cos(a);
   const ray=new t.THREE.Raycaster(new t.THREE.Vector3(p.x+dx*2,y,p.z+dz*2),new t.THREE.Vector3(-dx,0,-dz),0,2.1);
   const visible=ray.intersectObject(body,false)[0];
   const proxy=ray.intersectObjects(t.obstacles().filter(m=>m.name.startsWith(`main-interior-column-${i}-`)),false)[0];
   const c=colliders.find(c=>c.name===`main-interior-column-${i}-1`);
   rays.push({i,y,n,visible:visible?.distance,proxy:proxy?.distance,
    inside:proxy&&brushContainsPoint(c,proxy.point.x-dx*.001,y,proxy.point.z-dz*.001)});
  }
  const nav=t.enemyManager.navigation;nav.update({x:-25,y:0,z:28});
  const otherPoints=[];
  for(const x of [-6,-2.6,2.6,6])for(const z of [-2,2])otherPoints.push({x:-2+x,z:46.85+z,y:1.05});
  const pavilion=w.getObjectByName('phase1-west-boardwalk-v3').userData.terraceLayout.pavilion;
  for(let i=0;i<8;i++){const angle=i*Math.PI/4+Math.PI/8;otherPoints.push({x:pavilion.x+Math.cos(angle)*2.65,z:pavilion.z+Math.sin(angle)*2.65,y:13});}
  const {SMALL_HALLS,smallHallFurnitureBounds}=await import('/scripts/lingyin_small_halls.js');
  for(const hall of SMALL_HALLS)for(const piece of hall.furniture){const p=smallHallFurnitureBounds(piece);otherPoints.push({
   x:hall.x+p.x*Math.cos(hall.rot)+p.z*Math.sin(hall.rot),z:hall.z-p.x*Math.sin(hall.rot)+p.z*Math.cos(hall.rot),y:.95});}
  const otherMissing=otherPoints.filter(p=>!colliders.some(c=>intersectsBrush(c,p.x,p.z,p.y,.45,.52,1.78,colliders,nav.surfaceAt)));
  const disconnected=t.mapState().spawns.player.filter(([x,y,z])=>nav.distance[nav.nearest(x,z,y)]<0);
  const structures=colliders.filter(c=>c.name?.includes('perimeter-column')||c.name?.startsWith('main-interior-column'));
  const unblocked=structures.filter(c=>c.h>2&&c.y0<3&&!colliders.some(b=>intersectsBrush(b,c.x,c.z,1.35,.45,.52,1.78,colliders,nav.surfaceAt)));
  const statues=[];
  w.traverse(o=>{if(o.isLOD&&['hall-central-buddha','hall-flanking-buddha'].includes(o.name)){
   const box=new t.THREE.Box3().setFromObject(o.levels[0].object),centre=box.getCenter(new t.THREE.Vector3());
   statues.push({name:o.name,min:box.min.toArray(),max:box.max.toArray(),
    bodySolid:colliders.some(c=>brushContainsPoint(c,centre.x,centre.y,centre.z))});
  }});
  return {rays,disconnected,unblocked:unblocked.length,statues,otherChecked:otherPoints.length,otherMissing};
 });
 assert.ok(audit.rays.every(r=>Number.isFinite(r.visible)&&Math.abs(r.visible-r.proxy)<.0001&&r.inside),
  'visible shafts, tapered collision planes and bullet proxies match at 144 angles/heights');
 assert.equal(audit.unblocked,0);assert.deepEqual(audit.disconnected,[]);
 assert.deepEqual(audit.otherMissing,[],'gate columns, pavilion columns and all 11 side-room furnishings remain solid');
 await page.evaluate(()=>{Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.getElementById('viewport')});document.dispatchEvent(new Event('pointerlockchange'));
  const t=__tactical;t.player.pos.set(2.15,1.35,-25.294117647);t.player.vel.set(0,0,0);t.player.yaw=-Math.PI/2;t.player.pitch=0;t.player.onGround=true;t.resume();});
 await page.bringToFront();
 await page.keyboard.down('w');await page.waitForTimeout(1500);await page.keyboard.up('w');
 const approach=await page.evaluate(()=>{__tactical.pause();return __tactical.player.pos.toArray()});
 assert.ok(approach[0]<3.3&&approach[0]>2.2,`real game movement stops before the front right column: ${approach}`);
 await page.screenshot({path:'/private/tmp/lingyin-column-collision.png'});
 assert.ok(audit.statues.every(s=>s.bodySolid),'all three visible statue bodies have lightweight physical envelopes');
 const ceilings=[];
 for(const x of [-25.5,19]){
  await page.evaluate(x=>{const t=__tactical;t.player.pos.set(x,.95,7);t.player.vel.set(0,0,0);t.player.onGround=true;t.player.jumpBuf=0;t.player.coyote=0;
   window.__headHeights=[];window.__headRecord=true;const sample=()=>{if(!__headRecord)return;__headHeights.push(t.player.pos.y+1.78);requestAnimationFrame(sample)};requestAnimationFrame(sample);t.resume();},x);
  await page.keyboard.down('Space');await page.waitForTimeout(650);await page.keyboard.up('Space');
  const highest=await page.evaluate(()=>{__headRecord=false;__tactical.pause();return Math.max(...__headHeights)});
  assert.ok(highest<=3.168&&highest>3,'hanging lantern stops an actual jump without blocking normal passage');ceilings.push({x,highest});
 }
 const altarLanding=await page.evaluate(async()=>{const t=__tactical;t.player.pos.set(-2,3.05,-26-2.06*24/17);t.player.vel.set(0,0,0);t.player.onGround=false;t.player.jumpBuf=0;t.player.coyote=0;t.resume();
  await new Promise(r=>setTimeout(r,600));t.pause();return t.player.pos.toArray();});
 assert.ok(Math.abs(altarLanding[1]-2.65)<.01,'landing on the altar does not fall through its tabletop');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({raySamples:audit.rays.length,otherChecked:audit.otherChecked,disconnected:audit.disconnected,unblocked:audit.unblocked,statues:audit.statues,approach,ceilings,altarLanding,errors},null,2));
}finally{await browser.close()}
