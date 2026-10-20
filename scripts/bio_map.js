import * as THREE from 'three';
import { buildBlacktownMap } from './blacktown_map.js?v=map-filter-quality-1';
import { makeGLTFLoader } from './gltf.js';
import { BIO_BLACKTOWN_LAYOUT } from './bio_blacktown_config.js?v=1';

const PROP_BASE = new URL('../assets/bio/props/', import.meta.url).href;

function fitProp(source, name, x, y, z, height, yaw, root, map, kind = 'crate') {
  if (!source) return null;
  const bounds = new THREE.Box3().setFromObject(source);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = height / Math.max(size.y, .001);
  source.scale.setScalar(scale);
  source.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);

  const placed = new THREE.Group();
  placed.name = name;
  placed.position.set(x, y, z);
  placed.rotation.y = yaw;
  placed.add(source);
  root.add(placed);
  source.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    map.obstacles.push(node);
  });

  // Use the fitted oriented footprint, not a broad world AABB. The wreck is
  // solid without adding invisible collision in the rotated model's corners.
  const hx = size.x * scale / 2, hz = size.z * scale / 2;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const worldHx = Math.abs(c) * hx + Math.abs(s) * hz;
  const worldHz = Math.abs(s) * hx + Math.abs(c) * hz;
  const u = c * x - s * z, v = s * x + c * z;
  map.colliders.push({
    x, z, hx: worldHx, hz: worldHz, y0: y, h: y + height, walkable: false,
    planes: [
      [c, 0, -s, u + hx], [-c, 0, s, -u + hx],
      [s, 0, c, v + hz], [-s, 0, -c, -v + hz],
      [0, 1, 0, y + height], [0, -1, 0, -y],
    ],
  });
  map.topdown.push({ x, z, hx: worldHx, hz: worldHz, kind });
  return placed;
}

function makeRain(root, map) {
  const count = 520;
  const rain = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(.014, .72),
    new THREE.MeshBasicMaterial({
      color: 0xb8d7e4, transparent: true, opacity: .48,
      depthWrite: false, side: THREE.DoubleSide, fog: true,
    }),
    count,
  );
  rain.name = 'bio-blacktown-rain';
  rain.frustumCulled = false;
  rain.renderOrder = 3;
  root.add(rain);

  const drops = Array.from({ length: count }, () => ({
    x: (Math.random() * 2 - 1) * map.bounds.hw,
    z: (Math.random() * 2 - 1) * map.bounds.hl,
    y: 8 + Math.random() * 20,
    speed: 11 + Math.random() * 7,
  }));
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -.16));
  const scale = new THREE.Vector3(1, 1, 1);
  const roofAt = drop => {
    const value = map.surfaceAt?.(drop.x, drop.z, Infinity);
    return Number.isFinite(value) ? value : map.floorY;
  };
  const reset = drop => {
    drop.x = (Math.random() * 2 - 1) * map.bounds.hw;
    drop.z = (Math.random() * 2 - 1) * map.bounds.hl;
    drop.y = roofAt(drop) + 11 + Math.random() * 14;
  };
  for (const drop of drops) reset(drop);

  return dt => {
    if (!root.visible) return;
    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i];
      drop.y -= drop.speed * dt;
      drop.x -= 1.7 * dt;
      if (drop.x < -map.bounds.hw || drop.y <= roofAt(drop) + .08) reset(drop);
      position.set(drop.x, drop.y, drop.z);
      rain.setMatrixAt(i, matrix.compose(position, rotation, scale));
    }
    rain.instanceMatrix.needsUpdate = true;
  };
}

function addWetPatches(root, map) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x30444e, roughness: .18, metalness: .25,
    transparent: true, opacity: .42, depthWrite: false,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  for (const [x, z, w, d] of [[-32, 28, 4.8, 2.1], [18, 34, 5.2, 2.2],
    [44, 4, 4.4, 1.8], [-26, -30, 3.2, 1.2]]) {
    const y = map.surfaceAt?.(x, z, 8);
    if (!Number.isFinite(y)) continue;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'bio-blacktown-puddle';
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + .012, z);
    mesh.scale.set(w, d, 1);
    root.add(mesh);
  }
}

// The infection arena is a separate Black Town scene instance. TDM keeps its
// own untouched geometry/materials while this copy owns rain and props.
export async function buildBioMap(scene, onProgress = () => {}) {
  const map = await buildBlacktownMap(scene, fraction => onProgress(fraction * .76));
  const city = map.visuals[0];
  city.name = 'goldsrc-de-blackwidow-bio';

  const effects = new THREE.Group();
  effects.name = 'bio-blacktown-dressing';
  effects.visible = false;
  scene.add(effects);

  const gltfLoader = makeGLTFLoader();
  const [powerResult, wreckResult] = await Promise.allSettled([
    gltfLoader.loadAsync(PROP_BASE + 'power_box.glb'),
    gltfLoader.loadAsync(PROP_BASE + 'wrecked_suv.glb'),
  ]);
  const powerModel = powerResult.status === 'fulfilled' ? powerResult.value.scene : null;
  const wreckModel = wreckResult.status === 'fulfilled' ? wreckResult.value.scene : null;
  if (!powerModel) console.warn('生化黑色城镇配电箱加载失败：', powerResult.reason);
  if (!wreckModel) console.warn('生化黑色城镇废弃汽车加载失败：', wreckResult.reason);
  onProgress(.86);

  const [powerX, powerY, powerZ] = BIO_BLACKTOWN_LAYOUT.powerBox;
  const placedPower = fitProp(powerModel, 'bio-blacktown-power-box',
    powerX, powerY, powerZ, 1.88, -.5, effects, map, 'house');
  if (!placedPower) {
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 1.88, .82),
      new THREE.MeshStandardMaterial({ color: 0x52636a, roughness: .55, metalness: .55 }),
    );
    fallback.position.set(powerX, powerY + .94, powerZ);
    fallback.name = 'bio-blacktown-power-box-fallback';
    effects.add(fallback);
    map.obstacles.push(fallback);
    map.colliders.push({ x: powerX, z: powerZ, hx: .625, hz: .41,
      y0: powerY, h: powerY + 1.88, walkable: false });
  }

  for (let i = 0; i < BIO_BLACKTOWN_LAYOUT.wrecks.length; i++) {
    const spec = BIO_BLACKTOWN_LAYOUT.wrecks[i];
    fitProp(wreckModel?.clone(true), `bio-blacktown-wreck-${i + 1}`,
      spec.x, spec.y, spec.z, spec.height, spec.yaw, effects, map);
  }
  addWetPatches(effects, map);

  const updateRain = makeRain(effects, map);
  const storm = new THREE.Color(0x202b35);

  city.visible = effects.visible = false;
  onProgress(1);
  return {
    ...map,
    name: '黑色城镇（生化）',
    source: 'goldsrc-de-blackwidow-bio',
    visuals: [city, effects],
    background: storm,
    // Keep the source sky as IBL for characters and imported props while the
    // visible backdrop and distance haze carry the rainy infection treatment.
    environment: map.environment,
    fog: new THREE.FogExp2(0x202b35, .009),
    update: (_, dt) => updateRain(dt),
    spawns: {
      player: map.spawns.player.map(point => [...point]),
      enemy: map.spawns.enemy.map(point => [...point]),
    },
    bio: {
      humans: map.spawns.player.slice(0, 12).map(point => [...point]),
      mutants: map.spawns.enemy.slice(0, 8).map(point => [...point]),
      holdPoints: BIO_BLACKTOWN_LAYOUT.holdPoints.map(point => [...point]),
    },
  };
}
