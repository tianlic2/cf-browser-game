import * as THREE from 'three';

export function createFreightNote(colliders) {
  const box=colliders.find(c=>Math.hypot(c.x+1.18,c.z+9.37)<.03 && Math.abs(c.h-1.973)<.03);
  const canvas=document.createElement('canvas');
  canvas.width=384;canvas.height=288;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#c1b496';ctx.fillRect(0,0,384,288);
  ctx.fillStyle='#49514b';ctx.fillRect(15,25,354,3);
  ctx.font='bold 32px monospace';ctx.fillText('CARGO RECEIPT',18,64);
  ctx.font='18px monospace';ctx.fillText('BERTH 04    |    0187',19,95);
  for(let y=114;y<232;y+=27)ctx.fillRect(18,y,350,2);
  ctx.font='14px monospace';ctx.fillText('STOW   /   DRY HOLD',21,135);
  ctx.fillText('CASE   /   07',21,162);ctx.fillText('RECEIVED',260,216);
  for(let i=0,x=21;i<44;i++){const w=1+(i*17%4);ctx.fillRect(x,242,w,24);x+=w+2;}
  ctx.fillStyle='#9e946c';ctx.fillRect(4,7,50,15);ctx.fillRect(332,5,49,16);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  const geometry=new THREE.PlaneGeometry(.41,.31,10,8);
  const sheet=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
    map,side:THREE.DoubleSide,roughness:.97,metalness:0,envMapIntensity:.35,
  }));
  sheet.name='transport-freight-receipt';
  // The note sits in the clear panel between the lower batten and the diagonal.
  sheet.position.set(box.x+.32,box.y0+.68,box.z-box.hz-.009);
  sheet.rotation.y=Math.PI;sheet.receiveShadow=true;
  const base=geometry.attributes.position.array.slice();
  const pose=new THREE.BufferGeometry();
  const curled=base.slice();
  for(let i=0;i<base.length;i+=3){
    const u=base[i]/.41+.5,v=.5-base[i+1]/.31;
    const bend=THREE.MathUtils.smoothstep(.68*u+.62*v,.61,1.26)*v;
    curled[i]-=.030*bend;curled[i+1]+=.064*bend;curled[i+2]+=.115*bend;
  }
  pose.setAttribute('position',new THREE.BufferAttribute(curled,3));
  pose.setIndex(geometry.index);pose.computeVertexNormals();
  geometry.morphAttributes.position=[pose.attributes.position];
  geometry.morphAttributes.normal=[pose.attributes.normal];
  sheet.updateMorphTargets();
  sheet.userData.update=t=>{
    const phase=THREE.MathUtils.euclideanModulo(t-.93,17);
    const second=phase>=6.8;
    const age=second?phase-6.8:phase;
    const gust=THREE.MathUtils.smoothstep(age,0,.48)*(1-THREE.MathUtils.smoothstep(age,.66,2.5));
    sheet.morphTargetInfluences[0]=.09+gust*(second?.60:.88)*(.80+.20*Math.sin(age*14.2));
  };
  return sheet;
}

function treadTexture() {
  const canvas=document.createElement('canvas');canvas.width=80;canvas.height=150;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  // Broken tread blocks, an empty arch and a separate heel.
  for(let row=0;row<10;row++){
    const y=12+row*13;
    if(row===6)continue;
    const width=row<6?29-1.4*Math.abs(row-2):22;
    for(const side of [-1,1]){
      ctx.save();ctx.translate(40+side*width*.55,y);
      ctx.rotate(side*(row<6?.30:-.19));
      ctx.fillRect(-width*.45,-3.7,width*.90,7.4);ctx.restore();
    }
  }
  let state=904;
  const next=()=>((state=Math.imul(state,1664525)+1013904223|0)>>>0)/4294967296;
  ctx.globalCompositeOperation='destination-out';
  for(let i=0;i<1650;i++){
    ctx.globalAlpha=.22+.68*next();
    ctx.fillRect(next()*80,next()*150,1+next()*3,1+next()*3);
  }
  const map=new THREE.CanvasTexture(canvas);map.anisotropy=4;return map;
}

export function createDeckTracks(contact) {
  const capacity=24;
  const geometry=new THREE.PlaneGeometry(.18,.32);
  geometry.rotateX(-Math.PI/2);
  const alpha=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);
  alpha.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('treadOpacity',alpha);
  const material=new THREE.MeshBasicMaterial({color:0xbaac8b,map:treadTexture(),transparent:true,
    depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float treadOpacity; varying float vTread;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nvTread=treadOpacity;');
    shader.fragmentShader='varying float vTread;\n'+shader.fragmentShader.replace(
      '#include <map_fragment>','#include <map_fragment>\ndiffuseColor.a*=vTread;');
  };
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);
  mesh.name='transport-dry-bootprints';mesh.count=0;mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const {data,width,height}=contact.image;
  const born=new Float64Array(capacity),strength=new Float32Array(capacity);
  const placement=new THREE.Object3D();
  const residue=[0,0];
  let next=0,stride=0,foot=0;
  function dust(x,z){
    const col=Math.floor((x/32+.5)*width),row=Math.floor((z/96+.5)*height);
    if(col<0 || col>=width || row<0 || row>=height)return 0;
    return Math.max(0,(128-data[(row*width+col)*4+3])/127);
  }
  function walk(pos,dx,dz,yaw,t){
    const distance=Math.hypot(dx,dz);
    if(distance<.0001 || distance>.7 || Math.abs(pos.y-.0254)>.025 || Math.abs(pos.z)>35){
      stride=0;residue.fill(0);return;
    }
    const rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);
    for(let i=0;i<2;i++){
      const side=i===0?-1:1;
      const pickup=Math.max(dust(pos.x+.10*side*rightX,pos.z+.10*side*rightZ),
        dust(pos.x+.18*side*rightX,pos.z+.18*side*rightZ));
      residue[i]=Math.max(residue[i],pickup);
    }
    stride+=distance;
    if(stride<.82)return;
    stride%=.82;foot=1-foot;
    if(residue[foot]<.065)return;
    const side=foot===0?-1:1;
    placement.position.set(pos.x+side*.10*rightX,pos.y+.002,pos.z+side*.10*rightZ);
    placement.rotation.y=yaw-side*.07;
    placement.updateMatrix();
    mesh.setMatrixAt(next,placement.matrix);mesh.instanceMatrix.needsUpdate=true;
    born[next]=t;strength[next]=.53*residue[foot];
    alpha.setX(next,strength[next]);alpha.needsUpdate=true;
    mesh.count=Math.max(mesh.count,next+1);next=(next+1)%capacity;
    mesh.visible=true;residue[foot]*=.54;
  }
  mesh.visible=false;
  return {mesh,walk,update(t){
    if(!mesh.visible)return;
    let live=false;
    for(let i=0;i<mesh.count;i++){
      const age=t-born[i];
      const value=age<0?0:strength[i]*(1-THREE.MathUtils.smoothstep(age,6,13));
      alpha.setX(i,value);if(value>0)live=true;
    }
    alpha.needsUpdate=true;mesh.visible=live;
  },reset(){
    mesh.count=0;mesh.visible=false;next=0;stride=0;residue.fill(0);foot=0;
  }};
}
