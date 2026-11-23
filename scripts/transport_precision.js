import * as THREE from 'three';
import { splitAt, useFormedGeometry } from './transport_corrugation.js?v=2';

const fraction=x=>THREE.MathUtils.euclideanModulo(x,1);
const smooth=(x,a,b)=>THREE.MathUtils.smoothstep(x,a,b);

// Cut only at authored bends. Original UV and lightmap coordinates interpolate
// through every cut; the original BSP remains the gameplay/penetration proxy.
function formUvRelief(mesh,uCuts,vCuts,height,accept=()=>true) {
  const source=mesh.geometry,p=source.attributes.position,uv=source.attributes.uv,light=source.attributes.uv1;
  const positions=[],tex=[],shade=[];
  let formed=0;
  const edge=new THREE.Vector3(),normal=new THREE.Vector3();
  function emit(poly,n,relief){
    for(let i=1;i<poly.length-1;i++){
      const a=poly[0],b=poly[i],c=poly[i+1];
      const e=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
      if(e.cross(new THREE.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2])).lengthSq()<1e-18)continue;
      for(const v of [a,b,c]){
      const h=relief?height(v[3],v[4]):0;
      positions.push(v[0]-n.x*h,v[1]-n.y*h,v[2]-n.z*h);
      tex.push(v[3],v[4]);shade.push(v[5],v[6]);
      }
    }
  }
  function split(polys,cuts,axis){
    const out=[];
    for(let poly of polys){
      const min=Math.min(...poly.map(v=>v[axis])),max=Math.max(...poly.map(v=>v[axis]));
      for(let tile=Math.floor(min);tile<=Math.floor(max);tile++)for(const cut of cuts){
        const line=tile+cut;if(line<=min+1e-7||line>=max-1e-7)continue;
        const [a,b]=splitAt(poly,line,axis);if(a.length>=3)out.push(a);poly=b;
      }
      if(poly.length>=3)out.push(poly);
    }return out;
  }
  for(let i=0;i<p.count;i+=3){
    const poly=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j),uv.getX(i+j),uv.getY(i+j),light.getX(i+j),light.getY(i+j)]);
    edge.set(...poly[1].slice(0,3)).sub(new THREE.Vector3(...poly[0].slice(0,3)));
    normal.set(...poly[2].slice(0,3)).sub(new THREE.Vector3(...poly[0].slice(0,3))).cross(edge).negate().normalize();
    if(!accept(normal,poly)){emit(poly,normal,false);continue;}
    for(const piece of split(split([poly],uCuts,3),vCuts,4))emit(piece,normal,true);
    formed++;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(shade,2));
  g.computeVertexNormals();useFormedGeometry(mesh,g);
  mesh.userData.precisionRelief={sourceVertices:p.count,vertices:g.attributes.position.count,formedFaces:formed};
}

const boardEdges=[0,237/2048,510/2048,777/2048,1008/2048,1290/2048,1525/2048,1772/2048,1];
export function formTimberBoards(mesh) {
  const cuts=[...new Set(boardEdges.flatMap(v=>[-.003,0,.003].map(d=>v+d)).filter(v=>v>=0&&v<=1))].sort((a,b)=>a-b);
  formUvRelief(mesh,cuts,[0,.045,.065,.935,.955,1],(u,v)=>{
    u=fraction(u);v=fraction(v);
    const distance=Math.min(...boardEdges.map(e=>Math.abs(u-e)));
    const clear=smooth(v,.045,.065)*(1-smooth(v,.935,.955));
    return -.0065*Math.max(0,1-distance/.003)*clear;
  },n=>Math.abs(n.y)<.1);
  mesh.userData.precisionKind='sawn-board-joints';
}

export function formCabinetSteel(mesh) {
  const us=[];
  for(const half of [0,.5])for(const u of [.019,.025,.092,.098,.25,.402,.408,.475,.481])
    for(const d of [-.002,0,.002])us.push(half+u+d);
  const ys=[.038,.045,.052,.158,.164,.170,.342,.348,.354,.478,.482,.53,.578,.582,.948,.955,.962];
  for(let i=-5;i<=5;i++)for(const d of [-.006,-.002,0,.002,.006])ys.push(.256+i*2/111+d);
  const vs=[...new Set(ys.map(y=>1-y))].sort((a,b)=>a-b);
  formUvRelief(mesh,[...new Set(us)].sort((a,b)=>a-b),vs,(u,v)=>{
    const q=fraction(u*2)*.5,y=1-fraction(v);
    const door=Math.max(Math.abs(q-.25)-.231,Math.abs(y-.5)-.462);
    let h=.006*smooth(-door,-.002,.008);
    const vent=Math.max(Math.abs(q-.25)-.158,Math.abs(y-.256)-.092);
    const grille=smooth(-vent,0,.006);
    const blade=.5+.5*Math.cos((y-.256)*Math.PI*111);
    h=THREE.MathUtils.lerp(h,-.0035+.012*blade,grille);
    const handle=Math.max(Math.abs(q-.402)-.011,Math.abs(y-.53)-.048);
    h+=.011*smooth(-handle,-.002,.003);
    return h;
  },n=>Math.abs(n.y)<.05);
  mesh.userData.precisionKind='folded-cabinet-louvres';
}

// Hollow ISO-style casting. The handling apertures have eased lips and dark
// inner walls, instead of painting black ovals on a solid block. All six sides
// share the same pocket so one geometry works at every container corner.
export function cornerCastingGeometry() {
  const p=[],c=[];
  const angles=[];
  for(let q=0;q<4;q++)for(const a of [0,Math.PI/8,Math.atan(.9),Math.PI/4,Math.atan(1/.9),3*Math.PI/8])angles.push(q*Math.PI/2+a);
  const segments=angles.length;
  const point=(i,ring)=>{
    const a=angles[i%segments],cs=Math.cos(a),sn=Math.sin(a);
    if(ring===0){
      let scale=.5/Math.max(Math.abs(cs),Math.abs(sn));
      if(Math.min(Math.abs(cs*scale),Math.abs(sn*scale))>.45){
        const dot=.45*(Math.abs(cs)+Math.abs(sn));scale=dot+Math.sqrt(Math.max(0,dot*dot-.45*.45*2+.05*.05));
      }
      return [cs*scale,sn*scale,.5];
    }
    const radiusX=ring===1?.285:.255,radiusY=ring===1?.17:.14;
    return [cs*radiusX,sn*radiusY,ring===1?.5:ring===2?.465:.31];
  };
  const faceRotation=[new THREE.Euler(0,0,0),new THREE.Euler(0,Math.PI,0),new THREE.Euler(0,Math.PI/2,0),
    new THREE.Euler(0,-Math.PI/2,0),new THREE.Euler(-Math.PI/2,0,0),new THREE.Euler(Math.PI/2,0,0)];
  for(const rot of faceRotation){
    const q=new THREE.Quaternion().setFromEuler(rot);
    const add=(a,b,d,tone)=>{for(const v of [a,b,d]){const vec=new THREE.Vector3(...v).applyQuaternion(q);p.push(...vec.toArray());c.push(tone,tone,tone);}};
    for(let i=0;i<segments;i++)for(let ring=0;ring<3;ring++){
      const a=point(i,ring),b=point(i+1,ring),d=point(i,ring+1),e=point(i+1,ring+1),tone=[.82,1.12,.22][ring];
      add(a,b,d,tone);add(b,e,d,tone);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();g.computeBoundingSphere();
  return g;
}

export function addBattenFasteners(braces) {
  // The back of each cap is buried in timber. A smooth eight-triangle dome
  // avoids rendering hidden cylinder walls and end caps for thousands of heads.
  const points=[0,0,.36],indices=[];
  for(let i=0;i<8;i++){const a=i*Math.PI/4;points.push(Math.cos(a),Math.sin(a),0);indices.push(0,i+1,(i+1)%8+1);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();
  const metal=new THREE.MeshStandardMaterial({color:0x78786a,roughness:.76,metalness:.48,envMapIntensity:.35});
  const heads=new THREE.InstancedMesh(geo,metal,braces.count*2);heads.name='transport-timber-fasteners';
  const matrix=new THREE.Matrix4(),pose=new THREE.Object3D();
  for(let i=0;i<braces.count;i++){
    braces.getMatrixAt(i,matrix);const centre=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(centre,q,scale);
    for(let side=0;side<2;side++){
      const point=new THREE.Vector3((side?1:-1)*Math.max(0,scale.x*.5-.045),0,scale.z*.53).applyQuaternion(q).add(centre);
      pose.position.copy(point);pose.quaternion.copy(q);pose.scale.set(.0068,.0068,.0068);pose.updateMatrix();heads.setMatrixAt(i*2+side,pose.matrix);
    }
  }
  heads.receiveShadow=true;heads.computeBoundingSphere();heads.userData.visualOnly=true;
  return heads;
}

export function createCaseCornerPlates(colliders,atlas) {
  const p=[],col=[],uv=[],boxes=colliders.filter(c=>c.roundedFootprint&&
    c.textures.some(t=>t==='transportship/texture_234'||t==='transportship/texture_80')&&Math.min(c.hx,c.hz)>.45&&c.h-c.y0>.85);
  let surfaceUv;
  const tri=(v,w,q,tone)=>{for(const vtx of [v,w,q]){p.push(...vtx);col.push(tone,tone*.99,tone*.94);uv.push(...surfaceUv(vtx));}};
  let plates=0;
  for(const c of boxes){
    const tile=Math.abs(Math.round(c.x*9+c.z*13))%4,band=(tile%2?38:26)/512;
    for(const sx of [-1,1])for(const sz of [-1,1])for(const face of [0,1]){
      const nx=face?0:sx,nz=face?sz:0,tx=face?-sx:0,tz=face?0:-sz;
      const span=2*(face?c.hx:c.hz),w=span*band,h=(c.h-c.y0)*34/512;
      const cornerU=face?(sx*sz>0?1:0):(sx*sz<0?1:0);
      surfaceUv=v=>{
        const along=(v[0]-c.x-sx*c.hx)*tx+(v[2]-c.z-sz*c.hz)*tz;
        const u=cornerU?1-along/span:along/span,vertical=(v[1]-c.y0)/(c.h-c.y0);
        return [(tile%2+u)*.5,(1-Math.floor(tile/2)+vertical)*.5];
      };
      const point=(u,v,lift,y)=>[c.x+sx*c.hx+tx*u+nx*lift,y+v,c.z+sz*c.hz+tz*u+nz*lift];
      const shape=[[0,-h/2],[w-.008,-h/2],[w,-h/2+.008],[w,h/2-.008],[w-.008,h/2],[0,h/2]];
      for(const fraction of [1-90/512,1-410/512]){
        const y=c.y0+(c.h-c.y0)*fraction;
        const front=shape.map(([u,v])=>point(u+(w*.5-u)*.025,v*.93,.003,y));
        const outer=shape.map(([u,v])=>point(u,v,.001,y));
        for(let k=1;k<front.length-1;k++)tri(front[0],front[k],front[k+1],.82);
        for(let k=0;k<front.length;k++){
          const next=(k+1)%front.length;
          tri(outer[k],outer[next],front[k],.64);tri(front[k],outer[next],front[next],.64);
        }
        const radius=Math.min(.016,span*4.3/512),u=w-span*10/512;
        for(let k=0;k<10;k++){
          const theta=k*Math.PI/5,next=(k+1)*Math.PI/5;
          tri(point(u,0,.005,y),point(u+radius*Math.cos(theta),radius*Math.sin(theta),.0032,y),
            point(u+radius*Math.cos(next),radius*Math.sin(next),.0032,y),.98);
        }
        plates++;
      }
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();g.computeBoundingSphere();
  const m=new THREE.MeshStandardMaterial({map:atlas,color:0xffffff,vertexColors:true,side:THREE.DoubleSide,roughness:.72,metalness:.22,envMapIntensity:.5});
  const mesh=new THREE.Mesh(g,m);mesh.name='transport-case-corner-plates';mesh.receiveShadow=true;
  mesh.userData.plates=plates;mesh.userData.impactSurface='metal';return mesh;
}

// The handling pockets occupy only a few pixels at lane distances. Preserve
// their closed silhouette there, spending the hollow casting on nearby corners.
export function installCastingLod(root,near,material) {
  const matrices=[],centres=[],isNear=[];
  for(let i=0;i<near.count;i++){
    const m=new THREE.Matrix4();near.getMatrixAt(i,m);matrices.push(m);
    centres.push(new THREE.Vector3().setFromMatrixPosition(m));isNear.push(false);
  }
  const far=new THREE.InstancedMesh(new THREE.BoxGeometry(),material,near.count);
  far.name='transport-cargo-castings-distant';far.receiveShadow=true;far.frustumCulled=false;
  root.add(far);near.instanceMatrix.setUsage(THREE.DynamicDrawUsage);far.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  let last=-Infinity;const lastEye=new THREE.Vector3(Infinity,Infinity,Infinity);
  near.userData.total=matrices.length;
  root.userData.updateDetailLod=(eye,time=0,force=false)=>{
    if(!force&&time-last<.2&&lastEye.distanceToSquared(eye)<9)return;
    last=time;lastEye.copy(eye);let a=0,b=0;
    for(let i=0;i<matrices.length;i++){
      const distance=centres[i].distanceToSquared(eye);
      isNear[i]=distance<(isNear[i]?18*18:14*14);
      (isNear[i]?near:far).setMatrixAt(isNear[i]?a++:b++,matrices[i]);
    }
    near.count=a;far.count=b;near.instanceMatrix.needsUpdate=true;far.instanceMatrix.needsUpdate=true;
  };
  root.userData.precisionLod=()=>({near:near.count,far:far.count,total:matrices.length});
  root.userData.updateDetailLod(new THREE.Vector3(0,1.7,0));
}

export function precisionHatchGeometry() {
  const g=new THREE.PlaneGeometry(1.2,1.5,60,76),p=g.attributes.position,uv=g.attributes.uv;
  const rounded=(x,y,cx,cy,w,h,r)=>{
    const u=Math.abs((x-cx)*1.2)-w+r,v=Math.abs((y-cy)*1.5)-h+r;
    return Math.hypot(Math.max(u,0),Math.max(v,0))+Math.min(Math.max(u,v),0)-r;
  };
  for(let i=0;i<p.count;i++){
    const x=uv.getX(i),y=1-uv.getY(i),rim=rounded(x,y,.5,.5,.581,.731,.081);
    const seam=rim+.035;
    const pocket=Math.min(rounded(x,y,.5,.23,.118,.035,.019),rounded(x,y,.5,.77,.118,.035,.019));
    const crown=.006*smooth(-rim,0,.018),gasket=.005*(1-smooth(Math.abs(seam),.002,.012));
    const recess=.0045*smooth(-pocket,-.003,.006);
    p.setZ(i,crown-gasket-recess);
  }
  g.computeVertexNormals();return g;
}
