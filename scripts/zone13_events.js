import * as THREE from 'three';

const EVENT_TEXTURE = new URL('../assets/local/cf_bio_candidates/zone13/runtime-extras/events/infected.png', import.meta.url);

function marker(markers, name, fallback) {
  return markers.find((entry) => entry.name === name)?.position || fallback;
}

export function createZone13EventDirector(root, colliders, obstacles, worldData, supplyTexture) {
  const group = new THREE.Group();
  group.name = 'zone13-source-events';
  root.add(group);

  const busLights = new THREE.Group();
  busLights.name = 'zone13-event-bus-lights';
  const lampMaterial = new THREE.MeshBasicMaterial({ color: 0xffe28a, toneMapped: false, side: THREE.DoubleSide });
  const lampGeometry = new THREE.CircleGeometry(.18, 12);
  for (const bus of worldData.staticProps.filter((item) => /zone13\/bus\.mdl/i.test(item.model))) {
    const angle = THREE.MathUtils.degToRad(-bus.angles[1]);
    const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const side = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
    for (const sign of [-1, 1]) {
      const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
      lamp.position.set(bus.position[0], bus.position[1] + .72, bus.position[2])
        .addScaledVector(forward, 7.8).addScaledVector(side, sign * 1.3);
      lamp.rotation.y = angle;
      busLights.add(lamp);
    }
  }
  busLights.visible = false;
  group.add(busLights);

  const impactPosition = marker(worldData.markers, 'hac', [-75.8, 33.4, -47]);
  const crateMaterial = new THREE.MeshStandardMaterial({ map: supplyTexture, color: 0xb5b8ad, roughness: .72, metalness: .22 });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.4, 2.8), crateMaterial);
  crate.name = 'zone13-event-drop-container';
  crate.position.set(impactPosition[0], impactPosition[1] + 9, impactPosition[2]);
  crate.visible = false; crate.castShadow = crate.receiveShadow = true;
  group.add(crate);
  obstacles.push(crate);
  const crateCollider = { x: impactPosition[0], z: impactPosition[2], hx: 1.4, hz: 1.4,
    y0: impactPosition[1], h: impactPosition[1] + 2.4, walkable: false, model: 'zone13-event-drop-container' };
  let crateColliderInstalled = false;

  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xd4ba80, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.35, 1.6, 28), ringMaterial);
  ring.name = 'zone13-event-impact-ring';
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(impactPosition[0], impactPosition[1] + .04, impactPosition[2]);
  ring.visible = false; group.add(ring);

  const laserPosition = marker(worldData.markers, 'hurt4', [37.3, 13.6, -62]);
  const laser = new THREE.Mesh(new THREE.BoxGeometry(1.8, .055, .055),
    new THREE.MeshBasicMaterial({ color: 0xff2719, transparent: true, opacity: .9, toneMapped: false }));
  laser.name = 'zone13-event-punish-laser';
  laser.position.fromArray(laserPosition); laser.visible = false; group.add(laser);

  const cameoPosition = marker(worldData.markers, 'hp', [-69.1, 32.3, -28.6]);
  const cameoMaterial = new THREE.MeshBasicMaterial({ color: 0x77ddff, transparent: true, opacity: 0,
    depthWrite: false, toneMapped: false });
  if (typeof document !== 'undefined') {
    new THREE.TextureLoader().load(EVENT_TEXTURE.href, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(.25, .25);
      cameoMaterial.map = texture;
      cameoMaterial.needsUpdate = true;
    });
  }
  const cameo = new THREE.Group();
  cameo.name = 'zone13-event-hp-cameo'; cameo.position.fromArray(cameoPosition);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 8), cameoMaterial);
  head.position.y = 1.55; cameo.add(head);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.36, .72, 4, 8), cameoMaterial);
  torso.position.y = .78; cameo.add(torso);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .65, 3, 6), cameoMaterial);
    arm.position.set(side * .44, .88, 0); arm.rotation.z = side * -.28; cameo.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .78, 3, 6), cameoMaterial);
    leg.position.set(side * .18, -.1, 0); leg.rotation.z = side * -.08; cameo.add(leg);
  }
  cameo.visible = false; group.add(cameo);

  let previous = 0;
  let fired = new Set();
  let ringT = 0;
  let sound = null;
  const log = [];
  const record = (name, at) => { if (!fired.has(name)) { fired.add(name); log.push({ name, at }); return true; } return false; };
  const play = (kind, position = impactPosition) => sound?.bio(kind, position[0], position[1], position[2]);
  const trigger = (name, at = previous) => {
    if (!record(name, at)) return false;
    if (name === 'hoho') play('hoho', cameoPosition);
    if (name === 'drop') play('drop', impactPosition);
    if (name === 'bus') { busLights.visible = true; play('carstart', worldData.staticProps.find((x) => /bus\.mdl/i.test(x.model))?.position); }
    if (name === 'busoff') play('shutdown', worldData.staticProps.find((x) => /bus\.mdl/i.test(x.model))?.position);
    if (name === 'laser') { laser.visible = true; play('laser', laserPosition); }
    if (name === 'container') { crate.visible = true; play('container', impactPosition); }
    if (name === 'drop4') play('drop4', impactPosition);
    if (name === 'cameo') { cameo.visible = true; cameoMaterial.opacity = 1; play('hoho', cameoPosition); }
    return true;
  };

  const reset = (nextSound = null) => {
    sound = nextSound; previous = 0; fired = new Set(); log.length = 0; ringT = 0;
    busLights.visible = laser.visible = cameo.visible = crate.visible = ring.visible = false;
    cameoMaterial.opacity = 0; ringMaterial.opacity = 0;
    crate.position.set(impactPosition[0], impactPosition[1] + 9, impactPosition[2]);
    if (crateColliderInstalled) {
      const index = colliders.indexOf(crateCollider);
      if (index >= 0) colliders.splice(index, 1);
      crateColliderInstalled = false;
    }
  };

  const update = (elapsed, nextSound = sound) => {
    sound = nextSound || sound;
    if (!Number.isFinite(elapsed) || elapsed < previous) reset(sound);
    const cross = (at, name) => { if (previous < at && elapsed >= at) trigger(name, at); };
    cross(10, 'hoho'); cross(20, 'drop'); cross(30, 'bus'); cross(45, 'busoff'); cross(60, 'laser');
    cross(90, 'container'); cross(130, 'drop4'); cross(155, 'cameo');
    busLights.visible = fired.has('bus') && elapsed < 45;
    laser.visible = fired.has('laser') && elapsed < 60.55;
    if (fired.has('container')) {
      const t = THREE.MathUtils.clamp((elapsed - 90) / 1.5, 0, 1);
      const eased = t * t * (3 - 2 * t);
      crate.position.y = impactPosition[1] + 9 * (1 - eased) + 1.2;
      if (t >= 1 && !crateColliderInstalled) {
        colliders.push(crateCollider); crateColliderInstalled = true; ringT = .8; ring.visible = true;
      }
    }
    if (ringT > 0) {
      ringT = Math.max(0, ringT - Math.max(0, elapsed - previous));
      const age = 1 - ringT / .8; ring.scale.setScalar(1 + age * 2.2); ringMaterial.opacity = ringT / .8 * .68;
      ring.visible = ringT > 0;
    }
    cameo.visible = fired.has('cameo') && elapsed < 175;
    cameoMaterial.opacity = cameo.visible ? Math.min(1, (elapsed - 155) * 2, (175 - elapsed) * 2) : 0;
    previous = elapsed;
  };

  reset();
  return { group, reset, update, trigger, state: () => ({ elapsed: previous,
    fired: [...fired], busLights: busLights.visible, laser: laser.visible,
    containerVisible: crate.visible, containerLanded: crateColliderInstalled,
    cameo: cameo.visible, colliderCount: crateColliderInstalled ? 1 : 0, log: log.slice() }) };
}
