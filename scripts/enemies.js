// ===== 敌人系统（自建骨架模型 + 点射走位 AI + 倒地尸体 + 对象池）=====
// 模型不再是 GLB：soldier.glb 是静态单网格、无骨骼无动画，四肢永远垂着、枪只能飘在胸前。
// 现在用 scripts/enemy_model.js 里自建的关节骨架，走位/瞄准/开火/受击/倒地全程序化。
import * as THREE from "three";
import { SoldierRig } from "./enemy_model.js";

// 敌人血量恒定：HP 必须固定，否则「AK 3 枪死」的数值不成立 —— 所以难度**不碰血量**，
// 只缩放下面这份 ENEMY_TUNING 里的乘数。
const ENEMY_HP = 100;
const ENEMY_DAMAGE = 12;

// 难度调参（main.js 的 DIFFICULTIES 经 applyDifficulty() 灌进来）。
// 关键：**必须在赋值处现读**，不能在 Enemy 构造时捕获 —— 否则对局中途换难度，
// 已经上场的敌人会一直用旧值（血压/伤害/点射停顿全在 reset/updateBurst 里现算）。
export const ENEMY_TUNING = { dmg: 1, acc: 1, speed: 1, pause: 1, aggro: 1 };
const ENGAGE_NEAR = 7;    // 比这更近就后撤
const ENGAGE_FAR = 16;    // 比这更远就压上
const CORPSE_HOLD = 5.0;  // 尸身平躺保留时长
const CORPSE_SINK = 0.9;  // 之后下沉消失的时长
const CORPSE_FALL = 0.4;  // 倒地用时

// ---- 朝向 / 移动的平滑参数 ----
const BODY_PIVOT = 1.15;   // 倒地前扑的转轴高度（腰）。绕脚转会让整个人像块板子一样倒
const TURN_RATE = 3.4;     // 最大转身角速度（rad/s）：转半圈约 0.9s，接近人的转身速度
const MOVE_ACCEL = 4.5;    // 水平速度逼近系数：约 0.22s 加到目标速度（起停有惯性）
// 点射停顿的随机取值。两处赋值（reset 的初值与 updateBurst 的每轮停顿）都过这里，
// 难度的 pause 乘数就只需要接一次。
// 第三个乘数 mul 是**枪型**的：端着手动枪机的 AWM 却按 AK 的节奏扫射太出戏。
// 只影响节奏、**不改伤害**（伤害固定走 ENEMY_DAMAGE * 难度），所以「AK 三枪死」不受影响。
const pauseFor = (min, span, mul = 1) => (min + Math.random() * span) * ENEMY_TUNING.pause * mul;

// 朝向与目标方向差超过这个角度就先不开火（要先转正枪口）。
// 别收得太紧：玩家贴身绕圈时敌人跟不上转速，容差过小会让它一直不还击
const AIM_TOL = 0.35;

// CF 风格的红队（潜伏者）代号。导出给 main.js 的 Tab 战绩名册用
export const ENEMY_NAMES = [
  "幽灵", "猎鹰", "冷锋", "铁锤", "红隼", "毒蝎",
  "独狼", "夜莺", "战斧", "疾风", "黑曼巴", "游隼",
  "铁幕", "沙狐", "北极星", "残刃",
];

export class Enemy {
  constructor(scene, x, z, opts = {}) {
    this.scene = scene;

    // 层级：
    //   group  ← 世界坐标 + 朝向（rotation.y，同时就是瞄准方向 = 枪口方向）
    //     tilt  ← 只负责倒地时绕腰的整身前扑
    //       body ← 把原点挪回脚底
    //         rig.root ← 自建骨架（骨盆/脊椎/胸腔/头/双臂/双腿，逐关节驱动）
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.position.y = BODY_PIVOT;
    const body = new THREE.Group();
    body.position.y = -BODY_PIVOT;
    tilt.add(body);
    group.add(tilt);

    // 自建骨架：四肢有关节，走位/瞄准/开火/受击/倒地全部由它演。
    // 几何体在模块内全局共享（8 个敌人共用一份），材质每人一份（受击闪红不能串台）。
    // 枪这里传 null —— 底下的 reset() 会用 opts.rifle 走 setRifle()，传进来再挂一次
    // 等于白 clone 一份模板（setRifle 内部会先摘掉旧的）。
    this.rig = new SoldierRig(null);
    body.add(this.rig.root);
    // 步枪不进 meshes：① 受击闪红不该闪到枪上；② 子弹可以穿过枪身不算命中
    this.meshes = this.rig.meshes;
    for (const m of this.meshes) m.userData.enemy = this;

    scene.add(group);
    this.group = group;
    this.tilt = tilt;
    this.body = body;
    this.root = this.rig.root;

    this.reset(x, z, opts);
  }

  // 复用（对象池）或首次出生都走这里
  reset(x, z, opts = {}) {
    this.health = ENEMY_HP;
    this.maxHealth = ENEMY_HP;
    this.damage = ENEMY_DAMAGE * ENEMY_TUNING.dmg;
    this.name = opts.name || ENEMY_NAMES[0];
    // 枪型/皮肤每局随机（main.js 的 loadoutPicker 抽的），死亡时按这两个字段掉在地上。
    // 枪必须在这里换：敌人是对象池复用的，构造函数只跑一次。
    if (opts.rifle) this.rig.setRifle(opts.rifle, opts.gunId);
    this.gunId = opts.gunId || "ak";
    this.gunSkin = opts.gunSkin || null;
    this.weaponName = opts.weaponName || "步枪";
    this.fireMul = opts.fireMul || 1;
    this.dead = false;
    this.corpseT = 0;
    this.blindT = 0;
    this.flinch = 0;
    this.flashAmt = 0;
    this._lastFlash = -1; // 强制复用后重算一次 emissive
    this.seed = Math.random() * Math.PI * 2;
    // 移速必须在这里给：update() 里 `this.speed * dt` 一旦是 undefined，
    // sp 变 NaN → avoid() 的 `NaN < c.hx` 恒为 false（判成「没被挡」）→ moveBy(NaN,NaN)
    // 把 group.position 永久写成 NaN，敌人从此既不可见也不再移动。
    this.speed = (3.0 + Math.random() * 0.8) * ENEMY_TUNING.speed;

    this.rig.reset();               // 摆回站立姿势（对象池复用，必须清掉上一具尸体的姿势）
    this.tilt.position.y = BODY_PIVOT;
    this.tilt.rotation.set(0, 0, 0);
    this.group.visible = true;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = Math.atan2(-x, -z);

    this.eyeline = new THREE.Vector3(x, 1.68, z);
    this.animT = Math.random() * Math.PI * 2;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 1.2 + Math.random() * 1.4;
    // 移动/姿态的平滑量（对象池复用，每次出生都要归零，否则会带着上一具尸体的速度复活）
    this.vel = new THREE.Vector3();
    this.strafeBlend = this.strafeDir;
    this.stuckT = 0;
    // 绕行方向的「承诺」：走进死角的敌人必须**沿着同一个切向走一段时间**才出得来。
    // detourSide 只在一段绕行开始时定一次（两边各探一次，挑空的那边），
    // 绝不能每帧按 rotation.y 重算符号 —— 绕行本身会改 rotation.y，符号跟着翻，
    // 敌人就会以满速原地画圈（位移 0.1m/21s，而 stuckT 恒为 0，因为每帧都"动了"）。
    this.detourSide = 0;
    this.detourT = 0;
    // 净推进监工：画圈时 moved 是满的，只有「离玩家的距离长时间不减」才看得出来
    this.lastDist = -1;
    this.noProgT = 0;
    this.turnRate = 0;
    this.turnVel = 0;
    this.aimPitch = 0;
    this.aimErr = 0;
    this.aimLevel = 0;                                       // 低姿 ↔ 据枪 的过渡量
    this._lastStep = Math.floor(this.rig.phase / Math.PI);    // 脚步落点计数（相位半周期 = 一步）
    // 点射节奏：burstLeft 发子弹打完后停顿 burstPause
    this.burstLeft = 0;
    this.burstTimer = 0;
    this.burstPause = pauseFor(0.6, 0.8, this.fireMul);
    this.wantShoot = false;
    if (!this.group.parent) this.scene.add(this.group);
  }

  update(dt, player) {
    if (this.dead) { this.updateCorpse(dt); return; }

    this.animT += dt * 8;
    if (this.blindT > 0) this.blindT -= dt;
    if (this.flinch > 0) this.flinch = Math.max(0, this.flinch - dt * 4);

    const gp = this.group.position;
    const dx = player.pos.x - gp.x;
    const dz = player.pos.z - gp.z;
    const dist = Math.hypot(dx, dz) || 1e-3;
    const dir = new THREE.Vector3(dx, 0, dz).normalize();
    const blind = this.blindT > 0;
    // 帧率无关的指数逼近：1-e^(-k·dt)。用 dt*k 的写法在低帧率下会变慢，手感随帧率漂移
    const k = (rate) => 1 - Math.exp(-rate * dt);

    // ---------- ① 转身（限角速度，不再一帧转到位）----------
    let targetRot = blind
      ? this.group.rotation.y + Math.sin(this.animT * 0.35 + this.seed) * 1.6   // 致盲：乱转
      : Math.atan2(dx, dz);   // 本组 +z 就是正面，也是枪口指向
    let diff = targetRot - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // 转成角速度再积分（而不是直接写角度）：这样转身有起转/收住的过渡，
    // 直接 min(TURN_RATE*dt, diff*k) 会是「匀速转到停」，看着像机器人原地打转
    const wantRate = Math.max(-TURN_RATE, Math.min(TURN_RATE, diff * 8));
    this.turnVel += (wantRate - this.turnVel) * k(10);
    const step = this.turnVel * dt;
    this.group.rotation.y += step;
    this.turnRate = this.turnVel;
    // 转完后还剩多少没对准 —— 没转正不开火（枪口方向就是身体朝向，转着身子打就成了「歪着扫射」）
    this.aimErr = Math.abs(diff - step);

    // ---------- ② 期望速度 → 实际速度（有惯性，不是每帧瞬变）----------
    let wx = 0, wz = 0;
    if (blind) {
      this.wantShoot = false;
      wx = Math.sin(this.animT * 0.5 + this.seed);
      wz = Math.cos(this.animT * 0.4 + this.seed * 1.7);
    } else {
      // 侵略性高 = 更敢贴身：后撤阈值变小、横移更大幅。除法规避了 aggro 为 0 的极端值
      // （ENEMY_TUNING 只由 main.js 的 DIFFICULTIES 灌入，最小 0.7）
      const near = ENGAGE_NEAR / ENEMY_TUNING.aggro;
      if (dist > ENGAGE_FAR) { wx = dir.x; wz = dir.z; }                 // 压上
      else if (dist < near) { wx = -dir.x * 0.75; wz = -dir.z * 0.75; }  // 后撤
      if (dist < ENGAGE_FAR + 3) {
        // 中距离左右横移（一直在动，不站桩）。方向翻转也要平滑，
        // 否则速度向量会在一帧内掉头，看着像瞬移
        this.strafeT -= dt;
        if (this.strafeT <= 0) {
          this.strafeT = 1.4 + Math.random() * 1.6;
          this.strafeDir *= -1;
        }
        this.strafeBlend += (this.strafeDir - this.strafeBlend) * k(3.0);
        wx += -dir.z * this.strafeBlend * 0.85 * ENEMY_TUNING.aggro;
        wz += dir.x * this.strafeBlend * 0.85 * ENEMY_TUNING.aggro;
      } else {
        this.strafeBlend += (0 - this.strafeBlend) * k(3.0);   // 远距离只压上，不横着飘
      }
    }
    const wl = Math.hypot(wx, wz);
    const sp = this.speed * (blind ? 0.4 : 1);
    const tx = wl > 1e-4 ? (wx / wl) * sp : 0;
    const tz = wl > 1e-4 ? (wz / wl) * sp : 0;
    this.vel.x += (tx - this.vel.x) * k(MOVE_ACCEL);
    this.vel.z += (tz - this.vel.z) * k(MOVE_ACCEL);

    const before = gp.clone();
    const [sx, sz] = this.avoid(this.vel.x * dt, this.vel.z * dt);
    this.moveBy(sx, sz);
    const moved = Math.hypot(gp.x - before.x, gp.z - before.z);
    const wanted = Math.hypot(this.vel.x, this.vel.z) * dt;

    // 被集装箱顶住：速度衰减，并隔一会儿换个绕行方向，
    // 否则会贴着掩体原地蹭着走，看着像卡住
    if (wanted > 1e-4 && moved < wanted * 0.4) {
      this.stuckT += dt;
      this.vel.multiplyScalar(1 - Math.min(0.9, dt * 3));
      if (this.stuckT > 0.8) { this.stuckT = 0; this.strafeDir *= -1; this.strafeT = 1.4; }
    } else {
      this.stuckT = 0;
    }
    if (this.detourT > 0) this.detourT -= dt;

    // 净推进监工：绕圈时上面的 moved 判据**永远不触发**（每帧都在动、只是原地转），
    // 而 far 距离下 strafeDir 被 strafeBlend 强制衰减到 0，那条逃生路也是死的。
    // 所以再加一条与「怎么动」无关的判据：离玩家的距离长时间不减 = 没在推进。
    if (this.lastDist < 0) this.lastDist = dist;
    if (dist > ENGAGE_FAR + 3) {
      if (dist < this.lastDist - 0.35) { this.lastDist = dist; this.noProgT = 0; }
      else {
        this.noProgT += dt;
        if (this.noProgT > 2.2) {
          this.noProgT = 0; this.lastDist = dist;
          this.detourSide *= -1; this.detourT = 0;   // 换一个绕行方向，并强制重新探测
          this.strafeDir *= -1; this.strafeT = 1.4;
        }
      }
    } else { this.noProgT = 0; this.lastDist = dist; }

    // ---------- ③ 走位/瞄准/受击全部交给骨架 ----------
    const speedNow = Math.hypot(this.vel.x, this.vel.z);
    // 瞄准俯仰：>0 = 目标比自己低（骨架把它加在枪的俯仰上，身体朝向不受影响）
    const wantPitch = Math.atan2((gp.y + 1.5) - (player.pos.y + 1.35), Math.max(dist, 1));
    this.aimPitch += (Math.max(-0.22, Math.min(0.22, wantPitch)) - this.aimPitch) * k(6);
    // 端枪程度：进入交战距离就据枪，退远了回到低姿
    const wantAim = dist < ENGAGE_FAR + 6 ? 1 : 0;
    this.aimLevel += (wantAim - this.aimLevel) * k(1.6);
    this.rig.animate(dt, {
      moved,                          // 本帧实际走过的路程 → 步频/步幅
      speed: speedNow,
      aim: this.aimLevel,
      aimPitch: this.aimPitch,
      blind: blind ? 1 : 0,
      flinch: this.flinch,
      dead: false,
    });
    // 脚步声：相位每跨过 π 就是一个支撑期的开始（= 脚落地），与步态天然同步
    const stepIdx = Math.floor(this.rig.phase / Math.PI);
    if (stepIdx !== this._lastStep) {
      this._lastStep = stepIdx;
      if (speedNow > 0.6 && this.onFootstep) this.onFootstep(gp.x, gp.z);
    }

    // ---- 点射：3~5 连发 + 停顿，替代原来的「2 秒一发」----
    // 致盲时不推进点射：updateBurst 结尾会把 wantShoot 置回 true，
    // 而旧写法在致盲分支直接 return，根本走不到这里（main.js 的 enemiesShoot 也有 blindT 守卫，是双保险）
    if (!blind) this.updateBurst(dt, dist);

    this.eyeline.copy(gp).add(new THREE.Vector3(0, 1.68, 0));
    this.applyFlash(dt);
  }

  // 枪口的世界坐标（枪口火光与枪声定位用）。骨架给出「脚底系」的解析解，
  // 再按本组朝向旋转平移 —— 不用 localToWorld：后者依赖 matrixWorld，
  // 要等下一次 render 才更新（新生敌人会算到世界原点，attachMuzzleTo 踩过同一个坑）
  muzzleWorld(out) {
    out = out || new THREE.Vector3();
    this.rig.muzzleBody(out);
    const yaw = this.group.rotation.y;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const x = out.x, y = out.y, z = out.z;
    out.set(
      this.group.position.x + x * c + z * s,
      this.group.position.y + y,
      this.group.position.z - x * s + z * c
    );
    return out;
  }

  // 每开一枪：骨架来一下后坐（枪往肩里推 + 枪口上跳），由 main.js 的 enemiesShoot 调
  recoil() { this.rig.recoil(); }

  updateBurst(dt, dist) {
    if (dist > ENGAGE_FAR + 4) { this.burstLeft = 0; this.wantShoot = false; return; }
    // 还没把枪口转过来就先不打（否则会一边转身一边朝侧面泼子弹）
    if ((this.aimErr || 0) > AIM_TOL) { this.wantShoot = false; return; }
    if (this.burstLeft > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.burstLeft--;
        this.burstTimer = 0.1 + Math.random() * 0.05;
        this.wantShoot = true;
        return;
      }
    } else {
      this.burstPause -= dt;
      if (this.burstPause <= 0) {
        this.burstLeft = 3 + Math.floor(Math.random() * 3); // 3~5 连发
        this.burstTimer = 0;
        this.burstPause = pauseFor(0.85, 0.75, this.fireMul);
      }
    }
    this.wantShoot = false;
  }

  // 简单障碍规避：前方被挡就沿切线绕行
  avoid(sx, sz) {
    if (!Number.isFinite(sx) || !Number.isFinite(sz)) return [0, 0];
    const colliders = this.colliders;
    if (!colliders || !colliders.length) return [sx, sz];
    const nx = this.group.position.x + sx;
    const nz = this.group.position.z + sz;
    const ahead = nx + Math.sign(sx) * 0.5;
    const aheadZ = nz + Math.sign(sz) * 0.5;
    // 只有**落到地面**的碰撞体才算墙。avoid() 不看 c.h（低矮的木箱也当墙，宁可绕远），
    // 但必须看 c.y0 —— 悬空的天桥/屋顶（见 map.js）在敌人的高度上什么都没有，
    // 把它们当墙会让桥下的整条通道对 AI 变成死路，敌人永远走不过中路。
    const hits = (px, pz) =>
      colliders.some(
        (c) =>
          (c.y0 === undefined || c.y0 < 1.2) &&
          Math.abs(px - c.x) < c.hx + 0.5 &&
          Math.abs(pz - c.z) < c.hz + 0.5
      );
    if (!hits(ahead, aheadZ)) { this.detourT = 0; return [sx, sz]; }
    const gx = this.group.position.x, gz = this.group.position.z;
    const len = Math.hypot(sx, sz) || 1;
    // 绕行方向**承诺一段时间**（不是每帧重算）。一段绕行开始时两边各探 1.1m，
    // 挑真的空的那边；一样空/一样堵就按 seed 定，保证是确定的、不抖的。
    if (this.detourT <= 0) {
      const probe = (s) => {
        const px = gx + (-sz * s / len) * 1.1, pz = gz + (sx * s / len) * 1.1;
        let n = 0;
        for (const c of colliders) {
          if (c.y0 !== undefined && c.y0 >= 1.2) continue;
          if (Math.abs(px - c.x) < c.hx + 0.45 && Math.abs(pz - c.z) < c.hz + 0.45) n++;
        }
        return n;
      };
      const hl = probe(1), hr = probe(-1);
      // 平手时按 seed 定，方向要**真的随机**：seed 是 Math.random()*2π，恒 ≥ 0，
      // 直接拿 seed 判号会让所有敌人都挑同一边（同一个死角里挤成一团）。
      this.detourSide = hl === hr ? (Math.sin(this.seed) >= 0 ? 1 : -1) : (hl < hr ? 1 : -1);
      this.detourT = 1.1;
    }
    // 把本帧位移在水平面内转 90°（保长），即沿掩体切向走
    return [-sz * this.detourSide, sx * this.detourSide];
  }

  moveBy(x, z) {
    // 兜底：任何非有限增量都不写进位置。NaN 一旦进了 position 就不会自愈
    // （后续每帧的 dist/atan2 全是 NaN），敌人会静默消失在场景里。
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    this.group.position.x += x;
    this.group.position.z += z;
  }

  applyFlash(dt) {
    if (this.flashAmt > 0) this.flashAmt = Math.max(0, this.flashAmt - dt * 7);
    const k = this.flashAmt;
    if (k === this._lastFlash) return;
    this._lastFlash = k;
    // 材质是每人一份、几何体全局共享 → 交给骨架按材质（而非按网格）刷 emissive
    this.rig.setFlash(k);
  }

  // 被闪光弹致盲（秒）
  blind(seconds) {
    if (this.dead) return;
    this.blindT = Math.max(this.blindT, seconds);
  }

  setFlash() {
    this.flashAmt = 1;
    this.flinch = 1;
  }

  // 击杀 → 进入倒地状态（先不销毁：尸身要留在场上）
  takeDamage(amount) {
    if (this.dead) return false;
    this.health -= amount;
    this.setFlash();
    if (this.health <= 0) {
      this.dead = true;
      this.corpseT = 0;
      this.wantShoot = false;
      this.blindT = 0;
      this.flashAmt = 0;
      this.applyFlash(0); // 清掉受击闪红，尸体不该继续发光
      return true;
    }
    return false;
  }

  // 倒地 → 平躺保留 → 下沉消失（主程序据此回收进对象池）
  updateCorpse(dt) {
    this.corpseT += dt;
    const p = Math.min(this.corpseT / CORPSE_FALL, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    // 绕腰向前扑倒。转轴在腰上，所以倒地时必须把 pivot 一起降到甲板面，
    // 否则整具尸体会以齐腰的高度悬在空中（绕脚底转才不需要这一步）
    this.tilt.rotation.x = ease * Math.PI * 0.5;
    this.tilt.rotation.z = 0;
    // 放平后的高度 = 「身体的腰线离地多高」。绕腰转 90° 后，身体前方变成下方，
    // 所以这个值必须 ≥ 身体前表面的深度（胸甲 0.125 / 头盔脸罩 ~0.18），
    // 否则整个前半身会插进甲板。0.26 是实测出来的平衡点（见 enemy_model.js 的倒地段）。
    this.tilt.position.y = BODY_PIVOT * (1 - ease) + 0.26 * ease;
    if (this.corpseT > CORPSE_HOLD) {
      this.tilt.position.y -= dt * (0.26 / CORPSE_SINK) * 3;
    }
    // 骨架同步进入瘫倒姿势：膝盖跪折、上身塌下、双手松开
    // （所以尸体是「瘫下去」的，而不是一整块板子拍在甲板上）
    this.rig.animate(dt, { moved: 0, speed: 0, aim: 0, aimPitch: 0, blind: 0, flinch: 0, dead: true });
  }

  get corpseDone() {
    return this.dead && this.corpseT > CORPSE_HOLD + CORPSE_SINK;
  }
}

export class EnemyManager {
  constructor(scene, groundSize, opts = {}) {
    this.scene = scene;
    this.groundSize = groundSize;
    this.enemies = [];   // 存活（射线目标 / aliveCount 依此）
    this.corpses = [];   // 倒地尸身（既挡不了子弹，也不计入存活）
    this.free = [];      // 对象池
    this.wave = 0;
    this.frozen = false;
    this.onFootstep = opts.onFootstep || null;
    this._nameSeq = 0;
    // 每次刷出抽一份「枪型 + 皮肤」，由 main.js 注入（它才有 WEAPON_DEFS 与 guncatalog）。
    // 返回 { rifle, gunId, gunSkin, weaponName, fireMul }；没注入就退回裸 AK 的旧行为。
    this.loadoutPicker = opts.loadoutPicker || null;
  }

  aliveCount() {
    return this.enemies.length;
  }

  nextName() {
    return ENEMY_NAMES[this._nameSeq++ % ENEMY_NAMES.length];
  }

  // 复用池里的尸体/新建，避免一局创建上百个敌人导致材质与纹理泄漏。
  // 枪型/皮肤**每次刷出都重抽**：敌人是对象池复用的，同一具骨架会反复易主，
  // 只在构造函数里挂一次枪会让所有人都端着上一个死者的枪。
  acquire(x, z) {
    const load = this.loadoutPicker ? this.loadoutPicker() : null;
    let e = this.free.pop();
    if (!e) {
      e = new Enemy(this.scene, x, z, load || {});
      e.onFootstep = this.onFootstep;
      e.colliders = this._colliders || null;
    }
    e.reset(x, z, Object.assign({ name: this.nextName() }, load || {}));
    return e;
  }

  // 团队竞技：从敌方基地（-z 端）补充到指定存活数量
  spawnGroup(count, bounds) {
    this.wave++;
    const hw = bounds ? bounds.hw : 26;
    const hl = bounds ? bounds.hl : 68;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * (hw * 2 - 6);
      const z = -(hl - 4 - Math.random() * 6);
      this.enemies.push(this.acquire(x, z));
    }
    return this.enemies.length;
  }

  release(e) {
    this.scene.remove(e.group);
    this.free.push(e);
  }

  update(dt, player, colliders) {
    this._colliders = colliders || null;

    // 先推进尸身。本帧刚死的下一帧才开始倒地，避免同一帧被推进两次
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.updateCorpse(dt);
      if (c.corpseDone) {
        this.corpses.splice(i, 1);
        this.release(c);
      }
    }

    if (!this.frozen) {
      for (const e of this.enemies) {
        e.colliders = this._colliders;
        e.update(dt, player);
      }
    }

    // 存活筛掉已死的，转入尸体数组
    const alive = [];
    for (const e of this.enemies) {
      if (e.dead) this.corpses.push(e);
      else alive.push(e);
    }
    this.enemies = alive;

    return { aliveCount: this.enemies.length, allCleared: false };
  }

  // 供闪光弹使用
  blindAll(x, z, radius, seconds) {
    for (const e of this.enemies) {
      const dx = e.group.position.x - x, dz = e.group.position.z - z;
      const d = Math.hypot(dx, dz);
      if (d < radius) e.blind(seconds * (1 - d / radius) + 0.8);
    }
  }
}
