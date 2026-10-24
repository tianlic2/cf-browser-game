import * as THREE from 'three';
import { box, cyl, merge, projectedTempleUV } from './geom';
import { roofMaterial, stoneMaterial, woodMaterial } from './materials';
import { boardwalkDeckMaterial, pavilionTerraceMaterial, referenceStreamMaterial, referenceWaterfallMaterial, updateReferenceWater } from './reference_materials';
import { heightAt, STREAM, streamLevel, streamT, streamWidth, WORLD } from './heightfield';
import { boardwalkLayout, type WalkPoint } from './boardwalk_layout';
import { pavilionTerraceLayout } from './pavilion_terrace';

const Y = WORLD.platform.y;
const PAVILION_ROOF_PROFILE=[[0,1.8],[.65,1.38],[1.7,.82],[2.75,.34],[3.55,.10],[4,.28]];

function beamBetween(a: THREE.Vector3, b: THREE.Vector3, width: number, height: number) {
  const delta = b.clone().sub(a);
  const geometry = new THREE.BoxGeometry(width, height, delta.length());
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), delta.clone().normalize()));
  geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geometry;
}

function landingDeck(points:WalkPoint[],depth=.3) {
  const area=points.reduce((sum,p,i)=>{
    const next=points[(i+1)%points.length];return sum+p.x*next.z-next.x*p.z;
  },0);
  // Collinear route nodes have no turn surface. Do not emit zero-area faces.
  if(Math.abs(area)<1e-6)return null;
  const shape=new THREE.Shape();
  points.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});
  geometry.rotateX(-Math.PI/2);
  geometry.translate(0,Y+points[0].y-depth,0);
  return geometry;
}

/** Eight curved roof panels with metre-scale tile UVs, not a stretched cone. */
function pavilionCanopy() {
  const profile=PAVILION_ROOF_PROFILE;
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let side=0;side<8;side++) {
    const base=positions.length/3;
    for(const [r,h] of profile)for(let edge=0;edge<2;edge++) {
      const angle=(side+edge)*Math.PI/4+Math.PI/8;
      positions.push(Math.cos(angle)*r,h,Math.sin(angle)*r);
      uvs.push((edge-.5)*2*Math.sin(Math.PI/8)*r*3,r*3);
    }
    for(let ring=0;ring<profile.length-1;ring++) {
      const a=base+ring*2,b=a+1,c=a+2,d=a+3;
      if(ring>0)indices.push(a,b,c);
      indices.push(b,d,c);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

/**
 * Shared art generator. The editor uses it without gameplay effects; the FPS
 * must go through game_landscape's explicit collision/navigation admission.
 */
export class LingyinMasterplanBlockout {
  readonly group = new THREE.Group();
  readonly westBoardwalk = new THREE.Group();
  readonly eastRiver = new THREE.Group();
  readonly eastCrossing = new THREE.Group();
  private westRoute: {x:number;z:number;y:number}[] = [];
  private westTerrace:ReturnType<typeof pavilionTerraceLayout>|null=null;

  constructor() {
    this.group.name = 'lingyin-masterplan-blockout';
    // v3 has an elevated over-wall landing. Do not replay the older draft's
    // whole-group offsets onto its newly grounded entrance and stair flight.
    this.westBoardwalk.name = 'phase1-west-boardwalk-v3';
    this.eastRiver.name = 'phase1-east-river';
    this.eastCrossing.name = 'phase1-east-crossing';
    this.group.add(this.westBoardwalk, this.eastRiver, this.eastCrossing);
    this.buildWestBoardwalk();
    this.buildEastRiver();
    this.buildEastCrossing();
  }

  update(time:number) { updateReferenceWater(time); }

  /** Grade only the isolated preview under its reviewed gallery profile. */
  fitPreviewTerrain(world:THREE.Group) {
    this.gradeBoardwalkTerrain(world);
  }

  /** Shared terrain/vegetation clearance after explicit gameplay admission. */
  gradeBoardwalkTerrain(world:THREE.Group) {
    const nearest=(x:number,z:number)=>{
      let distance=Infinity,top=Y;
      for(let i=0;i<this.westRoute.length-1;i++) {
        const a=this.westRoute[i],b=this.westRoute[i+1],dx=b.x-a.x,dz=b.z-a.z;
        const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
        const d=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
        if(d<distance){distance=d;top=Y+THREE.MathUtils.lerp(a.y,b.y,t)}
      }
      return {distance,top};
    };
    const terrain=world.getObjectByName('terrain');
    if(terrain instanceof THREE.Mesh) {
      terrain.geometry=terrain.geometry.clone();
      const positions=terrain.geometry.getAttribute('position');
      for(let i=0;i<positions.count;i++) {
        const {distance,top}=nearest(positions.getX(i),positions.getZ(i));
        const old=positions.getY(i),cut=Math.min(old,top-1.1);
        const weight=1-THREE.MathUtils.smoothstep(distance,3.6,11);
        let next=THREE.MathUtils.lerp(old,cut,weight);
        const terrace=this.westTerrace;
        if(terrace) {
          const d=terrace.signedDistance(positions.getX(i),positions.getZ(i));
          // A solid earth bench supports the entire stone terrace. Its edge
          // blends back to the hillside instead of leaving an airborne disc.
          const blend=1-THREE.MathUtils.smoothstep(d,0,10);
          next=THREE.MathUtils.lerp(next,Y+terrace.entry.y-.60,blend);
          // Raising the terrace shoulder must not refill the final stair
          // trench. Keep its outside approach below the real tread profile.
          if(d>0&&distance<3.6)next=Math.min(next,top-.70);
        }
        positions.setY(i,next);
      }
      positions.needsUpdate=true;terrain.geometry.computeVertexNormals();
      terrain.geometry.computeBoundingSphere();
    }
    // A tree's trunk and crown use the same instance origin; reserve the
    // entire root footprint so leaf cards cannot reappear through a railing.
    world.updateMatrixWorld(true);
    const inverse=new THREE.Matrix4().copy(world.matrixWorld).invert();
    const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
    // There are two different groups named "vegetation" (world forest and
    // the nested gate kit). getObjectByName only cleared the first one.
    const visited=new Set<THREE.Object3D>();
    const vegetation=world.getObjectsByProperty('name','vegetation');
    const gateTrees=world.getObjectByName('lingyin-gate-framing-trees');
    if(gateTrees)vegetation.push(gateTrees);
    for(const group of vegetation) {
      group.traverse(object=>{
        if(!(object instanceof THREE.InstancedMesh))return;
        if(visited.has(object))return;visited.add(object);
        const local=new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld);
        for(let i=0;i<object.count;i++) {
          object.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix).applyMatrix4(local);
          if(nearest(point.x,point.z).distance>4.5&&
            (!this.westTerrace||this.westTerrace.signedDistance(point.x,point.z)>3)) {
            // The raised shoulder must carry nearby forest roots/cards with
            // it, not bury their bases inside the new hill. Gate-kit foliage
            // is independently authored and is not a ground-rooted instance.
            if(group.parent===world&&this.westTerrace) {
              const terrace=this.westTerrace,d=terrace.signedDistance(point.x,point.z);
              const blend=1-THREE.MathUtils.smoothstep(d,0,10);
              const delta=(Y+terrace.entry.y-.60-heightAt(point.x,point.z))*blend;
              matrix.elements[13]+=delta;object.setMatrixAt(i,matrix);
            }
            continue;
          }
          matrix.scale(new THREE.Vector3(0,0,0));object.setMatrixAt(i,matrix);
        }
        object.instanceMatrix.needsUpdate=true;object.computeBoundingSphere();
      });
    }
  }

  private buildWestBoardwalk() {
    const timber = boardwalkDeckMaterial();
    const stone = stoneMaterial(.2);
    const darkTimber = woodMaterial(true);
    darkTimber.color.set('#c2a27f');
    const roof = roofMaterial();
    roof.name='pavilion-weathered-grey-roof';
    roof.color.set(0x969e9a);roof.roughness=.92;roof.metalness=0;
    const lantern = new THREE.MeshStandardMaterial({
      name:'boardwalk-warm-lantern-glass',color:0xffc474,
      emissive:0xffa43a,emissiveIntensity:2.8,roughness:.66});
    const deck: THREE.BufferGeometry[] = [];
    const supports: THREE.BufferGeometry[] = [];
    const footings: THREE.BufferGeometry[] = [];
    const frames: THREE.BufferGeometry[] = [];
    const lights: THREE.BufferGeometry[] = [];
    // This route is deliberately independent from the old stone mountain
    // road. It follows the reference composition: a stair rooted on the west
    // court, elevated galleries along the outer edge, then a final stair into
    // a pavilion whose base sits on the authored hillside.  Both ends are
    // therefore visibly reachable instead of terminating in mid-air.
    const nodes = [
      // The enclosure cap is 3.76m above the court. The 0.30m deck's underside
      // at 4.05m clears it by 0.29m; the outer turn is wholly beyond the cap.
      // Stairs stay inside the courtyard and climb parallel to the wall.
      {x:-31.2,z:-18,y:0},
      {x:-31.2,z:-27,y:4.35},
      {x:-39.4,z:-27,y:4.35},
      {x:-42,z:12,y:4.35},
      {x:-49,z:20,y:6.4},
      {x:-51,z:36,y:6.4},
      {x:-47,z:42,y:9},
      {x:-39.5,z:49,y:9},
      {x:-45.5,z:57,y:11.95},
      {x:-47,z:59,y:11.95},
      {x:-49.5,z:61,y:13},
    ];
    this.westRoute=nodes;
    this.westBoardwalk.userData.route=nodes;
    // Alternate explicit stairs and level galleries. These elevations follow
    // the previously verified west-ascent profile instead of cutting through
    // the graded terrain or floating below it.
    const stairSegments = new Set([0,3,5,7,9]);
    const layout=boardwalkLayout(nodes,stairSegments);
    this.westBoardwalk.userData.railLayout=layout;
    const terrace=pavilionTerraceLayout(nodes[nodes.length-1],nodes[nodes.length-2]);
    this.westTerrace=terrace;
    this.westBoardwalk.userData.terraceLayout={...terrace,signedDistance:undefined};
    for (const {a,b,stair} of layout.spans) {
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;
      const rot=Math.atan2(dx,dz);
      if (stair) {
        const steps=Math.max(5,Math.ceil(length/.48),Math.ceil(Math.abs(b.y-a.y)/.18));
        for(let step=0;step<steps;step++) {
          const t=(step+.5)/steps;
          const top=THREE.MathUtils.lerp(a.y,b.y,(step+1)/steps);
          deck.push(box(4.25,.24,length/steps,
            THREE.MathUtils.lerp(a.x,b.x,t),Y+top-.12,
            THREE.MathUtils.lerp(a.z,b.z,t),rot));
        }
      } else {
        const pa=new THREE.Vector3(a.x,Y+a.y-.15,a.z);
        const pb=new THREE.Vector3(b.x,Y+a.y-.15,b.z);
        deck.push(beamBetween(pa,pb,4.25,.3));
      }
    }
    for(const points of layout.landings) {
      const landing=landingDeck(points);if(landing)deck.push(landing);
    }

    const postKeys=new Set<string>(),postPoints:WalkPoint[]=[];
    const addPost=(p:WalkPoint,lit:boolean)=>{
      const {x,z}=p,top=Y+p.y;
      const key=[x,p.y,z].map(v=>v.toFixed(4)).join(',');
      if(postKeys.has(key)||postPoints.some(q=>Math.hypot(q.x-x,q.z-z)<.34&&Math.abs(q.y-p.y)<.1))return;
      postKeys.add(key);postPoints.push(p);
      const ground=Math.min(heightAt(x,z),top-1.1);
      const columnHeight=Math.max(1.25,top-ground);
      // The support stops at deck level; the guard post begins there.
      supports.push(box(.22,columnHeight,.22,x,ground+columnHeight/2,z));
      supports.push(box(.2,1.22,.2,x,top+.61,z));
      if(!lit)return;
      lights.push(box(.4,.55,.4,x,top+1.46,z));
      frames.push(box(.52,.09,.52,x,top+1.78,z));
      frames.push(box(.46,.08,.46,x,top+1.16,z));
      for(const dx of [-.21,.21])for(const dz of [-.21,.21])
        frames.push(box(.045,.6,.045,x+dx,top+1.47,z+dz));
    };
    // Shared miter vertices are shared posts, too. Suppress redundant lamps
    // at nearby transition vertices rather than adding a cluster at each bend.
    const litPoints:WalkPoint[]=[];
    for(const rail of [...layout.rails,...terrace.rails]) {
      const {a,b}=rail;
      const railA=new THREE.Vector3(a.x,Y+a.y+1.02,a.z);
      const railB=new THREE.Vector3(b.x,Y+b.y+1.02,b.z);
      supports.push(beamBetween(railA,railB,.14,.15));
      supports.push(beamBetween(railA.clone().add(new THREE.Vector3(0,-.46,0)),
        railB.clone().add(new THREE.Vector3(0,-.46,0)),.11,.12));
      const length=Math.hypot(b.x-a.x,b.z-a.z);
      const stations=Math.max(1,Math.ceil(length/4.2));
      for(let station=0;station<=stations;station++) {
        const t=station/stations;
        const p={x:THREE.MathUtils.lerp(a.x,b.x,t),y:THREE.MathUtils.lerp(a.y,b.y,t),
          z:THREE.MathUtils.lerp(a.z,b.z,t)};
        const lit=(station===0||station===stations)&&
          litPoints.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>2.8);
        addPost(p,lit);if(lit)litPoints.push(p);
      }
    }
    this.westBoardwalk.userData.postPoints=postPoints;
    this.westBoardwalk.userData.litPostPoints=litPoints;

    // Stone-paved viewing terrace: leave a clear arrival court before the
    // pavilion, rather than pushing the flight into its old circular base.
    footings.push(landingDeck(terrace.outline.map(p=>({...p,y:p.y-.05})),.65)!);
    for(const rail of terrace.rails) {
      const a=new THREE.Vector3(rail.a.x,Y+rail.a.y+.11,rail.a.z);
      const b=new THREE.Vector3(rail.b.x,Y+rail.b.y+.11,rail.b.z);
      footings.push(beamBetween(a,b,.32,.22));
    }
    for(const p of terrace.guard)footings.push(box(.48,.24,.48,p.x,Y+p.y+.12,p.z));
    const pavingGeometry=landingDeck(terrace.outline,.05)!;
    const positions=pavingGeometry.getAttribute('position'),uv=pavingGeometry.getAttribute('uv');
    for(let i=0;i<positions.count;i++) {
      const dx=positions.getX(i)-terrace.entry.x,dz=positions.getZ(i)-terrace.entry.z;
      // Match the courtyard photograph's 48/32 UV repeat without cloning
      // its three GPU textures. The terrace uses smaller ~0.7m slabs.
      uv.setXY(i,(dx*terrace.forward.x+dz*terrace.forward.z)*2.4/48,
        (dx*terrace.normal.x+dz*terrace.normal.z)*2.4/32);
    }
    const pavingMesh=new THREE.Mesh(pavingGeometry,pavilionTerraceMaterial());
    pavingMesh.name='phase1-pavilion-terrace-paving';
    pavingMesh.receiveShadow=true;
    this.westBoardwalk.add(pavingMesh);

    const {x:px,z:pz}=terrace.pavilion,py=Y+terrace.entry.y;
    const pavilionTimber: THREE.BufferGeometry[]=[];
    for(let i=0;i<8;i++) {
      const angle=i/8*Math.PI*2+Math.PI/8;
      const x=px+Math.cos(angle)*2.65,z=pz+Math.sin(angle)*2.65;
      footings.push(cyl(.27,.31,.22,10,x,py+.11,z));
      pavilionTimber.push(cyl(.15,.18,3.24,10,x,py+1.84,z));
      const angle2=(i+1)/8*Math.PI*2+Math.PI/8;
      pavilionTimber.push(beamBetween(new THREE.Vector3(x,py+3.4,z),
        new THREE.Vector3(px+Math.cos(angle2)*2.65,py+3.4,pz+Math.sin(angle2)*2.65),.19,.24));
      for(let j=1;j<PAVILION_ROOF_PROFILE.length;j++) {
        const [r0,h0]=PAVILION_ROOF_PROFILE[j-1],[r1,h1]=PAVILION_ROOF_PROFILE[j];
        pavilionTimber.push(beamBetween(
          new THREE.Vector3(px+Math.cos(angle)*r0,py+3.03+h0,pz+Math.sin(angle)*r0),
          new THREE.Vector3(px+Math.cos(angle)*r1,py+3.03+h1,pz+Math.sin(angle)*r1),.11,.12));
      }
      pavilionTimber.push(beamBetween(new THREE.Vector3(px+Math.cos(angle)*3.98,py+3.37,pz+Math.sin(angle)*3.98),
        new THREE.Vector3(px+Math.cos(angle2)*3.98,py+3.37,pz+Math.sin(angle2)*3.98),.13,.16));
    }
    const pavilionPosts=new THREE.Mesh(merge(pavilionTimber),darkTimber);
    pavilionPosts.name='phase1-lower-pavilion-posts';
    pavilionPosts.castShadow=true;
    pavilionPosts.renderOrder=79;
    const pavilionRoof=new THREE.Mesh(pavilionCanopy(),roof);
    pavilionRoof.position.set(px,py+3.15,pz);
    footings.push(cyl(.16,.22,.14,8,px,py+4.96,pz));
    footings.push(cyl(.015,.09,.42,8,px,py+5.2,pz));
    pavilionRoof.name='phase1-lower-pavilion-roof';
    pavilionRoof.castShadow=true;
    pavilionRoof.renderOrder=80;
    const deckMesh = new THREE.Mesh(projectedTempleUV(merge(deck),2.4), timber);
    deckMesh.name = 'phase1-boardwalk-deck';
    deckMesh.castShadow = deckMesh.receiveShadow = true;
    deckMesh.renderOrder=80;
    const supportMesh = new THREE.Mesh(projectedTempleUV(merge(supports),.9), darkTimber);
    supportMesh.name = 'phase1-boardwalk-supports';
    supportMesh.castShadow = supportMesh.receiveShadow = true;
    supportMesh.renderOrder=79;
    const lanternMesh = new THREE.Mesh(merge(lights), lantern);
    lanternMesh.name = 'phase1-boardwalk-lanterns';
    lanternMesh.castShadow = false;
    lanternMesh.renderOrder=81;
    this.westBoardwalk.add(deckMesh, supportMesh, lanternMesh,pavilionPosts,pavilionRoof);
    const frameMesh=new THREE.Mesh(merge(frames),darkTimber);
    frameMesh.name='phase1-boardwalk-lantern-frames';
    const footingMesh=new THREE.Mesh(projectedTempleUV(merge(footings),1.4),stone);
    footingMesh.name='phase1-boardwalk-stone-footings';
    footingMesh.castShadow=footingMesh.receiveShadow=true;
    this.westBoardwalk.add(frameMesh,footingMesh);
  }

  private buildEastRiver() {
    const water = referenceStreamMaterial();
    const bank = stoneMaterial(.2);
    const waterGeos: THREE.BufferGeometry[] = [];
    const bankGeos: THREE.BufferGeometry[] = [];
    const points = STREAM.filter(([x, z]) => x > 25 && z > -62 && z < 70);
    for (let i = 0; i < points.length - 1; i += 2) {
      const [x, z] = points[i], [bx, bz] = points[Math.min(i + 2, points.length - 1)];
      const t = streamT(x, z).t;
      const level = streamLevel(t) + .1;
      const width = streamWidth(t) * 1.15;
      const a = new THREE.Vector3(x, level, z);
      const b = new THREE.Vector3(bx, streamLevel(streamT(bx, bz).t) + .1, bz);
      waterGeos.push(beamBetween(a, b, width, .12));
      const dx = bx - x, dz = bz - z, length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length, nz = dx / length;
      for (const side of [-1, 1]) bankGeos.push(beamBetween(
        a.clone().add(new THREE.Vector3(nx * side * (width * .58), .1, nz * side * (width * .58))),
        b.clone().add(new THREE.Vector3(nx * side * (width * .58), .1, nz * side * (width * .58))),
        .65, .5));
    }
    const waterMesh = new THREE.Mesh(merge(waterGeos), water);
    waterMesh.name = 'phase1-river-ribbon';
    waterMesh.renderOrder = 10;
    const bankMesh = new THREE.Mesh(projectedTempleUV(merge(bankGeos),1.4), bank);
    bankMesh.name = 'phase1-river-banks';
    bankMesh.castShadow = bankMesh.receiveShadow = true;

    // Establish a readable source pool -> fall -> plunge-pool sequence instead
    // of a single unsupported vertical rectangle.  It remains a transparent
    // preview surface; gameplay admission still requires matching collision.
    const upperPool = new THREE.Mesh(new THREE.CylinderGeometry(4.3,4.7,.18,24),water);
    upperPool.name='phase1-waterfall-upper-pool';
    upperPool.position.set(43.2,6.36,-54.4);
    upperPool.renderOrder=11;
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 7.6), referenceWaterfallMaterial());
    fall.name = 'phase1-waterfall-face';
    fall.position.set(42.25, 3.0, -49.9);
    fall.rotation.set(0,Math.PI-.12,0);
    fall.renderOrder = 12;
    const plungePool = new THREE.Mesh(new THREE.CylinderGeometry(5.4,5.8,.16,24),water);
    plungePool.name='phase1-waterfall-plunge-pool';
    plungePool.position.set(40.9,-.72,-45.6);
    plungePool.renderOrder=11;
    const lip = new THREE.Mesh(new THREE.BoxGeometry(5.9,.28,.7),bank);
    lip.name='phase1-waterfall-stone-lip';
    lip.position.set(42.65,6.2,-50.45);
    lip.rotation.y=-.12;
    this.eastRiver.add(waterMesh, bankMesh, upperPool, fall, plungePool, lip);
  }

  private buildEastCrossing() {
    const stone = stoneMaterial(.2);
    const roof = roofMaterial();
    const timber = woodMaterial(false);
    const geos: THREE.BufferGeometry[] = [];
    // The approved bridge, its court-side steps and guards already live in
    // Temple. Keep only the NEW bank-side approach here: a second identical
    // bridge produced coplanar faces and duplicate parapets in the editor.
    for(let i=0;i<3;i++) {
      const farGround=heightAt(44.35,28);
      const farTop=THREE.MathUtils.lerp(farGround,Y+.32,(i+1)/3);
      geos.push(box(.72,.18,4.75,44.62-i*.72,farTop-.09,28));
    }
    const bridge = new THREE.Mesh(projectedTempleUV(merge(geos),1.4), stone);
    bridge.name = 'phase1-east-bank-approach';
    bridge.castShadow = bridge.receiveShadow = true;

    // Small waterside pavilion placeholder, placed beyond the active wall.
    const pavilion = new THREE.Group();
    pavilion.name = 'phase1-east-pavilion';
    const px = 43.5, pz = 46.5;
    const pavilionY=heightAt(px,pz)+.1;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.8, .42, 8), stone);
    base.position.set(px, pavilionY + .21, pz);
    pavilion.add(base);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + Math.PI / 8;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.13, .17, 3.2, 8), timber);
      post.position.set(px + Math.cos(a) * 2.8, pavilionY + 1.8, pz + Math.sin(a) * 2.8);
      pavilion.add(post);
    }
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(4.4, 1.45, 8), roof);
    canopy.position.set(px, pavilionY + 4, pz);
    canopy.rotation.y = Math.PI / 8;
    pavilion.add(canopy);
    // A short fan of slabs gives the bank-side pavilion an explicit entrance.
    for(let i=0;i<3;i++) {
      const slab=new THREE.Mesh(new THREE.BoxGeometry(1.15,.16,3.2),stone);
      slab.name=`phase1-east-pavilion-step-${i+1}`;
      slab.position.set(px-4.05-i*.9,pavilionY-.08-i*.12,pz);
      pavilion.add(slab);
    }
    pavilion.traverse(object => {
      if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
    });
    this.eastCrossing.add(bridge, pavilion);
  }
}
