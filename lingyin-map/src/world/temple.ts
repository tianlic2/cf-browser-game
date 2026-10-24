import * as THREE from 'three';
import { box, cyl, lattice, merge, projectedTempleUV, roofGeometry, ringRoofGeometry, textTexture } from './geom';
import { WORLD } from './heightfield';
import { bronzeMaterial, dougongMaterial, goldMaterial, lanternMaterial, ricePaperTexture, roofMaterial, stoneMaterial, wallMaterial, windowMaterial, woodMaterial, weatheredFloorMaterial, tintFloorSlab, templePlaqueTexture, mainHallRoofMaterial, mainHallWallMaterial, mainHallStoneMaterial, mainHallRedWoodMaterial, mainHallPaintedBeamMaterial, mainHallWindowMaterial } from './materials';
import { plasterMaterial as gatePlasterMaterial, timberMaterial as gateTimberMaterial } from '../gate-kit/world/materials';
import { bakeSurfaceFinish, type SurfaceFinish } from './surface_finish';
import { MAIN_HALL } from '../../../scripts/lingyin_main_hall.js';
import { hallPerimeterColumns } from '../../../scripts/lingyin_columns.js';

type Role = 'stone' | 'floor' | 'wall' | 'paper' | 'gatePlaster' | 'wood' | 'woodDark' | 'dougong' | 'roof' | 'mainRoof' | 'gateRoof' | 'gold' | 'bronze' | 'lattice' | 'lantern' | 'dark' | 'window' | 'mainStone' | 'mainWall' | 'mainWood' | 'mainWoodDark' | 'mainDougong' | 'mainLattice' | 'mainWindow';

type HallSpec = {
  x: number;
  z: number;
  w: number;
  d: number;
  eave: number;
  rise: number;
  plinth: number;
  double?: boolean;
  rotY?: number;
  name?: string;
  openFront?: boolean;
  plaque?: string;
  studyFacade?: boolean;
};

export type TempleAnchors = {
  burner: THREE.Vector3;
  door: THREE.Vector3;
  eaves: THREE.Vector3[];
};

export type TempleOptions = {
  onlyMainHall?: boolean;
  omitGateVisual?: boolean;
  omitMainHallShrine?: boolean;
  studyHallEave?: number;
  studyFacade?: boolean;
  enrichedSmallHalls?: boolean;
};

export class Temple {
  readonly group = new THREE.Group();
  readonly materials: Record<Role, THREE.Material>;
  private readonly enrichedSmallHalls: boolean;
  readonly anchors: TempleAnchors = {
    burner: new THREE.Vector3(-2, 3.25, 22),
    door: new THREE.Vector3(-2, 4.4, 2),
    eaves: [],
  };
  private roles: Record<Role, THREE.BufferGeometry[]> = {
    stone: [], floor: [], wall: [], paper: [], gatePlaster: [], wood: [], woodDark: [], dougong: [], roof: [], mainRoof: [], gateRoof: [], gold: [], bronze: [], lattice: [], lantern: [], dark: [], window: [], mainStone: [], mainWall: [], mainWood: [], mainWoodDark: [], mainDougong: [], mainLattice: [], mainWindow: [],
  };

  constructor(options: TempleOptions = {}) {
    this.enrichedSmallHalls = options.enrichedSmallHalls === true;
    this.group.name = options.onlyMainHall ? 'temple-main-hall-only' : 'temple';
    const plat = WORLD.platform.y;
    this.materials = {
      stone: stoneMaterial(0.2),
      floor: weatheredFloorMaterial(),
      wall: wallMaterial(),
      paper: new THREE.MeshStandardMaterial({color:0xc5bba4,map:ricePaperTexture(),
        bumpMap:ricePaperTexture(),bumpScale:.009,roughness:.96,metalness:0,side:THREE.DoubleSide}),
      gatePlaster: gatePlasterMaterial(),
      wood: woodMaterial(false),
      woodDark: gateTimberMaterial(1),
      dougong: dougongMaterial(),
      roof: roofMaterial(),
      mainRoof: mainHallRoofMaterial(),
      gateRoof: roofMaterial(),
      gold: goldMaterial(),
      bronze: bronzeMaterial(),
      lattice: woodMaterial(true),
      lantern: lanternMaterial(),
      window: windowMaterial(),
      mainStone: mainHallStoneMaterial(),
      mainWall: mainHallWallMaterial(),
      mainWood: mainHallRedWoodMaterial(false),
      mainWoodDark: mainHallRedWoodMaterial(true),
      mainDougong: mainHallPaintedBeamMaterial(),
      mainLattice: mainHallRedWoodMaterial(true),
      mainWindow: mainHallWindowMaterial(),
      dark: new THREE.MeshStandardMaterial({ color: 0x2c322d, roughness: .95, metalness: 0 }),
    };
    (this.materials.gateRoof as THREE.MeshStandardMaterial).color.set('#aab89a');

    if (!options.onlyMainHall) {
      this.buildPlatform(plat);
      if (!options.omitGateVisual)
        this.buildHall({ x: -2, z: 40, w: 15, d: 8.5, eave: 6.6, rise: 2.9, plinth: 0.8, name: 'gate', openFront: true, plaque: '靈隱寺' });
    }
    this.buildHall({ ...MAIN_HALL, eave: options.studyHallEave ?? 8.0, rise: 5.0, double: true, plaque: '大雄寶殿', studyFacade: options.studyFacade });
    if (!options.onlyMainHall) {
      this.buildHall({ x: -25.5, z: 7, w: 9, d: 16, eave: 5.0, rise: 2.5, plinth: 0.7, rotY: Math.PI / 2, name: 'west' });
      this.buildHall({ x: 19, z: 7, w: 9, d: 16, eave: 5.0, rise: 2.5, plinth: 0.7, rotY: -Math.PI / 2, name: 'east' });
      this.buildPagoda(-31, 33, plat);
      this.buildEnclosure(plat);
    }
    if (!options.omitMainHallShrine) this.buildBuddha(plat);
    this.finalize();
  }

  private add(role: Role, geo: THREE.BufferGeometry) {
    this.roles[role].push(geo);
  }

  private addAt(role: Role, geo: THREE.BufferGeometry, x: number, y: number, z: number, rotY = 0) {
    if (rotY) geo.rotateY(rotY);
    geo.translate(x, y, z);
    this.roles[role].push(geo);
  }

  // ------------------------------------------------------------------ platform
  private buildPlatform(y: number) {
    const P = WORLD.platform;
    // low stone kerb around the terrace
    this.add('stone', box(2.2, 0.5, 1.0, P.x0, y - 0.05, 0, 0));
    this.add('stone', box(2.2, 0.5, 1.0, P.x1, y - 0.05, 0, 0));
    this.add('stone', box(P.x1 - P.x0 + 2.2, 0.5, 1.2, (P.x0 + P.x1) / 2, y - 0.05, P.z1));
    this.add('stone', box(P.x1 - P.x0 + 2.2, 0.5, 1.2, (P.x0 + P.x1) / 2, y - 0.05, P.z0));
    // south terrace steps (wide, shallow)
    const sw = 9;
    for (let i = 0; i < 6; i++) {
      this.add('stone', box(sw - i * 0.25, 0.19, 0.5, -2, y - 0.2 - i * 0.19, P.z1 + 0.6 + i * 0.48));
    }
    // east stair down to the bridge
    for (let i = 0; i < 5; i++) {
      this.add('stone', box(0.55, 0.2, 5.2, P.x1 + 0.4 + i * 0.5, y - 0.2 - i * 0.2, 28));
    }
    // The former low stone rails beside the mountain gate are deliberately
    // omitted. The relocated gate now extends its grounded ochre side wings
    // across these two spans, using one continuous architectural language.
  }

  private balustrade(a: number, b: number, c: number, y: number, axis: 'x' | 'z', _vertical = false) {
    const len = Math.abs(b - a);
    if (len < 1) return;
    const n = Math.max(2, Math.round(len / 2.4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a + (b - a) * t;
      const x = axis === 'x' ? p : c;
      const z = axis === 'x' ? c : p;
      this.add('stone', box(0.24, 0.95, 0.24, x, y + 0.475, z));
      this.add('stone', box(0.34, 0.12, 0.34, x, y + 0.98, z));
      if (i < n) {
        const t2 = (i + 0.5) / n;
        const p2 = a + (b - a) * t2;
        const x2 = axis === 'x' ? p2 : c;
        const z2 = axis === 'x' ? c : p2;
        const w = axis === 'x' ? len / n : 0.14;
        const d = axis === 'x' ? 0.14 : len / n;
        this.add('stone', box(w, 0.16, d, x2, y + 0.74, z2));
      }
    }
  }

  // ------------------------------------------------------------------ halls
  private buildHall(s: HallSpec) {
    const isGate = s.name === 'gate';
    const colH = s.eave - s.plinth;
    const hw = s.w / 2;
    const hd = s.d / 2;
    const geos: Record<Role, THREE.BufferGeometry[]> = {
      stone: [], floor: [], wall: [], paper: [], gatePlaster: [], wood: [], woodDark: [], dougong: [], roof: [], mainRoof: [], gateRoof: [], gold: [], bronze: [], lattice: [], lantern: [], dark: [], window: [], mainStone: [], mainWall: [], mainWood: [], mainWoodDark: [], mainDougong: [], mainLattice: [], mainWindow: [],
    };
    let exteriorPhase = true;
    const mainExteriorRoles: Partial<Record<Role, Role>> = {
      stone: 'mainStone', wall: 'mainWall', wood: 'mainWood', woodDark: 'mainWoodDark',
      dougong: 'mainDougong', lattice: 'mainLattice', window: 'mainWindow', roof: 'mainRoof',
    };
    const mapRole = (role: Role) => exteriorPhase && s.name === 'main'
      ? mainExteriorRoles[role] ?? role : role;
    const push = (role: Role, geo: THREE.BufferGeometry) => geos[mapRole(role)].push(geo);

    // stone plinth
    push('stone', box(s.w + 2.4, s.plinth + 0.25, s.d + 2.4, 0, (s.plinth + 0.25) / 2, 0));
    push('stone', box(s.w + 2.9, 0.16, s.d + 2.9, 0, 0.1, 0));
    for (let i = 0; i < 5; i++) {
      push('stone', box(5.0, 0.16, 0.42, 0, 0.16 + i * 0.16, hd + 1.35 + (4 - i) * 0.4 + (s.plinth - 0.8) * 0.25));
      if (s.name === 'gate')
        push('stone', box(5.0, 0.16, 0.42, 0, 0.16 + i * 0.16, -hd - 1.35 - (4 - i) * 0.4));
    }

    // columns around the perimeter
    const colHt = colH - 0.35;
    for(const column of hallPerimeterColumns(s))
      this.column(geos,column.x,.25,column.z,column.height,mapRole);

    // walls, inset behind the colonnade
    const wallH = isGate ? 3.55 : colHt - 0.4;
    const wallT = 0.3;
    const wy = 0.25 + wallH / 2;
    const wallInset = 1.35;
    const foot = (w: number, d: number, x: number, z: number) =>
      push('stone', box(w + .04, .22, d + .085, x, s.plinth + .30, z));
    if (!s.openFront) {
      const gap = s.name === 'main' ? 5.4 : s.name === 'rear' ? 4.6 : 3.4;
      const segW = (s.w - wallInset * 2 - gap) / 2;
      push('wall', box(segW, wallH, wallT, -(gap / 2 + segW / 2), wy, hd - wallInset));
      push('wall', box(segW, wallH, wallT, gap / 2 + segW / 2, wy, hd - wallInset));
      foot(segW, wallT, -(gap / 2 + segW / 2), hd - wallInset);
      foot(segW, wallT, gap / 2 + segW / 2, hd - wallInset);
      // The study facade has its own upper framing; the old lintel cuts
      // horizontally through the now-taller central entrance.
      if (!(s.name === 'main' && s.studyFacade))
        push('wood', box(gap + .3, 0.35, wallT + 0.1, 0, 0.25 + wallH, hd - wallInset));
    } else {
      // gate: two flanking wall stubs, open central bay
      const wingFrontX = hw - 2.05;
      for (const side of [-1, 1]) {
        push('wall', box(3.8, wallH, wallT, side * wingFrontX, wy, hd - wallInset));
        foot(3.8, wallT, side * wingFrontX, hd - wallInset);
      }
      // Keep the processional bay open all the way through the gate.
    }
    if (s.openFront || s.name === 'west') {
      const gap = s.name === 'west' ? 3.4 : 4.6;
      const segW = (s.w - wallInset * 2 - gap) / 2;
      for (const side of [-1, 1])
        push('wall', box(segW, wallH, wallT, side * (gap / 2 + segW / 2), wy, -hd + wallInset));
      for (const side of [-1, 1])
        foot(segW, wallT, side * (gap / 2 + segW / 2), -hd + wallInset);
      push('wood', box(gap + .3, .35, .42, 0, .25 + wallH, -hd + wallInset));
    } else {
      push('wall', box(s.w - wallInset * 2, wallH, wallT, 0, wy, -hd + wallInset));
      foot(s.w - wallInset * 2, wallT, 0, -hd + wallInset);
    }
    for (const xs of [-1, 1]) {
      push('wall', box(wallT, wallH, s.d - wallInset * 2, xs * (hw - wallInset), wy, 0));
      foot(wallT, s.d - wallInset * 2, xs * (hw - wallInset), 0);
      // a lit lattice window on each side wall
      const winH = Math.min(1.7, wallH * 0.5);
      const winW = Math.min(3.4, s.d * 0.32);
      const side = lattice(winW, winH, 0.22, 0.05, 0.02);
      side.bars.rotateY(xs * Math.PI / 2);
      side.backing.rotateY(xs * Math.PI / 2);
      side.bars.translate(xs * (hw - wallInset + 0.18), wy + 0.15, 0);
      side.backing.translate(xs * (hw - wallInset + 0.1), wy + 0.15, 0);
      push('lattice', side.bars);
      push('window', side.backing);
    }

    // lattice doors on the front (three or five bays)
    if (!s.openFront) {
      const bays = s.w > 20 ? 5 : 3;
      const bayW = (s.w - 2.2) / bays;
      const openBay = Math.floor(bays / 2);
      const doorBays = Array.from({ length: bays }, (_, k) => k);
      for (const i of doorBays) {
        const x = -hw + 1.1 + bayW * (i + 0.5);
        const doorW = bayW - 0.35;
        const doorH = Math.min(wallH - 0.55, 3.5);
        if (i === openBay) {
          // the central bay stands open: a warm interior and the Buddha read through it
          push('gold', box(0.16, doorH, 0.2, x - doorW / 2 - 0.1, 0.25 + doorH / 2, hd - wallInset + 0.2));
          push('gold', box(0.16, doorH, 0.2, x + doorW / 2 + 0.1, 0.25 + doorH / 2, hd - wallInset + 0.2));
          if (!(s.name === 'main' && s.studyFacade))
            push('gold', box(doorW + 0.2, 0.18, 0.2, x, 0.25 + doorH + 0.12, hd - wallInset + 0.2));
          continue;
        }
        const lat = lattice(doorW, doorH, 0.17, 0.055, hd - wallInset + 0.18);
        lat.bars.translate(x, 0, 0);
        lat.backing.translate(x, 0, 0);
        push('lattice', lat.bars);
        push('woodDark', lat.backing);
        push('wood', box(doorW + 0.18, 0.16, 0.24, x, 0.25 + doorH + 0.1, hd - wallInset + 0.18));
        push('wood', box(0.16, doorH + 0.2, 0.24, x - doorW / 2 - 0.09, 0.25 + doorH / 2, hd - wallInset + 0.18));
        push('wood', box(0.16, doorH + 0.2, 0.24, x + doorW / 2 + 0.09, 0.25 + doorH / 2, hd - wallInset + 0.18));
        // solid lower door leaves with gilded studs
        push('woodDark', box(doorW, doorH * 0.34, 0.1, x, 0.25 + doorH * 0.17, hd - wallInset + 0.1));
        for (let sx = -2; sx <= 2; sx++) {
          for (let sy = 0; sy < 2; sy++) {
            push('gold', new THREE.SphereGeometry(0.035, 6, 4).translate(x + sx * 0.62, 0.25 + 0.75 + sy * 0.32, hd - wallInset + 0.06));
          }
        }
      }
    }

    // stone balustrade around the hall base (main hall only), leaving the stair opening
    if (s.name === 'main') {
      const by = 0.45;
      const halfW = s.w / 2 + 1.2;
      const halfD = s.d / 2 + 1.45;
      for (let i = 0; i <= 14; i++) {
        const x = -halfW + (2 * halfW * i) / 14;
        if (Math.abs(x) < 3.6) continue;
        push('stone', box(0.24, 0.9, 0.24, x, by + 0.45, halfD));
        push('stone', box(0.26, 0.1, 0.26, x, by + 0.92, halfD));
      }
      for (let i = 0; i <= 10; i++) {
        const z = -halfD + (2 * halfD * i) / 10;
        for (const xs of [-1, 1]) {
          push('stone', box(0.24, 0.9, 0.24, xs * halfW, by + 0.45, z));
          push('stone', box(0.26, 0.1, 0.26, xs * halfW, by + 0.92, z));
        }
      }
      for (const xs of [-1, 1]) push('stone', box(0.16, 0.16, 2 * halfD, xs * halfW, by + 0.8, 0));
      for (const side of [-1, 1]) {
        const length = halfW - 3.6;
        push('stone', box(length, 0.16, 0.16,
          side * (halfW + 3.6) / 2, by + 0.8, halfD));
      }
    }

    // Rooms were originally scenic shells. Give each one a readable floor,
    // believable structural rhythm, skirting, and a distinct rear shrine.
    exteriorPhase = false;
    // The FPS small halls have their own efficient interior batches. Do not
    // leave the old floor, dense lattice and abstract shrine underneath them.
    if (!(this.enrichedSmallHalls && ['west','east','rear'].includes(s.name ?? ''))) {
    const roomW = s.w - wallInset * 2 - .55;
    const roomD = s.d - wallInset * 2 - .55;
    const floorTop = s.plinth + .25;
    const tile = 1.35;
    const nx = Math.floor(roomW / tile);
    const nz = Math.floor(roomD / tile);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = -roomW / 2 + (ix + .5) * roomW / nx;
      const z = -roomD / 2 + (iz + .5) * roomD / nz;
      const jitter = ((ix * 11 + iz * 7) % 7) * .002;
      const slab=box(roomW / nx - .018, .045, roomD / nz - .018, x, floorTop + .005 + jitter, z);
      push('floor',tintFloorSlab(slab,.82+((ix*13+iz*7)%11)*.022));
    }
    for (const side of [-1, 1]) {
      push('woodDark', box(.11, .44, roomD, side * roomW / 2, floorTop + .22, 0));
      push('bronze', box(.025, .035, roomD, side * roomW / 2, floorTop + .45, 0));
      for(const z of [-roomD*.24,roomD*.24]){
        const screen=lattice(Math.min(2.5,roomD*.32),2.1,.26,.055,0);
        screen.bars.rotateY(Math.PI/2);
        screen.backing.rotateY(Math.PI/2);
        screen.bars.translate(side*(hw-wallInset-.23),floorTop+.77,z);
        screen.backing.translate(side*(hw-wallInset-.27),floorTop+.77,z);
        push('lattice',screen.bars);
        push('paper',screen.backing);
      }
    }
    for (const z of [-roomD / 2, roomD / 2]) {
      if(z>0||s.name==='gate'||s.name==='west'){
        const opening=s.name==='main'?5.4:s.name==='rear'||s.name==='gate'?4.6:3.4;
        const part=(roomW-opening)/2;
        for(const side of [-1,1]){
          const x=side*(opening/2+part/2);
          push('woodDark',box(part,.44,.11,x,floorTop+.22,z));
          push('bronze',box(part,.035,.025,x,floorTop+.45,z));
        }
      }else{
        push('woodDark',box(roomW,.44,.11,0,floorTop+.22,z));
        push('bronze',box(roomW,.035,.025,0,floorTop+.45,z));
      }
    }
    const beamY = Math.max(floorTop + 2.9, colH - .35);
    for (let iz = 0; !isGate && iz < Math.max(2, Math.floor(roomD / 3.4)); iz++) {
      const z = -roomD / 2 + (iz + .5) * roomD / Math.max(2, Math.floor(roomD / 3.4));
      push('wood', box(roomW + .2, .2, .24, 0, beamY, z));
      for (const x of [-roomW / 3, roomW / 3])
        push('dougong', box(.4, .32, .4, x, beamY - .25, z));
    }
    if (s.name !== 'gate' && s.name !== 'main' && s.name !== 'west') {
      const altarZ = -hd + 2.7;
      const altarW = Math.min(5.5, roomW * .62);
      push('woodDark', box(altarW,.16,1.22,0,floorTop+.93,altarZ));
      push('bronze', box(altarW+.12,.07,1.3,0,floorTop+1.04,altarZ));
      push('woodDark', box(altarW-.35,.13,1.05,0,floorTop+.26,altarZ));
      for(const side of [-1,1])for(const depth of [-1,1]){
        const px=side*(altarW/2-.24),pz=altarZ+depth*.42;
        push('wood', box(.22,.78,.22,px,floorTop+.45,pz));
        push('bronze', box(.24,.06,.24,px,floorTop+.83,pz));
      }
      push('gold', box(altarW-.4,.055,.055,0,floorTop+.73,altarZ+.59));
      push('wood', box(altarW + .3, 2.7, .22, 0, floorTop + 2.35, altarZ - .72));
      push('gold', cyl(.5,.58,.13,20,0,floorTop+1.2,altarZ));
      push('gold', cyl(.34,.51,.63,20,0,floorTop+1.58,altarZ));
      push('gold', new THREE.SphereGeometry(.29,18,14).translate(0,floorTop+2.03,altarZ));
      push('gold', new THREE.TorusGeometry(.44,.045,8,28).translate(0,floorTop+1.99,altarZ-.24));
      for (const side of [-1, 1]) {
        push('bronze', cyl(.085, .11, .55, 10, side * Math.min(1.75, altarW * .32), floorTop + 1.24, altarZ + .1));
        push('lantern', new THREE.SphereGeometry(.12, 10, 8).translate(side * Math.min(1.75, altarW * .32), floorTop + 1.56, altarZ + .1));
      }
      for(const side of [-1,1]){
        const x=side*altarW*.34;
        push('bronze',cyl(.14,.22,.28,12,x,floorTop+1.2,altarZ+.3));
        for(let n=0;n<3;n++)push('woodDark',cyl(.012,.015,.55+n*.08,6,x+(n-1)*.045,floorTop+1.56,altarZ+.3));
      }
    }

    }
    exteriorPhase = true;
    if (!isGate) {
    // architrave + eave beams
    push('wood', box(s.w + 0.4, 0.42, 0.42, 0, colH - 0.2, hd - 0.9));
    push('wood', box(s.w + 0.4, 0.42, 0.42, 0, colH - 0.2, -hd + 0.9));
    for (const xs of [-1, 1]) push('wood', box(0.42, 0.42, s.d - 1.6, xs * (hw - 0.9), colH - 0.2, 0));
    push('wood', box(s.w + 1.4, 0.34, 0.7, 0, colH + 0.05, hd - 0.3));
    push('wood', box(s.w + 1.4, 0.34, 0.7, 0, colH + 0.05, -hd + 0.3));

    // dougong clusters
    const cluster = this.dougongCluster();
    const nFront = Math.max(3, Math.round(s.w / 2.3));
    for (let i = 0; i <= nFront; i++) {
      const x = -hw + 0.9 + ((s.w - 1.8) * i) / nFront;
      for (const zs of [-1, 1]) {
        const g = cluster.clone();
        g.translate(x, colH - 0.05, zs * (hd - 0.75));
        push('dougong', g);
      }
    }
    const nSide = Math.max(2, Math.round(s.d / 2.5));
    for (let i = 1; i < nSide; i++) {
      const z = -hd + 0.9 + ((s.d - 1.8) * i) / nSide;
      for (const xs of [-1, 1]) {
        const g = cluster.clone();
        g.rotateY(Math.PI / 2);
        g.translate(xs * (hw - 0.75), colH - 0.05, z);
        push('dougong', g);
      }
    }

    // rafters under the eaves
    const rafterCount = Math.round((s.w + 2) / 0.42);
    for (let i = 0; i <= rafterCount; i++) {
      const x = -hw - 0.8 + ((s.w + 1.6) * i) / rafterCount;
      for (const zs of [-1, 1]) {
        const g = box(0.1, 0.12, 1.45, x, colH + 0.02, zs * (hd + 0.45));
        g.rotateX(0.12 * zs);
        push(i % 2 ? 'wood' : 'dougong', g);
      }
    }
    const rafterSide = Math.round((s.d + 2) / 0.42);
    for (let i = 0; i <= rafterSide; i++) {
      const z = -hd - 0.8 + ((s.d + 1.6) * i) / rafterSide;
      for (const xs of [-1, 1]) {
        const g = box(1.45, 0.12, 0.1, xs * (hw + 0.45), colH + 0.02, z);
        g.rotateZ(-0.12 * xs);
        push(i % 2 ? 'wood' : 'dougong', g);
      }
    }

    // hanging red lanterns under the front eave
    const lanterns = Math.max(2, Math.round(s.w / 6.0));
    for (let i = 0; i <= lanterns; i++) {
      const x = -hw + 1.4 + ((s.w - 2.8) * i) / lanterns;
      const lx = x;
      const ly = colH - 1.05;
      const lz = hd + 0.15;
      const g = new THREE.SphereGeometry(0.17, 10, 8);
      g.scale(1, 1.18, 1);
      g.translate(lx, ly, lz);
      push('lantern', g);
      push('gold', cyl(0.09, 0.09, 0.08, 8, lx, ly + 0.3, lz));
      push('gold', cyl(0.09, 0.09, 0.08, 8, lx, ly - 0.3, lz));
      push('gold', cyl(0.012, 0.012, 0.55, 4, lx, ly + 0.6, lz));
    }

    }

    // roof
    if (isGate) {
      // The real mountain gate is a high, open central portal flanked by
      // lower gatehouses. Avoid stacking a tower on top of a full-width roof.
      const centralW = 9.1;
      const centralEave = colH + .16;
      push('gateRoof', roofGeometry({ w: centralW, d: s.d,
        eaveY: centralEave, rise: 3.05, cornerLift: .88,
        overhang: 1.25, nu: 34, nv: 14 }));
      this.ridgeAndTips(geos, centralW, s.d, centralEave + 3.05, centralEave);
      // A hip roof surface alone is hollow from below. Close the processional
      // bay with a timber soffit so players never see the sky through its
      // middle, then expose a modest beam rhythm under the boards.
      push('wood', box(8.9, .14, s.d + .35, 0, colH - .1, 0));
      for (const z of [-3.45, -1.72, 0, 1.72, 3.45])
        push('woodDark', box(8.9, .2, .24, 0, colH - .28, z));
      for (const x of [-3.65, 3.65])
        push('woodDark', box(.22, .2, s.d + .35, x, colH - .28, 0));
      // The rear doorway has a lower lintel than the front. Fill the tall
      // spandrel above it; otherwise a sky slit remains below the soffit.
      push('woodDark', box(8.9, 2.1, .32,
        0, colH - 1.07, -hd + 1.35));
      for (const side of [-1, 1]) {
        const wing = roofGeometry({ w: 5.6, d: s.d,
          eaveY: 3.84, rise: 1.45, cornerLift: .52,
          overhang: 1.1, nu: 24, nv: 11 });
        wing.translate(side * 5.15, 0, 0);
        push('gateRoof', wing);
        push('woodDark', box(6.1, .28, .42,
          side * 5.15, 3.62, hd - .25));
        push('woodDark', box(6.1, .28, .42,
          side * 5.15, 3.62, -hd + .25));
      }
      // The portal and plaque are carried by the red-brown timber frame.
      for (const side of [-1, 1]) {
        for (const z of [-hd + .82, hd - .82])
          push('woodDark', box(.62, colH - .35, .7,
            side * 3.22, (colH - .35) / 2 + .25, z));
        push('dougong', box(1.22, .29, 1.55,
          side * 3.22, colH - .25, hd - .25));
      }
      push('woodDark', box(8.9, .7, .7, 0, colH - .63, hd - .35));
      push('wood', box(9.5, .3, .62, 0, colH + .02, hd - .3));
      push('wood', box(9.5, .3, .62, 0, colH + .02, -hd + .3));
      push('bronze', box(8.75, .05, .75, 0, colH - .27, hd - .35));
    } else if (s.double) {
      const roofRole: Role = s.name === 'main' ? 'mainRoof' : 'roof';
      const lower = ringRoofGeometry({
        wOuter: s.w + 3.4, dOuter: s.d + 3.4, wInner: s.w - 1.2, dInner: s.d - 1.2,
        eaveY: colH + 0.1, rise: 1.15, cornerLift: 0.55, nu: 34, nv: 8,
      });
      push(roofRole, lower);
      // upper storey
      const upEave = colH + 3.0;
      push('wall', box(s.w - 2.2, 3.0, s.d - 2.2, 0, colH + 1.5, 0));
      // balcony railing under the upper eave
      for (let i = 0; i <= 12; i++) {
        const x = -hw + 1.2 + ((s.w - 2.4) * i) / 12;
        push('wood', box(0.1, 0.7, 0.1, x, colH + 0.55, hd - 1.05));
      }
      push('wood', box(s.w - 2.4, 0.12, 0.14, 0, colH + 0.9, hd - 1.05));
      // lattice band on the upper storey
      for (let i = 0; i < 5; i++) {
        const x = -hw + 1.6 + ((s.w - 3.2) * (i + 0.5)) / 5;
        const lat = lattice((s.w - 3.2) / 5 - 0.25, 1.4, 0.24, 0.07, hd - 0.95);
        lat.bars.translate(x, colH + 1.55, 0);
        lat.backing.translate(x, colH + 1.55, 0);
        push('lattice', lat.bars);
        push('window', lat.backing);
        for (let m = 0; m <= 4; m++) push('wood', box(0.08, 1.4, 0.12, x - (s.w - 3.2) / 10 + m * ((s.w - 3.2) / 20), colH + 1.55 + 0.7, hd - 0.88));
      }
      push('wood', box(s.w + 0.6, 0.35, 0.5, 0, upEave, hd - 0.7));
      push('wood', box(s.w + 0.6, 0.35, 0.5, 0, upEave, -hd + 0.7));
      const upper = roofGeometry({ w: s.w - 1.4, d: s.d - 1.4, eaveY: upEave + 0.2, rise: s.rise + 0.4, cornerLift: 0.95, overhang: 1.45, nu: 38, nv: 16 });
      push(roofRole, upper);
      this.ridgeAndTips(geos, s.w - 1.4, s.d - 1.4, upEave + 0.2 + s.rise + 0.4, upEave + 0.2, roofRole);
    } else {
      const roof = roofGeometry({ w: s.w, d: s.d, eaveY: colH + 0.15,
        rise: s.rise, cornerLift: .9, overhang: 1.25,
        nu: 36, nv: 15 });
      push('roof', roof);
      this.ridgeAndTips(geos, s.w, s.d, colH + 0.15 + s.rise, colH + 0.15);
    }

    if (isGate) {
      // Closely spaced exposed tile noses are characteristic of the photo.
      for (const part of [
        { x: 0, half: 5.75, y: colH + .12, z: hd + 1.25 },
        { x: -5.15, half: 3.9, y: 3.81, z: hd + 1.1 },
        { x: 5.15, half: 3.9, y: 3.81, z: hd + 1.1 },
      ]) {
        const count = Math.round(part.half * 2 / .32);
        for (let i = 0; i <= count; i++) {
          const x = part.x - part.half + 2 * part.half * i / count;
          const end = new THREE.CylinderGeometry(.065, .065, .075, 8);
          end.rotateX(Math.PI / 2);
          end.translate(x, part.y, part.z);
          push('gateRoof', end);
        }
      }
    } else if (!s.studyFacade) {
      // eave tile ends along the front and back
      const eaveY0 = s.double ? colH + 2.1 : colH + 0.15;
      const eaveHW = s.w / 2 + 1.1;
      const nEnds = Math.round((eaveHW * 2) / 0.34);
      for (let i = 0; i <= nEnds; i++) {
        const x = -eaveHW + (2 * eaveHW * i) / nEnds;
        for (const zs of [-1, 1]) {
          const g = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 8);
          g.rotateX(Math.PI / 2);
          g.translate(x, eaveY0 - 0.06, zs * (s.d / 2 + 1.1));
          push('roof', g);
        }
      }
    }

    // corner bells
    for (const xs of isGate ? [] : [-1, 1]) {
      for (const zs of [-1, 1]) {
        const corner = 1.15;
        push('bronze', cyl(0.14, 0.2, 0.5, 8, xs * (hw + corner), colH - 0.55, zs * (hd + corner)));
        push('bronze', new THREE.SphereGeometry(0.09, 8, 6).translate(xs * (hw + corner), colH - 0.85, zs * (hd + corner)));
      }
    }

    if (isGate) {
      // Shallow, warm plaster side rooms and black lattice windows flank the
      // unobstructed portal. Their visible faces coincide with existing walls.
      for (const side of [-1, 1]) {
        const x = side * (hw - 2.2);
        const front = hd - wallInset + .23;
        push('gatePlaster', box(2.42, 2.57, .045, x, 2.02, front - .08));
        const panel = lattice(1.64, 1.67, .21, .065, front + .05);
        panel.bars.translate(x, 1.25, 0);
        panel.backing.translate(x, 1.25, 0);
        push('lattice', panel.bars);
        push('woodDark', panel.backing);
        for (const dx of [-1.23, 1.23])
          push('woodDark', box(.13, 2.72, .16, x + dx, 1.98, front + .025));
        for (const y of [.63, 3.34])
          push('woodDark', box(2.58, .13, .16, x, y, front + .025));
      }
      push('woodDark', box(8.9, .5, .22, 0, colH - 1.06, hd + .3));
    }

    // plaque
    if (s.plaque) {
      const featuredTex = s.name === 'gate' || s.name === 'main'
        ? templePlaqueTexture(s.name as 'gate' | 'main')
        : undefined;
      const tex = featuredTex ?? textTexture(s.plaque, 512, 150, { bg: '#17130f', fg: '#d9b46b', border: '#7b5a2a' });
      const mat = featuredTex
        ? new THREE.MeshStandardMaterial({ name: `lingyin-${s.name}-gilded-plaque`, map: tex, roughness: 0.86, metalness: 0.02, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.15, emissive: new THREE.Color('#3a2a12'), emissiveIntensity: 0.18 });
      const studyMain = s.name === 'main' && s.studyFacade;
      // In the isolated proposal the sign belongs in the second-storey bay,
      // between the lower and upper roof, as in the supplied facade reference.
      // The regular game building keeps its existing plaque placement.
      const plaqueLift = s.name === 'gate' ? 1.18 : 1.45;
      const plaqueYLocal = studyMain ? colH + 2.03
        : 0.25 + Math.min(wallH - 0.55, 3.5) + plaqueLift;
      const plaqueZLocal = studyMain ? hd - .71
        : hd + (s.name === 'gate' ? .62 : -.35);
      const plaqueW = studyMain ? 5.5 : 4.2;
      const plaqueH = studyMain ? 1.52 : 1.2;
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(plaqueW, plaqueH), mat);
      plaque.position.set(s.x, WORLD.platform.y + plaqueYLocal, s.z + plaqueZLocal);
      plaque.castShadow = false;
      // keep the plaque as its own small object on the group
      plaque.name = `plaque-${s.name}`;
      this.group.add(plaque);
      if (studyMain) {
        push('woodDark', box(plaqueW + .36, plaqueH + .3, .17, 0,
          plaqueYLocal, plaqueZLocal - .16));
        for (const side of [-1, 1]) {
          push('gold', box(plaqueW + .34, .055, .05, 0,
            plaqueYLocal + side * (plaqueH / 2 + .11), plaqueZLocal - .055));
          push('gold', box(.055, plaqueH + .22, .05,
            side * (plaqueW / 2 + .12), plaqueYLocal, plaqueZLocal - .055));
        }
      } else {
        push('gold', box(4.5, 1.45, 0.16, 0,
          plaqueYLocal, hd + (s.name === 'gate' ? .48 : -.48)));
      }
    }

    // transform everything into place
    const rot = s.rotY ?? 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    for (const role of Object.keys(geos) as Role[]) {
      for (const g of geos[role]) {
        if (rot) g.rotateY(rot);
        g.translate(s.x, WORLD.platform.y, s.z);
        this.roles[role].push(g);
      }
    }
    const enrichedRoom=this.enrichedSmallHalls&&['west','east','rear'].includes(s.name??'');
    const lamp = new THREE.PointLight(enrichedRoom ? 0xffddb0 : 0xffb777,
      s.name === 'main' ? 6 : isGate ? 4.4 : enrichedRoom ? (s.name==='rear'?14:10) : 2.8,
      s.name === 'main' ? 18 : isGate ? 12 : enrichedRoom ? 13 : 10, 2);
    lamp.name=`temple-${s.name}-existing-room-light`;
    lamp.position.set(s.x, WORLD.platform.y + (isGate ? 4.1 : enrichedRoom ? colH-.88 : Math.max(3.2, s.plinth + 2.3)), s.z);
    this.group.add(lamp);
    // anchors
    this.anchors.eaves.push(new THREE.Vector3(s.x + sin * (hd + 1), WORLD.platform.y + colH, s.z + cos * (hd + 1)));
    if (s.name === 'main') {
      this.anchors.door.set(s.x, WORLD.platform.y + 1.6, s.z + hd + 1.5);
    }
  }

  private column(geos: Record<Role, THREE.BufferGeometry[]>, x: number, y: number, z: number, h: number, roleFor: (role: Role) => Role = role => role) {
    geos[roleFor('stone')].push(cyl(0.4, 0.46, 0.24, 10, x, y + 0.06, z));
    geos[roleFor('wood')].push(cyl(0.27, 0.33, h - 0.24, 12, x, y + 0.24 + (h - 0.24) / 2, z));
    geos.gold.push(cyl(0.31, 0.31, 0.08, 12, x, y + h - 0.16, z));
    geos.bronze.push(cyl(0.33, 0.33, 0.05, 12, x, y + 0.36, z));
  }

  private dougongCluster() {
    const geos: THREE.BufferGeometry[] = [];
    geos.push(box(0.42, 0.36, 0.42, 0, 0.18, 0));
    geos.push(box(1.5, 0.2, 0.3, 0, 0.46, 0));
    geos.push(box(0.3, 0.2, 1.1, 0, 0.46, 0.2));
    geos.push(box(0.46, 0.22, 0.46, -0.45, 0.67, 0));
    geos.push(box(0.46, 0.22, 0.46, 0, 0.67, 0));
    geos.push(box(0.46, 0.22, 0.46, 0.45, 0.67, 0));
    geos.push(box(0.22, 0.2, 0.9, 0, 0.67, 0.0));
    return merge(geos);
  }

  private ridgeAndTips(geos: Record<Role, THREE.BufferGeometry[]>, w: number, d: number, ridgeY: number, eaveY: number, role: 'roof' | 'mainRoof' = 'roof') {
    const rl = (w * 0.52) / 2;
    geos[role].push(box(rl * 2 + 0.6, 0.42, 0.42, 0, ridgeY + 0.18, 0));
    for (const xs of [-1, 1]) {
      // upturned ridge-end ornament (chiwen), abstracted as two tilted slabs
      geos[role].push(box(0.34, 1.15, 0.4, xs * (rl + 0.35), ridgeY + 0.55, 0));
      const tail = box(0.28, 0.9, 0.34, xs * (rl + 0.55), ridgeY + 1.05, 0.1);
      tail.rotateZ(-xs * 0.35);
      geos[role].push(tail);
    }
    // hip ridges from the ridge ends down to the four eave corners
    const hw0 = w / 2 + 1.15;
    const hd0 = d / 2 + 1.15;
    for (const xs of [-1, 1]) {
      for (const zs of [-1, 1]) {
        const a = new THREE.Vector3(xs * rl, ridgeY + 0.1, 0);
        const b = new THREE.Vector3(xs * hw0, eaveY + 0.35, zs * hd0);
        const dir = b.clone().sub(a);
        const len = dir.length();
        const g = new THREE.BoxGeometry(0.34, len, 0.28);
        g.translate(0, len / 2, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        g.applyQuaternion(q);
        g.translate(a.x, a.y, a.z);
        geos[role].push(g);
      }
    }
    // eave corner tips
    const hw = w / 2 + 1.15;
    const hd = d / 2 + 1.15;
    for (const xs of [-1, 1]) {
      for (const zs of [-1, 1]) {
        const tip = cyl(0.05, 0.2, 1.15, 6, 0, 0, 0);
        tip.rotateZ(-xs * 0.55);
        tip.rotateX(zs * 0.3);
        tip.translate(xs * hw, eaveY + 0.45, zs * hd);
        geos[role].push(tip);
        geos.gold.push(new THREE.SphereGeometry(0.11, 8, 6).translate(xs * hw, eaveY + 0.95, zs * hd));
      }
    }
  }

  // ------------------------------------------------------------------ pagoda
  private buildPagoda(x: number, z: number, y: number) {
    this.addAt('stone', cyl(3.1, 3.4, 0.7, 8), x, y + 0.35, z);
    let base = y + 0.7;
    let r = 2.1;
    for (let i = 0; i < 5; i++) {
      const h = 2.25 - i * 0.1;
      this.addAt('stone', cyl(r - 0.12, r, h, 8), x, base + h / 2, z);
      // door niche
      this.addAt('dark', box(0.7, 1.25, 0.2, 0, 0, 0), x, base + 0.75, z + r - 0.02);
      // eave
      this.addAt('stone', cyl(r + 0.85, r + 0.2, 0.36, 8), x, base + h + 0.18, z);
      this.addAt('stone', cyl(r + 0.1, r + 0.1, 0.16, 8), x, base + h + 0.42, z);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const tip = cyl(0.03, 0.1, 0.55, 5, 0, 0, 0);
        tip.rotateZ(0.7);
        tip.rotateY(-a);
        tip.translate(x + Math.cos(a) * (r + 0.85), base + h + 0.45, z + Math.sin(a) * (r + 0.85));
        this.add('stone', tip);
      }
      base += h + 0.5;
      r *= 0.87;
    }
    // finial
    this.addAt('gold', cyl(0.12, 0.3, 1.6, 8), x, base + 0.8, z);
    for (let i = 0; i < 4; i++) this.addAt('gold', new THREE.SphereGeometry(0.22 - i * 0.03, 10, 8), x, base + 0.4 + i * 0.3, z);
    this.addAt('gold', new THREE.SphereGeometry(0.16, 8, 6), x, base + 1.7, z);
  }

  // ------------------------------------------------------------------ enclosure
  private buildEnclosure(y: number) {
    const P = WORLD.platform;
    const seg = (x0: number, z0: number, x1: number, z1: number) => {
      const dx=x1-x0,dz=z1-z0,len=Math.hypot(dx,dz);
      const cx=(x0+x1)/2,cz=(z0+z1)/2,rot=Math.atan2(dx,dz);
      const nx=Math.cos(rot),nz=-Math.sin(rot);
      const footingBottom=-.02,footingTop=1.11;
      const wallBottom=1.03,wallTop=3.33;
      this.add('stone',box(.86,footingTop-footingBottom,len+.25,cx,
        y+(footingBottom+footingTop)/2,cz,rot));
      this.add('gatePlaster',box(.34,wallTop-wallBottom,len-.08,cx,
        y+(wallBottom+wallTop)/2,cz,rot));
      this.add('woodDark',box(.5,.18,len+.22,cx,y+wallTop+.015,cz,rot));
      for(const side of [-1,1]) {
        this.add('woodDark',box(.1,.16,len+.48,cx+side*nx*.88,y+wallTop+.06,
          cz+side*nz*.88,rot));
        const slab=new THREE.BoxGeometry(.95,.1,len+.5);
        slab.rotateZ(side*.34);slab.rotateY(rot);
        slab.translate(cx+nx*side*.38,y+wallTop+.2,cz+nz*side*.38);
        this.add('dark',slab);
      }
      this.add('dark',box(.18,.14,len+.52,cx,y+wallTop+.36,cz,rot));
      const count=Math.max(2,Math.ceil(len/6.4));
      for(let i=0;i<=count;i++) {
        const t=i/count;
        this.add('woodDark',box(.46,wallTop-wallBottom+.12,.46,
          x0+dx*t,y+(wallBottom+wallTop)/2,z0+dz*t,rot));
      }
    };
    // Keep the former pilgrimage gatehouse as part of the enclosure, but seal
    // its old passage with the same low stone balustrade used around the
    // temple. The planned western boardwalk has a separate entrance.
    seg(P.x0 + 0.5, P.z0 + 1, P.x0 + 0.5, 3.8);
    seg(P.x0 + 0.5, 10.2, P.x0 + 0.5, P.z1 - 1);
    for(const z of [3.8,10.2])
      this.add('stone',box(.75,3.7,.75,P.x0+.5,y+1.85,z));
    this.add('roof',box(1.25,.35,7.1,P.x0+.5,y+4.0,7));
    this.add('wood',box(.22,.4,2.0,P.x0+.05,y+3.45,7));
    const westSign=new THREE.Mesh(new THREE.PlaneGeometry(1.76,.34),
      new THREE.MeshStandardMaterial({map:textTexture('西山道',512,128,
        {bg:'#302923',fg:'#d4b674',border:'#8f7755'}),roughness:.88,
        side:THREE.DoubleSide}));
    westSign.rotation.y=Math.PI/2;
    westSign.position.set(P.x0+.2,y+3.45,7);
    this.group.add(westSign);
    // The raised hall floor continues over the narrow space to the gate.
    this.add('stone',box(4.25,.95,3.2,-34.25,y+.475,7));
    this.add('floor',tintFloorSlab(box(4.3,.06,3.25,-34.25,y+.98,7),.92));
    this.balustrade(4.1,9.9,P.x0+.5,y+.98,'z');
    seg(P.x0 + 0.5, P.z0 + 1, P.x1 - 0.5, P.z0 + 1);
    // east wall split around the gate to the bridge
    seg(P.x1 - 0.5, P.z0 + 1, P.x1 - 0.5, 23);
    seg(P.x1 - 0.5, 33, P.x1 - 0.5, P.z1 - 1);
    // small tiled gate at the east opening
    this.add('wood', box(0.4, 3.2, 1.0, P.x1 - 0.5, y + 2.0, 23.4));
    this.add('wood', box(0.4, 3.2, 1.0, P.x1 - 0.5, y + 2.0, 32.6));
    this.add('roof', box(1.9, 0.3, 10.4, P.x1 - 0.5, y + 3.75, 28));
    // The bridge exit is now playable. Swing both timber leaves outward along
    // the bridge axis so the full central bay stays visibly open.
    for (const side of [-1, 1]) {
      const z = 28 + side * 4.58;
      const x = P.x1 + 1.68;
      this.add('wood', box(4.38, 2.72, .22, x, y + 1.71, z));
      for (const dx of [-1.98, 1.98])
        this.add('bronze', box(.13, 2.8, .3, x + dx, y + 1.71, z));
      for (const dy of [.64, 1.55, 2.48])
        this.add('bronze', box(4.25, .15, .3, x, y + dy, z));
      for (const dx of [-1.4, -.7, .7, 1.4])
        for (const dy of [.56, 1.08, 1.85, 2.37])
          this.add('gold', new THREE.SphereGeometry(.055, 8, 6).translate(x + dx, y + dy, z - .14));
      const handle=cyl(.09,.09,.055,8,x-1.62,y+1.55,z-.16);
      handle.rotateX(Math.PI/2);
      this.add('bronze',handle);
    }

    // Permanent stone bridge under the approved exit. The planning overlay
    // may still tint it white in the editor, but the game now has real art,
    // footing and parapets at the same coordinates as navigation.
    const crown=[.34,.52,.66,.52,.34];
    for(let i=0;i<crown.length;i++)
      this.add('stone',box(2.55,.28,4.6,30.9+i*2.55,y+crown[i]-.14,28));
    for(let i=0;i<3;i++) {
      const rise=.11+i*.11;
      this.add('stone',box(.72,.18,4.75,28.38+i*.72,y+rise-.09,28));
    }
    for(const z of [25.9,30.1]) {
      for(let i=0;i<crown.length;i++) {
        const x=30.9+i*2.55,top=y+crown[i];
        this.add('stone',box(2.58,.17,.22,x,top+.93,z));
      }
      for(let i=0;i<=10;i++) {
        const t=i/10,index=Math.min(4,Math.floor(t*5));
        this.add('stone',box(.18,1.02,.18,29.2+t*14,y+crown[index]+.48,z));
      }
    }
    for(const x of [31.3,40.9])this.add('stone',box(.78,2.2,3.8,x,y-.78,28));
  }

  private buildBuddha(y: number) {
    const bx = MAIN_HALL.x;
    // The photogrammetry scan has a flat rear. Place its back almost flush
    // with the mural wall rather than leaving a walkable gap behind it.
    const bz = MAIN_HALL.z + 1.15;
    const by = y + 1.1;
    // The sculpted Buddha is loaded separately from a real scan. Keep the
    // architectural throne here so it shares the hall's batched materials.
    this.add('bronze', cyl(1.58, 1.72, 0.18, 36).translate(bx, by + 0.09, bz));
    this.add('bronze', cyl(1.43, 1.55, 0.38, 36).translate(bx, by + 0.37, bz));
    this.add('gold', cyl(1.48, 1.52, 0.055, 36).translate(bx, by + 0.19, bz));
    this.add('gold', cyl(1.34, 1.4, 0.07, 36).translate(bx, by + 0.57, bz));
    this.add('bronze', cyl(1.17, 1.30, 0.15, 36).translate(bx, by + 0.67, bz));
    // Pointed, gently cupped lotus petals replace the old oval beads.
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < 18; i++) {
        const angle = (i + ring * 0.5) * Math.PI * 2 / 18;
        const vertices: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        const rows = 7, columns = 5;
        for (let row = 0; row <= rows; row++) {
          const v = row / rows;
          const radius = 1.09 + ring * 0.07 + v * (ring ? 0.28 : 0.38);
          const halfWidth = (ring ? 0.17 : 0.19) * Math.sin(Math.PI * (0.12 + v * 0.88));
          for (let column = 0; column <= columns; column++) {
            const u = column / columns * 2 - 1;
            const a = angle + u * halfWidth;
            const height = 0.30 + ring * 0.17 + v * (ring ? 0.26 : 0.32)
              + (1 - u * u) * Math.sin(Math.PI * v) * 0.075;
            vertices.push(bx + Math.sin(a) * radius, by + height, bz + Math.cos(a) * radius);
            uvs.push(column / columns, v);
            if (row < rows && column < columns) {
              const k = row * (columns + 1) + column;
              indices.push(k, k + columns + 1, k + 1, k + 1, k + columns + 1, k + columns + 2);
            }
          }
        }
        const petal = new THREE.BufferGeometry();
        petal.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        petal.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        petal.setIndex(indices);
        petal.computeVertexNormals();
        this.add('bronze', petal);
      }
    }
    // warm plaster glow behind the figure, so the open bay reads as a lit interior
    const glow = new THREE.MeshStandardMaterial({ color: 0x120b06, emissive: new THREE.Color('#7a3510'), emissiveIntensity: 0.3, roughness: 1 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(8.5, 7, 0.2), glow);
    wall.position.set(bx, by + 2.8, MAIN_HALL.z+.6);
    this.group.add(wall);
  }

  private finalize() {
    for (const role of Object.keys(this.roles) as Role[]) {
      const geos = this.roles[role];
      if (!geos.length) continue;
      const merged = merge(geos);
      const tileSize: Partial<Record<Role, number>> = {
        stone: 1.4, wall: 2.0, gatePlaster: 1.8, wood: .75, woodDark: .7,
        dougong: .7, lattice: .75, mainStone: 1.4, mainWall: 2.0,
        mainWood: .75, mainWoodDark: .7, mainDougong: .7, mainLattice: .75,
      };
      const geo = tileSize[role] ? projectedTempleUV(merged, tileSize[role]!) : merged;
      const finish:Partial<Record<Role,SurfaceFinish>>={
        stone:'stone',mainStone:'stone',wall:'plaster',mainWall:'plaster',gatePlaster:'plaster',
        wood:'wood',woodDark:'wood',mainWood:'wood',mainWoodDark:'wood',lattice:'wood',mainLattice:'wood',
      };
      if(finish[role]) {
        bakeSurfaceFinish(geo,finish[role]!,finish[role]==='plaster'?undefined:WORLD.platform.y);
        (this.materials[role] as THREE.MeshStandardMaterial).vertexColors=true;
      }
      const mesh = new THREE.Mesh(geo, this.materials[role]);
      mesh.name = `temple-${role}`;
      mesh.castShadow = role === 'stone' || role === 'wall' || role === 'gatePlaster' || role === 'roof' || role === 'mainRoof' || role === 'wood' || role === 'woodDark' || role === 'dark' || role === 'dougong' || role === 'bronze' || role === 'mainStone' || role === 'mainWall' || role === 'mainWood' || role === 'mainWoodDark' || role === 'mainDougong';
      mesh.receiveShadow = true;
      this.group.add(mesh);
      geos.length = 0;
    }
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.name.startsWith('plaque')) {
        o.castShadow = false;
      }
    });
  }
}
