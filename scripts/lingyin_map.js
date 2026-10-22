import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { makeGLTFLoader } from './gltf.js';
import { ATMO, Sky, Backdrop, Terrain, HillsideTrail, Temple, ForestGate, GateGround, GateFramingTrees, createMainHallInterior, preloadTempleTextures, preloadTerrainTextures, preloadFoliagePhotos, Details, Vegetation, Water, Crag, Mist } from './lingyin_world.js?v=47';
import { lingyinLayout, LINGYIN_PLATFORM_Y } from './lingyin_layout.js?v=gate-forecourt-3';
import { triangulatedWalkSurface } from './lingyin_walk_surface.js';

// The imported procedural scene has its own editable visual sources. Keep
// detailed art separate from these lightweight combat proxies.
export async function buildLingyinMap(scene, onProgress = () => {}) {
  const layout = lingyinLayout();
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

  // The original skyline and atmosphere are preserved; the distant terrain
  // remains visual only, so its many triangles never enter AI sight rays.
  ATMO.sunDir.value.set(.8,.31,.42).normalize();
  ATMO.sunColor.value.setRGB(1,.78,.60);
  ATMO.sunIrr.value.set(4.2,3.55,2.9);
  ATMO.hazeColor.value.setRGB(.18,.235,.28);
  ATMO.mistColor.value.setRGB(.30,.36,.35);
  const sky = new Sky();
  world.add(sky.mesh);
  onProgress(.08);
  await tick();
  await attach(Backdrop,.17);
  await preloadTerrainTextures();
  await attach(Terrain,.36,1);
  const water = await attach(Water,.45);
  await preloadTempleTextures();
  onProgress(.50);
  await attach(Crag,.54);
  const hillside = await attach(HillsideTrail,.60);
  const gateGround = new GateGround({gameMap:true});
  gateGround.group.name = 'lingyin-gate-approach-ground';
  gateGround.group.position.set(-2,LINGYIN_PLATFORM_Y,40);
  world.add(gateGround.group);
  onProgress(.62);
  // The reviewed two-tier facade replaces only the old main hall. Other
  // temple buildings and their gameplay footprint stay in the same place.
  const temple = await attach(Temple,.69,{
    omitMainHallShrine:true, omitGateVisual:true,
    studyHallEave:11, studyFacade:true,
  });
  // Place the authored gate and its four framing trees into the existing
  // courtyard. Only their visuals come from the study; gameplay uses matching
  // lightweight brushes in lingyin_layout.js.
  const forestGate = new ForestGate();
  forestGate.group.name = 'lingyin-forest-gate';
  forestGate.group.position.set(-2,LINGYIN_PLATFORM_Y+.68,40);
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
  const muralMaterial = new THREE.MeshStandardMaterial({
    map:muralTexture,roughness:.91,metalness:0,
    emissive:0x28180f,emissiveIntensity:.06,
  });
  const muralGroup = new THREE.Group();
  muralGroup.name='lingyin-interior-murals';
  const murals=[
    {x:19,z:7,rot:-Math.PI/2,localZ:-5.9,y:3.3,w:4.6,h:2.5},
    {x:-2,z:-38,rot:0,localZ:-2.9,y:3.5,w:5.2,h:2.5},
  ];
  for(const s of murals){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(s.w,s.h),muralMaterial);
    mesh.name='lotus-mural';
    mesh.position.set(s.x+s.localZ*Math.sin(s.rot),LINGYIN_PLATFORM_Y+s.y,
      s.z+s.localZ*Math.cos(s.rot));
    mesh.rotation.y=s.rot;
    muralGroup.add(mesh);
  }
  world.add(muralGroup);
  onProgress(.74);
  await preloadFoliagePhotos();
  const vegetation = await attach(Vegetation,.82);
  const details = await attach(Details,.93);
  const mist = await attach(Mist,.97,details.smokeOrigin);

  const proxies = new THREE.Group();
  proxies.name = 'lingyin-combat-proxies';
  const invisible = new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide});
  for (const c of layout.colliders) {
    // A brush's `h` is its absolute top, not its height. The old proxy
    // extended from y0 to y0+h, creating invisible bullet/LOS slabs above
    // doors and walls even though character movement used the correct top.
    const proxy = new THREE.Mesh(
      c.rail ? new THREE.BoxGeometry(.16,.14,Math.hypot(
        c.rail.b.x-c.rail.a.x,c.rail.b.y-c.rail.a.y,c.rail.b.z-c.rail.a.z))
        : new THREE.BoxGeometry(c.hx*2,c.h-c.y0,c.hz*2),invisible);
    if (c.rail) {
      const {a,b,height}=c.rail;
      const direction=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z);
      proxy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());
      proxy.position.set((a.x+b.x)/2,(a.y+b.y)/2+height,(a.z+b.z)/2);
    } else proxy.position.set(c.x,(c.y0+c.h)/2,c.z);
    proxy.visible = false;
    proxies.add(proxy);
  }
  const trailPath = hillside.group.getObjectByName('graded-mountain-stone-path');
  if (trailPath?.geometry) {
    layout.setTrailSurface(triangulatedWalkSurface(
      trailPath.geometry, -LINGYIN_PLATFORM_Y));
    const trailProxy = new THREE.Mesh(
      trailPath.geometry.clone().translate(0,-LINGYIN_PLATFORM_Y,0),invisible);
    trailProxy.visible = false;
    proxies.add(trailProxy);
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
    background:new THREE.Color(0x8294a2), environment:null,
    fog:new THREE.FogExp2(0x8d9997,.0032),
    setActive(value){ active=!!value; },
    update(time,dt,camera){
      if(!active)return;
      ATMO.time.value=time;
      gateTrees.update(time);
      water.update(dt);
      vegetation.update(camera);
      if(camera)mist.update(time,camera);
    },
  };
}
