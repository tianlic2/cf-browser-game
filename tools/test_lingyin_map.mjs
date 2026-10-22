import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { GroundNavigation } from '../scripts/navigation.js';
import { intersectsBrush } from '../scripts/brush_collision.js';
import { lingyinLayout } from '../scripts/lingyin_layout.js';

const map = lingyinLayout();
assert.equal(map.spawns.player.length,30);
assert.equal(map.spawns.enemy.length,30);
assert.ok(new Set(map.spawns.player.map(p=>p[3])).size>=9,
  'respawns cover courtyards, halls, the west ascent and ridge pavilion');
for (const spawn of [...map.spawns.player,...map.spawns.enemy]) {
  assert.ok(Math.abs(map.surfaceAt(spawn[0],spawn[2],spawn[1]+.05)-spawn[1])<.02,
    `spawn has visible ground at ${spawn}`);
  assert.equal(map.colliders.some(c => intersectsBrush(c,spawn[0],spawn[2],spawn[1],
    .45,map.stepHeight,1.78,map.colliders,map.surfaceAt)),false,
    `spawn must clear authored obstacles at ${spawn}`);
}
const nav = new GroundNavigation(map.colliders,map.bounds,{
  maxHeight:map.navigationMaxHeight,step:map.navigationStep,climb:map.stepHeight,
  surfaceAt:map.surfaceAt,surfacesAt:map.surfacesAt,
});
assert.ok(nav.points.length>3000);
for (const target of [map.spawns.enemy[0],map.spawns.enemy[14]]) {
  nav.update({x:target[0],y:target[1],z:target[2]});
  for (const spawn of [...map.spawns.player,...map.spawns.enemy]) {
    const index = nav.nearest(spawn[0],spawn[2],spawn[1]);
    assert.ok(index>=0 && Math.abs(nav.point(index).y-spawn[1])<.52 &&
      nav.distance[index]>=0,`all distributed spawns connect at ${spawn}`);
  }
}
const rooms = [
  ['山门',-2,40,1.05],['大雄宝殿',-2,-6,1.35],
  ['西侧殿',-25.5,7,.95],['东侧殿',19,7,.95],['后殿',-2,-37,1.15],
];
for(const spawn of [map.spawns.player[0],map.spawns.enemy[0]]) {
  nav.update({x:spawn[0],y:spawn[1],z:spawn[2]});
  for(const [name,x,z,y] of rooms) {
    assert.ok(Math.abs(map.surfaceAt(x,z,1.6)-y)<.01,`${name} has a walkable indoor floor`);
    const index=nav.nearest(x,z,y);
    assert.ok(index>=0&&Math.abs(nav.point(index).y-y)<.1&&nav.distance[index]>0,
      `${name} is reachable from both teams`);
  }
}
const main = readFileSync(new URL('../scripts/main.js',import.meta.url),'utf8');
const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(main,/lingyin: \{ name: '灵隐寺', poster:/);
assert.match(main,/lingyin: \(\) => import\('\.\/lingyin_map\.js\?v=[^']+'\)/);
assert.match(html,/data-map="lingyin"/);
assert.ok(statSync(new URL('../scripts/lingyin_world.js',import.meta.url)).size>50000);
assert.ok(statSync(new URL('../assets/lingyin/lotus-mural.jpg',import.meta.url)).size>100000,
  'interior mural texture is available at runtime');
const statue = readFileSync(new URL('../assets/lingyin/buddha-clay-scan.glb',import.meta.url));
assert.equal(statue.toString('ascii',0,4),'glTF','scanned Buddha is a GLB asset');
assert.ok(statue.length>100000,'scanned Buddha geometry is present');
const statueFar = readFileSync(new URL('../assets/lingyin/buddha-clay-scan-lod.glb',import.meta.url));
assert.equal(statueFar.toString('ascii',0,4),'glTF','distant Buddha is a GLB asset');
const statuePrimitive = file => {
  const json = JSON.parse(file.subarray(20,20+file.readUInt32LE(12)).toString());
  const primitive = json.meshes[0].primitives[0];
  return { indices:json.accessors[primitive.indices].count,
    bounds:json.accessors[primitive.attributes.POSITION] };
};
const nearMesh = statuePrimitive(statue), farMesh = statuePrimitive(statueFar);
assert.ok(farMesh.indices < nearMesh.indices*.25,'distant scan must be substantially lighter');
for (const edge of ['min','max']) for (let axis=0;axis<3;axis++) {
  assert.ok(Math.abs(nearMesh.bounds[edge][axis]-farMesh.bounds[edge][axis])<.1,
    'scanned Buddha LODs must share the same placement bounds');
}
assert.ok(statSync(new URL('../vendor/three/examples/jsm/libs/draco/draco_decoder.wasm',import.meta.url)).size>100000,
  'local Draco decoder is bundled for the scanned statue');
const lingyinRuntime = readFileSync(new URL('../scripts/lingyin_map.js',import.meta.url),'utf8');
const lingyinWorldBundle = readFileSync(new URL('../scripts/lingyin_world.js',import.meta.url),'utf8');
const gateBridge = readFileSync(new URL('../lingyin-map/src/gate-kit/world/gate.ts',import.meta.url),'utf8');
assert.match(gateBridge,/templePlaqueTexture\('gate'\)/,
  'the existing Lingyin sign artwork stays on the replacement gate');
assert.match(gateBridge,/buildCeiling\(\)/);
assert.match(gateBridge,/buildIvy\(\)/);
assert.match(gateBridge,/stoneMaterial as templeStoneMaterial/,
  'gate rails reuse the temple terrace stone material family');
assert.match(gateBridge,/gate-stone-balustrades/,
  'the gate-side fence is the same stone balustrade language as the temple');
assert.doesNotMatch(gateBridge,/box\(0\.05, 0\.85, 0\.05/,
  'the former dense timber picket fence is removed');
assert.match(lingyinRuntime,/new GateGround\(\{gameMap:true\}\)/,
  'the new stone approach is attached to the playable map');
const gateGroundSource=readFileSync(new URL(
  '../lingyin-map/src/gate-kit/world/ground.ts',import.meta.url),'utf8');
assert.match(gateGroundSource,/courtyardPavingExtensionMaterial\(width,depth\)/,
  'gate interior and exterior use the same photographed courtyard stone');
assert.doesNotMatch(gateGroundSource,/this\.gameMap \? 45 : 64/,
  'the gate approach no longer overlaps the courtyard paving');
assert.match(lingyinRuntime,/new GateFramingTrees\(\{gamePerimeter:true\}\)/,
  'the new nearby trees and plant layers are attached');
const gateVegetation=readFileSync(new URL(
  '../lingyin-map/src/gate-kit/world/vegetation.ts',import.meta.url),'utf8');
assert.match(gateVegetation,/addBoundaryGrove\(\)/);
assert.match(gateVegetation,/forecourt-boundary-trunks/,
  'dense trees visibly explain the outer movement boundary');
assert.equal(map.colliders.some(c => c.z === 45.7 && c.hz === .14 && c.h === 1.35),false,
  'the removed timber entry fence leaves no invisible collision');
assert.match(lingyinRuntime,/setDRACOLoader\(draco\)/);
assert.match(lingyinRuntime,/createMainHallInterior\(temple/,
  'the reviewed three-figure hall is attached to the playable map');
for(const name of ['ridge-pavilion-stone','ridge-pavilion-timber','ridge-pavilion-roof'])
  assert.match(lingyinWorldBundle,new RegExp(name),`${name} is bundled into the playable map`);
assert.doesNotMatch(lingyinRuntime,/lingyin-buddha-scan|statueLOD\.addLevel/,
  'the old standalone statue is no longer duplicated');
for(const name of ['dragon-coffer','painted-beam','worn-red-lacquer',
  'aged-stone-floor','carved-altar','red-ceramic-roof']){
  assert.ok(statSync(new URL(`../assets/lingyin/hall-preview/${name}.webp`,import.meta.url)).size>10000,
    `${name} is present for the playable hall`);
}
assert.match(readFileSync(new URL('../scripts/lingyin_world.js',import.meta.url),'utf8'),
  /lingyin-main-hall-interior/,'game bundle contains the shared hall geometry');
console.log(`Lingyin team map: ${map.colliders.length} collision brushes, ${nav.points.length} navigation nodes, ${map.spawns.player.length} clear spawn sites per team`);
