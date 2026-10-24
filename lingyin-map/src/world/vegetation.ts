import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO } from '../core/atmosphere';
import { lerp, Rng } from '../core/math';
import { procMaterial } from '../core/materials';
import { photographedBarkMaterial, rockMaterial } from './materials';
import { projectedTempleUV } from './geom';
import { bakeSurfaceFinish } from './surface_finish';
import { heightAt, insidePlatform, insideTerrainFootprint, pathDistance, slopeAt, waterEdge } from './heightfield';
import { RIDGE_RAIL_OFFSET, ridgeTrailDistance } from '../../../scripts/lingyin_hillside_route.js';
import { SHOTS } from '../data/shots';
import { bambooCulmMaterial, runtimeTexture } from './runtime_textures';

const ATLAS = 1024;
const CELL = 256;

type FoliagePhoto = { diffuse: HTMLImageElement; alpha: HTMLImageElement };
let foliagePhotos: { pine: FoliagePhoto; broad: FoliagePhoto } | null = null;
let foliagePhotosLoading: Promise<void> | null = null;

export function preloadFoliagePhotos() {
  if (runtimeTexture('forest-atlas')) return Promise.resolve();
  if (foliagePhotosLoading) return foliagePhotosLoading;
  const load = (name: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Lingyin foliage image failed: ${name}`));
    image.src = new URL(`./assets/lingyin/temple-textures/${name}`, document.baseURI).href + '?v=1';
  });
  foliagePhotosLoading = Promise.all([
    load('pine-foliage-albedo.jpg'), load('pine-foliage-alpha.png'),
    load('broad-foliage-albedo.jpg'), load('broad-foliage-alpha.png'),
  ]).then(([pineDiffuse, pineAlpha, broadDiffuse, broadAlpha]) => {
    foliagePhotos = {
      pine: { diffuse: pineDiffuse, alpha: pineAlpha },
      broad: { diffuse: broadDiffuse, alpha: broadAlpha },
    };
  });
  return foliagePhotosLoading;
}

export type LeafKind = 'pine' | 'broad' | 'maple' | 'bamboo' | 'grass' | 'fern';

function cellRect(kind: LeafKind) {
  const idx: Record<LeafKind, number> = { pine: 0, broad: 1, maple: 2, bamboo: 3, grass: 4, fern: 5 };
  const i = idx[kind];
  return { col: i % 4, row: Math.floor(i / 4) };
}

function paintAtlas() {
  const baked = runtimeTexture('forest-atlas');
  if (baked) return baked;
  const c = document.createElement('canvas');
  c.width = ATLAS;
  c.height = ATLAS;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d');
  ctx.clearRect(0, 0, ATLAS, ATLAS);
  const rng = new Rng('foliage-atlas');

  const cell = (kind: LeafKind, draw: (g: CanvasRenderingContext2D) => void) => {
    const { col, row } = cellRect(kind);
    const x = col * CELL;
    const y = row * CELL;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, CELL, CELL);
    ctx.clip();
    draw(ctx);
    ctx.restore();
  };

  // ---- pine spray: dark needles radiating from the twig
  cell('pine', (g) => {
    const cx = CELL / 2;
    const cy = CELL * 0.62;
    const under = g.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, 190);
    under.addColorStop(0, 'rgba(22,36,24,0.55)');
    under.addColorStop(0.6, 'rgba(22,36,24,0.22)');
    under.addColorStop(1, 'rgba(22,36,24,0)');
    g.fillStyle = under;
    g.fillRect(0, 0, CELL, CELL);
    for (let s = 0; s < 10; s++) {
      const a0 = -Math.PI * 0.95 + (s / 6) * Math.PI * 1.9;
      g.strokeStyle = `rgb(${34 + rng.int(0, 16)},${44 + rng.int(0, 20)},${30 + rng.int(0, 14)})`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, cy);
      const ex = cx + Math.cos(a0) * 110;
      const ey = cy + Math.sin(a0) * 95;
      g.lineTo(ex, ey);
      g.stroke();
      for (let i = 0; i < 44; i++) {
        const t = 0.15 + (i / 34) * 0.85;
        const px = lerp(cx, ex, t);
        const py = lerp(cy, ey, t);
        const a = a0 + (rng.chance(0.5) ? 1 : -1) * (0.5 + rng.value() * 0.45);
        const len = 22 + rng.value() * 34 * (1 - t * 0.4);
        g.strokeStyle = `rgba(${40 + rng.int(0, 22)},${62 + rng.int(0, 32)},${36 + rng.int(0, 18)},${0.85})`;
        g.lineWidth = 1.15;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
        g.stroke();
      }
    }
  });

  // ---- broadleaf cluster
  cell('broad', (g) => {
    const cx = CELL / 2;
    const cy = CELL * 0.6;
    const under = g.createRadialGradient(cx, cy, 8, cx, cy, 180);
    under.addColorStop(0, 'rgba(24,40,22,0.5)');
    under.addColorStop(0.65, 'rgba(24,40,22,0.18)');
    under.addColorStop(1, 'rgba(24,40,22,0)');
    g.fillStyle = under;
    g.fillRect(0, 0, CELL, CELL);
    for (let b = 0; b < 12; b++) {
      const a = rng.range(-Math.PI, Math.PI);
      const len = rng.range(40, 105);
      const ex = cx + Math.cos(a) * len;
      const ey = cy + Math.sin(a) * len;
      g.strokeStyle = '#3b3122';
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(ex, ey);
      g.stroke();
      for (let i = 0; i < 7; i++) {
        const t = 0.25 + (i / 7) * 0.75;
        const px = lerp(cx, ex, t);
        const py = lerp(cy, ey, t);
        const la = a + (i % 2 ? 1 : -1) * 1.2;
        const lw = rng.range(12, 22);
        g.save();
        g.translate(px, py);
        g.rotate(la);
        g.fillStyle = `rgba(${44 + rng.int(0, 26)},${78 + rng.int(0, 40)},${40 + rng.int(0, 22)},0.94)`;
        g.beginPath();
        g.ellipse(lw * 0.6, 0, lw, lw * 0.42, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  });

  // ---- maple: five-lobed leaves, warm autumn accent
  cell('maple', (g) => {
    const palette = ['#a3402a', '#b6552c', '#8f3520', '#c06a33', '#7d2f22'];
    for (let i = 0; i < 72; i++) {
      const x = rng.range(30, CELL - 30);
      const y = rng.range(30, CELL - 30);
      const s = rng.range(16, 30);
      g.save();
      g.translate(x, y);
      g.rotate(rng.range(0, Math.PI * 2));
      g.fillStyle = palette[rng.int(0, palette.length - 1)];
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.62;
        const lx = Math.cos(a) * s;
        const ly = Math.sin(a) * s;
        g.lineTo(lx, ly);
        g.lineTo(Math.cos(a + 0.28) * s * 0.45, Math.sin(a + 0.28) * s * 0.45);
      }
      g.closePath();
      g.fill();
      g.restore();
    }
  });

  // ---- bamboo leaves
  cell('bamboo', (g) => {
    for (let b = 0; b < 5; b++) {
      const x0 = rng.range(30, CELL - 30);
      const y0 = rng.range(40, CELL - 40);
      for (let i = 0; i < 12; i++) {
        const a = rng.range(-Math.PI, Math.PI);
        const len = rng.range(30, 68);
        g.save();
        g.translate(x0 + rng.range(-10, 10), y0 + rng.range(-10, 10));
        g.rotate(a);
        g.fillStyle = `rgba(${70 + rng.int(0, 25)},${100 + rng.int(0, 30)},${48 + rng.int(0, 20)},0.9)`;
        g.beginPath();
        g.ellipse(len * 0.5, 0, len * 0.5, 3.2, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  });

  // ---- grass blades
  cell('grass', (g) => {
    for (let i = 0; i < 46; i++) {
      const x = CELL / 2 + rng.range(-70, 70);
      const a = -Math.PI / 2 + rng.range(-0.55, 0.55);
      const len = rng.range(80, 210);
      g.strokeStyle = `rgba(${72 + rng.int(0, 35)},${94 + rng.int(0, 35)},${44 + rng.int(0, 22)},0.95)`;
      g.lineWidth = rng.range(1.5, 3.4);
      g.beginPath();
      g.moveTo(x, CELL - 4);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.45, CELL - len * 0.55, x + Math.cos(a) * len, CELL - 4 - Math.sin(-a) * len);
      g.stroke();
    }
  });

  // ---- fern fronds
  cell('fern', (g) => {
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI / 2 + rng.range(-0.8, 0.8);
      const len = rng.range(120, 210);
      const x0 = CELL / 2;
      const y0 = CELL - 10;
      g.strokeStyle = '#3f5a34';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(x0 + Math.cos(a) * len * 0.6, y0 - len * 0.6, x0 + Math.cos(a) * len, y0 - len * 0.85);
      g.stroke();
      for (let i = 4; i < 20; i++) {
        const t = i / 20;
        const px = x0 + Math.cos(a) * len * t;
        const py = y0 - len * 0.85 * t - Math.sin(Math.abs(a)) * 6;
        for (const side of [-1, 1]) {
          g.strokeStyle = `rgba(${54 + rng.int(0, 20)},${80 + rng.int(0, 22)},${40 + rng.int(0, 18)},0.95)`;
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + side * 18 * (1 - t), py + 8);
          g.stroke();
        }
      }
    }
  });

  // The cutouts are cropped from Poly Haven's photographic leaf maps. They
  // replace only atlas pixels: all tree instances continue to share one GPU
  // texture and the original card geometry / culling budget.
  if (foliagePhotos) {
    const copyCutout = (
      kind: 'pine' | 'broad' | 'maple', photo: FoliagePhoto,
      sx: number, sy: number, sw: number, sh: number, autumn = false,
    ) => {
      const diffuseCanvas = document.createElement('canvas');
      const alphaCanvas = document.createElement('canvas');
      diffuseCanvas.width = diffuseCanvas.height = CELL;
      alphaCanvas.width = alphaCanvas.height = CELL;
      const dc = diffuseCanvas.getContext('2d')!;
      const ac = alphaCanvas.getContext('2d')!;
      dc.drawImage(photo.diffuse, sx, sy, sw, sh, 12, 12, CELL - 24, CELL - 24);
      ac.drawImage(photo.alpha, sx, sy, sw, sh, 12, 12, CELL - 24, CELL - 24);
      const diffuse = dc.getImageData(0, 0, CELL, CELL);
      const alpha = ac.getImageData(0, 0, CELL, CELL);
      for (let p = 0; p < diffuse.data.length; p += 4) {
        // UV islands around the photographs also contain opaque grey mesh
        // fragments. Keep only the leaf/needle colours inside the clean crop.
        const r=diffuse.data[p],g=diffuse.data[p+1],b=diffuse.data[p+2];
        const leaf = kind === 'pine' ? g > r * .94 && g > b * 1.12
          : g > r * 1.025 && g > b * 1.18;
        diffuse.data[p + 3] = leaf && alpha.data[p] > 230 ? 255 : 0;
        diffuse.data[p] = Math.min(255,r*1.06);
        diffuse.data[p+1] = Math.min(255,g*1.16);
        if (autumn) {
          diffuse.data[p] = Math.min(255, diffuse.data[p] * 1.5 + 52);
          diffuse.data[p + 1] = Math.min(255, diffuse.data[p + 1] * .68 + 12);
          diffuse.data[p + 2] = Math.min(255, diffuse.data[p + 2] * .52);
        }
      }
      dc.putImageData(diffuse, 0, 0);
      const { col, row } = cellRect(kind);
      ctx.clearRect(col * CELL, row * CELL, CELL, CELL);
      ctx.drawImage(diffuseCanvas, col * CELL, row * CELL);
    };
    // Stay inside the black alpha-backed cutout areas of the source atlases;
    // adjacent white islands are UV data for the original 3D tree meshes.
    copyCutout('pine', foliagePhotos.pine, 30, 42, 197, 360);
    copyCutout('broad', foliagePhotos.broad, 560, 35, 290, 620);
    copyCutout('maple', foliagePhotos.broad, 560, 35, 290, 620, true);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function cellUVs(kind: LeafKind, w: number, h: number) {
  const { col, row } = cellRect(kind);
  const inset = 3 / ATLAS;
  const u0 = col / 4 + inset;
  const v0 = 1 - (row + 1) / 4 + inset;
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + uv.getX(i) * (.25-inset*2), v0 + uv.getY(i) * (.25-inset*2));
  }
  return g;
}

function card(kind: LeafKind, w: number, h: number, y: number, angle: number, tilt = 0, pivotBottom = true, x = 0, z = 0) {
  const g = cellUVs(kind, w, h);
  if (pivotBottom) g.translate(0, h / 2, 0);
  g.rotateX(tilt);
  g.rotateY(angle);
  g.translate(x, y, z);
  return g;
}

class TreeVariant {
  trunk: THREE.BufferGeometry;
  cards: THREE.BufferGeometry;
  blobs: THREE.BufferGeometry;
  constructor(trunk: THREE.BufferGeometry, cards: THREE.BufferGeometry, blobs: THREE.BufferGeometry) {
    this.trunk = trunk;
    this.cards = cards;
    this.blobs = blobs;
  }
}

function pine(rng: Rng): TreeVariant {
  const h = rng.range(10, 16);
  const trunkParts: THREE.BufferGeometry[] = [];
  let x = 0;
  let z = 0;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const y0 = (i / segs) * h;
    const y1 = ((i + 1) / segs) * h;
    const r0 = lerp(0.42, 0.1, i / segs);
    const r1 = lerp(0.42, 0.1, (i + 1) / segs);
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, 8);
    g.translate(x, (y0 + y1) / 2, z);
    trunkParts.push(g);
    x += rng.range(-0.35, 0.35);
    z += rng.range(-0.35, 0.35);
  }
  // branches
  const branchTips: THREE.Vector3[] = [];
  for (let b = 0; b < 9; b++) {
    const y = h * rng.range(0.42, 0.95);
    const a = rng.range(0, Math.PI * 2);
    const len = rng.range(1.6, 3.6) * (1 - y / h * 0.5);
    const tx = Math.cos(a) * len;
    const tz = Math.sin(a) * len;
    const g = new THREE.CylinderGeometry(0.045, 0.14, len, 6);
    g.rotateZ(Math.PI / 2 - 0.35);
    g.rotateY(-a);
    g.translate(tx * 0.5, y + 0.15, tz * 0.5);
    trunkParts.push(g);
    branchTips.push(new THREE.Vector3(tx, y, tz));
  }

  const cards: THREE.BufferGeometry[] = [];
  const blobs: THREE.BufferGeometry[] = [];
  // crown: a few big horizontal masses plus needle cards
  for (const tip of branchTips) {
    const spread = 1.0;
    for (let i = 0; i < 8; i++) {
      const ox = tip.x + rng.range(-spread, spread);
      const oz = tip.z + rng.range(-spread, spread);
      cards.push(card('pine', rng.range(3.2, 4.6), rng.range(2.0, 2.8), tip.y - 0.9 + rng.range(-0.4, 0.4), (i / 8) * Math.PI + rng.range(-0.3, 0.3), 0.1, true, ox, oz));
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    cards.push(card('pine', 3.6, 2.3, h * 0.82, a, 0.02, true, Math.cos(a) * 0.7, Math.sin(a) * 0.7));
  }
  return new TreeVariant(mergeGeometries(trunkParts, false)!, mergeGeometries(cards, false)!, blobs.length ? mergeGeometries(blobs, false)! : new THREE.BufferGeometry());
}

function broadleaf(rng: Rng, kind: 'broad' | 'maple'): TreeVariant {
  const h = rng.range(5.5, 9);
  const trunkParts: THREE.BufferGeometry[] = [];
  trunkParts.push(new THREE.CylinderGeometry(0.16, 0.38, h * 0.62, 8).translate(0, h * 0.31, 0));
  const tips: THREE.Vector3[] = [];
  for (let b = 0; b < 6; b++) {
    const a = (b / 6) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const y = h * rng.range(0.4, 0.68);
    const len = rng.range(1.4, 2.6);
    const g = new THREE.CylinderGeometry(0.07, 0.16, len, 6);
    g.rotateZ(0.8);
    g.rotateY(-a);
    g.translate(Math.cos(a) * len * 0.4, y + 0.5, Math.sin(a) * len * 0.4);
    trunkParts.push(g);
    tips.push(new THREE.Vector3(Math.cos(a) * len * 0.8, y + 0.9, Math.sin(a) * len * 0.8));
  }
  const crownY = h * 0.78;
  const cards: THREE.BufferGeometry[] = [];
  // Crossed leaf sprays fill the centre without an opaque icosahedron.
  // The old solid mass showed its facets against the sky and made the trees
  // look like low-poly props despite the detailed outer leaf cards.
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 8;
    cards.push(card(kind, 4.8, 3.3, crownY - 1.7, a,
      i % 2 ? .12 : -.12, true,
      Math.cos(a * 2) * .24, Math.sin(a * 2) * .24));
  }
  for (let i = 0; i < 72; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.3, 2.9);
    const y = crownY + rng.range(-1.5, 1.9);
    const size = rng.range(2.0, 3.4);
    cards.push(card(kind, size, size * rng.range(0.65, 0.95), y, a, rng.range(-0.5, 0.5), true, Math.cos(a) * r, Math.sin(a) * r));
  }
  for (const tip of tips) {
    cards.push(card(kind, 2.0, 1.4, tip.y, rng.range(0, Math.PI), rng.range(-0.3, 0.3), true, tip.x, tip.z));
  }
  return new TreeVariant(mergeGeometries(trunkParts, false)!, mergeGeometries(cards, false)!, new THREE.BufferGeometry());
}

function bambooGeometry(rng: Rng) {
  const h = rng.range(6.5, 10);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const lean = rng.range(0.04, 0.12);
    const g = new THREE.CylinderGeometry(0.035, 0.05, h, 6);
    g.rotateZ(lean);
    g.rotateY(a);
    g.translate(Math.cos(a) * 0.35, h / 2, Math.sin(a) * 0.35);
    parts.push(g);
    // Rings and fibres are in the shared culm map, rather than seven extra
    // cylinders per stem. The four bent stem silhouettes remain geometric.
  }
  const trunk = mergeGeometries(parts, false)!;
  const cards: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 22; i++) {
    const a = rng.range(0, Math.PI * 2);
    const y = h * rng.range(0.55, 1.0);
    const r = rng.range(0.2, 1.4);
    cards.push(card('bamboo', rng.range(1.0, 1.7), rng.range(0.5, 0.9), y, a, rng.range(-0.4, 0.4), true, Math.cos(a) * r, Math.sin(a) * r));
  }
  return new TreeVariant(trunk, mergeGeometries(cards, false)!, new THREE.BufferGeometry());
}

export class Vegetation {
  readonly group = new THREE.Group();
  private tiles: { mesh: THREE.InstancedMesh; x: number; z: number; range: number }[] = [];
  private atlas: THREE.Texture;
  private bark: THREE.Material;
  private leafMat: THREE.Material;
  private grassGeo: THREE.BufferGeometry;
  private fernGeo: THREE.BufferGeometry;
  private time = ATMO.time;

  constructor() {
    this.group.name = 'vegetation';
    this.atlas = paintAtlas();
    this.bark = photographedBarkMaterial() ?? procMaterial({
      name: 'bark',
      params: { color: 0xffffff, roughness: 0.95 },
      color: /* glsl */ `
        float n = cgFbm2(vec2(cgP.x * 6.0 + cgP.z * 2.0, cgP.y * 0.9));
        vec3 c = mix(vec3(0.10,0.075,0.055), vec3(0.24,0.19,0.14), n);
        c *= 0.8 + 0.3 * smoothstep(0.2, 0.9, cgNoise2(vec2(cgP.y * 3.0, cgP.x * 2.0)));
        diffuseColor.rgb = c;
      `,
    });
    this.leafMat = procMaterial({
      name: 'leaf-card',
      params: {
        color: 0xffffff,
        map: this.atlas,
        alphaTest: 0.42,
        alphaToCoverage:true,
        side: THREE.DoubleSide,
        roughness: 0.92,
        metalness: 0,
      },
      uniforms: { uTime: this.time, uSunDir: ATMO.sunDir },
      vertexHead: 'uniform float uTime;',
      head: 'uniform vec3 uSunDir;',
      vertexPre: /* glsl */ `
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.9;
          float sway = sin(uTime * 0.65 + ph) * 0.045 + sin(uTime * 1.7 + ph * 1.7) * 0.015;
          transformed.x += sway * max(transformed.y, 0.0) * 0.6;
          transformed.z += sway * max(transformed.y, 0.0) * 0.35;
        #endif
      `,
      color: /* glsl */ `
        float ao = 0.7 + 0.3 * smoothstep(0.0, 7.0, cgP.y);
        diffuseColor.rgb *= ao;
      `,
      emissive: /* glsl */ `
        vec3 V = normalize(cameraPosition - cgP);
        float back = pow(max(dot(-V, uSunDir), 0.0), 2.2);
        totalEmissiveRadiance += vec3(0.10, 0.13, 0.05) * back * (0.45 + 0.55 * cgN.y);
      `,
    });

    const grass: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) grass.push(card('grass', 1.1, 0.85, 0, (i / 3) * Math.PI, 0, true));
    this.grassGeo = mergeGeometries(grass, false)!;
    const fern: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) fern.push(card('fern', 1.3, 0.9, 0, (i / 4) * Math.PI * 2, 0.1, true));
    this.fernGeo = mergeGeometries(fern, false)!;

    this.populate();
  }

  private canPlace(x: number, z: number, pad: number) {
    if (!insideTerrainFootprint(x,z,pad)) return false;
    if (insidePlatform(x, z, pad)) return false;
    // keep the showcase sightlines clear: no trunk or canopy inside the first 55% of a shot's view corridor
    for (const shot of SHOTS) {
      const ax = shot.pos[0];
      const az = shot.pos[2];
      const bx = shot.target[0];
      const bz = shot.target[2];
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      const t = ((x - ax) * dx + (z - az) * dz) / len2;
      if (t > -0.05 && t < 0.5) {
        const px = ax + dx * t;
        const pz = az + dz * t;
        if (Math.hypot(x - px, z - pz) < 9 + pad) return false;
      }
    }
    if (pathDistance(x, z) < pad + 1.6) return false;
    // The old centreline-only check admitted bamboo, shrubs and tree trunks
    // directly through the new edge rail and paved shoulder.
    if (ridgeTrailDistance(x,z)<RIDGE_RAIL_OFFSET+pad+.35)return false;
    if (waterEdge(x, z) < pad) return false;
    if (slopeAt(x, z) > 0.8) return false;
    return true;
  }

  private populate() {
    const rng = new Rng('vegetation');
    const pineVars = [pine(new Rng('pine-a')), pine(new Rng('pine-b')), pine(new Rng('pine-c'))];
    const broadVars = [broadleaf(new Rng('broad-a'), 'broad'), broadleaf(new Rng('broad-b'), 'broad')];
    const mapleVars = [broadleaf(new Rng('maple-a'), 'maple'), broadleaf(new Rng('maple-b'), 'maple')];
    const bambooVar = bambooGeometry(new Rng('bamboo'));
    const pineSlots: { v: number; m: THREE.Matrix4; c: THREE.Color }[] = [];
    const broadSlots: { v: number; m: THREE.Matrix4; c: THREE.Color }[] = [];
    const mapleSlots: { v: number; m: THREE.Matrix4; c: THREE.Color }[] = [];
    const bambooSlots: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();

    const mat4 = (x: number, y: number, z: number, s: number, ry: number) => {
      e.set(0, ry, 0);
      q.setFromEuler(e);
      sc.set(s, s, s);
      return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, sc);
    };

    // pines on the slopes and the crag shoulders
    let tries = 0;
    while (pineSlots.length < 190 && tries < 12000) {
      tries++;
      const x = rng.range(-250, 250);
      const z = rng.range(-250, 220);
      if (!this.canPlace(x, z, 3.5)) continue;
      if (slopeAt(x, z) < 0.08 && rng.chance(0.7)) continue;
      pineSlots.push({ v: rng.int(0, pineVars.length - 1), m: mat4(x, heightAt(x, z) - 0.25, z, rng.range(0.75, 1.25), rng.range(0, 6.28)), c: new THREE.Color().setHSL(0.29 + rng.range(-0.02, 0.02), 0.10, 0.76 + rng.range(-0.08, 0.06)) });
    }
    // broadleaf around the temple and lower slopes
    tries = 0;
    while (broadSlots.length < 120 && tries < 7000) {
      tries++;
      const x = rng.range(-210, 210);
      const z = rng.range(-190, 200);
      if (!this.canPlace(x, z, 3)) continue;
      if (Math.abs(x + 2) > 90 && rng.chance(0.5)) continue;
      broadSlots.push({ v: rng.int(0, broadVars.length - 1), m: mat4(x, heightAt(x, z) - 0.2, z, rng.range(0.8, 1.3), rng.range(0, 6.28)), c: new THREE.Color().setHSL(0.27 + rng.range(-0.03, 0.03), 0.10, 0.74 + rng.range(-0.08, 0.06)) });
    }

    // maples: warm accents near the courtyard and stream
    tries = 0;
    while (mapleSlots.length < 30 && tries < 3000) {
      tries++;
      const x = rng.range(-90, 80);
      const z = rng.range(-70, 90);
      if (!this.canPlace(x, z, 3)) continue;
      if (insidePlatform(x, z, 5)) continue;
      mapleSlots.push({ v: rng.int(0, mapleVars.length - 1), m: mat4(x, heightAt(x, z) - 0.2, z, rng.range(0.75, 1.15), rng.range(0, 6.28)), c: new THREE.Color().setHSL(0.05 + rng.range(-0.02, 0.02), 0.12, 0.82 + rng.range(-0.06, 0.05)) });
    }

    // bamboo grove west of the courtyard
    for (let i = 0; i < 170; i++) {
      const x = rng.range(-62, -38);
      const z = rng.range(-10, 52);
      if (!this.canPlace(x, z, 1.2)) continue;
      bambooSlots.push({ m: mat4(x, heightAt(x, z) - 0.1, z, rng.range(0.8, 1.2), rng.range(0, 6.28)), c: new THREE.Color().setHSL(0.24 + rng.range(-0.02, 0.02), 0.10, 0.8) });
    }

    this.buildSpecies(pineVars, pineSlots);
    this.buildSpecies(broadVars, broadSlots);
    this.buildSpecies(mapleVars, mapleSlots);
    this.buildSpecies([bambooVar], bambooSlots.map((s) => ({ v: 0, ...s })), bambooCulmMaterial());

    // grass and ferns
    const grassSlots: THREE.Matrix4[] = [];
    const fernSlots: THREE.Matrix4[] = [];
    tries = 0;
    while (grassSlots.length < 7000 && tries < 26000) {
      tries++;
      const x = rng.range(-120, 100);
      const z = rng.range(-90, 110);
      if (!this.canPlace(x, z, 0.5)) continue;
      if (insidePlatform(x, z, 1.5)) continue;
      grassSlots.push(mat4(x, heightAt(x, z) - 0.02, z, rng.range(0.7, 1.4), rng.range(0, 6.28)));
    }
    tries = 0;
    while (fernSlots.length < 800 && tries < 7000) {
      tries++;
      const x = rng.range(-95, 90);
      const z = rng.range(-70, 95);
      if (!this.canPlace(x, z, 1.2)) continue;
      fernSlots.push(mat4(x, heightAt(x, z) - 0.02, z, rng.range(0.7, 1.2), rng.range(0, 6.28)));
    }
    this.addInstanced(this.grassGeo, this.leafMat, grassSlots, false, 'grass');
    this.addInstanced(this.fernGeo, this.leafMat, fernSlots, false, 'fern');
    this.shrubsAndRocks(rng);
  }

  private shrubsAndRocks(rng: Rng) {
    const shrubGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI / 5;
      shrubGeos.push(card('broad', rng.range(1.55, 2.15), rng.range(1.1, 1.6),
        0, angle, rng.range(-0.16, 0.16), true,
        Math.cos(angle * 2) * 0.28, Math.sin(angle * 2) * 0.28));
    }
    const shrubGeo = mergeGeometries(shrubGeos, false)!;
    const shrubMats: THREE.Matrix4[] = [];
    let tries = 0;
    while (shrubMats.length < 260 && tries < 4000) {
      tries++;
      const x = rng.range(-140, 130);
      const z = rng.range(-100, 120);
      if (!this.canPlace(x, z, 1.7)) continue;
      const s = rng.range(0.7, 1.7);
      shrubMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) - 0.15, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, 6.28), 0)), new THREE.Vector3(s, s * rng.range(0.8, 1.2), s)));
    }
    this.addInstanced(shrubGeo, this.leafMat, shrubMats, true, 'shrub');

    // mossy boulders on the slopes and along the stream
    const rockGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.IcosahedronGeometry(rng.range(0.8, 1.8), 2);
      const p = g.getAttribute('position');
      for (let k = 0; k < p.count; k++) {
        const nx = p.getX(k);
        const ny = p.getY(k);
        const nz = p.getZ(k);
        const d = 1 + 0.22 * Math.sin(nx * 4 + i) * Math.cos(nz * 5 - i) + 0.1 * Math.sin(ny * 9);
        p.setXYZ(k, nx * d, ny * d * 0.7, nz * d);
      }
      g.computeVertexNormals();
      rockGeos.push(g);
    }
    let rockGeo = mergeGeometries(rockGeos, false)!;
    const rockMat=rockMaterial();
    if(rockMat.name==='limestone-photogrammetry')
      rockGeo=bakeSurfaceFinish(projectedTempleUV(rockGeo,1.6),'stone');
    const rockMats: THREE.Matrix4[] = [];
    tries = 0;
    while (rockMats.length < 85 && tries < 3000) {
      tries++;
      const x = rng.range(-150, 140);
      const z = rng.range(-110, 130);
      if (!insideTerrainFootprint(x,z,2.2)) continue;
      const s = rng.range(0.5, 2.2);
      // The merged boulder is wider than its instance origin.  Reserve space
      // from the temple by its actual scale so a large exterior rock cannot
      // protrude across the wall and appear on the courtyard paving.
      if (insidePlatform(x, z, 2.2 * s + 1)) continue;
      if (pathDistance(x, z) < 3 ||
        ridgeTrailDistance(x,z)<RIDGE_RAIL_OFFSET+1.8*s+.35) continue;
      rockMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) - 0.35 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.2, 0.2), rng.range(0, 6.28), rng.range(-0.2, 0.2))), new THREE.Vector3(s, s * rng.range(0.6, 1.1), s)));
    }
    this.addInstanced(rockGeo, rockMat, rockMats, true, 'boulder');
  }

  private buildSpecies(variants: TreeVariant[], slots: { v: number; m: THREE.Matrix4; c: THREE.Color }[], trunkMaterial = this.bark) {
    for (let vi = 0; vi < variants.length; vi++) {
      const list = slots.filter((s) => s.v === vi);
      if (!list.length) continue;
      const mats = list.map((s) => s.m);
      const colors = list.map((s) => s.c);
      let trunk=variants[vi].trunk;
      if(trunkMaterial.name==='bark-photogrammetry')
        trunk=bakeSurfaceFinish(projectedTempleUV(trunk,2.4),'bark');
      this.addInstanced(trunk, trunkMaterial, mats, true, 'trunk');
      this.addInstanced(variants[vi].cards, this.leafMat, mats, true, 'cards', colors);
    }
  }

  private addInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], shadow: boolean, name: string, colors?: THREE.Color[]) {
    if (!geo.getAttribute('position') || geo.getAttribute('position').count === 0 || !mats.length) return;
    // A single instanced mesh for a 500 m forest has one enormous bounding
    // sphere: Three.js then draws every tree even when most are behind us.
    // Keep shared geometry/materials, but give each spatial tile its own bounds.
    const tileSize = name === 'far-forest' ? 200
      : name === 'grass' || name === 'fern' ? 48 : 96;
    const maxDistance = name === 'grass' ? 75 : name === 'fern' ? 100
      : name === 'shrub' ? 125 : name === 'far-forest' ? 380 : 185;
    const bins = new Map<string, number[]>();
    for (let i = 0; i < mats.length; i++) {
      const e = mats[i].elements;
      const key = `${Math.floor(e[12] / tileSize)},${Math.floor(e[14] / tileSize)}`;
      const bin = bins.get(key);
      if (bin) bin.push(i);
      else bins.set(key, [i]);
    }
    for (const [key, indices] of bins) {
      const [ix, iz] = key.split(',').map(Number);
      const mesh = new THREE.InstancedMesh(geo, mat, indices.length);
      mesh.name = `${name}-${this.group.children.length}`;
      for (let i = 0; i < indices.length; i++) {
        const source = indices[i];
        mesh.setMatrixAt(i, mats[source]);
        if (colors) mesh.setColorAt(i, colors[source]);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      mesh.computeBoundingSphere();
      if (shadow && (mat as THREE.MeshStandardMaterial).map) {
        mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
          depthPacking: THREE.RGBADepthPacking,
          map: (mat as THREE.MeshStandardMaterial).map,
          alphaTest: (mat as THREE.MeshStandardMaterial).alphaTest,
          side: THREE.DoubleSide,
        });
      }
      this.group.add(mesh);
      this.tiles.push({ mesh, x: (ix + 0.5) * tileSize, z: (iz + 0.5) * tileSize,
        range: maxDistance + tileSize * 0.75 });
    }
  }

  update(camera?: THREE.Camera) {
    void this.time;
    if (!camera) return;
    const x = camera.position.x, z = camera.position.z;
    for (const tile of this.tiles) {
      const dx = x - tile.x, dz = z - tile.z;
      tile.mesh.visible = dx * dx + dz * dz < tile.range * tile.range;
    }
  }
}
