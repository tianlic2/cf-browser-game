import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm2 } from '../core/math';
import { heightAt } from './heightfield';
import { goldMaterial, rockMaterial, stoneMaterial } from './materials';

type RockSpec = { x: number; z: number; rx: number; ry: number; rz: number; seed: number; rot: number };

const ROCKS: RockSpec[] = [
  { x: 84, z: -24, rx: 13, ry: 21, rz: 12, seed: 2.1, rot: 0.4 },
  { x: 98, z: -40, rx: 10, ry: 17, rz: 10, seed: 5.7, rot: 1.2 },
  { x: 66, z: -50, rx: 9, ry: 15, rz: 8, seed: 8.3, rot: -0.6 },
  { x: 106, z: -8, rx: 12, ry: 21, rz: 11, seed: 3.4, rot: 2.0 },
  { x: 86, z: 6, rx: 7.5, ry: 11, rz: 7, seed: 9.1, rot: 1.7 },
  { x: 62, z: -34, rx: 5.5, ry: 8, rz: 5, seed: 4.2, rot: 0.1 },
];

function rockGeometry(s: RockSpec) {
  const geo = new THREE.SphereGeometry(1, 52, 36);
  const p = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const dir = v.clone().normalize();
    const ang = Math.atan2(dir.z, dir.x);
    const n1 = fbm2(dir.x * 3.1 + s.seed, dir.y * 2.3 + dir.z * 1.7 - s.seed, 4);
    const n2 = fbm2(dir.x * 9.0 - s.seed, dir.y * 7.0 + dir.z * 8.0 + s.seed, 3);
    // karst flutes run vertically, strongest on the flanks
    const flute = Math.sin(ang * 13 + n1 * 7.0) * 0.045 + Math.sin(ang * 29 + n2 * 3.0) * 0.018;
    const lateral = 1 - Math.abs(dir.y) * 0.35;
    const bulge = 1 + n1 * 0.16 + n2 * 0.055 + flute * lateral;
    // flatten the top a little so pines can stand on it
    const top = Math.max(0, dir.y);
    const x = v.x * s.rx * bulge;
    const y = (v.y * s.ry * (1 - top * 0.08) + top * top * 1.2) * (1 + n2 * 0.04);
    const z = v.z * s.rz * bulge;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  geo.rotateY(s.rot);
  geo.translate(s.x, heightAt(s.x, s.z) - 1.8, s.z);
  return geo;
}

/** Feilai Feng: a cluster of flute-weathered limestone crags with Buddhist niches. */
export class Crag {
  readonly group = new THREE.Group();
  readonly buddhaMaterial = goldMaterial();

  constructor() {
    this.group.name = 'feilaifeng';
    const geos = ROCKS.map(rockGeometry);
    const merged = mergeGeometries(geos, false);
    if (!merged) throw new Error('crag merge failed');
    const rock = new THREE.Mesh(merged, rockMaterial());
    rock.name = 'crag-rock';
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.group.add(rock);

    this.buildNiches();
  }

  private buildNiches() {
    const stone = stoneMaterial(0.4);
    const gold = this.buddhaMaterial;
    const baseY = heightAt(47, 3);

    // a dressed cliff face angled toward the temple
    const face = new THREE.Group();
    face.position.set(47, baseY, 3);
    face.rotation.y = -0.9;
    this.group.add(face);

    const addStone = (g: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(g, stone);
      m.castShadow = true;
      m.receiveShadow = true;
      face.add(m);
      return m;
    };
    // framing slab + recess
    addStone(new THREE.BoxGeometry(11, 9.5, 1.6).translate(0, 4.75, 0));
    const recess = new THREE.Mesh(new THREE.BoxGeometry(4.6, 5.6, 1.9), new THREE.MeshStandardMaterial({ color: 0x0e0d0b, roughness: 1 }));
    recess.position.set(0, 3.4, 0.55);
    face.add(recess);
    addStone(new THREE.BoxGeometry(5.6, 0.45, 2.6).translate(0, 6.35, 0.5));
    addStone(new THREE.BoxGeometry(0.55, 5.5, 2.4).translate(-2.65, 3.35, 0.5));
    addStone(new THREE.BoxGeometry(0.55, 5.5, 2.4).translate(2.65, 3.35, 0.5));

    // seated Buddha
    const buddha = new THREE.Group();
    buddha.position.set(0, 0.55, 1.25);
    buddha.scale.setScalar(0.92);
    const bm = (g: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(g, gold);
      m.castShadow = true;
      buddha.add(m);
      return m;
    };
    bm(new THREE.CylinderGeometry(1.35, 1.65, 0.5, 20).translate(0, 0.25, 0));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const petal = new THREE.SphereGeometry(0.4, 8, 6);
      petal.scale(1, 0.32, 0.6);
      petal.rotateY(-a);
      petal.translate(Math.cos(a) * 1.3, 0.52, Math.sin(a) * 1.3);
      bm(petal);
    }
    const legs = new THREE.SphereGeometry(1.05, 20, 14);
    legs.scale(1.32, 0.55, 0.85);
    bm(legs.translate(0, 1.0, 0));
    const torso = new THREE.SphereGeometry(1, 20, 16);
    torso.scale(0.86, 1.15, 0.62);
    bm(torso.translate(0, 2.1, 0));
    bm(new THREE.SphereGeometry(0.44, 20, 16).scale(1, 1.08, 0.95).translate(0, 3.22, 0.02));
    for (const s of [-1, 1]) {
      bm(new THREE.CylinderGeometry(0.075, 0.1, 0.42, 8).translate(s * 0.45, 3.16, 0));
      const arm = new THREE.CylinderGeometry(0.14, 0.18, 1.1, 8);
      arm.rotateZ(s * 0.95);
      bm(arm.translate(s * 0.9, 1.95, 0.2));
    }
    bm(new THREE.TorusGeometry(0.9, 0.05, 8, 32).translate(0, 3.3, -0.5));
    face.add(buddha);

    // two smaller niches on the flanks
    for (const [dx, dy, scale] of [
      [-6.8, 2.4, 0.55],
      [6.6, 1.8, 0.45],
    ] as const) {
      addStone(new THREE.BoxGeometry(3.0 * scale + 1.2, 3.6 * scale + 1.2, 1.2).translate(dx, dy + 2.4 * scale, -0.3));
      const dark = new THREE.Mesh(
        new THREE.BoxGeometry(3.0 * scale, 3.6 * scale, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x0d0c0a, roughness: 1 }),
      );
      dark.position.set(dx, dy + 2.4 * scale, 0.0);
      face.add(dark);
      const mini = new THREE.Group();
      mini.position.set(dx, dy + 0.4, 0.35);
      mini.scale.setScalar(scale);
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12).scale(0.8, 1.1, 0.6), gold);
      body.position.y = 1.9;
      mini.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), gold);
      head.position.y = 2.95;
      mini.add(head);
      face.add(mini);
    }

    // stone railing in front of the niches
    for (let i = -5; i <= 5; i++) {
      addStone(new THREE.BoxGeometry(0.16, 1.0, 0.16).translate(i * 1.1, 0.5, 2.4));
    }
    addStone(new THREE.BoxGeometry(12, 0.16, 0.2).translate(0, 0.95, 2.4));
    addStone(new THREE.BoxGeometry(12, 0.16, 0.2).translate(0, 0.55, 2.4));
  }

}
