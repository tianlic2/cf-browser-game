import * as THREE from 'three';
import { cloneSkinned } from './skinned_clone.js';
import { makeGLTFLoader } from './gltf.js';
import { FoxSoldierRig } from './fox_soldier.js?v=fox-published-1';
import { intersectsBrush } from './brush_collision.js?v=goldsrc-visible-wall-1';
import { enemyModel } from './guncatalog.js?v=weapon-world-3';
import { HUMAN_RUN_SPEED } from './move_speed.js?v=bio-arena-1';
import { overlapsActors, sweepActorAxis, findActorSpawn } from './actor_collision.js';
import { BIO_DAMAGE_MILESTONE, BIO_NPC_COUNT, BIO_INITIAL_ZOMBIES, BIO_ZOMBIE_HEALTH, bioHumanDamageMultiplier,
  ZOMBIE_RESPAWN_SECONDS, crossedDamageMilestones, refillTwoMagazines } from './bio_rules.js?v=initial-eight-1';
import { chooseAttackSlot, chooseIntent, combatPositionScore, createDirector,
  directorProfile, humanRole, localAvoidanceVector, recoveryStage, seededTraits,
  updateDirector, zombieRole, zombieTargetScore } from './bio_ai.js?v=bio-tactical-2';
import { BIO_HUMAN_SENSE_INTERVAL, BIO_ZOMBIE_ROUTE_INTERVAL,
  BIO_ZOMBIE_SENSE_INTERVAL, bioAnimationInterval, bioBudgetDue,
  bioSenseOffset } from './bio_performance.js?v=bio-lod-1';
import { createNpcNamePool } from './npc_names.js';
import { bioSourceRules } from './bio_source_rules.js';

const ASSET = new URL('../assets/bio/zombie/', import.meta.url).href;
const CLIPS = ['idle', 'run', 'attack', 'hit', 'death', 'scream'];
// Zombie meshes are fitted to 1.84 m. Hits above this height relative to
// their feet count as headshots, including body-tagged meshes and the proxy.
const BIO_ZOMBIE_HEAD_HEIGHT = 1.48;
const ROUND = 180;
const HIT_RANGE = 1.58;
const LEAP_UP = 8;
const LEAP_GRAVITY = 18;
const ZOMBIE_RUN_SPEED = HUMAN_RUN_SPEED;
const HIT_MOVE_SCALE = .52;
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
const HUMAN_MEMORY_SECONDS = 4.2;
const ZOMBIE_MEMORY_SECONDS = 5.5;
const HUMAN_SIGHT_RANGE = 31;
const ZOMBIE_SIGHT_RANGE = 34;
const HUMAN_HEARING_RANGE = 18;
const ZOMBIE_HEARING_RANGE = 24;
const ZOMBIE_ATTACK_SLOTS = 8;
const ZOMBIE_ATTACK_RADIUS = 1.27;
const LOCAL_AVOIDANCE_NEIGHBORS = 6;

export class BioMode {
  constructor({ scene, camera = null, sound, onPlayerInfected, onPlayerRespawn, onRoundEnd, onZombieKilled,
    onDamageMilestone, onDamageProgress, onSupplyReward, onChange }) {
    this.scene = scene;
    this.camera = camera;
    this.sound = sound;
    this.onPlayerInfected = onPlayerInfected;
    this.onPlayerRespawn = onPlayerRespawn;
    this.onRoundEnd = onRoundEnd;
    this.onZombieKilled = onZombieKilled;
    this.onDamageMilestone = onDamageMilestone;
    this.onDamageProgress = onDamageProgress;
    this.onSupplyReward = onSupplyReward;
    this.onChange = onChange;
    this.phase = 'off';
    this.playerZombie = false;
    this.playerOut = false;
    this.humans = [];
    this.zombies = [];
    this.timer = 0;
    this.kills = 0;
    this.playerKills = 0;
    this.infections = 0;
    this.playerDamage = 0;
    this.rules = bioSourceRules();
    this.humanDamageMultiplier = 1;
    this.liveElapsed = 0;
    this.nextBgmAt = 0;
    this._playerAttack = 0;
    this.playerMaxHealth = 100;
    this.playerRespawnT = 0;
    this.aiTime = 0;
    this.director = createDirector();
    this.combatHeat = 0;
    this.playerNoise = null;
    this._viewFrustum = new THREE.Frustum();
    this._viewProjection = new THREE.Matrix4();
    this._viewSphere = new THREE.Sphere(new THREE.Vector3(), 1.35);
    this._viewValid = false;
    this._localColliderCache = new Map();
    this.performance = this._newPerformanceStats();
  }

  _newPerformanceStats() {
    return { senseRefreshes: 0, lineOfSightRays: 0, navigationRefreshes: 0,
      animationUpdates: 0, animationSkips: 0, colliderCandidates: 0,
      localAvoidanceQueries: 0, tacticalPositionQueries: 0,
      recoveryTransitions: 0, attackSlotAssignments: 0 };
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
    this.map?.zone13Events?.reset?.(null);
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
    this.aiTime = 0;
    this.director = createDirector();
    this.combatHeat = 0;
    this.playerNoise = null;
    this.playerDamage = 0;
    this.playerKills = 0;
    this.humanDamageMultiplier = 1;
    this.liveElapsed = 0;
    this.nextBgmAt = 0;
    this._viewValid = false;
    this._localColliderCache.clear();
    this.performance = this._newPerformanceStats();
    this.onChange?.();
  }

  start(map, player = null) {
    this.clear();
    this.map = map;
    this.map?.zone13Events?.reset?.(this.sound);
    this.rules = bioSourceRules(map.bio?.ruleVariant);
    if (player) player.hp = this.rules.humanHealth;
    this.playerRef = player;
    this.phase = 'prepare';
    this.timer = this.rules.preparationSeconds;
    this.kills = this.infections = 0;
    const spawns = map.bio?.humans || map.spawns.player;
    const mercenaryNames = createNpcNamePool(Math.min(BIO_NPC_COUNT, spawns.length));
    for (let i = 0; i < Math.min(BIO_NPC_COUNT, spawns.length); i++) {
      const [x, y, z] = spawns[i];
      const spot = this._findSpawn(x, y, z);
      if (!spot) continue;
      const group = new THREE.Group();
      const rig = new FoxSoldierRig(enemyModel('m4'));
      group.add(rig.root);
      group.position.fromArray(spot);
      group.rotation.y = Math.PI;
      this.scene.add(group);
      this.humans.push({ group, rig, alive: true, infected: false,
        name: mercenaryNames[i], shotCd: .3 + i * .23,
        hold: i % (map.bio?.holdPoints?.length || 1), panic: 0, hp: this.rules.humanHealth,
        ammo: HUMAN_MAG_SIZE, reserve: HUMAN_INITIAL_RESERVE, reloadT: 0,
        routeT: 0, routeX: 0, routeZ: 0, moveX: 0, moveZ: 0,
        strafeSide: i % 2 ? 1 : -1, holdDecisionT: 2 + i * .35,
        lastThreat: null, lastThreatT: 0, turnRate: 0,
        traits: seededTraits(i, 'human'), role: 'anchor', intent: 'hold', intentT: 0,
        decisionT: .12 + i * .035, acquireT: 0, burstLeft: 2 + i % 3,
        shotNoiseT: 0, sharedThreat: null, sharedThreatT: 0,
        searchSide: i % 2 ? 1 : -1, threatVisible: false,
        airborne: false, jumpVelocity: 0, jumpTime: 0, jumpCooldown: 0,
        leapX: 0, leapZ: 0,
        stuckFor: 0, recoveryStage: 0, recoverySide: i % 2 ? 1 : -1,
        recoveryGoal: null, combatGoal: null, combatGoalT: 0,
        aimFocus: 0, lastAimX: NaN, lastAimZ: NaN,
        senseT: bioSenseOffset(i, Math.min(BIO_NPC_COUNT, spawns.length), BIO_HUMAN_SENSE_INTERVAL),
        senseCache: [], animLodT: 0,
        animMotion: { moved: 0, x: 0, z: 0, aimed: false } });
    }
    for (const crate of map.bio?.weaponCrates || []) {
      crate.active = true; crate.claimed = false; if (crate.mesh) crate.mesh.visible = true;
    }
    for (const wave of map.bio?.supplyWaves || []) {
      wave.deployed = wave.claimed = false; if (wave.mesh) wave.mesh.visible = false;
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
    const zombieHealth = BIO_ZOMBIE_HEALTH;
    const actor = { group, model, mother, hazmat, name, headshotHeight: BIO_ZOMBIE_HEAD_HEIGHT, health: zombieHealth,
      maxHealth: zombieHealth, dead: false, meshes: [], combatAt: -Infinity,
      attackT: 0, attackCd: 1.1, attackTarget: null, attackLanded: false,
      stagger: 0, pushX: 0, pushZ: 0, hitBrakeT: 0,
      moveX: 0, moveZ: 0, runRate: 1, hitT: 0, hitSide: 1,
      airborne: false, jumpVelocity: 0, jumpTime: 0, jumpCooldown: 0,
      leapX: 0, leapZ: 0, stuckFor: 0,
      recoveryStage: 0, recoverySide: this.zombies.length % 2 ? 1 : -1,
      recoveryGoal: null, attackSlotIndex: null, attackSlotTarget: null,
      flashT: 0, deathT: 0, restY: model.position.y, regenT: 0, lowHealth: false,
      respawnT: 0, rewarded: false,
      pursuitKey: null, pursuitMemory: 0, lastKnown: null,
      role: zombieRole(this.zombies.length, this.director.serial),
      traits: seededTraits(this.zombies.length, 'zombie'),
      decisionT: 0, commitT: 0, heardTarget: false, visibleTarget: false,
      flankSide: this.zombies.length % 2 ? 1 : -1, searchAngle: 0,
      senseT: bioSenseOffset(this.zombies.length, BIO_NPC_COUNT, BIO_ZOMBIE_SENSE_INTERVAL),
      senseCache: new Map(), routeT: 0, routeX: 0, routeZ: 0,
      routeGoalX: NaN, routeGoalZ: NaN, animLodT: 0,
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
      amount *= this.humanDamageMultiplier;
      actor.health = Math.max(0, actor.health - amount);
      actor.regenT = 0;
      actor.lowHealth = actor.health > 0 && actor.health <= this.rules.lowHealthBlink;
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

  _updateViewFrustum() {
    const camera = this.camera;
    if (!camera) { this._viewValid = false; return; }
    // main.js 已经写好本帧相机旋转；这里仅刷新矩阵用于 CPU 侧视锥判断。
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    this._viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._viewFrustum.setFromProjectionMatrix(this._viewProjection);
    this._viewValid = true;
  }

  _actorInView(actor) {
    if (!this._viewValid) return true;
    const p = actor.group?.position || actor.pos;
    if (!p) return true;
    this._viewSphere.center.set(p.x, p.y + .95, p.z);
    return this._viewFrustum.intersectsSphere(this._viewSphere);
  }

  _animationStep(actor, dt) {
    actor.animLodT = (actor.animLodT || 0) + dt;
    const p = actor.group?.position || actor.pos;
    const player = this.playerRef?.pos || this.playerRef;
    const distance = p && player ? Math.hypot(p.x - player.x, p.z - player.z) : 0;
    const interval = bioAnimationInterval(this._actorInView(actor), distance);
    if (!bioBudgetDue(actor.animLodT, interval)) {
      this.performance.animationSkips++;
      return null;
    }
    const elapsed = Math.min(.25, actor.animLodT);
    actor.animLodT = 0;
    this.performance.animationUpdates++;
    return elapsed;
  }

  // GoldSrc 图有上千个凸叶，但 GroundNavigation 已按网格建立了局部碰撞表。
  // 人物每个轴只检查脚下单元附近的几十个候选，判定公式本身完全不变。
  _nearbyColliders(x, z) {
    const navigation = this.map?.navigation;
    if (!navigation?.local || typeof navigation.cell !== 'function') return this.map?.colliders || [];
    const cell = navigation.cell(x, z);
    if (cell < 0) return [];
    const cached = this._localColliderCache.get(cell);
    if (cached) return cached;
    // local[cell] 的生成余量是 .6m；人物半径 .45m 再加半个网格可能略超出它。
    // 合并 3×3 单元可覆盖边界，同时仍远小于整张地图的 1541 个凸叶。
    const out = [], seen = new Set();
    const cx = cell % navigation.w, cz = Math.floor(cell / navigation.w);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nx >= navigation.w || nz < 0 || nz >= navigation.h) continue;
      for (const collider of navigation.local[nz * navigation.w + nx] || []) {
        if (seen.has(collider)) continue;
        seen.add(collider); out.push(collider);
      }
    }
    this._localColliderCache.set(cell, out);
    return out;
  }

  _findSpawn(x, y, z) {
    const valid = (px, py, pz) => this._canMove(px, pz, py, .45, null, false) &&
      Math.abs((this.map.navigation?.heightAt(px, pz, py) ?? py) - py) < .7;
    return findActorSpawn(x, y, z, this._bodies(), valid);
  }

  _floorAt(x, z, feetY) {
    const step = this.map.stepHeight ?? .5;
    const ceiling = feetY + step + .035;
    const navFloor = this.map.navigation?.heightAt(x, z, ceiling) ?? -Infinity;
    if (Number.isFinite(navFloor) && navFloor >= feetY - .05) return navFloor;
    return Math.max(navFloor,
      this.map.supportSurfaceAt?.(x, z, ceiling, .95) ?? -Infinity);
  }

  _canMove(x, z, y, radius = .45, self = null, checkActors = true) {
    const b = this.map.bounds;
    if (Math.abs(x) > b.hw - radius || Math.abs(z) > b.hl - radius) return false;
    // Source NAV can contain several floors under the same X/Z. A query made a
    // few millimetres below the current polygon used to select the next floor
    // down and teleport an NPC through the building. NPC walking is limited to
    // an ordinary step in both directions; deliberate leaps use _updateLeap.
    if (!self?.airborne) {
      const floor = this._floorAt(x, z, y);
      if (!Number.isFinite(floor) || Math.abs(floor - y) > (this.map.stepHeight ?? .5) + .055)
        return false;
    }
    const colliders = this._nearbyColliders(x, z);
    this.performance.colliderCandidates += colliders.length;
    return (self?.airborne || !this.map.canTraverse || this.map.canTraverse(x, z, y, this.map.stepHeight ?? .5)) &&
      (!self || !this.map.npcCanMove || this.map.npcCanMove(self.group.position.x, self.group.position.z, x, z, y, radius, !!self.airborne)) &&
      !colliders.some(c => intersectsBrush(c, x, z, y, radius,
      self?.airborne ? 0 : (this.map.stepHeight ?? .5), 1.78, colliders,
      this.map.navigation?.surfaceAt, this.map.navigation?.blockerAt)) &&
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
    if (!a.lastSafePosition) a.lastSafePosition = [p.x, p.y, p.z];
    const bodies = this._bodies();
    // Step off a low ledge under gravity instead of snapping back forever to
    // the last position on a crate whose top is absent from Source NAV.
    if (!a.airborne && Math.hypot(vx, vz) > .01) {
      const nx = p.x + vx * dt, nz = p.z + vz * dt;
      const floor = this._floorAt(nx, nz, p.y);
      const drop = p.y - floor;
      if (Number.isFinite(floor) && drop > (this.map.stepHeight ?? .5) + .055 && drop <= 1.5 &&
          (!this.map.canMoveSegment || this.map.canMoveSegment(p.x, p.z, nx, nz, p.y, 0, 1.78, .45))) {
        const speed = Math.hypot(vx, vz);
        a.airborne = true; a.jumpVelocity = 0; a.jumpTime = 0;
        a.leapX = vx / speed; a.leapZ = vz / speed;
      }
    }
    const dx = sweepActorAxis(p.x, vx * dt, p.z, p.y, bodies, a, 'x');
    const nx = p.x + dx;
    const floorX = !a.airborne ? Math.max(this._floorAt(nx, p.z, p.y),
      this._actorSupport({ x: nx, y: p.y, z: p.z }, a, bodies)) : p.y;
    if (this._canMove(nx, p.z, p.y, .45, a, false) &&
        (!this.map.canMoveSegment || this.map.canMoveSegment(p.x, p.z, nx, p.z, p.y,
          a.airborne ? 0 : (this.map.stepHeight ?? .5), 1.78, .45, !a.airborne)) &&
        !overlapsActors(nx, floorX, p.z, bodies, a)) p.x = nx;
    const dz = sweepActorAxis(p.z, vz * dt, p.x, p.y, bodies, a, 'z');
    const nz = p.z + dz;
    const floorZ = !a.airborne ? Math.max(this._floorAt(p.x, nz, p.y),
      this._actorSupport({ x: p.x, y: p.y, z: nz }, a, bodies)) : p.y;
    if (this._canMove(p.x, nz, p.y, .45, a, false) &&
        (!this.map.canMoveSegment || this.map.canMoveSegment(p.x, p.z, p.x, nz, p.y,
          a.airborne ? 0 : (this.map.stepHeight ?? .5), 1.78, .45, !a.airborne)) &&
        !overlapsActors(p.x, floorZ, nz, bodies, a)) p.z = nz;
    if (!a.airborne) {
      const floor = Math.max(this._floorAt(p.x, p.z, p.y), this._actorSupport(p, a, bodies));
      if (Number.isFinite(floor) && Math.abs(floor - p.y) <= (this.map.stepHeight ?? .5) + .055) {
        p.y = floor;
        a.lastSafePosition = [p.x, p.y, p.z];
      } else {
        p.fromArray(a.lastSafePosition);
        a.moveX = a.moveZ = 0;
        a.routeT = 0;
      }
    }
  }

  // Leap only over a low obstacle ahead. Tall perimeter walls remain solid.
  _tryLeap(a, vx, vz) {
    if (a.airborne || a.jumpCooldown > 0) return false;
    const p = a.group.position;
    const length = Math.hypot(vx, vz);
    if (length < .01) return false;
    vx /= length; vz /= length;
    const leapGravity = LEAP_GRAVITY * this.rules.zombieGravity;
    const leapHeight = LEAP_UP * LEAP_UP / (2 * leapGravity);
    const step = this.map.stepHeight ?? .5;
    let landing = null;
    for (const distance of [.7, 1, 1.3]) {
      const x = p.x + vx * distance, z = p.z + vz * distance;
      if (this._canMove(x, z, p.y, .45, a, false) &&
          (!this.map.canMoveSegment || this.map.canMoveSegment(p.x, p.z, x, z, p.y, step, 1.78, .45))) continue;
      const top = this.map.supportSurfaceAt?.(x, z, p.y + leapHeight - .08, .25) ?? -Infinity;
      if (top <= p.y + step + .035 || top > p.y + leapHeight - .08) continue;
      if (this.map.hasVerticalClearance && !this.map.hasVerticalClearance(x, z, top + .04, 1.78, .4)) continue;
      if (!this._canMove(x, z, top + .04, .45, a, false)) continue;
      landing = top;
      break;
    }
    if (landing === null) return false;
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
    const leapGravity = LEAP_GRAVITY * this.rules.zombieGravity;
    const next = p.y + a.jumpVelocity * dt - leapGravity * dt * dt * .5;
    a.jumpVelocity -= leapGravity * dt;
    a.jumpTime += dt;
    const ground = Math.max(this.map.navigation?.heightAt(p.x, p.z, Math.max(p.y, next)) ?? -Infinity,
      this.map.landingSurfaceAt?.(p.x, p.z, p.y, .55) ?? -Infinity,
      this._actorSupport(p, a));
    if (next > p.y && this.map.hasVerticalClearance &&
        !this.map.hasVerticalClearance(p.x, p.z, next, 1.78, .4)) a.jumpVelocity = 0;
    if (a.jumpVelocity <= 0 && next <= ground) {
      p.y = ground;
      a.airborne = false;
      a.jumpVelocity = 0;
      if (a.model) a.model.rotation.x = 0;
    } else {
      if (a.jumpVelocity !== 0 || next <= p.y) p.y = next;
      if (a.model) a.model.rotation.x = -.18 * Math.sin(Math.min(1, a.jumpTime / .9) * Math.PI);
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
    this.director.shock = 1;
    this.combatHeat = 1;
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
    z.lastSafePosition = [...spot];
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
    z.stuckFor = z.flashT = z.regenT = 0; z.lowHealth = false; z.runRate = 1;
    z.recoveryStage = 0; z.recoveryGoal = null;
    z.attackSlotIndex = null; z.attackSlotTarget = null;
    z.pursuitKey = null; z.pursuitMemory = 0; z.lastKnown = null;
    z.decisionT = z.commitT = 0;
    z.heardTarget = z.visibleTarget = false;
    z.senseT = 0; z.senseCache = new Map();
    z.routeT = 0; z.routeGoalX = z.routeGoalZ = NaN; z.animLodT = 0;
    z.role = zombieRole(this.zombies.indexOf(z), this.director.serial);
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
    player.hp = this.playerMaxHealth = BIO_ZOMBIE_HEALTH;
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
    this._advanceZombieKill();
    this.sound?.bio('death', player.pos.x, player.pos.y, player.pos.z);
    this.onChange?.();
    return true;
  }

  onPlayerNoise(position, kind = 'shot') {
    if (this.phase !== 'live' || this.playerZombie || this.playerOut || !position) return;
    const duration = kind === 'shot' ? 1.25 : .45;
    this.playerNoise = { x: position.x, y: position.y, z: position.z,
      radius: kind === 'shot' ? ZOMBIE_HEARING_RANGE : 10, time: duration, kind };
    this.combatHeat = Math.min(1, this.combatHeat + (kind === 'shot' ? .16 : .04));
  }

  _chooseMother(player) {
    // Select only existing NPCs, without replacement; the player starts human.
    const candidates = this.humans.filter(h => h.alive);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    let spawned = 0;
    for (const h of candidates) {
      if (spawned >= BIO_INITIAL_ZOMBIES) break;
      h.alive = false;
      this.scene.remove(h.group);
      const p = h.group.position;
      if (this.spawnZombie(p.x, p.y, p.z, spawned === 0, h.name)) spawned++;
      else { h.alive = true; this.scene.add(h.group); }
    }
    // Play one global warning even when the second mother is selected.
    this.sound?.bio('mother');
    this.phase = 'live';
    this.timer = this.rules.roundSeconds || ROUND;
    this.liveElapsed = 0;
    this.onChange?.();
  }

  tryInteract(player) {
    if (this.phase !== 'live' || this.playerZombie || this.playerOut) return null;
    const entries = [...(this.map.bio?.weaponCrates || []), ...(this.map.bio?.supplyWaves || [])]
      .filter((entry) => entry.active !== false && !entry.claimed && (entry.kind === 'weapon' || entry.deployed));
    let best = null, distance = 2.25;
    for (const entry of entries) {
      const position = entry.position || (entry.mesh ? entry.mesh.position.toArray() : null);
      if (!position) continue;
      const d = Math.hypot(player.pos.x - position[0], player.pos.z - position[2]);
      if (d < distance && Math.abs(player.pos.y - position[1]) < 1.8) { best = entry; distance = d; }
    }
    if (!best) return null;
    best.claimed = true; best.active = false;
    if (best.collider) best.collider.active = false;
    if (best.mesh) best.mesh.visible = false;
    const reward = best.kind === 'weapon'
      ? { type: 'weapon', id: this.rules.weaponRewards[Math.floor(Math.random() * this.rules.weaponRewards.length)] }
      : { type: 'supply', ammo: 'full', grenades: ['frag', 'flash', 'smoke'] };
    this.onSupplyReward?.(reward);
    this.sound?.bio('supply');
    this.onChange?.();
    return reward;
  }

  recordPlayerDamage(amount) {
    if (this.phase !== 'live' || this.playerZombie || this.playerOut || !(amount > 0)) return [];
    const previous = this.playerDamage;
    this.playerDamage += amount;
    const hundredCrossed = crossedDamageMilestones(previous, this.playerDamage, 100);
    if (hundredCrossed.length) this.onDamageProgress?.({ thresholds: hundredCrossed, total: this.playerDamage });
    const crossed = crossedDamageMilestones(previous, this.playerDamage, BIO_DAMAGE_MILESTONE);
    for (const threshold of crossed) this.onDamageMilestone?.({
      threshold, total: this.playerDamage, tier: threshold / BIO_DAMAGE_MILESTONE,
    });
    this.onChange?.();
    return crossed;
  }

  recordPlayerKill() {
    if (this.phase !== 'live' || this.playerZombie || this.playerOut) return;
    this.playerKills++;
    this.onChange?.();
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
    if (this.map.lineClear) {
      this.performance.lineOfSightRays++;
      return this.map.lineClear(a, b);
    }
    const dir = new THREE.Vector3(b.x - a.x, (b.y || 0) - (a.y || 0), b.z - a.z);
    const dist = dir.length();
    if (dist < .01) return true;
    this.performance.lineOfSightRays++;
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
    this._updateLeap(h, dt);
    const intendedX = vx, intendedZ = vz;
    if (!h.airborne && h.stuckFor > .62) this._tryLeap(h, intendedX, intendedZ);
    let length = Math.hypot(vx, vz);
    if (h.airborne) {
      vx = h.leapX; vz = h.leapZ; length = Math.hypot(vx, vz);
    } else if (length > .001) {
      [vx, vz] = this._localSteer(h, vx, vz, speed);
      [vx, vz] = this._recoverySteer(h, vx, vz, 'human');
      length = Math.hypot(vx, vz);
    }
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
    this._trackProgress(h, moved, length > .001 ? speed * dt : 0, dt);
    return { moved, speed: moved / Math.max(dt, .001), x: actualX, z: actualZ };
  }

  _animateHuman(h, dt, motion, aimed) {
    // 位置/碰撞仍逐帧；把多帧真实位移累积后再推进一次骨骼，步频不会因为 LOD 变慢。
    const acc = h.animMotion || (h.animMotion = { moved: 0, x: 0, z: 0, aimed: false });
    acc.moved += motion.moved;
    acc.x += motion.x;
    acc.z += motion.z;
    acc.aimed = aimed;
    const animDt = this._animationStep(h, dt);
    if (animDt === null) return;
    const yaw = h.group.rotation.y;
    const length = Math.max(acc.moved, .0001);
    const forward = (acc.x * Math.sin(yaw) + acc.z * Math.cos(yaw)) / length;
    const side = (acc.x * Math.cos(yaw) - acc.z * Math.sin(yaw)) / length;
    h.rig.animate(animDt, { moved: acc.moved, speed: acc.moved / Math.max(animDt, .001),
      aim: acc.aimed ? 1 : .48, moveForward: forward, moveSide: side,
      reload: h.reloadT > 0 ? 1 - h.reloadT / 2.5 : 0,
      turnRate: h.turnRate || 0 });
    acc.moved = acc.x = acc.z = 0;
  }

  _canSee(group, target, range, cone = -.18) {
    const p = group.position || group.pos || group;
    const dx = target.x - p.x, dz = target.z - p.z;
    const distance = Math.hypot(dx, dz);
    if (distance > range || Math.abs((target.y || 0) - (p.y || 0)) > 3.2) return false;
    if (distance > 4.2) {
      const yaw = group.rotation?.y ?? group.yaw ?? 0;
      const facing = (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / Math.max(.001, distance);
      if (facing < cone) return false;
    }
    return this._lineClear(p, target);
  }

  _targetIsolation(target, targets) {
    let neighbors = 0;
    for (const other of targets) {
      if (other === target) continue;
      if (Math.hypot(other.pos.x - target.pos.x, other.pos.z - target.pos.z) < 7) neighbors++;
    }
    return neighbors === 0 ? 1 : neighbors === 1 ? .35 : 0;
  }

  _targetMotion(target, player) {
    if (target.human) return { x: target.human.moveX || 0, z: target.human.moveZ || 0 };
    return { x: player.vel?.x || 0, z: player.vel?.z || 0 };
  }

  _neighborSamples(actor) {
    const p = actor.group?.position || actor.pos;
    if (!p) return [];
    return this._bodies().filter(other => other !== actor).map(other => {
      const q = other.group?.position || other.pos;
      return q ? { x: q.x, z: q.z, vx: other.moveX || other.vel?.x || 0,
        vz: other.moveZ || other.vel?.z || 0, radius: .45,
        distance: Math.hypot(q.x - p.x, q.z - p.z) } : null;
    }).filter(Boolean).sort((a, b) => a.distance - b.distance)
      .slice(0, LOCAL_AVOIDANCE_NEIGHBORS);
  }

  _localSteer(actor, vx, vz, speed) {
    const p = actor.group?.position || actor.pos;
    const steered = localAvoidanceVector({ position: p, desired: { x: vx, z: vz }, speed,
      neighbors: this._neighborSamples(actor), sideBias: actor.recoverySide || actor.flankSide || 1 });
    this.performance.localAvoidanceQueries++;
    if (actor.airborne || Math.hypot(steered.x, steered.z) < .01) return [steered.x, steered.z];
    const probe = .78;
    if (this._canMove(p.x + steered.x * probe, p.z + steered.z * probe,
      p.y, .45, actor, false)) return [steered.x, steered.z];
    const angle = .72;
    const candidates = [actor.recoverySide || 1, -(actor.recoverySide || 1)].map(side => {
      const c = Math.cos(angle * side), s = Math.sin(angle * side);
      return { x: steered.x * c - steered.z * s, z: steered.x * s + steered.z * c, side };
    });
    const clear = candidates.find(dir => this._canMove(p.x + dir.x * probe,
      p.z + dir.z * probe, p.y, .45, actor, false));
    if (clear) { actor.recoverySide = clear.side; return [clear.x, clear.z]; }
    return [steered.x, steered.z];
  }

  _pickRecoveryGoal(actor, vx, vz) {
    const p = actor.group.position;
    const base = Math.atan2(vx, vz);
    const side = actor.recoverySide || 1;
    const turns = [side * Math.PI / 2, -side * Math.PI / 2,
      side * Math.PI * .72, -side * Math.PI * .72, Math.PI];
    for (const radius of [1.05, 1.65, 2.25]) for (const turn of turns) {
      const angle = base + turn;
      const x = p.x + Math.sin(angle) * radius, z = p.z + Math.cos(angle) * radius;
      const y = this._floorAt(x, z, p.y);
      if (Number.isFinite(y) && Math.abs(y - p.y) <= (this.map.stepHeight ?? .5) + .055 &&
          this._canMove(x, z, p.y, .45, actor, false))
        return { x, y, z };
    }
    return null;
  }

  _recoverySteer(actor, vx, vz, kind) {
    const stage = recoveryStage(actor.stuckFor);
    if (stage !== actor.recoveryStage) {
      actor.recoveryStage = stage;
      this.performance.recoveryTransitions++;
      if (stage >= 2) actor.recoverySide *= -1;
      if (stage >= 3) {
        actor.routeT = 0;
        actor.recoveryGoal = this._pickRecoveryGoal(actor, vx, vz);
      }
    }
    if (stage === 0) return [vx, vz];
    const length = Math.hypot(vx, vz) || 1;
    const dx = vx / length, dz = vz / length, side = actor.recoverySide || 1;
    if (stage === 1) return [dx * .38 - dz * side * .92, dz * .38 + dx * side * .92];
    if (stage === 2) return [-dx * .46 - dz * side * .88, -dz * .46 + dx * side * .88];
    const goal = actor.recoveryGoal;
    if (goal) {
      const p = actor.group.position, gx = goal.x - p.x, gz = goal.z - p.z;
      const d = Math.hypot(gx, gz);
      if (d > .28) return [gx / d, gz / d];
      actor.recoveryGoal = null;
    }
    if (kind === 'zombie') this._tryLeap(actor, dx, dz);
    return [-dz * side, dx * side];
  }

  _trackProgress(actor, moved, intended, dt) {
    if (intended < .001 || actor.airborne || actor.hitBrakeT > 0) {
      actor.stuckFor = Math.max(0, actor.stuckFor - dt * 2.5);
      return;
    }
    if (moved < intended * .24) actor.stuckFor += dt;
    else actor.stuckFor = Math.max(0, actor.stuckFor - dt * 3.2);
    if (actor.stuckFor < .08) {
      actor.recoveryStage = 0;
      actor.recoveryGoal = null;
    }
  }

  _attackSlot(z, chosen, targetMotion, reservations) {
    if (chosen.patrol || !chosen.key) {
      z.attackSlotIndex = null; z.attackSlotTarget = null;
      return chosen.navPos;
    }
    const key = chosen.key;
    let reserved = reservations.get(key);
    if (!reserved) { reserved = new Set(); reservations.set(key, reserved); }
    const target = { x: chosen.pos.x + targetMotion.x * .12, y: chosen.pos.y,
      z: chosen.pos.z + targetMotion.z * .12 };
    const slot = chooseAttackSlot({ agent: z.group.position, target, reserved,
      count: ZOMBIE_ATTACK_SLOTS, radius: ZOMBIE_ATTACK_RADIUS,
      phase: (this.director.serial % 2) * Math.PI / ZOMBIE_ATTACK_SLOTS,
      preferredIndex: z.attackSlotTarget === key ? z.attackSlotIndex : null,
      canOccupy: candidate => {
        const floor = this._floorAt(candidate.x, candidate.z, target.y);
        return Number.isFinite(floor) && Math.abs(floor - target.y) < .72 &&
          this._canMove(candidate.x, candidate.z, floor, .42, z, false);
      } });
    if (slot) {
      reserved.add(slot.index);
      if (z.attackSlotIndex !== slot.index || z.attackSlotTarget !== key)
        this.performance.attackSlotAssignments++;
      z.attackSlotIndex = slot.index; z.attackSlotTarget = key;
      return { x: slot.x, y: this._floorAt(slot.x, slot.z, target.y), z: slot.z };
    }
    z.attackSlotIndex = null; z.attackSlotTarget = key;
    const index = Math.max(0, this.zombies.indexOf(z));
    const angle = index / Math.max(1, this.zombies.length) * Math.PI * 2;
    return { x: target.x + Math.sin(angle) * 2.35, y: target.y,
      z: target.z + Math.cos(angle) * 2.35 };
  }

  _positionKey(x, z) {
    return `${Math.round(x / 1.2)},${Math.round(z / 1.2)}`;
  }

  _humanCombatGoal(h, target, threats, reservations) {
    h.combatGoalT = Math.max(0, (h.combatGoalT || 0));
    if (h.combatGoal && h.combatGoalT > 0) {
      reservations.add(this._positionKey(h.combatGoal[0], h.combatGoal[2]));
      return h.combatGoal;
    }
    const p = h.group.position;
    const preferred = h.role === 'scout' ? 12.5 : h.role === 'support' ? 15 : 18;
    const candidates = [{ x: p.x, z: p.z, repeated: 0 }];
    const phase = (this.humans.indexOf(h) % 6) * Math.PI / 6;
    for (const radius of [preferred - 2, preferred + 2])
      for (let i = 0; i < 6; i++) {
        const angle = phase + i / 6 * Math.PI * 2;
        candidates.push({ x: target.x + Math.sin(angle) * radius,
          z: target.z + Math.cos(angle) * radius, repeated: i === 0 ? 1 : 0 });
      }
    let best = null, bestScore = -Infinity;
    for (const candidate of candidates) {
      const floor = this._floorAt(candidate.x, candidate.z, p.y);
      if (!Number.isFinite(floor) || Math.abs(floor - p.y) > 1.2 ||
          !this._canMove(candidate.x, candidate.z, floor, .45, h, false)) continue;
      const key = this._positionKey(candidate.x, candidate.z);
      const crowd = reservations.has(key) ? 1 : this.humans.filter(other => other !== h && other.alive &&
        Math.hypot((other.combatGoal?.[0] ?? other.group.position.x) - candidate.x,
          (other.combatGoal?.[2] ?? other.group.position.z) - candidate.z) < 2.2).length;
      const eye = { x: candidate.x, y: floor + 1.25, z: candidate.z };
      const aim = { x: target.x, y: target.y + 1.05, z: target.z };
      const visible = this._lineClear(eye, aim);
      const tx = candidate.x - target.x, tz = candidate.z - target.z;
      const targetDistance = Math.hypot(tx, tz), inv = 1 / Math.max(.001, targetDistance);
      const tucked = { x: candidate.x + tx * inv * .85, y: floor + .85,
        z: candidate.z + tz * inv * .85 };
      const cover = visible && !this._lineClear(tucked, aim) ? 1 : 0;
      const danger = threats.length ? Math.min(...threats.map(q =>
        Math.hypot(candidate.x - q.x, candidate.z - q.z))) : targetDistance;
      const pathCost = Math.hypot(candidate.x - p.x, candidate.z - p.z) *
        (this.map.navigation?.clear(p, { x:candidate.x,y:floor,z:candidate.z }) === false ? 1.28 : 1);
      const flank = Math.abs((candidate.x-target.x)*(p.z-target.z) -
        (candidate.z-target.z)*(p.x-target.x)) / Math.max(1,targetDistance*preferred);
      const score = combatPositionScore({ pathCost, targetDistance,
        preferredDistance: preferred, visible, cover, crowd, danger,
        repeated: candidate.repeated, flank });
      this.performance.tacticalPositionQueries++;
      if (score > bestScore) { bestScore = score; best = [candidate.x, floor, candidate.z]; }
    }
    h.combatGoal = best || this._holdPoint(h);
    h.combatGoalT = 1.02 + this.humans.indexOf(h) % 4 * .12;
    reservations.add(this._positionKey(h.combatGoal[0], h.combatGoal[2]));
    return h.combatGoal;
  }

  _friendInLineOfFire(h, target, humans) {
    const p = h.group.position;
    const dx = target.x - p.x, dz = target.z - p.z;
    const length2 = dx * dx + dz * dz;
    if (length2 < .01) return false;
    for (const mate of humans) {
      if (mate === h || !mate.alive) continue;
      const q = mate.group.position;
      const t = ((q.x - p.x) * dx + (q.z - p.z) * dz) / length2;
      if (t <= .06 || t >= .94 || Math.abs(q.y - p.y) > 1.3) continue;
      const rx = p.x + dx * t - q.x, rz = p.z + dz * t - q.z;
      if (rx * rx + rz * rz < .62 * .62) return true;
    }
    return false;
  }

  _patrolPoint(z) {
    const points = this.map.bio?.holdPoints || this.map.spawns.player || [];
    if (!points.length) return [z.group.position.x, z.group.position.y, z.group.position.z];
    if (!Number.isInteger(z.patrolIndex))
      z.patrolIndex = (this.zombies.indexOf(z) * 3 + this.director.serial) % points.length;
    const point = points[z.patrolIndex % points.length];
    if (Math.hypot(point[0] - z.group.position.x, point[2] - z.group.position.z) < 2.2)
      z.patrolIndex = (z.patrolIndex + 1 + (z.role === 'flanker' ? 1 : 0)) % points.length;
    return points[z.patrolIndex % points.length];
  }

  _humanSupportGoal(h, humans) {
    const mate = humans.filter(o => o !== h && o.alive)
      .sort((a, b) => ((b.reloadT > 0) - (a.reloadT > 0)) ||
        (Math.hypot(a.group.position.x-h.group.position.x,a.group.position.z-h.group.position.z) -
         Math.hypot(b.group.position.x-h.group.position.x,b.group.position.z-h.group.position.z)))[0];
    if (!mate) return this._holdPoint(h);
    const q = mate.group.position, hold = this._holdPoint(h);
    const dx = hold[0] - q.x, dz = hold[2] - q.z, len = Math.hypot(dx, dz) || 1;
    return [q.x + dx / len * 3.2, q.y, q.z + dz / len * 3.2];
  }

  _zombieRoute(z, target, dt, directX, directZ) {
    const navigation = this.map.navigation;
    if (!navigation) return [directX, directZ];
    const movedGoal = !Number.isFinite(z.routeGoalX) ||
      Math.hypot(target.x - z.routeGoalX, target.z - z.routeGoalZ) > 2.4;
    z.routeT = (z.routeT || 0) - dt;
    if (movedGoal || z.routeT <= 0) {
      let route = null;
      if (!navigation.clear(z.group.position, target)) {
        navigation.update(target);
        route = navigation.steer(z.group.position, target);
      }
      z.routeX = route?.x ?? directX;
      z.routeZ = route?.z ?? directZ;
      z.routeGoalX = target.x;
      z.routeGoalZ = target.z;
      z.routeT = BIO_ZOMBIE_ROUTE_INTERVAL +
        (Math.max(0, this.zombies.indexOf(z)) % 4) * .015;
      this.performance.navigationRefreshes++;
    }
    return [z.routeX, z.routeZ];
  }

  update(dt, player, elapsed = dt) {
    if (this.phase === 'off' || this.phase === 'ended') return;
    const countdownDt = Number.isFinite(elapsed) && elapsed > 0 ? elapsed : dt;
    this.playerRef = player;
    this._updateViewFrustum();
    this.aiTime += dt;
    this.combatHeat = Math.max(0, this.combatHeat - dt * .075);
    if (this.playerNoise) {
      this.playerNoise.time = Math.max(0, this.playerNoise.time - dt);
      if (this.playerNoise.time === 0) this.playerNoise = null;
    }
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
    this.liveElapsed += dt;
    this.map?.zone13Events?.update?.(this.liveElapsed, this.sound);
    if (this.liveElapsed >= this.nextBgmAt) {
      this.sound?.bio('bgm');
      this.nextBgmAt += this.rules.bgmRepeat;
    }
    for (const wave of this.map.bio?.supplyWaves || []) if (!wave.deployed && this.liveElapsed >= wave.at) {
      const candidates = wave.candidates || [];
      if (candidates.length) {
        wave.position = [...candidates[Math.floor(Math.random() * candidates.length)]];
        wave.deployed = true; wave.active = true;
        if (wave.collider) {
          const [x, y, z] = wave.position;
          Object.assign(wave.collider, { x, z, y0: y, h: y + .72, active: true });
        }
        if (wave.mesh) { wave.mesh.position.fromArray(wave.position); wave.mesh.position.y += .38; wave.mesh.visible = true; }
        this.sound?.bio('supply');
      }
    }
    if (this.playerZombie && this.playerOut) {
      this.playerRespawnT = Math.max(0, this.playerRespawnT - countdownDt);
      if (this.playerRespawnT === 0) this._respawnPlayerZombie(player);
    }
    const aliveHumans = this.humans.filter(h => h.alive);
    aliveHumans.forEach((h, i) => { h.role = humanRole(i, aliveHumans.length); });
    const targets = aliveHumans.map(h => ({ human: h, isPlayer: false,
      key: h, pos: h.group.position }));
    if (!this.playerZombie && !this.playerOut)
      targets.push({ human: null, isPlayer: true, key: player, pos: player.pos });
    let nearestThreat = Infinity;
    for (const z of this.zombies) {
      if (z.dead) continue;
      for (const target of targets) nearestThreat = Math.min(nearestThreat,
        Math.hypot(z.group.position.x-target.pos.x,z.group.position.z-target.pos.z));
    }
    const phaseChanged = updateDirector(this.director, {
      nearestThreat, humansAlive: targets.length,
      humansTotal: this.humans.length + (!this.playerZombie ? 1 : 0),
      combatHeat: this.combatHeat,
    }, dt);
    if (phaseChanged) {
      this.zombies.forEach((z, i) => {
        z.role = zombieRole(i, this.director.serial);
        z.commitT = this.director.phase === 'assault' ? i * .24 : 0;
        z.decisionT = 0;
      });
    }
    const profile = directorProfile(this.director);
    const zombieSenses = new Map();
    const packSightings = [];
    const targetByKey = new Map(targets.map(target => [target.key, target]));
    for (const z of this.zombies) {
      if (z.dead) continue;
      z.senseT = (z.senseT || 0) - dt;
      if (z.senseT <= 0) {
        const refreshed = new Map();
        for (const target of targets) {
          const d = Math.hypot(target.pos.x-z.group.position.x,target.pos.z-z.group.position.z);
          const visible = this._canSee(z.group, target.pos,
            ZOMBIE_SIGHT_RANGE * z.traits.awareness, -.26);
          const noise = target.human ? target.human.shotNoiseT > 0 :
            !!this.playerNoise && this.playerNoise.time > 0;
          const radius = target.human ? ZOMBIE_HEARING_RANGE : (this.playerNoise?.radius || 0);
          const heard = noise && d < radius && Math.abs(target.pos.y-z.group.position.y) < 5;
          if (visible || heard) {
            const perceived = visible ? target.pos : target.human ? target.pos : this.playerNoise;
            refreshed.set(target.key, { visible, heard, distance: d,
              pos: { x:perceived.x,y:perceived.y,z:perceived.z } });
          }
        }
        z.senseCache = refreshed;
        z.senseT = BIO_ZOMBIE_SENSE_INTERVAL;
        this.performance.senseRefreshes++;
      }
      const sensed = new Map();
      for (const [key, entry] of z.senseCache || []) {
        const target = targetByKey.get(key);
        if (!target) continue;
        sensed.set(key, entry);
        packSightings.push({ target, pos: entry.pos, source: z.group.position,
          visible: entry.visible, heard: entry.heard });
      }
      zombieSenses.set(z, sensed);
    }
    const targetLoads = new Map();
    const attackReservations = new Map();
    for (const z of this.zombies) {
      if (z.hitT > 0) {
        z.hitT = Math.max(0, z.hitT - dt);
        z.hitAction?.setEffectiveWeight(.42 * Math.pow(z.hitT / HIT_REACT_TIME, .75));
        if (z.hitT === 0) z.hitAction?.stop();
      }
      const zombieAnimDt = this._animationStep(z, dt);
      if (zombieAnimDt !== null) z.mixer.update(zombieAnimDt);
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
      z.commitT = Math.max(0, z.commitT - dt);
      z.pursuitMemory = Math.max(0, z.pursuitMemory - dt);
      let chosen = null, best = Infinity, lane = 0;
      const sensed = zombieSenses.get(z) || new Map();
      for (const t of targets) {
        const direct = sensed.get(t.key);
        const shared = !direct && packSightings.find(s => s.target.key === t.key &&
          Math.hypot(s.source.x-p.x,s.source.z-p.z) < 21);
        const remembered = z.pursuitKey === t.key && z.pursuitMemory > 0;
        if (!direct && !shared && !remembered) continue;
        const navPos = direct?.pos || shared?.pos || z.lastKnown;
        if (!navPos) continue;
        const d = Math.hypot(navPos.x - p.x, navPos.z - p.z);
        const load = targetLoads.get(t.key) || 0;
        const memory = remembered ? z.pursuitMemory / ZOMBIE_MEMORY_SECONDS : shared ? .62 : 0;
        const score = zombieTargetScore({ distance: d,
          visible: !!direct?.visible, heard: !!direct?.heard || !!shared?.heard,
          memory, load, persistent: z.pursuitKey === t.key ? 1 : 0,
          isolated: this._targetIsolation(t, targets),
          reloading: t.human?.reloadT > 0 ? 1 : 0, role: z.role });
        if (score < best) { best = score; chosen = { ...t, navPos, direct, shared }; lane = load; }
      }
      if (chosen) {
        z.pursuitKey = chosen.key;
        targetLoads.set(chosen.key, (targetLoads.get(chosen.key) || 0) + 1);
        if (chosen.direct || chosen.shared) {
          z.lastKnown = { x:chosen.navPos.x,y:chosen.navPos.y,z:chosen.navPos.z };
          z.pursuitMemory = chosen.direct?.visible ? ZOMBIE_MEMORY_SECONDS : 3.2;
        }
        z.visibleTarget = !!chosen.direct?.visible;
        z.heardTarget = !!chosen.direct?.heard || !!chosen.shared?.heard;
      } else {
        const patrol = this._patrolPoint(z);
        chosen = { human: null, isPlayer: false, patrol: true,
          key: null, pos: { x: patrol[0], y: patrol[1], z: patrol[2] },
          navPos: { x: patrol[0], y: patrol[1], z: patrol[2] } };
        z.pursuitKey = null;
        z.lastKnown = null;
        z.visibleTarget = z.heardTarget = false;
      }
      const targetMotion = chosen.patrol ? { x: 0, z: 0 } : this._targetMotion(chosen, player);
      let q = this._attackSlot(z, chosen, targetMotion, attackReservations);
      if (!chosen.patrol && z.role === 'cutoff') {
        const leadTime = Math.min(.72,.28+Math.hypot(targetMotion.x,targetMotion.z)*.045);
        q = { x:q.x + targetMotion.x*leadTime, y:q.y, z:q.z + targetMotion.z*leadTime };
      }
      const dx = q.x - p.x, dz = q.z - p.z;
      best = Math.hypot(dx,dz);
      const attackDistance = chosen.patrol ? Infinity :
        Math.hypot(chosen.pos.x-p.x,chosen.pos.z-p.z);
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
            (target.human ? target.human.alive : target.isPlayer && !this.playerZombie && !this.playerOut) &&
            Math.hypot(target.pos.x - p.x, target.pos.z - p.z) < HIT_RANGE &&
            Math.abs(target.pos.y - p.y) < 1.1 && this._lineClear(p, target.pos)) {
          z.attackLanded = true;
          if (target.human) this._infect(target.human);
          else {
            this.playerZombie = true;
            this.playerMaxHealth = player.hp = BIO_ZOMBIE_HEALTH;
            this.infections++;
            this.director.shock = 1;
            this.combatHeat = 1;
            this.onPlayerInfected?.(false);
            this.sound?.bio('infect', p.x, p.y, p.z);
          }
        }
        if (z.attackT <= 0) z.attackTarget = null;
      } else if (!chosen.patrol && attackDistance < HIT_RANGE + .18 && z.attackCd <= 0 &&
          z.commitT <= 0 && (z.visibleTarget || z.heardTarget)) {
        z.moveX *= .3; z.moveZ *= .3;
        z.attackT = z.hazmat ? 1.05 : .42;
        z.attackCd = z.hazmat ? 1.4 : 1.25;
        z.attackTarget = chosen;
        z.attackLanded = false;
        this._play(z, 'attack', false);
        this.sound?.bio('attack', p.x, p.y, p.z);
      } else if (best > 1.15) {
        let vx = dx / best, vz = dz / best;
        // Assigned flankers and overloaded pursuers take visibly different
        // lanes. They converge only in the final metres instead of forming a
        // single-file queue behind the pressure zombie.
        if (!chosen.patrol && best > 5 && (lane > 0 || z.role === 'flanker')) {
          const side = z.role === 'flanker' ? z.flankSide : lane % 2 ? 1 : -1;
          const offset = Math.min(5.5, 1.4 + lane * 1.15 + profile.flank * 2.4);
          const tx = q.x - vz * side * offset, tz = q.z + vx * side * offset;
          const length = Math.hypot(tx-p.x,tz-p.z) || 1;
          vx = (tx-p.x)/length; vz = (tz-p.z)/length;
        }
        const actorIndex = Math.max(0, this.zombies.indexOf(z));
        const temperament = ((actorIndex * 37 + this.director.serial * 17) % 100) / 100;
        const committed = z.commitT <= 0 &&
          (best < 3.2 || profile.commit * z.traits.aggression > .38 + temperament * .42);
        if (!chosen.patrol && !committed && best < 11) {
          // During probe/recovery, uncommitted zombies circle outside the
          // firing line. This telegraphs pressure and preserves a short breath
          // before the synchronized assault.
          const awayX = -dx / Math.max(best,.001), awayZ = -dz / Math.max(best,.001);
          const side = z.flankSide;
          vx = awayX * .62 - awayZ * side * .78;
          vz = awayZ * .62 + awayX * side * .78;
        }
        const directX = vx, directZ = vz;
        // Elevated defense decks can be reached directly with a leap. When a
        // pathfinder route stalls at a crate, the same leap is a recovery move.
        const raised = q.y > p.y + .55 && q.y - p.y <
          LEAP_UP * LEAP_UP / (2 * LEAP_GRAVITY * this.rules.zombieGravity);
        const canLeap = raised && this._tryLeap(z, directX, directZ);
        if (!z.airborne && !canLeap && this.map.navigation)
          [vx, vz] = this._zombieRoute(z, q, dt, vx, vz);
        const phasePace = chosen.patrol ? .76 : .86 + profile.aggression * .14;
        const speed = ZOMBIE_RUN_SPEED * this.rules.zombieSpeed * phasePace * (z.stagger > 0 ? HIT_MOVE_SCALE : 1);
        if (!z.airborne) {
          [vx, vz] = this._localSteer(z, vx, vz, speed);
          [vx, vz] = this._recoverySteer(z, vx, vz, 'zombie');
        }
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
        if (!z.airborne && advanced < .012 && Math.hypot(z.pushX, z.pushZ) < .04) {
          z.regenT += dt;
          if (z.regenT >= this.rules.regenDelay && z.health < z.maxHealth) {
            z.regenT = 0; z.health = Math.min(z.maxHealth, z.health + this.rules.zombieRegen);
            z.lowHealth = z.health <= this.rules.lowHealthBlink;
            this.sound?.bio('breath', p.x, p.y, p.z);
          }
        } else z.regenT = 0;
        this._trackProgress(z, advanced, speed * dt, dt);
        if (z.stuckFor > .62) this._tryLeap(z, directX, directZ);
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
    const humanSenses = new Map();
    const squadSightings = [];
    const liveZombies = new Set(this.zombies.filter(z => !z.dead));
    for (const h of aliveHumans) {
      h.senseT = (h.senseT || 0) - dt;
      if (h.senseT <= 0) {
        const refreshed = [];
        for (const z of this.zombies) {
          if (z.dead) continue;
          const q = z.group.position;
          const d = Math.hypot(q.x-h.group.position.x,q.z-h.group.position.z);
          const visible = this._canSee(h.group,q,HUMAN_SIGHT_RANGE,-.22);
          const noisy = z.attackT > 0 || Math.hypot(z.moveX,z.moveZ) > 2.4 || z.hitT > 0;
          const heard = noisy && d < (z.attackT > 0 ? HUMAN_HEARING_RANGE : 11.5);
          if (visible || heard) refreshed.push({ actor:z,
            pos:{x:q.x,y:q.y,z:q.z},visible,heard,isPlayer:false,distance:d });
        }
        if (this.playerZombie && !this.playerOut) {
          const q = player.pos;
          const d = Math.hypot(q.x-h.group.position.x,q.z-h.group.position.z);
          const visible = this._canSee(h.group,q,HUMAN_SIGHT_RANGE,-.22);
          const noisy = this._playerAttack > 0 || Math.hypot(player.vel?.x || 0,player.vel?.z || 0) > 3.2;
          const heard = noisy && d < (this._playerAttack > 0 ? HUMAN_HEARING_RANGE : 10);
          if (visible || heard) refreshed.push({ actor:null,
            pos:{x:q.x,y:q.y,z:q.z},visible,heard,isPlayer:true,distance:d });
        }
        h.senseCache = refreshed;
        h.senseT = BIO_HUMAN_SENSE_INTERVAL;
        this.performance.senseRefreshes++;
      }
      // 删除最多保留一个感知周期的死亡/已感染目标；缓存位置本身刻意保持快照，
      // 这就是 120～140ms 的真人反应延迟，而不是读取全图实时坐标。
      const sensed = (h.senseCache || []).filter(entry =>
        entry.isPlayer ? this.playerZombie && !this.playerOut : liveZombies.has(entry.actor));
      h.senseCache = sensed;
      for (const entry of sensed) {
        if (entry.visible) squadSightings.push({ source:h.group.position,entry });
      }
      humanSenses.set(h,sensed);
    }
    const humanReservations = new Set();
    for (const h of aliveHumans) {
      const p = h.group.position;
      h.shotNoiseT = Math.max(0,h.shotNoiseT-dt);
      h.shotCd = Math.max(0,h.shotCd-dt);
      h.intentT = Math.max(0,h.intentT-dt);
      h.decisionT = Math.max(0,h.decisionT-dt);
      h.acquireT = Math.max(0,h.acquireT-dt);
      h.combatGoalT = Math.max(0,(h.combatGoalT || 0)-dt);
      if (h.reloadT > 0) {
        h.reloadT = Math.max(0,h.reloadT-dt);
        if (h.reloadT === 0) {
          const loaded = Math.min(HUMAN_MAG_SIZE-h.ammo,h.reserve);
          h.ammo += loaded;
          h.reserve -= loaded;
        }
      }
      const sensed = humanSenses.get(h) || [];
      const direct = sensed.sort((a,b) => Number(b.visible)-Number(a.visible) ||
        a.distance-b.distance)[0] || null;
      const shared = !direct ? squadSightings
        .filter(s => Math.hypot(s.source.x-p.x,s.source.z-p.z) < 19)
        .sort((a,b) => Math.hypot(a.entry.pos.x-p.x,a.entry.pos.z-p.z) -
          Math.hypot(b.entry.pos.x-p.x,b.entry.pos.z-p.z))[0]?.entry : null;
      const observed = direct || shared;
      const visible = !!direct?.visible;
      if (observed) {
        if (visible && !h.threatVisible) h.acquireT = h.traits.reaction;
        h.lastThreat = { x:observed.pos.x,y:observed.pos.y,z:observed.pos.z };
        h.lastThreatT = direct?.visible ? HUMAN_MEMORY_SECONDS : 2.4;
      } else h.lastThreatT = Math.max(0,h.lastThreatT-dt);
      h.threatVisible = visible;
      const q = observed ? observed.pos : h.lastThreatT > 0 ? h.lastThreat : null;
      const dist = q ? Math.hypot(q.x-p.x,q.z-p.z) : Infinity;
      if (visible && q) {
        if (Number.isFinite(h.lastAimX)) {
          const shifted = Math.hypot(q.x-h.lastAimX,q.z-h.lastAimZ);
          if (shifted > .45) h.aimFocus *= .55;
        }
        h.lastAimX=q.x;h.lastAimZ=q.z;
      } else {
        h.aimFocus=Math.max(0,h.aimFocus-dt*1.8);
        h.lastAimX=h.lastAimZ=NaN;
      }
      const threatPositions = sensed.map(s=>s.pos);
      if (q && !threatPositions.length) threatPositions.push(q);
      this._reconsiderHold(h,threatPositions,dt);

      const reloaders = aliveHumans.filter(o=>o!==h && o.reloadT>0).length;
      if (h.reloadT === 0 && h.reserve > 0 && (h.ammo === 0 ||
          (h.ammo <= 7 && dist > 11 && reloaders < Math.max(1,Math.floor(aliveHumans.length/2))))) {
        h.reloadT = 2.5;
        h.intentT = 0;
      }
      const closestMate = aliveHumans.filter(o=>o!==h).sort((a,b) =>
        Math.hypot(a.group.position.x-p.x,a.group.position.z-p.z)-
        Math.hypot(b.group.position.x-p.x,b.group.position.z-p.z))[0];
      const mateNeedsHelp = !!closestMate && (closestMate.reloadT>0 || closestMate.intent==='evade');
      if (h.decisionT <= 0) {
        const closeness = q ? Math.max(0,(11-dist)/9) : 0;
        const scores = {
          hold:.36+(h.role==='anchor'?.28:0),
          engage:visible ? .68+h.traits.courage*.25-closeness*.22 : 0,
          evade:q ? closeness*.92+(h.reloadT>0?.35:0)+(1-h.traits.courage)*.18 : 0,
          support:mateNeedsHelp ? .48+h.traits.teamwork*.36+(h.role==='support'?.2:0) : 0,
          investigate:!visible&&q ? .46+h.traits.courage*.2 : 0,
          rotate:q&&threatPositions.length>1 ? .38+profile.aggression*.16 : 0,
        };
        const next = chooseIntent(h.intent,h.intentT,scores);
        if (next !== h.intent) {
          h.intent=next;h.intentT=.7+h.traits.teamwork*.35;h.routeT=0;
          if (next==='engage'||next==='rotate') h.combatGoalT=0;
        }
        h.decisionT=.18+h.traits.reaction*.45;
      }

      let vx=0,vz=0,speed=HUMAN_RUN_SPEED_AI;
      if (h.intent==='evade'&&q) {
        [vx,vz]=this._escapeDirection(h,q,threatPositions.length?threatPositions:[q]);
        speed=HUMAN_FLEE_SPEED;
      } else if (h.intent==='support') {
        [vx,vz]=this._humanRoute(h,this._humanSupportGoal(h,aliveHumans),dt);
      } else if (h.intent==='investigate'&&q) {
        const dx=q.x-p.x,dz=q.z-p.z,len=Math.hypot(dx,dz)||1;
        const goal=[q.x-dz/len*h.searchSide*3.6,q.y,q.z+dx/len*h.searchSide*3.6];
        [vx,vz]=this._humanRoute(h,goal,dt);
        speed=HUMAN_RUN_SPEED_AI*.82;
      } else if (h.intent==='engage'&&q&&visible) {
        if (dist<8.2) {
          [vx,vz]=this._escapeDirection(h,q,threatPositions.length?threatPositions:[q]);
          speed=HUMAN_FLEE_SPEED;
        } else {
          const goal=this._humanCombatGoal(h,q,threatPositions,humanReservations);
          [vx,vz]=this._humanRoute(h,goal,dt);
          if (Math.hypot(goal[0]-p.x,goal[2]-p.z)<1.25) {
            const dx=q.x-p.x,dz=q.z-p.z,len=Math.hypot(dx,dz)||1;
            vx=-dz/len*h.strafeSide;vz=dx/len*h.strafeSide;
            speed=HUMAN_RUN_SPEED_AI*.28;
          }
        }
      } else if (h.intent==='rotate'&&q) {
        [vx,vz]=this._humanRoute(h,
          this._humanCombatGoal(h,q,threatPositions,humanReservations),dt);
        speed=HUMAN_RUN_SPEED_AI*.88;
      } else [vx,vz]=this._humanRoute(h,this._holdPoint(h),dt);

      const motion=this._moveHuman(h,vx,vz,dt,speed*this.rules.humanSpeed);
      if (q) {
        const wanted=Math.atan2(q.x-p.x,q.z-p.z);
        const error=Math.atan2(Math.sin(wanted-h.group.rotation.y),Math.cos(wanted-h.group.rotation.y));
        const turn=THREE.MathUtils.clamp(error,-5.6*dt,5.6*dt);
        h.group.rotation.y+=turn;h.turnRate=turn/Math.max(dt,.001);
        if (visible) {
          const focusRate=(.75+h.traits.accuracy*.95)*(motion.speed<.8?1:.54);
          h.aimFocus=Math.min(1,h.aimFocus+dt*focusRate);
        }
        if (h.shotCd<=0&&h.reloadT===0&&h.ammo>0&&visible&&h.acquireT<=0&&
            h.aimFocus>.2&&dist<27&&Math.abs(error)<.48&&
            !this._friendInLineOfFire(h,q,aliveHumans)) {
          h.ammo--;h.shotNoiseT=1.1;this.combatHeat=Math.min(1,this.combatHeat+.035);
          h.burstLeft--;
          if (h.burstLeft<=0) {
            h.burstLeft=dist>18?2+Math.floor(Math.random()*2):3+Math.floor(Math.random()*3);
            h.shotCd=(dist>18?.7:.48)+Math.random()*.28;
          } else h.shotCd=(dist>18?.29:.2)+Math.random()*.12;
          const hitChance=Math.max(.34,h.traits.accuracy*.66+h.aimFocus*.27-
            Math.max(0,dist-8)*.012-
            Math.min(.12,motion.speed*.018)-(h.intent==='evade'?.12:0));
          if (Math.random()<hitChance) {
            if (direct.isPlayer) {
              player.hp=Math.max(0,player.hp-9*this.humanDamageMultiplier);
              if (player.hp===0)this.killPlayerZombie(player);
            } else direct.actor.takeDamage(12,false,{x:q.x-p.x,z:q.z-p.z});
          }
          h.rig.recoil(.7);
          this.sound?.enemyShoot(p.x,p.y+1.3,p.z,'m4');
        }
      } else if (motion.moved>.001) {
        const wanted=Math.atan2(motion.x,motion.z);
        const error=Math.atan2(Math.sin(wanted-h.group.rotation.y),Math.cos(wanted-h.group.rotation.y));
        const turn=THREE.MathUtils.clamp(error,-5.6*dt,5.6*dt);
        h.group.rotation.y+=turn;h.turnRate=turn/Math.max(dt,.001);
      } else h.turnRate*=Math.exp(-dt*9);
      this._animateHuman(h,dt,motion,!!q&&visible);
    }
    if (this.playerZombie && !this.playerOut && Math.hypot(player.vel?.x || 0, player.vel?.z || 0) < .04) {
      this.playerRegenT = (this.playerRegenT || 0) + dt;
      if (this.playerRegenT >= this.rules.regenDelay && player.hp < this.playerMaxHealth) {
        this.playerRegenT = 0; player.hp = Math.min(this.playerMaxHealth, player.hp + this.rules.zombieRegen);
        this.sound?.bio('breath', player.pos.x, player.pos.y, player.pos.z);
      }
    } else this.playerRegenT = 0;
    if (this.timer <= 0) this._end('human');
    else if (this.humans.every(h => !h.alive) && (this.playerZombie || this.playerOut)) this._end('zombie');
    this.onChange?.();
  }

  onZombieDeath(z) {
    if (!z.dead || z.rewarded) return;
    z.rewarded = true;
    this._advanceZombieKill();
    this.sound?.bio('death', z.group.position.x, z.group.position.y, z.group.position.z);
    this.onZombieKilled?.(z);
    this.onChange?.();
  }

  _advanceZombieKill() {
    this.kills++;
    this.humanDamageMultiplier = bioHumanDamageMultiplier(this.kills);
    for (const h of this.humans) {
      if (h.alive) h.reserve = refillTwoMagazines(h.reserve, HUMAN_MAG_SIZE, HUMAN_INITIAL_RESERVE);
    }
  }

  _end(winner) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.sound?.bio(winner === 'human' ? 'humanwin' : 'zombiewin');
    this.onRoundEnd?.(winner);
  }

  performanceStats() {
    const totalActors = this.humans.filter(h => h.alive).length +
      this.zombies.filter(z => !z.dead).length;
    return { ...this.performance, totalActors,
      animationSkipRate: this.performance.animationUpdates + this.performance.animationSkips > 0
        ? this.performance.animationSkips /
          (this.performance.animationUpdates + this.performance.animationSkips) : 0 };
  }

  status() {
    return { phase: this.phase, time: this.timer, humans: this.humans.filter(h => h.alive).length +
      (!this.playerZombie && !this.playerOut ? 1 : 0),
      zombies: this.zombies.length + (this.playerZombie ? 1 : 0),
      playerZombie: this.playerZombie, kills: this.kills, playerKills: this.playerKills,
      scoreKills: this.playerKills + Math.floor(this.playerDamage / BIO_DAMAGE_MILESTONE), infections: this.infections,
      playerDamage: this.playerDamage,
      ruleVariant: this.rules.id, ruleLabel: this.rules.label,
      humanDamageMultiplier: this.humanDamageMultiplier,
      lowHealth: this.playerZombie && !this.playerOut && (this.playerRef?.hp || 0) <= this.rules.lowHealthBlink,
      supplies: (this.map?.bio?.supplyWaves || []).map(({ wave, at, deployed, claimed, position }) =>
        ({ wave, at, deployed, claimed, position })),
      nextDamageMilestone: (Math.floor(this.playerDamage / BIO_DAMAGE_MILESTONE) + 1) * BIO_DAMAGE_MILESTONE,
      playerRespawnT: this.playerRespawnT,
      directorPhase: this.director.phase, directorIntensity: this.director.intensity,
      performance: this.performanceStats() };
  }
}
