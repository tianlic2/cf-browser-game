import * as THREE from 'three';

// Coordinates follow the reflected, playable ship. The bridge house bears on
// the existing officer-deck roof (9.96 m); the uptake fits the original oval
// funnel. Each end culls independently when the player turns down a lane.
const point = (x,y,z) => new THREE.Vector3(x,y,z);
const mix = (a,b,t) => a.clone().lerp(b,t);

function plateBatch(name,material) {
  const vertices=[],normals=[],colours=[],uv=[],indices=[];
  const palette=new Map();
  const color=value=>{
    if(!palette.has(value)) palette.set(value,new THREE.Color(value));
    return palette.get(value);
  };
  function face(corners,shade,upper=shade) {
    const [a,b]=corners;
    const normal=b.clone().sub(a).cross(corners.at(-1).clone().sub(a)).normalize();
    const idx=vertices.length/3;
    corners.forEach((p,i)=>{
      vertices.push(p.x,p.y,p.z); normals.push(normal.x,normal.y,normal.z);
      // The enamel comes from the ship’s existing salt-streaked steel plates.
      // Keep rust trails vertical on both the front and the wing returns.
      const wallU=Math.abs(normal.x)>.72?p.z:p.x;
      uv.push(wallU/2.65,Math.abs(normal.y)>.74?p.z/2.65:p.y/2.65);
      const col=color(i<2?shade:upper); colours.push(col.r,col.g,col.b);
    });
    indices.push(idx,idx+1,idx+2);
    if(corners.length===4)indices.push(idx,idx+2,idx+3);
  }
  const quad=(a,b,c,d,shade,upper)=>face([a,b,c,d],shade,upper);
  function beam(a,b,radius,shade,sides=4) {
    const axis=b.clone().sub(a).normalize();
    const radial=point(0,0,1).cross(axis);
    if(radial.lengthSq()<.001)radial.set(1,0,0).cross(axis);
    radial.normalize().multiplyScalar(radius);
    const edge=i=>radial.clone().applyAxisAngle(axis,(i+.5)*Math.PI*2/sides);
    for(let i=0;i<sides;i++) {
      const p=edge(i),q=edge(i+1);
      quad(a.clone().add(p),a.clone().add(q),b.clone().add(q),b.clone().add(p),shade);
    }
  }
  function mesh() {
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
    geo.setIndex(indices);geo.computeBoundingSphere();
    const result=new THREE.Mesh(geo,material);
    result.name=name; result.receiveShadow=true;
    return result;
  }
  return {quad,face,beam,mesh};
}

function navigationBridge(plates,windows) {
  const coat=0xd4d0bc, rim=0xf0e6cc, seal=0x3e4947, deckGreen=0x556f68;
  // Chamfered bridge wings and forward-raked glazing divert reflections
  // above the helmsman's sightline. Follow the same polygon around the rear.
  const plan=[
    [-5.65,-38.72],[4.38,-38.72],[6.45,-40.04],[6.45,-43.4],
    [5.4,-44.42],[-6.9,-44.42],[-7.8,-43.4],[-7.8,-40.04],
  ];
  const centre=point(-.65,0,-41.6);
  function ring(y,outset) {
    return plan.map(([x,z])=>point(x+(x-centre.x)*outset/7,y,z+(z-centre.z)*outset/3));
  }
  function belt(a,b,shade,upper) {
    for(let i=0;i<a.length;i++) {
      const j=(i+1)%a.length;
      plates.quad(a[i],a[j],b[j],b[i],shade,upper);
    }
  }
  const base=ring(9.955,0), shoulder=ring(10.92,.03), sill=ring(11.05,.09);
  const brow=ring(12.55,.55), roof=ring(12.73,.83), cap=ring(12.81,.83);
  belt(base,shoulder,0xafb2a7,coat);
  belt(shoulder,sill,0x9da69d,rim);
  belt(brow,roof,0x627068,coat);
  belt(roof,cap,0xe0d9c1,rim);
  for(let i=1;i<cap.length-1;i++)plates.face([cap[0],cap[i],cap[i+1]],deckGreen);
  const paneCounts=[7,2,2,1,7,1,2,2];
  for(let i=0;i<plan.length;i++) {
    const j=(i+1)%plan.length, count=paneCounts[i];
    for(let k=0;k<count;k++) {
      const a=mix(sill[i],sill[j],k/count), b=mix(sill[i],sill[j],(k+1)/count);
      const d=mix(brow[i],brow[j],k/count),c=mix(brow[i],brow[j],(k+1)/count);
      const lowerA=mix(a,b,.043), lowerB=mix(a,b,.957), topA=mix(d,c,.043), topB=mix(d,c,.957);
      // A dark EPDM reveal between the tinted glass and the painted mullion.
      plates.quad(a,lowerA,topA,d,0x7a867c,coat);
      plates.quad(lowerB,b,c,topB,0x899287,coat);
      plates.quad(lowerA,lowerB,mix(lowerB,topB,.065),mix(lowerA,topA,.065),seal);
      plates.quad(mix(lowerA,topA,.94),mix(lowerB,topB,.94),topB,topA,seal);
      windows.quad(mix(lowerA,topA,.065),mix(lowerB,topB,.065),mix(lowerB,topB,.94),
        mix(lowerA,topA,.94),[0x373f40,0x354544,0x3c4847][k%3],
        [0x637777,0x657977,0x607273][k%3]);
      // The foremost panes have parked wipers. Stand the blades off the glass.
      if(i===0 && k%2===1) {
        const onPane=(u,v)=>mix(mix(a,b,u),mix(d,c,u),v).add(point(0,0,.033));
        plates.beam(onPane(.36,.95),onPane(.59,.30),.024,0x434943,3);
        plates.beam(onPane(.33,.30),onPane(.81,.30),.023,0x323b38,3);
      }
    }
  }
  // The bridge wing decks are the original roof; guard tubes curve back to
  // the superstructure on each side. Standoffs stop short of the crane heel.
  for(const side of [-1,1]) {
    const inner=side===1?6.3:-7.6, outer=side===1?9.8:-12.1;
    const path=[[inner,-40],[outer,-40],[outer+side*.4,-40.44],[outer+side*.4,-43.5],[inner,-43.5]];
    path.forEach(([x,z],i)=>{
      plates.beam(point(x,9.96,z),point(x,10.98,z),.048,coat);
      if(!i)return;
      const [px,pz]=path[i-1];
      for(const height of [10.44,10.98])
        plates.beam(point(px,height,pz),point(x,height,z),height>10.5?.045:.031,coat);
    });
  }
  // A braced communications mast, a narrow halyard yard and VHF aerials.
  // Its narrow silhouette stays separate from the turning scanner aft.
  const foot=point(-1.65,12.8,-42.45), head=point(-1.65,17.20,-42.92);
  plates.beam(foot,head,.22,0xc7c6b6,6);
  for(const x of [-3.5,.18])plates.beam(point(x,12.8,-43.44),mix(foot,head,.72),.09,coat);
  const yard=point(-1.65,16.52,-42.84);
  plates.beam(point(-4.2,yard.y,yard.z),point(.9,yard.y,yard.z),.075,0xc7c6bb);
  for(const x of [-4.0,.7]) {
    plates.beam(point(x,yard.y,yard.z),mix(foot,head,.61),.034,0xaeb4ad,3);
    plates.beam(point(x,yard.y,yard.z),point(x,17.48,yard.z),.038,seal,3);
  }
  plates.beam(head,point(-1.65,19.04,-43.08),.068,seal);
  plates.beam(point(3.74,12.8,-43.22),point(3.81,15.22,-43.24),.03,0x69716a,3);
}

function funnelCrown(steel) {
  const cx=-.725,cz=45.94;
  // The original 3.73 x 3.36 m funnel ends in a flat polygon. A rolled
  // coaming and two blackened, double-walled uptakes give the stack a mouth.
  function oval(x,z,rx,rz,y,rake=0,sides=24) {
    return Array.from({length:sides},(_,i)=>{
      const a=-Math.PI*2*i/sides;
      return point(x+rx*Math.cos(a),y+rake*Math.sin(a),z+rz*Math.sin(a));
    });
  }
  function band(a,b,shade,finish=shade) {
    for(let i=0;i<a.length;i++){
      const j=(i+1)%a.length;
      steel.quad(a[i],a[j],b[j],b[i],shade,finish);
    }
  }
  band(oval(cx,cz,1.885,1.705,14.52),oval(cx,cz,1.885,1.705,15.13),0x565954,0x3a4140);
  band(oval(cx,cz,1.885,1.705,15.13),oval(cx,cz,1.78,1.60,15.16),0x8b8d80);
  // Faceted by design. Exhausts and insulated steam relief risers are welded
  // above the existing black boot topping and separated by a clear air gap.
  for(const [x,z,r,h,shift] of [[cx-.61,cz,.76,1.44,.17],[cx+.74,cz+.08,.49,.78,.12]]) {
    const a=oval(x,z,r*.92,r*.92,15.13,0,14), b=oval(x,z+shift,r,r,15.13+h,.13,14);
    const ins=oval(x,z+shift,r-.075,r-.075,15.13+h-.006,.13,14);
    const well=oval(x,z,r-.095,r-.095,15.14,0,14);
    band(a,b,0x494d49,0x252c2c);
    band(b,ins,0x858178,0x615f56);
    band(ins,well,0x262c2c,0x1b2121);
  }
  // A maintenance ladder with rounded safety hoops down the outboard face.
  for(const dx of [-.22,.22])
    steel.beam(point(cx+dx,11.70,cz-1.96),point(cx+dx,15.69,cz-1.96),.038,0xb1a38b);
  for(let i=0;i<13;i++){
    const y=11.84+i*.30;
    steel.beam(point(cx-.23,y,cz-1.96),point(cx+.23,y,cz-1.96),.027,0x9f9c8f,3);
  }
  for(const y of [12.12,13.20,14.28,15.36]) {
    const arc=[];
    for(let i=0;i<=6;i++){
      const a=Math.PI*i/6;
      arc.push(point(cx+.42*Math.cos(a),y,cz-1.78-.58*Math.sin(a)));
    }
    for(let i=1;i<arc.length;i++)steel.beam(arc[i-1],arc[i],.028,0x857e71,3);
  }
  for(const dx of [-.21,.21])
    steel.beam(point(cx+dx,12.12,cz-2.28),point(cx+dx,15.36,cz-2.28),.023,0x868070,3);
}

export function createTransportSuperstructure(hullPlate) {
  const root=new THREE.Group();
  root.name='transport-superstructure';
  const paint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.73,metalness:.16,envMapIntensity:.58});
  if(hullPlate?.map) {
    paint.map=hullPlate.map;
    paint.roughnessMap=hullPlate.roughnessMap;
    paint.normalMap=hullPlate.normalMap;
    paint.normalScale.setScalar(.36);
    paint.roughness=.98;
    // Divide out the plate atlas's mean grey-green so the original surface
    // variation and corrosion also work on cream enamel and soot-dark steel.
    paint.color.setRGB(4.25,3.65,3.82);
  }
  const glazing=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.18,metalness:.44,envMapIntensity:1.1});
  const bridge=plateBatch('transport-navigation-bridge',paint);
  const panes=plateBatch('transport-bridge-glazing',glazing);
  const stack=plateBatch('transport-exhaust-uptakes',paint);
  navigationBridge(bridge,panes);
  funnelCrown(stack);
  root.add(bridge.mesh(),panes.mesh(),stack.mesh());
  return root;
}
