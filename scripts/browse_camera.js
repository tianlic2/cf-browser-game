import * as THREE from 'three';

// Keep a camera boom inside the same room as its pivot. Cache world-space
// bounds once per map; raycast only the geometry the short boom can touch.
export class BrowseCamera {
  constructor() {
    this.ray = new THREE.Raycaster();
    this.pivot = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.end = new THREE.Vector3();
    this.test = new THREE.Vector3();
    this.box = new THREE.Box3();
    this.hits = [];
    this.maps = new WeakMap();
  }

  reset(map, obstacles) {
    if (!this.maps.has(map)) {
      const entries = [];
      for (const mesh of obstacles) {
        mesh.updateWorldMatrix(true, false);
        mesh.geometry.computeBoundingBox();
        const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
        entries.push({ mesh, bounds });
      }
      this.maps.set(map, entries);
    }
    this.map = map;
    this.entries = this.maps.get(map);
    this.distance = 0;
  }

  clearDistance(length) {
    this.end.copy(this.pivot).addScaledVector(this.direction, length);
    if (this.map.lineClear) {
      if (this.map.lineClear(this.pivot, this.end, 0)) return length;
      let lo = 0, hi = length;
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        this.test.copy(this.pivot).addScaledVector(this.direction, mid);
        if (this.map.lineClear(this.pivot, this.test, 0)) lo = mid;
        else hi = mid;
      }
      return Math.max(.045, lo - .18);
    }
    this.box.makeEmpty().expandByPoint(this.pivot).expandByPoint(this.end);
    this.ray.set(this.pivot, this.direction);
    this.ray.far = length;
    let clear = length;
    for (const {mesh, bounds} of this.entries) {
      if (!this.box.intersectsBox(bounds)) continue;
      this.hits.length = 0;
      this.ray.intersectObject(mesh, false, this.hits);
      if (this.hits.length) {
        this.ray.far = this.hits[0].distance;
        clear = Math.max(.045, this.ray.far - .18);
      }
    }
    return clear;
  }

  update(dt, camera, player, visitor) {
    const air = visitor.air;
    const pitch = THREE.MathUtils.clamp(player.pitch - .10, -1.20, 1.05);
    this.direction.set(Math.sin(player.yaw) * Math.cos(pitch), -Math.sin(pitch),
      Math.cos(player.yaw) * Math.cos(pitch));
    this.pivot.copy(player.pos);
    this.pivot.y += 1.16 + player.stepLift + air * .18;
    const clear = this.clearDistance(3.85 + visitor.cruise * .9);
    const outward = this.distance + (clear - this.distance) * (1 - Math.exp(-dt * 6));
    this.distance = this.distance ? Math.min(clear, outward) : clear;
    camera.position.copy(this.pivot).addScaledVector(this.direction, this.distance);
    camera.rotation.set(pitch, player.yaw, 0, 'YXZ');
    camera.rotateY(-.105 * Math.min(1, this.distance / 2));
    camera.fov = 55 + visitor.cruise * 5;
    // In a passage narrower than a shoulder the camera can approach the head.
    // Hide only the body until there is room behind it again.
    visitor.hinge.visible = this.distance > .46;
  }
}
