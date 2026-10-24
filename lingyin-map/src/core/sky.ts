import * as THREE from 'three';
import { ATMO, ATMO_FOG_GLSL } from './atmosphere';
import { NOISE_GLSL } from './materials';

const VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}
`;

const FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uSunSize;
uniform float uSunDisk;
uniform float uCloudCover;
uniform float uCloudScale;
uniform float uCloudSpeed;
uniform float uTime;
uniform float uEnvPass;
uniform vec3 uHazeColor;
${NOISE_GLSL}

vec3 skyHeight(vec3 d){
  float mu = dot(d, uSunDir);
  float h = clamp(d.y, -1.0, 1.0);
  float hh = max(h, 0.0);
  float t = pow(1.0 - hh, 5.0);
  vec3 zen = uZenith * (1.0 + 0.25 * (1.0 - hh));
  vec3 col = mix(zen, uHorizon, t);
  // warm band near the horizon on the sun side
  float band = smoothstep(0.0, 0.35, 1.0 - hh) * smoothstep(-0.05, 0.12, h);
  col = mix(col, col * vec3(1.16, 1.02, 0.86), band * smoothstep(-0.2, 0.9, mu) * 0.55);
  // soft aureole
  float m = max(mu, 0.0);
  col += uSunColor * (0.16 * pow(m, 6.0) + 0.5 * pow(m, 90.0) + 1.6 * pow(m, 900.0)) * (0.35 + 0.65 * t);
  return col;
}

// thin cloud deck: fbm on a projected plane, lit from the sun side
vec3 clouds(vec3 d, float quality){
  if (d.y < 0.015) return vec3(0.0);
  float H = 420.0;
  vec2 p = d.xz / max(d.y, 0.06) * H * 0.001;
  p = p * uCloudScale + vec2(uTime * uCloudSpeed * 0.002, uTime * uCloudSpeed * 0.0009);
  float n = cgFbm2(p * 0.55);
  float n2 = cgFbm2(p * 1.75 + 13.0);
  float cover = mix(n, n2, 0.4);
  float mask = smoothstep(0.62 - uCloudCover * 0.34, 0.78 - uCloudCover * 0.22, cover);
  mask *= smoothstep(0.02, 0.2, d.y);
  float mu = dot(d, uSunDir);
  float lit = 0.55 + 0.45 * smoothstep(-0.2, 0.7, mu);
  float thick = smoothstep(0.55, 0.9, n2);
  vec3 c = mix(vec3(0.55, 0.58, 0.61), vec3(1.1, 1.02, 0.9), lit);
  c *= mix(1.0, 0.72, thick);
  // bright silver rim where the sun grazes the deck
  c += uSunColor * pow(max(mu, 0.0), 18.0) * 0.5 * mask;
  return c * mask * 0.85;
}

vec3 cirrus(vec3 d){
  if (d.y < 0.08) return vec3(0.0);
  vec2 p = d.xz / d.y;
  p = mat2(0.86, -0.5, 0.5, 0.86) * p;
  vec2 q = vec2(p.x * 0.22, p.y * 1.35);
  float n = cgFbm2(q * 1.6 + vec2(uTime * 0.0007, 0.0));
  float streak = smoothstep(0.5, 0.82, n) * smoothstep(0.08, 0.22, d.y) * (1.0 - smoothstep(0.35, 0.75, d.y));
  return vec3(0.92, 0.93, 0.95) * streak * 0.14;
}

void main(){
  vec3 d = normalize(vDir);
  vec3 col = skyHeight(d);
  if (d.y > 0.0) {
    col = mix(col, col + clouds(d, 0.0), 0.85);
    col += cirrus(d);
  }
  if (d.y < 0.0) col = mix(col, uGround, smoothstep(0.0, -0.16, d.y));
  // sun disk (not in the IBL pass)
  if (uEnvPass < 0.5) {
    float mu = dot(d, uSunDir);
    float cosR = cos(uSunSize);
    float disk = smoothstep(cosR - 0.00003, cosR + 0.00001, mu);
    col += uSunColor * uSunDisk * disk * smoothstep(0.0, 0.06, d.y);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Sky {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly uniforms: Record<string, THREE.IUniform>;

  constructor() {
    this.uniforms = {
      uSunDir: ATMO.sunDir,
      uSunColor: ATMO.sunColor,
      uZenith: { value: new THREE.Color('#6689a6') },
      uHorizon: { value: new THREE.Color('#bfc6c4') },
      uGround: { value: new THREE.Color('#4a4b42') },
      uSunSize: { value: 0.012 },
      uSunDisk: { value: 34.0 },
      uCloudCover: { value: 0.29 },
      uCloudScale: { value: 1.0 },
      uCloudSpeed: { value: 1.0 },
      uTime: ATMO.time,
      uEnvPass: { value: 0 },
      uHazeColor: ATMO.hazeColor,
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });
    const geo = new THREE.SphereGeometry(1, 64, 40);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1e6;
    this.mesh.scale.setScalar(4000);
  }

  /** soft, dimmed sky used only to build the IBL */
  makeEnvSky() {
    const env = this.mesh.clone();
    env.material = this.material.clone();
    (env.material as THREE.ShaderMaterial).uniforms = { ...this.uniforms, uEnvPass: { value: 1 } };
    env.scale.setScalar(100);
    return env;
  }
}

/** A ring of distant, fog-veiled ridges outside the playable terrain. */
export class Backdrop {
  readonly group = new THREE.Group();
  constructor() {
    this.group.name = 'backdrop';
    this.addRidge(360, 58, 0.82, '#7f8d91', 17);
    this.addRidge(560, 92, 0.68, '#8d989a', 29);
    this.addRidge(880, 150, 0.5, '#9aa4a5', 41);
    this.addRidge(1280, 210, 0.36, '#a7afaf', 57);
  }

  private addRidge(radius: number, height: number, brightness: number, tint: string, seed: number) {
    const segs = 220;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const base = new THREE.Color(tint).multiplyScalar(brightness);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      const n = 0.5 + 0.5 * Math.sin(a * 7 + seed) * Math.sin(a * 3.1 + seed * 2.3);
      const n2 = 0.5 + 0.5 * Math.sin(a * 17 + seed * 1.7);
      const h = height * (0.5 + 0.5 * n) * (0.72 + 0.28 * n2);
      // two vertices per column: foot and crest
      pos.push(x, -8, z, x, h, z);
      const shade = 0.72 + 0.28 * n2;
      col.push(base.r * shade, base.g * shade, base.b * shade, base.r * 1.05, base.g * 1.05, base.b * 1.05);
      if (i < segs) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: ATMO.sunDir,
        uSunColor: ATMO.sunColor,
        uHazeColor: ATMO.hazeColor,
        uMistColor: ATMO.mistColor,
        uHazeDensity: ATMO.hazeDensity,
        uHazeHeight: ATMO.hazeHeight,
        uMistDensity: ATMO.mistDensity,
        uMistHeight: ATMO.mistHeight,
        uHazeFar: ATMO.hazeFar,
        uTime: ATMO.time,
      },
      vertexShader: /* glsl */ `
        varying vec3 vColor;
        varying vec3 vWorld;
        void main(){
          vColor = color;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying vec3 vWorld;
        ${ATMO_FOG_GLSL}
        void main(){
          vec3 c = atmoApply(vColor, cameraPosition, vWorld);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      vertexColors: true,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -5;
    this.group.add(mesh);
  }
}
