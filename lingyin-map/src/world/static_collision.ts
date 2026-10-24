import * as THREE from 'three';

type Point={x:number;z:number};
function hull(points:Point[]) {
  points.sort((a,b)=>a.x-b.x||a.z-b.z);
  const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
  const half=(values:Point[])=>{const out:Point[]=[];for(const p of values){
    while(out.length>=2&&cross(out[out.length-2],out[out.length-1],p)<=1e-8)out.pop();out.push(p);
  }return out;};
  const lower=half(points),upper=half([...points].reverse());
  return [...lower.slice(0,-1),...upper.slice(0,-1)];
}

/** Load-time CPU envelopes from the existing medium scan, never the 148k-face
 * near statue in per-frame collision. Bands preserve the seated silhouette
 * instead of turning the whole altar into one tall rectangular air wall. */
export function mainHallStatueSolids(world:THREE.Group) {
  world.updateMatrixWorld(true);
  const solids:any[]=[];let figure=0;
  world.traverse(object=>{
    if(!(object instanceof THREE.LOD)||!['hall-central-buddha','hall-flanking-buddha'].includes(object.name))return;
    const source=(object.levels.find(l=>l.distance===20)??object.levels[0]).object;
    const points:THREE.Vector3[]=[];
    source.traverse(mesh=>{
      if(!(mesh instanceof THREE.Mesh))return;
      const positions=mesh.geometry.getAttribute('position');
      for(let i=0;i<positions.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld));
    });
    const bounds=new THREE.Box3().setFromPoints(points),height=bounds.max.y-bounds.min.y;
    for(let band=0;band<6;band++){
      const y0=bounds.min.y+height*band/6,h=bounds.min.y+height*(band+1)/6;
      const polygon=hull(points.filter(p=>p.y>=y0-.06&&p.y<=h+.06).map(p=>({x:p.x,z:p.z})));
      if(polygon.length<3)continue;
      const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.z),x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
      const planes:number[][]=[[0,1,0,h],[0,-1,0,-y0]];
      polygon.forEach((a,i)=>{const b=polygon[(i+1)%polygon.length],length=Math.hypot(b.x-a.x,b.z-a.z);
        const nx=(b.z-a.z)/length,nz=-(b.x-a.x)/length;planes.push([nx,0,nz,nx*a.x+nz*a.z]);});
      solids.push({name:`main-buddha-body-${figure}-${band}`,x,z,y0,h,
        hx:(Math.max(...xs)-Math.min(...xs))/2,hz:(Math.max(...zs)-Math.min(...zs))/2,
        planes,polygon,preciseEscape:true,walkable:false});
    }
    figure++;
  });
  return solids;
}
