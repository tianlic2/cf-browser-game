// Unity CrossFire Fox: one source skeleton/mesh and its authored movement,
// reload, hit and death clips. ClassicSoldierRig only supplies the hidden
// weapon/event plumbing; it must never become the visible runtime character.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { cloneSkinned } from './skinned_clone.js';
import { ClassicSoldierRig } from './classic_soldier.js?v=omoh-return-1';
import { createFoxBreathingIdle } from './fox_idle.js';
import { FOX_MODEL_HEIGHT, FOX_MODEL_SCALE } from './fox_dimensions.js';

const BASE = new URL('../assets/local/fox_npc/', import.meta.url).href;
let source = null;
const V = new THREE.Vector3();
const W = new THREE.Vector3();
const Q = new THREE.Quaternion();

function geometryFor(mesh, groups) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(mesh.geometry.attributes))
    geometry.setAttribute(name, attribute);
  if (mesh.geometry.index) geometry.setIndex(mesh.geometry.index);
  for (const [start, count, materialIndex] of groups)
    geometry.addGroup(start, count, materialIndex);
  geometry.boundingBox = mesh.geometry.boundingBox?.clone() || null;
  geometry.boundingSphere = mesh.geometry.boundingSphere?.clone() || null;
  return geometry;
}

function cutRootMotion(clip) {
  // The AI/collision owns world displacement and facing. Keep native limbs,
  // torso and vertical fall while removing only the exported root's X/Y travel.
  for (const track of clip.tracks) {
    if (track.name === 'Bip01.position') {
      const x = track.values[0], y = track.values[1];
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = x;
        track.values[i + 1] = y;
      }
    }
  }
}

function settleDeathClip(clip) {
  // The source FBX restores its idle pose on its final frame. Stop shortly
  // before that reset so a corpse remains down until the object pool clears it.
  const settled = clip.clone();
  settled.duration = clip.duration * .93;
  settled.trim();
  return settled;
}

function deathFloorProfiles(actor, mesh, mixer, clips, scale, floorOffset) {
  // Sample the actual skinned triangles once while loading. Several authored
  // falls put limbs below the FBX foot origin; lifting by these sampled floor
  // envelopes keeps the corpse above the map without a per-frame mesh scan.
  const vertex = new THREE.Vector3();
  const positions = mesh.geometry.attributes.position;
  const profiles = new Map();
  for (const name of ['death-grounded']) {
    mixer.stopAllAction();
    const clip = clips.get(name);
    const action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const lifts = [];
    for (let i = 0; i <= 40; i++) {
      mixer.setTime(clip.duration * i / 40);
      actor.updateMatrixWorld(true);
      let minY = Infinity;
      for (let j = 0; j < positions.count; j++) {
        vertex.fromBufferAttribute(positions, j);
        mesh.applyBoneTransform(j, vertex).applyMatrix4(mesh.matrixWorld);
        if (vertex.y < minY) minY = vertex.y;
      }
      lifts.push(Math.max(0, -minY * scale - floorOffset + .015));
    }
    profiles.set(name, lifts);
  }
  mixer.stopAllAction();
  mixer.clipAction(clips.get('idle1')).reset().play();
  mixer.update(0);
  return profiles;
}

function deathFloorLift(profile, progress) {
  if (!profile) return 0;
  const position = Math.max(0, Math.min(1, progress)) * (profile.length - 1);
  const index = Math.min(profile.length - 2, Math.floor(position));
  const fraction = position - index;
  // Dense samples and a small clearance cover extrema between sample frames.
  return profile[index] * (1 - fraction) + profile[index + 1] * fraction + .012;
}

function upperClip(clip, name) {
  const tracks = clip.tracks.filter(track =>
    /^Bip01_(Spine|Neck|Head|L_(Clavicle|UpperArm|Forearm|Hand|Finger)|R_(Clavicle|UpperArm|Forearm|Hand|Finger))/.test(track.name));
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

function reactionClip(clip, name) {
  // 受击只扰动脊柱、颈部和头部。源 gutshot 还带有大幅手臂/手指轨道，
  // 直接以满权重覆盖会让双手瞬间离枪、肩肘扭曲，看起来像整个人抽了一下。
  const tracks = clip.tracks.filter(track =>
    /^Bip01_(Spine|Neck|Head)/.test(track.name));
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

// `left` 是这组源动作中唯一在末帧让头、胸、髋同时贴近地面的完整倒地姿势。
// 其可见倒向为人物局部 +X；绕世界竖直轴旋转同一原生动作，即可覆盖四个受击方向，
// 同时避免另外三段末帧“头/手着地、躯干和腿悬空”的源数据缺陷。
const GROUNDED_DEATH_YAW = Object.freeze({
  left: 0,
  right: Math.PI,
  forward: -Math.PI / 2,
  back: Math.PI / 2,
});

export async function loadFoxSoldier() {
  if (source) return true;
  try {
    const textureLoader = new THREE.TextureLoader();
    // FBX 中仍写着导出机上的 BMP 文件名；项目保存的是同内容 PNG，并会在下方显式
    // 覆盖材质。把加载器内部的旧请求也指向现有文件，避免浏览器等待三个 404 后卡在 66%。
    const fbxManager = new THREE.LoadingManager();
    const embeddedTextureAliases = {
      'woman_body_bl.bmp': BASE + 'body.png',
      'woman_face_bl.bmp': BASE + 'face.png',
      'ddfcd20.bmp': BASE + 'ddfcd20.png',
    };
    fbxManager.setURLModifier(url => {
      const file = decodeURIComponent(url).split('/').at(-1).toLowerCase();
      return embeddedTextureAliases[file] || url;
    });
    const [actor, body, face, hair] = await Promise.all([
      new FBXLoader(fbxManager).loadAsync(BASE + 'fox.fbx'),
      textureLoader.loadAsync(BASE + 'body.png'),
      textureLoader.loadAsync(BASE + 'face.png'),
      textureLoader.loadAsync(BASE + 'ddfcd20.png'),
    ]);
    for (const map of [body, face, hair]) {
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 8;
    }
    const mesh = actor.getObjectByName('OMOH_GR_gm3');
    if (!mesh?.isSkinnedMesh || actor.animations.length < 30)
      throw new Error('Fox 网格、骨骼或原生动作不完整');
    const groups = mesh.geometry.groups;
    if (groups.length !== 3 || groups[0].count + groups[1].count + groups[2].count !==
      mesh.geometry.attributes.position.count)
      throw new Error('Fox 身体/面部/头发网格分组不匹配');
    const materials = [body, face, hair].map(map => new THREE.MeshStandardMaterial({
      map, color: 0xffffff, roughness: .9, metalness: 0, side: THREE.DoubleSide,
    }));
    const bodyMesh = new THREE.SkinnedMesh(
      geometryFor(mesh, [[groups[0].start, groups[0].count, 0]]), materials[0]);
    const headMesh = new THREE.SkinnedMesh(
      geometryFor(mesh, [[groups[1].start, groups[1].count, 0],
        [groups[2].start, groups[2].count, 1]]), materials.slice(1));
    for (const part of [bodyMesh, headMesh]) {
      part.position.copy(mesh.position);
      part.quaternion.copy(mesh.quaternion);
      part.scale.copy(mesh.scale);
      part.bind(mesh.skeleton, mesh.bindMatrix.clone());
      part.bindMode = mesh.bindMode;
      part.frustumCulled = false;
      part.castShadow = false;
      part.receiveShadow = false;
      part.userData.part = part === headMesh ? 'head' : 'body';
      mesh.parent.add(part);
    }
    mesh.parent.remove(mesh);
    const clips = new Map();
    for (const clip of actor.animations) {
      const name = clip.name.split('|').at(-1);
      cutRootMotion(clip);
      clips.set(name, ['forward', 'back', 'left', 'right'].includes(name)
        ? settleDeathClip(clip) : clip);
    }
    for (const [key, raw] of [['reload-ak', 'ref_reload_ak47'],
      ['reload-rifle', 'ref_reload_rifle']]) {
      const clip = clips.get(raw);
      if (clip) clips.set(key, upperClip(clip, key));
    }
    for (const name of ['idle1', 'run.001', 'ref_reload_ak47',
      'gutshot', 'head', 'death1', 'forward', 'back', 'left', 'right'])
      if (!clips.has(name)) throw new Error('Fox 缺少原生动作 ' + name);
    clips.set('idle-calm', createFoxBreathingIdle(clips.get('idle1')));
    clips.set('hit-body', reactionClip(clips.get('gutshot'), 'hit-body'));
    clips.set('hit-head', reactionClip(clips.get('head'), 'hit-head'));
    clips.set('death-grounded', clips.get('left').clone());
    // FBX geometry is in source centimeters with a 100x mesh transform.
    // Normalize once, then apply the approved 5% uniform enlargement. Uniform
    // scaling preserves the source proportions, animation and hand placement.
    const mixer = new THREE.AnimationMixer(actor);
    mixer.clipAction(clips.get('idle1')).play();
    mixer.update(0);
    actor.updateMatrixWorld(true);
    const sourceHead = actor.getObjectByName('Bip01_Head');
    if (!sourceHead) throw new Error('Fox 缺少头部骨骼');
    // The jaw plane follows authored head motion in this bone's local basis.
    const headLocalUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
      sourceHead.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
    const bounds = new THREE.Box3().setFromObject(actor);
    const size = bounds.getSize(new THREE.Vector3());
    if (!(size.y > 0)) throw new Error('Fox 人物尺寸无效');
    const scale = FOX_MODEL_HEIGHT / size.y;
    const center = bounds.getCenter(new THREE.Vector3());
    const offset = new THREE.Vector3(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    const deathFloors = deathFloorProfiles(actor, bodyMesh, mixer, clips, scale, offset.y);
    source = { actor, clips, scale, headLocalUp, offset, deathFloors };
    return true;
  } catch (error) {
    // The approved Fox appearance is a required gameplay asset. A silent
    // ClassicSoldier fallback made a transient FBX/texture failure look like
    // an intentional character replacement, so fail the loading screen and
    // offer its normal retry flow instead.
    console.error('Fox 源人物加载失败：', error);
    throw new Error('Fox 人物模型加载失败，请重试', { cause: error });
  }
}

export class FoxSoldierRig extends ClassicSoldierRig {
  constructor(rifle) {
    super(rifle);
    if (!source) throw new Error('FoxSoldierRig 创建前必须先加载 Fox 源模型');
    this.source = 'fox-original-fbx';
    this.nativeDeath = true;
    // The old procedural rig is a hidden gun/event driver only. Source Fox
    // triangles are the visible model and authoritative bullet hit surfaces.
    for (const mesh of this.meshes) mesh.visible = false;
    this.meshes = [];
    this.helmetMeshes = [];
    this.foxHolder = new THREE.Group();
    this.foxHolder.position.copy(source.offset);
    this.foxHolder.scale.setScalar(source.scale);
    this.root.add(this.foxHolder);
    this.fox = cloneSkinned(source.actor);
    this.foxHolder.add(this.fox);
    this.headBone = this.fox.getObjectByName('Bip01_Head');
    this.fox.traverse(node => {
      if (!node.isSkinnedMesh || !node.userData.part) return;
      node.userData.headRegion = {
        bone: this.headBone, upLocal: source.headLocalUp,
        axisRoot: this.foxHolder,
        modelScale: FOX_MODEL_SCALE,
        headBoneIndex: node.skeleton.bones.indexOf(this.headBone),
      };
      node.material = Array.isArray(node.material)
        ? node.material.map(material => material.clone()) : node.material.clone();
      this.meshes.push(node);
    });
    this.mats = this.meshes.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
    this.headMats = this.meshes.filter(mesh => mesh.userData.part === 'head')
      .flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
    this.hand = this.fox.getObjectByName('Bip01_R_Hand');
    this.mixer = new THREE.AnimationMixer(this.fox);
    this.actions = new Map();
    for (const [name, clip] of source.clips) this.actions.set(name, this.mixer.clipAction(clip));
    this.reset();
  }

  setRifle(template, gunId) {
    super.setRifle(template, gunId);
    this.gunId = gunId || 'm4';
  }

  reset() {
    if (!this.fox) return super.reset();
    this.mount.visible = true;
    this.flashLife = 0;
    this.kick = 0;
    this._lastPose = null;
    if (this.muzzleFlash) this.muzzleFlash.visible = false;
    this.mixer.stopAllAction();
    this.baseAction = null;
    this.baseName = '';
    this.reloadAction = null;
    this.hitAction = null;
    this.wasReloading = false;
    this.wasHit = false;
    this.deadStarted = false;
    this.foxHolder.position.y = source.offset.y;
    this.fox.rotation.y = 0;
    this._switchBase('idle-calm', 0);
    this.mixer.update(0);
    this._poseWeapon();
    this.setFlash(0);
  }

  _switchBase(name, fade = .15) {
    const next = this.actions.get(name) || this.actions.get('idle-calm');
    if (!next || this.baseAction === next) return;
    const previous = this.baseAction;
    next.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (previous) previous.crossFadeTo(next, fade, false);
    this.baseAction = next;
    this.baseName = name;
  }

  _poseWeapon() {
    if (!this.hand || !this.mount.visible) return;
    // Only update the two chains needed for the gun. Updating the whole
    // skeleton here would duplicate all 38 bone transforms for every NPC.
    this.hand.updateWorldMatrix(true, false);
    this.chest.updateWorldMatrix(true, false);
    this.hand.getWorldPosition(W);
    this.root.getWorldQuaternion(Q);
    W.add(V.set(0, .045, .20).applyQuaternion(Q));
    this.chest.worldToLocal(W);
    this.mount.position.copy(W);
    this.mount.position.z -= this.kick * .025;
    this.mount.rotation.set(-(this._lastPose?.aimPitch || 0) * .65 - this.kick * .035, 0, 0);
    this.mount.updateMatrix();
  }

  animate(dt, state) {
    if (!this.fox) return super.animate(dt, state);
    this._lastPose = state;
    const dead = !!state.dead;
    if (dead && !this.deadStarted) {
      this.deadStarted = true;
      const clipName = ['forward', 'back', 'left', 'right'].includes(state.deathDirection)
        ? state.deathDirection : 'back';
      const previous = this.baseAction;
      this.reloadAction?.stop();
      this.hitAction?.stop();
      this.reloadAction = null;
      this.hitAction = null;
      this.fox.rotation.y = GROUNDED_DEATH_YAW[clipName];
      const death = this.actions.get('death-grounded') || this.actions.get('left');
      death.reset().setLoop(THREE.LoopOnce, 1);
      death.clampWhenFinished = true;
      death.setDuration(.70);
      death.play();
      if (previous && previous !== death) previous.crossFadeTo(death, .08, false);
      this.baseAction = death;
      this.baseName = clipName;
    } else if (!dead && this.deadStarted) this.reset();
    if (!dead) {
      const speed = Math.max(0, state.speed || 0);
      // left/right/back in this FBX are directional hit/fall clips, not locomotion.
      // Let the AI turn the actor while the same authored run drives every direction.
      const move = speed > .3 ? 'run.001' : 'idle-calm';
      this._switchBase(move);
      this.baseAction.timeScale = move === 'run.001'
        ? Math.max(.7, Math.min(2.4, speed / 1.45)) : 1;
      const reloading = state.reload > 0 && state.reload < 1;
      if (reloading && !this.wasReloading) {
        const key = this.gunId === 'ak' ? 'reload-ak' : 'reload-rifle';
        this.reloadAction = this.actions.get(key) || this.actions.get('reload-ak');
        this.reloadAction.reset().play();
        this.reloadAction.setEffectiveWeight(1);
      } else if (!reloading && this.wasReloading && this.reloadAction) {
        this.reloadAction.fadeOut(.12);
        this.reloadAction = null;
      }
      this.wasReloading = reloading;
      if (reloading && this.reloadAction)
        this.reloadAction.time = state.reload * this.reloadAction.getClip().duration;
      const hit = (state.flinch || 0) > .15;
      if (hit && !this.wasHit) {
        this.hitAction = this.actions.get('hit-body');
        if (this.hitAction) this.hitAction.reset().setLoop(THREE.LoopOnce, 1)
          .setDuration(.24).setEffectiveWeight(.48).fadeIn(.035).play();
      } else if (!hit && this.wasHit && this.hitAction) {
        this.hitAction.fadeOut(.08);
        this.hitAction = null;
      }
      this.wasHit = hit;
    }
    this.mixer.update(Math.max(0, dt));
    if (dead) {
      const progress = this.baseAction.time / this.baseAction.getClip().duration;
      this.foxHolder.position.y = source.offset.y +
        deathFloorLift(source.deathFloors.get('death-grounded'), progress);
    }
    // Leave mixer-resolved finger and spine rotations untouched. Per-frame
    // rotateX() accumulated on bones without an active track and made them spin.
    // The weapon mount still supplies the small visual fire kick.
    this.kick *= Math.exp(-dt * 11);
    this.flashLife = Math.max(0, this.flashLife - dt);
    if (this.muzzleFlash) {
      this.muzzleFlash.visible = this.flashLife > 0;
      this.muzzleFlash.material.opacity = this.flashLife / .075;
    }
    this._poseWeapon();
  }
}
