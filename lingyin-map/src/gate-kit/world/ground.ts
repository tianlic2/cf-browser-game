import * as THREE from 'three';
import { Rng } from '../core/math';
import { box, merge, tint } from './geom';
import { flagstoneMaterial, graniteMaterial } from './textures';
import { courtyardPavingExtensionMaterial } from '../../world/materials';
import { FRONT_GATE_FORECOURT } from '../../../../scripts/lingyin_hillside_route.js';
import { projectedTempleUV } from '../../world/geom';

export class Ground {
  readonly group = new THREE.Group();
  private readonly gameMap: boolean;

  constructor(options: { gameMap?: boolean } = {}) {
    this.gameMap = !!options.gameMap;
    this.group.name = 'ground';
    // The parent map already owns terrain and its physical walk surface.
    if (!this.gameMap) this.buildBase();
    this.buildPaving();
    this.buildKerbs();
    // Photographed paving already contains wear and joints. Raised green
    // polyhedra on top read as debris and add geometry/another draw call.
    if(!this.gameMap)this.buildMoss();
    this.buildRocks();
    this.group.traverse(object=>{
      if(!(object instanceof THREE.Mesh)||Array.isArray(object.material)||
        object.material.name!=='granite-photogrammetry')return;
      object.geometry=projectedTempleUV(object.geometry,1.25);
    });
  }

  private buildBase() {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#211f17'), roughness: 1 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.06;
    plane.receiveShadow = true;
    this.group.add(plane);
  }

  private buildPaving() {
    // In the game, begin exactly outside the temple enclosure. The enclosure
    // owns its full interior paving, so the two photographed-stone sheets meet
    // at the gate without a coplanar overlap or a strip of forest material.
    const width=this.gameMap?FRONT_GATE_FORECOURT.x1-FRONT_GATE_FORECOURT.x0:64;
    const depth=this.gameMap?FRONT_GATE_FORECOURT.z1-FRONT_GATE_FORECOURT.z0:64;
    const mat=this.gameMap?courtyardPavingExtensionMaterial(width,depth):
      flagstoneMaterial(3.6,true,0,0);
    const paving = new THREE.Mesh(new THREE.PlaneGeometry(width,depth), mat);
    paving.rotation.x = -Math.PI / 2;
    paving.position.set(0, this.gameMap ? 0.025 : 0.015,
      this.gameMap ? (FRONT_GATE_FORECOURT.z0+FRONT_GATE_FORECOURT.z1)/2-40 : 8);
    paving.receiveShadow = true;
    paving.name = 'flagstone-path';
    this.group.add(paving);
  }

  private buildKerbs() {
    const rng = new Rng('kerbs');
    const stone = graniteMaterial(0.06);
    const g: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      for (let z = 5.0; z < 33; z += 2.1) {
        const len = 2.0;
        const y = 0.12 + rng.range(-0.015, 0.025);
        const kerb = box(0.34, 0.22, len, s * 3.55, y, z + len / 2);
        kerb.scale(1, 1, 0.96);
        g.push(kerb);
      }
    }
    const m = new THREE.Mesh(merge(g), stone);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'kerbstones';
    this.group.add(m);
  }

  private buildRocks() {
    const rng = new Rng('ground-rocks');
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 26; i++) {
      const side = rng.chance(0.5) ? -1 : 1;
      const x = side * rng.range(3.6, 6.8);
      const z = rng.range(5.0, 28.0);
      const r = rng.range(0.07, 0.26);
      const g = new THREE.IcosahedronGeometry(r, 0);
      g.scale(1.4, rng.range(0.45, 0.8), 1.0);
      g.rotateY(rng.range(0, Math.PI * 2));
      g.translate(x, r * 0.5, z);
      tint(g, new THREE.Color().setHSL(0.1 + rng.range(-0.02, 0.02), 0.04, 0.16 + rng.range(0, 0.1)));
      geos.push(g);
    }
    const mat = graniteMaterial(0.02);
    const m = new THREE.Mesh(merge(geos), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'path-rocks';
    this.group.add(m);
  }

  private buildMoss() {
    const rng = new Rng('moss');
    const g: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 190; i++) {
      const side = rng.chance(0.5) ? -1 : 1;
      const inPath = i < 45;
      const x = inPath ? rng.range(-3.0, 3.0) : side * rng.range(3.1, 16) * (rng.chance(0.5) ? 1 : 0.4);
      const z = rng.range(4.8, 33);
      const r = inPath ? rng.range(0.015, 0.06) : rng.range(0.1, 0.4);
      const geo = new THREE.IcosahedronGeometry(r, 0);
      geo.scale(1.6, 0.22, 1.6);
      geo.translate(x, 0.035, z);
      tint(geo, new THREE.Color().setHSL(0.23 + rng.range(-0.03, 0.03), 0.4, 0.11 + rng.range(0, 0.05)));
      g.push(geo);
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true, envMapIntensity: 0.04 });
    const m = new THREE.Mesh(merge(g), mat);
    m.receiveShadow = true;
    m.name = 'moss-clumps';
    this.group.add(m);
  }
}
