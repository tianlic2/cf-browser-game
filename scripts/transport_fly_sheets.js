import * as THREE from 'three';
import { freightGust } from './transport_wind.js';

// Secondary sheets are folded over a corner of individual loads. Coordinates
// use the real brush faces so the same seam meets across a rotated corner.
const sheets=[
  {x:-1.18,z:-9.37,nx:0,nz:-1,side:-1,width:1.48,returnWidth:.81,drop:.85,top:1.97,tint:0xc3a886},
  {x:-3.72,z:27.08,nx:0,nz:-1,side:1,width:1.11,returnWidth:.43,drop:.51,top:4.70,tint:0xaac3bb},
  {x:7.56,z:-3.64,nx:.5,nz:-.866,side:-1,width:1.39,returnWidth:.71,drop:1.36,top:3.073,windPair:0,tint:0xb8b09b},
  {x:4.39,z:1.85,nx:-.866,nz:-.5,side:1,width:2.0,returnWidth:.84,drop:.76,top:3.073,tint:0x869b92},
  {x:-5.39,z:-1.43,nx:.866,nz:-.5,side:-1,width:2.16,returnWidth:.82,drop:1.27,top:3.073,frontOnly:true,windPair:1,tint:0xb3a084},
  {x:-6.53,z:-18.09,nx:1,nz:0,side:-1,width:1.88,returnWidth:.78,drop:.94,top:3.073,tint:0x97a8aa},
  {x:3.80,z:14.87,nx:0,nz:1,side:1,width:1.74,returnWidth:.68,drop:1.18,top:3.073,tint:0xa8a592},
];

// Each loose hem has two overlapping poses. A gust reaches the far end of
// the hem later, then reaches the sheltered sheet across the lane.
export function updateFreightWind(mesh,time) {
  const weights=mesh.morphTargetInfluences;
  for(let i=0;i<4;i++){
    const arrival=.65+Math.floor(i/2)*.76+(i%2)*.34;
    weights[i]=freightGust(time-arrival);
  }
}

export function createFreightFlySheets(colliders,colourMap,normalMap) {
  const position=[],uv=[],color=[];
  const folds=Array.from({length:4},()=>[]);
  for(const sheet of sheets) {
    const c=colliders.find(c=>Math.hypot(c.x-sheet.x,c.z-sheet.z)<.03 && Math.abs(c.h-sheet.top)<.025);
    if(!c)continue;
    const nx=sheet.nx,nz=sheet.nz,tx=nz*sheet.side,tz=-nx*sheet.side;
    const faceRadius=(x,z)=>Math.min(...c.planes.filter(([a,,b])=>a*x+b*z>.999)
      .map(([a,,b,d])=>d-a*c.x-b*c.z));
    const front=faceRadius(nx,nz),side=faceRadius(tx,tz);
    // A neighbouring box shares the sheltered sheet's return face. Hang it on
    // the open face, leaving space between its end and the neighbouring load.
    const edge=sheet.frontOnly?side-.18:side;
    const cornerX=c.x+nx*front+tx*edge,cornerZ=c.z+nz*front+tz*edge;
    const moving=sheet.windPair!==undefined;
    const lip=moving?.018:0;
    const tint=new THREE.Color(sheet.tint);
    function quad(a,b,d,e,hem=false) {
      for(const p of [a,b,d,b,e,d]) {
        if(p.length>5){
          const index=position.length;
          const [u,v,dx,dz]=p.slice(3);
          const slack=v*v*(sheet.windPair===0?1:.62);
          const split=THREE.MathUtils.smoothstep(u,.10,.83);
          const depth=slack*(.115+.023*Math.sin(3*Math.PI*u));
          const lift=slack*(.060+.018*Math.cos(Math.PI*u));
          for(let band=0;band<2;band++){
            const w=band===0?1-split:split;
            folds[sheet.windPair*2+band].push([index,dx*depth*w,lift*w,dz*depth*w]);
          }
        }
        position.push(...p.slice(0,3));
        uv.push(p[3],1-p[4]);
        const k=hem ? .76 : 1;
        color.push(tint.r*k,tint.g*k,tint.b*k);
      }
    }
    function point(s,t,h) {
      return [cornerX-tx*s-nx*t,h,cornerZ-tz*s-nz*t,s/sheet.width,t/sheet.returnWidth];
    }
    // The top lies flat on the supporting load. Uneven free ends turn down
    // over both faces; tension folds grow away from the fixed upper edge.
    const start=sheet.frontOnly?0:-lip;
    quad(point(start,-lip,c.h+.013),point(sheet.width,-lip,c.h+.013),
      point(start,sheet.returnWidth,c.h+.013),point(sheet.width,sheet.returnWidth,c.h+.013));
    // A narrow rolled-back hem sits across the inner edge. Eight tapered
    // sections give the wrapped fabric a soft silhouette at grazing angles.
    for(let i=0;i<8;i++){
      const ringPoint=(u,theta)=>{
        const radius=.036+.058*Math.sin(Math.PI*u)**.58;
        return point(sheet.width*u,sheet.returnWidth-radius*Math.cos(theta),
          c.h+.016+radius*(1+Math.sin(theta)));
      };
      for(let k=0;k<6;k++){
        const a=k*Math.PI/3,b=(k+1)*Math.PI/3;
        quad(ringPoint(i/8,a),ringPoint((i+1)/8,a),ringPoint(i/8,b),ringPoint((i+1)/8,b));
      }
    }
    for(const frontFace of (sheet.frontOnly?[true]:[true,false])) {
      const length=frontFace?sheet.width:sheet.returnWidth;
      function clothPoint(u,v) {
        const fall=sheet.drop*(1-(frontFace?.72:.48)*u+.12*Math.sin(u*Math.PI*2));
        // The visible formed cloth bows outside the brush. Follow the shoulder
        // before letting the loose panel hang clear of the deepest folds.
        const clearance=moving?lip+.086*Math.min(1,v/.34):.007;
        const lift=clearance+v*(.012+.024*Math.sin(u*Math.PI*3)**2)*Math.sin(Math.PI*u);
        const run=length*u-(sheet.frontOnly?0:clearance)*(1-u);
        const p=point(frontFace?run:-lift,frontFace?-lift:run,c.h+.013-v*fall);
        p[3]=u;p[4]=v;
        if(moving && v>0){
          // The two hanging faces turn the corner together; further out each
          // billows away from its own box face. The upper seam stays pinned.
          const wrap=sheet.frontOnly?0:1-THREE.MathUtils.smoothstep(u,0,.25);
          const dx=frontFace?nx+wrap*tx:tx+wrap*nx;
          const dz=frontFace?nz+wrap*tz:tz+wrap*nz;
          const length=Math.hypot(dx,dz);
          p.push(dx/length,dz/length);
        }
        return p;
      }
      for(let i=0;i<12;i++) {
        const a=i/12,b=(i+1)/12;
        const rows=moving?[0,.16,.34,.65,.965,1]:[0,.45,.965,1];
        for(let j=1;j<rows.length;j++){
          const v=rows[j-1],w=rows[j];
          quad(clothPoint(a,v),clothPoint(b,v),clothPoint(a,w),clothPoint(b,w),v>.9);
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  for(const [key,values,size] of [['position',position,3],['uv',uv,2],['color',color,3]]) {
    geometry.setAttribute(key,new THREE.Float32BufferAttribute(values,size));
  }
  geometry.computeVertexNormals();
  geometry.morphAttributes.position=[];
  geometry.morphAttributes.normal=[];
  const base=geometry.attributes.position.array;
  for(const fold of folds){
    const posed=base.slice();
    for(const [i,x,y,z] of fold){
      posed[i]+=x; posed[i+1]+=y; posed[i+2]+=z;
    }
    const pose=new THREE.BufferGeometry();
    pose.setAttribute('position',new THREE.BufferAttribute(posed,3));
    pose.computeVertexNormals();
    geometry.morphAttributes.position.push(pose.attributes.position);
    geometry.morphAttributes.normal.push(pose.attributes.normal);
  }
  const material=new THREE.MeshPhysicalMaterial({
    map:colourMap,normalMap,normalScale:new THREE.Vector2(.78,.78),
    sheen:.62,sheenRoughness:.83,sheenColor:0xc7bdac,
    vertexColors:true,roughness:.94,side:THREE.DoubleSide,envMapIntensity:.42,
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='transport-folded-corner-sheets';
  mesh.receiveShadow=true;
  return mesh;
}
