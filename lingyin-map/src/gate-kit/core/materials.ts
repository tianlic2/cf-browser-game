import * as THREE from 'three';

// Shared palette. Linear-ish sRGB hexes; tone mapping and exposure live in post.
export const PAL = {
  stone: '#8b887c',
  stoneDark: '#5f5e57',
  stoneWarm: '#a49a86',
  roof: '#3c4248',
  roofDark: '#282d33',
  roofRidge: '#4a5057',
  wood: '#6d2f28',
  woodDark: '#3a1e1a',
  wall: '#caa35f',
  wallShade: '#a9823f',
  gold: '#bd9144',
  bronze: '#6f5230',
  moss: '#63713f',
  grass: '#59663a',
  soil: '#6a5b45',
  pine: '#2f4530',
  pineLight: '#4d6340',
  leaf: '#45603a',
  maple: '#a6522f',
  bamboo: '#5c7442',
  waterDeep: '#203532',
  waterShallow: '#5f7d6e',
  mist: '#c8cfce',
  skyZenith: '#7d99b8',
  skyHorizon: '#d9d3c3',
  sun: '#ffd7a1',
};

export const NOISE_GLSL = /* glsl */ `
float cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
float cgNoise2(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float cgNoise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = cgHash12(i.xy + i.z * 19.19);
  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);
  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);
  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);
  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);
  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);
  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);
  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
float cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
float cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }
float cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }
// anti-aliased thin line: distance d in world units, width w, pixel footprint aa
float cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }
`;

export type ProcOptions = {
  params?: THREE.MeshStandardMaterialParameters;
  uniforms?: Record<string, THREE.IUniform>;
  head?: string;
  vertexHead?: string;
  vertexPre?: string;
  color?: string;
  roughness?: string;
  metalness?: string;
  normal?: string;
  emissive?: string;
  ao?: string;
  name?: string;
};

const VERT_HEAD = /* glsl */ `
varying vec3 vCgWorld;
varying vec3 vCgNormalW;
varying vec3 vCgObj;
varying float vCgSeed;
`;
const VERT_BODY = /* glsl */ `
{
  vec4 cgP = vec4(transformed, 1.0);
  vec3 cgN = objectNormal;
  float cgSeedV = 0.0;
  #ifdef USE_INSTANCING
    cgP = instanceMatrix * cgP;
    cgN = mat3(instanceMatrix) * cgN;
    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  #endif
  vCgWorld = (modelMatrix * cgP).xyz;
  vCgNormalW = normalize(mat3(modelMatrix) * cgN);
  vCgObj = transformed;
  vCgSeed = cgSeedV;
}
`;

/** MeshStandardMaterial with world-space GLSL hooks and shared noise functions. */
export function procMaterial(o: ProcOptions = {}) {
  const mat = new THREE.MeshStandardMaterial(o.params ?? {});
  if (o.name) mat.name = o.name;
  const uniforms = o.uniforms ?? {};
  const key = 'proc:' + hashParts([o.head, o.vertexHead, o.vertexPre, o.color, o.roughness, o.metalness, o.normal, o.emissive, o.ao].join('|'));
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    vs = vs.replace('#include <common>', `#include <common>\n${VERT_HEAD}\n${o.vertexHead ?? ''}`);
    if (o.vertexPre) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n{\n${o.vertexPre}\n}`);
    vs = vs.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_BODY}`);
    fs = fs.replace('#include <common>', `#include <common>\n${VERT_HEAD}\n${NOISE_GLSL}\n${o.head ?? ''}`);
    const locals = `vec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;`;
    fs = fs.replace('void main() {', `void main() {\n${locals}`);
    if (o.color) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n{\n${o.color}\n}`);
    if (o.roughness) fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n{\n${o.roughness}\n}`);
    if (o.metalness) fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n{\n${o.metalness}\n}`);
    if (o.normal) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n{\n${o.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`);
    if (o.emissive) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n{\n${o.emissive}\n}`);
    if (o.ao) fs = fs.replace('#include <aomap_fragment>', `#include <aomap_fragment>\n{\n${o.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  return mat;
}

function hashParts(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function color(hex: string) {
  return new THREE.Color(hex);
}

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function setEnvScale(mat: THREE.MeshStandardMaterial, scale: number) {
  mat.envMapIntensity = scale;
}
