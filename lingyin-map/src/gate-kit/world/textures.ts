import * as THREE from 'three';
import { canvasTexture, procMaterial } from '../core/materials';
import { Rng } from '../core/math';

type Maps = { map: THREE.Texture; height: THREE.Texture };
const flagstoneCache = new Map<string, Maps>();

/**
 * Tileable weathered flagstone plate. Stones are laid on a jittered grid, with
 * dark mortar, chipped edges, moss in the joints and a separate height field for
 * the bump. 1024² keeps the mip chain crisp at the front camera distance.
 */
export function flagstoneMaps(seed = 'flagstone', cells = 8): Maps {
  const key = `${seed}:${cells}`;
  const cached = flagstoneCache.get(key);
  if (cached) return cached;
  const size = 2048;
  const rng = new Rng(seed);
  const cell = size / cells;
  type Stone = { pts: [number, number][]; tone: number; moss: number; cracks: number[][] };
  const stones: Stone[] = [];
  // running-bond rows of irregular slabs: variable course heights, staggered
  // lengths, occasional narrow filler stones, tight joints.
  let rowY = -rng.range(0, cell * 0.4);
  let row = 0;
  while (rowY < size) {
    const h = cell * rng.range(0.62, 1.02);
    let x = -rng.range(0, cell * 0.8);
    while (x < size) {
      const w = cell * rng.range(0.62, 1.28);
      const x0 = x + 2.5;
      const x1 = x + w - 2.5;
      const y0 = rowY + 2.5;
      const y1 = rowY + h - 2.5;
      if (x1 - x0 > 20 && y1 - y0 > 20) {
        const cut = Math.min(x1 - x0, y1 - y0) * rng.range(0.06, 0.18);
        const j = () => rng.range(-1.8, 1.8);
        const pts: [number, number][] = [
          [x0 + cut + j(), y0 + j()],
          [(x0 + x1) / 2 + j(), y0 + rng.range(-1, 2)],
          [x1 - cut + j(), y0 + j()],
          [x1 + j(), y0 + cut + j()],
          [x1 + j(), (y0 + y1) / 2 + j()],
          [x1 + j(), y1 - cut + j()],
          [x1 - cut + j(), y1 + j()],
          [(x0 + x1) / 2 + j(), y1 + rng.range(-2, 1)],
          [x0 + cut + j(), y1 + j()],
          [x0 + j(), y1 - cut + j()],
          [x0 + j(), (y0 + y1) / 2 + j()],
          [x0 + j(), y0 + cut + j()],
        ];
        const cracks: number[][] = [];
        for (let c = 0; c < rng.int(0, 2); c++) {
          const a = rng.range(0, Math.PI * 2);
          const l = rng.range(cell * 0.12, cell * 0.35);
          cracks.push([(x0 + x1) / 2, (y0 + y1) / 2, (x0 + x1) / 2 + Math.cos(a) * l, (y0 + y1) / 2 + Math.sin(a) * l]);
        }
        stones.push({ pts, tone: rng.range(0.3, 0.48), moss: rng.range(0, 1), cracks });
      }
      x += w;
    }
    rowY += h;
    row++;
  }
  void row;

  const map = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = '#1b1c17';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 10000; i++) {
      const v = 18 + Math.floor(rng.range(0, 22));
      ctx.fillStyle = `rgba(${v},${v + 2},${v - 1},0.45)`;
      ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 4), rng.range(1, 4));
    }
    const drawStone = (s: Stone, heightOnly: boolean, ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
      ctx.closePath();
      if (heightOnly) {
        const v = Math.floor(130 + s.tone * 210);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fill();
        ctx.strokeStyle = '#080808';
        ctx.lineWidth = 5;
        ctx.stroke();
        return;
      }
      const l = s.tone * 100;
      const hue = 40 + rng.range(-5, 5);
      const sat = 2 + rng.range(0, 3);
      ctx.fillStyle = `hsl(${hue}, ${sat}%, ${l}%)`;
      ctx.fill();
      ctx.save();
      ctx.clip();
      // top face: subtle gradient, mineral grain, worn foot traffic
      const g = ctx.createLinearGradient(0, 0, size * 0.1, size * 0.1);
      g.addColorStop(0, 'rgba(255,250,240,0.10)');
      g.addColorStop(0.6, 'rgba(255,250,240,0.02)');
      g.addColorStop(1, 'rgba(0,0,0,0.10)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 520; i++) {
        const v = rng.range(-18, 18);
        ctx.fillStyle = v > 0 ? `rgba(210,208,196,${rng.range(0.02, 0.07)})` : `rgba(8,9,8,${rng.range(0.02, 0.09)})`;
        ctx.beginPath();
        ctx.arc(s.pts[0][0] + rng.range(-cell, cell), s.pts[0][1] + rng.range(-cell, cell), rng.range(0.5, 2.6), 0, Math.PI * 2);
        ctx.fill();
      }
      // broad damp / dirt pooling
      for (let i = 0; i < 4; i++) {
        const x = s.pts[0][0] + rng.range(-cell * 0.5, cell);
        const y = s.pts[0][1] + rng.range(-cell * 0.5, cell);
        const r = rng.range(cell * 0.12, cell * 0.4);
        const dg = ctx.createRadialGradient(x, y, 0, x, y, r);
        dg.addColorStop(0, 'rgba(14,16,12,0.16)');
        dg.addColorStop(1, 'rgba(14,16,12,0)');
        ctx.fillStyle = dg;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // moss creeping from the joints, strongest at the bottom of each cell
      const mstr = 0.08 + s.moss * 0.2;
      const mg = ctx.createLinearGradient(0, s.pts[1][1], 0, s.pts[8][1]);
      mg.addColorStop(0, 'rgba(46,64,26,0)');
      mg.addColorStop(1, `rgba(46,64,26,${mstr})`);
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, size, size);
      // hairline cracks / chipped corners
      ctx.strokeStyle = 'rgba(10,12,9,0.5)';
      ctx.lineWidth = 1.1;
      for (const c of s.cracks) {
        ctx.beginPath();
        ctx.moveTo(c[0], c[1]);
        ctx.lineTo((c[0] + c[2]) / 2 + rng.range(-5, 5), (c[1] + c[3]) / 2 + rng.range(-5, 5));
        ctx.lineTo(c[2], c[3]);
        ctx.stroke();
      }
      ctx.restore();
      // tight dark joint, then a thin algae line
      ctx.strokeStyle = 'rgba(8,10,8,0.55)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.strokeStyle = `rgba(48,62,26,${0.035 + s.moss * 0.09})`;
      ctx.lineWidth = 3.6;
      ctx.stroke();
    };
    stones.forEach((s) => drawStone(s, false, ctx));
    // fine leaf litter and twigs on the flags
    for (let i = 0; i < 70; i++) {
      const x = rng.range(0, size);
      const y = rng.range(0, size);
      ctx.fillStyle = `rgba(${64 + rng.range(0, 45)},${40 + rng.range(0, 25)},${18 + rng.range(0, 15)},0.35)`;
      ctx.beginPath();
      ctx.ellipse(x, y, rng.range(2, 6), rng.range(0.8, 2.2), rng.range(0, 3), 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 16;

  const height = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = '#090909';
    ctx.fillRect(0, 0, size, size);
    for (const st of stones) {
      ctx.beginPath();
      ctx.moveTo(st.pts[0][0], st.pts[0][1]);
      for (let i = 1; i < st.pts.length; i++) ctx.lineTo(st.pts[i][0], st.pts[i][1]);
      ctx.closePath();
      const v = Math.floor(120 + st.tone * 230);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fill();
      ctx.strokeStyle = '#080808';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }, false);
  height.wrapS = height.wrapT = THREE.RepeatWrapping;
  height.anisotropy = 16;
  const maps = { map, height };
  flagstoneCache.set(key, maps);
  return maps;
}

/** Weathered flagstone paving for the approach and the gate platform. */
export function flagstoneMaterial(tile = 6.0, pathMask = true,
  originX = 0, originZ = 0) {
  const { map } = flagstoneMaps('lingyin-flagstone', 8);
  const tileStr = tile.toFixed(2);
  return procMaterial({
    name: pathMask ? 'flagstone-path' : 'flagstone-platform',
    params: {
      color: 0xffffff,
      map,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.1,
    },
    color: /* glsl */ `
      vec2 warp = (vec2(cgFbm2(cgP.xz * 0.33 + 1.0), cgFbm2(cgP.xz * 0.33 + 5.0)) - 0.5) * 0.5;
      vec2 suv = cgP.xz / ${tileStr} + warp;
      vec3 st = texture2D(map, suv).rgb;
      float lum = dot(st, vec3(0.333));
      // soil and leaf litter outside the paved path
      float n = cgFbm2(cgP.xz * 0.55 + 3.0);
      float fine = cgNoise2(cgP.xz * 5.0);
      vec3 soil = mix(vec3(0.035,0.033,0.024), vec3(0.115,0.095,0.058), n * 0.8 + fine * 0.2);
      float moss = smoothstep(0.52, 0.78, cgFbm2(cgP.xz * 1.35 + 8.0));
      soil = mix(soil, vec3(0.075,0.105,0.035), moss * 0.7);

      vec2 gatePos = cgP.xz - vec2(${originX.toFixed(2)}, ${originZ.toFixed(2)});
      float halfW = mix(3.3, 4.8, 1.0 - smoothstep(7.0, 13.0, gatePos.y));
      halfW += (cgFbm2(gatePos * 0.7 + 2.0) - 0.5) * 1.5;
      float path = smoothstep(halfW + 0.6, halfW - 0.9, abs(gatePos.x)) * smoothstep(3.6, 4.8, gatePos.y);
      float courtyard = smoothstep(-20.0, -16.0, gatePos.y) * (1.0 - smoothstep(3.0, 4.2, gatePos.y)) * smoothstep(6.4, 4.8, abs(gatePos.x));
      path = max(path, courtyard);
      ${pathMask ? '' : 'path = 1.0;'}

      // stone: warm grey, with dark mortar and green in the joints
      vec3 stone = mix(vec3(dot(st, vec3(0.333))), st, 0.78) * 1.06;
      float joint = smoothstep(0.34, 0.16, lum);
      stone = mix(stone, stone * 0.62, joint * 0.5);
      float jointMoss = joint * smoothstep(0.25, 0.75, moss + 0.15);
      stone = mix(stone, vec3(0.11,0.15,0.05), jointMoss * 0.26);
      // damp, darker and slightly cooler in low spots
      float damp = smoothstep(0.58, 0.78, cgFbm2(cgP.xz * 0.45 + 17.0));
      stone = mix(stone, stone * vec3(0.62,0.66,0.66), damp * 0.5);
      // fine mineral variation
      stone *= 0.9 + 0.18 * cgNoise2(cgP.xz * 11.0);

      vec3 c = mix(soil, stone, path);
      // dappled sunlight: broad soft pools, not a uniform multiplier
      float dapple = smoothstep(0.55, 0.72, cgFbm2(cgP.xz * 0.95 + 8.0));
      c *= 0.93 + 0.1 * dapple * (0.35 + 0.65 * path);
      // scattered leaves on the flags
      float leaf = smoothstep(0.78, 0.84, cgNoise2(cgP.xz * 3.2 + 1.7));
      c = mix(c, vec3(0.22,0.12,0.045), leaf * path * 0.18);
      diffuseColor.rgb = c;
    `,
    roughness: /* glsl */ `
      float damp = smoothstep(0.58, 0.78, cgFbm2(cgP.xz * 0.45 + 17.0));
      float l = dot(diffuseColor.rgb, vec3(0.333));
      roughnessFactor = clamp(0.82 + 0.14 * l - damp * 0.28, 0.35, 1.0);
    `,
    normal: /* glsl */ `
      vec2 buv = cgP.xz / ${tileStr} + (vec2(cgFbm2(cgP.xz * 0.33 + 1.0), cgFbm2(cgP.xz * 0.33 + 5.0)) - 0.5) * 0.5;
      float e = 0.012;
      float h0 = dot(texture2D(map, buv).rgb, vec3(0.333));
      float hx = dot(texture2D(map, buv + vec2(e, 0.0)).rgb, vec3(0.333));
      float hz = dot(texture2D(map, buv + vec2(0.0, e)).rgb, vec3(0.333));
      cgBump = vec3(h0 - hx, 0.0, h0 - hz) * 3.4;
    `,
  });
}

/** Small granite block texture for column bases and kerbs. */
export function graniteMaterial(warm = 0) {
  const rng = new Rng('granite-tex');
  const size = 512;
  const map = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = '#4a4a45';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i++) {
      const v = 60 + Math.floor(rng.range(0, 80));
      ctx.fillStyle = `rgba(${v},${v + rng.range(-3, 3)},${v - rng.range(0, 8)},${rng.range(0.15, 0.6)})`;
      ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 3), rng.range(1, 3));
    }
    // feldspar flecks
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(200,196,180,0.35)' : 'rgba(20,20,18,0.4)';
      ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 4), rng.range(1, 4));
    }
    // damp / lichen
    for (let i = 0; i < 12; i++) {
      const x = rng.range(0, size);
      const y = rng.range(0, size);
      const r = rng.range(20, 90);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(40,60,26,0.32)');
      g.addColorStop(1, 'rgba(40,60,26,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 16;
  return procMaterial({
    name: 'granite-textured',
    params: { color: 0xffffff, map, roughness: 1, metalness: 0, envMapIntensity: 0.12 },
    uniforms: { uWarm: { value: warm } },
    head: 'uniform float uWarm;',
    color: /* glsl */ `
      vec3 c = texture2D(map, cgP.xz * 0.55 + cgP.y * 0.35).rgb;
      c = mix(c, c * vec3(1.06, 0.98, 0.88), uWarm * 0.6);
      float moss = smoothstep(0.55, 0.8, cgFbm2(cgP.xz * 1.8 + 5.0));
      c = mix(c, vec3(0.11,0.15,0.055), moss * 0.45);
      c *= 1.0 - (1.0 - smoothstep(0.0, 0.7, cgP.y - 0.3)) * 0.3;
      diffuseColor.rgb = c;
    `,
    normal: /* glsl */ `
      float e = 0.02;
      float h0 = dot(texture2D(map, cgP.xz * 0.55 + cgP.y * 0.35).rgb, vec3(0.333));
      float hx = dot(texture2D(map, (cgP.xz + vec2(e,0.0)) * 0.55 + cgP.y * 0.35).rgb, vec3(0.333));
      float hz = dot(texture2D(map, (cgP.xz + vec2(0.0,e)) * 0.55 + cgP.y * 0.35).rgb, vec3(0.333));
      cgBump = vec3(h0-hx, 0.0, h0-hz) * 2.0;
    `,
  });
}
