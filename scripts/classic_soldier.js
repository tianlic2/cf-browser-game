// CF SWAT source mesh, retargeted onto the existing locomotion/weapon IK driver.
// Geometry/textures are shared; skeletons and hit-flash materials are per actor.
import * as THREE from 'three';
import { SoldierRig } from './enemy_model.js';
import { makeGLTFLoader } from './gltf.js';

const BASE=new URL('../assets/classic/',import.meta.url).href;
const SWAT_BL=new URL('../models/swat_bl.glb',import.meta.url).href;
const C=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
const CI=C.clone().invert();
const MODEL_SCALE=0.00957;
const MODEL_FLOOR=109.597 * MODEL_SCALE;
let asset=null;
export async function loadClassicSoldier() {
  try {
    const r=await fetch(BASE+'swat/swat.json');if (!r.ok) throw new Error('SWAT 数据缺失');
    const data=await r.json();
    const [gltf,weightResponse]=await Promise.all([
      makeGLTFLoader().loadAsync(SWAT_BL),
      fetch(BASE+'swat/swat_bl_weights.bin'),
    ]);
    if(!weightResponse.ok)throw new Error('SWAT BL 蒙皮权重缺失');
    const weights=new Uint8Array(await weightResponse.arrayBuffer());
    gltf.scene.updateMatrixWorld(true);
    const parts=[];
    gltf.scene.traverse(node=>{if(node.isMesh)parts.push(node);});
    if(parts.length!==4 || parts.some((mesh,i)=>mesh.geometry.attributes.position.count!==[498,478,55,1641][i]))
      throw new Error('SWAT BL 网格布局与蒙皮权重不匹配');
    const expected=parts.reduce((sum,mesh)=>sum+mesh.geometry.attributes.position.count*8,0);
    if(weights.length!==expected)throw new Error('SWAT BL 蒙皮权重长度不匹配');
    const geometries=[];
    let offset=0;
    parts.forEach((mesh,i)=>{
      // The GLB scene's -90° X rotation changes Z-up into the game's Y-up.
      // Keep the source geometry, normals, UVs and embedded diffuse textures.
      const geometry=mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      geometry.rotateY(Math.PI);
      geometry.scale(MODEL_SCALE,MODEL_SCALE,MODEL_SCALE);
      geometry.translate(0,MODEL_FLOOR,0);
      const count=geometry.attributes.position.count;
      const skinIndex=new Uint8Array(count*4),skinWeight=new Uint8Array(count*4);
      for(let v=0;v<count;v++) {
        const at=offset+v*8;
        skinIndex.set(weights.subarray(at,at+4),v*4);
        skinWeight.set(weights.subarray(at+4,at+8),v*4);
      }
      offset+=count*8;
      geometry.setAttribute('skinIndex',new THREE.Uint8BufferAttribute(skinIndex,4));
      geometry.setAttribute('skinWeight',new THREE.Uint8BufferAttribute(skinWeight,4,true));
      if(mesh.material.map)mesh.material.map.anisotropy=8;
      geometries.push({geometry,part:i<2?'head':'body',helmet:i===1,
        map:mesh.material.map});
    });
    asset={data,geometries};return true;
  }catch(error){console.warn('经典角色加载失败，使用内置骨架：',error);return false;}
}

export class ClassicSoldierRig extends SoldierRig {
  constructor(rifle) {
    super(rifle);
    if(!asset)return;
    this.source='swat-bl-glb';
    this.corpseHeight=.35;
    this.corpseHeightBack=.26;
    // Keep only the driver's transform hierarchy and rifle. Hidden primitive
    // meshes do not participate in raycasting; actual skinned triangles do.
    for(const m of this.meshes)m.visible=false;
    for(const m of this.mats)m.dispose();
    this.meshes=[];
    this.mats=asset.geometries.map(entry=>new THREE.MeshStandardMaterial({
      map:entry.map,roughness:.88,metalness:0,envMapIntensity:.22,
    }));
    this.headMats=[];
    this.helmetMeshes=[];
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
    // This GLB is an unrigged, forward-reaching pose. Its shoulders, elbows
    // and palms sit above/in front of the older SWAT bind pose. Set limb bind
    // pivots to the new mesh before recording inverse matrices, so the same
    // weapon IK brings the *visible* gloves to the gun instead of only its
    // invisible driver hands. Source geometry itself remains untouched.
    const armBind={
      16:[.23,1.60,-.04],17:[.37,1.38,-.01],18:[.50,1.15,.25],
      29:[-.23,1.60,-.04],30:[-.37,1.38,-.01],31:[-.50,1.15,.25],
    };
    this.skinRoot.updateMatrixWorld(true);
    for(const [key,point] of Object.entries(armBind)) {
      const i=Number(key),bone=this.bones[i],parent=bone.parent;
      bone.position.copy(parent.worldToLocal(new THREE.Vector3(...point)));
      bone.updateMatrixWorld(true);
    }
    this.skinRoot.updateMatrixWorld(true);
    this.bindPos=this.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
    this.bindQ=this.bones.map(b=>b.getWorldQuaternion(new THREE.Quaternion()));
    this.rest=this.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
    this.skeleton=new THREE.Skeleton(this.bones);
    for(const [i,entry] of asset.geometries.entries()) {
      const m=new THREE.SkinnedMesh(entry.geometry,this.mats[i]);
      m.name='classic-swat-'+entry.part;m.userData.part=entry.part;
      m.frustumCulled=false;
      m.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.9,0),2.5);
      this.skinRoot.add(m);m.bind(this.skeleton,new THREE.Matrix4());this.meshes.push(m);
      if(entry.part==='head')this.headMats.push(m.material);
      if(entry.helmet)this.helmetMeshes.push(m);
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
