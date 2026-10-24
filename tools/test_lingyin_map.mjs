import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { GroundNavigation } from '../scripts/navigation.js';
import { intersectsBrush } from '../scripts/brush_collision.js';
import { lingyinLayout } from '../scripts/lingyin_layout.js';

const map = lingyinLayout();
assert.equal(map.spawns.player.length,25);
assert.equal(map.spawns.enemy.length,25);
assert.ok(new Set(map.spawns.player.map(p=>p[3])).size>=7,
  'respawns cover connected courtyards and halls without using the sealed west route');
assert.equal(map.spawns.player.some(p=>p[3]==='west-ascent'||p[3]==='ridge-pavilion'),false,
  'no team may spawn outside the sealed west gate');
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
  ['山门',-2,46.85,1.05],['大雄宝殿',-2,-19,1.35],
  ['西侧殿',-25.5,7,.95],['东侧殿',19,7,.95],
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
const layoutSource = readFileSync(new URL('../scripts/lingyin_layout.js',import.meta.url),'utf8');
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
const heightfieldSource = readFileSync(new URL(
  '../lingyin-map/src/world/heightfield.ts',import.meta.url),'utf8');
assert.match(heightfieldSource,/size:\s*170/,
  'visual terrain is cropped to the playable Lingyin footprint');
assert.doesNotMatch(heightfieldSource,/\bgauss\(|\bridged2\(/,
  'the inaccessible surrounding mountain height fields are removed');
assert.match(heightfieldSource,/if\(underTemple\|\|underForecourt\)return Math\.min\(h,P\.y-\.14\)/,
  'rendered terrain is buried beneath the temple and forecourt paving');
assert.doesNotMatch(lingyinRuntime,/\bBackdrop\b|attach\(Crag/,
  'the playable map no longer builds distant mountain rings or Feilai Feng scenery');
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
const detailsSource=readFileSync(new URL(
  '../lingyin-map/src/world/details.ts',import.meta.url),'utf8');
assert.match(gateGroundSource,/courtyardPavingExtensionMaterial\(width,depth\)/,
  'gate interior and exterior use the same photographed courtyard stone');
assert.match(detailsSource,/temple-enclosure-photographic-paving/,
  'all terrain inside the temple enclosure is covered by the gate forecourt stone');
assert.match(detailsSource,/courtyardPavingExtensionMaterial\(width,depth\)/,
  'enclosure paving preserves the same real-world texture scale as the gate forecourt');
assert.doesNotMatch(detailsSource,/prayerRibbons|#8e2f24/,
  'the obsolete red prayer-ribbon line is removed from the courtyard');
assert.doesNotMatch(layoutSource,/prayer-ribbon posts|\[-12,8\]\)add\(x,37/,
  'removed prayer-ribbon posts leave no invisible collision behind');
assert.doesNotMatch(detailsSource,/textTexture\('冷泉'/,
  'the courtyard stele no longer stretches and crops oversized lettering');
assert.match(detailsSource,/const slabStone = stoneMaterial\(0\.42\)/,
  'the stele face uses the same photographed weathered-stone family as the temple');
assert.doesNotMatch(detailsSource,/this\.puddles\(\)|private puddles\(|new THREE\.ShapeGeometry\(shape\)/,
  'coplanar transparent courtyard puddles are removed to eliminate z-fighting');
assert.match(gateGroundSource,/FRONT_GATE_FORECOURT\.z1-FRONT_GATE_FORECOURT\.z0/,
  'gate paving begins outside the enclosure rather than overlapping its new full paving');
assert.doesNotMatch(gateGroundSource,/this\.gameMap \? 45 : 64/,
  'the gate approach no longer overlaps the courtyard paving');
assert.match(lingyinRuntime,/new GateFramingTrees\(\{gamePerimeter:true\}\)/,
  'the new nearby trees and plant layers are attached');
const gateVegetation=readFileSync(new URL(
  '../lingyin-map/src/gate-kit/world/vegetation.ts',import.meta.url),'utf8');
assert.match(gateVegetation,/addBoundaryWall\(\)/);
assert.match(gateVegetation,/base: \[-12\.8, -0\.5\]/,
  'the courtyard-left framing tree is moved toward the gate');
assert.match(gateVegetation,/base: \[12\.6, -1\.7\]/,
  'the courtyard-right framing tree is moved toward the gate');
assert.match(detailsSource,/g\.position\.set\(7\.5, heightAt\(7\.5, 36\.5\), 36\.5\)/,
  'the narrow courtyard stele moves gateward with the two trees');
assert.match(layoutSource,/\[-12\.8,-\.5,\.86\].*\[12\.6,-1\.7,\.8\]/,
  'tree collision trunks follow the shifted visual trees');
assert.match(layoutSource,/add\(7\.5,36\.5,1\.06,\.86,0,2\.9\)/,
  'the stele collision follows its shifted visible mesh');
assert.match(gateVegetation,/if \(z < 5\.7\) continue/,
  'raised moss blobs are excluded from the photographed temple paving');
const worldVegetation=readFileSync(new URL(
  '../lingyin-map/src/world/vegetation.ts',import.meta.url),'utf8');
assert.match(worldVegetation,/insidePlatform\(x, z, 2\.2 \* s \+ 1\)/,
  'large exterior boulders reserve their full radius from the temple platform');
assert.doesNotMatch(gateVegetation,/addBoundaryGrove\(\)|forecourt-boundary-(?:trunks|canopy)/,
  'the coarse animated tree ring is removed from the forecourt boundary');
for(const name of ['forecourt-boundary-stone-base','forecourt-boundary-plaster',
  'forecourt-boundary-roof-cap','forecourt-boundary-timber-posts'])
  assert.match(gateVegetation,new RegExp(name),`${name} forms the low-cost visible boundary`);
assert.match(lingyinRuntime,/lingyin_world\.js\?v=85/,
  'the boundary-wall visual bundle is cache-busted');
assert.match(gateVegetation,/const footingBottom=-\.02,footingTop=1\.11/,
  'the expanded side-wing boundary has a continuous ground footing');
assert.match(gateVegetation,/const wallBottom=1\.03,wallTop=3\.33/,
  'the expanded boundary preserves the repaired gate-wing proportions');
assert.match(gateVegetation,/slab\.rotateZ\(side\*\.34\)/,
  'the expanded boundary uses the same paired pitched roof language');
assert.match(layoutSource,/,-\.02,3\.76\)/,
  'forecourt collision reaches from the buried footing through the visible roof');
assert.match(gateBridge,/const wallTop=PLATFORM_Y\+2\.3/,
  'gate wing roof placement is anchored to the real plaster-wall top');
assert.match(gateBridge,/gate-wing-roof-bearing/,
  'gate wing roof has a continuous visible bearing instead of floating');
assert.doesNotMatch(gateBridge,/PLATFORM_Y \+ 3\.0|PLATFORM_Y \+ 3\.16/,
  'the former floating wing-roof heights are removed');
assert.match(gateBridge,/const footingBottom=-\.7/,
  'gate wing footing reaches the study ground before the runtime height offset');
assert.match(gateBridge,/gate-wing-ground-footing/,
  'gate wing has a named continuous ground footing for visual inspection');
assert.match(lingyinRuntime,/forestGate\.group\.position\.set\(-2,LINGYIN_PLATFORM_Y\+\.68,46\.85\)/,
  'the accepted editor transform is committed to the playable gate');
for(const name of ['gate-wing-terrace-extension-plaster',
  'gate-wing-terrace-extension-footing','gate-wing-terrace-extension-timber',
  'gate-wing-terrace-extension-roof'])
  assert.match(gateBridge,new RegExp(name),`${name} replaces the terrace stone rail`);
const templeSource=readFileSync(new URL(
  '../lingyin-map/src/world/temple.ts',import.meta.url),'utf8');
const templeMaterialsSource=readFileSync(new URL(
  '../lingyin-map/src/world/materials.ts',import.meta.url),'utf8');
for(const role of ['mainStone','mainWall','mainWood','mainWoodDark','mainDougong','mainLattice','mainWindow'])
  assert.match(templeSource,new RegExp(role),`${role} isolates the main hall exterior finish`);
assert.match(templeSource,/let exteriorPhase = true/);
assert.match(templeSource,/exteriorPhase = false;[\s\S]*Rooms were originally scenic shells|Rooms were originally scenic shells[\s\S]*exteriorPhase = false;/,
  'main hall exterior routing is disabled before room materials are built');
assert.match(templeSource,/const roofRole: Role = s\.name === 'main' \? 'mainRoof' : 'roof'/,
  'the formal game hall receives its dedicated red roof, not only the study facade');
for(const material of ['mainHallRoofMaterial','mainHallWallMaterial','mainHallStoneMaterial',
  'mainHallRedWoodMaterial','mainHallPaintedBeamMaterial','mainHallWindowMaterial'])
  assert.match(templeMaterialsSource,new RegExp(`export function ${material}`),
    `${material} is a dedicated main-hall exterior material`);
assert.match(templeMaterialsSource,/main-hall-painted-beam-pattern/,
  'one shared repeat texture supplies the blue-green and gilt painted beam pattern');
assert.match(templeSource,/plasterMaterial as gatePlasterMaterial/,
  'the temple enclosure reuses the mountain-gate ochre plaster');
assert.match(templeSource,/const footingBottom=-\.02,footingTop=1\.11/,
  'the enclosure uses the same grounded granite footing proportions');
assert.match(templeSource,/const wallBottom=1\.03,wallTop=3\.33/,
  'the enclosure plaster panels match the gate-wing height');
assert.match(templeSource,/Math\.ceil\(len\/6\.4\)/,
  'dark timber posts repeat in the same gate-wing bay rhythm');
assert.doesNotMatch(templeSource,/this\.add\('wall', box\(t, wallH, len/,
  'the former photographed low wall strip is no longer used for the enclosure');
assert.match(templeSource,/The bridge exit is now playable/,
  'the east timber leaves are opened instead of sealing the bridge bay');
assert.match(templeSource,/this\.balustrade\(4\.1,9\.9,P\.x0\+\.5,y\+\.98,'z'\)/,
  'the former west passage is visibly closed by a matching stone balustrade');
assert.match(templeSource,/const crown=\[\.34,\.52,\.66,\.52,\.34\]/,
  'the playable map renders the same shallow stone bridge profile as the preview');
assert.doesNotMatch(templeSource,/Closed timber leaves make the scenic bridge boundary legible/);
assert.doesNotMatch(templeSource,/this\.balustrade\(P\.x0 \+ 1, -14|this\.balustrade\(10, P\.x1 - 1/,
  'the former low stone rails beside the gate are no longer rendered');
assert.match(layoutSource,/add\(-24\.5,45\.75,10\.5,\.46,-\.02,3\.76\)/,
  'left terrace extension collision matches the new visible wing');
assert.match(layoutSource,/add\(18\.5,45\.75,8\.5,\.46,-\.02,3\.76\)/,
  'right terrace extension collision matches the new visible wing');
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
