import * as THREE from 'three';

// Bake visibility against the actual sculpture once, after construction. Small
// orthographic depth maps capture the shade cast by lips, sleeves and fingers.
const directions = [
  [-.70,.55,.65], [.76,.46,.55], [-.22,.92,-.32], [.26,.86,.51],
  [-.84,.18,-.52], [.85,.20,-.49], [.10,-.28,.96], [.32,-.20,-.93],
];
const size = 144;
const pixelsPerMetre = 25;

function makeDepthView(meshes:THREE.Mesh[], direction:number[]) {
  const axis = new THREE.Vector3(...direction).normalize();
  const right = new THREE.Vector3(0,1,0).cross(axis).normalize();
  const up = axis.clone().cross(right);
  const depth = new Float32Array(size*size).fill(-Infinity);
  function project(x:number,y:number,z:number,out:THREE.Vector3) {
    y -= 2.35;
    return out.set(size/2+pixelsPerMetre*(x*right.x+y*right.y+z*right.z),
      size/2+pixelsPerMetre*(x*up.x+y*up.y+z*up.z), x*axis.x+y*axis.y+z*axis.z);
  }
  const corners = [new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  for(const mesh of meshes) {
    const pos = mesh.geometry.getAttribute('position'),idx = mesh.geometry.index;
    for(let t=0;t<(idx?.count??pos.count);t+=3) {
      for(let j=0;j<3;j++) {
        const i=idx?idx.getX(t+j):t+j;
        project(pos.getX(i),pos.getY(i),pos.getZ(i),corners[j]);
      }
      const [a,b,c]=corners;
      const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
      if(Math.abs(denominator)<.0001)continue;
      const x0=Math.max(0,Math.ceil(Math.min(a.x,b.x,c.x))),x1=Math.min(size-1,Math.floor(Math.max(a.x,b.x,c.x)));
      const y0=Math.max(0,Math.ceil(Math.min(a.y,b.y,c.y))),y1=Math.min(size-1,Math.floor(Math.max(a.y,b.y,c.y)));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) {
        const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/denominator;
        const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/denominator;
        if(u>=0&&v>=0&&u+v<=1) {
          const k=y*size+x;
          depth[k]=Math.max(depth[k],u*a.z+v*b.z+(1-u-v)*c.z);
        }
      }
    }
  }
  return {axis,depth,project};
}

export function bakeSculptureVisibility(lod:THREE.LOD) {
  const medium = lod.levels[1].object.children as THREE.Mesh[];
  const views=directions.map(dir=>makeDepthView(medium,dir));
  const p=new THREE.Vector3(),n=new THREE.Vector3(),sample=new THREE.Vector3();
  const cache=new Map<number,number>();
  for(const level of lod.levels)for(const child of level.object.children) {
    const mesh=child as THREE.Mesh,geometry=mesh.geometry;
    const pos=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
    const visibility=new Uint8Array(pos.count);
    for(let i=0;i<pos.count;i++) {
      p.fromBufferAttribute(pos,i);n.fromBufferAttribute(normal,i);
      const key=(Math.round((p.x+3)*125)*1024+Math.round(p.y*125))*1024+Math.round((p.z+2)*125);
      let value=cache.get(key);
      if(value===undefined) {
        let sheltered=0,total=.15;
        for(const view of views) {
          const weight=Math.max(0,n.dot(view.axis));
          if(!weight)continue;
          total+=weight;
          view.project(p.x,p.y,p.z,sample);
          const index=Math.round(sample.x)+size*Math.round(sample.y);
          sheltered+=weight*THREE.MathUtils.smoothstep(view.depth[index]-sample.z,.065,.23);
        }
        value=Math.round(255*(1-.85*sheltered/total));cache.set(key,value);
      }
      visibility[i]=value;
    }
    geometry.setAttribute('sculptVisibility',new THREE.BufferAttribute(visibility,1,true));
  }
}
