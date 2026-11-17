import * as THREE from 'three';
import { MAIN_HALL, MAIN_HALL_FLOOR_Y } from './lingyin_main_hall.js';

// The timber and metal batches also contain altar furniture and joinery.
// Identify the two end rings of each actual cylinder once at load time.
// Interpolate its cross-section in the shader: the shafts have no mid-height
// vertices, and their original UV seam must not interrupt a patch of polish.
function markColumns(mesh, columns) {
  const vertices = mesh.geometry.getAttribute('position');
  const frame = new Float32Array(vertices.count * 4);
  const point = new THREE.Vector3();
  for (let i = 0; i < vertices.count; i++) {
    point.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld);
    for (const part of columns) {
      const bottom = Math.abs(point.y - part.y0) < .012;
      if (!bottom && Math.abs(point.y - part.h) >= .012) continue;
      const dx = (point.x - part.x) / part.round.sx;
      const dz = (point.z - part.z) / part.round.sz;
      const radius = bottom ? part.round.rb : part.round.rt;
      const distance = Math.hypot(dx, dz);
      if (distance > .012 && Math.abs(distance - radius) > .012) continue;
      const offset = 4 * i;
      // Positive X in this frame faces the walking aisle on both sides.
      frame[offset] = dx / radius * Math.sign(MAIN_HALL.x - part.x);
      frame[offset + 1] = dz / radius;
      frame[offset + 2] = 1;
      frame[offset + 3] = Math.sin(part.x * 7.1 + part.z * .78);
      break;
    }
  }
  mesh.geometry.setAttribute('columnContact', new THREE.BufferAttribute(frame, 4));
}

const noise = `
  float contactHash(vec2 p) {
    vec3 h = fract(p.xyx * vec3(.1031,.1030,.0973));
    h += dot(h,h.yzx+33.33);
    return fract((h.x+h.y)*h.z);
  }
  float contactNoise(vec2 p) {
    vec2 cell=floor(p), f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(contactHash(cell),contactHash(cell+vec2(1,0)),f.x),
               mix(contactHash(cell+vec2(0,1)),contactHash(cell+1.),f.x),f.y);
  }`;

const timber = `
  float facing=dot(vColumn.xy,vec2(.76,.65));
  vec2 grain=vec2(vWearWorld.x+vWearWorld.z*.79,vWearWorld.y);
  float mottle=contactNoise(grain*vec2(7.,4.))-.5;
  float reach=vWearWorld.y-${MAIN_HALL_FLOOR_Y}-1.13-.13*vColumn.w-.14*vColumn.y;
  float touched=vColumn.z*(1.-smoothstep(.12,.60,abs(reach)+.13*mottle))*
    smoothstep(-.47,.75,facing+.43*mottle);
  // Hand rubbing burnishes intact lacquer. The original flecks of exposed
  // pale timber retain their fibre and do not turn into glossy paint.
  float bare=smoothstep(.38,.77,diffuseColor.g/max(diffuseColor.r,.0001));
  float polish=touched*(1.-.68*bare);
  diffuseColor.rgb*=mix(vec3(1.),vec3(.78,.69,.64),polish);
  roughnessFactor=mix(roughnessFactor,.265+.065*mottle,polish);
  float wornNormal=.65*polish;`;

const base = `
  vec2 casting=(vWearWorld.xz+vWearWorld.y*vec2(.42,.79));
  float cloud=.68*contactNoise(casting*5.3)+.32*contactNoise(casting*20.);
  float height=vWearWorld.y-${MAIN_HALL_FLOOR_Y};
  float footing=vColumn.z;
  float shoulder=smoothstep(.13,.235,height+.025*(cloud-.5));
  float lip=shoulder*smoothstep(.83,.95,length(vColumn.xy))*
    (.42+.58*smoothstep(-.6,.85,vColumn.x+.45*vColumn.y));
  float patina=footing*(1.-.82*lip)*(.42+.42*cloud);
  diffuseColor.rgb*=mix(vec3(1.),vec3(.54,.73,.65),patina);
  diffuseColor.rgb*=1.+footing*(.38*(cloud-.5)+.29*lip);
  float dust=footing*(1.-smoothstep(.025,.12,height+.045*(cloud-.5)));
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.095,.075,.052),dust*(.28+.38*cloud));
  roughnessFactor=mix(roughnessFactor,.64+.19*cloud-.39*lip,footing);
  metalnessFactor*=1.-.50*dust-.20*patina;
  float wornNormal=.16*footing*lip;`;

const threshold = `
  vec2 sill=vWearWorld.xz-vec2(${MAIN_HALL.x.toFixed(2)},${(MAIN_HALL.z + MAIN_HALL.d / 2 - 1.35).toFixed(2)});
  float walked=0.;
  if (abs(sill.x)<2.25 && abs(sill.y)<1.55 && abs(vWearWorld.y-${MAIN_HALL_FLOOR_Y})<.015) {
    float mineral=contactNoise(vWearWorld.xz*5.3);
    float irregular=.21*(contactNoise(vWearWorld.xz*2.2)-.5)+.08*(mineral-.5);
    float lane=abs(sill.x+.16*sin(sill.y*1.7)-.08);
    float across=1.-smoothstep(.40,1.89,lane+irregular);
    float along=1.-smoothstep(.35,1.37,abs(sill.y-.08)+.70*irregular+.18*lane);
    walked=across*along*(.82+.18*mineral);
    // Pale, rough clefts survive while the exposed stone loses its dusty skin.
    walked*=.76+.24*smoothstep(.035,.23,dot(diffuseColor.rgb,vec3(.3,.59,.11)));
    diffuseColor.rgb*=mix(vec3(1.),vec3(.70,.74,.76),walked);
    roughnessFactor=mix(roughnessFactor,.64,walked);
  }
  float wornNormal=.60*walked;`;

function applyWear(mesh, columns, finish, label) {
  // Preserve the original shader hooks (stone, windows, doorway bounce) and
  // isolate the bronze batch from the burner legs sharing its source material.
  const source = mesh.material, mat = source.clone();
  const key = source.customProgramCacheKey();
  if (columns) markColumns(mesh, columns);
  mat.onBeforeCompile = function(shader, renderer) {
    source.onBeforeCompile.call(this, shader, renderer);
    const vary = columns ? 'varying vec4 vColumn;\n' : '';
    shader.vertexShader = (columns ? 'attribute vec4 columnContact;\n' : '') +
      vary + 'varying vec3 vWearWorld;\n' + shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nvWearWorld=(modelMatrix*vec4(transformed,1.)).xyz;\n' +
        (columns ? 'vColumn=columnContact;' : ''));
    shader.fragmentShader = vary + 'varying vec3 vWearWorld;\n' + noise + '\n' + shader.fragmentShader
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + finish)
      .replace('#include <lights_physical_fragment>',
        'normal=normalize(mix(normal,nonPerturbedNormal,wornNormal));\n#include <lights_physical_fragment>');
  };
  mat.customProgramCacheKey = () => key + '-contact-' + label;
  mesh.material = mat;
}

export function finishHallContactWear(world, colliders) {
  const pieces = [
    ['temple-mainWood', /^main-perimeter-column-\d+$/, timber, 'porch'],
    ['hall-structure-lacquer', /^main-interior-column-\d+-1$/, timber, 'shaft'],
    ['hall-structure-bronze', /^main-interior-column-\d+-0$/, base, 'foot'],
    ['temple-mainStone', null, threshold, 'sill'],
  ];
  for (const [name, filter, finish, label] of pieces) {
    const mesh = world.getObjectByName(name);
    if (mesh) applyWear(mesh, filter && colliders.filter(part => filter.test(part.name)), finish, label);
  }
}
