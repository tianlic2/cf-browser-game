import * as THREE from 'three';
import { ClassicView } from './classic_view.js?v=kukri-hand-material-2';
import { fetchJoinedAsset } from './chunked_asset.js?v=github-publish-1';

const ROOT = new URL('../assets/local/cf_bio_candidates/zone13/runtime-character/ghost-view/', import.meta.url);
const VERSION = 'source-sections-1';
const assetUrl = (name) => {
  const url = new URL(name, ROOT);
  url.searchParams.set('v', VERSION);
  return url;
};

// Formal-game wrapper around the exact Source view model approved in the
// isolated tuner. The preview remains a QA tool, never a runtime dependency.
export async function loadBioZombieView() {
  const response = await fetch(assetUrl('view.json'));
  if (!response.ok) throw new Error(`生化幽灵第一人称资源缺失 (${response.status})`);
  const data = await response.json();
  const bytes = await fetchJoinedAsset(data.binaryParts || ['view.bin'], assetUrl, '生化幽灵视模');
  const loader = new THREE.TextureLoader();
  const names = [...new Set(data.parts.map((part) => part.map))];
  const loaded = await Promise.all(names.map((name) => loader.loadAsync(assetUrl(name).href)));
  const maps = new Map(names.map((name, index) => [name, loaded[index]]));
  for (const texture of maps.values()) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = 4;
  }
  const textures = data.parts.map((part) => ({
    map: maps.get(part.map), normalMap: null, metalnessMap: null,
    aoMap: null, emissiveMap: null, reflectionMap: null,
  }));
  const view = new ClassicView(data, bytes, textures, false);
  view.root.name = 'bio-source-ghost-first-person';
  // Corrected Source animation data already carries its camera-space pose.
  view.root.position.set(0, 0, 0);
  view.root.rotation.set(0, 0, 0);
  view.root.scale.setScalar(1);
  view.root.traverse((object) => {
    if (!object.isMesh || !object.material?.isMeshStandardMaterial) return;
    object.material.roughness = .72;
    object.material.metalness = object === view.gun ? .16 : .03;
    object.material.emissive.set(0x170b08);
    object.material.emissiveIntensity = .22;
  });
  view.root.visible = false;

  let clip = null;
  let elapsed = 0;
  let lightVariant = 0;
  let wasVisible = false;
  const playAttack = ({ hit = false } = {}) => {
    clip = `${hit ? 'light_hit' : 'light_miss'}${lightVariant + 1}`;
    lightVariant = 1 - lightVariant;
    elapsed = 0;
    view.sample(clip, 0);
    return { clip, duration: view.duration(clip) };
  };
  const update = (dt, visible) => {
    view.root.visible = !!visible;
    if (!visible) {
      if (wasVisible) { clip = null; elapsed = 0; view.sample('idle_0', 0); }
      wasVisible = false;
      return;
    }
    wasVisible = true;
    if (!clip) { view.sample('idle_0', 0); return; }
    elapsed += dt;
    const duration = view.duration(clip);
    view.sample(clip, Math.min(elapsed, duration));
    if (elapsed >= duration) { clip = null; elapsed = 0; }
  };
  const reset = () => { clip = null; elapsed = 0; view.sample('idle_0', 0); };
  return { view, root: view.root, playAttack, update, reset };
}
