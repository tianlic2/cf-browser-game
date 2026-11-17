import * as THREE from 'three';
import { finishTempleArchitecture } from './lingyin_architectural_finish.js?v=chisel-sanctum-1';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO, Sky, Terrain, HillsideTrail, Temple, ForestGate, GateGround, GateFramingTrees, createMainHallInterior, createSmallHallInteriors, mainHallStatueSolids, createApprovedLingyinLandscape, preloadTempleTextures, preloadRuntimeTextures, preloadTerrainTextures, preloadFoliagePhotos, Details, Vegetation, Water, Mist } from './lingyin_world.js?v=flanking-apron-leaf-1';
import { lingyinLayout, LINGYIN_PLATFORM_Y } from './lingyin_layout.js?v=offering-depth-1';
import { COURT_COVER } from './lingyin_court_cover.js?v=2';
import { createLingyinWell } from './lingyin_well.js?v=1';
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
  const textureLoader = new THREE.TextureLoader();
  const hallTexture = name => textureLoader.loadAsync(
    new URL(`../assets/lingyin/hall-preview/${name}.webp`, import.meta.url).href);
  const [coffer, paintedBeam, redLacquer,
    stoneFloor, carvedAltar, redRoof, sanctumCraft, giltLeaf, altarStone, chasedDetail, centralRobe, aureoleArt] = await Promise.all([
    hallTexture('dragon-coffer'), hallTexture('painted-beam'),
    hallTexture('worn-red-lacquer'), hallTexture('aged-stone-floor'),
    hallTexture('carved-altar'), hallTexture('red-ceramic-roof'), hallTexture('sanctum-craft'),hallTexture('gilt-leaf-finish'),hallTexture('altar-veined-stone'),hallTexture('three-buddha-incisions'),
    textureLoader.loadAsync(new URL('../assets/lingyin/hall-preview/central-robe-normal.png?v=seated-folds-1',import.meta.url).href),
    hallTexture('aureole-scrollwork'),
  ]);
  aureoleArt.colorSpace=THREE.SRGBColorSpace;aureoleArt.anisotropy=8;
  centralRobe.channel=1;centralRobe.anisotropy=8;
  giltLeaf.wrapS=giltLeaf.wrapT=THREE.RepeatWrapping;
  giltLeaf.anisotropy=8;
  for(const texture of [altarStone,coffer,paintedBeam,redLacquer,stoneFloor,carvedAltar,redRoof,sanctumCraft]){
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=8;
  }
  // Keep the already-loaded hall stone image on the well. The waist walls use
  // a neutral untextured mineral finish: the hall floor texture is mutated to
  // a high repeat later and made these small vertical faces read as crates.
  // The visible walls and their bullet/movement proxies share COURT_COVER bounds.
  // Recessed panels and end piers stay inside those bounds, so the richer
  // silhouette never creates a new invisible snag.
  const stoneCoverMaterial = new THREE.MeshStandardMaterial({map:stoneFloor,color:0xc4c1b6,roughness:.92});
  stoneCoverMaterial.name='lingyin-well-stone';
  const waistWallMaterial=new THREE.MeshStandardMaterial({color:0x999a95,roughness:.96,metalness:0});
  waistWallMaterial.name='courtyard-waist-wall-stone';
  const stonePanelMaterial=waistWallMaterial.clone();
  stonePanelMaterial.name='courtyard-waist-wall-recess';
  // The photographed floor map is intentionally not reused on this tiny
  // inset: repeating it at panel scale reads as a woven crate from combat
  // distance. A quiet neutral stone keeps the masonry frame legible.
  stonePanelMaterial.map=null;
  stonePanelMaterial.color.set(0x50514d);
  stonePanelMaterial.roughness=.97;
  const coverGroup = new THREE.Group(); coverGroup.name = 'courtyard-stone-cover';
  const coverStone=[],coverRecess=[];
  const coverBox=(bucket,w,h,d,x,y,z)=>{
    const geometry=new THREE.BoxGeometry(w,h,d);
    geometry.translate(x,LINGYIN_PLATFORM_Y+y,z);
    bucket.push(geometry);
  };
  for (const c of COURT_COVER) {
    const w=c.hx*2,d=c.hz*2,longX=w>d;
    coverBox(coverStone,w,.18,d,c.x,.09,c.z);
    // Pull the broad core face back by 25 mm. The inset panel can then sit
    // flush with the shared collision boundary instead of being hidden behind
    // the opaque BoxGeometry face or floating outside the proxy.
    coverBox(coverStone,longX?w:w-.05,c.h-.36,longX?d-.05:d,c.x,c.h/2,c.z);
    coverBox(coverStone,w,.18,d,c.x,c.h-.09,c.z);
    // Slightly broader end piers give each low wall a believable structural
    // rhythm while remaining within the original rectangular combat proxy.
    const pier=.22,span=(longX?w:d)/2-pier/2;
    for(const side of [-1,1])coverBox(coverStone,longX?pier:w,
      c.h-.22,longX?d:pier,c.x+(longX?side*span:0),c.h/2,
      c.z+(longX?0:side*span));
    // A dark inset on both exposed faces reads as carved stone at combat
    // distance. It is recessed into the solid wall rather than protruding.
    const panelLength=Math.max(.4,(longX?w:d)-.78),panelHeight=c.h-.68;
    for(const side of [-1,1])coverBox(coverRecess,
      longX?panelLength:.025,panelHeight,longX?.025:panelLength,
      c.x+(longX?0:side*(w/2-.0125)),c.h/2,
      c.z+(longX?side*(d/2-.0125):0));
  }
  const addCoverBatch=(geometries,material,name)=>{
    const geometry=mergeGeometries(geometries,false);
    if(!geometry)throw new Error(`Failed to merge ${name}`);
    geometries.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name=name;
    mesh.receiveShadow=true;
    mesh.castShadow=true;
    coverGroup.add(mesh);
  };
  addCoverBatch(coverStone,waistWallMaterial,'courtyard-waist-wall-masonry');
  addCoverBatch(coverRecess,stonePanelMaterial,'courtyard-waist-wall-carved-panels');
  world.add(coverGroup);
  redLacquer.wrapS=redLacquer.wrapT=THREE.RepeatWrapping;
  redRoof.wrapS=redRoof.wrapT=THREE.RepeatWrapping;
  redRoof.repeat.set(.2,.2);
  redRoof.needsUpdate=true;
  temple.group.add(createMainHallInterior(temple,{
    coffer,paintedBeam,redLacquer,stoneFloor,carvedAltar,redRoof,sanctumCraft,giltLeaf,altarStone,chasedDetail,centralRobe,aureoleArt,
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
  // The permanent temple bridge is the playable one; Details also contains
  // an older, narrower scenic bridge at the same location.
  const details = await attach(Details,.93,{omitBridge:true});
  const mist = await attach(Mist,.97,details.smokeOrigin);
  const well=createLingyinWell(world,stoneCoverMaterial);
  well.position.y=LINGYIN_PLATFORM_Y;
  world.add(well);
  const landscape=options.editor?null:createApprovedLingyinLandscape(world);
  await finishTempleArchitecture(world,layout.colliders);
  layout.colliders.push(...mainHallStatueSolids(world));
  if(landscape)layout.setLandscapeData(landscape,
    triangulatedWalkSurface(landscape.walkGeometry,-LINGYIN_PLATFORM_Y,2,true));

  const proxies = new THREE.Group();
  proxies.name = 'lingyin-combat-proxies';
  const invisible = new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide});
  for (const c of layout.colliders) {
    // Exact authored triangles below avoid diagonal-deck AABB bullet walls.
    if(c.landscape || c.name==='main-hall-grand-stair-rail' || c.carvedRail)continue;
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
  const railArt=world.getObjectByName('main-hall-stair-carving');
  const railProxy=new THREE.Mesh(railArt.geometry,invisible);
  railProxy.name='main-hall-carved-rail-proxy';
  railProxy.matrixAutoUpdate=false;
  railProxy.matrix.copy(railArt.matrixWorld);
  railProxy.visible=false;proxies.add(railProxy);
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
  // Bullet surfaces follow the five visible bridge slabs and the entry steps.
  // Character/NPC footing comes from the same top heights in lingyin_layout.
  for(const [x,top] of [[30.9,.34],[33.45,.52],[36,.66],[38.55,.52],[41.1,.34]]){
    const slab=new THREE.Mesh(new THREE.BoxGeometry(x===41.1?3.45:2.55,.28,8.2),invisible);
    slab.name='east-bridge-deck';slab.position.set(x,top-.14,28);slab.visible=false;proxies.add(slab);
  }
  for(let i=0;i<3;i++){
    const top=.11+i*.11,step=new THREE.Mesh(new THREE.BoxGeometry(.72,.18,8.2),invisible);
    step.name='east-bridge-step';step.position.set(28.38+i*.72,top-.09,28);step.visible=false;proxies.add(step);
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
