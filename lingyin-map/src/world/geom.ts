import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function withUV(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.getAttribute('uv')) {
    const count = geo.getAttribute('position').count;
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return geo;
}

export function box(w: number, h: number, d: number, x = 0, y = 0, z = 0, rotY = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return withUV(g);
}

export function cyl(rt: number, rb: number, h: number, seg: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false);
  g.translate(x, y, z);
  return withUV(g);
}

export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = geos.filter((g) => g && g.getAttribute('position')?.count);
  // ExtrudeGeometry is non-indexed while the primitives are indexed; normalise the mix.
  const allIndexed = clean.every((g) => g.index !== null);
  const prepared = clean.map((g) => (allIndexed ? withUV(g) : withUV(g.index ? g.toNonIndexed() : g)));
  const merged = mergeGeometries(prepared, false);
  if (!merged) throw new Error('merge failed');
  merged.computeBoundingSphere();
  return merged;
}

/** World-metre UVs on all sides of the temple's merged architectural meshes. */
export function projectedTempleUV(source: THREE.BufferGeometry, metresPerTile: number) {
  // A triangle needs one projection plane. Unindexing prevents a cylinder
  // vertex shared by two differently oriented faces from stretching a map
  // across the whole column at the projection seam.
  const geo = source.index ? source.toNonIndexed() : source;
  const pos = geo.getAttribute('position');
  const normal = geo.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 3) {
    const nx = Math.abs(normal.getX(i) + normal.getX(i + 1) + normal.getX(i + 2));
    const ny = Math.abs(normal.getY(i) + normal.getY(i + 1) + normal.getY(i + 2));
    const nz = Math.abs(normal.getZ(i) + normal.getZ(i + 1) + normal.getZ(i + 2));
    for (let j = i; j < i + 3; j++) {
      const x = pos.getX(j), y = pos.getY(j), z = pos.getZ(j);
      const u = ny > nx && ny > nz ? x : nx > nz ? z : x;
      const v = ny > nx && ny > nz ? z : y;
      uv[j * 2] = u / metresPerTile;
      uv[j * 2 + 1] = v / metresPerTile;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function translate(geo: THREE.BufferGeometry, x: number, y: number, z: number) {
  geo.translate(x, y, z);
  return geo;
}

export function rotateY(geo: THREE.BufferGeometry, a: number) {
  geo.rotateY(a);
  return geo;
}

/**
 * Curved Chinese hip roof. Four slopes meet at a ridge; eaves rise at the corners.
 * Returns a position/normal/uv geometry with UVs in metres so the tile shader can
 * draw courses and cover tiles at a fixed world scale.
 */
export function roofGeometry(opts: {
  w: number;
  d: number;
  eaveY: number;
  rise: number;
  cornerLift?: number;
  overhang?: number;
  ridgeFrac?: number;
  nu?: number;
  nv?: number;
  sag?: number;
}): THREE.BufferGeometry {
  const { w, d, eaveY, rise } = opts;
  const overhang = opts.overhang ?? 1.1;
  const cornerLift = opts.cornerLift ?? 0.85;
  const ridgeFrac = opts.ridgeFrac ?? 0.52;
  const nu = opts.nu ?? 40;
  const nv = opts.nv ?? 18;
  const hw = w / 2 + overhang;
  const hd = d / 2 + overhang;
  const rl = (w * ridgeFrac) / 2;

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const slopeLen = Math.hypot(hd, rise);

  const patch = (
    get: (u: number, v: number) => [number, number, number],
    uScale: number,
    vScale: number,
  ) => {
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        const [x, y, z] = get(u, v);
        pos.push(x, y, z);
        // u = distance across the eave, v = distance up the slope
        uv.push((u - 0.5) * uScale, v * vScale);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i;
        const b = a + 1;
        const c = a + nu + 1;
        const dd = c + 1;
        idx.push(a, c, b, b, c, dd);
      }
    }
  };

  const yAt = (u: number, v: number) => {
    const corner = Math.pow(Math.abs(u - 0.5) * 2, 5) * Math.pow(1 - v, 2.1) * cornerLift;
    return eaveY + rise * Math.pow(v, 1.32) + corner;
  };

  // front / back
  for (const sign of [1, -1]) {
    patch(
      (u, v) => {
        const x = (u - 0.5) * 2 * (hw * (1 - v) + rl * v);
        const z = sign * hd * Math.pow(1 - v, 0.94);
        return [x, yAt(u, v), z];
      },
      hw * 2,
      slopeLen,
    );
  }
  // hip ends
  for (const sign of [1, -1]) {
    patch(
      (u, v) => {
        const x = sign * (hw * (1 - v) + rl * v);
        const z = (u - 0.5) * 2 * hd * (1 - v);
        return [x, yAt(u, v), z];
      },
      hd * 2,
      slopeLen,
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** A hip skirt roof around a storey: outer eave up to an inner rectangle. */
export function ringRoofGeometry(opts: {
  wOuter: number;
  dOuter: number;
  wInner: number;
  dInner: number;
  eaveY: number;
  rise: number;
  cornerLift?: number;
  nu?: number;
  nv?: number;
}): THREE.BufferGeometry {
  const { wOuter, dOuter, wInner, dInner, eaveY, rise } = opts;
  const cornerLift = opts.cornerLift ?? 0.7;
  const nu = opts.nu ?? 40;
  const nv = opts.nv ?? 10;
  const hwO = wOuter / 2;
  const hdO = dOuter / 2;
  const hwI = wInner / 2;
  const hdI = dInner / 2;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const patch = (get: (u: number, v: number) => [number, number, number], uScale: number) => {
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        const [x, y, z] = get(u, v);
        pos.push(x, y, z);
        uv.push((u - 0.5) * uScale, v * 4.2);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i;
        const b = a + 1;
        const c = a + nu + 1;
        const dd = c + 1;
        idx.push(a, c, b, b, c, dd);
      }
    }
  };
  const yAt = (u: number, v: number) =>
    eaveY + rise * Math.pow(v, 1.18) + Math.pow(Math.abs(u - 0.5) * 2, 4) * Math.pow(1 - v, 2) * cornerLift;
  for (const sign of [1, -1]) {
    patch(
      (u, v) => {
        const x = (u - 0.5) * 2 * (hwO * (1 - v) + hwI * v);
        const z = sign * (hdO * (1 - v) + hdI * v);
        return [x, yAt(u, v), z];
      },
      hwO * 2,
    );
  }
  for (const sign of [1, -1]) {
    patch(
      (u, v) => {
        const x = sign * (hwO * (1 - v) + hwI * v);
        const z = (u - 0.5) * 2 * (hdO * (1 - v) + hdI * v);
        return [x, yAt(u, v), z];
      },
      hdO * 2,
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Wall panel with a round-arch opening, extruded along its thickness. */
export function archWallGeometry(w: number, h: number, thick: number, archR: number, archY: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, h);
  shape.lineTo(-w / 2, h);
  shape.lineTo(-w / 2, 0);
  const hole = new THREE.Path();
  hole.moveTo(-archR, 0.2);
  hole.lineTo(-archR, archY);
  hole.absarc(0, archY, archR, Math.PI, 0, true);
  hole.lineTo(archR, 0.2);
  hole.lineTo(-archR, 0.2);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 16 });
  geo.translate(0, 0, -thick / 2);
  return withUV(geo);
}

export function lattice(
  w: number,
  h: number,
  cell = 0.19,
  bar = 0.055,
  z = 0,
): { bars: THREE.BufferGeometry; backing: THREE.BufferGeometry } {
  const geos: THREE.BufferGeometry[] = [];
  for (let x = -w / 2; x <= w / 2 + 0.001; x += cell) geos.push(box(bar, h, 0.06, x, h / 2, z));
  for (let y = 0; y <= h + 0.001; y += cell * 1.35) geos.push(box(w, bar, 0.055, 0, y, z));
  return { bars: merge(geos), backing: box(w, h, 0.04, 0, h / 2, z - 0.06) };
}

export function textTexture(text: string, w = 512, h = 160, opts: { bg?: string; fg?: string; border?: string } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = opts.bg ?? '#221a14';
  ctx.fillRect(0, 0, w, h);
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  }
  ctx.fillStyle = opts.fg ?? '#d8b268';
  ctx.font = `600 ${Math.floor(h * 0.56)}px "Songti SC", "STSong", "Noto Serif SC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
