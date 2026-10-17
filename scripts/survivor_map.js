import * as THREE from 'three';
import { prepareGoldsrcCollision } from './goldsrc_surface.js?v=visible-wall-1';
import { fetchChunkedMap } from './chunked_asset.js?v=github-publish-1';

const BASE = new URL('../assets/classic/survivor/', import.meta.url).href;

function snowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(16, 16, 1, 16, 16, 15);
  glow.addColorStop(0, 'rgba(255,255,255,.95)');
  glow.addColorStop(.32, 'rgba(245,250,255,.8)');
  glow.addColorStop(1, 'rgba(220,235,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSnow(bounds) {
  const count = 900;
  const positions = new Float32Array(count * 3);
  let seed = 0x5a17c0de;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 0x100000000);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (random() * 2 - 1) * bounds.hw;
    positions[i * 3 + 1] = -4 + random() * 23;
    positions[i * 3 + 2] = (random() * 2 - 1) * bounds.hl;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: snowTexture(), color: 0xf7fbff, size: .12, transparent: true,
    opacity: .72, depthWrite: false, alphaTest: .08, sizeAttenuation: true,
    blending: THREE.NormalBlending, toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'survivor-snow';
  points.frustumCulled = false;
  return { points, positions, count };
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 31);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(.14, 'rgba(255,220,150,.9)');
  glow.addColorStop(.5, 'rgba(255,95,20,.28)');
  glow.addColorStop(1, 'rgba(255,60,0,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGlows(points) {
  const group = new THREE.Group();
  group.name = 'survivor-source-glows';
  const map = glowTexture();
  for (const source of points || []) {
    const rgb = String(source.color || '255 160 64').trim().split(/\s+/).map(Number);
    const material = new THREE.SpriteMaterial({
      map, color: new THREE.Color((rgb[0] || 255) / 255, (rgb[1] || 160) / 255,
        (rgb[2] || 64) / 255), transparent: true, opacity: .78,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.fromArray(source.position);
    const scale = Math.max(.35, Number(source.scale) || 1) * .72;
    sprite.scale.set(scale, scale, 1);
    group.add(sprite);
  }
  return group;
}

export async function buildSurvivorMap(scene, onProgress = () => {}) {
  const { data, binary } = await fetchChunkedMap(BASE, 'github-publish-1', '雪地求生');
  onProgress(.05);
  const walkableSurfaces = prepareGoldsrcCollision(data, binary);
  onProgress(.18);

  const loader = new THREE.TextureLoader();
  const texturePaths = ['lightmap.png', ...data.parts.map(part => part.material.map).filter(Boolean)];
  const uniquePaths = [...new Set(texturePaths)];
  let loaded = 0;
  const textures = new Map(await Promise.all(uniquePaths.map(async path => {
    const texture = await loader.loadAsync(BASE + path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    if (path !== 'lightmap.png') texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    onProgress(.18 + .65 * ++loaded / uniquePaths.length);
    return [path, texture];
  })));
  const sky = await new THREE.CubeTextureLoader().loadAsync(
    ['ft', 'bk', 'up', 'dn', 'rt', 'lf'].map(face => BASE + data.sky[face]));
  sky.colorSpace = THREE.SRGBColorSpace;
  onProgress(.9);

  const lightmap = textures.get('lightmap.png');
  const group = new THREE.Group();
  group.name = 'goldsrc-de-survivor';
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
      map, lightMap: part.material.unlit ? null : lightmap,
      lightMapIntensity: 1, color: map ? 0xffffff : 0xc4c8c9,
      side: THREE.DoubleSide, alphaTest: part.material.alphaTest || 0,
      transparent: opacity < 1, opacity, depthWrite: opacity === 1,
      toneMapped: false,
    });
    material.name = part.material.name;
    if (material.lightMap) material.lightMap.channel = 1;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = part.material.name;
    group.add(mesh);
    obstacles.push(mesh);
  }

  const snow = makeSnow(data.bounds);
  const glows = makeGlows(data.spritePoints);
  group.add(snow.points, glows);
  group.visible = false;
  scene.add(group);

  let previousTime = 0;
  let active = false;
  const ambience = new Audio(BASE + data.ambient);
  ambience.loop = true;
  ambience.volume = .18;
  ambience.preload = 'auto';
  return {
    ...data,
    name: '雪地求生',
    source: 'goldsrc-de-survivor',
    visuals: [group], obstacles, background: sky, environment: sky,
    ...walkableSurfaces,
    fog: new THREE.FogExp2(0xc2cbdc, .0065),
    navigationMaxHeight: 9,
    navigationStep: .9,
    stepHeight: .52,
    setActive(value) {
      active = !!value;
      if (!active) {
        ambience.pause();
        ambience.currentTime = 0;
      }
    },
    resumeAudio() {
      if (active && ambience.paused) ambience.play().catch(() => {});
    },
    update(time) {
      const dt = Math.max(0, Math.min(.05, time - previousTime));
      previousTime = time;
      const position = snow.positions;
      for (let i = 0; i < snow.count; i++) {
        const at = i * 3;
        position[at] += dt * .34;
        position[at + 1] -= dt * (1.6 + (i % 7) * .09);
        position[at + 2] += Math.sin(time * .65 + i * 1.73) * dt * .18;
        if (position[at + 1] < -5) {
          position[at + 1] = 19;
          position[at] = ((i * 47.13) % (data.bounds.hw * 2)) - data.bounds.hw;
        }
      }
      snow.points.geometry.attributes.position.needsUpdate = true;
      for (let i = 0; i < glows.children.length; i++) {
        glows.children[i].material.opacity = .65 + Math.sin(time * 8 + i * 2.1) * .13;
      }
    },
  };
}
