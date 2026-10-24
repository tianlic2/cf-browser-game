import assert from 'node:assert/strict';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/?debug=game-map-update-1&debugMap=lingyin&debugAutoStart=1&debugNoEnemies=1&debugPlayer=-31.2,0,-16,0,0');
 await page.waitForFunction(()=>window.__tactical?.scene.getObjectByName('lingyin-approved-landscape'),null,{timeout:120000});
 await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
 const audit=await page.evaluate(async()=>{
  const t=__tactical,nav=t.enemyManager.navigation;
  const {canMoveThroughBrushes,intersectsBrush}=await import('/scripts/brush_collision.js');
  const world=t.scene.getObjectByName('lingyin-authored-world');
  const board=world.getObjectByName('phase1-west-boardwalk-v3'),nodes=board.userData.route;
  const colliders=t.colliders(),surface=nav.surfaceAt;
  const failures=[],samples=[];
  for(const backwards of [false,true]){
   const route=backwards?[...nodes].reverse():nodes;
   let prev=route[0],y=prev.y;
   for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i],n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.07);
    for(let k=1;k<=n;k++){
     const f=k/n,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f;
     const next=surface(x,z,y+.52);
     if(next===null||Math.abs(next-y)>.521||!canMoveThroughBrushes(colliders,prev.x,prev.z,x,z,y,.45,.52,1.78,surface)){
      failures.push({backwards,i,k,x,z,y,next,blockers:colliders.filter(c=>intersectsBrush(c,x,z,y,.45,.52,1.78,colliders,surface)).slice(0,3)});break;
     }
     y=next;prev={x,z,y};
    }
    samples.push({backwards,i,y});
   }
  }
  nav.update({x:-25,y:0,z:28});
  const connections=nodes.map(p=>{const i=nav.nearest(p.x,p.z,p.y);return {p,index:i,distance:nav.distance[i],actual:nav.point(i)}});
  const terrace=board.userData.terraceLayout;
  const i=nav.nearest(terrace.pavilion.x,terrace.pavilion.z,13);
  connections.push({p:terrace.pavilion,index:i,distance:nav.distance[i],actual:nav.point(i)});
  const deck=world.getObjectByName('phase1-boardwalk-deck');
  const rails=[...board.userData.railLayout.rails,...terrace.rails];
  const unblockedRails=rails.filter(({a,b})=>{
   const x=(a.x+b.x)/2,z=(a.z+b.z)/2,y=(a.y+b.y)/2;
   return !colliders.some(c=>intersectsBrush(c,x,z,y,.45,.52,1.78,colliders,surface));
  }).length;
  const rays=[];world.updateMatrixWorld(true);
  for(const p of nodes){
   const ray=new t.THREE.Raycaster(new t.THREE.Vector3(p.x,30,p.z),new t.THREE.Vector3(0,-1,0));
   const hit=ray.intersectObject(deck,false)[0];
   const bullet=ray.intersectObjects(t.obstacles(),false)[0];
   rays.push({p,visible:hit?.point.y,physical:surface(p.x,p.z,p.y+.52),bullet:bullet?.point.y});
  }
  return {failures,samples,connections,rays,unblockedRails,oldTrail:world.getObjectByName('hillside-pilgrimage-trail')?.visible??false,
   oldWater:world.getObjectByName('water')?.visible??false,stats:t.renderStats(),state:t.mapState()};
 });
 console.log(JSON.stringify({failures:audit.failures,
  connectedStops:audit.connections.filter(c=>c.distance>=0).length,
  matchedDeckSamples:audit.rays.length,unblockedRails:audit.unblockedRails,stats:audit.stats,errors},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(audit.failures,[],'player must walk every flight and join both directions');
 assert.ok(audit.connections.every(c=>c.index>=0&&c.distance>=0&&Math.abs(c.actual.y-c.p.y)<.52),'NPC navigation connects court to terrace');
 assert.equal(audit.oldTrail,false);assert.equal(audit.oldWater,false);
 assert.equal(audit.unblockedRails,0,'every guard section blocks actors');
 for(const r of audit.rays){
  assert.ok(Math.abs(r.visible-r.physical)<.02,'visible/physical deck height matches');
  assert.ok(Math.abs(r.visible-r.bullet)<.02,'bullet proxies use the same world transform and deck triangles');
 }
 // Headless Chrome does not provide native pointer lock. Emulate ONLY its
 // DOM state/event; keyboard handling, game loop and movement stay real.
 await page.evaluate(()=>{
  Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.getElementById('viewport')});
  document.dispatchEvent(new Event('pointerlockchange'));
 });
 await page.keyboard.down('w');await page.waitForTimeout(2200);await page.keyboard.up('w');
 const walked=await page.evaluate(()=>__tactical.player.pos.toArray());
 console.log('Actual player walked up the entrance:',walked);
 assert.ok(walked[1]>2&&walked[2]<-20,'actual game input can climb the entrance without jumping');
 await page.screenshot({path:'/private/tmp/lingyin-game-update-entry.png'});
}finally{await browser.close()}
