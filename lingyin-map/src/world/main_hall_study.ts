import * as THREE from 'three';
import { box, cyl, merge, projectedTempleUV } from './geom';
import { WORLD } from './heightfield';
import { woodMaterial, dougongMaterial } from './materials';
import { bakeSurfaceFinish } from './surface_finish';
import type { Temple } from './temple';
import { MAIN_HALL, MAIN_HALL_SCALE } from '../../../scripts/lingyin_main_hall.js';
import { distantScan,configureProjectedLOD } from './distant_geometry';
import { MAIN_INTERIOR_COLUMNS, MAIN_COLUMN_PARTS, MAIN_CENSER, MAIN_CENSER_PROFILE,MAIN_HALL_FIXTURES } from '../../../scripts/lingyin_columns.js';

export type MainHallStudyAssets = {
  coffer: THREE.Texture;
  paintedBeam: THREE.Texture;
  redLacquer: THREE.Texture;
  stoneFloor: THREE.Texture;
  carvedAltar: THREE.Texture;
  redRoof: THREE.Texture;
  buddhaScan: THREE.Object3D;
  buddhaSideLod: THREE.Object3D;
};

// The preview and the FPS map share one authored hall so the reviewed
// facade and interior remain visually identical after integration.
export function createMainHallInterior(temple: Temple, assets: MainHallStudyAssets) {
  const group = new THREE.Group();
  group.name = 'lingyin-main-hall-interior';
  const cx = WORLD.temple.x, cz = WORLD.temple.z;
  const floor = WORLD.platform.y + 1.35;
  // Preview-only taller eave: the original 5 m interior compressed the
  // columns, windows and three-figure altar into one low horizontal band.
  const ceiling = WORLD.platform.y + 9.72;
  // The shell retains metre-sized wall insets. Compensate before the layout
  // transform so the new floor and soffit still meet its inner perimeter.
  const roomW = (MAIN_HALL.w-3.25)/MAIN_HALL_SCALE.x;
  const roomD = (MAIN_HALL.d-3.25)/MAIN_HALL_SCALE.z;

  // The facade is part of the hall replacement. The original hall's
  // lower blank wall and unpainted eaves made the correctly modeled roof read
  // unlike the supplied two-storey reference.
  const eave = WORLD.platform.y + 9.9;

  function addFacade() {
    const roof = temple.materials.mainRoof;
    if (roof instanceof THREE.MeshStandardMaterial) {
      roof.map = assets.redRoof;
      roof.normalMap = null;
      roof.bumpMap = assets.redRoof;
      roof.bumpScale = .035;
      roof.color.set('#f3dfd4');
      roof.roughness = .88;
      roof.needsUpdate = true;
    }
    const upperY = eave + 1.55;
    add('darkWood', 24.0, 2.5, .09, 0, upperY, 7.45);
    for (const x of [-9.2, -5.1, 5.1, 9.2]) {
      add('teal', 3.5, 1.45, .055, x, upperY, 7.52);
      for (let n = -4; n <= 4; n++)
        add('darkWood', .055, 1.43, .06, x + n * .39, upperY, 7.57);
      for (let n = -1; n <= 1; n++)
        add('gilt', 3.5, .035, .06, x, upperY + n * .48, 7.58);
    }
    for (const x of [-12.0, -7.15, -3.25, 3.25, 7.15, 12.0]) {
      add('lacquer', .36, 2.56, .32, x, upperY, 7.69);
      add('gilt', .47, .07, .37, x, eave + .29, 7.69);
    }
    const fasciaArt = assets.paintedBeam.clone();
    fasciaArt.wrapS = THREE.RepeatWrapping;
    fasciaArt.repeat.set(9, 1);
    fasciaArt.needsUpdate = true;
    const painted = new THREE.MeshStandardMaterial({
      name: 'hall-exterior-blue-gold-caihua', map: fasciaArt,
      roughness: .78, metalness: .02, side: THREE.DoubleSide,
    });
    const paintedFaces:THREE.BufferGeometry[]=[];
    for (const [width, height, y, z] of [
      [27.8, .72, eave - .48, 9.58],
      [26.5, .62, eave + 2.85, 8.77],
      [23.9, .38, eave + .33, 7.82],
    ]) {
      add('teal', width + .1, height + .06, .16, 0, y, z - .1);
      add('gilt', width + .12, .035, .17, 0, y - height / 2 - .04, z - .09);
      add('gilt', width + .12, .035, .17, 0, y + height / 2 + .04, z - .09);
      const face=new THREE.PlaneGeometry(width,height);
      face.translate(cx,y,cz+z);paintedFaces.push(face);
    }
    const paintedEaves=new THREE.Mesh(merge(paintedFaces),painted);
    paintedEaves.name='hall-exterior-painted-eaves';group.add(paintedEaves);
    for (const x of [-9.2, 9.2]) {
      const medallion = new THREE.Mesh(new THREE.CircleGeometry(1.28, 32),
        new THREE.MeshStandardMaterial({color:'#244448', roughness:.82,
          metalness:.06, side:THREE.DoubleSide}));
      medallion.name = 'hall-exterior-round-window';
      medallion.position.set(cx + x, floor + 3.95, cz + 7.47);
      group.add(medallion);
      const rim = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.34, 48),
        new THREE.MeshStandardMaterial({color:'#ae8542', roughness:.58,
          metalness:.4, side:THREE.DoubleSide}));
      rim.position.set(cx + x, floor + 3.95, cz + 7.49);
      group.add(rim);
    }
    for (const x of [-5.75, 5.75]) {
      add('darkWood', 3.65, 5.25, .085, x, floor + 3.05, 7.51);
      for (const dx of [-1.87, 1.87])
        add('lacquer', .16, 5.48, .12, x + dx, floor + 3.05, 7.59);
      for (const dy of [-2.7, 2.7])
        add('lacquer', 3.95, .16, .12, x, floor + 3.05 + dy, 7.59);
      for (const dx of [-1.15, -.58, 0, .58, 1.15])
        add('teal', .055, 5.1, .09, x + dx, floor + 3.05, 7.61);
      for (const dy of [-1.8, -.9, 0, .9, 1.8])
        add('teal', 3.55, .055, .09, x, floor + 3.05 + dy, 7.61);
    }
  }

  const lacquer = new THREE.MeshStandardMaterial({
    name: 'hall-worn-cinnabar-lacquer', map: assets.redLacquer,
    roughness: .51, metalness: .02,
  });
  const darkWood=woodMaterial(true);
  darkWood.name='hall-carved-dark-wood';darkWood.color.set('#aa9381');darkWood.roughness=.9;
  const teal=dougongMaterial();
  teal.name='hall-painted-dougong';teal.color.set('#8bafa7');teal.roughness=.92;
  const gilt = new THREE.MeshStandardMaterial({
    name: 'hall-aged-gilt', color: '#b98737', metalness: .54,
    roughness: .39, emissive: '#2d1907', emissiveIntensity: .12,
  });
  const bronze = new THREE.MeshStandardMaterial({
    name: 'hall-cast-bronze', color: '#77603d', metalness: .57,
    roughness: .48,
  });
  const materials = { lacquer, darkWood, teal, gilt, bronze };
  type Role = keyof typeof materials;
  const pooled: Record<Role, THREE.BufferGeometry[]> = {
    lacquer: [], darkWood: [], teal: [], gilt: [], bronze: [],
  };
  const add = (role: Role, w: number, h: number, d: number,
    x: number, y: number, z: number) =>
    pooled[role].push(box(w, h, d, cx + x, y, cz + z));
  const addCyl = (role: Role, rt: number, rb: number, h: number,
    x: number, y: number, z: number, sides = 24) =>
    pooled[role].push(cyl(rt, rb, h, sides, cx + x, y, cz + z));
  addFacade();

  // Polished, irregular gray stone conceals the existing pale floor tiles.
  const floorMat = (temple.materials.stone as THREE.MeshStandardMaterial).clone();
  floorMat.name = 'hall-weathered-stone-floor';
  // The shared stone shell has baked vertex colours, but this photographed
  // plane does not. Do not inherit a colour attribute that it cannot supply.
  floorMat.vertexColors=false;
  floorMat.color.set('#e3dfd6');
  floorMat.roughness = .9;
  floorMat.map = assets.stoneFloor;
  floorMat.map.wrapS = floorMat.map.wrapT = THREE.RepeatWrapping;
  floorMat.map.repeat.set(7*MAIN_HALL_SCALE.x,4*MAIN_HALL_SCALE.z);
  floorMat.map.needsUpdate = true;
  // The previous normal/roughness scans belonged to different stone. Use
  // this floor's own relief, sharing its albedo rather than cloning a GPU map.
  floorMat.normalMap=null;floorMat.roughnessMap=null;
  floorMat.bumpMap=assets.stoneFloor;floorMat.bumpScale=.024;
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW - .08, roomD - .08), floorMat);
  floorMesh.name = 'hall-stone-floor';
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(cx, floor + .04, cz);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // A coffered roof soffit, the central dragon panel, and painted beam faces.
  add('darkWood', roomW - .08, .16, roomD - .08, 0, ceiling, 0);
  for (const z of [-5.55, -2.0, 1.55, 5.35]) {
    add('teal', roomW - .2, .72, .54, 0, ceiling - .38, z);
    add('gilt', roomW - .2, .045, .62, 0, ceiling - .76, z);
  }
  for (const x of [-10.0, -7.7, -3.8, 3.8, 7.7, 10.0])
    add('teal', .54, .55, roomD - .2, x, ceiling - .28, 0);
  for (const x of [-10.7, 10.7]) {
    add('gilt', .035, .06, roomD - .2, x, ceiling - .58, 0);
  }
  const beamPaint = assets.paintedBeam.clone();
  beamPaint.wrapS = THREE.RepeatWrapping;
  beamPaint.repeat.set(8, 1);
  beamPaint.needsUpdate = true;
  const beamMat = new THREE.MeshStandardMaterial({
    name: 'hall-painted-beam-art', map: beamPaint,
    roughness: .74, metalness: .03, side: THREE.DoubleSide,
  });
  const beamFaces: THREE.BufferGeometry[] = [];
  for (const z of [-5.55, -2.0, 1.55, 5.35]) {
    const g = new THREE.PlaneGeometry(roomW - .25, .61);
    g.translate(cx, ceiling - .37, cz + z + .286);
    beamFaces.push(g);
  }
  const beamMesh = new THREE.Mesh(merge(beamFaces), beamMat);
  beamMesh.name = 'hall-painted-crossbeams';
  group.add(beamMesh);
  const cofferMat = new THREE.MeshStandardMaterial({
    name: 'hall-dragon-coffer-art', map: assets.coffer, roughness: .76,
    side: THREE.DoubleSide, emissive: '#45301d', emissiveIntensity: .08,
  });
  const coffer = new THREE.Mesh(new THREE.PlaneGeometry(6.75, 6.15), cofferMat);
  coffer.name = 'hall-central-dragon-coffer';
  coffer.rotation.x = Math.PI / 2;
  coffer.position.set(cx, ceiling - .11, cz + .1);
  group.add(coffer);
  for (const side of [-1, 1]) {
    add('gilt', .09, .045, 6.48, side * 3.43, ceiling - .12, .1);
    add('gilt', 6.95, .045, .09, 0, ceiling - .12, .1 + side * 3.15);
  }

  // Three pairs of massive lacquered columns. Stone shoes and layered
  // bracket arms visibly transfer the roof load to the shafts.
  for (const [x, z] of MAIN_INTERIOR_COLUMNS) {
    for(const part of MAIN_COLUMN_PARTS)
      addCyl(part.role,part.rt,part.rb,part.h,x,WORLD.platform.y+part.y,z,part.segments);
    for (let layer = 0; layer < 3; layer++) {
      const y = ceiling - .44 + layer * .16;
      const reach = .85 + layer * .25;
      add('teal', 2 * reach, .16, .58, x, y, z);
      add('teal', .62, .16, 2 * reach, x, y + .07, z);
      add('gilt', 2 * reach, .025, .06, x, y - .09, z + .29);
    }
  }
  // Bracket clusters repeat into the side aisles without new draw calls.
  for (const x of [-10.1, -5.15, 5.15, 10.1])
    for (const z of [-5.55, -2.0, 1.55, 5.35]) {
      add('teal', 1.42, .16, .38, x, ceiling - .82, z);
      add('teal', .47, .22, .9, x, ceiling - .68, z);
      add('gilt', 1.32, .035, .04, x, ceiling - .92, z + .22);
    }

  // False translucent paper windows sit just inside the existing side walls.
  // They use emissive fill rather than expensive real transmission.
  const windowMat = new THREE.MeshStandardMaterial({
    name: 'hall-daylit-paper', color: '#e4d5b7', roughness: 1,
    emissive: '#fff0d0', emissiveIntensity: .76, side: THREE.DoubleSide,
  });
  const windowFaces: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) for (const z of [-3.75, 0, 3.75]) {
    const wx = side * (roomW / 2 - .22);
    const wy = floor + 4.18;
    const g = new THREE.PlaneGeometry(2.7, 5.5);
    g.rotateY(-side * Math.PI / 2);
    g.translate(cx + wx, wy, cz + z);
    windowFaces.push(g);
    for (const dz of [-1.39, 1.39])
      add('darkWood', .12, 5.7, .13, wx - side * .08, wy, z + dz);
    for (const dy of [-2.82, 2.82])
      add('darkWood', .12, .14, 2.85, wx - side * .08, wy + dy, z);
    for (let n = -3; n <= 3; n++)
      add('darkWood', .045, 5.5, .045, wx - side * .13, wy, z + n * .36);
    for (let n = -6; n <= 6; n++)
      add('darkWood', .045, .045, 2.7, wx - side * .13, wy + n * .4, z);
  }
  const windows = new THREE.Mesh(merge(windowFaces), windowMat);
  windows.name = 'hall-daylit-lattice-windows';
  group.add(windows);
  for (const side of [-1, 1]) {
    add('darkWood', .18, 1.05, roomD - .25,
      side * (roomW / 2 - .12), floor + .57, 0);
    add('gilt', .035, .035, roomD - .25,
      side * (roomW / 2 - .19), floor + 1.12, 0);
  }

  // Deep altar backdrop and stepped timber dais at the actual rear wall.
  for(const part of MAIN_HALL_FIXTURES)
    add(part.role,part.w,part.h,part.d,part.x,floor+part.y,part.z);
  add('teal', 18.0, .8, .42, 0, ceiling - .65, -6.23);
  for (const x of [-6.9, -2.3, 2.3, 6.9]) {
    add('lacquer', .18, 6.95, .13, x, floor + 4.1, -6.48);
    add('gilt', .035, 6.9, .04, x + .13, floor + 4.1, -6.4);
  }
  for (const y of [floor + 5.5, floor + 7.15]) {
    add('teal', 17.1, .24, .2, 0, y, -6.45);
    add('gilt', 17.1, .035, .22, 0, y - .13, -6.45);
  }
  for (const x of [-8.75, 8.75]) {
    add('lacquer', .4, 4.8, .36, x, floor + 2.5, -6.35);
    add('gilt', .07, 4.4, .04, x + (x < 0 ? .23 : -.23), floor + 2.52, -6.12);
  }

  // The generated image is an original ornamental texture, not a flattened
  // copy of either user reference. Wood geometry carries the depth.
  const haloTexture = makeHaloTexture();
  const haloMat = new THREE.MeshBasicMaterial({
    name: 'hall-gilt-halos', map: haloTexture, transparent: true,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const distantBuddha=distantScan(assets.buddhaSideLod);
  for (const x of [-4.6, 0, 4.6]) {
    const mid = x === 0;
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(mid ? 4.5 : 3.55, mid ? 4.5 : 3.55), haloMat);
    halo.name = 'hall-statue-halo';
    halo.position.set(cx + x, floor + (mid ? 4.05 : 3.56), cz - 6.37);
    group.add(halo);
    const figure = new THREE.LOD();
    figure.position.set(cx + x, floor + .9, cz - 4.82);
    figure.addLevel(placeScan(mid ? assets.buddhaScan : assets.buddhaSideLod,
      gilt, mid ? 1.35 : 1.05, 0, 0, 0), 0);
    if (mid) {
      // Preserve the scanned silhouette and gilding outside the hall. Dense
      // facial detail is useful only close to the altar, not across the court.
      figure.addLevel(placeScan(assets.buddhaSideLod, gilt, 1.35, 0, 0, 0), 20, .12);
    }
    figure.addLevel(placeScan(distantBuddha,gilt,mid?1.35:1.05,0,0,0),40,.12);
    configureProjectedLOD(figure);
    figure.name = mid ? 'hall-central-buddha' : 'hall-flanking-buddha';
    group.add(figure);
  }

  // Altar, dense but batched offerings, and a clear red processional route.
  add('gilt', 13.4, .035, .06, 0, floor + 1.07, -1.3);
  add('gilt', 13.4, .035, .06, 0, floor + .59, -1.3);
  const carvedArt = assets.carvedAltar.clone();
  carvedArt.wrapS = THREE.RepeatWrapping;
  carvedArt.repeat.set(5, 1);
  carvedArt.needsUpdate = true;
  const altarFront = new THREE.Mesh(new THREE.PlaneGeometry(13.26, .7),
    new THREE.MeshStandardMaterial({name:'hall-carved-altar-front', map: carvedArt,
      roughness:.68, metalness:.04, side:THREE.DoubleSide}));
  altarFront.name='hall-carved-altar-front';
  altarFront.position.set(cx, floor + .84, cz - 1.31);
  group.add(altarFront);
  for (const x of [-6.3, -3.2, 0, 3.2, 6.3]) {
    add('gilt', .08, .45, .08, x, floor + .87, -1.15);
  }
  const flames: THREE.BufferGeometry[] = [];
  for (const x of [-5.7, -4.4, -2.8, -1.4, 1.4, 2.8, 4.4, 5.7]) {
    addCyl('bronze', .13, .2, .25, x, floor + 1.45, -2.04, 12);
    addCyl('gilt', .045, .07, .28, x, floor + 1.72, -2.04, 10);
    const g = new THREE.SphereGeometry(.08, 10, 8);
    g.scale(.75, 1.7, .75);
    g.translate(cx + x, floor + 1.93, cz - 2.04);
    flames.push(g);
  }
  const flame = new THREE.Mesh(merge(flames), new THREE.MeshBasicMaterial({color:'#ffd185'}));
  flame.name = 'hall-altar-flames';
  group.add(flame);

  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.65, 11.6),
    new THREE.MeshStandardMaterial({
      name: 'hall-woven-carpet', map: makeCarpetTexture(),
      roughness: .94, metalness: 0,
    }));
  carpet.name = 'hall-processional-carpet';
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(cx, floor + .055, cz + 1.38);
  group.add(carpet);
  const incense = makeIncenseBurner(bronze, gilt, cx+MAIN_CENSER.x, floor, cz+MAIN_CENSER.z);
  incense.scale.setScalar(MAIN_CENSER.scale);
  incense.position.set((cx+MAIN_CENSER.x)*(1-MAIN_CENSER.scale),floor*(1-MAIN_CENSER.scale),
    (cz+MAIN_CENSER.z)*(1-MAIN_CENSER.scale));
  group.add(incense);

  // Keep additional illumination cheap: these small lights do not cast
  // shadows and are contained in the hall group.
  const altarLight = new THREE.PointLight(0xffbc70, 13, 16, 2);
  altarLight.position.set(cx, floor + 3.6, cz - 3.0);
  group.add(altarLight);
  for (const side of [-1, 1]) {
    const light = new THREE.PointLight(0xffe5be, 6, 8, 2);
    light.position.set(cx + side * 9, floor + 3.2, cz + .2);
    group.add(light);
  }

  for (const role of Object.keys(pooled) as Role[]) {
    if (!pooled[role].length) continue;
    const original = merge(pooled[role]);
    const geo = role === 'lacquer' ? projectedTempleUV(original, 2.4)
      : role === 'darkWood' || role==='teal' ? projectedTempleUV(original, .9) : original;
    if(role==='lacquer'||role==='darkWood'||role==='teal') {
      bakeSurfaceFinish(geo,'wood',floor);materials[role].vertexColors=true;
    }
    const mesh = new THREE.Mesh(geo, materials[role]);
    mesh.name = 'hall-structure-' + role;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Keep the authored interior coherent with the larger shell. The outer
  // editable group stays identity so stale editor snapshots cannot undo this.
  const layout=new THREE.Group();layout.name='main-hall-expanded-layout';
  const {x:sx,z:sz}=MAIN_HALL_SCALE;
  const preserve=(object:THREE.Object3D,anchor:THREE.Vector3)=>{
    const pivot=new THREE.Group();pivot.name=`${object.name}-proportion-pivot`;
    pivot.position.copy(anchor);pivot.scale.set(1/sx,1,1/sz);
    object.position.sub(anchor);group.remove(object);pivot.add(object);group.add(pivot);
  };
  for(const object of [...group.children]) {
    if(object instanceof THREE.LOD||object.name==='hall-statue-halo'||object.name==='hall-exterior-round-window'||
      (object instanceof THREE.Mesh&&object.geometry.type==='RingGeometry'))
      preserve(object,object.position.clone());
  }
  preserve(incense,new THREE.Vector3(cx+MAIN_CENSER.x,floor,cz+MAIN_CENSER.z));
  for(const object of [...group.children]){group.remove(object);layout.add(object);}
  layout.scale.set(sx,1,sz);layout.position.set(cx*(1-sx),0,cz*(1-sz));
  group.add(layout);
  group.userData.expandedLayout={width:MAIN_HALL.w,depth:MAIN_HALL.d,centerZ:cz,statueProportionsPreserved:true};
  return group;
}

function placeScan(source: THREE.Object3D, material: THREE.Material, scale: number,
  x: number, bottom: number, z: number) {
  const root = source.clone(true);
  root.rotation.x = Math.PI / 2;
  root.scale.setScalar(.027 * scale);
  root.position.set(0, 0, 0);
  root.traverse(object => {
    if (object instanceof THREE.Mesh) object.material = material;
  });
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  root.position.set(
    x - (bounds.min.x + bounds.max.x) / 2,
    bottom - bounds.min.y,
    z - (bounds.min.z + bounds.max.z) / 2,
  );
  return root;
}

function makeHaloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const c = 256;
  const ring = (r: number, width: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
  };
  ring(218, 14, '#76511e');
  ring(202, 5, '#edc66c');
  ring(174, 8, '#9b6c2d');
  ring(166, 4, '#f4d787');
  ring(92, 5, '#d5a64e');
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI * 2 / 32;
    ctx.save(); ctx.translate(c, c); ctx.rotate(a);
    ctx.fillStyle = i % 2 ? '#a77330' : '#dcad55';
    ctx.beginPath();
    ctx.moveTo(0, -178);
    ctx.quadraticCurveTo(14, -198, 0, -216);
    ctx.quadraticCurveTo(-14, -198, 0, -178);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI * 2 / 16;
    ctx.save(); ctx.translate(c, c); ctx.rotate(a);
    ctx.fillStyle = '#bd873a';
    ctx.beginPath(); ctx.ellipse(0, -119, 13, 39, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeCarpetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6f2520'; ctx.fillRect(0, 0, 384, 1024);
  for (let i = 0; i < 4800; i++) {
    const x = (Math.imul(i, 1597334677) >>> 0) % 384;
    const y = (Math.imul(i, 3812015801) >>> 0) % 1024;
    ctx.fillStyle = i % 3 ? '#8c332a22' : '#32141322';
    ctx.fillRect(x, y, 2, 5);
  }
  for (const x of [18, 31, 353, 366]) {
    ctx.fillStyle = '#b48a49'; ctx.fillRect(x, 0, x === 18 || x === 366 ? 3 : 7, 1024);
  }
  ctx.strokeStyle = '#aa7c43'; ctx.lineWidth = 3;
  for (const x of [43, 341]) for (let y = 0; y < 1024; y += 32) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x < 100 ? 11 : -11), y + 16);
    ctx.lineTo(x, y + 32); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeIncenseBurner(bronze: THREE.Material, gold: THREE.Material,
  x: number, floor: number, z: number) {
  const group = new THREE.Group();
  group.name = 'hall-tripod-incense-burner';
  const profile = MAIN_CENSER_PROFILE.map(([radius,y])=>new THREE.Vector2(radius,y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), bronze);
  bowl.position.set(x, floor + .4, z);
  group.add(bowl);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(.88, .055, 8, 32), gold);
  lip.rotation.x = Math.PI / 2;
  lip.position.set(x, floor + 1.2, z);
  group.add(lip);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.08, .13, .43, 9), bronze);
    leg.position.set(x + Math.cos(a) * .58, floor + .28, z + Math.sin(a) * .58);
    group.add(leg);
  }
  for (const side of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.22, .055, 8, 20), bronze);
    handle.position.set(x + side * 1.03, floor + 1.04, z);
    group.add(handle);
  }
  return group;
}
