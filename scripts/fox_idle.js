import * as THREE from '../vendor/three/build/three.module.js';

// The source idle1 is a 0.17 s loop with pelvis and foot motion. Preserve its
// first-frame stance, then animate only the chest at a natural breathing rate.
export const FOX_BREATH_PERIOD = 4.2;

export function createFoxBreathingIdle(sourceClip) {
  const quarter = FOX_BREATH_PERIOD / 4;
  const times = [0, quarter, quarter * 2, quarter * 3, FOX_BREATH_PERIOD];
  const wave = [0, 1, 0, -1, 0];
  const axis = new THREE.Vector3(1, 0, 0);
  const tracks = sourceClip.tracks.map(track => {
    const size = track.getValueSize();
    const first = Array.from(track.values.slice(0, size));
    const amplitude = track.name === 'Bip01_Spine1.quaternion' ? .009
      : track.name === 'Bip01_Spine2.quaternion' ? .007 : 0;
    if (amplitude) {
      const base = new THREE.Quaternion().fromArray(first);
      const values = wave.flatMap(phase => base.clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(axis, phase * amplitude))
        .normalize().toArray());
      return new THREE.QuaternionKeyframeTrack(track.name, times, values);
    }
    // Complete static tracks keep the hips, legs and feet fixed through the
    // whole cycle, including while crossfading out of run. No bone is rotated
    // incrementally from its preceding frame.
    return new track.constructor(track.name, [0, FOX_BREATH_PERIOD],
      [...first, ...first]);
  });
  return new THREE.AnimationClip('idle-calm', FOX_BREATH_PERIOD, tracks);
}
