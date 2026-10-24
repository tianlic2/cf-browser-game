import * as THREE from 'three';
import { box, cyl, merge, sparrowBrace } from './geom';
import { canvasTexture } from '../core/materials';
import { goldMaterial, plasterMaterial, timberMaterial } from './materials';
import { flagstoneMaterial, graniteMaterial } from './textures';
import { Roof } from './roof';
import { batchStaticSiblings } from '../../world/static_batch';
import { projectedTempleUV } from '../../world/geom';
import { bakeSurfaceFinish } from '../../world/surface_finish';
import { goldMaterial as templeGoldMaterial, stoneMaterial as templeStoneMaterial,
  templePlaqueTexture } from '../../world/materials';

const PLATFORM_Y = 0.35;
const COL_TOP = 5.6;
const COL_X = [-6.0, -2.6, 2.6, 6.0];
const COL_Z = 2.0;

export class Gate {
  readonly group = new THREE.Group();
  readonly roof: Roof;
  private timber = timberMaterial(0);
  private timberDark = timberMaterial(1);
  private stone = graniteMaterial(0.12);
  private balustradeStone = templeStoneMaterial(0.2);
  private plaster = plasterMaterial();
  private gold = goldMaterial();

  constructor() {
    this.group.name = 'gate';
    this.buildPlatformAndBases();
    this.buildColumns();
    this.buildBrackets();
    this.buildWalls();
    this.buildRailings();
    this.buildPlaque();
    this.buildCeiling();
    this.buildWings();
    this.buildIvy();
    this.buildContactShadow();
    // The source study keeps its Canvas granite fallback. The actual game
    // uses preloaded stone scans at metre scale, including the long footing.
    if(this.stone.name==='granite-photogrammetry')this.group.traverse(object=>{
      if(!(object instanceof THREE.Mesh)||object.material!==this.stone)return;
      object.geometry=bakeSurfaceFinish(projectedTempleUV(object.geometry,1.25),'stone');
      (this.stone as THREE.MeshStandardMaterial).vertexColors=true;
    });
    this.roof = new Roof();
    this.group.add(this.roof.group);
    for (const object of this.group.children) {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) continue;
      if (object.material.name.startsWith('gate-photographic-'))
        object.geometry = projectedTempleUV(object.geometry,
          object.material.name.includes('plaster') ? 2 : .8);
    }
    batchStaticSiblings(this.group);
  }

  private buildPlatformAndBases() {
    const geos: THREE.BufferGeometry[] = [];
    // The playable courtyard sits 0.68m below the gate study's local origin.
    // Carry the updated platform down to the real floor so its edge is solid.
    geos.push(box(17.2, 0.68, 7.4, 0, -0.34, 0));
    // stone platform top (the paving module covers the approach)
    geos.push(box(17.2, 0.35, 7.4, 0, 0.175, 0));
    // moulded edge
    geos.push(box(17.6, 0.12, 7.8, 0, 0.31, 0));
    for (const x of COL_X) {
      for (const z of [-COL_Z, COL_Z]) {
        geos.push(box(0.95, 0.2, 0.95, x, PLATFORM_Y + 0.1, z));
        const drum = new THREE.CylinderGeometry(0.42, 0.47, 0.42, 16);
        drum.translate(x, PLATFORM_Y + 0.41, z);
        geos.push(drum);
        const rim = new THREE.TorusGeometry(0.43, 0.035, 6, 16);
        rim.rotateX(Math.PI / 2);
        rim.translate(x, PLATFORM_Y + 0.62, z);
        geos.push(rim);
        // carved lotus-petal ring around the drum
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const petal = box(0.16, 0.05, 0.26, 0, 0, 0);
          petal.rotateX(-0.28);
          petal.rotateY(-a);
          petal.translate(x + Math.cos(a) * 0.5, PLATFORM_Y + 0.56, z + Math.sin(a) * 0.5);
          geos.push(petal);
        }
      }
    }
    // Shallow front and rear steps meet the existing gameplay walk surface.
    for (let i = 0; i < 3; i++) {
      geos.push(box(9.5, 0.12, 0.5, 0, 0.06 + i * 0.12, 4.0 + (2 - i) * 0.5));
      geos.push(box(9.5, 0.12, 0.5, 0, 0.06 + i * 0.12, -4.0 - (2 - i) * 0.5));
    }
    for (let i = 0; i < 4; i++) {
      const top = .16 * (i + 1);
      for (const side of [-1, 1])
        geos.push(box(5, .15, .5, 0, top - .68 - .075, side * (7 - i * .5)));
    }
    const m = new THREE.Mesh(merge(geos), this.stone);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);

    // textured paving on the platform and step treads
    const topMat = flagstoneMaterial(3.4, false);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(16.7, 7.0), topMat);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, 0.356, 0);
    top.receiveShadow = true;
    this.group.add(top);
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        const step = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 0.48), topMat);
        step.rotation.x = -Math.PI / 2;
        step.position.set(0, 0.122 + i * 0.12, side * (4.0 + (2 - i) * 0.5));
        step.receiveShadow = true;
        this.group.add(step);
      }
    }
  }

  private buildColumns() {
    const geos: THREE.BufferGeometry[] = [];
    for (const x of COL_X) {
      for (const z of [-COL_Z, COL_Z]) {
        const h = COL_TOP - (PLATFORM_Y + 0.62);
        geos.push(cyl(0.23, 0.28, h, 16, x, PLATFORM_Y + 0.62 + h / 2, z));
        // iron band + gold pin near the base and top
        geos.push(cyl(0.295, 0.295, 0.06, 16, x, PLATFORM_Y + 0.85, z));
      }
    }
    // cross beams front/back (along z) at each column line
    for (const x of COL_X) {
      geos.push(box(0.26, 0.32, 4.5, x, COL_TOP - 0.12, 0));
    }
    // longitudinal architraves per bay, front and back
    for (let i = 0; i < COL_X.length - 1; i++) {
      const w = COL_X[i + 1] - COL_X[i] - 0.5;
      const cx = (COL_X[i] + COL_X[i + 1]) / 2;
      for (const z of [-COL_Z, COL_Z]) {
        geos.push(box(w, 0.42, 0.32, cx, COL_TOP - 0.22, z));
        geos.push(box(w + 0.1, 0.24, 0.36, cx, COL_TOP + 0.08, z));
      }
    }
    // upper purlins running the length of the building
    for (const z of [-1.5, 1.5]) {
      const g = cyl(0.11, 0.11, 13.4, 10, 0, 6.55, z);
      g.rotateZ(Math.PI / 2);
      geos.push(g);
    }
    for (const x of [-5.2, 5.2]) {
      const g = cyl(0.1, 0.1, 3.6, 10, x, 6.7, 0);
      g.rotateX(Math.PI / 2);
      geos.push(g);
    }
    const m = new THREE.Mesh(merge(geos), this.timber);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);

    // carved sparrow braces at each column / beam junction
    const braces: THREE.BufferGeometry[] = [];
    for (const x of COL_X) {
      for (const z of [-COL_Z, COL_Z]) {
        for (const s of [-1, 1]) {
          const g = sparrowBrace(1.55, 0.62, 0.16);
          if (s < 0) {
            g.scale(-1, 1, 1);
            g.translate(x, COL_TOP - 0.45, z + (z > 0 ? -0.15 : 0.15));
          } else {
            g.translate(x, COL_TOP - 0.45, z + (z > 0 ? -0.15 : 0.15));
          }
          braces.push(g);
        }
      }
    }
    const bm = new THREE.Mesh(merge(braces), this.timberDark);
    bm.castShadow = true;
    bm.receiveShadow = true;
    this.group.add(bm);
  }

  private bracketCluster() {
    const g: THREE.BufferGeometry[] = [];
    // bearing block and first tier of arms
    g.push(box(0.58, 0.26, 0.58, 0, 0.13, 0));
    g.push(box(1.18, 0.15, 0.3, 0, 0.34, 0));
    g.push(box(0.32, 0.15, 1.12, 0, 0.34, 0.1));
    // three sheng (small bearing blocks) on the first tier
    for (const x of [-0.46, 0, 0.46]) g.push(box(0.3, 0.2, 0.3, x, 0.5, 0));
    // second tier with transverse arm
    g.push(box(1.5, 0.14, 0.27, 0, 0.64, 0.05));
    g.push(box(0.29, 0.14, 1.3, 0, 0.64, 0.16));
    for (const x of [-0.62, 0, 0.62]) g.push(box(0.26, 0.18, 0.26, x, 0.8, 0.08));
    // third, shorter tier
    g.push(box(1.0, 0.12, 0.24, 0, 0.92, 0.16));
    // projecting ang (cantilever) with a slight downward tilt
    g.push(box(0.2, 0.15, 1.05, 0, 0.84, 0.55, 0, 0.12));
    g.push(box(0.44, 0.2, 0.42, 0, 0.98, 1.12));
    // paired diagonal braces under the cantilever
    for (const sx of [-1, 1]) {
      g.push(box(0.09, 0.5, 0.13, sx * 0.18, 0.62, 0.52, 0, sx * 0.55, sx * 0.16));
    }
    // hanging pendant under the end block
    g.push(box(0.12, 0.34, 0.12, 0, 0.78, 1.13));
    return merge(g);
  }

  private buildBrackets() {
    const clusters: THREE.BufferGeometry[] = [];
    const base = this.bracketCluster();
    const puts: [number, number, number][] = [];
    // front / back eaves
    for (let x = -6.6; x <= 6.6; x += 0.68) {
      puts.push([x, 6.05, COL_Z - 0.15]);
      puts.push([x, 6.05, -COL_Z + 0.15]);
    }
    // sides
    for (let z = -1.35; z <= 1.35; z += 0.78) {
      puts.push([-6.35, 6.05, z]);
      puts.push([6.35, 6.05, z]);
    }
    for (const [x, y, z] of puts) {
      const c = base.clone();
      c.scale(0.7, 0.76, 0.7);
      if (Math.abs(x) > 6.2) c.rotateY(Math.PI / 2);
      c.translate(x, y, z);
      clusters.push(c);
    }
    // upper tier, offset half a bay, to give the eave its layered depth
    for (const [x, y, z] of puts) {
      if ((Math.round(x / 0.68) & 1) === 0) continue;
      const c = base.clone();
      c.scale(0.5, 0.55, 0.5);
      if (Math.abs(x) > 6.2) c.rotateY(Math.PI / 2);
      c.translate(x + (Math.abs(x) > 6.2 ? 0 : 0.34), y + 0.5, z - 0.05);
      clusters.push(c);
    }
    // outer eave row: smaller clusters closer to the tile edge, adding depth
    for (const [x, y, z] of puts) {
      const c = base.clone();
      c.scale(0.48, 0.52, 0.48);
      if (Math.abs(x) > 6.2) c.rotateY(Math.PI / 2);
      c.translate(x, y - 0.04, z + (z > 0 ? 0.42 : -0.42));
      clusters.push(c);
    }
    // corner clusters turned 45 degrees
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const c = base.clone();
        c.rotateY(sx * sz * Math.PI / 4);
        c.translate(sx * 6.55, 6.1, sz * 1.55);
        clusters.push(c);
      }
    }
    const m = new THREE.Mesh(merge(clusters), this.timberDark);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    // small gilded accents on the bracket ends
    const accents: THREE.BufferGeometry[] = [];
    for (const [x, y, z] of puts) {
      accents.push(box(0.12, 0.1, 0.12, x, y + 0.98, z + (z > 0 ? 1.05 : -1.05)));
    }
    const am = new THREE.Mesh(merge(accents), this.gold);
    am.castShadow = false;
    this.group.add(am);

  }

  private panelWall(w: number, h: number, x: number, y: number, z: number) {
    const g: THREE.BufferGeometry[] = [];
    const n = Math.max(6, Math.round(w / 0.34));
    for (let i = 0; i <= n; i++) {
      const px = -w / 2 + (w * i) / n;
      g.push(box(0.26, h, 0.12, px, h / 2, 0));
    }
    g.push(box(w, 0.22, 0.18, 0, h * 0.18, 0.02));
    g.push(box(w, 0.26, 0.2, 0, h * 0.72, 0.02));
    g.push(box(w, 0.24, 0.2, 0, h - 0.12, 0.02));
    const geo = merge(g);
    geo.translate(x, y, z);
    return geo;
  }

  private buildWalls() {
    const walls: THREE.BufferGeometry[] = [];
    // side bays: solid dark timber panel walls front and back, leaving the centre open
    const bays: [number, number][] = [
      [-6.0, -2.6],
      [2.6, 6.0],
    ];
    for (const [a, b] of bays) {
      const w = b - a - 0.55;
      const cx = (a + b) / 2;
      for (const z of [-COL_Z, COL_Z]) {
        const back = box(w, 4.95, 0.08, 0, 2.47, -0.09);
        back.translate(cx, PLATFORM_Y + 0.02, z);
        walls.push(back);
        walls.push(this.panelWall(w, 4.95, cx, PLATFORM_Y + 0.02, z));
        // door frame and lower panel divisions
        const frame: THREE.BufferGeometry[] = [];
        for (const fx of [a + 0.3, (a + b) / 2, b - 0.3]) {
          frame.push(box(0.2, 4.95, 0.18, fx, PLATFORM_Y + 0.02 + 2.47, z + (z > 0 ? 0.1 : -0.1)));
        }
        for (const fy of [1.4, 2.6, 3.9]) {
          frame.push(box(w, 0.16, 0.16, cx, PLATFORM_Y + 0.02 + fy, z + (z > 0 ? 0.1 : -0.1)));
        }
        walls.push(merge(frame));
        // framed lattice over the upper half of the side-bay doors
        const lat: THREE.BufferGeometry[] = [];
        const ly = PLATFORM_Y + 0.02 + 2.6;
        const lh = 2.0;
        for (let k = 0; k <= Math.round(w / 0.22); k++) {
          lat.push(box(0.05, lh, 0.07, cx - w / 2 + (w * k) / Math.round(w / 0.22), ly + lh / 2, z + (z > 0 ? 0.12 : -0.12)));
        }
        for (let k = 0; k <= 5; k++) {
          lat.push(box(w, 0.05, 0.07, cx, ly + (lh * k) / 5, z + (z > 0 ? 0.12 : -0.12)));
        }
        walls.push(merge(lat));
      }
    }
    // side walls (x = ±6) closing the side bays
    for (const x of [-6.0, 6.0]) {
      const g: THREE.BufferGeometry[] = [];
      for (let i = 0; i <= 12; i++) {
        const z = -1.9 + (3.8 * i) / 12;
        g.push(box(0.12, 4.95, 0.28, 0, 2.47, z));
      }
      const geo = merge(g);
      geo.translate(x, PLATFORM_Y + 0.02, 0);
      walls.push(geo);
    }
    const m = new THREE.Mesh(merge(walls), this.timberDark);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);

    // iron studs and ring handles on the side-bay doors
    const studs: THREE.BufferGeometry[] = [];
    for (const [a, b] of bays) {
      const cx = (a + b) / 2;
      for (const z of [-COL_Z, COL_Z]) {
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 3; col++) {
            const x = cx - 0.9 + col * 0.9;
            const y = PLATFORM_Y + 0.9 + row * 0.85;
            const g = new THREE.SphereGeometry(0.045, 7, 5);
            g.scale(1, 1, 0.5);
            g.translate(x, y, z + (z > 0 ? 0.19 : -0.19));
            studs.push(g);
          }
        }
        const ring = new THREE.TorusGeometry(0.13, 0.022, 6, 12);
        ring.translate(cx, PLATFORM_Y + 1.4, z + (z > 0 ? 0.2 : -0.2));
        studs.push(ring);
      }
    }
    const sm = new THREE.Mesh(merge(studs), this.gold);
    sm.castShadow = false;
    this.group.add(sm);

    // ochre plaster side wings
    const plaster: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      plaster.push(box(6.4, 2.3, 0.34, s * 8.95, PLATFORM_Y + 1.15, -1.1));
      // stone plinth under the wall
      plaster.push(box(6.6, 0.4, 0.46, s * 8.95, PLATFORM_Y + 0.2, -1.1));
    }
    const pm = new THREE.Mesh(merge(plaster), this.plaster);
    pm.castShadow = true;
    pm.receiveShadow = true;
    this.group.add(pm);
  }

  private buildRailings() {
    const g: THREE.BufferGeometry[] = [];
    // Use the same stone post/cap/beam language as the temple terrace. The
    // former dense timber pickets sat only a few metres from that balustrade
    // and made the entrance read as two unrelated architectural kits.
    const rail = (x0: number, x1: number, z: number) => {
      const len = Math.abs(x1 - x0);
      const n = Math.max(2, Math.round(len / 2.4));
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        g.push(box(0.24, 0.95, 0.24, x, PLATFORM_Y + 0.475, z));
        g.push(box(0.34, 0.12, 0.34, x, PLATFORM_Y + 0.98, z));
        if (i < n) {
          const nextX = x0 + ((x1 - x0) * (i + 0.5)) / n;
          g.push(box(len / n, 0.16, 0.14, nextX, PLATFORM_Y + 0.74, z));
        }
      }
    };
    rail(-5.6, -2.9, 1.35);
    rail(2.9, 5.6, 1.35);
    const m = new THREE.Mesh(merge(g), this.balustradeStone);
    m.name = 'gate-stone-balustrades';
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
  }

  private buildCeiling() {
    const geos: THREE.BufferGeometry[] = [];
    // exposed ceiling rafters across the open central bay
    for (let x = -6.2; x <= 6.2; x += 0.5) {
      geos.push(box(0.11, 0.14, 4.2, x, 5.62, 0, 0, 0.06));
    }
    // two longitudinal purlins and a central ridge beam
    for (const z of [-1.2, 0, 1.2]) {
      const g = cyl(0.09, 0.09, 12.8, 8, 0, 5.72, z);
      g.rotateZ(Math.PI / 2);
      geos.push(g);
    }
    // carved beam ends peeking below the eave
    for (const x of [-6.1, -2.65, 2.65, 6.1]) {
      for (const z of [-1.95, 1.95]) {
        geos.push(box(0.26, 0.3, 0.35, x, 5.62, z));
      }
    }
    const m = new THREE.Mesh(merge(geos), this.timber);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
  }

  private buildPlaque() {
    const group = new THREE.Group();
    // Keep the game's existing Lingyin sign artwork and dimensions.
    const tex = templePlaqueTexture('gate');
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 1.45, 0.16), templeGoldMaterial(),
    );
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1.2),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86, metalness: 0.02, side: THREE.DoubleSide }),
    );
    face.position.z = 0.09;
    group.add(board, face);
    // hanging rods and pendants
    const rods: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      rods.push(box(0.06, 1.0, 0.06, sx * 1.2, 0.95, 0));
      rods.push(box(0.16, 0.06, 0.16, sx * 1.2, 1.46, 0));
    }
    const rm = new THREE.Mesh(merge(rods), this.gold);
    group.add(rm);
    group.position.set(0, 4.5, COL_Z + 0.24);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.group.add(group);
  }

  private buildIvy() {
    const tex = canvasTexture(256, 256, (ctx) => {
      ctx.clearRect(0, 0, 256, 256);
      let a = 98765;
      const rnd = () => {
        a = (a * 1664525 + 1013904223) >>> 0;
        return a / 4294967296;
      };
      for (let i = 0; i < 14; i++) {
        const x = 26 + rnd() * 204;
        const y = 26 + rnd() * 204;
        const r = 12 + rnd() * 20;
        const ang = rnd() * Math.PI * 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        const g = ctx.createLinearGradient(-r, 0, r, 0);
        g.addColorStop(0, '#263a18');
        g.addColorStop(0.5, '#557034');
        g.addColorStop(1, '#2c421c');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(24,36,14,0.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.stroke();
        ctx.restore();
      }
    });
    tex.anisotropy = 4;
    const leafMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95, envMapIntensity: 0.05 });
    const stemMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a341a'), roughness: 1 });
    const leaves: THREE.BufferGeometry[] = [];
    const stems: THREE.BufferGeometry[] = [];
    let a = 24680;
    const rnd = () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
    for (const s of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const x = s * 8.95 - 2.65 + i * 0.75 + rnd() * 0.2;
        const top = PLATFORM_Y + 2.52;
        const len = 0.5 + rnd() * 1.2;
        const stem = new THREE.CylinderGeometry(0.012, 0.016, len, 5);
        stem.rotateZ((rnd() - 0.5) * 0.15);
        stem.translate(x, top - len / 2, -0.885);
        stems.push(stem);
        for (let k = 0; k < 4; k++) {
          const y = top - len * (0.18 + k * 0.24);
          const g = new THREE.PlaneGeometry(0.28 + rnd() * 0.26, 0.2 + rnd() * 0.2);
          g.rotateZ(rnd() * Math.PI * 2);
          g.translate(x + (rnd() - 0.5) * 0.2, y, -0.875);
          leaves.push(g);
        }
      }
    }
    const stemMesh = new THREE.Mesh(merge(stems), stemMat);
    stemMesh.castShadow = false;
    this.group.add(stemMesh);
    const leafMesh = new THREE.Mesh(merge(leaves), leafMat);
    leafMesh.castShadow = false;
    this.group.add(leafMesh);
  }

  private buildContactShadow() {
    const tex = canvasTexture(512, 256, (ctx) => {
      const g = ctx.createRadialGradient(256, 128, 10, 256, 128, 250);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 256);
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(15, 7), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, PLATFORM_Y + 0.012, 0.4);
    this.group.add(m);
  }

  private buildWings() {
    // low ochre walls with a small tiled cap and a dark service door
    const tileMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2c322d'), roughness: 0.95, metalness: 0 });
    const doorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#241812'), roughness: 0.95 });
    const wallTop=PLATFORM_Y+2.3;
    for (const s of [-1, 1]) {
      const cx = s * 8.95;
      // The old roof sat roughly half a metre above the plaster wall. Anchor
      // every roof component to the actual wall top so the eave reads as one
      // supported assembly before this module is reused around the forecourt.
      const headPlate = new THREE.Mesh(new THREE.BoxGeometry(6.58, 0.18, 0.5), this.timberDark);
      headPlate.position.set(cx, wallTop + 0.015, -1.1);
      headPlate.castShadow = true;
      headPlate.receiveShadow = true;
      headPlate.name = 'gate-wing-roof-bearing';
      this.group.add(headPlate);
      for (const zs of [-1, 1]) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.1, 0.95), tileMat);
        slab.rotation.x = zs * 0.34;
        slab.position.set(cx, wallTop + 0.2, -1.1 + zs * 0.38);
        slab.castShadow = true;
        slab.receiveShadow = true;
        this.group.add(slab);
      }
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.14, 0.18), tileMat);
      ridge.position.set(cx, wallTop + 0.36, -1.1);
      this.group.add(ridge);
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 0.1), this.timberDark);
      fascia.position.set(cx, wallTop + 0.06, -0.22);
      this.group.add(fascia);
      for (let i = 0; i < 15; i++) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8), tileMat);
        cap.rotation.x = Math.PI / 2;
        cap.position.set(cx - 3.2 + i * 0.44, wallTop + 0.02, -0.17);
        this.group.add(cap);
      }
      // In the standalone gate study local y=-.68 is ground. The playable map
      // raises this whole gate by .68m, so a footing that stopped at -.27 still
      // left a visible .41m void underneath. Span the complete interval from
      // real ground to the plaster-wall base and overlap both ends slightly.
      const footingBottom=-.7;
      const footingTop=PLATFORM_Y+.08;
      const footingHeight=footingTop-footingBottom;
      const footing = new THREE.Mesh(new THREE.BoxGeometry(7.0, footingHeight, 0.86), this.stone);
      footing.position.set(cx, (footingBottom+footingTop)/2, -1.1);
      footing.castShadow = true;
      footing.receiveShadow = true;
      footing.name = 'gate-wing-ground-footing';
      this.group.add(footing);
      const footingCap = new THREE.Mesh(new THREE.BoxGeometry(7.12, 0.12, 0.96), this.stone);
      footingCap.position.set(cx, PLATFORM_Y + 0.06, -1.1);
      footingCap.receiveShadow = true;
      this.group.add(footingCap);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.0, 0.07), doorMat);
      door.position.set(cx + s * 0.4, PLATFORM_Y + 1.2, -0.91);
      this.group.add(door);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.26, 2.2, 0.1), this.timberDark);
      frame.position.set(cx + s * 0.4, PLATFORM_Y + 1.3, -0.94);
      this.group.add(frame);
    }

    // After the gate is moved to the terrace edge, continue the same grounded
    // side-wing assembly across the two spans formerly occupied by low stone
    // balustrades. Coordinates stay local to the gate at world x=-2.
    const extensions=[
      {cx:-22.575,len:20.85}, // world -35.0 .. -14.15
      {cx:20.575,len:16.85},  // world  10.15 ..  27.0
    ];
    const plaster:THREE.BufferGeometry[]=[];
    const stone:THREE.BufferGeometry[]=[];
    const timber:THREE.BufferGeometry[]=[];
    const tiles:THREE.BufferGeometry[]=[];
    for(const {cx,len} of extensions) {
      plaster.push(box(len,2.3,.34,cx,PLATFORM_Y+1.15,-1.1));
      const footingBottom=-.7,footingTop=PLATFORM_Y+.08;
      stone.push(box(len+.2,footingTop-footingBottom,.86,cx,
        (footingBottom+footingTop)/2,-1.1));
      stone.push(box(len+.32,.12,.96,cx,PLATFORM_Y+.06,-1.1));
      timber.push(box(len+.18,.18,.5,cx,wallTop+.015,-1.1));
      timber.push(box(len+.4,.16,.1,cx,wallTop+.06,-.22));
      const bays=Math.max(2,Math.ceil(len/6.4));
      for(let i=0;i<=bays;i++) {
        const x=cx-len/2+len*i/bays;
        timber.push(box(.34,2.38,.4,x,PLATFORM_Y+1.19,-1.1));
      }
      for(const zs of [-1,1])
        tiles.push(box(len+.4,.1,.95,cx,wallTop+.2,-1.1+zs*.38,0,zs*.34));
      tiles.push(box(len+.4,.14,.18,cx,wallTop+.36,-1.1));
      const caps=Math.max(2,Math.floor(len/.44));
      for(let i=0;i<=caps;i++) {
        const cap=new THREE.CylinderGeometry(.055,.055,.06,8);
        cap.rotateX(Math.PI/2);
        cap.translate(cx-len/2+len*i/caps,wallTop+.02,-.17);
        tiles.push(cap);
      }
    }
    const add=(geos:THREE.BufferGeometry[],material:THREE.Material,name:string)=>{
      const mesh=new THREE.Mesh(merge(geos),material);
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name;
      this.group.add(mesh);
    };
    add(plaster,this.plaster,'gate-wing-terrace-extension-plaster');
    add(stone,this.stone,'gate-wing-terrace-extension-footing');
    add(timber,this.timberDark,'gate-wing-terrace-extension-timber');
    add(tiles,tileMat,'gate-wing-terrace-extension-roof');
  }
}
