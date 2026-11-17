import * as THREE from 'three';
import { containerFrameEnvelopes } from './transport_stack_paint.js?v=freight-steel-1';
import { createBuckleTail } from './transport_motion.js';

// The imported cargo is a set of flat, painted boxes. These inset steel
// members give the repeated 3.17 m modules real silhouettes at walking
// distance. They stay within about 5 mm of the existing collision envelope.
export function createTransportCargoDetail(colliders) {
  const modules=colliders.filter(c=>
    Math.abs(c.hx*2-3.17)<.12 && Math.abs(c.hz*2-3.17)<.12 &&
    c.h-c.y0>2.9 && c.h-c.y0<3.2 &&
    c.textures.includes('transportship/texture_78'));
  const frameEnvelopes=containerFrameEnvelopes(modules);
  const doors=modules.filter(c=>c.textures.some(t=>
    t==='transportship/texture_79'||t==='transportship/texture_71'));
  const tarps=colliders.filter(c=>c.textures.includes('transportship/texture_83')&&
    c.hx>.8&&c.hz>.8&&c.h-c.y0>1.3);
  const root=new THREE.Group();root.name='transport-cargo-relief';
  const steel=new THREE.MeshStandardMaterial({color:0x4b4b47,metalness:.38,
    roughness:.62,envMapIntensity:.38});
  const casting=new THREE.MeshStandardMaterial({color:0x65635c,metalness:.48,
    roughness:.56,envMapIntensity:.44});
  const webbing=new THREE.MeshStandardMaterial({color:0x172721,roughness:.94,
    metalness:0,envMapIntensity:.08});
  const frame=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),steel,frameEnvelopes.length*12);
  const corners=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),casting,frameEnvelopes.length*8);
  const locks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.018,.018,1,8),casting,doors.length*4);
  const tarpBands=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),webbing,tarps.length*8);
  const tarpClips=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),casting,tarps.length*4);
  frame.name='transport-cargo-frames';corners.name='transport-cargo-castings';locks.name='transport-cargo-door-rods';
  tarpBands.name='transport-tarp-webbing';tarpClips.name='transport-tarp-clips';
  const dummy=new THREE.Object3D();
  const add=(mesh,index,x,y,z,sx,sy,sz)=>{
    dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(sx,sy,sz);
    dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
  };
  let fi=0,ci=0,li=0;
  for(const c of frameEnvelopes) {
    const x=c.x,z=c.z,mid=(c.y0+c.h)*.5,h=c.h-c.y0;
    for(const sx of [-1,1])for(const sz of [-1,1]) {
      add(frame,fi++,x+sx*(c.hx-.03),mid,z+sz*(c.hz-.03),.07,h-.08,.07);
      for(const y of [c.y0+.065,c.h-.065])
        add(corners,ci++,x+sx*(c.hx-.06),y,z+sz*(c.hz-.06),.16,.13,.16);
    }
    for(const y of [c.y0+.045,c.h-.045]) {
      for(const sz of [-1,1])
        add(frame,fi++,x,y,z+sz*(c.hz-.03),c.hx*2-.12,.07,.07);
      for(const sx of [-1,1])
        add(frame,fi++,x+sx*(c.hx-.03),y,z,.07,.07,c.hz*2-.12);
    }
  }
  for(const c of doors) {
    const x=c.x,z=c.z,mid=(c.y0+c.h)*.5,h=c.h-c.y0;
    if(!c.textures.includes('transportship/texture_79'))for(const sz of [-1,1])for(const sx of [-1,1])
      add(locks,li++,x+sx*.43,mid,z+sz*(c.hz-.012),1,h-.26,1);
  }
  locks.count=li;
  let bi=0,ti=0;
  for(const c of tarps) {
    const x=c.x,z=c.z,h=c.h-c.y0,mid=(c.h+c.y0)*.5;
    // Rotated brushes also have cardinal bounding planes. Fit the webbing
    // to the four physical sides, not to the corners of the enclosing AABB.
    const diagonals=c.planes.filter(([nx,ny,nz])=>Math.abs(ny)<.001&&Math.abs(nx)>.05&&Math.abs(nz)>.05);
    const faces=diagonals.length===4 ? diagonals :
      [[1,0,0,x+c.hx],[-1,0,0,-x+c.hx],[0,0,1,z+c.hz],[0,0,-1,-z+c.hz]];
    for(const [nx,,nz,d] of faces) {
      const side=d-nx*x-nz*z;
      const other=faces.find(([px,,pz])=>Math.abs(px*nx+pz*nz)<.01);
      const span=2*(other[3]-other[0]*x-other[2]*z);
      dummy.rotation.set(0,Math.atan2(nx,nz),0);
      dummy.position.set(x+nx*(side+.004),mid,z+nz*(side+.004));
      for(const dimensions of [[.044,h-.12,.012],[span-.06,.044,.012]]) {
        dummy.scale.set(...dimensions);
        dummy.updateMatrix();
        tarpBands.setMatrixAt(bi++,dummy.matrix);
      }
      dummy.scale.set(.083,.095,.021);
      dummy.updateMatrix();
      // One exposed main-lane buckle, on the opposite face from its loose flysheet.
      if(Math.abs(x-7.56)<.03 && Math.abs(z+3.64)<.03 && nx<-.85 && nz<-.49){
        dummy.position.addScaledVector(new THREE.Vector3(nx,0,nz),.019);
        dummy.updateMatrix();
        root.add(createBuckleTail(dummy));
      }
      tarpClips.setMatrixAt(ti++,dummy.matrix);
    }
  }
  for(const mesh of [frame,corners,locks,tarpBands,tarpClips]) {
    mesh.instanceMatrix.needsUpdate=true;
    mesh.frustumCulled=false;
    mesh.castShadow=false;mesh.receiveShadow=true;
    if(mesh.count)root.add(mesh);
  }
  const shadowCanvas=document.createElement('canvas');
  shadowCanvas.width=shadowCanvas.height=128;
  const ctx=shadowCanvas.getContext('2d');
  const gradient=ctx.createRadialGradient(64,64,18,64,64,64);
  gradient.addColorStop(0,'rgba(3,8,10,.44)');
  gradient.addColorStop(.55,'rgba(3,8,10,.26)');
  gradient.addColorStop(1,'rgba(3,8,10,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
  const shadows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),modules.length);
  shadows.name='transport-cargo-contact-shadows';
  let si=0;
  for(const c of modules) {
    dummy.position.set(c.x,c.y0+.007,c.z);
    dummy.rotation.set(-Math.PI/2,0,0);
    dummy.scale.set(c.hx*2+.76,c.hz*2+.76,1);
    dummy.updateMatrix();shadows.setMatrixAt(si++,dummy.matrix);
  }
  shadows.instanceMatrix.needsUpdate=true;
  shadows.frustumCulled=false;
  root.add(shadows);
  root.userData.modules=modules.length;
  root.userData.frameEnvelopes=frameEnvelopes.length;
  root.userData.doors=doors.length;
  root.userData.tarps=tarps.length;
  return root;
}
