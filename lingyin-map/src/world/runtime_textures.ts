import * as THREE from 'three';

type RuntimeMap = 'forest-atlas' | 'gate-atlas' | 'gate-paving';
const maps = new Map<RuntimeMap, THREE.Texture>();
let loading: Promise<void> | null = null;

// Original authored atlases, baked offline. Standalone source studies retain
// their Canvas fallback; only the playable map waits for these runtime maps.
export function preloadRuntimeTextures() {
  // Offline baker needs the authored Canvas originals, never a re-encoded
  // copy of an earlier lossy bake. This switch is confined to local tooling.
  if (['127.0.0.1', 'localhost'].includes(location.hostname) &&
    new URLSearchParams(location.search).get('bakeLingyinTextures') === '1')
    return Promise.resolve();
  if (loading) return loading;
  const loader = new THREE.TextureLoader();
  loading = Promise.all((['forest-atlas', 'gate-atlas', 'gate-paving'] as RuntimeMap[]).map(async name => {
    const texture = await loader.loadAsync(new URL(
      `./assets/lingyin/runtime-textures/${name}.webp`, document.baseURI).href + '?v=2');
    texture.name = `lingyin-baked-${name}`;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8;
    if (name === 'gate-paving') texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    maps.set(name, texture);
  })).then(() => {});
  return loading;
}

export function runtimeTexture(name: RuntimeMap) { return maps.get(name); }

let bambooMap: THREE.CanvasTexture | null = null;
export function bambooCulmMaterial() {
  if (!bambooMap) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(128, 512);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 128; x++) {
      const node = (y * 8 / 512) % 1;
      const band = node < .04 ? .48 : node < .09 ? 1.12 : 1;
      const grain = .91 + .09 * Math.sin(x * 1.8 + Math.sin(y * .013));
      const light = (.85 + .15 * Math.sin(x / 128 * Math.PI * 2)) * band * grain;
      const p = (y * 128 + x) * 4;
      image.data[p] = 82 * light; image.data[p + 1] = 103 * light;
      image.data[p + 2] = 48 * light; image.data[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    bambooMap = new THREE.CanvasTexture(canvas);
    bambooMap.name = 'lingyin-bamboo-node-and-fibre';
    bambooMap.colorSpace = THREE.SRGBColorSpace;
    bambooMap.wrapS = bambooMap.wrapT = THREE.RepeatWrapping;
    bambooMap.anisotropy = 8;
  }
  return new THREE.MeshStandardMaterial({
    name: 'bamboo-textured-culm', map: bambooMap, bumpMap: bambooMap,
    bumpScale: .008, roughness: .8, metalness: 0,
  });
}
