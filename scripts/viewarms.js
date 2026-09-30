// ===== 第一人称手臂（视模）+ 换弹动作 =====
//
// 为什么要有这个模块：武器是挂在相机下的一个 Group，`animateWeapon()` 每帧写它的位移/旋转，
// 于是枪看起来是**从右下角凭空浮出来**的 —— 没有手、也没有「人在操作它」的证据。
// 这里用基础几何现搭两只前臂 + 手套（与 enemy_model.js 同一套做法与几何约定，零新资源），
// 挂在**当前武器组之下**，随枪一起被后坐/摇摆/换弹下沉驱动。
//
// 坐标系：武器组的局部坐标 = **相机空间**（-z 前、+x 右、+y 上）。
// 因为组挂在相机下、且组自身的变换只由 animateWeapon 写，所以组局部就是「相对眼睛」的坐标。
// 所有锚点（握把、护木、肘部、弹匣井）都用这一套，与 GLB 归一化后的摆放直接对齐。
//
// 骨段约定沿用 enemy_model.js 的 `limb()`：**从原点向局部 -y 伸展**。
// 于是「把前臂指向肘部」就是 `fore.quaternion.setFromUnitVectors(DOWN, normalize(elbow - wrist))`。
import * as THREE from "three";

const DOWN = new THREE.Vector3(0, -1, 0);
const _d = new THREE.Vector3();

// 配色：**故意不用敌人那身近黑（0x1c1e21）**。枪本身就是近黑的，手再用同色，整块就是一团
// 分不出结构的黑（第一版实测：放大到 4 倍也只看得出几片黑色平板，"手握枪"完全读不出来）。
// 换成浅棕皮革 + 橄榄绿袖 —— 与敌人装备仍是同一套迷彩体系，但在枪身上有明确明暗对比。
const GLOVE = 0x7a5f45;
const SLEEVE = 0x474d3a;

// ---------- 几何体全局共享（照抄 enemy_model.js 的惰性缓存：每把武器重建会漏 buffer geometry）----------
// 手**不是**一个方盒：一个 0.09 的立方体在这个距离（离眼 0.4~0.7m）有 60~90px，光秃秃的方块
// 在画面里就是「枪下面吊着一块黑板」，完全不像手（第一版实测如此）。改成
// 「掌 + 四指 + 拇指」五块小盒：多花 5 个 draw call，换来的是**轮廓本身就像手** —— 指缝的
// 明暗分界在低多边形风格里比任何贴图都管用。
let GEO = null;
function geo() {
  if (GEO) return GEO;
  const box = (w, h, d, tx = 0, ty = 0, tz = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(tx, ty, tz);
    return g;
  };
  const limb = (rTop, rBot, len) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, len, 10);
    g.translate(0, -len / 2, 0);
    return g;
  };
  GEO = {
    // 掌：薄板贴在握把**后方**（+z 是朝玩家那一侧）。**宽度要小于握把的可见宽度**，
    // 否则掌心把握把整个包住，画面里就只剩一块方板、枪不见了（第一版 0.078 实测如此）。
    palm: box(0.070, 0.092, 0.048, 0, 0, 0.026),
    // 四指：从掌的前缘向前伸、绕过握把正面。**绕的角度由 _buildArm 给的 rotation.y 负责**，
    // 几何本身朝 -z 直伸。**指根必须和掌心有重叠**（-0.022 时指背 0.008 > 掌前缘 0.002），
    // 取 -0.028 时两者正好在 0.002 相切 —— 一转过 0.55rad 就裂开一道缝，
    // 看起来是一排悬空的板子而不是手（实测）。
    finger: box(0.016, 0.030, 0.060, 0, -0.030, -0.022),
    // 拇指：横贴掌的内侧（哪边是内由 _buildArm 按左右手镜像摆放）
    thumb: box(0.024, 0.032, 0.054, 0, 0.030, -0.016),
    // 前臂：0.50 长，够从手一直伸到画面外（实测到屏幕下缘只需 ~0.18m，留足余量）
    // 前臂要够长：腕点到肘锚点实测 0.64m（静止位），太短的话换弹下探时前臂只画到一半，
    // 画面里就只剩一只「悬空的手」（实测 0.50 时下探段完全读不出手臂）。
    forearm: limb(0.044, 0.036, 0.62),
    // 换弹中段左手带的弹匣
    mag: box(0.030, 0.110, 0.070, 0, -0.058, 0),
  };
  return GEO;
}

// 四指的横向排布（相对掌心）。对称分布 → 左右手不用各自一套几何。
// 托枪手（左手）掌心的翻转角，约 75°：把默认拳形的「指头朝前」转成「指头朝上」，绕护木一圈。
const PALM_ROLL_SUPPORT = 1.30;
const FINGER_X =[-0.026, -0.0087, 0.0087, 0.026];

// ---------- 握持锚点表（武器组局部）----------
// r = 右手（扣扳机那只）腕点，l = 左手（托举）腕点，null 表示这把枪只用一只手。
// m = 弹匣井（换弹时左手把弹匣插进去的位置），p = 腰侧弹匣袋。
//
// **整张表是照着「逐 mesh 实测的包围盒」推的，不是估的。** 方法：在武器组局部用 Box3 量出每个
// 材质段的 y/z 区间，认出「护木 / 握把 / 弹匣」三块，再让手盒（0.088×0.105×0.085）**从下方包住**
// 那一块 —— 手心落在部件中心下方约 0.045（手盒半高 0.0525），手背才露在部件外侧。
// 关键实测值（AK）：护木 Wood y∈[0.043,0.112] z∈[-0.202,-0.07]、握把 Wood y∈[-0.055,0.031]
// z∈[0.112,0.185]、弹匣 Dark_metal y∈[-0.119,0.055] z∈[-0.095,0.043]。
// M4：护木 Primary y∈[0.017,0.126] z∈[-0.236,0.012]、握把在 Primary z∈[0.009,0.245] 的后段；
// 手枪 P320 的握把与套筒同在一个 mesh（y 下探到 -0.18），只能按「握把在后下方」估；
// **匕首是倒着握的**（刀柄在上、刃朝下）：红柄占 y∈[0,0.25]、护手在 y≈0、刃在 y<0，
// 所以手要落在 y 为正的那一侧 —— 第一版按 AGENTS.md 里"knife_s_1 是刀柄"的说法
// 去抓下半截，抓的其实是刀刃（实测截图看到手握住金色的刃）。
// 投掷物是半径 0.11 的球，手从**后下方**托着，掌心必须落进球的下半部才有"握住"的读感。
// 可选的 `s` = 手部缩放（作用在 palm 组上，绕腕点缩）。**这不是装饰参数**：视模是超尺寸的
// （手枪 0.55 / 匕首 0.50 的归一化长度都远大于真枪），刀柄与手枪握把的截面因此比真枪粗得多，
// 不缩的话 0.070 宽的手会整个埋进握把里、什么都看不见（手枪实测如此）；反过来匕首柄又太细，
// 手要缩一点才不像一巴掌糊上去。步枪维持 1.0。
export const ARM_ANCHORS = {
  ak:     { r: [ 0.018, -0.030,  0.145], l: [-0.025,  0.023, -0.175] },
  m4:     { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190] },
  awm:    { r: [ 0.018, -0.045,  0.160], l: [-0.025, -0.030, -0.230] },
  pistol: { r: [-0.028, -0.100,  0.160], l: [-0.048, -0.135,  0.115], s: 1.25, m: [ 0.0, -0.230, 0.140] },
  knife:  { r: [ 0.000,  0.020,  0.000], s: 0.78, l: null },
  frag:   { r: [-0.030, -0.035,  0.080], s: 1.00, l: null },
  flash:  { r: [-0.030, -0.035,  0.080], s: 1.00, l: null },
  smoke:  { r: [-0.030, -0.035,  0.080], s: 1.00, l: null },
};

// 肘部锚点（武器组局部）。两条硬约束：
//  ① **z 不能 ≥ 0**（相机之后）—— 否则前臂被 near 平面切掉一截，画面里是一截悬空圆柱。
//  ② 肘必须落在**画面之外**，前臂才像从屏幕外伸进来的，而不是凭空长在手后面。
// 右肘往外下方（+x、-y）撇出去，左肘往左下方 —— 前臂因此是**斜着**入画的；
// 两边都取正下方会得到两根立着的绿管子（第一版实测如此，看着像柱子不像手臂）。
// 对外仍导出成数组（调试/测试会读），类内部转成 Vector3 用。
export const ELBOWS = { r: [0.300, -0.520, -0.060], l: [-0.300, -0.520, -0.110] };

// 换弹中段的两个落点。**注意这两者处在不同的坐标系里，这是有意的**：
//
//  · MAGWELL / MAG_SLAP 是**武器组局部**坐标（弹匣井是枪身上的一块，必须跟着枪走）。
//  · POUCH 是**相机空间**坐标（腰侧弹匣袋钉在屏幕上，不能跟着枪走）。
//
// 为什么必须分开：手臂是武器组的子节点，而换弹时组本身会下沉 0.22m、再俯仰 -0.85rad。
// 腰袋点若也用组局部坐标，就会被这组变换一起甩出去 —— 实测 p=0.40 时手落在屏幕 y≈1600px，
// 整段下探全程在画面外（相机空间 (-0.28,-0.45,-0.62) 经 -49° 俯仰后 y 变成 -0.665、
// z 变成 -0.249，投影直接爆掉）。所以 POUCH 在 update() 里用过组矩阵的**逆**换回组局部，
// 屏幕位置因此与枪怎么沉、怎么转完全无关。
const POUCH = new THREE.Vector3(-0.320, -0.200, -0.620); // 相机空间：胸前弹匣袋 ≈ px(400,506)
const MAGWELL = new THREE.Vector3(0.000, -0.155, 0.020); // 组局部：弹匣井（现有弹匣下缘再低一点）
const MAG_SLAP = new THREE.Vector3(0.000, -0.128, 0.020); // 组局部：拍实，往上顶一点点

// 换弹时间线的关键帧（p ∈ [0,1]）。首尾都落在护木锚点上 —— 所以 p=1 时**精确回到静止姿势**，
// 不会在 updateReload 翻掉 reloading 的那一帧跳一下。
//   0.00–0.16 枪身下沉外倾、左手离开护木
//   0.16–0.40 左手下探到腰侧弹匣袋
//   0.40–0.58 带弹匣上抬、插入弹匣井
//   0.58–0.76 拍实（过冲再落回）
//   0.76–1.00 左手归位到护木、枪身抬回
const KEYS = [
  { p: 0.00, k: "L" },
  { p: 0.16, k: "L" },
  { p: 0.40, k: "P" },
  { p: 0.58, k: "M" },
  { p: 0.67, k: "S" },
  { p: 0.76, k: "M" },
  { p: 1.00, k: "L" },
];
// 弹匣盒可见区间：从「手已到弹匣袋」到「插进弹匣井」。
// 上限 0.62 是必须的 —— 枪自己的弹匣是模型的一部分、卸不掉，带过去的弹匣若在弹匣井里
// 还亮着，就会和枪上那只**穿模**。让它在「手捂住井口」的那一刻消失，肉眼看不出来。
const MAG_ON = 0.32, MAG_OFF = 0.62;

const smooth = (t) => t * t * (3 - 2 * t); // smoothstep，与 animateWeapon 里那条同源

// 换弹期间左肘的**相机空间**位置：前臂从这里往画面左下伸出去。远端落在屏幕外（y≈1050px）
// 是刻意的 —— 一条整整齐齐收在画面里的前臂看着像贴在镜头上的塑料管，出画才像「手长在自己身上」。
const ELBOW_L_RELOAD = new THREE.Vector3(-0.590, -0.410, -0.450);

const _tmpL = new THREE.Vector3();
const _tmpE = new THREE.Vector3();
const _tmpR = new THREE.Vector3();
const _kA = new THREE.Vector3();
const _kB = new THREE.Vector3();

export class ViewArms {
  constructor() {
    const G = geo();
    // 材质每个实例一份（与 SoldierRig 同理：将来若要做「受击/变色」不会互相串）
    this.matGlove = new THREE.MeshStandardMaterial({ color: GLOVE, roughness: 0.86, metalness: 0.03 });
    this.matSleeve = new THREE.MeshStandardMaterial({ color: SLEEVE, roughness: 0.93, metalness: 0.02 });
    this.matMag = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.68, metalness: 0.28 });

    this.root = new THREE.Group();
    this.root.name = "viewArms";
    this.armR = this._buildArm(G, 1);
    this.armL = this._buildArm(G, -1);
    // 弹匣只挂在左手上（右手的枪自己带着弹匣）
    this.magL = this.armL.mag;
    this.root.add(this.armR.grp, this.armL.grp);

    // 初值直接读锚点表，不要另抄一份常量 —— 抄一份就会出现「表改了、静止姿势没跟上」
    this.anchorR = new THREE.Vector3().fromArray(ARM_ANCHORS.ak.r);
    this.anchorL = new THREE.Vector3().fromArray(ARM_ANCHORS.ak.l);
    this.magwell = MAGWELL.clone();
    // 肘锚点：对外是数组，内部一律用 Vector3（_aim 只收 Vector3，见该函数注释）
    this.elbR = new THREE.Vector3().fromArray(ELBOWS.r);
    this.elbL = new THREE.Vector3().fromArray(ELBOWS.l);
    this.hasLeft = true;
    this.weaponId = "ak";
    this.magL.visible = false;
    this._aim(this.armR, this.anchorR, this.elbR);
    this._aim(this.armL, this.anchorL, this.elbL);
  }

  // side = +1 右手 / -1 左手（拇指镜像）
  _buildArm(G, side) {
    const grp = new THREE.Group();
    // 手掌单独一组：将来若要按武器/握把角度调「手的俯仰」，只动这一组，
    // **不能**动 grp —— grp 的旋转会叠加到 fore 的四元数上，把前臂指歪（见 _aim）。
    const palm = new THREE.Group();
    const parts = [new THREE.Mesh(G.palm, this.matGlove)];
    for (const fx of FINGER_X) {
      const f = new THREE.Mesh(G.finger, this.matGlove);
      f.position.set(fx, 0, 0);
      // 手指**绕 y 往枪身中线扣**（右手往 -x、左手往 +x）—— 不扣的话四根指头直挺挺朝前伸，
      // 看着像一块带缝的板，而不是"绕在握把上"。0.55rad ≈ 31°，刚好包住半个握把。
      f.rotation.y = side * 0.55;
      parts.push(f);
    }
    const thumb = new THREE.Mesh(G.thumb, this.matGlove);
    thumb.position.set(-side * 0.046, 0, 0);
    parts.push(thumb);
    // 托枪那只手（左手）要把掌心翻上来包住护木。默认那副「指头朝下」的拳形是给扣扳机的手用的
    // —— 它握的是竖直的握把；护木是横的，不翻这一下，左手就变成一块**搁在护木上**的方板
    // （实测放大图：手背朝上、指头悬空，完全没有"握住"的读感）。
    palm.rotation.x = side < 0 ? PALM_ROLL_SUPPORT : 0;
    palm.add(...parts);
    grp.add(palm);

    // 前臂挂在腕点稍后下方，避免圆柱从手背正面捅出来
    const fore = new THREE.Group();
    fore.position.set(0, -0.022, 0.030);
    const foreMesh = new THREE.Mesh(G.forearm, this.matSleeve);
    fore.add(foreMesh);
    grp.add(fore);

    // 换弹时左手拎着的弹匣（只在左手；右手那把枪的弹匣始终插在枪上）
    const mag = new THREE.Mesh(G.mag, this.matMag);
    // 弹匣要**穿过掌心**：拳头的盒子是 y∈[-0.046,0.046]，弹匣顶得压在掌心以上，
    // 否则手和弹匣之间会露出一道缝，看着像两块分开的板（实测）。
    mag.position.set(0, -0.005, 0.010);
    mag.visible = false;
    grp.add(mag);

    for (const o of [...parts, foreMesh, mag]) {
      o.frustumCulled = false;   // 视模紧贴相机，视锥剔除只会带来闪烁
      o.castShadow = false;
      o.receiveShadow = false;
      // 手臂不属于「武器材质」——meshMats() 会遍历整个武器组导出材质快照，
      // 不过滤的话皮肤测试的条数/下标断言会全线崩（见 main.js 的 meshMats）。
      o.userData.viewArms = true;
    }
    return { grp, palm, fore, mag };
  }

  // 挂到某把武器的组里。手臂必须是**武器组的子节点**（而不是 vmCamera 的兄弟）——
  // switchWeapon / applyScope / animateWeapon 这三处都在写 group.visible，
  // 挂在组里才能让「开镜时手臂跟着枪一起消失」自动成立。
  attach(group, weaponId) {
    if (this.root.parent !== group) group.add(this.root);
    this.configure(weaponId);
  }

  configure(weaponId) {
    const a = ARM_ANCHORS[weaponId] || ARM_ANCHORS.ak;
    this.weaponId = weaponId;
    this.anchorR.fromArray(a.r);
    this.hasLeft = !!a.l;
    // **必须 fromArray，不能 copy**：a.m 是数组，而 Vector3.copy() 读的是 `.x/.y/.z`
    // —— 数组上那三个是 undefined，copy 完 magwell 就是 NaN，插弹匣那半段左手直接消失
    // （NaN 沿 lerp 传下去，s=1 时整条时间线都残废）。锚点表里其它几个字段走的就是 fromArray。
    if (a.m) this.magwell.fromArray(a.m);
    else this.magwell.copy(MAGWELL);
    if (this.hasLeft) this.anchorL.fromArray(a.l);
    // 手部缩放（见锚点表里 `s` 的说明）。缩的是 palm 组 —— 它的原点就是腕点，
    // 所以手是「绕腕点缩小」，腕点本身不动、仍然咬在握把上。
    const s = a.s || 1;
    this.armR.palm.scale.setScalar(s);
    this.armL.palm.scale.setScalar(s);
    this.armL.grp.visible = this.hasLeft;
    this.magL.visible = false;
    // 立刻摆到静止位：切枪那一帧手臂不这么放的话，会有一帧停在上一把枪的握位上
    this._aim(this.armR, this.anchorR, this.elbR);
    if (this.hasLeft) this._aim(this.armL, this.anchorL, this.elbL);
  }

  // 把腕点摆到 wrist、前臂指向 elbow。零向量要提前拦掉 ——
  // normalize(0) 会得到 NaN 四元数，污染矩阵后 animateWeapon 每帧抛异常，
  // 被 loop 的 try/catch 吃掉，表现就是「手臂凭空消失」且控制台之外无提示。
  // `elbow` 是 Vector3。**这里踩过一次**：函数原先按下标读数组（`elbowArr[0]`），
  // 换弹那条路径传进来的却是 Vector3 —— 三个分量全是 undefined，`_d` 变 NaN，
  // `d2 < 1e-8` 对 NaN 恒为 false，于是 setFromUnitVectors 吃进一个 NaN 方向，
  // 前臂的四元数整条污染：**前臂静默消失，不报错、不进 loopErrors**（实测排查了两轮）。
  // 现在统一走 Vector3，两边不会再串。
  _aim(arm, wrist, elbow) {
    arm.grp.position.copy(wrist);
    _d.set(elbow.x - wrist.x, elbow.y - wrist.y, elbow.z - wrist.z);
    const d2 = _d.lengthSq();
    if (d2 < 1e-8) arm.fore.quaternion.identity();
    else arm.fore.quaternion.setFromUnitVectors(DOWN, _d.multiplyScalar(1 / Math.sqrt(d2)));
  }

  // 左手在换弹时间线上的位置（**组局部**，由 _key 把相机空间的腰袋点换进来）。
  // 写到 out 上避免每帧新建向量。
  _reloadLeft(p, out, invM) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = KEYS[i], b = KEYS[i + 1];
      if (p > b.p) continue;
      const t = b.p > a.p ? (p - a.p) / (b.p - a.p) : 0;
      const s = smooth(Math.max(0, Math.min(1, t)));
      const va = this._key(a.k, _kA, invM), vb = this._key(b.k, _kB, invM);
      return out.set(va.x + (vb.x - va.x) * s, va.y + (vb.y - va.y) * s, va.z + (vb.z - va.z) * s);
    }
    return out.copy(this.anchorL);
  }
  // 组局部坐标 ⇄ 相机空间：invM 是武器组矩阵的逆（组是 vmCamera 的子节点、vmCamera 是单位变换，
  // 所以「组矩阵」本身就是 局部→相机 的映射）。缺省当单位阵，方便单独调用。
  _key(k, out, invM) {
    if (k === "L") return out.copy(this.anchorL);
    if (k === "M") return out.copy(this.magwell);
    // 拍实用量很小（3cm），只是给「拍到位」一个可见的过冲
    if (k === "S") return out.set(this.magwell.x, this.magwell.y + 0.030, this.magwell.z);
    out.copy(POUCH);
    if (invM) out.applyMatrix4(invM);
    return out;
  }

  /**
   * @param reloading 当前武器是否在换弹（门控在 st.reloading 上，不能只看 p）
   * @param p         st.reloadT / st.reloadDur，被 clamp 到 [0,1]
   * @param invM      武器组矩阵的逆（相机空间 → 组局部）。换弹时组的俯仰会到 -0.85rad，
   *                  腰袋点必须走这个逆变换才能钉在屏幕上；省略则退化为旧的纯组局部行为。
   */
  update(reloading, p, invM) {
    this._aim(this.armR, this.anchorR, this.elbR);
    if (!this.hasLeft) return;
    if (reloading) {
      this._reloadLeft(p, _tmpL, invM);
      // 左肘要跟着「手还在不在枪上」在两套锚点之间过渡：
      // 手在护木时肘取枪上的 elbL（前臂贴着枪身），手下去掏弹匣时换成相机空间的肘位。
      // 全程用 elbL 不行 —— 手都到腰上了、肘还挂在枪上，前臂会横穿整个画面，
      // 看着像一根搁在屏幕下沿的木头（实测 p=0.16 / 0.40 都是这样）。
      _tmpR.copy(ELBOW_L_RELOAD);
      if (invM) _tmpR.applyMatrix4(invM);
      const w = p <= 0.16 ? 0
        : p < 0.40 ? smooth((p - 0.16) / 0.24)
          : p <= 0.76 ? 1
            : 1 - smooth((p - 0.76) / 0.24);
      _tmpE.copy(this.elbL).lerp(_tmpR, w);
      this._aim(this.armL, _tmpL, _tmpE);
      // 弹匣只在「手已到弹匣袋」到「插进井里」之间可见；位置在 _buildArm 里定死，
      // 这里不要再写一次（重复写会盖掉「穿过掌心」那个修正）。
      this.magL.visible = p > MAG_ON && p < MAG_OFF;
    } else {
      this._aim(this.armL, this.anchorL, this.elbL);
      this.magL.visible = false;
    }
  }
}
