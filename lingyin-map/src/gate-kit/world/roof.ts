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
    this.buildMossPatches();
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

  /** Rows of individual half-round cover tiles with overlapping lips. */
  private buildCoverTiles() {
    const rng = new Rng('roof-tiles');
    const geos: THREE.BufferGeometry[] = [];
    const courses = 12;
    const steps = 3;
    const seg = 5;
    const baseRadius = 0.095;

    const addTile = (kind: Kind, u: number, v0: number, v1: number) => {
      const pos: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      const base = new THREE.Color().setHSL(0.12 + rng.range(-0.02, 0.02), 0.035, 0.13 + rng.range(-0.03, 0.045));
      const mossy = rng.chance(0.32);
      const pts: THREE.Vector3[] = [];
      const sides: THREE.Vector3[] = [];
      const norms: THREE.Vector3[] = [];
      for (let i = 0; i <= steps; i++) {
        const v = v0 + (v1 - v0) * (i / steps);
        const p = roofPoint(kind, u, v);
        const n = roofNormal(kind, u, v);
        const e = 0.01;
        const side = roofPoint(kind, Math.min(1, u + e), v).sub(roofPoint(kind, Math.max(0, u - e), v)).normalize();
        pts.push(p);
        sides.push(side);
        norms.push(n);
      }
      for (let i = 0; i <= steps; i++) {
        const p = pts[i];
        const side = sides[i];
        const n = norms[i];
        // flare the exposed (lower) end; shrink the hidden upper end
        const flare = i === 0 ? 1.14 : 0.98;
        const r = baseRadius * flare;
        const off = 0.035 + (i === 0 ? 0.02 : 0.0);
        for (let a = 0; a <= seg; a++) {
          const ang = (a / seg) * Math.PI;
          const q = p.clone().addScaledVector(side, Math.cos(ang) * r).addScaledVector(n, off + Math.sin(ang) * r);
          pos.push(q.x, q.y, q.z);
          const moss = i === 0 ? 0.72 : 0.14;
          const c = base.clone().lerp(new THREE.Color(0.15, 0.21, 0.055), moss * rng.value() * 1.1 + (mossy ? 0.35 : 0));
          if (i === 0) c.multiplyScalar(0.8);
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
      // exposed lower cap, slightly proud of the tile
      const p0 = pts[0];
      const n0 = norms[0];
      const s0 = sides[0];
      const capBase = p0.clone().addScaledVector(n0, 0.03);
      const centerIdx = pos.length / 3;
      pos.push(capBase.x, capBase.y, capBase.z);
      col.push(base.r * 0.7, base.g * 0.7, base.b * 0.7);
      const capR = baseRadius * 1.16;
      for (let a = 0; a <= 10; a++) {
        const ang = (a / 10) * Math.PI * 2;
        const q = capBase.clone().addScaledVector(s0, Math.cos(ang) * capR).addScaledVector(n0, Math.sin(ang) * capR);
        pos.push(q.x, q.y, q.z);
        col.push(base.r * 0.62, base.g * 0.62, base.b * 0.62);
      }
      for (let a = 0; a < 10; a++) idx.push(centerIdx, centerIdx + 1 + a, centerIdx + 2 + a);

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      geos.push(g);
    };

    const nFront = 52;
    for (let i = 0; i <= nFront; i++) {
      const u = i / nFront;
      for (let c = 0; c < courses; c++) {
        const v0 = c / courses;
        const v1 = Math.min(1, (c + 1) / courses + 0.018);
        addTile('front', u, v0, v1);
        addTile('back', u, v0, v1);
      }
    }
    const nSide = 20;
    for (let i = 0; i <= nSide; i++) {
      const u = i / nSide;
      for (let c = 0; c < courses; c++) {
        const v0 = c / courses;
        const v1 = Math.min(1, (c + 1) / courses + 0.018);
        addTile('left', u, v0, v1);
        addTile('right', u, v0, v1);
      }
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
    geos.push(box(rl * 2 + 1.2, 0.2, 0.42, 0, ridgeY + 0.2, 0));
    // ridge tiles and the vertical tile face
    for (let x = -rl - 0.4; x <= rl + 0.4; x += 0.28) {
      const g = new THREE.CylinderGeometry(0.16, 0.16, 0.22, 10);
      g.translate(x, ridgeY + 0.36, 0);
      geos.push(g);
    }
    for (let x = -rl - 0.3; x <= rl + 0.3; x += 0.34) {
      for (const sz of [-1, 1]) {
        geos.push(box(0.24, 0.18, 0.04, x, ridgeY + 0.2, sz * 0.22));
      }
    }
    // ridge-end ornaments: a low curling chiwen
    for (const s of [-1, 1]) {
      geos.push(box(0.4, 0.32, 0.46, s * (rl + 0.48), ridgeY + 0.18, 0));
      const tail = box(0.3, 0.5, 0.34, s * (rl + 0.6), ridgeY + 0.5, 0.02);
      tail.rotateZ(s * -0.8);
      geos.push(tail);
      const tip = box(0.2, 0.28, 0.28, s * (rl + 0.78), ridgeY + 0.7, 0.02);
      tip.rotateZ(s * -1.25);
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

  private buildMossPatches() {
    const rng = new Rng('roof-moss-patches');
    const geos: THREE.BufferGeometry[] = [];
    const colors: number[] = [];
    for (let i = 0; i < 120; i++) {
      const kind: Kind = (['front', 'back', 'left', 'right'] as Kind[])[i % 4];
      const u = rng.range(0.06, 0.94);
      const v = rng.chance(0.55) ? rng.range(0.03, 0.3) : rng.range(0.55, 0.96);
      const p = roofPoint(kind, u, v);
      const n = roofNormal(kind, u, v);
      const t = roofPoint(kind, Math.min(1, u + 0.01), v).sub(roofPoint(kind, Math.max(0, u - 0.01), v)).normalize();
      const b = new THREE.Vector3().crossVectors(n, t).normalize();
      const r = rng.range(0.14, 0.45);
      const npts = rng.int(6, 9);
      const idxCenter = geos.length; // not used; each patch is its own fan
      const pos: number[] = [];
      const idx: number[] = [];
      pos.push(p.x + n.x * 0.012, p.y + n.y * 0.012, p.z + n.z * 0.012);
      for (let k = 0; k <= npts; k++) {
        const a = (k / npts) * Math.PI * 2;
        const rr = r * rng.range(0.6, 1.0);
        const q = p
          .clone()
          .addScaledVector(t, Math.cos(a) * rr)
          .addScaledVector(b, Math.sin(a) * rr * rng.range(0.55, 1.0))
          .addScaledVector(n, 0.012);
        pos.push(q.x, q.y, q.z);
        if (k < npts) idx.push(0, k + 1, k + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      geos.push(g);
      const c = new THREE.Color().setHSL(0.22 + rng.range(-0.02, 0.02), 0.5, 0.09 + rng.range(0, 0.04));
      for (let k = 0; k < pos.length / 3; k++) colors.push(c.r, c.g, c.b);
      void idxCenter;
    }
    const merged = merge(geos.map((g) => {
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors.slice(0, g.getAttribute('position').count * 3), 3));
      return g;
    }));
    const mat = new THREE.MeshStandardMaterial({
      color: 0x536b38,
      roughness: 1,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildEaves() {
    const wood = timberMaterial(1);
    const geos: THREE.BufferGeometry[] = [];
    // fascia boards
    for (const s of [-1, 1]) {
      geos.push(box(hw * 2, 0.2, 0.16, 0, ROOF.eaveY - 0.26, s * hd));
      geos.push(box(0.16, 0.2, hd * 2, s * hw, ROOF.eaveY - 0.26, 0));
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
