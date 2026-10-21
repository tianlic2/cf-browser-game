import * as THREE from 'three';
import { box, cyl, merge, sparrowBrace, tint } from './geom';
import { canvasTexture } from '../core/materials';
import { goldMaterial, plasterMaterial, stoneMaterial, timberMaterial } from './materials';
import { Roof } from './roof';
import { goldMaterial as templeGoldMaterial, templePlaqueTexture } from '../../world/materials';

const PLATFORM_Y = 0.35;
const COL_TOP = 5.6;
const COL_X = [-6.0, -2.6, 2.6, 6.0];
const COL_Z = 2.0;

export class Gate {
  readonly group = new THREE.Group();
  readonly roof: Roof;
  private timber = timberMaterial(0);
  private timberDark = timberMaterial(1);
  private stone = stoneMaterial(0.15);
  private plaster = plasterMaterial();
  private gold = goldMaterial();

  constructor() {
    this.group.name = 'gate';
    this.buildPlatformAndBases();
    this.buildColumns();
    this.buildBrackets();
    this.buildWalls();
    this.buildRailings();
    this.buildApproachFence();
    this.buildPlaque();
    this.buildWings();
    this.buildContactShadow();
    this.roof = new Roof();
    this.group.add(this.roof.group);
  }

  private buildPlatformAndBases() {
    const geos: THREE.BufferGeometry[] = [];
    // The FPS courtyard is at y=0 while the playable gate floor is y=1.05.
    // Fill the plinth below the study's shallow platform so it cannot float.
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
      }
    }
    // three shallow front steps
    for (let i = 0; i < 3; i++) {
      geos.push(box(9.5, 0.12, 0.5, 0, 0.06 + i * 0.12, 4.0 + (2 - i) * 0.5));
      geos.push(box(9.5, 0.12, 0.5, 0, 0.06 + i * 0.12, -4.0 - (2 - i) * 0.5));
    }
    // Four lower, narrow treads join the raised study gate to the original
    // courtyard and the north mountain opening without an unclimbable lip.
    for (let i = 0; i < 4; i++) {
      const top = .16 * (i + 1);
      for (const side of [-1, 1])
        geos.push(box(5, .15, .5, 0, top - .68 - .075, side * (7 - i * .5)));
    }
    const m = new THREE.Mesh(merge(geos), this.stone);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
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
    g.push(box(0.55, 0.28, 0.55, 0, 0.14, 0));
    g.push(box(1.1, 0.16, 0.28, 0, 0.36, 0));
    g.push(box(0.3, 0.18, 1.05, 0, 0.36, 0.12));
    g.push(box(0.42, 0.22, 0.42, -0.42, 0.56, 0));
    g.push(box(0.42, 0.22, 0.42, 0, 0.56, 0));
    g.push(box(0.42, 0.22, 0.42, 0.42, 0.56, 0));
    g.push(box(1.45, 0.15, 0.28, 0, 0.68, 0.05));
    g.push(box(0.3, 0.16, 1.25, 0, 0.68, 0.2));
    // projecting cantilever (ang) and its end block
    g.push(box(0.22, 0.14, 0.95, 0, 0.82, 0.5, 0, 0.1));
    g.push(box(0.38, 0.2, 0.38, 0, 0.94, 1.05));
    g.push(box(0.16, 0.5, 0.16, 0, 0.55, 1.0));
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
      c.scale(0.74, 0.78, 0.74);
      if (Math.abs(x) > 6.2) c.rotateY(Math.PI / 2);
      c.translate(x, y, z);
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
        back.translate(cx, PLATFORM_Y + 0.62, z);
        walls.push(back);
        walls.push(this.panelWall(w, 4.95, cx, PLATFORM_Y + 0.62, z));
        // door frame and lower panel divisions
        const frame: THREE.BufferGeometry[] = [];
        for (const fx of [a + 0.3, (a + b) / 2, b - 0.3]) {
          frame.push(box(0.2, 4.95, 0.18, fx, PLATFORM_Y + 0.62 + 2.47, z + (z > 0 ? 0.1 : -0.1)));
        }
        for (const fy of [1.4, 2.6, 3.9]) {
          frame.push(box(w, 0.16, 0.16, cx, PLATFORM_Y + 0.62 + fy, z + (z > 0 ? 0.1 : -0.1)));
        }
        walls.push(merge(frame));
        // framed lattice over the upper half of the side-bay doors
        const lat: THREE.BufferGeometry[] = [];
        const ly = PLATFORM_Y + 0.62 + 2.6;
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
      geo.translate(x, PLATFORM_Y + 0.62, 0);
      walls.push(geo);
    }
    const m = new THREE.Mesh(merge(walls), this.timberDark);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);

    // ochre plaster side wings
    const plaster: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      plaster.push(box(6.0, 2.3, 0.34, s * 9.1, PLATFORM_Y + 1.15, -1.1));
      // stone plinth under the wall
      plaster.push(box(6.2, 0.4, 0.46, s * 9.1, PLATFORM_Y + 0.2, -1.1));
    }
    const pm = new THREE.Mesh(merge(plaster), this.plaster);
    pm.castShadow = true;
    pm.receiveShadow = true;
    this.group.add(pm);
  }

  private buildRailings() {
    const g: THREE.BufferGeometry[] = [];
    const rail = (x0: number, x1: number, z: number) => {
      const n = Math.round((x1 - x0) / 0.22);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        g.push(box(0.05, 0.85, 0.05, x, PLATFORM_Y + 0.62 + 0.43, z));
      }
      g.push(box(x1 - x0, 0.09, 0.1, (x0 + x1) / 2, PLATFORM_Y + 1.3, z));
      g.push(box(x1 - x0, 0.09, 0.1, (x0 + x1) / 2, PLATFORM_Y + 0.9, z));
      for (let i = 0; i <= 2; i++) {
        const x = x0 + ((x1 - x0) * i) / 2;
        g.push(box(0.12, 1.0, 0.12, x, PLATFORM_Y + 0.62 + 0.5, z));
      }
    };
    rail(-5.6, -2.9, 1.35);
    rail(2.9, 5.6, 1.35);
    const m = new THREE.Mesh(merge(g), this.timberDark);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
  }

  private buildApproachFence() {
    const geos: THREE.BufferGeometry[] = [];
    // North terrace edge: the old stone balustrade stops at these spans.
    // The centre [-3, 3] remains fully open to the seven stair treads.
    for (const [a,b] of [[-12,-3],[3,12]]) {
      const n = 5;
      for (let i=0;i<=n;i++) {
        const x=a+(b-a)*i/n;
        geos.push(box(.19,1.26,.19,x,-.68+.63,5.7));
        geos.push(box(.3,.1,.3,x,-.68+1.3,5.7));
      }
      for (const h of [.52,1.03])
        geos.push(box(b-a,.13,.17,(a+b)/2,-.68+h,5.7));
    }
    const fence = new THREE.Mesh(merge(geos),this.timberDark);
    fence.name='gate-terrace-timber-fence';
    fence.castShadow=true;
    fence.receiveShadow=true;
    this.group.add(fence);
  }

  private buildPlaque() {
    const group = new THREE.Group();
    // Keep the game's existing Lingyin plaque artwork on the new building.
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
    // tiled coping on the plaster walls: two shallow slopes and a small ridge
    const geos: THREE.BufferGeometry[] = [];
    const wingTile = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2f2b'), roughness: 0.94 });
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.12, 1.5), wingTile);
      slab.rotation.x = 0.22;
      slab.position.set(s * 9.1, PLATFORM_Y + 2.9, -1.1);
      slab.castShadow = true;
      slab.receiveShadow = true;
      this.group.add(slab);
      for (let i = 0; i < 4; i++) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 1.5), this.timberDark);
        r.position.set(s * 9.1 - 2.4 + i * 1.6, PLATFORM_Y + 2.7, -0.55);
        this.group.add(r);
      }
    }
    for (const s of [-1, 1]) {
      for (const zs of [-1, 1]) {
        const g = box(6.2, 0.12, 0.85, 0, 0, 0);
        g.rotateX(zs * 0.32);
        g.translate(s * 9.1, PLATFORM_Y + 3.0, -1.1 + zs * 0.38);
        geos.push(g);
      }
      geos.push(box(6.2, 0.18, 0.18, s * 9.1, PLATFORM_Y + 3.16, -1.1));
      // eave tile ends
      for (let i = 0; i < 16; i++) {
        const x = s * 9.1 - 3 + i * 0.4;
        for (const zs of [-1, 1]) {
          geos.push(box(0.1, 0.1, 0.12, x, PLATFORM_Y + 3.0, -1.1 + zs * 0.8));
        }
      }
    }
    const merged = merge(geos);
    tint(merged, new THREE.Color(0.13, 0.14, 0.13));
    const tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, vertexColors: true, envMapIntensity: 0.08 });
    const m = new THREE.Mesh(merged, tileMat);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
  }
}
