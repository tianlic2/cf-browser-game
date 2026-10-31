import * as THREE from 'three';
import { createZone13SpatialCollision } from './zone13_collision.js?v=zone13-jump-2';
import { createZone13EventDirector } from './zone13_events.js';

const ROOT = new URL('../assets/local/cf_bio_candidates/zone13/graybox/', import.meta.url);
const EXTRAS = new URL('../assets/local/cf_bio_candidates/zone13/runtime-extras/', import.meta.url);
const VERSION = 'formal-performance-3';
const assetUrl = (name) => {
  const url = new URL(name, ROOT);
  url.searchParams.set('v', VERSION);
  return url;
};

async function fetchJson(name, label) {
  const response = await fetch(assetUrl(name));
  if (!response.ok) throw new Error(`${label}缺失 (${response.status})`);
  return response.json();
}

function makeAtlasMaterial(group, texture, atlasInfo) {
  if (group.id === 'glass') return new THREE.MeshPhysicalMaterial({
    color: 0x8eb8bd, roughness: .18, metalness: 0, transmission: .35,
    transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide,
  });
  const material = new THREE.MeshStandardMaterial({
    color: group.color, map: group.texture ? texture : null,
    roughness: .88, metalness: group.id === 'metal' ? .22 : .03,
    side: THREE.DoubleSide,
  });
  if (!group.texture) return material;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float atlasSlot; varying float vAtlasSlot;\nvoid main() {')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n vAtlasSlot = atlasSlot;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying float vAtlasSlot;\nvoid main() {')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          float atlasIndex = floor(vAtlasSlot + 0.5);
          vec2 atlasGrid = vec2(${atlasInfo.columns.toFixed(1)}, ${atlasInfo.rows.toFixed(1)});
          vec2 atlasCell = vec2(mod(atlasIndex, atlasGrid.x), floor(atlasIndex / atlasGrid.x));
          vec2 localUv = vec2(0.015) + fract(vMapUv) * 0.97;
          vec4 sampledDiffuseColor = texture2D(map, (atlasCell + localUv) / atlasGrid);
          diffuseColor *= sampledDiffuseColor;
        #endif
      `);
  };
  material.customProgramCacheKey = () => `zone13-formal-atlas-v2-${atlasInfo.columns}x${atlasInfo.rows}`;
  return material;
}

export function createWalkSurface(payload, cellSize = 4) {
  const cells = new Map();
  const areaCells = new Map();
  const areas = new Map();
  const key = (x, z) => `${x},${z}`;
  const triangles = [];
  const triangleHeight = (x, z, triangle) => {
    const [a, b, c] = triangle;
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-9) return null;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    const w = 1 - u - v;
    return u < -1e-5 || v < -1e-5 || w < -1e-5 ? null : u * a[1] + v * b[1] + w * c[1];
  };
  const insert = (triangle, index) => {
    const xs = triangle.map((p) => p[0]), zs = triangle.map((p) => p[2]);
    for (let z = Math.floor(Math.min(...zs) / cellSize); z <= Math.floor(Math.max(...zs) / cellSize); z++)
      for (let x = Math.floor(Math.min(...xs) / cellSize); x <= Math.floor(Math.max(...xs) / cellSize); x++) {
        const k = key(x, z);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(index);
      }
  };
  for (const area of payload.areas) {
    const center = area.corners.reduce((sum, p) => ({ x: sum.x + p[0] / 4, y: sum.y + p[1] / 4, z: sum.z + p[2] / 4 }), { x: 0, y: 0, z: 0 });
    areas.set(area.id, { ...area, center });
    const xs = area.corners.map((p) => p[0]), zs = area.corners.map((p) => p[2]);
    for (let z = Math.floor(Math.min(...zs) / cellSize); z <= Math.floor(Math.max(...zs) / cellSize); z++)
      for (let x = Math.floor(Math.min(...xs) / cellSize); x <= Math.floor(Math.max(...xs) / cellSize); x++) {
        const k = key(x, z);
        if (!areaCells.has(k)) areaCells.set(k, []);
        areaCells.get(k).push(area.id);
      }
    for (const ids of [[0, 2, 1], [0, 3, 2]]) {
      const triangle = ids.map((i) => area.corners[i]);
      insert(triangle, triangles.push(triangle) - 1);
    }
  }
  const heightsAt = (x, z, maxY = Infinity) => {
    const candidates = cells.get(key(Math.floor(x / cellSize), Math.floor(z / cellSize))) || [];
    const values = [];
    for (const index of candidates) {
      const height = triangleHeight(x, z, triangles[index]);
      if (height !== null && height <= maxY + 1e-4 && !values.some((v) => Math.abs(v - height) < 1e-3)) values.push(height);
    }
    return values.sort((a, b) => b - a);
  };
  const surfaceAt = (x, z, maxY = Infinity) => heightsAt(x, z, maxY)[0] ?? -Infinity;
  const canTraverse = (x, z, feetY, maxStep = payload.actor.maxStep) => {
    let center = null;
    for (let i = 0; i < 9; i++) {
      const angle = i / 8 * Math.PI * 2;
      const px = x + (i ? Math.cos(angle) * payload.actor.radius : 0);
      const pz = z + (i ? Math.sin(angle) * payload.actor.radius : 0);
      const height = surfaceAt(px, pz, feetY + maxStep);
      if (!Number.isFinite(height)) return false;
      if (center === null) center = height;
      if (Math.abs(height - center) > maxStep) return false;
    }
    return true;
  };
  const nearestArea = (position) => {
    let best = null, score = Infinity;
    let candidates = areaCells.get(key(Math.floor(position.x / cellSize), Math.floor(position.z / cellSize)));
    if (!candidates?.length) {
      candidates = [];
      const cx = Math.floor(position.x / cellSize), cz = Math.floor(position.z / cellSize);
      for (let ring = 1; ring <= 2 && !candidates.length; ring++)
        for (let z = cz - ring; z <= cz + ring; z++) for (let x = cx - ring; x <= cx + ring; x++) {
          if (Math.abs(x - cx) !== ring && Math.abs(z - cz) !== ring) continue;
          candidates.push(...(areaCells.get(key(x, z)) || []));
        }
    }
    const pool = candidates?.length ? new Set(candidates) : areas.keys();
    for (const id of pool) {
      const area = areas.get(id);
      const value = (position.x - area.center.x) ** 2 + (position.z - area.center.z) ** 2 + Math.abs(position.y - area.center.y) * 8;
      if (value < score) { score = value; best = area; }
    }
    return best;
  };
  const routeCache = new Map();
  const route = (fromId, toId) => {
    const cacheKey = `${fromId}:${toId}`;
    if (routeCache.has(cacheKey)) return routeCache.get(cacheKey);
    if (fromId === toId) return [];
    const queue = [fromId], previous = new Map([[fromId, null]]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const id = queue[cursor];
      for (const next of areas.get(id)?.connections || []) {
        if (!areas.has(next) || previous.has(next)) continue;
        previous.set(next, id);
        if (next === toId) {
          const result = [];
          for (let step = next; step !== fromId; step = previous.get(step)) result.push(step);
          result.reverse(); routeCache.set(cacheKey, result); return result;
        }
        queue.push(next);
      }
    }
    return [];
  };
  let goal = null;
  const navigation = {
    heightAt: surfaceAt,
    blockerAt: () => false,
    clear(a, b) {
      const from = nearestArea(a), to = nearestArea(b);
      return !!from && !!to && (from.id === to.id || from.connections.includes(to.id));
    },
    update(target) { goal = { x: target.x, y: target.y, z: target.z }; },
    steer(position, target = goal) {
      if (!target) return null;
      const from = nearestArea(position), to = nearestArea(target);
      if (!from || !to) return null;
      const ids = route(from.id, to.id);
      const waypoint = ids.length ? areas.get(ids[0]).center : target;
      const dx = waypoint.x - position.x, dz = waypoint.z - position.z;
      const length = Math.hypot(dx, dz);
      return length > 1e-4 ? { x: dx / length, z: dz / length } : null;
    },
  };
  return { surfaceAt, heightsAt, canTraverse, navigation, areas };
}

async function addStaticProps(root, manifest, items, placements, obstacles) {
  const textureLoader = new THREE.TextureLoader();
  const batches = await Promise.all(manifest.models.map(async (model) => {
    const instances = items.map((item, index) => ({ item, index })).filter(({ item }) => item.model.toLowerCase() === model.model.toLowerCase());
    if (!instances.length) return [];
    const response = await fetch(assetUrl(`static-models/${model.binary}`));
    if (!response.ok) throw new Error(`13号地区静态模型缺失：${model.model}`);
    const buffer = await response.arrayBuffer();
    return Promise.all(model.parts.map(async (part) => {
      const packed = new Float32Array(buffer, part.byteOffset, part.byteLength / 4);
      const geometry = new THREE.BufferGeometry();
      const interleaved = new THREE.InterleavedBuffer(packed, 8);
      geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
      geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(interleaved, 3, 3));
      geometry.setAttribute('uv', new THREE.InterleavedBufferAttribute(interleaved, 2, 6));
      let map = null;
      if (part.texture) {
        map = await textureLoader.loadAsync(assetUrl(`static-models/${part.texture}`).href);
        map.colorSpace = THREE.SRGBColorSpace; map.flipY = false;
      }
      const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: .78, metalness: .06, side: THREE.DoubleSide, alphaTest: .18 }), instances.length);
      mesh.name = `zone13-source-prop-${model.model}`;
      const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), quaternion = new THREE.Quaternion();
      instances.forEach(({ item, index: sourceIndex }, index) => {
        position.fromArray(item.position); position.y += placements[sourceIndex]?.correctionY || 0;
        scale.setScalar(item.scale || 1);
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-item.angles[1]));
        mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
      return mesh;
    }));
  }));
  for (const mesh of batches.flat()) { root.add(mesh); obstacles.push(mesh); }
}

export async function buildZone13Map(scene, onProgress = () => {}) {
  const textureLoader = new THREE.TextureLoader();
  const cubeLoader = new THREE.CubeTextureLoader();
  const skyFaces = ['rt', 'lf', 'up', 'dn', 'ft', 'bk']
    .map((face) => new URL(`skybox/gray_sky${face}.png`, EXTRAS).href);
  const [worldData, walkData, modelData, gameplay, atlasInfo, meshResponse,
    weaponBoxTexture, supplyBoxTexture, atlas, skybox] = await Promise.all([
    fetchJson('zone13-graybox.json', '13号地区场景清单'),
    fetchJson('zone13-walkmesh.json', '13号地区行走网格'),
    fetchJson('static-models/manifest.json', '13号地区道具清单'),
    fetchJson('zone13-gameplay-plan.json', '13号地区玩法清单'),
    fetchJson('zone13-material-atlas.json', '13号地区材质图集清单'),
    fetch(assetUrl('zone13-graybox.bin')),
    textureLoader.loadAsync(assetUrl('weaponbox.png').href),
    textureLoader.loadAsync(assetUrl('supplybox.png').href),
    textureLoader.loadAsync(assetUrl('zone13-material-atlas.png').href),
    cubeLoader.loadAsync(skyFaces),
  ]);
  if (!meshResponse.ok) throw new Error(`13号地区场景网格缺失 (${meshResponse.status})`);
  onProgress(.18);
  const buffer = await meshResponse.arrayBuffer();
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.flipY = false;
  atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter;
  const root = new THREE.Group(); root.name = 'zone13-formal-map'; root.visible = false;
  const obstacles = [];
  for (const group of worldData.groups) {
    if (!group.vertexCount) continue;
    const packed = new Float32Array(new Float32Array(buffer, group.byteOffset, group.byteLength / 4));
    const geometry = new THREE.BufferGeometry();
    const interleaved = new THREE.InterleavedBuffer(packed, group.strideFloats || 8);
    geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
    geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(interleaved, 3, 3));
    geometry.setAttribute('uv', new THREE.InterleavedBufferAttribute(interleaved, 2, 6));
    if ((group.strideFloats || 8) >= 9) geometry.setAttribute('atlasSlot', new THREE.InterleavedBufferAttribute(interleaved, 1, 8));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, makeAtlasMaterial(group, atlas, atlasInfo));
    mesh.name = `zone13-world-${group.id}`; mesh.receiveShadow = true;
    root.add(mesh); obstacles.push(mesh);
  }
  onProgress(.58);
  await addStaticProps(root, modelData, worldData.staticProps, walkData.staticPropPlacements, obstacles);
  const crateGeometry = new THREE.BoxGeometry(1.05, .72, .82);
  for (const map of [weaponBoxTexture, supplyBoxTexture]) {
    map.colorSpace = THREE.SRGBColorSpace; map.flipY = false;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
  }
  const weaponMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: weaponBoxTexture, roughness: .62 });
  const supplyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: supplyBoxTexture, roughness: .58 });
  const weaponCrates = worldData.markers.filter((marker) => marker.kind === 'weapon').map((marker, index) => {
    const mesh = new THREE.Mesh(crateGeometry, weaponMaterial); mesh.name = `zone13-weapon-crate-${index + 1}`;
    mesh.position.fromArray(marker.position); mesh.position.y += .38; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    return { kind: 'weapon', position: [...marker.position], mesh, active: true, claimed: false };
  });
  const supplyPoints = gameplay.points.filter((point) => point.kind === 'supply');
  const supplyWaves = ['locone', 'loctwo'].map((name, wave) => ({ wave: wave + 1,
    at: gameplay.rules.source.airdropSeconds[wave], deployed: false, claimed: false,
    candidates: supplyPoints.filter((point) => point.name === name).map((point) => [...point.position]),
    mesh: (() => { const mesh = new THREE.Mesh(crateGeometry, supplyMaterial); mesh.name = `zone13-airdrop-${wave + 1}`; mesh.visible = false; mesh.castShadow = true; root.add(mesh); return mesh; })(),
  }));
  scene.add(root);
  const walk = createWalkSurface(walkData);
  const colliders = walkData.propColliders.map((c) => ({ ...c, walkable: false }));
  for (const crate of weaponCrates) {
    const [x, y, z] = crate.position;
    crate.collider = { x, z, y0: y, h: y + .72, hx: .525, hz: .41,
      active: true, walkable: false, model: 'weaponbox' };
    colliders.push(crate.collider);
  }
  for (const wave of supplyWaves) {
    wave.collider = { x: 0, z: 0, y0: 0, h: .72, hx: .525, hz: .41,
      active: false, walkable: false, model: 'supplybox' };
    colliders.push(wave.collider);
  }
  const spatialCollision = createZone13SpatialCollision(worldData, buffer, colliders);
  skybox.colorSpace = THREE.SRGBColorSpace;
  const zone13Events = createZone13EventDirector(root, colliders, obstacles, worldData, supplyBoxTexture);
  const min = worldData.bounds.min, max = worldData.bounds.max;
  const bounds = { hw: Math.ceil(Math.max(Math.abs(min[0]), Math.abs(max[0]))), hl: Math.ceil(Math.max(Math.abs(min[2]), Math.abs(max[2]))) };
  const spawns = walkData.spawnStarts.map((item) => [...item.position]);
  // The Source map contains ten authored starts, while the formal bio rules deploy
  // twelve mercenaries plus the player. Fill the two missing slots from roomy NAV
  // centres instead of stacking actors onto an existing spawn.
  if (spawns.length < 12) {
    const candidates = [...walk.areas.values()]
      .map((area) => [area.center.x, area.center.y, area.center.z])
      .filter((point) => spawns.every((spawn) => Math.hypot(point[0] - spawn[0], point[2] - spawn[2]) > 6));
    candidates.sort((a, b) => Math.min(...spawns.map((p) => Math.hypot(b[0] - p[0], b[2] - p[2]))) -
      Math.min(...spawns.map((p) => Math.hypot(a[0] - p[0], a[2] - p[2]))));
    while (spawns.length < 12 && candidates.length) spawns.push(candidates.shift());
  }
  const holdMarkers = worldData.markers.filter((marker) => marker.kind === 'weapon').map((marker) => [...marker.position]);
  const topdown = [{ x: (min[0] + max[0]) / 2, z: (min[2] + max[2]) / 2, hx: (max[0] - min[0]) / 2, hz: (max[2] - min[2]) / 2, kind: 'floor' }];
  for (const collider of colliders) topdown.push({ x: collider.x, z: collider.z, hx: collider.hx, hz: collider.hz, kind: /bus|car/i.test(collider.model) ? 'crate' : 'house' });
  const canMoveSegment = (x0, z0, x1, z1, feetY,
      stepHeight = walkData.actor.maxStep, actorHeight = walkData.actor.height,
      radius = walkData.actor.radius, grounded = true) => {
    // Support controls landing, not horizontal movement: a player can walk
    // off a platform while the actual BSP walls continue to block movement.
    return !spatialCollision.blocksMovement(x0, z0, x1, z1, feetY,
      radius, stepHeight, actorHeight);
  };
  onProgress(1);
  return {
    name: '13号地区', source: 'source-zone13-local', visuals: [root],
    setActive(active) { root.visible = active; },
    obstacles, colliders, bounds, topdown,
    floorY: min[1], stepHeight: walkData.actor.maxStep, groundSnap: .18,
    strictAirborneSupport: true,
    surfaceAt: walk.surfaceAt, surfacesAt: walk.heightsAt,
    canTraverse: walk.canTraverse, playerCanTraverse: () => true, canMoveSegment,
    hasVerticalClearance: spatialCollision.hasVerticalClearance,
    landingSurfaceAt: spatialCollision.landingSurfaceAt,
    supportSurfaceAt: spatialCollision.supportSurfaceAt,
    lineClear: spatialCollision.lineClear,
    collisionPerformance: spatialCollision.stats,
    voidY: min[1] - 2,
    navigation: walk.navigation,
    background: skybox, environment: skybox, fog: new THREE.FogExp2(0x39423f, .0028),
    renderLook: { hemiSky: 0xe4eee7, hemiGround: 0x62584b, hemiIntensity: 1.2,
      sunPosition: [-80, 130, 65], sunColor: 0xffd8a0, sunIntensity: 2.15, exposure: 1.05 },
    spawns: { player: spawns, enemy: [...spawns].reverse() },
    distributedSpawns: true, spawnSafeDistance: 8,
    radarOverview: { url: new URL('radar/zm_zone13_radar.png', EXTRAS).href,
      posX: -3832, posY: 2501, scale: 5, width: 1024, height: 1024,
      metresPerSourceUnit: worldData.scaleMetersPerSourceUnit || .0254 },
    zone13Events,
    bio: { humans: spawns, mutants: [...spawns].reverse(), holdPoints: holdMarkers.length ? holdMarkers : spawns,
      ruleVariant: 'zone13zm', weaponCrates, supplyWaves },
  };
}
