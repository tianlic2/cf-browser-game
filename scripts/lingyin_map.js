import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { makeGLTFLoader } from './gltf.js';
import { ATMO, Sky, Backdrop, Terrain, HillsideTrail, Temple, buddhaMaterial, preloadTempleTextures, preloadTerrainTextures, preloadFoliagePhotos, Details, Vegetation, Water, Crag, Mist } from './lingyin_world.js?v=29';
import { lingyinLayout, LINGYIN_PLATFORM_Y } from './lingyin_layout.js?v=hillside-12';

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
  await attach(Temple,.69);
  // The hall's focal statue is a reduced real-world clay scan. Its original
  // Z-up coordinates are stood upright and aligned with the existing throne.
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('../vendor/three/examples/jsm/libs/draco/', import.meta.url).href);
  const buddhaGltf = makeGLTFLoader().setDRACOLoader(draco);
  const [buddha, buddhaFar] = await Promise.all([
    buddhaGltf.loadAsync(new URL('../assets/lingyin/buddha-clay-scan.glb', import.meta.url).href),
    buddhaGltf.loadAsync(new URL('../assets/lingyin/buddha-clay-scan-lod.glb', import.meta.url).href),
  ]);
  draco.dispose();
  const statue = new THREE.Group();
  statue.name = 'lingyin-buddha-scan';
  // The scan is 0.826 m deep at this scale; the rear face now sits roughly
  // 2 cm in front of the mural plane at z=-11.28.
  statue.position.set(-2,LINGYIN_PLATFORM_Y+1.78,-10.85);
  const agedGilt = buddhaMaterial();
  const prepareStatue = root => {
    root.rotation.x = Math.PI / 2;
    root.scale.setScalar(.027);
    root.position.set(-1.607,0,-.413);
    root.traverse(object => {
      if (!object.isMesh) return;
      object.material = agedGilt;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return root;
  };
  const statueLOD = new THREE.LOD();
  statueLOD.addLevel(prepareStatue(buddha.scene),0);
  statueLOD.addLevel(prepareStatue(buddhaFar.scene),14);
  statue.add(statueLOD);
  world.add(statue);
  // Two unobtrusive votive lights reveal the carved face and robe folds from
  // the entrance; they do not cast dynamic shadows in the combat renderer.
  const keyLight = new THREE.PointLight(0xffd39a, 21, 10, 2);
  keyLight.position.set(-5,LINGYIN_PLATFORM_Y+4.7,-6.0);
  const fillLight = new THREE.PointLight(0xffe8c5, 11, 8, 2);
  fillLight.position.set(.3,LINGYIN_PLATFORM_Y+4.0,-6.8);
  world.add(keyLight,fillLight);
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
    {x:-2,z:-12,rot:0,localZ:.72,y:4.1,w:6.5,h:4.2},
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
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(c.hx*2,c.h-c.y0,c.hz*2),invisible);
    proxy.position.set(c.x,(c.y0+c.h)/2,c.z);
    proxy.visible = false;
    proxies.add(proxy);
  }
  const trailPath = hillside.group.getObjectByName('graded-mountain-stone-path');
  if (trailPath?.geometry) {
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
      water.update(dt);
      vegetation.update(camera);
      if(camera)mist.update(time,camera);
    },
  };
}
