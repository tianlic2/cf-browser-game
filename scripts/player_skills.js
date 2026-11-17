import * as THREE from 'three';

export const PLAYER_SKILL_RULES = Object.freeze({
  flight: Object.freeze({ speed: 6, fastSpeed: 16, takeoffHeight: .35 }),
  cover: Object.freeze({ width: 2.4, height: 2.05, depth: .16, health: 800, life: 120,
    killRepair: 50 }),
  ultimate: Object.freeze({ size: 3.6, height: 3.1, depth: .16, faceHealth: 800, life: 120,
    dropHeight: 11, dropDuration: .45 }),
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mesh(geometry, material, name) {
  const out = new THREE.Mesh(geometry, material);
  out.name = name;
  return out;
}

let sharedEnergyGridTexture = null;
function energyGridTexture() {
  if (sharedEnergyGridTexture) return sharedEnergyGridTexture;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const r = 18, h = Math.sin(Math.PI / 3) * r;
  ctx.lineWidth = 1.25;
  for (let row = -1; row < 7; row++) for (let col = -1; col < 10; col++) {
    const cx = col * r * 1.5 + (row & 1 ? r * .75 : 0), cy = row * h * 2 + h;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = (row + col) % 3 ? 'rgba(24,170,215,.055)' : 'rgba(112,235,255,.11)';
    ctx.fill(); ctx.strokeStyle = 'rgba(125,238,255,.46)'; ctx.stroke();
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(220,252,255,.72)'); gradient.addColorStop(.1, 'rgba(76,222,255,.08)');
  gradient.addColorStop(.9, 'rgba(76,222,255,.05)'); gradient.addColorStop(1, 'rgba(196,249,255,.55)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  sharedEnergyGridTexture = texture;
  return sharedEnergyGridTexture;
}

export class PlayerSkillSystem {
  constructor(scene, hud) {
    this.scene = scene;
    this.hud = hud;
    this.flight = { active: false, takeoffRemaining: 0 };
    this.covers = [];
    this.cover = { active: false, count: 0, health: 0, life: 0, cooldown: 0, age: 0,
      center: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(1, 0, 0), group: null };
    this.coverPreview = { group: null, visible: false, valid: false, styleValid: null,
      position: new THREE.Vector3(), yaw: 0 };
    this.cages = [];
    this.cagePreview = { group: null, visible: false, valid: false, styleValid: null,
      position: new THREE.Vector3(), yaw: 0 };
    this._worldColliders = null;
    this.ultimate = { active: false, count: 0, cooldown: 0 };
    this._events = [];
    this.lastInterceptKind = null;
    this._syncHud();
  }

  _buildCover(preview = false) {
    const cover = { active: !preview, health: PLAYER_SKILL_RULES.cover.health,
      life: PLAYER_SKILL_RULES.cover.life, age: 0,
      center: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, -1),
      right: new THREE.Vector3(1, 0, 0), collider: null };
    const g = new THREE.Group();
    g.name = preview ? 'player-folding-cover-preview' : 'player-folding-energy-cover';
    const coverHeight = PLAYER_SKILL_RULES.cover.height;
    const coverWidth = PLAYER_SKILL_RULES.cover.width;
    const coverHalf = coverWidth / 2;
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x42dbef, map: energyGridTexture(), transparent: true,
      opacity: preview ? .16 : .3,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const panel = mesh(new THREE.PlaneGeometry(coverWidth - .12, coverHeight - .13, 12, 10), panelMat, 'energy-membrane');
    panel.position.y = coverHeight / 2;
    g.add(panel);
    const frameMat = new THREE.MeshStandardMaterial({ color: preview ? 0x42cfe8 : 0x102c38,
      metalness: preview ? .2 : .82, roughness: preview ? .5 : .23,
      emissive: preview ? 0x17677b : 0x052c39, emissiveIntensity: preview ? .7 : .82,
      transparent: preview, opacity: preview ? .38 : 1, depthWrite: !preview });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x78efff, transparent: true,
      opacity: preview ? .55 : .92, depthWrite: false });
    const addBar = (w, h, x, y) => {
      const bar = mesh(new THREE.BoxGeometry(w, h, .07), frameMat, 'folding-frame');
      bar.position.set(x, y, 0); g.add(bar);
    };
    addBar(.07, coverHeight, -coverHalf, coverHeight / 2); addBar(.07, coverHeight, coverHalf, coverHeight / 2);
    addBar(coverWidth + .07, .075, 0, .055); addBar(coverWidth + .07, .06, 0, coverHeight - .03);
    for (const side of [-1, 1]) {
      for (const y of [.3, coverHeight - .3]) {
        const brace = mesh(new THREE.BoxGeometry(.035, .46, .085), frameMat, 'folding-brace');
        brace.position.set(side * (coverHalf - .14), y, .015);
        brace.rotation.z = side * (y < coverHeight / 2 ? -.22 : .22); g.add(brace);
      }
      const foot = mesh(new THREE.CylinderGeometry(.13, .09, .18, 6), frameMat, 'shield-foot');
      foot.position.set(side * (coverHalf - .01), .09, .03); g.add(foot);
    }
    for (const x of [-coverHalf, coverHalf]) for (const y of [.09, coverHeight - .09]) {
      const core = mesh(new THREE.CylinderGeometry(.065, .085, .19, 10), glowMat, 'shield-emitter');
      core.rotation.z = Math.PI / 2; core.position.set(x, y, .02); g.add(core);
    }
    const hex = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i; const x = Math.cos(a) * .085, y = Math.sin(a) * .085;
      if (i) hex.lineTo(x, y); else hex.moveTo(x, y);
    }
    hex.closePath();
    const badge = mesh(new THREE.ShapeGeometry(hex), glowMat.clone(), 'shield-core');
    badge.position.set(0, coverHeight * .52, .012); g.add(badge);
    g.visible = !preview;
    this.scene.add(g);
    Object.assign(cover, { group: g, panel, panelMat, frameMat, glowMat, badge, badgeMat: badge.material });
    return cover;
  }

  _buildCage(preview = false) {
    const r = PLAYER_SKILL_RULES.ultimate;
    const cage = { active: !preview, landed: preview, life: r.life, age: 0,
      target: new THREE.Vector3(), fallTime: 0, faces: [], colliders: [] };
    const g = new THREE.Group();
    g.name = preview ? 'player-sky-cage-preview' : 'player-sky-iron-cage';
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x53dff2, map: energyGridTexture(),
      transparent: true, opacity: preview ? .105 : .2, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending });
    const frameMat = new THREE.MeshStandardMaterial({ color: preview ? 0x4bcfe4 : 0x202a2d,
      metalness: preview ? .3 : .92, roughness: preview ? .46 : .3,
      emissive: preview ? 0x17677b : 0x07191d, emissiveIntensity: preview ? .72 : .22,
      transparent: preview, opacity: preview ? .34 : 1, depthWrite: !preview });
    const half = r.size / 2;
    const dummy = new THREE.Object3D();
    const addBar = (instances, x, y, length, thickness = .075, angle = 0) => {
      dummy.position.set(x, y, .01); dummy.rotation.set(0, 0, angle);
      dummy.scale.set(thickness, length, r.depth * .62); dummy.updateMatrix();
      instances.push(dummy.matrix.clone());
    };
    const addFace = (name, position, rotation, roof = false) => {
      const faceGroup = new THREE.Group(); faceGroup.name = `sky-cage-${name}`;
      faceGroup.position.copy(position); faceGroup.rotation.copy(rotation); g.add(faceGroup);
      const panel = mesh(new THREE.PlaneGeometry(r.size - .16, (roof ? r.size : r.height) - .16),
        panelMat, `sky-cage-${name}-membrane`);
      if (!roof) panel.position.y = 0;
      faceGroup.add(panel);
      const instances = [];
      const faceHeight = roof ? r.size : r.height;
      addBar(instances, -half, 0, faceHeight, .095);
      addBar(instances, half, 0, faceHeight, .095);
      addBar(instances, 0, -faceHeight / 2, r.size + .08, .095, Math.PI / 2);
      addBar(instances, 0, faceHeight / 2, r.size + .08, .095, Math.PI / 2);
      for (const x of [-r.size / 4, 0, r.size / 4]) addBar(instances, x, 0, faceHeight, .045);
      const diagonalLength = Math.hypot(r.size * .48, faceHeight * .78);
      const diagonalAngle = Math.atan2(r.size * .48, faceHeight * .78);
      addBar(instances, -r.size * .24, 0, diagonalLength, .055, -diagonalAngle);
      addBar(instances, r.size * .24, 0, diagonalLength, .055, diagonalAngle);
      const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), frameMat, instances.length);
      bars.name = `sky-cage-${name}-ironwork`;
      instances.forEach((matrix, index) => bars.setMatrixAt(index, matrix));
      bars.instanceMatrix.needsUpdate = true; faceGroup.add(bars);
      const face = { name, active: true, health: r.faceHealth, group: faceGroup, panel,
        center: new THREE.Vector3(), normal: new THREE.Vector3(), right: new THREE.Vector3(),
        up: new THREE.Vector3(), roof, collider: null };
      cage.faces.push(face);
    };
    addFace('north', new THREE.Vector3(0, r.height / 2, half), new THREE.Euler(0, 0, 0));
    addFace('south', new THREE.Vector3(0, r.height / 2, -half), new THREE.Euler(0, Math.PI, 0));
    addFace('east', new THREE.Vector3(half, r.height / 2, 0), new THREE.Euler(0, Math.PI / 2, 0));
    addFace('west', new THREE.Vector3(-half, r.height / 2, 0), new THREE.Euler(0, -Math.PI / 2, 0));
    addFace('roof', new THREE.Vector3(0, r.height, 0), new THREE.Euler(-Math.PI / 2, 0, 0), true);
    g.visible = !preview;
    this.scene.add(g);
    Object.assign(cage, { group: g, panelMat, frameMat });
    return cage;
  }

  bindColliders(colliders) {
    this.hideCoverPreview();
    this.hideCagePreview();
    this._removeAllCovers();
    this._removeAllCages();
    this._worldColliders = colliders;
  }

  _makeBoxCollider(position, normal, right, width, height, depth, name) {
    const halfWidth = width / 2, halfDepth = depth / 2;
    const x = position.x, z = position.z, y0 = position.y, h = y0 + height;
    const planes = [
      [right.x, 0, right.z, right.x * x + right.z * z + halfWidth],
      [-right.x, 0, -right.z, -right.x * x - right.z * z + halfWidth],
      [normal.x, 0, normal.z, normal.x * x + normal.z * z + halfDepth],
      [-normal.x, 0, -normal.z, -normal.x * x - normal.z * z + halfDepth],
      [0, 1, 0, h], [0, -1, 0, -y0],
    ];
    return { name, dynamicCover: true, active: true, x, z, y0, h,
      hx: Math.abs(right.x) * halfWidth + Math.abs(normal.x) * halfDepth,
      hz: Math.abs(right.z) * halfWidth + Math.abs(normal.z) * halfDepth,
      planes, preciseEscape: true };
  }

  _makeCoverCollider(position, normal, right) {
    const r = PLAYER_SKILL_RULES.cover;
    return this._makeBoxCollider(position, normal, right, r.width, r.height, r.depth,
      'player-folding-cover-collider');
  }

  _syncCoverFacade() {
    const latest = this.covers[this.covers.length - 1];
    this.cover.active = this.covers.length > 0;
    this.cover.count = this.covers.length;
    this.cover.cooldown = 0;
    if (latest) {
      for (const key of ['health', 'life', 'age', 'group', 'center', 'normal', 'right']) this.cover[key] = latest[key];
    } else {
      this.cover.health = 0; this.cover.life = 0; this.cover.age = 0; this.cover.group = null;
    }
  }

  resetMatch() {
    this.flight.active = false; this.flight.takeoffRemaining = 0;
    this.hideCoverPreview();
    this.hideCagePreview();
    this._removeAllCovers();
    this._removeAllCages();
    this._events.length = 0;
    this._syncHud();
  }

  cancelTransient(player) {
    if(this.flight.active && player)player.vel.y=Math.min(0,player.vel.y);
    this.flight.active=false;this.flight.takeoffRemaining=0;
    this.hideCoverPreview();
    this.hideCagePreview();
    this._syncHud();
  }

  endMatch(player) {
    this.cancelTransient(player);
    this._removeAllCovers();
    this._removeAllCages();
    this._syncHud();
  }

  toggleFlight(grounded = false) {
    this.flight.active=!this.flight.active;
    this.flight.takeoffRemaining=this.flight.active&&grounded?PLAYER_SKILL_RULES.flight.takeoffHeight:0;
    this._syncHud();
    return this.flight.active;
  }

  placeCover(position, yaw) {
    const r = PLAYER_SKILL_RULES.cover;
    const cover = this._buildCover();
    cover.center.copy(position).add(new THREE.Vector3(0, r.height / 2, 0));
    cover.normal.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    cover.right.set(-cover.normal.z, 0, cover.normal.x);
    const g = cover.group; g.position.copy(position); g.rotation.y = yaw + Math.PI;
    g.scale.set(1, 1, 1);
    cover.collider = this._makeCoverCollider(position, cover.normal, cover.right);
    this._worldColliders?.push(cover.collider);
    this.covers.push(cover);
    this._syncCoverFacade();
    this._syncHud();
    return true;
  }

  setCoverPreview(position, yaw, valid = true) {
    if (!this.coverPreview.group) {
      const visual = this._buildCover(true);
      Object.assign(this.coverPreview, visual);
    }
    const preview = this.coverPreview;
    preview.visible = true;
    preview.valid = !!valid;
    preview.position.copy(position);
    preview.yaw = yaw;
    preview.group.position.copy(position);
    preview.group.rotation.y = yaw + Math.PI;
    preview.group.visible = true;
    if (preview.styleValid !== !!valid) {
      preview.styleValid = !!valid;
      const color = valid ? 0x42dbef : 0xff4f55;
      const glow = valid ? 0x78efff : 0xff7b72;
      preview.panelMat.color.setHex(color);
      preview.panelMat.map = valid ? energyGridTexture() : null;
      preview.panelMat.opacity = valid ? .16 : .12;
      preview.panelMat.needsUpdate = true;
      preview.frameMat.color.setHex(color);
      preview.frameMat.emissive.setHex(valid ? 0x17677b : 0x7b171b);
      preview.glowMat.color.setHex(glow);
      preview.badgeMat.color.setHex(glow);
    }
    return true;
  }

  hideCoverPreview() {
    this.coverPreview.visible = false;
    this.coverPreview.valid = false;
    if (this.coverPreview.group) this.coverPreview.group.visible = false;
  }

  setCagePreview(position, yaw, valid = true) {
    if (!this.cagePreview.group) {
      const visual = this._buildCage(true);
      Object.assign(this.cagePreview, visual);
    }
    const preview = this.cagePreview;
    preview.visible = true; preview.valid = !!valid;
    preview.position.copy(position); preview.yaw = yaw;
    preview.group.position.copy(position); preview.group.rotation.y = yaw;
    preview.group.visible = true;
    if (preview.styleValid !== !!valid) {
      preview.styleValid = !!valid;
      const color = valid ? 0x53dff2 : 0xff4f55;
      preview.panelMat.color.setHex(color);
      preview.panelMat.map = valid ? energyGridTexture() : null;
      preview.panelMat.opacity = valid ? .105 : .085;
      preview.panelMat.needsUpdate = true;
      preview.frameMat.color.setHex(color);
      preview.frameMat.emissive.setHex(valid ? 0x17677b : 0x7b171b);
    }
    return true;
  }

  hideCagePreview() {
    this.cagePreview.visible = false; this.cagePreview.valid = false;
    if (this.cagePreview.group) this.cagePreview.group.visible = false;
  }

  placeCage(position, yaw) {
    const r = PLAYER_SKILL_RULES.ultimate;
    const cage = this._buildCage();
    cage.target.copy(position); cage.group.position.copy(position).add(new THREE.Vector3(0, r.dropHeight, 0));
    cage.group.rotation.y = yaw; cage.group.visible = true; cage.yaw = yaw;
    this.cages.push(cage);
    this.ultimate.active = true; this.ultimate.count = this.cages.length;
    this._syncHud();
    return true;
  }

  _activateCage(cage) {
    if (!cage || cage.landed) return;
    const r = PLAYER_SKILL_RULES.ultimate;
    cage.landed = true; cage.group.position.copy(cage.target); cage.group.updateMatrixWorld(true);
    const worldQuat = new THREE.Quaternion();
    for (const face of cage.faces) {
      face.group.getWorldPosition(face.center); face.group.getWorldQuaternion(worldQuat);
      face.normal.set(0, 0, 1).applyQuaternion(worldQuat).normalize();
      face.right.set(1, 0, 0).applyQuaternion(worldQuat).normalize();
      face.up.set(0, 1, 0).applyQuaternion(worldQuat).normalize();
      if (face.roof) continue;
      const bottom = face.center.clone(); bottom.y = cage.target.y;
      face.collider = this._makeBoxCollider(bottom, face.normal, face.right, r.size, r.height,
        r.depth, `player-sky-cage-${face.name}-collider`);
      cage.colliders.push(face.collider); this._worldColliders?.push(face.collider);
    }
    this._events.push({ type: 'cageLanded', position: cage.target.clone() });
  }

  _deactivateCageFace(cage, face) {
    if (!face?.active) return;
    face.active = false; face.health = 0; face.group.visible = false;
    if (face.collider) {
      face.collider.active = false;
      const index = this._worldColliders?.indexOf(face.collider) ?? -1;
      if (index >= 0) this._worldColliders.splice(index, 1);
      const localIndex = cage.colliders.indexOf(face.collider);
      if (localIndex >= 0) cage.colliders.splice(localIndex, 1);
      face.collider = null;
    }
    this._events.push({ type: 'cageFaceBreak', position: face.center.clone(), face: face.name });
  }

  _removeCage(cage) {
    if (!cage) return;
    cage.active = false;
    for (const face of cage.faces) {
      if (face.collider) {
        face.collider.active = false;
        const index = this._worldColliders?.indexOf(face.collider) ?? -1;
        if (index >= 0) this._worldColliders.splice(index, 1);
      }
    }
    cage.colliders.length = 0;
    const cageIndex = this.cages.indexOf(cage);
    if (cageIndex >= 0) this.cages.splice(cageIndex, 1);
    this._disposeEffect(cage.group);
    this.ultimate.active = this.cages.length > 0; this.ultimate.count = this.cages.length;
  }

  _removeAllCages() {
    for (const cage of [...this.cages]) this._removeCage(cage);
    this.ultimate.active = false; this.ultimate.count = 0;
  }

  _removeCover(cover) {
    if (!cover) return;
    cover.active = false;
    if (cover.collider) {
      cover.collider.active = false;
      const colliderIndex = this._worldColliders?.indexOf(cover.collider) ?? -1;
      if (colliderIndex >= 0) this._worldColliders.splice(colliderIndex, 1);
    }
    const index = this.covers.indexOf(cover);
    if (index >= 0) this.covers.splice(index, 1);
    this._disposeEffect(cover.group);
    this._syncCoverFacade();
  }

  _removeAllCovers() {
    for (const cover of [...this.covers]) this._removeCover(cover);
    this._syncCoverFacade();
  }

  _segmentBarrierHit(from, to) {
    const delta = new THREE.Vector3().subVectors(to, from);
    let best = null;
    for (const cover of this.covers) {
      const denom = delta.dot(cover.normal);
      if (Math.abs(denom) < 1e-5) continue;
      const t = new THREE.Vector3().subVectors(cover.center, from).dot(cover.normal) / denom;
      if (t <= 0 || t >= 1 || (best && t >= best.t)) continue;
      const point = new THREE.Vector3().copy(from).addScaledVector(delta, t);
      const rel = new THREE.Vector3().subVectors(point, cover.center);
      if (Math.abs(rel.dot(cover.right)) <= PLAYER_SKILL_RULES.cover.width / 2 &&
          Math.abs(rel.y) <= PLAYER_SKILL_RULES.cover.height / 2)
        best = { point, barrier: cover, kind: 'cover', t };
    }
    const cageRule = PLAYER_SKILL_RULES.ultimate;
    for (const cage of this.cages) {
      if (!cage.landed) continue;
      for (const face of cage.faces) {
        if (!face.active) continue;
        const denom = delta.dot(face.normal);
        if (Math.abs(denom) < 1e-5) continue;
        const t = new THREE.Vector3().subVectors(face.center, from).dot(face.normal) / denom;
        if (t <= 0 || t >= 1 || (best && t >= best.t)) continue;
        const point = new THREE.Vector3().copy(from).addScaledVector(delta, t);
        const rel = new THREE.Vector3().subVectors(point, face.center);
        const halfHeight = face.roof ? cageRule.size / 2 : cageRule.height / 2;
        if (Math.abs(rel.dot(face.right)) <= cageRule.size / 2 &&
            Math.abs(rel.dot(face.up)) <= halfHeight)
          best = { point, barrier: face, cage, kind: 'cage', t };
      }
    }
    return best;
  }

  // `from` is the rendered muzzle and remains the public shot origin. `barrierOrigin` is the
  // shooter's eye/body point. World gun models can protrude through a thin cage wall when an NPC
  // hugs it; testing only muzzle -> target would then start outside the cage and bypass that face.
  interceptEnemyShot(from, to, damage, barrierOrigin = null) {
    const hit = this._segmentBarrierHit(barrierOrigin || from, to);
    this.lastInterceptKind = hit?.kind || null;
    if (!hit) return null;
    const { barrier, point } = hit;
    barrier.health -= Math.max(1, damage || 1);
    if (barrier.health <= 0) {
      barrier.health = 0;
      if (hit.kind === 'cover') barrier.life = Math.min(barrier.life, .28);
      else this._deactivateCageFace(hit.cage, barrier);
    }
    if (hit.kind === 'cover') this._syncCoverFacade();
    this._syncHud();
    return point;
  }

  explosiveScale(origin, target) { return this._segmentBarrierHit(origin, target) ? .6 : 1; }

  addDamage() {}

  onKill() {
    for (const cover of this.covers) {
      cover.health = Math.min(PLAYER_SKILL_RULES.cover.health, cover.health + PLAYER_SKILL_RULES.cover.killRepair);
    }
    this._syncCoverFacade();
    this._syncHud();
  }

  combatProfile() { return {
    infiniteAmmo: false, recoilScale: 1, spreadScale: 1, moveSpreadScale: 1, switchScale: 1,
  }; }

  cameraProfile() { return { fovBoost: 0, roll: 0 }; }

  update(dt, player, enabled = true) {
    if (!enabled) { this.cancelTransient(player); this._removeAllCovers(); this._removeAllCages(); this._syncHud(); return; }
    for (const cover of [...this.covers]) {
      cover.life -= dt; cover.age += dt;
      if (cover.life <= 0) this._removeCover(cover);
    }
    this._syncCoverFacade();
    const cageRule = PLAYER_SKILL_RULES.ultimate;
    for (const cage of [...this.cages]) {
      if (!cage.landed) {
        cage.fallTime = Math.min(cageRule.dropDuration, cage.fallTime + dt);
        const p = clamp(cage.fallTime / cageRule.dropDuration, 0, 1);
        const fall = p * p * (3 - 2 * p);
        cage.group.position.y = cage.target.y + cageRule.dropHeight * (1 - fall);
        if (p >= 1) this._activateCage(cage);
        continue;
      }
      cage.life -= dt; cage.age += dt;
      if (cage.life <= 0) this._removeCage(cage);
    }
    this.ultimate.active = this.cages.length > 0; this.ultimate.count = this.cages.length;
    this._syncHud();
  }

  drainEvents() { return this._events.splice(0); }

  _disposeEffect(object) {
    this.scene.remove(object);
    object.traverse?.(child => { child.geometry?.dispose?.(); child.material?.dispose?.(); });
    object.geometry?.dispose?.(); object.material?.dispose?.();
  }

  _syncHud() {
    const root = this.hud?.querySelector('#skillHud'); if (!root) return;
    const r = PLAYER_SKILL_RULES;
    const flight = root.querySelector('[data-skill="flight"]');
    const cover = root.querySelector('[data-skill="cover"]');
    const ult = root.querySelector('[data-skill="ultimate"]');
    if (flight) {
      flight.classList.add('ready');flight.classList.toggle('active',this.flight.active);
      flight.style.setProperty('--skill-fill','100%');
      flight.title='Z开关飞行 · 空格上升 · Ctrl下降 · Shift加速 · 保留实体碰撞';
      flight.querySelector('.skill-value').textContent=this.flight.active?'飞行中 · Z关闭':'Z开启 · 无冷却';
    }
    if (cover) {
      cover.classList.add('ready');
      cover.classList.toggle('active', this.covers.length > 0);
      cover.style.setProperty('--skill-fill', '100%');
      cover.querySelector('.skill-value').textContent = `${this.covers.length}个`;
    }
    if (ult) {
      ult.classList.add('ready'); ult.classList.toggle('active', this.cages.length > 0);
      ult.style.setProperty('--skill-fill', '100%');
      ult.querySelector('.skill-value').textContent = `${this.cages.length}个`;
    }
  }

  snapshot() { return {
    flight: { ...this.flight, cooldown: 0 },
    cover: { active: this.cover.active, health: this.cover.health, life: this.cover.life, cooldown: this.cover.cooldown,
      count: this.covers.length, maxCount: null,
      width: PLAYER_SKILL_RULES.cover.width, height: PLAYER_SKILL_RULES.cover.height,
      preview: { visible: this.coverPreview.visible, valid: this.coverPreview.valid,
        position: this.coverPreview.visible ? this.coverPreview.position.toArray() : null,
        yaw: this.coverPreview.yaw },
      position: this.cover.group?.position.toArray() || null, normal: this.cover.normal.toArray(), right: this.cover.right.toArray(),
      items: this.covers.map(cover => ({ health: cover.health, life: cover.life,
        position: cover.group.position.toArray(), normal: cover.normal.toArray(), right: cover.right.toArray() })) },
    ultimate: { ...this.ultimate,
      maxCount: null, cooldown: 0, size: PLAYER_SKILL_RULES.ultimate.size,
      height: PLAYER_SKILL_RULES.ultimate.height, faceHealth: PLAYER_SKILL_RULES.ultimate.faceHealth,
      life: PLAYER_SKILL_RULES.ultimate.life,
      preview: { visible: this.cagePreview.visible, valid: this.cagePreview.valid,
        position: this.cagePreview.visible ? this.cagePreview.position.toArray() : null,
        yaw: this.cagePreview.yaw },
      items: this.cages.map(cage => ({ landed: cage.landed, life: cage.life, age: cage.age,
        position: cage.group.position.toArray(), target: cage.target.toArray(), yaw: cage.yaw,
        faces: cage.faces.map(face => ({ name: face.name, active: face.active, health: face.health,
          center: cage.landed ? face.center.toArray() : null,
          normal: cage.landed ? face.normal.toArray() : null })) })) },
    combat: this.combatProfile(),
  }; }
}
