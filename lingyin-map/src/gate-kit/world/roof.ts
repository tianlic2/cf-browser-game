import * as THREE from 'three';
import { Rng } from '../core/math';
import { box, merge, tint } from './geom';
import { coverTileMaterial, roofFieldMaterial, timberMaterial } from './materials';

export const ROOF = {
  w: 13.8,
  d: 6.4,
  eaveY: 7.02,
  rise: 3.15,
  overhang: 0.9,
  ridgeFrac: 0.44,
  cornerLift: 0.3,
};

const hw = ROOF.w / 2 + ROOF.overhang;
const hd = ROOF.d / 2 + ROOF.overhang;
const rl = (ROOF.w * ROOF.ridgeFrac) / 2;

type Kind = 'front' | 'back' | 'left' | 'right';

/** Point on the curved roof surface. v=0 at the eave, v=1 at the ridge. */
export function roofPoint(kind: Kind, u: number, v: number): THREE.Vector3 {
  const corner = Math.pow(Math.abs(u - 0.5) * 2, 5) * Math.pow(1 - v, 2.15) * ROOF.cornerLift;
  const y = ROOF.eaveY + ROOF.rise * Math.pow(v, 1.32) + corner;
  if (kind === 'front' || kind === 'back') {
    const sign = kind === 'front' ? 1 : -1;
    const x = (u - 0.5) * 2 * (hw * (1 - v) + rl * v);
    const z = sign * hd * Math.pow(1 - v, 0.94);
    return new THREE.Vector3(x, y, z);
  }
  const sign = kind === 'left' ? -1 : 1;
  const x = sign * (hw * (1 - v) + rl * v);
  const z = (u - 0.5) * 2 * hd * (1 - v);
  return new THREE.Vector3(x, y, z);
}

function roofNormal(kind: Kind, u: number, v: number) {
  const e = 0.008;
  const du = roofPoint(kind, Math.min(1, u + e), v).sub(roofPoint(kind, Math.max(0, u - e), v));
  const dv = roofPoint(kind, u, Math.min(1, v + e)).sub(roofPoint(kind, u, Math.max(0, v - e)));
  const n = new THREE.Vector3().crossVectors(du, dv).normalize();
  if (n.y < 0) n.negate();
  return n;
}

export class Roof {
  readonly group = new THREE.Group();
  private tileMat = coverTileMaterial();
  private fieldMat = roofFieldMaterial();

  constructor() {
    this.group.name = 'roof';
    this.buildField();
    this.buildCoverTiles();
    this.buildRidges();
    this.buildEaves();
  }

  private buildField() {
    const geos: THREE.BufferGeometry[] = [];
    const nu = 56;
    const nv = 26;
    for (const kind of ['front', 'back', 'left', 'right'] as Kind[]) {
      const pos: number[] = [];
      const uvs: number[] = [];
      const idx: number[] = [];
      for (let j = 0; j <= nv; j++) {
        const v = j / nv;
        for (let i = 0; i <= nu; i++) {
          const u = i / nu;
          const p = roofPoint(kind, u, v);
          pos.push(p.x, p.y, p.z);
          uvs.push((u - 0.5) * (kind === 'front' || kind === 'back' ? hw * 2 : hd * 2), v * 6.5);
        }
      }
      for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
          const a = j * (nu + 1) + i;
          const b = a + 1;
          const c = a + nu + 1;
          const d = c + 1;
          idx.push(a, b, c, b, d, c);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      geos.push(g);
    }
    const mesh = new THREE.Mesh(merge(geos), this.fieldMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /** Continuous half-round cover tiles, swept along the curved slope. */
  private buildCoverTiles() {
    const rng = new Rng('roof-tiles');
    const geos: THREE.BufferGeometry[] = [];
    const addStrip = (kind: Kind, u: number) => {
      const steps = 18;
      const seg = 5;
      const radius = 0.085;
      const pos: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      const pts: THREE.Vector3[] = [];
      const sides: THREE.Vector3[] = [];
      const norms: THREE.Vector3[] = [];
      for (let i = 0; i <= steps; i++) {
        const v = i / steps;
        const p = roofPoint(kind, u, v);
        const n = roofNormal(kind, u, v);
        const e = 0.01;
        const p2 = roofPoint(kind, Math.min(1, u + e), v);
        const side = p2.sub(p).normalize();
        pts.push(p);
        sides.push(side);
        norms.push(n);
      }
      const base = new THREE.Color().setHSL(0.32 + rng.range(-0.03, 0.03), 0.05, 0.16 + rng.range(-0.03, 0.04));
      for (let i = 0; i <= steps; i++) {
        const p = pts[i];
        const side = sides[i];
        const n = norms[i];
        for (let a = 0; a <= seg; a++) {
          const ang = (a / seg) * Math.PI;
          const q = p.clone().addScaledVector(side, Math.cos(ang) * radius).addScaledVector(n, 0.04 + Math.sin(ang) * radius);
          pos.push(q.x, q.y, q.z);
          const moss = i > steps * 0.55 ? 0.35 : 0.1;
          const c = base.clone().lerp(new THREE.Color(0.16, 0.21, 0.07), moss * rng.value() * 0.5);
          col.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < steps; i++) {
        for (let a = 0; a < seg; a++) {
          const k = i * (seg + 1) + a;
          const k2 = k + seg + 1;
          idx.push(k, k + 1, k2, k + 1, k2 + 1, k2);
        }
      }
      // eave end cap (a slightly larger round tile end)
      const p0 = pts[0];
      const n0 = norms[0];
      const s0 = sides[0];
      const t0 = p0.clone().sub(pts[1]).normalize();
      const capBase = p0.clone().addScaledVector(t0, 0.01);
      const centerIdx = pos.length / 3;
      pos.push(capBase.x, capBase.y, capBase.z);
      col.push(base.r * 0.9, base.g * 0.9, base.b * 0.9);
      const capR = 0.082;
      for (let a = 0; a <= 10; a++) {
        const ang = (a / 10) * Math.PI * 2;
        const q = capBase.clone().addScaledVector(s0, Math.cos(ang) * capR).addScaledVector(n0, Math.sin(ang) * capR);
        pos.push(q.x, q.y, q.z);
        col.push(base.r * 0.8, base.g * 0.8, base.b * 0.8);
      }
      for (let a = 0; a < 10; a++) idx.push(centerIdx, centerIdx + 1 + a, centerIdx + 2 + a);

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      geos.push(g);
    };

    const nFront = 56;
    for (let i = 0; i <= nFront; i++) {
      const u = i / nFront;
      addStrip('front', u);
      addStrip('back', u);
    }
    const nSide = 20;
    for (let i = 0; i <= nSide; i++) {
      const u = i / nSide;
      addStrip('left', u);
      addStrip('right', u);
    }
    const mesh = new THREE.Mesh(merge(geos), this.tileMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildRidges() {
    const geos: THREE.BufferGeometry[] = [];
    const ridgeY = ROOF.eaveY + ROOF.rise;
    // main ridge
    geos.push(box(rl * 2 + 1.2, 0.72, 0.7, 0, ridgeY + 0.34, 0));
    // ridge tiles
    for (let x = -rl - 0.4; x <= rl + 0.4; x += 0.28) {
      const g = new THREE.CylinderGeometry(0.15, 0.15, 0.24, 10);
      g.translate(x, ridgeY + 0.76, 0);
      geos.push(g);
    }
    // ridge-end ornaments (abstract curling chiwen)
    for (const s of [-1, 1]) {
      geos.push(box(0.3, 0.7, 0.36, s * (rl + 0.5), ridgeY + 0.62, 0, 0, 0, s * -0.1));
      const tail = box(0.26, 0.58, 0.3, s * (rl + 0.68), ridgeY + 1.0, 0.02);
      tail.rotateZ(s * -0.55);
      geos.push(tail);
      const tip = new THREE.ConeGeometry(0.13, 0.45, 8);
      tip.translate(s * (rl + 0.8), ridgeY + 1.2, 0.02);
      geos.push(tip);
    }
    // hip ridges
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const a = new THREE.Vector3(sx * rl, ridgeY + 0.1, 0);
        const b = new THREE.Vector3(sx * hw, ROOF.eaveY + ROOF.cornerLift * 0.65, sz * hd);
        const dir = b.clone().sub(a);
        const len = dir.length();
        const g = new THREE.BoxGeometry(0.3, len, 0.3);
        g.translate(0, len / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
        g.translate(a.x, a.y, a.z);
        geos.push(g);
        // small ridge tiles along the hip
        for (let t = 0.06; t < 0.96; t += 0.1) {
          const p = a.clone().lerp(b, t);
          const q = new THREE.CylinderGeometry(0.13, 0.13, 0.2, 8);
          q.translate(p.x, p.y + 0.18, p.z);
          geos.push(q);
        }
      }
    }
    const merged = merge(geos);
    tint(merged, new THREE.Color(0.14, 0.15, 0.14));
    const mesh = new THREE.Mesh(merged, this.tileMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildEaves() {
    const wood = timberMaterial(1);
    const geos: THREE.BufferGeometry[] = [];
    // fascia boards
    for (const s of [-1, 1]) {
      geos.push(box(hw * 2, 0.24, 0.18, 0, ROOF.eaveY - 0.08, s * hd));
      geos.push(box(0.18, 0.24, hd * 2, s * hw, ROOF.eaveY - 0.08, 0));
    }
    // rafters under the front and back eaves
    for (let x = -hw + 0.3; x <= hw - 0.3; x += 0.34) {
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.1, 0.14, 1.7);
        g.rotateX(s * 0.22);
        g.translate(x, ROOF.eaveY - 0.3, s * (hd - 0.8));
        geos.push(g);
        // pale painted rafter end
        const cap = new THREE.BoxGeometry(0.11, 0.15, 0.06);
        cap.translate(x, ROOF.eaveY - 0.42, s * (hd + 0.04));
        geos.push(cap);
      }
    }
    // side rafters
    for (let z = -hd + 0.4; z <= hd - 0.4; z += 0.36) {
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(1.6, 0.14, 0.1);
        g.rotateZ(s * -0.22);
        g.translate(s * (hw - 0.8), ROOF.eaveY - 0.3, z);
        geos.push(g);
      }
    }
    // dark soffit above the rafters
    geos.push(box(hw * 2 - 0.6, 0.12, hd * 2 - 0.6, 0, ROOF.eaveY - 0.14, 0));
    const mesh = new THREE.Mesh(merge(geos), wood);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    // upturned corner tips, dark ceramic
    const tips: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const g = new THREE.CylinderGeometry(0.04, 0.12, 0.75, 8);
        g.rotateZ(sx * -0.7);
        g.rotateX(sz * 0.25);
        g.translate(sx * (hw - 0.1), ROOF.eaveY + 0.28, sz * (hd - 0.1));
        tips.push(g);
      }
    }
    const tipGeo = merge(tips);
    tint(tipGeo, new THREE.Color(0.15, 0.16, 0.15));
    const tipMesh = new THREE.Mesh(tipGeo, this.tileMat);
    tipMesh.castShadow = true;
    this.group.add(tipMesh);
    // make sure every geometry has a colour attribute for the tile material
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const g = o.geometry;
        if (!g.getAttribute('color') && o.material === this.tileMat) tint(g, new THREE.Color(0.16, 0.17, 0.16));
      }
    });
  }
}
