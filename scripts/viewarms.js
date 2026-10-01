// ===== 第一人称手臂（视模）+ 换弹动作 =====
//
// 为什么要有这个模块：武器是挂在相机下的一个 Group，`animateWeapon()` 每帧写它的位移/旋转，
// 于是枪看起来是**从右下角凭空浮出来**的 —— 没有手、也没有「人在操作它」的证据。
//
// **几何来源：`models/cs/ak47.glb` 的 `HandR`/`ArmR`/`HandL`/`ArmL` 四个节点**
// （参考项目 counter-strike-in-browser-main，MIT）。只取这四块**手与袖**，枪身一律不渲染 ——
// 枪还是我们自己的 GLB。为什么不用程序化几何现搭：手型是本项目最难用基础盒子凑出来的东西，
// 上一版用「掌 + 四指 + 拇指」五块盒拼了一个，放大看仍是一排板子。CS 这份是烘好的握拳姿态，
// 右拳扣竖直握把、左拳绕横护木 —— 那是**造型信息**，不是几个数字能参数化的。
//
// 但**配色不搬**：CS 那套是近黑手套 + 织纹贴图，配我们这把近黑的枪会糊成一团
// （AGENTS.md 记过：第一版程序化手用近黑时「放大 4 倍也只看得出几片黑色平板」）。
// 所以只借几何与姿势，材质一律换成我们自己的暖棕针织 + 深棕合成革 + 橄榄绿袖。
//
// **材质：四套程序化 canvas PBR（albedo / normal / roughness 同出一张高度场）。**
// 旧版把 `glove`/`glove_palm`/`gun_rubber` 三个源材质名统统映到**一块**同色、无贴图、
// roughness 恒定的材质上，于是手背那三块本来就该有不同的手感的面糊成一团 —— 这是
// 「太假」的一半；另一半是**袖管**：一根光滑的锥管，没有任何东西告诉眼睛「这是布」。
// 现在手背是涤纶针织（1.8mm 织孔）、掌心是合成革（细密粒面 + 汗渍磨光）、虎口是橡胶垫、
// 袖管是平织 + ripstop 加固格 + 2~4cm 折痕，腕上再加一圈**罗纹弹力束带**
// （`_cuff()`，几何按袖管的实测半径现造）。贴图全部 512² 或 256² 现生成，
// 无外部资源；生成是确定性的（整数哈希，不用 Math.random），同一版代码每次长得一样，
// 改一处可以直接用截图前后对比。
//
// 贴图配方（针织 / 粒面皮革 / ripstop 平织、以及「尼龙磨损是变亮、皮革磨损是变亮且更滑」
// 这条）参考了参考项目 counter-strike-in-browser-main 的 `src/gameplay/WeaponTextures.js`
// （MIT，Copyright (c) 2026 StarKnightt），**代码是重写的**，只沿用它的织纹尺度约定。
//
// 坐标系：武器组的局部坐标 = **相机空间**（-z 前、+x 右、+y 上）。
// 因为组挂在相机下、且组自身的变换只由 animateWeapon 写，所以组局部就是「相对眼睛」的坐标。
//
// 骨段约定：**从原点向局部 -y 伸展**。于是「把前臂指向肘部」就是
// `fore.quaternion.setFromUnitVectors(DOWN, normalize(elbow - wrist))`。
// CS 的前臂**不是轴对齐的**（实测主轴是 (±0.23, -0.83, +0.51) 这种斜的），
// 所以装载时要先把它转正到 -Y，否则 setFromUnitVectors 会把它指歪 —— 见 CS_SRC 的注释。
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// CS 双手的源文件。用视图模相对路径（`fetch` 按**文档 URL** 解析，写在 scripts/ 里也是对的）。
export const CS_HANDS_URL = "./models/cs/ak47.glb";

const DOWN = new THREE.Vector3(0, -1, 0);
const _d = new THREE.Vector3();

// 配色：**故意不用 CS 的近黑**（见文件头）。枪本身就是近黑的，手再用同色，整块就是一团
// 分不出结构的黑。棕色皮革 + 橄榄绿袖 —— 与敌人装备仍是同一套迷彩体系，但在枪身上有明确明暗对比。
//
// **四个色而不是一个**：真实战术手套本来就是**拼料**的 —— 手背是弹力针织、掌心是合成革、
// 虎口一块橡胶垫。原来三块网格同色，于是手的「结构」只剩外轮廓（放大看就是一块肉色橡皮泥）。
// 现在靠**材质差异**把手背 / 掌心 / 垫子分开，这是不增加一个多边形就能拿到立体感的做法。
//
// **这四个色是烘进 albedo 贴图的基色，不是 `material.color`。** 上色只有这一处：
// `gloveKnitMaps()` 等用它当基色，材质那边固定 `color = 0xffffff`。两边都上色会
// 色值平方（`0x6d563e² ≈ 0x2f1c0f`，手套直接黑成一块；AGENTS.md 记过集装箱那个坑）。
// 想调色改这里，改完贴图与材质会一起跟着变。
const GLOVE = 0x6d563e;   // 手背针织：暖棕（比原来的 0x7a5f45 沉一档，不再读成「裸手」）
const PALM = 0x4b392a;    // 掌心合成革：更深的棕，与手背拉开层次
const PAD = 0x26241f;     // 虎口橡胶垫：近黑
const SLEEVE = 0x474d3a;  // 袖布：橄榄绿
const CUFF = 0x3d4231;    // 袖口罗纹束带：比袖布深一档，给袖口一个交代

// ---------- CS 源数据的实测常数（`models/cs/ak47.glb`）----------
// **这几个数只能量不能猜**，全部由 `node /tmp/glbpca.mjs models/cs/ak47.glb` 从顶点直接算出：
//   · handPivot = 手网格的**包围盒中心** —— 装进来后落在 ARM_ANCHORS 的 `r`/`l` 上。
//   · armWrist  = 前臂**靠手那一端**（沿主轴取两端各 12% 的顶点质心）。
//   · armDir    = 前臂主轴（顶点协方差的主特征向量），**由腕指向肘**。
// 四个节点的变换都是单位阵、顶点直接烘在枪空间里，所以这些数就是它们的世界坐标。
//
// 为什么 armDir 是关键：CS 的前臂是**斜的**，主轴 (0.23, -0.83, 0.51) 与 -Y 差着 33°。
// 直接塞进 `fore` 再让 `_aim` 去指，等于在「本来就歪的模型」上再叠一次旋转，前臂会指着枪托。
// 所以装载时先 `setFromUnitVectors(armDir, DOWN)` 把它转正，此后 `_aim` 才说了算。
//
// 顺带一个反直觉的实测结论：**CS 的肘在腕的斜后方（+z、-y），而本模块原来的 ELBOWS 把肘
// 摆在腕的斜前方（-z）**。旧的程序化圆柱只有「方向」有意义、长度 0.62 一路伸出画外，
// 所以摆反了看不出来；换成有形状的真实前臂就立刻穿帮。ELBOWS 已按这里的方向重写。
const CS_SRC = {
  handPivot: { R: [0.0077, -0.0631, 0.0723], L: [-0.0331, -0.0463, -0.2871] },
  armWrist: { R: [0.0433, -0.0085, 0.1647], L: [-0.1205, -0.0774, -0.2753] },
  armDir: { R: [0.2299, -0.8275, 0.5122], L: [-0.3167, -0.8386, 0.4433] },
};

// 手部网格里「哪块算是手、哪块算是袖」由源材质名决定（实测材质表）：
//   HandR/HandL → glove, glove_palm, gun_rubber（掌垫）  ArmR/ArmL → sleeve
// CS 自己的织纹贴图（WeaponTextures.js）**不搬**，只按名换材质。
const MAT_SLEEVE_NAMES = new Set(["sleeve"]);

// 腕 → 肘 的方向（**单位向量**，武器组局部）。两侧各自固定：这是「人的胳膊往哪撇」，
// 与手里是哪把枪无关 —— 所以它**不是** ELBOWS 那种绝对点，而是一个方向，
// 由 configure() 按当前武器的手腕锚点现算成肘点（见该处）。
// 值直接取自 CS 两只前臂各自的主轴，即源模型烘好的姿势。
// 约束：① 肘必须在腕的**后方或正侧面**，z 不能比腕更靠前（否则前臂从枪管方向支棱出去）；
//       ② 肘必须落在画面外，前臂才像从屏幕外伸进来的，而不是凭空长在手后面。
export const ELBOW_DIR = { r: [0.2299, -0.8275, 0.5122], l: [-0.3167, -0.8386, 0.4433] };
// 肘到腕的距离只影响方向、不影响画面（前臂只有 ~0.25m 长，肘点永远在画外），
// 取 0.62 是为了让「方向」在数值上稳定，不至于被浮点噪声放大。
const ELBOW_DIST = 0.62;

// 前臂的**轴向拉伸**。CS 的袖管只有 0.369m(右) / 0.284m(左) 长，而视模的前臂必须一直画到
// **画面外**才不像「凭空长在手后面的一截管子」。实测（步枪握持位 0.32/-0.17/-0.5、1280×713）：
//   · 右袖：腕点就落在 px≈1232（画面右缘 1280），沿轴走 6% 就出画了 —— 不用拉。
//   · 左袖：腕点在 (800,475)，**袖口停在 (773,638)，在画面里**，会看到一个齐刷刷的断口。
//     解 `py(袖口)=713` 得袖长至少要 0.289m（原生 0.211m）→ 拉伸 ≥1.37。取 1.8 留余量。
// 拉伸只作用在**轴向**（局部 y），袖管是等截面的，拉长只是变长、不会变成一根细面条。
const ARM_STRETCH = { R: 1.0, L: 1.8 };

// =====================================================================================
// 程序化 PBR 贴图（手套 / 袖布 / 橡胶垫）
// =====================================================================================
//
// 【为什么需要】几何是 CS 烘好的（握拳姿态、指节分层，实测 HandR 3720 面），本身够用；
// 病灶在**材质**：四块网格原来全吃同一个纯色 MeshStandardMaterial，于是手在画面上是一团
// 没有起伏、没有纹理、没有明暗过渡的橡皮泥（放大 4 倍的截图里只剩光滑的肉色块）。
// 纯色 + 粗糙度 0.86 的表面在「半球光 + 一盏方向光」下只有亮面/暗面两个台阶，
// **没有任何可读的表面信息** —— 这就是「假」的全部来源。
//
// 【三张图各管一件事，缺一张就退回橡皮泥】
//   · map（反照率）—— 织纹疏密、磨损、汗渍，让同一块面有明暗层次；
//   · normalMap    —— 颗粒与织纹的起伏，让掠射光下的高光碎开；
//   · roughnessMap —— 颗粒顶端磨亮、凹处发涩。**「织物」与「塑料」的第一分野是粗糙度的
//                     空间分布**，不是颜色、也不是形状。三张图必须由**同一张高度场**派生，
//                     各画各的必然对不上（凸起处反而发暗，一眼假）。
//
// 【尺度按屏幕反推，不按美术直觉】视模里手离相机只有 0.3~0.4m。实测 1280 宽画面下
// 手背约 110px 宽、袖子约 70px —— 也就是 **≈0.3mm 一个像素**。于是：
//   · 1~2mm 的皮革粒面/织孔在屏幕上是 3~6px，读得出来，但只读成「微光」而不是「图案」；
//   · 真正能被看见的是 **1cm 量级的磨损斑、松紧不一处**，纹理必须带这一层，
//     否则远看仍是一块平色 —— 细纹再精致也扛不住 mipmap 一平均。
// 参考项目 counter-strike-in-browser-main 的 WeaponTextures.js 从同一组实测得出同一结论
// （它的 512² 贴图在屏幕上只有 2.5px 的织孔），这里沿用它的尺度：**手套 10cm 一格、
// 袖子 14cm 一格**。格子开这么大还有个附带好处 —— 手背周长才 ~10cm，
// **整只手只落一格，重复感为零**。
//
// 【授权】织纹的做法（平织的 sin·sin 结构、织物纤维噪声、磨损/汗渍低频斑、ripstop 加固格、
// 以及 256² 保存预算的分工）参考了 counter-strike-in-browser-main 的 WeaponTextures.js
// （MIT，Copyright (c) 2026 StarKnightt），与本项目已有的「借 CS 的双手几何 / 借 CS 的手感
// 数值」同源；实现按本项目自己的写法重写，配色仍是我们自己的皮革棕 + 橄榄绿。
//
// 所有贴图都**无缝可平铺**：噪声按格点数环绕取模、Sobel 也环绕取样。这不是锦上添花 ——
// 袖管/手掌的 UV 都跨好几格（实测 ArmR 的 u 跨 7.4 个单位），有接缝会直接穿帮。

const TEX_SIZE = 512;

// 目标：一张贴图铺满多少米。见上面「尺度按屏幕反推」。256² 的那两张（掌垫、橡胶）
// 是因为它们在手背上只占一小块、基本被挡住 —— 参考项目也是这么省的。
const TEX_TILE = { glove: 0.10, palm: 0.10, sleeve: 0.14, pad: 0.04, cuff: 0.03 };
const TEX_PX = { glove: 512, palm: 256, sleeve: 512, pad: 256, cuff: 256 };

/** 确定性整数哈希 → [0,1)。贴图必须每次加载长得一模一样，否则「这张皮子好不好看」
 *  就变成一次抽奖，改一处代码前后也没法用截图对比。Math.random() 做不到这一点。 */
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 可平铺的值噪声。`per` / `perY` 是**格点数**（整数），环绕取模，所以左右上下都接得上。
 *  perY 单独给，是为了让一个场能沿某个方向拉长（袖子的纵向褶皱正是这么来的）而仍然可平铺。 */
function vnoise(x, y, per, seed, perY) {
  const P = perY || per;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % per) + per) % per, x1 = (x0 + 1) % per;
  const y0 = ((iy % P) + P) % P, y1 = (y0 + 1) % P;
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  const t = a + (b - a) * sx, u = c + (d - c) * sx;
  return t + (u - t) * sy;
}

/** 可平铺的 fBm。baseCells 必须是整数，否则最粗那一层接不上。 */
function fbm(u, v, base, oct, seed, gain) {
  let amp = 1, sum = 0, norm = 0, cells = base;
  const g = gain || 0.5;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(u * cells, v * cells, cells, seed + i * 17);
    norm += amp; amp *= g; cells *= 2;
  }
  return sum / norm;
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** 逐像素算一张单通道场。**逐像素调 fn 很贵**（512² = 26 万次），所以只有真正需要
 *  逐像素精度的结构（织孔、粒面）才走它，低频一律走 lowField。 */
function field(S, fn) {
  const out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) out[y * S + x] = fn((x + 0.5) / S, (y + 0.5) / S);
  }
  return out;
}

/** 低频场：在 1/div 的分辨率上算完再双线性放大（环绕）。省 div² 倍算力 ——
 *  低频本来就没有逐像素的信息，放大不会丢东西。div=4 时误差在 1/512 像素尺度上不可见。 */
function lowField(S, fn, div) {
  const N = Math.max(4, Math.round(S / (div || 8)));
  const g = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) g[y * N + x] = fn((x + 0.5) / N, (y + 0.5) / N);
  }
  const out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const fy = (y / S) * N, y0 = Math.floor(fy), ty = fy - y0;
    const r0 = (y0 % N) * N, r1 = ((y0 + 1) % N) * N;
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * N, x0 = Math.floor(fx), tx = fx - x0;
      const c0 = x0 % N, c1 = (x0 + 1) % N;
      const a = g[r0 + c0], b = g[r0 + c1], c = g[r1 + c0], d = g[r1 + c1];
      const t = a + (b - a) * tx, u = c + (d - c) * tx;
      out[y * S + x] = t + (u - t) * ty;
    }
  }
  return out;
}

/** 可分离场：结构只由 u 或只由 v 决定时（织纹就是），用两个一维数组 + 一个组合子，
 *  把 O(S²) 降到 O(S)。512² 的平织如果按逐像素算，光这一个场就是 26 万次三角函数。 */
/** 可分离结构（经纬织纹）用的场：`fu`/`fv` 各把**两个 1-D 分量**写进自己的临时数组，
 *  再由 `comb(au, bu, av, bv)` 把它们横向/纵向地拼起来。
 *
 *  **`fu(t, out, off)` 必须写 `out[off]` 与 `out[off+1]` 两个分量**（不是写 `out[0]`）——
 *  A/B 是 `2*S` 长的交错存储。第一版把回调写成 `A[0] = ...; A[1] = ...`，而拼合时读的是
 *  `A[x]`（沿 x 下标走），于是 x ≥ 2 一律读到 0，而本该是「纵向分量」的那个参数
 *  拿到的是**像素下标 x 本身**（0~511）—— `0.12 * max(gu, x)` 直接把袖布推成纯白。
 *  症状极具误导性：只有袖子一张贴图炸掉、另外三张正常，看着像配色写错了。 */
function sepField(S, fu, fv, comb) {
  const A = new Float32Array(2 * S), B = new Float32Array(2 * S);
  for (let i = 0; i < S; i++) { const t = (i + 0.5) / S; fu(t, A, i * 2); fv(t, B, i * 2); }
  const out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = x * 2, b = y * 2;
    out[y * S + x] = comb(A[a], A[a + 1], B[b], B[b + 1]);
  }
  return out;
}

/** 高度场 → 切线空间法线贴图（Sobel，取样同样环绕）。`strength` 就是「起伏有多陡」。 */
function normalFromHeight(h, S, strength) {
  const cv = makeCanvas(S);
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const at = (x, y) => h[(((y % S) + S) % S) * S + (((x % S) + S) % S)];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * S + x) * 4;
      d[i] = (-dx / len * 0.5 + 0.5) * 255;
      d[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

/** 线性 → sRGB 传输。源色一律**先在 sRGB 空间按美术直觉定 hex**，再转成线性做运算、
 *  最后转回来 —— 直接在线性空间里乘系数会让暗部的变化看起来比亮的快得多。 */
const SRGB_LUT = new Float32Array(1025);
for (let i = 0; i <= 1024; i++) {
  const c = i / 1024;
  SRGB_LUT[i] = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
const lin2srgb = (c) => SRGB_LUT[Math.round(clamp01(c) * 1024)];
function hexLin(hex) {
  return [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255].map((v) => {
    // sRGB → 线性
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
}

/**
 * 由一张高度场 + 一个配色回调生成 { map, normalMap, roughnessMap } 三件套。
 * `albedo(i, o)` 把**线性** rgb 写进 o（长度 3），三张图因此天然对齐。
 */
function buildMaps(S, h, normalStrength, normalScale, albedo, rough) {
  const cv = makeCanvas(S);
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const rgbLin = [0, 0, 0];
  for (let i = 0; i < h.length; i++) {
    albedo(i, rgbLin);
    d[i * 4] = lin2srgb(rgbLin[0]) * 255;
    d[i * 4 + 1] = lin2srgb(rgbLin[1]) * 255;
    d[i * 4 + 2] = lin2srgb(rgbLin[2]) * 255;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // 粗糙度只被 three 读绿色通道，三个通道写同一个值是为了肉眼能直接看这张图。
  const rc = makeCanvas(S);
  const rctx = rc.getContext("2d");
  const rimg = rctx.createImageData(S, S);
  const rd = rimg.data;
  for (let i = 0; i < h.length; i++) {
    const v = clamp01(rough(i)) * 255;
    rd[i * 4] = v; rd[i * 4 + 1] = v; rd[i * 4 + 2] = v; rd[i * 4 + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);

  return {
    map: texFrom(cv, true),
    normalMap: texFrom(normalFromHeight(h, S, normalStrength), false),
    roughnessMap: texFrom(rc, false),
    normalScale: new THREE.Vector2(normalScale, normalScale),
  };
}

/** 反照率贴图是颜色贴图 → **必须显式标 SRGBColorSpace**；法线/粗糙度是数据贴图 →
 *  **必须保持 NoColorSpace**。CanvasTexture 默认就是 NoColorSpace，所以漏标的后果
 *  是颜色被当线性数据读进来、整体发白（AGENTS.md 记过同一坑，出现在集装箱上）。
 *  anisotropy 稍后由 load() 按 renderer 的上限补 —— 袖子是贴着视线的斜面，
 *  各向异性过滤对它的观感影响最大。 */
function texFrom(cv, srgb) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/** 手套手背：**涤纶针织**（不是皮革）。真实的战术手套手背是弹力针织、掌心才是合成革 ——
 *  这个区分本身就是「看着像真东西」的一部分，两块面因此有不同的手感。
 *  织孔只有 0.7mm 见方（屏幕上 2.5px），读出来的是**织物光泽**而不是图案。 */
function gloveKnitMaps() {
  const S = TEX_PX.glove;
  const W = 56, C = 80;                       // 10cm 一格 → 织孔 1.8×1.25mm
  const knit = field(S, (u, v) => {
    const wale = 0.5 + 0.5 * Math.cos(u * Math.PI * 2 * W);       // 纵行（菱形柱）
    // **相邻纵行的线圈要错开半个横列** —— 不错开就是一排方格，不是针织（实测对比过）
    const phase = (Math.floor(u * W) & 1) ? 0.5 : 0;
    const course = 0.5 + 0.5 * Math.cos((v * C + phase) * Math.PI * 2);
    return wale * (0.55 + 0.45 * course);
  });
  const fibers = lowField(S, (u, v) =>
    0.22 * (vnoise(u * 44, v * 44, 44, 19) - 0.5) +
    // 沿纵行方向拉长的纤维束（vnoise 的 perY 比 per 小 = 纵向拉伸）
    0.26 * (vnoise(u * 112, v * 28, 112, 15, 28) - 0.5), 4);
  // 磨损/松紧：~1cm 的斑块。**这才是屏幕上真正能看见的那一层**（见文件头）。
  const wear = lowField(S, (u, v) => sstep(0.46, 0.80, fbm(u, v, 3, 3, 17, 0.55)), 8);
  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = knit[i] * 0.55 + fibers[i] - wear[i] * 0.06;

  const base = hexLin(GLOVE);
  return buildMaps(S, h, 3.4, 0.42,
    (i, o) => {
      const k = knit[i] - 0.5, f = fibers[i], w = wear[i];
      // 线圈顶被磨亮、磨白（尼龙的磨损是**变亮**，不是变脏）
      const l = (1 + 0.16 * k + f) * (1 + 0.30 * w);
      o[0] = base[0] * l * (1 + 0.05 * f);
      o[1] = base[1] * l;
      o[2] = base[2] * l * (1 - 0.06 * f);
    },
    (i) => 0.82 + 0.07 * (knit[i] - 0.5) + 0.15 * fibers[i] - 0.07 * wear[i]);
}

/** 手套掌心：**合成革**（Amara）。细密的圆润粒面 + 汗渍磨光斑 —— 磨光处**更亮也更滑**，
 *  这是皮革在游戏画面里最容易被认出来的一对特征。 */
function gloveLeatherMaps() {
  const S = TEX_PX.palm;
  const cells = lowField(S, (u, v) => 0.6 * vnoise(u * 40, v * 40, 40, 21) + 0.4 * vnoise(u * 80, v * 80, 80, 23), 4);
  const pebble = new Float32Array(S * S);
  for (let i = 0; i < pebble.length; i++) pebble[i] = sstep(0.32, 0.68, cells[i]);
  const micro = lowField(S, (u, v) => vnoise(u * 112, v * 112, 112, 25), 4);
  const rubbed = lowField(S, (u, v) => sstep(0.50, 0.80, fbm(u, v, 3, 3, 27, 0.55)), 8);
  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = pebble[i] * 0.7 + micro[i] * 0.2 - rubbed[i] * 0.1;

  const base = hexLin(PALM);
  return buildMaps(S, h, 3.0, 0.5,
    (i, o) => {
      const p = pebble[i] - 0.5, d = rubbed[i];
      // 汗渍处颜色更浅、更中性（皮革被磨掉了表层）
      const l = (1 + 0.12 * p) * (1 - 0.10 * d);
      o[0] = base[0] * l * (1 + 0.16 * d);
      o[1] = base[1] * l * (1 + 0.12 * d);
      o[2] = base[2] * l * (1 + 0.08 * d);
    },
    // 磨光处更滑 —— 与「更亮」同向，两者一起才像被摸旧的皮子
    (i) => 0.62 + 0.06 * (pebble[i] - 0.5) - 0.12 * rubbed[i]);
}

/** 掌心/虎口那块橡胶垫。只在手背上露出一点点，用最低的预算（256²）。 */
function glovePadMaps() {
  const S = TEX_PX.pad;
  const h = lowField(S, (u, v) => vnoise(u * 90, v * 90, 90, 31) - 0.5, 4);
  const base = hexLin(PAD);
  return buildMaps(S, h, 2.2, 0.4,
    (i, o) => {
      const k = 1 + 0.16 * h[i];
      o[0] = base[0] * k; o[1] = base[1] * k; o[2] = base[2] * k;
    },
    (i) => 0.90 + 0.06 * h[i]);
}

/** 袖管：**平织 + ripstop 加固格 + 折痕**的橄榄绿军布。
 *
 *  **折痕那一层是这里唯一真正看得见的东西，别删。** 袖管是第一人称里面积最大的一块
 *  布面，而它同时是一根**光滑的锥管** —— 只有织纹时，1.5mm 的织孔在屏幕上不到 4px，
 *  整条袖子读出来就是一根塑料管（这正是旧版最像假货的地方，实测对比过）。真正让
 *  「布」立住的是 2~4cm 的横向折痕：法线贴上它之后，掠射光下才有起伏的明暗带。
 *  织纹只负责近处的「这是个织物」的读感，折痕才负责远处的体积感。 */
function sleeveMaps() {
  const S = TEX_PX.sleeve;
  const WEAVE = 96;                           // 14cm 一格 → 经/纬各 96 根，织孔 1.5mm
  const GRID = 20;                            // 加固格 7mm 一道
  const thread = (t, per) => {
    // 到最近一根线的距离（环绕），高斯剖面
    const d = Math.abs(((t * per) % 1) - 0.5);
    return Math.exp(-(d * d) / (0.0035 * 0.0035));
  };
  const weave = sepField(S,
    (u, A, o) => { A[o] = thread(u, GRID); A[o + 1] = Math.sin(u * Math.PI * 2 * WEAVE); },
    (v, B, o) => { B[o] = thread(v, GRID); B[o + 1] = Math.sin(v * Math.PI * 2 * WEAVE); },
    (gu, su, gv, sv) => 0.20 * Math.max(gu, gv) + 0.14 * su * sv);
  const fibers = lowField(S, (u, v) => vnoise(u * 128, v * 128, 128, 51), 4);
  const mottle = lowField(S, (u, v) => fbm(u, v, 4, 3, 53), 8);
  // 折痕：粗噪声取脊（`1-|2n-1|` 的峰在 n=0.5）再三次幂收尖，得到一条条窄而陡的折线。
  // 用 lowField 的粗网格算（每格约 1/div = 1/6 纹理 = 2.3cm），正好落在要的尺度上。
  const warp = lowField(S, (u, v) => vnoise(u * 6, v * 3, 6, 61, 3), 7);
  const crease = new Float32Array(S * S);
  for (let i = 0; i < crease.length; i++) {
    const c = 1 - Math.abs(2 * warp[i] - 1);
    crease[i] = Math.pow(c, 2.5) * (0.45 + 0.55 * mottle[i]);
  }

  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) {
    h[i] = weave[i] + fibers[i] * 0.14 + (mottle[i] - 0.5) * 0.10 - crease[i] * 0.85;
  }

  const base = hexLin(SLEEVE);
  return buildMaps(S, h, 6.0, 0.95,
    (i, o) => {
      const l = (1 + 0.18 * (mottle[i] - 0.5) + 0.12 * (fibers[i] - 0.5) + 0.6 * weave[i])
        * (1 - 0.26 * crease[i]);          // 折痕里是暗的（自遮挡 + 积灰）
      o[0] = base[0] * l; o[1] = base[1] * l; o[2] = base[2] * l;
    },
    // 布几乎处处发涩：0.88~0.93。**织纹对粗糙度的影响必须写进来**，
    // 否则掠射光下袖子是一条均匀的塑料管。
    (i) => 0.90 + 0.25 * weave[i] + 0.02 * (fibers[i] - 0.5) + 0.05 * crease[i]);
}

/** 袖口束带：**罗纹弹力布**（一圈圈细密的竖棱）。它存在的意义是给「袖子插着一只手」
 *  那个断口一个交代 —— 袖口本来就是收口的、比袖管深一档，这一块是画面里
 *  唯一能把「衣服」和「胳膊」分开的构件，所以给它自己的贴图、不复用袖管那张。
 *  UV 由 cuffGeo 烘成「格数」，材质那边 repeat 固定 (1,1)。 */
function cuffMaps() {
  const S = TEX_PX.cuff;
  const RIBS = 3;      // 3cm 一格 → 每 3cm 三道棱，棱距 1cm（一圈约 38 道）
  const rib = field(S, (u) => Math.cos(u * Math.PI * 2 * RIBS));
  const fuzz = lowField(S, (u, v) => vnoise(u * 160, v * 160, 160, 71), 4);
  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = rib[i] * 0.8 + (fuzz[i] - 0.5) * 0.1;

  const base = hexLin(CUFF);
  return buildMaps(S, h, 3.0, 0.75,
    (i, o) => {
      const l = (1 + 0.22 * rib[i]) * (1 + 0.10 * (fuzz[i] - 0.5));
      o[0] = base[0] * l; o[1] = base[1] * l; o[2] = base[2] * l;
    },
    (i) => 0.78 + 0.10 * fuzz[i]);        // 弹力布比平织滑一点
}

// 四套贴图全局共用 —— 它们是纯数据、不可变，每个 ViewArms 实例各建一份纯属浪费。
let TEX_SETS = null;
function texSets() {
  if (TEX_SETS) return TEX_SETS;
  TEX_SETS = {
    glove: gloveKnitMaps(),
    palm: gloveLeatherMaps(),
    pad: glovePadMaps(),
    sleeve: sleeveMaps(),
    cuff: cuffMaps(),
  };
  return TEX_SETS;
}

// ---------- 几何体全局共享（照抄 enemy_model.js 的惰性缓存：每把武器重建会漏 buffer geometry）----------
// 换弹中段左手带的弹匣。**只有这一块还是程序化的** —— CS 那份里没有可拎的弹匣。
let GEO = null;
function geo() {
  if (GEO) return GEO;
  const box = (w, h, d, tx = 0, ty = 0, tz = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(tx, ty, tz);
    return g;
  };
  GEO = {
    // 换弹中段左手带的弹匣（要穿过掌心，位置由 _buildArm 定）
    mag: box(0.030, 0.110, 0.070, 0, -0.058, 0),
    // 袖口的束口环：**按「袖管在腕端的半径」现做**（见 _install 里实测那段），
    // 这里只给一个占位用的单位环，实际几何在 _cuffGeo() 里按实测算出来。
    cuff: null,
  };
  return GEO;
}

// 袖口那一圈束带的几何：一个**开口圆柱**，半径与长度按实测的袖管尺寸推。
// 为什么值得专门做一块：手套和袖子是两份网格直接对接的，接口处只有「颜色突然换掉」
// 一条信息 —— 画面上就是一个绿管子插着一只棕手。真实的袖口是**有厚度的束口**，
// 而且在腕上鼓出来一圈，它同时干掉了「管子断口」和「手肘以下没有结构」两件事。
// 半径给 1.16 倍：束带本来就比袖管粗一点，而且留出余量避免与袖管 Z-fighting。
// **UV 直接烘成「格数」**（uv 单位 = 一个 TEX_TILE），所以它的材质用 repeat(1,1)：
// 圆柱的默认 UV 是 [0,1] 归一化，周长 0.28m 与长度 0.04m 会差 7 倍，
// 交给 repeat 去补就会撞上 _mat() 里那条「两轴差 3 倍以上按各向同性」的保护 ——
// 那条保护是给「拿不到 UV 的网格」用的，在这里会把束带的织纹压成一条线。
function cuffGeo(rad, len, tile) {
  const g = new THREE.CylinderGeometry(rad * 1.16, rad * 1.10, len, 18, 1, true);
  g.translate(0, -len / 2, 0);   // 顶点沿 -y 伸展，与整套骨架的约定一致（见文件头）
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * (2 * Math.PI * rad * 1.13) / tile, uv.getY(i) * len / tile);
  }
  uv.needsUpdate = true;
  return g;
}

/**
 * 一件网格的 **UV 密度**：每 1 个 UV 单位对应多少米（u / v 两轴分开量）。
 * 为什么必须实测：CS 那份模型的两条袖管 UV 尺度不一样（ArmR 与 ArmL 差近两倍），
 * 两轴之间也能差 1.7 倍。共用一份 repeat 会让一条袖子的织纹被轴向拉长、另一条被压扁 ——
 * 这是「一眼假」的典型来源，而且从截图上只会看成「贴图有点糊」，很难反推。
 *
 * 量法：遍历全部子网格的**每一条边**，累加 |Δ世界坐标| / Σ|Δuv|（逐轴）。
 * 用边长加权而不是「包围盒 ÷ uv 跨度」——后者在多岛 UV 上会差出好几倍。
 * 网格没有 UV（attributes.uv 缺失）时返回 null，由 _mat() 回退到 repeat(1,1)。
 */
function uvDensity(root) {
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  let du = 0, dv = 0, dw = 0;
  for (const o of collectMeshes(root)) {
    const g = o.geometry;
    const pos = g && g.attributes && g.attributes.position;
    const uv = g && g.attributes && g.attributes.uv;
    if (!pos || !uv || !g.index) continue;
    const idx = g.index;
    // 每 7 条边取一条：UV 密度在同一块面上是常量，全量遍历纯属浪费（这几万三角形的
    // 模型在初始化时跑一次，抽稀后耗时从 ~40ms 掉到个位数）。
    for (let i = 0; i + 2 < idx.count; i += 3) {
      for (let e = 0; e < 3; e++) {
        const i0 = idx.getX(i + e), i1 = idx.getX(i + ((e + 1) % 3));
        if (((i + e) % 7) !== 0) continue;
        a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1);
        const d = a.distanceTo(b);
        du += Math.abs(uv.getX(i1) - uv.getX(i0));
        dv += Math.abs(uv.getY(i1) - uv.getY(i0));
        dw += d;
      }
    }
  }
  if (!(dw > 1e-6) || !(du > 1e-9) || !(dv > 1e-9)) return null;
  return { u: dw / du, v: dw / dv };
}

/** 源材质名 → 贴图种类。**唯一的映射点**，_install 与 _cuff 都走它。
 *  CS 那份模型的手只用了三个材质名（`glove` 手背针织 / `glove_palm` 掌心合成革 /
 *  `gun_rubber` 虎口橡胶垫），旧版把它们统统映到一块同色同糙的材质上 —— 手背上
 *  本来该有三种手感的三块面因此糊成一团，这是「一团橡皮泥」的成因之一。
 *  未命中（换手模型）一律回退成手背针织。 */
function matKind(name) {
  if (MAT_SLEEVE_NAMES.has(name)) return "sleeve";
  if (name === "glove_palm") return "palm";
  if (name === "gun_rubber") return "pad";
  return "glove";
}

// ---------- 握持锚点表（武器组局部）----------
// r = 右手（扣扳机那只）腕点，l = 左手（托举）腕点，null 表示这把枪只用一只手。
// m = 弹匣井（换弹时左手把弹匣插进去的位置）。
//
// **整张表是照着「逐 mesh 实测的包围盒」推的，不是估的。** 方法：在武器组局部用 Box3 量出每个
// 材质段的 y/z 区间，认出「护木 / 握把 / 弹匣」三块，再让手**从下方包住**那一块。
// 关键实测值（AK）：护木 Wood y∈[0.043,0.112] z∈[-0.202,-0.07]、握把 Wood y∈[-0.055,0.031]
// z∈[0.112,0.185]、弹匣 Dark_metal y∈[-0.119,0.055] z∈[-0.095,0.043]。
// M4：护木 Primary y∈[0.017,0.126] z∈[-0.236,0.012]、握把在 Primary z∈[0.009,0.245] 的后段；
// 手枪 P320 的握把与套筒同在一个 mesh（y 下探到 -0.18），只能按「握把在后下方」估；
// **匕首是倒着握的**（刀柄在上、刃朝下）：红柄占 y∈[0,0.25]、护手在 y≈0、刃在 y<0，
// 所以手要落在 y 为正的那一侧 —— 第一版按 AGENTS.md 里"knife_s_1 是刀柄"的说法
// 去抓下半截，抓的其实是刀刃（实测截图看到手握住金色的刃）。
// 投掷物是半径 0.11 的球，手从**后下方**托着，掌心必须落进球的下半部才有"握住"的读感。
//
// `s` = **整只手（含前臂）的缩放**，绕腕点缩（作用在 grp 上，见 configure）。
// **这不是装饰参数**：视模是超尺寸的（手枪 0.55 / 匕首 0.50 的归一化长度都远大于真枪），
// 握把截面因此比真枪粗得多，不缩的话手会整个埋进握把里、什么都看不见；反过来匕首柄又太细。
// 步枪的 0.743 是**推导出来的**：CS 那把 AK 长 1.1036、我们归一化到 0.82 → 0.82/1.1036。
// 其余几把没有对应关系（CS 没有手枪/投掷物），按「手的绝对尺寸与步枪一致」起步、再目视微调。
//
// `hr` / `hl` = 左右手**各自的旋转**（弧度，XYZ）。CS 的手是照着**它那把枪**的握把烘的姿势，
// 换到我们的枪上角度不完全吻合（尤其手枪的握把倾角差得多），留这两个字段逐把修。
export const ARM_ANCHORS = {
  ak:     { r: [ 0.006,  0.001,  0.155], l: [-0.025,  0.041, -0.146], s: 0.743 },
  m4:     { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190], s: 0.743 },
  awm:    { r: [ 0.018, -0.045,  0.160], l: [-0.025, -0.030, -0.230], s: 0.743 },
  pistol: { r: [-0.028, -0.100,  0.160], l: [-0.048, -0.135,  0.115], s: 0.800, m: [ 0.0, -0.230, 0.140] },
  knife:  { r: [ 0.000,  0.020,  0.000], s: 0.550, l: null },
  frag:   { r: [-0.030, -0.035,  0.080], s: 0.650, l: null },
  flash:  { r: [-0.030, -0.035,  0.080], s: 0.650, l: null },
  smoke:  { r: [-0.030, -0.035,  0.080], s: 0.650, l: null },

  // ---- 模型皮肤专用锚点表 ----
  // 每款模型皮肤各一张，键名由皮肤 `model.anchorKey` 指定（`configure()` 取不到就回退到
  // 武器 id 那张，再取不到回退 ak）。为什么要按模型分而不是给枪加一个 Y/Z 平移：
  // 一次握持是**两个**接触点（右手腕咬扳机、左手腕托护木）**加**换弹的弹匣井，单一个平移
  // 最多只对得准一个点，另外两个必然漂；它还会挪动整把枪，破坏 bx/by/bz 当初按
  // 「手必须落在画面内」反推出来的构图。
  // 初值一律复制所属武器那一套（含 `m` = 弹匣井，显式写出来是为了让它可单独调），
  // 之后靠 `armsPose()` + `project()` 的数值逐个调 —— 视模从不读枪的几何自适应，只能量。
  ak_classic:   { r: [ 0.018, -0.030,  0.145], l: [-0.025,  0.023, -0.175], s: 0.743, m: [0, -0.155, 0.020] },
  m4_thor:      { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190], s: 0.743, m: [0, -0.155, 0.020] },
  m4_frost:     { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190], s: 0.743, m: [0, -0.155, 0.020] },
  m4_bubblegum: { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190], s: 0.743, m: [0, -0.155, 0.020] },
  awm_volt:     { r: [ 0.018, -0.045,  0.160], l: [-0.025, -0.030, -0.230], s: 0.743, m: [0, -0.155, 0.020] },
  awm_field:    { r: [ 0.018, -0.045,  0.160], l: [-0.025, -0.030, -0.230], s: 0.743, m: [0, -0.155, 0.020] },
};

// 肘点（武器组局部）由 configure() 现算成 `anchor + ELBOW_DIR * ELBOW_DIST`。
// 为什么不再是一张固定的绝对点表：肘的**方向**是人的姿势（与枪无关），而腕点随枪走 ——
// 固定绝对点会让「换一把枪」同时改掉前臂的角度，于是同一双手在八把枪上指着八个方向。
// 对外仍导出 `ELBOWS` 给调试钩子读（值是最近一次 configure 算出来的绝对点，只读）。
export const ELBOWS = { r: [0, 0, 0], l: [0, 0, 0] };

// 换弹中段的两个落点。**注意这两者处在不同的坐标系里，这是有意的**：
//
//  · MAGWELL / MAG_SLAP 是**武器组局部**坐标（弹匣井是枪身上的一块，必须跟着枪走）。
//  · POUCH 是**相机空间**坐标（腰侧弹匣袋钉在屏幕上，不能跟着枪走）。
//
// 为什么必须分开：手臂是武器组的子节点，而换弹时组本身会下沉、再俯仰。
// 腰袋点若也用组局部坐标，就会被这组变换一起甩出去 —— 实测 p=0.40 时手落在屏幕 y≈1600px，
// 整段下探全程在画面外（相机空间 (-0.28,-0.45,-0.62) 经 -49° 俯仰后 y 变成 -0.665、
// z 变成 -0.249，投影直接爆掉）。所以 POUCH 在 update() 里用过组矩阵的**逆**换回组局部，
// 屏幕位置因此与枪怎么沉、怎么转完全无关。
const POUCH = new THREE.Vector3(-0.320, -0.200, -0.620); // 相机空间：胸前弹匣袋 ≈ px(400,506)
// 导出的理由只有一个：`armAnchors()` 这个读口要把**生效的**弹匣井补进每条锚点里
// （表里只有手枪显式写了 `m`，其余武器走这个常量）。让测试去写死 0.020/0.155 这类魔法数，
// 等于把「换弹时左手有没有对上弹匣井」这条断言挂在一个会跟产品漂移的副本上。
export const MAGWELL = new THREE.Vector3(0.000, -0.155, 0.020); // 组局部：弹匣井（现有弹匣下缘再低一点）
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

// 换弹期间左肘的**相机空间**位置：前臂从这里往画面左下伸出去。远端落在屏幕外是刻意的 ——
// 一条整整齐齐收在画面里的前臂看着像贴在镜头上的塑料管，出画才像「手长在自己身上」。
const ELBOW_L_RELOAD = new THREE.Vector3(-0.590, -0.410, -0.450);

const _tmpL = new THREE.Vector3();
const _tmpE = new THREE.Vector3();
const _tmpR = new THREE.Vector3();
const _kA = new THREE.Vector3();
const _kB = new THREE.Vector3();
const _dirR = new THREE.Vector3();
const _dirL = new THREE.Vector3();

export class ViewArms {
  constructor() {
    const G = geo();
    // 材质每个实例一份（与 SoldierRig 同理：将来若要做「受击/变色」不会互相串）。
    // **手部四块网格的材质是在 _install 里按「源材质名 + 左右」现建的** —— 因为
    // 贴图的 repeat 必须按那条网格**实测的 UV 密度**反推（见 _mat），构造期拿不到。
    this.matMag = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.68, metalness: 0.28 });
    this._matCache = new Map();

    this.root = new THREE.Group();
    this.root.name = "viewArms";
    this.armR = this._buildArm(G, 1, "R");
    this.armL = this._buildArm(G, -1, "L");
    // 弹匣只挂在左手上（右手的枪自己带着弹匣）
    this.magL = this.armL.mag;
    this.root.add(this.armR.grp, this.armL.grp);

    // 手部网格是异步装进来的（见 load()）。这把锁只用于**降级提示**：
    // 装载失败时枪照常显示、只是没有手，而不是整局崩掉。
    this.handsReady = false;

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
    this._solveElbows();
    this._aim(this.armR, this.anchorR, this.elbR);
    this._aim(this.armL, this.anchorL, this.elbL);
  }

  /**
   * 把 CS 那份 GLB 里的四块网格装进已经搭好的骨架上。**必须在第一帧之前完成**
   * （main.js 的 init() 把它并进 Promise.all）—— 否则开局那一帧是「枪浮在空中」。
   * 失败**不是静默 no-op**：返回 false，由调用方 toast 报错；枪照常显示、只是没有手。
   */
  load(url = CS_HANDS_URL) {
    return new Promise((resolve) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          const src = gltf.scene;
          // **不需要 clone**：四个节点各用一次，直接从源场景里摘过来即可。
          // 顺带绕开 `Object3D.copy()` 会把 userData 走一遍 JSON 序列化那个坑。
          const take = (name) => {
            const o = src.getObjectByName(name) || null;
            if (o) o.removeFromParent();
            return o;
          };
          const parts = {
            handR: take("HandR"), armR: take("ArmR"),
            handL: take("HandL"), armL: take("ArmL"),
          };
          if (!parts.handR || !parts.armR) return resolve(false); // 只有右手也认作失败
          // 装载本身也可能抛（比如源数据的键名/字段对不上）。**必须在这里接住**：
          // GLTFLoader 的 onLoad 里抛出的异常会被它转给 onError，于是一路退化成「静默无手」，
          // 控制台之外没有任何痕迹 —— 实测踩到过一次（CS_SRC 用 "R"/"L" 做键、
          // 而这里传的是 arm.side 那个 ±1 的数字，取到 undefined，排查了三轮）。
          try {
            this._install(this.armR, parts.handR, parts.armR);
            if (parts.handL && parts.armL) this._install(this.armL, parts.handL, parts.armL);
          } catch (err) {
            console.error("[viewarms] 双手装载失败", err);
            return resolve(false);
          }
          this.handsReady = true;
          resolve(true);
        },
        undefined,
        (err) => { console.error("[viewarms] 双手 GLB 加载失败", err); resolve(false); }
      );
    });
  }

  // 把一对「手 + 袖」挂进一只骨架的手臂上（坐标系与枢轴见文件头与 CS_SRC 注释）
  _install(arm, handMesh, armMesh) {
    // **用 arm.tag（"R"/"L"）取表，不是 arm.side（±1）**：CS_SRC / ARM_STRETCH 都以字母为键，
    // 传数字会取到 undefined，紧接着 `hp[0]` 抛异常 —— 而那异常在 GLTFLoader 的 onLoad 里，
    // 会被它吞成 onError，表现是「手静默不显示」而不是报错。
    const side = arm.tag;
    // 手：枢轴 = 手掌包围盒中心，于是它正好落在 ARM_ANCHORS 的 r/l 上
    const hp = CS_SRC.handPivot[side], aw = CS_SRC.armWrist[side], ad = CS_SRC.armDir[side];
    arm.handWrap.position.set(-hp[0], -hp[1], -hp[2]);
    arm.handWrap.add(handMesh);

    // 前臂：① 转正 —— 把它的**真实主轴**旋到局部 -Y（否则 _aim 会把它指歪，见 CS_SRC 注释）；
    //        ② 再把腕端挪到 fore 的原点，于是 fore 的位置就是腕点、_aim 转的就是整根前臂。
    const axis = new THREE.Vector3().fromArray(ad);
    const q = new THREE.Quaternion().setFromUnitVectors(axis, DOWN);
    arm.armWrap.quaternion.copy(q);
    arm.armWrap.position.copy(new THREE.Vector3().fromArray(aw)).applyQuaternion(q).negate();
    // 袖管挂在 **armWrap** 上（不是 armStretch）——层级是 fore → armStretch(scale) → armWrap(quat) → 网格，
    // 顶点才会先转正、再沿前臂轴拉伸。挂错一层就退回「沿源空间的歪轴拉」，见 _buildArm 里那段注释。
    arm.armWrap.add(armMesh);

    // 袖管的轴向长度（腕 → 肘）。**从几何实测**，不抄 CS_SRC 里那几个数 ——
    // 那几个是枢轴用的，和「袖口到底伸到哪」不是同一件事，抄错了会让 armTip() 骗人。
    const bb = new THREE.Box3().setFromObject(armMesh);
    let mn = Infinity, mx = -Infinity;
    const corner = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
      const d = corner.dot(axis);
      if (d < mn) mn = d;
      if (d > mx) mx = d;
    }
    // axis 是**腕 → 肘**，而腕落在投影小的一端，所以长度就是整个跨度
    arm.armLen = mx - mn;

    // 只借几何、不借材质（CS 的织纹贴图不搬，配色与贴图都是我们自己的，见文件头）。
    // 材质按**源材质名 + 左右**现建：手背针织 / 掌心合成革 / 虎口橡胶垫三块在手背上
    // 本来就该是三种手感，同色同粗糙度正是「一团橡皮泥」的成因之一。
    const handDen = uvDensity(handMesh), armDen = uvDensity(armMesh);
    for (const o of collectMeshes(handMesh)) o.material = this._mat(matKind(o.material.name), side, handDen);
    for (const o of collectMeshes(armMesh)) o.material = this._mat(matKind(o.material.name), side, armDen);
    // 袖口束带：位置与粗细全部由**实测**推出（袖管在腕端的半径 + 袖管本身的长度比例），
    // 不写死数字 —— 换了源模型（换手）它自己就跟着变。
    // **必须在下面那个打标循环之前造出来并挂上**，否则它不进 collectMeshes、拿不到
    // `userData.viewArms`，会被 meshMats() 当成武器材质导出去（皮肤测试的条数断言会红）。
    const cuff = this._cuff(armMesh, axis, new THREE.Vector3().fromArray(aw), arm.armLen, side);
    if (cuff) arm.fore.add(cuff);

    for (const o of [...collectMeshes(handMesh), ...collectMeshes(armMesh)]) {
      o.frustumCulled = false;   // 视模紧贴相机，视锥剔除只会带来闪烁
      o.castShadow = false;
      o.receiveShadow = false;
      // 手臂不属于「武器材质」——meshMats() 会遍历整个武器组导出材质快照，
      // 不过滤的话皮肤测试的条数/下标断言会全线崩（见 main.js 的 meshMats）。
      o.userData.viewArms = true;
    }
    if (cuff) { cuff.frustumCulled = false; cuff.userData.viewArms = true; }
  }

  /**
   * 袖口那圈束带。半径取「腕端附近那些顶点到前臂轴的半径」，只统计靠腕的那一段
   * （靠肘那端是喇叭口，拿它做束带会得到一个比手还粗的环）。
   * 全部按**源模型坐标**造 —— 它是 armWrap 的兄弟节点，与网格同一个坐标系。
   */
  _cuff(armMesh, axis, wrist, armLen, side) {
    const r90 = [];
    const v = new THREE.Vector3();
    for (const o of collectMeshes(armMesh)) {
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).sub(wrist);
        const t = v.dot(axis);                       // 沿轴的坐标（腕 = 0）
        if (t < 0 || t > armLen * 0.22) continue;    // 只看靠腕的 22%
        r90.push(Math.sqrt(Math.max(0, v.lengthSq() - t * t)));
      }
    }
    if (r90.length < 8) return null;
    r90.sort((a, b) => a - b);
    const rad = r90[Math.floor(r90.length * 0.9)];   // 90 分位：不被个别飞点带大
    if (!(rad > 1e-4)) return null;
    return new THREE.Mesh(cuffGeo(rad, armLen * 0.10, TEX_TILE.cuff), this._mat("cuff", side, null));
  }

  /**
   * 取一件手部材质。key = **贴图种类** + 左右 —— **必须按左右分**：两张袖管的 UV 尺度实测
   * 差近两倍（ArmR 每 UV 单位 0.133m、ArmL 0.129m，v 方向 0.108 / 0.112），
   * 共用一份贴图会让一条袖子的织纹被轴向拉长、另一条被压扁 —— 这是「一眼假」的典型来源。
   *
   * `kind` ∈ glove / palm / pad / sleeve / cuff（由 `matKind()` 从源材质名映射）。
   * `den` 是这条网格实测的 UV 密度（米/UV 单位，u 与 v 分开量），由此把 `repeat`
   * 反推成「一张贴图铺满 TEX_TILE[kind] 米」：repeat = 密度 / 尺寸。
   * `den === null` = 网格的 UV 已经烘成格数（袖口束带），repeat 固定 (1,1)。
   */
  _mat(kind, side, den) {
    const key = kind + "|" + side;
    let m = this._matCache.get(key);
    if (m) return m;

    const src = texSets()[kind];
    const tile = TEX_TILE[kind];
    m = new THREE.MeshStandardMaterial({
      // **必须是白的**：本色已经烘进 albedo 贴图了（gloveKnitMaps 等用 hexLin(底色) 当基色），
      // `color` 是**乘**在 map 上的 —— 两边都上等于色值平方，`0x6d563e² ≈ 0x2f1c0f`，
      // 手套会黑成一块（AGENTS.md 里集装箱那条是同一个坑）。调色改上面那四个常量。
      color: 0xffffff,
      roughness: 1,          // 完全交给 roughnessMap（roughness 是**乘**在贴图上的倍率）
      metalness: 0.02,
      envMapIntensity: 0.85,
      normalScale: src.normalScale.clone(),
    });
    // 贴图 clone() 共享同一份 image（不额外占显存），但 repeat 各自独立。
    // `den === null` = **这条网格的 UV 已经烘成「格数」了**（袖口束带就是这么造的，
    // 见 cuffGeo），它要的正是 repeat(1,1) —— 再乘一次 density 就成了平方。
    const use = (t) => {
      const c = t.clone();
      if (den) {
        let ru = den.u / tile, rv = den.v / tile;
        // 两轴比超过 3 倍，说明这条网格根本没有 UV（uvDensity 会对齐到守卫值），
        // 或者 UV 被非等比地摊平了 —— 这时按各向同性走，免得织纹被拉成一条线。
        const k = ru / rv;
        if (k > 3 || k < 1 / 3) rv = ru;
        c.repeat.set(ru, rv);
      } else {
        c.repeat.set(1, 1);
      }
      c.needsUpdate = true;
      return c;
    };
    m.map = use(src.map);
    m.normalMap = use(src.normalMap);
    m.roughnessMap = use(src.roughnessMap);
    this._matCache.set(key, m);
    return m;
  }

  // side = +1 右手 / -1 左手
  _buildArm(G, side, tag) {
    const grp = new THREE.Group();
    // 手掌单独一组：按武器/握把角度微调「手的姿态」只动这一组，
    // **不能**动 grp —— grp 的旋转会叠加到 fore 的四元数上，把前臂指歪（见 _aim）。
    const palm = new THREE.Group();
    // 手的枢轴修正再往里一层：`handWrap` 只负责把网络的包围盒中心挪到原点 + 承接每把枪的
    // 姿态修正（hr/hl），换上层的 palm 是为了让「按武器调角度」与「按源数据摆枢轴」分开，
    // 免得两者写在同一个 quaternion 上互相覆盖。
    const handWrap = new THREE.Group();
    palm.add(handWrap);
    grp.add(palm);

    // 前臂挂在**腕点**（由 _install 把源前臂的腕端挪到这里）。fore 的 quaternion 由 _aim 每帧覆盖，
    // 所以任何「让袖子转个角度」的修正都必须写在里层的 armWrap 上，不能写在这一层。
    const fore = new THREE.Group();
    // 腕点在「手心坐标系」里的偏移：源数据里前臂腕端相对手掌中心的差，直接搬过来 ——
    // 这样手和袖是**同一份源数据推出来的两个点**，不会各调各的、最后在腕子上裂一道缝。
    fore.position.set(
      CS_SRC.armWrist[tag][0] - CS_SRC.handPivot[tag][0],
      CS_SRC.armWrist[tag][1] - CS_SRC.handPivot[tag][1],
      CS_SRC.armWrist[tag][2] - CS_SRC.handPivot[tag][2]
    );
    // 拉伸层与旋转层的**嵌套顺序是有讲究的，反了会把袖口从腕上掰开**（实测踩到）：
    //   · `armWrap` 自带源模型枪空间的旋转 q（把前臂的真实主轴旋到局部 -Y），
    //     所以它**内层**的坐标是**源模型的枪空间** —— 而源空间里的 Y 根本不是前臂的轴
    //     （实测差 33°）。在这层做 `scale.y` 等于沿着一根歪轴拉，袖口被挪走 **0.0619m**、
    //     整根管子还歪 33°：画面上就是「袖子和小手之间裂一道缝」。
    //   · `fore` 的局部 -Y **才是**前臂轴 —— `_aim()` 每帧用
    //     `setFromUnitVectors(DOWN, normalize(elbow - wrist))` 保证了这一点。
    //     所以拉伸必须放在 `fore` 与 `armWrap` 之间。
    //   · 而且**不需要**为位置做补偿：腕端 `aw` 经 q 与 p 之后恰好落在 fore 的原点上，
    //     而原点对任何 `scale` 都是不动点。写 `armWrap` 的 position 那一行照旧即可。
    // 为什么不用 `fore.scale` 直接拉：`armWrap.position` 是 fore 的子节点，
    // 会跟着一起被缩放，腕点就滑出手心了（子节点的 position 活在父节点的缩放空间里）。
    const armStretch = new THREE.Group();
    armStretch.scale.set(1, ARM_STRETCH[tag], 1);
    const armWrap = new THREE.Group();
    armStretch.add(armWrap);
    fore.add(armStretch);
    grp.add(fore);

    // 换弹时左手拎着的弹匣（只在左手；右手那把枪的弹匣始终插在枪上）
    const mag = new THREE.Mesh(G.mag, this.matMag);
    // 弹匣要**穿过掌心**：弹匣顶得压在掌心以上，否则手和弹匣之间会露出一道缝，
    // 看着像两块分开的板（实测）。
    mag.position.set(0, -0.005, 0.010);
    mag.visible = false;
    mag.frustumCulled = false;
    mag.userData.viewArms = true;
    grp.add(mag);

    return { grp, palm, handWrap, fore, armWrap, armStretch, mag, side, tag };
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
    // 手部缩放：缩的是 grp，而 grp 的原点就是腕点 —— 所以整只手（含前臂、弹匣）
    // 是「绕腕点缩小」，腕点本身不动、仍然咬在握把上。
    const s = a.s || 1;
    this.armR.grp.scale.setScalar(s);
    this.armL.grp.scale.setScalar(s);
    // 每把枪的手部姿态修正（CS 的手是照它那把枪烘的，换到我们的枪上角度不完全吻合）
    this.armR.palm.rotation.fromArray(a.hr || [0, 0, 0]);
    this.armL.palm.rotation.fromArray(a.hl || [0, 0, 0]);
    this.armL.grp.visible = this.hasLeft;
    this.magL.visible = false;
    this._solveElbows();
    // 立刻摆到静止位：切枪那一帧手臂不这么放的话，会有一帧停在上一把枪的握位上
    this._aim(this.armR, this.anchorR, this.elbR);
    if (this.hasLeft) this._aim(this.armL, this.anchorL, this.elbL);
  }

  // 袖口在**武器组局部**的坐标。判「前臂有没有画到画面外」靠它：喂给 main.js 的 project()
  // 就知道袖口落在第几个像素，是**数值判据**而不是截图目测（截图只告诉你某一帧看着不对）。
  // 解析算出，不走 Box3 —— Box3 是世界坐标、旋转下会把盒子撑大，拿来判「出没出画」会偏保守。
  armTip(side, out = new THREE.Vector3()) {
    const a = side === "l" ? this.armL : this.armR;
    const L = (a.armLen || 0) * (a.armStretch ? a.armStretch.scale.y : 1);
    // 前臂的伸展方向恒为 fore 的局部 -y（_aim 就是把它转到腕→肘方向上的）
    return out.set(0, -L, 0).applyQuaternion(a.fore.quaternion).add(a.fore.position);
  }

  // 肘 = 腕 + 方向 × 距离。**方向是固定的、腕点随枪走** —— 见 ELBOW_DIR 的注释。
  _solveElbows() {
    _dirR.fromArray(ELBOW_DIR.r).normalize();
    _dirL.fromArray(ELBOW_DIR.l).normalize();
    this.elbR.copy(this.anchorR).addScaledVector(_dirR, ELBOW_DIST);
    this.elbL.copy(this.anchorL).addScaledVector(_dirL, ELBOW_DIST);
    ELBOWS.r = this.elbR.toArray();
    ELBOWS.l = this.elbL.toArray();
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
   * @param invM      武器组矩阵的逆（相机空间 → 组局部）。换弹时组的俯仰很大，
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

// 生成器 / 多 primitive 网格在 three 里会成为 Group，所以一律往下收一层。
// （CS 的 HandR/HandL 各带 3 个材质 → 3 个 primitive → 一定是 Group。）
function collectMeshes(o) {
  const out = [];
  o.traverse((m) => { if (m.isMesh) out.push(m); });
  return out;
}
