// ===== 战术突击 FPS - 主游戏（运输船 · 团队竞技 · CF 手感）=====
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SFX } from "./audio.js";
import { EnemyManager, ENEMY_NAMES, ENEMY_TUNING } from "./enemies.js";
import { buildMap } from "./map.js";
import { ViewArms, ARM_ANCHORS, ELBOWS, MAGWELL } from "./viewarms.js";
import {
  SKINS, STOCK, DEFAULT_SKIN, DEFAULT_MUZZLE,
  skinsFor, findSkin, isSkinned, skinLabel, paintSkin, modelOf, allModelSkins,
} from "./skins.js";
import { buildGunCatalog, worldModel, enemyModel, randomGunRoll } from "./guncatalog.js";
import { Chat } from "./chat.js";

// ---------- DOM ----------
const viewport = document.getElementById("viewport");
const hud = document.getElementById("hud");
const menu = document.getElementById("menu");
const gameover = document.getElementById("gameover");
const fxLayer = document.getElementById("fx-layer");
const cross = document.getElementById("crosshair");
const hpVal = document.getElementById("hpVal");
const hpFill = document.getElementById("hpFill");
const ammoVal = document.getElementById("ammoVal");
const ammoFill = document.getElementById("ammoFill");
const teamScoreVal = document.getElementById("teamScoreVal");
const enemyScoreVal = document.getElementById("enemyScoreVal");
const roundTimeEl = document.getElementById("roundTime");
const limitVal = document.getElementById("limitVal");
const toast = document.getElementById("toast");
const killfeed = document.getElementById("killfeed");
const streakEl = document.getElementById("streak");
// 连杀窗口倒计时（常驻，见 updateStreakHud）+ 高档位的全屏边缘辉光
const streakTimerEl = document.getElementById("streakTimer");
const streakTimerNumEl = document.getElementById("streakTimerNum");
const streakTimerFillEl = document.getElementById("streakTimerFill");
const streakFlashEl = document.getElementById("streakFlash");
const killIconEl = document.getElementById("killIcon");
const hitdir = document.getElementById("hitdir");
const flashOverlay = document.getElementById("flashOverlay");
const scopeEl = document.getElementById("scope");
const scoreboardEl = document.getElementById("scoreboard");
const deathEl = document.getElementById("deathScreen");
const deathKillerEl = document.getElementById("deathKiller");
const deathWeaponEl = document.getElementById("deathWeapon");
const deathFillEl = document.getElementById("deathFill");

// ---------- 常量 ----------
const EYE = 1.62;
const CROUCH_EYE = 1.02;
const PLAYER_RADIUS = 0.45;
// 站立时头顶的高度（下蹲不参与判定：碰撞体是按「站着能不能过」算的）。
// 只被 colliders 的 y0 用到 —— 判断一个悬空物（天桥 / 舱室屋顶）是在头顶还是在身前。
const PLAYER_TOP = 1.78;
// 一个「台阶」的最大高度：矮于它的碰撞体不挡人，只当作可以迈上去的台面。
// 0.4m 的舷侧走道、0.345m 的甲板舱盖都靠它变成能走上去的地方；
// 0.93m 的木箱 / 1.85m 的箱堆 / 2.43m 的集装箱仍然要跳。
const STEP_H = 0.5;

// CF 没有冲刺键：默认就是奔跑，Shift 是静步潜行
const RUN_SPEED = 7.2;
const SNEAK_SPEED = 3.5;
const CROUCH_SPEED = 3.0;
const GRAVITY = 21;
const JUMP_VEL = 7.5;
const ACCEL_GROUND = 14; // 地面加速度
const ACCEL_AIR = 4;     // 空中极低 —— 保留水平动量才有连跳
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.12;

const BASE_FOV = 75;
// 两级变倍照抄 CS 的 AWP（`WeaponDefs.js` 的 `zoom: [30.5, 7.5]`，2.75× / 11.4×）。
// 原值 22 / 11 是 CF 的量级，比 CS 收得更紧 —— 换成 CS 的口径后一级镜的开阔度明显变大，
// 更适合我们这张 40×68m 的运输船甲板（22° 时几乎只剩一条缝）。
const SCOPE_FOV = 30.5; // 一级镜
const SCOPE_FOV2 = 7.5; // 二级镜

// ---------- 渲染器 / 场景 / 相机 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
// 两通道渲染（世界 + 视模）自己管清屏，不能让 three 在每次 render 时自动清 ——
// 自动清会把视模通道刚画上的东西一起抹掉。
renderer.autoClear = false;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.08, 1200);
camera.rotation.order = "YXZ";
scene.add(camera);

// ---------- 视模通道（武器 + 手臂）----------
// 为什么单开一层：枪和手是挂在相机上的，深度永远比场景近，只要和世界一起画，
// 贴到集装箱/墙角上时枪管与手臂就会直接插进墙里。单开一个场景，先用世界自己的深度清掉，
// 再画视模，等价于「枪永远在最前面」，而且**不动 FOV、不动相机矩阵**（不像缩小模型的土办法）。
//
// vmCamera 是**单位变换**：武器组本来就挂在相机下（组局部 = 相机空间），搬过去之后
// 坐标语义一字不变。
// **vmCamera 必须 add 进 vmScene**：renderer.render(scene, camera) 只从 scene 这一棵树
// 往下 projectObject()，挂在「不在场景里的相机」下面的东西既不会被画、也不报错 ——
// 表现就是「枪和手全都不见了」，而控制台干净得很。
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.01, 5);
// vmScene 的灯：半球光给底光（背对太阳时枪不会全黑），方向光每帧从世界太阳镜像过来。
// 环境贴图（IBL）在 init 里 buildMap 之后补上 —— AWM 金皮/匕首金皮的 metalness 很高，
// 没有 IBL 会渲成两块黑铁。
const vmHemi = new THREE.HemisphereLight(0xb0d0ea, 0x8f8a7e, 1.1);
const vmSun = new THREE.DirectionalLight(0xfff4e0, 2.6);
vmSun.position.set(0, 1, 0);
// 补光 + 轮廓光。只有「半球 + 镜像太阳」两盏时，太阳绕到背后（朝太阳走那半圈）
// 手和袖子会整片压暗，手套的织纹与磨损糊成一块 —— 视模是**相机锁定**的，
// 它永远待在画面的同一个角落，所以这两盏可以按相机空间写死方向，不必跟着世界转。
// 反过来说：它们只服务视模，**不要**搬进主场景（世界的光照是另一套，见下方「灯光」一节）。
const vmFill = new THREE.DirectionalLight(0xdae6f2, 0.55);   // 右后下方：托起掌背与袖管的底面
vmFill.position.set(0.75, -0.5, 0.85);
const vmRim = new THREE.DirectionalLight(0xfff2df, 0.7);     // 左后上方：给袖管勾一条边，与背景分开
vmRim.position.set(-1.0, 0.75, 0.9);
vmScene.add(vmHemi, vmSun, vmFill, vmRim, vmCamera);

// ---------- 灯光（晴天正午）----------
// 天光：天顶偏暖的冷蓝 + 甲板反射的暖灰地色。原来地色 0x8d9aa2 明显偏蓝，
// 深色甲板会被染成蓝灰，所以地色改成中性暖灰。
scene.add(new THREE.HemisphereLight(0xb0d0ea, 0x8f8a7e, 1.1));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
sun.position.set(-34, 78, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.camera.far = 240;
sun.shadow.bias = -0.0004;
// three r155+ 支持 shadow.intensity：调它拿到硬朗的直射光，而不用动全局 shadowMap.type
if ("intensity" in sun.shadow) sun.shadow.intensity = 1.0;
scene.add(sun);

// ---------- 地图 ----------
let gameReady = false;
let mapData = null;
let obstacleMeshes = [];
// 拍平后的障碍 Mesh 列表。map 的 obstacles 是 Mesh 与 Group 混装（106 Mesh + 28 Group
// 内含 392 Mesh），非递归 intersectObjects(obstacleMeshes,false) 会**静默漏掉** Group 里的
// 所有实体 —— 集装箱全是 Group，等于掩体完全不挡视线。障碍是静态的，初始化时拍平一次。
let obstacleFlat = [];
let colliders = [];
let bounds = { hw: 28, hl: 70 };

// ---------- 武器系统（多槽位） ----------
// ---------- CS2 弹道表（逐发累积抬枪偏移，度；x 右+ / y 上+）----------
// 来源：counter-strike-in-browser（MIT，Copyright (c) 2026 StarKnightt）src/gameplay/WeaponDefs.js。
// 语义：第 i 发**沿着表里第 i 项**给出的偏移飞出去（第 1 发 `[0,0]` 打准星）；打完整张表就停在最后一项。
// 索引在停火 `recoilReset` 秒后归零；恢复曲线由 `punchHold` + `punchDecay{exp,lin}` 决定
// （先按 `e^(-dt·exp)` 指数衰减，再按 `lin·dt` 度/秒线性扣，两项都在 `sinceShot > punchHold` 之后才开始）。
//
// **`viewTrack = 1.0`（相机跟满后坐）是本作与 CS 唯一一处刻意的差异。**
// CS 取 0.45~0.55：相机只跟着走一半、HUD 十字留在原地（那个十字是绘制上去的图元，所以「准星撒谎」在那边
// 是设计）。我们的准星是屏幕中心的**纯几何点**，且 AGENTS.md 有一条硬约定「准星所指必中」——
// 只跟一半会让子弹系统性地落在准星之外。取 1.0 之后子弹射线与相机读的是同一组
// `Euler(pitch+recoilPitch, yaw+recoilYaw)`，那条约定一个字都不用改，玩家看到的抬枪就是真实的落点。
// 于是 CS 的随机散布锥（`inacc`）只用来驱动**准星张开**这一项纯视觉表现，绝不喂子弹。
function akPattern() {
  const dy = [0, 0.30, 0.40, 0.55, 0.65, 0.65, 0.55, 0.40, 0.28, 0.22, 0.07, 0.06, 0.05, 0.04, 0.03, 0.03, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
  const dx = [0, 0.03, -0.03, 0.03, 0.00, -0.03, 0.03, -0.03, -0.06, -0.11, -0.25, -0.28, -0.25, -0.19, -0.11, 0.14, 0.30, 0.39, 0.39, 0.33, 0.25, 0.11, -0.06, -0.22, -0.28, -0.25, -0.17, 0.06, 0.19, 0.22];
  const out = []; let x = 0, y = 0;
  for (let i = 0; i < 30; i++) { x += dx[i]; y += dy[i]; out.push([x, y]); }
  return out;
}
// 把一张表按 (kx, ky) 缩放 —— 只给下面两张**本作自配**的表用，AK/AWM 是 CS 原表、不走这里。
function scalePattern(src, kx, ky) {
  return src.map(([x, y]) => [+(x * kx).toFixed(4), +(y * ky).toFixed(4)]);
}
// M4 与 USP：CS 那边**没有**这两把（那份仓库只有 ak47 / awp / knife），按同一风格手配。
// 写出来是为了让「同风格」可核对，而不是含糊一句「参考 CS」：
//   · M4A4 的口径是「比 AK 更收窄、垂直更直、横向勾得更浅」，所以直接拿 AK 的逐发增量按
//     (dx × 0.55, dy × 0.82) 缩放 —— 30 发对 30 发，索引一一对应。
//   · USP 12 发半自动，间隔 0.17s：`sinceShot` 只在两发之间走 0.02s 的恢复（`punchHold` 0.15 挡住了大头），
//     所以连点会真的沿表往上爬，与 CS 的手枪压枪一致。
const M4_PATTERN = scalePattern(akPattern(), 0.55, 0.82);
const USP_DY = [0, 0.55, 0.75, 0.80, 0.70, 0.55, 0.40, 0.28, 0.20, 0.14, 0.10, 0.08];
const USP_DX = [0, 0.05, 0.12, 0.20, 0.26, 0.30, 0.26, 0.18, 0.06, -0.08, -0.18, -0.24];
const USP_PATTERN = (() => {
  const out = []; let x = 0, y = 0;
  for (let i = 0; i < 12; i++) { x += USP_DX[i]; y += USP_DY[i]; out.push([x, y]); }
  return out;
})();

// 准星张开的输入（CS 的 `inacc` 表，单位是「最大偏离角的正切」，见 PX_PER_DEG 一节）。
//   · `stand` / `crouch` / `move` / `jumpInitial` / `jump` 是姿态与移动的散布锥；
//   · `fire` 是每发的连发惩罚增量；`recoverStand` 是「掉到 1/10 所需秒数」。
// AK 与 AWP 是 CS 原值（`WeaponDefs.js`）；M4 / USP 那边没有，按同一口径缩放：
// M4 取 AK 的 0.92（更稳），USP 取 AK 的 1.6（手枪站定本来就散一档）。
const INACC_AK = { stand: 0.00641, crouch: 0.00481, move: 0.17506, jumpInitial: 0.10094, jump: 0.14076, fire: 0.0078, recoverStand: 0.368 };
const INACC_AWP = { stand: 0.0808, crouch: 0.0606, move: 0.17648, jumpInitial: 0.17286, jump: 0.13383, fire: 0.05385, recoverStand: 0.345 };
const scaleInacc = (src, k) => Object.fromEntries(Object.entries(src).map(([n, v]) => [n, +(v * k).toFixed(5)]));
const INACC_M4 = scaleInacc(INACC_AK, 0.92);
const INACC_USP = scaleInacc(INACC_AK, 1.6);

// 1=主武器(背包三选一) 2=副武器 3=近战 4=投掷物(手雷/闪光弹/烟雾弹循环)
// Q=上/副武器快速切换，B=背包选主武，右键=AWM 开镜 / 匕首重击
const WEAPON_DEFS = {
  ak: {
    id: "ak", slot: "primary", type: "rifle", name: "AK-47", model: "./models/ak47.glb",
    rotY: -Math.PI / 2, targetLen: 0.82, key: "1", fullAuto: true,
    // enemyFireMul：敌人端着这把枪时的**点射节奏**倍率（只影响 burstPause，不动伤害）。
    // 端着 AWM 按 AK 的节奏扫射太出戏。敌人 HP 与 ENEMY_TUNING 一律不碰，
    // 「AK 三枪死」那条数值不受影响。
    enemyFireMul: 1.0,
    // rangeMod：CS 的落点衰减 `rangeMod ^ (距离/9.525)`（见 damageAt）。比原来那条
    // `max(0.65, 1-(d-18)/40*0.35)` 平缓得多（50m 处 CS → 0.90、旧式 → 0.72）。
    // 近距离 3 枪死保住了（36 × 3 = 108 > 100），50m 处由 5 枪变 4 枪 —— 这是一次真实的手感改动。
    stats: { magSize: 30, reserve: 90, interval: 0.1, dmg: 36, reload: 2.43, rangeMod: 0.98 },
    pattern: akPattern(), recoilReset: 0.55, punchHold: 0.15, viewTrack: 1.0, punchDecay: { exp: 5, lin: 2 },
    inacc: INACC_AK,
  },
  m4: {
    id: "m4", slot: "primary", type: "rifle", name: "M4A1", model: "./models/m4.glb",
    rotY: Math.PI / 2, targetLen: 0.82, key: "1", fullAuto: true,
    enemyFireMul: 0.9,
    stats: { magSize: 30, reserve: 90, interval: 0.0901, dmg: 33, reload: 3.1, rangeMod: 0.99 },
    pattern: M4_PATTERN, recoilReset: 0.55, punchHold: 0.15, viewTrack: 1.0, punchDecay: { exp: 5, lin: 2 },
    inacc: INACC_M4,
  },
  awm: {
    id: "awm", slot: "primary", type: "sniper", name: "AWM", model: "./models/awm.glb",
    rotY: -Math.PI / 2, targetLen: 0.95, key: "1", fullAuto: false,
    enemyFireMul: 3.2,
    // boltTime：CS 的栓动循环 —— 开火后退镜、拉栓 1.2s、拉完自动回镜。挂在 state 上按 dt 走。
    stats: { magSize: 10, reserve: 30, interval: 1.4548, dmg: 115, reload: 3.7, rangeMod: 0.99, boltTime: 1.2, zoom: true },
    // AWP 的弹道表是 CS 原表：5 项、每项抬 3.0°。射速 1.4548s 远大于 recoilReset 0.55s，
    // 所以实战里每发都从 `[0,0]` 重新起表 —— 等效于「每枪固定 +3.0° 抬枪、+0.3° 右偏」。
    // 巧合的是旧值 0.05 rad ≈ 2.86°，量级本来就对得上。
    pattern: [[0, 0], [0.3, 3.0], [-0.3, 3.0], [0.3, 3.0], [-0.3, 3.0]],
    recoilReset: 0.55, punchHold: 0.20, viewTrack: 1.0, punchDecay: { exp: 6, lin: 10 },
    inacc: INACC_AWP,
  },
  pistol: {
    id: "pistol", slot: "secondary", type: "pistol", name: "USP", model: "./models/pistol.glb",
    rotY: 0, targetLen: 0.55, key: "2", fullAuto: false,
    stats: { magSize: 12, reserve: 24, interval: 0.17, dmg: 35, reload: 2.2, rangeMod: 0.91 },
    // **punchHold 必须 > 射击间隔（0.17s），否则这张表等于白写。** `punchHold` 决定「停火多久
    // 之后才开始恢复」，取 0.15 时每两发之间会漏进 ~0.02s 的恢复（实测 60fps 下正好 1~2 帧，
    // 一次就扣掉 `lin` 的量），连点十几发 `aimPunch` 会反复被打回 0 —— 表里第 3 项往后永远走不到。
    // 取 0.25（> 0.17）之后连续射击不再漏恢复，连点的手枪抬枪轨迹才真的按表爬；单点之间
    // 0.25s 的静止仍然足够让它回落。**这条约束对 AK/M4 天然成立（0.1/0.0901 < 0.15），只对手枪要留意。**
    pattern: USP_PATTERN, recoilReset: 0.55, punchHold: 0.25, viewTrack: 1.0, punchDecay: { exp: 6, lin: 10 },
    inacc: INACC_USP,
  },
  knife: {
    id: "knife", slot: "melee", type: "melee", name: "军用匕首", model: "./models/knife.glb",
    rotY: 0, targetLen: 0.5, key: "3",
    // CS 口径：轻击 40（背后 90）、重击 65（背后 180），够得着 0.91m。
    // **距离比旧值（2.2m）短得多** —— 旧值等于「隔着一个人挥刀还能中」。这是有意的收紧。
    stats: {
      range: 0.91,
      light: { dmg: 40, backstab: 90, interval: 0.4 },
      heavy: { dmg: 65, backstab: 180, interval: 1.0 },
    },
    pattern: [[0, 0]], recoilReset: 0.55, punchHold: 0.15, viewTrack: 0, punchDecay: { exp: 6, lin: 10 },
  },
  // ---- 投掷物三件套（CF 的 4 号槽循环切换）----
  frag: {
    id: "frag", slot: "grenade", type: "grenade", nade: "frag", name: "手雷",
    model: "./models/grenade.glb", rotY: 0, targetLen: 0.22, key: "4", tint: 0x4a5a3a,
    stats: { count: 2, throwCooldown: 0.85, radius: 6.5, dmg: 100, fuse: 2.2 },
  },
  flash: {
    id: "flash", slot: "grenade", type: "grenade", nade: "flash", name: "闪光弹",
    model: "./models/grenade.glb", rotY: 0, targetLen: 0.22, key: "4", tint: 0xb9c2c8,
    stats: { count: 2, throwCooldown: 0.85, radius: 22, blind: 4.5, fuse: 1.7 },
  },
  smoke: {
    id: "smoke", slot: "grenade", type: "grenade", nade: "smoke", name: "烟雾弹",
    model: "./models/grenade.glb", rotY: 0, targetLen: 0.22, key: "4", tint: 0x555c62,
    stats: { count: 2, throwCooldown: 0.85, radius: 5.4, life: 14, fuse: 1.5 },
  },
};
const PRIMARY_IDS = ["ak", "m4", "awm"];
const NADE_IDS = ["frag", "flash", "smoke"];

// owned[id] = { group, gun, baseGun, baseMuzzle, muzzleLocal, models, modelMuzzles,
//               modelLoads, state, def, glowMats }
// `gun` = **当前挂着的**模型子树；`baseGun` = 出厂低模（模型皮肤会换掉前者，但永不换后者）。
// 单存 `baseGun` 是为了世界模型目录（scripts/guncatalog.js）能从中派生掉落物/敌人手持的变体 ——
// **只能从 baseGun 派生**：模型皮肤那把是高精度模型、朝向/标尺/材质名全都不同，
// 拿它去建目录会把敌人手里的枪也换成模型，而 AGENTS.md 的约定是「仅玩家用模型」。
// 也不能靠 group.children[0] 现取：group 后面还会被 viewArms.attach / attachMuzzleTo
// 塞进别的子节点，第一个孩子是谁就不确定了。
const owned = {};
// WEAPON_STATE 恒指向当前武器 state（切枪时重新赋值），供换弹/弹药/后坐复用
let WEAPON_STATE = null;
let currentId = "ak";
// 后坐力仅作相机/射线的临时偏移，不写入 player.pitch，保证瞄准单一数据源。
// **它们是「当前武器 aimPunch 的派生量」，不是独立累加器** —— 唯一的写入点是 syncRecoil()。
// 这样做的意义是：相机（`camera.rotation`）与子弹（`Euler(pitch+recoilPitch, yaw+recoilYaw)`）
// 读的**必然是同一个值**，不可能出现「搬了弹道表但准星撒谎」。见 WEAPON_DEFS 上方的弹道表一节。
let recoilPitch = 0;
let recoilYaw = 0;
const D2R = Math.PI / 180;
// 开镜状态
let scoped = false;

function cur() { return owned[currentId]; }

// 把当前武器的 `aimPunch`（度）搬到相机/射线用的 `recoilPitch`/`recoilYaw`（弧度）。
// 符号：CS 的 `aimPunch.x` 是「往右」，而本作 +`rotation.y` 是**左转**（Euler Y 作用在 (0,0,-1) 上
// 得到 (-sinθ, 0, -cosθ)，θ>0 时朝 -x），所以横向取负。纵向两边同号（+ = 抬头）。
function syncRecoil() {
  const o = owned[currentId];
  if (!o) { recoilPitch = 0; recoilYaw = 0; return; }
  const vt = o.def.viewTrack ?? 1.0;
  const p = o.state.aimPunch;
  recoilPitch = p.y * D2R * vt;
  recoilYaw = -p.x * D2R * vt;
}

// 按 CS 的落点衰减 `rangeMod ^ (距离/9.525)` 算命中伤害。9.525m 是 CS 的「一个衰减单位」
// （25 英尺），照抄即可 —— 它只影响曲线的快慢，与我们的甲板尺寸无关。
function damageAt(def, dist) {
  const rm = def.stats.rangeMod ?? 1;
  return Math.max(1, Math.round(def.stats.dmg * Math.pow(rm, dist / 9.525)));
}

// 推进一步弹道表：把 `aimPunch` 加到**下一发**要用的偏移上。
// 必须在命中处理**之后**调用 —— 与 AGENTS.md「本枪后坐必须在命中处理之后才累加」同一条：
// 首发的射线要用打表之前的偏移，否则第一枪就比准星所见提前抬了一枪的量。
function advancePunch() {
  const def = WEAPON_DEFS[currentId];
  const st = cur().state;
  const pat = def.pattern;
  // 表长 1（刀 / 投掷物）时没有「下一发」可言，直接返回 —— 少了这个守卫，
  // `pat[n + n - 2]` 会读到 `pat[-1]` 得 undefined，`nxt[0] - prv[0]` 当场抛异常。
  if (!pat || pat.length < 2) return;
  const n = pat.length;
  const idx = Math.min(st.recoilIdx, n - 1);
  const next = idx + 1 < n ? idx + 1 : n - 1; // 打满之后停在最后一项（CS 同）
  const prev = idx + 1 < n ? idx : n - 2;
  st.aimPunch.x += pat[next][0] - pat[prev][0];
  st.aimPunch.y += pat[next][1] - pat[prev][1];
  st.recoilIdx = idx + 1;
  syncRecoil();
}

// 停火恢复。**对每一把枪都推进，不只手上这把** —— 与 `state.cooldown` 只递减当前武器不同：
// cooldown 是 0.07s 的量级，冻结了无感；而「扫半梭子 → 切枪 → 切回来」时若后坐被冻结，
// 那半梭子的抬枪会原封不动地等着你，而 `recoilPitch` 是即时同步的，切回来那一帧画面会跳。
function decayPunch(dt) {
  for (const k in owned) {
    const s = owned[k].state;
    const def = WEAPON_DEFS[k];
    s.sinceShot = Math.min(999, s.sinceShot + dt);
    if (s.sinceShot > (def.recoilReset ?? 0.55)) s.recoilIdx = 0;
    const ap = s.aimPunch;
    if ((ap.x !== 0 || ap.y !== 0) && s.sinceShot > (def.punchHold ?? 0.15)) {
      // 指数项 + 线性尾，两项都作用在**同一个**「衰减系数」上（CS 的写法）。
      // 线性尾按当前**模长**扣，扣穿了就整体归零，避免过零反向。
      const d = def.punchDecay ?? { exp: 6, lin: 10 };
      const e = Math.exp(-dt * d.exp);
      const len = Math.hypot(ap.x, ap.y);
      const nl = Math.max(0, len * e - d.lin * dt);
      const f = len > 1e-9 ? nl / len : 0;
      ap.x *= f; ap.y *= f;
      if (Math.abs(ap.x) < 1e-4) ap.x = 0;
      if (Math.abs(ap.y) < 1e-4) ap.y = 0;
    }
    // 准星张开的连发惩罚回落。CS 的 `recoverStand` 是「**掉到 1/10** 所需秒数」
    // （`Weapons` 里用的是 `exp(-dt · LN10 / recover)`，即 `10^(-dt/recover)`），所以这里照抄那个底。
    if (s.inaccPenalty > 0) {
      const tau = def.inacc?.recoverStand ?? 0.4;
      s.inaccPenalty *= Math.pow(10, -dt / tau);
      if (s.inaccPenalty < 1e-5) s.inaccPenalty = 0;
    }
  }
  syncRecoil();
}

// ---------- 准星张开（**纯视觉**）----------
// 两路输入，都**只画在准星的四条刻线上，绝不喂子弹**（决定 4 的落点就在这一节）：
//   ① 弹道表**下一发的增量** `pattern[idx+1] − pattern[idx]`。这一项最有信息量，
//      而且是真的：`viewTrack = 1.0` 时相机虽跟满后坐，准星中心也只代表「现在这一发」，
//      下一发相对它会偏这么多。连发时准星往外张 = 「你现在再打一发会飘多少」。
//   ② CS 的 `inacc` 散布锥（站立/下蹲/移动/空中 + 每发上跳的惩罚）。CS 用它描述**子弹的随机散布**；
//      我们不出这种散布，所以这一项只是沿用它的**口径**（站定最紧、跑动很散、空中最散），
//      让准星的外张与移动状态保持 CS 玩家熟悉的那套读数。
// 角度 → 像素用的是真值：713px 高 / 75° 竖直 FOV 下 1° ≈ 9.5px。
// `inacc` 里存的正是「最大偏离角的**正切**」（CS 注释原文就是 tangent），所以要过一次 atan。
// 旧口径是 `4 + spread*480 + hSpeed*1.1` —— 一个无量纲的杂拌，且恒 ≥ 4px、站定不收紧。
const PX_PER_DEG = 9.5;
const inaccToPx = (v) => Math.atan(Math.max(0, v || 0)) * 57.29577951308232 * PX_PER_DEG;

// 姿态 + 移动的散布锥（正切值，与 CS 同单位）。静步不叠移动项 —— 与「静步不触发脚步声」同源。
function baseInaccuracy(def) {
  const ic = def.inacc;
  if (!ic) return 0;
  const p = player;
  if (!p.onGround) return ic.jumpInitial + ic.jump * Math.min(1, Math.abs(p.vel.y) / JUMP_VEL);
  let base = p.crouching ? ic.crouch : ic.stand;
  const hs = Math.hypot(p.vel.x, p.vel.z);
  let m = (hs - 0.34 * RUN_SPEED) / (0.95 * RUN_SPEED - 0.34 * RUN_SPEED);
  m = Math.max(0, Math.min(1, m));
  if (m > 0 && !p.sneaking) base += ic.move * Math.pow(m, 0.25);
  return base;
}
function crosshairGap() {
  const def = WEAPON_DEFS[currentId];
  const st = cur().state;
  let px = 4; // 基线：站定不动时准星的固有开口
  px += inaccToPx(baseInaccuracy(def));
  px += inaccToPx(st.inaccPenalty);
  const pat = def.pattern;
  if (pat && pat.length >= 2) {
    const n = pat.length, idx = Math.min(st.recoilIdx, n - 1);
    const next = idx + 1 < n ? idx + 1 : n - 1;
    const prev = idx + 1 < n ? idx : n - 2;
    px += Math.hypot(pat[next][0] - pat[prev][0], pat[next][1] - pat[prev][1]) * PX_PER_DEG;
  }
  return Math.max(4, Math.min(240, px));
}

// AWM 的栓动循环：拉栓计时 −dt，归零时若「开火前在镜里」就自动回镜。
// **走 dt 不用 setTimeout** —— 与换弹/死亡计时同一套理由：`pause()`（停 rAF）才能把它一起冻住，
// 无头测试也才能定步长快进。只有 AWM 会用到，所以只推进它一把。
function updateBolt(dt) {
  const s = owned.awm && owned.awm.state;
  if (!s || s.boltT <= 0) return;
  s.boltT -= dt;
  if (s.boltT > 0) return;
  s.boltT = 0;
  if (s.reScope && currentId === "awm" && state === "playing" && !dead) setScoped(true);
  s.reScope = false;
}

// 第一人称手臂（视模）。**全局只有一个实例**，切枪时被重挂进新武器的组 ——
// 与枪口火光同一套模式（attachMuzzleTo），免得每把枪各养一双永远看不见的手。
const viewArms = new ViewArms();

// 装载双手（`models/cs/ak47.glb` 的四块手/袖网格，见 viewarms.js）。
// **永不 reject**：失败时返回 false，手臂只是不显示（枪照常）—— 这是明确降级，不是静默失败，
// 调用方负责 toast 报错。
let handsOk = null;
function loadHands() {
  return viewArms.load().then((ok) => { handsOk = ok; return ok; });
}

// ---------- 通用武器 GLB 加载 ----------

// 把一棵刚 load 进来的模型树处理成「可以上漆、可以在视模通道里画」的状态。
// **顺序不能动**：① `matName` 必须在 `material.clone()` **之前**记（皮肤按 GLB 原始材质名
// 分部位上漆）；② `baseMat` 快照在 clone **之后**（它记的是出厂值 —— applySkinTo 每次都先
// 还原到它再叠皮肤，这是「切回原厂」能可靠回退的唯一前提）；③ 投掷物的 `def.tint` 又在快照
// **之后**（否则 base 里存的是被 tint 改过的色，切回原厂会还原成错的颜色）。
// `frustumCulled = false` 不是优化选项而是视模通道的硬需求：枪挂在单位变换的 vmCamera 下，
// 视锥剔除按主相机那套算会把枪整片闪没；`DoubleSide` 是因为视模里能看见背面。
// **懒加载进来的模型皮肤也必须走这一步**（见 mountGunModel），少一个都会静默坏掉。
function prepareGunMeshes(gun, def) {
  gun.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.frustumCulled = false;
    // 模型皮肤的网格自带烘焙贴图 —— 打上这个标，paintSkin 就不会把它的 map 抹掉
    // （普通皮肤「丢贴图平涂」那条规则是为基础低模的迷彩贴图写的，不适用于这里）。
    if (def.keepMap) o.userData.keepMap = true;
    if (!o.material) return;
    o.userData.matName = o.material.name || "";
    o.material = o.material.clone();
    o.material.side = THREE.DoubleSide;
    o.userData.baseMat = {
      color: o.material.color ? o.material.color.clone() : null,
      metalness: o.material.metalness,
      roughness: o.material.roughness,
      emissive: o.material.emissive ? o.material.emissive.clone() : null,
      emissiveIntensity: o.material.emissiveIntensity,
      envMapIntensity: o.material.envMapIntensity,
      map: o.material.map || null, // 贴图只存引用，不 clone（多网格共用一张）
    };
    if (def.tint && o.material.color) {
      o.material.color.lerp(new THREE.Color(def.tint), 0.75);
    }
  });
}

// 把模型归一化到「原点 = 包围盒中心、最长轴 = targetLen、枪口朝本组 -z」。
// 手上所有锚点（viewarms 的 ARM_ANCHORS、每把枪的 bx/by/bz 握持位、MAGWELL）都写在
// **这个坐标系**里，所以 targetLen 必须与被替换的基础枪**完全一致** —— 换了标尺，
// 那套手工量出来的数字全部失效。
//
// **顺序必须是 缩放 → 旋转 → 量 → 居中，不能把「居中」提前。**
// Object3D 的局部矩阵是 T·R·S，先居中再旋转会残留一个 (R−I)·center。实测残差：
// 现有三把基础枪 0.004 / 0.003 / 0.020（看不出来，所以一直没人发现），
// 而 m4a1_leishen 是 **1.651**、m4a1_bubblegum 是 **0.590** —— 枪会悬在手前方一米五。
// 先转再居中对九个模型全部给出 0.000。guncatalog.js 的 `makeVariant` 早就是正确写法。
//
// 返回**实测的**枪口锚点：居中之后枪管口就是包围盒 min.z 那一侧。
// y 默认 0.02（枪管轴线略高于枪身中线），个别模型可以用 `muzzleY` 覆盖。
function fitGunModel(gun, opts) {
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(gun).getSize(size);
  const longest = Math.max(size.x, size.y, size.z) || 1;
  gun.scale.multiplyScalar(opts.targetLen / longest);
  gun.rotation.y = opts.rotY;
  const center = new THREE.Vector3();
  new THREE.Box3().setFromObject(gun).getCenter(center);
  gun.position.sub(center);
  // 居中之后再量一次，把「残差」留在模型上供测试断言（见 __tactical.modelResidual）。
  // **必须在这里量**：此时 gun 还没被 add 进任何父节点，`setFromObject` 用的是它自己的
  // 局部矩阵；一旦挂进武器组，量到的就是叠了握持位（bx/by/bz）之后的世界坐标，毫无意义。
  // 存成普通数字数组（而不是 Vector3）—— `Object3D.copy()` 会把 userData 走一遍
  // JSON 序列化，Vector3 会被拍平成普通对象；数组则两种形态读起来都一样。
  const box = new THREE.Box3().setFromObject(gun);
  gun.userData.fitCenter = box.getCenter(new THREE.Vector3()).toArray();
  const muzzle = new THREE.Vector3(0, opts.muzzleY === undefined ? 0.02 : opts.muzzleY, box.min.z - 0.02);
  gun.userData.fitMuzzle = muzzle.toArray();
  return muzzle;
}

function loadWeapon(def) {
  return new Promise((resolve) => {
    new GLTFLoader().load(
      def.model,
      (gltf) => {
        const gun = gltf.scene;
        prepareGunMeshes(gun, def);
        const muzzleLocal = fitGunModel(gun, def);

        const group = new THREE.Group();
        group.add(gun);
        group.visible = false;
        // 挂到**视模相机**而不是主相机：组局部坐标 = 相机空间，所以武器/手臂的摆放一无变化，
        // 但它从此只在视模通道里被画出来，不会插进集装箱。
        vmCamera.add(group);

        const st = {
          mag: def.stats.magSize ?? 0,
          magSize: def.stats.magSize ?? 0,
          reserve: def.stats.reserve ?? 0,
          count: def.stats.count ?? 0,
          maxCount: def.stats.count ?? 0,
          reloading: false,
          reloadT: 0,
          reloadDur: def.stats.reload ?? 0,
          cooldown: 0,
          fireInterval: def.stats.interval ?? 0.5,
          // 射速闸门用「下次可开火的绝对时刻」存在每把枪自己身上。
          // 不能像以前那样共用一个模块级 lastFire：那是拿当前武器的 interval
          // 去比上一把枪的开火时刻——AWM 打一枪再切 M4，M4 会被 1.25s 的狙击
          // 间隔卡住，与「切枪即时生效、切枪后立即可开火」的约定相反。
          nextFireAt: 0,
          // ---- CS 后坐（每把枪一份，语义见 WEAPON_DEFS 上方的「CS2 弹道表」）----
          recoilIdx: 0,             // 下一发取弹道表的第几项
          aimPunch: { x: 0, y: 0 }, // 累积抬枪偏移（度，x 右+ / y 上+）；打满表就停在最后一项
          sinceShot: 99,            // 距上一发的秒数，驱动 punchHold / recoilReset 两条时序
          inaccPenalty: 0,          // 准星张开的连发惩罚（度）—— **纯视觉，绝不喂子弹**
          boltT: 0,                 // AWM 拉栓剩余秒数（0 = 可以开火/可以开镜）
          reScope: false,           // 开火前在镜里 → 拉完自动回镜（CS 的栓动循环）
          ks: makeKickSpring(), // 视模后坐的位移/速度状态（见 makeKickSpring 注释）
          throwCd: 0,
        };

        // `baseGun` 是**永不替换**的那一份，也是世界枪械目录的唯一来源（见 init 的 buildGunCatalog）。
        // `gun` 的语义是「当前挂着的模型」—— 模型皮肤会把它换成另一棵树（mountGunModel），
        // 所以任何「枪的几何长什么样」的问询都必须显式说明自己要的是哪一份。
        // `models`/`modelMuzzles`/`modelLoads` 按皮肤 id 缓存「已装好的模型树 / 它的枪口锚点 /
        // 在飞的加载」。
        owned[def.id] = {
          group, gun, baseGun: gun, baseMuzzle: muzzleLocal.clone(), muzzleLocal,
          models: {}, modelMuzzles: {}, modelLoads: {},
          state: st, def,
        };
        resolve(true);
      },
      undefined,
      () => resolve(false)
    );
  });
}

// ---------- 枪口火光（挂到当前武器组）----------
// **无 map 的 SpriteMaterial 在 three 里就是一块纯色实心方框** —— 旧版正是这样，
// 于是「枪口焰」是一块 0.45×0.45 的方形色块糊在准星下方（枪口离相机约 0.93m，
// 75° FOV、800px 屏高下 1 世界单位 ≈ 1000px，0.45 就是 250 多 px、比整把枪还大）。
// 现在改成程序化生成的星芒贴图：每条尖刺的角度/长度/粗细各自随机，一次生成多款，
// 每发再随机换款 + 随机旋转 + 随机尺寸 ——「形状复杂且不固定」靠的就是这两个随机维度，
// 只换旋转角是看不出区别的。
function flashTexture() {
  const S = 128;
  const cx = S / 2;
  const cy = S / 2;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d");
  g.globalCompositeOperation = "lighter"; // 尖刺与软核互相叠加，而不是后画的盖住先画的

  // 软核：两层径向渐变（外层大而淡、内层小而亮），把尖刺之间的负空间填住
  for (const [r, a] of [[0.30, 0.5], [0.15, 1.0]]) {
    const rad = S * r * (0.8 + Math.random() * 0.4);
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(0.5, `rgba(255,255,255,${a * 0.35})`);
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
  }

  // 尖刺：从中心射出的细长三角，填一条沿轴衰减的线性渐变（尖端自然收没，不出现硬边）
  const n = 6 + Math.floor(Math.random() * 6);
  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = base + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
    const len = S * (0.18 + Math.random() * 0.30);
    const wid = S * (0.015 + Math.random() * 0.05);
    g.save();
    g.translate(cx, cy);
    g.rotate(a);
    const grd = g.createLinearGradient(0, 0, len, 0);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.4, "rgba(255,255,255,0.32)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, -wid);
    g.lineTo(len, 0);
    g.lineTo(0, wid);
    g.closePath();
    g.fill();
    g.restore();
  }

  // 几粒飞溅余烬，把外轮廓再打碎一点（否则尖刺之间的留白太规整，像几何图形）
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = S * (0.16 + Math.random() * 0.24);
    g.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.4})`;
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, S * (0.008 + Math.random() * 0.018), 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  // CanvasTexture 的 colorSpace 默认是 NoColorSpace，不设会被当线性数据读进来再 sRGB
  // 编码输出，整体亮一档（与 map.js 里那几个程序化贴图同一个坑）
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// 贴图是**白底 + alpha 形状**，颜色留给 material.color 去乘 —— skins.js 的专属枪口焰色
// （每个皮肤一项 muzzle）正是这么上色的；贴图一旦自带橙黄，就会被色值再乘一遍变成脏红。
const MUZZLE_FLASHES = Array.from({ length: 5 }, flashTexture);

const muzzleShot = new THREE.Sprite(
  new THREE.SpriteMaterial({
    color: 0xffcf70,
    map: MUZZLE_FLASHES[0],
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  })
);
muzzleShot.scale.set(0.17, 0.17, 1);
const muzzleLight = new THREE.PointLight(0xffa040, 0, 6);

// 时长与尺寸按武器类型给：狙击更亮更久、手枪最短。尺寸同样是按枪口距离上的屏高反推的
// （muzzle 在相机前 ≈0.93m，1 世界单位 ≈ 1000px），0.17 约合 95px，而贴图里真正亮的
// 只有中间那一小团（实测核心约 30px）—— 比旧版 250 多 px 的实心方框小一个量级。
const MUZZLE_FLASH = {
  rifle: { life: 0.07, size: 0.17 },
  sniper: { life: 0.10, size: 0.21 },
  pistol: { life: 0.06, size: 0.14 },
};
let muzzleLife = 0.07;
let muzzleSize = 0.17;
// muzzleT 的三段语义：`MUZZLE_HOLD`(负数) = 本帧刚触发、停一帧；`>=0` = 已过的秒数；
// `Infinity` = 没在闪。**不能让「刚触发」也用 0** —— 那样「muzzleT > 0 才推进」的判据
// 永远不成立，火光会卡在满亮不消（第一版实测就是这个：连打 6 发全程 opacity=1）。
const MUZZLE_HOLD = -1;
let muzzleT = Infinity;

function triggerMuzzleFlash(def) {
  const s = MUZZLE_FLASH[def.type] || MUZZLE_FLASH.rifle;
  // 换贴图**不需要** material.needsUpdate：map 从一张非空贴图换到另一张非空贴图不会
  // 改变着色器的 USE_MAP 分支，只有 null ↔ 非 null 才要（切皮肤那条路径才要）。
  muzzleShot.material.map = MUZZLE_FLASHES[(Math.random() * MUZZLE_FLASHES.length) | 0];
  muzzleShot.material.rotation = Math.random() * Math.PI * 2;
  muzzleLife = s.life;
  muzzleSize = s.size * (0.85 + Math.random() * 0.35);
  muzzleT = MUZZLE_HOLD;
}

// 每帧推进。**触发后的第一帧停在 p=0 不推进** —— dt 在低帧率下被 clamp 到 0.05，
// 若进来就 `+= dt`，20fps 下第一帧直接 p≈0.7、火光只剩 0.13 的不透明度，看着像没开火。
// 停一帧等价于「任何帧率下都完整亮一帧再开始消」。
function updateMuzzleFlash(dt) {
  if (muzzleT === MUZZLE_HOLD) muzzleT = 0;
  else if (muzzleT >= 0 && muzzleT < muzzleLife) muzzleT += dt;
  if (!(muzzleT >= 0) || muzzleT >= muzzleLife) { // Infinity / 已过期：连点光源一起关
    muzzleShot.material.opacity = 0;
    muzzleLight.intensity = 0;
    return;
  }
  const p = Math.min(muzzleT / muzzleLife, 1);
  const k = Math.pow(1 - p, 1.7);
  muzzleShot.material.opacity = k;
  muzzleLight.intensity = 2.5 * k; // 枪口光与火焰同涨同消，去掉旧版那条 setTimeout
  const sc = muzzleSize * (0.72 + 0.5 * p); // 边涨边消：贴图是尖刺状，涨的过程不会糊成一块
  muzzleShot.scale.set(sc, sc, 1);
}

// 把火光挂到指定武器枪口。初始化与切枪都走这里 —— 否则每局第一条命的火光
// 会留在世界原点（switchWeapon 因 id === currentId 提前 return，从没挂上去过）。
//
// **两个单例现在分居两处**：`muzzleShot`（Sprite 火焰）跟着枪留在视模场景里，
// 而 `muzzleLight`（点光源，照亮周围世界）必须回到主场景的相机下 —— 把它留在视模场景里
// 不会报任何错，只是「开枪照不亮墙」，是那种永远没人发现的静默回归。
// 光源的位置由 animateWeapon 每帧从武器组矩阵同步（见那里的注释）。
function attachMuzzleTo(id) {
  const c = owned[id];
  if (!c) return;
  if (muzzleShot.parent) muzzleShot.parent.remove(muzzleShot);
  muzzleShot.position.copy(c.muzzleLocal);
  c.group.add(muzzleShot);
  if (muzzleLight.parent !== camera) {
    if (muzzleLight.parent) muzzleLight.parent.remove(muzzleLight);
    camera.add(muzzleLight);
  }
  muzzleLight.position.copy(c.muzzleLocal);
  // 切枪时把在飞的那发收掉：Sprite 是单例、跟着组走，留着的话上一把枪的火焰会跟着
  // 挂到新枪口上再闪完剩下几帧（而且新枪的 spread/尺寸未必对）。
  muzzleT = Infinity;
  muzzleShot.material.opacity = 0;
  muzzleLight.intensity = 0;
}

// ---------- 玩家状态 ----------
const player = {
  pos: new THREE.Vector3(0, 0, 10),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  hp: 100,
  onGround: true,
  sneaking: false,
  crouching: false,
  eyeH: EYE,
  viewDip: 0,   // 落地缓冲：独立于 eyeH，否则会破坏蹲伏过渡
  stepLift: 0,  // 上台阶的相机滞后（负值），同样独立于 eyeH
  coyote: 0,
  jumpBuf: 0,
  groundY: 0,   // 脚下台面高度：每帧由 supportAt() 重算，不是常量
  invuln: 0,
};
const keys = {};
const IS_SNEAK = "Sneak";
const IS_CROUCH = "Crouch";
// Ctrl 按下的时刻（-1 = 没按）。只给 isSecondaryClick 分辨「Ctrl+单击当右键」用。
let crouchDownAt = -1;

// ---------- 游戏状态 ----------
let state = "menu";
let kills = 0;
let enemyScore = 0;
let locked = false;
let time = 0;
let fireEnabled = false;
let strideAcc = 0;
let curFov = BASE_FOV;
let sbAcc = 0; // 战绩面板的刷新节流
let bpAcc = 0; // 背包面板**提示行**的刷新节流（列表不动，只在换背包/换皮肤时重建）

// 团队竞技参数
const TDM_LIMIT = 40;
const TDM_SPAWN_INTERVAL = 2.4;
const TDM_RESPAWN = 1.2;
const TDM_TIME = 600;     // 回合时长（秒）；时间到按比分判胜负

// 场上同时存活的敌人数。**不是常量**：开始菜单里选、对局中按 +/- 调。
// **单一数据源就是 enemyTarget 本身**（菜单与对局共用它，所以对局里 +/- 的结果
// 会留到下一局，菜单上也看得到）。它一变，名册（roster）与在场的实例必须跟着
// 原子地一起变 —— 见 setEnemyTarget()。
const ENEMY_MIN = 1;
const ENEMY_MAX = 8;      // 上限 8；ENEMY_NAMES 共 16 个代号，这个范围内不会重名
let enemyTarget = 8;

// 难度：只缩放敌人强度，**不动 ENEMY_HP** —— 血量固定才保住「AK 三枪死」的数值。
// 数值一律是相对现状（普通档全 1）的乘数。
const DIFFICULTIES = [
  { id: "easy",   name: "简单", dmg: 0.6,  acc: 0.65, speed: 0.85, pause: 1.5, aggro: 0.7 },
  { id: "normal", name: "普通", dmg: 1,    acc: 1,    speed: 1,    pause: 1,   aggro: 1   },
  { id: "hard",   name: "困难", dmg: 1.25, acc: 1.35, speed: 1.12, pause: 0.7, aggro: 1.3 },
];
let difficultyId = "normal";

function findDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

// 把选中的难度灌给敌人系统。对局中途换也立即生效：ENEMY_TUNING 是在
// 「每次刷人 / 每轮点射」现读的，不是在敌人构造时捕获的。
function applyDifficulty() {
  const d = findDifficulty(difficultyId);
  Object.assign(ENEMY_TUNING, { dmg: d.dmg, acc: d.acc, speed: d.speed, pause: d.pause, aggro: d.aggro });
}

// 死亡流程：被击杀后先看 3 秒击杀者信息（镜头缓缓转向击杀者），再传送回出生点复活。
// 与 CF 一样，死亡期间不能移动/开枪/切背包 —— 那 3 秒只属于「看自己怎么死的」。
const DEATH_DELAY = 3.0;  // 死亡视角时长（秒）
const DEATH_TURN = 0.9;   // 转向前 0.9s 内转完，剩余时间停在击杀者方向
// 敌人的枪名不再是常量：每局随机、存在 `enemy.weaponName` 上，取用一律走 enemyWeaponName()。
// （旧版这里是写死的 `const ENEMY_WEAPON = "步枪"`。）
let timeLeft = TDM_TIME;
let spawnAcc = 0;
let dead = false;
let deathT = 0;           // 死亡视角剩余时间（由主循环按 dt 推进，不用 setTimeout）
let lastKiller = null;    // 仅供调试钩子读取
// 死亡视角的转向：与 recoilPitch/recoilYaw 一样是**独立的相机叠加量**，
// 绝不写回 player.yaw/pitch —— 那是全项目唯一的朝向数据源。
const deathCam = { active: false, t: 0, dYaw: 0, dPitch: 0, yawOff: 0, pitchOff: 0 };
// 连杀（CF 口径）：**计数器 + 一个会重置的时间戳**，不是「最近 N 秒的击杀时间数组」。
// 每击杀一人 `streakCount++`，并且把 4 秒窗口**从这一发重新起算**；4 秒内没有下一杀就归零。
//   这两种写法不是口味不同，是**真的会算出不同的数**：在**相邻间隔都 < 4s、但首尾间隔 > 4s**
//   的时候分道扬镳。第 0 / 3.5 / 7.0 秒各杀一人 —— 「最近 4 秒内杀了几个人」（滑动窗口）
//   在第三杀只数得到 2 人（第 0 秒那杀被 `7.0 - 4.0` 挤出了窗口），而「每杀一人就把计时器
//   推翻重来」是 3 人：只要**相邻两杀**都接得上，连杀就一直续着，这才是 CF 的手感。
//   旧实现是 3.0s 的 `killTimes.filter(t => time - t < 3.0)`，窗口既短、又是滑动语义。
// 时间轴用主循环的 `time`（`time += dt`），不用 `performance.now()`：`__tactical.pause()`
// 停 rAF 时它跟着一起冻住，无头测试才能定步长快进（同 chat / 死亡计时那套）。
const STREAK_WINDOW = 4.0;
let streakCount = 0;
let lastKillAt = -Infinity;
// 主循环里被兜住的异常。以前任何一处抛异常都会让 update() 走不完 →
// renderer.render 永不执行 → 画布彻底冻住且没有任何提示（用户只能看到「卡住」）。
// 现在异常在这里留底：console 报一次，同时挂到 __tactical.lastError 上供排查。
let lastError = null;
let loopErrors = 0;
function noteLoopError(err, where) {
  const msg = String((err && err.message) || err);
  loopErrors++;
  if (!lastError || lastError.msg !== msg) console.error(`[${where}]`, err);
  lastError = { where, msg, count: lastError && lastError.msg === msg ? lastError.count + 1 : 1 };
}
// 死亡兜底定时器：死亡倒计时由主循环推进，万一主循环那头出了问题，
// 这个墙上时钟的兜底也会把死亡态解除（见 beginDeath / cancelDeath）。
let deathWatchdog = 0;

// 闪光弹白屏
let flashT = 0, flashDur = 0, flashIntensity = 0;

const sfx = new SFX();
const enemyManager = new EnemyManager(scene, 60);
enemyManager.onFootstep = (x, z) => sfx.footstep(x, 1.0, z);
const raycaster = new THREE.Raycaster();

// ---------- 预加载 ----------
function loadAK() {
  return Promise.all(PRIMARY_IDS.map((id) => loadWeapon(WEAPON_DEFS[id])));
}
// 敌人那把枪**不再单独加载**：世界模型目录（scripts/guncatalog.js）在初始化的最后
// 从玩家已加载的枪上派生全部「枪型 × 皮肤」变体，包括敌人手持的那一份。
// 旧版这里会再下载一遍 ak47.glb 给敌人当模板，那 92KB 和这个函数一起删掉了。
// 顺带一提：正因为共用一份来源，敌人手里的枪才能**带皮肤**（旧版只能是裸 AK）。

// ---------- 命中 / 受击反馈 ----------
function addHitMark(kind) {
  // kind: "hit" | "head" | "kill"
  const el = document.createElement("div");
  el.className = "hitmark " + kind;
  fxLayer.appendChild(el);
  el.offsetWidth;
  el.classList.add("show");
  setTimeout(() => el.remove(), 280);
}
function damageOverlay() {
  const d = document.createElement("div");
  d.className = "damage";
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 520);
}
let toastTimer = null;
function showToast(msg, red = false) {
  toast.textContent = msg;
  toast.classList.toggle("red", red);
  toast.classList.toggle("show", !!msg);
  clearTimeout(toastTimer);
  if (msg) toastTimer = setTimeout(() => toast.classList.remove("show"), 1400);
}

// 受击方向指示：把指示器旋转到伤害来源的方位
function showHitDir(wx, wz) {
  const dx = wx - player.pos.x, dz = wz - player.pos.z;
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  const fwd = -sy * dx - cy * dz;   // 前方分量
  const right = cy * dx - sy * dz;  // 右方分量
  const deg = Math.atan2(right, fwd) * 180 / Math.PI;
  hitdir.style.transform = "rotate(" + deg.toFixed(1) + "deg)";
  hitdir.classList.remove("show");
  void hitdir.offsetWidth;
  hitdir.classList.add("show");
}

// ---------- 战绩名册（按住 Tab 显示）----------
// 敌人对象是**池化**的、名字每次出场由 nextName() 重抽，所以战绩不能挂在 Enemy 上。
// 这里维护一份持久的红队名册（长度跟随 enemyTarget），敌人只是某条目当前在场的那具身体：
// 条目认得名字与累计战绩，身体死了就解绑、下次补员再绑到同一条目上。
let roster = [];
let playerDeaths = 0;
const PLAYER_NAME = "你";

// ---------- 模拟聊天（CF 风格 · 左下角）----------
// **打字绝不释放指针锁。** pointerlockchange 一旦走到失锁分支就会
// `hud.classList.add("hidden")` + 弹出主菜单 —— 一解锁，整个 HUD 连同聊天框自己一起消失。
// 所以流程是「保住锁 + 用 chat.handleKey 把整条键盘路径短路」，见下方 keydown 的第一条语句。
const chat = new Chat({
  logEl: document.getElementById("chatLog"),
  inputEl: document.getElementById("chatInput"),
  inputWrapEl: document.getElementById("chatInputWrap"),
  canOpen: () => state === "playing" && locked,
  onTypingChange: (typing) => {
    if (!typing) return;
    // 打字期间键盘不该再驱动游戏。keys 是本文件的模块级变量、chat.js 碰不到，
    // 所以清键必须在这里做 —— 否则「按住 W 时敲回车」会让玩家一边打字一边往前走。
    for (const k in keys) keys[k] = false;
    keys[IS_SNEAK] = false;
    keys[IS_CROUCH] = false;
    crouchDownAt = -1;   // 它喂给 isSecondaryClick，留着会把手感判断带偏
    fireEnabled = false; // 别让打字期间续火
  },
  getSpeakerNames: () => {
    // 只读 name 字符串、绝不留 Enemy 引用：对象池会反复易主，bindRoster 每次复用都会改写 name
    const live = enemyManager.enemies.filter((e) => !e.dead).map((e) => e.name);
    if (live.length) return live;
    return roster.map((r) => r.name); // 一个活人都没有时退化成名册名（整局稳定）
  },
});

function initRoster() {
  roster = [];
  for (let i = 0; i < enemyTarget; i++) {
    roster.push({ name: ENEMY_NAMES[i % ENEMY_NAMES.length], kills: 0, deaths: 0, enemy: null });
  }
  playerDeaths = 0;
}
// 名册随 enemyTarget 伸缩。**只用在对局中途改人数**（新开一局直接走 initRoster 全量重建）。
// 两条硬约束：
//   ① 只裁 `enemy === null` 的空闲条目。删掉仍被存活敌人引用的条目，那个敌人阵亡时
//      enemy.roster.deaths++ 就写进了一个已经不在名册里的对象 —— 不崩，但战绩凭空消失。
//      所以调用方必须先下线超编的敌人（那会把它们的条目解绑），这里才裁得干净。
//   ② 绝不调 initRoster()：那会把所有 kills/deaths/playerDeaths 清零，等于中途清空战绩。
function resizeRoster(n) {
  while (roster.length < n) {
    const i = roster.length;
    roster.push({ name: ENEMY_NAMES[i % ENEMY_NAMES.length], kills: 0, deaths: 0, enemy: null });
  }
  // 先摘空闲条目（从尾部往回找，不动战绩）
  for (let i = roster.length - 1; i >= 0 && roster.length > n; i--) {
    if (!roster[i].enemy) roster.splice(i, 1);
  }
  // 仍然超长 = 剩下的条目都被敌人占着（此时下线那一步没做完）。从尾部强删并解绑，
  // 宁可丢一条极端情况下的战绩，也不能让名册比敌人数还长。
  while (roster.length > n) {
    const gone = roster.pop();
    if (gone.enemy) { gone.enemy.roster = null; gone.enemy = null; }
  }
}
// 给新出场的敌人绑一个空条目（优先真正空闲的，其次尸体未清的）
function bindRoster(e) {
  // 名册为空时自愈：gameStart() 把 state 置 "playing" 放在第一行，一旦它中途抛异常，
  // 名册就停在 []，而 update() 照样跑 refillEnemies() → slot 为 undefined → 每 2.4 秒
  // 抛一次、连 renderer.render 一起带走（实测踩到，见 gameStart 的注释）。
  if (!roster.length) initRoster();
  const slot = roster.find((r) => !r.enemy) || roster.find((r) => r.enemy.dead) || roster[0];
  slot.enemy = e;
  e.roster = slot;
  e.name = slot.name; // 击杀信息条也用名册里的固定代号
  return slot;
}
// 敌人阵亡：先记名册，再走原有的击杀结算。
// 必须**当场解开绑定**：敌人对象是池化的，下一条命会复用同一个对象，
// 若旧条目还攥着它，就会出现两个条目指向同一具身体、战绩串号。
function onEnemyDeath(enemy, headshot, weaponName) {
  if (enemy.roster) {
    enemy.roster.deaths++;
    enemy.roster.enemy = null;
    enemy.roster = null;
  }
  // 临死一句。`name` 是普通字符串属性、对象池复用时会被 bindRoster 改写，
  // 所以在这里**当场读成字符串**交给 chat（chat 只留字符串，绝不留 Enemy 引用）。
  // 只有一半概率触发：每具尸体都留一句遗言会变成刷屏。
  if (Math.random() < 0.5) chat.taunt("dyingWords", { speaker: enemy.name });
  // 掉枪挂在这里：它是三条伤害路径（手雷 / 近战 / 子弹）唯一的汇合点，
  // 也正是「一次阵亡只记一次」的那个函数 —— 挂别处会走漏其中一条路径。
  dropEnemyGun(enemy);
  onKill(headshot, enemy.name, weaponName);
}

function renderScoreboard() {
  if (scoreboardEl.classList.contains("hidden")) return;
  const row = (name, k, d, me) =>
    '<div class="sb-row' + (me ? " me" : "") + '">' +
    '<span class="sb-name">' + name + "</span>" +
    '<span class="sb-k">' + k + "</span>" +
    '<span class="sb-d">' + d + "</span></div>";
  document.getElementById("sbBlueScore").textContent = kills;
  document.getElementById("sbRedScore").textContent = enemyScore;
  document.getElementById("sbLimit").textContent = TDM_LIMIT;
  document.getElementById("sbBlueRows").innerHTML =
    row(PLAYER_NAME, kills, playerDeaths, true);
  // 红队按击杀降序（和 CF 一样）。Array.sort 自 ES2019 起保证稳定，
  // 所以同为 0 杀时会保持名册原有次序，不会莫名其妙按拼音重排。
  const sorted = roster.slice().sort((a, b) => b.kills - a.kills);
  document.getElementById("sbRedRows").innerHTML =
    sorted.map((r) => row(r.name, r.kills, r.deaths, false)).join("");
}

function showScoreboard(v) {
  scoreboardEl.classList.toggle("hidden", !v);
  if (v) renderScoreboard();
}

// 击杀信息条
function pushKillFeed(killer, weapon, victim, headshot, foe) {
  const row = document.createElement("div");
  row.className = "kf-row" + (foe ? " foe" : "");
  const hs = headshot ? '<span class="kf-hs">爆头</span>' : "";
  row.innerHTML =
    '<span class="kf-k">' + killer + "</span>" +
    '<span class="kf-w">' + weapon + "</span>" + hs +
    '<span class="kf-v">' + victim + "</span>";
  killfeed.appendChild(row);
  while (killfeed.children.length > 5) killfeed.removeChild(killfeed.firstChild);
  setTimeout(() => row.remove(), 6500);
}

// 连杀播报（文字 + 浏览器语音合成，失败静默降级）
//
// **这个阶梯不封顶。** 旧版是 `{2:双杀,3:三杀,4:四杀,5:五杀}` 加一句 `Math.min(n,5)` ——
// 于是 6 连杀往上全都在喊「五杀!」（用户实测报的问题）。现在分两段：
//   2~9 是**称号档**（双杀/三杀/四杀/五杀 → 暴走/主宰/超神/弑神，取自 DotA 血统的中文习惯，
//        CF 玩家一眼认得），10 往上直接落到**中文数字连杀**（「十连杀!」「十一连杀!」…），
//   所以任何 n 都有专属文案，永远不会跟别的档撞车、也永远不会封顶。
//
// 称号档**必须连着数**：2~9 中间不许留空。`__tactical.streakLabel(n)` 就是读它的口子。
const STREAK_TITLES = {
  2: "双杀!", 3: "三杀!", 4: "四杀!", 5: "五杀!",
  6: "暴走!", 7: "主宰!", 8: "超神!", 9: "弑神!",
};
const STREAK_TITLE_MAX = 9;   // 超过它就改用中文数字连杀

// 语音（英文 TTS，用户可以完全忽略 —— 说话失败是静默降级）。
// 6 档往上没有「官方」叫法了，就用经典的那串 DotA 播报往上顶，听感依旧在升级。
const STREAK_VOICE = {
  2: "Double kill", 3: "Triple kill", 4: "Quadra kill", 5: "Penta kill",
  6: "Rampage", 7: "Dominating", 8: "Godlike", 9: "Beyond godlike",
};

const CN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
// 中文数字（够用即可：连杀数上百是不可能事件，超过 99 就退化成阿拉伯数字，不至于出错）
function cnNumber(n) {
  if (n < 10) return CN_DIGITS[n];
  if (n < 20) return n === 10 ? "十" : "十" + CN_DIGITS[n - 10];
  if (n < 100) {
    const tens = Math.floor(n / 10), ones = n % 10;
    return CN_DIGITS[tens] + "十" + (ones ? CN_DIGITS[ones] : "");
  }
  return String(n);
}

// 播报主文案。**单调且无上限**：n 越大文案一定越长/越靠后，绝不复用前档。
function streakLabel(n) {
  if (!(n >= 2)) return "";
  if (n <= STREAK_TITLE_MAX) return STREAK_TITLES[n];
  return cnNumber(n) + "连杀!";
}
function streakVoice(n) {
  if (n <= STREAK_TITLE_MAX) return STREAK_VOICE[n];
  if (n < 13) return "Unstoppable";
  if (n < 17) return "Wicked sick";
  return "Legendary";
}

// 颜色/特效档位 r1~r5（与文案档**故意分开**：文案是给眼睛读的数，档位是配色，
// 将来加文案不该连带改配色）。n 越大档位只增不减。
function streakRank(n) {
  if (n <= 3) return 1;    // 基础黄
  if (n <= 5) return 2;    // 橙
  if (n <= 7) return 3;    // 深橙（起全屏辉光）
  if (n <= 9) return 4;    // 赤红
  return 5;                // 紫金
}
let speechOk = true;
function speak(text) {
  if (!speechOk || !text || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1.15;
    u.volume = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    speechOk = false;
  }
}
function showStreak(n) {
  if (n < 2) return;
  const label = streakLabel(n);
  const rank = streakRank(n);
  // className 整条重写会把上一发的 `show` 一起抹掉，正好用来重触发动画；
  // 顺序不能反 —— 先摆好类名、强制一次回流，再加 `show`。
  // 长文案收一档字号。阈值定在 6 个字：10~19 的「十二连杀!」正好 5 个字（42px×5 ≈ 260px，
  // 480px 窄屏也放得下），20 往上的「二十一连杀!」是 6 个，再按 42px 排会顶到屏幕边。
  streakEl.className = "streak r" + rank + (label.length > 5 ? " long" : "");
  streakEl.textContent = label;
  void streakEl.offsetWidth;
  streakEl.classList.add("show");
  sfx.streak(n);
  speak(streakVoice(n));
  // 高档位再来一层全屏边缘辉光（r3 起）。同样是「重写类名 → 回流 → 加 show」。
  if (rank >= 3 && streakFlashEl) {
    streakFlashEl.className = "streak-flash f" + rank;
    void streakFlashEl.offsetWidth;
    streakFlashEl.classList.add("show");
  }
}

// 连杀窗口倒计时（常驻 HUD）：只要身上挂着连杀就显示，进度条按 STREAK_WINDOW 走完。
// **每帧由 update() 推**（不是 CSS 动画）：这样才能跟着 __tactical.pause() 一起冻住、
// 也才能在无头测试里定步长快进 —— 与死亡面板的倒计时条同一套做法。
function updateStreakHud() {
  if (!streakTimerEl) return;
  const active = state === "playing" && !dead && streakCount >= 1;
  if (!active) {
    // 只在真的显示着的时候去改 DOM，免得每帧做无谓的写（顺带把 `low` 一起清掉）
    if (streakTimerEl.classList.contains("show")) {
      streakTimerEl.classList.remove("show", "low");
      streakTimerNumEl.textContent = "";
      streakTimerFillEl.style.width = "0%";
    }
    return;
  }
  const remain = Math.max(0, STREAK_WINDOW - (time - lastKillAt));
  streakTimerEl.classList.add("show");
  streakTimerNumEl.textContent = "×" + streakCount;
  streakTimerFillEl.style.width = ((remain / STREAK_WINDOW) * 100).toFixed(1) + "%";
  // 快断了（1.2s 内）就转红闪一下，提示「再不杀就断了」。单杀不给提示（还没成串）。
  streakTimerEl.classList.toggle("low", remain <= 1.2 && streakCount >= 2);
}
function showKillIcon(headshot) {
  killIconEl.textContent = headshot ? "爆头击杀" : "击杀";
  killIconEl.classList.remove("show");
  void killIconEl.offsetWidth;
  killIconEl.classList.add("show");
}

// ---------- 死亡界面 ----------
// 被击杀后显示击杀者信息 + 复活倒计时，3 秒后由 respawnPlayer() 收起。
// 浮层挂在 #hud 内部：层内 z-index 5 与战绩面板同级，天然压得住狙击镜(6)、
// 又低于闪光白屏(.fx-layer 8)与菜单(.menu 10)。
function showDeathPanel(killerName, weaponName) {
  // 三个元素一律判空：cancelDeath() 在 gameStart() 的第一行就会被调到，一旦这里抛异常，
  // 整局会毁在「state 已置 playing、但 initRoster()/refillEnemies() 都没跑」的半截状态里
  // （表现是敌人永远刷不出来 + 名册为空 + 每 2.4 秒在 bindRoster 抛一次错、画面停住）。
  // 只要 index.html 是旧的（浏览器缓存了没有 #deathScreen 的老页面）就会踩到，实测复现过。
  if (deathKillerEl) deathKillerEl.textContent = killerName || "敌人";
  if (deathWeaponEl) deathWeaponEl.textContent = weaponName || "";
  // 准星在死亡期间没有意义（CF 也是收起的）
  if (cross) cross.classList.add("hidden");
  if (deathFillEl) deathFillEl.style.width = "0%";
  if (deathEl) deathEl.classList.remove("hidden");
}
function hideDeathPanel() {
  if (deathEl) deathEl.classList.add("hidden");
  if (cross) cross.classList.remove("hidden");
}
// 复活倒计时进度条：每帧写 width（与 #crosshair 每帧写 --gap 同一套做法）。
// 不用 CSS 动画 —— 它跟不上 __tactical.pause()，也和 dt 驱动的死亡计时不同步。
function updateDeathBar(p) {
  if (!deathFillEl) return;
  deathFillEl.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + "%";
}

// ---------- 背包与切枪 ----------
// CF 式多背包：3 个背包各带一把主武器，副武器/近战/投掷物三件套共用。
// 数字键 1/2/3/4 切的是「当前背包内的槽位」，不是背包编号 —— 切背包走 B + 数字键，
// 与 CF 一致（CF 里这也是两件不同的事）。
const BACKPACKS = [
  { primary: "ak", skin: "firekirin" },    // 背包 1
  { primary: "m4", skin: "thor" },         // 背包 2
  { primary: "awm", skin: "shadowless" },  // 背包 3
];
let curBp = 0;

// 副武器/近战的皮肤是**全局一份**，不像主武器那样按背包分。
// 理由：BACKPACKS 里根本没有副武器/近战的选择（所有人都固定 USP + 匕首），
// 给它们按背包各配一份是「无差别的差别」，只会让菜单多出 6 行重复内容。
const GEAR_SKIN = { pistol: "shura", knife: "dragonslayer" };

// 出厂配装的一份只读副本。
// **捡枪会改写 BACKPACKS[curBp].primary/.skin 与 GEAR_SKIN**（CF 里也是捡了就是捡了），
// 但那是「本局」的事 —— 新开一局必须还原成出厂值，否则上一局在地上捡的那把枪会跟着你
// 进下一局（开局发现主武器不是自己配的那把，很像 bug）。
// 复活**不**还原：CF 里死了再站起来，手上还是你上一条命拿的枪。
// 注意 `__tactical.setSkin` 改的也是 BACKPACKS 本身，所以调用顺序必须是「先 beginGame 再 setSkin」。
const LOADOUT_DEFAULT = {
  packs: BACKPACKS.map((b) => ({ ...b })),
  gear: { ...GEAR_SKIN },
};
function resetLoadout() {
  BACKPACKS.forEach((b, i) => {
    b.primary = LOADOUT_DEFAULT.packs[i].primary;
    b.skin = LOADOUT_DEFAULT.packs[i].skin;
  });
  GEAR_SKIN.pistol = LOADOUT_DEFAULT.gear.pistol;
  GEAR_SKIN.knife = LOADOUT_DEFAULT.gear.knife;
}

// 某把武器此刻该用哪款皮肤。投掷物返回 null —— 它们靠 def.tint 区分三件套，
// 不吃皮肤（applySkinTo 收到 null 会直接返回，不碰材质，从而保住那份 tint）。
function activeSkinId(id) {
  const def = WEAPON_DEFS[id];
  if (!def) return null;
  if (def.slot === "primary") return BACKPACKS[curBp].skin;
  if (id === "pistol" || id === "knife") return GEAR_SKIN[id];
  return null;
}

// 换主武器时用：wantedSkin 属于这把枪就沿用它，否则回退到这把枪的默认皮肤。
// 不做这层校验就会出现「M4 挂着 AK 的 skin id」—— findSkin 找不到会按原厂处理
// （枪是黑的），可菜单却高亮着一个不存在的项，看起来像皮肤丢了。
function skinForGun(gunId, wantedSkin) {
  const list = skinsFor(gunId);
  if (list.some((s) => s.id === wantedSkin)) return wantedSkin;
  return DEFAULT_SKIN[gunId] || STOCK;
}

// 「AK-47-火麒麟」这种带皮肤的显示名（CF 的英雄级武器就是这么印在 HUD 上的），
// 原厂只写枪名。HUD、拾取/丢弃 toast、击杀信息条、死亡面板四处共用这一份 ——
// 以前这段三元表达式只写在 updateAmmoHud 里，别处各自硬编码，改一处就漏三处。
function gunDisplayName(id, skinId) {
  const def = WEAPON_DEFS[id];
  if (!def) return "枪械";
  const sid = skinId === undefined ? activeSkinId(id) : skinId;
  if (sid && isSkinned(id, sid)) return def.name + "-" + skinLabel(id, sid);
  return def.name;
}

// 把一款皮肤刷到**当前玩家手上的**这把武器上。
// 上漆的逻辑本体在 skins.js 的 paintSkin()（世界模型目录也要用同一份，见 guncatalog.js），
// 这里只负责把它挂到 owned 上，并补上枪口焰这个单例的颜色。
// 每次都从 userData.baseMat 还原、再叠覆盖项 —— 原厂与任意皮肤之间可以来回切，
// 不会出现「上一款皮肤刷过的字段残留在这一款没覆盖到的部位上」（黄金AWM 的金色残留到
// 无影的黑白上，就是这种 bug 的典型样子）。这一条现在由 paintSkin 统一保证。
function applySkinTo(id, skinId) {
  const entry = owned[id];
  if (!entry) return;
  const skin = findSkin(id, skinId);
  // 皮肤表里没有这把武器（投掷物）→ 直接不碰材质。它们的颜色是 def.tint 刷上去的，
  // 强行还原 base 反而会把 tint 抹掉，三件套就再也分不出来了。
  if (!skin) return;
  entry.glowMats = paintSkin(entry.group, id, skinId) || [];
  // 枪口焰是**单例**（muzzleShot/muzzleLight 由 attachMuzzleTo 在切枪时重新挂载），
  // 所以这里只改颜色，不重建、不重新挂载。
  const mz = skin.muzzle;
  muzzleShot.material.color.setHex(mz !== undefined ? mz : DEFAULT_MUZZLE.sprite);
  muzzleLight.color.setHex(mz !== undefined ? mz : DEFAULT_MUZZLE.light);
}

// ---------- 模型皮肤：懒加载 + 换模型 ----------
// 一款皮肤可以自带一棵 GLB（`skin.model`，见 skins.js）。挂上去的那棵树放在 `owned[id].gun`
// 里，而 `owned[id].baseGun` 是**永不替换**的出厂低模 —— 世界枪械目录只能从它派生。
//
// 为什么懒加载：六个模型合计 ≈11.6 MiB（贴图占大头），进战场就全下会在开局卡出一个
// 明显的空窗，而绝大多数对局根本不会碰其中任何一款。所以选中模型皮肤时**先保持 baseGun 挂着**、
// 后台去拉，到了再换 —— 拉过一次就一直命中缓存，之后切进切出是瞬时的。
// 这也意味着「按 G 丢枪」这类路径永远看到的是基础模型，不需要任何额外的异步分支。

// 当前该用哪张手臂锚点表：模型皮肤各有一张自己的（`ARM_ANCHORS[anchorKey]`），
// 没有 `model` 或没有 `anchorKey` 就用武器 id 自己那张。
// 单独抽出来是因为它有三个调用点（switchWeapon / 模型加载完成 / 换皮肤），必须同源。
function armAnchorKey(id) {
  const m = modelOf(id, activeSkinId(id));
  return m && m.anchorKey ? m.anchorKey : id;
}

// 按当前皮肤把模型树挂好（幂等）。**只动 `gun` 这一个子节点**：
// 组本身（viewArms.root 与 muzzleShot 的挂载关系）、`group.visible` 一概不碰 ——
// 可见性有三个写者（switchWeapon / applyScope / animateWeapon），这里插一脚就会出现
// 「开镜后手臂浮在镜筒上」那一类 bug。
function applyMountedModel(id) {
  const entry = owned[id];
  if (!entry) return;
  const skinId = activeSkinId(id);
  const want = entry.models[skinId] || entry.baseGun;
  if (entry.gun !== want) {
    entry.group.remove(entry.gun);
    entry.group.add(want);
    entry.gun = want;
  }
  // 枪口锚点跟着模型走：不同模型的包围盒 min.z 差得多（镜子、消音器都会把它推前推后）
  entry.muzzleLocal.copy(skinId && entry.modelMuzzles[skinId] ? entry.modelMuzzles[skinId] : entry.baseMuzzle);
}

// 请求挂上 id 的 skinId。返回 true 表示**此刻已经是**模型皮肤（无需等待），
// false 表示要么不是模型皮肤、要么模型还在路上（此时手里仍是 baseGun）。
function mountGunModel(id, skinId) {
  const entry = owned[id];
  if (!entry) return false;
  const mdl = modelOf(id, skinId);
  if (!mdl) { applyMountedModel(id); return false; }
  if (entry.models[skinId]) { applyMountedModel(id); return true; }

  // 去重：连按两下 `]` 会发出两个请求，晚到的那个会把早到的结果盖掉（挂错皮肤）。
  if (!entry.modelLoads[skinId]) {
    entry.modelLoads[skinId] = new Promise((resolve) => {
      new GLTFLoader().load(
        mdl.file,
        (gltf) => {
          const gun = gltf.scene;
          // 与基础枪**同一条**处理链路。不走这一步，模型会缺 `DoubleSide`/`frustumCulled`
          // （视模通道里整片闪没），也没有 `matName`/`baseMat`（上漆与还原都会失真）。
          // `keepMap: true` 给每个网格打标，paintSkin 才不会把模型自带的烘焙贴图抹掉。
          prepareGunMeshes(gun, { keepMap: true });
          entry.modelMuzzles[skinId] = fitGunModel(gun, mdl);
          entry.models[skinId] = gun;
          resolve(true);
        },
        undefined,
        () => {
          // 失败要把缓存清掉，否则这一款皮肤永远不再重试
          delete entry.modelLoads[skinId];
          if (id === currentId) showToast("皮肤模型加载失败：" + skinLabel(id, skinId), true);
          resolve(false);
        }
      );
    }).then((ok) => {
      // 解析时的**双重守卫，缺一不可**：
      //   ① `id === currentId` —— 这把枪可能已经不在手上了；
      //   ② 此刻为 id 解析出的皮肤**仍然**是这一款 —— 用户完全可以在模型飞行途中把它切走。
      // 只判 ① 是这类代码的经典坑：`attachMuzzleTo` 是**单例搬运工**（把 `muzzleShot` 从旧父节点
      // 摘下来挂进 c.group），`applySkinTo` 又无条件改 `muzzleShot.material.color`，
      // 于是一个过期的解析会把**手上这把枪**的枪口火光搬进一个隐藏组、再改掉它的颜色。
      // `gameStart()` 里 `resetLoadout()` 跑在 `switchWeapon` 之前，正是这条竞态的现成触发路径。
      if (ok && id === currentId && activeSkinId(id) === skinId) {
        applyMountedModel(id);
        applySkinTo(id, skinId);
        attachMuzzleTo(id);
        viewArms.configure(armAnchorKey(id));
      }
      return ok;
    });
  }
  return false;
}

// 每帧的发光呼吸。**必须在 animateWeapon 里那个 `if (scoped) return` 之前调用** ——
// 那个提前 return 是为了开镜时藏枪模，写在它后面会让发光一开镜就停跳。
// 只推进当前武器：其余武器组 visible=false，更新了也看不见。
const glowT0 = performance.now();
function updateSkinGlow() {
  const entry = owned[currentId];
  if (!entry || !entry.glowMats || !entry.glowMats.length) return;
  const t = (performance.now() - glowT0) / 1000;
  const g = entry.glowMats;
  for (let i = 0; i < g.length; i++) {
    const it = g[i];
    // 相位按材质下标错开，免得同枪多个发光件完全同步地一起闪
    const phase = i * 1.7;
    it.mat.emissiveIntensity = it.base + it.amp * (0.5 + 0.5 * Math.sin(t * it.speed + phase));
  }
}

// 换背包的限制与 CF 一致：只能在己方复活点安全区内、且本回合未开火/未投掷/未挥刀时。
// 这条限制带来一个重要推论：每次合法换包都发生在满弹状态（行动后本回合就锁死了），
// 所以「每个背包的弹药是否独立」在游戏里根本观察不到 —— 状态因此不必拆成 3 套，
// 沿用每把枪一份的 owned[id].state 即可。若哪天改成随时可切，必须再拆，
// 且要同步改 respawnPlayer()/gameStart() 里那两个 `for (const k in owned)` 全量重置循环。
// 安全圈半径 9m。地图缩到 40×68m 后，11m 的圈会盖掉近 1/3 的甲板
// （复活点在 (0, hl-6) = (0, 27.35)，圈顶已经顶到 z=38.35 > bounds.hl），
// 「本回合未行动才能换背包」的判定范围必须跟着地图收。
const SPAWN_SAFE_R = 9;
let actedThisLife = false;
function inSpawnZone() {
  // 复活点就是 respawnPlayer()/gameStart() 用的那个 (0, bounds.hl - 6)
  return Math.hypot(player.pos.x, player.pos.z - (bounds.hl - 6)) <= SPAWN_SAFE_R;
}
function canSwapBackpack() {
  return state === "playing" && !dead && inSpawnZone() && !actedThisLife;
}
// 被拦的原因要分开说 —— 阵亡中既没开火也可能仍站在复活点，用「已开火」那套文案
// 会把原因说错（建议倒是对的）。两处调用点（switchBackpack 的 toast 与
// updateBackpack 的面板提示）共用这一份，免得文案各自演化后互相矛盾。
function swapBlockReason() {
  if (dead) return "阵亡中，复活后才能换背包";
  if (actedThisLife) return "本回合已开火，需复活后才能换背包";
  return "只能在复活点安全区内换背包";
}

// force=true：即使 id 已经是当前武器也重做一遍显示与挂载。
// 开局/复活必须走 force —— 否则 currentId 恰好就是目标枪时会提前 return，
// 武器组可见性与枪口火光挂载都不会刷新（枪口火光会留在世界原点）。
// 注意：这里**不写** BACKPACKS[curBp].primary —— 配装只在开始菜单改，
// 否则 debug 钩子 switchWeapon("m4") 这类调用会悄悄改掉玩家的背包。
function switchWeapon(id, force) {
  if (!owned[id] || (id === currentId && !force)) return;
  currentId = id;
  WEAPON_STATE = owned[id].state;
  // 后坐偏移是**当前武器 aimPunch 的派生量**，切枪必须立刻重算 —— 否则会带着上一把枪的
  // 抬枪角去瞄（AWM 打一枪切 AK，AK 的准星会莫名其妙地高 3°）。见 syncRecoil 的注释。
  syncRecoil();
  // 换枪一律退镜，避免端着镜子换到没镜的枪
  scoped = false;
  scopeEl.classList.add("hidden");
  cross.classList.remove("hidden");
  for (const k in owned) owned[k].group.visible = k === id;
  // 先把「该挂哪棵树」定下来（模型皮肤可能还在路上，那就先挂着基础低模、后台去拉），
  // 后面三步读的都是此刻挂着的那棵树。
  mountGunModel(id, activeSkinId(id));
  attachMuzzleTo(id);
  // 手臂重挂进新武器的组，并按这把枪的握持锚点摆位（顺带把换弹相位清干净）。
  // 挂在 group 之下是有意的：开镜/阵亡时 animateWeapon 把 group 藏起来，手臂自动跟着藏，
  // 不会出现「镜筒上浮着一只手」。
  // 第二个参数是**锚点 key**（模型皮肤各有一张表），不是武器 id。
  viewArms.attach(owned[id].group, armAnchorKey(id));
  // 上漆。挂在这里而不是各个调用点：switchBackpack()/respawnPlayer()/gameStart()
  // 全都走 switchWeapon(…, true)，一处挂钩三个入口全覆盖。
  applySkinTo(id, activeSkinId(id));
  sfx.switchWeapon();
  updateAmmoHud();
}
function quickSwitch() {
  const to = WEAPON_DEFS[currentId].slot === "secondary" ? "primary" : "secondary";
  const id = slotWeapon(to);
  if (!id) { slotEmptyHint(to); return; }
  switchWeapon(id);
}
// 当前背包的主武器。防御性回退到 AK：switchWeapon 对未加载的 id 是静默 no-op，
// 会让 currentId / 可见性 / 枪口火光全部停在旧状态。
function equippedPrimary() {
  const id = BACKPACKS[curBp].primary;
  return owned[id] ? id : "ak";
}
// 数字键 1：切到「当前背包的主武器」。
// 这里**不能**再按 PRIMARY_IDS 轮换：那样从背包选完 AWM 之后按 1，
// 会从 AWM 的下一位绕回 AK，用户看到的就是「刚选了 3 号，一切枪又跳回 1 号 AK」。
// 已经拿着这把枪时 switchWeapon 因 id === currentId 直接 return，按 1 无副作用。
function switchToPrimary() {
  const id = slotWeapon("primary");
  if (!id) { slotEmptyHint("primary"); return; }
  switchWeapon(id);
}
// 数字键 2。副武器槽只有 USP 一个型号，但它同样可以被 G 丢掉。
function switchToSecondary() {
  const id = slotWeapon("secondary");
  if (!id) { slotEmptyHint("secondary"); return; }
  switchWeapon(id);
}
// B + 数字键（或点击面板）切换背包。不可切换时给出具体原因，不要静默失败。
function switchBackpack(i) {
  if (!BACKPACKS[i]) return false;
  if (!canSwapBackpack()) {
    sfx.empty();
    showToast(swapBlockReason());
    return false;
  }
  if (i === curBp) return true;
  curBp = i;
  // 换背包 = 从这个背包里再取一把枪，所以它顺手把「主武器已丢空」的标记清掉。
  // 不清的话会出现「按 G 丢了 AK，再 B+2 切到背包 2，手上还是空的」—— 面板明明写着
  // 背包 2 是 M4 却拿不到，看着像坏了。放这里也没有被滥用的余地：能换背包就意味着
  // 站在复活点且本回合没开过火，而那种状态下本来就可以直接选任意一个背包。
  emptySlot.primary = false;
  // force=true：换包后即使主武器恰好是同一把，也要刷新可见性与枪口火光
  switchWeapon(equippedPrimary(), true);
  updateBackpack();
  showToast("切换至背包 " + (i + 1));
  return true;
}
// 数字键 4：在手雷 / 闪光弹 / 烟雾弹之间循环（CF 的投掷物槽行为）
function switchNade() {
  const avail = NADE_IDS.filter((id) => owned[id] && owned[id].state.count > 0);
  const list = avail.length ? avail : NADE_IDS;
  const idx = list.indexOf(currentId);
  switchWeapon(list[(idx + 1) % list.length] || list[0]);
}
function toggleBackpack() {
  const b = document.getElementById("backpack");
  const isOpen = !b.classList.contains("hidden");
  b.classList.toggle("hidden", isOpen);
  updateBackpack();
  if (!isOpen) showToast(canSwapBackpack() ? "按 1 / 2 / 3 切换背包" : "");
  else showToast("");
}
function backpackOpen() {
  const b = document.getElementById("backpack");
  return !!b && !b.classList.contains("hidden");
}
// 换**皮肤**的门槛比换背包低得多，这是有意的：皮肤纯粹是外观，不影响伤害/弹药/移速，
// 所以不需要「复活点 + 本回合未行动」那条（那条是为「战斗中换武器」这种有实战收益的操作设的）。
// 只要求在对局中且没死 —— 否则「进战场看看我的新枪」这件事本身就被挡住了。
function canSwapSkin() {
  return state === "playing" && !dead;
}
// 在当前背包的主武器上选一款皮肤。
// **皮肤选择是「配置」，不是「本局临时」**（用户已确认的语义）：同时写 `BACKPACKS` 与
// `LOADOUT_DEFAULT`，于是重开一局仍然是它；而捡到的枪只写 `BACKPACKS`（走 pickUpItem），
// 所以下一局照样还原成配置值。两者语义不同，别顺手合并。
function selectSkin(skinId) {
  const id = BACKPACKS[curBp].primary;
  if (!skinsFor(id).some((s) => s.id === skinId)) return false;
  if (!canSwapSkin()) { sfx.empty(); showToast("对局中才能更换皮肤", true); return false; }
  if (BACKPACKS[curBp].skin === skinId) return true;
  BACKPACKS[curBp].skin = skinId;
  LOADOUT_DEFAULT.packs[curBp].skin = skinId;
  // 手上正好是这把枪才需要重挂/重刷；否则下次切到它时 switchWeapon 会处理。
  // 顺序与 switchWeapon 一致：先定模型，再挂枪口火光/手臂，最后上漆。
  if (currentId === id) {
    mountGunModel(id, skinId);
    attachMuzzleTo(id);
    viewArms.configure(armAnchorKey(id));
    applySkinTo(id, skinId);
  }
  sfx.switchWeapon();
  showToast(gunDisplayName(id, skinId));
  // 右下角的枪名（「M4A1-霜白」）由 updateAmmoHud 写，而它只在切枪/换弹/开火那几处被调 ——
  // 漏了这一句，换完皮肤 HUD 上还印着上一款的枪名（得等下次切枪才刷新），
  // 看着就像「皮肤没换成功」。手上不是这把枪时它写的是手上那把的名字，无副作用。
  updateAmmoHud();
  return true;
}
// 在当前背包主武器上循环皮肤（`[` 上一款 / `]` 下一款）。
// 顺序就是 skins.js 里数组的顺序、也就是面板上从上到下的顺序 —— 两者必须同源，
// 否则按键走的方向与眼睛看到的对不上。
function cycleSkin(dir) {
  const id = BACKPACKS[curBp].primary;
  const list = skinsFor(id);
  if (!list.length) return false;
  const cur = list.findIndex((s) => s.id === BACKPACKS[curBp].skin);
  const n = list.length;
  const next = list[(((cur < 0 ? 0 : cur) + dir) % n + n) % n];
  if (!next || !selectSkin(next.id)) return false;
  updateBackpack();
  return true;
}
// 面板是「查看 + 切换」用的，改配装在开始菜单里（等价于 CF 在仓库里配好再进战场）。
// 指针锁定时没有光标，所以这里的鼠标点击实际点不到，主路径是键盘 B + 数字键 / `[` `]`。
function updateBackpack() {
  const list = document.getElementById("bpList");
  if (!list) return;
  list.innerHTML = "";
  BACKPACKS.forEach((bp, i) => {
    const row = document.createElement("button");
    row.className = "bp-item bp-row" + (i === curBp ? " active" : "");
    row.dataset.bp = String(i);
    // 带上皮肤名，否则两个背包都用 AK 时面板上看不出区别
    const sk = skinLabel(bp.primary, bp.skin);
    const skTag = isSkinned(bp.primary, bp.skin) ? '<span class="bp-skin">' + sk + "</span>" : "";
    row.innerHTML =
      '<span class="bp-idx">' + (i + 1) + "</span>" +
      '<span class="bp-name">' + WEAPON_DEFS[bp.primary].name + "</span>" + skTag;
    // 与键盘那条路径同源：选完背包**不关面板**（皮肤行就在下面，关掉就点不到了）。
    // 实际上指针锁定时没有光标、失锁时整个 #hud 又是 display:none，所以这一行
    // 只影响带光标调试的场景 —— 但那正是它会与键盘行为漂移的地方，故保持一致。
    row.onclick = () => { switchBackpack(i); };
    list.appendChild(row);
  });
  // ---- 皮肤行：只针对**当前背包的主武器** ----
  // 副武器/近战是全局一份 GEAR_SKIN、不按背包分（AGENTS.md 的既有决定），所以不给它们行。
  const curPrimary = BACKPACKS[curBp].primary;
  const skinList = skinsFor(curPrimary);
  if (skinList.length) {
    const sec = document.createElement("div");
    sec.className = "bp-sec";
    const title = document.createElement("div");
    title.className = "bp-sec-title";
    title.textContent = WEAPON_DEFS[curPrimary].name + " 皮肤";
    sec.appendChild(title);
    const rowBox = document.createElement("div");
    rowBox.className = "bp-list bp-skins";
    const activeSkin = BACKPACKS[curBp].skin;
    // 皮肤名来自我们自己的常量表（不是用户输入），和上面几行一样可以走 innerHTML
    skinList.forEach((s) => {
      const b = document.createElement("button");
      b.className = "bp-item bp-skin-row" + (s.id === activeSkin ? " active" : "");
      b.dataset.skin = s.id;
      const mid = s.model ? '<span class="bp-model">模型</span>' : "";
      b.innerHTML = '<span class="bp-name">' + s.name + "</span>" + mid;
      b.onclick = () => { if (selectSkin(s.id)) updateBackpack(); };
      rowBox.appendChild(b);
    });
    sec.appendChild(rowBox);
    list.appendChild(sec);
  }
  updateBpHint();
}
// 面板底下那行提示。**单独拆出来**是因为它会随时间自己变（走出安全区、开一枪都会改
// 那两道闸门），而皮肤列表不会 —— 主循环按 0.25s 节流只重算这一行，不重建整个列表。
//
// **键名一律做成 <kbd> 键帽，绝不写成纯文本 `[ / ]`。** 曾经那行是
// 「1 / 2 / 3 换背包 · [ / ] 换皮肤 · …」，括号在 11px 灰字里只有 6.6px 宽、笔画细到几乎
// 看不见，前面又刚好有三个真斜杠，于是整句被读成「按 `/` 换皮肤」（用户实测报的正是这条）。
// 有边框和底色的键帽才能让人一眼认出「这是键盘上的那个键」。
let bpHintKey = ""; // 上一次渲染的闸门状态，用来跳过无变化的重建
function updateBpHint() {
  const hint = document.getElementById("bpHint");
  if (!hint) return;
  // 两条提示分别挂在**各自那道闸门**上，不能共用一句三元表达式：
  // 换皮肤的门槛（`canSwapSkin`：在对局中、没死）比换背包那条（复活点 + 本回合未行动）
  // 宽得多，合成一句就会在「本回合已开火」时把「[ ] 换皮肤」一起藏掉 ——
  // 而那时候皮肤**明明还能换**，玩家只会得出「皮肤换不了」的结论。
  const canBp = canSwapBackpack();
  const canSkin = canSwapSkin();
  // 主循环每 0.25s 调一次，状态没变就别反复 createElement
  const stateKey = (canBp ? "ok" : swapBlockReason()) + "|" + canSkin;
  if (stateKey === bpHintKey) return;
  bpHintKey = stateKey;

  hint.textContent = "";
  const keysLine = document.createElement("div");
  keysLine.className = "bp-hint-keys";
  hint.appendChild(keysLine);

  // 一段「键帽 + 说明」。`keys` 为空表示这段是被拦原因，只有文字、没有键。
  const item = (keys, text, warn) => {
    const box = document.createElement("span");
    box.className = "bp-hint-item" + (warn ? " warn" : "");
    for (const k of keys) {
      const kbd = document.createElement("kbd");
      kbd.textContent = k;
      box.appendChild(kbd);
    }
    box.appendChild(document.createTextNode(text));
    return box;
  };
  const sep = () => {
    const s = document.createElement("span");
    s.className = "bp-hint-sep";
    s.textContent = "·";
    return s;
  };

  if (canBp) keysLine.appendChild(item(["1", "2", "3"], " 换背包"));
  else keysLine.appendChild(item([], swapBlockReason(), true)); // 只有这条染警示黄：皮肤仍然可用
  if (canSkin) {
    keysLine.appendChild(sep());
    keysLine.appendChild(item(["[", "]"], " 换皮肤"));
  }

  // 槽位图例另起一行压暗：它和这个面板的操作无关，混在同一行会把上面两条按键提示淹掉。
  const legend = document.createElement("div");
  legend.className = "bp-hint-legend";
  legend.textContent = "副武器 USP · 近战 匕首 · 投掷物 手雷/闪光/烟雾";
  hint.appendChild(legend);
}
// ---------- 地面掉落武器（敌人掉的枪 / 玩家按 G 丢的枪）----------
// 数据形状：{ id, skin, slotKind, root, t, baseY, armed, x, z }
// `slotKind` 决定捡起来进哪个槽位 —— 敌人掉的永远是 primary，玩家丢手枪才产生 secondary。
const groundItems = [];
// 「这个槽位被丢空了」。**必须独立于 BACKPACKS 记账**：主武器槽的配置在 BACKPACKS[curBp].primary
// 里，丢枪不该把它抹掉（那等于丢了配装），但按 1 / Q 又不能切到一把已经不存在的枪上。
// 所以用一对布尔量标记「空槽」，复活/开局一起清掉 —— 那正是「复活恢复完整配装」的实现。
const emptySlot = { primary: false, secondary: false };
// 地上同时最多留这么多把。多了从最旧的开始收 —— 团队竞技里敌人源源不断，
// 不设上限的话尸体区会堆成一堆枪的沼泽，而且是纯粹的 GPU 浪费。
const GROUND_MAX = 14;

// 某个槽位此刻装着哪把枪；空槽返回 null。
function slotWeapon(slot) {
  if (slot === "primary") return emptySlot.primary ? null : equippedPrimary();
  if (slot === "secondary") return emptySlot.secondary ? null : "pistol";
  return null;
}
function slotEmptyHint(slot) {
  sfx.empty();
  showToast(slot === "primary" ? "主武器已丢弃，去地上捡一把" : "副武器已丢弃，去地上捡一把", true);
}

// 在地上生成一把枪。
//   armed —— 是否立即可拾取。敌人掉的传 true（它本来就该躺在那儿等人来拿），
//   玩家自己丢的必须传 false，理由见 updateGroundItems 里的防抖说明。
function spawnGroundGun(id, skin, slotKind, x, z, deckY, armed) {
  const tpl = worldModel(id, skin);
  if (!tpl) return null;
  // 三层容器，缺一层都不行：
  //   root —— 世界位置（落点）+ 每帧自转
  //   tier —— 侧躺
  //   模型
  // **侧躺必须放在外层**：模型归一化后枪管沿 ±z（rotY 摆好了），所以绕 **z** 轴滚 90°
  // 正好把它放倒（z 轴是旋转轴、枪管方向不变，y 方向的高度换成枪的厚度）。
  // 若改模型自己的 rotation.z，那是在「枪管还没被 rotY 转到 z 上」之前先绕自己的 z 转，
  // 结果是把枪竖起来 —— 默认的 XYZ 顺序就是这个坑。
  const root = new THREE.Group();
  const tier = new THREE.Group();
  tier.rotation.z = Math.PI / 2;
  // clone(true) 与目录**共享材质** —— 所以回收只能 scene.remove()，绝不能 dispose
  // （见 guncatalog.js 顶部那段；这与 grenadePool 的「用完即 dispose」正好相反）。
  tier.add(tpl.clone(true));
  root.add(tier);
  // 落点高度：贴着甲板面 + 「躺倒后的半高」。**量一次包围盒**而不是写死常数 ——
  // 三把枪的粗细差得多（AWM 还带个镜子），写死总有一把会陷进甲板或浮在空中。
  tier.updateWorldMatrix(false, true);
  const box = new THREE.Box3().setFromObject(tier);
  const half = (box.max.y - box.min.y) / 2;
  const baseY = deckY + half + 0.012;
  root.position.set(x, baseY, z);
  scene.add(root);

  const item = { id, skin, slotKind, root, t: Math.random() * 6.283, baseY, armed: !!armed, x, z };
  groundItems.push(item);
  while (groundItems.length > GROUND_MAX) scene.remove(groundItems.shift().root);
  return item;
}

// 玩家按 G 丢枪。只接受主武器/副武器（刀与投掷物没有「地上的枪」这个表示）。
// **不置 actedThisLife** —— 丢枪不算「行动」，与换弹一致（背包切换的限制不受影响）。
function dropWeapon() {
  const slot = WEAPON_DEFS[currentId].slot;
  if (slot !== "primary" && slot !== "secondary") {
    sfx.empty();
    showToast("只能丢弃主武器或副武器", true);
    return false;
  }
  const id = currentId;
  const skin = activeSkinId(id);
  // 落点 = 玩家正前方 0.9m（与射击同源的 yaw 约定：前向量 = (-sin, -cos)）。
  // 贴着集装箱/箱堆时（blockedBy 非空）退回自己脚下，免得枪掉进掩体里再也走不到。
  let px = player.pos.x - Math.sin(player.yaw) * 0.9;
  let pz = player.pos.z - Math.cos(player.yaw) * 0.9;
  px = Math.max(-bounds.hw, Math.min(bounds.hw, px));
  pz = Math.max(-bounds.hl, Math.min(bounds.hl, pz));
  if (blockedBy(px, pz, player.pos.y)) { px = player.pos.x; pz = player.pos.z; }
  // 生成失败就**什么都别动** —— 置了 emptySlot 却地上没枪，等于凭空把枪弄丢了
  // （`slotWeapon()` 会一直返回 null，按 1 / Q 都是空槽提示，那把枪再也回不来）。
  // 今天目录对每一款可持有的皮肤都非 null，所以这条是防御性的；但它必须在这里，
  // 因为 `spawnGroundGun` 的 null 分支一旦被走到就是**静默**的。
  if (!spawnGroundGun(id, skin, slot, px, pz, supportAt(px, pz, player.pos.y), false)) {
    sfx.empty();
    showToast("暂时无法丢下这把枪", true);
    return false;
  }
  emptySlot[slot] = true;
  sfx.empty(); // 掉地的机械声。没有新增音频资源 —— 音效表里没有 drop/pickup 一类
  showToast("已丢弃 " + gunDisplayName(id, skin));
  // 切到另一个槽位；两个都空就掏刀（拿刀时按 G 是被上面挡掉的，不会空转）
  const next = slotWeapon(slot === "primary" ? "secondary" : "primary");
  switchWeapon(next || "knife", true);
  return true;
}

// 真正把一把地上的枪装到手上。槽位标记、背包配置、场景移除三处必须一起改。
function pickUpItem(it, idx) {
  emptySlot[it.slotKind] = false;
  if (it.slotKind === "primary") {
    // 捡到的枪**替换当前背包的主武器**（连同皮肤）—— CF 里也是「捡了就是捡了」。
    // 复活/重开一局都走 equippedPrimary()，所以这把枪会一直用到本局结束。
    BACKPACKS[curBp].primary = it.id;
    BACKPACKS[curBp].skin = skinForGun(it.id, it.skin);
  } else {
    GEAR_SKIN.pistol = it.skin; // 副武器只有 USP 一个型号，皮肤是全局一份
  }
  groundItems.splice(idx, 1);
  scene.remove(it.root); // 只移出场景，不 dispose（共享材质，见 spawnGroundGun）
  // force=true 必须传：currentId 恰好就是这把枪时（同型号同皮肤再捡一把的情况）
  // 不 force 会提前 return，可见性与枪口火光都不刷新。
  switchWeapon(it.id, true);
  showToast("拾取 " + gunDisplayName(it.id, it.skin));
  chat.taunt("pickup", {});
  return it;
}

// 每帧：自转 + 起伏 + 拾取判定。
// **暂停自转是没必要、拾取必须先挡死**：update() 的死亡分支是往下穿透的（不会提前 return），
// 不在这里挡的话死亡那 3 秒里尸体飘过去也能把枪捡走。故意只挡拾取、不挡转动 ——
// 连地上所有枪一起定住 3 秒，看起来像画面卡了。
function updateGroundItems(dt) {
  if (!groundItems.length) return;
  const canPick = !dead;
  for (let i = groundItems.length - 1; i >= 0; i--) {
    const it = groundItems[i];
    it.t += dt;
    it.root.rotation.y = it.t * 0.9;                                  // 缓慢自转
    it.root.position.y = it.baseY + Math.sin(it.t * 1.7) * 0.02;      // 轻微起伏
    if (!canPick) continue;
    const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z);
    // ① 玩家自己丢的枪：**走远到 2.2m 之外才算解锁**。
    //    这一层不是美术细节、是必需的防抖：丢枪之后那个槽位就是空的，而玩家正踩在枪上，
    //    少了它就会「丢下 → 下一帧又捡回来」（或者站满 1.5 秒后自己捡回来），
    //    G 键等于完全不生效 —— 用户选定的规则是「只有空手时才捡」，而丢枪恰好制造出空手。
    if (!it.armed) {
      if (d > 2.2) it.armed = true;
      continue;
    }
    // ② 只有**对应槽位为空**时才捡（手上有枪时走过去什么也不发生，必须先用 G 丢掉）
    if (!emptySlot[it.slotKind]) continue;
    // ③ 距离。竖直那条挡住「在屋顶捡到甲板下的枪」
    if (d >= 1.15 || Math.abs(it.baseY - player.pos.y) > 1.6) continue;
    pickUpItem(it, i);
  }
}

function clearGroundItems() {
  for (const it of groundItems) scene.remove(it.root); // 同上：不 dispose
  groundItems.length = 0;
}

// 敌人阵亡掉枪。位置取敌人的**世界坐标** group.position（不是 e.root.position ——
// 那是内层模型，见 enemies.js 的四层结构）。枪型/皮肤就是它活着时端在手里的那一把，
// 所以「掉下来的枪」与「敌人手里的枪」永远对得上。
function dropEnemyGun(e) {
  if (!e || !e.gunId) return;
  const p = e.group.position;
  // 可能死在集装箱顶/舷侧走道上，落点高度按脚下实际台面取（不能抄 player.groundY）
  spawnGroundGun(e.gunId, e.gunSkin, "primary", p.x, p.z, supportAt(p.x, p.z, p.y), true);
}

// 敌人手里的枪名。每局随机（见 guncatalog.js），敌人对象池复用时由 reset() 重写 ——
// 所以这里**现读**。旧版那个写死的 `ENEMY_WEAPON = "步枪"` 常量已经删掉了。
function enemyWeaponName(e) {
  return (e && e.weaponName) || "步枪";
}

// 开始菜单里**只有对局设置**（敌人数 + 难度），没有键位表、也没有背包/皮肤配装。
// 背包与皮肤改用写死的默认值：BACKPACKS（背包1=AK 火麒麟 / 背包2=M4 雷神 / 背包3=AWM 无影）
// 与 GEAR_SKIN（USP 修罗 / 匕首 屠龙）。三个背包在游戏内仍可用 B + 数字键切换，
// 所以「三背包 = 三把主武器」这条玩法没丢，只是配装在代码里预设好、菜单不再提供入口。
//
// `skinForGun()` 保留着：皮肤归属校验的那条不变式（「M4 不许挂着 AK 的 skin id」）依然成立，
// 只是现在唯一的触发点是 `__tactical.setSkin` 这类程序化改动。删掉它会让那条不变式重新变成
// 「靠调用方自觉」（见文件上方 skins 一节的说明）。
function buildMenuMatch() {
  const val = document.getElementById("enemyCountVal");
  if (val) val.textContent = String(enemyTarget);
  const box = document.getElementById("mlDiff");
  if (!box) return;
  if (!box.childElementCount) {
    for (const d of DIFFICULTIES) {
      const btn = document.createElement("button");
      btn.className = "ml-seg-btn";
      btn.dataset.diff = d.id;
      btn.textContent = d.name;
      btn.onclick = () => { difficultyId = d.id; buildMenuMatch(); };
      box.appendChild(btn);
    }
  }
  for (const btn of box.children) {
    btn.classList.toggle("active", btn.dataset.diff === difficultyId);
  }
}

// ---------- 开镜（AWM 右键）----------
// CF 的 AWM 是**两级变倍**：右键 → 一级镜，再右键 → 二级镜（更高倍），再右键 → 退镜。
// 用 scopeStage 记 0/1/2，scoped 只是它的布尔视图，别处照旧读 scoped。
let scopeStage = 0;
function applyScope(stage) {
  const def = WEAPON_DEFS[currentId];
  if (stage > 0 && !(def.stats && def.stats.zoom)) stage = 0;
  // 拉栓中不许开镜（AWM 的栓动循环）。退镜（stage 0）永远允许，否则拉栓开始时
  // 那次强制退镜会被自己挡掉 —— 那不是「开镜」而是「离开镜」，两回事。
  if (stage > 0 && WEAPON_STATE && WEAPON_STATE.boltT > 0) stage = 0;
  const was = scoped;
  scopeStage = stage;
  scoped = stage > 0;
  scopeEl.classList.toggle("hidden", !scoped);
  scopeEl.classList.toggle("x2", stage === 2); // 二级镜：镜筒更窄、分划更密
  cross.classList.toggle("hidden", scoped);
  const c = cur();
  if (c) c.group.visible = !scoped;
  if (scoped !== was) (scoped ? sfx.scopeIn() : sfx.scopeOut());
}
// 兼容既有调用点（换枪 / 复活 / 失焦 / 开火后）——一律按「进一级镜 / 退镜」处理
function setScoped(v) { applyScope(v ? (scopeStage > 0 ? scopeStage : 1) : 0); }
// 右键按一下：退镜 → 一级镜 → 二级镜 → 退镜（CF 的 AWM 就是这种循环变倍）
function cycleScope() { applyScope(scoped ? (scopeStage >= 2 ? 0 : 2) : 1); }

// ---------- 手雷 / 闪光弹 / 烟雾弹 ----------
const grenadePool = [];
const smokes = [];
const SMOKE_PUFFS = 14;
const smokePool = [];

function smokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(236,238,240,0.9)");
  g.addColorStop(0.45, "rgba(214,218,222,0.55)");
  g.addColorStop(1, "rgba(200,205,210,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const smokeTex = smokeTexture();

function acquirePuff() {
  let s = smokePool.pop();
  if (!s) {
    s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex,
      transparent: true,
      depthWrite: false,   // 但要 depthTest，让集装箱能自然切开烟团
      depthTest: true,
      opacity: 0,
      blending: THREE.NormalBlending, // 烟是减光的，不能用 Additive
    }));
    s.renderOrder = 10;
    s.userData = {};
    scene.add(s);
  }
  s.visible = true;
  return s;
}

function spawnSmoke(p, radius, life) {
  const cloud = { pos: p.clone(), radius: 0.4, target: radius, t: 0, life, sprites: [] };
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const s = acquirePuff();
    s.userData.off = new THREE.Vector3(
      (Math.random() - 0.5) * 1.4,
      Math.random() * 0.7,
      (Math.random() - 0.5) * 1.4
    );
    s.userData.seed = Math.random() * 10;
    s.userData.baseScale = 1.5 + Math.random() * 1.5;
    cloud.sprites.push(s);
  }
  smokes.push(cloud);
}

function updateSmokes(dt) {
  for (let i = smokes.length - 1; i >= 0; i--) {
    const c = smokes[i];
    c.t += dt;
    // 0.4s 淡入 → 2.5s 膨胀到目标半径 → 最后 2.5s 淡出
    const grow = Math.min(1, Math.max(0, (c.t - 0.1) / 2.5));
    c.radius = c.target * (0.35 + 0.65 * grow);
    const a = Math.min(Math.min(1, c.t / 0.4), Math.min(1, Math.max(0, (c.life - c.t) / 2.5)));
    for (const s of c.sprites) {
      const off = s.userData.off;
      s.position.set(
        c.pos.x + off.x * c.radius,
        c.pos.y + 0.9 + off.y * c.radius * 0.8 + Math.sin(c.t * 0.7 + s.userData.seed) * 0.12,
        c.pos.z + off.z * c.radius
      );
      const sc = s.userData.baseScale * (0.45 + (c.radius / c.target) * 0.85);
      s.scale.set(sc, sc, 1);
      s.material.opacity = 0.34 * a;
    }
    if (c.t >= c.life) {
      for (const s of c.sprites) { s.visible = false; smokePool.push(s); }
      smokes.splice(i, 1);
    }
  }
}

// 线段-球相交：射线被烟团挡住就返回 true。每帧最多 8 敌人 × 3 团，成本可忽略
const _seg = new THREE.Vector3();
const _mz = new THREE.Vector3();   // 敌人枪口（_seg 被 smokeBlocks 占用，别混用）
function smokeBlocks(ax, ay, az, bx, by, bz) {
  if (!smokes.length) return false;
  _seg.set(bx - ax, by - ay, bz - az);
  const a = _seg.lengthSq();
  if (a < 1e-6) return false;
  for (const c of smokes) {
    if (c.radius < 0.6) continue;
    const cx = c.pos.x - ax, cy = c.pos.y + 0.9 - ay, cz = c.pos.z - az;
    let t = (cx * _seg.x + cy * _seg.y + cz * _seg.z) / a;
    t = Math.max(0, Math.min(1, t));
    const px = _seg.x * t - cx, py = _seg.y * t - cy, pz = _seg.z * t - cz;
    if (px * px + py * py + pz * pz < c.radius * c.radius) return true;
  }
  return false;
}

function applyFlashEffect(intensity) {
  flashIntensity = Math.max(flashIntensity, Math.min(1, intensity));
  flashDur = 2.2 + 3.4 * flashIntensity;
  flashT = 0;
}

function updateFlash(dt) {
  if (flashIntensity <= 0) return;
  flashT += dt;
  const p = flashT / flashDur;
  if (p >= 1) {
    flashIntensity = 0;
    flashOverlay.style.opacity = "0";
    return;
  }
  // 前段死白 + 长尾，才是 CF 那种「糊了半天」的观感
  const vis = p < 0.12 ? 1 : Math.pow(1 - (p - 0.12) / 0.88, 2.2);
  flashOverlay.style.opacity = (vis * flashIntensity).toFixed(3);
}

function clearFlash() {
  flashIntensity = 0;
  flashT = 0;
  flashOverlay.style.opacity = "0";
  sfx.muffle(0.01, 20000);
}

function detonateFlash(p) {
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + player.eyeH, player.pos.z);
  const dx = p.x - eye.x, dy = p.y + 0.4 - eye.y, dz = p.z - eye.z;
  const dist = Math.hypot(dx, dy, dz);
  const R = WEAPON_DEFS.flash.stats.radius;
  if (dist < R && dist > 1e-3) {
    // 隔着集装箱不该被闪到
    const dir = new THREE.Vector3(dx, dy, dz).divideScalar(dist);
    raycaster.set(eye, dir);
    raycaster.far = dist;
    if (raycaster.intersectObjects(obstacleFlat, false).length === 0) {
      const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, "YXZ"));
      const facing = Math.max(0, (dx * fwd.x + dy * fwd.y + dz * fwd.z) / dist);
      const intensity = Math.max(0, 1 - dist / R) * (0.35 + 0.65 * facing);
      if (intensity > 0.05) applyFlashEffect(intensity);
    }
  }
  // 敌人也会被闪瞎
  enemyManager.blindAll(p.x, p.z, 16, WEAPON_DEFS.flash.stats.blind);
  sfx.flashbang(3.2);
  emit(new THREE.Vector3(p.x, player.groundY + 0.3, p.z), 0xffffff, true);
}

function updateGrenades(dt) {
  for (let i = grenadePool.length - 1; i >= 0; i--) {
    const g = grenadePool[i];
    g.t += dt;
    g.vel.y -= 16 * dt;
    g.mesh.position.addScaledVector(g.vel, dt);
    g.mesh.rotation.x += dt * 7;
    g.mesh.rotation.z += dt * 5;
    // 落点每帧重算：从集装箱顶上扔出去的雷要落到甲板/箱顶，而不是弹在一块
    // 「玩家扔雷那一刻站着的高度」延伸出来的隐形平面上。
    g.groundY = supportAt(g.mesh.position.x, g.mesh.position.z, g.mesh.position.y);

    // 落地弹跳：CF 里投掷物是「弹几下等引信」，不是一碰地就炸。
    // 阻尼必须只在真正撞击的那一帧施加 —— 写成每帧乘一次的话，贴地那几帧会把
    // 水平速度迅速压成 0，手雷扔出去两秒只挪十几厘米。
    if (g.mesh.position.y < g.groundY) {
      g.mesh.position.y = g.groundY;
      if (g.vel.y < -0.5) {
        g.vel.y = -g.vel.y * 0.38; // 一次弹跳
        g.vel.x *= 0.72;
        g.vel.z *= 0.72;
      } else {
        g.vel.y = 0;               // 贴地滑行：按时间衰减，不按帧
        const fric = Math.max(0, 1 - dt * 2.2);
        g.vel.x *= fric;
        g.vel.z *= fric;
      }
    }
    if (g.t < g.fuse) continue;

    const p = g.mesh.position.clone();
    p.y = g.groundY + 0.1;

    if (g.kind === "frag") {
      spawnImpact(p, false);
      emit(new THREE.Vector3(p.x, p.y + 0.3, p.z), 0xffaa44, true);
      emit(new THREE.Vector3(p.x, p.y + 0.8, p.z), 0xff55aa, true);
      sfx.explosion();
      const eff = WEAPON_DEFS.frag.stats;
      for (const e of enemyManager.enemies) {
        if (e.dead) continue;
        const dist = Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z);
        if (dist < eff.radius) {
          const dmg = Math.round(eff.dmg * (1 - dist / eff.radius));
          if (e.takeDamage(dmg)) onEnemyDeath(e, false, "手雷");
        }
      }
      const pdist = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
      if (pdist < eff.radius * 0.75) {
        damagePlayer(Math.round(eff.dmg * 0.35 * (1 - pdist / eff.radius)), false);
      }
    } else if (g.kind === "flash") {
      detonateFlash(p);
    } else {
      spawnSmoke(p, WEAPON_DEFS.smoke.stats.radius, WEAPON_DEFS.smoke.stats.life);
      sfx.smokeHiss(p.x, p.y, p.z);
    }

    scene.remove(g.mesh);
    g.mesh.geometry.dispose();
    g.mesh.material.dispose();
    grenadePool.splice(i, 1);
  }
}

function throwGrenade() {
  const def = WEAPON_DEFS[currentId];
  const st = def.stats;
  if (state !== "playing" || dead || cur().state.throwCd > 0) return;
  if (cur().state.count <= 0) { sfx.empty(); return; }
  cur().state.count--;
  actedThisLife = true; // 本回合已行动 → 锁定背包切换（CF 规则）
  cur().state.throwCd = st.throwCooldown;
  sfx.throwGrenade();
  triggerKick(currentId); // 甩手投掷的后坐视感

  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  origin.y -= 0.15;
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(
    new THREE.Euler(player.pitch + recoilPitch, player.yaw + recoilYaw, 0, "YXZ")
  );
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 10),
    new THREE.MeshStandardMaterial({
      color: def.nade === "flash" ? 0xcfd6da : def.nade === "smoke" ? 0x4a5055 : 0x33424f,
      metalness: 0.3,
      roughness: 0.6,
    })
  );
  mesh.position.copy(origin);
  mesh.scale.set(1, 1, 1.3);
  scene.add(mesh);
  grenadePool.push({
    mesh, kind: def.nade, t: 0,
    vel: dir.multiplyScalar(11).add(new THREE.Vector3(0, 3.4, 0)),
    fuse: st.fuse,
    // 落点每帧按脚下实际台面重算（见 updateGrenades）。这里**不能**抄 player.groundY：
    // 那是「玩家站在哪」，雷飞出去之后跟它没关系，抄过来会得到一个 2.43m 高的隐形地板。
    groundY: 0,
  });
  updateAmmoHud();
}

// ---------- 近战 ----------
// 轻击 / 重击两档（CS 口径：轻 40·背后 90，重 65·背后 180，够得着 0.91m）。
// `heavy` 只在右键按下时为真（见 mousedown 那条分支）。
//
// **命中方式刻意保留我们的单射线**，不搬 CS 的 `sweep()` 外壳命中 ——
// 我们的敌人骨架没有 `sweep()`，而为了一个近战要给它加一套外壳体不划算。
// 代价是「贴着敌人侧身挥刀」比 CS 更容易落空，这是明确的观感折衷（已写进 AGENTS.md）。
function meleeAttack(heavy) {
  if (state !== "playing" || dead) return;
  const st = WEAPON_DEFS.knife.stats;
  const mode = heavy ? st.heavy : st.light;
  const now = performance.now();
  // 近战也用自己的射速闸门（cur() 就是匕首，因为 melee 类型只有它）
  const ks = cur().state;
  if (now < ks.nextFireAt) return;
  ks.nextFireAt = now + mode.interval * 1000;
  actedThisLife = true; // 本回合已行动 → 锁定背包切换（CF 规则）
  ks.cooldown = heavy ? 0.7 : 0.3;
  sfx.melee(!!heavy);
  triggerKick("knife"); // 挥刀：大幅偏转 + 小位移
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(
    new THREE.Euler(player.pitch + recoilPitch, player.yaw + recoilYaw, 0, "YXZ")
  );
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  raycaster.set(origin, dir);
  raycaster.far = st.range;
  const hits = raycaster.intersectObjects(flatTargets(), false);
  if (hits.length > 0) {
    const h = hits[0];
    spawnTracer(h.point);
    if (h.object.userData.enemy) {
      const enemy = h.object.userData.enemy;
      if (!enemy.dead) {
        const head = h.object.userData.part === "head";
        // 背刺：敌人的**前向**（骨架的 +z，经 group.rotation.y 转进世界）与我们这一刀的
        // 方向同向 —— 也就是他背对着我们。CS 的判据是 `dot > 0.5`（±60° 的扇面），照抄。
        // 自杀那一侧不需要特判：`killer === null` 的路径只存在于手雷自伤。
        const ef = new THREE.Vector3(Math.sin(enemy.group.rotation.y), 0, Math.cos(enemy.group.rotation.y));
        const backstab = ef.dot(dir) > 0.5;
        const dmg = head ? enemy.maxHealth : backstab ? mode.backstab : mode.dmg;
        spawnBlood(h.point);
        if (enemy.takeDamage(dmg)) onEnemyDeath(enemy, head, "军用匕首");
        else { addHitMark(head ? "head" : backstab ? "kill" : "hit"); head ? sfx.headshot() : sfx.hit(); enemy.setFlash(); }
      }
    } else {
      spawnSparks(h.point);
    }
  }
}

// ---------- 射击 ----------
// 敌人(存活) + 障碍拍平成纯 Mesh 列表做非递归 intersectObjects。
// 尸体不进这个列表，所以既挡不了子弹也不挡视线；血条已移除，也无需担心 Sprite 递归。
function flatTargets() {
  const meshes = [];
  for (const e of enemyManager.enemies) {
    for (const m of e.meshes) meshes.push(m);
  }
  for (const m of obstacleFlat) meshes.push(m);
  return meshes;
}

function fire() {
  const def = WEAPON_DEFS[currentId];
  // dead 是兜底闸门：死亡视角期间左键、自动连发（走这条）、__tactical.forceFire 全部到此为止
  if (state !== "playing" || dead) return;
  if (def.type === "melee") { meleeAttack(); return; }
  if (def.type === "grenade") { throwGrenade(); return; }

  if (WEAPON_STATE.reloading || WEAPON_STATE.cooldown > 0) return;
  // 拉栓中不许开火（AWM）。门放在这里而不是 `nextFireAt` 上：`nextFireAt` 只管射速节奏，
  // 而拉栓是「这一发之后的额外动作」，两者正交 —— 拉栓 1.2s 比射击间隔 1.4548s 短，
  // 合并成一个计时器会让「拉栓中切枪再切回来」丢掉拉栓状态。
  if (WEAPON_STATE.boltT > 0) return;
  const now = performance.now();
  if (now < WEAPON_STATE.nextFireAt) return;

  if (WEAPON_STATE.mag <= 0) { sfx.empty(); startReload(); return; }
  WEAPON_STATE.nextFireAt = now + WEAPON_STATE.fireInterval * 1000;
  WEAPON_STATE.mag--;
  actedThisLife = true; // 本回合已行动 → 锁定背包切换（CF 规则）
  WEAPON_STATE.cooldown = 0.07;
  sfx.shoot(def.type);

  triggerKick(currentId);
  // 连发惩罚（**只喂准星张开**）。上限对齐 CS 的 `_baseInaccuracy` 在做完整梭时的量级。
  WEAPON_STATE.inaccPenalty = Math.min(WEAPON_STATE.inaccPenalty + (def.inacc?.fire ?? 0.008), 0.09);

  // 枪口焰：只在这里「触发」，涨消由 animateWeapon 每帧推进（见 updateMuzzleFlash）。
  // 旧写法是 `setTimeout(..., 55)` —— 既不受 pause() 影响、又与帧率脱钩：60fps 下正好
  // 一帧多就没了，掉一帧就整发不显示；连发时多个定时器还会互相踩着关灯。
  triggerMuzzleFlash(def);

  // 子弹沿相机当前朝向发射，与准星所见完全一致。
  // `syncRecoil()` 在这里显式再同步一次：`recoilPitch/Yaw` 是 `aimPunch` 的派生量，
  // 而 `aimPunch` 可能刚被这一帧的 `decayPunch()` 改过 —— 保证相机与射线读的是同一份。
  syncRecoil();
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(
    new THREE.Euler(player.pitch + recoilPitch, player.yaw + recoilYaw, 0, "YXZ")
  );
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  raycaster.set(origin, dir);
  raycaster.far = 300;

  const hits = raycaster.intersectObjects(flatTargets(), false);
  if (hits.length > 0) {
    const h = hits[0];
    spawnTracer(h.point);
    if (h.object.userData.enemy) {
      const enemy = h.object.userData.enemy;
      if (!enemy.dead) {
        const head = h.object.userData.part === "head";
        // 距离衰减走 CS 的 `rangeMod ^ (距离/9.525)`（见 damageAt）。
        // 比旧式 `max(0.65, 1-(d-18)/40*0.35)` 平缓：AK 在 50m 处 0.72 → 0.90，即 5 枪变 4 枪。
        const dmg = head ? enemy.maxHealth : damageAt(def, h.distance);
        spawnBlood(h.point);
        if (enemy.takeDamage(dmg)) onEnemyDeath(enemy, head, def.name);
        else {
          addHitMark(head ? "head" : "hit");
          head ? sfx.headshot() : sfx.hit();
        }
      }
    } else {
      spawnSparks(h.point);
    }
  }

  // 本枪后坐：**按弹道表逐发推进**（不再有 `Math.random()` —— 表本身就是「形状确定」的，
  // 随机化会把 AK 经典的轨迹打成噪声）。`advancePunch()` 内部会 `syncRecoil()`，
  // 所以相机与**下一发**的射线立刻跟上这一发的抬升。
  // 位置在命中处理**之后**：与 AGENTS.md「本枪后坐必须在命中处理之后才累加」一致，
  // 首发射线用的是打表之前的偏移，不会比准星所见提前抬一枪。
  WEAPON_STATE.sinceShot = 0;
  advancePunch();

  // CF 惯例：狙击枪一枪打出即强制退镜。CS 的 AWP 还多一层栓动循环 ——
  // 退镜 → 拉栓 `boltTime` 秒（期间不可开火、不可开镜）→ 拉完**自动回镜**。
  // 旧注释说这顺带避免了狙击后坐在窄视场里被放大糊住画面，现在这一点由退镜本身负责。
  if (def.type === "sniper") {
    WEAPON_STATE.boltT = def.stats.boltTime ?? 0;
    WEAPON_STATE.reScope = scoped; // 本来在镜里 → 拉完自动回镜（CS 的手感）
    if (scoped) setScoped(false);
  }

  updateAmmoHud();
  if (WEAPON_STATE.mag <= 0) startReload();
}

function onKill(headshot, enemyName, weaponName) {
  kills++;
  // 距上一杀超过窗口就归零，然后从这一发重新起算（见 STREAK_WINDOW 的注释）。
  // 这里**必须**再判一次过期，不能只依赖主循环里那次归零：`__tactical.onKill` 是直接调
  // 本函数的（绕过 update），而 pause() 期间 update 根本不跑。
  if (time - lastKillAt > STREAK_WINDOW) streakCount = 0;
  streakCount++;
  lastKillAt = time;
  // 敌人的反应。三档互斥，按「连杀 > 爆头 > 普通击杀」只挑一档入场 ——
  // chat 的优先级队列本来也能合并，但在这里先选一次更省，也让意图更直白。
  chat.taunt(streakCount >= 2 ? "multikill" : headshot ? "headshot" : "kill", { name: enemyName });
  addHitMark("kill");
  showKillIcon(headshot);
  sfx.kill();
  pushKillFeed("你", weaponName || WEAPON_DEFS[currentId].name, enemyName || "敌人", !!headshot, false);
  if (streakCount >= 2) showStreak(streakCount);
  updateScoreHud();
  if (state === "playing" && kills >= TDM_LIMIT) endTDM("win");
}

function refillEnemies() {
  if (state !== "playing") return;
  const alive = enemyManager.aliveCount();
  if (alive >= enemyTarget) return;
  const before = enemyManager.enemies.length;
  enemyManager.spawnGroup(enemyTarget - alive, bounds);
  // spawnGroup 只会往 enemies 尾部追加，所以 [before, length) 就是这次新上场的人
  for (let i = before; i < enemyManager.enemies.length; i++) bindRoster(enemyManager.enemies[i]);
}

// 敌人数在 HUD（#enemyNumVal）与菜单步进器（#enemyCountVal）上的显示同步。
// 只在「人数变了 / 新开一局」时写 —— 不做每帧更新，免得又踩 renderScoreboard()
// 那种「面板隐藏就早退」的坑。两个位置一起写：对局里按 +/- 的结果，回到菜单看得见。
function refreshEnemyCountUi() {
  const hud = document.getElementById("enemyNumVal");
  if (hud) hud.textContent = String(enemyTarget);
  const menu = document.getElementById("enemyCountVal");
  if (menu) menu.textContent = String(enemyTarget);
}

// 改「场上敌人数」。**一个原子操作：变量、在场实例、名册三处必须一起改**，
// 只改 enemyTarget 会留下两种不一致 ——
//   调大：refillEnemies 会补人，但名册没条目 → bindRoster 走到最后的 `|| roster[0]`，
//         两个敌人共用一条 → 阵亡时战绩互相覆盖；
//   调小：refillEnemies 的 `alive >= enemyTarget` 恒成立、直接 return，多出来的人永远不下线。
function setEnemyTarget(n) {
  const want = Math.max(ENEMY_MIN, Math.min(ENEMY_MAX, Math.round(Number(n) || ENEMY_MIN)));
  if (want === enemyTarget) { refreshEnemyCountUi(); return enemyTarget; }
  enemyTarget = want;

  if (state === "playing") {
    // ① 减员：把超编的存活敌人「离场」。
    //    **绝不能设 e.dead = true** —— 下一帧 enemyManager.update() 会把它转入 corpses、
    //    播一遍倒地动画，并经 onEnemyDeath 记一次阵亡：语义就变成了「被打死」。
    //    这里只解绑名册 + release() 回对象池（release 只负责移出场景与入池）。
    const list = enemyManager.enemies;
    if (list.length > enemyTarget) {
      const doomed = list.slice(enemyTarget);
      const drop = new Set(doomed);
      enemyManager.enemies = list.filter((e) => !drop.has(e));
      for (const e of doomed) {
        if (e.roster) { e.roster.enemy = null; e.roster = null; }  // 不记 deaths++：下线不等于阵亡
        enemyManager.release(e);
      }
    }
    // ② 名册先跟到新长度（此时超编敌人的条目已解绑，能被干净地裁掉）
    resizeRoster(enemyTarget);
    // ③ 加人：立即补，不等 2.4s 的补员节拍
    if (enemyManager.enemies.length < enemyTarget) refillEnemies();
  }
  // 菜单里改（state !== "playing"）时不用碰名册与实例：下一局的 gameStart() 会
  // 用 initRoster() 按新的 enemyTarget 全量重建，refillEnemies() 再按它刷人。
  refreshEnemyCountUi();
  return enemyTarget;
}

// ---------- 换弹 ----------
function startReload() {
  if (WEAPON_STATE.reloading || WEAPON_STATE.mag === WEAPON_STATE.magSize || WEAPON_STATE.reserve <= 0) return;
  WEAPON_STATE.reloading = true;
  WEAPON_STATE.reloadT = 0;
  sfx.reload();
  showToast("换弹中");
}
function updateReload(dt) {
  if (!WEAPON_STATE.reloading) return;
  WEAPON_STATE.reloadT += dt;
  if (WEAPON_STATE.reloadT >= WEAPON_STATE.reloadDur) {
    const take = Math.min(WEAPON_STATE.magSize - WEAPON_STATE.mag, WEAPON_STATE.reserve);
    WEAPON_STATE.mag += take;
    WEAPON_STATE.reserve -= take;
    WEAPON_STATE.reloading = false;
    showToast("");
    updateAmmoHud();
  }
}

// ---------- 粒子池（火花 / 血雾共用）----------
const pool = [];
function makePool(n) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })
    );
    m.visible = false;
    scene.add(m);
    pool.push({ m, life: 0.2, t: 1, base: 0.2, vel: null, grav: 0 });
  }
}
makePool(140);

function emit(point, hex, big, vel, grav, life) {
  const o = pool.find((p) => p.t >= p.life);
  if (!o) return;
  o.m.position.copy(point);
  o.m.material.color.setHex(hex);
  o.base = big ? 0.35 : 0.18;
  o.life = life || 0.2;
  o.t = 0;
  o.vel = vel || null;
  o.grav = grav || 0;
  o.m.visible = true;
}

function spawnTracer(p) { emit(p, 0xffd080, false, null, 0, 0.12); }
// 打中掩体：黄白火花 + 尘
function spawnSparks(p) {
  for (let i = 0; i < 6; i++) {
    emit(p, i < 3 ? 0xffe08a : 0xffffff, true, new THREE.Vector3(
      (Math.random() - 0.5) * 3, Math.random() * 2.4, (Math.random() - 0.5) * 3
    ), 9, 0.34);
  }
}
// 打中敌人：血雾（红色，带重力）
function spawnBlood(p) {
  for (let i = 0; i < 7; i++) {
    emit(p, i % 3 === 0 ? 0xff4444 : 0x9e1414, true, new THREE.Vector3(
      (Math.random() - 0.5) * 2.2, Math.random() * 1.4, (Math.random() - 0.5) * 2.2
    ), 12, 0.42);
  }
}
function spawnImpact(p, solid) { emit(p, solid ? 0xffffff : 0xfff0b0, true); }

function updatePool(dt) {
  for (const o of pool) {
    if (o.t >= o.life) continue;
    o.t += dt;
    if (o.vel) {
      o.vel.y -= o.grav * dt;
      o.m.position.addScaledVector(o.vel, dt);
    }
    o.m.scale.setScalar(Math.max(0.01, o.base * (1 - o.t / o.life) * 3));
    o.m.material.opacity = 1 - o.t / o.life;
    if (o.t >= o.life) o.m.visible = false;
  }
}

// ---------- 敌人开火 ----------
function enemiesShoot() {
  if (!enemyManager.enemies.length) return;
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + EYE, player.pos.z);
  const losMeshes = obstacleFlat;
  const pSpeed = Math.hypot(player.vel.x, player.vel.z);

  for (const e of enemyManager.enemies) {
    if (!e.wantShoot || e.dead || e.blindT > 0) continue;
    const from = e.eyeline;
    const dx = eye.x - from.x, dy = eye.y - from.y, dz = eye.z - from.z;
    const dist = Math.hypot(dx, dy, dz) || 1e-3;
    const dir = new THREE.Vector3(dx / dist, dy / dist, dz / dist);

    raycaster.set(from, dir);
    raycaster.far = dist;
    if (raycaster.intersectObjects(losMeshes, false).length > 0) continue;
    // 烟雾弹真的挡视线（否则烟雾只是好看）
    if (smokeBlocks(from.x, from.y, from.z, eye.x, eye.y, eye.z)) continue;

    // 枪口火光打在手里的枪管前端（不再是胸口下方的近似位），看着才是「他在开枪」
    const mz = e.muzzleWorld(_mz);
    emit(mz, 0xffd080, true);
    sfx.enemyShoot(mz.x, mz.y, mz.z);
    e.recoil();   // 骨架来一下后坐：枪往肩里推 + 枪口上跳（每发一下）

    // 走位能躲枪：玩家移动时敌人命中率下降。难度只缩这一处 —— 伤害在 Enemy.reset
    // 里按 ENEMY_TUNING.dmg 定，不在命中后再乘（免得同一个乘数算两遍）。
    const hitProb = Math.max(0.05, Math.min(0.95,
      Math.max(0.12, 0.72 - dist / 46) * Math.max(0.5, 1 - pSpeed * 0.05) * ENEMY_TUNING.acc));
    if (Math.random() < hitProb) damagePlayer(e.damage, true, e);
  }
}

// ---------- 玩家受击 ----------
function damagePlayer(amount, byEnemy = true, killer = null) {
  if (state !== "playing") return;
  // 死亡视角期间敌人仍在开火（enemiesShoot 不看你死没死）。不早退的话会反复走进
  // 下面的死亡分支：比分、名册击杀数、击杀信息条全部被重复记账。
  if (dead) return;
  if (player.invuln > 0) return;
  player.hp -= amount;
  damageOverlay();
  sfx.hurt();
  if (killer) showHitDir(killer.group.position.x, killer.group.position.z);
  updateHpHud();
  if (player.hp <= 0) {
    player.hp = 0;
    playerDeaths++; // 自伤手雷同样记一次阵亡（CF 里自杀也算）
    lastKiller = byEnemy ? killer : null;
    if (byEnemy) {
      enemyScore++;
      if (killer && killer.roster) killer.roster.kills++; // 记到名册条目上，不是记在池化的敌人对象上
      pushKillFeed(killer ? killer.name : "敌人", enemyWeaponName(killer), "你", false, true);
      updateScoreHud();
      if (enemyScore >= TDM_LIMIT) { endTDM("lose"); return; }
    }
    beginDeath(killer, byEnemy);
  }
}

// 最短弧的角度归一：+190° 要当成 -170° 转，否则镜头会绕远路甩一大圈
function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// 进入死亡视角：**不再当帧瞬移**。先把镜头交给击杀者，DEATH_DELAY 秒后才真正复活。
function beginDeath(killer, byEnemy = true) {
  dead = true;
  // 击杀者的嘲讽。自雷（killer === null）没有发言人，退化成系统播报一句。
  // 这里**不收聊天输入框** —— CF 允许死后继续打字，死亡视角只有 3 秒，
  // 而且 chat.handleKey 排在各处 dead 守卫之前，功能上天然可用。
  if (killer && killer.name) chat.taunt("death", { speaker: killer.name });
  else chat.taunt("death", { speaker: "战地广播", kind: "system" });
  deathT = DEATH_DELAY;
  fireEnabled = false; // 握着左键被打死时 mouseup 不一定来，别让它复活后自己续火
  setScoped(false);    // 死亡一律退镜（狙击镜筒会挡住「谁杀了我」）
  clearFlash();

  // 转向目标：以死亡瞬间的朝向为起点，最短弧转到击杀者方向
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + player.eyeH, player.pos.z);
  let toYaw = player.yaw, toPitch = player.pitch;
  if (killer && killer.group) {
    const p = killer.group.position;   // 世界坐标在 group.position（别读 e.root.position）
    const dx = p.x - eye.x, dz = p.z - eye.z;
    const flat = Math.hypot(dx, dz) || 1e-3;
    // 与 showHitDir 同一套朝向约定：前向量 = (-sin yaw, -cos yaw)
    toYaw = Math.atan2(-dx, -dz);
    toPitch = Math.atan2(p.y + 1.4 - eye.y, flat); // 瞄胸口，不盯着脚下
  }
  // 自杀（手雷自伤）没有 killer → 差值为 0，退化成「镜头停住」，不做无意义的转动
  deathCam.dYaw = normAngle(toYaw - player.yaw);
  // 俯仰按 mousemove 的同一上限收一下，否则「仰头阵亡、凶手在脚下」会把相机顶得翻过去
  const lim = Math.PI / 2 - 0.05;
  deathCam.dPitch = Math.max(-lim, Math.min(lim, toPitch)) - player.pitch;
  deathCam.t = 0;
  deathCam.yawOff = 0;
  deathCam.pitchOff = 0;
  deathCam.active = true;

  showDeathPanel(
    byEnemy ? (killer ? killer.name : "敌人") : "自己的手雷",
    byEnemy ? enemyWeaponName(killer) : ""
  );

  // 兜底：正常的死亡倒计时走主循环的 deathT，但万一主循环那头出问题
  // （比如某处在死亡块之前每帧抛异常），这里保证「永远卡在死亡态」不可能发生。
  // 判据是**帧号有没有推进**，不是墙上时钟：低帧率机器上倒计时本来就会慢于真实时间
  // （实测 1.2fps 下 3 秒要走 6.4 秒墙上时钟），只看秒数会把好机器误判成卡死。
  armDeathWatchdog();
}

function armDeathWatchdog() {
  clearTimeout(deathWatchdog);
  let lastFrame = frameCount;
  const tick = () => {
    if (!dead) return;
    if (frameCount !== lastFrame) {          // 主循环还活着，交给它，继续观察
      lastFrame = frameCount;
      deathWatchdog = setTimeout(tick, 1500);
      return;
    }
    // 整整 1.5 秒一帧都没推进：主循环那头真出问题了，直接复活解围
    try {
      respawnPlayer();
    } catch (err) {
      noteLoopError(err, "死亡兜底");
      cancelDeath();
    }
  };
  deathWatchdog = setTimeout(tick, 1500);
}

// 每帧推进死亡视角（由 update() 调用，走 dt —— 与 __tactical.pause() 语义一致）
function stepDeathCam(dt) {
  if (!deathCam.active) return;
  deathCam.t = Math.min(1, deathCam.t + dt / DEATH_TURN);
  const e = 1 - Math.pow(1 - deathCam.t, 3); // easeOutCubic：起步快、收尾稳
  deathCam.yawOff = deathCam.dYaw * e;
  deathCam.pitchOff = deathCam.dPitch * e;
}

// 清掉一切死亡态。重开一局、回合结束都要调，否则死亡中结算会在结算画面上
// 跳出瞬移与「已复活」toast。
function cancelDeath() {
  clearTimeout(deathWatchdog);
  dead = false;
  deathT = 0;
  deathCam.active = false;
  deathCam.t = 0;
  deathCam.dYaw = 0;
  deathCam.dPitch = 0;
  deathCam.yawOff = 0;
  deathCam.pitchOff = 0;
  hideDeathPanel();
}

function respawnPlayer() {
  clearFlash();
  setScoped(false);
  player.hp = 100;
  player.pos.set((Math.random() - 0.5) * 10, 0, bounds.hl - 6);
  actedThisLife = false; // 复活回到安全区，重新开放背包切换（CF 规则）
  // 复活恢复**完整配装**：丢枪留下的空槽一起清掉。地上的枪不动 ——
  // 它们留在原地等人捡（包括自己刚丢的那把）。
  emptySlot.primary = false;
  emptySlot.secondary = false;
  player.vel.set(0, 0, 0);
  player.yaw = 0;
  player.pitch = 0;
  // 后坐归零的**权威**是下面那个逐把枪的重置循环（清 `aimPunch`），
  // 然后由末尾的 `switchWeapon → syncRecoil()` 把派生量刷成 0。这两行只是把
  // 「重置循环跑之前」的那一帧也摆正，免得中间任何一处读到一个陈旧的抬枪角。
  recoilPitch = 0;
  recoilYaw = 0;
  player.viewDip = 0;
  player.stepLift = 0;
  // groundY 必须一起清零：它现在由 supportAt() 每帧重算，若上一帧死在集装箱顶
  // （groundY=2.43）而不清，复活到 y=0 的甲板上会被 `pos.y <= groundY` 直接弹回箱顶。
  player.groundY = 0;
  player.invuln = TDM_RESPAWN;
  for (const k in owned) {
    const d = owned[k].def.stats;
    owned[k].state.mag = d.magSize ?? 0;
    owned[k].state.reserve = d.reserve ?? 0;
    owned[k].state.count = d.count ?? 0;
    owned[k].state.reloading = false;
    owned[k].state.reloadT = 0; // 与 reloading 一起清 —— 只清前者会让手臂卡在换弹中途
    resetKick(owned[k].state);
    owned[k].state.cooldown = 0;
    owned[k].state.nextFireAt = 0;
    owned[k].state.throwCd = 0;
    // CS 后坐/准星的每把枪状态一并归零（含 AWM 的拉栓）。
    owned[k].state.recoilIdx = 0;
    owned[k].state.aimPunch.x = 0;
    owned[k].state.aimPunch.y = 0;
    owned[k].state.sinceShot = 99;   // 99 = 早已停火，下一发从表头起
    owned[k].state.inaccPenalty = 0;
    owned[k].state.boltT = 0;
    owned[k].state.reScope = false;
  }
  // 复活装备「当前背包」的主武器。这里历史上硬编码 "ak"，而 AK 的 slot 是 primary，
  // 旧版 switchWeapon 会顺手把「已选主武器」也改成 "ak" —— 于是「选了 AWM，死一次再按 1
  // 就跳回 AK」，症状看起来像 1 键轮换，真正的触发点却是死亡。force=true 见 switchWeapon 注释。
  switchWeapon(equippedPrimary(), true);
  updateHpHud();
  updateAmmoHud();
  updateScoreHud();
  showToast("已复活");
  // 死亡态在这里结束（原来是个没有 clearTimeout 的 setTimeout，重开一局/连续死亡会残留）。
  // 计时改由主循环的 deathT 驱动，见 update()。
  cancelDeath();
}

// ---------- 控制 ----------
document.addEventListener("keydown", (e) => {
  // 聊天输入态在**这里**整体短路 —— 必须是第一条语句、且在 `keys[e.code] = true` 之前：
  //  · 排在后面的话，打出的 w/a/s/d 会同时驱动 movePlayer；
  //  · 也不能只挡几个键，下面还有 +/-(改敌人数)、G(丢枪)、1/2/3/4、B 等分支；
  //  · 提前 return 会让 handler 末尾那两处 Space/方向键的 preventDefault **不执行**，
  //    空格才打得进输入框（这正是「必须放在最前」的第二个理由）。
  if (chat.handleKey(e)) return;
  keys[e.code] = true;
  // Tab 是浏览器的焦点切换键，不管在不在游戏里都要挡掉，否则按住会把焦点移走
  if (e.code === "Tab") {
    e.preventDefault();
    if (state === "playing") showScoreboard(true);
    return;
  }
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys[IS_SNEAK] = true;
  if (e.code === "ControlLeft" || e.code === "ControlRight") {
    // 只认「抬起 → 按下」那一次。系统对按住不放的键会持续补发 keydown，而这些补发的
    // `e.repeat` 并不可靠（实测 CDP/合成输入下恒为 false），若每次 keydown 都刷新时间戳，
    // 「按住 Ctrl 蹲着打枪」会被永远判成 Ctrl+单击手势。
    if (!keys[IS_CROUCH]) crouchDownAt = performance.now();
    keys[IS_CROUCH] = true;
  }
  if (state !== "playing") return;
  // 对局中增减敌人数量（1~8）。放在 dead 之前是有意的：死亡视角那 3 秒里也能调。
  // 用 e.code 而不是 e.key —— `+` 在不同布局/输入法下 e.key 不一样，而 Shift+Equal 与
  // 小键盘加号都是稳定的物理键。Shift 会顺带置一次 IS_SNEAK，抬手即清，无副作用。
  if (e.code === "Equal" || e.code === "NumpadAdd") { e.preventDefault(); setEnemyTarget(enemyTarget + 1); return; }
  if (e.code === "Minus" || e.code === "NumpadSubtract") { e.preventDefault(); setEnemyTarget(enemyTarget - 1); return; }
  // 死亡视角期间不换弹、不切枪、不开背包面板（枪模都藏起来了，换枪没有意义）。
  // Tab 战绩面板在上面已经处理过，不受这里影响。
  if (dead) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    return;
  }
  if (e.code === "KeyR") startReload();
  // G = 丢弃当前的主武器/副武器（掉在脚前的地上，走远再回来可以捡）
  if (e.code === "KeyG") dropWeapon();
  if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") {
    if (backpackOpen()) {
      // 面板打开时，数字键选的是「第几个背包」（CF 的 B + 数字键）。
      // **选完不关面板**：皮肤行就渲染在同一个面板里（见 updateBackpack），一关面板
      // 紧接着按 `[`/`]` 就会因为 `backpackOpen()` 为假而静默失效 —— 用户实测报的
      // 「能换背包、换不了皮肤」正是这条。关闭面板仍然只有 B 一个入口，标题里写着。
      switchBackpack(+e.code[5] - 1);
      return;
    }
  }
  if (e.code === "Digit1") switchToPrimary();
  if (e.code === "Digit2") switchToSecondary();
  if (e.code === "Digit3") switchWeapon("knife");
  if (e.code === "Digit4") switchNade();
  if (e.code === "KeyQ") quickSwitch();
  if (e.code === "KeyB") toggleBackpack();
  // `[` / `]` = 在**面板打开时**循环当前背包主武器的皮肤。
  // 键盘是主路径：指针锁定时没有光标，面板里那些按钮其实点不到（见 updateBackpack 的注释）。
  // 要求面板打开是有意的 —— 免得战斗中误触一个方括号就把枪换了皮。
  // （打字时天然安全：`chat.handleKey` 是 keydown 的第一条语句，输入态整体短路）
  if (e.code === "BracketLeft" || e.code === "BracketRight") {
    if (backpackOpen()) {
      e.preventDefault();
      cycleSkin(e.code === "BracketLeft" ? -1 : 1);
    }
    return;
  }
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});
document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
  if (e.code === "Tab") { showScoreboard(false); return; }
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys[IS_SNEAK] = false;
  if (e.code === "ControlLeft" || e.code === "ControlRight") {
    keys[IS_CROUCH] = false;
    crouchDownAt = -1;
  }
});
// 切走窗口时 keyup 收不到，战绩面板会一直挂着，所以失焦也要收起来。
// 聊天同理：失焦后 keyup 收不到、输入框也丢了焦点，typing 会一直挂着。
window.addEventListener("blur", () => { showScoreboard(false); chat.cancel(); });

function requestLock() { viewport.requestPointerLock(); }
document.getElementById("startBtn").addEventListener("click", () => { sfx.ensure(); requestLock(); });
document.getElementById("restartBtn").addEventListener("click", () => { sfx.ensure(); requestLock(); });

document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === viewport;
  if (locked) {
    hud.classList.remove("hidden");
    menu.classList.add("hidden");
    gameover.classList.add("hidden");
    viewport.classList.add("active");
    if (state !== "playing") gameStart();
  } else {
    hud.classList.add("hidden");
    setScoped(false);
    clearFlash();
    showScoreboard(false);
    // 失锁是「取消聊天输入」的**权威信号**：指针锁下 Chrome 拿 Escape 去解锁，
    // 页面通常根本收不到那次 keydown，所以 Escape 那条只是尽力而为（见 chat.js）。
    // 这里必须收：输入框随 HUD 一起被 display:none，会静默失焦而 typing 还挂着 true。
    chat.cancel();
    if (state === "playing") menu.classList.remove("hidden");
    viewport.classList.remove("active");
  }
});
document.addEventListener("mousemove", (e) => {
  // 死亡期间不能转头：镜头归死亡视角接管（否则玩家一甩鼠标就压过转向击杀者的插值）。
  // 聊天打字期间同理 —— 指针锁还在，movementX/Y 照来，不挡就是边打字边乱转镜头。
  if (!locked || state !== "playing" || dead || chat.isTyping()) return;
  // 开镜灵敏度照抄 CS 的 `zoomSens: [40/90, 10/90]`（CS 的 zoom_sensitivity_ratio = 1），
  // 即按 FOV 等比缩放：一级 0.444、二级 0.111（原值 0.35 / 0.22 是拍脑袋定的）。
  const sens = 0.0022 * (scopeStage === 2 ? 10 / 90 : scoped ? 40 / 90 : 1);
  player.yaw -= e.movementX * sens;
  player.pitch -= e.movementY * sens;
  const lim = Math.PI / 2 - 0.05;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
});
// 判断「右键」而不是裸写 e.button === 2 —— macOS 触控板的 Ctrl+单击在 Chrome 里
// 报的是 button:0 + ctrlKey:true，原来的写法会把开镜错判成开火（用户看到的就是「右键没反应」）。
// 顺手兼容 e.which（老事件模型）与二级/三级键。
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
// 「Ctrl 刚按下就点」算右键手势的窗口。Ctrl 在本作里是蹲，所以 Ctrl+单击与
// 「按住蹲下再开枪」在事件层完全同形（都是 button:0 + ctrlKey:true），只能按
// 「Ctrl 是按下去的一瞬间，还是已经按住了一会儿」分。触控板做右键手势时 Ctrl 与
// 单击几乎同时发生；蹲着打枪的人则是先按住 Ctrl 再点，通常远超这个窗口。
const CTRL_CLICK_MS = 300;
function isSecondaryClick(e) {
  if (e.button === 2 || e.which === 3) return true;
  if (IS_MAC && e.button === 0 && e.ctrlKey) {
    // 没镜可开的武器（步枪/手枪/刀/投掷物）根本无处可开，别把这一枪吞掉
    if (!(WEAPON_DEFS[currentId].stats || {}).zoom) return false;
    const held = crouchDownAt >= 0 ? performance.now() - crouchDownAt : Infinity;
    return held <= CTRL_CLICK_MS;
  }
  return false;
}
document.addEventListener("mousedown", (e) => {
  // 死亡期间整体不响应：既不能开镜，也不能把 fireEnabled 置 true
  // （按住不放的话，复活那一刻全自动枪会立刻续火）。
  // 聊天打字期间同理 —— 输入框上按左键不该同时开一枪。
  if (!locked || state !== "playing" || dead || chat.isTyping()) return;
  if (isSecondaryClick(e)) {
    e.preventDefault();
    // 刀出鞘时右键 = **重击**（CS 的轻/重两档）。这一句必须问在 `cycleScope()` 之前：
    // `isSecondaryClick` 对没有 `stats.zoom` 的武器本来就返回 false，只有**真右键**
    // （`button === 2`）能走到这里，所以刀的重击不会被 Mac 那条 Ctrl+单击的判定搅进来。
    if (WEAPON_DEFS[currentId].type === "melee") { meleeAttack(true); return; }
    cycleScope();
    return;
  }
  if (e.button === 0) { fireEnabled = true; fire(); }
});
document.addEventListener("mouseup", (e) => {
  if (e.button === 0 || e.which === 1) fireEnabled = false;
});
// pointer lock 下右键仍会冒泡出右键菜单。这里不再只看 locked：
// 只要已经进了战场就挡掉，避免「锁掉了 → 菜单弹出 → 右键像没反应」。
document.addEventListener("contextmenu", (e) => {
  if (locked || state === "playing") e.preventDefault();
});
// 键盘兜底：V 也能开镜（鼠标右键万一被系统/驱动吃掉时仍有路可走）
document.addEventListener("keydown", (e) => {
  // 聊天打字时不许切镜：这一处**最容易漏** —— 它没有 dead / 面板守卫，
  // 打一句 "very good" 会顺手把 AWM 的倍镜切一档。
  if (chat.isTyping()) return;
  if (e.code !== "KeyV" || state !== "playing" || !locked) return;
  if (!(WEAPON_DEFS[currentId].stats || {}).zoom) return;
  e.preventDefault();
  cycleScope();
});

// ---------- 开始 / 结束 ----------
function gameStart() {
  state = "playing";
  kills = 0;
  enemyScore = 0;
  // 死亡中重开一局：必须连死亡计时一起清掉，否则新一局会继承上一局的倒计时
  // 而自己「复活」一次（面板残留 + 无端瞬移 + 冒出一句「已复活」）
  cancelDeath();
  // 新一局：收起输入框并清空聊天记录（与 killfeed 一起归零，免得上一局的台词串过来）。
  // clear() 还会把「冷场计时」重置成较短的 firstIdle —— 开局几秒内就会有人说话。
  chat.cancel();
  chat.clear();
  spawnAcc = 0;
  timeLeft = TDM_TIME;
  streakCount = 0;
  lastKillAt = -Infinity;
  updateStreakHud();   // 立刻收掉倒计时条（别等下一帧；新一局可以是暂停中开的）
  player.hp = 100;
  player.invuln = 0;
  player.pos.set(0, 0, bounds.hl - 6);
  actedThisLife = false;
  emptySlot.primary = false;   // 新一局恢复完整配装（同 respawnPlayer）
  emptySlot.secondary = false;
  resetLoadout();              // 上一局在地上捡的枪不进下一局（见 LOADOUT_DEFAULT）
  player.vel.set(0, 0, 0);
  player.yaw = 0;
  player.pitch = 0;
  player.viewDip = 0;
  player.stepLift = 0;
  player.groundY = 0;   // 同 respawnPlayer：动态 groundY 不清会把玩家弹回上一局的箱顶
  player.eyeH = EYE;
  // 后坐归零的**权威**是下面那个逐把枪的重置循环（清 `aimPunch`），
  // 然后由末尾的 `switchWeapon → syncRecoil()` 把派生量刷成 0。这两行只是把
  // 「重置循环跑之前」的那一帧也摆正，免得中间任何一处读到一个陈旧的抬枪角。
  recoilPitch = 0;
  recoilYaw = 0;
  camera.rotation.set(0, 0, 0);
  curFov = BASE_FOV;
  camera.fov = BASE_FOV;
  setScoped(false);
  clearFlash();
  grenadePool.forEach((g) => scene.remove(g.mesh));
  grenadePool.length = 0;
  // 地上的枪同理清空。**注意只 scene.remove**，不 dispose —— 几何/材质是目录里的
  // 共享对象（见 guncatalog.js 顶部）。grenadePool 的雷是自己 new 的材质，可以 dispose；
  // 掉落物不是。
  clearGroundItems();
  for (const c of smokes) for (const s of c.sprites) { s.visible = false; smokePool.push(s); }
  smokes.length = 0;
  killfeed.innerHTML = "";
  for (const k in owned) {
    const d = owned[k].def.stats;
    owned[k].state.mag = d.magSize ?? 0;
    owned[k].state.reserve = d.reserve ?? 0;
    owned[k].state.count = d.count ?? 0;
    owned[k].state.reloading = false;
    owned[k].state.reloadT = 0;
    resetKick(owned[k].state);
    owned[k].state.cooldown = 0;
    owned[k].state.nextFireAt = 0;
    owned[k].state.throwCd = 0;
    // CS 后坐/准星的每把枪状态一并归零（含 AWM 的拉栓）。
    owned[k].state.recoilIdx = 0;
    owned[k].state.aimPunch.x = 0;
    owned[k].state.aimPunch.y = 0;
    owned[k].state.sinceShot = 99;   // 99 = 早已停火，下一发从表头起
    owned[k].state.inaccPenalty = 0;
    owned[k].state.boltT = 0;
    owned[k].state.reScope = false;
  }
  // 新一局沿用玩家选的背包主武器（CF 也是开局带自己的背包）。
  // force=true 保证即使 currentId 已经是它，可见性与枪口火光挂载也会重做，
  // 否则第一条命的枪口火光会留在世界原点。
  switchWeapon(equippedPrimary(), true);
  // 本局的难度与敌人数：难度必须在刷人之前灌进去（Enemy.reset 会现读它定伤害/移速），
  // 敌人数必须在 initRoster() 之前定下来（名册长度 = enemyTarget）。
  applyDifficulty();
  // 旧敌人必须 release 回对象池：只清数组的话，上一局那批人的 group 还留在场景里，
  // 变成一堆不会动也不会消失的雕塑（restart 后能看到）。两个数组互不重叠。
  for (const e of enemyManager.enemies) enemyManager.release(e);
  for (const c of enemyManager.corpses) enemyManager.release(c);
  enemyManager.enemies = [];
  enemyManager.corpses = [];
  enemyManager.wave = 0;
  initRoster();
  refreshEnemyCountUi();
  showScoreboard(false);
  document.getElementById("gameover").classList.add("hidden");
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  updateHpHud();
  updateAmmoHud();
  updateScoreHud();
  updateTimerHud();
  showToast("团队竞技开始");
  sfx.roundStart();
  refillEnemies();
}

// result: "win" | "lose" | "draw"
function endTDM(result) {
  if (result === true) result = "win";
  if (result === false) result = "lose";
  if (result === "draw" && kills !== enemyScore) result = kills > enemyScore ? "win" : "lose";
  state = "over";
  // 死亡中时间到 / 比分到顶：必须掐掉死亡计时。否则 3 秒后 respawnPlayer() 照跑，
  // 会在结算画面上把玩家瞬移回出生点并弹一句「已复活」。
  cancelDeath();
  setScoped(false);
  showScoreboard(false);
  // 必须收：本函数最后一行是 document.exitPointerLock()，不先收的话输入框会卡在
  // 「open」状态而 HUD 已经隐藏（跟着失锁再收一次也行，但那时输入框已经没意义了）。
  chat.cancel();
  chat.clear();
  sfx.roundEnd(result === "win");
  const title = document.getElementById("goTitle");
  const sub = document.getElementById("goSub");
  const text = { win: "胜利", lose: "失败", draw: "平局" }[result] || "结束";
  const subs = { win: "TEAM VICTORY", lose: "TEAM DEFEATED", draw: "DRAW" }[result] || "MATCH OVER";
  if (title) { title.textContent = text; title.className = "menu-title " + result; }
  if (sub) sub.textContent = subs;
  document.getElementById("goMine").textContent = kills;
  document.getElementById("goEnemy").textContent = enemyScore;
  document.getElementById("goLimit").textContent = TDM_LIMIT;
  gameover.classList.remove("hidden");
  hud.classList.add("hidden");
  document.exitPointerLock();
}

// ---------- HUD ----------
function updateHpHud() {
  const hp = Math.max(0, player.hp);
  hpVal.textContent = Math.round(hp);
  hpVal.classList.toggle("low", hp <= 30);
  hpFill.style.width = hp + "%";
  hpFill.classList.toggle("low", hp <= 30);
}
function updateAmmoHud() {
  const def = WEAPON_DEFS[currentId];
  // 有皮肤就写「AK-47-火麒麟」（CF 的英雄级武器就是这么印在 HUD 上的），原厂只写枪名。
  // 这段判断现在收进 gunDisplayName()，与拾取/丢弃 toast、击杀信息条共用一份。
  document.getElementById("weaponName").textContent = gunDisplayName(currentId);
  const badge = document.getElementById("bpBadge");
  if (badge) badge.textContent = "背包 " + (curBp + 1);
  if (def.type === "grenade") {
    ammoVal.textContent = cur().state.count + " 颗";
    ammoVal.classList.toggle("low", cur().state.count <= 0);
    ammoFill.style.width = Math.min(100, (cur().state.count / cur().state.maxCount) * 100) + "%";
    ammoFill.classList.toggle("low", cur().state.count <= 1);
  } else if (def.type === "melee") {
    ammoVal.textContent = "-- / --";
    ammoVal.classList.remove("low");
    ammoFill.style.width = "100%";
    ammoFill.classList.remove("low");
  } else {
    ammoVal.textContent = WEAPON_STATE.mag + " / " + WEAPON_STATE.reserve;
    ammoVal.classList.toggle("low", WEAPON_STATE.mag <= 6);
    ammoFill.style.width = (WEAPON_STATE.mag / WEAPON_STATE.magSize) * 100 + "%";
    ammoFill.classList.toggle("low", WEAPON_STATE.mag <= 6);
  }
  updateScoreHud();
}
function updateScoreHud() {
  teamScoreVal.textContent = kills;
  enemyScoreVal.textContent = enemyScore;
}
function updateTimerHud() {
  const t = Math.max(0, Math.ceil(timeLeft));
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  roundTimeEl.textContent = mm + ":" + ss;
  roundTimeEl.classList.toggle("low", t <= 60);
}

// ---------- 碰撞 ----------
// 高度感知的两条规则。地图上每个碰撞体的竖直区间都是 [0, c.h]（没有一件东西是从半空
// 开始的），所以不需要真正的 AABB 求交，这两条就够 —— 关键是**读 c.h**。
// 以前 collideAt(x,z) 只比 XZ、从不读 c.h，于是人在 6m 高空横穿地上的木箱堆照样被挡住
// —— 那就是「空气墙」的本体。
//
// 挡不挡：(x,z) 落在某碰撞体的外扩矩形里，且它的顶面高过「脚底 + 一个台阶」。
// 脚底已经高过箱顶就不挡（站在箱顶上当然不该被这只箱子挡）；
// 矮于一个台阶的也不挡（0.4m 的舷侧走道是「迈上去」，不是「撞上去」）。
//
// 可选的 `y0`（底面高度）：碰撞体的竖直区间默认是 [0, h]，只有**悬空物**（天桥、
// 舱室屋顶）才需要写 y0 —— 那种东西的下方是要能走人的。少了这一条，一座 4.9m 高的
// 天桥会把桥下的整条通道堵死（碰撞模型里没有「从下面穿过去」这个概念）。
// 判据用「底面高过玩家头顶」而不是「高过脚底」：只要 y0 ≥ 脚底 + 身高，人就从底下过。
function blockedBy(x, z, feetY) {
  for (const c of colliders) {
    if (c.h <= feetY + STEP_H) continue;
    if (c.y0 !== undefined && c.y0 >= feetY + PLAYER_TOP) continue;
    if (Math.abs(x - c.x) < c.hx + PLAYER_RADIUS && Math.abs(z - c.z) < c.hz + PLAYER_RADIUS) return c;
  }
  return null;
}

// 脚底落在哪 = (x,z) 处能站上去的最高台面（箱顶 / 走道 / 舱盖），默认甲板 0。
// **不做半径外扩**：外扩的话人站在台阶旁边 0.45m 处就会被举到台上，看着是浮空。
// 只取够得着的（c.h <= 脚底 + 一个台阶）—— 2.43m 高的集装箱顶不该在当前帧接住你。
function supportAt(x, z, feetY) {
  let top = 0;
  for (const c of colliders) {
    if (c.h > feetY + STEP_H) continue;
    // 悬空物（y0 > 脚底 + 一个台阶）不可能被站在上面 —— 人在它下面，顶面够不着。
    if (c.y0 !== undefined && c.y0 > feetY + STEP_H) continue;
    if (Math.abs(x - c.x) < c.hx && Math.abs(z - c.z) < c.hz) top = Math.max(top, c.h);
  }
  return top;
}

function movePlayer(dt) {
  // 死亡视角：只保留重力与落地，一切输入都不接受 —— 但**不能整块跳过这个函数**，
  // 否则在空中被打死时尸体会挂在半空 3 秒。水平速度在这段时间里按加速度自然衰减停下。
  const canAct = !dead;
  // 前 = player.yaw（与渲染、射击同源，保证 W 始终朝准星正前方）
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const move = new THREE.Vector3();
  if (canAct) {
    if (keys["KeyW"]) move.add(fwd);
    if (keys["KeyS"]) move.sub(fwd);
    if (keys["KeyD"]) move.add(right);
    if (keys["KeyA"]) move.sub(right);
    if (move.lengthSq() > 0) move.normalize();

    player.crouching = !!keys[IS_CROUCH];
    // CF 没有冲刺键：Shift 是静步潜行（更慢，但没有脚步声）
    player.sneaking = !!keys[IS_SNEAK] && !player.crouching;
  }

  let speed = player.crouching ? CROUCH_SPEED : player.sneaking ? SNEAK_SPEED : RUN_SPEED;
  if (scoped) speed *= 0.42; // 开镜时明显拖慢

  const target = move.multiplyScalar(speed);
  // 地面加速度高、空中极低 —— 落地时不做速度归一，水平动量才能保下来，连跳才成立
  const k = Math.min(1, (player.onGround ? ACCEL_GROUND : ACCEL_AIR) * dt);
  player.vel.x += (target.x - player.vel.x) * k;
  player.vel.z += (target.z - player.vel.z) * k;

  // 跳跃缓冲 + coyote time：dt 被 clamp 到 0.05，严格同帧判定会漏掉落地帧。
  // 死亡期间连这一段也要挡住：只挡水平移动的话，尸体按空格会自己蹦起来（还带起跳音效）。
  if (canAct && keys["Space"]) player.jumpBuf = JUMP_BUFFER;
  else player.jumpBuf = Math.max(0, player.jumpBuf - dt);
  player.coyote = player.onGround ? COYOTE_TIME : Math.max(0, player.coyote - dt);

  player.vel.y -= GRAVITY * dt;
  if (canAct && player.jumpBuf > 0 && player.coyote > 0) {
    player.vel.y = JUMP_VEL;
    player.onGround = false;
    player.jumpBuf = 0;
    player.coyote = 0;
    sfx.jump();
  }

  // 分轴移动 + 碰撞（高度感知）
  // depenetration 兜底：若**当前**位置就已经在某个碰撞体里（复活点压着台阶、被挤进去），
  // 一律放行，否则玩家会被永久钉死在原地 —— 探测时会真的卡住。
  const stuck = blockedBy(player.pos.x, player.pos.z, player.pos.y);
  const nx = player.pos.x + player.vel.x * dt;
  if (stuck || !blockedBy(nx, player.pos.z, player.pos.y)) player.pos.x = nx;
  else player.vel.x = 0;

  const nz = player.pos.z + player.vel.z * dt;
  if (stuck || !blockedBy(player.pos.x, nz, player.pos.y)) player.pos.z = nz;
  else player.vel.z = 0;

  player.pos.x = Math.max(-bounds.hw, Math.min(bounds.hw, player.pos.x));
  player.pos.z = Math.max(-bounds.hl, Math.min(bounds.hl, player.pos.z));

  // 垂直 / 落地。groundY 每帧按脚下实际台面重算，不再是常量 0 ——
  // 地图特意叠了双层集装箱当架枪高点，以前永远站不上去（groundY 写死 0）。
  const prevY = player.pos.y;
  player.groundY = supportAt(player.pos.x, player.pos.z, player.pos.y);
  const vyBefore = player.vel.y;
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= player.groundY) {
    const wasAir = !player.onGround;
    player.pos.y = player.groundY;
    if (wasAir) {
      const impact = Math.min(1, Math.abs(vyBefore) / 9);
      player.viewDip = impact;     // 落地缓冲，独立于 eyeH
      sfx.land(impact);
    }
    player.vel.y = 0;
    player.onGround = true;
  } else {
    // 走出箱顶 / 走道边缘也要开始下落。以前只有起跳那一支会把 onGround 置 false，
    // 一旦 groundY 变成动态的，缺这一支就会变成「半空中漂着走」。
    player.onGround = false;
  }
  // 上台阶的视觉平滑：脚底一帧抬高 0.4m 太生硬，让相机先落后一点再追上。
  // 必须独立于 viewDip —— 那个被 Math.max(0, …) 钳过，装不下负值。
  const rise = player.pos.y - prevY;
  if (rise > 0.02) player.stepLift = Math.max(-0.5, -rise);

  // 脚步声：静步 / 空中都不出声，否则按步频触发
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && !player.sneaking && hSpeed > 1.4) {
    strideAcc += hSpeed * dt;
    if (strideAcc >= 2.7) { strideAcc = 0; sfx.footstep(); }
  } else if (!player.onGround) {
    strideAcc = 2.5; // 落地后尽快踏出第一步
  }
}

// ---------- 武器视模动画 ----------
// 开火冲击：不用「衰减振荡」包络，改用**临界阻尼弹簧**。
//   · 旧的 exp(-rate·t)·sin(freq·t) 会穿过静止位再弹回来（欠阻尼），枪看着像橡皮筋；
//     而且横向那一路写成 `kickSeed*0.6 + ek*0.4`，前半截是个**常量**偏移——
//     AK 每 0.082s 重抽一次种子，枪就每秒瞬跳 12 次新角度，即所谓「发抖」。
//   · 临界阻尼峰值在 t=1/rate 处到达、**永不过冲**，且多个冲量天然叠加
//     → 连发时枪口稳定累积上抬，这才是 CF 的全自动手感。
// rate = 1/峰值时间。表里填的就是实际最大位移/转角（冲量按 amp·rate·e 反推）。
// 视模后坐幅值 **取自 CS 的 `kick{back, up, roll, yaw}`**（`WeaponDefs.js`），
// 但**阻尼比仍是我们自己的临界阻尼**。CS 用 zeta 0.8 的欠阻尼弹簧（ω 46 rad/s、峰值在 23ms），
// 而 AGENTS.md 记着那条路会「穿过静止位再弹回来、像橡皮筋」—— 那是本项目**已经修掉**的 bug，
// 不请回来。所以只取幅值、配我们的解析解（峰值恒等于表里填的数、出现在 1/rate 秒）。
//   · CS 的角度是度，这里是弧度：AK up 2.2° = 0.0384 / roll 0.6° = 0.0105 / yaw 0.4° = 0.0070；
//     AWP up 2.6° = 0.0454 / roll 1.2° = 0.0209 / yaw 0.6° = 0.0105。`back` 本身就是米，照抄。
//   · `up`（额外的**位移**抬升）CS 没有对应的量，按本表 back:up 的既有比例（约 2.8:1）折出来。
//   · `rate` 保留我们的值 —— CS 的 23ms 峰值在 60fps 下不足两帧，看不到。1/rate 才是峰值时刻。
//   · 手枪按步枪的形状等比（CS 那边没有手枪的 kick 表）；刀与投掷物不动（CS 无对应数据）。
const KICK = {
  rifle:   { rate: 16, back: 0.025, up: 0.009, pitch: 0.038, roll: 0.011, yaw: 0.007 },
  sniper:  { rate: 8,  back: 0.048, up: 0.018, pitch: 0.045, roll: 0.021, yaw: 0.011 },
  pistol:  { rate: 18, back: 0.022, up: 0.008, pitch: 0.042, roll: 0.011, yaw: 0.007 },
  melee:   { rate: 6,  back: 0.030, up: 0.012, pitch: 0.320, roll: 0.180, yaw: 0.080 },
  grenade: { rate: 12, back: 0.030, up: 0.014, pitch: 0.090, roll: 0.038, yaw: 0.018 },
};
const KICK_AXES = ["back", "up", "pitch", "roll", "yaw"];
// 每个轴一份状态：p=当前位移，v=速度，amp=该轴单发峰值（用来定连发上限）。
function makeKickSpring() {
  const s = {};
  for (const a of KICK_AXES) s[a] = { p: 0, v: 0, amp: 0 };
  return s;
}
function resetKick(st) {
  if (!st || !st.ks) return;
  for (const a of KICK_AXES) { const k = st.ks[a]; k.p = 0; k.v = 0; }
}
// 开火时调用：给各轴一个冲量。seed 只在 -1..1 间选横向方向，不参与其它轴。
function triggerKick(id, seed) {
  const st = owned[id] && owned[id].state;
  if (!st || !st.ks) return;
  const kk = KICK[WEAPON_DEFS[id].type] || KICK.rifle;
  const s = seed == null ? Math.random() * 2 - 1 : seed;
  const imp = (amp) => amp * kk.rate * Math.E; // 峰值 = v0/(rate·e)
  const add = (key, amp, dir) => { const a = st.ks[key]; a.amp = amp; a.v += imp(amp) * dir; };
  add("back", kk.back, 1);
  add("up", kk.up, 1);
  add("pitch", kk.pitch, 1);
  add("roll", kk.roll, s);
  add("yaw", kk.yaw, s);
}

let bobT = 0;
function animateWeapon(dt) {
  const c = cur();
  const def = WEAPON_DEFS[currentId];
  // 发光呼吸必须在开镜早退**之前**推进，否则端着 AWM 一开镜，极光/黄金的呼吸就停了
  // —— 开镜时枪模虽然被藏起来，但退镜那一刻的亮度会卡在半路上，看着像坏了。
  updateSkinGlow();
  // 开镜 / 阵亡都不显示枪模。火光跟着一起收：Sprite 挂在武器组上，组虽然隐藏了，
  // 但 muzzleT 会停在半路（这个早退不推进它），退镜/复活时会补闪一下。
  if (scoped || dead) {
    c.group.visible = false;
    muzzleT = Infinity;
    updateMuzzleFlash(0);
    return;
  }
  c.group.visible = true;

  // 后坐各轴：临界阻尼弹簧的**解析解**，随 dt 步进 ——
  //   x(t) = (p + (v + r·p)·t)·e^(-r·t),  v(t) = (v - r·(v + r·p)·t)·e^(-r·t)
  // 必须用解析解而不是显式欧拉：欧拉的阻尼项在 2·r·dt > 1 时会把速度一步推成负的，
  // r=16 时 dt>31ms（即 30fps 以下）后坐直接归零、dt=0.05 时甚至爆到 2.76。
  // 解析解与帧率完全无关（已用 144/60/30/20fps 逐档核对：峰值恒等于表里的值）。
  const st = WEAPON_STATE;
  const kk = KICK[def.type] || KICK.rifle;
  const spring = (a) => {
    const r = kk.rate;
    const B = a.v + r * a.p;
    const e = Math.exp(-r * dt);
    a.p = (a.p + B * dt) * e;
    a.v = (a.v - r * B * dt) * e;
    // 连发时冲量会一直叠加，给个上限，免得长按扫射把枪折进肩膀里
    const cap = a.amp * 1.7;
    if (a.p > cap) { a.p = cap; a.v = 0; }
    else if (a.p < -cap) { a.p = -cap; a.v = 0; }
    if (Math.abs(a.p) < 1e-5 && Math.abs(a.v) < 1e-5) { a.p = 0; a.v = 0; }
    return a.p;
  };
  const ekBack = spring(st.ks.back);
  const ekUp = spring(st.ks.up);
  const ekPitch = spring(st.ks.pitch);
  const ekRoll = spring(st.ks.roll);
  const ekYaw = spring(st.ks.yaw);

  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  const moving = hSpeed > 0.6 && player.onGround;
  // 静步 / 下蹲的摆动明显更小，奔跑时最大
  const rate = moving ? (player.crouching || player.sneaking ? 6 : hSpeed > 5.6 ? 12 : 8) : 0;
  const amp = player.crouching || player.sneaking ? 0.55 : hSpeed > 5.6 ? 1.3 : 1;
  bobT += dt * rate;
  const m = moving ? amp : 0;
  const bobX = Math.sin(bobT * 2) * 0.013 * m;
  const bobY = Math.sin(bobT) * 0.013 * m;

  // 位移：+z 是朝玩家（后坐把枪推向肩膀），+y 向上
  const kBack = ekBack;
  const kUp = ekUp;
  // 旋转：抬枪口 + 左右甩/翻滚。横向的两个弹簧已把方向折进位移里，直接取用即可。
  const kPitch = ekPitch;
  const kYaw = ekYaw;
  const kRoll = ekRoll;

  let rDip = 0, rRot = 0, rRoll = 0, rYaw = 0;
  let reloading = false, reloadP = 0;
  // reloadHoldP 是给调试用的「定格」：非 null 时换弹时间线**不读 reloadT**，直接用它。
  // 为什么需要它：暂停 RAF 之后切姿势是不会重绘的（pause 只停循环），而恢复循环又会让
  // reloadT 继续往前走 —— 想把某一张截图停在第 40% 相位根本做不到（实测被坑过一轮，
  // 一叠"换弹相位图"其实全是静止位）。有了这个变量，循环照常跑、姿势却钉死。
  if ((WEAPON_STATE.reloading || reloadHoldP !== null) && WEAPON_STATE.reloadDur > 0) {
    reloading = true;
    // 时间边界与 viewarms.js 的换弹关键帧同源：0–16% 沉下去，76–100% 抬回来，
    // 中间 60% 枪身**保持低位不动**（那段时间手正在取弹匣/插入/拍实）。
    // 旧写法是 0–40% 下沉、55–100% 抬起 —— 枪会在手臂刚下探时就急着抬回来，
    // 两边不同步，看着像「枪在换弹、手在忙别的」。
    const p = reloadP = reloadHoldP !== null
      ? reloadHoldP
      : Math.min(WEAPON_STATE.reloadT / WEAPON_STATE.reloadDur, 1);
    const ease = (t) => t * t * (3 - 2 * t);
    const out = p < 0.16 ? ease(p / 0.16) : 1;
    const back = p >= 0.76 ? ease((p - 0.76) / 0.24) : 0;
    const phase = out - back;
    rDip = phase; rRot = phase; rRoll = phase; rYaw = phase * 0.22;
  }

  // 静止位。**这几个数不是纯审美，是「手必须进画面」反推出来的**：
  // 手心的屏幕高度 ≈ 464.6 · (y/(-z))（75° FOV、713px 高），所以握把越靠下、越靠近相机，
  // 手就越容易掉出屏幕下缘。原来 by = -0.28 时扣扳机那只手落在 NDC y ≈ -1.25（屏幕外 90px），
  // 无论手臂怎么做都看不见 —— 用户抱怨的「枪凭空浮在右下角」正是这个几何事实。
  // 现在按各武器的握把实测位置（见 viewarms.js 的锚点表）分别定：步枪保持在右下、
  // 手枪握把更靠后所以**推远一点**（-0.5 → -0.56，手才落回画面内）、投掷物抬高拿在身前。
  let bx, by, bz;
  if (def.type === "melee") { bx = 0.34; by = -0.15; bz = -0.42; }
  else if (def.type === "grenade") { bx = 0.26; by = -0.14; bz = -0.52; }
  else if (def.type === "pistol") { bx = 0.40; by = -0.19; bz = -0.72; }
  else { bx = 0.32; by = -0.17; bz = -0.5; }

  // 换弹时的枪身位移：**往上抬、不往下沉**。
  // 这条是投影几何逼出来的，不是手感取舍 —— 弹匣井在枪局部 y=-0.155（枪身最下缘），
  // 相机投影是 px_y = 356.5 + 464.6·(y/(-z))，两个方向都在把它往画面外推：
  // 往下沉 y 更负、往近处拉 -z 更小，**都会放大偏移**。静止位算下来弹匣井就已经在
  // px_y≈671（画面高 713），再沉 0.13 直接掉到 872 —— 整段「插弹匣」全在屏幕外，
  // 玩家只看到枪沉下去、手消失、枪又回来。抬起来才是唯一能让这个动作入画的解法。
  // 原来的 -0.85rad(49°) 俯仰同理收到 -0.22，否则枪口甩出画面、弹匣井翻转朝后。
  c.group.position.set(
    bx + bobX,
    by + bobY + kUp + rDip * 0.09,
    bz + kBack + rDip * 0.05
  );
  c.group.rotation.set(
    kPitch - rRot * 0.22,
    bobX * 0.5 + kYaw - rYaw,
    bobX + kRoll + rRoll * 0.30
  );

  // 组矩阵先算好：手臂与枪口光都要用它。
  // 用 `matrix` 而不是 `matrixWorld` —— 后者要等 vmScene 更新过矩阵才有意义，而这一行跑在 render 之前。
  // vmCamera 是单位变换，所以组局部坐标 == 相机局部坐标，`matrix` 就是 局部→相机 的映射。
  c.group.updateMatrix();

  // 手臂：右腕永远在握把锚点上，左腕由换弹时间线驱动。**必须在组变换写完之后**再更新，
  // 否则手臂会差一帧（组已经动过、手还停在上一帧的位置）。
  // 传进组矩阵的逆：换弹时组会沉 0.22m、俯仰 -0.85rad，腰袋那个点得反向抵消掉这组变换，
  // 屏幕位置才钉得住（否则整段下探被甩到画面外，见 viewarms.js 里 POUCH 的注释）。
  _invGroup.copy(c.group.matrix).invert();
  viewArms.update(reloading, reloadP, _invGroup);
  _muzzleLocal.copy(c.muzzleLocal).applyMatrix4(c.group.matrix);
  muzzleLight.position.copy(_muzzleLocal);

  // 枪口焰的涨消。放在最后：它不改枪/手的位姿，但要用本帧的 dt。
  updateMuzzleFlash(dt);
}
const _muzzleLocal = new THREE.Vector3();
const _invGroup = new THREE.Matrix4(); // 武器组矩阵的逆（相机空间 → 组局部），换弹时手臂用

// 换弹姿势定格（调试用，见 __tactical.poseReload）
let reloadHoldP = null;

// ---------- 主循环 ----------
function update(dt, rawDt) {
  time += dt;
  if (mapData && mapData.update) mapData.update(time, dt); // 海浪顶点动画 + 水面滚动
  updateSmokes(dt);
  updateFlash(dt);
  updatePool(dt);
  sfx.updateListener(player.pos, player.yaw);
  // 聊天：行寿命 / 限流冷却 / 应答延迟 / 冷场计时全部由 dt 推进（绝不用 setTimeout 或
  // CSS 动画 —— 那样跟不上 __tactical.pause()，也没法在无头测试里定步长快进）。
  // 放在下面那行 `state !== "playing"` 的 return **之前**：结算画面上已有的行也能淡完。
  chat.update(dt);
  // 连杀窗口过期就把计数归零。**单靠 onKill 里那次过期判定是不够的**：那条只在「下一次
  // 击杀」时才跑，中间这 4 秒里 `streak()` 读口会一直报一个早就该没了的数（调试和测试都
  // 会被它骗）。两条判定用的是同一个比较，不会互相打架。
  if (streakCount > 0 && time - lastKillAt > STREAK_WINDOW) streakCount = 0;
  // 连杀窗口倒计时条（每帧写 width，同死亡面板那条）。放在 `state !== "playing"` 的
  // return **之前**：结算的一瞬间它也得立刻收掉，而不是停在最后一帧。
  updateStreakHud();

  if (state !== "playing") return;

  // 回合计时：时间到按比分判胜负
  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    updateTimerHud();
    endTDM(kills === enemyScore ? "draw" : kills > enemyScore ? "win" : "lose");
    return;
  }
  if (Math.ceil(timeLeft * 1) % 1 === 0) updateTimerHud();

  // 后坐恢复（CS 模型：`punchHold` 之后 exp+lin 衰减，`recoilReset` 之后弹道表索引归零）。
  // **逐把枪推进**，不只手上这把 —— 理由见 decayPunch 的注释。
  // `syncRecoil()` 在 decayPunch 末尾调，所以相机与射线的偏移是这一帧刚算出来的。
  decayPunch(dt);
  updateBolt(dt);

  // 死亡视角：按**墙上时钟**推进（不用 setTimeout，才能跟着 __tactical.pause() 一起冻结）。
  // 到点才真正复活 —— 原地不动地站满这 3 秒，正是「看自己怎么死的」那段时间。
  // 必须用 rawDt 而不是 dt：dt 被 clamp 到 0.05，低帧率下 3 秒会拉长成
  // 「20fps → 3 秒变 6 秒、软渲染 1.6fps → 37 秒」，看起来就是死机卡住（实测踩到）。
  // 上限 1 秒只是防标签页切回来时 rawDt 是个巨大的数、一帧就把死亡跳过。
  const ddt = Math.min(1, Number.isFinite(rawDt) && rawDt > 0 ? rawDt : dt);
  if (dead) {
    deathT -= ddt;
    stepDeathCam(ddt);
    updateDeathBar(1 - Math.max(0, deathT) / DEATH_DELAY);
    if (deathT <= 0) {
      // 复活过程一旦抛异常，必须在这里兜住：update() 走不完 → renderer.render 永不执行
      // → 画面彻底冻住，而且 dead 永远为 true，下一帧再抛一次，永远出不来。
      // 这层兜底保证「无论复活里坏成什么样，死亡态一定会解除」。
      try {
        respawnPlayer();
      } catch (err) {
        console.error("[复活失败]", err);
        cancelDeath();
      }
    }
  }

  // 开镜 FOV 插值（只改 fov 与灵敏度，射线方向仍由 pitch/yaw 决定，准星所指必中）
  const targetFov = scopeStage === 2 ? SCOPE_FOV2 : scoped ? SCOPE_FOV : BASE_FOV;
  curFov += (targetFov - curFov) * Math.min(1, 12 * dt);
  camera.fov = curFov;

  camera.rotation.order = "YXZ";
  // 死亡视角的偏移和 recoilPitch/recoilYaw 一样，只叠在相机这一行，不写回 player.pitch/yaw
  camera.rotation.x = player.pitch + recoilPitch + deathCam.pitchOff;
  camera.rotation.y = player.yaw + recoilYaw + deathCam.yawOff;
  // 开镜时轻微呼吸晃动（只作用在 roll，不污染瞄准数据源）
  camera.rotation.z = scoped ? Math.sin(time * 1.6) * 0.006 : 0;

  movePlayer(dt);
  player.viewDip = Math.max(0, player.viewDip - dt * 5.5);
  // 上台阶的滞后同样向 0 收（从负值往上爬）。约 0.17s 追上，够看出「迈上去」但不拖沓。
  player.stepLift = Math.min(0, player.stepLift + dt * 2.6);

  // 只有全自动武器按住才连发；AWM / USP 这类半自动必须重新扣扳机（CF 同此）。
  // `!chat.isTyping()` 是唯一一条**不经鼠标事件**的开火路径的闸门：mousedown 已经挡了，
  // 但 fireEnabled 若在开输入之前就被置位，这里不挡就会一边打字一边突突。
  if (fireEnabled && WEAPON_DEFS[currentId].fullAuto && !WEAPON_STATE.reloading && !dead && !chat.isTyping()) fire();
  if (player.invuln > 0) player.invuln -= dt;
  if (WEAPON_STATE.cooldown > 0) WEAPON_STATE.cooldown -= dt;
  if (WEAPON_STATE.throwCd > 0) WEAPON_STATE.throwCd -= dt;
  updateReload(dt);
  updateGrenades(dt);
  // 地面掉落物：自转 + 起伏 + 拾取判定。这里**必须显式挡死亡** ——
  // update() 的死亡分支是往下穿透的（不会提前 return），不挡的话尸体飘过去也能捡枪。
  updateGroundItems(dt);

  // 准星张开：口径见 crosshairGap()。**这一行只写 CSS 变量，子弹与它无关** ——
  // 决定 4 的落点就在这（CS 的散布锥不作用于子弹，我们的准星因此永远说真话）。
  cross.style.setProperty("--gap", crosshairGap().toFixed(1) + "px");

  // 战绩面板开着的时候每 0.2s 刷一次（按住 Tab 期间别人还在打）
  sbAcc += dt;
  if (sbAcc >= 0.2) { sbAcc = 0; renderScoreboard(); }

  // 背包面板同理，但只刷**提示行**：那两道闸门会随走位与开火自己变（走出安全区 /
  // 打一枪都会改），不刷新的话提示会停在「打开面板那一刻」，告诉玩家一件已经不能做的事。
  bpAcc += dt;
  if (bpAcc >= 0.25) { bpAcc = 0; if (backpackOpen()) updateBpHint(); }

  spawnAcc += dt;
  if (spawnAcc >= TDM_SPAWN_INTERVAL) { spawnAcc = 0; refillEnemies(); }

  enemyManager.update(dt, player, colliders);
  enemiesShoot();
}

let lastT = performance.now();
let rid = 0;
let frameCount = 0;
// 调试暂停闸门（`__tactical.pause()` / `resume()`）。**必须是显式布尔量，不能只靠
// `cancelAnimationFrame(rid)`** —— `loop()` 的第一行就是 `rid = requestAnimationFrame(loop)`，
// 于是「已经派发到任务队列里的那一帧」在 `pause()` 之后照样会跑，并且**把链子重新接上**，
// 主循环就此复活。实测：pause() 之后 `frames()` 仍在慢慢涨，定步长快进的用例里混进一帧
// 真实 dt 的衰减，后坐轨迹差出 10% —— 而 `resume()` 在循环已经在跑时又会接出**第二条**链
// （每帧 update 两遍）。这个闸门把两个方向都关死：pause 之后连排队的那一帧也不续链，
// resume 只在真的停着时才起步（幂等）。
let loopPaused = false;
// 视模通道真正画了几遍。**不能用 frameCount 或绘制调用数代替**：frameCount 在 loop 的
// 第一行就自增（哪怕后面每帧都抛异常它也照涨），绘制调用数则被世界通道撑满 ——
// 只有这个计数能证明「第二遍渲染确实在跑」（见 AGENTS.md 里「判卡死要看绘制」那条）。
let vmFrames = 0;
function loop(now) {
  // 必须在这两行**之前**：`pause()` 之后若有已经派发的帧跑进来，这一句拦住它、
  // 不让 `rid` 被重新赋值，链子才算真的断掉。
  if (loopPaused) return;
  rid = requestAnimationFrame(loop);
  frameCount++;
  // rawDt = 真实帧间隔；dt 被 clamp 到 0.05 是给物理/碰撞用的（低帧率下单帧位移不失控）。
  // 纯计时（死亡停顿与死亡镜头）必须用 rawDt —— 详情见 update() 里那段注释。
  const rawDt = (now - lastT) / 1000;
  const dt = Math.min(0.05, rawDt);
  lastT = now;
  // 眼高只由蹲伏驱动；落地缓冲走独立的 viewDip，两者互不干扰
  // 眼高只由蹲伏驱动；落地缓冲走独立的 viewDip、上台阶滞后走 stepLift，三者互不干扰
  const targetEye = player.crouching ? CROUCH_EYE : EYE;
  player.eyeH += (targetEye - player.eyeH) * Math.min(1, 22 * dt);
  camera.position.set(
    player.pos.x,
    player.pos.y + player.eyeH - player.viewDip * 0.11 + player.stepLift,
    player.pos.z
  );
  // update() / animateWeapon() 里的任何异常都只损失这一帧的逻辑，绝不能连累
  // renderer.render —— 少了它，画布会**永久**停在最后一帧，看起来就是死机，
  // 而且没有任何可见提示（用户实测踩到过：音频的字段名撞车在死亡路径上抛异常）。
  try {
    update(dt, rawDt);
    animateWeapon(dt);
  } catch (err) {
    noteLoopError(err, "主循环");
  }
  // 渲染段也必须进 try。视模通道是每帧都跑的新代码路径，它一旦抛异常而这里没兜住，
  // `renderer.render` 会整个断掉（画布永久停在最后一帧），而它又**在 try 之外** ——
  // window.onerror 之外唯一能看见它的地方就是 loopErrors，测试契约恰恰断言
  // `loopErrors() === 0`：异常直接冒出去反而「看起来零报错」，是最难查的假绿。
  try {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    // 视模相机只跟长宽比、**不跟 FOV**：开镜时相机的 fov 会掉到 22 / 11，
    // 视模若跟着缩，枪和手会被放大到糊满屏幕（镜筒里的枪是另一套 overlay，不靠视模）。
    vmCamera.aspect = camera.aspect;
    vmCamera.updateProjectionMatrix();
    syncVmLighting();
    // 显式清屏：renderer.autoClear 已关，而纹理背景走的是 boxMesh 路径
    // （depthWrite:false），它只重绘颜色、**不清深度**。不显式清，上一帧的深度会
    // 把这一帧挡住，画面看起来是凝固的。
    renderer.clear();
    renderer.render(scene, camera);
    // 清深度但**不清颜色**：视模从此在「深度归零」的画布上重画一遍，
    // 于是枪和手永远压在世界之上 —— 这就是防穿墙的全部机制。
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);
    vmFrames++;
  } catch (err) {
    noteLoopError(err, "渲染");
  }
}

// 视模的光照必须跟世界同步，否则会出现「枪亮着、甲板是阴的」这种一眼假的画面。
// 两个**原地突变**的坑都在下面标注 —— 它们都不会报错，只会让世界静默变化。
const _sunDir = new THREE.Vector3();
const _qc = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
function syncVmLighting() {
  // 取世界太阳的方向。**绝不能写 sun.position.normalize()** —— 那是原地改世界光源的
  // 位置，会把它从 (-34,78,30) 缩成一个单位向量，影子相机的 near/far 随即不再框住
  // 场景，影子会**静默消失**（不报错、只是地上没有影子了）。
  _sunDir.copy(sun.position).sub(sun.target.position).normalize();
  // 转到相机局部。**同样不能写 camera.quaternion.invert()** —— 那是原地改相机本身，
  // 每帧翻一次，画面会抖成一片。
  _sunDir.applyQuaternion(_qc.copy(camera.quaternion).invert());
  vmSun.position.copy(_sunDir.multiplyScalar(50));
  // 半球光的天地方向也得跟着世界走，否则「从天上来」会变成「从屏幕上方来」。
  // _up 每帧都要 set 回去 —— applyQuaternion 是原地变换，不重置的话它会被逐帧旋转。
  vmHemi.position.copy(_up.set(0, 1, 0).applyQuaternion(_qc));
}

// ---------- 初始化 ----------
async function init() {
  buildMenuMatch();
  // 敌人数量步进器（菜单里没有指针锁定，这是**唯一**能点选的地方）。
  // 直接改 enemyTarget —— 菜单与对局共用一个数据源，所以对局里 +/- 的结果
  // 回到菜单也看得到，反之亦然。
  const minus = document.getElementById("enemyMinus");
  const plus = document.getElementById("enemyPlus");
  if (minus) minus.onclick = () => { setEnemyTarget(enemyTarget - 1); buildMenuMatch(); };
  if (plus) plus.onclick = () => { setEnemyTarget(enemyTarget + 1); buildMenuMatch(); };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  vmCamera.aspect = camera.aspect;
  vmCamera.updateProjectionMatrix();

  // 天空贴图由 map.js 生成并同时用作 background / environment
  mapData = await buildMap(scene);
  colliders = mapData.colliders;
  obstacleMeshes = mapData.obstacles;
  obstacleFlat = [];
  for (const o of obstacleMeshes) {
    if (o.isMesh) obstacleFlat.push(o);
    else o.traverse((m) => { if (m.isMesh) obstacleFlat.push(m); });
  }
  bounds = mapData.bounds;
  // 视模场景自己不带 background（那会在视模通道里铺一张全屏天空，把世界整个抹掉），
  // 但**环境贴图必须共用** —— AWM 金皮(metalness 0.78)、匕首金皮(0.85) 这类高金属度
  // 表面的着色基本全靠 IBL，漏了这句它们会渲成两块黑铁，而且不报任何错。
  vmScene.environment = scene.environment;
  limitVal.textContent = TDM_LIMIT;
  document.getElementById("goLimit").textContent = TDM_LIMIT;

  await Promise.all([
    loadAK(),
    loadWeapon(WEAPON_DEFS.pistol),
    loadWeapon(WEAPON_DEFS.knife),
    loadWeapon(WEAPON_DEFS.frag),
    loadWeapon(WEAPON_DEFS.flash),
    loadWeapon(WEAPON_DEFS.smoke),
    // 双手（CS 的 HandR/ArmR/HandL/ArmL，见 viewarms.js）。**必须在第一帧之前就位** ——
    // 晚一步，开局那一帧就是「枪浮在空中、手还没长出来」。失败不 reject（resolve(false)）。
    loadHands(),
  ]);
  // 手臂加载失败是**明确降级**（枪照常、只是没有手），所以必须让玩家看见，
  // 不能像别的失败路径那样静默 —— 那会变成「画面里手没了，控制台之外无提示」。
  if (!handsOk) showToast("手臂模型加载失败，已降级为无手（枪械照常）", true);
  // 世界模型目录（敌人手持 + 地面掉落）。**必须在全部武器加载完之后** ——
  // 它从玩家这几把枪派生「枪型 × 皮肤」的全部变体。建目录这一步不存在异步，
  // 几毫秒的事（就是一批 clone + 上漆）。
  // **必须显式喂 `baseGun`**：`gun` 是「当前挂着的模型」，而模型皮肤是高精度模型，
  // 拿它建目录会把敌人手里的枪也换成模型（与「仅玩家用模型」的约定相反），
  // 而且背包 2 的默认皮肤恰好就是模型皮肤（雷神），开局那一刻 `gun` 随时可能是它。
  buildGunCatalog({
    ak: owned.ak && owned.ak.baseGun,
    m4: owned.m4 && owned.m4.baseGun,
    awm: owned.awm && owned.awm.baseGun,
    pistol: owned.pistol && owned.pistol.baseGun,
  });
  // 敌人**每次刷出**都抽一份配装：型号先等概率抽，再在该型号的皮肤列表里等概率抽一款。
  // **模型皮肤也在这个池子里** —— 但目录里产出的永远是「基础低模 + 材质上漆」，
  // 换模型只发生在玩家这边（见 `mountGunModel`）。所以模型皮肤必须自带 `slots`，
  // 否则敌人在抽到它时会拿到一把没上漆的原厂枪。组合数见 guncatalog.js 的注释。
  // 挂在 picker 上而不是一次性发下去：敌人是对象池复用的，acquire() 每次都调它
  // （见 enemies.js），所以池里捞出来的旧敌人也会换上新枪。
  enemyManager.loadoutPicker = () => {
    const r = randomGunRoll();
    const d = WEAPON_DEFS[r.id];
    return {
      rifle: enemyModel(r.id, r.skin),
      gunId: r.id,
      gunSkin: r.skin,
      weaponName: gunDisplayName(r.id, r.skin),
      // 只影响点射节奏，不动伤害 —— 「AK 三枪死」那条数值不受影响
      fireMul: (d && d.enemyFireMul) || 1,
    };
  };
  WEAPON_STATE = owned.ak.state;
  owned.ak.group.visible = true;
  attachMuzzleTo("ak"); // 首帧就要挂好，否则第一条命的枪口火光在世界原点
  viewArms.attach(owned.ak.group, "ak"); // 首帧就得有手，不能等第一次切枪
  gameReady = true;
  requestAnimationFrame(loop);

  if (new URLSearchParams(location.search).has("debug")) {
    window.__tactical = {
      chat, enemyManager, player, fire, WEAPON_STATE, camera, obstacleMeshes, THREE, scene,
      renderer, owned, cur, WEAPON_DEFS, smokes, grenadePool,
      ready: () => gameReady,
      curId: () => currentId,
      // 改动地图后核对「有没有两件东西占同一块地方」用的拍平列表 —— obstacles 是
      // Mesh 与 Group 混装（见 obstacleFlat 那条注释），直接给外面的必须是拍平后的。
      obstacles: () => obstacleFlat,
      switchWeapon, quickSwitch, switchToPrimary, switchNade, setScoped,
      switchBackpack, BACKPACKS,
      backpackState: () => ({
        curBp,
        canSwap: canSwapBackpack(),
        inSpawn: inSpawnZone(),
        acted: actedThisLife,
        list: BACKPACKS.map((b) => b.primary),
        skins: BACKPACKS.map((b) => b.skin),
        gear: { ...GEAR_SKIN },
      }),
      setActed: (v) => { actedThisLife = !!v; },
      // ---- 皮肤 ----
      skinsFor, findSkin, skinLabel, GEAR_SKIN,
      skinState: () => ({
        cur: activeSkinId(currentId),
        bp: BACKPACKS.map((b) => b.skin),
        gear: { ...GEAR_SKIN },
        glow: (owned[currentId].glowMats || []).map((g) => g.mat.emissiveIntensity),
        muzzle: { sprite: muzzleShot.material.color.getHex(), light: muzzleLight.color.getHex() },
        name: document.getElementById("weaponName").textContent,
      }),
      setSkin: (weaponId, skinId) => {
        // 测试与调试入口：直接改配装再刷漆。
        // **注意它不写 LOADOUT_DEFAULT**（与面板里的 selectSkin 不同）—— 这是刻意的：
        // 这样「先 beginGame() 再 setSkin()」的既有测试写法才不会被 resetLoadout 的语义搅乱。
        const bpIdx = BACKPACKS.findIndex((b) => b.primary === weaponId);
        if (bpIdx >= 0) BACKPACKS[bpIdx].skin = skinId;
        else GEAR_SKIN[weaponId] = skinId;
        if (currentId === weaponId) {
          // 顺序与 switchWeapon 里完全一致：先定模型，再挂枪口火光/手臂锚点，最后上漆。
          // 模型皮肤要懒加载，这里立刻返回 baseGun —— 加载完成后由 mountGunModel 内部再刷一遍。
          mountGunModel(weaponId, skinId);
          attachMuzzleTo(weaponId);
          viewArms.configure(armAnchorKey(weaponId));
          applySkinTo(weaponId, skinId);
        }
        return activeSkinId(weaponId);
      },
      // ---- 模型皮肤 ----
      // 全部「模型皮肤」的清单。测试用它断言「目录里绝不该出现这些模型」。
      modelSkins: () =>
        allModelSkins().map((m) => ({
          weaponId: m.weaponId,
          skinId: m.skinId,
          file: m.model.file,
          anchorKey: m.model.anchorKey,
          targetLen: m.model.targetLen,
        })),
      // 当前武器这一刻的模型状态：挂的是基础低模还是模型、模型就绪与否、有没有在飞。
      modelState: (weaponId) => {
        const id = weaponId || currentId;
        const e = owned[id];
        if (!e) return null;
        const skinId = activeSkinId(id);
        return {
          id,
          skin: skinId,
          wants: !!modelOf(id, skinId),
          mounted: e.gun === e.baseGun ? "base" : "model",
          loading: !!(skinId && e.modelLoads[skinId]),
          ready: !!(skinId && e.models[skinId]),
          anchorKey: armAnchorKey(id),
          muzzleLocal: e.muzzleLocal.toArray(),
        };
      },
      // 居中残差：模型（或基础枪）包围盒中心的模长。**必须 ≤1e-3** ——
      // 大于这个量级说明 fitGunModel 的「先转再居中」顺序被写反了。
      // 这个值是 fitGunModel 在模型还没被 add 进父节点时量好存在 userData 上的，
      // 不能现量：挂上去之后量到的是叠了握持位（bx/by/bz）的世界坐标。
      modelResidual: (weaponId) => {
        const e = owned[weaponId || currentId];
        if (!e || !e.gun.userData.fitCenter) return null;
        const c = e.gun.userData.fitCenter;
        return Math.hypot(c[0], c[1], c[2]);
      },
      skinCycle: (dir) => cycleSkin(dir >= 0 ? 1 : -1),
      selectSkin: (skinId) => selectSkin(skinId),
      backpackOpen,
      // 挂载诊断：一次给全「模型在武器组局部系里的包围盒 + 有效可见性 + 枪口火光挂在谁身上」。
      // 全是可 JSON 序列化的纯数据（Object3D 过不了 CDP 的 returnByValue）。
      gunDebug: (weaponId) => {
        const id = weaponId || currentId;
        const e = owned[id];
        if (!e) return null;
        // 局部包围盒：先量世界盒，再用组矩阵的逆把八个角搬回组局部。
        // 组的变换是「平移 + 旋转」（无缩放），回转能精确还原八个角，所以盒子是紧的。
        // 不能直接用 setFromObject —— 那给的是叠了握持位（bx/by/bz）之后的世界坐标。
        e.group.updateWorldMatrix(true, true);
        const wb = new THREE.Box3().setFromObject(e.gun);
        const inv = e.group.matrixWorld.clone().invert();
        const lb = new THREE.Box3();
        const v = new THREE.Vector3();
        for (let i = 0; i < 8; i++) {
          v.set(
            i & 1 ? wb.max.x : wb.min.x,
            i & 2 ? wb.max.y : wb.min.y,
            i & 4 ? wb.max.z : wb.min.z
          ).applyMatrix4(inv);
          lb.expandByPoint(v);
        }
        // 有效可见性：从每个网格沿 parent 链走到根，任何一层 invisible 都算看不见
        // （只看根自己的 visible 会误报 —— 开镜藏的是组，根还是 true）。
        let meshes = 0, visibleMeshes = 0;
        e.gun.traverse((o) => {
          if (!o.isMesh) return;
          meshes++;
          let vis = true;
          for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
          if (vis) visibleMeshes++;
        });
        return {
          id,
          skin: activeSkinId(id),
          mounted: e.gun === e.baseGun ? "base" : "model",
          min: lb.min.toArray(),
          max: lb.max.toArray(),
          size: lb.getSize(new THREE.Vector3()).toArray(),
          meshes,
          visibleMeshes,
          // 枪口火光（单例搬运工）此刻挂在谁的组上
          muzzleParent: muzzleShot.parent === e.group ? id : muzzleShot.parent ? "other" : "none",
          muzzleLocal: e.muzzleLocal.toArray(),
        };
      },
      meshMats: (weaponId) => {
        // 逐网格导出材质快照，供断言「哪个部位被刷成了什么颜色」
        const out = [];
        const e = owned[weaponId || currentId];
        if (!e) return out;
        e.group.traverse((o) => {
          // 手臂是武器组的子节点，必须滤掉 —— 否则它们会混进材质快照，
          // 皮肤测试的「条数 / 下标」断言会全线崩，而且报错信息完全指不到手臂身上。
          if (o.userData.viewArms) return;
          if (o.isMesh && o.material && o.material.color) {
            out.push({
              name: o.userData.matName,
              color: o.material.color.getHex(),
              metalness: o.material.metalness,
              roughness: o.material.roughness,
              emissive: o.material.emissive ? o.material.emissive.getHex() : null,
              ei: o.material.emissiveIntensity,
              base: o.userData.baseMat ? o.userData.baseMat.color.getHex() : null,
            });
          }
        });
        return out;
      },
      // 逐**材质名**给武器各部件的**顶点包围盒**（武器组局部坐标）。
      // 为什么需要它：握位锚点（viewarms.js 的 ARM_ANCHORS）必须落在「护木 / 握把」这些
      // 真实几何上，而那几块只有按材质名才分得开（AK 的握把和枪托同在 `Wood` 里）。
      // 只给整体 bbox 是不够的 —— 整把枪的包围盒中心对拟合手的位置毫无帮助。
      // 注意是 **group 局部**：组的握持位与待机旋转都还叠在外面，量出来的数才能直接写进锚点表。
      gunParts: (weaponId) => {
        const e = owned[weaponId || currentId];
        if (!e) return null;
        e.group.updateWorldMatrix(true, true);
        const inv = new THREE.Matrix4().copy(e.group.matrixWorld).invert();
        const out = {};
        const v = new THREE.Vector3();
        const m = new THREE.Matrix4();
        e.group.traverse((o) => {
          if (!o.isMesh || o.userData.viewArms) return;  // 手臂不是枪的一部分
          const nm = o.userData.matName || (o.material && o.material.name) || "?";
          const pos = o.geometry.attributes.position;
          if (!pos) return;
          m.multiplyMatrices(inv, o.matrixWorld);
          const r = out[nm] || (out[nm] = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity], verts: 0 });
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m);
            for (let c = 0; c < 3; c++) {
              if (v.getComponent(c) < r.lo[c]) r.lo[c] = v.getComponent(c);
              if (v.getComponent(c) > r.hi[c]) r.hi[c] = v.getComponent(c);
            }
          }
          r.verts += pos.count;
        });
        const rd = (n) => +n.toFixed(4);
        for (const k in out) {
          const r = out[k];
          r.lo = r.lo.map(rd); r.hi = r.hi.map(rd);
          r.ctr = [0, 1, 2].map((c) => rd((r.lo[c] + r.hi[c]) / 2));
          r.size = [0, 1, 2].map((c) => rd(r.hi[c] - r.lo[c]));
        }
        return out;
      },
      // 按**材质名**沿 z 给顶点直方图。为什么 bbox 不够：一个材质常横跨几个不相连的部件
      // （AK 的 `Wood` 同时是护木+握把+枪托），只看包围盒得到的是三者的并集，
      // 完全看不出握把在哪一段。直方图里的**空档**就是部件之间的缝，一眼就能读出分段。
      // 拟合握位（ARM_ANCHORS）时先用它定位部件，再用 gunParts() 量准。
      gunProfile: (weaponId, matName, bins = 28) => {
        const e = owned[weaponId || currentId];
        if (!e) return null;
        e.group.updateWorldMatrix(true, true);
        const inv = new THREE.Matrix4().copy(e.group.matrixWorld).invert();
        const pts = [];
        const v = new THREE.Vector3();
        const m = new THREE.Matrix4();
        e.group.traverse((o) => {
          if (!o.isMesh || o.userData.viewArms) return;
          const nm = o.userData.matName || (o.material && o.material.name) || "?";
          if (matName && nm !== matName) return;
          const pos = o.geometry.attributes.position;
          if (!pos) return;
          m.multiplyMatrices(inv, o.matrixWorld);
          for (let i = 0; i < pos.count; i++) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m).clone());
        });
        if (!pts.length) return null;
        const lo = Math.min(...pts.map((p) => p.z)), hi = Math.max(...pts.map((p) => p.z));
        const counts = new Array(bins).fill(0);
        for (const p of pts) counts[Math.min(bins - 1, Math.floor((p.z - lo) / (hi - lo + 1e-9) * bins))]++;
        // 每一格同时给出该段顶点的 y 区间 —— 握把是「往下伸」的那段，y 一看就分得开
        const rows = counts.map((n, i) => {
          const a = lo + (hi - lo) * i / bins, b2 = lo + (hi - lo) * (i + 1) / bins;
          const seg = pts.filter((p) => p.z >= a && p.z < b2);
          return {
            z: [+a.toFixed(3), +b2.toFixed(3)], n,
            y: seg.length ? [+Math.min(...seg.map((p) => p.y)).toFixed(3), +Math.max(...seg.map((p) => p.y)).toFixed(3)] : null,
          };
        });
        return { mat: matName, z: [+lo.toFixed(3), +hi.toFixed(3)], bins: rows };
      },
      // 旧名保留只为兼容；行为已改为「装备当前背包的主武器」，不再轮换
      switchToPrimaryCycle: switchToPrimary,
      getRecoil: () => recoilPitch,
      getRecoilYaw: () => recoilYaw,
      // 复位要**连 `aimPunch` 一起清**（它是权威，`recoilPitch/Yaw` 只是派生量）——
      // 只清派生量的话下一次 `decayPunch`/`syncRecoil` 会立刻把它算回来。
      resetRecoil: () => {
        for (const k in owned) { owned[k].state.aimPunch.x = 0; owned[k].state.aimPunch.y = 0; owned[k].state.recoilIdx = 0; owned[k].state.inaccPenalty = 0; }
        syncRecoil();
      },
      // 手动**摆**一个后坐状态（度、表下标、距上一发的秒数）。与 `resetRecoil` 同一族：
      // 帧率无关性那条断言要拿**同一个起点**跑三条不同步长的曲线，而起点只能靠
      // 「连发若干发」自然形成 —— 那个过程受 `nextFireAt` 与真实帧率影响，三次跑不出一模一样的
      // `aimPunch`（实测差 3~5%），断言会被测试自己的噪声糊掉。有了这个读口，起点是精确的。
      setPunch: (x = 0, y = 0, idx = 0, sinceShot = 0) => {
        const s = WEAPON_STATE;
        s.aimPunch.x = x; s.aimPunch.y = y;
        s.recoilIdx = idx; s.sinceShot = sinceShot; s.inaccPenalty = 0;
        syncRecoil();
        return { x: s.aimPunch.x, y: s.aimPunch.y };
      },
      // CS 后坐的可观测面：`aimPunch`（度）、弹道表下标、距上一发的秒数、准星开口（px）。
      // 这一组就是「弹道表真的生效了吗」那条断言的读口 —— 逐发记录它、与表里逐项比对。
      punch: (id) => {
        const k = id || currentId;
        if (!owned[k]) return null;
        const s = owned[k].state;
        return { weapon: k, x: s.aimPunch.x, y: s.aimPunch.y, idx: s.recoilIdx, sinceShot: s.sinceShot,
          pitch: recoilPitch, yaw: recoilYaw, penalty: s.inaccPenalty, gap: crosshairGap(),
          viewTrack: WEAPON_DEFS[k].viewTrack ?? 1.0 };
      },
      punchTable: (id) => (WEAPON_DEFS[id || currentId].pattern || []).map((p) => p.slice()),
      // 手动推进后坐恢复（= `update()` 每帧调的那个 `decayPunch`，**同一个函数**）。
      // 存在的唯一理由是**帧率无关性**这条断言：`pause()` 停掉 rAF 之后自己定步长喂 dt，
      // 144/60/30fps 三种步长在同一**时刻**必须给出同一个 `aimPunch`。
      // 别在别处用它推进游戏时间 —— 它只碰后坐，不碰物理。
      punchStep: (dt) => { decayPunch(dt); return { x: WEAPON_STATE.aimPunch.x, y: WEAPON_STATE.aimPunch.y }; },
      // 落点衰减（CS 的 `rangeMod ^ (d/9.525)`）。暴露它是因为「AK 50m 处 5 枪变 4 枪」
      // 这条 TTK 变化必须能**数值**核对，而不是靠读一遍公式。
      dmgAt: (id, dist) => damageAt(WEAPON_DEFS[id || currentId], dist),
      melee: (heavy) => meleeAttack(!!heavy),
      // 配表的读口（深拷贝，别让测试改到真表）。刀的 `stats` 是 `{range, light, heavy}`，
      // 与枪的 `{magSize, reserve, ...}` 不同形，调用方自己认。
      weaponStats: (id) => JSON.parse(JSON.stringify(WEAPON_DEFS[id || currentId].stats)),
      // 视模后坐的当前形态（各轴位移 + 峰值帽），用来核对临界阻尼解析解的峰值仍等于 KICK 表的数。
      kickState: (id) => {
        const e = owned[id || currentId];
        if (!e) return null;
        const out = {};
        for (const a of KICK_AXES) out[a] = { p: e.state.ks[a].p, v: e.state.ks[a].v, amp: e.state.ks[a].amp };
        return { weapon: id || currentId, axes: out, boltT: e.state.boltT, reScope: e.state.reScope, rate: (KICK[e.def.type] || KICK.rifle).rate };
      },
      setCrouch: (v) => { keys[IS_CROUCH] = !!v; },
      setSneak: (v) => { keys[IS_SNEAK] = !!v; },
      freezeEnemies: (v) => { enemyManager.frozen = !!v; },
      isCrouching: () => player.crouching,
      isSneaking: () => player.sneaking,
      isScoped: () => scoped,
      scopeStage: () => scopeStage,
      cycleScope,
      eyeH: () => player.eyeH,
      viewDip: () => player.viewDip,
      fov: () => camera.fov,
      frames: () => frameCount,
      beginGame: gameStart,
      tdmScores: () => ({ kills, enemyScore, invuln: player.invuln || 0, timeLeft }),
      // ---- 对局设置（敌人数 / 难度）----
      enemyTarget: () => enemyTarget,
      setEnemyTarget: (n) => { const v = setEnemyTarget(n); buildMenuMatch(); return v; },
      enemyBounds: () => ({ min: ENEMY_MIN, max: ENEMY_MAX }),
      difficulty: () => difficultyId,
      difficulties: () => DIFFICULTIES.map((d) => d.id),
      setDifficulty: (id) => { difficultyId = findDifficulty(id).id; applyDifficulty(); buildMenuMatch(); return difficultyId; },
      enemyTuning: () => ({ ...ENEMY_TUNING }),
      showScoreboard,
      scoreboard: () => ({
        visible: !scoreboardEl.classList.contains("hidden"),
        playerDeaths,
        roster: roster.map((r) => ({ name: r.name, kills: r.kills, deaths: r.deaths, bound: !!r.enemy })),
      }),
      onKill: (head, name, wpn) => onKill(head, name, wpn),
      // 连杀读口：`count` 是当前连杀数（4 秒无击杀即为 0），`since` 是距上一杀的秒数，
      // `window` 是窗口长度（免得测试把 4.0 抄一份进去、以后改窗口时假红）。
      // `since` 在「本局还没杀过人」时是 `null`，**不是 `Infinity`** —— 内部那个
      // `time - lastKillAt` 确实是 `Infinity`，但 CDP 的 returnByValue 走 JSON，
      // `Infinity` 到那边会变成 `null`（测试里对着它调 toFixed 直接 TypeError）。
      // 与其让读口在两处表现不一致，不如在源头就把它写成 null 并写进这条注释。
      streak: () => {
        const since = time - lastKillAt;
        return { count: streakCount, since: Number.isFinite(since) ? since : null, window: STREAK_WINDOW };
      },
      // 播报文案阶梯。有了它才能在测试里断言「10 连杀 ≠ 5 连杀」这类事，
      // 而不是把中文抄进测试里（那就成了「照着实现写测试」）。
      streakLabel: (n) => streakLabel(n),
      // 常驻倒计时条的 DOM 真值：`visible` 是它有没有挂 `show`，`num` 是显示的数字，
      // `fill` 是条宽百分比字符串，`low` 是「快断了」的告警态。断言必须读这里 ——
      // 读 `updateStreakHud` 的入参只能是「我算出来的」，读 DOM 才是「玩家看到的」。
      streakHud: () => ({
        visible: !!streakTimerEl && streakTimerEl.classList.contains("show"),
        num: streakTimerNumEl ? streakTimerNumEl.textContent : null,
        fill: streakTimerFillEl ? streakTimerFillEl.style.width : null,
        low: !!streakTimerEl && streakTimerEl.classList.contains("low"),
      }),
      hurt: (n, enemy) => damagePlayer(n, true, enemy || null),
      // 主循环里被兜住的异常（正常应为 0 / null）。写测试时顺手断言这个，
      // 否则被 try/catch 吃掉的异常在 __errs 里看不到，会「假绿」。
      loopErrors: () => loopErrors,
      lastError: () => lastError,
      // ---- 模拟聊天 ----
      // chatTrigger 是测试的主动触发器：否则只能真打一局来等台词（限流 + 冷场计时
      // 都要走到点，用墙上时钟等根本不现实）。cat 取 CHAT_LINES 的键。
      chatState: () => chat.state(),
      chatLines: () => chat.state().lines,
      chatIsTyping: () => chat.isTyping(),
      chatOpen: () => chat.open(),
      chatClose: () => chat.cancel(),
      chatSend: (text) => chat.say(text),
      chatTrigger: (cat, ctx) => { chat.taunt(cat, ctx || {}); },
      chatClear: () => chat.clear(),
      // 死亡视角（只读）：t 是仿真时间（dt 被 clamp 到 0.05，低帧率下会慢于墙上时钟，
      // 所以测试要按 frames() 换算帧数，别按秒干等）
      deathState: () => ({
        dead,
        t: deathT,
        delay: DEATH_DELAY,
        killer: lastKiller && lastKiller.name,
        yawOff: deathCam.yawOff,
        pitchOff: deathCam.pitchOff,
        yaw: player.yaw,
        pitch: player.pitch,
      }),
      deathPanel: () => ({
        visible: !deathEl.classList.contains("hidden"),
        killer: deathKillerEl.textContent,
        weapon: deathWeaponEl.textContent,
        barW: deathFillEl.style.width,
        crosshairHidden: cross.classList.contains("hidden"),
      }),
      // 死亡流程的测试入口（与 hurt 同源，只是固定走致死伤害）
      killBy: (enemy) => damagePlayer(100000, true, enemy || null),
      killSelf: () => damagePlayer(100000, false, null),
      endTDM,
      forceFire: () => fire(),
      startReload: () => startReload(),
      isReloading: () => WEAPON_STATE.reloading,
      getReloadDur: () => WEAPON_STATE.reloadDur,
      getAmmo: () => ({ mag: WEAPON_STATE.mag, reserve: WEAPON_STATE.reserve, count: WEAPON_STATE.count }),
      nadeCounts: () => NADE_IDS.map((id) => owned[id].state.count),
      spawnSmoke: (x, z) => spawnSmoke(new THREE.Vector3(x, 0, z), 5.4, 14),
      flashPlayer: (i) => applyFlashEffect(i === undefined ? 1 : i),
      flashIntensity: () => flashIntensity,
      detonateFlash: (x, y, z) => detonateFlash(new THREE.Vector3(x, y, z)),
      smokeBlocks,
      weaponTransform: () => ({
        x: cur().group.position.x, y: cur().group.position.y, z: cur().group.position.z,
        rx: cur().group.rotation.x, ry: cur().group.rotation.y, rz: cur().group.rotation.z,
      }),
      // ---- 视模通道 / 第一人称手臂 ----
      vmScene, vmCamera, viewArms, muzzleShot, muzzleLight,
      // renders 递增只证明「第二遍真的画了」。世界通道在画时 frameCount 与绘制计数
      // 照样涨，所以那两个量都验不出「视模被漏掉」。
      vmState: () => ({
        renders: vmFrames,
        sceneIsParent: vmCamera.parent === vmScene,
        fov: vmCamera.fov,
        aspect: vmCamera.aspect,
        gunVisible: cur().group.visible,
        armsVisible: viewArms.root.visible,
        armsParent: viewArms.root.parent === cur().group,
        bg: vmScene.background ? 1 : 0,
        env: vmScene.environment ? 1 : 0,
      }),
      // 双手位置。注意给的是**武器组局部**坐标，不是相机空间 —— 手臂是武器组的子节点，
      // 组的握持位 (bx,by,bz) 与后坐/换弹的位移旋转都还叠在外面。想换算屏幕像素就喂给
      // 下面的 project()（它自己会乘组矩阵），别直接把这三个数当相机坐标用。
      armsPose: () => {
        const arr = (v) => [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
        return {
          r: arr(viewArms.armR.grp.position),
          l: arr(viewArms.armL.grp.position),
          lRest: arr(viewArms.anchorL),
          // 手是从 `models/cs/ak47.glb` 装的（见 viewarms.js）。loaded=false 时整双手是空的，
          // 断言「手在位」的用例必须先看这个字段，否则量到的全是空组的原点、会**假绿**。
          loaded: viewArms.handsReady,
          scale: viewArms.armR.grp.scale.x,
          hasLeft: viewArms.hasLeft,
          leftArmVisible: viewArms.armL.grp.visible,
          magVisible: viewArms.magL.visible,
          // 手部网格要**递归**数：装进来的 CS 手本身还是个多层嵌套
          // （grp → palm → handWrap → HandR(Group) → 3 个 mesh），只数一两层会得到 2（两个空弹匣盒），
          // 看着像「装了但没网格」，其实只是数漏了。满载是 10 = 3+1(右手) + 3+1(左手) + 2(弹匣盒)。
          meshes: (() => { let n = 0; viewArms.root.traverse((o) => { if (o.isMesh) n++; }); return n; })(),
        };
      },
      reloadPhase: () => (WEAPON_STATE.reloading ? Math.min(WEAPON_STATE.reloadT / WEAPON_STATE.reloadDur, 1) : 0),
      // 把换弹时间线**定格**在 p。走 reloadHoldP（见 animateWeapon 里那段）而不是写 reloadT：
      // 写 reloadT 只在"循环已经暂停"时有效，而暂停之后根本不重绘，截图会拿到静止位。
      poseReload: (p) => {
        const st = WEAPON_STATE;
        if (!st.reloadDur) return null;
        reloadHoldP = Math.max(0, Math.min(1, p));
        animateWeapon(0);
        const arr = (v) => [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
        return { p: reloadHoldP, left: arr(viewArms.armL.grp.position), mag: viewArms.magL.visible };
      },
      clearReload: () => {
        reloadHoldP = null;
        const st = WEAPON_STATE;
        st.reloading = false; st.reloadT = 0;
        animateWeapon(0);
      },
      // 握持锚点的**在线微调**入口：锚点表是导出的可变对象，configure() 每次都现读，
      // 所以改一条就立刻生效 —— 逐把枪调握位时不必每改一个数就重启一次页面。
      // 每条都补上**生效的**弹匣井：表里只有手枪显式写了 `m`，其余武器走 `viewarms.js` 的
      // 模块常量 `MAGWELL`（`configure()` 里是 `a.m ?? MAGWELL`）。不补的话读口对步枪返回
      // `undefined`，「换弹时左手有没有对上弹匣井」这条断言就只能把 `[0,-0.155,0.02]`
      // 抄进测试里 —— 产品一改那个常量，断言还在原地空绿。
      armAnchors: () => {
        const out = JSON.parse(JSON.stringify(ARM_ANCHORS));
        const mw = [+MAGWELL.x.toFixed(4), +MAGWELL.y.toFixed(4), +MAGWELL.z.toFixed(4)];
        for (const k in out) if (out[k].l && !out[k].m) out[k].m = mw;
        return out;
      },
      setArmAnchor: (weaponId, a) => {
        const entry = ARM_ANCHORS[weaponId];
        if (!entry || !a) return null;
        if (a.r) entry.r = a.r;
        if (a.l !== undefined) entry.l = a.l;
        if (a.m) entry.m = a.m;
        // `s` = 整只手的缩放、`hr`/`hl` = 左右手的姿态修正。这两个也必须能在线改 ——
        // 否则逐把枪拟合时每调一次就得重启一次页面（ARM_ANCHORS 的注释里说了要能现改现生效）。
        if (a.s !== undefined) entry.s = a.s;
        if (a.hr) entry.hr = a.hr;
        if (a.hl) entry.hl = a.hl;
        if (weaponId === currentId) viewArms.configure(weaponId);
        return JSON.parse(JSON.stringify(entry));
      },
      // 把「武器组局部」坐标投到屏幕像素。调握位时靠它对齐 ——
      // 组局部 → 相机空间只要乘组自身的 matrix（vmCamera 是单位变换），
      // 再走 vmCamera 的投影矩阵。窗口尺寸用 innerWidth/Height，与 aspect 同源。
      project: (v) => {
        const p = new THREE.Vector3(v[0], v[1], v[2]);
        cur().group.updateMatrix();
        p.applyMatrix4(cur().group.matrix);
        vmCamera.updateMatrixWorld();
        p.project(vmCamera);
        return [+((p.x + 1) / 2 * window.innerWidth).toFixed(1), +((1 - p.y) / 2 * window.innerHeight).toFixed(1)];
      },
      viewSize: () => [window.innerWidth, window.innerHeight],
      // 袖口（前臂远端）的**武器组局部**坐标 + 屏幕像素。拟合时用它判「前臂有没有画到画面外」：
      // 喂给 project() 拿像素，与 viewSize() 比大小即可（见 viewarms.js 的 ARM_STRETCH 注释）。
      armTip: (side) => {
        const v = viewArms.armTip(side === "l" ? "l" : "r");
        const arr = [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
        const p = new THREE.Vector3(v.x, v.y, v.z);
        cur().group.updateMatrix();
        p.applyMatrix4(cur().group.matrix);
        p.project(vmCamera);
        return { local: arr, px: [+((p.x + 1) / 2 * window.innerWidth).toFixed(1), +((1 - p.y) / 2 * window.innerHeight).toFixed(1)] };
      },
      elbows: () => JSON.parse(JSON.stringify(ELBOWS)),
      setElbow: (side, v) => { if (ELBOWS[side] && v) ELBOWS[side] = v; return JSON.parse(JSON.stringify(ELBOWS)); },
      // ---- 地面掉落武器（敌人掉的枪 / 按 G 丢的枪）----
      dropWeapon,
      slotWeapon,
      groundItems: () => groundItems.map((it) => ({
        id: it.id, skin: it.skin, slotKind: it.slotKind,
        x: +it.x.toFixed(3), y: +it.baseY.toFixed(3), z: +it.z.toFixed(3),
        armed: it.armed,
        inScene: it.root.parent === scene,
        meshes: (() => { let n = 0; it.root.traverse((o) => { if (o.isMesh) n++; }); return n; })(),
      })),
      emptySlotState: () => ({ ...emptySlot }),
      // 每个敌人此刻端着什么。gunId/skin 就是它死亡时掉在地上的那把。
      enemyLoadouts: () => enemyManager.enemies.map((e) => ({
        name: e.name, gunId: e.gunId, skin: e.gunSkin, weaponName: e.weaponName,
        hasRifle: !!(e.rig && e.rig.rifle), dead: e.dead,
      })),
      // 目录自检：每个「枪型 × 皮肤」组合是否都产出了世界模型/敌人模型。
      // 四个可持有枪型相加是 **20**（ak 5 / m4 6 / awm 6 / pistol 3），
      // 其中 6 款是模型皮肤 —— 它们照样得有世界/敌人变体（敌人和掉落物只认材质皮肤）。
      // 断言时**一定要把条目数一并打出来**：`world` 全 false 的空跑也是「全绿」。
      worldModels: (id) => skinsFor(id).map((s) => ({
        skin: s.id, world: !!worldModel(id, s.id), enemy: !!enemyModel(id, s.id),
      })),
      // 无视走位直接把最近的枪捡起来（只查空槽，不查 armed / 距离）
      pickUpNearest: () => {
        let best = -1, bd = Infinity;
        for (let i = 0; i < groundItems.length; i++) {
          const it = groundItems[i];
          const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z);
          if (d < bd) { bd = d; best = i; }
        }
        if (best < 0) return null;
        const it = groundItems[best];
        if (!emptySlot[it.slotKind]) return null;
        pickUpItem(it, best);
        return { id: it.id, skin: it.skin, slotKind: it.slotKind, dist: +bd.toFixed(3) };
      },
      colliders: () => colliders.slice(),
      // 见 `loopPaused` 那处注释：只 cancel 是不够的（排队中的那一帧会把链子接回来），
      // 而重复 `resume()` 会接出第二条链、每帧 update 两遍。
      pause: () => { loopPaused = true; cancelAnimationFrame(rid); },
      resume: () => { if (!loopPaused) return; loopPaused = false; lastT = performance.now(); rid = requestAnimationFrame(loop); },
      EYE,
    };
  }
}
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // 视模相机必须一起跟 —— 差了这一行，改窗口后枪和手会被横向拉伸（不报错）
  vmCamera.aspect = camera.aspect;
  vmCamera.updateProjectionMatrix();
});
init();
