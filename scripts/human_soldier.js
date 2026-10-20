// Human Soldier native character + animation suite.
// The visual mesh, skeleton, rifle pose and every clip come from one authored
// package. The old CF/SWAT rig stays underneath as a transparent gameplay
// hitbox and as the loading-failure fallback; AI, navigation and damage rules
// never depend on this visual layer.
import * as THREE from 'three';
import { FBXLoader } from '../vendor/three/examples/jsm/loaders/FBXLoader.js';
import { ClassicSoldierRig, loadClassicSoldier } from './classic_soldier.js?v=motion-quality-1';
import { RIFLE_LEN } from './enemy_model.js';

const BASE=new URL('../assets/preview/human_soldier/',import.meta.url).href;
const MODEL='HumanM_Model.fbx';
const WEAPON='Human_AssaultRifle.fbx';
const PALETTE='HumanAnimations_ColorPalette.png';
const HOLD='HumanM@WeaponHold_AssaultRifle01.fbx';
// After FBX axis conversion the authored rifle points along local -Y and uses
// +Z as up. Catalog rifles point along +Z with +Y up.
const CATALOG_TO_PROP=new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1,0,0),Math.PI/2);
const CORE={
  aim:'HumanM@AssaultRifle_Aim01.fbx',
  fire:'HumanM@AssaultRifle_Aim01_Shoot01.fbx',
  reload:'HumanM@AssaultRifle_Reload01.fbx',
  hit_1:'HumanM@Damage01.fbx',hit_2:'HumanM@Damage02.fbx',
  death_1:'HumanM@Death01.fbx',death_2:'HumanM@Death02.fbx',death_3:'HumanM@Death03.fbx',
};
const DIRECTIONS={
  f:'Forward',fl:'ForwardLeft',l:'Left',bl:'BackwardLeft',
  b:'Backward',br:'BackwardRight',r:'Right',fr:'ForwardRight',
};
const FILES={...CORE};
for(const [id,suffix] of Object.entries(DIRECTIONS)){
  FILES['walk_'+id]=`HumanM@Walk01_${suffix}.fbx`;
  FILES['run_'+id]=`HumanM@Run01_${suffix}.fbx`;
}

let asset=null;
let loading=null;

function sourceClip(object,file){
  const source=object.animations?.[0];
  if(!source)throw new Error(`${file} 中没有动画轨道`);
  const tracks=source.tracks.filter(track=>!track.name.startsWith('Rig.')).map(track=>{
    const clone=track.clone();
    // NPC position belongs to the game's movement controller. Removing X/Z
    // root translation keeps the authored gait without visual drift or a
    // mismatch against collision and hitboxes. Vertical hip motion remains.
    if(/^(?:B-root|B-hips)\.position$/.test(clone.name)){
      const size=clone.getValueSize(),x=clone.values[0],z=clone.values[2];
      for(let i=0;i<clone.values.length;i+=size){clone.values[i]=x;clone.values[i+2]=z;}
    }
    return clone;
  });
  return new THREE.AnimationClip(source.name,source.duration,tracks);
}
function nodeName(track){return track.name.slice(0,track.name.lastIndexOf('.'));}
function upperBody(track){
  return /^B-(?:spine|spineProxy|chest|neck|head|jaw|shoulder|upperArm|forearm|hand|thumb|indexFinger|middleFinger|ringFinger|pinky)/.test(nodeName(track));
}
function movementWithHold(movement,hold){
  const lower=movement.tracks.filter(track=>!upperBody(track)).map(track=>track.clone());
  const upper=hold.tracks.filter(upperBody).map(track=>{
    const clone=track.clone();
    if(clone.times.length===1)return clone;
    const first=clone.values.slice(0,clone.getValueSize());
    clone.times=new Float32Array([0,movement.duration]);
    clone.values=new clone.values.constructor([...first,...first]);
    return clone;
  });
  return new THREE.AnimationClip(`${movement.name}+WeaponHold`,movement.duration,[...lower,...upper]);
}
function cloneSkinned(source){
  const clone=source.clone(true),lookup=new Map();
  const sourceNodes=[],cloneNodes=[];source.traverse(n=>sourceNodes.push(n));clone.traverse(n=>cloneNodes.push(n));
  for(let i=0;i<sourceNodes.length;i++)lookup.set(sourceNodes[i],cloneNodes[i]);
  for(const original of sourceNodes){
    if(!original.isSkinnedMesh)continue;
    const copy=lookup.get(original);
    copy.skeleton=new THREE.Skeleton(original.skeleton.bones.map(b=>lookup.get(b)),
      original.skeleton.boneInverses.map(m=>m.clone()));
    copy.bindMatrix.copy(original.bindMatrix);copy.bindMatrixInverse.copy(original.bindMatrixInverse);
    copy.bind(copy.skeleton,copy.bindMatrix);
  }
  return clone;
}

export async function loadHumanSoldier(){
  if(asset)return true;if(loading)return loading;
  loading=(async()=>{
    const classic=loadClassicSoldier();
    try{
      const loader=new FBXLoader(),textureLoader=new THREE.TextureLoader();
      const entries=Object.entries(FILES);
      const [model,weapon,palette,holdObject,...clipObjects]=await Promise.all([
        loader.loadAsync(BASE+MODEL),loader.loadAsync(BASE+WEAPON),textureLoader.loadAsync(BASE+PALETTE),
        loader.loadAsync(BASE+HOLD),...entries.map(([,file])=>loader.loadAsync(BASE+file)),classic,
      ]);
      palette.colorSpace=THREE.SRGBColorSpace;palette.magFilter=THREE.NearestFilter;
      palette.minFilter=THREE.NearestFilter;
      const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
      const scale=1.78/Math.max(size.y,.001),floor=-box.min.y*scale;
      const hold=sourceClip(holdObject,HOLD),clips={};
      entries.forEach(([id,file],i)=>{
        const clip=sourceClip(clipObjects[i],file);
        clips[id]=/^(?:walk|run)_/.test(id)?movementWithHold(clip,hold):clip;
      });
      model.traverse(node=>{if(node.isMesh){node.material=Array.isArray(node.material)
        ?node.material.map(m=>{const c=m.clone();c.map=palette;c.color.set(0xffffff);c.needsUpdate=true;return c;})
        :(()=>{const c=node.material.clone();c.map=palette;c.color.set(0xffffff);c.needsUpdate=true;return c;})();}});
      weapon.traverse(node=>{if(node.isMesh){node.material=Array.isArray(node.material)
        ?node.material.map(m=>{const c=m.clone();c.map=palette;c.color.set(0xffffff);c.needsUpdate=true;return c;})
        :(()=>{const c=node.material.clone();c.map=palette;c.color.set(0xffffff);c.needsUpdate=true;return c;})();}});
      asset={model,weapon,weaponBox:new THREE.Box3().setFromObject(weapon),clips,scale,floor};return true;
    }catch(error){
      console.warn('Human Soldier 动作加载失败，继续使用经典 SWAT：',error);
      await classic;return false;
    }
  })();
  return loading;
}

function directionName(side,forward){
  const sector=((Math.round(Math.atan2(side,forward)/(Math.PI/4))%8)+8)%8;
  // Enemy movement reports +side as local right. Keep this table in the same
  // convention as the authored ForwardRight / Right clips.
  return ['f','fr','r','br','b','bl','l','fl'][sector];
}
function materialsOf(root){
  const out=[];root.traverse(node=>{
    if(!node.isMesh)return;
    node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;
    const list=Array.isArray(node.material)?node.material:[node.material];
    const copies=list.map(material=>material.clone());
    node.material=Array.isArray(node.material)?copies:copies[0];out.push(...copies);
  });return out;
}

export class HumanSoldierRig extends ClassicSoldierRig{
  constructor(rifle){
    super(null);
    if(!asset){if(rifle)super.setRifle(rifle);return;}
    this.source='human-soldier-native';
    this.nativeDeath=true;
    // Retain the proven SWAT triangles as transparent gameplay hitboxes. They
    // still receive the shared procedural pose but no longer contribute pixels.
    for(const material of this.mats){material.colorWrite=false;material.depthWrite=false;
      material.transparent=true;material.opacity=0;material.needsUpdate=true;}
    for(const mesh of this.meshes){mesh.visible=true;mesh.castShadow=false;}
    this.nativeActor=cloneSkinned(asset.model);
    this.nativeActor.name='human-soldier-native-visual';
    this.nativeActor.scale.setScalar(asset.scale);this.nativeActor.position.y=asset.floor;
    this.visualMats=materialsOf(this.nativeActor);
    this.root.add(this.nativeActor);
    const socket=this.nativeActor.getObjectByName('B-handPropR')||this.nativeActor.getObjectByName('B-handProp.R');
    if(!socket)throw new Error('Human Soldier 缺少右手武器挂点');
    this.nativeWeaponSocket=socket;
    this.visualWeapon=asset.weapon.clone(true);this.visualWeapon.name='human-soldier-native-rifle';
    materialsOf(this.visualWeapon);
    this.visualWeapon.position.set(-.8,3.5,-.2);
    this.visualWeapon.quaternion.set(-.00000049220387,.707107,-.00000017369162,.7071066).normalize()
      .multiply(new THREE.Quaternion(-Math.SQRT1_2,0,0,Math.SQRT1_2));
    socket.add(this.visualWeapon);
    this.nativeLoadout=null;
    this.nativeMixer=new THREE.AnimationMixer(this.nativeActor);
    this.nativeActions=new Map();this.nativeAction=null;this.nativeName='';
    this.nativeHitT=0;this.nativeShotT=0;this.nativeFlinch=0;this.nativeDeathName='death_1';
    if(rifle)this.setRifle(rifle);
    this._activateNative('aim',true,0);
    this.nativeMixer.update(0);
  }

  setRifle(template,gunId){
    super.setRifle(template,gunId);
    if(this.nativeWeaponSocket){
      if(this.nativeLoadout)this.nativeWeaponSocket.remove(this.nativeLoadout);
      this.nativeLoadout=null;
      if(template){
        const box=asset.weaponBox,center=box.getCenter(new THREE.Vector3());
        const holder=new THREE.Group();holder.name=`human-soldier-${gunId||'rifle'}-loadout`;
        holder.position.copy(this.visualWeapon.position).add(center.applyQuaternion(this.visualWeapon.quaternion));
        holder.quaternion.copy(this.visualWeapon.quaternion).multiply(CATALOG_TO_PROP);
        // The imported prop uses FBX units; the catalog model is already in
        // metres. Match its authored length once on spawn, not every frame.
        holder.scale.setScalar(box.getSize(new THREE.Vector3()).y/RIFLE_LEN*(gunId==='barrett'?1.2:1));
        holder.add(template.clone(true));this.nativeWeaponSocket.add(holder);
        this.nativeLoadout=holder;
        if(this.muzzleFlash){
          holder.add(this.muzzleFlash);
          this.muzzleFlash.position.set(0,.02,RIFLE_LEN/2+.03);
        }
      }else if(this.muzzleFlash){
        this.mount.add(this.muzzleFlash);
        this.muzzleFlash.position.set(0,.02,RIFLE_LEN/2+.03);
      }
      this.visualWeapon.visible=!this.nativeLoadout;
    }
    // The procedural rig remains the gameplay hitbox. Only the matching model
    // at the animated right hand supplies pixels and the muzzle position.
    if(this.rifle)this.rifle.visible=false;
  }

  muzzleBody(out){
    if(!this.nativeLoadout)return super.muzzleBody(out);
    // A shot is sparse; refresh just this animated hand chain, then express
    // the real muzzle in the same body-local coordinates Enemy.muzzleWorld uses.
    out.set(0,.02,RIFLE_LEN/2+.03);
    this.nativeLoadout.localToWorld(out);
    this.root.worldToLocal(out);
    return out;
  }

  reset(){
    super.reset();
    if(!this.nativeMixer)return;
    this.nativeMixer.stopAllAction();this.nativeActions.clear();this.nativeAction=null;this.nativeName='';
    this.nativeHitT=this.nativeShotT=this.nativeFlinch=0;
    this.nativeDeathName=`death_${1+Math.floor(Math.random()*3)}`;
    if(this.visualWeapon)this.visualWeapon.visible=!this.nativeLoadout;
    if(this.nativeLoadout)this.nativeLoadout.visible=true;
    this._activateNative('aim',true,0);this.nativeMixer.update(0);
  }

  _action(name){
    let action=this.nativeActions.get(name);
    if(!action){action=this.nativeMixer.clipAction(asset.clips[name]);this.nativeActions.set(name,action);}
    return action;
  }

  _activateNative(name,loop=true,fade=.10,reset=true){
    if(this.nativeName===name){
      if(reset){
        this.nativeAction.enabled=true;this.nativeAction.paused=false;
        this.nativeAction.reset().play();
      }
      return this.nativeAction;
    }
    const next=this._action(name),previous=this.nativeAction;
    next.enabled=true;next.setEffectiveWeight(1);next.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);
    next.clampWhenFinished=!loop;if(reset)next.reset();next.play();
    if(previous&&fade>0)previous.crossFadeTo(next,fade,true);else if(previous)previous.stop();
    this.nativeAction=next;this.nativeName=name;return next;
  }

  animate(dt,s){
    super.animate(dt,s);
    if(!this.nativeMixer)return;
    this.nativeShotT=Math.max(0,this.nativeShotT-dt);
    this.nativeHitT=Math.max(0,this.nativeHitT-dt);
    const flinch=Number.isFinite(s.flinch)?s.flinch:0;
    if(flinch>.72&&this.nativeFlinch<=.72){this.nativeHitT=.34;
      this._activateNative(Math.random()<.5?'hit_1':'hit_2',false,.045,true);}
    this.nativeFlinch=flinch;
    const reloading=Number.isFinite(s.reload)&&s.reload>0&&s.reload<1&&!s.dead;
    if(s.dead){
      this._activateNative(this.nativeDeathName,false,.06,this.nativeName!==this.nativeDeathName);
      if(this.visualWeapon)this.visualWeapon.visible=false;
      if(this.nativeLoadout)this.nativeLoadout.visible=false;
      this.nativeMixer.update(dt);
    }else if(reloading){
      const action=this._activateNative('reload',false,.08,this.nativeName!=='reload');
      action.paused=true;action.time=Math.min(asset.clips.reload.duration*.999,s.reload*asset.clips.reload.duration);
      this.nativeMixer.update(0);
    }else if(this.nativeShotT>0){
      const action=this._activateNative('fire',false,.035,this.nativeName!=='fire');action.paused=false;
      this.nativeMixer.update(dt);
    }else if(this.nativeHitT>0){
      if(this.nativeAction)this.nativeAction.paused=false;this.nativeMixer.update(dt);
    }else{
      const moving=this.motionSpeed>.28&&this.walkW>.08;
      const gait=this.motionSpeed>2.15?'run':'walk';
      const name=moving?`${gait}_${directionName(this.motionSide,this.motionForward)}`:'aim';
      const action=this._activateNative(name,true,.12,this.nativeName!==name);action.paused=false;
      action.timeScale=moving?THREE.MathUtils.clamp(this.motionSpeed/(gait==='run'?3.35:1.55),.55,1.45):1;
      this.nativeMixer.update(dt);
    }
    if(!s.dead){
      if(this.visualWeapon)this.visualWeapon.visible=!this.nativeLoadout;
      if(this.nativeLoadout)this.nativeLoadout.visible=true;
    }
  }

  recoil(power=1){
    this.nativeShotT=.20;
    // Automatic fire must restart the authored shot on every bullet. Letting a
    // LoopOnce action keep its previous end time makes later rounds look frozen.
    if(this.nativeMixer)this._activateNative('fire',false,.035,true);
    super.recoil(power);
  }

  setFlash(k){
    if(!this.visualMats)return super.setFlash(k);
    for(const material of this.visualMats){
      if(!material.emissive)continue;
      material.emissive.setRGB(.85*k,.025*k,.025*k);material.emissiveIntensity=1;
    }
  }

  detachHelmet(){return null;}
}
