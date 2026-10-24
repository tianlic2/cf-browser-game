import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { makeGLTFLoader } from './gltf.js';
import { ATMO, Sky, Terrain, HillsideTrail, Temple, ForestGate, GateGround, GateFramingTrees, createMainHallInterior, createSmallHallInteriors, mainHallStatueSolids, createApprovedLingyinLandscape, preloadTempleTextures, preloadRuntimeTextures, preloadTerrainTextures, preloadFoliagePhotos, Details, Vegetation, Water, Mist } from './lingyin_world.js?v=85';
import { lingyinLayout, LINGYIN_PLATFORM_Y } from './lingyin_layout.js?v=static-solids-1';
import { triangulatedWalkSurface } from './lingyin_walk_surface.js?v=2';

// The imported procedural scene has its own editable visual sources. Keep
// detailed art separate from these lightweight combat proxies.
export async function buildLingyinMap(scene, onProgress = () => {}, options = {}) {
  const layout = lingyinLayout({approvedLandscape:!options.editor});
  const world = new THREE.Group();
  world.name = 'lingyin-authored-world';
  world.position.y = -LINGYIN_PLATFORM_Y;
  world.visible = false;
  scene.add(world);
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const attach = async (Ctor, fraction, ...args) => {
    const part = new Ctor(...args);
    world.add(part.group);
    onProgress(fraction);
    await tick();
    return part;
  };

  // Keep the atmosphere, but not the former rings of inaccessible mountains.
  // The visible ground now ends shortly beyond the real combat footprint.
  const renderLook={
    exposure:1.1, sunPosition:[-65,90,50], sunColor:0xffe0b0,sunIntensity:3.25,
    hemiSky:0xd9e2df,hemiGround:0x81725a,hemiIntensity:1.6,
  };
  ATMO.sunDir.value.fromArray(renderLook.sunPosition).normalize();
  ATMO.sunColor.value.setRGB(1,.84,.64);
  ATMO.sunIrr.value.set(4.2,3.55,2.9);
  ATMO.hazeColor.value.setRGB(.18,.235,.28);
  ATMO.mistColor.value.setRGB(.30,.36,.35);
  const sky = new Sky();
  sky.uniforms.uZenith.value.set('#7b9fb7');
  sky.uniforms.uHorizon.value.set('#d3d3c0');
  sky.uniforms.uGround.value.set('#7c8470');
  sky.uniforms.uCloudCover.value=.17;
  world.add(sky.mesh);
  onProgress(.08);
  await tick();
  await Promise.all([preloadTerrainTextures(),preloadTempleTextures(),preloadRuntimeTextures()]);
  await attach(Terrain,.36,1,!options.editor);
  const water = options.editor ? await attach(Water,.45) : null;
  onProgress(.50);
  const hillside = options.editor ? await attach(HillsideTrail,.60) : null;
  const gateGround = new GateGround({gameMap:true});
  gateGround.group.name = 'lingyin-gate-approach-ground';
  gateGround.group.position.set(-2,LINGYIN_PLATFORM_Y,40);
  world.add(gateGround.group);
  onProgress(.62);
  // The reviewed two-tier facade replaces only the old main hall. Other
  // temple buildings and their gameplay footprint stay in the same place.
  const temple = await attach(Temple,.69,{
    omitMainHallShrine:true, omitGateVisual:true,
    studyHallEave:11, studyFacade:true, enrichedSmallHalls:true,
  });
  // Place the authored gate and its four framing trees into the existing
  // courtyard. Only their visuals come from the study; gameplay uses matching
  // lightweight brushes in lingyin_layout.js.
  const forestGate = new ForestGate();
  forestGate.group.name = 'lingyin-forest-gate';
  forestGate.group.position.set(-2,LINGYIN_PLATFORM_Y+.68,46.85);
  world.add(forestGate.group);
  const gateTrees = new GateFramingTrees({gamePerimeter:true});
  gateTrees.group.name = 'lingyin-gate-framing-trees';
  gateTrees.group.position.set(-2,LINGYIN_PLATFORM_Y,40);
  world.add(gateTrees.group);
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('../vendor/three/examples/jsm/libs/draco/', import.meta.url).href);
  const buddhaGltf = makeGLTFLoader().setDRACOLoader(draco);
  const textureLoader = new THREE.TextureLoader();
  const hallTexture = name => textureLoader.loadAsync(
    new URL(`../assets/lingyin/hall-preview/${name}.webp`, import.meta.url).href);
  const [buddha, buddhaFar, coffer, paintedBeam, redLacquer,
    stoneFloor, carvedAltar, redRoof] = await Promise.all([
    buddhaGltf.loadAsync(new URL('../assets/lingyin/buddha-clay-scan.glb', import.meta.url).href),
    buddhaGltf.loadAsync(new URL('../assets/lingyin/buddha-clay-scan-lod.glb', import.meta.url).href),
    hallTexture('dragon-coffer'), hallTexture('painted-beam'),
    hallTexture('worn-red-lacquer'), hallTexture('aged-stone-floor'),
    hallTexture('carved-altar'), hallTexture('red-ceramic-roof'),
  ]);
  draco.dispose();
  for(const texture of [coffer,paintedBeam,redLacquer,stoneFloor,carvedAltar,redRoof]){
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=8;
  }
  redLacquer.wrapS=redLacquer.wrapT=THREE.RepeatWrapping;
  redRoof.wrapS=redRoof.wrapT=THREE.RepeatWrapping;
  redRoof.repeat.set(.2,.2);
  redRoof.needsUpdate=true;
  temple.group.add(createMainHallInterior(temple,{
    coffer,paintedBeam,redLacquer,stoneFloor,carvedAltar,redRoof,
    buddhaScan:buddha.scene,buddhaSideLod:buddhaFar.scene,
  }));
  onProgress(.72);
  const muralTexture = await new THREE.TextureLoader().loadAsync(
    new URL('../assets/lingyin/lotus-mural.jpg', import.meta.url).href);
  muralTexture.colorSpace = THREE.SRGBColorSpace;
  muralTexture.anisotropy = 8;
  temple.group.add(createSmallHallInteriors(temple,{
    stoneFloor,paintedBeam,carvedAltar,mural:muralTexture,
  }));
  onProgress(.74);
  await preloadFoliagePhotos();
  const vegetation = await attach(Vegetation,.82);
  const details = await attach(Details,.93);
  const mist = await attach(Mist,.97,details.smokeOrigin);
  const landscape=options.editor?null:createApprovedLingyinLandscape(world);
  layout.colliders.push(...mainHallStatueSolids(world));
  if(landscape)layout.setLandscapeData(landscape,
    triangulatedWalkSurface(landscape.walkGeometry,-LINGYIN_PLATFORM_Y,2,true));

  const proxies = new THREE.Group();
  proxies.name = 'lingyin-combat-proxies';
  const invisible = new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide});
  for (const c of layout.colliders) {
    // Exact authored triangles below avoid diagonal-deck AABB bullet walls.
    if(c.landscape)continue;
    // A brush's `h` is its absolute top, not its height. The old proxy
    // extended from y0 to y0+h, creating invisible bullet/LOS slabs above
    // doors and walls even though character movement used the correct top.
    let polygonGeometry;
    if(c.polygon){
      const shape=new THREE.Shape(c.polygon.map(p=>new THREE.Vector2(p.x-c.x,-(p.z-c.z))));
      polygonGeometry=new THREE.ExtrudeGeometry(shape,{depth:c.h-c.y0,bevelEnabled:false,steps:1})
        .rotateX(-Math.PI/2).translate(0,-(c.h-c.y0)/2,0);
    }
    const proxy = new THREE.Mesh(
      polygonGeometry || (c.round ? new THREE.CylinderGeometry(c.round.rt,c.round.rb,c.h-c.y0,c.round.segments)
        .scale(c.round.sx,1,c.round.sz).rotateY(c.round.rot)
        : c.rail ? new THREE.BoxGeometry(.16,.14,Math.hypot(
        c.rail.b.x-c.rail.a.x,c.rail.b.y-c.rail.a.y,c.rail.b.z-c.rail.a.z))
        : new THREE.BoxGeometry(c.hx*2,c.h-c.y0,c.hz*2)),invisible);
    proxy.name=c.name||'';
    if (c.rail) {
      const {a,b,height}=c.rail;
      const direction=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z);
      proxy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());
      proxy.position.set((a.x+b.x)/2,(a.y+b.y)/2+height,(a.z+b.z)/2);
    } else proxy.position.set(c.x,(c.y0+c.h)/2,c.z);
    proxy.visible = false;
    proxies.add(proxy);
  }
  const trailPath = hillside?.group.getObjectByName('graded-mountain-stone-path');
  if (!landscape&&trailPath?.geometry) {
    layout.setTrailSurface(triangulatedWalkSurface(
      trailPath.geometry, -LINGYIN_PLATFORM_Y));
    const trailProxy = new THREE.Mesh(
      trailPath.geometry.clone().translate(0,-LINGYIN_PLATFORM_Y,0),invisible);
    trailProxy.visible = false;
    proxies.add(trailProxy);
  }
  if(landscape){
    world.updateMatrixWorld(true);
    landscape.group.traverse(object=>{
      if(!object.isMesh||object.material.transparent)return;
      const proxy=new THREE.Mesh(object.geometry,invisible);
      proxy.matrixAutoUpdate=false;
      proxy.matrix.copy(object.matrixWorld);
      proxy.visible=false;
      proxies.add(proxy);
    });
    // Surface indexing copied the coordinates; this geometry is CPU-only.
    landscape.walkGeometry.dispose();
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(63,92),invisible);
  floor.rotation.x = -Math.PI/2;
  floor.position.set(-4,-.04,-.5);
  floor.visible = false;
  proxies.add(floor);
  scene.add(proxies);
  onProgress(1);
  if (new URLSearchParams(location.search).get('debugMetrics') === '1') {
    const breakdown = world.children.map((part, index) => {
      let meshes = 0, triangles = 0, shadowTriangles = 0, instances = 0;
      part.traverse(object => {
        if (!object.isMesh || !object.geometry) return;
        const count = object.isInstancedMesh ? object.count : 1;
        const tris = ((object.geometry.index?.count || object.geometry.getAttribute('position')?.count || 0) / 3) * count;
        meshes++;
        instances += count;
        triangles += tris;
        if (object.castShadow) shadowTriangles += tris;
      });
      return { name: part.name || `part-${index}`, meshes, instances,
        triangles: Math.round(triangles), shadowTriangles: Math.round(shadowTriangles) };
    });
    document.documentElement.dataset.lingyinGeometry = JSON.stringify(breakdown);
  }
  let active = false;
  return {
    ...layout,
    name:'灵隐寺', source:'lingyin-procedural',
    visuals:[world,proxies], obstacles:[proxies],
    renderLook,
    background:new THREE.Color(0x9eafa9), environment:null,
    fog:new THREE.FogExp2(0xb5bba5,.0024),
    setActive(value){ active=!!value; },
    update(time,dt,camera){
      if(!active)return;
      ATMO.time.value=time;
      gateTrees.update(time);
      water?.update(dt);
      if(landscape)landscape.update(time);
      vegetation.update(camera);
      if(camera)mist.update(time,camera);
    },
  };
}
