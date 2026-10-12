import * as THREE from 'three';
import { makeGLTFLoader } from './gltf.js';
import { batchStatic } from './batch.js';
import { palaceMaterials } from './palace_textures.js';

const ROOT = new URL('../assets/palace/', import.meta.url).href;
const HW = 19.5, HL = 29;
const UPPER = 3.2;

// The visible masonry, bullet meshes, player collision and AI navigation all
// come from the same primitives. Decorative trim is deliberately non-solid.
export async function buildPalaceMap(scene, onProgress = () => {}) {
  const textureLoader = new THREE.TextureLoader();
  const [diff, normal, rough] = await Promise.all([
    textureLoader.loadAsync(ROOT + 'textures/marble_diff.jpg'),
    textureLoader.loadAsync(ROOT + 'textures/marble_nor.jpg'),
    textureLoader.loadAsync(ROOT + 'textures/marble_rough.jpg'),
  ]);
  onProgress(.35);
  for (const t of [diff, normal, rough]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(9.5, 14.5);
    t.anisotropy = 8;
  }
  diff.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  group.name = 'royal-palace';
  scene.add(group);
  const colliders = [], topdown = [], obstacles = [];
  const architecture = [], ornament = [];
  const mat = (color, roughness = .7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const marbleMaps = { map: diff, normalMap: normal, roughnessMap: rough,
    normalScale: new THREE.Vector2(1, 1) };
  const { cream, pale, stone, wood, dark, red, burgundy } = palaceMaterials();
  const gold = mat(0xd3a54a, .28, .72), goldBright = mat(0xffd47b, .24, .75);
  const glass = new THREE.MeshStandardMaterial({ color: 0x254d5c, metalness: .28,
    roughness: .24, emissive: 0x102d3c, emissiveIntensity: .28 });
  const water = new THREE.MeshStandardMaterial({ color: 0x55aeb2, metalness: .28,
    roughness: .18, transparent: true, opacity: .82, depthWrite: false });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffdd97,
    emissive: 0xffad4c, emissiveIntensity: 2.2, roughness: .3 });
  const banner = red.clone();
  banner.side = THREE.DoubleSide;
  const marble = new THREE.MeshStandardMaterial({ ...marbleMaps,
    color: 0xffffff, roughness: 1, metalness: .04 });

  function mesh(geometry, material, name, x, y, z, physical = false) {
    const m = new THREE.Mesh(geometry, material);
    m.name = name; m.position.set(x, y, z);
    m.receiveShadow = true; m.castShadow = physical;
    group.add(m);
    (physical ? architecture : ornament).push(m);
    if (physical) obstacles.push(m);
    return m;
  }
  function box(name, x, y, z, w, h, d, material, options = {}) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const tile = material.userData.tileSize;
    if (tile) {
      const uv = geometry.attributes.uv;
      const faces = [[d,h], [d,h], [w,d], [w,d], [w,h], [w,h]];
      for (let face = 0; face < 6; face++) {
        const [fw, fh] = faces[face];
        for (let corner = 0; corner < 4; corner++) {
          const i = face * 4 + corner;
          uv.setXY(i, uv.getX(i) * fw / tile, uv.getY(i) * fh / tile);
        }
      }
      uv.needsUpdate = true;
    }
    const m = mesh(geometry, material, name, x, y, z,
      !!options.physical);
    if (options.solid) colliders.push({ x, z, hx: w / 2, hz: d / 2,
      y0: y - h / 2, h: y + h / 2, walkable: !!options.walkable });
    if (options.kind) topdown.push({ x, z, hx: w / 2, hz: d / 2, kind: options.kind });
    return m;
  }
  function cylinder(name, x, y, z, radius, height, material, sides = 12,
    physical = false) {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, sides);
    const tile = material.userData.tileSize;
    if (tile) {
      const uv = geometry.attributes.uv;
      const sideVertices = (sides + 1) * 2;
      const across = Math.max(1, Math.round(2 * Math.PI * radius / tile));
      for (let i = 0; i < sideVertices; i++)
        uv.setXY(i, uv.getX(i) * across, uv.getY(i) * height / tile);
      uv.needsUpdate = true;
    }
    return mesh(geometry,
      material, name, x, y, z, physical);
  }
  function arch(name, x, y, z, halfSpan, rise, material,
    band, plane = 'xy', depth = .12, physical = false) {
    const profile = new THREE.Shape();
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI * i / 24;
      const px = Math.cos(a) * (halfSpan + band);
      const py = Math.sin(a) * (rise + band);
      if (i === 0) profile.moveTo(px, py);
      else profile.lineTo(px, py);
    }
    for (let i = 24; i >= 0; i--) {
      const a = Math.PI * i / 24;
      profile.lineTo(Math.cos(a) * (halfSpan - band),
        Math.sin(a) * (rise - band));
    }
    profile.closePath();
    const geometry = new THREE.ExtrudeGeometry(profile, {
      depth, bevelEnabled: true, bevelThickness: .014,
      bevelSize: .014, bevelSegments: 1, curveSegments: 4,
    });
    const a = mesh(geometry, material, name,
      plane === 'yz' ? x - depth / 2 : x, y,
      plane === 'yz' ? z : z - depth / 2, physical);
    if (plane === 'yz') a.rotation.y = Math.PI / 2;
    return a;
  }
  function floorRing(name, x, z, radius, material) {
    const ring = mesh(new THREE.RingGeometry(radius - .035, radius + .035, 32),
      material, name, x, .028, z);
    ring.rotation.x = -Math.PI / 2;
    return ring;
  }
  function wallX(x, z0, z1, height = 5.6, material = cream) {
    const mid = (z0 + z1) / 2;
    box('palace-wall-x', x, height / 2, mid, .5, height, z1 - z0,
      material, { physical: true, solid: true, kind: 'house' });
    box('wall-crown', x, height - .15, mid, .72, .16, z1 - z0, gold);
    box('wall-plinth', x, .35, mid, .72, .23, z1 - z0, stone);
  }
  function wallZ(z, x0, x1, height = 5.6, material = cream) {
    const mid = (x0 + x1) / 2;
    box('palace-wall-z', mid, height / 2, z, x1 - x0, height, .5,
      material, { physical: true, solid: true, kind: 'house' });
    box('wall-crown', mid, height - .15, z, x1 - x0, .16, .72, gold);
    box('wall-plinth', mid, .35, z, x1 - x0, .23, .72, stone);
  }

  // One unbroken walkable slab gives both teams a valid navigation surface.
  box('marble-floor', 0, -.18, 0, HW * 2, .36, HL * 2, marble,
    { physical: true, solid: true, walkable: true, kind: 'deck' });
  for (const x of [-HW, HW]) wallX(x, -HL, HL, 7.2);
  for (const z of [-HL, HL]) wallZ(z, -HW, HW, 7.2);

  // Three equally legible lanes: the throne hall and two flanking galleries.
  // The ±12 and 0 openings connect each flank back to the centre.
  for (const x of [-9.2, 9.2]) {
    for (const [a, b] of [[-19,-14],[-10,-2],[2,10],[14,19]]) wallX(x, a, b, 2.55);
  }
  for (const z of [-19, 19]) {
    for (const [a, b] of [[-19.5,-15.7],[-11.3,-4.2],[4.2,11.3],[15.7,19.5]])
      wallZ(z, a, b, 4.6);
  }

  // High lintels remain above the upper-gallery headroom at the bridge and
  // stairs; a low lintel here silently cuts the two upper routes apart.
  for (const x of [-9.2, 9.2]) for (const z of [-12, 0, 12]) {
    // At z=0 the cross-gallery itself roofs the lower doorway. A second high
    // beam here would fill the upper player's sightline across the hall.
    if (z !== 0) {
      box('portal-lintel', x, 5.95, z, .55, .8, 4.05, pale,
        { physical: true, solid: true });
      box('portal-gold-crown', x, 6.41, z, .67, .14, 4.22, gold);
      for (const face of [-1, 1]) {
        box('portal-carved-frieze', x + face * .31, 5.94, z,
          .035, .075, 3.66, gold);
        for (const dz of [-1.23, 0, 1.23])
          cylinder('portal-frieze-rosette', x + face * .34, 5.94,
            z + dz, .11, .045, goldBright, 10).rotation.z = Math.PI / 2;
      }
    }
    for (const edge of [-1, 1])
      box('portal-jamb', x, 1.26, z + edge * 2.07, .72, 2.52, .18, gold);
    // Keep the segmental arch entirely below the suspended gallery. A tall
    // arch here would visually pierce its walkable floor at z=0.
    arch('portal-stone-arch', x, 2.50, z,
      1.86, .25, stone, .10, 'yz', .61, true);
    arch('portal-inner-fillet', x, 2.46, z,
      1.67, .22, gold, .024, 'yz', .65);
    box('portal-keystone', x, 2.79, z, .70, .13, .22, goldBright);
  }
  for (const z of [-19, 19]) {
    box('grand-portal-lintel', 0, 4.96, z, 8.4, .62, .6, pale,
      { physical: true, solid: true });
    box('grand-portal-crown', 0, 5.34, z, 8.7, .14, .75, gold);
    for (const x of [-4.18, 4.18]) {
      cylinder('grand-portal-pillar', x, 2.28, z, .33, 4.56, stone, 12);
      cylinder('grand-portal-capital', x, 4.5, z, .48, .2, gold, 12);
    }
    arch('grand-portal-arch', 0, 3.18, z,
      3.88, 1.46, stone, .18, 'xy', .78, true);
    box('grand-portal-keystone', 0, 4.77, z, .46, .40, .8, goldBright);
  }

  // Recessed blue glass and wine-red heraldry make the long walls legible.
  // These sit directly on solid wall and never form invisible cover.
  for (const side of [-1, 1]) {
    for (const z of [-23, -12, 0, 12, 23]) {
      const x = side * 19.16;
      box('window-dark-recess', x, 3.35, z, .09, 3.95, 2.38, dark);
      box('window-glass', x - side * .055, 3.35, z, .06, 3.62, 2.12, glass);
      box('window-center-mullion', x - side * .095, 3.35, z, .08, 3.8, .11, gold);
      for (const dz of [-1.16, 1.16])
        box('window-gold-frame', x - side * .10, 3.35, z + dz, .1, 4.04, .11, gold);
      for (const y of [1.36, 5.33])
        box('window-gold-sill', x - side * .10, y, z, .1, .14, 2.45, gold);
      box('window-crossbar', x - side * .10, 3.55, z, .1, .1, 2.4, gold);
      arch('window-arch', x - side * .12, 5.20, z,
        1.12, .38, gold, .065, 'yz');
    }
    for (const z of [-16.5, -6, 6, 16.5]) {
      const x = side * 8.9;
      box('heraldic-panel', x, 1.58, z, .10, 2.02, 2.36, burgundy);
      for (const dz of [-1.22, 1.22])
        box('panel-gold-side', x - side * .065, 1.58, z + dz, .09, 2.18, .11, gold);
      for (const y of [.53, 2.63])
        box('panel-gold-end', x - side * .065, y, z, .09, .12, 2.5, gold);
      cylinder('heraldic-medallion', x - side * .14, 1.6, z, .42, .085,
        goldBright, 12).rotation.z = Math.PI / 2;
      for (const dz of [-.57, .57])
        box('heraldic-chevron', x - side * .19, 1.6, z + dz,
          .09, .13, .44, gold);
    }
    for (const z of [-17.5, 17.5]) {
      const outline = new THREE.Shape();
      outline.moveTo(-.72, 0); outline.lineTo(.72, 0);
      outline.lineTo(.72, -2.28); outline.lineTo(0, -2.77);
      outline.lineTo(-.72, -2.28); outline.closePath();
      const cloth = mesh(new THREE.ShapeGeometry(outline), banner,
        'crimson-royal-banner', side * 18.97, 5.65, z);
      cloth.rotation.y = side * Math.PI / 2;
      cylinder('banner-rod', side * 18.94, 5.72, z,
        .045, 1.65, gold, 8).rotation.x = Math.PI / 2;
      const crest = mesh(new THREE.CircleGeometry(.25, 16), goldBright,
        'banner-crest', side * 18.92, 4.30, z);
      crest.rotation.y = side * Math.PI / 2;
    }
    for (const z of [-6, 6]) {
      const x = side * 19.01;
      box('sconce-backplate', x, 3.60, z, .10, .58, .32, dark);
      box('sconce-bracket', x - side * .20, 3.50, z, .42, .07, .07, gold);
      cylinder('sconce-bowl', x - side * .37, 3.62, z, .18, .11, gold, 12);
      mesh(new THREE.SphereGeometry(.105, 8, 6), lamp,
        'sconce-flame', x - side * .37, 3.76, z);
    }
  }

  // Upper galleries are reachable from four 0.32 m steps-per-rise flights.
  // The thin suspended floor leaves the lower routes physically open.
  for (const side of [-1, 1]) {
    const gx = side * 11.5;
    box('upper-gallery', gx, UPPER - .14, 0, 7.2, .28, 22.4, pale,
      { physical: true, solid: true, walkable: true, kind: 'bridge' });
    box('gallery-wood-soffit', gx, UPPER - .305, 0, 6.96, .022, 22.12, dark);
    for (const z of [-9, -4.5, 0, 4.5, 9])
      box('gallery-soffit-rib', gx, UPPER - .326, z, 6.98, .035, .085, gold);
    box('gallery-gold-edge', side * 7.85, UPPER + .04, 0, .16, .16, 22.4, gold);
    for (const zEnd of [-1, 1]) {
      for (let i = 1; i <= 10; i++) {
        const top = UPPER * i / 10;
        const z = zEnd * (17.6 - (i - .5) * .7);
        box('gallery-stair', side * 13.7, top - .12, z, 2.7, .24, .7, stone,
          { physical: true, solid: true, walkable: true });
        box('stair-nosing', side * 13.7, top + .018, z - zEnd * .29,
          2.7, .035, .055, gold);
      }
      topdown.push({ x: side * 13.7, z: zEnd * 14.1,
        hx: 1.35, hz: 3.5, kind: 'stairs' });
    }
    // Knee-height open balustrade: players can shoot into the central hall.
    for (const z of [-6.35, 6.35])
      box('gallery-balustrade', side * 7.83, UPPER + .49, z, .16, .98, 9.7, gold,
        { physical: true, solid: true });
    for (let z = -9; z <= 9; z += 3) {
      if (z === 0) continue;
      cylinder('baluster', side * 7.83, UPPER + .55, z, .10, .82, pale, 10);
      cylinder('baluster-cap', side * 7.83, UPPER + 1.02, z, .18, .14, gold, 10);
    }
  }
  box('cross-gallery', 0, UPPER - .14, 0, 16.2, .28, 2.5, pale,
    { physical: true, solid: true, walkable: true, kind: 'bridge' });
  box('bridge-wood-soffit', 0, UPPER - .305, 0, 15.98, .022, 2.30, dark);
  for (const x of [-6,-3,0,3,6])
    box('bridge-soffit-rib', x, UPPER - .327, 0, .085, .035, 2.34, gold);
  for (const z of [-1.22, 1.22]) {
    box('bridge-rail', 0, UPPER + .48, z, 15.9, .95, .14, gold,
      { physical: true, solid: true });
  }

  // Thick marble columns with actual collision, alternating gold collars and
  // fluting. Two raised cover pieces interrupt the otherwise long sight line.
  for (const x of [-5.6, 5.6]) for (const z of [-8, 8]) {
    cylinder('column', x, 2.65, z, .53, 5.3, pale, 16, true);
    colliders.push({ x, z, hx: .53, hz: .53, y0: 0, h: 5.3, walkable: false });
    topdown.push({ x, z, hx: .55, hz: .55, kind: 'container' });
    for (const y of [.2, 4.96, 5.23])
      cylinder('column-capital', x, y, z, .77, .18, gold, 16);
    for (let a = 0; a < 8; a++) {
      const angle = a * Math.PI / 4;
      cylinder('column-flute', x + .52 * Math.cos(angle), 2.65,
        z + .52 * Math.sin(angle), .045, 4.5, stone, 6);
    }
  }
  for (const z of [-13, 13]) {
    box('royal-dais', 0, .41, z, 4.8, .82, 2.5, wood,
      { physical: true, solid: true, kind: 'crate' });
    box('dais-carpet', 0, .84, z, 4.4, .05, 2.2, red);
    for (const x of [-1.75, 0, 1.75]) {
      box('dais-carved-panel', x, .40, z + Math.sign(z) * 1.275,
        1.38, .58, .035, dark);
      box('dais-panel-top', x, .72, z + Math.sign(z) * 1.30,
        1.42, .035, .04, gold);
    }
    box('throne-seat', 0, 1.35, z, 1.5, .7, .8, gold,
      { physical: true, solid: true });
    box('throne-cushion', 0, 1.75, z, 1.34, .13, .68, red);
    const backZ = z - Math.sign(z) * .35;
    const back = new THREE.Shape();
    back.moveTo(-.80, 1.02); back.lineTo(.80, 1.02);
    back.lineTo(.91, 2.76);
    back.quadraticCurveTo(.63, 3.35, 0, 3.48);
    back.quadraticCurveTo(-.63, 3.35, -.91, 2.76);
    back.closePath();
    mesh(new THREE.ExtrudeGeometry(back, {
      depth: .22, bevelEnabled: true, bevelThickness: .045,
      bevelSize: .045, bevelSegments: 2, curveSegments: 8,
    }), red, 'throne-shaped-back', 0, 0, backZ - .11, true);
    colliders.push({ x: 0, z: backZ, hx: .92, hz: .18,
      y0: 1.02, h: 3.48, walkable: false });
    arch('throne-arched-crown', 0, 2.77,
      backZ + Math.sign(z) * .20, .94, .75, goldBright, .095);
    box('throne-crown-keystone', 0, 3.53,
      backZ + Math.sign(z) * .21, .22, .25, .12, goldBright);
    for (const x of [-.95, .95]) {
      cylinder('throne-post', x, 2.12, backZ, .12, 2.18, gold, 10);
      cylinder('throne-finial', x, 3.29, backZ, .2, .2, goldBright, 10);
      box('throne-arm', x, 1.55, z + Math.sign(z) * .22,
        .26, .19, 1.08, gold);
    }
    cylinder('throne-crest', 0, 2.43, backZ + Math.sign(z) * .23,
      .3, .11, goldBright, 16).rotation.x = Math.PI / 2;
  }
  box('ceremonial-carpet', 0, .018, 0, 2.5, .035, 22, red);
  for (const x of [-1.3, 1.3]) box('carpet-braid', x, .04, 0, .08, .04, 22, gold);
  for (const z of [-22.5, 22.5]) {
    floorRing('entrance-floor-medallion', 0, z, 1.04, gold);
    floorRing('entrance-medallion-inner', 0, z, .46, goldBright);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const ray = box('medallion-ray', .75 * Math.sin(a), .032,
        z + .75 * Math.cos(a), .055, .012, .58, gold);
      ray.rotation.y = a;
    }
  }

  // The basin's lathed lip and recessed water read as a fountain at player
  // height. Its existing low collision footprint remains the movement proxy.
  const basinProfile = [
    [0,0],[1.68,0],[1.82,.12],[1.96,.42],[2.04,.89],
    [2.02,1.12],[1.89,1.25],[1.73,1.25],[1.69,1.10],[1.70,.93],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  mesh(new THREE.LatheGeometry(basinProfile, 32), stone,
    'fountain-carved-basin', 0, 0, 0, true);
  colliders.push({ x: 0, z: 0, hx: 1.9, hz: 1.9, y0: 0, h: 1.2,
    walkable: false });
  topdown.push({ x: 0, z: 0, hx: 1.9, hz: 1.9, kind: 'crate' });
  mesh(new THREE.TorusGeometry(1.84, .075, 8, 32), gold,
    'fountain-brass-rim', 0, 1.23, 0).rotation.x = Math.PI / 2;
  for (const [radius, height] of [[1.76, .15], [1.92, .57], [2.02, 1.02]])
    mesh(new THREE.TorusGeometry(radius, .038, 6, 32), pale,
      'fountain-carved-band', 0, height, 0).rotation.x = Math.PI / 2;
  cylinder('fountain-water', 0, 1.115, 0, 1.7, .026, water, 32);
  for (const radius of [.83, 1.30])
    mesh(new THREE.TorusGeometry(radius, .012, 4, 32), goldBright,
      'fountain-water-ripple', 0, 1.137, 0).rotation.x = Math.PI / 2;
  cylinder('fountain-center-column', 0, 1.42, 0, .21, .56, pale, 16, true);
  cylinder('fountain-upper-dish', 0, 1.71, 0, .64, .13, stone, 24, true);
  mesh(new THREE.TorusGeometry(.61, .055, 7, 24), gold,
    'fountain-upper-rim', 0, 1.79, 0).rotation.x = Math.PI / 2;
  cylinder('fountain-upper-water', 0, 1.79, 0, .52, .018, water, 24);

  // Side-corridor cover, spaced away from the stair feet and door apertures.
  for (const x of [-16.4, 16.4]) for (const z of [-6.5, 6.5]) {
    box('marble-planter', x, .54, z, 1.7, 1.08, 2.0, stone,
      { physical: true, solid: true, kind: 'crate' });
    box('planter-gold-lip', x, 1.1, z, 1.9, .12, 2.2, gold);
  }
  // Rotationally symmetric offset cover gives both spawn sides a short move
  // from the centre lane without turning the two side corridors into mazes.
  for (const [x, z] of [[-3.55, -6.8], [3.55, 6.8]]) {
    box('marble-cover-plinth', x, .51, z, 1.45, 1.02, 1.55, stone,
      { physical: true, solid: true, kind: 'crate' });
    box('cover-plinth-cap', x, 1.04, z, 1.58, .11, 1.69, gold);
    box('cover-plinth-inset', x, .55, z + Math.sign(z) * .795,
      1.07, .60, .027, pale);
  }

  // The ceiling reads as a coffered royal hall. It does not cast a huge dark
  // shadow across the scene: chandeliers and existing daylight stay usable.
  const roof = box('vaulted-ceiling', 0, 7.34, 0, 39, .38, 58, dark,
    { physical: true, solid: true });
  roof.castShadow = false;
  for (const x of [-15,-9,-3,3,9,15])
    box('ceiling-gold-rib', x, 7.07, 0, .18, .13, 56, gold);
  for (const z of [-24,-16,-8,0,8,16,24])
    box('ceiling-cross-rib', 0, 7.07, z, 37, .13, .18, gold);
  for (const x of [-12,-6,0,6,12]) for (const z of [-20,-12,-4,4,12,20]) {
    box('ceiling-coffer-inset', x, 7.119, z, 5.58, .022, 7.58, wood);
    const rosette = mesh(new THREE.RingGeometry(.34, .41, 20), gold,
      'coffer-rosette', x, 7.096, z);
    rosette.rotation.x = Math.PI / 2;
  }
  for (const z of [-16, 0, 16]) {
    const light = new THREE.PointLight(0xffdb9b, 50, 13, 2);
    light.position.set(0, 5.45, z); group.add(light);
  }
  const windowFill = new THREE.DirectionalLight(0xb7d1df, .34);
  windowFill.position.set(-18, 5, 7);
  group.add(windowFill);

  // Kenney's CC0 castle pieces are used as façade accents; the gameplay
  // masonry stays authored above so bullets and bodies cannot hit air.
  const gltf = makeGLTFLoader();
  const accentCache = new Map();
  async function accent(file, name, targetWidth, x, y, z, yaw = 0, folder = 'kenney') {
    try {
      const url = ROOT + folder + '/' + file;
      if (!accentCache.has(url)) accentCache.set(url, gltf.loadAsync(url));
      const model = (await accentCache.get(url)).scene.clone(true);
      const initial = new THREE.Box3().setFromObject(model);
      const width = Math.max(.01, initial.max.x - initial.min.x);
      model.scale.setScalar(targetWidth / width);
      model.rotation.y = yaw;
      model.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(model);
      model.position.set(x - (b.min.x + b.max.x) / 2,
        y - b.min.y, z - (b.min.z + b.max.z) / 2);
      model.name = name;
      if (folder === 'frame') model.traverse((o) => {
        if (o.isMesh) o.material.side = THREE.DoubleSide;
      });
      group.add(model);
    } catch (error) { console.warn('宫殿装饰加载失败：', file, error); }
  }
  await Promise.all([
    ...[-16,0,16].map(z =>
      accent('Chandelier_03_1k.gltf', 'brass-crystal-chandelier', 2.35,
        0, 4.5, z, 0, 'chandelier')),
    accent('tower-square-arch.glb', 'castle-arch-north', 4.5, 0, 0, -28.3),
    accent('tower-square-arch.glb', 'castle-arch-south', 4.5, 0, 0, 28.3, Math.PI),
    ...[-1,1].flatMap(side => [-1,1].map(end =>
      accent('gate.glb', 'side-castle-gate', 2.4,
        side * 14.1, 0, end * 28.36, end > 0 ? Math.PI : 0))),
    ...[-1,1].flatMap(side => [-1,1].map(end =>
      accent('fancy_picture_frame_01_1k.gltf', 'gilded-oil-painting', 1.5,
        side * 18.92, 1.75, end * 6, side * Math.PI / 2, 'frame'))),
  ]);
  onProgress(.9);

  // Keep structure and trim in separate batches: only the former blocks shots.
  batchStatic(group, architecture, {
    onReplace(oldMeshes, newMeshes) {
      for (const old of oldMeshes) {
        const i = obstacles.indexOf(old);
        if (i >= 0) obstacles.splice(i, 1);
      }
      obstacles.push(...newMeshes);
    },
    receiveShadow: true,
  });
  batchStatic(group, ornament, { receiveShadow: true });
  onProgress(1);
  group.visible = false;
  return {
    name: '王宫回廊', source: 'royal-palace', visuals: [group],
    background: new THREE.Color(0x201b20), colliders, obstacles,
    topdown, bounds: { hw: HW - .55, hl: HL - .55 },
    spawns: {
      player: [[0,0,24],[-5,0,24],[5,0,24]],
      enemy: [[0,0,-24],[-5,0,-24],[5,0,-24]],
    },
    floorY: 0,
    navigationMaxHeight: UPPER + .1,
  };
}
