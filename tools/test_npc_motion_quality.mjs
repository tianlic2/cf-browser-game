import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');
const moduleOf = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const { advanceFacing, angleDelta, separationOffset } = await moduleOf(await read('scripts/npc_motion.js'));
const actor = (x=0,y=0,z=0) => ({group:{position:{x,y,z},rotation:{y:0}},seed:.8,speed:4,turnVel:0});
const out={};
const self=actor();
const separate=peers=>separationOffset(self,peers,1/60,1.6,3.2,.35,out);
assert.deepEqual(separate([self]),{x:0,z:0},'lone NPC has no phantom drift');
assert.deepEqual(separate([actor(10)]),{x:0,z:0},'distant NPC has no influence');
assert.deepEqual(separate([actor(0,3)]),{x:0,z:0},'no pushing across floors');
assert.deepEqual(separate([{...actor(.1),dead:true}]),{x:0,z:0},'corpses do not steer living NPCs');
assert.deepEqual(separate([actor(-.8),actor(.8)]),{x:0,z:0},'balanced neighbours do not create arbitrary drift');
assert.ok(separate([actor(.3)]).x<0,'actual nearby actors repel');
assert.ok(Math.hypot(out.x,out.z)<=.35*4/60+1e-10,'separation is capped by legal frame movement');
assert.ok(Math.hypot(...Object.values(separate([actor()])))>0,'coincident actors can separate');
for(const fps of [20,30,60,144]) {
  const bot=actor();
  let previous=0;
  for(let i=0;i<fps*3;i++) {
    advanceFacing(bot,1.2,1/fps,3.4);
    assert.ok(bot.group.rotation.y>=previous-1e-10,'fixed-heading turn is monotonic');
    assert.ok(bot.group.rotation.y<=1.2+1e-10,'turn does not overshoot');
    assert.ok(Math.abs(bot.turnRate)<=3.4+1e-10);
    previous=bot.group.rotation.y;
  }
  assert.ok(Math.abs(angleDelta(1.2,bot.group.rotation.y))<.001);
  bot.group.rotation.y=Math.PI-.01;bot.turnVel=0;
  advanceFacing(bot,-Math.PI+.01,1/fps,3.4);
  assert.ok(bot.group.rotation.y>Math.PI-.01,'wraparound takes the short arc');
}
console.log('PASS: stable turns at 20/30/60/144fps; separation only for real neighbours.');

const THREE=await moduleOf(await read('vendor/three/build/three.module.js'));
const mapSource=(await read('scripts/map_texture_quality.js')).replace("import * as THREE from 'three';",'');
const configureMapTexture=new Function('THREE',mapSource.replace('export function','function')+';return configureMapTexture;')(THREE);
const light=configureMapTexture(new THREE.Texture(),true);
assert.equal(light.generateMipmaps,false);
assert.equal(light.minFilter,THREE.LinearFilter);
assert.equal(light.anisotropy,1);
const surface=configureMapTexture(new THREE.Texture());
assert.equal(surface.generateMipmaps,true);
assert.equal(surface.minFilter,THREE.LinearMipmapLinearFilter);
assert.equal(surface.anisotropy,16);
assert.equal(surface.colorSpace,THREE.SRGBColorSpace);
for(const name of ['classic_map','blacktown_map','survivor_map','prison_map'])
  assert.match(await read('scripts/'+name+'.js'),/configureMapTexture\(/);
console.log('PASS: atlas lightmaps cannot bleed through mip levels; map albedo keeps trilinear/anisotropic filtering.');
