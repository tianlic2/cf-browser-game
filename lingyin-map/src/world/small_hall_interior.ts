import * as THREE from 'three';
import { SMALL_HALLS, smallHallFurnitureBounds, type SmallHallFurniture } from '../../../scripts/lingyin_small_halls.js';
import { box, cyl, merge, projectedTempleUV } from './geom';
import { ricePaperTexture } from './materials';
import { WORLD } from './heightfield';
import type { Temple } from './temple';

type Assets = {stoneFloor:THREE.Texture;paintedBeam:THREE.Texture;carvedAltar:THREE.Texture;mural:THREE.Texture};
type Role = 'timber'|'plaster'|'floor'|'paper'|'paint'|'carving'|'mural'|'glow';

/** The remaining side rooms share eight batches and existing texture downloads. */
export function createSmallHallInteriors(temple:Temple,assets:Assets) {
  const group=new THREE.Group();group.name='lingyin-small-hall-interiors';
  const buckets:Record<Role,THREE.BufferGeometry[]>={timber:[],plaster:[],floor:[],paper:[],paint:[],carving:[],mural:[],glow:[]};
  const timber=(temple.materials.woodDark as THREE.MeshStandardMaterial).clone();
  timber.name='small-hall-worn-timber';timber.color.set('#e0c5a9');timber.roughness=.84;timber.vertexColors=true;
  const plaster=(temple.materials.wall as THREE.MeshStandardMaterial).clone();
  plaster.name='small-hall-limewash';plaster.color.set('#dfd7be');plaster.vertexColors=true;
  plaster.map=ricePaperTexture();plaster.bumpMap=plaster.map;plaster.bumpScale=.009;
  plaster.normalMap=null;plaster.roughnessMap=null;plaster.roughness=.98;
  const floor=new THREE.MeshStandardMaterial({name:'small-hall-aged-stone',map:assets.stoneFloor,
    bumpMap:assets.stoneFloor,bumpScale:.022,color:0xe6dfcf,roughness:.92,vertexColors:true});
  const paper=new THREE.MeshStandardMaterial({name:'small-hall-paper-and-woven-fabric',map:ricePaperTexture(),
    bumpMap:ricePaperTexture(),bumpScale:.006,roughness:.94,vertexColors:true});
  // Use the already-uploaded main-hall map objects, not fresh clones with a new
  // GPU allocation. The art planes below compensate for their 8x / 5x repeat.
  const sharedMap=(name:string,fallback:THREE.Texture)=>
    ((temple.group.getObjectByName(name) as THREE.Mesh|undefined)?.material as THREE.MeshStandardMaterial|undefined)?.map??fallback;
  const paintMap=sharedMap('hall-painted-crossbeams',assets.paintedBeam);
  const carvingMap=sharedMap('hall-carved-altar-front',assets.carvedAltar);
  const materials:Record<Role,THREE.MeshStandardMaterial>={timber,plaster,floor,paper,
    paint:new THREE.MeshStandardMaterial({name:'small-hall-painted-frieze',map:paintMap,color:0xc1b59b,roughness:.9}),
    carving:new THREE.MeshStandardMaterial({name:'small-hall-carved-apron',map:carvingMap,color:0xb2a38c,roughness:.87}),
    mural:new THREE.MeshStandardMaterial({name:'small-hall-antique-lotus-art',map:assets.mural,color:0xc5b48d,roughness:.96}),
    glow:new THREE.MeshStandardMaterial({name:'small-hall-lantern-paper',color:0xe5c68d,emissive:0xffbb5f,emissiveIntensity:.8,roughness:.92}),
  };
  const tint=(g:THREE.BufferGeometry,color:THREE.ColorRepresentation)=>{
    const c=new THREE.Color(color),p=g.attributes.position,colors=new Uint8Array(p.count*3);
    for(let i=0;i<p.count;i++){
      // Very restrained baked contact shading; never bake the outside moss into an interior.
      const shade=.94+.06*Math.max(0,g.attributes.normal.getY(i));
      colors.set([Math.round(c.r*shade*255),Math.round(c.g*shade*255),Math.round(c.b*shade*255)],i*3);
    }
    g.setAttribute('color',new THREE.BufferAttribute(colors,3,true));return g;
  };
  for(const hall of SMALL_HALLS) {
    const y=hall.plinth+.25,hw=hall.w/2-1.35-.18,hd=hall.d/2-1.35-.18;
    const ceiling=hall.eave-hall.plinth-.38,wallHeight=ceiling-y;
    const emit=(role:Role,g:THREE.BufferGeometry,color:THREE.ColorRepresentation=0xffffff)=>{
      if(role==='timber'||role==='plaster')g=projectedTempleUV(g,role==='timber'?.8:2.4);
      if(role==='paint'||role==='carving'){
        const map=materials[role].map!,uv=g.getAttribute('uv');
        // Recover the face width before world transformation (all art is a plane).
        g.computeBoundingBox();const width=g.boundingBox!.getSize(new THREE.Vector3()).length();
        const repeats=Math.max(1,width/2.8);
        for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)*repeats-map.offset.x)/map.repeat.x,
          (uv.getY(i)-map.offset.y)/map.repeat.y);
      }
      if(materials[role].vertexColors&&!g.hasAttribute('color'))tint(g,color);
      g.rotateY(hall.rot);g.translate(hall.x,WORLD.platform.y,hall.z);buckets[role].push(g);
    };
    const b=(role:Role,w:number,h:number,d:number,x:number,cy:number,z:number,color?:THREE.ColorRepresentation)=>
      emit(role,box(w,h,d,x,cy,z),color);
    const face=(role:Role,w:number,h:number,x:number,cy:number,z:number,rot=0,color?:THREE.ColorRepresentation)=>{
      const g=new THREE.PlaneGeometry(w,h);g.rotateY(rot);g.translate(x,cy,z);emit(role,g,color);
    };
    // One lightly tessellated surface, not a box for every stone. Shared photograph
    // already repeats 7 x 4 in the main hall; compensate in UVs, not texture clones.
    const paving=new THREE.PlaneGeometry(hw*2,hd*2,Math.ceil(hw*2/.8),Math.ceil(hd*2/.8));
    paving.rotateX(-Math.PI/2);paving.translate(0,y+.034,0);
    const uv=paving.attributes.uv,pos=paving.attributes.position;
    for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/(3.3*assets.stoneFloor.repeat.x),pos.getZ(i)/(3.3*assets.stoneFloor.repeat.y));
    tint(paving,0xffffff);
    const colors=paving.getAttribute('color'),bounds=hall.furniture.map(smallHallFurnitureBounds);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),edge=Math.min(hw-Math.abs(x),hd-Math.abs(z));
      let shade=.88+.12*Math.min(1,edge/.4);
      for(const p of bounds){
        const distance=Math.hypot(Math.max(0,Math.abs(x-p.x)-p.hx),Math.max(0,Math.abs(z-p.z)-p.hz));
        shade=Math.min(shade,.76+.24*Math.min(1,distance/.35));
      }
      colors.setXYZ(i,colors.getX(i)*shade,colors.getY(i)*shade,colors.getZ(i)*shade);
    }
    emit('floor',paving);
    // Thin interior limewash over the coarse exterior masonry; no coplanar overlays.
    for(const side of [-1,1]) {
      b('plaster',.04,wallHeight,hd*2,side*(hw+.035),y+wallHeight/2,0);
      b('timber',.065,.52,hd*2,side*(hw-.003),y+.26,0,0xbab1a3);
      b('timber',.085,.07,hd*2,side*(hw-.02),y+.55,0);
      for(const z of [-hd*.6,0,hd*.6]){
        b('timber',.07,wallHeight,.085,side*(hw-.025),y+wallHeight/2,z);
      }
      // Paper windows with a clear frame and sparse lattice, not dozens of tiny bars.
      for(const z of hall.name==='rear'?[-.1]:[-3.3,3.3]) {
        const w=hall.name==='rear'?2:2.15,h=1.15,cy=y+1.88,x=side*(hw-.075),rot=-side*Math.PI/2;
        face('paper',w,h,x,cy,z,rot,0xdad0ae);
        for(const depth of [-1,1])b('timber',.09,.075,w+.16,x,y+1.88+depth*(h/2+.035),z);
        for(let k=-3;k<=3;k++)b('timber',.095,h,.035,x-side*.014,cy,z+k*w/7);
        b('timber',.095,.035,w,x-side*.014,cy,z);
      }
    }
    for(const end of [-1,1]) {
      const open=end>0||hall.name==='west',gap=hall.name==='rear'?4.6:3.4;
      const segments=open?[-1,1]:[0];
      for(const side of segments){
        const width=open?hw-gap/2:hw*2,x=open?side*(gap/2+width/2):0;
        b('plaster',width,wallHeight,.04,x,y+wallHeight/2,end*(hd+.035));
        b('timber',width,.52,.065,x,y+.26,end*(hd-.003),0xbab1a3);
        b('timber',width,.07,.085,x,y+.55,end*(hd-.02));
      }
    }
    // Close the bare roof underside with boards, exposed tie beams and a restrained
    // painted band. These are high above the player; no new collision ceiling needed.
    b('timber',hw*2+.12,.09,hd*2+.12,0,ceiling+.045,0,0xbeb7a6);
    const beamZ=hall.name==='rear'?[-2,1.8]:[-4.4,0,4.4];
    for(const z of beamZ){
      b('timber',hw*2,.18,.22,0,ceiling-.09,z);
      face('paint',hw*2-.35,.16,0,ceiling-.1,z+.114);
    }
    for(const x of [-hw*.66,-hw*.33,0,hw*.33,hw*.66])
      b('timber',.055,.07,hd*2,x,ceiling-.07,0,0xc3baa6);
    // Lantern has a timber housing, amber paper and suspension; the room keeps
    // its single existing point light rather than adding a light per decoration.
    const ly=ceiling-.5;
    b('timber',.035,.26,.035,0,ceiling-.18,0);
    b('glow',.36,.38,.36,0,ly,0);
    for(const side of [-1,1]){
      b('timber',.48,.065,.48,0,ly+side*.22,0);
      for(const depth of [-1,1])b('timber',.035,.43,.035,side*.195,ly,depth*.195);
    }
    for(const piece of hall.furniture)buildFurniture(piece,y,emit);
    if(hall.name!=='west') {
      const w=hall.name==='rear'?5.1:3.8,h=hall.name==='rear'?2.65:2.12,cy=y+(hall.name==='rear'?2.05:1.7),z=-hd+.075;
      b('timber',w+.22,h+.22,.085,0,cy,z);
      face('paper',w+.09,h+.09,0,cy,z+.047,0,0xc8b68d);
      face('mural',w,h,0,cy,z+.053);
    }
  }
  let triangles=0;
  for(const role of Object.keys(buckets) as Role[]){
    const geometry=merge(buckets[role]);
    const mesh=new THREE.Mesh(geometry,materials[role]);mesh.name=`small-halls-${role}`;
    mesh.receiveShadow=true;
    // Large shells already cast the room's shadow. Tiny books and frames should
    // not add another shadow pass for the whole map.
    mesh.castShadow=false;group.add(mesh);
    triangles+=(geometry.index?.count||geometry.attributes.position.count)/3;
  }
  group.userData={halls:SMALL_HALLS.length,batches:group.children.length,triangles,addedLights:0,addedDownloads:0};
  return group;
}

type Emit=(role:Role,g:THREE.BufferGeometry,color?:THREE.ColorRepresentation)=>void;
function buildFurniture(p:SmallHallFurniture,y:number,emit:Emit){
  const put=(role:Role,g:THREE.BufferGeometry,color?:THREE.ColorRepresentation)=>{
    g.rotateY(p.rot);g.translate(p.x,y,p.z);emit(role,g,color);
  };
  const b=(role:Role,w:number,h:number,d:number,x:number,cy:number,z:number,color?:THREE.ColorRepresentation)=>put(role,box(w,h,d,x,cy,z),color);
  const face=(role:Role,w:number,h:number,x:number,cy:number,z:number,color?:THREE.ColorRepresentation)=>
    put(role,new THREE.PlaneGeometry(w,h).translate(x,cy,z),color);
  const {w,d,h}=p;
  if(p.kind==='bookcase'){
    b('timber',w-.06,h-.08,.045,0,h/2,-d/2+.04,0x827568);
    for(const side of [-1,1])b('timber',.075,h,d,side*(w/2-.038),h/2,0);
    for(let shelf=0;shelf<4;shelf++){
      const sy=.13+shelf*(h-.2)/3;
      b('timber',w,.065,d,0,sy,0);
      if(shelf===3)continue;
      for(let bundle=0;bundle<4;bundle++){
        const x=-w/2+.31+bundle*(w-.6)/3,bh=.24+((bundle+shelf)%3)*.055;
        b('paper',.36,bh,d-.15,x,sy+.04+bh/2,.015,[0xbfb08c,0xa1a998,0x987c62][(bundle+shelf)%3]);
        // Stacked thread-bound folios: shallow edge bands, not separate book meshes.
        for(let line=1;line<=3;line++)face('paper',.34,.012,x,sy+.06+line*bh/4,d/2-.048,0xddd0ab);
        face('paper',.032,bh+.005,x+.075,sy+.04+bh/2,d/2-.044,0x5a5141);
      }
    }
    b('timber',w+.12,.08,d+.08,0,h,0);
  }else if(p.kind==='bench'){
    b('timber',w,.09,d,0,.43,0);
    b('timber',w,.14,.065,0,.78,-d/2+.04);
    for(const side of [-1,1])for(const depth of [-1,1])b('timber',.07,.4,.075,side*(w/2-.12),.2,depth*(d/2-.1));
    for(const side of [-1,1])b('timber',.055,.45,.055,side*(w/2-.12),.64,-d/2+.04);
    for(const side of [-1,1])b('paper',w*.37,.035,d*.7,side*w*.23,.492,0,0xa29776);
  }else{
    // Furniture remains within its shared collision footprint, including the
    // stone-top cabinets and altar apron; no freestanding props in the aisle.
    const top=h-.07;
    for(const side of [-1,1])for(const depth of [-1,1])b('timber',.105,top-.09,.105,side*(w/2-.12),(top-.09)/2,depth*(d/2-.12));
    b('timber',w,.1,d,0,top,0);
    b('timber',w-.14,.16,.07,0,top-.14,d/2-.04);
    b('timber',w-.15,.055,d-.14,0,.16,0);
    if(p.kind==='cabinet'){
      b('timber',w-.16,top-.2,d-.1,0,(top+.1)/2,0);
      for(const side of [-1,1]){
        b('paper',w*.43,.42,.008,side*w*.235,.64,d/2-.045,0x8a7660);
        b('timber',.025,.09,.035,side*.07,.7,d/2-.018);
      }
    }else if(p.kind==='altar'||p.kind==='lectern'){
      face('carving',w-.3,.28,0,top-.21,d/2+.002);
      if(p.kind==='lectern'){
        // Closed folio on a sloped rest. Total height fits the .1m tabletop props.
        const folio=box(.68,.045,.36,0,0,0);folio.rotateX(-.12);folio.translate(0,h+.008,0);
        put('paper',folio,0xc8b78d);
      }else{
        for(const side of [-1,1]){
          put('timber',cyl(.12,.16,.055,10,side*w*.32,h+.01,0));
          put('paper',cyl(.1,.08,.08,10,side*w*.32,h+.065,0),0x8eacaa);
        }
      }
    }else{
      b('paper',.52,.065,.36,-w*.18,h+.01,0,0xbcb393);
      b('paper',.34,.035,.33,w*.2,h+.006,0,0x9ba38f);
    }
  }
  // The theme is deliberately conveyed by real furniture and material hierarchy,
  // not a low-poly pseudo-statue assembled from spheres and cones.
}
