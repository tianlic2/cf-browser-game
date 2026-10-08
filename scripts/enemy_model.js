// ===== 程序化士兵模型：自建关节骨架 + 程序化动画 =====
//
// 为什么弃用 models/soldier.glb：那个模型是**单网格静态姿势、没有骨骼也没有动画**
// （19 个 primitive 全是装备件，双臂垂在身侧），于是敌人只能整体平移，
// 枪只能作为刚体飘在胸前 —— 「自然」这件事在几何层面就做不到。
// 这里用基础几何自建一套带关节的骨架，走位/瞄准/开火/受击/倒地全部程序化驱动。
//
// 坐标系约定（与 enemies.js 一致）：**+z 是正面**、+y 是上、脚底在 y=0。
// 于是「朝右」是 -x（右手 = 扣扳机那只手在 -x 侧）。
//
// 旋转正负号（这套骨架里到处都要用，先记牢）：
//   朝上的骨（脊椎/颈）：rotation.x > 0 → 上端往 +z 倒 = **前倾**
//   朝下的骨（四肢）：  rotation.x > 0 → 末端往 -z 摆 = **向后摆**
// 所以「腿往前抬」是负的 rotation.x，「上身前倾」是正的 rotation.x。
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ---------- 骨架尺寸（身高 ≈ 1.82，与旧 GLB 的 1.8 同量级，命中体积不变）----------
// 骨盆静止高度：必须让「髋(0.95-0.04) → 踝(0.10)」的距离接近腿长(0.82)，否则站立时
// 膝盖会一直弯着 40° 以上 —— 站着也像半蹲（实测 PELVIS_Y=0.90 时膝角 44°）。
// 0.95 时跨度 0.81 ≈ 98.8% 腿长，膝角自然回到 ~18°，身高 1.82 与旧 GLB 同量级。
const PELVIS_Y = 0.95;   // 骨盆静止高度
const HIP_DY = -0.04;    // 髋关节相对骨盆原点
const HIP_X = 0.10;
const THIGH = 0.42;
const SHIN = 0.40;
const ANKLE_Y = 0.10;    // 踝关节离地高度（脚掌厚度 + 一点间隙，免得脚掌切进甲板）
const SPINE_Y = 0.06;    // 骨盆 → 脊椎
const CHEST_Y = 0.28;    // 脊椎 → 胸腔中心
const SHOULDER_X = 0.20;
const SHOULDER_Y = 0.22; // 肩相对胸腔中心 → 离地 1.46
const NECK_Y = 0.50;     // 脊椎 → 颈
// 上臂/前臂：真人 1.8m 的肩→肘 ≈0.32、肘→腕 ≈0.29（臂展 0.61）。
// **这两个值不是纯造型参数，而是 IK 的硬约束**：支撑手要按在护木上，
// **臂展是 0.61（= UPPER + FORE）**，不是 0.58 —— 旧注释写错了两处，已于本次改正；
// 引它之前先按 `UPPER + FORE` 现算一遍，别再抄。臂展配「枪心在胸前三四十厘米」
// 会让左臂被拉成一条直线（见 `RIFLE_ANCHORS` 上方那条 HANDGUARD 约束）。
const UPPER = 0.32;      // 上臂
const FORE = 0.29;       // 前臂
const LEG_REACH = THIGH + SHIN;

// ---------- 配色（CF 潜伏者：深橄榄制服 + 黑战术装具 + 红队标）----------
//
// 三档涂装轮排（`PALETTES`），肤色两档交错（`SKINS`）—— 8 具骨架一眼分得出谁是谁，
// 但仍读作同一支「潜伏者」部队。**只改颜色值、一件几何都不动**，所以逐敌配色是零调用代价的。
// 面具 / 镜片 / 队标三色**逐具固定**（那是装备规格，不是涂装；队标红色是全队的识别色）。
const PALETTES = [
  //  制服主色   深色件     装具     辅袋     靴       手套
  { cloth: 0x4c5138, cloth2: 0x3b4030, gear: 0x24262a, pouch: 0x6a6147, boot: 0x2b2d32, glove: 0x5c4d36 },
  { cloth: 0x8a7a56, cloth2: 0x6d6044, gear: 0x3a3226, pouch: 0x9c8a63, boot: 0x40382a, glove: 0x2e2b26 },
  { cloth: 0x55604e, cloth2: 0x434c3e, gear: 0x2e3237, pouch: 0x6f7566, boot: 0x33373a, glove: 0x6b5a41 },
  { cloth: 0x3f4430, cloth2: 0x31362a, gear: 0x22242a, pouch: 0x5c5540, boot: 0x282a2d, glove: 0x4a3f2f },
];
const SKINS = [0xa8815c, 0x8a6743];
// 面具 / 镜片 / 队标：逐具不变
const C_FIXED = { mask: 0x1a1c1f, lens: 0x3a5a63, team: 0xa8342f };

// 兜底：`C` 保留成「第 0 组」快照，供少数静态引用（如文件头注释里的色值）对照。
const C = Object.assign({}, PALETTES[0], C_FIXED, { skin: SKINS[0] });

// ---------- 三档装备构型（决定**剪影**）----------
//
// 与配色正交：构型管「身上挂着哪几件装具」，配色管「涂装」，两者相乘就是每具骨架的身份。
// 8 具按模块计数器 `SRIG_N` 轮排（见 `SoldierRig` 构造函数）。
//
// ⚠️ **每个构型合批后必须恰好 22 块**、且**每个桶在每个构型里都非空**。块数一旦随构型变，
// `cfdraw` / `cfhit` 那些 `find(e => !e.dead)` 取到的骨架形状就会漂，断言看起来全绿而其实
// 每轮量的不是同一具。
const KITS = {
  //           前后护板  肩带  背包  肩垫  大腿袋
  light: { plate: false, straps: false, pack: false, pauldron: false, thigh: false },
  std:   { plate: true,  straps: true,  pack: true,  pauldron: false, thigh: false },
  heavy: { plate: true,  straps: true,  pack: true,  pauldron: true,  thigh: true  },
};
const KIT_ORDER = ["light", "std", "heavy"];

// ---------- 几何体全局共享（同构型的敌人共用同一批 BufferGeometry，只克隆材质）----------
// 按**构型**缓存：`buildGeo(kit)` 每个构型只跑一次，8 具骨架共享同一批几何（不会 ×8 份）。
//
// ⚠️ 每个构型必须**恰好 22 块**、且**每个桶在每个构型里都非空** —— 否则块数会随构型变，
// 测试里 `find(!dead)` 取到的骨架形状会漂（cfdraw / cfhit 的断言全靠这个数）。
const GEO_CACHE = new Map();
export function geo(kit = 0) {
  let G = GEO_CACHE.get(kit);
  if (!G) { G = buildGeo(kit); GEO_CACHE.set(kit, G); }
  return G;
}

function buildGeo(kit) {
  const box = (w, h, d, tx = 0, ty = 0, tz = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(tx, ty, tz);
    return g;
  };
  // 骨段：从关节（原点）向 -y 伸展，正好对应「骨骼局部 -y 是骨段方向」
  const limb = (rTop, rBot, len) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, len, 7);
    g.translate(0, -len / 2, 0);
    return g;
  };
  const K = KITS[KIT_ORDER[kit]] || KITS.std;

  // ---------- 躯干/护甲 ----------
  //
  // 旧版只有 `vest` + `pouch` + `backPack` 三块，实测三个缺陷（贴脸特写 `/tmp/close-front.png`）：
  //   ① 背心 z ∈ [-0.12, 0.10] 被 `torso` 的 z ∈ [-0.125, 0.125] **完整包住** —— 正面只剩
  //      两侧各 2cm 黑边，胸口是一块没有细节的橄榄色平板。
  //   ② `pouch` z ∈ [0.14, 0.20] 比躯干前表面 0.125 还前出 7.5cm，**悬空**在胸前
  //      （旧 `vest` 厚度从 0.30 收到 0.22 时漏改了它的 tz）。
  //   ③ 右手被胸甲埋住 —— 见 `MOUNT_CARRY` 那条。
  //
  // 现在按**真实防弹背心的语汇**拆开：前后两块护板 + 侧腰围 + 两条肩带与肩带扣 + 过肩段 +
  // 拖拽提把 + 背包。弹匣袋**分三格排在腹前**（y ≈ -0.13），z 区间与前胸板重叠 2.2cm
  // ⇒ 贴死在板上、不再悬空。
  //
  // **弹匣袋必须让开中轴**：右手握点在胸腔系的 y ≈ +0.04、x ∈ [-0.04, 0.04]。
  // 三个弹匣袋排在 y ∈ [-0.19, -0.07] 是**握点以下**（正面看手在袋口之上），左胸那块
  // admin 小袋刻意偏到 x = -0.108 避开握点那条 x 带。改这块之前先看 `MOUNT_CARRY` 的注释。
  const gearParts = [
    // 轻装只剩一块薄胸挂基板 —— **这个桶在每个构型里都必须非空**
    K.plate ? box(0.34, 0.34, 0.026, 0, 0.005, 0.122)
            : box(0.36, 0.30, 0.030, 0, 0.010, 0.126),
  ];
  if (K.plate) {
    gearParts.push(
      box(0.31, 0.31, 0.024, 0, 0.010, -0.122),         // 后背板
      box(0.030, 0.24, 0.28, 0.172, 0.010, 0),          // 侧腰围 R
      box(0.030, 0.24, 0.28, -0.172, 0.010, 0),         // 侧腰围 L
    );
  }
  if (K.straps) {
    gearParts.push(
      box(0.052, 0.22, 0.022, 0.104, 0.075, 0.142),     // 前肩带 R（骑在护板之上）
      box(0.052, 0.22, 0.022, -0.104, 0.075, 0.142),
      box(0.064, 0.034, 0.020, 0.104, 0.170, 0.146),    // 肩带扣
      box(0.064, 0.034, 0.020, -0.104, 0.170, 0.146),
      box(0.056, 0.024, 0.235, 0.104, 0.230, -0.010),   // 过肩段
      box(0.056, 0.024, 0.235, -0.104, 0.230, -0.010),
      box(0.086, 0.022, 0.052, 0, 0.150, -0.145),       // 拖拽提把
    );
  }
  if (K.pack) gearParts.push(box(0.22, 0.24, 0.09, 0, 0.030, -0.150));

  const pouchParts = [
    box(0.095, 0.115, 0.062, -0.115, -0.130, 0.144),    // 弹匣袋 ×3
    box(0.095, 0.115, 0.062, 0.000, -0.130, 0.144),
    box(0.095, 0.115, 0.062, 0.115, -0.130, 0.144),
    box(0.072, 0.105, 0.058, 0.152, -0.070, 0.138),     // 侧袋 ×2
    box(0.072, 0.105, 0.058, -0.152, -0.070, 0.138),
    box(0.098, 0.072, 0.046, -0.108, 0.070, 0.148),     // 左胸 admin 小袋
  ];

  // 衣领：重装再叠一圈加宽的护颈。**顶面刻意压在 0.250 以下**（= 离地 1.54m）——
  // 头部命中盒的底面在 1.535，再高就会有一条横带挡在下巴前面把爆头吞掉。
  const collarParts = [box(0.30, 0.08, 0.24, 0, 0.24, 0)];
  if (K.pauldron) collarParts.push(box(0.28, 0.055, 0.25, 0, 0.222, -0.005));

  // ---------- 头盔 ----------
  //
  // 旧版是一块 0.245×0.13×0.27 的平板 + 一条帽檐 —— 正面看就是个方盒子扣在头上，
  // 是「这是一块积木」最直白的一处。现在按**战斗头盔的语汇**拆开：
  // 压扁的半球圆顶 + 后侧裙 + 护目板 + 左右护耳 + NVG 座/筒。
  //
  // ⚠️ **头部 AABB 是硬约束**（它同时锁住爆头命中盒与尸体 pivot 两件玩法数值）：
  //      x ∈ [-0.125, +0.125]   y ∈ [-0.120, +0.165]   z ∈ [-0.135, +0.180]
  // 这六个数是**实测出来的**（不是抄来的规矩）：x 由帽檐 0.25 宽给出、y 上界由旧头盔顶
  // 0.165 给出（头部命中盒的顶）、y 下界由面罩 -0.12、z 下界由旧头盔后壁 -0.135、
  // z 上界 0.18 由帽檐前缘给出 —— 而 z 的上界**正是尸体 pivot 那条约束的源头**
  // （`h = max(root 系 z)`，见 `/tmp/cfpivot.mjs`）。加件之前先把这三条算一遍，
  // 任何一轴超出去都要同步改 `enemies.js` 的 0.26 与 `CORPSE_SINK`。
  //
  // 本设计三轴全部**顶格但不越界**（圆顶最宽 ±0.125、顶面 0.165；侧裙后壁 -0.135；
  // 帽檐前缘 0.18）⇒ pivot 的 0.2613 一分不动。
  const helmetDome = new THREE.SphereGeometry(0.125, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  helmetDome.scale(1, 0.84, 1);             // 压扁：y 半径 0.105，顶面落在 0.165
  helmetDome.translate(0, 0.06, -0.01);
  const helmetParts = [
    helmetDome,                                        // 圆顶（顶面 0.165 / 最宽 ±0.125）
    // 后侧裙。**前缘止于 0.065** —— 护目镜从 0.08 起、面罩从 0.07 起，再往前伸就是
    // 「镜片被头盔吞掉一半」（旧版头盔 z ∈ [-0.135, 0.135] 就把护目镜背面压住了）。
    box(0.21, 0.095, 0.20, 0, 0.012, -0.035),
    // 护目板 / 帽檐：**宽度取旧版的 0.245 而不是 0.25**（前缘同样 0.18）。这一档不是
    // 审美 —— 死姿里 `h = max(root 系 z)` 的极值点就是这块板的 (−x, +z) 那个角：脖子
    // 转 1.15rad 后 world z ≈ −0.913·x + 0.409·z，x 每让出 1mm 就把极值拉回 0.9mm。
    // 0.25 时实测 0.2620（比旧版 0.2613 还多烂 0.7mm），0.245 落回 0.2597 ≤ 0.26，
    // `enemies.js` 那个常量才真的不用动。**改这块板先看 `cfpivot`。**
    box(0.245, 0.042, 0.10, 0, 0.048, 0.13),           // 护目板 / 帽檐（前缘 0.18）
    box(0.032, 0.080, 0.10, -0.104, -0.015, -0.035),   // 护耳 R
    box(0.032, 0.080, 0.10, 0.104, -0.015, -0.035),    // 护耳 L
    // NVG 座/筒骑在圆顶**前斜面**上（y 0.12 处圆顶半径 0.10，座的 z 0.065~0.115 正好
    // 一半埋进圆顶、一半探出来）。放在正顶面会整块悬空 —— 圆顶到 0.165 时已经收成一点了。
    box(0.055, 0.032, 0.050, 0, 0.122, 0.090),         // NVG 座
    box(0.045, 0.045, 0.045, 0, 0.115, 0.135),         // NVG 筒
  ];

  const G = {
    pelvis: box(0.32, 0.22, 0.24),
    torso: box(0.36, 0.46, 0.25),
    head: box(0.19, 0.23, 0.21),
    mask: box(0.175, 0.10, 0.06, 0, -0.07, 0.10),
    goggles: box(0.215, 0.065, 0.05, 0, 0.005, 0.105),
    arm: limb(0.062, 0.050, UPPER),
    fore: limb(0.052, 0.044, FORE),
    hand: box(0.082, 0.11, 0.082, 0, -0.045, 0),
    thigh: limb(0.100, 0.080, THIGH),
    shin: limb(0.076, 0.058, SHIN),
    foot: box(0.11, 0.08, 0.25, 0, -0.045, 0.06),
    teamBand: box(0.075, 0.05, 0.075, 0, -0.02, 0.09),
    // 关节球：低多边形骨段在弯折处会露出断口（膝盖弯 78° 时最明显），塞一个球补上
    jointBig: new THREE.SphereGeometry(0.085, 8, 6),
    jointMid: new THREE.SphereGeometry(0.068, 8, 6),
  };
  // ---------- 四肢护具 ----------
  //
  // 护肘 / 护膝 / 靴子三件（肩垫与大腿袋只有重装挂，见 `KITS`）**全部并进已有的桶**，
  // 一个材质都不新开。新开一个桶要付每帧 +16~32 次调用（8 具 × 2 侧 × 2 处），换一点颜色不值 ——
  // 所以它们只提供**剪影**，颜色对比由逐敌配色免费提供（见 `PALETTES`）。
  //
  // 尺寸是**照着关节球反推**的，不是拍脑袋：`jointBig` 半径 0.085、`jointMid` 0.068，
  // 护具比球窄就是白挂（球本来就是这条腿上最宽的一件）。所以护膝取 0.175 宽（±0.0875，
  // 压过球 2.5mm）、护肘取 0.125（±0.0625，压过上臂 0.062 只 0.5mm）。z 方向才是主要露出量：
  // 护膝前缘 0.1025 比球面 0.085 前出 1.75cm、护肘 0.08 比 0.068 前出 1.2cm。
  //
  // 靴子三件：包头（前出 2cm）+ 靴筒口（裹住小腿最下 5.8cm）。**没有鞋底** ——
  // 脚掌本来就停在离地 1.5cm（`ANKLE_Y 0.10` 减去脚高），再垫一层要动 `ANKLE_Y`，
  // 那会连带改整条腿的解析解，换不到可读性。
  const shParts = [G.jointMid, G.arm];
  if (K.pauldron) shParts.push(box(0.135, 0.060, 0.145, 0, 0.006, 0));
  const elParts = [G.jointMid, G.fore, box(0.125, 0.090, 0.100, 0, -0.006, 0.030)];
  const hipParts = [G.jointBig, G.thigh];
  // 大腿袋挂在**正前方**（x 居中）：`hipThigh` 是两侧共用的同一份几何，带 x 偏移的话
  // 会在一条腿上是外侧、另一条腿上变成内侧。
  if (K.thigh) hipParts.push(box(0.085, 0.125, 0.075, 0, -0.17, 0.090));
  const kneeParts = [G.jointBig, G.shin, box(0.175, 0.105, 0.125, 0, -0.012, 0.040)];
  const footParts = [
    G.foot,
    box(0.108, 0.060, 0.065, 0, -0.048, 0.175),        // 包头
    box(0.105, 0.060, 0.115, 0, 0.028, 0.010),         // 靴筒口
  ];

  // ---------- 同父同材质预合批（每具 22 块）----------
  //
  // 每个（骨骼 × 材质）桶里的几何合成一块。同父 ⇒ 动画里永远一起走，同材质 ⇒ 本来就是
  // 一次绘制，拆成多块纯粹是多出来的调用。
  //
  // **合并不需要任何矩阵烘焙**：上面 box()/limb() 造几何时已经把偏移 translate 进去了，
  // 各件几何都直接表达在**父骨骼的局部系**里，所以合并就是纯拼接（顶点原地首尾相接）。
  // 也正因为如此，同一棵树的合批前后世界顶点集合**逐个一致**。
  //
  // **每一桶都走 `mergeAll` 一次给全**（历史写法 `mergePair` 只吃两件，现已删除）：
  // 件数随构型变（轻装护甲 1 件、重装 12 件），而 `mergePair(mergePair(a,b),c)` 那种嵌套在
  // `?nobatch` 下会静默丢掉除两件之外的全部（见 `mergeAll` 那条注释）。
  // 同时把**未合批的件表**留在 `G` 上，构造函数的 `addN` 在兜底分支里要靠它逐件挂回。
  //
  // 失败兜底：属性集不一致时 `mergeGeometries` 返回 null 并在控制台留一行 error
  // （污染「零报错」断言），所以这里**不复用那个返回值当判据** —— 合不了就留 null，
  // 由构造里的 `addN()` 退回逐个挂。宁可多几次 draw call，也不能少一块身体。
  //
  // **合批的正确性判据是「世界顶点云逐个一致」**（`/tmp/cfemerge.mjs`）：同一份源码
  // 合批树 vs `?nobatch` 树，顶点数 / 三角形数 / 点云校验和 / 包围盒四项全部相等；
  // 头部命中网格合批后 4 块、`part="head"` 标签仍在，打头依旧一击必杀（`/tmp/cfhit.mjs`）。
  // **别只截图比对** —— 漏挂一块在截图上很难看出来，而这条断言一眼就红。
  G.shArm = mergeAll(shParts);
  G.elFore = mergeAll(elParts);
  G.hipThigh = mergeAll(hipParts);
  G.kneeShin = mergeAll(kneeParts);
  G.bootSet = mergeAll(footParts);
  G.helmetSet = mergeAll(helmetParts);
  G.gear = mergeAll(gearParts);
  G.pouchSet = mergeAll(pouchParts);
  G.collarSet = mergeAll(collarParts);

  G.shParts = shParts;
  G.elParts = elParts;
  G.hipParts = hipParts;
  G.kneeParts = kneeParts;
  G.bootParts = footParts;
  G.helmetParts = helmetParts;
  G.gearParts = gearParts;
  G.pouchParts = pouchParts;
  G.collarParts = collarParts;
  return G;
}

// 同父同材质的一批几何合成一件。合不了返回 null（调用方 `addN` 退回逐个挂）。
// 只在 buildGeo() 里跑一次，所以合并出来的几何是**同构型全敌人共享**的（8 具不会各造一份）。
//
// `?nobatch` 让这里**恒返回 null** —— 于是 `addN()` 走它本来就有的退回分支，
// 得到的就是合批前的几何树。这不是新加第二条路径（退回分支本来就在，只是给
// 「mergeGeometries 失败」用的），而是把同一个兜底接到那面旗子上：骨段合批改的
// 正是**射线目标**（敌人网格就在 `flatTargets()` 里），而「合批把命中判定弄坏了」
// 恰恰是 `?nobatch` 存在的理由。不加这一句的话，这类回归没有对照可跑 ——
// 截图上什么都看不出来，只会表现为「打头不秒杀」。
// 旗子与 `scripts/map.js` 的 `NO_BATCH` **同源同名**（那边管地图静态合批），
// 三个模块各自读一次 `location.search`，刻意不抽公共模块：读法只有一行。
const NO_BATCH = typeof location !== "undefined"
  && new URLSearchParams(location.search).has("nobatch");

// **绝不能嵌套调用** `mergeAll([mergeAll([a, b]), c])`：`?nobatch` 时内层返回 `null`，
// 外层就成了 `mergeGeometries([null, c])` —— 异常被这里吞掉 ⇒ 返回 null ⇒ 调用方
// 只挂回 2 件，**剩下的件静默消失**（没有报错、没有控制台痕迹，只是画面上少了一块）。
// 一律**一次给全整张件表**。
function mergeAll(parts) {
  if (NO_BATCH || parts.length < 2) return null;
  try { return mergeGeometries(parts, false) || null; } catch (e) { return null; }
}

// ---------- 挂枪常量 ----------
export const RIFLE_LEN = 0.92;
const RIFLE_HALF = RIFLE_LEN / 2;
const RIFLE_YAW = Math.PI / 2;   // AK 枪口在本体 -x，+90° → 指向本组 +z

// 两个握点（相对枪心、在枪自身坐标系里）：扣扳机的手在下后方，托举手在护木上
// 握点/护木点（mount 本地系）：归一化后是「中心归零、枪口朝 +z」的一根长枪（全长 0.92），
// 扳机握把在中心**之后**约 19cm，木护木在中心之前约 10cm —— 这两个值是从实测截图上
// 量出来的（用像素比例反推），不是拍脑袋。放错会让左手够到枪管中段。
// 更硬的一条约束：左肩(0.20, 0.22, 0) 到护木点的距离必须明显小于**臂展 0.61**
// （= `UPPER + FORE`，**不是 0.58** —— 旧注释抄错了，引之前现算一遍）。
// 否则 IK 被迫把支撑臂拉成一条直线，看起来像「枪飘在胸前、手够不着」。
// 现在的实测负载：低姿 85.4% / 据枪 85.5%（肘弯 ~63°），上限取 90%
// —— 推导与余量见 `MOUNT_CARRY` 那条注释。
//
// **按枪型号分开取**：三把枪归一化后都在同一个 0.92 的盒子里、枪口都朝 +z，
// 但握把/护木在盒子里的位置不同（AWM 是手动枪机、M4 的护木更长），共用一套会让某把枪的手插进枪身。
// 形态照抄 viewarms.js 的 ARM_ANCHORS：**导出成可变对象**，可以用 __tactical 在线微调，
// 不必为了挪一厘米重启页面（初值三把暂时相同，是实测截图后按需分别调的起点）。
export const RIFLE_ANCHORS = {
  ak: { grip: new THREE.Vector3(0, -0.10, -0.19), handguard: new THREE.Vector3(0, -0.04, 0.10) },
  m4: { grip: new THREE.Vector3(0, -0.10, -0.19), handguard: new THREE.Vector3(0, -0.04, 0.10) },
  awm: { grip: new THREE.Vector3(0, -0.10, -0.19), handguard: new THREE.Vector3(0, -0.04, 0.10) },
};

// 两个持枪姿态（相对胸腔中心的枪心位置 + 俯仰；俯仰 >0 = 枪口压下）。
//
// **`MOUNT_CARRY.z` 是「右手看得见看不见」的唯一旋钮，不是造型参数。**
// 低姿（pitch 0.30）下 `mount.matrix` 把两个握点送到：
//     gripTarget = (x_m, y_m − 0.03939, z_m − 0.21107)
//     hgTarget   = (x_m, y_m − 0.06777, z_m + 0.08371)
// 旧值 z 0.30 ⇒ 右腕 z = 0.0889，而躯干前表面在 0.125、「前胸板」前表面在 0.135
// —— 右腕**在胸甲内部**，手网格还沿前臂朝里伸，正面完全看不见（`/tmp/cfhand.mjs` 实测
// 低姿 0/8 角露出）。**薄化躯干赚不回可见性**：就算护甲薄到 0.11 也只赚 1.5cm，右腕仍在里面
// 2.1cm。所以只挪挂点，`torso` 保持 0.25 不动（薄化还要连带重排护甲/背包的 tz，收益为负）。
//
// z 0.30 → 0.35 让握点前进 5.0cm（越过前胸板），同时 y 0.04 → 0.08 把**左臂**从 89.5%
// 拉回 85.4% —— 正好与据枪姿态的 85.5% 齐平，这次改动**没让瞄准姿态变差一分**。
// 左臂负载上限取 **90%**（0.549，肘弯 ≥51°）：留 10% 到硬 clamp `(0.32+0.29)×0.999 = 0.6094`
// 的余量。95% 只剩 4.8%，后坐/致盲/倒地插值一旦把目标推远就会顶到 clamp、手从枪上脱开。
const MOUNT_CARRY = { x: 0.00, y: 0.08, z: 0.35, pitch: 0.30 };
const MOUNT_AIM = { x: -0.02, y: 0.15, z: 0.36, pitch: 0.0 };

// 步频松驰系数：严格「支撑脚世界坐标不动」要求步幅与走过路程严格相等，
// 而腿长把跨步锁死在 ±0.32m → 3.4m/s 下要 5Hz 的步频，看着像小碎步。
// 这里让步幅与腿长脱钩 28%（支撑脚会缓慢前滑），换回接近真人的 ~3.7Hz。
const CADENCE_SLIP = 0.72;
const HALF_STRIDE_MAX = 0.32;

// ---------- 临时变量（避免每帧 new）----------
const DOWN = new THREE.Vector3(0, -1, 0);
const _i1 = new THREE.Vector3();
const _i2 = new THREE.Vector3();
const _i3 = new THREE.Vector3();
const _iq = new THREE.Quaternion();

// 两骨 3D IK：把 root→(上段→下段) 的末端拉到 target。全部在「上段父级坐标系」里算，
// 骨段朝局部 -y 伸展所以基准方向是 (0,-1,0)；pole 决定中间关节往哪边顶。
// 结果写进 qUp（上段局部四元数）与 qLo（下段相对上段的四元数）。
function ik2(root, target, pole, lenUp, lenLo, qUp, qLo) {
  _i1.subVectors(target, root);
  let d = _i1.length();
  const reach = (lenUp + lenLo) * 0.999;
  if (d > reach) { _i1.multiplyScalar(reach / d); d = reach; }
  else if (d < 0.05) { _i1.multiplyScalar(0.05 / Math.max(d, 1e-5)); d = 0.05; }
  const dir = _i2.copy(_i1).multiplyScalar(1 / d);            // 单位方向
  // 上段方向 = dir 绕 (dir × pole) 旋 A（余弦定理）→ 中间关节被 pole 顶向一侧
  const cosA = (lenUp * lenUp + d * d - lenLo * lenLo) / (2 * lenUp * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  _i3.crossVectors(dir, pole);
  if (_i3.lengthSq() < 1e-9) _i3.set(1, 0, 0).cross(dir);     // pole 与 dir 共线的退化兜底
  _i3.normalize();
  const upDir = _i1.copy(dir).applyAxisAngle(_i3, A).normalize();
  qUp.setFromUnitVectors(DOWN, upDir);
  // 下段方向 = 末端 - 中间关节；换算到上段局部系再取四元数
  const joint = _i3.copy(root).addScaledVector(upDir, lenUp);
  const loDir = _i1.copy(target).sub(joint).normalize();
  _iq.copy(qUp).invert();
  loDir.applyQuaternion(_iq);
  qLo.setFromUnitVectors(DOWN, loDir);
}

// IK 常量入参：肩点、极向量（肘往哪边顶）、致盲捂脸目标、倒地松手目标
const _shR = new THREE.Vector3(-SHOULDER_X, SHOULDER_Y, 0);
const _shL = new THREE.Vector3(SHOULDER_X, SHOULDER_Y, 0);
const _poleR = new THREE.Vector3(-1.0, -0.75, -0.35).normalize();
const _poleL = new THREE.Vector3(0.75, -1.0, -0.15).normalize();
// 致盲捂脸的目标点。**z 必须大于护甲前表面**（前胸板 0.135 / 肩带 0.153）——
// 旧值 0.16 配老背心够用，现在会被前肩带顶穿 1cm，所以提到 0.20。
const _faceT = new THREE.Vector3(0.10, SHOULDER_Y + 0.10, 0.20);
// 倒地时枪滑到的位置（胸腔系）与横转角：z 收回到 0.06 是为了让枪落在甲板上而不是甲板下
const _mountDeadP = new THREE.Vector3(-0.02, -0.22, 0.06);
const _MOUNT_DEAD_PITCH = 0.45;
const RIFLE_DEATH_YAW = 1.5;   // 叠加在 RIFLE_YAW 上的横转量（≈86°，几乎垂直于身体）
const _dropR = new THREE.Vector3(-0.26, -0.28, -0.10);
const _dropL = new THREE.Vector3(0.30, -0.32, -0.06);
// 握点目标（每帧从常量算出来，绝不在 GRIP/HANDGUARD 上原地 applyMatrix4）
const _gripT = new THREE.Vector3();
const _hgT = new THREE.Vector3();

// 逐具骨架的身份计数器。**必须在构造期取、不能放进 `reset()`**：
// `EnemyManager` 是对象池（`acquire()` 从 `free` 弹出复用），在 `reset()` 里换色的话
// 捞出来的人会**继承上一具尸体的配色**，症状是「敌人颜色随机跳」、极难归因。
// 定死在构造期从结构上消灭这条路径 —— 代价是 `enemies.js` / `main.js` 一个字都不用改。
let SRIG_N = 0;

export class SoldierRig {
  constructor(rifleTemplate) {
    // `3` 与 `4` 互质 ⇒ 前 8 具给出 8 组**两两不同**的 (kit, palette)；肤色按 idx 折半交错。
    this.variant = {
      idx: SRIG_N,
      kit: SRIG_N % 3,
      palette: SRIG_N % 4,
      skin: (SRIG_N >> 1) % 2,
    };
    SRIG_N++;
    const G = geo(this.variant.kit);
    const mkMat = (color, rough = 0.82, metal = 0.05) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

    // 每个敌人一份材质（受击闪红要各自独立），几何体共享
    const C = Object.assign({}, PALETTES[this.variant.palette] || PALETTES[0], C_FIXED,
      { skin: SKINS[this.variant.skin] || SKINS[0] });
    this.matCloth = mkMat(C.cloth);
    this.matCloth2 = mkMat(C.cloth2);
    this.matGear = mkMat(C.gear, 0.9);
    this.matPouch = mkMat(C.pouch, 0.9);
    this.matGlove = mkMat(C.glove, 0.85);
    this.matBoot = mkMat(C.boot, 0.9);
    this.matSkin = mkMat(C.skin, 0.75);
    this.matMask = mkMat(C.mask, 0.7);
    this.matLens = mkMat(C.lens, 0.25, 0.45);
    this.matTeam = mkMat(C.team, 0.7);
    this.mats = [
      this.matCloth, this.matCloth2, this.matGear, this.matPouch, this.matGlove,
      this.matBoot, this.matSkin, this.matMask, this.matLens, this.matTeam,
    ];
    this.headMats = [this.matMask, this.matGear];   // 爆头闪得更狠

    this.meshes = [];
    const add = (parent, geometry, material, part) => {
      const m = new THREE.Mesh(geometry, material);
      m.castShadow = false;
      m.receiveShadow = false;
      if (part) m.userData.part = part;
      parent.add(m);
      this.meshes.push(m);
      return m;
    };
    // 同父同材质的一批：合批成功就挂那一块合并几何（省若干次绘制调用），
    // 失败（`merged === null`，含 `?nobatch`）就原样逐个挂 —— 宁可多几次 draw call，
    // 也不能少一块身体。`part` 照原样打上（同桶的件本来就同 `part`，如头盔族全是 "head"）。
    // **两条路都必须把每一件都挂上** —— 这是它一次吃整张件表、而不是两两合并的原因。
    const addN = (parent, merged, parts, material, part) => {
      if (merged) return add(parent, merged, material, part);
      for (const g of parts) add(parent, g, material, part);
    };

    // ---------- 层级：root → pelvis →（spine → chest → 双臂/头/枪）+ 双腿 ----------
    const root = new THREE.Group();
    const pelvis = new THREE.Group();
    pelvis.position.y = PELVIS_Y;
    root.add(pelvis);
    add(pelvis, G.pelvis, this.matCloth2);
    add(pelvis, G.teamBand, this.matTeam);

    const spine = new THREE.Group();
    spine.position.y = SPINE_Y;
    pelvis.add(spine);

    const chest = new THREE.Group();
    chest.position.y = CHEST_Y;
    spine.add(chest);
    add(chest, G.torso, this.matCloth);
    addN(chest, G.gear, G.gearParts, this.matGear);
    addN(chest, G.pouchSet, G.pouchParts, this.matPouch);
    addN(chest, G.collarSet, G.collarParts, this.matCloth2);

    // 头
    const neck = new THREE.Group();
    neck.position.y = NECK_Y;
    spine.add(neck);
    const head = new THREE.Group();
    head.position.y = 0.14;
    neck.add(head);
    add(head, G.head, this.matSkin, "head");
    addN(head, G.helmetSet, G.helmetParts, this.matGear, "head");
    add(head, G.mask, this.matMask, "head");
    add(head, G.goggles, this.matLens, "head");

    // 双臂（肩 → 上臂 → 肘 → 前臂 → 手）
    const mkArm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * SHOULDER_X, SHOULDER_Y, 0);
      chest.add(sh);
      addN(sh, G.shArm, G.shParts, this.matCloth2);
      const el = new THREE.Group();
      el.position.y = -UPPER;
      sh.add(el);
      addN(el, G.elFore, G.elParts, this.matCloth2);
      const hd = new THREE.Group();
      hd.position.y = -FORE;
      el.add(hd);
      add(hd, G.hand, this.matGlove);
      return { sh, el, hd };
    };
    this.armR = mkArm(-1);   // -x 是右手（扣扳机）
    this.armL = mkArm(1);

    // 双腿（髋 → 大腿 → 膝 → 小腿 → 踝 → 脚）
    const mkLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * HIP_X, HIP_DY, 0);
      pelvis.add(hip);
      addN(hip, G.hipThigh, G.hipParts, this.matCloth2);
      const knee = new THREE.Group();
      knee.position.y = -THIGH;
      hip.add(knee);
      addN(knee, G.kneeShin, G.kneeParts, this.matCloth2);
      const ankle = new THREE.Group();
      ankle.position.y = -SHIN;
      knee.add(ankle);
      addN(ankle, G.bootSet, G.bootParts, this.matBoot);
      return { hip, knee, ankle };
    };
    this.legR = mkLeg(-1);
    this.legL = mkLeg(1);

    // 枪：挂在胸腔的挂点上，位置/俯仰由姿态插值驱动。
    // 枪型每局随机（见 guncatalog.js），所以真正挂上去是 setRifle() 干的 —— 对象池复用
    // 也要能换枪，不能只在构造函数里挂一次。
    this.mount = new THREE.Group();
    chest.add(this.mount);
    this.rifle = null;
    this.rifleYaw = RIFLE_YAW;
    this.anchors = RIFLE_ANCHORS.ak;
    if (rifleTemplate) this.setRifle(rifleTemplate);

    this.root = root;
    this.pelvis = pelvis;
    this.spine = spine;
    this.chest = chest;
    this.neck = neck;
    this.head = head;

    // 动画状态
    this._fR = { v: new THREE.Vector3(), lift: 0 };
    this._fL = { v: new THREE.Vector3(), lift: 0 };
    this._sR = { z: 0, lift: 0 };
    this._sL = { z: 0, lift: 0 };
    this.mountPos = new THREE.Vector3();
    this.mountPitch = 0;
    this.phase = 0;
    this.pelvisY = PELVIS_Y;
    this.aimBlend = 0;
    this.kick = 0;         // 开火后坐（每次射击置 1，指数衰减）
    this.breath = 0;
    this.deathBlend = 0;
    this.walkW = 0;
    this.reset();
  }

  // 换枪。枪型是每局随机的（见 scripts/guncatalog.js），而敌人是对象池复用的，
  // 所以**每次刷出**都要走这里，不能只在构造函数里挂一次。
  // 模板是目录缓存的共享对象（同一个「枪型+皮肤」的材质在所有实例间共用），
  // 所以**不 dispose 旧的** —— dispose 会连累其它敌人和目录本身。
  setRifle(template, gunId) {
    if (this.rifle) this.mount.remove(this.rifle);
    this.rifle = template ? template.clone(true) : null;
    if (this.rifle) this.mount.add(this.rifle);
    // 枪的朝向由 animate() 每帧写死（倒地时还要叠 RIFLE_DEATH_YAW），所以这里把模板上
    // 已经烘好的角度记下来当基准：不同枪的 GLB 原始朝向不同，目录按「枪口朝本组 +z」
    // 各自烘了一个角度，不能一律用 RIFLE_YAW。
    this.rifleYaw = this.rifle ? this.rifle.rotation.y : RIFLE_YAW;
    this.anchors = RIFLE_ANCHORS[gunId] || RIFLE_ANCHORS.ak;
  }

  reset() {
    this.phase = Math.random() * Math.PI * 2;
    this.pelvisY = PELVIS_Y;
    this.aimBlend = 0;
    this.kick = 0;
    this.deathBlend = 0;
    this.walkW = 0;
    this.breath = Math.random() * Math.PI * 2;
    this.pelvis.position.set(0, PELVIS_Y, 0);
    this.pelvis.rotation.set(0, 0, 0);
    this.spine.rotation.set(0, 0, 0);
    this.chest.rotation.set(0, 0, 0);
    this.neck.rotation.set(0, 0, 0);
    this.mount.position.set(MOUNT_CARRY.x, MOUNT_CARRY.y, MOUNT_CARRY.z);
    this.mount.rotation.set(MOUNT_CARRY.pitch, 0, 0);
    this.mount.updateMatrix();
    this.animate(0, { moved: 0, speed: 0, aim: 0, blind: 0, flinch: 0, dead: false });
  }

  // 开火后坐：由 enemies.js 每发调用一次
  recoil() { this.kick = 1; }

  // 受击闪红（几何体共享、材质每人一份，所以只管这套材质）
  setFlash(k) {
    for (const m of this.mats) {
      const hot = this.headMats.indexOf(m) >= 0 ? 1 : 0.5;
      m.emissive.setRGB(0.85 * k * hot, 0.025 * k, 0.025 * k);
    }
  }

  // 枪口在 body 系（脚底为原点）的位置 —— 供 main.js 的枪口火光 / 枪声定位用。
  // 解析式而不是 localToWorld：后者依赖 matrixWorld，要等下一次 render 才更新，
  // 新生敌人会算到世界原点（历史上 attachMuzzleTo 踩过同一个坑）。
  muzzleBody(out) {
    out.set(0, 0.02, RIFLE_HALF + 0.03).applyMatrix4(this.mount.matrix);
    out.y += this.pelvis.position.y + SPINE_Y + CHEST_Y;
    return out;
  }

  // ---------- 每帧程序化动画 ----------
  // s: { moved, speed, aim, aimPitch, blind, flinch, dead }
  animate(dt, s) {
    const moved = Math.max(0, Number.isFinite(s.moved) ? s.moved : 0);
    const speed = Math.max(0, Number.isFinite(s.speed) ? s.speed : 0);
    const aim = clamp01(s.aim || 0);
    const aimPitch = Number.isFinite(s.aimPitch) ? s.aimPitch : 0;   // >0 = 目标更低
    const blind = clamp01(s.blind || 0);
    const flinch = clamp01(s.flinch || 0);
    this.breath += dt * 1.6;
    this.kick *= Math.exp(-dt * 11);                  // 后坐衰减（帧率无关）
    this.aimBlend += (aim - this.aimBlend) * (1 - Math.exp(-dt * 5.5));
    this.deathBlend += ((s.dead ? 1 : 0) - this.deathBlend) * (1 - Math.exp(-dt * 7));

    // ① 步幅跟着速度走，相位跟着「走过的路程」走 —— 支撑脚的脚底才不会打滑
    const walkW = clamp01((speed - 0.25) / 1.1);
    this.walkW = walkW;
    const halfStride = Math.min(HALF_STRIDE_MAX, Math.max(0.06, speed * 0.10));
    this.phase += (Math.PI * moved * CADENCE_SLIP) / (2 * halfStride);

    // ② 脚的前后位置与抬脚高度：支撑期在本体系里匀速后移（= 世界坐标里不动），
    //    摆动期抬起前摆。z/y 都不依赖骨盆高度，所以可以先算出来。
    const strideOf = (ph, out) => {
      const q = ((ph % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (q < Math.PI) {                        // 支撑期
        out.z = halfStride * (1 - (2 * q) / Math.PI);
        out.lift = 0;
      } else {                                  // 摆动期
        const u = (q - Math.PI) / Math.PI;
        out.z = -halfStride * Math.cos(Math.PI * u);
        out.lift = 0.15 * Math.sin(Math.PI * u);
      }
      out.z *= walkW;                           // 站定时把脚收回髋下（避免僵在跨步姿势上）
      out.lift *= walkW;
      return out;
    };
    const sR = strideOf(this.phase + Math.PI, this._sR);
    const sL = strideOf(this.phase, this._sL);

    // ③ 骨盆高度：取两条腿「刚刚够得着」的上界 —— 自然生成走路时的一起一伏，
    //    且永远不会把腿拉脱臼（超出伸展范围时 IK 会把脚拽离地面）。
    //    **必须在算脚的目标点之前定下来**：目标点是「相对骨盆」的，
    //    用上一帧的骨盆高度会把脚带偏 1~2cm（实测脚掌会切进甲板）。
    const bound = (s) =>
      ANKLE_Y - HIP_DY + s.lift + Math.sqrt(Math.max(0.02, (LEG_REACH * 0.99) ** 2 - s.z * s.z));
    const wantY = Math.min(PELVIS_Y, Math.min(bound(sR), bound(sL))) - 0.012 * walkW;
    this.pelvisY += (wantY - this.pelvisY) * (1 - Math.exp(-dt * 15));
    const idleW = 1 - walkW;
    this.pelvis.position.y = this.pelvisY + idleW * Math.sin(this.breath) * 0.008;
    this.pelvis.position.x = Math.sin(this.phase) * 0.022 * walkW;
    this.pelvis.rotation.z = Math.sin(this.phase) * 0.05 * walkW;
    this._fR.v.set(-HIP_X, -this.pelvisY + ANKLE_Y + sR.lift, sR.z);
    this._fL.v.set(HIP_X, -this.pelvisY + ANKLE_Y + sL.lift, sL.z);
    const fR = this._fR, fL = this._fL;

    // ④ 腿：纯 2D 解算（腿只在矢状面里摆，解析式比四元数 IK 更稳更省）
    const solveLeg = (leg, f) => {
      const dy = f.v.y - HIP_DY, dz = f.v.z;
      const d = Math.min(LEG_REACH * 0.995, Math.hypot(dy, dz));
      const base = Math.atan2(dz, -dy);                                    // 髋→踝 偏角（前为正）
      const cosA = (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d);
      const thighA = base + Math.acos(Math.max(-1, Math.min(1, cosA)));    // 膝盖朝前顶
      const kneeZ = Math.sin(thighA) * THIGH, kneeY = -Math.cos(thighA) * THIGH;
      const shinA = Math.atan2(f.v.z - kneeZ, -(f.v.y - kneeY));
      leg.hip.rotation.x = -thighA;
      leg.knee.rotation.x = thighA - shinA;
      // 脚掌踩平（抵消小腿的绝对倾角），摆动期再让脚尖下垂一点
      leg.ankle.rotation.x = shinA - f.lift * 1.6;
    };
    solveLeg(this.legR, fR);
    solveLeg(this.legL, fL);

    // ⑤ 躯干：跑起来前倾、走起来左右微扭、受击后仰（都是小幅，不夺走「朝向=瞄准」这个前提）
    this.spine.rotation.x = 0.05 + 0.09 * walkW + 0.05 * blind - flinch * 0.26;
    this.spine.rotation.y = Math.sin(this.phase) * 0.09 * walkW * (1 - this.aimBlend) - flinch * 0.14;
    this.spine.rotation.z = blind * (0.08 + Math.sin(this.breath * 1.7) * 0.06);

    // ⑥ 头：跑动时抬起来一点、致盲时低头乱晃、受击时向后甩
    this.neck.rotation.x = -0.04 * walkW + Math.sin(this.breath * 0.9) * 0.02
      + blind * 0.20 - flinch * 0.30;
    this.neck.rotation.y = blind
      ? Math.sin(this.breath * 2.3) * 0.45
      : Math.sin(this.breath * 0.7) * 0.06;

    // ⑦ 枪：低姿 ↔ 据枪 插值，开火时往肩里推 + 抬枪口
    const k = this.aimBlend;
    const kick = this.kick;
    const db = this.deathBlend;
    this.mountPos.set(
      MOUNT_CARRY.x + (MOUNT_AIM.x - MOUNT_CARRY.x) * k,
      MOUNT_CARRY.y + (MOUNT_AIM.y - MOUNT_CARRY.y) * k - kick * 0.012,
      MOUNT_CARRY.z + (MOUNT_AIM.z - MOUNT_CARRY.z) * k - kick * 0.035
    );
    this.mountPitch = MOUNT_CARRY.pitch + (MOUNT_AIM.pitch - MOUNT_CARRY.pitch) * k
      - kick * 0.10 - aimPitch * (0.35 + 0.65 * k) + blind * 0.30;   // 注意是**减**：↑符号约定见文件头，负 pitch = 抬枪口
    // 倒地：枪从肩上滑下来，位置收回体侧、并把整根枪**绕 Y 横过来**。
    // 这不是审美而是一条几何硬约束：倒地时 enemies.js 的 tilt 会绕腰把整具身体转 90° 放平，
    // 「身体前方」随之变成「身体下方」，而枪口在胸前方 0.85m 处 —— 不横过来，整根枪管
    // 会从甲板底下捅出去（实测尸体最低点 -0.586m，等于甲板上插着一杆埋进去的枪）。
    // 横过来之后枪沿 ±x 躺着，x 轴在放平变换里不变，高度恒定在甲板之上。
    if (db > 0.001) {
      this.mountPos.lerp(_mountDeadP, db);
      this.mountPitch += (_MOUNT_DEAD_PITCH - this.mountPitch) * db;
    }
    if (this.rifle) this.rifle.rotation.y = this.rifleYaw + RIFLE_DEATH_YAW * db;
    this.mount.position.copy(this.mountPos);
    this.mount.rotation.set(this.mountPitch, 0, 0);
    this.mount.updateMatrix();

    // ⑧ 双臂 IK：手要一直黏在握把与护木上（「看起来真的在持枪」的关键）。
    //    挂点在胸腔系里 → 肩也在胸腔系里，两边同系，IK 直接在这个系里解。
    _gripT.copy(this.anchors.grip).applyMatrix4(this.mount.matrix);
    _hgT.copy(this.anchors.handguard).applyMatrix4(this.mount.matrix);
    if (blind > 0.02) _hgT.lerp(_faceT, blind * 0.85);          // 致盲：左手抬起来捂脸
    if (this.deathBlend > 0.02) {                               // 倒地：双手松开垂在身侧
      _gripT.lerp(_dropR, this.deathBlend);
      _hgT.lerp(_dropL, this.deathBlend);
    }
    ik2(_shR, _gripT, _poleR, UPPER, FORE, this.armR.sh.quaternion, this.armR.el.quaternion);
    ik2(_shL, _hgT, _poleL, UPPER, FORE, this.armL.sh.quaternion, this.armL.el.quaternion);
    this.armR.hd.rotation.set(0.3, 0, 0);
    this.armL.hd.rotation.set(0.3, 0, 0);

    // ⑨ 倒地：全身只是「松掉」—— 四肢瘫软、上身塌下、头一歪。
    //    **绝对不能把腿折起来**：enemies.js 的 tilt 会把整具身体绕腰转 90° 放平，
    //    折起的腿在那之后会朝天上翘成一团（实测尸体像只翻倒的虫子）。
    //    pelvis 高度同理不能在这里动 —— 放平后的高度由 tilt.position.y 负责。
    if (this.deathBlend > 0.02) {
      const d = this.deathBlend;
      this.legR.hip.rotation.x += (0.10 - this.legR.hip.rotation.x) * d;
      this.legL.hip.rotation.x += (0.18 - this.legL.hip.rotation.x) * d;
      this.legR.knee.rotation.x += (-0.20 - this.legR.knee.rotation.x) * d;
      this.legL.knee.rotation.x += (-0.30 - this.legL.knee.rotation.x) * d;
      this.legR.ankle.rotation.x += (0.10 - this.legR.ankle.rotation.x) * d;
      this.legL.ankle.rotation.x += (0.14 - this.legL.ankle.rotation.x) * d;
      // 脊椎/脖子**几乎不能往前弯**：倒地后「身体前方」=「身体下方」，在这里前倾多少，
      // 脸和头盔就扎进甲板多少（实测脊椎 0.22 + 脖子 0.40 时头盔最低点 -0.219m）。
      // 头改成**整个转向侧面**（rotation.y 大角度）：一来这才是「死人歪着头」的样子，
      // 二来头盔的 0.27m 深度从「朝下」转到「朝侧」，直接退出「扎地板」的那条轴。
      this.spine.rotation.x += (0.08 - this.spine.rotation.x) * d;
      this.neck.rotation.x += (0.10 - this.neck.rotation.x) * d;
      this.neck.rotation.y += (1.15 - this.neck.rotation.y) * d;
      this.mount.rotation.x += (0.55 - this.mount.rotation.x) * d;
    }
  }
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
