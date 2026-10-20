import * as THREE from 'three';
import { Rng } from '../core/math';

function puffTexture(seed: number | string) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d');
  const rng = new Rng(seed);
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 70; i++) {
    const x = rng.range(36, size - 36);
    const y = rng.range(36, size - 36);
    const r = rng.range(8, 38);
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, `rgba(0,0,0,${rng.range(0.08, 0.24)})`);
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const COMMON_ATTRIBUTES = /* glsl */ `
attribute vec3 aPos;
attribute vec2 aScale;
attribute float aRot;
attribute float aAlpha;
varying vec2 vUv;
varying float vAlpha;
`;

const GROUND_VERT = /* glsl */ `
${COMMON_ATTRIBUTES}
void main(){
  float c = cos(aRot), s = sin(aRot);
  vec2 p = mat2(c, -s, s, c) * position.xy;
  vec3 wp = aPos + vec3(p.x * aScale.x, 0.0, p.y * aScale.y);
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const BILLBOARD_VERT = /* glsl */ `
${COMMON_ATTRIBUTES}
uniform vec3 uRight;
uniform vec3 uUp;
void main(){
  float c = cos(aRot), s = sin(aRot);
  vec2 p = mat2(c, -s, s, c) * position.xy;
  vec3 wp = aPos + uRight * p.x * aScale.x + uUp * p.y * aScale.y;
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uTint;
varying vec2 vUv;
varying float vAlpha;
void main(){
  float a = texture2D(uMap, vUv).a;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uTint, a * vAlpha);
}
`;

type Layer = {
  geo: THREE.InstancedBufferGeometry;
  pos: THREE.InstancedBufferAttribute;
  scl: THREE.InstancedBufferAttribute;
  rot: THREE.InstancedBufferAttribute;
  alpha: THREE.InstancedBufferAttribute;
  count: number;
};

type Bank = { x: number; y: number; z: number; s: number; phase: number; speed: number; opacity: number };
type Puff = { origin: THREE.Vector3; scale: number; phase: number; speed: number; kind: 'spray' | 'smoke'; seed: number };

/** Ground-hugging mist layers plus billboard spray and incense smoke. */
export class Mist {
  readonly group = new THREE.Group();
  private tex = puffTexture('mist');
  private banks: Bank[] = [];
  private puffs: Puff[] = [];
  private ground: Layer;
  private billboard: Layer;
  private uniforms = { uRight: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uMap: { value: null as THREE.Texture | null }, uTint: { value: new THREE.Color('#aebbb6') } };

  constructor(smokeOrigin: THREE.Vector3) {
    this.group.name = 'mist';
    const rng = new Rng('mist');
    for (let i = 0; i < 12; i++) {
      this.banks.push({
        x: rng.chance(0.5) ? rng.range(-150, -70) : rng.range(60, 130),
        y: rng.range(1.5, 6.0),
        z: rng.range(-120, 80),
        s: rng.range(16, 42),
        phase: rng.range(0, 6.28),
        speed: rng.range(0.03, 0.1),
        opacity: rng.range(0.03, 0.07),
      });
    }
    for (let i = 0; i < 14; i++) {
      this.puffs.push({
        origin: new THREE.Vector3(44 + rng.range(-3.5, 3.5), rng.range(3.8, 8), -50 + rng.range(-2.5, 2.5)),
        scale: rng.range(3, 8),
        phase: rng.range(0, 6.28),
        speed: rng.range(0.4, 1.0),
        kind: 'spray',
        seed: rng.range(0, 1),
      });
    }
    for (let i = 0; i < 34; i++) {
      this.puffs.push({
        origin: smokeOrigin.clone(),
        scale: 1,
        phase: i / 26,
        speed: rng.range(0.045, 0.075),
        kind: 'smoke',
        seed: rng.range(0, 1),
      });
    }
    this.uniforms.uMap.value = this.tex;
    this.ground = this.makeLayer(this.banks.length, GROUND_VERT);
    this.billboard = this.makeLayer(this.puffs.length, BILLBOARD_VERT);
    const gm = new THREE.Mesh(this.ground.geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GROUND_VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    gm.frustumCulled = false;
    gm.renderOrder = 18;
    this.group.add(gm);
    const bm = new THREE.Mesh(this.billboard.geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: BILLBOARD_VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    bm.frustumCulled = false;
    bm.renderOrder = 22;
    this.group.add(bm);
    this.update(0, new THREE.PerspectiveCamera());
  }

  private makeLayer(count: number, _vert: string): Layer {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    const pos = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const scl = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    const rot = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    geo.setAttribute('aPos', pos);
    geo.setAttribute('aScale', scl);
    geo.setAttribute('aRot', rot);
    geo.setAttribute('aAlpha', alpha);
    geo.instanceCount = count;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 20, 0), 500);
    return { geo, pos, scl, rot, alpha, count };
  }

  update(time: number, camera: THREE.Camera) {
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    this.uniforms.uRight.value.copy(right);
    this.uniforms.uUp.value.copy(up);

    for (let i = 0; i < this.banks.length; i++) {
      const b = this.banks[i];
      const t = time * b.speed + b.phase;
      const x = b.x + Math.sin(t) * 6;
      const z = b.z + Math.cos(t * 0.7) * 4;
      const a = b.opacity * (0.72 + 0.28 * Math.sin(t * 2.0));
      this.ground.pos.setXYZ(i, x, b.y, z);
      this.ground.scl.setXY(i, b.s, b.s * 0.7);
      this.ground.rot.setX(i, b.phase + time * 0.01);
      this.ground.alpha.setX(i, a);
    }
    this.ground.pos.needsUpdate = true;
    this.ground.scl.needsUpdate = true;
    this.ground.rot.needsUpdate = true;
    this.ground.alpha.needsUpdate = true;

    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      const t = time * p.speed + p.phase;
      let x = p.origin.x;
      let y = p.origin.y;
      let z = p.origin.z;
      let sx = p.scale;
      let sy = p.scale;
      let a = 0;
      let rot = 0;
      if (p.kind === 'spray') {
        x += Math.sin(t * 2.3) * 0.8;
        y += Math.sin(t * 1.7) * 0.5;
        a = 0.14 * (0.7 + 0.3 * Math.sin(t * 2.1));
        sx = p.scale * (0.9 + 0.1 * Math.sin(t));
        sy = p.scale * 0.8;
        rot = p.seed * 3.0;
      } else {
        const age = (time * p.speed + p.phase) % 1;
        y = p.origin.y + age * 8.0;
        x = p.origin.x + age * age * 2.2 + Math.sin(age * 5.0) * 0.4;
        z = p.origin.z + age * age * 0.8;
        const s = 0.5 + age * 3.4;
        sx = s;
        sy = s * 1.15;
        a = 0.16 * (1 - age) * Math.min(1, age * 8);
        rot = age * 1.2;
      }
      this.billboard.pos.setXYZ(i, x, y, z);
      this.billboard.scl.setXY(i, sx, sy);
      this.billboard.rot.setX(i, rot);
      this.billboard.alpha.setX(i, Math.max(0, a));
    }
    this.billboard.pos.needsUpdate = true;
    this.billboard.scl.needsUpdate = true;
    this.billboard.rot.needsUpdate = true;
    this.billboard.alpha.needsUpdate = true;
  }
}
