import * as THREE from 'three';

const TRAIL_LIFE = .46;
const TRAIL_LIMIT = 12;
const TRAIL_SEGMENTS = 384;
const TRAIL_COLORS = Object.freeze({
  frag: [1, .68, .3], flash: [.73, .89, 1], smoke: [.72, .86, .79],
});

function radialTexture(stops, seed = 1, roughness = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(128, 128);
  let value = seed;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    value = (Math.imul(value, 1664525) + 1013904223) | 0;
    const noise = ((value >>> 16) & 255) / 255;
    const dx = (x - 63.5) / 63.5, dy = (y - 63.5) / 63.5;
    const angle = Math.atan2(dy, dx);
    const edge = roughness * (.11 * Math.sin(angle * 7 + 1.1) +
      .07 * Math.sin(angle * 13 - 1.6) + .045 * Math.sin(angle * 19 + .4));
    const radius = Math.hypot(dx, dy) * (1 + edge + (noise - .5) * .08);
    let a = 0;
    for (let i = 1; i < stops.length; i++) if (radius <= stops[i][0]) {
      const t = (radius - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      a = stops[i - 1][1] * (1 - t) + stops[i][1] * t;
      break;
    }
    const offset = (y * 128 + x) * 4;
    image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = 255;
    image.data[offset + 3] = Math.round(255 * Math.max(0, a) * (.84 + .16 * noise));
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const _axis = new THREE.Vector3();
const _toCamera = new THREE.Vector3();
const _side = new THREE.Vector3();
const _ribbonOrder = [0, 1, 2, 2, 1, 3];

export class GrenadeVfx {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.time = 0;
    this.trails = [];
    this.blasts = [];
    this.trailPosition = new Float32Array(TRAIL_SEGMENTS * 12 * 3);
    this.trailTint = new Float32Array(TRAIL_SEGMENTS * 12 * 4);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.trailPosition, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aTint', new THREE.BufferAttribute(this.trailTint, 4).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute vec4 aTint; varying vec4 vTint; void main(){vTint=aTint;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec4 vTint; void main(){gl_FragColor=vTint;}',
    });
    this.trailMesh = new THREE.Mesh(geometry, material);
    this.trailMesh.frustumCulled = false;
    scene.add(this.trailMesh);

    this.glowTexture = radialTexture([[0, 1], [.16, .95], [.43, .42], [1, 0]], 17);
    this.fireTexture = radialTexture([[0, .85], [.16, .92], [.48, .72], [.76, .28], [1, 0]], 39, 1);
    this.cloudTexture = radialTexture([[0, .72], [.35, .72], [.7, .28], [1, 0]], 71, .7);
    for (let i = 0; i < 4; i++) this.blasts.push(this.makeBlast());
  }

  makeBlast() {
    const group = new THREE.Group();
    const sprite = (texture, color, blending) => {
      const item = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture, color, transparent: true, opacity: 0,
        blending, depthWrite: false, depthTest: true,
      }));
      group.add(item);
      return item;
    };
    const core = sprite(this.glowTexture, 0xfff5cf, THREE.AdditiveBlending);
    const fire = Array.from({ length: 5 }, (_, i) => sprite(this.fireTexture,
      [0xffb24a, 0xff6a1a, 0xff8d2a, 0xff4a13, 0xff9b3b][i], THREE.NormalBlending));
    const smoke = Array.from({ length: 6 }, () => sprite(this.cloudTexture,
      0x393c3d, THREE.NormalBlending));
    const sparksGeometry = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(18 * 2 * 3);
    sparksGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
    const sparks = new THREE.LineSegments(sparksGeometry, new THREE.LineBasicMaterial({
      color: 0xffd080, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
    }));
    group.add(sparks);
    group.visible = false;
    this.scene.add(group);
    return { group, core, fire, smoke, sparks, sparkPositions, t: Infinity, life: 1.08 };
  }

  track(grenade) {
    if (this.trails.length >= TRAIL_LIMIT) this.trails.shift();
    this.trails.push({ grenade, kind: grenade.kind, points: [] });
  }

  sample(grenade) {
    const trail = this.trails.find(item => item.grenade === grenade);
    if (!trail) return;
    // The first hand-side metres are behind the viewmodel; drawing them as a
    // world ribbon creates a giant foreground wedge when the grenade leaves.
    if (!trail.points.length) {
      if (grenade.mesh.position.distanceTo(this.camera.position) < 1.4) return;
      trail.points.push({ position: grenade.mesh.position.clone(), time: this.time });
      return;
    }
    const last = trail.points.at(-1).position;
    const next = grenade.mesh.position;
    const distance = last.distanceTo(next);
    if (distance < .012) return;
    const steps = Math.min(8, Math.max(1, Math.ceil(distance / .23)));
    for (let i = 1; i <= steps; i++) trail.points.push({
      position: last.clone().lerp(next, i / steps),
      time: this.time - (steps - i) * .008,
    });
    if (trail.points.length > 32) trail.points.splice(0, trail.points.length - 32);
  }

  finish(grenade) {
    const trail = this.trails.find(item => item.grenade === grenade);
    if (trail) trail.grenade = null;
  }

  explode(position) {
    const blast = this.blasts.find(item => item.t >= item.life) ||
      this.blasts.reduce((oldest, item) => item.t > oldest.t ? item : oldest);
    blast.group.position.copy(position);
    blast.group.visible = true;
    blast.t = 0;
    for (let i = 0; i < blast.fire.length; i++) {
      const angle = i * Math.PI * 2 / blast.fire.length;
      blast.fire[i].position.set(Math.cos(angle) * .53, .2 + (i % 3) * .32, Math.sin(angle) * .53);
    }
    for (let i = 0; i < blast.smoke.length; i++) {
      const angle = i * Math.PI * 2 / blast.smoke.length;
      blast.smoke[i].position.set(Math.cos(angle) * .24, .2 + (i % 3) * .12, Math.sin(angle) * .24);
    }
  }

  writeRibbon(a, b, color, width, alphaA, alphaB, vertex) {
    _axis.subVectors(b, a).normalize();
    _toCamera.subVectors(this.camera.position, a).normalize();
    _side.crossVectors(_axis, _toCamera).normalize();
    if (_side.lengthSq() < .01) _side.set(0, 1, 0);
    _side.multiplyScalar(width);
    for (let i = 0; i < 6; i++) {
      const corner = _ribbonOrder[i], p = corner < 2 ? a : b;
      const sign = corner === 0 || corner === 2 ? 1 : -1;
      const index = (vertex + i) * 3, tint = (vertex + i) * 4;
      this.trailPosition[index] = p.x + _side.x * sign;
      this.trailPosition[index + 1] = p.y + _side.y * sign;
      this.trailPosition[index + 2] = p.z + _side.z * sign;
      this.trailTint[tint] = color[0]; this.trailTint[tint + 1] = color[1];
      this.trailTint[tint + 2] = color[2]; this.trailTint[tint + 3] = corner < 2 ? alphaA : alphaB;
    }
  }

  update(dt) {
    this.time += dt;
    let vertex = 0;
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      while (trail.points.length && this.time - trail.points[0].time > TRAIL_LIFE) trail.points.shift();
      if (!trail.points.length) {
        if (!trail.grenade) this.trails.splice(i, 1);
        continue;
      }
      const color = TRAIL_COLORS[trail.kind] || TRAIL_COLORS.frag;
      for (let j = 1; j < trail.points.length && vertex + 12 <= this.trailPosition.length / 3; j++) {
        const a = trail.points[j - 1], b = trail.points[j];
        const alphaA = Math.max(0, 1 - (this.time - a.time) / TRAIL_LIFE);
        const alphaB = Math.max(0, 1 - (this.time - b.time) / TRAIL_LIFE);
        this.writeRibbon(a.position, b.position, color, .03, alphaA * .14, alphaB * .14, vertex);
        vertex += 6;
        this.writeRibbon(a.position, b.position, color, .009, alphaA * .66, alphaB * .66, vertex);
        vertex += 6;
      }
    }
    this.trailMesh.geometry.setDrawRange(0, vertex);
    if (vertex) {
      this.trailMesh.geometry.attributes.position.needsUpdate = true;
      this.trailMesh.geometry.attributes.aTint.needsUpdate = true;
    }
    for (const blast of this.blasts) {
      if (blast.t >= blast.life) continue;
      blast.t += dt;
      const t = blast.t;
      blast.core.position.y = .22;
      blast.core.scale.setScalar(.35 + 2.5 * Math.min(1, t / .12));
      blast.core.material.opacity = Math.max(0, 1 - t / .13) * .48;
      blast.core.visible = t < .13;
      for (let i = 0; i < blast.fire.length; i++) {
        const f = blast.fire[i];
        const phase = Math.max(0, 1 - t / (.42 + (i % 2) * .08));
        f.scale.setScalar((.55 + 2.65 * Math.min(1, t / .18)) * (i % 2 ? .85 : 1.08));
        f.position.y += dt * (1.5 + i * .12);
        f.material.opacity = phase * .9;
        f.visible = phase > 0;
      }
      for (let i = 0; i < blast.smoke.length; i++) {
        const s = blast.smoke[i], phase = Math.max(0, 1 - Math.max(0, t - .2) / .88);
        s.scale.setScalar(.85 + t * (3 + i * .15));
        s.position.y += dt * (.85 + (i % 3) * .2);
        s.material.opacity = Math.min(1, Math.max(0, t - .06) / .2) * phase * .5;
        s.visible = s.material.opacity > 0;
      }
      const positions = blast.sparkPositions;
      for (let i = 0; i < 18; i++) {
        const angle = i * 2.39996;
        const speed = 3.6 + i % 5 * .68;
        const radius = speed * t;
        const y = .3 + (i % 7) * .13 + (i % 4) * 1.8 * t - 3.5 * t * t;
        const tail = Math.max(0, radius - .16 * (1 - t));
        const o = i * 6;
        positions[o] = Math.cos(angle) * tail; positions[o + 1] = y - .04; positions[o + 2] = Math.sin(angle) * tail;
        positions[o + 3] = Math.cos(angle) * radius; positions[o + 4] = y; positions[o + 5] = Math.sin(angle) * radius;
      }
      blast.sparks.geometry.attributes.position.needsUpdate = true;
      blast.sparks.material.opacity = Math.max(0, 1 - t / .42);
      blast.sparks.visible = t < .42;
      if (t >= blast.life) blast.group.visible = false;
    }
  }

  clear() {
    this.trails.length = 0;
    this.trailMesh.geometry.setDrawRange(0, 0);
    for (const blast of this.blasts) { blast.t = Infinity; blast.group.visible = false; }
  }

  stats() {
    return { trails: this.trails.length, trailVertices: this.trailMesh.geometry.drawRange.count,
      blasts: this.blasts.filter(item => item.group.visible).length,
      blastPositions: this.blasts.filter(item => item.group.visible).map(item => item.group.position.toArray()) };
  }
}
