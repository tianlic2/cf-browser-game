import * as THREE from 'three';
import { configureMapTexture } from './map_texture_quality.js';
import { prepareGoldsrcCollision } from './goldsrc_surface.js?v=visible-wall-1';
import { fetchChunkedMap } from './chunked_asset.js?v=github-publish-1';

const BASE = new URL('../assets/classic/blacktown/', import.meta.url).href;

export async function buildBlacktownMap(scene, onProgress = () => {}) {
  const { data, binary } = await fetchChunkedMap(BASE, 'github-publish-1', '黑色城镇');
  onProgress(.05);
  const walkableSurfaces = prepareGoldsrcCollision(data, binary);
  onProgress(.18);

  const loader = new THREE.TextureLoader();
  const texturePaths = ['lightmap.png', ...data.parts.map(part => part.material.map).filter(Boolean)];
  const uniquePaths = [...new Set(texturePaths)];
  let loaded = 0;
  const textures = new Map(await Promise.all(uniquePaths.map(async path => {
    const texture = await loader.loadAsync(BASE + path);
    configureMapTexture(texture, path === 'lightmap.png');
    onProgress(.18 + .67 * ++loaded / uniquePaths.length);
    return [path, texture];
  })));
  const sky = await new THREE.CubeTextureLoader().loadAsync(
    ['ft', 'bk', 'up', 'dn', 'rt', 'lf'].map(face => BASE + data.sky[face]));
  sky.colorSpace = THREE.SRGBColorSpace;
  onProgress(.92);

  const lightmap = textures.get('lightmap.png');
  const group = new THREE.Group();
  group.name = 'goldsrc-de-blackwidow';
  const obstacles = [];
  for (const part of data.parts) {
    const values = new Float32Array(binary, part.offset, part.count * 7);
    const buffer = new THREE.InterleavedBuffer(values, 7);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
    geometry.setAttribute('uv', new THREE.InterleavedBufferAttribute(buffer, 2, 3));
    geometry.setAttribute('uv1', new THREE.InterleavedBufferAttribute(buffer, 2, 5));
    const map = part.material.map ? textures.get(part.material.map) : null;
    const opacity = part.material.opacity ?? 1;
    const material = new THREE.MeshBasicMaterial({
      map, lightMap: lightmap, lightMapIntensity: 1,
      color: map ? 0xffffff : 0xc4c8c9, side: THREE.DoubleSide,
      alphaTest: part.material.alphaTest || 0,
      transparent: opacity < 1, opacity, depthWrite: opacity === 1,
      toneMapped: false,
    });
    material.name = part.material.name;
    material.lightMap.channel = 1;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = part.material.name;
    group.add(mesh);
    obstacles.push(mesh);
  }

  group.visible = false;
  scene.add(group);
  return {
    ...data,
    name: '黑色城镇',
    source: 'goldsrc-de-blackwidow',
    visuals: [group], obstacles, background: sky, environment: sky,
    ...walkableSurfaces,
    fog: new THREE.FogExp2(0x8f968b, .0032),
    navigationMaxHeight: 20,
    navigationStep: .85,
    // 地图三轴从原始换算整体放大了 1.2 倍，移动能力也按同一高度比例补偿：
    // 18-unit 台阶仍可跨越，48-unit 箱体仍可跳上；较高箱体仍须借矮箱。
    stepHeight: .56,
    groundSnap: .56,
    jumpHeightScale: 1.2,
    smoothGroundTransitions: true,
    downhillViewRecovery: 5.2,
  };
}
