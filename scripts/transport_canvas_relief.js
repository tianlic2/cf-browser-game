import * as THREE from 'three';
import {splitAt, useFormedGeometry} from './transport_corrugation.js?v=2';

const hems=[.77,.72,.79,.75], slack=[.036,.078,.017,.054], slopes=[1,.59,1.25,.81];

// Assign one finish to the whole physical load, including its top and all four
// sides. Choose among unused neighbours first, including on the diagonal rows.
export function canvasLoads(colliders) {
  const loads=[];
  for(const c of colliders.filter(c=>c.textures.includes('transportship/texture_83') &&
      c.hx>.8 && c.hz>.8 && c.h-c.y0>1.3).sort((a,b)=>a.z-b.z || a.x-b.x)) {
    const neighbours=loads.filter(load=>Math.hypot(c.x-load.c.x,c.z-load.c.z)<4.2 &&
      Math.abs(c.y0-load.c.y0)<3.5);
    const seed=Math.abs(Math.round(c.x*13+c.z*17+c.h*23));
    let variant=seed%4;
    for(let step=0;step<4;step++) {
      const choice=(seed+step)%4;
      if(!neighbours.some(n=>n.variant===choice)){variant=choice;break;}
    }
    // One tight waxed sheet at the end of the main diagonal breaks the
    // olive / sand / olive repeat. Its original box and cloth mesh stay put.
    const endLoad=Math.hypot(c.x-4.39,c.z-1.85)<.03 && Math.abs(c.h-3.0734)<.02;
    loads.push({c,variant,finish:endLoad?2:variant});
  }
  return loads;
}

function cellLoad(cell,loads) {
  const x=-cell.reduce((sum,p)=>sum+p[0],0)/cell.length;
  const y=cell.reduce((sum,p)=>sum+p[1],0)/cell.length;
  const z=cell.reduce((sum,p)=>sum+p[2],0)/cell.length;
  let best=Infinity, match;
  for(const load of loads) {
    const {c}=load,dx=c.x-x,dz=c.z-z;
    if(y<c.y0-.08 || y>c.h+.08 || Math.abs(dx)>c.hx+.08 || Math.abs(dz)>c.hz+.08)continue;
    if(c.planes.some(([nx,ny,nz,d])=>nx*x+ny*y+nz*z>d+.08))continue;
    const distance=dx*dx+dz*dz+(y-(c.y0+c.h)/2)**2;
    if(distance<best){best=distance;match=load;}
  }
  return match;
}

// Signed distance in metres from the original brush. Pull the fabric inward
// between its lashings. All edges and the exposed galvanized base remain fixed.
function clothDepth(u, v, variant) {
  const bay = THREE.MathUtils.euclideanModulo(u*2,1);
  const y = THREE.MathUtils.euclideanModulo(1-v,1);
  const hem = hems[variant] + slack[variant]*Math.sin(Math.PI*bay) - .016*Math.sin(2*Math.PI*u+.4);
  if (y>hem) return 0;
  const drop = y/hem;
  const envelope = Math.sin(Math.PI*bay)*Math.sin(Math.PI*drop);
  const belt = Math.min(1, Math.abs(drop-.49)*13);
  let fold = 0;
  for (const run of [bay,1-bay]) {
    const line = .97-.76*slopes[variant]*run+(.1+.04*variant)*run*run;
    const d = (drop-line)/(.037+run*.06);
    fold += Math.exp(-d*d) * Math.exp(-run);
  }
  return -envelope*belt*(.024+.006*variant+.064*fold);
}

function cutGrid(polygon, axis, resolution) {
  const values=polygon.map(p=>p[axis]);
  const start=Math.floor(Math.min(...values)*resolution)+1;
  const end=Math.ceil(Math.max(...values)*resolution);
  const rows=[];
  for(let i=start;i<end;i++) {
    const [row,remainder]=splitAt(polygon,i/resolution,axis);
    if(row.length>=3) rows.push(row);
    polygon=remainder;
  }
  if(polygon.length>=3) rows.push(polygon);
  return rows;
}

export function formTransportCanvas(mesh, loads, top) {
  const src=mesh.geometry.getAttribute('position').data.array;
  const positions=[], normals=[], uv=[], uv1=[];
  const edge1=new THREE.Vector3(),edge2=new THREE.Vector3(),normal=new THREE.Vector3();
  const du=new THREE.Vector3(),dv=new THREE.Vector3(),tangent=new THREE.Vector3(),bitangent=new THREE.Vector3();
  const smoothNormal=new THREE.Vector3();
  for(let i=0;i<src.length;i+=21) {
    const triangle=[0,7,14].map(offset=>Array.from(src.subarray(i+offset,i+offset+7)));
    const [a,b,c]=triangle;
    edge1.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    edge2.set(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
    normal.crossVectors(edge1,edge2).normalize();
    const u1=b[3]-a[3],u2=c[3]-a[3],v1=b[4]-a[4],v2=c[4]-a[4];
    const det=u1*v2-u2*v1;
    const cloth=!top && Math.abs(normal.y)<.1 && Math.abs(det)>1e-7;
    if(cloth) {
      du.copy(edge1).multiplyScalar(v2/det).addScaledVector(edge2,-v1/det);
      dv.copy(edge2).multiplyScalar(u1/det).addScaledVector(edge1,-u2/det);
    }
    const cells=cutGrid(triangle,3,cloth?12:1).flatMap(column=>cutGrid(column,4,cloth?10:1));
    for(const cell of cells) {
      const load=cellLoad(cell,loads);
      const variant=load?.variant ?? 0, finish=load?.finish ?? 0;
      const tileU=Math.floor(cell.reduce((sum,p)=>sum+p[3],0)/cell.length);
      const tileV=Math.floor(cell.reduce((sum,p)=>sum+p[4],0)/cell.length);
      for(let j=1;j<cell.length-1;j++) {
        for(const p of [cell[0],cell[j],cell[j+1]]) {
          const u=p[3],v=p[4],depth=cloth?clothDepth(u,v,variant):0;
          smoothNormal.copy(normal);
          if(cloth) {
            tangent.copy(du).addScaledVector(normal,(clothDepth(u+.002,v,variant)-clothDepth(u-.002,v,variant))/.004);
            bitangent.copy(dv).addScaledVector(normal,(clothDepth(u,v+.002,variant)-clothDepth(u,v-.002,variant))/.004);
            smoothNormal.crossVectors(tangent,bitangent).normalize().multiplyScalar(Math.sign(det));
          }
          positions.push(p[0]+normal.x*depth,p[1]+normal.y*depth,p[2]+normal.z*depth);
          normals.push(smoothNormal.x,smoothNormal.y,smoothNormal.z);
          const gutter=1/128;
          uv.push(((finish%2)+gutter+(u-tileU)*(1-2*gutter))/2,
            (1-Math.floor(finish/2)+gutter+(v-tileV)*(1-2*gutter))/2);
          uv1.push(p[5],p[6]);
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  for(const [attribute,values,size] of [['position',positions,3],['normal',normals,3],['uv',uv,2],['uv1',uv1,2]])
    geometry.setAttribute(attribute,new THREE.Float32BufferAttribute(values,size));
  useFormedGeometry(mesh,geometry);
}
