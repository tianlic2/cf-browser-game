import * as THREE from 'three';

// The original straight side chords run between these survey points. The two
// cranes have different inclinations and opposite hoisting directions.
const booms = [
  {x:12.724, heel:[9.73,-42.1], head:[32.48,8.41], loadZ:9.05, loadTop:10.02},
  {x:-12.503, heel:[4.18,42.97], head:[30.79,-7.32], loadZ:-7.97, loadTop:10.02},
];

export function createTransportBooms() {
  const group=new THREE.Group();
  group.name='transport-deck-cranes';
  const steel=[], wheels=[];
  const ochre=0xb79350, flange=0xd5ad5a, web=0x967c50, joint=0x695e4c, cable=0x444945;
  const upright=new THREE.Vector3(0,1,0);
  function member(a,b,w,d,color,batch=steel) {
    const delta=b.clone().sub(a);
    const length=delta.length();
    const q=new THREE.Quaternion().setFromUnitVectors(upright,delta.normalize());
    const pos=a.clone().lerp(b,.5);
    batch.push([new THREE.Matrix4().compose(pos,q,new THREE.Vector3(w,length,d)),color]);
  }
  function part(x,y,z,w,h,d,color) {
    steel.push([new THREE.Matrix4().makeScale(w,h,d).setPosition(x,y,z),color]);
  }

  for(const {x,heel,head,loadZ,loadTop} of booms) {
    const dy=head[0]-heel[0], dz=head[1]-heel[1], length=Math.hypot(dy,dz);
    const upY=Math.abs(dz)/length, upZ=-Math.sign(dz)*dy/length;
    function station(t,side,top) {
      // Built-up box truss narrows at the sheave and closes at its heel pin.
      const rise=.45+.95*Math.sin(Math.PI*t)**.66;
      return new THREE.Vector3(x+side*(1.71-.15*top),
        heel[0]+dy*t+top*upY*rise,heel[1]+dz*t+top*upZ*rise);
    }
    const bays=13;
    for(let i=0;i<=bays;i++) {
      const t=i/bays;
      member(station(t,-1,1),station(t,1,1),.11,.14,web);
      if(i%2===0) member(station(t,-1,0),station(t,1,0),.14,.16,joint);
      for(const side of [-1,1]) {
        const lower=station(t,side,0), upper=station(t,side,1);
        member(lower,upper,.14,.12,ochre);
        if(i===bays) continue;
        const next=(i+1)/bays;
        member(lower,station(next,side,0),.29,.31,ochre);
        member(upper,station(next,side,1),.24,.26,flange);
        member(station(t,side,i%2),station(next,side,1-i%2),.15,.15,web);
        // Splice plates bridge the chord joints every three bays.
        if(i%3===1) member(station(t-.005,side,1),station(t+.005,side,1),.29,.31,joint);
      }
      if(i<bays) member(station(t,i%2?1:-1,1),station((i+1)/bays,i%2?-1:1,1),.105,.105,web);
    }
    // Two sheaves on a cross-shaft and a short equalizer over the existing load.
    const az=head[1], ay=head[0];
    member(new THREE.Vector3(x-1.86,ay,az),new THREE.Vector3(x+1.86,ay,az),.29,.29,joint,wheels);
    part(x,loadTop+.18,loadZ,3.24,.32,.55,joint);
    for(const side of [-1,1]) {
      const cx=x+side*1.06;
      for(const offset of [-.19,.19]) {
        member(new THREE.Vector3(cx+offset-.045,ay,az),new THREE.Vector3(cx+offset+.045,ay,az),1.28,1.28,ochre,wheels);
      }
      member(new THREE.Vector3(cx-.16,ay,az),new THREE.Vector3(cx+.16,ay,az),1.06,1.06,cable,wheels);
      for(const zOffset of [-.48,.48])
        member(new THREE.Vector3(cx,ay,az+zOffset),new THREE.Vector3(cx,loadTop+.26,loadZ+zOffset*.4),.048,.048,cable,wheels);
    }
  }
  const material=new THREE.MeshStandardMaterial({metalness:.24,roughness:.7,envMapIntensity:.6});
  for(const [name,geometry,parts] of [
    ['transport-boom-trusses',new THREE.BoxGeometry(),steel],
    ['transport-hoist-sheaves',new THREE.CylinderGeometry(.5,.5,1,16),wheels],
  ]) {
    const mesh=new THREE.InstancedMesh(geometry,material,parts.length);
    parts.forEach(([matrix,color],i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new THREE.Color(color));});
    mesh.name=name;mesh.computeBoundingSphere();
    mesh.castShadow=true;mesh.receiveShadow=true;
    group.add(mesh);
  }
  return group;
}
