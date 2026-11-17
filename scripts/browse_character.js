// Author unarmed upper-body motion in the FBX's own skeleton space. Sample once
// when the visitor is created. Three's mixer interpolates the resulting tracks.
import * as THREE from 'three';
import { makeBlobShadow } from './blobshadow.js';

function visitClip(actor, clips, name) {
  const walking = name === 'walk', gliding = name === 'glide';
  const flying = gliding || name === 'hover';
  const base = clips.get(walking ? 'walk' : flying ? 'jump' : 'idle-calm');
  const duration = walking ? base.duration : 4.2;
  const mixer = new THREE.AnimationMixer(actor);
  const lower = mixer.clipAction(base).play();
  // The first treadwater frame is the source's open-chested, unarmed bind-like
  // stance. Retain the native hips and leg keys from the selected lower clip.
  const upperTracks = clips.get('treadwater').tracks.filter(t =>
    /^Bip01_(Spine|Neck|Head|[LR]_(Clavicle|UpperArm|Forearm|Hand|Finger))/.test(t.name));
  const chest = mixer.clipAction(new THREE.AnimationClip('open chest', 1, upperTracks));
  const sides = ['L', 'R'].map((side, i) => {
    const bone = suffix => actor.getObjectByName('Bip01_' + side + '_' + suffix);
    return { sign: i ? -1 : 1, arm: bone('UpperArm'), elbow: bone('Forearm'),
      hand: bone('Hand'), knee: bone('Calf'), ankle: bone('Foot') };
  });
  const bones = [...new Set(upperTracks.filter(t => t.name.endsWith('.quaternion'))
    .map(t => actor.getObjectByName(t.name.split('.')[0])))];
  const keys = new Map(bones.map(b => [b, []]));
  const frames = walking ? 48 : 24;
  const head = actor.getObjectByName('Bip01_Head');
  const neckLift = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), -.39);
  const times = [];
  const delta = new THREE.Quaternion(), parent = new THREE.Quaternion(), rotation = new THREE.Quaternion();
  const from = new THREE.Vector3(), to = new THREE.Vector3(), origin = new THREE.Vector3();
  function aim(bone, child, x, y, z) {
    bone.getWorldPosition(origin);
    child.getWorldPosition(from).sub(origin).normalize();
    delta.setFromUnitVectors(from, to.set(x, y, z).normalize());
    bone.getWorldQuaternion(rotation).premultiply(delta);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(parent).invert().multiply(rotation));
    bone.updateWorldMatrix(false, true);
  }
  for (let i = 0; i <= frames; i++) {
    const phase = i / frames, breath = Math.sin(phase * Math.PI * 2);
    // Sample the upper pose separately so armed source keys never contribute.
    chest.stop(); lower.reset().play();
    lower.time = walking ? phase * base.duration : flying ? base.duration * (.32 + .035 * breath) : 0;
    mixer.update(0);
    const legPositions = sides.map(({ankle}) => ankle.getWorldPosition(new THREE.Vector3()).z);
    lower.enabled = false;
    chest.reset().play(); chest.time = 0; mixer.update(0);
    if (gliding) {
      head.getWorldQuaternion(rotation).premultiply(neckLift);
      head.quaternion.copy(head.parent.getWorldQuaternion(parent).invert().multiply(rotation));
    }
    for (const [i, side] of sides.entries()) {
      const swing = walking ? THREE.MathUtils.clamp((legPositions[1-i] - legPositions[i]) * .55, -.46, .46) : 0;
      aim(side.arm, side.elbow, side.sign * (gliding ? 1.18 : flying ? .58 + .035 * breath : .13),
        gliding ? -.52 : -.98, gliding ? -.48 : flying ? -.31 : swing - .09);
      aim(side.elbow, side.hand, side.sign * (gliding ? .95 : flying ? .33 : -.045),
        gliding ? -.48 : -.94, gliding ? -.38 : flying ? -.13 : swing + .22);
    }
    times.push(phase * duration);
    for (const bone of bones) keys.get(bone).push(...bone.quaternion.toArray());
  }
  chest.stop(); mixer.stopAllAction(); mixer.uncacheRoot(actor);
  const tracks = base.tracks.filter(t => !upperTracks.some(u => u.name === t.name)).map(track => {
    if (walking || !flying) return track.clone();
    const interp = track.createInterpolant();
    const values = times.flatMap(t => Array.from(interp.evaluate(base.duration *
      (.32 + .035 * Math.sin(t / duration * 2 * Math.PI)))));
    return new track.constructor(track.name, times, values);
  });
  // Upper-body translations are static source bone lengths, not weapon motion.
  for (const track of upperTracks.filter(t => !t.name.endsWith('.quaternion')))
    tracks.push(new track.constructor(track.name, [0], track.values.slice(0, track.getValueSize())));
  for (const [bone, values] of keys)
    tracks.push(new THREE.QuaternionKeyframeTrack(bone.name + '.quaternion', times, values));
  return new THREE.AnimationClip('visit-' + name, duration, tracks);
}

// A small sample of the actual soles accounts for the source's varying ankle
// pitch. Each sample owns an index into the skinned mesh, including both feet.
function soleSamples(mesh) {
  mesh.updateWorldMatrix(true, false);
  const point = new THREE.Vector3(), bounds = new THREE.Box3();
  const g = mesh.geometry.groups[0], points = [];
  for (let i = g.start; i < g.start + g.count; i++) {
    mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
    bounds.expandByPoint(point);
    points.push([i, point.x, point.y, point.z]);
  }
  const samples = new Map();
  for (const [i, x, y, z] of points) {
    if (y > bounds.min.y + .13) continue;
    const key = Math.floor(x / .055) + '/' + Math.floor(z / .08);
    if (!samples.has(key) || samples.get(key).y > y) samples.set(key, {i, y});
  }
  return [...samples.values()].map(s => s.i);
}

export class BrowseCharacter {
  constructor({actor, holder, clips}) {
    this.root = new THREE.Group();
    this.root.name = 'browse-visitor';
    this.body = new THREE.Group();
    this.hinge = new THREE.Group();
    // Pitch and bank around the hips instead of rotating about the soles.
    this.hinge.position.y = .95;
    this.body.position.y = -.95;
    this.root.add(this.hinge);
    this.hinge.add(this.body);
    this.body.add(holder);
    this.floorOffset = holder.position.y;
    this.holder = holder;
    actor.traverse(mesh => {
      if (!mesh.isSkinnedMesh) return;
      mesh.receiveShadow = true;
      if (mesh.userData.part === 'body') {
        this.skin = mesh;
        // The FBX shares vertices for body/face/hair. A single-material mesh
        // ignores geometry.groups, so limit the body draw to its own UV island.
        const geo = mesh.geometry.clone(), group = geo.groups[0];
        geo.setDrawRange(group.start, group.count);
        mesh.geometry = geo;
        mesh.material = mesh.material.clone();
        const surface = new THREE.TextureLoader().load(new URL('../assets/local/fox_npc/visit-surface.png', import.meta.url).href);
        surface.flipY = mesh.material.map.flipY;
        surface.anisotropy = mesh.material.map.anisotropy;
        mesh.material.roughness = mesh.material.metalness = 1;
        mesh.material.roughnessMap = mesh.material.metalnessMap = mesh.material.bumpMap = surface;
        mesh.material.bumpScale = .0025;
        mesh.material.envMapIntensity = .58;
      } else {
        mesh.material = mesh.material.map((m, i) => {
          const mat = m.clone();
          mat.roughness = i === 0 ? .74 : .63;
          mat.envMapIntensity = .48;
          return mat;
        });
      }
    });
    const authored = ['idle', 'walk', 'hover', 'glide'].map(name => visitClip(actor, clips, name));
    this.mixer = new THREE.AnimationMixer(actor);
    this.actions = authored.map(clip => this.mixer.clipAction(clip).play());
    this.actions.forEach((action,i) => action.setEffectiveWeight(i === 0 ? 1 : 0));
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    this.samples = soleSamples(this.skin);
    this.point = new THREE.Vector3();
    this.shadow = makeBlobShadow(.75, .6);
    this.root.add(this.shadow);
  }

  reset(player) {
    this.root.visible = true;
    this.root.rotation.y = player.yaw + Math.PI;
    this.air = this.gait = this.cruise = this.bank = this.clock = 0;
    this.hinge.rotation.set(0,0,0);
    this.root.position.copy(player.pos);
  }

  update(dt, player, flying, velocity) {
    const ease = rate => 1 - Math.exp(-dt * rate);
    const horizontal = Math.hypot(velocity.x, velocity.z);
    let turn = 0;
    if (horizontal > .08) {
      const diff = Math.atan2(velocity.x, velocity.z) - this.root.rotation.y;
      turn = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.root.rotation.y += turn * ease(flying ? 6 : 12);
    }
    this.clock += dt;
    this.air += (Number(flying) - this.air) * ease(flying ? 6 : 9);
    this.gait += (Math.min(1, horizontal / 1.3) - this.gait) * ease(10);
    this.cruise += ((flying ? Math.min(1, horizontal / 7) : 0) - this.cruise) * ease(4);
    this.bank += (THREE.MathUtils.clamp(turn, -.55, .55) * this.cruise - this.bank) * ease(5);
    const [idle, walk, hover, glide] = this.actions;
    idle.setEffectiveWeight((1-this.air)*(1-this.gait));
    walk.setEffectiveWeight((1-this.air)*this.gait);
    // One source cycle is about two metres, independent of frame rate.
    walk.timeScale = horizontal * walk.getClip().duration / 2;
    hover.setEffectiveWeight(this.air * (1 - this.cruise));
    glide.setEffectiveWeight(this.air * this.cruise);
    this.mixer.update(dt);
    const climb = THREE.MathUtils.clamp(velocity.y / 7, -1, 1);
    const pitch = this.cruise * .97 - climb * this.air * .18;
    this.hinge.rotation.x += (pitch - this.hinge.rotation.x) * ease(7);
    this.hinge.rotation.z = -this.bank;
    this.root.position.copy(player.pos);
    this.holder.position.y = this.floorOffset;
    this.hinge.position.y = .95 + this.air * (.21 + .035 * Math.sin(this.clock * 2.1));
    this.root.updateMatrixWorld(true);
    if (this.air < .995) {
      let soleY = Infinity;
      for (const i of this.samples)
        soleY = Math.min(soleY, this.skin.getVertexPosition(i, this.point).applyMatrix4(this.skin.matrixWorld).y);
      const correction = THREE.MathUtils.clamp(player.pos.y - soleY, -.32, .32);
      this.holder.position.y += correction * (1 - this.air);
    }
    this.shadow.visible = !flying && player.onGround;
  }
}
