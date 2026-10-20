import * as THREE from 'three';
import { archWallGeometry, box, cyl, merge, projectedTempleUV, textTexture } from './geom';
import { Rng } from '../core/math';
import { heightAt, WATER_POND, WORLD } from './heightfield';
import { bronzeMaterial, courtyardPavingMaterial, goldMaterial, roofMaterial, stoneMaterial, woodMaterial, weatheredFloorMaterial, tintFloorSlab } from './materials';

export class Details {
  readonly group = new THREE.Group();
  readonly smokeOrigin = new THREE.Vector3(-2, 7.4, 22);
  readonly lanterns: THREE.Vector3[] = [];

  constructor() {
    this.group.name = 'details';
    this.bridge();
    this.lanternsAlongPath();
    this.censer();
    this.lions();
    this.stele();
    this.pavilion();
    this.streamRailing();
    this.prayerRibbons();
    this.paving();
    this.puddles();
  }

  private paving() {
    // The old court was hundreds of raised rectangular boxes with dark gaps.
    // A continuous scan keeps the walking surface level while the albedo and
    // normal maps carry the real joints, chips and age of the stone.
    const court = new THREE.Mesh(new THREE.PlaneGeometry(48, 32), courtyardPavingMaterial());
    court.rotation.x = -Math.PI / 2;
    court.position.set(-2, WORLD.platform.y + .025, 18);
    court.receiveShadow = true;
    court.name = 'courtyard-photographic-paving';
    this.group.add(court);

    const stone = weatheredFloorMaterial();
    const geos: THREE.BufferGeometry[] = [];
    const rng = new Rng('paving');
    // processional path from the gate to the bridge
    for (let z = 46; z < 58; z += 1.3) {
      for (let x = -4; x < 4; x += 1.9) {
        geos.push(tintFloorSlab(box(1.7, 0.09, 1.15, x, heightAt(x, z) + 0.02, z),.81+rng.range(0,.23)));
      }
    }
    const m = new THREE.Mesh(merge(geos), stone);
    m.receiveShadow = true;
    this.group.add(m);
  }

  private puddles() {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#333d33'),
      roughness: 0.32,
      metalness: 0.0,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
    });
    const rng = new Rng('puddles');
    for (let i = 0; i < 6; i++) {
      const x = rng.range(-18, 16);
      const z = rng.range(8, 30);
      const r = rng.range(0.9, 2.25);
      const shape = new THREE.Shape();
      for(let j=0;j<=28;j++){
        const a=j/28*Math.PI*2;
        const irregular=.82+.13*Math.sin(a*3+i*2.4)+.08*Math.sin(a*7-i*.8);
        const px=Math.cos(a)*r*irregular;
        const py=Math.sin(a)*r*irregular;
        if(j===0)shape.moveTo(px,py);else shape.lineTo(px,py);
      }
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2);
      g.scale(1, 1, rng.range(0.45, 0.8));
      g.translate(x, WORLD.platform.y + 0.035, z);
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  private bridge() {
    const stone = stoneMaterial(0.35);
    const geos: THREE.BufferGeometry[] = [];
    const wall = archWallGeometry(13.4, 3.3, 0.45, 3.15, 1.05);
    for (const z of [26.1, 29.9]) geos.push(wall.clone().translate(36, 0.45, z));
    geos.push(box(13.6, 0.34, 4.6, 36, 3.66, 28));
    geos.push(box(13.9, 0.18, 4.9, 36, 3.86, 28));
    // parapets
    for (const zs of [-1, 1]) {
      for (let i = 0; i <= 12; i++) {
        const x = 29.5 + i * 1.1;
        geos.push(box(0.2, 1.0, 0.2, x, 4.45, 28 + zs * 2.05));
        if (i < 12) geos.push(box(1.1, 0.15, 0.16, x + 0.55, 4.88, 28 + zs * 2.05));
      }
      geos.push(box(13.4, 0.18, 0.26, 36, 4.95, 28 + zs * 2.05));
    }
    // end steps
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) geos.push(box(1.2, 0.18, 4.2, 36 + s * (7.0 + i * 0.5), 3.4 - i * 0.18, 28));
    }
    const mesh = new THREE.Mesh(projectedTempleUV(merge(geos), 1.4), stone);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private lanternsAlongPath() {
    const stone = stoneMaterial(0.5);
    const geos: THREE.BufferGeometry[] = [];
    const positions: [number, number][] = [
      [-7.5, 44],
      [3.5, 44],
      [-10, 34],
      [6, 34],
      [5, 10],
      [-10, 10],
      [25, 33],
      [29, 52],
    ];
    for (const [x, z] of positions) {
      const y = heightAt(x, z);
      geos.push(box(0.75, 0.22, 0.75, x, y + 0.11, z));
      geos.push(cyl(0.16, 0.2, 1.15, 8, x, y + 0.78, z));
      geos.push(box(0.55, 0.55, 0.55, x, y + 1.62, z));
      geos.push(new THREE.ConeGeometry(0.62, 0.42, 6).translate(x, y + 2.1, z));
      geos.push(new THREE.SphereGeometry(0.09, 6, 4).translate(x, y + 2.38, z));
      this.lanterns.push(new THREE.Vector3(x, y + 1.62, z));
    }
    const mesh = new THREE.Mesh(projectedTempleUV(merge(geos), 1.4), stone);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // warm paper glow inside each lantern
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a1a0d, emissive: new THREE.Color('#ffb45a'), emissiveIntensity: 0.9 }),
    );
    for (const p of this.lanterns) {
      const g = glow.clone();
      g.position.copy(p);
      this.group.add(g);
    }
    // a few real warm lights: enough to pool on the stone at dawn, cheap to render
    for (let i = 0; i < Math.min(3, this.lanterns.length); i++) {
      const l = new THREE.PointLight(0xffb066, 7, 9, 2);
      l.position.copy(this.lanterns[i]).add(new THREE.Vector3(0, 0.05, 0));
      this.group.add(l);
    }
    const censerLight = new THREE.PointLight(0xff8a3c, 9, 8, 2);
    censerLight.position.set(-2, WORLD.platform.y + 4.3, 22);
    this.group.add(censerLight);
  }

  private censer() {
    const bronze = bronzeMaterial();
    const geos: THREE.BufferGeometry[] = [];
    const x = -2;
    const z = 22;
    const y = WORLD.platform.y;
    // Three separate feet leave a real passage below the bowl. A continuous
    // disk here would visibly close the space that the collision now opens.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const lower = new THREE.Vector3(Math.cos(a) * 1.9, .19, Math.sin(a) * 1.9);
      const upper = new THREE.Vector3(Math.cos(a) * 1.55, 1.96, Math.sin(a) * 1.55);
      geos.push(cyl(.23, .29, .18, 10, lower.x, .105, lower.z));
      const axis = upper.clone().sub(lower);
      const leg = new THREE.CylinderGeometry(.13, .18, axis.length(), 10);
      leg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), axis.normalize()));
      leg.translate((lower.x + upper.x) / 2, (lower.y + upper.y) / 2,
        (lower.z + upper.z) / 2);
      geos.push(leg);
    }
    geos.push(cyl(1.55, 1.4, .16, 20, 0, 1.91, 0));
    // bowl profile
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector2(1.18 + Math.sin(t * Math.PI) * .25 + .1 * t, t * 1.15));
    }
    const bowl = new THREE.LatheGeometry(pts, 24);
    bowl.translate(0, 1.9, 0);
    geos.push(bowl);
    geos.push(new THREE.TorusGeometry(1.28, 0.09, 8, 28).rotateX(Math.PI / 2).translate(0, 3.05, 0));
    for (const s of [-1, 1]) {
      const h = new THREE.TorusGeometry(0.38, 0.07, 8, 16, Math.PI * 1.2);
      h.rotateY(Math.PI / 2);
      h.translate(s * 1.35, 2.6, 0);
      geos.push(h);
    }
    // pierced lid + small finial
    geos.push(cyl(1.1, 1.25, 0.22, 20, 0, 3.17, 0));
    geos.push(new THREE.SphereGeometry(0.22, 10, 8).translate(0, 3.5, 0));
    geos.push(new THREE.ConeGeometry(0.2, 0.55, 8).translate(0, 3.8, 0));
    const m = new THREE.Mesh(merge(geos), bronze);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    this.smokeOrigin.set(x, y + 4.15, z);
  }

  private lions() {
    const stone = stoneMaterial(0.55);
    const geos: THREE.BufferGeometry[] = [];
    for (const x of [-10.5, 6.5]) {
      const z = 41.5;
      const y = heightAt(x, z);
      geos.push(box(1.4, 0.5, 1.8, x, y + 0.25, z));
      geos.push(new THREE.SphereGeometry(0.55, 12, 10).scale(1, 1.15, 1.25).translate(x, y + 1.1, z));
      geos.push(new THREE.SphereGeometry(0.42, 12, 10).translate(x, y + 1.75, z + 0.45));
      for (const s of [-1, 1]) {
        geos.push(new THREE.SphereGeometry(0.28, 8, 6).translate(x + s * 0.38, y + 2.0, z + 0.4));
        geos.push(new THREE.CylinderGeometry(0.12, 0.15, 0.8, 6).translate(x + s * 0.35, y + 0.65, z + 0.5));
      }
      geos.push(new THREE.CylinderGeometry(0.1, 0.16, 0.9, 6).translate(x, y + 0.9, z + 1.05));
    }
    const m = new THREE.Mesh(projectedTempleUV(merge(geos), 1.4), stone);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
  }

  private stele() {
    const stone = stoneMaterial(0.7);
    const tex = textTexture('冷泉', 256, 512, { bg: '#5b5b52', fg: '#2c2a24' });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.1), stone);
    base.position.y = 0.2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.22), mat);
    slab.position.set(0, 1.55, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.4), stone);
    cap.position.y = 2.82;
    g.add(base, slab, cap);
    g.position.set(7.5, heightAt(7.5, 33), 33);
    g.rotation.y = -0.35;
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.group.add(g);
  }

  private pavilion() {
    const wood = woodMaterial(false);
    const roof = roofMaterial();
    const stone = stoneMaterial(0.4);
    const group = new THREE.Group();
    const cx = 29;
    const cz = 51;
    const baseY = Math.max(heightAt(cx, cz), WATER_POND) + 0.15;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.1, 0.5, 6), stone);
    base.position.y = 0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 3.1, 8), wood);
      c.position.set(Math.cos(a) * 3.1, 2.05, Math.sin(a) * 3.1);
      c.castShadow = true;
      group.add(c);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 8), goldMaterial());
      ring.position.set(Math.cos(a) * 3.1, 3.5, Math.sin(a) * 3.1);
      group.add(ring);
    }
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 4.6, 1.7, 6), roof);
    cone.position.y = 4.4;
    cone.castShadow = true;
    group.add(cone);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 8), goldMaterial());
    tip.position.y = 5.55;
    group.add(tip);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.09, 0.7, 5), roof);
      t.position.set(Math.cos(a) * 4.5, 4.95, Math.sin(a) * 4.5);
      t.rotation.z = 0.9;
      t.rotation.y = -a;
      group.add(t);
    }
    group.position.set(cx, baseY, cz);
    this.group.add(group);
  }

  private streamRailing() {
    const stone = stoneMaterial(0.4);
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 14; i++) {
      const z = 34 + i * 1.6;
      const x = 31.6 - i * 0.06;
      const y = heightAt(x, z);
      geos.push(box(0.18, 1.0, 0.18, x, y + 0.5, z));
      if (i < 13) geos.push(box(0.14, 0.14, 1.6, x - 0.03, y + 0.9, z + 0.8));
    }
    const m = new THREE.Mesh(projectedTempleUV(merge(geos), 1.4), stone);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
  }

  private prayerRibbons() {
    const wood = woodMaterial(true);
    const group = new THREE.Group();
    const x0 = -12;
    const z0 = 37;
    const x1 = 8;
    const z1 = 37;
    for (const [x, z] of [
      [x0, z0],
      [x1, z1],
    ] as const) {
      const y = heightAt(x, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), wood);
      post.position.set(x, y + 2.1, z);
      group.add(post);
    }
    const lineY = heightAt(0, 37) + 3.9;
    const ribbonMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8e2f24'), roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 22; i++) {
      const t = (i + 0.5) / 22;
      const x = x0 + (x1 - x0) * t;
      const w = 0.16 + Math.random() * 0.05;
      const h = 0.55 + Math.random() * 0.35;
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ribbonMat);
      r.position.set(x, lineY - 0.5 - h / 2, 37 + (Math.random() - 0.5) * 0.05);
      r.rotation.y = (Math.random() - 0.5) * 0.3;
      group.add(r);
    }
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, x1 - x0, 4).rotateZ(Math.PI / 2), wood);
    line.position.set((x0 + x1) / 2, lineY, 37);
    group.add(line);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry.type === 'PlaneGeometry') o.castShadow = true;
    });
    this.group.add(group);
  }
}
