// ===== 程序化 PBR 材质工具集（高度场 → albedo / normal / roughness 三件套）=====
//
// 这套管线原本长在 `scripts/viewarms.js` 里（第一人称手套的织纹、皮革粒面、袖布折痕），
// 现在提出来给全项目共用 —— **不要另写第二套**。它解决的问题是「一张 canvas 出三张图、
// 三张图天然对齐」：法线由同一张高度场按 Sobel 求出来，粗糙度由同一个下标算出来，
// 所以织孔的凸起、积灰的暗、磨光处的亮永远落在同一处，不会各画各的。
//
// **性能**：逐像素调 `fn` 很贵（1024² = 105 万次），所以按下面这条选场函数：
//   · `sepField` —— 结构只由 u 或只由 v 决定（经纬织纹、条纹）→ O(S)，首选
//   · `lowField` —— 低频噪声（锈迹、污渍、大块明暗）→ 1/div² 次，放大不丢信息
//   · `field`    —— 只有真正需要逐像素精度的（1mm 级的织孔、粒面）才走它
// 全部在加载期一次性生成，不进主循环。
//
// 所有场都是**可平铺**的（noise 按格点数环绕取模），因为大面积表面（甲板、船体）
// 的 UV 会跨好几格，有接缝会直接穿帮。
import * as THREE from "three";

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** 确定性整数哈希 → [0,1)。贴图必须每次加载长得一模一样，否则「这张皮子好不好看」
 *  就变成一次抽奖，改一处代码前后也没法用截图对比。Math.random() 做不到这一点。 */
export function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 可平铺的值噪声。`per` / `perY` 是**格点数**（整数），环绕取模，所以左右上下都接得上。
 *  perY 单独给，是为了让一个场能沿某个方向拉长（袖子的纵向褶皱正是这么来的）而仍然可平铺。 */
export function vnoise(x, y, per, seed, perY) {
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
export function fbm(u, v, base, oct, seed, gain) {
  let amp = 1, sum = 0, norm = 0, cells = base;
  const g = gain || 0.5;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(u * cells, v * cells, cells, seed + i * 17);
    norm += amp; amp *= g; cells *= 2;
  }
  return sum / norm;
}

/** 逐像素算一张单通道场。**逐像素调 fn 很贵**（512² = 26 万次），所以只有真正需要
 *  逐像素精度的结构（织孔、粒面）才走它，低频一律走 lowField。 */
export function field(S, fn) {
  const out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) out[y * S + x] = fn((x + 0.5) / S, (y + 0.5) / S);
  }
  return out;
}

/** 低频场：在 1/div 的分辨率上算完再双线性放大（环绕）。省 div² 倍算力 ——
 *  低频本来就没有逐像素的信息，放大不会丢东西。div=4 时误差在 1/512 像素尺度上不可见。 */
export function lowField(S, fn, div) {
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
 *  把 O(S²) 降到 O(S)。512² 的平织如果按逐像素算，光这一个场就是 26 万次三角函数。
 *
 *  **`fu(t, out, off)` 必须写 `out[off]` 与 `out[off+1]` 两个分量**（不是写 `out[0]`）——
 *  A/B 是 `2*S` 长的交错存储。第一版把回调写成 `A[0] = ...; A[1] = ...`，而拼合时读的是
 *  `A[x]`（沿 x 下标走），于是 x ≥ 2 一律读到 0，而本该是「纵向分量」的那个参数
 *  拿到的是**像素下标 x 本身**（0~511）—— `0.12 * max(gu, x)` 直接把袖布推成纯白。
 *  症状极具误导性：只有袖子一张贴图炸掉、另外三张正常，看着像配色写错了。 */
export function sepField(S, fu, fv, comb) {
  const A = new Float32Array(2 * S), B = new Float32Array(2 * S);
  for (let i = 0; i < S; i++) { const t = (i + 0.5) / S; fu(t, A, i * 2); fv(t, B, i * 2); }
  const out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = x * 2, b = y * 2;
    out[y * S + x] = comb(A[a], A[a + 1], B[b], B[b + 1]);
  }
  return out;
}

export function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

/** 高度场 → 切线空间法线贴图（Sobel，取样同样环绕）。`strength` 就是「起伏有多陡」。
 *  `H` 不给就按正方形处理；集装箱那类**非方**贴图必须显式给，否则行距按 W 算会整体错位。 */
export function normalFromHeight(h, S, strength, H) {
  const R = H || S;
  const cv = makeCanvas(S);
  cv.height = R;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(S, R);
  const d = img.data;
  const at = (x, y) => h[(((y % R) + R) % R) * S + (((x % S) + S) % S)];
  // 非方贴图：u 方向一格代表的世界距离是 v 方向的 S/R 倍，Sobel 得按宽高比补回来，
  // 否则集装箱那张 256×128 的瓦楞法线只有纵向坡度的一半，凸起看着像被压扁过。
  const su = R === S ? 1 : S / R;
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength * su;
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

/** 线性 → sRGB 传输。源色一律**先在 sRGB 空间按美术直觉定 hex**，再转成线性做运算、
 *  最后转回来 —— 直接在线性空间里乘系数会让暗部的变化看起来比亮的快得多。 */
const SRGB_LUT = new Float32Array(1025);
for (let i = 0; i <= 1024; i++) {
  const c = i / 1024;
  SRGB_LUT[i] = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
export const lin2srgb = (c) => SRGB_LUT[Math.round(clamp01(c) * 1024)];

/** hex → **线性** rgb 三元组。写进 `albedo` 回调的就是这个线性值。 */
export function hexLin(hex) {
  return [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255].map((v) => {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
}

/** 反照率贴图是颜色贴图 → **必须显式标 SRGBColorSpace**；法线/粗糙度是数据贴图 →
 *  **必须保持 NoColorSpace**。CanvasTexture 默认就是 NoColorSpace，所以漏标的后果
 *  是颜色被当线性数据读进来、整体发白（AGENTS.md 记过同一坑，出现在集装箱上）。 */
export function texFrom(cv, srgb) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/**
 * 由一张高度场 + 两个回调生成 `{ map, normalMap, roughnessMap, normalScale }`。
 * `albedo(i, o)` 把**线性** rgb 写进 `o`（长度 3）；`rough(i)` 给 [0,1] 的粗糙度。
 * 三张图共用一个下标，所以天然对齐。
 *
 * 注意 three 里 `roughnessMap` 是**乘**在 `material.roughness` 上的 —— 用它的材质
 * 必须把 `roughness` 设成 1.0（或让这张图接近纯白），否则等于暗地里又打了一折。
 */
export function buildMaps(S, h, normalStrength, normalScale, albedo, rough) {
  return buildMapsRect(S, S, h, normalStrength, normalScale, albedo, rough);
}

/**
 * `buildMaps` 的非方形版：W × H 非等比。
 * **法线的 Sobel 必须按 W/H 分别求步长**，否则 u 方向的一格与 v 方向的一格被当成
 * 同样的世界距离 —— 集装箱那张 256×128 的贴图会得到「横向坡度只有纵向一半」的法线，
 * 瓦楞的凸起看着像被压扁过。
 */
export function buildMapsRect(W, H, h, normalStrength, normalScale, albedo, rough) {
  const cv = makeCanvas(W);
  cv.height = H;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(W, H);
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
  const rc = makeCanvas(W);
  rc.height = H;
  const rctx = rc.getContext("2d");
  const rimg = rctx.createImageData(W, H);
  const rd = rimg.data;
  for (let i = 0; i < h.length; i++) {
    const v = clamp01(rough(i)) * 255;
    rd[i * 4] = v; rd[i * 4 + 1] = v; rd[i * 4 + 2] = v; rd[i * 4 + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);

  return {
    map: texFrom(cv, true),
    normalMap: texFrom(normalFromHeight(h, W, normalStrength, H), false),
    roughnessMap: texFrom(rc, false),
    normalScale: new THREE.Vector2(normalScale, normalScale),
  };
}
