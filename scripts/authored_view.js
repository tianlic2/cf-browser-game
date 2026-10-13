import * as THREE from "three";
import { makeGLTFLoader } from "./gltf.js";

const ROOT = "./assets/classic/motions/";
export const AUTHORED_VIEW_POSE = Object.freeze({
  knife: Object.freeze({ x: .20, y: -.14, z: -.05, yaw: Math.PI, scale: .05 }),
  deagle: Object.freeze({ x: .7, y: 0, z: .25, yaw: 3.45, scale: .018 }),
});
const KNIFE_CLIPS = {
  idle: "v_knife.qc_skeleton|idle_0.006",
  draw: "v_knife.qc_skeleton|select.006",
  light: "v_knife.qc_skeleton|combo_1",
  thrust: "v_knife.qc_skeleton|combo_2",
  heavy: "v_knife.qc_skeleton|bigshot",
};

async function texture(file) {
  const map = await new THREE.TextureLoader().loadAsync(ROOT + file);
  map.flipY = false;
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  return map;
}

class AnimatedModel {
  constructor(scene, clips) {
    this.root = scene;
    this.root.visible = false;
    this.mixer = new THREE.AnimationMixer(scene);
    this.clips = clips;
    this.actions = new Map();
    this.active = null;
    this.clip = "";
    this.sampleTime = 0;
    this.leftHand = null;
    this.rightHand = null;
    this.muzzleBone = null;
    this.muzzleOffset = null;
    scene.traverse((object) => {
      if (object.isBone && /(?:L_Hand|L Hand)$/.test(object.name)) this.leftHand = object;
      if (object.isBone && /(?:R_Hand|R Hand)$/.test(object.name)) this.rightHand = object;
      if (object.isBone && object.name === 'Bone07') this.muzzleBone = object;
      if (!object.isMesh) return;
      object.frustumCulled = false;
      object.castShadow = false;
      object.material.side = THREE.DoubleSide;
    });
  }

  duration(name) { return this.clips[name]?.duration || 0; }

  leftHandCamera(out) {
    if (!this.leftHand) return null;
    this.root.updateMatrixWorld(true);
    return this.leftHand.getWorldPosition(out);
  }

  rightHandCamera(out) {
    if (!this.rightHand) return null;
    this.root.updateMatrixWorld(true);
    return this.rightHand.getWorldPosition(out);
  }

  muzzleCamera(out) {
    if (!this.muzzleBone || !this.muzzleOffset) return null;
    this.root.updateMatrixWorld(true);
    return this.muzzleBone.localToWorld(out.copy(this.muzzleOffset));
  }

  sample(name, time) {
    const clip = this.clips[name] || this.clips.idle;
    if (!clip) return;
    if (this.active !== name) {
      if (this.active) this.actions.get(this.active)?.stop();
      let action = this.actions.get(name);
      if (!action) {
        action = this.mixer.clipAction(clip);
        const repeating = name === 'idle' || name === 'walk';
        action.setLoop(repeating ? THREE.LoopRepeat : THREE.LoopOnce,
          repeating ? Infinity : 1);
        action.clampWhenFinished = !repeating;
        this.actions.set(name, action);
      }
      action.reset().play();
      this.active = name;
    }
    this.mixer.setTime(Math.max(0, Math.min(time, clip.duration)));
    this.clip = name;
    this.sampleTime = time;
  }
}

function setMaterials(scene, maps) {
  scene.traverse((object) => {
    if (!object.isMesh) return;
    const name = object.material?.name || object.name;
    const key = Object.keys(maps).find((part) => name.includes(part) || object.name.includes(part));
    if (!key) return;
    object.material = new THREE.MeshStandardMaterial({
      name, map: maps[key], roughness: key.includes("DesertEagle") ? .42 : .83,
      metalness: key.includes("DesertEagle") ? .48 : .05,
      side: THREE.DoubleSide,
    });
  });
}

export async function loadAuthoredViews(camera) {
  const loader = makeGLTFLoader();
  const [knife, deagle, knifeMap, handMap, armMap] = await Promise.all([
    loader.loadAsync(ROOT + "knife_view.glb"),
    loader.loadAsync(ROOT + "deagle_view.glb"),
    texture("knife.png"),
    texture("../ak/view/FVIEW_HAND_GR.png"),
    texture("../ak/view/FVIEW_ARM_GR.png"),
  ]);
  setMaterials(knife.scene, { Knife: knifeMap, AK47_Hand: handMap, AK47_Arm: armMap });
  knife.scene.traverse((object) => {
    if (object.isMesh && object.material.name.includes('AK47_Arm')) object.visible = false;
  });
  deagle.scene.traverse((object) => {
    if (!object.isMesh) return;
    // The extracted BL forearms terminate openly in mid-air. Keep the authored
    // moving gun/slide/magazine, but use the game's continuous classic sleeves.
    if (object.material.name === 'Hand_BL' || object.material.name === 'Arm_BL') {
      object.visible = false;
      return;
    }
    object.material = object.material.clone();
    object.material.transparent = false;
    object.material.depthWrite = true;
    object.material.metalness = object.material.name === 'DesrtEagle' ? .42 : .04;
  });
  const knifeClips = Object.fromEntries(Object.entries(KNIFE_CLIPS).map(([name, source]) =>
    [name, knife.animations.find((clip) => clip.name === source)]));
  const deagleClips = Object.fromEntries(Object.entries({
    draw: 'select', idle: 'idle', reload: 'reload',
    shoot: 'shoot-1', shoot2: 'shoot-2', shoot3: 'shoot-3', walk: 'run',
  }).map(([name, suffix])=>[name,deagle.animations.find((clip)=>clip.name.endsWith('PV-DEAGLE_'+suffix))]));
  const views = {
    knife: new AnimatedModel(knife.scene, knifeClips),
    deagle: new AnimatedModel(deagle.scene, deagleClips),
  };
  // FBX exporters preserve Source's centimetre-sized parent scale. Calibrate
  // the complete rig, not individual meshes, so weapon and fingers stay bound.
  for (const [id, view] of Object.entries(views)) {
    const pose = AUTHORED_VIEW_POSE[id];
    view.root.scale.setScalar(pose.scale);
    view.root.position.set(pose.x, pose.y, pose.z);
    view.root.rotation.y = pose.yaw;
    camera.add(view.root);
  }
  // The source pistol's barrel points along local +Z. Turn it toward camera
  // -Z before placing the grip in the lower-right corner of the view.
  views.deagle.sample('idle', 0);
  if (views.deagle.muzzleBone) {
    views.deagle.root.updateMatrixWorld(true);
    // Centroid of the barrel's forwardmost vertices in the source idle pose.
    // Convert through the root, then bind it to the moving pistol bone.
    views.deagle.muzzleOffset = views.deagle.muzzleBone.worldToLocal(
      new THREE.Vector3(10.28, -10.92, 69.76).applyMatrix4(views.deagle.root.matrixWorld));
  }
  return views;
}
