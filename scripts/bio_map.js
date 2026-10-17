import * as THREE from 'three';
import { makeGLTFLoader } from './gltf.js';

// An original infection arena with linked factory halls, offset holdouts and
// a central loading court. Every authored cover has a matching collision proxy.
export async function buildBioMap(scene, onProgress = () => {}) {
  const root = new THREE.Group();
  root.name = 'bio-pyramid';
  scene.add(root);
  const colliders = [], obstacles = [], topdown = [];
  const loader = new THREE.TextureLoader();
  const wallTex = await loader.loadAsync(new URL('../assets/classic/prison/fallback_concrete_concretefloor008a.png', import.meta.url).href);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(5, 5);
  wallTex.colorSpace = THREE.SRGBColorSpace;
  const groundTex = wallTex.clone();
  groundTex.repeat.set(9, 10);
  groundTex.needsUpdate = true;
  const deckTex = wallTex.clone();
  deckTex.repeat.set(8, 4);
  deckTex.needsUpdate = true;
  const asphalt = await loader.loadAsync(new URL('../assets/bio/textures/asphalt_02_diff_1k.jpg', import.meta.url).href);
  const asphaltNormal = await loader.loadAsync(new URL('../assets/bio/textures/asphalt_02_nor_gl_1k.jpg', import.meta.url).href);
  for (const texture of [asphalt, asphaltNormal]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(26, 29);
  }
  asphalt.colorSpace = THREE.SRGBColorSpace;
  onProgress(.35);
  const gltfLoader = makeGLTFLoader();
  const propFiles = ['power_box.glb', 'wrecked_suv.glb', 'watchtower.glb',
    'barrel_02/Barrel_02_1k.gltf', 'factory_facade/modular_factory_facade_1k.gltf',
    'overhead_crane/overhead_crane_1k.gltf',
    'concrete_road_barrier_02/concrete_road_barrier_02_1k.gltf'];
  const propResults = await Promise.allSettled(propFiles.map(file =>
    gltfLoader.loadAsync(new URL(`../assets/bio/props/${file}`, import.meta.url).href)));
  const props = propResults.map((result, index) => {
    if (result.status === 'fulfilled') return result.value.scene;
    console.warn(`生化地图模型 ${propFiles[index]} 加载失败：`, result.reason);
    return null;
  });
  onProgress(.52);
  const stone = new THREE.MeshStandardMaterial({ color: 0xaeb4ad, map: wallTex, roughness: .93 });
  const groundStone = stone.clone();
  groundStone.map = asphalt;
  groundStone.normalMap = asphaltNormal;
  groundStone.color.setHex(0xb2b8ba);
  groundStone.roughness = .84;
  const dark = new THREE.MeshStandardMaterial({ color: 0x838d89, map: deckTex, roughness: .89, metalness: .06 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8b9790, roughness: .68, metalness: .3 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x856b5b, roughness: .91, metalness: .14 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb63c2d, emissive: 0x6d160e, emissiveIntensity: .72 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffb073, emissive: 0xff4e25, emissiveIntensity: 2.1 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x5d6c70, roughness: .53, metalness: .68 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x579ba5, emissive: 0x284b53, emissiveIntensity: .6, roughness: .19, metalness: .55 });
  const powerGlass = glass.clone();
  powerGlass.color.setHex(0xffffff);
  powerGlass.metalness = .04;
  powerGlass.roughness = .46;
  const powerDiode = red.clone();
  const wet = new THREE.MeshStandardMaterial({ color: 0x445763, roughness: .19, metalness: .32, transparent: true, opacity: .55, depthWrite: false });
  function box(name, x, y, z, w, h, d, material, solid = false, walkable = false, kind = '') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = solid;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (solid) {
      obstacles.push(mesh);
      colliders.push({ x, z, hx: w / 2, hz: d / 2, y0: y - h / 2, h: y + h / 2, walkable });
      if (kind) {
        const radarKind = kind === 'floor'
          ? name === 'court-floor' ? 'deck' : name.includes('step') ? 'stairs' : 'walk'
          : name.startsWith('perimeter') ? 'hull'
            : name.includes('crate') || name.includes('cover') ? 'crate' : 'house';
        topdown.push({ x, z, hx: w / 2, hz: d / 2, kind: radarKind });
      }
    }
    return mesh;
  }
  function placeProp(source, name, x, z, height, yaw = 0) {
    if (!source) return null;
    const initial = new THREE.Box3().setFromObject(source);
    const size = initial.getSize(new THREE.Vector3());
    const center = initial.getCenter(new THREE.Vector3());
    const scale = height / size.y;
    source.scale.setScalar(scale);
    source.position.set(-center.x * scale, -initial.min.y * scale, -center.z * scale);
    const placed = new THREE.Group();
    placed.name = name;
    placed.position.set(x, 0, z);
    placed.rotation.y = yaw;
    placed.add(source);
    root.add(placed);
    source.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      obstacles.push(node);
    });
    // The rotated vehicle/cabinet needs a rotated collision proxy. Its world
    // AABB was a large invisible wall around the four corners of the model.
    const localHx = size.x * scale / 2, localHz = size.z * scale / 2;
    const cx = Math.cos(yaw), sx = Math.sin(yaw);
    const footprint = { x: Math.abs(cx) * localHx + Math.abs(sx) * localHz,
      z: Math.abs(sx) * localHx + Math.abs(cx) * localHz };
    const u = cx * x - sx * z, v = sx * x + cx * z;
    colliders.push({ x, z, hx: footprint.x, hz: footprint.z,
      y0: 0, h: height, walkable: false,
      planes: [[cx, 0, -sx, u + localHx], [-cx, 0, sx, -u + localHx],
        [sx, 0, cx, v + localHz], [-sx, 0, -cx, -v + localHz],
        [0, 1, 0, height], [0, -1, 0, 0]] });
    topdown.push({ x, z, hx: footprint.x, hz: footprint.z, kind: 'crate' });
    return placed;
  }
  // Poly Haven's barrel is authored at game scale. Its eight-sided collision
  // proxy is close to the visible cylinder; shots raycast against the same
  // placed model, not against a larger invisible rectangular prop brush.
  function placeBarrel(name, x, y, z, yaw = 0) {
    if (!props[3]) return;
    const copy = props[3].clone(true);
    const bounds = new THREE.Box3().setFromObject(copy);
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z) * .51;
    copy.position.y -= bounds.min.y;
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    group.add(copy);
    root.add(group);
    copy.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      obstacles.push(node);
    });
    const planes = Array.from({ length: 8 }, (_, i) => {
      const a = i * Math.PI / 4, nx = Math.cos(a), nz = Math.sin(a);
      return [nx, 0, nz, nx * x + nz * z + radius];
    });
    planes.push([0, 1, 0, y + size.y], [0, -1, 0, -y]);
    colliders.push({ x, z, hx: radius * 1.09, hz: radius * 1.09,
      y0: y, h: y + size.y, walkable: false, planes });
    topdown.push({ x, z, hx: radius, hz: radius, kind: 'crate' });
  }
  function placeBarrier(name, x, y, z, yaw = 0, height = 1.3) {
    if (!props[6]) return false;
    const copy = props[6].clone(true);
    const sourceBounds = new THREE.Box3().setFromObject(copy);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    const scale = height / sourceSize.y;
    copy.scale.setScalar(scale);
    copy.position.set(-sourceBounds.getCenter(new THREE.Vector3()).x * scale,
      -sourceBounds.min.y * scale, -sourceBounds.getCenter(new THREE.Vector3()).z * scale);
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    group.add(copy);
    root.add(group);
    copy.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = node.receiveShadow = true;
      obstacles.push(node);
    });
    const halfWidth = sourceSize.x * scale / 2;
    const halfDepth = sourceSize.z * scale / 2;
    const cx = Math.cos(yaw), sx = Math.sin(yaw);
    const worldHalfX = Math.abs(cx) * halfWidth + Math.abs(sx) * halfDepth;
    const worldHalfZ = Math.abs(sx) * halfWidth + Math.abs(cx) * halfDepth;
    const u = cx * x - sx * z, v = sx * x + cx * z;
    colliders.push({ x, z, hx: worldHalfX, hz: worldHalfZ, y0: y, h: y + height,
      walkable: false,
      planes: [[cx, 0, -sx, u + halfWidth], [-cx, 0, sx, -u + halfWidth],
        [sx, 0, cx, v + halfDepth], [-sx, 0, -cx, -v + halfDepth],
        [0, 1, 0, y + height], [0, -1, 0, -y]] });
    topdown.push({ x, z, hx: worldHalfX, hz: worldHalfZ, kind: 'crate' });
    return true;
  }
  // Large process tanks provide rounded cover and a recognizable industrial
  // silhouette. The twelve-sided footprint follows the visible cylinder, so
  // humans and mutants do not stop at empty square corners around it.
  function placeTank(name, x, z, playable = true) {
    const tank = new THREE.Group();
    tank.name = name;
    tank.position.set(x, 0, z);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.56, 3.75, 20), steel);
    shell.position.y = 2.05;
    shell.castShadow = shell.receiveShadow = true;
    tank.add(shell);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.62, .35, 20), rust);
    foot.position.y = .175;
    foot.castShadow = foot.receiveShadow = true;
    tank.add(foot);
    for (const y of [.55, 3.33]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.53, .09, 6, 20), rust);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      tank.add(band);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.5, .35, 20), trim);
    cap.position.y = 4.1;
    cap.castShadow = true;
    tank.add(cap);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(.07, 3.35, .07), trim);
      rail.position.set(side * .35, 1.9, -1.53);
      tank.add(rail);
    }
    for (const y of [.75, 1.55, 2.35, 3.15]) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(.8, .06, .08), trim);
      rung.position.set(0, y, -1.54);
      tank.add(rung);
    }
    root.add(tank);
    if (!playable) return;
    obstacles.push(shell, foot);
    const planes = Array.from({ length: 12 }, (_, i) => {
      const a = i * Math.PI / 6, nx = Math.cos(a), nz = Math.sin(a);
      return [nx, 0, nz, nx * x + nz * z + 1.56];
    });
    planes.push([0, 1, 0, 4.3], [0, -1, 0, 0]);
    colliders.push({ x, z, hx: 1.62, hz: 1.62,
      y0: 0, h: 4.3, walkable: false, planes });
    topdown.push({ x, z, hx: 1.56, hz: 1.56, kind: 'crate' });
  }
  // The Poly Haven facade is a library of real 3 m modules. We reuse only
  // selected wall/window/door modules; the source GLTF's showroom layout is
  // never placed in the level. A matching 3 m collision brush sits behind
  // every panel, so an apparent entrance is always an actual gap in both
  // render and navigation geometry.
  function factoryPanel(name, x, z, yaw, style = 'plain', upper = false) {
    const source = props[4];
    const wallName = style === 'window' ? 'wall_window_centered_small_01'
      : style === 'door' ? 'wall_door_centered_small_01' : 'wall_standard_standard_01';
    const detailName = style === 'window' ? 'window_centered_small_01'
      : style === 'door' ? 'door_centered_small_01' : null;
      const panel = new THREE.Group();
    panel.name = name;
    panel.position.set(x, upper ? 3 : 0, z);
    panel.rotation.y = yaw;
    root.add(panel);
    const cloneFace = (nodeName, depth, reverse) => {
      const authored = source?.getObjectByName(nodeName);
      if (!authored) return;
      const face = authored.clone();
      face.position.set(1.5, 0, 0);
      face.castShadow = true;
      face.receiveShadow = true;
      face.traverse(mesh => {
        if (!mesh.isMesh) return;
        const side = material => {
          material.side = THREE.DoubleSide;
          material.needsUpdate = true;
        };
        Array.isArray(mesh.material) ? mesh.material.forEach(side) : side(mesh.material);
      });
      const mount = new THREE.Group();
      mount.position.z = depth;
      if (reverse) mount.rotation.y = Math.PI;
      mount.add(face);
      panel.add(mount);
      face.traverse(mesh => { if (mesh.isMesh) obstacles.push(mesh); });
    };
    // The original facade details protrude toward local -Z; keep both faces
    // just outside the .38 m backing brush rather than burying the windows.
    for (const [depth, reverse] of [[-.21, false], [.21, true]]) {
      cloneFace(wallName, depth, reverse);
      if (detailName) cloneFace(detailName, depth, reverse);
    }
    const alongX = Math.abs(Math.cos(yaw)) > .5;
    box(`${name}-collision`, x, upper ? 4.5 : 1.5, z,
      alongX ? 3 : .38, 3, alongX ? .38 : 3,
      stone, true, false, 'wall');
  }
  function factoryBlock(name, x0, z0, panelsX, panelsZ, openings) {
    const x1 = x0 + panelsX * 3, z1 = z0 + panelsZ * 3;
    const edges = [
      ['south', Array.from({ length: panelsX }, (_, i) => [x0 + (i + .5) * 3, z0, 0, i])],
      ['north', Array.from({ length: panelsX }, (_, i) => [x0 + (i + .5) * 3, z1, Math.PI, i])],
      ['west', Array.from({ length: panelsZ }, (_, i) => [x0, z0 + (i + .5) * 3, -Math.PI / 2, i])],
      ['east', Array.from({ length: panelsZ }, (_, i) => [x1, z0 + (i + .5) * 3, Math.PI / 2, i])],
    ];
    for (const [edge, tiles] of edges) for (const [x, z, yaw, i] of tiles) {
      if (openings[edge]?.includes(i)) {
        // A beam above the opening makes the doorway readable from a distance,
        // but leaves the entire 3 m opening free of collision.
        box(`${name}-${edge}-${i}-lintel`, x, 3.18, z,
          edge === 'south' || edge === 'north' ? 3 : .44, .35,
          edge === 'south' || edge === 'north' ? .44 : 3, trim);
      } else {
        // A door-looking panel backed by a solid collision brush is a false
        // entrance. Only skipped panels above are traversable doorways.
        factoryPanel(`${name}-${edge}-${i}`, x, z, yaw,
          i % 3 === 0 ? 'window' : 'plain');
      }
      factoryPanel(`${name}-${edge}-${i}-upper`, x, z, yaw,
        i % 2 === 0 ? 'window' : 'plain', true);
    }
    // Exposed trusses rather than a solid ceiling retain good visibility and
    // allow fire and navigation through every ground-level doorway.
    for (let i = 1; i < panelsZ; i += 2) {
      box(`${name}-roof-truss`, (x0 + x1) / 2, 6.25, z0 + i * 3,
        x1 - x0, .25, .24, steel);
    }
    box(`${name}-roof-edge-a`, (x0 + x1) / 2, 6.32, z0, x1 - x0, .34, .42, rust);
    box(`${name}-roof-edge-b`, (x0 + x1) / 2, 6.32, z1, x1 - x0, .34, .42, rust);
    const lamp = new THREE.PointLight(0xa8d8ec, 5.5, 17, 2);
    lamp.position.set((x0 + x1) / 2, 5.2, (z0 + z1) / 2);
    root.add(lamp);
  }
  function factorySign(name, label, x, z, width) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 112;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1b282c'; ctx.fillRect(0, 0, 512, 112);
    ctx.strokeStyle = '#b7a177'; ctx.lineWidth = 8; ctx.strokeRect(5, 5, 502, 102);
    ctx.fillStyle = '#d4d8cb'; ctx.font = 'bold 57px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 57, 475);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 112 / 512),
      new THREE.MeshStandardMaterial({ map, roughness: .81, metalness: .1,
        emissive: 0x182327, emissiveIntensity: .2, side: THREE.DoubleSide }));
    sign.name = name;
    sign.position.set(x, 3.7, z);
    root.add(sign);
  }
  // Ground is one continuous walkable brush. The ledges have broad, low steps
  // so the same support/step rules work for the player and navigation grid.
  box('court-floor', 0, -.12, 0, 80, .24, 88, groundStone, true, true, 'floor');
  for (const side of [-1, 1]) {
    box('perimeter-long', side * 40.35, 2.5, 0, .7, 5, 88, stone, true, false, 'wall');
    box('perimeter-end', 0, 2.5, side * 44.35, 80, 5, .7, stone, true, false, 'wall');
    box('perimeter-cap', side * 40.05, 5.05, 0, .72, .18, 88, steel);
    box('perimeter-service-pipe', side * 39.93, 3.86, 0, .12, .12, 85, steel);
    box('perimeter-base-trim', side * 39.92, .28, 0, .12, .28, 85, rust);
    for (const z of [-38, -28, -18, -8, 2, 12, 22, 32, 40]) {
      box('buttress', side * 39.6, 1.5, z, 1.3, 3, 1.5, trim, true, false, 'wall');
      box('warning-strip', side * 39.55, 2.85, z, .12, .16, 1.8, red);
      box('wall-vent-frame', side * 39.94, 3.1, z + 3.2, .10, .95, 1.48, steel);
      for (let i = 0; i < 5; i++)
        box('wall-vent-slat', side * 39.87, 2.76 + i * .17, z + 3.2, .035, .055, 1.2, trim);
    }
  }
  for (const end of [-1, 1]) {
    const z = end * 16;
    box('defense-deck', 0, .7, z, 21, 1.4, 10, stone, true, true, 'floor');
    box('deck-surface', 0, 1.42, z, 21.1, .05, 10.1, dark);
    for (const x of [-7, -3.5, 0, 3.5, 7])
      box('deck-joint', x, 1.452, z, .025, .004, 9.8, trim);
    box('hazard-edge', 0, 1.454, z - end * 4.87, 20.4, .008, .1, red);
    for (const x of [-6, 0, 6]) {
      box('step-1', x, .17, z - end * 7.2, 3.5, .34, 1.8, stone, true, true, 'floor');
      box('step-2', x, .39, z - end * 6.3, 3.5, .78, 1.4, stone, true, true, 'floor');
      box('step-3', x, .57, z - end * 5.4, 3.5, 1.14, 1.0, stone, true, true, 'floor');
    }
    for (const x of [-8.6, 8.6]) {
      if (!placeBarrier('deck-concrete-cover', x, 1.4, z, Math.PI / 2, 1.4)) {
        box('deck-cover', x, 2.15, z, 1.65, 1.4, 2.1, rust, true, false, 'wall');
        box('deck-cover-band', x, 2.22, z, 1.69, .16, 2.13, trim);
      }
    }
    box('rear-crenel-left', -9.8, 1.84, z + end * 4.8, 2.2, .8, .55, stone, true, false, 'wall');
    box('rear-crenel-right', 9.8, 1.84, z + end * 4.8, 2.2, .8, .55, stone, true, false, 'wall');
    // A second, rear holdout has three broad approaches and chest-high cover.
    // It offers a retreat route without becoming an unreachable perch.
    const rearZ = end * 34;
    box('rear-holdout', 0, .7, rearZ, 18, 1.4, 8, stone, true, true, 'floor');
    box('rear-holdout-surface', 0, 1.42, rearZ, 18.1, .05, 8.1, dark);
    for (const x of [-6, 0, 6]) {
      box('rear-step-1', x, .17, rearZ - end * 5.9, 3.3, .34, 1.8, stone, true, true, 'floor');
      box('rear-step-2', x, .39, rearZ - end * 4.8, 3.3, .78, 1.2, stone, true, true, 'floor');
      box('rear-step-3', x, .57, rearZ - end * 4.15, 3.3, 1.14, .8, stone, true, true, 'floor');
    }
    for (const x of [-7.3, 7.3]) {
      if (!placeBarrier('rear-concrete-cover', x, 1.4, rearZ - end * 3.65, 0, 1.1))
        box('rear-cover', x, 1.85, rearZ - end * 3.65, 2.4, .85, .5, rust, true, false, 'wall');
    }
    box('rear-rail', 0, 1.83, rearZ + end * 3.8, 17.4, .82, .32, trim, true, false, 'wall');
  }
  for (const side of [-1, 1]) {
    const x = side * 29;
    box('side-holdout', x, .7, 0, 8, 1.4, 11, stone, true, true, 'floor');
    box('side-holdout-surface', x, 1.42, 0, 8.1, .05, 11.1, dark);
    for (const z of [-3.5, 3.5]) {
      box('side-step-1', x - side * 5.9, .17, z, 1.8, .34, 2.8, stone, true, true, 'floor');
      box('side-step-2', x - side * 4.8, .39, z, 1.2, .78, 2.8, stone, true, true, 'floor');
      box('side-step-3', x - side * 4.15, .57, z, .8, 1.14, 2.8, stone, true, true, 'floor');
    }
    for (const z of [-4.4, 4.4])
      box('side-cover', x - side * 3.65, 1.85, z, .5, .85, 2.2, rust, true, false, 'wall');
    box('side-rail', x + side * 3.8, 1.83, 0, .32, .82, 10.4, trim, true, false, 'wall');
  }
  // Two authored factory buildings replace the former featureless side lanes.
  // Their open bays are deliberately offset, so either team can flank a
  // defended interior instead of pushing down one long, symmetric corridor.
  factoryBlock('western-loading-hall', -36, -27, 6, 6,
    { south: [2, 3], north: [1, 4], east: [2, 3] });
  factoryBlock('eastern-decontamination', 21, 9, 5, 6,
    { south: [1, 2], north: [2, 3], west: [1, 4] });
  factorySign('western-loading-sign', 'LOADING BAY 02', -31.5, -8.73, 4.2);
  factorySign('eastern-decon-sign', 'QUARANTINE', 30, 27.27, 5.2);
  if (props[5]) {
    const crane = props[5];
    const authored = new THREE.Box3().setFromObject(crane);
    const size = authored.getSize(new THREE.Vector3());
    const center = authored.getCenter(new THREE.Vector3());
    const longAxisX = size.x >= size.z;
    const width = Math.max(size.x, size.z);
    const scale = 18 / Math.max(width, .01);
    crane.scale.setScalar(scale);
    crane.position.set(-center.x * scale, 5.2 - authored.min.y * scale, -center.z * scale);
    const stage = new THREE.Group();
    stage.name = 'bio-overhead-crane';
    stage.position.z = -5;
    if (!longAxisX) stage.rotation.y = Math.PI / 2;
    stage.add(crane);
    root.add(stage);
    crane.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      obstacles.push(node);
    });
    for (const side of [-1, 1]) {
      box('crane-support-column', side * 9.2, 4.5, -5, .48, 9, .48,
        steel, true, false, 'wall');
      box('crane-support-foot', side * 9.2, .2, -5, 1.0, .4, 1.0, rust);
    }
  }
  // Offset center cover creates a crossing decision instead of a single lane.
  for (const [x, z] of [[-8, -3], [8, 3], [-2, 2], [2, -2]]) {
    if (props[1] && x === -8 && z === -3) continue;
    box('quarantine-crate', x, .8, z, 2.5, 1.6, 2.8, rust, true, false, 'wall');
    box('crate-metal-lip', x, 1.62, z, 2.58, .12, 2.88, trim);
    for (const dx of [-1.15, 1.15])
      box('crate-edge-brace', x + dx, .82, z, .085, 1.47, 2.9, steel);
    for (const dz of [-1.3, 1.3])
      box('crate-side-brace', x, .83, z + dz, 2.45, .12, .07, steel);
  }
  for (const [x, z] of [[-29, -20], [29, -20], [-29, 20], [29, 20],
    [-14, -30], [14, -30], [-14, 30], [14, 30]]) {
    box('outer-barricade-crate', x, .82, z, 2.6, 1.64, 3.2, rust, true, false, 'wall');
    box('outer-barricade-rim', x, 1.68, z, 2.72, .11, 3.3, trim);
  }
  // An offset processing checkpoint breaks the east sightline into two
  // approach choices. The low shield is defensible, while the wide flanks
  // remain traversable for both people and the navigation grid.
  for (const [x, z] of [[18, -27], [23, -22]]) {
    box('checkpoint-bulkhead', x, 1.22, z, .75, 2.44, 7.2, stone, true, false, 'wall');
    box('checkpoint-cap', x, 2.48, z, .88, .12, 7.35, trim);
    box('checkpoint-warning', x + .39, 1.10, z, .025, .14, 6.95, red);
  }
  box('checkpoint-cover', 20.5, .62, -15, 5.5, 1.24, .68, steel, true, false, 'wall');
  box('checkpoint-cover-rim', 20.5, 1.27, -15, 5.62, .08, .78, trim);
  // The west maintenance pocket offers a closer, less exposed holdout. The
  // bulkheads are staggered so there is always a route around either end.
  box('service-bulkhead-a', -24, 1.20, 13, 6.3, 2.4, .75, stone, true, false, 'wall');
  box('service-bulkhead-b', -19.5, 1.20, 21, .75, 2.4, 7.2, stone, true, false, 'wall');
  box('service-cover', -24, .65, 23, 5.3, 1.3, .7, rust, true, false, 'wall');
  for (const [x, z, w, d] of [[-24, 13, 6.5, .83], [-19.5, 21, .84, 7.35]])
    box('service-cap', x, 2.45, z, w, .12, d, trim);
  for (const [name, x, y, z, yaw] of [
    ['west-barrel-a', -31, 0, -12, .3], ['west-barrel-b', -30.4, 0, -12.4, 1.1],
    ['east-barrel-a', 32, 0, 13, .8], ['east-barrel-b', 32.6, 0, 13.4, -.5],
    ['checkpoint-barrel', 20, 0, -18, .45], ['service-barrel', -23, 0, 25, -.7],
    ['north-deck-barrel', 3, 1.4, -17.7, .1],
    ['south-deck-barrel', -3, 1.4, 35.7, .95],
  ]) placeBarrel(name, x, y, z, yaw);
  placeTank('north-process-tank', 12, -26);
  placeTank('south-process-tank', -12, 26);
  placeTank('loading-hall-tank', -30, -18);
  placeTank('decontamination-tank', 29, 18);
  placeTank('west-background-silo', -47, 14, false);
  placeTank('east-background-silo', 47, -16, false);
  // Independently licensed Sketchfab details are fitted to game meters. The
  // wreck is a real cover brush; the tower sits beyond the playable perimeter.
  placeProp(props[1], 'bio-wrecked-suv', -8, -3, 1.82, .22);
  if (props[2]) {
    const tower = props[2];
    const bounds = new THREE.Box3().setFromObject(tower);
    const scale = 14 / bounds.getSize(new THREE.Vector3()).y;
    const center = bounds.getCenter(new THREE.Vector3());
    tower.scale.setScalar(scale);
    tower.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    tower.name = 'bio-perimeter-watchtower';
    const stage = new THREE.Group();
    stage.position.set(-47, 0, -30);
    stage.rotation.y = .42;
    stage.add(tower);
    root.add(stage);
    tower.traverse(node => {
      if (!node.isMesh) return;
      node.receiveShadow = true;
      const shade = material => {
        const toned = material.clone();
        toned.color?.multiplyScalar(.62);
        return toned;
      };
      node.material = Array.isArray(node.material) ? node.material.map(shade) : shade(node.material);
    });
  }
  for (const x of [-17, 17]) {
    for (const z of [-12, 0, 12]) {
      if (x === -17 && z === -12) continue;
      box('side-pillar', x, 1.55, z, 1.7, 3.1, 1.7, stone, true, false, 'wall');
      box('pillar-cap', x, 3.14, z, 2.3, .2, 2.3, trim);
    }
  }
  for (const z of [-37, -21, 0, 21, 37]) for (const side of [-1, 1]) {
    box('wall-safety-lamp-housing', side * 39.62, 4.05, z, .22, .38, 1.25, steel);
    box('wall-safety-lamp', side * 39.48, 4.04, z, .05, .16, .92, lamp);
    const light = new THREE.PointLight(0xff7650, 8, 14, 2);
    light.position.set(side * 39.2, 3.95, z);
    root.add(light);
  }
  // A painted procedural night sky keeps the open roof from reading as a flat
  // color. It stays entirely outside collision and navigation.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 512; skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const skyPixels = skyCtx.createImageData(512, 256);
  const smooth = t => t * t * (3 - 2 * t);
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const noise = (x, y, periodX) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
    const wrapped = n => (n % periodX + periodX) % periodX;
    const a = hash(wrapped(ix), iy) * (1 - fx) + hash(wrapped(ix + 1), iy) * fx;
    const b = hash(wrapped(ix), iy + 1) * (1 - fx) + hash(wrapped(ix + 1), iy + 1) * fx;
    return a * (1 - fy) + b * fy;
  };
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const nx = x / 512, ny = y / 256;
    const cloud = noise(nx * 6, ny * 6, 6) * .57 + noise(nx * 13, ny * 13, 13) * .29 +
      noise(nx * 27, ny * 27, 27) * .14;
    const band = Math.max(0, 1 - Math.abs(ny - .42) * 1.25);
    const light = Math.max(0, cloud - .38) * 210 * band;
    const horizon = Math.max(0, 1 - Math.abs(ny - .53) * 2) * 12;
    const k = (y * 512 + x) * 4;
    skyPixels.data[k] = 22 + light * .70 + horizon * .5;
    skyPixels.data[k + 1] = 34 + light * .81 + horizon * .7;
    skyPixels.data[k + 2] = 49 + light + horizon;
    skyPixels.data[k + 3] = 255;
  }
  skyCtx.putImageData(skyPixels, 0, 0);
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false, fog: false }));
  skyDome.name = 'bio-storm-sky';
  root.add(skyDome);
  // A repairable distribution cabinet sits in the open central court. Its
  // collision and visual position are deliberately the same for both teams.
  const power = [0, 0, 5.5];
  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 512;
  panelCanvas.height = 256;
  const panelCtx = panelCanvas.getContext('2d');
  panelCtx.fillStyle = '#10252c';
  panelCtx.fillRect(0, 0, 512, 256);
  panelCtx.strokeStyle = '#6295a1';
  panelCtx.lineWidth = 4;
  panelCtx.strokeRect(13, 13, 486, 230);
  panelCtx.fillStyle = '#b8dad7';
  panelCtx.font = 'bold 42px Arial';
  panelCtx.fillText('EMERGENCY POWER', 32, 72);
  panelCtx.font = '26px monospace';
  panelCtx.fillText('MAIN BUS  //  02', 34, 130);
  panelCtx.fillStyle = '#c5815e';
  for (let i = 0; i < 7; i++) panelCtx.fillRect(35 + i * 56, 174, 42, 21);
  const panelTex = new THREE.CanvasTexture(panelCanvas);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  powerGlass.map = panelTex;
  powerGlass.needsUpdate = true;
  if (props[0]) {
    placeProp(props[0], 'bio-electric-box', power[0], power[2], 1.88, -Math.PI / 2);
    box('power-status', 0, 1.62, 6.15, .13, .09, .035, powerDiode);
  } else {
    box('power-cabinet', power[0], .92, power[2], 1.35, 1.84, .82, steel, true, false, 'wall');
    box('power-door', 0, 1.02, 5.94, 1.12, 1.48, .045, trim);
    box('power-screen', 0, 1.25, 5.97, .75, .48, .02, powerGlass);
    for (const x of [-.38, 0, .38]) {
      box('power-switch', x, .69, 5.99, .13, .20, .12, steel);
      box('power-diode', x, 1.73, 5.99, .12, .08, .035, powerDiode);
    }
    box('power-warning-stripe', 0, .28, 5.99, 1.05, .055, .035, red);
  }
  const powerLight = new THREE.PointLight(0x62c7d9, .35, 5, 2);
  powerLight.position.set(0, 1.6, 5.95);
  root.add(powerLight);
  const floodlights = [];
  for (const z of [-34, -16, 16, 34]) for (const x of [-8.5, 8.5]) {
    box('floodlight-mast', x, 3.3, z, .15, 3.7, .15, steel, true, false, 'wall');
    box('floodlight-housing', x, 5.15, z, .82, .28, .46, steel);
    const lens = box('floodlight-lens', x, 5.11, z + (z > 0 ? - .24 : .24), .7, .17, .03, glass);
    const light = new THREE.SpotLight(0xc2eaff, .18, 19, Math.PI / 3.3, .7, 1.5);
    light.position.set(x, 5.05, z);
    light.target.position.set(x * .5, 0, z > 0 ? 8 : -8);
    root.add(light, light.target);
    floodlights.push({ light, lens });
  }
  // Thin wet patches catch the emergency lights without obstructing movement.
  const puddleGeo = new THREE.PlaneGeometry(1, 1);
  for (const [x, z, w, d, y] of [[-11, 4, 3.5, 1.4, .014], [12, -5, 4, 1.2, .014],
    [-14, -15, 2.8, 1, .014], [13, 16, 3.2, 1.1, .014], [11, 8, 2.5, 1, .014],
    [-28, 17, 3.2, 1.3, .014], [27, -19, 3.3, 1.5, .014], [10, 28, 2.3, 1.2, .014],
    [-3, 35, 2.3, .85, 1.462], [3, -35, 2.3, .85, 1.462]]) {
    const patch = new THREE.Mesh(puddleGeo, wet);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, y, z);
    patch.scale.set(w, d, 1);
    root.add(patch);
  }
  // A single instanced draw call supplies slanting rainfall across the arena.
  const rainCount = 340;
  const rain = new THREE.InstancedMesh(new THREE.PlaneGeometry(.012, .66),
    new THREE.MeshBasicMaterial({ color: 0xb6d3df, transparent: true, opacity: .42,
      depthWrite: false, side: THREE.DoubleSide }), rainCount);
  rain.frustumCulled = false;
  rain.renderOrder = 3;
  root.add(rain);
  const drops = Array.from({ length: rainCount }, () => ({
    x: (Math.random() - .5) * 78, y: 2 + Math.random() * 14,
    z: (Math.random() - .5) * 86, speed: 10 + Math.random() * 5,
  }));
  const dropMatrix = new THREE.Matrix4(), dropPos = new THREE.Vector3();
  const dropQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -.14));
  const dropScale = new THREE.Vector3(1, 1, 1);
  function updateRain(dt) {
    if (!root.visible) return;
    for (let i = 0; i < rainCount; i++) {
      const p = drops[i];
      p.y -= p.speed * dt;
      p.x -= dt * 1.5;
      if (p.y < .1) { p.y = 10 + Math.random() * 7; p.x = (Math.random() - .5) * 78; }
      if (p.x < -39) p.x = 39;
      dropPos.set(p.x, p.y, p.z);
      rain.setMatrixAt(i, dropMatrix.compose(dropPos, dropQuat, dropScale));
    }
    rain.instanceMatrix.needsUpdate = true;
  }
  function setPower(active) {
    powerGlass.emissive.setHex(active ? 0x2f8792 : 0x1d4b53);
    powerGlass.emissiveIntensity = active ? .55 : .18;
    powerDiode.color.setHex(active ? 0x79ffca : 0xb63c2d);
    powerDiode.emissive.setHex(active ? 0x1caa67 : 0x6d160e);
    powerDiode.emissiveIntensity = active ? 1.4 : .72;
    powerLight.intensity = active ? 3.5 : .35;
    for (const { light, lens } of floodlights) {
      light.intensity = active ? 7 : .18;
      lens.material.emissiveIntensity = active ? 2.1 : .6;
    }
  }
  const haze = new THREE.Color(0x202b35);
  root.visible = false;
  onProgress(1);
  return {
    name: '生化禁区', source: 'bio-pyramid', visuals: [root], background: haze,
    fog: new THREE.FogExp2(0x202b35, .012), update: (_, dt) => updateRain(dt), setPower,
    colliders, obstacles, topdown, bounds: { hw: 39.3, hl: 43.3 }, floorY: 0,
    navigationMaxHeight: 1.5, navigationStep: .9,
    spawns: {
      player: [[0, 1.4, 34], [-6, 1.4, 34], [6, 1.4, 34]],
      enemy: [[-27, 0, -37], [27, 0, -37], [0, 1.4, -34]],
    },
    bio: {
      humans: [[-6, 1.4, 34], [6, 1.4, 34], [-6, 1.4, 32], [6, 1.4, 32], [0, 1.4, 36.5]],
      mutants: [[-27, 0, -37], [27, 0, -37], [0, 1.4, -34]],
      holdPoints: [[-5.7, 1.4, 34], [5.7, 1.4, 34], [-29, 1.4, 0], [29, 1.4, 0],
        [20, 0, -12], [-24, 0, 19], [-5.3, 1.4, 16], [5.3, 1.4, 16]],
      power,
    },
  };
}
