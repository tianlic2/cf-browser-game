import * as THREE from 'three';

// Reuse the AK's actual gloves, sleeves and UVs for the shared weapon IK.
// Bake once: other weapons retain their own grip/reload/melee choreography.
export function bakeClassicArms(view) {
  view.sample('idle_0',0);
  const result={},v=new THREE.Vector3(),normal=new THREE.Vector3(),m=new THREE.Matrix4(),nm=new THREE.Matrix3();
  for(const side of ['R','L']) {
    const wrist=view.bones.find(b=>b.name===`FvARM-bone ${side} Hand`).getWorldPosition(new THREE.Vector3());
    const ring=view.sleeveExtension.rings.find(r=>Math.sign(r.shoulder.x)===(side==='R'?1:-1));
    const axis=new THREE.Vector3(side==='R'?.23:-.23,-.80,.55).normalize();
    const sourceAxis=ring.shoulder.clone().sub(wrist).normalize();
    const cut=ring.points.reduce((p,v)=>p.add(v),new THREE.Vector3()).multiplyScalar(1/ring.points.length);
    const sleeveAxis=cut.clone().sub(wrist).normalize(),sleeveLength=cut.distanceTo(wrist);
    const straighten=new THREE.Quaternion().setFromUnitVectors(sleeveAxis,sourceAxis),warp=new THREE.Quaternion();
    const straightCut=cut.clone().sub(wrist).applyQuaternion(straighten).add(wrist);
    const q=new THREE.Quaternion().setFromUnitVectors(sourceAxis,axis);
    const transform=new THREE.Matrix4().compose(new THREE.Vector3(),q,new THREE.Vector3(1.35,1.35,1.35));
    const make=(mesh,extension=false)=>{
      const g=mesh.geometry,p=g.attributes.position,skin=g.attributes.skinIndex,out={position:[],normal:[],uv:[]};
      const indices=g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i);
      for(let i=0;i<indices.length;i+=3) {
        if(extension) {if(indices[i]<ring.offset||indices[i]>=ring.offset+ring.indices.length*3)continue;}
        else if(!view.bones[skin.getX(indices[i])].name.includes(` ${side} `))continue;
        // The SMD-to-camera transform is a reflection. Reverse its winding
        // when baking into a regular, positive-scale mesh.
        for(const j of extension?[0,1,2]:[0,2,1]) {
          const k=indices[i+j];
          if(extension){
            const local=k-ring.offset,row=Math.floor(local/ring.indices.length),j=local%ring.indices.length;
            v.copy(ring.points[j]).sub(cut).applyQuaternion(straighten).add(straightCut);
            v.addScaledVector(ring.shoulder.clone().sub(straightCut),row/2);
            normal.fromBufferAttribute(g.attributes.normal,k).applyQuaternion(straighten);
          }
          else {
            mesh.getVertexPosition(k,v);mesh.localToWorld(v);
            const bone=skin.getX(k);
            m.multiplyMatrices(view.bones[bone].matrixWorld,view.skeleton.boneInverses[bone]);
            normal.fromBufferAttribute(g.attributes.normal,k).applyNormalMatrix(nm.getNormalMatrix(m));
            if(mesh===view.sleeves) {
              // Straighten the upper sleeve for arbitrary weapon poses. Baking
              // the AK's bent elbow unchanged exposes its fold during stabbing.
              const onSeam=ring.points.some(p=>p.distanceToSquared(v)<1e-10);
              const t=onSeam?1:THREE.MathUtils.clamp((v.clone().sub(wrist).dot(sleeveAxis)-.025)/(sleeveLength-.025),0,1);
              warp.identity().slerp(straighten,t*t*(3-2*t));
              v.sub(wrist).applyQuaternion(warp).add(wrist);normal.applyQuaternion(warp);
            }
          }
          v.sub(wrist).applyMatrix4(transform);normal.applyQuaternion(q);
          out.position.push(v.x,v.y,v.z);out.normal.push(normal.x,normal.y,normal.z);
          out.uv.push(g.attributes.uv.getX(k),g.attributes.uv.getY(k));
        }
      }
      return out;
    };
    const hand=make(view.hands),fore=make(view.sleeves),tail=make(view.sleeveExtension.mesh,true);
    for(const key of Object.keys(fore))fore[key].push(...tail[key]);
    const geometry=data=>{const g=new THREE.BufferGeometry();for(const [key,a] of Object.entries(data))g.setAttribute(key,new THREE.Float32BufferAttribute(a,key==='uv'?2:3));return g;};
    const handGeometry=geometry(hand);handGeometry.computeBoundingBox();
    result[side]={hand:handGeometry,fore:geometry(fore),pivot:handGeometry.boundingBox.getCenter(new THREE.Vector3()).toArray(),axis:axis.toArray()};
  }
  result.material={hand:view.hands.material,fore:view.sleeves.material};
  return result;
}
