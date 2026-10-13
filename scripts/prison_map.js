import * as THREE from 'three';
import { expandPrisonLayout, PRISON_HORIZONTAL_SCALE, PRISON_VERTICAL_SCALE } from './prison_scale.js?v=watch-city-1';
import { preservePrisonTexelScale } from './prison_uv.js?v=watch-city-tone-1';

const BASE = new URL('../assets/classic/prison/', import.meta.url).href;

function makePrisonSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#17232e');
  gradient.addColorStop(.48, '#303d47');
  gradient.addColorStop(.7, '#48535a');
  gradient.addColorStop(1, '#28333c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 0x51a7;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 0x100000000);
  for (let i = 0; i < 85; i++) {
    const x = random() * canvas.width;
    const y = 80 + random() * 290;
    const rx = 45 + random() * 115;
    const ry = 13 + random() * 35;
    const shade = random() > .55 ? '185,197,202' : '9,15,22';
    const alpha = .035 + random() * .07;
    for (const offset of [-canvas.width, 0, canvas.width]) {
      ctx.save();
      ctx.translate(x + offset, y);
      ctx.scale(rx, ry);
      const cloud = ctx.createRadialGradient(0, 0, .1, 0, 0, 1);
      cloud.addColorStop(0, `rgba(${shade},${alpha})`);
      cloud.addColorStop(1, `rgba(${shade},0)`);
      ctx.fillStyle = cloud;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  }
  const sky = new THREE.CanvasTexture(canvas);
  sky.colorSpace = THREE.SRGBColorSpace;
  sky.mapping = THREE.EquirectangularReflectionMapping;
  return sky;
}

export async function buildPrisonMap(scene, onProgress = () => {}) {
  const response = await fetch(BASE + 'map.json');
  if (!response.ok) throw new Error('守望之城地图资源缺失');
  const data = expandPrisonLayout(await response.json());
  onProgress(.08);
  const binaryResponse = await fetch(BASE + 'map.bin');
  if (!binaryResponse.ok) throw new Error('守望之城地图网格缺失');
  const binary = await binaryResponse.arrayBuffer();
  onProgress(.25);
  const loader = new THREE.TextureLoader();
  const paths = ['lightmap.png', ...data.parts.map(p => p.material.map?.replace(/^prison\//, '')).filter(Boolean)];
  const uniquePaths = [...new Set(paths)];
  let loaded = 0;
  const textures = new Map(await Promise.all(uniquePaths.map(async path => {
    const tex = await loader.loadAsync(BASE + path);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    if (path !== 'lightmap.png') tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    onProgress(.25 + .75 * ++loaded / uniquePaths.length);
    return [path, tex];
  })));
  const light = textures.get('lightmap.png');
  const group = new THREE.Group();
  group.name = 'classic-cf-prison';
  group.scale.set(PRISON_HORIZONTAL_SCALE, PRISON_VERTICAL_SCALE, PRISON_HORIZONTAL_SCALE);
  const obstacles = [];
  for (const p of data.parts) {
    const vertices = new Float32Array(binary, p.offset, p.count * 7);
    preservePrisonTexelScale(vertices, PRISON_HORIZONTAL_SCALE, PRISON_VERTICAL_SCALE);
    const buffer = new THREE.InterleavedBuffer(vertices, 7);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
    geometry.setAttribute('uv', new THREE.InterleavedBufferAttribute(buffer, 2, 3));
    geometry.setAttribute('uv1', new THREE.InterleavedBufferAttribute(buffer, 2, 5));
    const mapPath = p.material.map?.replace(/^prison\//, '');
    const opacity = p.material.opacity ?? 1;
    const material = new THREE.MeshBasicMaterial({
      map: mapPath ? textures.get(mapPath) : null,
      lightMap: light, lightMapIntensity: 1,
      color: mapPath ? 0xffffff : 0x737678,
      side: THREE.DoubleSide, alphaTest: p.material.alphaTest || 0,
      transparent: opacity < 1, opacity, depthWrite: opacity === 1,
      toneMapped: false,
    });
    material.name = p.material.name;
    material.lightMap.channel = 1;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = p.material.name;
    group.add(mesh);
    obstacles.push(mesh);
  }
  group.visible = false;
  scene.add(group);
  return {
    ...data, name: '守望之城', source: 'cf-prison-source-port',
    visuals: [group], obstacles,
    background: makePrisonSky(),
    navigationMaxHeight: 3.3 * PRISON_VERTICAL_SCALE,
    navigationStep: .75,
    stepHeight: .5 * PRISON_VERTICAL_SCALE,
  };
}
