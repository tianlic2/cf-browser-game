import { createTransportCompartments, createCompartmentLightProbe, paintCompartmentWalls } from './transport_compartments.js';
import { createDeckhouseWindowFrames, createDeckhouseGlass } from './transport_pilothouse.js';
import { createTransportSuperstructure } from './transport_superstructure.js';
import { dampenTransportMaterial } from './transport_damp.js?v=rain-ripples-1';
import { createTransportDynamics, harbourWaterGeometry } from './transport_dynamics.js';
import { formTimberBoards, formCabinetSteel, precisionHatchGeometry, addBattenFasteners, createCaseCornerPlates } from './transport_precision.js';
import * as THREE from 'three';
import { lightTransportSurfaces, createTransportSkyProbe, createTransportSunProbe, softenTransportCargoShadow, transportSunPosition } from './transport_lighting.js?v=compartment-light-1';
import { createDeckTracks, createFreightNote } from './transport_paper_and_tracks.js';
import { detachMastScanner, createHoistSignals } from './transport_deck_signals.js';
import { createTransportRain, createTransportStormAudio } from './transport_weather.js?v=roof-runoff-1';
import { animateShipWater } from './transport_motion.js?v=harbour-swell-1';
import { waterMaps } from './map.js';
import { configureMapTexture } from './map_texture_quality.js';
import { hasCardinalBoxFootprint } from './brush_collision.js?v=transport-rounded-corners-1';
import { createTransportSurfaceDetail } from './transport_surface_detail.js?v=3';
import { createFreightFlySheets, updateFreightWind } from './transport_fly_sheets.js?v=gust-steps-1';
import { canvasLoads, formTransportCanvas } from './transport_canvas_relief.js?v=hanging-folds-2';
import { formTransportCargoPanel } from './transport_corrugation.js?v=2';
import { createTransportCargoDetail } from './transport_cargo_detail.js?v=precision-models-1';
import { upgradeTransportTexture } from './transport_texture_detail.js?v=1';

import { createTransportOutfitting, createDeckContactMap, addBulkheadLight, deckStencil } from './transport_outfitting.js?v=cargo-dust-1';
import { createTransportDoorGear } from './transport_door_gear.js';
import { createTransportBooms } from './transport_booms.js?v=open-platforms-1';
import { caseAtlas, dressTimberCases } from './transport_case_hardware.js';
import { markTransportFreight } from './transport_freight_marks.js';
import { paintTransportStacks, matchTransportDoorPaint } from './transport_stack_paint.js?v=freight-steel-1';

const BASE = new URL('../assets/classic/', import.meta.url).href;
// Imported Transport Ship uses these materials on the actual wooden crate faces.
// Other crate-sized props use corrugated metal/canvas and must remain bulletproof.
const WOOD_BULLET_MATERIALS = new Set([
  'transportship/texture_234',
  'transportship/texture_80',
]);
const SHIP_SURFACE_MATERIALS = new Set([
  '95','93','94','85','91','87','78','79','92','83','81','76','74','71',
  '77','75','126','234','80','88','73','86','84','82','70','108','90','125',
].map(id=>`transportship/texture_${id}`));
const CANVAS_SURFACE_MATERIALS = new Set(['81','82','83','84'].map(id=>`transportship/texture_${id}`));
const CORRUGATED_SURFACE_MATERIALS = new Set([
  'transportship/texture_78','transportship/texture_73','ship/m_00001',
  'ship/m_00017','ship/m_00024','ship/m_00032',
]);
// Widen the texture footprint only once a pixel covers multiple source texels.
function filterLaneFinish(material) {
  const previous = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    previous.call(this, shader, renderer);
    const { width, height } = this.normalMap.image;
    const normalChunk = THREE.ShaderChunk.normal_fragment_maps.replace(
      'texture2D( normalMap, vNormalMapUv )', 'texture2D( normalMap, vNormalMapUv, laneBias )'
    ).replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * (1.0 - .15 * laneCoverage);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 laneTexel = vNormalMapUv * vec2(${width}.0, ${height}.0);
        float laneSpan = max(length(dFdx(laneTexel)), length(dFdy(laneTexel)));
        float laneCoverage = smoothstep(1.25, 7.0, laneSpan);
        float laneBias = .76 * laneCoverage;
        ${THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )',
          'texture2D( map, vMapUv, laneBias * .34 )')}`)
      .replace('#include <normal_fragment_maps>', normalChunk)
      .replace('#include <lights_physical_fragment>', `
        // Approximate unresolved normal variance as a broader highlight.
        vec3 dx = dFdx(normal), dy = dFdy(normal);
        roughnessFactor = min(1.0, sqrt(roughnessFactor * roughnessFactor
          + laneCoverage * min(.10, .55 * (dot(dx,dx) + dot(dy,dy)) + .024)));
        #include <lights_physical_fragment>`);
  };
  material.customProgramCacheKey = () => key + '-lane-filter-' +
    material.normalMap.image.width + 'x' + material.normalMap.image.height;
}

export async function buildClassicMap(scene, onProgress = () => {}) {
  const response = await fetch(BASE+'transport/map.json');
  if (!response.ok) throw new Error('经典地图资源缺失');
  const data = await response.json();
  onProgress(.06);
  // Reflect across the ship's long axis, keeping the teams at their own ends.
  // Geometry, brush halfspaces, spawns and radar must use the same transform.
  for (const c of data.colliders) {
    c.x = -c.x;
    for (const plane of c.planes) plane[0] = -plane[0];
    // Source exported these props as cardinal convex brushes. Use the real
    // circle-vs-box footprint so the actor capsule rolls around visible
    // corners instead of hitting the mitered square produced by plane offsets.
    c.roundedFootprint = hasCardinalBoxFootprint(c);
  }
  for (const team of Object.values(data.spawns)) for (const p of team) p[0] = -p[0];
  for (const face of data.topdown) face.x = -face.x;
  data.floorY = Math.min(0, ...data.colliders.map(c => c.h));
  // The wooden crate at the end of the lower corridor is 1.397m above the
  // tunnel floor. The shared 7.5m/s jump reaches only about 1.339m at 21m/s²,
  // and semi-implicit frame stepping trims the sampled apex further. A small
  // Transport-only height scale gives the route a stable margin even at 30fps;
  // movement on every other map remains unchanged.
  data.jumpHeightScale = 1.16;
  const binary = await fetch(BASE+'transport/map.bin').then(r => { if (!r.ok) throw new Error('地图网格缺失'); return r.arrayBuffer(); });
  onProgress(.28);
  const loader=new THREE.TextureLoader();
  const textureCount=7+data.parts.filter(p=>p.material.map).length;
  let texturesDone=0;
  const textureReady=(count=1)=>onProgress(.28+.72*(texturesDone+=count)/textureCount);
  const texture=async(path,repeat=false) => {
    const t=configureMapTexture(await loader.loadAsync(BASE+path), !repeat);
    textureReady();return t;
  };
  const authored = new Map([
    ['transportship/texture_95', 'deck'],
    ['transportship/texture_93', 'bulkhead-skirt'],
    ['transportship/texture_94', 'bulkhead-plate'],
    ['transportship/texture_108', 'service-cabinet'],
    ['transportship/texture_81', 'canvas-top'],
    ['transportship/texture_83', 'canvas-side'],
    ['transportship/texture_78', 'cargo'],
    ['transportship/texture_79', 'cargo-doors'],
    ['transportship/texture_234', 'pine'],
    ['transportship/texture_80', 'painted-wood'],
  ]);
  const roughSurfaces = [...authored];
  const materialBase = new URL('../assets/transport-materials/', import.meta.url);
  const loadSurface = async (name, channel) => {
    const revision=name==='cargo'?'freight-steel-1':name==='canvas-side'?'hanging-folds-2':
      name==='canvas-top' || name==='pine' || name==='painted-wood'?'freight-finish-2':
      name==='service-cabinet'?'rolled-enamel-1':name==='flush-hatch'?'rebated-lid-1':'harbour-2';
    const map = configureMapTexture(await loader.loadAsync(new URL(name+'-'+channel+'.webp?v='+revision,materialBase).href), false);
    if(channel!=='color') map.colorSpace=THREE.NoColorSpace;
    return map;
  };
  const [light,sky,textures,normalEntries,roughnessEntries,environment,occlusion,hatchPaint,hatchSurface,sheetColor,sheetNormal,skyAccess,rainCover,roomLight]=await Promise.all([
    texture('transport/lightmap.png'),
    new THREE.CubeTextureLoader().loadAsync(['px','nx','py','ny','pz','nz']
      .map(face=>new URL('sky/'+face+'.webp?v=cloudbreak-return-1',materialBase).href)).then(t=>{textureReady(6);return t;}),
    Promise.all(data.parts.map(async p=>{
      const name=authored.get(p.material.name);
      if(!name) return p.material.map ? texture(p.material.map,true) : null;
      const map=await loadSurface(name,'color');
      textureReady();
      return map;
    })),
    Promise.all([...authored].map(async ([material,name])=>[material,await loadSurface(name,'normal')])),
    Promise.all(roughSurfaces.map(async ([material,name])=>[material,await loadSurface(name,'roughness')])),
    fetch(new URL('sky/harbour-light.bin?v=cloud-irradiance-1',materialBase)).then(async response=>{
      if (!response.ok) throw new Error('港口环境光资源缺失');
      const pixels=new Uint16Array(await response.arrayBuffer());
      if (pixels.length!==256*128*4) throw new Error('港口环境光尺寸错误');
      const panorama=new THREE.DataTexture(pixels,256,128,THREE.RGBAFormat,THREE.HalfFloatType);
      panorama.mapping=THREE.EquirectangularReflectionMapping;
      panorama.minFilter=panorama.magFilter=THREE.LinearFilter;
      panorama.colorSpace=THREE.LinearSRGBColorSpace;
      panorama.name='transport-harbour-radiance';
      panorama.needsUpdate=true;
      return panorama;
    }),
    loader.loadAsync(new URL('ship-occlusion.png',materialBase).href),
    loadSurface('flush-hatch','color'),
    loadSurface('flush-hatch','surface'),
    loadSurface('corner-sheet','color'),
    loadSurface('corner-sheet','normal'),
    loader.loadAsync(new URL('sky/ship-sky-access.png',materialBase).href),
    loader.loadAsync(new URL('rain-cover.png?v=surface-rain-1',materialBase).href),
    loader.loadAsync(new URL('tween-deck-light.png',materialBase).href),
  ]);
  roomLight.name='transport-tween-deck-light';
  roomLight.flipY=false;
  roomLight.generateMipmaps=false;
  roomLight.minFilter=roomLight.magFilter=THREE.LinearFilter;
  rainCover.name='transport-rain-cover';
  rainCover.flipY=false;
  rainCover.generateMipmaps=false;
  rainCover.minFilter=rainCover.magFilter=THREE.LinearFilter;
  skyAccess.flipY=false;
  skyAccess.generateMipmaps=false;
  skyAccess.minFilter=skyAccess.magFilter=THREE.LinearFilter;
  skyAccess.name='transport-directional-sky-access';
  configureMapTexture(occlusion,true);
  occlusion.colorSpace=THREE.NoColorSpace;
  occlusion.name='transport-baked-visibility';
  occlusion.channel=1;
  light.channel=1;
  const normals = new Map(normalEntries);
  const roughness = new Map(roughnessEntries);
  sky.colorSpace=THREE.SRGBColorSpace;
  sky.name="transport-harbour-sky";
  const stencil=deckStencil();
  const deckContact=createDeckContactMap(data.colliders);
  for(let i=0;i<textures.length;i++) {
    if(authored.has(data.parts[i].material.name))continue;
    const source=textures[i];
    const upgraded=upgradeTransportTexture(source,data.parts[i].material.name);
    if(upgraded!==source){textures[i]=upgraded;source.dispose();}
  }
  const detail=createTransportSurfaceDetail();
  const group=new THREE.Group();group.name='classic-transport-ship';
  group.scale.x=-1;
  const caseMarks=caseAtlas();
  const loads=canvasLoads(data.colliders);
  const obstacles=[];
  data.parts.forEach((p,i)=>{
    const buffer=new THREE.InterleavedBuffer(new Float32Array(binary,p.offset,p.count*7),7);
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.InterleavedBufferAttribute(buffer,3,0));
    g.setAttribute('uv',new THREE.InterleavedBufferAttribute(buffer,2,3));
    g.setAttribute('uv1',new THREE.InterleavedBufferAttribute(buffer,2,5));
    const surface=SHIP_SURFACE_MATERIALS.has(p.material.name)||p.material.name.startsWith('ship/');
    const organic=WOOD_BULLET_MATERIALS.has(p.material.name)||CANVAS_SURFACE_MATERIALS.has(p.material.name);
    const deck=p.material.name==='transportship/texture_95';
    const corrugated=CORRUGATED_SURFACE_MATERIALS.has(p.material.name);
    let mat;
    const airframe=p.material.name==='transportship/fuslo' || p.material.name==='transportship/verde';
    if(p.material.name.includes('/glass/offwndwb_')) {
      g.computeVertexNormals();
      mat=createDeckhouseGlass();
    } else if(airframe) {
      g.computeVertexNormals();
      const blades=p.material.name.endsWith('/verde');
      mat=new THREE.MeshStandardMaterial({map:textures[i],side:THREE.DoubleSide,
        metalness:blades?.32:.22,roughness:blades?.69:.56,envMapIntensity:.55});
      // Remap the almost-black placeholder paint, retaining yellow markings.
      mat.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
          `#include <map_fragment>
          float marking=smoothstep(.10,.45,diffuseColor.r);
          diffuseColor.rgb=mix(${blades?'vec3(.062,.072,.071)':'vec3(.17,.195,.181)'},diffuseColor.rgb,marking);`);
      };
      mat.customProgramCacheKey=()=>blades?'transport-rotor':'transport-fuselage';
    } else if(surface) {
      g.computeVertexNormals();
      const fabric=['canvas-top','canvas-side'].includes(authored.get(p.material.name));
      const Material=fabric ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
      mat=new Material({map:textures[i],lightMap:light,lightMapIntensity:.34,
        aoMap:occlusion,aoMapIntensity:.93, color:0xffffff,
        side:THREE.DoubleSide,alphaTest:p.material.alphaTest||0,
        bumpMap:normals.has(p.material.name)?null:textures[i],bumpScale:organic ? .008 : corrugated?.042:.014,
        normalMap:normals.get(p.material.name) || detail.normal,
        normalScale:new THREE.Vector2().setScalar(normals.has(p.material.name)?1:.28),
        roughnessMap:roughness.get(p.material.name) || detail.roughness,
        roughness:1,metalness:organic?0:deck?.035:.11,
        envMapIntensity:organic?.47:deck?.34:.53});
      if(authored.get(p.material.name)==='service-cabinet') {
        mat.metalnessMap=mat.roughnessMap;
        mat.metalness=1;
      }
      if(fabric) {
        mat.sheen=.70;
        mat.sheenColor.setHex(0xbdb29a);
        mat.sheenRoughness=.82;
      }
      // Three's normal-map branch normally masks the bump-map branch. Layer
      // the original panel/rivet relief on top of the fine shared normal map.
      mat.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
          '#include <normal_fragment_maps>\n#ifdef USE_BUMPMAP\nnormal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(), faceDirection);\n#endif');
        if(fabric) {
          // The green channel controls roughness. Red masks the fibre lobe
          // away from the pallet skirt and lowers it over the webbing.
          shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',
            '#include <lights_physical_fragment>\nmaterial.sheenColor *= texelRoughness.r;');
          if(authored.get(p.material.name)==='canvas-side'){
            shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',
              `#include <aomap_fragment>
              reflectedLight.indirectDiffuse *= texelRoughness.b;
              sheenSpecularIndirect *= texelRoughness.b;`);
          }
        }
        const bulkhead = deck || /^transportship\/texture_(93|94)$/.test(p.material.name);
        if (bulkhead) {
          shader.vertexShader='varying vec3 vTransportNormal;\nvarying vec3 vTransportWorld;\n'+shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\nvTransportNormal = normalize(mat3(modelMatrix) * normal);\nvTransportWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          shader.fragmentShader='varying vec3 vTransportNormal;\nvarying vec3 vTransportWorld;\n'+shader.fragmentShader;
          addBulkheadLight(shader);
          if (!deck) paintCompartmentWalls(shader);
        }
        if(deck || fabric) softenTransportCargoShadow(shader);
        if(deck) {
          shader.uniforms.uDeckStencil={value:stencil};
          shader.uniforms.uTransportGrit={value:detail.grit};
          shader.uniforms.uDeckContact={value:deckContact};
          shader.fragmentShader='uniform sampler2D uDeckStencil;\nuniform sampler2D uTransportGrit;\nuniform sampler2D uDeckContact;\n'+shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#include <map_fragment>
            float deckFlat = smoothstep(0.72, 0.94, abs(vTransportNormal.y));
            float deckLevel = 1.0 - smoothstep(0.08, 0.18, abs(vTransportWorld.y));
            float laneEdge = abs(abs(vTransportWorld.x) - 11.35);
            float lanePaint = (1.0 - smoothstep(0.045, 0.09, laneEdge))
              * (1.0 - smoothstep(32.0, 38.0, abs(vTransportWorld.z)))
              * deckFlat * deckLevel;
            float wear = texture2D(uTransportGrit, vTransportWorld.xz * 0.35).r;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.38,.24,.055),
              lanePaint * smoothstep(.53,.73,wear) * .78);
            // Broken corner marks identify the inboard edges of cargo bays.
            vec2 bay = vec2(abs(vTransportWorld.x) - 6.5, mod(vTransportWorld.z+4., 8.)-4.);
            vec2 stripe = abs(bay);
            float lineWidth = max(.01, fwidth(bay.x)+fwidth(bay.y));
            float along = (1.-smoothstep(.037,.037+lineWidth,stripe.x)) * (1.-smoothstep(.66,.72,stripe.y));
            float across = (1.-smoothstep(.037,.037+lineWidth,stripe.y)) * smoothstep(-.05,.0,bay.x)
              * (1.-smoothstep(.43,.49,bay.x));
            float bayPaint = max(along,across) * (1.-smoothstep(28.,32.,abs(vTransportWorld.z)));
            diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.44,.32,.105),
              bayPaint * deckFlat * deckLevel * smoothstep(.51,.71,wear)*.79);
            vec2 contactUV = vec2(vTransportWorld.x/32.+.5,.5-vTransportWorld.z/96.);
            vec4 deckUse = texture2D(uDeckContact,contactUV);
            float contact = deckUse.r;
            float abrasion = deckUse.g * deckFlat * deckLevel;
            float paintFilm = deckUse.b * deckFlat * deckLevel;
            float tooth = smoothstep(.51,.74,wear);
            float traffic = (deckUse.a * 255. - 128.) / 127.;
            float walked = max(0.,traffic)*deckFlat*deckLevel;
            float dust = max(0.,-traffic)*deckFlat*deckLevel;
            float grain = texture2D(uTransportGrit,vTransportWorld.xz*.073).r;
            dust *= (.42+.58*smoothstep(.48,.80,grain))*(.70+.30*tooth);
            // Foot traffic breaks the chalky top coat. The worn area keeps
            // the original plate scratches and only picks up a broad sheen.
            diffuseColor.rgb *= 1.+walked*(.10+.10*tooth);
            diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.29,.235,.17),dust*.69);
            // Dry rubber transfer and exposed primer follow the vehicle paths.
            // The scan still supplies the scratches and seams through the wear.
            diffuseColor.rgb *= 1. - abrasion * (.39+.22*tooth);
            diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.32,.25,.115),
              paintFilm*(.22+.58*tooth));
            diffuseColor.rgb *= mix(1.,contact,deckFlat*deckLevel*.92);
            float endSign = sign(vTransportWorld.z);
            vec2 stencilUv = vec2(endSign*(vTransportWorld.x+endSign*7.0)/3.0,
              (16.8-abs(vTransportWorld.z))/1.5) + 0.5;
            float inside = step(0.,stencilUv.x)*step(stencilUv.x,1.)*step(0.,stencilUv.y)*step(stencilUv.y,1.);
            float marking = texture2D(uDeckStencil,clamp(stencilUv,0.,1.)).a * inside * deckFlat * deckLevel;
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.41,.37,.26),marking*.72);`)
            .replace('#include <roughnessmap_fragment>',
              `#include <roughnessmap_fragment>
              roughnessFactor = clamp(roughnessFactor - abrasion*.10 - walked*.17
                + dust*.18 + paintFilm*.06,.72,1.);`)
            .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
              normal=normalize(mix(normal,nonPerturbedNormal,.24*walked+.18*dust));`);

        }
      };
      mat.customProgramCacheKey=()=> `transport-surface-detail-v7-${fabric?'cloth':'solid'}-${deck?'dry-deck':authored.get(p.material.name)==='canvas-side'?'hanging-folds':/texture_(93|94)$/.test(p.material.name)?'bulkhead':'dry'}`;
    } else {
      // Signs, alpha-tested fencing and small authored details keep their
      // original source colours; they are not metallic structural surfaces.
      mat=new THREE.MeshBasicMaterial({map:textures[i],lightMap:light,lightMapIntensity:1,
        color:textures[i]?0xffffff:0x6d7a7d,side:THREE.DoubleSide,
        alphaTest:p.material.alphaTest||0,toneMapped:false});
    }
    if (p.material.name==='cs_havana/metalfence007a') {
      // Mips average thin wire and sky into the same texel. Let MSAA carry
      // that fractional coverage through instead of thresholding it twice.
      mat.alphaTest=.015;
      mat.alphaToCoverage=true;
    }
    mat.name=p.material.name;
    const mesh=new THREE.Mesh(g,mat);mesh.name=p.material.name;
    if(authored.get(p.material.name)==='cargo') {
      formTransportCargoPanel(mesh);
      paintTransportStacks(mesh);
      mat.normalScale.setScalar(.92);
    }
    if(authored.get(p.material.name)==='cargo-doors')matchTransportDoorPaint(mesh);
    if(['canvas-side','canvas-top'].includes(authored.get(p.material.name))) {
      formTransportCanvas(mesh,loads,authored.get(p.material.name)==='canvas-top');
      mat.normalScale.setScalar(.78);
      if(authored.get(p.material.name)==='canvas-side')markTransportFreight(mesh);
    }
    if(WOOD_BULLET_MATERIALS.has(mesh.name)){
      formTimberBoards(mesh);
      dressTimberCases(mesh,data.colliders,caseMarks);
      mat.normalScale.setScalar(.68);
    }
    if(authored.get(mesh.name)==='service-cabinet'){
      formCabinetSteel(mesh);
      mat.normalScale.setScalar(.35);
    }
    mesh.castShadow=surface || airframe;
    mesh.receiveShadow=surface || airframe;
    if(WOOD_BULLET_MATERIALS.has(p.material.name))mesh.userData.bulletMaterial='wood';
    if (surface || airframe) {
      mesh.userData.impactSurface = WOOD_BULLET_MATERIALS.has(mesh.name) ? 'wood'
        : CANVAS_SURFACE_MATERIALS.has(mesh.name) ? 'cloth' : 'metal';
    }
    group.add(mesh);
    obstacles.push(mesh);
  });
  const scanner=detachMastScanner(group.getObjectByName('transportship/texture_95'));
  const booms=createTransportBooms();
  const signals=createHoistSignals();
  booms.add(signals,createDeckhouseWindowFrames(),createTransportSuperstructure(group.getObjectByName('transportship/texture_94').material));
  const fog=new THREE.Fog(0xb4bdc1,31,165);
  const rain=createTransportRain(data.colliders,rainCover);
  const dynamics=createTransportDynamics(rainCover,rain.roofAt);
  const cargoRelief=createTransportCargoDetail(data.colliders);
  cargoRelief.add(createTransportDoorGear(group.getObjectByName('transportship/texture_79')));
  cargoRelief.add(createFreightFlySheets(data.colliders,sheetColor,sheetNormal));
  const pine=group.getObjectByName('transportship/texture_234').material;
  const fittings=createTransportOutfitting(data.colliders,pine);
  // Visual receivers only. The gameplay ray still hits the original brush.
  const sheet = cargoRelief.getObjectByName('transport-folded-corner-sheets');
  const fans=fittings.getObjectByName('transport-vent-impellers');
  const tail=cargoRelief.getObjectByName('transport-loose-buckle-tail');
  const receipt=createFreightNote(data.colliders);
  const tracks=createDeckTracks(deckContact);
  fittings.add(receipt,tracks.mesh,createTransportCompartments());
  const braces = fittings.getObjectByName('transport-timber-braces');
  const casePlates=createCaseCornerPlates(data.colliders,caseMarks);
  fittings.add(casePlates);
  fittings.add(addBattenFasteners(braces));
  const bands = cargoRelief.getObjectByName('transport-tarp-webbing');
  const clips = cargoRelief.getObjectByName('transport-tarp-clips');
  // Use the same receiving filter across the cloth, hems and fastening hardware.
  for(const material of new Set([sheet.material,bands.material,clips.material])){
    material.onBeforeCompile=softenTransportCargoShadow;
    material.customProgramCacheKey=()=>'transport-freight-penumbra-1';
  }
  sheet.userData.impactSurface = 'cloth';
  braces.userData.impactSurface = 'wood';
  braces.userData.impactGrainAxis = new THREE.Vector3(1,0,0);
  bands.userData.impactSurface = 'cloth';
  clips.userData.impactSurface = 'metal';
  for (const mesh of obstacles) {
    const finish = authored.get(mesh.name);
    if (finish === 'pine' || finish === 'painted-wood') mesh.impactLayers = [sheet,braces,casePlates];
    if (finish !== 'canvas-side' && finish !== 'canvas-top' && finish !== 'cargo') continue;
    // These meshes override raycast with the flat BSP proxy. Share the formed
    // geometry and matrix with a receiver outside the scene for the VFX query.
    const skin = new THREE.Mesh(mesh.geometry,mesh.material);
    skin.matrixWorld = mesh.matrixWorld;
    skin.userData.impactSurface = mesh.userData.impactSurface;
    if (finish === 'canvas-side') {
      // The authored roughness atlas stores cloth coverage in red and zero
      // on the exposed galvanized skirt. Sample once per hit, from a CPU copy.
      const image = mesh.material.roughnessMap.image;
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image,0,0);
      const mask = ctx.getImageData(0,0,image.width,image.height).data;
      skin.userData.impactSurfaceAt = uv => {
        const x = Math.min(image.width-1,Math.max(0,Math.floor(uv.x*image.width)));
        const y = Math.min(image.height-1,Math.max(0,Math.floor((1-uv.y)*image.height)));
        return mask[(y*image.width+x)*4] < 7 ? 'metal' : 'cloth';
      };
    }
    mesh.impactLayers = finish === 'cargo' ? [skin] : [skin,sheet,bands,clips];
  }
  // Flush covers share a draw and sit on the actual 25.4 mm raised deck plate.
  const coverMaterial=new THREE.MeshStandardMaterial({map:hatchPaint,alphaTest:.5,
    normalMap:hatchSurface,roughnessMap:hatchSurface,metalness:.23,roughness:1,envMapIntensity:.45});
  coverMaterial.onBeforeCompile=shader=>{
    softenTransportCargoShadow(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      'float roughnessFactor=roughness*texture2D(roughnessMap,vRoughnessMapUv).a;');
  };
  const covers=new THREE.InstancedMesh(precisionHatchGeometry(),coverMaterial,3);
  covers.name='transport-flush-inspection-covers';
  const pose=new THREE.Object3D();
  for (const [i,[x,z,yaw]] of [[7,-11,.04],[-7,10,Math.PI],[1,-23,0]].entries()) {
    pose.position.set(x,.028,z);
    pose.rotation.set(-Math.PI/2,yaw,0,'YXZ');
    pose.updateMatrix();
    covers.setMatrixAt(i,pose.matrix);
  }
  covers.receiveShadow=true;
  fittings.add(covers);
  for (const mesh of obstacles) {
    const finish=authored.get(mesh.name);
    if (['deck','canvas-top','canvas-side','pine','painted-wood'].includes(finish))
      filterLaneFinish(mesh.material);
    if (finish==='deck' || finish==='canvas-top' || finish==='canvas-side')
      dampenTransportMaterial(mesh.material,rainCover,finish.replace('canvas-',''),dynamics.userData.clock);
  }
  filterLaneFinish(braces.material);
  filterLaneFinish(sheet.material);
  filterLaneFinish(coverMaterial);
  dampenTransportMaterial(sheet.material,rainCover,'sheet');
  dampenTransportMaterial(coverMaterial,rainCover,'hatch');
  lightTransportSurfaces([group,cargoRelief,fittings,booms],skyAccess,roomLight);
  scene.add(group,cargoRelief,fittings,booms);scene.background=sky;scene.environment=environment;scene.fog=fog;
  const water=waterMaps();
  for(const k of ['map','normalMap','roughnessMap'])water[k].repeat.set(1600/14,1600/14);
  const sea=new THREE.Mesh(harbourWaterGeometry(),new THREE.MeshStandardMaterial({
    map:water.map,normalMap:water.normalMap,roughnessMap:water.roughnessMap,normalScale:water.normalScale,
    color:0xdce8ef,roughness:.72,metalness:.1,envMapIntensity:.55,
  }));
  sea.name='transport-open-water';
  const updateWater=animateShipWater(sea.material,dynamics.userData.clock);
  sea.rotation.x=-Math.PI/2;sea.position.y=-3.42;scene.add(sea);
  const storm=createTransportStormAudio();
  scene.add(rain.root,dynamics);
  // Identify the visible face directly under a supported foot. A box brush
  // can list wood and metal together; a standing actor may also be below it.
  group.updateWorldMatrix(true,true);
  const timber=group.children.filter(mesh=>WOOD_BULLET_MATERIALS.has(mesh.name));
  const footRay=new THREE.Raycaster();
  footRay.ray.direction.set(0,-1,0);footRay.far=.18;
  const woodFaces=[];
  function footSurface(x,y,z) {
    footRay.ray.origin.set(x,y+.09,z);
    woodFaces.length=0;
    footRay.intersectObjects(timber,false,woodFaces);
    if (woodFaces.length) return 'wood';
    const rainHit=rain.receiverAt(x,y,z);
    if (rainHit===1) return 'wet-steel';
    if (rainHit===2) return 'canvas';
    return 'dry-steel';
  }
  return {...data, obstacles, visuals:[group,cargoRelief,sea,fittings,booms,rain.root,dynamics], background:sky, environment, fog,
    renderLook:{hemiSky:0xccdaea,hemiGround:0x939089,hemiIntensity:1.45,
      sunPosition:transportSunPosition,sunColor:0xffe0b8,sunIntensity:1.85,exposure:1.04},
    skyVisibilityAt:createTransportSkyProbe(skyAccess),
    compartmentLightAt:createCompartmentLightProbe(roomLight),
    sunVisibilityAt:createTransportSunProbe(data.colliders),
    deckImpulse:tail.userData.impulse,
    deckWalk:tracks.walk, footSurface,
    rainSheltered:rain.sheltered,
    weatherAudio(sfx,eye,playing) {
      if (!playing) {rain.soundHits(eye,null);storm.stop();scene.backgroundIntensity=1;return;}
      const inside=rain.sheltered(eye);
      const flash=storm.update(sfx,inside,eye);
      rain.soundHits(eye,!storm.canHearHits() || !sfx.ctx || sfx.muted ? null : hit=>storm.impact(sfx,hit));
      scene.backgroundIntensity=1+.46*flash;
    },
    setActive(active) {
      tracks.reset();
      if (!active) {storm.stop();scene.backgroundIntensity=1;}
    },
    source:'cf-transportship-source-port', update(t,dt,camera){
      if(camera)cargoRelief.userData.updateDetailLod(camera.position,t);
      dynamics.userData.update(t);
      rain.update(t);
      scanner.rotation.y=t*.70;
      signals.userData.update(t);
      receipt.userData.update(t);
      tracks.update(t);
      updateFreightWind(sheet,t);
      fans.userData.turn(t);
      tail.userData.setTime(t);
      updateWater(t);
    }};

}
