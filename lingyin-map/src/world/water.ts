import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO } from '../core/atmosphere';
import { clamp } from '../core/math';
import { procMaterial } from '../core/materials';
import { STREAM, heightAt, insideTerrainFootprint, streamLevel, streamT, streamWidth, WATER_POND, WORLD } from './heightfield';

const WATER_VERT = /* glsl */ `
attribute float aDepth;
attribute float aFlow;
varying float vDepth;
varying float vFlow;
varying vec2 vUvW;
void main(){
  vDepth = aDepth;
  vFlow = aFlow;
  vUvW = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Stream + pond surface with depth-tinted water and animated bank foam. */
export class Water {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshStandardMaterial;
  readonly waterfall: THREE.Mesh;
  private fallMat: THREE.ShaderMaterial;

  constructor() {
    this.group.name = 'water';
    this.material = this.makeWaterMaterial();
    const geos: THREE.BufferGeometry[] = [];

    // ---- stream ribbon
    const pts = STREAM.filter(([x,z])=>insideTerrainFootprint(x,z,1));
    const pos: number[] = [];
    const uvs: number[] = [];
    const depth: number[] = [];
    const flow: number[] = [];
    const idx: number[] = [];
    const n = pts.length;
    let dist = 0;
    for (let i = 0; i < n; i++) {
      const [x, z] = pts[i];
      const pPrev = pts[Math.max(0, i - 1)];
      const pNext = pts[Math.min(n - 1, i + 1)];
      let tx = pNext[0] - pPrev[0];
      let tz = pNext[1] - pPrev[1];
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      const nx = -tz;
      const nz = tx;
      if (i > 0) dist += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      const t = streamT(x,z).t;
      const w = streamWidth(t) * 0.54;
      const level = streamLevel(t);
      for (const side of [-1, 1]) {
        const px = x + nx * w * side;
        const pz = z + nz * w * side;
        const dep = level - heightAt(px, pz);
        pos.push(px, level + 0.015, pz);
        uvs.push(side < 0 ? 0 : 1, dist / 4.5);
        depth.push(clamp(dep, 0, 4));
        flow.push(0.7 + t * 0.6);
      }
      if (i < n - 1) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const streamGeo = new THREE.BufferGeometry();
    streamGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    streamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    streamGeo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
    streamGeo.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1));
    streamGeo.setIndex(idx);
    streamGeo.computeVertexNormals();
    geos.push(streamGeo);

    // ---- pond disc (slightly subdivided so the depth attribute has resolution)
    const pondGeo = new THREE.CircleGeometry(WORLD.pond.r, 64, 0, Math.PI * 2);
    pondGeo.rotateX(-Math.PI / 2);
    const pPos = pondGeo.getAttribute('position');
    const pDepth: number[] = [];
    const pFlow: number[] = [];
    for (let i = 0; i < pPos.count; i++) {
      const x = pPos.getX(i) + WORLD.pond.x;
      const z = pPos.getZ(i) + WORLD.pond.z;
      pPos.setX(i, x);
      pPos.setZ(i, z);
      pPos.setY(i, WATER_POND);
      pDepth.push(clamp(WATER_POND - heightAt(x, z), 0, 4));
      pFlow.push(0.28);
    }
    pondGeo.setAttribute('aDepth', new THREE.Float32BufferAttribute(pDepth, 1));
    pondGeo.setAttribute('aFlow', new THREE.Float32BufferAttribute(pFlow, 1));
    pondGeo.computeVertexNormals();
    geos.push(pondGeo);

    const merged = mergeGeometries(geos.map((g) => {
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
      return g;
    }), false);
    if (!merged) throw new Error('water merge failed');
    const mesh = new THREE.Mesh(merged, this.material);
    mesh.name = 'water-surface';
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    this.group.add(mesh);

    // ---- one tall fall into the upper stream
    this.fallMat = this.makeFallMaterial();
    const fw = 4.2;
    const fh = 9.5;
    const fseg = 26;
    const fpos: number[] = [];
    const fuv: number[] = [];
    const fidx: number[] = [];
    for (let j = 0; j <= fseg; j++) {
      const v = j / fseg;
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        const bulge = Math.sin(v * Math.PI) * 0.9 + 0.2;
        fpos.push(44 + (u - 0.5) * fw * (1 + v * 0.15), 13.2 - v * fh, -51 + bulge * v);
        fuv.push(u, v);
      }
    }
    for (let j = 0; j < fseg; j++) {
      for (let i = 0; i < 6; i++) {
        const a = j * 7 + i;
        fidx.push(a, a + 7, a + 1, a + 1, a + 7, a + 8);
      }
    }
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    fgeo.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
    fgeo.setIndex(fidx);
    fgeo.computeVertexNormals();
    this.waterfall = new THREE.Mesh(fgeo, this.fallMat);
    this.waterfall.name = 'waterfall';
    this.waterfall.renderOrder = 4;
    this.group.add(this.waterfall);
  }

  private makeWaterMaterial() {
    return procMaterial({
      name: 'water',
      params: {
        color: 0xffffff,
        roughness: 0.06,
        metalness: 0.0,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        envMapIntensity: 1.5,
      },
      uniforms: { uTime: ATMO.time },
      head: 'uniform float uTime; varying float vDepthW; varying float vFlowW;',
      vertexHead: /* glsl */ `
        attribute float aDepth;
        attribute float aFlow;
        varying float vDepthW;
        varying float vFlowW;
      `,
      vertexPre: /* glsl */ `
        vDepthW = aDepth;
        vFlowW = aFlow;
      `,
      color: /* glsl */ `
        float d = clamp(vDepthW / 2.0, 0.0, 1.0);
        vec3 deep = vec3(0.018, 0.073, 0.078);
        vec3 shallow = vec3(0.13, 0.23, 0.19);
        vec3 c = mix(shallow, deep, d);
        float flow = uTime * (0.35 + vFlowW * 0.5);
        float fn = cgNoise2(vec2(cgP.x * 1.7, cgP.z * 0.8 - flow));
        fn *= cgNoise2(vec2(cgP.x * 4.2 + 7.0, cgP.z * 1.7 - flow * 1.6));
        float edge = 1.0 - smoothstep(0.0, 0.28, vDepthW);
        float foam = smoothstep(0.3, 0.62, fn + edge * 0.42) * (0.3 + edge * 1.2);
        c = mix(c, vec3(0.78, 0.80, 0.76), clamp(foam, 0.0, 1.0) * 0.8);
        diffuseColor.rgb = c;
        diffuseColor.a = mix(0.78, 0.95, d) + foam * 0.2;
      `,
      normal: /* glsl */ `
        float t = uTime;
        vec2 p = cgP.xz;
        float n1 = cgNoise2(p * 1.3 + vec2(0.0, -t * 0.5));
        float n2 = cgNoise2(p * 2.7 + vec2(t * 0.35, -t * 0.8));
        float n3 = cgNoise2(p * 6.1 + vec2(-t * 0.6, -t * 1.4));
        cgBump = vec3((n1 - n2) * 0.10 + (n2 - n3) * 0.05, 0.0, (n2 - n1) * 0.10 + (n3 - n2) * 0.05);
      `,
      roughness: /* glsl */ `
        roughnessFactor = mix(0.06, 0.22, smoothstep(0.0, 0.4, 1.0 - vDepthW));
      `,
    });
  }

  private makeFallMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: ATMO.time },
      vertexShader: WATER_VERT,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying float vDepth;
        varying float vFlow;
        varying vec2 vUvW;
        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x), f.y); }
        void main(){
          float t = uTime;
          float streak = n2(vec2(vUvW.x * 8.0, vUvW.y * 2.0 - t * 1.8));
          streak *= n2(vec2(vUvW.x * 22.0 + 3.0, vUvW.y * 4.0 - t * 3.1));
          float edge = smoothstep(0.0, 0.18, vUvW.x) * smoothstep(1.0, 0.82, vUvW.x);
          float top = smoothstep(0.0, 0.08, vUvW.y);
          float a = edge * top * (0.55 + streak * 0.65);
          vec3 c = mix(vec3(0.55,0.68,0.68), vec3(0.95,0.97,0.94), streak);
          gl_FragColor = vec4(c, clamp(a, 0.0, 0.9));
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  update(_dt: number) {
    // time is driven by the shared ATMO uniform
    this.fallMat.uniforms.uTime = ATMO.time;
  }
}
