// CF SWAT source mesh, retargeted onto the existing locomotion/weapon IK driver.
// Geometry/textures are shared; skeletons and hit-flash materials are per actor.
import * as THREE from 'three';
import { SoldierRig } from './enemy_model.js';

const BASE=new URL('../assets/classic/',import.meta.url).href;
const C=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
const CI=C.clone().invert();
let asset=null;
export async function loadClassicSoldier() {
  try {
    const r=await fetch(BASE+'swat/swat.json');if (!r.ok) throw new Error('SWAT 数据缺失');
    const data=await r.json();
    const response=await fetch(BASE+'swat/swat.bin');if (!response.ok) throw new Error('SWAT 网格缺失');
    const binary=await response.arrayBuffer();
    const textures=await Promise.all(data.parts.map(p=>new THREE.TextureLoader().loadAsync(BASE+p.material.map)));
    const geometries=[];
    data.parts.forEach((p,pi)=>{
      textures[pi].colorSpace=THREE.SRGBColorSpace;textures[pi].anisotropy=8;
      const a=new Float32Array(binary,p.offset,p.count*16);
      const buckets={body:[],head:[]};
      for (let i=0;i<p.count;i+=3) {
        let head=0;
        for(let v=0;v<3;v++)for(let w=0;w<4;w++) if(a[(i+v)*16+8+w]===14)head+=a[(i+v)*16+12+w];
        const bucket=buckets[head>1.5?'head':'body'];
        for(let v=0;v<3;v++)for(let k=0;k<16;k++)bucket.push(a[(i+v)*16+k]);
      }
      for(const [part,values] of Object.entries(buckets)) {
        if(!values.length)continue;
        const n=values.length/16, positions=[],normals=[],uv=[],joints=[],weights=[];
        const v=new THREE.Vector3();
        for(let i=0;i<n;i++) {
          const o=i*16;
          v.fromArray(values,o).applyQuaternion(C).multiplyScalar(.0254);positions.push(v.x,v.y,v.z);
          v.fromArray(values,o+3).applyQuaternion(C);normals.push(v.x,v.y,v.z);
          uv.push(values[o+6],1-values[o+7]);
          joints.push(...values.slice(o+8,o+12));weights.push(...values.slice(o+12,o+16));
        }
        const g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
        g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
        g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));
        g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
        geometries.push({geometry:g,part,texture:pi});
      }
    });
    asset={data,textures,geometries};return true;
  }catch(error){console.warn('经典角色加载失败，使用内置骨架：',error);return false;}
}

export class ClassicSoldierRig extends SoldierRig {
  constructor(rifle) {
    super(rifle);
    if(!asset)return;
    this.source='cf-swat-reborn';
    this.corpseHeight=.35;
    // Keep only the driver's transform hierarchy and rifle. Hidden primitive
    // meshes do not participate in raycasting; actual skinned triangles do.
    for(const m of this.meshes)m.visible=false;
    for(const m of this.mats)m.dispose();
    this.meshes=[];
    this.mats=asset.textures.map(map=>new THREE.MeshStandardMaterial({map,roughness:.88,metalness:0,envMapIntensity:.22}));
    this.headMats=[];
    this.bones=asset.data.bones.map(b=>{
      const bone=new THREE.Bone();bone.name=b.name;
      bone.position.fromArray(b.position).applyQuaternion(C).multiplyScalar(.0254);
      bone.quaternion.copy(C).multiply(new THREE.Quaternion().fromArray(b.quaternion)).multiply(CI);
      return bone;
    });
    this.skinRoot=new THREE.Group();this.root.add(this.skinRoot);
    this.bones.forEach((bone,i)=>{
      const parent=asset.data.bones[i].parent;
      (parent>=0?this.bones[parent]:this.skinRoot).add(bone);
    });
    this.skinRoot.updateMatrixWorld(true);
    this.bindPos=this.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
    this.bindQ=this.bones.map(b=>b.getWorldQuaternion(new THREE.Quaternion()));
    this.rest=this.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
    this.skeleton=new THREE.Skeleton(this.bones);
    for(const entry of asset.geometries) {
      const m=new THREE.SkinnedMesh(entry.geometry,this.mats[entry.texture]);
      m.name='classic-swat-'+entry.part;m.userData.part=entry.part;
      m.frustumCulled=false;
      m.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.9,0),2.5);
      this.skinRoot.add(m);m.bind(this.skeleton,new THREE.Matrix4());this.meshes.push(m);
      if(entry.part==='head')this.headMats.push(m.material);
    }
    this._retarget();
  }

  animate(dt,s) { super.animate(dt,s);if(this.skeleton)this._retarget(); }

  _retarget() {
    // Work in the actor's foot coordinate system, independent of enemy yaw and
    // the outer corpse pivot. Preserve the original bone roll during retarget.
    this.root.updateWorldMatrix(true,true);
    const inv=this.root.matrixWorld.clone().invert();
    const iq=this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const pos=node=>node.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const rot=node=>iq.clone().multiply(node.getWorldQuaternion(new THREE.Quaternion()));
    const pelvis=pos(this.pelvis),chest=pos(this.chest),neck=pos(this.neck);
    const targets=new Map();
    const set=(i,p,q)=>targets.set(i,{p,q});
    set(0,pelvis,rot(this.pelvis));
    set(9,pos(this.spine),rot(this.spine));
    set(10,pos(this.spine).lerp(chest,.45),rot(this.spine));
    set(11,chest,rot(this.chest));
    set(12,chest.clone().lerp(neck,.78),rot(this.chest));
    set(13,neck,rot(this.neck));set(14,pos(this.head),rot(this.head));
    const segment=(i,j,a,b)=>{
      const p=pos(a),end=pos(b);
      const from=this.bindPos[j].clone().sub(this.bindPos[i]).normalize();
      const to=end.clone().sub(p).normalize();
      set(i,p,new THREE.Quaternion().setFromUnitVectors(from,to).multiply(this.bindQ[i]));
    };
    for(const [leg,a,b,c] of [[this.legL,1,2,3],[this.legR,5,6,7]]) {
      segment(a,b,leg.hip,leg.knee);segment(b,c,leg.knee,leg.ankle);
      set(c,pos(leg.ankle),rot(leg.ankle).multiply(this.bindQ[c]));
    }
    for(const [arm,cl,a,b,c] of [[this.armL,15,16,17,18],[this.armR,28,29,30,31]]) {
      set(cl,chest.clone().lerp(neck,.86).lerp(pos(arm.sh),.22),rot(this.chest).multiply(this.bindQ[cl]));
      segment(a,b,arm.sh,arm.el);segment(b,c,arm.el,arm.hd);
      set(c,pos(arm.hd),rot(arm.hd).multiply(this.bindQ[c]));
    }
    this.bones.forEach((bone,i)=>{
      const t=targets.get(i),parent=asset.data.bones[i].parent;
      bone.position.copy(this.rest[i].p);bone.quaternion.copy(this.rest[i].q);
      if(t) {
        const parentMatrix=parent>=0?this.bones[parent].matrixWorld:new THREE.Matrix4();
        bone.position.copy(t.p).applyMatrix4(parentMatrix.clone().invert());
        const pq=new THREE.Quaternion().setFromRotationMatrix(parentMatrix).invert();
        // Torso/head targets are rotation deltas, limbs already carry bind roll.
        const q=t.q.clone();if([0,9,10,11,12,13,14].includes(i))q.multiply(this.bindQ[i]);
        bone.quaternion.copy(pq).multiply(q);
      }
      bone.updateMatrix();
      bone.matrixWorld.copy(parent>=0?this.bones[parent].matrixWorld:new THREE.Matrix4()).multiply(bone.matrix);
    });
    // matrices above deliberately use actor coordinates; the scene graph adds
    // enemy/world transforms at render and raycast time.
    this.skinRoot.updateMatrixWorld(true);this.skeleton.update();
  }
}
