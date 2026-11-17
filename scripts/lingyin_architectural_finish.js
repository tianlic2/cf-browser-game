import * as THREE from 'three';
import { finishHallPorch } from './lingyin_porch_finish.js?v=dry-stone-1';
import { finishHallWindows } from './lingyin_window_finish.js?v=chisel-sanctum-1';
import { finishHallContactWear } from './lingyin_contact_wear.js';
import { finishHallAltar } from './lingyin_altar_finish.js?v=chisel-sanctum-1';
import { MAIN_PORTAL, MAIN_HALL, MAIN_HALL_FLOOR_Y, MAIN_HALL_STAIRS, mainHallStair } from './lingyin_main_hall.js?v=grand-portal-1';

// Linear radiance from two cubemap captures of this map. Row zero is the
// nadir. The fourth byte stores the multiplier for a 0–16 linear range.
async function loadLightProbe(name) {
  const size = 256 * 128;
  const response = await fetch(new URL('../assets/lingyin/light/' + name + '.rgbm', import.meta.url));
  if (!response.ok) throw new Error('无法加载灵隐寺环境光 ' + name);
  const rgbm = new Uint8Array(await response.arrayBuffer());
  if (rgbm.length !== size * 4) throw new Error('灵隐寺环境光尺寸错误 ' + name);
  const linear = new Uint16Array(rgbm.length);
  for (let i = 0; i < linear.length; i += 4) {
    const scale = rgbm[i + 3] * 16 / (255 * 255);
    for (let c = 0; c < 3; c++) linear[i+c] = THREE.DataUtils.toHalfFloat(rgbm[i+c] * scale);
    linear[i+3] = 0x3c00;
  }
  const probe = new THREE.DataTexture(linear,256,128,THREE.RGBAFormat,THREE.HalfFloatType);
  probe.name = 'lingyin-' + name + '-radiance';
  probe.mapping = THREE.EquirectangularReflectionMapping;
  probe.colorSpace = THREE.LinearSRGBColorSpace;
  probe.minFilter = probe.magFilter = THREE.LinearFilter;
  probe.needsUpdate = true;
  return probe;
}

// Distances to actual ground-level masonry, baked once in map coordinates.
// Red is narrow contact shade; green is the broader skirt of sheltered stone.
function courtyardContact(colliders) {
  const w=320,h=512,bytes=new Uint8Array(w*h*4);
  const solids=colliders.filter(b=>b.y0<.18 && b.h>.24 && !b.landscape);
  for (const b of solids) {
    const reach=Math.min(1.65,.35+b.h*.4);
    const x0=Math.max(0,Math.floor((b.x-b.hx-reach+40)*4));
    const x1=Math.min(w-1,Math.ceil((b.x+b.hx+reach+40)*4));
    const z0=Math.max(0,Math.floor((b.z-b.hz-reach+50)*4));
    const z1=Math.min(h-1,Math.ceil((b.z+b.hz+reach+50)*4));
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
      const dx=Math.abs((x+.5)/4-40-b.x), dz=Math.abs((z+.5)/4-50-b.z);
      const distance=b.round ? Math.max(0,Math.hypot(dx/b.hx,dz/b.hz)-1)*Math.min(b.hx,b.hz)
        : Math.hypot(Math.max(0,dx-b.hx),Math.max(0,dz-b.hz));
      const i=4*(z*w+x);
      bytes[i]=Math.max(bytes[i],Math.round(255*Math.exp(-distance*7)));
      bytes[i+1]=Math.max(bytes[i+1],Math.round(255*(1-THREE.MathUtils.smoothstep(distance,0,reach))));
    }
  }
  const tex=new THREE.DataTexture(bytes,w,h);
  tex.name='lingyin-masonry-contact';tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;
  return tex;
}

function finishStone(mat,contact,stair) {
  const compile=mat.onBeforeCompile, key=mat.customProgramCacheKey();
  const front=MAIN_HALL.z+mainHallStair(0).z+MAIN_HALL_STAIRS.treadDepth/2;
  const back=front-MAIN_HALL_STAIRS.count*MAIN_HALL_STAIRS.treadDepth;
  mat.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.vertexShader='varying vec3 vTemplePosition;\n'+shader.vertexShader.replace(
      '#include <project_vertex>','#include <project_vertex>\nvTemplePosition=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.uniforms.uTempleContact={value:contact};
    shader.fragmentShader='varying vec3 vTemplePosition;\nuniform sampler2D uTempleContact;\n'+shader.fragmentShader;
    // Only the scanned court uses this running-bond pattern. Preserve its
    // photographed joints while varying broad mineral tone between courses.
    const course=mat.name==='courtyard-photogrammetry-extension' ? `
      vec2 scan=vMapUv*3.;
      float row=floor(scan.y);
      float cell=floor(scan.x+.5*mod(row,2.));
      float stoneSeed=fract(sin(dot(vec2(cell,row),vec2(12.9898,78.233)))*43758.5453);
      vec2 margin=min(fract(vec2(scan.x+.5*mod(row,2.),scan.y)),
                      1.-fract(vec2(scan.x+.5*mod(row,2.),scan.y)));
      // Fade the variation before its boundary rather than drawing another seam.
      float core=smoothstep(.02,.27,min(margin.x,margin.y));
      diffuseColor.rgb*=1.+(stoneSeed-.5)*.20*core;
    ` : '';
    // The scan supplies the original joints and mineral grain. A second,
    // coarser sample breaks the travel lane into overlapping worn patches.
    const approach=mat.name==='courtyard-photogrammetry-extension' ? `
      vec2 ground=vTemplePosition.xz;
      float axis=ground.x-(${MAIN_HALL.x.toFixed(2)})+.38*sin(ground.y*.48)+.18*sin(ground.y*.85+.8);
      float mottling=texture2D(roughnessMap,vRoughnessMapUv*.39+vec2(.31,.17)).g;
      float lane=1.-smoothstep(.45,3.45,abs(axis)+.83*(mottling-.5));
      float intact=smoothstep(.035,.17,mineral);
      float traffic=lane*intact*(.67+.33*mottling)*(1.-contact.g)
        *(1.-smoothstep(12.,22.,ground.y))*smoothstep(-11.,-7.9,ground.y);

      // The high grains lose their chalky skin; dark mortar stays recessed.
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.78,.82,.85)
        +vec3(.013,.014,.014),traffic);

    ` : '';
    const masks=stair ? `
      float inStair=step(${back},vTemplePosition.z)*step(vTemplePosition.z,${front})*
        step(vTemplePosition.y,${MAIN_HALL_FLOOR_Y});
      float walk=inStair*(1.-smoothstep(1.,3.25,abs(vTemplePosition.x-(${MAIN_HALL.x.toFixed(2)}))));
      float upward=abs(normalize(cross(dFdx(vTemplePosition),dFdy(vTemplePosition))).y);
      walk*=smoothstep(.75,.99,upward);
      float stepU=fract((${front}-vTemplePosition.z)/${MAIN_HALL_STAIRS.treadDepth});
      float nose=walk*(1.-smoothstep(.02,.28,stepU));
      diffuseColor.rgb*=vec3(.96,.98,.99)*(1.+.12*nose-.045*walk);
      ` : `
      vec2 contact=texture2D(uTempleContact,(vTemplePosition.xz+vec2(40.,50.))/vec2(80.,128.)).rg;
      float walk=(1.-smoothstep(1.3,4.5,abs(vTemplePosition.x+2.)))*(1.-contact.g);
      // The scan already contains joints. Retain their original placement.
      float mineral=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=mix(vec3(mineral),diffuseColor.rgb,.72)*vec3(.83,.91,1.);
      ${course}
      diffuseColor.rgb*=1.-.27*contact.r-.065*contact.g;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.86,.94,.83),contact.g*.48);
      ${approach}
      `;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n'+masks+'\nroughnessFactor=max(.65,roughnessFactor-.105*walk);'+
        (approach?'\nroughnessFactor=mix(roughnessFactor,.74+.025*mottling,traffic);':''))
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,.26*walk));'+
        (approach?'\nnormal=normalize(mix(normal,nonPerturbedNormal,.46*traffic));':''));
  };
  mat.customProgramCacheKey=()=>key+(stair?'-temple-treads':'-temple-paving');
}

// Treat the two actual paper-window banks as diffuse area sources. Interpolate
// their broad contribution across the woodwork; no extra render or shadow pass.
function addWindowFill(mat, windows) {
  const compile=mat.onBeforeCompile, key=mat.customProgramCacheKey();
  mat.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.uniforms.uTempleWindows={value:windows};
    shader.vertexShader='uniform vec3 uTempleWindows[2];\nvarying float vWindowFill;\n'+
      shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec3 surface=(modelMatrix*vec4(transformed,1.)).xyz;
        vec3 face=inverseTransformDirection(transformedNormal,viewMatrix);
        vWindowFill=0.;
        for(int side=0;side<2;side++){
          vec3 delta=uTempleWindows[side]-surface;
          float d2=max(dot(delta,delta),.25);
          vec3 direction=delta*inversesqrt(d2);
          vWindowFill+=max(dot(face,direction),0.)*abs(direction.x)*42./(42.+d2);
        }`);
    shader.fragmentShader='varying float vWindowFill;\n'+shader.fragmentShader.replace(
      '#include <aomap_fragment>',`reflectedLight.indirectDiffuse+=diffuseColor.rgb*
        (1.-metalnessFactor)*vec3(.65,.62,.54)*vWindowFill;
        #include <aomap_fragment>`);
  };
  mat.customProgramCacheKey=()=>key+'-paper-window-fill';
}

// Indirect daylight arriving through the front bay. For an interior point,
// integrate the solid angle of the opening, then weight it by the receiving
// face. Evaluate per fragment so even one large floor polygon grades smoothly.
function addEntranceDaylight(mat, porchOnly=false) {
  const compile=mat.onBeforeCompile, key=mat.customProgramCacheKey();
  const doorZ=MAIN_HALL.z+MAIN_HALL.d/2-1.35;
  const aperture=new THREE.Vector4(MAIN_HALL.x,doorZ,MAIN_HALL_FLOOR_Y,
    MAIN_HALL_FLOOR_Y+MAIN_PORTAL.clearHeight);
  mat.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.uniforms.uHallOpening={value:aperture};
    shader.vertexShader='varying vec3 vDoorLightPosition;\n'+shader.vertexShader.replace(
      '#include <project_vertex>','#include <project_vertex>\nvDoorLightPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=`varying vec3 vDoorLightPosition;
      uniform vec4 uHallOpening;
      float apertureCorner(vec2 p,float d){
        return atan(p.x*p.y,d*sqrt(dot(p,p)+d*d));
      }
    `+shader.fragmentShader.replace('#include <aomap_fragment>',`
      vec3 doorP=vDoorLightPosition;
      vec3 doorN=inverseTransformDirection(normal,viewMatrix);
      float depth=uHallOpening.y-doorP.z;
      float d=max(.65,depth);
      vec2 doorLow=vec2(uHallOpening.x-${MAIN_PORTAL.halfClear.toFixed(3)},uHallOpening.z)-doorP.xy;
      vec2 doorHigh=vec2(uHallOpening.x+${MAIN_PORTAL.halfClear.toFixed(3)},uHallOpening.w)-doorP.xy;
      float omega=apertureCorner(doorHigh,d)+apertureCorner(doorLow,d)
        -apertureCorner(vec2(doorLow.x,doorHigh.y),d)-apertureCorner(vec2(doorHigh.x,doorLow.y),d);
      // Anchor the representative direction to the closest part of the opening.
      vec2 towards=mix(clamp(vec2(0.),doorLow,doorHigh),(doorLow+doorHigh)*.5,.50);
      vec3 incoming=normalize(vec3(towards,d));
      float inside=clamp(omega*.159155,0.,1.)*
        (.20+.8*max(0.,dot(doorN,incoming)));
      // On the porch, the whole court supplies light. Upturned faces see sky,
      // and downward-facing joinery receives the weaker stone-floor bounce.
      const float eaveHeight=${(MAIN_HALL.eave-MAIN_HALL.plinth-.15+1).toFixed(3)};
      float belowEave=1.-smoothstep(eaveHeight-.6,eaveHeight+1.7,doorP.y);
      float front=max(0.,dot(doorN,normalize(vec3(-.24,.33,.91))));
      float porch=belowEave*(.13+.76*front+.11*max(0.,-doorN.y));
      float atFacade=smoothstep(-.6,.55,-depth);
      vec3 courtyardLight=mix(1.65*inside*vec3(.86,.94,1.04),
        porch*vec3(.91,.95,.99),atFacade);
      // The projecting bracket arms see more open court than the tie beam at
      // their roots. The pale terrace returns light to the flanks and soffits.
      float lateral=abs(doorP.x-uHallOpening.x);
      float bayMask=1.-smoothstep(${(MAIN_HALL.w/2).toFixed(3)},${(MAIN_HALL.w/2+1.8).toFixed(3)},lateral);
      float entrance=bayMask*(1.-smoothstep(10.,15.,depth))
        *smoothstep(-8.,-5.,depth)*(1.-smoothstep(eaveHeight+.45,eaveHeight+1.7,doorP.y));
      float beyondLintel=smoothstep(-.60,2.10,depth);
      float reveal=1.-smoothstep(${(MAIN_PORTAL.halfClear-.25).toFixed(3)},${(MAIN_PORTAL.halfClear+1.05).toFixed(3)},lateral);
      float courtView=mix(1.,clamp(omega*.159155,0.,1.),beyondLintel);
      float projection=smoothstep(-.15,2.75,-depth);
      float groundHeight=max(.05,doorP.y-uHallOpening.z);
      vec3 groundRay=normalize(vec3(clamp(uHallOpening.x-doorP.x,-3.,3.)-.85,
        -(groundHeight+1.2),max(2.4,6.4+depth)));
      float facingStone=max(0.,dot(doorN,groundRay));
      float under=max(0.,-doorN.y);
      float foot=smoothstep(.03,.80,groundHeight);
      float crown=smoothstep(eaveHeight-1.20,eaveHeight+.20,doorP.y);
      float beamPocket=crown*(1.-projection);
      float apertureSide=1.-smoothstep(0.,4.,abs(lateral-${MAIN_PORTAL.halfClear.toFixed(3)}));
      float revealShadow=exp(-abs(depth)*.96)*apertureSide*(1.-max(0.,doorN.z));
      float shelter=clamp(.18*(1.-foot)+.27*beamPocket+.20*revealShadow
        +.28*beyondLintel*(1.-reveal),0.,.72);
      reflectedLight.indirectDiffuse*=1.-entrance*shelter;
      reflectedLight.indirectSpecular*=1.-entrance*shelter*.60;
      float spread=.22+.78*facingStone;
      float bounce=(.55+.50*projection)*spread+.28*under;
      vec3 stoneReturn=vec3(1.13,.96,.77)*bounce*(.62+.38*foot)*(1.-.39*beamPocket);
      // Past the threshold the door aperture limits the courtyard return.
      float innerReturn=beyondLintel*exp(-max(depth,0.)*.15)*(.26+.74*reveal)
        *(.36+.64*max(0.,dot(doorN,normalize(vec3(.21,-.72,-.48)))));
      ${porchOnly?'courtyardLight=vec3(0.);':''}
      courtyardLight+=entrance*${porchOnly?'.35':mat.name==='hall-exterior-blue-gold-caihua'?'.59':'1.'}
        *(stoneReturn*courtView+vec3(.85,.73,.61)*innerReturn);
      reflectedLight.indirectDiffuse+=diffuseColor.rgb*(1.-metalnessFactor)*courtyardLight;
      #include <aomap_fragment>`);
  };
  mat.customProgramCacheKey=()=>key+(porchOnly?'-porch-timber-bounce':'-main-porch-bounce');
}

// Six paper panels contribute soft, view-dependent specular light on polished
// stone. Derive their rectangles from the rendered geometry, including frame gaps.
function finishSanctumStone(world,bank) {
  const position=bank.geometry.getAttribute('position');
  const panels=[],point=new THREE.Vector3();
  for(let i=0;i<position.count;i+=4){
    const bounds=new THREE.Box3();
    for(let j=0;j<4;j++)bounds.expandByPoint(point.fromBufferAttribute(position,i+j).applyMatrix4(bank.matrixWorld));
    panels.push(bounds);
  }
  if(panels.length!==6)return;
  const aperture=`
    uniform vec3 uPaperMin[6], uPaperMax[6];
    // Projected area of the six paper panels as seen by a horizontal stone tile.
    float paperIrradiance(vec3 p){
      float light=0.;
      for(int i=0;i<6;i++){
        vec3 delta=(uPaperMin[i]+uPaperMax[i])*.5-p;
        vec2 size=uPaperMax[i].yz-uPaperMin[i].yz;
        float area=size.x*size.y;
        float d2=max(dot(delta,delta),.001);
        light+=area*max(0.,delta.y)*abs(delta.x)/(d2*(d2+.45*area));
      }
      return min(light,1.);
    }
    float paperVisibility(vec3 origin, vec3 direction,float spread){
      if(abs(direction.x)<.05)return 0.;
      float coverage=0.;
      for(int i=0;i<6;i++){
        float distanceToPaper=(uPaperMin[i].x-origin.x)/direction.x;
        if(distanceToPaper<=0.)continue;
        vec2 hit=origin.yz+direction.yz*distanceToPaper;
        vec2 centre=(uPaperMin[i].yz+uPaperMax[i].yz)*.5;
        vec2 edge=abs(hit-centre)-(uPaperMax[i].yz-centre);
        float penumbra=.08+distanceToPaper*spread;
        coverage+=1.-smoothstep(-penumbra,penumbra,max(edge.x,edge.y));
      }
      return min(coverage,1.);
    }`;
  function apply(mesh,floor){
    const mat=mesh.material,old=mat.onBeforeCompile,key=mat.customProgramCacheKey();
    mat.onBeforeCompile=function(shader,renderer){
      old.call(this,shader,renderer);
      shader.uniforms.uPaperMin={value:panels.map(p=>p.min)};
      shader.uniforms.uPaperMax={value:panels.map(p=>p.max)};
      shader.vertexShader='varying vec3 vSanctumPoint;\n'+shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nvSanctumPoint=(modelMatrix*vec4(transformed,1.)).xyz;');
      const response=floor?`
        vec3 eye=normalize(cameraPosition-vSanctumPoint);
        vec3 surfaceNormal=inverseTransformDirection(normal,viewMatrix);
        vec3 ray=reflect(-eye,surfaceNormal);
        float reflection=paperVisibility(vSanctumPoint,ray,.16+.28*roughnessFactor);
        float fresnel=.012+.089*pow(1.-clamp(dot(eye,surfaceNormal),0.,1.),5.);
        reflectedLight.indirectSpecular+=reflection*fresnel*vec3(1.11,1.18,1.25);
        reflectedLight.indirectDiffuse*=.74;
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*paperIrradiance(vSanctumPoint)*vec3(.71,.79,.87);
      `:`
        // Only the marble atlas cell receives lateral window light here.
        if(vMapUv.x<.25 && vMapUv.y<.5){
          float sunPatch=paperVisibility(vSanctumPoint,normalize(vec3(-1.,.38,.29)),.12);
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*sunPatch*vec3(.50,.46,.39);
        }`;
      shader.fragmentShader='varying vec3 vSanctumPoint;\n'+aperture+'\n'+shader.fragmentShader.replace(
        '#include <aomap_fragment>','#include <aomap_fragment>\n'+response);
    };
    mat.customProgramCacheKey=()=>key+'-paper-stone-'+(floor?'paving':'altar');
  }
  apply(world.getObjectByName('hall-stone-floor'),true);
  apply(world.getObjectByName('hall-painted-ceiling-and-niches'),false);
}

export async function finishTempleArchitecture(world,colliders) {
  const [court,hall]=await Promise.all([loadLightProbe('court'),loadLightProbe('hall')]);
  const contact=courtyardContact(colliders),seen=new Set();
  const bank=world.getObjectByName('hall-daylit-lattice-windows');
  world.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(bank);
  const mid=bounds.getCenter(new THREE.Vector3());
  const windows=[mid.clone().setX(bounds.min.x),mid.clone().setX(bounds.max.x)];
  world.traverse(o=>{
    if(!o.isMesh || !o.material.isMeshStandardMaterial || seen.has(o.material))return;
    const mat=o.material,name=mat.name;
    seen.add(mat);
    if(name==='courtyard-photogrammetry-extension' || name==='flagstone-platform')
      finishStone(mat,contact,false);
    if(name==='main-hall-grey-stone-plinth')finishStone(mat,contact,true);
    if(name==='hall-worn-cinnabar-lacquer'){
      mat.roughness=.43;
      mat.bumpMap=mat.map;mat.bumpScale=.004;
    }
    if(name==='main-hall-weathered-red-timber')mat.roughness=.70;
    if(name==='gate-photographic-wood' || name==='gate-photographic-wood-dark')mat.roughness=.76;
    // Restrict the two local probes to architecture. The original foliage,
    // stream shaders and weapon lighting keep their own lighting models.
    const interior=name.startsWith('hall-') && !name.startsWith('hall-exterior');
    const exterior=/^(gate-photographic|main-hall-|lingyin-main-gilded|lingyin-gate-gilded|courtyard-|stone-photogrammetry|red-lacquer-wood|flagstone-platform)/.test(name);
    if(interior && ['hall-worn-cinnabar-lacquer','hall-carved-dark-wood','hall-painted-dougong',
        'hall-inlaid-limestone','hall-painted-beam-art'].includes(name))addWindowFill(mat,windows);
    if(name==='hall-daylit-paper'){
      mat.emissiveIntensity=.53;
      mat.color.setHex(0xdacaa7);
    }
    if (/^main-hall-(weathered-red-timber|dark-red-joinery|cool-grey-plaster|dark-teal-window|blue-green-painted-beams)$/.test(name)
        || ['hall-worn-cinnabar-lacquer','hall-portal-cinnabar','hall-carved-dark-wood','hall-painted-dougong','hall-woven-carpet',
            'hall-inlaid-limestone','hall-painted-beam-art','hall-exterior-blue-gold-caihua'].includes(name))
      addEntranceDaylight(mat);
    else if(name==='main-hall-porch-bracket-paint' || name==='main-hall-painted-flying-rafters')
      addEntranceDaylight(mat,true);
    if(interior || exterior){
      mat.envMap=interior?hall:court;
      mat.envMapIntensity=interior?(mat.metalness>.3?1.15:.64):.52;
      mat.userData.envLock=true;
    }
  });
  await Promise.all([finishHallAltar(world,hall),finishHallWindows(world,bounds)]);
  finishSanctumStone(world,bank);
  finishHallContactWear(world,colliders);
  finishHallPorch(world);
}
