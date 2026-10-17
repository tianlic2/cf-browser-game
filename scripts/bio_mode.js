import * as THREE from 'three';
import { cloneSkinned } from './skinned_clone.js';
import { makeGLTFLoader } from './gltf.js';
import { ClassicSoldierRig } from './classic_soldier.js';
import { intersectsBrush } from './brush_collision.js';
import { enemyModel } from './guncatalog.js';
import { HUMAN_RUN_SPEED } from './move_speed.js?v=bio-arena-1';
import { overlapsActors, sweepActorAxis, findActorSpawn } from './actor_collision.js';
import { ZOMBIE_RESPAWN_SECONDS, refillTwoMagazines } from './bio_rules.js';

const ASSET = new URL('../assets/bio/zombie/', import.meta.url).href;
const CLIPS = ['idle', 'run', 'attack', 'hit', 'death', 'scream'];
const PREP = 15;
const ROUND = 180;
const HIT_RANGE = 1.58;
const LEAP_UP = 8;
const LEAP_GRAVITY = 18;
const LEAP_HEIGHT = LEAP_UP * LEAP_UP / (2 * LEAP_GRAVITY);
const POWER_REPAIR_TIME = 2.5;
const POWER_DURATION = 45;
const ZOMBIE_RUN_SPEED = HUMAN_RUN_SPEED * 1.05;
const HIT_MOVE_SCALE = .52;
const ZOMBIE_HEALTH = 5000;
const HUMAN_MAG_SIZE = 30;
const HUMAN_INITIAL_RESERVE = 180;
const ZOMBIE_ACCEL = 8;
const KNOCKBACK_DRAG = 10;
const KNOCKBACK_MAX_SPEED = 7.5;
const HIT_BRAKE_TIME = .13;
const HUMAN_RUN_SPEED_AI = 5.6;
const HUMAN_FLEE_SPEED = 6.0;
const HUMAN_ROUTE_PERIOD = .36;
const HIT_REACT_TIME = .42;

export class BioMode {
  constructor({ scene, sound, onPlayerInfected, onPlayerRespawn, onRoundEnd, onZombieKilled, onPowerRestored, onChange }) {
    this.scene = scene;
    this.sound = sound;
    this.onPlayerInfected = onPlayerInfected;
    this.onPlayerRespawn = onPlayerRespawn;
    this.onRoundEnd = onRoundEnd;
    this.onZombieKilled = onZombieKilled;
    this.onPowerRestored = onPowerRestored;
    this.onChange = onChange;
    this.phase = 'off';
    this.playerZombie = false;
    this.playerOut = false;
    this.humans = [];
    this.zombies = [];
    this.timer = 0;
    this.kills = 0;
    this.infections = 0;
    this._playerAttack = 0;
    this.playerMaxHealth = 100;
    this.playerRespawnT = 0;
    this.power = 'off';
    this.powerRepair = 0;
    this.powerTime = 0;
  }

  async load() {
    const loader = makeGLTFLoader();
    const [base, ...motions] = await Promise.all([
      loader.loadAsync(ASSET + 'model.glb'),
      ...CLIPS.map(name => loader.loadAsync(ASSET + name + '.glb')),
    ]);
    this.template = base.scene;
    // GLTFLoader sanitizes FBX colons out of node and track names. The model
    // uses CityDeadOutfitHips while motion files use mixamorigHips.
    this.clips = new Map(CLIPS.map((name, i) => {
      const clip = motions[i].animations[0].clone();
      clip.name = name;
      for (const track of clip.tracks) {
        track.name = track.name.replace(/^mixamorig(?=[A-Z])/, 'CityDeadOutfit');
        // World movement belongs to the collision controller. A moving hips
        // track otherwise slides the skin through walls while its group stays put.
        if (/Hips.*\.position$/.test(track.name)) {
          const x = track.values[0], z = track.values[2];
          for (let j = 0; j < track.values.length; j += 3) {
            track.values[j] = x;
            track.values[j + 2] = z;
          }
        }
      }
      return [name, clip];
    }));
    const tex = new THREE.TextureLoader();
    const [body, outfit, bodyNor, outfitNor] = await Promise.all([
      tex.loadAsync(ASSET + 'City_Infected_Man_Body1_BaseColor.png'),
      tex.loadAsync(ASSET + 'City_Man_Infected_Outfit1_BaseColor.png'),
      tex.loadAsync(ASSET + 'City_Infected_Man_Body1_Normal.png'),
      tex.loadAsync(ASSET + 'City_Man_Infected_Outfit1_Normal.png'),
    ]);
    body.colorSpace = outfit.colorSpace = THREE.SRGBColorSpace;
    this.skinTexture = body;
    this.skinNormal = bodyNor;
    this.template.traverse(obj => {
      if (!obj.isMesh) return;
      obj.material = Array.isArray(obj.material) ? obj.material.map(m => this._material(m, body, outfit, bodyNor, outfitNor))
        : this._material(obj.material, body, outfit, bodyNor, outfitNor);
    });
    // The independently licensed Hazmat GLB contains its own rig and motions.
    // Keep it optional so an unavailable skin never disables infection mode.
    try {
      const hazmat = await loader.loadAsync(new URL('../assets/bio/zombie_hazmat.glb', import.meta.url).href);
      this.hazmatTemplate = hazmat.scene;
      const byName = new Map(hazmat.animations.map(clip => [clip.name, clip]));
      this.hazmatClips = new Map([
        ['idle', byName.get('Zombie_Idle')],
        ['run', byName.get('Zombie_Walk_Root')],
        ['attack', byName.get('Zombie_Skill')],
        ['scream', byName.get('Zombie_EnemySpotted')],
      ].filter(([, clip]) => clip));
      for (const clip of this.hazmatClips.values()) {
        // Navigation supplies horizontal travel. Preserve the authored vertical
        // hip movement so the feet and torso still carry their natural weight.
        for (const track of clip.tracks) {
          if (!/Hips.*\.position$/.test(track.name)) continue;
          const x = track.values[0], z = track.values[2];
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = x;
            track.values[i + 2] = z;
          }
        }
      }
      this.hazmatTemplate.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.material = obj.material.clone();
        if (obj.material.color) obj.material.color.multiplyScalar(1.32);
      });
    } catch (error) {
      console.warn('防化服幽灵外观不可用，使用基础幽灵：', error);
      this.hazmatTemplate = null;
      this.hazmatClips = null;
    }
  }

  _material(m, body, outfit, bodyNor, outfitNor) {
    const isBody = /Body/i.test(m.name);
    return new THREE.MeshStandardMaterial({
      name: m.name, map: isBody ? body : outfit,
      normalMap: isBody ? bodyNor : outfitNor,
      color: 0xffffff, roughness: .83, metalness: .04,
    });
  }

  clear() {
    for (const a of [...this.humans, ...this.zombies]) {
      this.scene.remove(a.group);
      a.mixer?.stopAllAction();
      if (a.headHit) {
        a.headHit.geometry.dispose();
        a.headHit.material.dispose();
      }
    }
    this.humans.length = this.zombies.length = 0;
    this.phase = 'off';
    this.playerZombie = false;
    this.playerOut = false;
    this.timer = 0;
    this._playerAttack = 0;
    this.playerMaxHealth = 100;
    this.playerRespawnT = 0;
    this.power = 'off';
    this.powerRepair = 0;
    this.powerTime = 0;
    this.map?.setPower?.(false);
    this.onChange?.();
  }

  start(map, player = null) {
    this.clear();
    this.map = map;
    this.playerRef = player;
    this.phase = 'prepare';
    this.timer = PREP;
    this.kills = this.infections = 0;
    this.map.setPower?.(false);
    const spawns = map.bio?.humans || map.spawns.player;
    for (let i = 0; i < Math.min(5, spawns.length); i++) {
      const [x, y, z] = spawns[i];
      const spot = this._findSpawn(x, y, z);
      if (!spot) continue;
      const group = new THREE.Group();
      const rig = new ClassicSoldierRig(enemyModel('m4'));
      group.add(rig.root);
      group.position.fromArray(spot);
      group.rotation.y = Math.PI;
      this.scene.add(group);
      this.humans.push({ group, rig, alive: true, infected: false,
        name: ['猎鹰', '夜莺', '冷锋', '铁锤', '红隼'][i], shotCd: .3 + i * .23,
        hold: i % (map.bio?.holdPoints?.length || 1), panic: 0, hp: 100,
        ammo: HUMAN_MAG_SIZE, reserve: HUMAN_INITIAL_RESERVE, reloadT: 0,
        routeT: 0, routeX: 0, routeZ: 0, moveX: 0, moveZ: 0,
        strafeSide: i % 2 ? 1 : -1, holdDecisionT: 2 + i * .35,
        lastThreat: null, lastThreatT: 0, turnRate: 0 });
    }
    this.onChange?.();
  }

  spawnZombie(x, y, z, mother = false, name = '生化幽灵') {
    if (!this.template) throw new Error('生化幽灵资源未加载');
    const spot = this._findSpawn(x, y, z);
    if (!spot) return null;
    const group = new THREE.Group();
    const hazmat = !!this.hazmatTemplate && (mother || this.zombies.length % 2 === 1);
    const model = cloneSkinned(hazmat ? this.hazmatTemplate : this.template);
    group.add(model);
    model.scale.setScalar(.01);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const scale = 1.84 / Math.max(.01, bounds.max.y - bounds.min.y);
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(model);
    model.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y,
      -(fitted.min.z + fitted.max.z) / 2);
    const actor = { group, model, mother, hazmat, name, health: ZOMBIE_HEALTH,
      maxHealth: ZOMBIE_HEALTH, dead: false, meshes: [], combatAt: -Infinity,
      attackT: 0, attackCd: 1.1, attackTarget: null, attackLanded: false,
      stagger: 0, pushX: 0, pushZ: 0, hitBrakeT: 0,
      moveX: 0, moveZ: 0, runRate: 1, hitT: 0, hitSide: 1,
      airborne: false, jumpVelocity: 0, jumpTime: 0, jumpCooldown: 0,
      leapX: 0, leapZ: 0, stuckFor: 0,
      flashT: 0, deathT: 0, restY: model.position.y,
      respawnT: 0, rewarded: false,
      pursuitKey: null,
      mixer: new THREE.AnimationMixer(model), active: null,
      actions: new Map() };
    for (const [key, clip] of (hazmat ? this.hazmatClips : this.clips))
      actor.actions.set(key, actor.mixer.clipAction(clip));
    actor.hitAction = actor.actions.get('hit') || null;
    model.traverse(obj => {
      if (!obj.isMesh) return;
      obj.userData.enemy = actor;
      obj.userData.part = 'body';
      actor.meshes.push(obj);
      obj.castShadow = true;
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    head.position.set(0, 1.62, 0);
    head.userData.enemy = actor;
    head.userData.part = 'head';
    group.add(head);
    actor.headHit = head;
    actor.meshes.push(head);
    actor.takeDamage = (amount, headshot = false, impactDir = null) => {
      if (actor.dead) return false;
      actor.health = Math.max(0, actor.health - amount);
      actor.stagger = Math.min(.48, Math.max(.2, actor.stagger + amount / 1100));
      if (impactDir) {
        const len = Math.hypot(impactDir.x, impactDir.z);
        if (len > .001) {
          // Treat the hit as a real backward impulse. It moves independently
          // from the chase controller, so the zombie actually retreats.
          const impulse = Math.min(6.5, 2.4 + Math.sqrt(Math.max(0, amount)) * .3);
          actor.pushX += impactDir.x / len * impulse;
          actor.pushZ += impactDir.z / len * impulse;
          const pushSpeed = Math.hypot(actor.pushX, actor.pushZ);
          if (pushSpeed > KNOCKBACK_MAX_SPEED) {
            actor.pushX *= KNOCKBACK_MAX_SPEED / pushSpeed;
            actor.pushZ *= KNOCKBACK_MAX_SPEED / pushSpeed;
          }
          actor.moveX *= .12;
          actor.moveZ *= .12;
          actor.hitBrakeT = HIT_BRAKE_TIME;
          actor.hitSide = Math.sign(impactDir.x * Math.cos(group.rotation.y) -
            impactDir.z * Math.sin(group.rotation.y)) || actor.hitSide;
        }
      }
      actor.flashT = .12;
      if (actor.health > 0) {
        actor.hitT = HIT_REACT_TIME;
        if (actor.hitAction) {
          actor.hitAction.stop().reset().setLoop(THREE.LoopOnce, 1);
          actor.hitAction.clampWhenFinished = false;
          actor.hitAction.setEffectiveTimeScale(actor.hitAction.getClip().duration / .6);
          actor.hitAction.setEffectiveWeight(.42).play();
        }
        return false;
      }
      actor.dead = true;
      actor.hitAction?.stop();
      actor.deathT = 1.7;
      actor.respawnT = ZOMBIE_RESPAWN_SECONDS;
      if (actor.hazmat) this._play(actor, 'idle');
      else this._play(actor, 'death', false);
      for (const m of actor.meshes) m.userData.enemy = null;
      this.onZombieDeath(actor);
      return true;
    };
    actor.setFlash = () => { actor.flashT = .12; };
    group.position.fromArray(spot);
    this.scene.add(group);
    this.zombies.push(actor);
    this._play(actor, mother ? 'scream' : 'idle');
    this.onChange?.();
    return actor;
  }

  _play(a, name, loop = true) {
    const next = a.actions.get(name);
    if (!next || a.active === next) return;
    next.reset();
    if (name === 'run') next.setEffectiveTimeScale(a.runRate);
    else if (a.hazmat && name === 'attack') next.setEffectiveTimeScale(next.getClip().duration / 1.05);
    else next.setEffectiveTimeScale(1);
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.fadeIn(.16).play();
    a.active?.fadeOut(.16);
    a.active = next;
  }

  _bodies() {
    return [...this.humans.filter(h => h.alive), ...this.zombies.filter(z => !z.dead),
      ...(this.playerRef && !this.playerOut ? [this.playerRef] : [])];
  }

  _findSpawn(x, y, z) {
    const valid = (px, py, pz) => this._canMove(px, pz, py, .45, null, false) &&
      Math.abs((this.map.navigation?.heightAt(px, pz, py) ?? py) - py) < .7;
    return findActorSpawn(x, y, z, this._bodies(), valid);
  }

  _canMove(x, z, y, radius = .45, self = null, checkActors = true) {
    const b = this.map.bounds;
    if (Math.abs(x) > b.hw - radius || Math.abs(z) > b.hl - radius) return false;
    return !this.map.colliders.some(c => intersectsBrush(c, x, z, y, radius,
      this.map.stepHeight ?? .5, 1.78)) &&
      (!checkActors || !overlapsActors(x, y, z, this._bodies(), self, radius));
  }

  _actorSupport(p, self, bodies = this._bodies()) {
    let top = -Infinity;
    for (const actor of bodies) {
      if (actor === self) continue;
      const q = actor.group?.position || actor.pos;
      if (!q) continue;
      const candidate = q.y + 1.78;
      if (p.y < candidate - .02) continue;
      if ((p.x - q.x) ** 2 + (p.z - q.z) ** 2 < .9 ** 2)
        top = Math.max(top, candidate);
    }
    return top;
  }

  _move(a, vx, vz, dt) {
    const p = a.group.position;
    const bodies = this._bodies();
    const dx = sweepActorAxis(p.x, vx * dt, p.z, p.y, bodies, a, 'x');
    const nx = p.x + dx;
    const floorX = !a.airborne ? Math.max(this.map.navigation?.heightAt(nx, p.z, p.y) ?? 0,
      this._actorSupport({ x: nx, y: p.y, z: p.z }, a, bodies)) : p.y;
    if (this._canMove(nx, p.z, p.y, .45, a, false) &&
        !overlapsActors(nx, floorX, p.z, bodies, a)) p.x = nx;
    const dz = sweepActorAxis(p.z, vz * dt, p.x, p.y, bodies, a, 'z');
    const nz = p.z + dz;
    const floorZ = !a.airborne ? Math.max(this.map.navigation?.heightAt(p.x, nz, p.y) ?? 0,
      this._actorSupport({ x: p.x, y: p.y, z: nz }, a, bodies)) : p.y;
    if (this._canMove(p.x, nz, p.y, .45, a, false) &&
        !overlapsActors(p.x, floorZ, nz, bodies, a)) p.z = nz;
    if (!a.airborne) p.y = Math.max(this.map.navigation?.heightAt(p.x, p.z, p.y) ?? 0,
      this._actorSupport(p, a, bodies));
  }

  // Leap only over a low obstacle ahead. Tall perimeter walls remain solid.
  _tryLeap(a, vx, vz) {
    if (a.airborne || a.jumpCooldown > 0) return false;
    const p = a.group.position;
    const x = p.x + vx * .7, z = p.z + vz * .7;
    const obstacle = this.map.colliders.find(c =>
      c.h > p.y + (this.map.stepHeight ?? .5) && c.h <= p.y + LEAP_HEIGHT - .08 &&
      intersectsBrush(c, x, z, p.y, .45, this.map.stepHeight ?? .5, 1.78));
    if (!obstacle) return false;
    // A jump needs room to clear the far side; don't hop in place against a wall.
    const beyond = Math.max(1.7, Math.min(3.7, Math.abs(vx) * obstacle.hx * 2 + Math.abs(vz) * obstacle.hz * 2 + 1));
    if (!this._canMove(p.x + vx * beyond, p.z + vz * beyond,
      Math.max(p.y, obstacle.h) + .06, .45, a)) return false;
    a.airborne = true;
    a.jumpVelocity = LEAP_UP;
    a.jumpTime = 0;
    a.jumpCooldown = 1.2;
    a.leapX = vx;
    a.leapZ = vz;
    a.stuckFor = 0;
    return true;
  }

  _updateLeap(a, dt) {
    a.jumpCooldown = Math.max(0, a.jumpCooldown - dt);
    if (!a.airborne) return;
    const p = a.group.position;
    const next = p.y + a.jumpVelocity * dt - LEAP_GRAVITY * dt * dt * .5;
    a.jumpVelocity -= LEAP_GRAVITY * dt;
    a.jumpTime += dt;
    const ground = Math.max(this.map.navigation?.heightAt(p.x, p.z, Math.max(p.y, next)) ?? 0,
      this._actorSupport(p, a));
    if (a.jumpVelocity <= 0 && next <= ground) {
      p.y = ground;
      a.airborne = false;
      a.jumpVelocity = 0;
      a.model.rotation.x = 0;
    } else {
      p.y = next;
      a.model.rotation.x = -.18 * Math.sin(Math.min(1, a.jumpTime / .9) * Math.PI);
    }
  }

  _infect(human) {
    if (!human.alive) return;
    human.alive = false;
    human.infected = true;
    this.scene.remove(human.group);
    const p = human.group.position;
    this.spawnZombie(p.x, p.y, p.z, false, human.name);
    this.infections++;
    this.sound?.bio('infect', p.x, p.y, p.z);
    this.onChange?.();
  }

  _mutantSpawn() {
    const spawns = this.map.bio?.mutants || this.map.spawns.enemy;
    const targets = this.humans.filter(h => h.alive).map(h => h.group.position);
    if (!this.playerZombie && !this.playerOut && this.playerRef) targets.push(this.playerRef.pos);
    let selected = null, safest = -Infinity;
    for (const [x, y, z] of spawns) {
      const spot = this._findSpawn(x, y, z);
      if (!spot) continue;
      const distance = targets.length ? Math.min(...targets.map(p =>
        Math.hypot(p.x - spot[0], p.z - spot[2]))) : 0;
      if (distance > safest) { safest = distance; selected = spot; }
    }
    return selected;
  }

  _respawnZombie(z) {
    const spot = this._mutantSpawn();
    if (!spot) return false;
    z.group.position.fromArray(spot);
    if (!z.group.parent) this.scene.add(z.group);
    z.model.position.y = z.restY;
    z.model.rotation.set(0, 0, 0);
    z.mixer.stopAllAction();
    z.active = null;
    z.health = z.maxHealth;
    z.dead = false;
    z.rewarded = false;
    z.deathT = z.respawnT = z.hitT = z.stagger = 0;
    z.attackT = 0; z.attackCd = 1; z.attackTarget = null; z.attackLanded = false;
    z.pushX = z.pushZ = z.moveX = z.moveZ = z.hitBrakeT = 0;
    z.airborne = false; z.jumpVelocity = z.jumpTime = z.jumpCooldown = 0;
    z.leapX = z.leapZ = 0;
    z.stuckFor = z.flashT = 0; z.runRate = 1;
    z.pursuitKey = null;
    for (const mesh of z.meshes) mesh.userData.enemy = z;
    this._play(z, 'idle');
    this.onChange?.();
    return true;
  }

  _respawnPlayerZombie(player) {
    const spot = this._mutantSpawn();
    if (!spot) return false;
    player.pos.fromArray(spot);
    player.vel?.set(0, 0, 0);
    player.yaw = Math.atan2(spot[0], spot[2]);
    player.pitch = 0;
    player.hp = this.playerMaxHealth = ZOMBIE_HEALTH;
    this.playerOut = false;
    this.playerRespawnT = 0;
    this.onPlayerRespawn?.();
    this.onChange?.();
    return true;
  }

  killPlayerZombie(player) {
    if (!this.playerZombie || this.playerOut) return false;
    player.hp = 0;
    this.playerOut = true;
    this.playerRespawnT = ZOMBIE_RESPAWN_SECONDS;
    this.sound?.bio('death', player.pos.x, player.pos.y, player.pos.z);
    this.onChange?.();
    return true;
  }

  _chooseMother(player) {
    const options = this.humans.filter(h => h.alive);
    // Include the player in the draw, as in classic infection mode. There is
    // always at least one AI mercenary left to hunt if the player is chosen.
    const roll = Math.floor(Math.random() * (options.length + 1));
    if (roll === options.length) {
      this.playerZombie = true;
      this.playerMaxHealth = player.hp = ZOMBIE_HEALTH;
      this.onPlayerInfected?.(true);
      this.sound?.bio('mother');
    } else {
      const h = options[roll];
      h.alive = false;
      this.scene.remove(h.group);
      const p = h.group.position;
      this.spawnZombie(p.x, p.y, p.z, true, h.name);
      this.sound?.bio('mother', p.x, p.y, p.z);
    }
    this.phase = 'live';
    this.timer = ROUND;
    this.power = 'offline';
    this.map?.setPower?.(false);
    this.onChange?.();
  }

  repairPower(player) {
    if (this.phase !== 'live' || this.playerZombie || this.playerOut ||
        this.power !== 'offline' || !this.map?.bio?.power) return false;
    const q = this.map.bio.power;
    if (Math.hypot(player.pos.x - q[0], player.pos.z - q[2]) > 2.5 ||
        Math.abs(player.pos.y - q[1]) > 1.1) return false;
    this.power = 'repairing';
    this.powerRepair = 0;
    this.onChange?.();
    return true;
  }

  attackAsZombie(player) {
    if (this.phase !== 'live' || !this.playerZombie || this.playerOut || this._playerAttack > 0) return false;
    this._playerAttack = .8;
    const p = player.pos;
    let target = null, best = HIT_RANGE;
    const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    for (const h of this.humans) {
      if (!h.alive) continue;
      const q = h.group.position;
      const dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz);
      if (dist < best && forward.x * dx + forward.z * dz > dist * .42 &&
          Math.abs(q.y - p.y) < 1.1 && this._lineClear(p, q)) {
        target = h; best = dist;
      }
    }
    this.sound?.bio('attack', p.x, p.y, p.z);
    if (target) this._infect(target);
    return !!target;
  }

  _lineClear(a, b) {
    const dir = new THREE.Vector3(b.x - a.x, (b.y || 0) - (a.y || 0), b.z - a.z);
    const dist = dir.length();
    if (dist < .01) return true;
    const ray = new THREE.Raycaster(new THREE.Vector3(a.x, (a.y || 0) + 1.2, a.z), dir.normalize(), 0, dist);
    return !ray.intersectObjects(this.map.obstacles, false).length;
  }

  _holdPoint(h) {
    const points = this.map.bio?.holdPoints;
    return points?.length ? points[h.hold % points.length] : this.map.spawns.player[h.hold % this.map.spawns.player.length];
  }

  _reconsiderHold(h, threats, dt) {
    h.holdDecisionT -= dt;
    if (h.holdDecisionT > 0) return;
    h.holdDecisionT = 3.2 + (h.hold % 3) * .4;
    const p = h.group.position, points = this.map.bio?.holdPoints || [];
    if (!points.length || !threats.length) return;
    const near = Math.min(...threats.map(t => Math.hypot(t.x-p.x,t.z-p.z)));
    if (near > 15) return;
    const score = (point) => {
      const travel = Math.hypot(point[0]-p.x,point[2]-p.z);
      if (travel > 23 || Math.abs(point[1]-p.y) > 2) return -Infinity;
      const safety = Math.min(...threats.map(t => Math.hypot(point[0]-t.x,point[2]-t.z)));
      const crowded = this.humans.filter(o => o !== h && o.alive && o.hold === points.indexOf(point)).length;
      return Math.min(22,safety) - travel * .4 - crowded * 2;
    };
    let best = h.hold, value = score(points[best]);
    points.forEach((point,i) => { const s=score(point);if(s>value+2.4){best=i;value=s;} });
    if (best !== h.hold) { h.hold = best; h.routeT = 0; }
  }

  _escapeDirection(h, threat, threats) {
    const p = h.group.position, hold = this._holdPoint(h);
    const base = Math.atan2(p.x-threat.x,p.z-threat.z);
    let best = null, value = -Infinity;
    for (const turn of [0,-.55,.55,-1.1,1.1,-1.65,1.65,Math.PI]) {
      const angle = base + turn, vx = Math.sin(angle), vz = Math.cos(angle);
      const nx = p.x + vx * 1.35, nz = p.z + vz * 1.35;
      if (!this._canMove(nx,nz,p.y,.45,h)) continue;
      const safety = Math.min(...threats.map(t => Math.hypot(nx-t.x,nz-t.z)));
      const holdDist = Math.hypot(nx-hold[0],nz-hold[2]);
      const score = safety - holdDist * .08 - Math.abs(turn) * .15;
      if (score > value) { value = score; best = [vx,vz]; }
    }
    return best || [0,0];
  }

  _humanRoute(h, goal, dt) {
    const p = h.group.position;
    const dx = goal[0] - p.x, dz = goal[2] - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < .75) return [0, 0];
    h.routeT -= dt;
    if (h.routeT <= 0) {
      const target = { x: goal[0], y: goal[1], z: goal[2] };
      let dir = null;
      if (this.map.navigation && !this.map.navigation.clear(p, target)) {
        this.map.navigation.update(target);
        dir = this.map.navigation.steer(p, target);
      }
      h.routeX = dir?.x ?? dx / dist;
      h.routeZ = dir?.z ?? dz / dist;
      h.routeT = HUMAN_ROUTE_PERIOD + h.hold * .025;
    }
    return [h.routeX, h.routeZ];
  }

  _moveHuman(h, vx, vz, dt, speed) {
    const p = h.group.position;
    const length = Math.hypot(vx, vz);
    const targetX = length > .001 ? vx / length * speed : 0;
    const targetZ = length > .001 ? vz / length * speed : 0;
    const blend = 1 - Math.exp(-dt * 8);
    h.moveX += (targetX - h.moveX) * blend;
    h.moveZ += (targetZ - h.moveZ) * blend;
    const x = p.x, z = p.z;
    this._move(h, h.moveX, h.moveZ, dt);
    const actualX = p.x - x, actualZ = p.z - z;
    const moved = Math.hypot(actualX, actualZ);
    if (length > .001 && moved < .015 && dt > 0) {
      h.routeT = 0;
      h.moveX *= .4;
      h.moveZ *= .4;
    }
    return { moved, speed: moved / Math.max(dt, .001), x: actualX, z: actualZ };
  }

  _animateHuman(h, dt, motion, aimed) {
    const yaw = h.group.rotation.y;
    const length = Math.max(motion.moved, .0001);
    const forward = (motion.x * Math.sin(yaw) + motion.z * Math.cos(yaw)) / length;
    const side = (motion.x * Math.cos(yaw) - motion.z * Math.sin(yaw)) / length;
    h.rig.animate(dt, { moved: motion.moved, speed: motion.speed,
      aim: aimed ? 1 : .48, moveForward: forward, moveSide: side,
      reload: h.reloadT > 0 ? 1 - h.reloadT / 2.5 : 0,
      turnRate: h.turnRate || 0 });
  }

  update(dt, player, elapsed = dt) {
    if (this.phase === 'off' || this.phase === 'ended') return;
    const countdownDt = Number.isFinite(elapsed) && elapsed > 0 ? elapsed : dt;
    this.playerRef = player;
    this.timer = Math.max(0, this.timer - dt);
    this._playerAttack = Math.max(0, this._playerAttack - dt);
    if (this.phase === 'prepare') {
      for (const h of this.humans) {
        const [vx, vz] = this._humanRoute(h, this._holdPoint(h), dt);
        const motion = this._moveHuman(h, vx, vz, dt, HUMAN_RUN_SPEED_AI);
        if (motion.moved > .001) {
          const wanted = Math.atan2(motion.x, motion.z);
          const error = Math.atan2(Math.sin(wanted - h.group.rotation.y),
            Math.cos(wanted - h.group.rotation.y));
          h.group.rotation.y += THREE.MathUtils.clamp(error, -5.6 * dt, 5.6 * dt);
        }
        this._animateHuman(h, dt, motion, false);
      }
      if (this.timer <= 0) this._chooseMother(player);
      else this.onChange?.();
      return;
    }
    if (this.power === 'repairing') {
      const q = this.map.bio.power;
      if (this.playerZombie || this.playerOut ||
          Math.hypot(player.pos.x - q[0], player.pos.z - q[2]) > 2.6 ||
          Math.abs(player.pos.y - q[1]) > 1.1) {
        this.power = 'offline';
        this.powerRepair = 0;
      } else {
        this.powerRepair = Math.min(POWER_REPAIR_TIME, this.powerRepair + dt);
        if (this.powerRepair >= POWER_REPAIR_TIME) {
          this.power = 'online';
          this.powerTime = POWER_DURATION;
          this.map.setPower?.(true);
          this.sound?.ui('switch');
          this.onPowerRestored?.();
        }
      }
    } else if (this.power === 'online') {
      this.powerTime = Math.max(0, this.powerTime - dt);
      if (this.powerTime <= 0) {
        this.power = 'spent';
        this.map.setPower?.(false);
      }
    }
    if (this.playerZombie && this.playerOut) {
      this.playerRespawnT = Math.max(0, this.playerRespawnT - countdownDt);
      if (this.playerRespawnT === 0) this._respawnPlayerZombie(player);
    }
    const aliveHumans = this.humans.filter(h => h.alive);
    const targets = [...aliveHumans.map(h => ({ human: h, pos: h.group.position }))];
    if (!this.playerZombie && !this.playerOut) targets.push({ human: null, pos: player.pos });
    const targetLoads = new Map();
    for (const z of this.zombies) {
      if (z.hitT > 0) {
        z.hitT = Math.max(0, z.hitT - dt);
        z.hitAction?.setEffectiveWeight(.42 * Math.pow(z.hitT / HIT_REACT_TIME, .75));
        if (z.hitT === 0) z.hitAction?.stop();
      }
      z.mixer.update(dt);
      if (z.dead) {
        z.deathT -= dt;
        z.respawnT = Math.max(0, z.respawnT - countdownDt);
        if (z.hazmat) {
          const t = Math.min(1, (1.7 - z.deathT) / .55);
          const eased = t * t * (3 - 2 * t);
          z.model.rotation.x = -1.22 * eased;
          z.model.rotation.z = 0;
          z.model.position.y = z.restY - .28 * eased;
        }
        if (z.deathT <= 0 && z.group.parent) this.scene.remove(z.group);
        if (z.respawnT === 0) this._respawnZombie(z);
        continue;
      }
      z.attackCd = Math.max(0, z.attackCd - dt);
      z.stagger = Math.max(0, z.stagger - dt);
      z.hitBrakeT = Math.max(0, z.hitBrakeT - dt);
      this._updateLeap(z, dt);
      const hitBlend = z.hitT / HIT_REACT_TIME;
      if (z.hazmat) {
        const targetRoll = z.hitSide * .11 * hitBlend;
        z.model.rotation.z += (targetRoll - z.model.rotation.z) * (1 - Math.exp(-dt * 18));
        if (!z.airborne) z.model.rotation.x += (.09 * hitBlend - z.model.rotation.x) *
          (1 - Math.exp(-dt * 16));
      }
      const p = z.group.position;
      let chosen = null, best = Infinity, lane = 0;
      for (const t of targets) {
        const d = Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
        const key = t.human || player;
        const load = targetLoads.get(key) || 0;
        const score = d + load * 2.7 - (z.pursuitKey === key ? 1.4 : 0);
        if (score < best) { best = score; chosen = t; lane = load; }
      }
      if (!chosen) continue;
      z.pursuitKey = chosen.human || player;
      targetLoads.set(z.pursuitKey, (targetLoads.get(z.pursuitKey) || 0) + 1);
      const q = chosen.pos;
      const dx = q.x - p.x, dz = q.z - p.z;
      best = Math.hypot(dx,dz);
      const desiredYaw = Math.atan2(dx, dz);
      const yawError = Math.atan2(Math.sin(desiredYaw - z.group.rotation.y),
        Math.cos(desiredYaw - z.group.rotation.y));
      z.group.rotation.y += THREE.MathUtils.clamp(yawError, -4.8 * dt, 4.8 * dt);
      if (z.attackT > 0) {
        const brake = Math.exp(-dt * 11);
        z.moveX *= brake; z.moveZ *= brake;
        this._move(z, z.moveX, z.moveZ, dt);
        z.attackT = Math.max(0, z.attackT - dt);
        const target = z.attackTarget;
        if (!z.attackLanded && z.attackT <= (z.hazmat ? .45 : 0) && target &&
            (target.human ? target.human.alive : !this.playerZombie && !this.playerOut) &&
            Math.hypot(target.pos.x - p.x, target.pos.z - p.z) < HIT_RANGE &&
            Math.abs(target.pos.y - p.y) < 1.1 && this._lineClear(p, target.pos)) {
          z.attackLanded = true;
          if (target.human) this._infect(target.human);
          else {
            this.playerZombie = true;
            this.playerMaxHealth = player.hp = ZOMBIE_HEALTH;
            this.infections++;
            this.onPlayerInfected?.(false);
            this.sound?.bio('infect', p.x, p.y, p.z);
          }
        }
        if (z.attackT <= 0) z.attackTarget = null;
      } else if (best < HIT_RANGE + .18 && z.attackCd <= 0) {
        z.moveX *= .3; z.moveZ *= .3;
        z.attackT = z.hazmat ? 1.05 : .42;
        z.attackCd = z.hazmat ? 1.4 : 1.25;
        z.attackTarget = chosen;
        z.attackLanded = false;
        this._play(z, 'attack', false);
        this.sound?.bio('attack', p.x, p.y, p.z);
      } else if (best > 1.15) {
        let vx = dx / best, vz = dz / best;
        // The second and third pursuer take a side lane before closing in;
        // only the last metres converge on the actual attack target.
        if (best > 5 && lane > 0) {
          const side = lane % 2 ? 1 : -1;
          const offset = Math.min(2.5,lane * 1.25);
          const tx = q.x - vz * side * offset, tz = q.z + vx * side * offset;
          const length = Math.hypot(tx-p.x,tz-p.z) || 1;
          vx = (tx-p.x)/length; vz = (tz-p.z)/length;
        }
        const directX = vx, directZ = vz;
        // Elevated defense decks can be reached directly with a leap. When a
        // pathfinder route stalls at a crate, the same leap is a recovery move.
        const raised = q.y > p.y + .55 && q.y - p.y < LEAP_HEIGHT;
        const canLeap = raised && this._tryLeap(z, directX, directZ);
        if (!z.airborne && !canLeap && this.map.navigation && !this.map.navigation.clear(p, q)) {
          this.map.navigation.update(q);
          const steer = this.map.navigation.steer(p, q);
          if (steer) { vx = steer.x; vz = steer.z; }
        }
        const lit = this.power === 'online' && Math.abs(p.z) > 9 && Math.abs(p.x) < 12;
        const speed = ZOMBIE_RUN_SPEED * (lit ? .78 : 1) *
          (z.stagger > 0 ? HIT_MOVE_SCALE : 1);
        // Turn first, then accelerate. The old controller translated directly
        // toward the target while the mesh was still facing elsewhere.
        const headingError = Math.atan2(Math.sin(desiredYaw - z.group.rotation.y),
          Math.cos(desiredYaw - z.group.rotation.y));
        const turnGate = Math.max(0, Math.cos(headingError));
        const desiredX = z.hitBrakeT > 0 ? 0 : (z.airborne ? z.leapX : vx) * speed * turnGate;
        const desiredZ = z.hitBrakeT > 0 ? 0 : (z.airborne ? z.leapZ : vz) * speed * turnGate;
        const accel = 1 - Math.exp(-dt * ZOMBIE_ACCEL);
        z.moveX += (desiredX - z.moveX) * accel;
        z.moveZ += (desiredZ - z.moveZ) * accel;
        const beforeX = p.x, beforeZ = p.z;
        this._move(z, z.moveX, z.moveZ, dt);
        const advanced = Math.hypot(p.x - beforeX, p.z - beforeZ);
        z.stuckFor = !z.airborne && z.hitBrakeT <= 0 && advanced < speed * dt * .2
          ? z.stuckFor + dt : 0;
        if (z.stuckFor > .35) this._tryLeap(z, directX, directZ);
        const actualSpeed = advanced / Math.max(dt, .001);
        const runTarget = (z.hazmat ? 3.2 : 1.6) *
          THREE.MathUtils.clamp(actualSpeed / ZOMBIE_RUN_SPEED, .4, 1.16);
        z.runRate += (runTarget - z.runRate) * (1 - Math.exp(-dt * 8));
        this._play(z, actualSpeed > .45 ? 'run' : 'idle');
        z.actions.get('run')?.setEffectiveTimeScale(z.runRate);
      } else if (z.attackT <= 0) {
        z.moveX *= Math.exp(-dt * 9); z.moveZ *= Math.exp(-dt * 9);
        this._play(z, 'idle');
      }
      // Apply the recoil even while attacking or idling at melee range. The
      // shared movement resolver prevents it from crossing walls or actors.
      const drag = Math.exp(-dt * KNOCKBACK_DRAG);
      if (dt > 0 && Math.hypot(z.pushX, z.pushZ) > .001) {
        const step = (1 - drag) / (KNOCKBACK_DRAG * dt);
        const beforeX = p.x, beforeZ = p.z;
        this._move(z, z.pushX * step, z.pushZ * step, dt);
        if (Math.abs(p.x - beforeX) < 1e-5) z.pushX = 0;
        if (Math.abs(p.z - beforeZ) < 1e-5) z.pushZ = 0;
      }
      z.pushX *= drag;
      z.pushZ *= drag;
    }
    for (const h of aliveHumans) {
      const p = h.group.position;
      if (h.reloadT > 0) {
        h.reloadT = Math.max(0, h.reloadT - dt);
        if (h.reloadT === 0) {
          const loaded = Math.min(HUMAN_MAG_SIZE, h.reserve);
          h.ammo += loaded;
          h.reserve -= loaded;
        }
      } else if (h.ammo === 0 && h.reserve > 0) h.reloadT = 2.5;
      const threatPositions = [];
      let nearest = null, dist = Infinity, targetPlayer = false;
      for (const z of this.zombies) {
        if (z.dead) continue;
        const q = z.group.position, d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < 30 && Math.abs(q.y-p.y) < 2.5 && this._lineClear(p,q)) {
          threatPositions.push(q);
          if (d < dist) { nearest = z; dist = d; targetPlayer = false; }
        }
      }
      if (this.playerZombie && !this.playerOut) {
        const d = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
        if (d < 30 && Math.abs(player.pos.y-p.y) < 2.5 && this._lineClear(p,player.pos)) {
          threatPositions.push(player.pos);
          if (d < dist) { nearest = null; dist = d; targetPlayer = true; }
        }
      }
      h.shotCd = Math.max(0, h.shotCd - dt);
      const visible = !!(nearest || targetPlayer);
      if (visible) {
        const seen = targetPlayer ? player.pos : nearest.group.position;
        h.lastThreat = { x: seen.x, y: seen.y, z: seen.z };
        h.lastThreatT = 2.3;
      } else h.lastThreatT = Math.max(0,h.lastThreatT-dt);
      const q = visible ? (targetPlayer ? player.pos : nearest.group.position) :
        h.lastThreatT > 0 ? h.lastThreat : null;
      if (!visible && q) dist = Math.hypot(q.x-p.x,q.z-p.z);
      if (!visible && q) threatPositions.push(q);
      this._reconsiderHold(h, threatPositions, dt);
      const threatened = !!q;
      let vx = 0, vz = 0, speed = HUMAN_RUN_SPEED_AI;
      if (q && dist < 9.5) {
        // Sample legal escape directions and prefer the one that opens the
        // most distance from the entire pack, not merely the nearest ghost.
        [vx,vz] = this._escapeDirection(h,q,threatPositions.length ? threatPositions : [q]);
        speed = HUMAN_FLEE_SPEED;
      } else {
        [vx, vz] = this._humanRoute(h, this._holdPoint(h), dt);
      }
      const motion = this._moveHuman(h, vx, vz, dt, speed);
      if (q) {
        const wanted = Math.atan2(q.x - p.x, q.z - p.z);
        const error = Math.atan2(Math.sin(wanted - h.group.rotation.y),
          Math.cos(wanted - h.group.rotation.y));
        const turn = THREE.MathUtils.clamp(error, -5.6 * dt, 5.6 * dt);
        h.group.rotation.y += turn;
        h.turnRate = turn / Math.max(dt,.001);
        if (h.shotCd <= 0 && h.reloadT === 0 && h.ammo > 0 &&
            visible && dist < 27 && Math.abs(error) < .48) {
          h.shotCd = .43 + Math.random() * .18;
          h.ammo--;
          if (targetPlayer) {
            player.hp = Math.max(0, player.hp - 9);
            if (player.hp === 0) this.killPlayerZombie(player);
          } else nearest.takeDamage(12, false,
            { x: q.x - p.x, z: q.z - p.z });
          h.rig.recoil(.7);
          this.sound?.enemyShoot(p.x, p.y + 1.3, p.z, 'm4');
        }
      } else if (motion.moved > .001) {
        const wanted = Math.atan2(motion.x, motion.z);
        const error = Math.atan2(Math.sin(wanted-h.group.rotation.y),
          Math.cos(wanted-h.group.rotation.y));
        const turn = THREE.MathUtils.clamp(error,-5.6*dt,5.6*dt);
        h.group.rotation.y += turn;
        h.turnRate = turn / Math.max(dt,.001);
      } else {
        h.turnRate *= Math.exp(-dt*9);
      }
      this._animateHuman(h, dt, motion, threatened && visible);
    }
    if (this.timer <= 0) this._end('human');
    else if (this.humans.every(h => !h.alive) && (this.playerZombie || this.playerOut)) this._end('zombie');
    this.onChange?.();
  }

  onZombieDeath(z) {
    if (!z.dead || z.rewarded) return;
    z.rewarded = true;
    this.kills++;
    for (const h of this.humans) {
      if (h.alive) h.reserve = refillTwoMagazines(h.reserve, HUMAN_MAG_SIZE, HUMAN_INITIAL_RESERVE);
    }
    this.sound?.bio('death', z.group.position.x, z.group.position.y, z.group.position.z);
    this.onZombieKilled?.(z);
    this.onChange?.();
  }

  _end(winner) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.onRoundEnd?.(winner);
  }

  status() {
    return { phase: this.phase, time: this.timer, humans: this.humans.filter(h => h.alive).length +
      (!this.playerZombie && !this.playerOut ? 1 : 0),
      zombies: this.zombies.length + (this.playerZombie ? 1 : 0),
      playerZombie: this.playerZombie, kills: this.kills, infections: this.infections,
      playerRespawnT: this.playerRespawnT,
      power: this.power, powerRepair: this.powerRepair / POWER_REPAIR_TIME,
      powerTime: this.powerTime };
  }
}
