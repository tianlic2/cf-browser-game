import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function withUV(g: THREE.BufferGeometry) {
  if (!g.getAttribute('uv')) {
    const n = g.getAttribute('position').count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

export function box(w: number, h: number, d: number, x = 0, y = 0, z = 0, rotY = 0, rotX = 0, rotZ = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX) g.rotateX(rotX);
  if (rotY) g.rotateY(rotY);
  if (rotZ) g.rotateZ(rotZ);
  g.translate(x, y, z);
  return withUV(g);
}

export function cyl(rt: number, rb: number, h: number, seg: number, x = 0, y = 0, z = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false);
  g.translate(x, y, z);
  return withUV(g);
}

export function merge(geos: THREE.BufferGeometry[]) {
  const clean = geos.filter((g) => g && g.getAttribute('position')?.count);
  const indexed = clean.every((g) => g.index !== null);
  const prepared = clean.map((g) => (indexed ? withUV(g) : withUV(g.index ? g.toNonIndexed() : g)));
  const m = mergeGeometries(prepared, false);
  if (!m) throw new Error('merge failed');
  m.computeBoundingSphere();
  return m;
}

/** Add a per-vertex colour attribute to a geometry (used for tile / slab variation). */
export function tint(geo: THREE.BufferGeometry, color: THREE.Color) {
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** A carved, curved bracket (sparrow brace, 雀替) as an extruded 2-D profile. */
export function sparrowBrace(len: number, height: number, thick: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(len * 0.15, height * 0.92, len * 0.55, height * 0.55);
  s.quadraticCurveTo(len * 0.86, height * 0.3, len, height * 0.62);
  s.lineTo(len, 0);
  s.quadraticCurveTo(len * 0.45, height * 0.28, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 12 });
  g.translate(0, 0, -thick / 2);
  return withUV(g);
}

/** Textured plaque canvas: weathered gold board, black calligraphy, red seal. */
export function plaqueTexture(text: string) {
  const w = 1024;
  const h = 320;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d');
  const rng = (() => {
    let a = 20260420;
    return () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
  })();
  // aged gold ground
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#c9a45a');
  grad.addColorStop(0.5, '#b8924b');
  grad.addColorStop(1, '#9d7a3d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 1 + rng() * 8;
    ctx.fillStyle = `rgba(${80 + rng() * 70 | 0},${60 + rng() * 50 | 0},${20 + rng() * 30 | 0},${0.02 + rng() * 0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // calligraphy, right to left
  ctx.fillStyle = '#18130d';
  ctx.font = '600 190px "Songti SC", "STSong", "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = text.split('');
  const startX = w * 0.76;
  const gap = w * 0.24;
  chars.forEach((ch, i) => {
    ctx.save();
    ctx.translate(startX - i * gap, h / 2 + 6);
    ctx.rotate((rng() - 0.5) * 0.02);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  // red seal, lower left
  ctx.fillStyle = '#8f2b22';
  ctx.fillRect(86, h - 116, 58, 58);
  ctx.fillStyle = '#d9bda0';
  ctx.font = '600 32px "Songti SC", serif';
  ctx.fillText('靈', 115, h - 78);
  // rain streaks / edge wear
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 40; i++) {
    const x = rng() * w;
    const g2 = ctx.createLinearGradient(x, 0, x + 20, 0);
    g2.addColorStop(0, 'rgba(0,0,0,0)');
    g2.addColorStop(0.5, `rgba(40,30,15,${0.02 + rng() * 0.05})`);
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(x, 0, 20, h);
  }
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
