import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../scripts/render_budget.js',import.meta.url),'utf8');
const {RenderBudget}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const budget=new RenderBudget();
assert.equal(budget.setViewport(1280,720,2),1.75);
assert.ok(1920*1080*budget.setViewport(1920,1080,2)**2<=3000001,'bounded pixel cost on Retina');
assert.equal(budget.setViewport(1280,720,1),1,'ordinary screens retain native rendering');
for(let t=0;t<15000;t+=30)assert.equal(budget.sample(30,t,true),null,'native 1x must not become a blurry sub-native image');
assert.equal(budget.scale,1,'unapplied quality changes cannot leak into a future resize');
budget.setViewport(1280,720,2);
budget.sample(16,15001,false);
for(let t=15002;t<17990;t+=30)assert.equal(budget.sample(30,t,true),null,'ignore loading/entry settling');
let lowered=null;
for(let t=18000;t<23000;t+=30){const next=budget.sample(30,t,true);if(next!==null){lowered=next;break;}}
assert.ok(lowered<1.75&&lowered>=1,'sustained slow frames reduce only rendering resolution');
const frozen=budget.ratio;
for(let t=23000;t<30000;t+=200)assert.equal(budget.sample(250,t,true),null,'debugger/background gaps are not a GPU signal');
assert.equal(budget.ratio,frozen);
assert.equal(budget.sample(16,30000,false),null);
let restored=false;
for(let t=30001;t<50000;t+=16.67)if(budget.sample(16.67,t,true)>frozen){restored=true;break;}
assert.ok(restored,'quality returns gradually after sustained stable frames');
const main=await readFile(new URL('../scripts/main.js',import.meta.url),'utf8');
assert.match(main,/renderBudget\.sample\(rawDt\*1000/);
assert.match(main,/!document\.hidden&&!matchPaused/);
assert.doesNotMatch(source,/camera|player\.|damage|collider|pitch|yaw/,'budget cannot change aiming, movement or simulation');
console.log('render budget passed: Retina pixel cap, native floor, settling/cooldown, hidden-tab immunity, gradual recovery');
