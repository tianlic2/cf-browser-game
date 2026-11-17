import * as THREE from 'three';
import { box, cyl, merge, projectedTempleUV } from './geom';
import { porchBeamPainting, porchBrackets } from './main_hall_brackets';
import { inlaidPaving, sanctumJoinery } from './main_hall_sanctum';
import { WORLD } from './heightfield';
import { woodMaterial, dougongMaterial } from './materials';
import { bakeSurfaceFinish } from './surface_finish';
import type { Temple } from './temple';
import { MAIN_HALL, MAIN_HALL_FLOOR_Y, MAIN_HALL_RAISE, MAIN_HALL_SCALE, MAIN_PORTAL, mainPortalTimbers } from '../../../scripts/lingyin_main_hall.js';
import { flameAureole } from './flame_aureole';
import { sculptedTempleBuddha } from './buddha_sculpture';
import { hallPerimeterColumns, MAIN_INTERIOR_COLUMNS, MAIN_COLUMN_PARTS, MAIN_CENSER, MAIN_CENSER_PROFILE,OFFERING_TABLE,MAIN_SHRINE,MAIN_HALL_FIXTURES } from '../../../scripts/lingyin_columns.js';

export type MainHallStudyAssets = {
  coffer: THREE.Texture;
  paintedBeam: THREE.Texture;
  redLacquer: THREE.Texture;
  stoneFloor: THREE.Texture;
  carvedAltar: THREE.Texture;
  redRoof: THREE.Texture;
  sanctumCraft: THREE.Texture;
  giltLeaf: THREE.Texture;
  chasedDetail: THREE.Texture;
  centralRobe: THREE.Texture;
  aureoleArt: THREE.Texture;
  altarStone: THREE.Texture;
};

// The preview and the FPS map share one authored hall so the reviewed
// facade and interior remain visually identical after integration.
export function createMainHallInterior(temple: Temple, assets: MainHallStudyAssets) {
  const group = new THREE.Group();
  group.name = 'lingyin-main-hall-interior';
  const cx = WORLD.temple.x, cz = WORLD.temple.z;
  const floor = WORLD.platform.y + MAIN_HALL_FLOOR_Y;
  // Preview-only taller eave: the original 5 m interior compressed the
  // columns, windows and three-figure altar into one low horizontal band.
  const ceiling = WORLD.platform.y + 9.72 + MAIN_HALL_RAISE;
  // The shell retains metre-sized wall insets. Compensate before the layout
  // transform so the new floor and soffit still meet its inner perimeter.
  const roomW = (MAIN_HALL.w-3.25)/MAIN_HALL_SCALE.x;
  const roomD = (MAIN_HALL.d-3.25)/MAIN_HALL_SCALE.z;

  // The facade is part of the hall replacement. The original hall's
  // lower blank wall and unpainted eaves made the correctly modeled roof read
  // unlike the supplied two-storey reference.
  const eave = WORLD.platform.y + 9.9 + MAIN_HALL_RAISE;

  function addFacade() {
    const roof = temple.materials.mainRoof;
    if (roof instanceof THREE.MeshStandardMaterial) {
      roof.map = assets.redRoof;
      roof.normalMap = null;
      roof.bumpMap = assets.redRoof;
      roof.bumpScale = .035;
      roof.color.set('#c5a89f');
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
    const fasciaArt = porchBeamPainting(assets.paintedBeam);
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
      const uv=face.getAttribute('uv');
      for(let j=0;j<uv.count;j++)uv.setX(j,uv.getX(j)*Math.round(width/3.1));
      face.translate(cx,y,cz+z);paintedFaces.push(face);
    }
    const {x:sx,z:sz}=MAIN_HALL_SCALE;
    const plasterZ=(MAIN_HALL.d/2-1.35+.15)/sz;
    const frameZ=plasterZ+.064;
    // A deep lower frieze spans the column line; each bay has its own recessed
    // painted field and each capital carries the next tier on projecting arms.
    const columns=hallPerimeterColumns(MAIN_HALL).filter(c=>c.z>0 && c.z===MAIN_HALL.d/2-.9);
    const beamZ=(MAIN_HALL.d/2-.9)/sz;
    const beamY=eave-1.33;
    add('darkWood',MAIN_HALL.w/sx,.94,.63,0,beamY,beamZ);
    const outerZ=9.58*sz;
    const brackets=porchBrackets(columns.map(c=>c.x),beamZ*sz,outerZ,fasciaArt);
    brackets.scale.set(1/sx,1,1/sz);
    brackets.position.set(cx,beamY,cz+beamZ);
    group.add(brackets);
    for(let i=0;i<columns.length;i++){
      const x=columns[i].x/sx;
      if(i+1===columns.length)continue;
      const span=(columns[i+1].x-columns[i].x)/sx, mid=x+span/2;
      const face=new THREE.PlaneGeometry(span-.21,.69);
      face.translate(cx+mid,beamY,cz+beamZ+.325);paintedFaces.push(face);
      // The same bay also has painted inner and lower faces, visible when
      // walking below the beam. Its edge beads remain solid timber.
      const back=new THREE.PlaneGeometry(span-.21,.69);
      back.rotateY(Math.PI);back.translate(cx+mid,beamY,cz+beamZ-.319);
      const underside=new THREE.PlaneGeometry(span-.14,.56);
      underside.rotateX(Math.PI/2);underside.translate(cx+mid,beamY-.473,cz+beamZ);
      paintedFaces.push(back,underside);
      const soffit=new THREE.PlaneGeometry(span-.05,.46);
      soffit.rotateX(Math.PI/2);soffit.translate(cx+mid,eave-.929,cz+9.52);
      add('darkWood',span,.16,.49,mid,eave-.845,9.52);
      paintedFaces.push(soffit);
      for(const dy of [-.395,.395])add('teal',span,.075,.075,mid,beamY+dy,beamZ+.34);
      add('gilt',.075,.74,.07,x+.09,beamY,beamZ+.34);
    }
    // Carry the painted fascia around the corners, visible on oblique approaches.
    for(const side of [-1,1]){
      const face=new THREE.PlaneGeometry(25.4/sz,.70);
      const uv=face.getAttribute('uv');
      for(let j=0;j<uv.count;j++)uv.setX(j,uv.getX(j)*7);
      face.rotateY(side*Math.PI/2);
      const x=side*(MAIN_HALL.w/2+.38)/sx;
      face.translate(cx+x,eave-.48,cz);paintedFaces.push(face);
      add('teal',.14,.82,25.4/sz,x-side*.085,eave-.48,0);
    }
    const paintedEaves=new THREE.Mesh(merge(paintedFaces),painted);
    paintedEaves.name='hall-exterior-painted-eaves';paintedEaves.receiveShadow=true;group.add(paintedEaves);

    // Backed lattice in circular openings, forward of the lime coat. Shorten
    // every member to its chord so the ends die into the circular wood rebate.
    for(const x of [-9.2,9.2]){
      const y=floor+3.18, z=plasterZ+.037;
      const disk=new THREE.Mesh(new THREE.CircleGeometry(1.16,48),darkWood);
      disk.name='hall-exterior-round-window';disk.position.set(cx+x,y,cz+z);group.add(disk);
      const rim=new THREE.Mesh(new THREE.RingGeometry(1.12,1.25,48),gilt);
      rim.position.set(cx+x,y,cz+z+.066);group.add(rim);
      for(const d of [-.81,-.54,-.27,0,.27,.54,.81]){
        const chord=2*Math.sqrt(1.13**2-d**2);
        add('teal',.042, chord,.044,x+d/sx,y,z+.041);
        add('teal',chord/sx,.045,.042,x,y+d,z+.032);
      }
    }

    // Work in physical metres so both the reveals and inward-open leaves
    // meet the collision surfaces after the interior's nonuniform expansion.
    const timber=(role:Role,w:number,h:number,d:number,x:number,y:number,z:number)=>
      add(role,w/sx,h,d/sz,x/sx,floor+y,z/sz);
    for(const p of mainPortalTimbers())timber(p.role==='lacquer'?'portalWood':p.role,p.w,p.h,p.d,p.x,p.y,p.z);
    const {halfClear,clearHeight,wallZ,leafDepth}=MAIN_PORTAL;
    timber('gilt',2*halfClear+.84,.044,.674,0,clearHeight+.13,wallZ);
    // Back-to-back stepped fretwork reads from both the stairs and the nave.
    for(const side of [-1,1]){
      for(let i=0;i<6;i++){
        const cell=halfClear/6,x=side*(i+.5)*cell,y=clearHeight+.795;
        timber('teal',.055,.81,.10,x,y,wallZ);
        timber('teal',cell-.055,.064,.10,x+side*cell/2,y+.14,wallZ);
        timber('portalWood',.062,.29,.12,x+side*cell*.70,y-.005,wallZ);
        timber('teal',cell*.31,.057,.11,x+side*cell*.55,y-.15,wallZ);
      }
      // Raised fielded panels, perimeter nails and a bronze ring on each
      // open door. Details face the aisle and stay against the solid leaf.
      const x=side*halfClear,midZ=wallZ-.08-leafDepth/2;
      for(const face of [-1,1]){
        const fx=x+side*(face===1?MAIN_PORTAL.leafThickness+.022:-.022);
        for(const y of [.25,2.08,4.95,clearHeight-.22])
          timber('darkWood',.045,.14,leafDepth-.14,fx,y,midZ);
        for(const dz of [-1.62,1.62])
          timber('darkWood',.046,clearHeight-.20,.13,fx,clearHeight/2,midZ+dz);
        for(let row=0;row<3;row++)for(let col=0;col<5;col++){
          const stud=new THREE.SphereGeometry(.058,10,7).scale(.56/sx,1,1/sz);
          stud.translate(cx+fx/sx,floor+2.50+row*.80,cz+(midZ+(col-2)*.62)/sz);
          pooled.bronze.push(stud);
        }
      }
      const pullZ=wallZ-leafDepth+.47;
      timber('bronze',.048,.32,.24,x-side*.044,1.65,pullZ);
      const ring=new THREE.TorusGeometry(.108,.022,8,24).rotateY(Math.PI/2).scale(1/sx,1,1/sz);
      ring.translate(cx+(x-side*.085)/sx,floor+1.54,cz+pullZ/sz);pooled.bronze.push(ring);
    }
    // Four leaves per closed flank. Their fielded skirts are solid timber;
    // only the upper portions carry lattice. The central entrance stays open.
    for(const side of [-1,1]){
      const bayX=side*MAIN_PORTAL.flankX/sx, leafW=.96;
      for(let n=0;n<4;n++){
        const x=bayX+(n-1.5)*leafW;
        add('darkWood',leafW-.012,5.04,.10,x,floor+2.54,frameZ);
        for(const dx of [-.445,.445])
          add('lacquer',.072,5.04,.09,x+dx,floor+2.54,frameZ+.063);
        for(const h of [.12,1.48,1.98,4.96])
          add('lacquer',leafW-.11,.14,.085,x,floor+h,frameZ+.066);
        add('lacquer',.66,1.08,.065,x,floor+.81,frameZ+.057);
        add('lacquer',.67,.28,.063,x,floor+1.73,frameZ+.055);
        for(const dx of [-.28,-.14,0,.14,.28])
          add('lacquer',.035,2.83,.04,x+dx,floor+3.48,frameZ+.076);
        for(let j=0;j<12;j++)
          add('lacquer',.80,.033,.04,x,floor+2.15+j*.236,frameZ+.062);
      }
      for(const dx of [-2.01,2.01])add('lacquer',.17,5.30,.18,bayX+dx,floor+2.65,frameZ+.016);
      add('lacquer',4.18,.20,.19,bayX,floor+5.24,frameZ+.016);
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
  // A large door reads as intact lacquer. Modulate the old paint only lightly;
  // its bare patches are appropriate at pillar scale but dwarf a door fitting.
  const portalWood=new THREE.MeshStandardMaterial({name:'hall-portal-cinnabar',map:assets.redLacquer,
    color:0xffffff,roughness:.59,metalness:.045});
  portalWood.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float woodValue=dot(diffuseColor.rgb,vec3(.27,.62,.11));
      diffuseColor.rgb=vec3(.235,.034,.017)*(.80+.46*sqrt(clamp(woodValue,0.,1.)));
    `);
  };
  portalWood.customProgramCacheKey=()=>'hall-portal-painted-timber';
  const altarTimber=darkWood.clone();
  altarTimber.name='hall-rubbed-altar-hardwood';altarTimber.color.setHex(0xe1c0a5);
  altarTimber.roughness=.51;
  altarTimber.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\ndiffuseColor.rgb=vec3(.060,.023,.011)+diffuseColor.rgb*.76;');
  };
  altarTimber.customProgramCacheKey=()=>'hall-altar-waxed-hardwood';
  const altarStone=new THREE.MeshStandardMaterial({name:'hall-honed-altar-limestone',
    map:assets.altarStone,color:0xe1d6bd,roughness:.77});
  const materials = { lacquer, darkWood, teal, gilt, bronze, portalWood, altarTimber, altarStone };
  type Role = keyof typeof materials;
  const pooled: Record<Role, THREE.BufferGeometry[]> = {
    lacquer: [], darkWood: [], teal: [], gilt: [], bronze: [], portalWood: [], altarTimber: [], altarStone: [],
  };
  const add = (role: Role, w: number, h: number, d: number,
    x: number, y: number, z: number) =>
    pooled[role].push(box(w, h, d, cx + x, y, cz + z));
  const addCyl = (role: Role, rt: number, rb: number, h: number,
    x: number, y: number, z: number, sides = 24) =>
    pooled[role].push(cyl(rt, rb, h, sides, cx + x, y, cz + z));
  addFacade();

  const floorMat=inlaidPaving(assets.altarStone,roomW-.08,roomD-.08);
  floorMat.vertexColors=false;
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW - .08, roomD - .08), floorMat);
  floorMesh.name = 'hall-stone-floor';
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(cx, floor + .04, cz);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  add('darkWood',roomW-.08,.16,roomD-.08,0,ceiling+.12,0);
  group.add(sanctumJoinery(assets.sanctumCraft,assets.coffer,assets.altarStone,cx,cz,floor,ceiling,roomW,roomD));
  // Three pairs of massive lacquered columns. Stone shoes and layered
  // bracket arms visibly transfer the roof load to the shafts.
  for (const [x, z] of MAIN_INTERIOR_COLUMNS) {
    for(const part of MAIN_COLUMN_PARTS)
      addCyl(part.role,part.rt,part.rb,part.h,x,WORLD.platform.y+MAIN_HALL_RAISE+part.y,z,part.segments);
    for (let layer = 0; layer < 3; layer++) {
      const y = ceiling - .44 + layer * .16;
      const reach = .85 + layer * .25;
      add('teal', 2 * reach, .16, .58, x, y, z);
      add('teal', .62, .16, 2 * reach, x, y + .07, z);
      add('gilt', 2 * reach, .025, .06, x, y - .09, z + .29);
    }
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
  for(const part of MAIN_HALL_FIXTURES){
    const role=part.name.startsWith('altar-stone-')?'altarStone':
      part.name.startsWith('altar-')?'altarTimber':part.role;
    add(role,part.w,part.h,part.d,part.x,floor+part.y,part.z);
  }
  add('teal', 18.0, .8, .42, 0, ceiling - .65, -6.23);
  for (const x of [-MAIN_SHRINE.pitch, 0, MAIN_SHRINE.pitch]) {
    const mid=x===0;
    const halo=flameAureole(assets.aureoleArt);
    halo.position.set(cx+x, floor+5.06, cz+MAIN_SHRINE.backZ+.43);
    group.add(halo);
    const figure = sculptedTempleBuddha(x===0?0:x<0?1:2,assets.giltLeaf,assets.chasedDetail,assets.centralRobe);
    figure.scale.setScalar(MAIN_SHRINE.scale);
    figure.position.set(cx+x,floor+MAIN_SHRINE.seatY,cz+MAIN_SHRINE.statueZ);
    figure.name = mid ? 'hall-central-buddha' : 'hall-flanking-buddha';
    group.add(figure);
  }

  const table=OFFERING_TABLE;
  // Front and end rails meet the four legs beneath an overhanging top.
  for(const side of [-1,1]){
    // Curved spandrels join the apron to each front leg without closing the opening.
    const bracket=new THREE.Shape();
    bracket.moveTo(0,0);bracket.lineTo(.54,0);bracket.lineTo(.54,-.047);
    bracket.bezierCurveTo(.43,-.046,.43,-.127,.325,-.12);
    bracket.bezierCurveTo(.22,-.107,.175,-.218,.12,-.268);
    bracket.lineTo(0,-.268);bracket.closePath();
    const cheek=new THREE.ExtrudeGeometry(bracket,{depth:.078,bevelEnabled:true,
      bevelThickness:.008,bevelSize:.009,bevelSegments:2,curveSegments:10});
    if(side>0)cheek.rotateY(Math.PI);
    cheek.translate(cx+side*table.legX,floor+table.top-.188,cz+table.z+table.legZ+(side>0?.039:-.039));
    pooled.altarTimber.push(cheek);
    add('altarTimber',.08,.14,2*table.legZ,side*table.legX,floor+table.top-.15,table.z);
    for(const end of [-1,1]){
      const x=side*table.legX,z=table.z+end*table.legZ;
      add('altarTimber',.24,.072,.22,x,floor+.08,z);
      add('altarTimber',.215,.045,.204,x,floor+table.top-.26,z);
    }
  }
  add('altarTimber',table.w-.06,.036,.041,0,floor+table.top-.065,table.z+table.d/2);
  const carvedArt = assets.carvedAltar.clone();
  carvedArt.wrapS = THREE.RepeatWrapping;
  carvedArt.repeat.set(2, 1);
  carvedArt.needsUpdate = true;
  const altarFront = new THREE.Mesh(new THREE.PlaneGeometry(2*table.legX-.20,.14),
    new THREE.MeshStandardMaterial({name:'hall-carved-altar-front', map: carvedArt,
      color:0xf1dcc3,bumpMap:carvedArt,bumpScale:.006,roughness:.56,metalness:.025,side:THREE.DoubleSide}));
  altarFront.name='hall-carved-altar-front';
  altarFront.position.set(cx, floor+table.top-.155, cz+table.z+table.legZ+.041);
  group.add(altarFront);
  // Small offering cups share the top of the front table with the censer.
  for(const x of [-1.74,-.99,.99,1.74]){
    addCyl('bronze',.095,.13,.054,x,floor+table.top+.027,table.z-.06,20);
    addCyl('gilt',.075,.051,.091,x,floor+table.top+.0995,table.z-.06,16);
    addCyl('bronze',.134,.072,.091,x,floor+table.top+.1905,table.z-.06,24);
  }
  // A projecting crown and an inset fascia read separately under each knee.
  for(const x of [-MAIN_SHRINE.pitch,0,MAIN_SHRINE.pitch]){
    const front=MAIN_SHRINE.statueZ+1.315;
    add('darkWood',4.66,.052,.072,x,floor+.976,front);
    add('bronze',4.48,.022,.042,x,floor+.927,front+.006);
    add('darkWood',4.52,.066,.058,x,floor+.674,front);
  }
  const incense = makeIncenseBurner(bronze, gilt, cx+MAIN_CENSER.x, floor, cz+MAIN_CENSER.z);
  incense.scale.setScalar(MAIN_CENSER.scale);
  incense.position.set((cx+MAIN_CENSER.x)*(1-MAIN_CENSER.scale),floor*(1-MAIN_CENSER.scale)+MAIN_CENSER.baseY,
    (cz+MAIN_CENSER.z)*(1-MAIN_CENSER.scale));
  group.add(incense);

  // The three local fittings wash down the statues. A soft cone keeps
  // light off the coffer above them and lets the side returns fall away.
  for(const bay of [-MAIN_SHRINE.pitch,0,MAIN_SHRINE.pitch]){
    const light=new THREE.SpotLight(bay>0?0xffe7cc:0xffdfb7, bay===0?51:46, 13, .59, .83, 2);
    light.name='hall-statue-wash';
    light.position.set(cx+bay-1.42,floor+7.62,cz-2.32);
    light.target.position.set(cx+bay,floor+4.69,cz+MAIN_SHRINE.statueZ);
    if(bay===0){
      light.position.set(cx-1.58,floor+7.68,cz-2.06);
      light.target.position.set(cx,floor+5.58,cz+MAIN_SHRINE.statueZ);
      light.angle=.615;light.penumbra=.80;light.intensity=61;
    }
    if(bay<0){
      light.position.set(cx+bay-1.94,floor+7.84,cz-1.96);
      light.target.position.set(cx+bay,floor+5.58,cz+MAIN_SHRINE.statueZ);
      light.angle=.65;light.penumbra=.88;light.intensity=82;
    }
    group.add(light,light.target);
  }

  for (const role of Object.keys(pooled) as Role[]) {
    if (!pooled[role].length) continue;
    const original = merge(pooled[role]);
    const geo = role === 'lacquer' || role==='portalWood' ? projectedTempleUV(original, 2.4)
      : role==='altarStone' ? projectedTempleUV(original,1.36)
      : role === 'darkWood' || role==='teal' || role==='altarTimber' ? projectedTempleUV(original, .9) : original;
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
