import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { GroundNavigation } from '../scripts/navigation.js';
import { lingyinLayout } from '../scripts/lingyin_layout.js';

const map = lingyinLayout();
assert.equal(map.spawns.player.length,8);
assert.equal(map.spawns.enemy.length,8);
for (const spawn of [...map.spawns.player,...map.spawns.enemy]) {
  assert.equal(map.surfaceAt(spawn[0],spawn[2],.5),0,'spawn has ground');
  assert.equal(map.colliders.some(c =>
    spawn[0] > c.x-c.hx-.48 && spawn[0] < c.x+c.hx+.48 &&
    spawn[2] > c.z-c.hz-.48 && spawn[2] < c.z+c.hz+.48 &&
    c.y0 < 1.8 && c.y0+c.h > .05),false,'spawn must clear authored obstacles');
}
const nav = new GroundNavigation(map.colliders,map.bounds,{
  maxHeight:map.navigationMaxHeight,step:map.navigationStep,climb:map.stepHeight,
  surfaceAt:map.surfaceAt,surfacesAt:map.surfacesAt,
});
assert.ok(nav.points.length>3000);
for (const target of [map.spawns.enemy[0],map.spawns.enemy[4]]) {
  nav.update({x:target[0],y:target[1],z:target[2]});
  for (const spawn of map.spawns.player) {
    const index = nav.nearest(spawn[0],spawn[2],spawn[1]);
    assert.ok(index>=0 && nav.distance[index]>0,'all player spawns connect to enemy side');
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
assert.match(main,/lingyin: \(\) => import\('\.\/lingyin_map\.js\?v=27'\)/);
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
assert.match(lingyinRuntime,/setDRACOLoader\(draco\)/);
assert.match(lingyinRuntime,/lingyin-buddha-scan/);
assert.match(lingyinRuntime,/statueLOD\.addLevel/);
console.log(`Lingyin team map: ${map.colliders.length} collision brushes, ${nav.points.length} navigation nodes, 16 clear reachable spawns`);
