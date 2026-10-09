// ===== 运输船地图（CrossFire 风格集装箱货轮战场）=====
import * as THREE from "three";
import { makeGLTFLoader } from "./gltf.js";
import { batchStatic } from "./batch.js";
// 程序化 PBR 管线（高度场 → albedo / normal / roughness 三件套）与第一人称手套共用同一份，
// 见 texturekit.js 的模块头。**不要再另写第二套噪声/法线生成代码。**
import { clamp01, sstep, hash2, vnoise, fbm, field, lowField, sepField, hexLin, lin2srgb, buildMaps, buildMapsRect } from "./texturekit.js";

const loader = makeGLTFLoader();

// `?nobatch` 关掉静态几何合批。**这不是一个装饰性开关**：合批会把 `obstacles` 里的对象
// 换成烘焙到世界坐标的合并产物，而「子弹该打在哪儿」必须逐点等价 —— 用它在**同一次构建**里
// 做 A/B，比对新旧 obstacles 对同一条射线的命中距离（见 /tmp/cfprobe.mjs）。
// 平时永远不开。
const NO_BATCH = new URLSearchParams(location.search).has("nobatch");

// 统一配色（对齐 assets/image.png：炭灰钢甲板 + 军绿集装箱 + 米黄木箱 + 灰白钢质上层建筑）
const PAL = {
  // 甲板被半球光的冷蓝天空色照亮，出图会偏蓝；底色故意偏暖一点抵消回来。
  // **这一档是「近黑炭灰」那条设计规范落地的位置**：贴图的钢灰（0x9aa0a6）是中性灰，
  // 真正的色调全在这个乘积里，所以调它不用碰贴图。改它必须与 main.js 的灯光配比
  // 一起定标 —— 两边都在改整体亮度，分两次调会来回打架（见 main.js 灯光那一段）。
  deck: 0x59564d,
  olive: 0x3d5634,  // 军绿
  dgreen: 0x2f5230, // 深绿（参考图里占多数）
  gray: 0x7f868c,   // 浅灰
  grayblue: 0x5f6b78,
  khaki: 0x8f8560,  // 浅卡其
  lwood: 0xcdb488,  // 浅原木（米黄木箱）——参考图里木箱是最亮的元素，别压暗
  rail: 0x7d848c,
};

// ---------- 程序化材质纹理（钢甲板 / 锈 / 集装箱漆 / 条纹）----------
//
// **本节的大面积表面一律走 `texturekit.js` 的「高度场 → albedo + normal + roughness」三件套。**
// 改造之前甲板只有一张 512² 的纯色贴图：**全项目一张法线贴图都没有**，所有凹凸
// （防滑纹、拼缝、锈坑）只是画在颜色上的明暗，光照下不产生任何起伏响应 ——
// 这是「看着假」的首要原因，比配色问题更根本。
//
// 甲板：偏冷的炭灰防滑钢板。参考图里甲板是哑光深灰而非刷白，
// 所以 albedo 定在中性钢灰，真正的色调交给 material.color 去乘（见 PAL.deck）。
const DECK_TILE = 5.7;   // 一个大砖 5.7m（拼缝 1.43m 一格、防滑纹 0.18m 一块，都是真实尺寸）
const DECK_PX = 1024;    // 1024 / 5.7 ≈ 180 px/m
const DECK_NSTR = 1.7;   // 法线强度：拼缝要看得见、防滑纹不能过冲成鹅卵石
const DECK_NSCALE = 0.8;

function steelDeckMaps() {
  const S = DECK_PX;
  const cells = 32;   // 防滑菱形纹：每砖 32 块 → 5.7/32 ≈ 0.178m
  // 钢板拼缝**必须各向异性**，否则甲板读起来是一地瓷砖。
  //
  // 两个轴对应 DeckGeometry 顶面的 u↔x、v↔z（three 的 `buildPlane('x','z','y',1,-1,…)`），
  // 也就是 u 横跨船宽、v 沿船长。真船的甲板是**长条板沿船长铺**：横向的边接缝
  // （seam）间距 1.5~2.5m，纵向的端接缝（butt）间距 6~12m。
  // 两轴都取 4（=1.43m 方格）时，出图就是一片 1.43m 的正方形网格 —— 在
  // `sa-aft-house.png` 的掠射角下像铺了地砖，是那一帧里最假的一处。
  // 现在：横向 3 分格 ≈ 1.9m 一道边接缝，纵向 1 分格 = 5.7m 一道端接缝（落在砖边界上，
  // 因为缝在 v=0 处、而贴图是环绕的，跨砖时接得上）。
  const seamU = 3, seamV = 1;
  // 缝宽按**米**定，不能按「分格的百分比」定：sstep 的阈值是作用在 `f` 的小数部分上的，
  // 而 `f = t·N` —— 同一道阈值在 N 大的一轴上换出来的实际宽度要除以 N。直接用
  // 0.022 的话横向缝是 4.2cm、纵向缝是 12.5cm（宽了三倍，看着像一条胶带）。
  // 换算：世界宽度 = (阈值/N)·5.7m，所以 阈值 = 世界宽度·N/5.7。
  const SEAM_W = 0.042 / DECK_TILE;  // 4.2cm 的焊缝

  // ① 防滑菱形纹 + 细颗粒。**逐像素**（一块 0.18m 只占 32px，低频放大就没了）。
  //    菱形 = 把 L1 距离沿 v 拉长，得到防滑板上那种窄长的凸块；凸块之间留平底。
  //    颗粒用可平铺的哈希：`gx*8` 在 u→1 时正好等于 256 = cells*8，取模后接得上。
  const tread = field(S, (u, v) => {
    const gx = u * cells, gy = v * cells;
    const fx = gx - Math.floor(gx) - 0.5, fy = gy - Math.floor(gy) - 0.5;
    const m = Math.abs(fx) + Math.abs(fy) * 1.55;
    const bump = sstep(0.46, 0.18, m);
    const K = cells * 8;
    const n = hash2(Math.round(gx * 8) % K, Math.round(gy * 8) % K, 5);
    return bump * 0.78 + n * 0.22;
  });
  // ② 大块起伏（钢板不平整、被压出的浅坑）—— 低频，放大不丢信息
  const macro = lowField(S, (u, v) => fbm(u, v, 6, 3, 71), 4);
  // ③ 锈迹蒙版（大块 + 碎边）  ④ 油渍 / 水渍蒙版
  const rust = lowField(S, (u, v) => fbm(u, v, 3, 5, 133), 3);
  const oil = lowField(S, (u, v) => fbm(u, v, 2, 3, 907), 4);
  // ⑤ 拼缝：只由 u 或只由 v 决定 → 走可分离场，O(S) 而不是 O(S²)
  const seamT = sepField(S,
    (t, out, off) => {
      const f = t * seamU;
      out[off] = sstep(SEAM_W * seamU, 0.0, Math.min(f - Math.floor(f), 1 - (f - Math.floor(f))));
      out[off + 1] = 1;
    },
    (t, out, off) => {
      const f = t * seamV;
      out[off] = sstep(SEAM_W * seamV, 0.0, Math.min(f - Math.floor(f), 1 - (f - Math.floor(f))));
      out[off + 1] = 1;
    },
    (a, _a2, b, _b2) => Math.max(a, b));

  // 合成高度场：防滑纹为主、大块起伏打底、拼缝是**下凹**（比防滑纹深，
  // 一眼才看得出甲板是一块一块焊起来的）。取值范围落在 [-0.45, 1]。
  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = tread[i] * 0.50 + macro[i] * 0.42 - seamT[i] * 0.45;

  const STEEL = hexLin(0x9aa0a6);  // 中性钢灰（真正的色调在 material.color 上）
  const RUSTC = hexLin(0x6b4526);
  const OILC = hexLin(0x24262a);

  const mix = (o, c, k) => { o[0] += (c[0] - o[0]) * k; o[1] += (c[1] - o[1]) * k; o[2] += (c[2] - o[2]) * k; };

  const albedo = (i, o) => {
    const hv = h[i];
    // 基色：凸处被鞋底与货物磨得亮一点，凹处积灰发暗
    const shade = 0.80 + 0.30 * hv;
    o[0] = STEEL[0] * shade; o[1] = STEEL[1] * shade; o[2] = STEEL[2] * shade;
    // 锈：把颜色往锈褐推（越锈越暗越暖），边缘用 sstep 收窄做出「锈斑」的硬边
    mix(o, RUSTC, sstep(0.50, 0.86, rust[i]) * 0.80);
    // 油渍 / 水渍：压暗去饱和
    mix(o, OILC, sstep(0.58, 0.88, oil[i]) * 0.55);
    // 拼缝里积的污——比周围暗一档，缝才立得起来
    const k = 1 - seamT[i] * 0.45;
    o[0] *= k; o[1] *= k; o[2] *= k;
  };
  // 粗糙度：磨亮处更滑、锈与积灰更粗。**roughnessMap 是乘在 material.roughness 上的**，
  // 所以用它的材质必须把 roughness 设成 1.0（见 texturekit.js 模块头那条）。
  const rough = (i) => clamp01(
    0.70 + 0.14 * h[i] + 0.24 * sstep(0.50, 0.90, rust[i]) - 0.10 * sstep(0.55, 0.88, oil[i]) + seamT[i] * 0.25);

  return buildMaps(S, h, DECK_NSTR, DECK_NSCALE, albedo, rough);
}

// 甲板贴图是**一整块 40×68m 的 BoxGeometry 的顶面**用的，但同一张图还要给走道（1.6m 宽）、
// 楼梯踏面、甲板室屋顶、栈桥桥面共用。BoxGeometry 每个面的 UV 都是 0..1，所以
// **共用一份 repeat 等于按各自的尺寸重新拉伸一遍** —— 走道会被拉开 25:1（实测），
// 上面的防滑纹变成一道道横条。
//
// 做法：按该表面的**真实长宽比**克隆一份贴图并重设 repeat。
// **克隆不增加显存**：r160 的 `WebGLTextures` 按 `Source` 去重上传（`_sources` 是 WeakMap，
// 见 three.module.js L24005 / L24643），而 `Texture.copy()` 连 `source` 一起复制 ——
// 所以多出来的只是几份 uv 变换矩阵。三张图（albedo / normal / roughness）各有自己的
// uv 变换（r160 起 `map` / `normalMap` / `roughnessMap` 各带一个 `*MapTransform` uniform），
// 所以它们必须一起克隆、一起设 repeat。
function deckSkin(w, h, tile) {
  const t = tile || DECK_TILE;
  const out = {};
  for (const k of ["map", "normalMap", "roughnessMap"]) {
    const c = deckMaps[k].clone();
    c.repeat.set(w / t, h / t);
    out[k] = c;
  }
  out.normalScale = deckMaps.normalScale;
  return out;
}

// 钢板甲板的贴图集只在 buildMap 里生成一次（1024² 三张图，加载期一次性开销），
// 上面两个函数读它。
let deckMaps = null;

/** 一种尺寸的钢质表面 = 按该尺寸定 repeat 的甲板贴图 + 指定的色调。
 *  **不要退回「所有钢板表面共用一个材质」** —— 那就是 25:1 拉伸的来源。 */
function deckSurface(w, h, color, metal = 0.04) {
  return new THREE.MeshStandardMaterial({
    ...deckSkin(w, h),
    color,
    roughness: 1.0,
    metalness: metal,
  });
}

// 太阳在天空贴图里的**归一化**位置，由场景那盏 DirectionalLight 的方向算出来。
// three 的 equirect 映射是 u = atan2(dir.z, dir.x)/2π + 0.5、v = asin(dir.y)/π + 0.5，
// 画布 y = (1−v)·H。灯在 (-34, 78, 30) → 单位向量 (-0.377, 0.865, 0.333)
// → u = 0.885、v = 0.833 → 画布 y = 0.167H。**改灯的坐标就得同步改这两个数**，
// 否则天上的太阳和地上的影子方向对不上，一眼假。
// 写成归一化值是刻意的：贴图分辨率以后还会动（它同时是 IBL），像素坐标会跟着漂。
const SUN_U = 0.885, SUN_V = 0.167;

// 晴空：等距柱状投影贴图（天顶深蓝 → 地平线海雾）+ fbm 云层 + 日轮光晕。
// equirect 的 v=0 是天顶、v=0.5 是地平线，所以渐变的分界要落在 0.5。
//
// 这张贴图**同时是 `scene.background` 与 `scene.environment`**（r160 的 WebGLRenderer
// 会对 equirect 环境自动跑 PMREMGenerator），所以它的质量会成片地反映到全场金属件
// 与掠射角高光上 —— 云层从「一坨圆斑」变成「有厚度的层」是这个文件里波及面最广的一处改动。
function skyTexture() {
  const W = 4096, H = 2048;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");

  // ① 天底渐变。地平线那一档**必须收敛到雾色**（FogExp2 的 0xc4dcea）——
  //    否则海天交界会是一条比两边都亮的硬边（实测就是那条突兀的浅色横带）。
  const g = x.createLinearGradient(0, 0, 0, H);
  //    **天顶色是 DESIGN.md 的规范值 #1a5aa6，不是更深的 #0d3f86。** 曾经为了「整体
  //    冷调」把天顶压到 #0d3f86（线性 B/R ≈ 55），但**这张贴图同时是 IBL** ——
  //    天空的观感颜色与天空的照明颜色是两回事，前者可以很蓝，后者必须接近中性。
  //    规范值本身就已经是很深的蓝了（B/R ≈ 37），拿它当照明已经偏蓝，再压深只会
  //    让所有背光面糊成一片蓝黑（实测：`port-house` 那面全背光的墙读到 (66,89,105)）。
  g.addColorStop(0.00, "#1a5aa6"); // 天顶：深蓝（DESIGN.md 规范值）
  g.addColorStop(0.18, "#2a72b8");
  g.addColorStop(0.34, "#69abd6");
  g.addColorStop(0.46, "#a6cfe4");
  g.addColorStop(0.50, "#c4dcea"); // 地平线 = 雾色
  g.addColorStop(0.58, "#9dc2d2");
  g.addColorStop(1.00, "#3b7f95"); // 地平线以下（基本被海面挡住）
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  // ② 云层。为什么必须是 fbm 而不是一堆径向渐变圆：叠出来的圆斑每个边缘都是一条
  //    等值线，远看是一片白雾、近看是同心圈，没有任何「云的结构」。fbm 的大团块与
  //    边上那些碎絮来自同一个场的高低频八度，所以层级是自洽的。
  //    **云必须横向可平铺**：equirect 的 u=0 与 u=1 是同一个方向，接不上天上就是
  //    一道竖直的缝。`fbm`/`vnoise` 按格点数环绕取模，所以 u 方向的格点数取整数即可 ——
  //    这也是这张贴图**不能用 `Math.random()`** 的原因（那只能保证好看一次，
  //    改一处参数就没法跟旧截图逐像素对比）。
  //
  //    在 **1/8 分辨率**上算、再交给 drawImage 双线性放大：云本来就没有硬边，
  //    8 倍放大看不出来，而在 4096×2048 上逐像素跑 9 个八度的 fbm 是 840 万次取样。
  const CW = 512, CH = 256;
  const cc = document.createElement("canvas");
  cc.width = CW; cc.height = CH;
  const cx2 = cc.getContext("2d");
  const cimg = cx2.createImageData(CW, CH);
  const cd = cimg.data;
  const mix3 = (a, b, t) => a + (b - a) * t;
  for (let j = 0; j < CH; j++) {
    const v = (j + 0.5) / CH;
    // 云的垂直分布：天顶附近淡出（equirect 在极点附近像素被挤成一个点，涡旋很明显）、
    // 地平线附近也淡出（远处的云被大气散射吃掉，硬留到地平线会出现一条云的硬边）。
    const prof = sstep(0.015, 0.16, v) * (1 - sstep(0.33, 0.47, v));
    for (let i = 0; i < CW; i++) {
      const u = (i + 0.5) / CW;
      // v 轴乘 0.5：画布是 2:1，不缩的话同样的格点数在竖方向上会被拉长一倍，
      // 云会变成一条条竖着的柱子。
      const base = fbm(u, v * 0.5, 6, 5, 21);
      const det = fbm(u, v * 0.5, 17, 4, 88);
      const d = base * 0.70 + det * 0.30;
      // 覆盖率：阈值把场切成「有云 / 无云」，sstep 的宽度决定云边的软硬。
      const cov = sstep(0.505, 0.72, d) * prof;
      // 云的受光：厚的地方顶上更亮（约等于从下方看到被太阳打亮的云体），
      // 离太阳近的那一侧再补一点暖白 —— 全白会显得像贴纸。
      let du = Math.abs(u - SUN_U);
      du = Math.min(du, 1 - du);
      const sunNear = clamp01(1 - Math.hypot(du * 2, v - SUN_V) / 0.60);
      const lit = clamp01(0.30 + 0.60 * cov + 0.30 * sunNear);
      const o = (j * CW + i) * 4;
      // 阴影侧是冷灰蓝、受光侧是暖白（云影里是天空的散射，不是灰）
      cd[o] = 255 * mix3(0.74, 1.00, lit);
      cd[o + 1] = 255 * mix3(0.79, 0.99, lit);
      cd[o + 2] = 255 * mix3(0.87, 0.96, lit);
      cd[o + 3] = 255 * cov;
    }
  }
  cx2.putImageData(cimg, 0, 0);
  x.drawImage(cc, 0, 0, W, H);

  // ③ 日轮与光晕（画在云之后，所以太阳不会被云吃掉）。三层光晕：外圈的散射、
  //    中圈的辉光、内圈的核心 —— 单层渐变会得到一个像贴上去的圆盘。
  //    半径按画布宽度取比例，改分辨率不用重调。
  const sx = SUN_U * W, sy = SUN_V * H;
  const glow = (r, a0, a1, a2) => {
    const rg = x.createRadialGradient(sx, sy, 0, sx, sy, r);
    rg.addColorStop(0.0, "rgba(255,248,224," + a0 + ")");
    rg.addColorStop(0.35, "rgba(255,246,214," + a1 + ")");
    rg.addColorStop(1.0, "rgba(255,244,206," + a2 + ")");
    x.fillStyle = rg;
    x.beginPath();
    x.arc(sx, sy, r, 0, Math.PI * 2);
    x.fill();
  };
  glow(0.075 * W, 0.10, 0.045, 0);
  glow(0.026 * W, 0.30, 0.12, 0);
  glow(0.009 * W, 0.85, 0.35, 0);
  const disc = x.createRadialGradient(sx, sy, 0, sx, sy, 0.0035 * W);
  disc.addColorStop(0, "rgba(255,255,252,1)");
  disc.addColorStop(0.55, "rgba(255,253,242,0.98)");
  disc.addColorStop(1, "rgba(255,246,214,0)");
  x.fillStyle = disc;
  x.beginPath();
  x.arc(sx, sy, 0.0035 * W, 0, Math.PI * 2);
  x.fill();

  // ④ 地平线雾带：把海天交界从一条硬边压成一段过渡。颜色与 ① 的地平线档同源。
  const hz = x.createLinearGradient(0, H * 0.435, 0, H * 0.545);
  hz.addColorStop(0.0, "rgba(214,232,240,0)");
  hz.addColorStop(0.5, "rgba(214,232,240,0.62)");
  hz.addColorStop(1.0, "rgba(196,220,234,0)");
  x.fillStyle = hz;
  x.fillRect(0, H * 0.435, W, H * 0.11);

  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 海面：**全场景唯一一块「什么结构都没有」的大面**。改造前是一张 512² 的纯色卡铺在
// 2000×2000 上（每格 27.8m、一个贴图砖 66m），顶点正弦的波长还有 314m —— 于是整片海
// 在画面上就是一片没有任何起伏、没有反光的渐变，占的画面面积却仅次于天空。
//
// 重做分三层，**各管一段尺度**（这是海面渲染的标准切法，不要试图让顶点去扛全部细节）：
//   ① 顶点位移 —— 只扛两条长涌（周期 100~160m）。1600m 的平面 128 段 = 12.5m/格，
//      再短的波就低于奈奎斯特了，硬位移只会得到一堆跳变的锯齿。
//   ② 法线贴图（14m 一砖）—— 扛全部细浪。**波光只发生在法线里，不在几何里**。
//   ③ 粗糙度贴图 —— 浪尖更粗、平水更滑。这是波光能「一片片地亮」而不是整片均匀
//      发亮的原因。
// 三张图共用同一个高度场（`buildMaps` 的原话），所以白沫**正好落在浪脊上**；
// 也因此三者的 repeat 与 offset 必须一直同步（见下面 material 与 update()）。
const WATER_TILE = 14;      // 一砖 14m（1024/14 ≈ 73 px/m）
const WATER_PX = 1024;
const WATER_SPAN = 1600;    // 海面边长。相机 far=1200，对角 1131 不会被裁出硬边

export function waterMaps() {
  const S = WATER_PX;
  const TAU = Math.PI * 2;
  // 方向波：频率必须取**整数**（一砖几个来回），否则左右接不上。六个方向叠起来
  // 才不像一块规整的搓衣板 —— 单一方向的周期波一眼就能看出是数学公式。
  const wave = lowField(S, (u, v) => {
    let h = 0;
    h += Math.sin((3 * u + 1 * v) * TAU + 0.7) * 1.00;
    h += Math.sin((1 * u - 2 * v) * TAU + 2.1) * 0.72;
    h += Math.sin((5 * u + 3 * v) * TAU + 4.4) * 0.45;
    h += Math.sin((2 * u + 5 * v) * TAU + 1.3) * 0.34;
    h += Math.sin((7 * u - 2 * v) * TAU + 5.6) * 0.22;
    h += Math.sin((4 * u + 6 * v) * TAU + 3.0) * 0.16;
    return h / 2.89 * 0.5 + 0.5;   // 归一到 [0,1]
  }, 4);
  // 细碎的白沫：只用来打散上面那六条波的规整感，不参与大形
  const chop = lowField(S, (u, v) => fbm(u, v, 20, 4, 55), 4);

  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = clamp01(wave[i] * 0.80 + chop[i] * 0.20);

  const DEEP = hexLin(0x0f4062);   // 深水
  const CREST = hexLin(0x317fa6);  // 浪脊透光
  const FOAM = hexLin(0xdcecf2);   // 白沫
  const mix = (o, c, k) => { o[0] += (c[0] - o[0]) * k; o[1] += (c[1] - o[1]) * k; o[2] += (c[2] - o[2]) * k; };

  const albedo = (i, o) => {
    const hv = h[i];
    o[0] = DEEP[0]; o[1] = DEEP[1]; o[2] = DEEP[2];
    mix(o, CREST, sstep(0.42, 0.88, hv));
    mix(o, FOAM, sstep(0.84, 0.97, hv) * 0.85);   // 只有最高的那一小撮起沫
  };
  // 平水很滑（反射又亮又窄）、起沫处变粗。**roughnessMap 是乘在 material.roughness 上的**，
  // 所以材质那边必须写 1.0。
  const rough = (i) => clamp01(0.16 + 0.12 * h[i] + 0.55 * sstep(0.84, 0.97, h[i]));

  return buildMaps(S, h, 1.15, 0.7, albedo, rough);
}

// 船体周围的泡沫带：船在水里不可能和水分得那么干净 —— 舷侧水线处有一圈被船体挤出的白沫。
// 四条半透明贴花带（**纯视觉，绝不进 obstacles**），沿船长平铺、沿舷宽淡出。
//
// `across` 决定淡出走 u 还是走 v：舷侧那条带的横向是世界的 x、首尾那条是世界的 z，
// 而 PlaneGeometry 的 u 恒沿局部 x —— 两条带的几何朝向不同，淡出轴也跟着换。
// 与其去转贴图矩阵（`setUvTransform` 先缩放后旋转，耦合起来很难读），不如直接出两份。
const FOAM_TILE = 9;   // 泡沫沿带长方向 9m 一砖

function foamTexture(across) {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d");
  const img = x.createImageData(S, S);
  const d = img.data;
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      // t = 沿带长方向；s = 横向，0 = 贴着船体、1 = 开阔海面
      const t = across === "u" ? (j + 0.5) / S : (i + 0.5) / S;
      const s = across === "u" ? (i + 0.5) / S : (j + 0.5) / S;
      // 白沫的边界要是一条**碎边**而不是直线：用噪声把「贴船那 10%」这个阈值推来推去
      const edge = 0.08 + fbm(t * 0.5, s * 0.25, 9, 4, 404) * 0.42;
      const a = (1 - sstep(edge, edge + 0.40, s)) * (0.5 + 0.5 * fbm(t * 0.5, s, 26, 3, 77));
      const o = (j * S + i) * 4;
      d[o] = 232; d[o + 1] = 244; d[o + 2] = 250;
      d[o + 3] = 255 * clamp01(a);
    }
  }
  x.putImageData(img, 0, 0);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  if (across === "u") { tx.wrapS = THREE.ClampToEdgeWrapping; tx.wrapT = THREE.RepeatWrapping; }
  else { tx.wrapS = THREE.RepeatWrapping; tx.wrapT = THREE.ClampToEdgeWrapping; }
  return tx;
}

// 船体：红色防污漆舷侧 + 纵向锈痕。
//
// **锈痕必须沿 v 流**：BoxGeometry 的 ±X 面的 UV 是 u→z、v→y 且 vdir = -1，
// 所以贴图里「从上往下」画的痕迹在世界里就是**向下淌**的 —— 这一条本来就是对的
// （原实现的竖条方向没错），错的只是密度：`repeat(6,1)` 让 68m 长的舷侧横向每
// 11.3m 才一砖、而 3.4m 高竖向一砖，texel 被拉成 22×13mm 的扁格，远看是一层糊。
const HULL_TILE = 3.4;   // 一个方砖 3.4m
const HULL_PX = 512;     // 512 / 3.4 = 150 px/m

function hullMaps() {
  const S = HULL_PX;
  // ① 纵向锈痕：`vnoise` 直接给 `perY`，让噪声沿 v 拉长 8 倍（24 : 3）—— 仍然可平铺
  const streak = lowField(S, (u, v) => {
    const a = vnoise(u * 24, v * 3, 24, 311, 3);
    const b = vnoise(u * 48, v * 6, 48, 512, 6);
    return a * 0.7 + b * 0.3;
  }, 4);
  // ② 漆面剥落 / 起泡（大块）  ③ 细颗粒（氧化麻点）
  const peel = lowField(S, (u, v) => fbm(u, v, 3, 4, 77), 4);
  const grain = field(S, (u, v) => hash2((u * S) | 0, (v * S) | 0, 9));
  // ②b **大块漆面差异**（两个八度、2 格基频 ⇒ 约 1.7m 的补漆/褪色斑）。
  //     这一层是「退到十米开外就只剩一块红板」的解药：锈痕（0.1m 级）与麻点（毫米级）
  //     在十来米外全部糊成同一个常数，只剩色相本身 —— 于是整面墙读起来是**一个平色**。
  //     补上 1.7m 这个尺度之后，远处看到的就是「刷过很多次的红漆、这里新补一块那里褪白」。
  const patch = lowField(S, (u, v) => fbm(u, v, 2, 3, 911), 8);
  // ④ 钢板焊缝：竖缝落在砖边界（3.4m 一道外板）、横缝落在砖中（上下两列板）。
  //    **这一条才是「近看像刷了漆的水泥墙」的解药** —— 原来的高度场只有噪声，
  //    平铺出去就是一层均匀的颗粒，没有任何能读出「这是钢板拼起来的」的尺度。
  const seam = sepField(S,
    (t, out, off) => { out[off] = sstep(0.0125, 0.0, Math.min(t, 1 - t)); out[off + 1] = 1; },
    (t, out, off) => { out[off] = sstep(0.0180, 0.0, Math.abs(t - 0.5)); out[off + 1] = 1; },
    (a, _a2, b, _b2) => Math.max(a, b));
  // ⑤ 铆钉：沿两条焊缝一排排，间距 42px（贴图 3.4m / 42px ≈ 28cm，与真实铆距同量级）
  const RP = 3.0, D = 42;
  const rivet = field(S, (u, v) => {
    const px = u * S, py = v * S;
    // 竖缝两侧各一排（钉心离缝 4px）
    const dx1 = Math.abs(Math.min(px, S - px) - 4);
    const dy1 = Math.abs(((py + D / 2) % D) - D / 2);
    // 横缝上下各一排
    const dy2 = Math.abs(Math.abs(py - S / 2) - 4);
    const dx2 = Math.abs(((px + D / 2) % D) - D / 2);
    return Math.max(
      sstep(RP, 1.3, Math.hypot(dx1, dy1)),
      sstep(RP, 1.3, Math.hypot(dx2, dy2)));
  });

  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) {
    h[i] = clamp01(0.34 + peel[i] * 0.30 + streak[i] * 0.24 + grain[i] * 0.14
      + (patch[i] - 0.5) * 0.14 + rivet[i] * 0.20 - seam[i] * 0.42);
  }

  // 底色直接烘进 albedo，material.color 固定 0xffffff —— 两边都上色等于色值平方
  // （AGENTS.md 记过两次：集装箱与手套都是这么黑的）。目标等价于改造前的
  // `#8e3a2c`（当线性读）× `color 0xb8a396`，但走正确的 sRGB 通路。
  const PAINT = hexLin(0x884a3c);   // 防污漆：偏氧化的砖红，**不要取纯正的正红**
  const RUSTC = hexLin(0x5a3320);
  const BARE = hexLin(0x6a6f74);   // 剥落处露出的裸钢
  const mix = (o, c, k) => { o[0] += (c[0] - o[0]) * k; o[1] += (c[1] - o[1]) * k; o[2] += (c[2] - o[2]) * k; };

  const albedo = (i, o) => {
    o[0] = PAINT[0]; o[1] = PAINT[1]; o[2] = PAINT[2];
    mix(o, RUSTC, sstep(0.52, 0.90, streak[i]) * 0.85);  // 锈痕
    mix(o, BARE, sstep(0.62, 0.88, peel[i]) * 0.55);     // 剥落
    mix(o, RUSTC, sstep(0.56, 0.92, patch[i]) * 0.55);   // 大块锈斑 / 补漆
    // 焊缝里积的垢比周围暗一档，缝才立得起来；铆钉头被磨得比周围亮。
    // 焊缝的权重从 0.38 提到 0.52：在 10m 外一道 6cm 的缝只占两三个屏幕像素，
    // 对比不够就整个消失，「钢板拼起来的」这条信息全靠它。
    const sh = (0.86 + 0.28 * grain[i]) * (1 - seam[i] * 0.52) * (1 + rivet[i] * 0.16)
      * (1 + (patch[i] - 0.5) * 0.34);
    o[0] *= sh; o[1] *= sh; o[2] *= sh;
  };
  const rough = (i) => clamp01(0.60 + 0.24 * sstep(0.50, 0.90, streak[i])
    + 0.18 * sstep(0.60, 0.90, peel[i]) - 0.10 * grain[i]
    + seam[i] * 0.22 - rivet[i] * 0.14 + (patch[i] - 0.5) * 0.10);

  return buildMaps(S, h, 1.1, 0.6, albedo, rough);
}

// 舷侧贴图按面的真实尺寸定 repeat。**不逐面拆材质**：±X 是 68×3.4 的主视面，
// ±Y 的 1.2m 窄檐与 ±Z 的端面都埋在栏杆/舰体块后面，为它们各开一份材质
// 换来的是十几份材质和多出来的绘制调用，不值。
let hullBase = null; // 同 deckMaps：只在 buildMap 里生成一次

function hullSkin(w, h) {
  const out = {};
  for (const k of ["map", "normalMap", "roughnessMap"]) {
    const c = hullBase[k].clone();
    c.repeat.set(w / HULL_TILE, h / HULL_TILE);
    out[k] = c;
  }
  out.normalScale = hullBase.normalScale;
  return out;
}

// ===== 涂装钢板（甲板室立面 / 上层建筑）=====
// 改造前这两块立面是**纯平色材质**（`wallMat` / `superMat` 只有 color/roughness/metalness），
// 一点贴图都没有 —— 一片 12×4.9 的墙近看就是一块刷了蓝灰漆的板子，
// 是「建模粗糙」最容易被一眼看穿的地方（`h0-port-house.png` 里那面墙就是）。
//
// 与舷侧的区别是**底色不烘进 albedo**：这份贴图走的是和甲板同一条路
// （中性浅灰 albedo + `material.color` 上色），因为甲板室与上层建筑要用两个不同的灰、
// 却该共用同一份贴图。**不能两边都上色**（色值平方，AGENTS.md 记过两次）。
const PLATE_TILE = 4.8;  // 一个砖 4.8m = 两块 2.4m 宽的外板
const PLATE_PX = 512;

function plateMaps() {
  const S = PLATE_PX;
  const mix = (o, c, k) => { o[0] += (c[0] - o[0]) * k; o[1] += (c[1] - o[1]) * k; o[2] += (c[2] - o[2]) * k; };
  // ① 外板拼缝：竖缝每 2.4m 一道（砖边界与砖中），横缝落在砖中（上下两列板）
  // **槽要宽、要浅，不能是「窄而深的一道线」**：法线是从高度场的梯度算出来的，
  // 窄槽（半宽 0.011·512 ≈ 5.6px）在 106 px/m 下只有 5cm 宽，梯度极陡 → 法线几乎翻 90°，
  // 太阳一斜掠过去（`h?-house-corner.png` 那个角度）整面墙就读成**瓦楞板**。
  // 半宽放到 0.024（≈11px ≈ 10cm，真实焊缝的量级）之后梯度减半，斜掠时是拼缝、正看是平面。
  const seam = sepField(S,
    (t, out, off) => {
      out[off] = Math.max(sstep(0.024, 0.0, Math.min(t, 1 - t)),
                          sstep(0.024, 0.0, Math.abs(t - 0.5)));
      out[off + 1] = 1;
    },
    (t, out, off) => { out[off] = sstep(0.028, 0.0, Math.abs(t - 0.5)); out[off + 1] = 1; },
    (a, _a2, b, _b2) => Math.max(a, b));
  // ② 沿缝的螺栓排（间距 30px ≈ 28cm，与舷侧那套同量级）
  const BP = 2.4, D = 30;
  const bolt = field(S, (u, v) => {
    const px = u * S, py = v * S;
    const edge = Math.min(px, S - px, Math.abs(px - S / 2));  // 到最近一条竖缝的距离
    const dV = Math.hypot(Math.max(0, edge - 4), Math.abs(((py + D / 2) % D) - D / 2));
    const dH = Math.hypot(Math.max(0, Math.abs(py - S / 2) - 4), Math.abs(((px + D / 2) % D) - D / 2));
    return Math.max(sstep(BP, 1.0, dV), sstep(BP, 1.0, dH));
  });
  // ③ 涂装橘皮（细）  ④ 雨痕 / 积垢（沿 v 拉长的低频）
  const peel = lowField(S, (u, v) => fbm(u, v, 8, 3, 401), 4);
  const stain = lowField(S, (u, v) => vnoise(u * 12, v * 3, 12, 733, 3), 4);
  // ③b **大尺度补漆 / 褪色斑**（2 格基频 ⇒ 一个砖 4.8m 里约两块 2.4m 的斑）。
  //     这一层是「退到十米外只剩一块蓝灰板」的解药，与 `hullMaps` 里那条 patch 同源：
  //     拼缝（2.4m）、锈、橘皮在十来米外全部糊成一个常数，**只剩色相本身**，于是整面墙
  //     读起来是一个平色。补上这个尺度之后，远处看到的是「补过很多次漆的外板」。
  const patch = lowField(S, (u, v) => fbm(u, v, 2, 3, 917), 8);
  // ③c 锈迹（约 1m 的斑块）。**权重再乘上它离拼缝/螺栓多近** —— 水是从缝里渗进去的，
  //     锈从缝沿冒出来才像真的；均匀撒一层锈只会得到一块脏抹布。
  const rust = lowField(S, (u, v) => fbm(u, v, 5, 4, 419), 4);
  const RUSTC = hexLin(0x6b3a1e);   // 湿锈（带橙相，靠 material.color 乘完仍是棕的）
  const DIRT = hexLin(0x3a3a34);    // 积垢：中性偏暗
  const rustW = new Float32Array(S * S);
  for (let i = 0; i < rustW.length; i++) {
    rustW[i] = clamp01(sstep(0.58, 0.90, rust[i]) * (0.30 + 0.70 * Math.max(seam[i], bolt[i] * 1.3)));
  }

  // **拼缝的深度要克制**：第一版取 seam 权重 0.44（高度）/ 0.40（albedo），正面平视时
  // 是「钢板拼缝」，可一旦太阳斜掠过来（`h1-house-corner.png` 那个角度），2.4m 一道的
  // 深槽就把整面墙读成瓦楞板。高度（= 法线）那一路降到 0.32 之后斜掠不再像波纹钢；
  // **albedo 那一路可以放回去**——明暗不参与法线计算，斜掠时不会翻成瓦楞。
  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) {
    h[i] = clamp01(0.52 + (peel[i] - 0.5) * 0.22 + stain[i] * 0.10 + bolt[i] * 0.22
      - seam[i] * 0.32 + (patch[i] - 0.5) * 0.10 + rustW[i] * 0.06);
  }

  const albedo = (i, o) => {
    // 中性浅灰：色相完全交给 material.color。略微偏暖一点点，免得乘上冷调漆之后发青。
    const sh = (1 - seam[i] * 0.40) * (1 + bolt[i] * 0.14) * (1 + (peel[i] - 0.5) * 0.07);
    o[0] = sh; o[1] = sh * 0.995; o[2] = sh * 0.982;
    const pv = 1 + (patch[i] - 0.5) * 0.34;      // 大尺度涂装深浅差（约 ±17%）
    o[0] *= pv; o[1] *= pv; o[2] *= pv;
    mix(o, DIRT, sstep(0.55, 0.92, stain[i]) * 0.45);
    mix(o, RUSTC, rustW[i] * 0.72);
  };
  const rough = (i) => clamp01(0.70 + seam[i] * 0.12 - bolt[i] * 0.11
    + sstep(0.58, 0.94, stain[i]) * 0.16 - (peel[i] - 0.5) * 0.08
    + (patch[i] - 0.5) * 0.10 + rustW[i] * 0.14);

  return buildMaps(S, h, 1.0, 0.45, albedo, rough);
}

// 同 deckMaps/hullBase：只在 buildMap 里生成一次
let plateBase = null;

/** 一种尺寸的涂装钢板 = 按该面真实长宽比定 repeat 的贴图 + 指定色调。
 *  **必须是「一面一份」而不是全船一份**：侧墙大面是 4.9×4.5、门间短墙是 4.2×2.6，
 *  共用一个 repeat 会把后者那 2.4m 的外板压成 1.4m（即甲板那条 25:1 拉伸的缩小版）。 */
function plateMat(w, h, color, metal = 0.06) {
  const m = new THREE.MeshStandardMaterial({
    ...plateSkin(w, h), color, roughness: 1.0, metalness: metal,
  });
  return m;
}

function plateSkin(w, h) {
  const out = {};
  for (const k of ["map", "normalMap", "roughnessMap"]) {
    const c = plateBase[k].clone();
    c.repeat.set(w / PLATE_TILE, h / PLATE_TILE);
    out[k] = c;
  }
  out.normalScale = plateBase.normalScale;
  return out;
}

// ===== 集装箱：一张**高度场**同时出 albedo / normal / roughness =====
//
// 改造前只有一个 256×128 的 canvas：瓦楞、横梁、角件、锈蚀**全都只是画在颜色上的明暗**，
// 没有法线 ⇒ 光照下不产生任何起伏响应，正面看就是一块印了竖条纹的板子。
// 集装箱是全场屏幕占比最大的物件之一，这一条是「画面发灰发假」里回报最高的一处。
//
// 布局常量**只有这一份**，albedo 与法线都从同一个 `h` 推出来 —— 两边各画一遍必然会漂移，
// 而漂移的症状是「凸起和明暗对不上」，比完全没有法线更假。
const CONT_W = 256, CONT_H_PX = 128;  // 贴图像素（**非方**，所以走 buildMapsRect）
const CONT_RIB = 256 / 24;            // 瓦楞节距 → 一张面 24 根（真箱 ≈0.28m，32 根会起摩尔纹）
const CONT_RAIL = 12;                 // 上下横梁高 12px
const CONT_FIT = 56;                  // 角件宽 56px、高 20px

/** 距线段 (x0,y0)-(x1,y1) 的距离，给端门 X 折线用 */
function distSeg(px, py, x0, y0, x1, y1) {
  const vx = x1 - x0, vy = y1 - y0;
  const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (x0 + vx * t), py - (y0 + vy * t));
}

let contHeight = null; // 只算一次（确定性，与颜色无关）
function containerLayout() {
  if (contHeight) return contHeight;
  const W = CONT_W, H = CONT_H_PX;
  const h = new Float32Array(W * H);
  const railV = (py) => sstep(CONT_RAIL + 2, CONT_RAIL - 3, py) + sstep(H - CONT_RAIL - 2, H - CONT_RAIL + 3, py);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      // ① 瓦楞：梯形截面（顶面是平的，棱是圆的），不是正弦 —— 真实瓦楞板是压出来的
      const p = (px % CONT_RIB) / CONT_RIB;
      const rib = sstep(0.28, 0.60, 1 - Math.abs(2 * p - 1));
      // ② 横梁（上下各一条，凸出瓦楞之外）
      const rail = Math.min(1, railV(py));
      // ③ 四角角件（比横梁更高，是整箱最厚的地方）
      const inX = (px < 4 + CONT_FIT || px > W - 4 - CONT_FIT);
      const inY = (py < 4 + 20 || py > H - 4 - 20);
      const fit = (inX && inY) ? 1 : 0;
      // ④ 端门 X 折线（门面内侧的加强筋）
      const dx = Math.min(
        distSeg(px, py, 72, 14, 128, 114),
        distSeg(px, py, 128, 14, 72, 114));
      const brace = sstep(4.0, 1.2, dx);
      // ⑤ 细颗粒：漆面麻点
      const grain = hash2(px, py, 9);
      h[py * W + px] = clamp01(
        0.30 + rib * 0.42 + rail * 0.20 + fit * 0.34 + brace * 0.14 + (grain - 0.5) * 0.07);
    }
  }
  contHeight = h;
  return h;
}

// 集装箱表面贴图：颜色**烘进 albedo**（材质色留白），所以每种颜色一张。
function containerFaceTexture(baseHex, h) {
  const W = CONT_W, H = CONT_H_PX;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const img = x.createImageData(W, H);
  const d = img.data;

  const BASE = hexLin(baseHex);
  const RUSTC = hexLin(0x6e4420);
  const BARE = hexLin(0x5c6167);
  const mix = (o, k) => { o[0] += (RUSTC[0] - o[0]) * k; o[1] += (RUSTC[1] - o[1]) * k; o[2] += (RUSTC[2] - o[2]) * k; };
  const mixB = (o, k) => { o[0] += (BARE[0] - o[0]) * k; o[1] += (BARE[1] - o[1]) * k; o[2] += (BARE[2] - o[2]) * k; };
  const rgb = [0, 0, 0];

  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / H;
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      const u = (px + 0.5) / W;
      // 凹凸带的明暗：凹处积灰发暗、凸起被磨亮 —— 与法线同源，方向不会打架
      const sh = 0.74 + 0.40 * h[i];
      rgb[0] = BASE[0] * sh; rgb[1] = BASE[1] * sh; rgb[2] = BASE[2] * sh;
      // 锈：靠噪声决定「锈在哪」，再让两块横梁附近更易锈（水从上下积）
      const n = fbm(u, v, 5, 4, 133);
      const nearRail = 1 - sstep(0.16, 0.40, Math.min(v, 1 - v));
      mix(rgb, sstep(0.47, 0.79, n) * (0.42 + 0.48 * nearRail));
      // 掉漆露底（少量，压在锈斑里）
      mixB(rgb, sstep(0.74, 0.92, fbm(u, v, 13, 3, 611)) * 0.30);
      const o = i * 4;
      d[o] = lin2srgb(rgb[0]) * 255;
      d[o + 1] = lin2srgb(rgb[1]) * 255;
      d[o + 2] = lin2srgb(rgb[2]) * 255;
      d[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  // 贴图里烘的就是最终颜色，必须按 sRGB 解读；否则 Canvas 的 sRGB 字节会被当成线性值，
  // 再经输出转换亮一整档 —— 深绿箱会褪成灰白绿。
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 法线 + 粗糙度与颜色无关 → 6 种颜色共用一份（实测集装箱色只有 6 种）
let contDetail = null;
function containerDetail() {
  if (!contDetail) {
    const h = containerLayout();
    const W = CONT_W, H = CONT_H_PX;
    const rough = (i) => {
      const u = ((i % W) + 0.5) / W, v = ((i / W | 0) + 0.5) / H;
      // 漆面滑、锈面糙、凹处藏灰
      return clamp01(0.60 + 0.26 * sstep(0.47, 0.79, fbm(u, v, 5, 4, 133)) + 0.14 * (1 - h[i]));
    };
    const noop = () => {};
    const m = buildMapsRect(W, H, h, 1.9, 0.85, noop, rough);
    contDetail = { normalMap: m.normalMap, roughnessMap: m.roughnessMap, normalScale: m.normalScale };
  }
  return contDetail;
}

// 木箱表面：**一张高度场出 albedo / normal / roughness**。
//
// 改造前是一个 128² 的浅灰底 + 几道手画细线：四边各两条 3px 的线，加 320 条随机木纹。
// 木箱是全场最亮的元素（`PAL.lwood` 米黄），也是中路的主要掩体，但那个贴图在光照下
// 完全没有起伏 —— 0.9m 的方箱看着就是一块印了格子的浅色板。
//
// 现在把「一个箱面」当设计单元：外圈**边框木条**（凸）、内侧**竖板条**（板缝凹、
// 板面微拱）、板缝里的**钉头**（一颗颗小凸起）。albedo 保持**接近白的中性木色**，
// 真正的颜色仍由 `material.color = hex` 相乘 —— 木箱有好几种颜色（米黄/军绿），
// 颜色烘进贴图就得每种颜色一张。
const CRATE_PX = 256, CRATE_TILE = 0.9;   // 一张贴图 = 一个 0.9m 的箱面
const CRATE_FRAME = 0.085;                // 边框木条宽 8.5cm（真实木箱的档条尺寸）
const CRATE_PLANK = 4;                    // 内侧 4 条竖板

let crateBase = null;
function woodMaps() {
  if (crateBase) return crateBase;
  const S = CRATE_PX;
  // ① 板缝：由 u 决定 → 可分离场。缝是**窄而深**的 V 形槽，不是一条画上去的线。
  const seamU = sepField(S,
    (t, out, off) => {
      const f = t * CRATE_PLANK;
      const d = Math.min(f - Math.floor(f), 1 - (f - Math.floor(f)));
      out[off] = sstep(0.055, 0.0, d);
      out[off + 1] = 1;
    },
    (_t, out, off) => { out[off] = 0; out[off + 1] = 1; },
    (a, _a2, b, _b2) => Math.max(a, b));
  // ② 边框：由 u/v 各自决定，两张一维场取交（取 max 就是四条边全有）
  const frame = sepField(S,
    (t, out, off) => { out[off] = sstep(CRATE_FRAME - 0.012, CRATE_FRAME + 0.004, t) * sstep(1 - CRATE_FRAME + 0.012, 1 - CRATE_FRAME - 0.004, t); out[off + 1] = 1; },
    (t, out, off) => { out[off] = sstep(CRATE_FRAME - 0.012, CRATE_FRAME + 0.004, t) * sstep(1 - CRATE_FRAME + 0.012, 1 - CRATE_FRAME - 0.004, t); out[off + 1] = 1; },
    (a, _a2, b, _b2) => Math.max(a, b));
  // ③ 木纹：沿板条方向（v）拉长的噪声 + 细颗粒
  const grain = lowField(S, (u, v) => vnoise(u * 26, v * 5, 26, 41, 5) * 0.7 + vnoise(u * 64, v * 12, 64, 43, 12) * 0.3, 4);
  const pore = field(S, (u, v) => hash2((u * S) | 0, (v * S) | 0, 47));
  // ④ 钉头：板缝两侧、靠近上下边框的地方各一颗
  const nail = (u, v) => {
    let m = 0;
    for (let k = 0; k < CRATE_PLANK + 1; k++) {
      const nu = k / CRATE_PLANK;
      for (const nv of [0.135, 0.865]) {
        const d = Math.hypot((u - nu) * 1.0, (v - nv) * 0.62);
        m = Math.max(m, sstep(0.028, 0.008, d));
      }
    }
    return m;
  };

  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let xx = 0; xx < S; xx++) {
      const i = y * S + xx;
      const u = (xx + 0.5) / S, v = (y + 0.5) / S;
      // 板面微拱：缝两侧高、缝心低
      const crown = (1 - seamU[i]) * 0.14;
      h[i] = clamp01(0.42 + crown + frame[i] * 0.34 - seamU[i] * 0.34 - frame[i] * seamU[i] * 0.30
        + (grain[i] - 0.5) * 0.22 + (pore[i] - 0.5) * 0.06 + nail(u, v) * 0.22);
    }
  }

  const WOOD = hexLin(0xded2b6);   // 接近白的中性木色（真正的颜色在 material.color 上）
  const GAP = hexLin(0x4a3a26);
  const mix = (o, c, k) => { o[0] += (c[0] - o[0]) * k; o[1] += (c[1] - o[1]) * k; o[2] += (c[2] - o[2]) * k; };
  const albedo = (i, o) => {
    const sh = 0.80 + 0.34 * h[i];
    o[0] = WOOD[0] * sh; o[1] = WOOD[1] * sh; o[2] = WOOD[2] * sh;
    // 木纹：沿板条拉长的明暗（顺纹深、逆纹浅）
    const g = (grain[i] - 0.5) * 0.30;
    o[0] *= 1 + g; o[1] *= 1 + g * 1.15; o[2] *= 1 + g * 1.5;   // 顺纹偏暖
    // 板缝与钉孔里积灰发黑
    mix(o, GAP, clamp01(seamU[i] * 0.85 + (pore[i] > 0.93 ? 0.25 : 0)));
  };
  const rough = (i) => clamp01(0.80 + 0.10 * (1 - h[i]) + 0.10 * seamU[i] - 0.08 * frame[i]);

  crateBase = buildMaps(S, h, 2.1, 0.75, albedo, rough);
  return crateBase;
}

// 黄白条纹（舰艉遮阳棚 / 救生艇罩），参考图里右舷那顶条纹天篷
function stripeTexture(aHex, bHex, reps = 9) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const x = c.getContext("2d");
  const w = 256 / reps;
  for (let i = 0; i < reps; i++) {
    x.fillStyle = "#" + (i % 2 ? bHex : aHex).toString(16).padStart(6, "0");
    x.fillRect(Math.floor(i * w), 0, Math.ceil(w), 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function loadModel(url, onReady) {
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        if (onReady) onReady(gltf);
        resolve(gltf.scene);
      },
      undefined,
      () => resolve(null)
    );
  });
}

// ---------- 构建地图 ----------
export async function buildMap(scene) {
  const colliders = []; // {x,z,hx,hz,h}
  const obstacles = []; // 射线阻挡 mesh
  // 龙门吊小车的运行时句柄（由下面的吊装段赋值，update() 里驱动它缓慢横移）
  let craneTrolley = null;
  // 甲板尺寸。**这两个数不是随便定的**，见下面「集装箱网格」一节的两条推导：
  //   · 宽 40m 是「舷边道 + 外列 + 巷 + 内列 + 中央大道」这条横截面倒推出来的最小值；
  //   · 长 68m 被敌人刷出带 |z| ∈ [hl-10, hl-4] 反向锁死（最外排行心 15.2 是上限）。
  const DECK_W = 20; // 半宽（舷向）→ 甲板 40m 宽
  const DECK_L = 34; // 半长（纵向）→ 甲板 68m 长
  // 曾经的 spawnRadius = 26 是死代码（全仓库无消费点），已删。

  // ===== 俯视布局表（小地图专用，见 scripts/minimap.js）=====
  // **是构建期顺手推入的、不从 `colliders` 反推**：colliders 里混着栏杆、隐形墙、
  // 逐格碎片与各种「挡人但不该画」的件（全图几百条），拿它去画小地图是一片噪声。
  // 这里只收「玩家在地图上一眼该认出的大件」，字段统一 `{ x, z, hx, hz, kind, y0? }`。
  //   kind: container | house | crate | stairs | walk | bridge | hull
  // `y0` 只在架空结构（栈桥）上出现 —— 值与 `colliders` 里那条同源，小地图按
  // 「敌人能否从底下走过去」的同一套语义决定要不要把它算作视线遮挡。
  const topdown = [];

  // ===== 天空（晴天白昼）=====
  // 同一张贴图既做背景也做环境反射：省掉 RoomEnvironment（那是室内房间环境，
  // 在明亮天空下会让金属发脏），也少一个 CDN 依赖。
  const sky = skyTexture();
  scene.background = sky;
  scene.environment = sky;
  // 雾别太浓：船只有 68m 长，稍浓一点就会把船头那端的集装箱糊成一片白。
  scene.fog = new THREE.FogExp2(0xc4dcea, 0.0021);

  // ===== 海面 =====
  const waterGeo = new THREE.PlaneGeometry(WATER_SPAN, WATER_SPAN, 128, 128);
  const wm = waterMaps();
  // 三张图的 repeat **必须一致**：白沫是从同一个高度场导出的，对不上的话白沫会浮在
  // 浪沟里而不是浪脊上。
  const wRep = WATER_SPAN / WATER_TILE;
  for (const k of ["map", "normalMap", "roughnessMap"]) wm[k].repeat.set(wRep, wRep);
  const waterMat = new THREE.MeshStandardMaterial({
    map: wm.map, normalMap: wm.normalMap, roughnessMap: wm.roughnessMap,
    normalScale: wm.normalScale,
    // 颜色烘在 albedo 里，`color` 固定白 —— 两边都上色等于色值平方（AGENTS.md 记过两次）
    color: 0xffffff,
    // roughnessMap 是乘在它上面的 → 必须写 1.0
    roughness: 1.0,
    // 水是**电介质**，Fresnel 会自己在掠射角把反射推到 1 —— 这正是从甲板上看远处海面
    // 一片亮、低头看近处一片深的原因。0.06 只是补一点点，不要靠 metalness 硬提反射。
    metalness: 0.06,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -2.4;
  // 原来这里是 transparent + opacity 0.97 —— 整片海走透明通道，白拿一次排序问题
  // 却换来 3% 的透底。水本来就不透，改成不透明。
  scene.add(water);
  const wpos = waterGeo.attributes.position;
  const wbase = [];
  for (let i = 0; i < wpos.count; i++) wbase.push([wpos.getX(i), wpos.getY(i)]);

  // ===== 船体周围的泡沫带（纯视觉贴花，不进 obstacles / colliders）=====
  const FOAM_W = 3.4;                       // 带子从舷侧往外铺 3.4m
  const FOAM_Y = -2.26;                     // 略高于浪脊（最低 -2.50、最高 -2.30）
  const foamSideU = foamTexture("u");       // 舷侧两条：淡出走 u
  const foamEndV = foamTexture("v");        // 首尾两条：淡出走 v
  const foamMat = (tex) => new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, opacity: 0.85,
  });
  const foamStrips = [];
  /** `flip` = 让贴图的「贴船侧」落在 u/v 的哪一端。舷宽方向的朝向左右/首尾各不相同，
   *  与其给每条带单独出一份贴图，不如翻一下 uv（`setUvTransform` 先缩放后平移，
   *  repeat = -1 配 offset = 1 就是干净的镜像）。 */
  function addFoam(w, h, x0, z0, tex, across, flip, len) {
    const m = foamMat(tex);
    if (flip) {
      if (across === "u") { m.map.repeat.x = -1; m.map.offset.x = 1; }
      else { m.map.repeat.y = -1; m.map.offset.y = 1; }
    }
    // 淡出轴不平铺（ClampToEdge），另一轴按带长平铺
    if (across === "u") m.map.repeat.y = len / FOAM_TILE;
    else m.map.repeat.x = len / FOAM_TILE;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x0, FOAM_Y, z0);
    mesh.renderOrder = 4;
    scene.add(mesh);
    // 只有**平铺的那根轴**能滚（另一根是 clamped 的淡出轴，滚它等于把淡出推走）
    foamStrips.push({ tex: m.map, axis: across === "u" ? "y" : "x" });
    return mesh;
  }
  // 舷侧：x = ±(20.4 + 0.6 + 1.7) = ±22.7，纵跨船首块（-50）到船尾块（+44）
  addFoam(FOAM_W, 94, -(DECK_W + 1.0 + FOAM_W / 2), -3, foamSideU, "u", true, 94);
  addFoam(FOAM_W, 94, (DECK_W + 1.0 + FOAM_W / 2), -3, foamSideU, "u", false, 94);
  // 船首 / 船尾：横跨 ±(DECK_W+1) 再各甩出一条带子
  const FOAM_END_W = (DECK_W + 1) * 2 + FOAM_W * 2;
  addFoam(FOAM_END_W, FOAM_W, 0, -(DECK_L + 16) - FOAM_W / 2, foamEndV, "v", false, FOAM_END_W);
  addFoam(FOAM_END_W, FOAM_W, 0, (DECK_L + 10) + FOAM_W / 2, foamEndV, "v", true, FOAM_END_W);

  // ===== 钢甲板 =====
  deckMaps = steelDeckMaps();
  // metalness 必须≈0：甲板法线朝上，0.22 的金属度会把整片晴空环境反射糊在上面，
  // 深色甲板直接被照成浅蓝灰（实测比预期亮了一整档）。
  // **roughness 必须是 1.0** —— roughnessMap 是乘在它上面的（texturekit.js 模块头那条）。
  const deckMat = deckSurface(DECK_W * 2, DECK_L * 2, PAL.deck);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(DECK_W * 2, 0.6, DECK_L * 2), deckMat);
  deck.position.y = -0.3;
  deck.receiveShadow = true;
  scene.add(deck);

  // ===== 船体（红色舷侧 + 船首/船尾舰体块）=====
  hullBase = hullMaps();
  plateBase = plateMaps();
  // 舷侧主视面是 68×3.4；`color` 固定白 —— 红漆已经烘进 albedo 了
  const hullMat = new THREE.MeshStandardMaterial({
    ...hullSkin(DECK_L * 2, 3.4), color: 0xffffff, roughness: 1.0, metalness: 0.08,
  });
  for (const sx of [-1, 1]) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, DECK_L * 2), hullMat);
    hull.position.set(sx * (DECK_W + 0.4), -1.7, 0);
    scene.add(hull);
  }
  // **不要给舷侧外面加细节（水线漆带 boot-top、舷外标识、舷窗等）** —— 舷侧的**外**表面
  // 在整个游戏里都看不见。已实测过：把 boot-top 染成品红，从甲板、舷侧走道（x=−19.35，
  // 能站到的最外沿）、以及俯视机位各拍一遍，**一次都没出现**。原因是几何上的：
  // 舷侧顶面在 y=0、水面在 y=−2.4，而玩家眼高 ≥1.6m，视线越过舷侧顶沿之后直接落到水上，
  // 舷侧那 2.4m 高的外立面被自己的顶沿完整遮住（要看见它得站到 x 超出 ±21 的船外）。
  // 「船从哪里入水」这件事由 `foamTexture()` 那四条泡沫带负责，那才是从甲板上看得见的。
  // 玩家实际看到的「红色舷侧」是这堵墙的**内**表面（走道内侧、面朝 +x/−x），它已经带贴图。
  //
  // 船首（-z，敌方一侧）与船尾（+z，我方一侧）的舰体：延伸出甲板之外，
  // 上面承载上层建筑，甲板本身保持净空（敌方 AI 在 -z 端刷出，不能被挡住）。
  const bowStern = [
    { z: -(DECK_L + 8), d: 16 }, // 船首
    { z: DECK_L + 5, d: 10 },    // 船尾
  ];
  for (const e of bowStern) {
    // **repeat 必须按「玩家看得见的那一面」定，而不是按±X那一面。**
    // 舰体块是 BoxGeometry(42, 6.2, d)：±X 面是 d×6.2、±Z 面是 42×6.2，两者差 2.6 倍。
    // 站在甲板上（`h?-bow-super.png` 那个机位）看见的**只有 +z 面**（船首块）与 −z 面（船尾块）
    // —— 42m 宽的那面，正对中路、距离十来米。而 ±X 面在 x=±21、在 `bounds.hw=19.35` 之外，
    // 法线朝外，玩家永远站在它的内法线一侧，是背面（同舷侧外表面那条，见下面的注释）。
    // 第一版按 `e.d`(16) 定 repeat，于是 42m 的正面套了 16m 的砖 ⇒ **横向拉伸 2.6 倍**，
    // 锈痕与焊缝全被拉成一道道横糊 —— 那一面本来是最该看得出「这是一片铆起来的钢板」的地方。
    const hullBlkMat = new THREE.MeshStandardMaterial({
      ...hullSkin(DECK_W * 2 + 2, 6.2), color: 0xffffff, roughness: 1.0, metalness: 0.08,
    });
    const blk = new THREE.Mesh(new THREE.BoxGeometry(DECK_W * 2 + 2, 6.2, e.d), hullBlkMat);
    blk.position.set(0, -0.3, e.z);
    scene.add(blk);
    // 首尾盖的顶面是 42×d，与甲板的 40×68 完全是两个比例 —— 单独一份 repeat
    const cap = new THREE.Mesh(new THREE.BoxGeometry(DECK_W * 2 + 2, 0.5, e.d), deckSurface(DECK_W * 2 + 2, e.d, PAL.deck));
    cap.position.set(0, 2.75, e.z);
    scene.add(cap);
    // 小地图：舰体块大部分落在 `bounds` 之外，画的时候按地图矩形裁掉，只在上下缘露出一点
    // —— 那一点正好是「这条船还有首尾」的可读信号。
    topdown.push({ x: 0, z: e.z, hx: DECK_W + 1, hz: e.d / 2, kind: "hull" });
  }
  // ===== 舷侧走道（参考图最醒目的特征：两舷各一条抬高的钢板走道 + 栏杆）=====
  // metalness 0.3 → 0.04：走道朝上，0.3 会把整片晴空反射糊在 1.6m 宽的一条上，
  // 走道直接被照成浅蓝灰（和 deckMat 上面那条注释同一个理由）。
  // 色调 `0x9aa1a8` → `0x6f6d64`：原来的近白浅蓝灰让走道成了**全场最亮的水平面**，
  // 比甲板还亮一档半 —— 而 DESIGN.md 里「深色甲板」才是这个场景的基调，走道是同一片
  // 甲板上的钢面，不该反过来压过它。现在比甲板（PAL.deck 0x59564d）亮一档、同属暖灰，
  // 既保住「这是一条抬高的独立走道」的可读性，又不跟甲板抢。
  // **同一个数在 `stairMat` 上又出现一次**（楼梯踏面同属走道系统），改一处要改两处。
  const sideMat = deckSurface(1.6, DECK_L * 2, 0x6f6d64);
  const WALK_H = 0.4;
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.6, WALK_H, DECK_L * 2), sideMat);
    w.position.set(sx * (DECK_W - 0.8), WALK_H / 2, 0);
    w.castShadow = true;
    w.receiveShadow = true;
    scene.add(w);
    colliders.push({ x: sx * (DECK_W - 0.8), z: 0, hx: 0.8, hz: DECK_L, h: WALK_H });
    obstacles.push(w);
    topdown.push({ x: sx * (DECK_W - 0.8), z: 0, hx: 0.8, hz: DECK_L, kind: "walk" });
  }

  // ===== 栏杆（立在舷侧走道上，作为视线/碰撞）=====
  const railMat = new THREE.MeshStandardMaterial({ color: PAL.rail, metalness: 0.7, roughness: 0.4 });
  function addRail(x, y, z, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), railMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    scene.add(m);
    obstacles.push(m);
    return m;
  }
  const RAIL_Y = WALK_H; // 栏杆立足面
  for (const sx of [-1, 1]) {
    addRail(sx * (DECK_W - 0.2), RAIL_Y + 1.1, 0, 0.12, 0.12, DECK_L * 2);
    addRail(sx * (DECK_W - 0.2), RAIL_Y + 0.6, 0, 0.1, 0.1, DECK_L * 2);
    for (let z = -DECK_L; z <= DECK_L; z += 6) {
      addRail(sx * (DECK_W - 0.2), RAIL_Y + 0.6, z, 0.14, 1.2, 0.14);
    }
  }
  // 两端的舷墙栏杆（防止掉落，也把战场收口）
  for (const sz of [-1, 1]) {
    addRail(0, RAIL_Y + 1.1, sz * (DECK_L - 0.2), DECK_W * 2, 0.12, 0.12);
    for (let x = -DECK_W; x <= DECK_W; x += 6) {
      addRail(x, RAIL_Y + 0.6, sz * (DECK_L - 0.2), 0.14, 1.2, 0.14);
    }
  }

  // ===== 集装箱堆放 =====
  // 真实箱体约 6.0(长) x 2.55(宽) x 2.43(高)，本地模型 5.996/2.551/2.432 -> 缩放 1.9
  const containerProto = await loadModel("./models/container.glb");
  // 尺寸直接量包围盒。**这个 GLB 的长边在本地 Z 上，不在本地 X 上** —— 下面 specs 的
  // rot 是按「本地长边 = X」写的（rot=PI/2 意为长边顺船），所以摆放时要补一个
  // CONT_YAW = -90°。漏掉它的后果实测过：60 只箱子的模型全部比自己的碰撞盒转了 90°
  // （模型 6m 横在甲板上、碰撞盒 6m 顺船），且模型中心还偏出碰撞盒 1.31m；x=±19/±16/±13
  // 三列各 6m 宽、间距才 3m，于是互相插进对方体内糊成一堵实心墙 ——
  // 设计里的「三条主干道 + 11m 中央通道」全没了，玩家撞到的就是那面「空气墙」。
  const cdim = new THREE.Box3().setFromObject(containerProto).getSize(new THREE.Vector3());
  const CONT_SCALE = 1.9;
  const CONT_T = cdim.x * CONT_SCALE; // 本地 X = 箱宽 ~2.55
  const CONT_H = cdim.y * CONT_SCALE; // 本地 Y = 箱高 ~2.43
  const CONT_L = cdim.z * CONT_SCALE; // 本地 Z = 箱长 ~6.0
  const CONT_YAW = -Math.PI / 2;      // 把本地长边(Z)搬到 specs 假定的本地 X 上

  const LONG = Math.PI / 2; // 长边顺船
  const SHORT = 0;          // 横置

  // CF「运输船」的多线结构（+z = 船尾 = 我方出生，-z = 船头 = 敌方基地）：
  //   舷边道 ┃ 外带（甲板室/舷边道具） ┃ 外列 ┃ 内巷 ┃ 内列 ┃ **中央大道** ┃ 内列 ┃ 内巷 ┃ 外列 ┃ 舷边道具 ┃ 舷边道
  //
  // **列距是被箱子尺寸倒推出来的，不是随手填的美术数字。** 长边顺船的箱子在 X 上只占
  // CONT_T = 2.55m；列心间距 5.2 给出 **2.65m 净巷**（够一人通过、够两个人错身）。
  // 两个曾经踩过的极端：
  //   · 早期列距 3.0m —— 2.55 的箱子在 3.0 的格子里互相插进对方体内，六列糊成两条实心墙；
  //   · 中间那版列距 7.2m —— 4.65m 的巷子比中央大道还宽，「三线结构」名存实亡，
  //     集装箱退化成散落的箱子，掩体之间的走位博弈没了。
  // 行距同理：箱长 CONT_L = 6.0m，行心间距 9.0 → **3.0m 的横向巷道**，
  // 与纵向巷道一起把甲板切成一张可以打「转角遭遇」的网。
  //
  // ---- 缩图后的两条硬约束（改这两个数组之前先把它们读完）----
  // ① **甲板室 ↔ 爬梯 ↔ 行距是一条锁死的链**：PORT_HZ = 6，而 stairRun(4.5) = 10 × 0.62 = 6.2，
  //    所以爬梯占 z ∈ [6, 12.2]；而箱长 6.0，下一排的行心**必须正好是 15.2**（箱南沿 12.2）
  //    才能严丝合缝地接住梯脚。这两个值（±6.2 与 ±15.2）是链子推出来的，不是美术选择。
  // ② **最外排行心受敌人刷出带的反向约束**：enemies.js 的 spawnGroup 在
  //    z = -(hl - 4 - rand·6) 刷人，即 |z| ∈ [hl-10, hl-4]。hl = DECK_L-0.65 = 33.35，
  //    所以刷出带是 |z| ∈ [23.35, 29.35]；要保证刷出点不落进箱子里，需要
  //    |最外排行心| + 3（半箱长） + 3（刷出带下沿到装箱外沿的余量） ≤ 29.35，
  //    即 |行心| ≤ 23.35 是硬上限 —— 但网格步长是 9.0，所以只能取 **±15.2**。
  //    **这条把「4 行」定死了：不能靠往外加排来填满甲板**，多出来的长度只能做开阔地。
  //
  // 于是甲板两端各留 ~15m 的开阔地（正好是双方的出生区），中路只剩 4 排箱子 —— 这就是要的「变小、变空」。
  const COLS = [-11.6, -6.4, 6.4, 11.6]; // 列心，间距 5.2（2 列/舷）
  const ROWS = [-15.2, -6.2, 6.2, 15.2]; // 行心，间距 9.0（4 排）
  // 堆叠层数表（0 = 留空）。行 = ROWS 下标（r0 = 最靠敌方），列 = COLS 下标（c0 = 左舷最外）。
  // 关于 x 镜像（c0↔c3）与 z 镜像（r0↔r3）都对称，保证两边出生点的掩体条件一致。
  //   · 外列（c0/c3）在 r1/r2 留空 —— 那里是两座**可进入的甲板建筑**（见「甲板建筑」一节）。
  //     甲板室 x 跨 ±[9.2, 14.0]、z 跨 ∓6，正好压住 (x=±11.6, z=∓6.2) 这两个格子。
  //   · 两端外列两层、内列一层：保留侧面高低错落，同时打开中路天空与对枪线。
  const STACK = [
    [2, 1, 1, 2], // z = -15.2  敌方前沿
    [0, 1, 1, 0], // z =  -6.2  外列让位给甲板室与爬梯
    [0, 1, 1, 0], // z =   6.2  同上
    [2, 1, 1, 2], // z =  15.2  我方前沿
  ];
  // 上色：按 (行,列) 取确定性的色 —— 不用 Math.random，配色每次刷新一致，截图可比对。
  // 深绿仍是主色（占多数），穿插灰蓝/浅卡其/军绿；三层塔统一刷浅灰，让它们从头像里跳出来。
  const PICK = [PAL.dgreen, PAL.olive, PAL.dgreen, PAL.grayblue, PAL.dgreen, PAL.khaki, PAL.dgreen, PAL.gray];
  const containers = [];
  for (let r = 0; r < ROWS.length; r++) {
    for (let c = 0; c < COLS.length; c++) {
      const n = STACK[r][c];
      if (!n) continue;
      containers.push({
        x: COLS[c],
        z: ROWS[r],
        rot: LONG,
        stack: n,
        colors: Array.from({ length: n }, (_, L) =>
          L > 0 ? 0xa49e88 : PICK[(r * 3 + c * 5) % PICK.length]
        ),
      });
    }
  }
  // ---- 中央大道上的两口深绿箱（CF 的「不可穿透的绿皮箱」）----
  // z=±10.7 正好落在 R(-15.2) 与 R(-6.2) 之间那条**横向巷道**的中点，把中央大道切成 S 形。
  //
  // **横置（rot: SHORT）的箱子绝不能放在大道正中** —— 这是敌人 AI 的硬约束，不是美术选择。
  // enemies.js 的 avoid() 是个纯局部反射：前方被挡就把本帧位移在水平面内转 90°，
  // 并且**承诺 1.1s 不改方向**（detourT），所以一次绕行在 3.5m/s 下要走 3.85m 才重算；
  // 两侧各探 1.1m 打平时（平手）方向由 `Math.sin(seed)` 定，而 seed 是每敌人一个**固定值**。
  // 于是一口 6.0m 宽（hx=3.0）的横箱摆在 x=0 时：`ahead` 探针（前向再 +0.5m）被挡的区间是
  // x ∈ (-4.0, 3.0)，两侧的可用窗口各只有 1.125m —— **比一次绕行的 3.85m 还窄**，
  // 随机挑中的那一侧必然滑过头，滑到底撞上里层集装箱列（x=±6.4）再平手再回头，
  // 于是以满速在 -4.0 ~ -0.2 之间**永久往复**（实测 60s 净推进 14m、累计路程 181m，
  // 8 人里 2 人中招；两个侧探都读 0 时按 seed 定方向，所以中招与否纯看 seed 的符号）。
  //
  // 修法不是调 AI（avoid 的时序是历史调稳的，别动），而是**把它贴到巷子边上、只留一条宽道**：
  // 箱心 x=±3.85 → 箱体跨 x ∈ ±[2.575, 5.125]，东沿正好与里层集装箱列（西沿 5.125）齐平，
  // 原来那条 0.85m 的假缝也一并消掉。此时被挡区间是 x ∈ (1.575, 5.125)，
  // **可用窗口 x ∈ [-5.125, 1.575]，净宽 6.7m** —— 比一次绕行宽得多，怎么滑都能滑进窗口。
  // 两口箱心 x 相反（z 也相反），中路仍是「必须绕、且绕两侧」的 S 形交火线。
  containers.push({ x: -3.85, z: 10.7, rot: SHORT, stack: 1, tarp: true, colors: [PAL.dgreen] });
  containers.push({ x: 3.85, z: -10.7, rot: SHORT, stack: 1, tarp: true, colors: [PAL.dgreen] });

  const faceCache = new Map(); // 同色集装箱共用一张瓦楞贴图（全局缓存，颜色只有 6 种）
  // 材质也**按颜色**缓存。实测 container.glb 那 5 个材质彼此的差别**只有 baseColorFactor**
  // （doubleSided / alphaMode / metal / rough 全部一致，见 /tmp/glbmat.mjs 的输出），
  // 而下面会把颜色烘进 containerFaceTexture、把材质色留白 —— 上漆之后 5 个 primitive
  // 在渲染上完全等价，所以合成一份是安全的。原先每箱每个 primitive 各 clone 一份 = 110 份材质。
  const contMatCache = new Map();
  const contDet = containerDetail();
  const containerMat = (col, faceTex, srcMat) => {
    if (!contMatCache.has(col)) {
      const m = srcMat.clone();
      // 颜色已经烘进 containerFaceTexture，材质色必须留白 —— 两边都上色等于色值平方，
      // 深绿箱会直接黑成一块（实测 #2f5230 平方后只剩 #091a09）。
      m.color = new THREE.Color(0xffffff);
      m.map = faceTex;
      // 三件套与颜色无关 → 6 种颜色共用同一份 normalMap / roughnessMap
      m.normalMap = contDet.normalMap;
      m.normalScale = contDet.normalScale;
      m.roughnessMap = contDet.roughnessMap;
      m.metalness = 0.12;
      // roughnessMap 是**乘**在 roughness 上的，所以这里必须是 1.0，变化全在贴图里
      m.roughness = 1.0;
      m.needsUpdate = true;
      contMatCache.set(col, m);
    }
    return contMatCache.get(col);
  };
  // Canvas-wrapped military freight: neutral fabric height field, dark green albedo,
  // pale pallet band and tie-down seams. All maps share UVs and dimensions.
  const tarpH = 1.90, TS = 256;
  const tarpHeight = field(TS, (u, v) => 0.5 + 0.16 * Math.sin(u * 44 + Math.sin(v * 9) * 2) + 0.05 * fbm(u, v, 18, 3, 48));
  const tarpBase = hexLin(0x304333), pallet = hexLin(0xaaa38a);
  const tarpMaps = buildMaps(TS, tarpHeight, 1.2, 0.45, (i, rgb) => {
    const u = (i % TS) / TS, v = Math.floor(i / TS) / TS;
    const bottom = v > 0.84;
    const seam = Math.abs(u - 0.18) < 0.012 || Math.abs(u - 0.82) < 0.012;
    const tone = (0.68 + tarpHeight[i] * 0.5) * (seam ? 0.55 : 1);
    const base = bottom ? pallet : tarpBase;
    for (let j = 0; j < 3; j++) rgb[j] = base[j] * tone;
  }, () => 0.96);
  const tarpMat = new THREE.MeshStandardMaterial({ ...tarpMaps, roughness: 1, metalness: 0 });
  const contMeshes = []; // 待合批的全部 primitive
  const contGroups = []; // 需要从 obstacles / scene 里换掉的原对象（每箱一个 Group）
  for (const spec of containers) {
    if (!containerProto) break;
    const total = spec.stack;
    for (let L = 0; L < total; L++) {
      const height = spec.tarp ? tarpH : CONT_H;
      const clone = spec.tarp
        ? new THREE.Mesh(new THREE.BoxGeometry(CONT_L, height, CONT_T), tarpMat)
        : containerProto.clone(true);
      clone.scale.setScalar(spec.tarp ? 1 : CONT_SCALE);
      clone.rotation.y = spec.tarp ? spec.rot : spec.rot + CONT_YAW;
      // 摆位前先量一次自己的包围盒：GLB 的几何中心不在原点（实测偏在本地 z≈+0.69、
      // y≈+0.06），直接 position.set(spec.x, CONT_H/2, spec.z) 会让整箱偏出碰撞盒 1.31m
      // —— 模型和碰撞盒各站各的，就是玩家摸到的「空气墙」。
      clone.position.set(0, 0, 0);
      const cc = new THREE.Box3().setFromObject(clone).getCenter(new THREE.Vector3());
      clone.position.set(spec.x - cc.x, height / 2 + L * height - cc.y, spec.z - cc.z);
      const col = spec.colors[L];
      if (!faceCache.has(col)) faceCache.set(col, containerFaceTexture(col, containerLayout()));
      const faceTex = faceCache.get(col);
      clone.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.material && !spec.tarp) o.material = containerMat(col, faceTex, o.material);
          contMeshes.push(o);
        }
      });
      scene.add(clone);
      // **每一层都要进 obstacles**。以前只有 L===0 那一层进去，于是 2/3 层叠箱的上面两层
      // 是不挡子弹的 —— 对着三层塔的正脸开枪，弹道会从第二层穿过去打中后面的东西，
      // 属于「看到的掩体和实际掩体不符」。
      contGroups.push(clone);
      if (L === 0) {
        const rot = spec.rot;
        const lx = Math.abs(CONT_L / 2 * Math.cos(rot)) + Math.abs(CONT_T / 2 * Math.sin(rot));
        const lz = Math.abs(CONT_L / 2 * Math.sin(rot)) + Math.abs(CONT_T / 2 * Math.cos(rot));
        colliders.push({ x: spec.x, z: spec.z, hx: lx, hz: lz, h: height * total });
        // 小地图：每格一件（**按格画、不按层画** —— 同一格叠几层在俯视图上是同一个方块，
        // 与 colliders「每格一个」的粒度一致）。
        topdown.push({ x: spec.x, z: spec.z, hx: lx, hz: lz, kind: "container" });
      }
    }
  }
  // 合批：115 个 primitive（23 箱 × 5）→ 每种颜色一个 mesh。
  // **必须把 obstacles 里的原对象原子地换掉**：`Raycaster` 只读 `matrixWorld`、
  // 不要求对象在场景里，所以只 `scene.remove()` 却把原对象留在 obstacles 里的话，
  // 子弹会继续命中一个用陈旧矩阵算出来的点（`h.point` 是错的）——见 batch.js 的注释②。
  if (NO_BATCH) {
    // `?nobatch` 必须**忠实还原改动前的行为**，否则 A/B 比的是两个都错的东西
    // （实测踩到：这里原来漏了这句，于是「合批前」的 obstacles 里根本没有集装箱和桶，
    //  189 vs 204 的假差异看着像合批把命中改多了）。
    for (const g of contGroups) obstacles.push(g);
  } else {
    batchStatic(scene, contMeshes, {
      castShadow: true,
      receiveShadow: true,
      onReplace: (_olds, news) => {
        for (const g of contGroups) {
          const i = obstacles.indexOf(g);
          if (i >= 0) obstacles.splice(i, 1);
          if (g.parent) g.parent.remove(g);
        }
        for (const n of news) obstacles.push(n);
      },
    });
  }

  // ===== 木箱堆（参考图里的米黄木箱，CF 中主要的可穿透掩体/垫脚箱）=====
  const crateMats = new Map();
  const crateMaps = woodMaps();
  // 木箱按颜色缓存材质。**颜色走 `color` 相乘、贴图是接近白的中性木色** ——
  // 木箱有好几种颜色（米黄 / 军绿），把颜色烘进贴图就得每种颜色重跑一遍三件套。
  function crateMat(hex) {
    if (!crateMats.has(hex)) {
      crateMats.set(hex, new THREE.MeshStandardMaterial({
        ...crateMaps,          // map / normalMap / roughnessMap / normalScale
        color: hex,
        roughness: 1.0,        // roughnessMap 是乘在它上面的
        metalness: 0.03,
      }));
    }
    return crateMats.get(hex);
  }
  function addCratePile(o) {
    const bx = 0.9, gap = 0.05;
    const nx = o.nx || 1, nz = o.nz || 1, nh = o.h || 1;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) for (let k = 0; k < nh; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bx, bx, bx), crateMat(o.colors[k % o.colors.length]));
      const x = o.x + (i - (nx - 1) / 2) * (bx + gap);
      const z = o.z + (j - (nz - 1) / 2) * (bx + gap);
      const y = (o.topY || 0) + bx / 2 + k * (bx + gap * 0.5);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m); obstacles.push(m);
      minX = Math.min(minX, x - bx / 2); maxX = Math.max(maxX, x + bx / 2);
      minZ = Math.min(minZ, z - bx / 2); maxZ = Math.max(maxZ, z + bx / 2);
    }
    const h = (o.topY || 0) + nh * (bx + gap * 0.5);
    colliders.push({ x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, hx: (maxX - minX) / 2, hz: (maxZ - minZ) / 2, h });
    topdown.push({ x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, hx: (maxX - minX) / 2, hz: (maxZ - minZ) / 2, kind: "crate" });
  }
  const W = PAL.lwood, G = 0x3a6b3a, DG = PAL.dgreen;
  // 木箱一律放在**开阔处**：纵向巷净宽只有 2.65m，塞进 1.85m 的箱堆会把巷口堵死
  // （敌人 avoid() 还要按 0.5m 外扩，净空不够那条巷子对 AI 就成了死胡同）。
  // 缩图后木箱从 25 处砍到 9 处，只留**中场大堆 + 中央大道两端 + 舷边外带**四类：
  //   · x = 0 那一串是 CF 中路的标准掩体（射击时能越过、走位时挡人）；
  //   · x = ±16.2 落在甲板室（外缘 14.0）与舷侧走道（内缘 18.4）之间那条 4.4m 的外带里，
  //     两侧各余 1.75m，不堵路。
  // 中央大道（|x| < 5.125）与横向巷道（3.0m）留给走位，不放任何东西。
  //
  // **沿 Z 迎面撞上来的障碍，半宽（hx）必须 ≤ 2.85m。** 这是上面「横置绿箱不能摆正中」
  // 同一条推导的直接推论：avoid() 一次绕行滑 3.85m，而绕开一个半宽 h 的障碍需要滑过
  // h + 1.0（`ahead` 探针还要再外扩 0.5m），所以 h > 2.85 的箱子从正中滑一次**永远滑不到位**，
  // 会撞上第二堵墙再平手再回头 —— 就是那个永久往复。木箱堆 bx=0.9、gap=0.05，
  // 所以 nx ≤ 3（半宽 1.40m）安全，nx = 4 时半宽 1.875m 也仍在 2.85m 以内、能过，
  // 但把守出生口那两堆还是**偏心摆到 x = ±3.0**，让开中轴给敌人一条直路。
  // 舷边那四堆（nx=1）半宽只有 0.45m，随便放。
  addCratePile({ x: 0, z: 0, nx: 3, nz: 2, h: 2, colors: [W] });      // 中路大木箱堆（全图最显眼的中场掩体）
  addCratePile({ x: 0, z: 5.2, nx: 3, nz: 1, h: 1, colors: [W] });    // 中路绿皮箱内侧的矮箱
  addCratePile({ x: 0, z: -5.2, nx: 3, nz: 1, h: 1, colors: [W] });
  addCratePile({ x: 3.0, z: 20.5, nx: 3, nz: 2, h: 1, colors: [W] });     // 我方出生区前（偏心摆，让开大道中轴）
  addCratePile({ x: -3.0, z: -20.5, nx: 3, nz: 2, h: 1, colors: [G, DG] }); // 敌方出生区前（与上一条关于原点镜像）
  for (const sx of [-1, 1]) {
    for (const z of [10.7, -10.7]) {
      addCratePile({ x: sx * 16.2, z, nx: 1, nz: 2, h: 1, colors: z > 0 ? [W] : [W, G] });
    }
  }

  // ===== 军用油桶 / 木桶掩体 =====
  const oilProto = await loadModel("./models/oilbarrels.glb");
  const barrelProto = await loadModel("./models/barrel.glb");
  // 桶簇实测最长边 1.27m —— **不能塞进 2.65m 的纵向巷**（敌人 avoid() 要外扩 0.5m 才能过，
  // 净空不够就会把那条巷子当成死胡同）。所以四组桶全部落在**开阔地**：
  // 中央大道里那两组**贴着绿皮箱的开口侧**（箱心 x=∓3.85 → 箱体压在 x ∈ ±[2.575, 5.125]，
  // 所以桶只能摆到 x=±1.4 这一侧，再往边上就进箱子了），
  // 另两组在舷边外带（|x| ≈ 16.4，甲板室外缘 14.0 与走道内缘 18.4 之间）。
  // 改集装箱网格（COLS/ROWS/STACK）之后**必须重跑碰撞审计**（见 AGENTS.md）。
  const props = [
    { x: 1.4, z: 10.7, oil: 1, r: 0 },
    { x: -1.4, z: -10.7, oil: 1, r: 2 },
    { x: 16.4, z: 20.0, oil: 0, r: 1 },
    { x: -16.4, z: -20.0, oil: 1, r: 2.6 },
  ];
  // 材质与几何都按「油/木 × 源材质」归并：`oilbarrels.glb` 有 24 个 primitive、7 个材质，
  // 4 组桶各 clone 一份 = 72 次绘制调用；它们只是甲板上的静物，合成后每组材质一个 mesh。
  const barrelMatCache = new Map();
  const barrelMat = (key, srcMat, oil) => {
    if (!barrelMatCache.has(key)) {
      const m = srcMat.clone();
      // **两种桶都要处理**，不能只管油桶：`barrel.glb`（木桶）原来的材质也是高金属度，
      // 而 `scene.environment` 是那张亮蓝天贴图 —— 金属度高的表面基本不吃反照率、
      // 只反天空，于是木桶在甲板上是**惨白薄荷绿**（跟深绿集装箱、米黄木箱放一起
      // 像塑料垃圾桶）。压金属度 + 提粗糙度之后才回得来本色。
      m.metalness = 0.15;
      m.roughness = 0.68;
      // 油桶 GLB 自带高饱和红/蓝漆带，跟军事配色打架；乘一层灰绿把饱和度压下去。
      // 木桶保留自己的木色，只压金属度（见上）。
      if (oil) m.color = new THREE.Color(0x5f6753);
      barrelMatCache.set(key, m);
    }
    return barrelMatCache.get(key);
  };
  const barrelMeshes = [];
  const barrelGroups = [];
  for (const p of props) {
    const proto = p.oil ? oilProto : barrelProto;
    if (!proto) continue;
    const o = proto.clone(true);
    // oilbarrels.glb 是一「组」桶，本地尺寸没保证：按包围盒把它整组缩到约 0.95m 高
    // （标准 200L 油桶 ≈0.88m），写死倍率容易做出比人还高的巨型桶。
    const pre = new THREE.Box3().setFromObject(o);
    const preH = Math.max(0.001, pre.max.y - pre.min.y);
    o.scale.setScalar(p.oil ? Math.min(14, 0.95 / preH) : 1.1);
    o.rotation.y = p.r;
    const bb = new THREE.Box3().setFromObject(o);
    o.position.set(p.x, -bb.min.y, p.z);
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        if (m.material) {
          m.material = barrelMat((p.oil ? "oil|" : "dry|") + m.material.uuid, m.material, p.oil);
        }
        barrelMeshes.push(m);
      }
    });
    scene.add(o);
    const h = bb.max.y - bb.min.y;
    if (h > 0.06) {
      // 碰撞盒按实际包围盒推，别再写死 1.0：缩放改了以后碰撞会跟模型对不上
      const hx = Math.max(0.28, (bb.max.x - bb.min.x) / 2);
      const hz = Math.max(0.28, (bb.max.z - bb.min.z) / 2);
      colliders.push({ x: p.x, z: p.z, hx, hz, h: Math.min(h, 1.2) });
      barrelGroups.push(o); // obstacles 的重指统一放到合批之后（见下）
    }
  }
  // 与集装箱同一套原子替换：从 obstacles 摘掉原对象 → 加进合并产物。
  if (NO_BATCH) {
    // 同集装箱：`?nobatch` 必须忠实还原改动前的行为（桶是真进 obstacles 的）
    for (const g of barrelGroups) obstacles.push(g);
  } else {
    batchStatic(scene, barrelMeshes, {
      castShadow: true,
      receiveShadow: true,
      onReplace: (_olds, news) => {
        for (const g of barrelGroups) {
          const i = obstacles.indexOf(g);
          if (i >= 0) obstacles.splice(i, 1);
          if (g.parent) g.parent.remove(g);
        }
        for (const n of news) obstacles.push(n);
      },
    });
  }

  // ===== 叉车（甲板作业道具）=====
  const forkProto = await loadModel("./models/forklift.glb");
  if (forkProto) {
    const fork = forkProto.clone(true);
    // 按包围盒归一化，和油桶同一套写法（见上面 props 循环）。**千万别写死倍率**：
    // 原来这里是 scale.setScalar(26)，而 GLB 自带很大的本地偏移，倍率会把偏移一起放大
    // —— 实测整台叉车被推到船头外 1.4km、尺寸 60m，被 FogExp2 吃得一干二净，
    // 而 (-22,10) 那个碰撞盒底下空无一物：玩家撞上去就是一面纯空气墙。
    const pre = new THREE.Box3().setFromObject(fork);
    const preL = Math.max(0.001, Math.max(pre.max.x - pre.min.x, pre.max.z - pre.min.z));
    fork.scale.setScalar(3.2 / preL); // 叉车全长约 3.2m
    fork.rotation.y = Math.PI / 2;
    fork.position.set(0, 0, 0);
    const bb = new THREE.Box3().setFromObject(fork);
    const bc = bb.getCenter(new THREE.Vector3());
    // 落在我方出生区的**外侧**（出生点在 (0, hl-6) = (0, 27.35)、安全半径 9m；
    // (11, 22) 距出生点 12.2m，正好在圈外），当我方出生区的侧翼掩体；
    // 同时避开 x=11.6 那一列的集装箱（z 最远 18.2，叉车长边沿 z 从 20.4 起）。
    const FX = 11, FZ = 22;
    fork.position.set(FX - bc.x, -bb.min.y, FZ - bc.z);
    fork.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    scene.add(fork);
    obstacles.push(fork);
    // 碰撞盒按实际包围盒推，别再写死 1.4/1.8/2.2
    colliders.push({
      x: FX,
      z: FZ,
      hx: Math.max(0.5, (bb.max.x - bb.min.x) / 2),
      hz: Math.max(0.5, (bb.max.z - bb.min.z) / 2),
      h: Math.min(bb.max.y - bb.min.y, 3.2),
    });
  }

  // ===== 甲板建筑（两座可进入的舱室 + 屋顶平台 + 外挂爬梯）=====
  // 这一节是「立体化」的主承重：原来的地图上**唯一的垂直变化是 0.4m 的舷侧走道**，
  // 全场所有东西都在同一层，走位只有「沿通道前后」一个维度。
  // 两座建筑的顶层都是 4.9m 的**可行走屋顶**（= 两层集装箱的高度），各配南北两部爬梯。
  //
  // 关键前提是 main.js 里 colliders 新增的 `y0`（底面高度）：碰撞模型本来假定
  // 「每个碰撞体的竖直区间都是 [0, h]」，于是一座屋顶的碰撞盒会把**底下的整间屋子**填实
  // ——「可进入」和「可站上去的屋顶」在旧模型里是互斥的。写了 y0 之后，
  // 屋顶（y0=4.6, h=4.9）只在「人在上面」时才算实体，人在屋里时它是一块天花板。
  // 这两个常量必须**声明在使用点之前**：右舷屋顶那间小机房在下面几行就要用 WALL_TINT 造材质，
  // 而 `const` 在同一函数作用域里是有 TDZ 的 —— 声明留在下面的立面细节节里会在开局直接抛
  // `Cannot access 'WALL_TINT' before initialization`（整张地图构建失败，页面白屏）。
  const WALL_TINT = 0xaaa38d;   // 甲板室涂装色（贴图是中性的，色相全在这一档）
  const SIDE_DOOR = 2.2;        // 东西侧墙上那道窄门的净宽
  const wallMat = plateMat(3.0, 2.3, WALL_TINT);   // 只给右舷屋顶那间小机房用
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x5d646b, roughness: 0.72, metalness: 0.18 });
  // 钢板屋顶的色调比甲板浅一档（甲板室顶棚常年被太阳晒、又被雨水冲，锈得少）
  const ROOF_TINT = 0x858273;

  // 一部直跑钢梯。**每一级台阶各进一个 collider** —— 玩家的上下楼全靠
  // supportAt/blockedBy 逐级读 c.h；给整部梯一个 AABB 的话它就是一个 4.5m 高的实心块。
  //
  // **踏步必须比玩家半径（PLAYER_RADIUS = 0.45）宽**，这是这套碰撞模型的硬约束，
  // 不是审美选择：blockedBy 把每个 collider 按半径外扩，而 supportAt 只在
  // **中心**落进未外扩的矩形里才算踩到。TREAD ≤ 0.45 时，下一级台阶的外扩范围
  // 会**罩住**当前这级的整个踏面（边缘 z_i - TREAD/2 + 0.45 ≥ z_i + TREAD/2），
  // 人走到一半就被下一级挡住，脚永远落不到踏面上 —— 表现为「贴着梯子原地推、上不去」。
  // 第一版 TREAD = 0.40 就是这么卡死的（实测：从 z=13.4 走到 13.47 就不动了）。
  // 取 0.62 → 富余 0.17m。
  // 踏面高按 **0.44 的期望值四舍五入**，不要向上取整到 0.5：4.5m 净高正好是 0.5 的整数倍，
  // ceil 会给出 9 级 × 0.50m —— 正好压在 STEP_H 的等号边界上（`c.h <= feetY + STEP_H`），
  // 第一级从甲板迈上去只在浮点意义上成立。取 10 级 × 0.45m 就有 0.05m 富余。
  const RISER_WANT = 0.44, TREAD = 0.62, STAIR_W = 1.6;
  // 踏面是 1.6×0.62，与走道的 1.6×68 差两个数量级 —— 套走道那份 repeat 的话
  // 每级踏面上会被压上 19 条防滑纹（实测的 25:1 拉伸在楼梯上是最刺眼的一处）
  // 同 `sideMat` 那个 0x6f6d64（楼梯踏面与走道是同一套钢面），改一处要改两处。
  const stairMat = deckSurface(STAIR_W, TREAD, 0x6f6d64);
  const stairSteps = (topY) => Math.max(2, Math.round(topY / RISER_WANT));
  // 梯子的水平投影长度（调用方要用它算梯脚位置，好让梯顶正好落在屋顶边缘）
  const stairRun = (topY) => stairSteps(topY) * TREAD;
  // 四座梯子的全部静态件统一收集，最后一次性合批（见下面那处 batchStatic 调用）。
  // **必须同时 scene.add**：`batchStatic` 的 bake() 读的是 `matrixWorld`，而 matrixWorld
  // 只会被 `updateMatrixWorld` 写 —— 游离在场景外的 mesh 永远是单位阵，烘出来会堆在原点。
  const stairParts = [];
  const stairPart = (m) => { scene.add(m); stairParts.push(m); return m; };
  // 两座甲板室的舱壁管路（见 addHouseDetail ⑧）。同样攒起来一次合批 —— 两座 × 两侧
  // × 两根 × ~10 件 ≈ 80 个静态件，不合批就是 80 次绘制调用。
  const pipeRunParts = [];

  // 楼梯。**视觉与碰撞必须一一对应，这是本函数最硬的一条约束。**
  //
  // 第一版每一级是一整块**从甲板 y=0 长到该级踏面**的实心盒：碰撞是对的，但站在甲板上
  // 斜看时每一级的 +x 面都是「0.62m 宽 × 最高 4.5m 高」的大板，十几块叠起来就是一座
  // **巨型台阶塔**（`h3-house-corner.png` 左半边全是它）—— 而它正好是甲板上最挡视线的一处。
  //
  // 现在改成真实的开口梯：薄踏板 + 薄立板 + 两道斜梯梁 + 带立柱的扶手。
  // 碰撞随之从「实心块」改成 `y0 = 踏面高 − 0.30`，即**碰撞体只贴着踏板本身**：
  //   · 上梯不受影响：站在下一级上时 `supportAt` 仍取得到这一级
  //     （y0 = feetY + 0.15 ≤ feetY + STEP_H，c.h = feetY + 0.45 ≤ feetY + STEP_H）；
  //   · 梯下变成可通行 —— `blockedBy` 里 `c.y0 >= feetY + PLAYER_TOP(1.78)` 那一支会放行，
  //     而「看得见的开口梯下面本来就能过人」，两边仍然对得上（这正是这一版的意义）。
  //   · 顺带：敌人 `avoid()` 会滤掉 `y0 ≥ 1.2` 的碰撞体，于是梯子对 AI 从
  //     「6.2m 长、4.5m 高的墙」缩成「1.9m 长的小台阶」—— 只会更好走，不会更堵。
  function addStairs(cx, zBottom, dir, topY, mat) {
    const n = stairSteps(topY);
    const rise = topY / n;
    const run = n * TREAD;
    // 小地图：整条梯段画成一个长条（不逐级画 —— 一级 0.62m 在 40×68 的图上不到 1px）
    topdown.push({ x: cx, z: zBottom + dir * run / 2, hx: STAIR_W / 2, hz: run / 2, kind: "stairs" });
    const ang = Math.atan2(topY, run);   // 坡度
    const XO = STAIR_W / 2 - 0.06;       // 扶手 / 立柱 / 梯梁所在的 x 偏移
    const RAIL_H = 0.95;                 // 扶手高出踏面前缘
    // 与梯段平行的一条长条（扶手、梯梁都用它）：中点在梯段中点，弦长按坡度放大
    const slope = (yOff) => ({
      len: run / Math.cos(ang) * 1.02,
      y: topY / 2 + yOff,
      z: zBottom + dir * run / 2,
    });
    let z = zBottom;
    for (let i = 0; i < n; i++) {
      const top = rise * (i + 1);
      const zc = z + dir * TREAD / 2;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(STAIR_W, 0.08, TREAD), mat);
      tread.position.set(cx, top - 0.04, zc);
      stairPart(tread);
      // 立板：贴在本级的下沿（也就是上一级的前缘）。缩进 2cm 免得与踏板共面。
      const riser = new THREE.Mesh(new THREE.BoxGeometry(STAIR_W - 0.08, rise + 0.02, 0.045), mat);
      riser.position.set(cx, top - rise / 2 - 0.02, zc - dir * (TREAD / 2 - 0.024));
      stairPart(riser);
      colliders.push({ x: cx, z: zc, hx: STAIR_W / 2, hz: TREAD / 2, h: top, y0: top - 0.30 });
      obstacles.push(tread);
      z += dir * TREAD;
      // 立柱：隔一级一根，立在本级踏面的**前缘**上（前缘的高度正好是 top，与扶手线对齐）
      if (i % 2 === 1 || i === n - 1) {
        for (const sx of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, RAIL_H, 0.07), trimMat);
          post.position.set(cx + sx * XO, top + RAIL_H / 2, zc + dir * (TREAD / 2 - 0.05));
          stairPart(post);
        }
      }
    }
    // 扶手：上、中两道；梯梁：板厚 0.10、深 0.52，托住全部踏板。
    // **一律纯视觉、不进 obstacles** —— 扶手进了就是两道 4.5m 高的墙把梯子封死（旧注释的结论）。
    for (const sx of [-1, 1]) {
      for (const h of [RAIL_H, RAIL_H * 0.55]) {
        const s = slope(h);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, s.len), railMat);
        bar.position.set(cx + sx * XO, s.y, s.z);
        bar.rotation.x = -dir * ang;
        stairPart(bar);
      }
      const s = slope(-0.30);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.52, s.len), trimMat);
      beam.position.set(cx + sx * XO, s.y, s.z);
      beam.rotation.x = -dir * ang;
      stairPart(beam);
    }
    return { zTop: zBottom + dir * n * TREAD };
  }

  // ---- 甲板室立面细节（**纯视觉：不进 colliders、不进 obstacles**）----
  //
  // 侧墙是全场面积最大的几块平面之一（左舷那面 12m 长的墙正对中路），而改造前
  // 它是一整块纯色板 —— 舷窗、腰线、门框、壁灯一个都没有，近看就是一面刷了漆的墙
  // （`h0-port-house.png` 里能直接看到）。这里按船舶立面的真实语汇补上：
  // 舷窗（凸出的圈 + 凹进去的深色玻璃）、腰线 belt rail、四角竖向包边、
  // 门框与门楣横窗、门边壁灯、通风百叶。
  //
  // **一律不给碰撞**：舷窗只凸出 5cm、壁灯凸出 22cm 且离地 3.1m，都不构成通行障碍；
  // 把它们塞进 colliders 会让「贴着墙走」凭空多出几处卡点，还可能踩到 AI 绕行那条
  // 「挡路障碍半宽 ≤ 2.85m」的红线（AGENTS.md）。代价是子弹能穿过舷窗与壁灯 ——
  // 用这个换一整面墙的细节，折衷是划算的。
  // **舷窗/门楣横窗的玻璃：必须是一面「照着天的镜子」，不能是一块黑。**
  // 原值 `color 0x151d25 + metalness 0.6` 是错的：金属度只有 0.6 时镜面反射率 F0 是
  // `lerp(0.04, color, 0.6)` —— 仍然被那个近黑的 color 拽住，于是它既不吃漫反射
  // （color 太暗）又反射不出东西（F0 太暗），渲出来是一块**纯黑**。在
  // `h4-house-corner.png` 里那块门楣横窗就是墙上一个黑洞，看着像墙被凿穿了。
  //
  // 改成 metalness 0.9：几乎纯镜面，反射色由 color 染色 —— color 提亮到钢蓝灰，
  // 于是它反射的是那片天空，读作「深色玻璃映着天光」。这是唯一能在**没有室内**
  // 的前提下把窗户画对的写法（真实玻璃是介质、F0 只有 4%，正面看就是暗的；但这
  // 些窗背后没有房间，照物理来只会得到一片黑）。
  //
  // `envLock` 是给那个全局去蓝遍历的豁免牌：玻璃**必须**吃满 IBL，
  // 否则「映着天光」这件事直接被降掉七成（规则见 scripts/envtame.js）。
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x46586a, roughness: 0.10, metalness: 0.9, envMapIntensity: 1.5,
  });
  glassMat.userData.envLock = true;
  // 灯面（只这一件发光）：底色压到暖白而不是纯白，发光 0.22 —— 0.85 时它是画面里
  // 最亮的一块、比天空还亮，「一团白光糊在墙上」的观感一半来自这个数。
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xe6d7b4, emissive: 0xffcf6e, emissiveIntensity: 0.22, roughness: 0.5,
  });
  const rimGeo = new THREE.TorusGeometry(0.175, 0.035, 6, 12);
  const glassGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.07, 12);
  // axis："x" = 装在朝 ±x 的墙上、"z" = 装在朝 ±z 的墙上。
  // 圆环（TorusGeometry）默认躺在 XY 面、轴朝 Z，所以朝 x 的墙要绕 Y 转 90°。
  function addPorthole(x, y, z, axis) {
    const rim = new THREE.Mesh(rimGeo, trimMat);
    rim.position.set(x, y, z);
    if (axis === "x") rim.rotation.y = Math.PI / 2;
    scene.add(rim);
    const g = new THREE.Mesh(glassGeo, glassMat);
    g.position.set(x, y, z);
    if (axis === "x") g.rotation.z = Math.PI / 2; else g.rotation.x = Math.PI / 2;
    scene.add(g);
  }

  function addHouseDetail(cx, cz, hx, hz, topY, doorW, HALF_LEN) {
    const T = 0.28;
    const FACE_X = hx + T / 2;   // 侧墙外表面的 |x − cx|
    const FACE_Z = hz + T / 2;
    // ① 舷窗：一排，y = 2.85（站在甲板上平视的高度）。**避开侧墙中间那道窄门**
    //    （净宽 SIDE_DOOR，门边留 0.55 余量），所以按位置筛而不是按固定间距硬摆。
    const keep = (off) => Math.abs(off) > SIDE_DOOR / 2 + 0.55;
    for (const sz of [-1, 1]) {
      const x = cx + sz * (FACE_X + 0.02);
      for (let i = 0; i < 8; i++) {
        const z = cz + (i / 7 - 0.5) * (hz * 2 - 1.7);
        if (keep(z - cz)) addPorthole(x, 2.85, z, "x");
      }
    }
    // ② 腰线：绕着整座屋子一圈的凸出条（比墙面凸出 10cm）at y = 1.15。
    //    **必须在门洞处断开** —— 腰线在 1.15m、门洞净高 2.06/2.2m，整根拉通会有一条
    //    钢板横在门当间（实测第一版就是这样：侧门被一条灰杠齐腰截断，看着像门被封了）。
    //    每面墙按「门洞两侧各一段」摆，长度与门洞的定位同源（同一个 SIDE_DOOR / doorW）。
    for (const sx of [-1, 1]) {
      const seg = (hz * 2 - SIDE_DOOR) / 2;
      for (const t of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.22, seg), trimMat);
        b.position.set(cx + sx * FACE_X, 1.15, cz + t * (SIDE_DOOR / 2 + seg / 2));
        scene.add(b);
      }
    }
    for (const sz of [-1, 1]) {
      const seg = (hx * 2 - doorW) / 2;
      for (const t of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(seg, 0.22, 0.20), trimMat);
        b.position.set(cx + t * (doorW / 2 + seg / 2), 1.15, cz + sz * FACE_Z);
        scene.add(b);
      }
    }
    // ③ 四角竖向包边（角柱）
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, topY, 0.22), trimMat);
      c.position.set(cx + sx * FACE_X, topY / 2, cz + sz * FACE_Z);
      scene.add(c);
    }
    // ④ 门框：门洞两侧各一根竖框 + 顶上一条横楣。**只在门洞外面**（净宽以内什么都不加，
    //    否则门就被框死了）。
    for (const sx of [-1, 1]) {
      for (const t of [-1, 1]) {
        const j = new THREE.Mesh(new THREE.BoxGeometry(0.14, SIDE_DOOR + 0.1, 0.22), trimMat);
        // 竖框的中心离门洞边 0.13 → 框的内沿正好落在 1.10（= 净宽的一半），不侵占门洞
        j.position.set(cx + sx * (FACE_X + 0.01), (SIDE_DOOR + 0.1) / 2, cz + t * (SIDE_DOOR / 2 + 0.13));
        scene.add(j);
      }
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, SIDE_DOOR + 0.42), trimMat);
      h.position.set(cx + sx * (FACE_X + 0.01), SIDE_DOOR + 0.13, cz);
      scene.add(h);
    }
    for (const sz of [-1, 1]) {
      for (const t of [-1, 1]) {
        const j = new THREE.Mesh(new THREE.BoxGeometry(0.22, HALF_LEN + 0.1, 0.14), trimMat);
        j.position.set(cx + t * (doorW / 2 + 0.13), (HALF_LEN + 0.1) / 2, cz + sz * (FACE_Z + 0.01));
        scene.add(j);
      }
      const h = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.42, 0.16, 0.14), trimMat);
      h.position.set(cx, HALF_LEN + 0.13, cz + sz * (FACE_Z + 0.01));
      scene.add(h);
      // ⑤ 门楣横窗：门上方那段墙本来是一块空板，开一排窗正好用掉它
      const winW = doorW - 1.0, winH = 0.62;
      const win = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.06), glassMat);
      win.position.set(cx, HALF_LEN + 0.75, cz + sz * (FACE_Z + 0.02));
      scene.add(win);
      // 窗框 + 竖挺。**这一笔是必需的、不是装饰**：玻璃改成镜面材质之后整块横窗是
      // 一片连续的蓝色反光，没有任何分割就读作「墙上贴了一张蓝纸」。加一圈窗框与
      // 四道竖挺之后，同一块玻璃立刻变成「一扇窗」—— 分割线是这个尺度上唯一
      // 能表达「这里是窗」的语汇。
      const wf = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.12, winH + 0.12, 0.05), trimMat);
      wf.position.set(cx, HALF_LEN + 0.75, cz + sz * (FACE_Z + 0.01));
      scene.add(wf);
      for (let i = 1; i <= 4; i++) {
        const mull = new THREE.Mesh(new THREE.BoxGeometry(0.045, winH, 0.05), trimMat);
        mull.position.set(cx - winW / 2 + (winW * i) / 5, HALF_LEN + 0.75, cz + sz * (FACE_Z + 0.04));
        scene.add(mull);
      }
    }
    // ⑥ 门边壁灯：**嵌入式舱壁灯**（底板 + 灯面 + 两道护栅），离地 3.1m（够高，不构成通行障碍）。
    //
    // 三代改法的教训都在这几行里：
    //   · 初版是一个 `0xfff1cc` + `emissiveIntensity 0.85` 的**孤零零的锥体**，发光过曝
    //     （是画面里最亮的一块，比天空还亮）—— 画面里就是「墙上悬着一团白光」。
    //   · 二代补了底座 + 支架 + 顶盖，正面看**仍然是一只白锥**：支架沿墙法线伸出，
    //     而正视墙面时那条轴正好指向相机，整根支架被透视压成一个点。
    // 结论：**舷灯不能靠「伸出来的支架」建立依附感**，得做成贴壁件。现在是
    // 底板 + 内嵌灯面 + 两道横向护栅（护栅是舷灯最好认的那笔），任何角度看都咬在墙上。
    for (const sx of [-1, 1]) {
      const zL = cz + SIDE_DOOR / 2 + 0.42;
      const xF = cx + sx * FACE_X;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.36), trimMat);
      plate.position.set(xF + sx * 0.035, 3.10, zL);
      scene.add(plate);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.20, 0.24), lampMat);
      lens.position.set(xF + sx * 0.085, 3.10, zL);
      scene.add(lens);
      for (const dy of [-0.075, 0.075]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.30), trimMat);
        bar.position.set(xF + sx * 0.115, 3.10 + dy, zL);
        scene.add(bar);
      }
    }
    // ⑦ 通风百叶：侧墙高处一块凹进去的深色格栅 + 三片百叶
    for (const sx of [-1, 1]) for (const t of [-1, 1]) {
      const z = cz + t * (hz * 0.62);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.78), glassMat);
      box.position.set(cx + sx * (FACE_X + 0.02), 3.95, z);
      scene.add(box);
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.80), trimMat);
        s.position.set(cx + sx * (FACE_X + 0.035), 3.95 + (i - 1) * 0.16, z);
        scene.add(s);
      }
    }
    // ⑧ 舱壁管路：沿侧墙横贯的蒸汽管 + 电缆管 + 法兰 + 管卡。
    //
    // 船舶立面上最「有船味」的一笔，而且**正好落在玩家的平视高度上** —— 甲板上的人
    // 一抬眼就是这条线，它是这一面墙从「一块钢板」变成「机舱外壁」的最后一块拼图。
    //
    // 位置卡在**门楣（SIDE_DOOR ≈ 2.2m）之上、舷窗（2.85m，圈外缘 2.64m）之下**
    // 那条空带里，所以不必在门洞处断开 —— 也就不会重蹈腰线那个「一根横杠把门截断」
    // 的坑（见 ②）。两根管的中点定在 2.30 / 2.52，各自带法兰后的外缘是 2.405 / 2.60，
    // 上下各留 0.04 以上间隙（舷窗 2.64、腰线无关，因为腰线在 1.15）。
    //
    // **不给碰撞**（与舷窗/壁灯同一条折衷，见本节开头）：它只凸出 7cm，塞进 colliders
    // 只会让「贴着墙走」凭空多出卡点。
    // 全部件攒进 `pipeRunParts`，两座房子建完后一次性合批 —— 否则光这一项就是
    // 两座 × 两侧 × 两根 × ~10 件 ≈ 80 次绘制调用。
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x8a8f93, metalness: 0.62, roughness: 0.45 });
    for (const sx of [-1, 1]) {
      const xP = cx + sx * (FACE_X + 0.06);   // 管心（半径 0.07 的那根正好有一线嵌进墙里，不留缝）
      const xC = cx + sx * (FACE_X + 0.035);  // 管卡（贴墙那一小段）
      for (const [py, pr] of [[2.30, 0.070], [2.52, 0.045]]) {
        const len = hz * 2 - 0.55;
        const run = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, len, 10), pipeMat);
        run.rotation.x = Math.PI / 2;         // 圆柱默认沿 Y，绕 X 转 90° 即沿 Z（船长方向）
        run.position.set(xP, py, cz);
        scene.add(run);
        pipeRunParts.push(run);
        const nF = Math.max(2, Math.round(len / 3.2));
        for (let i = 0; i < nF; i++) {
          const f = new THREE.Mesh(new THREE.CylinderGeometry(pr + 0.035, pr + 0.035, 0.055, 10), pipeMat);
          f.rotation.x = Math.PI / 2;
          f.position.set(xP, py, cz + (i / (nF - 1) - 0.5) * (len - 0.5));
          scene.add(f);
          pipeRunParts.push(f);
        }
        const nC = Math.max(3, Math.round(len / 1.9));
        for (let i = 0; i < nC; i++) {
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.05), pipeMat);
          c.position.set(xC, py - pr - 0.025, cz + (i / (nC - 1) - 0.5) * (len - 0.35));
          scene.add(c);
          pipeRunParts.push(c);
        }
      }
    }
  }

  // 一座「四面墙 + 南北贯通门洞 + 屋顶」的甲板室。
  // 墙做成一圈**环**：屋顶 collider 只在环上，中间那格是空的 —— 那正是可站立的室内地面。
  // （玩家站在屋里时头顶 4.6m 处有东西，但 y0 把它们放行了。）
  function addDeckHouse(cx, cz, hx, hz, topY, doorW) {
    // 小地图：整座甲板室画成一块实心（墙上门洞在 40×68 的图上读不出来）
    topdown.push({ x: cx, z: cz, hx, hz, kind: "house" });
    const T = 0.28;               // 墙厚
    const HALF_LEN = topY * 0.42; // 门洞高 ≈ 2.06m（4.9m 净高的 42%）
    // **侧墙与端墙各一份贴图**：侧墙大面是 topY × segD（这才是从甲板上看得见的主面）、
    // 端墙是 segW × (topY - HALF_LEN)，两者差近一倍。共用一个 repeat 会把端墙那
    // 2.4m 宽的外板压成 1.4m —— 就是甲板那条 25:1 拉伸的缩小版。
    const segW0 = (hx * 2 - doorW) / 2;
    const segD0 = (hz * 2 - SIDE_DOOR) / 2;
    const mLong = plateMat(segD0, topY, WALL_TINT);
    const mEnd = plateMat(segW0, topY - HALF_LEN, WALL_TINT);
    // 北墙 / 南墙：门洞两侧各一段
    for (const sz of [-1, 1]) {
      const segW = segW0;
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(segW, topY - HALF_LEN, T), mEnd);
        w.position.set(cx + sx * (doorW / 2 + segW / 2), HALF_LEN + (topY - HALF_LEN) / 2, cz + sz * hz);
        w.castShadow = true; w.receiveShadow = true;
        scene.add(w); obstacles.push(w);
        colliders.push({ x: w.position.x, z: w.position.z, hx: segW / 2, hz: T / 2, h: topY });
      }
      // 门楣（门洞上方那一段）
      const lin = new THREE.Mesh(new THREE.BoxGeometry(doorW, topY - HALF_LEN, T), mEnd);
      lin.position.set(cx, HALF_LEN + (topY - HALF_LEN) / 2, cz + sz * hz);
      lin.castShadow = true;
      scene.add(lin); obstacles.push(lin);
      // 门楣**不给碰撞**：它的竖直区间是 [2.06, 4.9]，而碰撞模型只会读 c.h ——
      // 给它一个 h=4.9 的盒子等于把 3.6m 宽的门洞重新堵死。
    }
    // 东西侧墙：各开一个窄门（贴地），同样只给「门洞两侧」的碰撞
    for (const sx of [-1, 1]) {
      const segD = segD0;
      for (const sz of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(T, topY, segD), mLong);
        w.position.set(cx + sx * hx, topY / 2, cz + sz * (SIDE_DOOR / 2 + segD / 2));
        w.castShadow = true; w.receiveShadow = true;
        scene.add(w); obstacles.push(w);
        colliders.push({ x: w.position.x, z: w.position.z, hx: T / 2, hz: segD / 2, h: topY });
      }
      const lin = new THREE.Mesh(new THREE.BoxGeometry(T, topY - SIDE_DOOR, SIDE_DOOR), mLong);
      lin.position.set(cx + sx * hx, SIDE_DOOR + (topY - SIDE_DOOR) / 2, cz);
      scene.add(lin); obstacles.push(lin);
    }
    addHouseDetail(cx, cz, hx, hz, topY, doorW, HALF_LEN);
    // 屋顶：视觉上是一整块甲板，**碰撞只留一圈环**，中间那格空着 = 室内能站人。
    // 环宽取 0.9m（够站稳、够狙击手趴边）；屋顶四角各留 0.9m 的边条。
    const roof = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.4, 0.3, hz * 2 + 0.4),
      deckSurface(hx * 2 + 0.4, hz * 2 + 0.4, ROOF_TINT, 0.12));
    roof.position.set(cx, topY - 0.15, cz);
    roof.castShadow = true; roof.receiveShadow = true;
    scene.add(roof); obstacles.push(roof);
    // **整块板**，不是一圈环。曾经做成「只有边上 0.95m 的环有碰撞」，好让屋里能站人 ——
    // 但 y0 已经把这件事解决得更干净了：板子的 y0 是 4.6，人站在屋里（脚底 0）时
    // blockedBy 判「4.6 ≥ 0+1.78 → 从底下过」、supportAt 判「4.6 > 0+0.5 → 踩不到」，
    // 两条都自动放行。留成环的话，人从屋顶往中间一走就**穿过看得见的屋面板掉进屋里**。
    colliders.push({ x: cx, z: cz, hx: hx + 0.2, hz: hz + 0.2, h: topY, y0: topY - 0.3 });
    // 屋顶四周 0.95m 高的栏杆：**不给碰撞**（给碰撞就是四面 4.9m 高的隐形墙，
    // 人会撞在屋顶中间走不到边上）。它只负责让屋顶边缘看得出来。
    for (const sz of [-1, 1]) {
      for (const y of [0.45, 0.9]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.4, 0.07, 0.07), trimMat);
        r.position.set(cx, topY + y, cz + sz * (hz + 0.2));
        scene.add(r);
      }
      for (let i = -hx; i <= hx; i += 1.6) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), trimMat);
        p.position.set(cx + i, topY + 0.475, cz + sz * (hz + 0.2));
        scene.add(p);
      }
    }
    for (const sx of [-1, 1]) {
      for (const y of [0.45, 0.9]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, hz * 2 + 0.4), trimMat);
        r.position.set(cx + sx * (hx + 0.2), topY + y, cz);
        scene.add(r);
      }
      for (let i = -hz; i <= hz; i += 1.6) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), trimMat);
        p.position.set(cx + sx * (hx + 0.2), topY + 0.475, cz + i);
        scene.add(p);
      }
    }
    return topY;
  }

  // ---- 左舷：长甲板室（12m × 4.8m，低而长）----
  // 净高 4.5m（≈两级集装箱 4.86m）：够高当地标与狙击位，又不至于让爬梯长得挤到货箱区去。
  // 梯子的 z 向投影 = stairRun(4.5) = 10 × 0.62 = 6.2m，所以梯脚必须落在
  // hz + 6.2 = 12.2 之外 —— 而 z=±15.2 那一排集装箱的南沿正好是 12.2，**严丝合缝**
  // （这就是 ROWS 里 ±6.2/±15.2 那两个值的来源，见「集装箱网格」一节的锁死链）。
  // x 取 ∓12.0（**不是最外列列心 11.6**）：甲板室内墙落在 9.6，与内列箱外缘（7.675）
  // 之间留 1.925m 的窄巷 —— 玩家（半径 0.45）有 1.0m 的通行窗，敌人（avoid 外扩 0.5）
  // 有 0.925m。取 11.6 时敌人只剩 0.385m 的窗口，那条巷子对 AI 等于不存在。
  const PORT_X = -12.0, PORT_HZ = 6, PORT_TOP = 4.5;
  addDeckHouse(PORT_X, 0, 2.4, PORT_HZ, PORT_TOP, 3.6);
  const P_RUN = stairRun(PORT_TOP);
  addStairs(PORT_X, PORT_HZ + P_RUN, -1, PORT_TOP, stairMat);   // 北梯：顶在屋顶北缘
  addStairs(PORT_X, -(PORT_HZ + P_RUN), 1, PORT_TOP, stairMat); // 南梯
  // 屋顶上的通风机组（纯视觉，兼作屋顶掩体）
  for (const z of [-3.4, 1.6]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.5), trimMat);
    v.position.set(PORT_X + 1.2, PORT_TOP + 0.55, z);
    v.castShadow = true;
    scene.add(v); obstacles.push(v);
    colliders.push({ x: PORT_X + 1.2, z, hx: 0.75, hz: 0.75, h: PORT_TOP + 1.1, y0: PORT_TOP });
  }

  // ---- 右舷：机舱棚（9m × 4.8m，屋顶上多一层小机房）----
  const STBD_X = 12.0, STBD_HZ = 4.5, STBD_TOP = 4.5;
  addDeckHouse(STBD_X, 0, 2.4, STBD_HZ, STBD_TOP, 3.2);
  const S_RUN = stairRun(STBD_TOP);
  addStairs(STBD_X, STBD_HZ + S_RUN, -1, STBD_TOP, stairMat);
  addStairs(STBD_X, -(STBD_HZ + S_RUN), 1, STBD_TOP, stairMat);
  // 四座梯子合批：约 4×36 = 144 个静态件 → 2 个（per 材质）。`onReplace` 把踏板从
  // `obstacles` 重指到合并产物上 —— 铁律②，漏了子弹就会继续命中一堆已被 scene.remove
  // 的旧盒（读的是陈旧矩阵，打中的点还是错的）。
  batchStatic(scene, stairParts, {
    castShadow: true, receiveShadow: true,
    onReplace: (olds, news) => {
      for (const o of olds) {
        const i = obstacles.indexOf(o);
        if (i >= 0) obstacles.splice(i, 1);
      }
      const t = news.find((m) => m.material === stairMat);
      if (t) obstacles.push(t);
    },
  });
  // 两座甲板室的舱壁管路合批（见 addHouseDetail ⑧）。**没有 onReplace** ——
  // 这批件一件都不在 `obstacles` 里（刻意不给碰撞），所以没有要重指的东西。
  batchStatic(scene, pipeRunParts, { castShadow: true, receiveShadow: true });
  const pent = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.3, 3.6), wallMat);
  pent.position.set(STBD_X, STBD_TOP + 1.15, 0);
  pent.castShadow = true; pent.receiveShadow = true;
  scene.add(pent); obstacles.push(pent);
  colliders.push({ x: STBD_X, z: 0, hx: 1.5, hz: 1.8, h: STBD_TOP + 2.3, y0: STBD_TOP });

  // Classic layout: side lookout roofs stay independent; the centre skyline is open.
  // No bridge meshes, colliders or minimap footprint remain.
  // The cargo gantry is background scenery beyond the north spawn apron.
  const craneGroup = new THREE.Group();
  // 格构把腿/梁从 4+3 个盒子撑成三百多个小件 —— 必须合批，否则「细节」直接变成 +300 次
  // 绘制调用。小车的 car/rope/hang 是动态的（update() 里横移），**绝不进这个数组**。
  // 声明在块外：合批调用落在块外（见下面 batchStatic 那处），`const` 进不去。
  const craneParts = [];
  const steelPart = (m) => { craneGroup.add(m); craneParts.push(m); return m; };
  {
    const LEG_X = DECK_W + 1.6, BEAM_Y = 15.5;
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a8874, roughness: 0.82, metalness: 0.35 });
    // 腿落在 x=±21.6 —— **在船体（外壁 x=±20.4~21.0）之外、水面之上**，所以每条腿下面
    // 得先有一块属于自己的舷外平台，否则四条腿就是悬空站在海面上。
    // 平台从 -2.6（没入水线 y=-2.4 以下）顶到 +0.2，与甲板齐平。
    for (const sx of [-1, 1]) {
      const spon = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.8, 13.0), trimMat);
      spon.position.set(sx * LEG_X, -1.2, 0);
      steelPart(spon);
      // 与船体相连的两根斜撑（不然平台像是贴在海上的孤岛）
      for (const dz of [-3.4, 3.4]) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.35), steel);
        st.position.set(sx * (LEG_X - 1.5), 1.1, dz);
        st.rotation.z = sx * -0.55;
        steelPart(st);
      }
    }
    // ---- 格构式塔腿（替换原来的 0.7×15.5×0.7 实心方柱）----
    // 实心柱在十来米外就是一根黄棒，「龙门吊」这条信息完全靠主梁与吊箱撑着。
    // 真实的集装箱起重机腿是四根角钢 + 之字形缀条，剪影里全是洞 —— 那才是它一眼可辨的原因。
    const CS = 0.30;                    // 角钢半间距（腿宽 0.60，与旧的 0.7 相当）
    const BAYS = 10, BAY = BEAM_Y / BAYS;
    const diagL = Math.hypot(CS * 2, BAY);
    const legAng = Math.atan2(BAY, CS * 2);
    for (const sx of [-1, 1]) {
      for (const dz of [-2.4, 2.4]) {
        const bx = sx * LEG_X;
        for (const ax of [-1, 1]) for (const az of [-1, 1]) {   // 四根角钢
          const ch = new THREE.Mesh(new THREE.BoxGeometry(0.13, BEAM_Y, 0.13), steel);
          ch.position.set(bx + ax * CS, BEAM_Y / 2, dz + az * CS);
          steelPart(ch);
        }
        for (let i = 0; i < BAYS; i++) {                        // 四个面上的之字缀条
          const y = (i + 0.5) * BAY;
          const s = i % 2 ? 1 : -1;
          for (const ax of [-1, 1]) {                           // 法线朝 ±x 的面：斜杆在 y-z 面内
            const d = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, diagL), steel);
            d.position.set(bx + ax * CS, y, dz);
            d.rotation.x = s * legAng;
            steelPart(d);
          }
          for (const az of [-1, 1]) {                           // 法线朝 ±z 的面：斜杆在 x-y 面内
            const d = new THREE.Mesh(new THREE.BoxGeometry(diagL, 0.07, 0.07), steel);
            d.position.set(bx, y, dz + az * CS);
            d.rotation.z = -s * legAng;
            steelPart(d);
          }
        }
      }
      // 同一侧两条腿之间的水平系杆（每侧一榀框架）—— 比旧版细一档，与格构匹配
      for (const y of [3.9, 7.75, 11.6, 15.5]) {
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 5.5), steel);
        br.position.set(sx * LEG_X, y, 0);
        steelPart(br);
      }
    }
    // ---- 主梁：箱型梁 → 格构桁架（上下弦 + 竖腹杆 + 斜腹杆）----
    // 跨度 2·LEG_X+2 = 45.2m，是全场最长的一条水平线；实心梁对着高对比的天空就是两条黄带。
    const SPAN = LEG_X * 2 + 2;
    const BN = 20, bw = SPAN / BN;
    const webL = Math.hypot(bw, 1.1), webAng = Math.atan2(1.1, bw);
    for (const dz of [-1.1, 1.1]) {
      for (const dy of [-0.55, 0.55]) {
        const chord = new THREE.Mesh(new THREE.BoxGeometry(SPAN, 0.30, 0.34), steel);
        chord.position.set(0, BEAM_Y + dy, dz);
        steelPart(chord);
      }
      for (let i = 0; i <= BN; i++) {
        const x = -SPAN / 2 + i * bw;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.09), steel);
        post.position.set(x, BEAM_Y, dz);
        steelPart(post);
        if (i < BN) {
          const d = new THREE.Mesh(new THREE.BoxGeometry(webL, 0.09, 0.09), steel);
          d.position.set(x + bw / 2, BEAM_Y, dz);
          d.rotation.z = (i % 2 ? 1 : -1) * webAng;
          steelPart(d);
        }
      }
    }
    const tie = new THREE.Mesh(new THREE.BoxGeometry(SPAN, 0.26, 3.0), steel);
    tie.position.set(0, BEAM_Y + 0.8, 0);
    steelPart(tie);
    // 小车 + 吊索 + 悬吊的集装箱（会缓慢横移、轻微摆动 —— 见 update()）
    // **吊箱底必须留在 8m 以上**：桥面在 4.9m、桥上桁架顶到 6.4m，吊箱低了会从桥里穿过去。
    const HANG_Y = 9.4; // 吊箱中心高度
    const trolley = new THREE.Group();
    const car = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 2.6), steel);
    car.position.y = BEAM_Y - 0.9;
    trolley.add(car);
    const ropeLen = BEAM_Y - 1.4 - (HANG_Y + CONT_H / 2);
    for (const dx of [-0.7, 0.7]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ropeLen, 6), trimMat);
      rope.position.set(dx, BEAM_Y - 1.4 - ropeLen / 2, 0);
      trolley.add(rope);
    }
    // 吊着的箱子用**真集装箱**（同一份 GLB），尺寸一致才有「重物」的体量感
    if (containerProto) {
      const hang = containerProto.clone(true);
      hang.scale.setScalar(CONT_SCALE);
      hang.rotation.y = CONT_YAW;
      hang.position.set(0, 0, 0);
      const hc = new THREE.Box3().setFromObject(hang).getCenter(new THREE.Vector3());
      hang.position.set(-hc.x, HANG_Y - hc.y, -hc.z);
      hang.traverse((o) => {
        if (o.isMesh) {
          // **必须是 false**：阴影贴图现在只烘一次（见 main.js 的静态阴影冻结），而这只箱子
          // 是全场**唯一**会动的投影体（小车在 update() 里 ±10m 横移）。留着 true 的话
          // 它的影子会被永久烙在烘图那一刻的 x 上，然后跟着箱体一起「漂」——很扎眼。
          // 反过来，全场其余投影体都是静止的，所以烘一次完全够用。
          o.castShadow = false;
          if (o.material) {
            o.material = o.material.clone();
            o.material.color = new THREE.Color(PAL.olive);
            o.material.metalness = 0.15;
            o.material.roughness = 0.85;
          }
        }
      });
      trolley.add(hang);
    }
    craneGroup.add(trolley);
    craneTrolley = trolley;
  }
  craneGroup.position.z = -(DECK_L + 9);
  scene.add(craneGroup);
  // 合批必须在 `scene.add(craneGroup)` **之后**：bake() 读的是 matrixWorld，而游离在
  // 场景外的子树永远不会被 `updateMatrixWorld` 写到（同楼梯那条注释）。
  // 这些件既不在 obstacles 也不在 colliders（腿在 x=±21.6，bounds.hw=19.35 之外，纯剪影），
  // 所以不需要 onReplace。
  batchStatic(scene, craneParts, { castShadow: true, receiveShadow: true });

  // ===== 甲板动态元素：烟囱排烟 + 海鸥 =====
  // 这两样不参与碰撞也不挡子弹，纯「活着」——静止的场景再细看也会发死，
  // 一有缓慢移动的烟和鸟，画面就立住了。
  // 烟：14 个 Sprite 循环使用（少而大，控制半透明 overdraw），一路向上飘 + 被风吹向 -x。
  const smokeTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0.0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.45, "rgba(244,246,248,0.42)");
    g.addColorStop(1.0, "rgba(238,242,246,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    // 加一点噪声，免得每团烟都是同一个完美圆
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * 0.16;
      const rr = 10 + Math.random() * 44;
      const an = Math.random() * Math.PI * 2;
      x.fillStyle = "rgba(255,255,255," + a.toFixed(3) + ")";
      x.beginPath();
      x.arc(64 + Math.cos(an) * rr * 0.6, 64 + Math.sin(an) * rr * 0.6, 6 + Math.random() * 14, 0, Math.PI * 2);
      x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const funnelSmoke = [];
  const SMOKE_LIFE = 11.0;   // 一团烟从烟囱口飘到散尽的秒数
  // 烟囱口的位置（与下面「船首上层建筑」里的 funnel 同一处：z = -(DECK_L+8)+1，顶在 y≈11.7）
  const FUNNEL_Z = -(DECK_L + 8) + 1;
  {
    const mat = new THREE.SpriteMaterial({
      map: smokeTex, transparent: true, opacity: 0.5, depthWrite: false,
      color: 0xc9d3da, fog: true,
    });
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.renderOrder = 9;
      scene.add(s);
      funnelSmoke.push({ s, t: (i / 14) * SMOKE_LIFE, ph: i * 0.9 });
    }
  }

  // 海鸥：两个薄片当翅膀，绕 z 扇动；每只沿自己的圆盘旋 + 上下起伏
  const gulls = [];
  {
    const gullMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide });
    const wingGeo = new THREE.BoxGeometry(1.05, 0.05, 0.26);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const L = new THREE.Mesh(wingGeo, gullMat);
      const R = new THREE.Mesh(wingGeo, gullMat);
      L.position.x = -0.55; R.position.x = 0.55;
      L.rotation.z = 0.35; R.rotation.z = -0.35;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.5), gullMat);
      g.add(L, R, body);
      // 翼展约 2.2m 的鸟（group 局部 +z 是飞行方向，与敌人骨架同一套朝向约定）
      g.scale.setScalar(1.5 + Math.random() * 0.8);
      scene.add(g);
      gulls.push({
        g, L, R,
        r: 34 + Math.random() * 62,
        a: Math.random() * Math.PI * 2,
        // 角速度 0.15~0.3 rad/s：60m 半径上合 9~18 m/s，是真实海鸥的巡航速度；
        // 再慢就成"飘着的纸片"，再快就成飞虫。
        w: (0.15 + Math.random() * 0.15) * (Math.random() < 0.5 ? -1 : 1),
        y: 17 + Math.random() * 22,
        flap: 3.6 + Math.random() * 2.4,
        ph: Math.random() * Math.PI * 2,
      });
    }
  }
  // 龙门吊吊装作业区的地面标线：**只画一圈黄框**，不铺满。
  // 铺满一整块黄黑斜纹在深色甲板上是灾难（远看像地上开了个洞）；
  // 而且这类贴地薄片**绝不能进 obstacles** —— 甲板本身不在阻挡列表里，
  // 只把这一块加进去会让「朝空地开枪」在这一段莫名其妙地打中东西。
  {
    const zoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8874, roughness: 0.82 });
    // HW 取 8.5：向内收进「内列箱外缘 7.675」与「甲板室内墙 9.2」之间那条 2.65m 的纵向巷，
    // 于是这圈线在全新的窄甲板上既不会长进集装箱、也不会被甲板室的地板盖住。
    const HW = 8.5, HD = 4.5, LW = 0.28;
    for (const [w, d, ox, oz] of [
      [HW * 2, LW, 0, HD], [HW * 2, LW, 0, -HD],
      [LW, HD * 2, HW, 0], [LW, HD * 2, -HW, 0],
    ]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), zoneMat);
      b.position.set(ox, 0.022, oz);
      scene.add(b);
    }
  }

  // ===== 船首上层建筑（舰桥 + 烟囱 + 桅杆，参考图远端的船楼轮廓）=====
  const superMat = new THREE.MeshStandardMaterial({ color: 0x878e96, roughness: 0.78, metalness: 0.06 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.35, roughness: 0.7 });
  const SZ = -(DECK_L + 8); // 与船首舰体块同一中心
  // 舰桥楼与船尾甲板室走**涂装钢板**（与两座甲板室同一份贴图，各按自己的主面尺寸定 repeat）
  const house = new THREE.Mesh(new THREE.BoxGeometry(16, 4.4, 9), plateMat(16, 4.4, 0x878e96));
  house.position.set(0, 5.2, SZ);
  house.castShadow = true;
  scene.add(house);
  // 舷窗带
  const winBand = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.9, 9.2), darkMat);
  winBand.position.set(0, 6.4, SZ);
  scene.add(winBand);
  // 舰桥窗的分隔竖框：**这一条才是「这是舰桥」的识别点**。一圈全黑的窗带看着像
  // 一条油漆带，切成 9 格之后立刻变成驾驶室的窗。只做朝甲板这一面（+z）。
  const BZ = SZ + 4.6;   // 窗带 +z 面（朝玩家）在 z = SZ + 4.6
  for (let i = 0; i < 9; i++) {
    const x = (i / 8 - 0.5) * 15.4;
    const mull = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.02, 0.14), superMat);
    mull.position.set(x, 6.4, BZ);
    scene.add(mull);
  }
  // 舰桥下面一排舷窗
  for (let i = 0; i < 5; i++) addPorthole((i / 4 - 0.5) * 11.0, 4.35, BZ + 0.05, "z");
  // 烟囱
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 4.0, 14), darkMat);
  funnel.position.set(0, 9.4, SZ + 1);
  scene.add(funnel);
  const funnelCap = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.4, 14), superMat);
  funnelCap.position.set(0, 11.5, SZ + 1);
  scene.add(funnelCap);
  // 桅杆 + 横桁
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 11, 8), superMat);
  mast.position.set(0, 12.5, SZ - 3);
  scene.add(mast);
  for (const [y, w] of [[15.5, 3.4], [13.2, 2.4]]) {
    const yard = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.16), superMat);
    yard.position.set(0, y, SZ - 3);
    scene.add(yard);
  }
  // 船尾低矮甲板室（在玩家出生点正后方，最近处只有 2.6m，所以也要有细节）
  const AFT_Z = DECK_L + 5;
  const aft = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 6), plateMat(12, 2.6, 0x878e96));
  aft.position.set(0, 3.7, AFT_Z);
  aft.castShadow = true;
  scene.add(aft);
  // 朝甲板这一面（−z）的门框 + 一排舷窗。**门从 y=3.0 起**（船尾盖顶面），
  // 屋子本身的下半截埋在盖里，门框若从 2.4 摆起会有一半陷进盖板。
  const AZ = AFT_Z - 3.0;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 0.06), darkMat);
  door.position.set(0, 3.75, AZ - 0.04);
  scene.add(door);
  for (const t of [-1, 1]) {
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.20, 1.66, 0.14), trimMat);
    j.position.set(t * 0.95, 3.75, AZ - 0.06);
    scene.add(j);
  }
  const ah = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.14), trimMat);
  ah.position.set(0, 4.66, AZ - 0.06);
  scene.add(ah);
  for (let i = 0; i < 4; i++) {
    const s = i < 2 ? -1 : 1;
    addPorthole(s * (2.7 + (i % 2) * 1.6), 3.75, AZ - 0.05, "z");
  }

  // ===== 救生艇（左舷走道上，参考图里那艘白底黄条的艇）=====
  const boatWhite = new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: 0.6, metalness: 0.1 });
  const boatBase = WALK_H;
  const lbHull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 5.6), boatWhite);
  lbHull.position.set(-(DECK_W - 1.0), boatBase + 0.5, 16);
  lbHull.castShadow = true;
  scene.add(lbHull);
  const lbCover = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.4, 5.6), boatWhite);
  lbCover.position.set(-(DECK_W - 1.0), boatBase + 1.2, 16);
  scene.add(lbCover);
  // 艇体本身要挡人：走道现在真的能走上去（0.4m 的台阶属于「迈上去」），不放碰撞
  // 就等于踩着一条 1.8m 高的艇穿过去。位置和尺寸照上面的 BoxGeometry/position 抄。
  colliders.push({ x: -(DECK_W - 1.0), z: 16, hx: 1.02, hz: 2.8, h: 1.8 });
  obstacles.push(lbHull, lbCover);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd8b23a, roughness: 0.7 });
  for (const dz of [-1.8, 0, 1.8]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.42, 0.55), stripeMat);
    band.position.set(-(DECK_W - 1.0), boatBase + 1.2, 16 + dz);
    scene.add(band);
  }

  // ===== 黄白条纹遮阳棚（右舷走道上方，参考图右侧那顶条纹天篷）=====
  const awningMat = new THREE.MeshStandardMaterial({
    map: stripeTexture(0xe9e4da, 0xd8b23a, 9),
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  // 棚宽 2.6m、x = DECK_W-0.6：整顶棚都在 1.6m 宽的舷侧走道正上方（走道 x ∈ [18.4, 20.0]，
  // 棚子 x ∈ [18.1, 20.7]），不会一侧长进甲板室里。长度随甲板缩到 12m。
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 12), awningMat);
  awning.position.set(DECK_W - 0.6, 3.1, 8);
  awning.castShadow = true;
  scene.add(awning);
  for (const z of [2, 8, 14]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.1, 8), superMat);
    post.position.set(DECK_W - 1.6, WALK_H + 1.55, z);
    scene.add(post);
    // 立柱落在走道内缘（x=18.4），挡人区间 [17.8,19.0]，走道还剩 [19.0,19.35] 能过 ——
    // 一整排柱子本来就该把人挤到外侧绕行，但不能把走道整条封死。
    colliders.push({ x: DECK_W - 1.6, z, hx: 0.15, hz: 0.15, h: 3.5 });
    obstacles.push(post);
  }

  // ===== 港口小道具 =====
  // 全部登记进 obstacles（挡子弹/挡视线）与 colliders（挡人）。以前这里是「纯视觉、
  // 不参与碰撞」，于是通风管/系缆桩/消防桶/信号灯柱全都能一脚穿过去 —— 正是
  // 「显示的障碍与实际障碍不符」的另一半。
  // 金属道具别调太亮：metalness 高 + 晴天天空反射会把它们照成近乎纯白，
  // 在深色甲板上像一块浮着的白板。压暗基色、抬高粗糙度。
  // metalness 必须压到接近 0：圆柱面会把整片天空镜面反射进来，
  // 0.38 就足以让系缆桩/通风管白成一根水泥柱。
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x5a6067, metalness: 0.06, roughness: 0.82 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x9e4535, roughness: 0.78 });
  // solid 传 { r, h } 时同时登记一个方形碰撞盒（r = 半宽，h = 顶面绝对高度）。
  // 碰撞体的竖直区间一律按 [0, h] 处理：地图上没有一件东西是从半空开始的。
  const slashProp = (geo, mat, x, y, z, solid = null) => {
    const mm = new THREE.Mesh(geo, mat);
    mm.position.set(x, y, z);
    mm.castShadow = true; mm.receiveShadow = true;
    scene.add(mm);
    obstacles.push(mm);
    if (solid) colliders.push({ x, z, hx: solid.r, hz: solid.r, h: solid.h });
    return mm;
  };
  // 舷边件必须贴到栏杆内侧（x = ±(DECK_W-0.4) = ±19.6）。
  // 抬高的舷侧走道只有 1.6m 宽（x∈[18.4,20.0]），玩家中心又被 bounds.hw 卡在 ≤19.35，
  // 系缆桩若放在走道中间（半径 0.3）会把走道口堵死 —— 那就等于把「一条空气墙」换成
  // 「一条真墙」。贴到栏杆后玩家自然地走甲板一侧绕过去。
  const EDGE_X = DECK_W - 0.4;
  // 系缆桩（舷边）。缩图后 z 从 ±32/±44 收到 ±30 —— 新甲板只有 ±34。
  for (const sx of [-1, 1]) for (const z of [-30, 30]) {
    slashProp(new THREE.CylinderGeometry(0.22, 0.3, 0.8, 10), steelMat, sx * EDGE_X, WALK_H + 0.4, z, { r: 0.3, h: 1.45 });
    slashProp(new THREE.CylinderGeometry(0.3, 0.38, 0.26, 10), darkMat, sx * EDGE_X, WALK_H + 0.92, z);
  }
  // 通风管（CF 甲板上的鹅颈通风筒：细而矮，别做成 2.4m 的大柱子）
  // 坐标必须落在**开阔处**：通风管半径 0.46，塞进 2.65m 的纵向巷会把它变成死胡同。
  // 前两根**跟着中央大道那两口绿皮箱走**：箱心在 x=∓3.85，所以通风管必须站到对面那半边
  // （x=±4.2）才不穿模 —— 绿箱把 x 压在 ±[2.575, 5.125]，原来写的 ∓4.2 正好整根埋进箱子里。
  // 后两根在舷边外带（|x| = 16.4 ∈ [14.0, 18.4]）。
  for (const [x, z] of [[4.2, 10.7], [-4.2, -10.7], [-16.4, 22.0], [16.4, -22.0]]) {
    slashProp(new THREE.CylinderGeometry(0.34, 0.42, 1.5, 12), steelMat, x, 0.75, z, { r: 0.46, h: 1.73 });
    slashProp(new THREE.CylinderGeometry(0.46, 0.46, 0.26, 12), darkMat, x, 1.6, z);
  }
  // 消防桶（靠近两座甲板室的爬梯，方便「梯子口必有消防器材」这个实感）
  // x=±13.8 在甲板室（外缘 14.0）之外、又在 z=±15.2 那排集装箱（x 从 12.875 起）之外。
  for (const [x, z] of [[-13.8, 13.6], [13.8, -13.6]]) {
    slashProp(new THREE.CylinderGeometry(0.3, 0.24, 0.7, 12), redMat, x, 0.35, z, { r: 0.3, h: 0.7 });
  }
  // 甲板舱盖：顶面才 0.345m，矮于一个台阶（STEP_H=0.5）→ 不挡人，是块可以踩上去的垫脚板
  for (const [x, z] of [[-3.5, 22.5], [3.5, -22.5]]) {
    slashProp(new THREE.BoxGeometry(1.6, 0.25, 1.6), darkMat, x, 0.13, z, { r: 0.8, h: 0.345 });
    slashProp(new THREE.BoxGeometry(1.4, 0.09, 1.4), steelMat, x, 0.3, z);
  }
  // 救生圈（挂舷）：**不给碰撞** —— 它是横在走道 1.55m 高处的环（外径 0.53），
  // 给它一个盒子等于用一面看不见的墙把 1.6m 宽的走道封了。
  for (const [x, z] of [[EDGE_X, -24], [-EDGE_X, 24]]) {
    const ri = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 10, 20), new THREE.MeshStandardMaterial({ color: 0xd83a2f, roughness: 0.8 }));
    ri.position.set(x, WALK_H + 1.15, z); ri.rotation.z = Math.PI / 2;
    scene.add(ri);
  }
  // 信号灯柱。z 必须避开 ±30 —— 系缆桩就在那两个 z 上，两边都贴到 EDGE_X 之后
  // 灯柱会和系缆桩重叠成一根（碰撞盒也会叠在一起）。移到 ∓21，正好卡在两根栏杆立柱中间。
  for (const [x, z] of [[EDGE_X, -21], [-EDGE_X, 21]]) {
    slashProp(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), darkMat, x, WALK_H + 1.3, z, { r: 0.12, h: 3.1 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xd8a92e, emissiveIntensity: 0.8 }));
    lamp.position.set(x, WALK_H + 2.7, z); scene.add(lamp);
  }
  // 甲板黄色警示线：沿**中央大道**两侧（|x| = 5.6，正好在内列箱的边线外）与
  // **舷边外带**（|x| = 17.2，甲板室外缘 14.0 与走道内缘 18.4 之间）画全长。
  // 这两条才是玩家真正会走的路，标线让"路"在地面上看得出来。
  // 长度取 DECK_L*2 - 6 = 62，两端各留 3m 不画到舷墙根。
  const stripMat = new THREE.MeshStandardMaterial({ color: 0xd8a92e, roughness: 0.6 });
  for (const sx of [-1, 1]) for (const x of [5.6, 17.2]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, DECK_L * 2 - 6), stripMat);
    strip.position.set(sx * x, 0.02, 0);
    scene.add(strip);
  }

  // ===== 远处背景：海面上的货轮 =====
  const shipProto = await loadModel("./models/ship.glb");
  if (shipProto) {
    const bg = [
      { x: -120, z: -160, s: 60, rot: 0.6 },
      { x: 150, z: 120, s: 80, rot: -2.4 },
      { x: 100, z: -200, s: 45, rot: 1.2 },
      { x: -170, z: 90, s: 55, rot: 2.0 },
    ];
    const shipMeshes = [];
    for (const b of bg) {
      const s = shipProto.clone(true);
      s.scale.setScalar(b.s);
      s.rotation.y = b.rot;
      s.position.set(b.x, -1.5, b.z);
      scene.add(s);
      s.traverse((o) => { if (o.isMesh) shipMeshes.push(o); });
    }
    // 4 份 × 94 个 primitive = **376 次绘制调用**（实测占整帧的四分之一，是全场景最大的一项），
    // 而它们只是天边的剪影：既不在 obstacles 也不在 colliders，也没人改它们的材质。
    // 按材质合批后 4 份船一起只剩 9 个 mesh。零耦合、零语义变化，所以这一步排在最前。
    if (!NO_BATCH) batchStatic(scene, shipMeshes);
  }

  // ===== 远景：海岸线与城市天际线 =====
  const landMat = new THREE.MeshStandardMaterial({ color: 0x7f8f6a, roughness: 1 });
  const cityMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b2, roughness: 0.95 });
  for (const spec of [
    { x: 520, z: -430, rot: 0.5, len: 620, depth: 90, heights: 14 },
    { x: -560, z: 300, rot: -0.9, len: 480, depth: 70, heights: 9 },
  ]) {
    const land = new THREE.Mesh(new THREE.BoxGeometry(spec.len, 16, spec.depth), landMat);
    land.position.set(spec.x, -6, spec.z);
    land.rotation.y = spec.rot;
    scene.add(land);

    const dirX = Math.cos(spec.rot), dirZ = -Math.sin(spec.rot);
    for (let i = 0; i < spec.heights; i++) {
      const off = (i / (spec.heights - 1) - 0.5) * spec.len * 0.72;
      const h = 18 + Math.random() * 60;
      const b = new THREE.Mesh(new THREE.BoxGeometry(14 + Math.random() * 22, h, 14 + Math.random() * 16), cityMat);
      b.position.set(
        spec.x + dirX * off + (Math.random() - 0.5) * 20,
        2 + h / 2,
        spec.z + dirZ * off + (Math.random() - 0.5) * 20
      );
      b.rotation.y = spec.rot;
      scene.add(b);
    }
  }

  return {
    colliders,
    obstacles,
    // 俯视布局（小地图底图的数据源）。**不从 colliders 反推**的理由见 `const topdown` 处。
    topdown,
    // 边界必须贴住可见的舷墙栏杆（两端在 z=±(DECK_L-0.2)=±33.8，两舷在 x=±19.8）。
    // 原来的 DECK_W-1.2 / DECK_L-1.2 比栏杆小了整 1m，
    // 于是船首船尾两端各有一道**看不见的墙**，玩家离栏杆还有一步就走不动了。
    // 现在 19.35 / 33.35 正好等于「玩家胶囊边缘（+PLAYER_RADIUS 0.45）贴到栏杆」。
    // **hl 还被 enemies.js 的刷出公式用作输入**（|z| ∈ [hl-10, hl-4]），改它等于改刷敌位置。
    bounds: { hw: DECK_W - 0.65, hl: DECK_L - 0.65 },
    update(t, dt) {
      this._n = (this._n || 0) + 1;
      // ---- 海浪：两条长涌（周期 100 / 160m）+ **解析法线** ----
      // 位移与它的偏导都是闭式的，所以法线直接算，不走 `computeVertexNormals()`
      // —— 那一趟在 128²=16641 个顶点上重算全部面法线再平均，是这块唯一的大开销，
      // 而结果与解析值只差浮点误差。局部坐标里平面在 XY、位移在 Z，所以
      // 曲面是 (x, y, f(x,y))，法线 = normalize(−f_x, −f_y, 1)。
      const A1 = 0.095, K1X = 0.055, K1Y = 0.021, W1 = 1.05;
      const A2 = 0.070, K2X = -0.031, K2Y = 0.044, W2 = 0.80;
      const nrm = waterGeo.attributes.normal;
      for (let i = 0; i < wpos.count; i++) {
        const [bx, by] = wbase[i];
        const p1 = bx * K1X + by * K1Y + t * W1;
        const p2 = bx * K2X + by * K2Y + t * W2;
        wpos.setZ(i, Math.sin(p1) * A1 + Math.sin(p2) * A2);
        const fx = Math.cos(p1) * A1 * K1X + Math.cos(p2) * A2 * K2X;
        const fy = Math.cos(p1) * A1 * K1Y + Math.cos(p2) * A2 * K2Y;
        const inv = 1 / Math.sqrt(fx * fx + fy * fy + 1);
        nrm.setXYZ(i, -fx * inv, -fy * inv, inv);
      }
      wpos.needsUpdate = true;
      nrm.needsUpdate = true;
      // 白沫 / 浪脊随波滚动，纯 offset 动画，零额外逐帧 CPU。
      // **三张图必须同速同向**：它们出自同一个高度场，错开的话白沫会跑到浪沟里。
      const wox = t * 0.010, woy = t * 0.006;
      wm.map.offset.set(wox, woy);
      wm.normalMap.offset.set(wox, woy);
      wm.roughnessMap.offset.set(wox, woy);
      // 船体泡沫沿船长缓缓漂（只滚平铺的那根轴）
      for (let i = 0; i < foamStrips.length; i++) {
        const f = foamStrips[i];
        f.tex.offset[f.axis] = (f.axis === "y" ? t : t * 0.6) * 0.008 + (i * 0.37);
      }
      // 龙门吊小车沿主梁缓慢往复（±10m，主梁净跨 ±20.6m），吊物挂着一丝摆
      if (craneTrolley) {
        craneTrolley.position.x = Math.sin(t * 0.11) * 10.0;
        craneTrolley.rotation.z = Math.sin(t * 0.47 + 1.1) * 0.014;
      }
      // 烟囱排烟：每团烟独立计时，飘完一圈回炉。sprite 的 scale 是**世界尺寸**的
      // （Sprite 不受父级缩放影响时按世界单位算），所以半径要写成"米"而不是比例。
      for (const p of funnelSmoke) {
        p.t += dt;
        if (p.t >= SMOKE_LIFE) p.t -= SMOKE_LIFE;
        const k = p.t / SMOKE_LIFE;
        // **烟团尺度要收着来**：原来飘 30m 横 + 30m 高、半径涨到 21m，14 个 sprite 叠起来
        // 在亮蓝天空上糊出一大块**去饱和的灰斑**（看着像天空脏了，不是烟）。晴天白昼的
        // 配色里这块脏灰很显眼。现在飘 9m 横 / 15m 高、半径封顶 ~9m，只在烟囱口留一缕。
        p.s.position.set(
          -k * 9 - Math.sin(t * 0.6 + p.ph) * 1.1,
          11.8 + k * 15,
          FUNNEL_Z + k * 10
        );
        const size = 2.6 + k * 8;
        p.s.scale.set(size, size, 1);
        // 前 12% 淡入、之后线性淡出 —— 两端都硬切会看到"烟团凭空出现/消失"
        p.s.material.opacity = Math.min(1, k / 0.12) * (1 - k) * (1 - k) * 0.34;
      }
      // 海鸥：沿自己的圆盘旋 + 上下起伏，朝向取速度方向（局部 +z 为前）
      for (const b of gulls) {
        b.a += b.w * dt;
        const ca = Math.cos(b.a), sa = Math.sin(b.a);
        b.g.position.set(ca * b.r, b.y + Math.sin(t * 0.7 + b.ph) * 1.6, sa * b.r);
        // 速度 = d/dt (r cos a, r sin a) · w = r·w·(-sin a, cos a)
        b.g.rotation.y = Math.atan2(-sa * b.w, ca * b.w);
        const f = Math.sin(t * b.flap + b.ph) * 0.6;
        b.L.rotation.z = 0.35 + f;
        b.R.rotation.z = -0.35 - f;
      }
    },
  };
}
