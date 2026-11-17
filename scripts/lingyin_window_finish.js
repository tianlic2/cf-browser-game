import * as THREE from 'three';
import { MAIN_HALL, MAIN_HALL_FLOOR_Y } from './lingyin_main_hall.js';

// These six independent paper faces retain their original [0,1] panel UVs.
// The oak strips are batched together with altar furniture. Classify triangles
// once using the actual paper bounds, so the altar keeps its approved finish.
function markWindowWood(mesh, bounds) {
  const pos = mesh.geometry.getAttribute('position');
  const attr = new Float32Array(pos.count * 3);
  const points = Array.from({length:3}, () => new THREE.Vector3());
  const tri = new THREE.Box3();
  for (let i=0; i<pos.count; i+=3) {
    for (let j=0; j<3; j++) points[j].fromBufferAttribute(pos,i+j).applyMatrix4(mesh.matrixWorld);
    tri.setFromPoints(points);
    const onBank = Math.min(Math.abs(tri.min.x-bounds.min.x), Math.abs(tri.max.x-bounds.max.x)) < .26;
    if (!onBank || tri.min.y < bounds.min.y-.16 || tri.max.y > bounds.max.y+.16 ||
        tri.min.z < bounds.min.z-.22 || tri.max.z > bounds.max.z+.22) continue;
    const h=tri.max.y-tri.min.y, w=tri.max.z-tri.min.z;
    const vertical=h>w;
    const width=vertical?w:h;
    for (let j=0; j<3; j++) {
      const p=points[j], k=3*(i+j);
      attr[k]=1;
      attr[k+1]=vertical?1:0;
      // Signed cross-section coordinate for the long front face of a strip.
      attr[k+2]=width>.008 ? (vertical?p.z-tri.min.z:p.y-tri.min.y)/width*2-1 : 0;
    }
  }
  mesh.geometry.setAttribute('windowBar',new THREE.BufferAttribute(attr,3));
}

function install(mat, texture, label, vary, vertex, chunk, body) {
  const previous=mat.onBeforeCompile, key=mat.customProgramCacheKey();
  mat.onBeforeCompile=function(shader,renderer) {
    previous.call(this,shader,renderer);
    shader.uniforms.uWindowCraft={value:texture};
    shader.vertexShader=(label==='wood'?'attribute vec3 windowBar;\n':'')+vary+shader.vertexShader
      .replace('#include <project_vertex>','#include <project_vertex>\n'+vertex);
    shader.fragmentShader='uniform sampler2D uWindowCraft;\n'+vary+shader.fragmentShader
      .replace(chunk,chunk+'\n'+body);
  };
  mat.customProgramCacheKey=()=>key+'-hall-window-'+label;
}

export async function finishHallWindows(world, bounds) {
  const texture=await new THREE.TextureLoader().loadAsync(
    new URL('../assets/lingyin/hall-preview/window-craft.webp',import.meta.url).href);
  texture.name='hall-lime-paper-timber';
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=8;
  const wall=world.getObjectByName('temple-mainWall').material;
  // Use the relief of the new lime coat instead of the old pitted undercoat.
  wall.map=null; wall.normalMap=null; wall.roughnessMap=null;
  wall.bumpMap=texture; wall.bumpScale=.012;
  wall.color.setHex(0xc1b8a5);
  install(wall,texture,'lime','varying vec2 vLimeCoord;\n','vLimeCoord=uv;',
    '#include <color_fragment>',`
    float sweep=texture2D(uWindowCraft,vLimeCoord*.34+vec2(.17,.43)).r-.5;
    float pores=texture2D(uWindowCraft,vLimeCoord).r-.5;
    float height=vDoorLightPosition.y-${MAIN_HALL_FLOOR_Y};
    float skirt=1.-smoothstep(.78,2.20,height+.32*sweep);
    diffuseColor.rgb*=1.+.22*sweep+.15*pores;
    diffuseColor.rgb*=mix(vec3(1.),vec3(.87,.84,.80),skirt*(.74+.42*sweep));`);

  const paper=world.getObjectByName('hall-daylit-lattice-windows').material;
  install(paper,texture,'paper','varying vec2 vPanel;\nvarying vec2 vFibre;\n',
    'vPanel=uv;vFibre=(modelMatrix*vec4(transformed,1.)).zy;',
    '#include <emissivemap_fragment>',`
    vec2 sheet=(vPanel-.5)*vec2(2.7,5.5);
    vec2 toBorder=vec2(1.35,2.75)-abs(sheet);
    vec2 nearest=clamp(floor(sheet/vec2(.36,.40)+.5),vec2(-3.,-6.),vec2(3.,6.));
    vec2 barGap=abs(sheet-nearest*vec2(.36,.40));
    float barShade=exp(-min(barGap.x,barGap.y)*27.);
    float frameShade=exp(-min(toBorder.x,toBorder.y)*8.);
    float pulp=texture2D(uWindowCraft,vFibre*.43).g-.5;
    float fibre=texture2D(uWindowCraft,vFibre*1.75).g-.5;
    float openSky=smoothstep(.05,.92,vPanel.y+.045*sin(vFibre.x*.61));
    float jamb=1.-smoothstep(.03,.40,min(vPanel.x,1.-vPanel.x));
    float daylight=.55+.39*openSky+.09*(1.-jamb)-.095*frameShade-.10*barShade;
    float transmission=daylight*(1.+.19*pulp+.065*fibre);
    totalEmissiveRadiance*=transmission*mix(vec3(.99,.91,.82),vec3(1.,1.02,1.065),vPanel.y);
    diffuseColor.rgb*=transmission;`);

  const wood=world.getObjectByName('hall-structure-darkWood');
  markWindowWood(wood,bounds);
  install(wood.material,texture,'wood','varying vec3 vBar;\n','vBar=windowBar;',
    '#include <metalnessmap_fragment>',`
    if(vBar.x>.5) {
      vec2 pos=vDoorLightPosition.zy;
      vec2 grainUV=mix(pos.yx,pos,vBar.y)*vec2(1.63,.59);
      float grain=texture2D(uWindowCraft,grainUV).b-.5;
      float arris=smoothstep(.68,1.,abs(vBar.z));
      vec3 timber=vec3(.19,.078,.035)*(1.+.69*grain);
      float skyFace=mix(.74,1.06,smoothstep(-.8,.85,vBar.z));
      diffuseColor.rgb=mix(diffuseColor.rgb,timber,.83)*skyFace*(1.+.16*arris);
      roughnessFactor=.62+.12*grain-.09*arris;
    }`);
}
