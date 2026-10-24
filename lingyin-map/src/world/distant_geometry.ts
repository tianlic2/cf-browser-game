import * as THREE from 'three';

/** Deterministic voxel clustering for distant, untextured static scan geometry.
 * Near and medium LODs stay untouched; no runtime decimation while moving. */
export function distantGeometry(source:THREE.BufferGeometry,resolution=28) {
  if(source.hasAttribute('skinIndex')||source.morphAttributes.position?.length)
    throw new Error('Distant clustering is only for static, untextured decoration');
  const position=source.getAttribute('position');source.computeBoundingBox();
  const box=source.boundingBox!,size=box.getSize(new THREE.Vector3());
  const step=Math.max(size.x,size.y,size.z)/resolution;
  if(!(step>0))return source.clone();
  const bins=new Map<string,{id:number;x:number;y:number;z:number;n:number}>();
  const remap=new Uint32Array(position.count);
  for(let i=0;i<position.count;i++) {
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const key=`${Math.floor((x-box.min.x)/step)},${Math.floor((y-box.min.y)/step)},${Math.floor((z-box.min.z)/step)}`;
    let bin=bins.get(key);if(!bin){bin={id:bins.size,x:0,y:0,z:0,n:0};bins.set(key,bin);}
    bin.x+=x;bin.y+=y;bin.z+=z;bin.n++;remap[i]=bin.id;
  }
  const vertices=new Float32Array(bins.size*3);
  for(const b of bins.values())vertices.set([b.x/b.n,b.y/b.n,b.z/b.n],b.id*3);
  const count=source.index?.count??position.count,indices:number[]=[],seen=new Set<string>();
  for(let i=0;i<count;i+=3) {
    const a=remap[source.index?source.index.getX(i):i],b=remap[source.index?source.index.getX(i+1):i+1],c=remap[source.index?source.index.getX(i+2):i+2];
    if(a===b||b===c||a===c)continue;
    const key=[a,b,c].sort((a,b)=>a-b).join(',');if(seen.has(key))continue;seen.add(key);
    indices.push(a,b,c);
  }
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.BufferAttribute(vertices,3));result.setIndex(indices);
  result.computeVertexNormals();result.computeBoundingSphere();
  result.userData.distantOnly=true;return result;
}

export function distantScan(source:THREE.Object3D) {
  const result=source.clone(true),cache=new Map<THREE.BufferGeometry,THREE.BufferGeometry>();
  result.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    let geometry=cache.get(object.geometry);
    if(!geometry){geometry=distantGeometry(object.geometry);cache.set(object.geometry,geometry);}
    object.geometry=geometry;
  });
  return result;
}

/** Scope FOV changes projected size without changing camera.zoom. Use a
 * private camera proxy so distant detail returns without changing aim math. */
export function configureProjectedLOD(lod:THREE.LOD,referenceFov=75) {
  const proxy=new THREE.PerspectiveCamera(),update=lod.update.bind(lod);
  lod.update=(camera:THREE.Camera)=>{
    const view=camera as THREE.PerspectiveCamera;
    const magnification=Number.isFinite(view.fov)
      ? Math.max(1,Math.tan(referenceFov*Math.PI/360)/Math.tan(view.fov*Math.PI/360)):1;
    proxy.matrixWorld.copy(camera.matrixWorld);proxy.zoom=(view.zoom||1)*magnification;
    update(proxy);
  };
}
