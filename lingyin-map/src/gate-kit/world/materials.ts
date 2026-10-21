import * as THREE from 'three';
import { procMaterial } from '../core/materials';

const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;

/** Dark, weathered camphor-wood columns and beams with traces of old red lacquer. */
export function timberMaterial(dark = 0) {
  return procMaterial({
    name: dark ? 'timber-dark' : 'timber',
    params: { color: 0xffffff, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.05 },
    uniforms: { uDark: { value: dark } },
    head: 'uniform float uDark;',
    color: /* glsl */ `
      // vertical grain and long weather streaks
      float grain = cgFbm2(vec2(cgP.x * 5.0 + cgP.z * 3.0, cgP.y * 0.55));
      float fine = cgNoise2(vec2(cgP.x * 22.0 + cgP.z * 14.0, cgP.y * 2.2));
      vec3 warm = mix(vec3(0.095, 0.045, 0.032), vec3(0.20, 0.105, 0.068), grain * 0.8 + fine * 0.2);
      vec3 grey = mix(vec3(0.08, 0.072, 0.062), vec3(0.17, 0.16, 0.14), grain);
      // old red lacquer survives in patches, mostly near the top
      float paint = smoothstep(0.52, 0.72, cgFbm2(vec2(cgP.x * 1.3 + cgP.z * 1.1, cgP.y * 1.4) + 3.1));
      paint *= smoothstep(0.4, 3.0, cgP.y) * (1.0 - smoothstep(4.2, 5.4, cgP.y));
      vec3 c = mix(warm, grey, smoothstep(0.35, 0.7, grain) * 0.35);
      c = mix(c, vec3(0.16, 0.045, 0.03), paint * 0.45);
      // soot / damp at the foot, green algae in the lowest 0.8 m
      c = mix(c, vec3(0.045, 0.038, 0.032), (1.0 - smoothstep(0.0, 1.1, cgP.y - 0.35)) * 0.55);
      float algae = smoothstep(0.45, 0.8, cgFbm2(vec2(cgP.x * 2.2, cgP.y * 0.7) + 7.0)) * (1.0 - smoothstep(0.4, 2.2, cgP.y));
      c = mix(c, vec3(0.10, 0.14, 0.07), algae * 0.45);
      c = mix(c, c * 0.55, uDark);
      c *= 0.9 + 0.18 * smoothstep(0.1, 2.0, cgN.y);
      diffuseColor.rgb = c;
    `,
    roughness: /* glsl */ `
      float grain = cgFbm2(vec2(cgP.x * 6.0, cgP.y * 0.7));
      roughnessFactor = 0.66 + 0.24 * grain;
    `,
    normal: /* glsl */ `
      float e = 0.03;
      float h0 = cgFbm2(vec2(cgP.x * 14.0, cgP.y * 0.9));
      float hx = cgFbm2(vec2((cgP.x + e) * 14.0, cgP.y * 0.9));
      cgBump = vec3(h0 - hx, 0.0, 0.0) * 0.8;
    `,
  });
}

/** Granite: column bases, platform, kerbs, lanterns, carved frames. */
export function stoneMaterial(warm = 0) {
  return procMaterial({
    name: 'granite',
    params: { color: 0xffffff, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.05 },
    uniforms: { uWarm: { value: warm } },
    head: 'uniform float uWarm;',
    color: /* glsl */ `
      float n = cgFbm2(cgP.xz * 0.8 + cgP.y * 0.4);
      float fine = cgNoise2(cgP.xz * 7.0 + cgP.y * 3.0);
      vec3 c = mix(vec3(0.045,0.045,0.043), vec3(0.115,0.112,0.103), n * 0.8 + fine * 0.2);
      c = mix(c, c * vec3(1.1, 1.0, 0.88), uWarm * 0.5);
      // grey lichen and moss creeping from joints
      float lichen = smoothstep(0.58, 0.78, cgFbm2(cgP.xz * 3.2 + 5.0));
      c = mix(c, vec3(0.32,0.34,0.28), lichen * 0.5);
      float moss = smoothstep(0.5, 0.75, cgFbm2(cgP.xz * 2.1 + 9.0)) * (0.4 + 0.6 * smoothstep(0.2, 0.9, cgN.y));
      c = mix(c, vec3(0.13,0.17,0.07), moss * 0.55);
      // damp base
      c *= 1.0 - (1.0 - smoothstep(0.0, 0.6, cgP.y - 0.35)) * 0.25;
      diffuseColor.rgb = c;
    `,
    normal: /* glsl */ `
      float e = 0.02;
      float h0 = cgFbm2(cgP.xz * 10.0 + cgP.y * 4.0);
      float hx = cgFbm2((cgP.xz + vec2(e, 0.0)) * 10.0 + cgP.y * 4.0);
      float hz = cgFbm2((cgP.xz + vec2(0.0, e)) * 10.0 + cgP.y * 4.0);
      cgBump = vec3(h0-hx, 0.0, h0-hz) * 0.35;
    `,
  });
}

/** Ochre plaster of the side walls, with rain streaks and exposed patches. */
export function plasterMaterial() {
  return procMaterial({
    name: 'plaster',
    params: { color: 0xffffff, roughness: 0.9 },
    color: /* glsl */ `
      float n = cgFbm2(vec2(cgP.x * 0.9 + cgP.z * 0.9, cgP.y * 0.7));
      float fine = cgNoise2(vec2(cgP.x * 8.0 + cgP.z * 4.0, cgP.y * 6.0));
      vec3 c = mix(vec3(0.26, 0.17, 0.06), vec3(0.40, 0.28, 0.115), n * 0.8 + fine * 0.2);
      // vertical rain wash
      float streak = smoothstep(0.6, 0.9, cgNoise2(vec2(cgP.x * 4.0 + cgP.z * 2.0, cgP.y * 0.15)));
      c *= 1.0 - streak * 0.22;
      c = mix(c, vec3(0.30, 0.245, 0.16), (1.0 - smoothstep(0.35, 1.4, cgP.y - 0.35)) * 0.5);
      diffuseColor.rgb = c;
    `,
  });
}

/** Pan-tile roof field: rows, moss in the valleys, pale lichen. */
export function roofFieldMaterial() {
  return procMaterial({
    name: 'roof-field',
    params: { color: 0xffffff, roughness: 1.0, metalness: 0.0, map: WHITE, envMapIntensity: 0.05 },
    color: /* glsl */ `
      // vMapUv.x/y are metres across and up the slope
      float course = abs(fract(vMapUv.y / 0.36) - 0.5) * 2.0;
      float rowLine = smoothstep(0.82, 0.98, course);
      float pan = abs(fract(vMapUv.x / 0.32) - 0.5) * 2.0;
      vec3 tile = mix(vec3(0.035,0.04,0.038), vec3(0.09,0.095,0.088), cgHash12(floor(vec2(vMapUv.x/0.32, vMapUv.y/0.36))) * 0.35 + (1.0-pan)*0.15);
      tile *= 1.0 - rowLine * 0.32;
      // green moss, denser near the ridge and in the pan valleys
      float moss = smoothstep(0.38, 0.68, cgFbm2(vMapUv * 0.45 + 4.0));
      moss *= 0.4 + 0.6 * (1.0 - pan);
      tile = mix(tile, vec3(0.14,0.185,0.07), moss * 0.85);
      // pale lichen spots
      tile = mix(tile, vec3(0.34,0.34,0.30), smoothstep(0.72,0.86, cgNoise2(vMapUv*3.2)) * 0.25);
      diffuseColor.rgb = tile;
    `,
    normal: /* glsl */ `
      float course = abs(fract(vMapUv.y / 0.36) - 0.5) * 2.0;
      cgBump = vec3(0.0, 0.0, -sign(fract(vMapUv.y/0.36)-0.5) * course * 0.4);
    `,
  });
}

/** Individual cover tiles: darker ceramic with moss on the crown. */
export function coverTileMaterial() {
  return procMaterial({
    name: 'cover-tile',
    params: { color: 0xffffff, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide, vertexColors: true, envMapIntensity: 0.06 },
    color: /* glsl */ `
      float n = cgNoise2(cgP.xz * 3.0 + cgP.y * 2.0);
      vec3 c = mix(vec3(0.06,0.07,0.065), vec3(0.14,0.15,0.14), n);
      float moss = smoothstep(0.55, 0.8, cgFbm2(vec2(cgP.x * 0.9, cgP.z * 0.9) + 3.0));
      c = mix(c, vec3(0.18,0.23,0.08), moss * 0.65);
      c *= 0.85 + 0.25 * smoothstep(0.2, 1.0, cgN.y);
      diffuseColor.rgb = c;
    `,
  });
}

export function goldMaterial() {
  return procMaterial({
    name: 'gold',
    params: { color: 0xffffff, roughness: 0.42, metalness: 0.75 },
    color: /* glsl */ `
      float n = cgFbm2(cgP.xy * 3.0 + cgP.z * 2.0);
      vec3 c = mix(vec3(0.42,0.28,0.08), vec3(0.82,0.60,0.22), n * 0.7 + 0.3);
      diffuseColor.rgb = c;
    `,
  });
}
