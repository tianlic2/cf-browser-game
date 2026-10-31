import assert from 'node:assert/strict';
import {chromium} from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/?debug=new-bridge&debugMap=lingyin&debugAutoStart=1&debugNoEnemies=1');
 await page.waitForFunction(()=>window.__tactical?.enemyManager.navigation,null,{timeout:120000});await page.waitForSelector('#bootScreen',{state:'detached',timeout:120000});
 const result=await page.evaluate(()=>{const t=__tactical;t.pause();const nav=t.enemyManager.navigation,world=t.scene.getObjectByName('lingyin-authored-world');world.updateMatrixWorld(true);const samples=[];
 for(const z of [25,28,31])for(const x of [30.9,33.45,36,38.55,41.1]){const ray=new t.THREE.Raycaster(new t.THREE.Vector3(x,2,z),new t.THREE.Vector3(0,-1,0),0,5);const visual=ray.intersectObject(world,true).find(h=>h.object.name==='temple-stone')?.point.y;const bullet=ray.intersectObjects(t.obstacles(),false).find(h=>h.object.name==='east-bridge-deck')?.point.y;samples.push({x,z,visual,bullet,support:nav.surfaceAt(x,z,1)});}
 nav.update({x:-25,y:0,z:28});const nodes=[25,28,31].map(z=>{const i=nav.nearest(36,z,.66);return {z,index:i,distance:nav.distance[i],point:nav.point(i)}});return {samples,nodes};});
 assert.ok(result.samples.every(s=>Number.isFinite(s.visual)&&Number.isFinite(s.support)&&Math.abs(s.visual-s.support)<.03&&Number.isFinite(s.bullet)&&Math.abs(s.bullet-s.support)<.03),JSON.stringify(result.samples));assert.ok(result.nodes.every(n=>n.index>=0&&n.distance>=0),JSON.stringify(result.nodes));assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser.close()}
