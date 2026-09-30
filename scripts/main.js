// ===== 战术突击 FPS - 主游戏（运输船 · 团队竞技 · CF 手感）=====
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SFX } from "./audio.js";
import { EnemyManager, ENEMY_NAMES, ENEMY_TUNING } from "./enemies.js";
import { buildMap } from "./map.js";
import { ViewArms, ARM_ANCHORS, ELBOWS } from "./viewarms.js";
import {
  SKINS, STOCK, DEFAULT_SKIN, DEFAULT_MUZZLE,
  skinsFor, findSkin, isSkinned, skinLabel,
} from "./skins.js";

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
const SCOPE_FOV = 22;  // 一级镜
const SCOPE_FOV2 = 11; // 二级镜（CF 的 AWM 是两级变倍）

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
vmScene.add(vmHemi, vmSun, vmCamera);

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
// 1=主武器(背包三选一) 2=副武器 3=近战 4=投掷物(手雷/闪光弹/烟雾弹循环)
// Q=上/副武器快速切换，B=背包选主武，右键=AWM 开镜
const WEAPON_DEFS = {
  ak: {
    id: "ak", slot: "primary", type: "rifle", name: "AK-47", model: "./models/ak47.glb",
    rotY: -Math.PI / 2, targetLen: 0.82, key: "1", fullAuto: true,
    stats: { magSize: 30, reserve: 150, interval: 0.1, dmg: 34, reload: 2.1, recoil: 0.012 },
  },
  m4: {
    id: "m4", slot: "primary", type: "rifle", name: "M4A1", model: "./models/m4.glb",
    rotY: Math.PI / 2, targetLen: 0.82, key: "1", fullAuto: true,
    stats: { magSize: 30, reserve: 150, interval: 0.082, dmg: 28, reload: 2.0, recoil: 0.01 },
  },
  awm: {
    id: "awm", slot: "primary", type: "sniper", name: "AWM", model: "./models/awm.glb",
    rotY: -Math.PI / 2, targetLen: 0.95, key: "1", fullAuto: false,
    stats: { magSize: 5, reserve: 45, interval: 1.25, dmg: 120, reload: 3.4, recoil: 0.05, zoom: true },
  },
  pistol: {
    id: "pistol", slot: "secondary", type: "pistol", name: "USP", model: "./models/pistol.glb",
    rotY: 0, targetLen: 0.55, key: "2", fullAuto: false,
    stats: { magSize: 12, reserve: 72, interval: 0.17, dmg: 30, reload: 1.5, recoil: 0.02 },
  },
  knife: {
    id: "knife", slot: "melee", type: "melee", name: "军用匕首", model: "./models/knife.glb",
    rotY: 0, targetLen: 0.5, key: "3",
    stats: { dmg: 75, range: 2.2, interval: 0.5 },
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

// owned[id] = { group, muzzleLocal, state, def }
const owned = {};
// WEAPON_STATE 恒指向当前武器 state（切枪时重新赋值），供换弹/弹药/后坐复用
let WEAPON_STATE = null;
let currentId = "ak";
// 后坐力仅作相机/射线的临时偏移，不写入 player.pitch，保证瞄准单一数据源
let recoilPitch = 0;
let recoilYaw = 0;
// 开镜状态
let scoped = false;

function cur() { return owned[currentId]; }

// 第一人称手臂（视模）。**全局只有一个实例**，切枪时被重挂进新武器的组 ——
// 与枪口火光同一套模式（attachMuzzleTo），免得每把枪各养一双永远看不见的手。
const viewArms = new ViewArms();

// ---------- 通用武器 GLB 加载 ----------
function loadWeapon(def) {
  return new Promise((resolve) => {
    new GLTFLoader().load(
      def.model,
      (gltf) => {
        const gun = gltf.scene;
        // 归一化：最长轴缩放到 targetLen，居中，再按 rotY 旋转使枪口朝本地 -z
        const box = new THREE.Box3().setFromObject(gun);
        const size = new THREE.Vector3();
        box.getSize(size);
        const longest = Math.max(size.x, size.y, size.z);
        gun.scale.multiplyScalar(def.targetLen / longest);
        const box2 = new THREE.Box3().setFromObject(gun);
        const center = new THREE.Vector3();
        box2.getCenter(center);
        gun.position.sub(center);
        gun.rotation.y = def.rotY;

        gun.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = false;
            o.frustumCulled = false;
            if (o.material) {
              // 皮肤按 GLB 的原始材质名分部位上漆（AK 的 Wood/Metal/Dark_metal 等），
              // 所以名字要在 clone **之前**记下来 —— clone 虽然会带 name，
              // 但显式存 userData 更经得起后续改动。
              o.userData.matName = o.material.name || "";
              o.material = o.material.clone();
              o.material.side = THREE.DoubleSide;
              // 记下出厂材质参数：applySkinTo 每次都先还原到这份 base 再叠皮肤。
              // 这是「原厂」能可靠回退的前提 —— 没有它，切回原厂只能靠再猜一遍原值。
              o.userData.baseMat = {
                color: o.material.color ? o.material.color.clone() : null,
                metalness: o.material.metalness,
                roughness: o.material.roughness,
                emissive: o.material.emissive ? o.material.emissive.clone() : null,
                emissiveIntensity: o.material.emissiveIntensity,
                envMapIntensity: o.material.envMapIntensity,
                map: o.material.map || null, // 贴图只存引用，不 clone（多网格共用一张）
              };
              // 投掷物：同模型靠配色区分手雷/闪光弹/烟雾弹。
              // 注意这一步不接受皮肤覆盖，它必须在 base 快照**之后**做，
              // 否则 base 里存的是被 tint 改过的色，切回「原厂」会还原成错的颜色。
              if (def.tint && o.material.color) {
                o.material.color.lerp(new THREE.Color(def.tint), 0.75);
              }
            }
          }
        });

        const group = new THREE.Group();
        group.add(gun);
        group.visible = false;
        // 挂到**视模相机**而不是主相机：组局部坐标 = 相机空间，所以武器/手臂的摆放一无变化，
        // 但它从此只在视模通道里被画出来，不会插进集装箱。
        vmCamera.add(group);

        const half = def.targetLen / 2;
        const muzzleLocal = new THREE.Vector3(0, 0.02, -half - 0.02);

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
          spread: def.stats.type === "sniper" ? 0 : 0.003,
          ks: makeKickSpring(), // 视模后坐的位移/速度状态（见 makeKickSpring 注释）
          throwCd: 0,
        };

        owned[def.id] = { group, muzzleLocal, state: st, def };
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
const ENEMY_WEAPON = "步枪"; // 敌人共用同一把步枪（Enemy 上没有 weapon 字段）
let timeLeft = TDM_TIME;
let spawnAcc = 0;
let dead = false;
let deathT = 0;           // 死亡视角剩余时间（由主循环按 dt 推进，不用 setTimeout）
let lastKiller = null;    // 仅供调试钩子读取
// 死亡视角的转向：与 recoilPitch/recoilYaw 一样是**独立的相机叠加量**，
// 绝不写回 player.yaw/pitch —— 那是全项目唯一的朝向数据源。
const deathCam = { active: false, t: 0, dYaw: 0, dPitch: 0, yawOff: 0, pitchOff: 0 };
let killTimes = [];
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
function loadEnemyRifle() {
  const load = (url, onDone) =>
    new Promise((resolve) => {
      new GLTFLoader().load(
        url,
        (gltf) => { onDone(gltf.scene); resolve(true); },
        undefined,
        () => resolve(false)   // 失败不算致命：没有枪就只是空手
      );
    });
  // 士兵不再需要外部模型：骨架在 scripts/enemy_model.js 里用基础几何现搭（带关节、可动画）。
  // 只有枪仍然是 GLB，而且必须**另载一份**：玩家的枪会被皮肤直接改材质（applySkinTo），
  // 共用同一份 GLB 会让「换皮肤」连敌人的枪一起改掉，而且敌人的枪要按世界尺寸定标。
  return load("./models/ak47.glb", (s) => enemyManager.setRifle(s)).then(() => true);
}

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
const STREAK_TEXT = { 2: "双杀!", 3: "三杀!", 4: "四杀!", 5: "五杀!" };
const STREAK_VOICE = { 2: "Double kill", 3: "Triple kill", 4: "Multi kill", 5: "Unbelievable" };
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
  const label = STREAK_TEXT[Math.min(n, 5)] || "团灭!";
  streakEl.textContent = label;
  streakEl.classList.remove("show");
  void streakEl.offsetWidth;
  streakEl.classList.add("show");
  sfx.streak(n);
  speak(STREAK_VOICE[Math.min(n, 5)]);
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

// 把一款皮肤刷到某把武器上。
// **每次都先从 userData.baseMat 还原、再叠皮肤覆盖项** —— 这样原厂与任意皮肤之间可以
// 来回切，不会出现「上一款皮肤刷过的字段残留在这一款没覆盖到的部位上」（黄金AWM 的金色
// 残留到无影的黑白上，就是这种 bug 的典型样子）。
function applySkinTo(id, skinId) {
  const entry = owned[id];
  if (!entry) return;
  const skin = findSkin(id, skinId);
  // 皮肤表里没有这把武器（投掷物）→ 直接不碰材质。它们的颜色是 def.tint 刷上去的，
  // 强行还原 base 反而会把 tint 抹掉，三件套就再也分不出来了。
  if (!skin) return;
  const slots = skin.slots || {};
  const glow = [];
  entry.group.traverse((o) => {
    if (!o.isMesh || !o.material || !o.userData.baseMat) return;
    const base = o.userData.baseMat;
    const m = o.material;
    // 1) 还原出厂
    if (base.color && m.color) m.color.copy(base.color);
    if (base.emissive && m.emissive) m.emissive.copy(base.emissive);
    if (base.metalness !== undefined) m.metalness = base.metalness;
    if (base.roughness !== undefined) m.roughness = base.roughness;
    if (base.emissiveIntensity !== undefined) m.emissiveIntensity = base.emissiveIntensity;
    if (base.envMapIntensity !== undefined) m.envMapIntensity = base.envMapIntensity;
    // 原贴图的取舍：**非原厂皮肤默认丢掉它**。
    // material.color 是**乘**在贴图上的，而 AWM/USP 带的是深色迷彩 —— 浅色皮肤
    // （无影的冷白、天神的亮金）乘上去只会变成脏橄榄，出不来想要的颜色。
    // 迷彩与目标色只能二选一；CF 的英雄级武器皮肤本来也是纯色 + 金属描边，不是迷彩。
    // 想保留迷彩的皮肤写 keepMap: true（目前只有「原厂」之外暂无，留着这个开关）。
    if (m.map !== undefined) {
      // 原厂必须还原贴图 —— 不能只看 skin.keepMap，因为原厂的 slots 是空的、
      // 根本不会写这个字段，漏掉它会让「切回原厂」变成一把没有迷彩的灰枪。
      const want = (skin.id === STOCK || skin.keepMap) ? base.map : null;
      if (m.map !== want) {
        m.map = want;
        // 切换 map 的 null/非 null 会改变着色器的 USE_MAP 分支，必须重编程序，
        // 否则贴图要么不生效、要么残留在已置空的材质上。
        m.needsUpdate = true;
      }
    }
    // 2) 叠皮肤覆盖项（按 GLB 原始材质名对号入座）
    const ov = slots[o.userData.matName];
    if (!ov) return;
    if (ov.color !== undefined && m.color) m.color.setHex(ov.color);
    if (ov.emissive !== undefined && m.emissive) m.emissive.setHex(ov.emissive);
    if (ov.metalness !== undefined) m.metalness = ov.metalness;
    if (ov.roughness !== undefined) m.roughness = ov.roughness;
    if (ov.emissiveIntensity !== undefined) m.emissiveIntensity = ov.emissiveIntensity;
    if (ov.envMapIntensity !== undefined) m.envMapIntensity = ov.envMapIntensity;
    // 3) 登记发光呼吸的候选材质（只有真正带 emissive 的部位才呼吸）
    if (skin.pulse && ov.emissive !== undefined && m.emissive) {
      glow.push({ mat: m, base: m.emissiveIntensity, amp: skin.pulse.amp, speed: skin.pulse.speed });
    }
  });
  entry.glowMats = glow;
  // 枪口焰是**单例**（muzzleShot/muzzleLight 由 attachMuzzleTo 在切枪时重新挂载），
  // 所以这里只改颜色，不重建、不重新挂载。
  const mz = skin.muzzle;
  muzzleShot.material.color.setHex(mz !== undefined ? mz : DEFAULT_MUZZLE.sprite);
  muzzleLight.color.setHex(mz !== undefined ? mz : DEFAULT_MUZZLE.light);
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
  // 换枪一律退镜，避免端着镜子换到没镜的枪
  scoped = false;
  scopeEl.classList.add("hidden");
  cross.classList.remove("hidden");
  for (const k in owned) owned[k].group.visible = k === id;
  attachMuzzleTo(id);
  // 手臂重挂进新武器的组，并按这把枪的握持锚点摆位（顺带把换弹相位清干净）。
  // 挂在 group 之下是有意的：开镜/阵亡时 animateWeapon 把 group 藏起来，手臂自动跟着藏，
  // 不会出现「镜筒上浮着一只手」。
  viewArms.attach(owned[id].group, id);
  // 上漆。挂在这里而不是各个调用点：switchBackpack()/respawnPlayer()/gameStart()
  // 全都走 switchWeapon(…, true)，一处挂钩三个入口全覆盖。
  applySkinTo(id, activeSkinId(id));
  sfx.switchWeapon();
  updateAmmoHud();
}
function quickSwitch() {
  if (WEAPON_DEFS[currentId].slot === "secondary") switchWeapon(equippedPrimary());
  else switchWeapon("pistol");
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
  switchWeapon(equippedPrimary());
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
// 面板是「查看 + 切换」用的，改配装在开始菜单里（等价于 CF 在仓库里配好再进战场）。
// 指针锁定时没有光标，所以这里的鼠标点击实际点不到，主路径是键盘 B + 数字键。
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
    row.onclick = () => { if (switchBackpack(i)) toggleBackpack(); };
    list.appendChild(row);
  });
  const hint = document.getElementById("bpHint");
  if (hint) {
    const ok = canSwapBackpack();
    hint.textContent = ok
      ? "按 1 / 2 / 3 切换 · 副武器 USP · 近战 匕首 · 投掷物 手雷/闪光/烟雾"
      : swapBlockReason();
    hint.classList.toggle("warn", !ok);
  }
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
function meleeAttack() {
  if (state !== "playing" || dead) return;
  const st = WEAPON_DEFS.knife.stats;
  const now = performance.now();
  // 近战也用自己的射速闸门（cur() 就是匕首，因为 melee 类型只有它）
  const ks = cur().state;
  if (now < ks.nextFireAt) return;
  ks.nextFireAt = now + st.interval * 1000;
  actedThisLife = true; // 本回合已行动 → 锁定背包切换（CF 规则）
  ks.cooldown = 0.4;
  sfx.melee();
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
        const dmg = head ? enemy.maxHealth : st.dmg;
        spawnBlood(h.point);
        if (enemy.takeDamage(dmg)) onEnemyDeath(enemy, head, "军用匕首");
        else { addHitMark(head ? "head" : "hit"); head ? sfx.headshot() : sfx.hit(); enemy.setFlash(); }
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
  const now = performance.now();
  if (now < WEAPON_STATE.nextFireAt) return;

  if (WEAPON_STATE.mag <= 0) { sfx.empty(); startReload(); return; }
  WEAPON_STATE.nextFireAt = now + WEAPON_STATE.fireInterval * 1000;
  WEAPON_STATE.mag--;
  actedThisLife = true; // 本回合已行动 → 锁定背包切换（CF 规则）
  WEAPON_STATE.cooldown = 0.07;
  sfx.shoot(def.type);

  triggerKick(currentId);
  WEAPON_STATE.spread = Math.min(WEAPON_STATE.spread + 0.008, 0.03);

  // 枪口焰：只在这里「触发」，涨消由 animateWeapon 每帧推进（见 updateMuzzleFlash）。
  // 旧写法是 `setTimeout(..., 55)` —— 既不受 pause() 影响、又与帧率脱钩：60fps 下正好
  // 一帧多就没了，掉一帧就整发不显示；连发时多个定时器还会互相踩着关灯。
  triggerMuzzleFlash(def);

  // 子弹沿相机当前朝向发射，与准星所见完全一致；
  // 本枪后坐等命中处理之后才累加（作用于后续子弹），避免首枪就提前偏离准星。
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
        // 距离衰减：18m 内满伤，之后线性降到 65%
        const falloff = Math.max(0.65, 1 - Math.max(0, h.distance - 18) / 40 * 0.35);
        const dmg = head ? enemy.maxHealth : Math.max(1, Math.round(def.stats.dmg * falloff));
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

  // 本枪后坐：枪口上抬 + 轻微横向晃动（仅临时偏移，不写入 player.pitch/yaw）
  recoilPitch += (def.type === "sniper" ? 0.05 : 0.008) + Math.random() * 0.004;
  recoilYaw += (Math.random() - 0.5) * (def.type === "sniper" ? 0.02 : 0.006);

  // CF 惯例：狙击枪一枪打出即强制退镜，要重新右键上膛再瞄（也顺带避免
  // 0.05 的狙击后坐在 22° 视场里被放大 4 倍糊住画面）
  if (def.type === "sniper" && scoped) setScoped(false);

  updateAmmoHud();
  if (WEAPON_STATE.mag <= 0) startReload();
}

function onKill(headshot, enemyName, weaponName) {
  kills++;
  killTimes.push(time);
  killTimes = killTimes.filter((t) => time - t < 3.0);
  addHitMark("kill");
  showKillIcon(headshot);
  sfx.kill();
  pushKillFeed("你", weaponName || WEAPON_DEFS[currentId].name, enemyName || "敌人", !!headshot, false);
  if (killTimes.length >= 2) showStreak(killTimes.length);
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
      pushKillFeed(killer ? killer.name : "敌人", ENEMY_WEAPON, "你", false, true);
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
    byEnemy ? ENEMY_WEAPON : ""
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
  player.vel.set(0, 0, 0);
  player.yaw = 0;
  player.pitch = 0;
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
    owned[k].state.spread = owned[k].def.stats.spread ?? 0.003;
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
  if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") {
    const isOpen = !document.getElementById("backpack").classList.contains("hidden");
    if (isOpen) {
      // 面板打开时，数字键选的是「第几个背包」（CF 的 B + 数字键）
      if (switchBackpack(+e.code[5] - 1)) toggleBackpack();
      return;
    }
  }
  if (e.code === "Digit1") switchToPrimary();
  if (e.code === "Digit2") switchWeapon("pistol");
  if (e.code === "Digit3") switchWeapon("knife");
  if (e.code === "Digit4") switchNade();
  if (e.code === "KeyQ") quickSwitch();
  if (e.code === "KeyB") toggleBackpack();
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
// 切走窗口时 keyup 收不到，战绩面板会一直挂着，所以失焦也要收起来
window.addEventListener("blur", () => showScoreboard(false));

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
    if (state === "playing") menu.classList.remove("hidden");
    viewport.classList.remove("active");
  }
});
document.addEventListener("mousemove", (e) => {
  // 死亡期间不能转头：镜头归死亡视角接管（否则玩家一甩鼠标就压过转向击杀者的插值）
  if (!locked || state !== "playing" || dead) return;
  const sens = 0.0022 * (scopeStage === 2 ? 0.22 : scoped ? 0.35 : 1);
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
  // （按住不放的话，复活那一刻全自动枪会立刻续火）
  if (!locked || state !== "playing" || dead) return;
  if (isSecondaryClick(e)) { e.preventDefault(); cycleScope(); return; }
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
  spawnAcc = 0;
  timeLeft = TDM_TIME;
  killTimes = [];
  player.hp = 100;
  player.invuln = 0;
  player.pos.set(0, 0, bounds.hl - 6);
  actedThisLife = false;
  player.vel.set(0, 0, 0);
  player.yaw = 0;
  player.pitch = 0;
  player.viewDip = 0;
  player.stepLift = 0;
  player.groundY = 0;   // 同 respawnPlayer：动态 groundY 不清会把玩家弹回上一局的箱顶
  player.eyeH = EYE;
  recoilPitch = 0;
  recoilYaw = 0;
  camera.rotation.set(0, 0, 0);
  curFov = BASE_FOV;
  camera.fov = BASE_FOV;
  setScoped(false);
  clearFlash();
  grenadePool.forEach((g) => scene.remove(g.mesh));
  grenadePool.length = 0;
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
    owned[k].state.spread = owned[k].def.stats.spread ?? 0.003;
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
  // 有皮肤就写「AK-47-火麒麟」（CF 的英雄级武器就是这么印在 HUD 上的），原厂只写枪名
  const sid = activeSkinId(currentId);
  const skinned = sid && isSkinned(currentId, sid);
  document.getElementById("weaponName").textContent =
    skinned ? def.name + "-" + skinLabel(currentId, sid) : def.name;
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
const KICK = {
  rifle:   { rate: 16, back: 0.055, up: 0.020, pitch: 0.090, roll: 0.050, yaw: 0.026 },
  sniper:  { rate: 8,  back: 0.130, up: 0.048, pitch: 0.220, roll: 0.110, yaw: 0.060 },
  pistol:  { rate: 18, back: 0.048, up: 0.022, pitch: 0.100, roll: 0.048, yaw: 0.026 },
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

  // 后坐偏移衰减
  recoilPitch = Math.max(0, recoilPitch - dt * 0.55);
  recoilYaw *= Math.max(0, 1 - dt * 0.6);

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

  // 只有全自动武器按住才连发；AWM / USP 这类半自动必须重新扣扳机（CF 同此）
  if (fireEnabled && WEAPON_DEFS[currentId].fullAuto && !WEAPON_STATE.reloading && !dead) fire();
  if (player.invuln > 0) player.invuln -= dt;
  if (WEAPON_STATE.cooldown > 0) WEAPON_STATE.cooldown -= dt;
  if (WEAPON_STATE.throwCd > 0) WEAPON_STATE.throwCd -= dt;
  WEAPON_STATE.spread = Math.max(0.003, WEAPON_STATE.spread - dt * 0.06);
  updateReload(dt);
  updateGrenades(dt);

  // 准星扩散：接线早已存在但从未被用过的 .crosshair 间隙
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  const gap = Math.max(4, Math.min(26, 4 + WEAPON_STATE.spread * 480 + hSpeed * 1.1));
  cross.style.setProperty("--gap", gap.toFixed(1) + "px");

  // 战绩面板开着的时候每 0.2s 刷一次（按住 Tab 期间别人还在打）
  sbAcc += dt;
  if (sbAcc >= 0.2) { sbAcc = 0; renderScoreboard(); }

  spawnAcc += dt;
  if (spawnAcc >= TDM_SPAWN_INTERVAL) { spawnAcc = 0; refillEnemies(); }

  enemyManager.update(dt, player, colliders);
  enemiesShoot();
}

let lastT = performance.now();
let rid = 0;
let frameCount = 0;
// 视模通道真正画了几遍。**不能用 frameCount 或绘制调用数代替**：frameCount 在 loop 的
// 第一行就自增（哪怕后面每帧都抛异常它也照涨），绘制调用数则被世界通道撑满 ——
// 只有这个计数能证明「第二遍渲染确实在跑」（见 AGENTS.md 里「判卡死要看绘制」那条）。
let vmFrames = 0;
function loop(now) {
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
    loadEnemyRifle(),
  ]);
  WEAPON_STATE = owned.ak.state;
  owned.ak.group.visible = true;
  attachMuzzleTo("ak"); // 首帧就要挂好，否则第一条命的枪口火光在世界原点
  viewArms.attach(owned.ak.group, "ak"); // 首帧就得有手，不能等第一次切枪
  gameReady = true;
  requestAnimationFrame(loop);

  if (new URLSearchParams(location.search).has("debug")) {
    window.__tactical = {
      enemyManager, player, fire, WEAPON_STATE, camera, obstacleMeshes, THREE, scene,
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
        // 测试与调试入口：直接改配装再刷漆
        const bpIdx = BACKPACKS.findIndex((b) => b.primary === weaponId);
        if (bpIdx >= 0) BACKPACKS[bpIdx].skin = skinId;
        else GEAR_SKIN[weaponId] = skinId;
        if (currentId === weaponId) applySkinTo(weaponId, skinId);
        return activeSkinId(weaponId);
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
      // 旧名保留只为兼容；行为已改为「装备当前背包的主武器」，不再轮换
      switchToPrimaryCycle: switchToPrimary,
      getRecoil: () => recoilPitch,
      getRecoilYaw: () => recoilYaw,
      resetRecoil: () => { recoilPitch = 0; recoilYaw = 0; },
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
      hurt: (n, enemy) => damagePlayer(n, true, enemy || null),
      // 主循环里被兜住的异常（正常应为 0 / null）。写测试时顺手断言这个，
      // 否则被 try/catch 吃掉的异常在 __errs 里看不到，会「假绿」。
      loopErrors: () => loopErrors,
      lastError: () => lastError,
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
          hasLeft: viewArms.hasLeft,
          leftArmVisible: viewArms.armL.grp.visible,
          magVisible: viewArms.magL.visible,
          meshes: viewArms.root.children.reduce(
            (n, a) => n + a.children.filter((c) => c.isMesh).length + a.children.filter((c) => c.isGroup).reduce((m, g) => m + g.children.filter((c) => c.isMesh).length, 0), 0),
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
      armAnchors: () => JSON.parse(JSON.stringify(ARM_ANCHORS)),
      setArmAnchor: (weaponId, a) => {
        const entry = ARM_ANCHORS[weaponId];
        if (!entry || !a) return null;
        if (a.r) entry.r = a.r;
        if (a.l !== undefined) entry.l = a.l;
        if (a.m) entry.m = a.m;
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
      elbows: () => JSON.parse(JSON.stringify(ELBOWS)),
      setElbow: (side, v) => { if (ELBOWS[side] && v) ELBOWS[side] = v; return JSON.parse(JSON.stringify(ELBOWS)); },
      colliders: () => colliders.slice(),
      pause: () => cancelAnimationFrame(rid),
      resume: () => { rid = requestAnimationFrame(loop); },
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
