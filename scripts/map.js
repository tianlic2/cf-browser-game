// ===== 运输船地图（CrossFire 风格集装箱货轮战场）=====
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

// 统一配色（对齐 assets/image.png：炭灰钢甲板 + 军绿集装箱 + 米黄木箱 + 灰白钢质上层建筑）
const PAL = {
  // 甲板被半球光的冷蓝天空色照亮，出图会偏蓝（实测 #47586C）；底色故意偏暖一点抵消回来。
  deck: 0x6d6a5e,
  olive: 0x3d5634,  // 军绿
  dgreen: 0x2f5230, // 深绿（参考图里占多数）
  gray: 0x7f868c,   // 浅灰
  grayblue: 0x5f6b78,
  khaki: 0x8f8560,  // 浅卡其
  lwood: 0xcdb488,  // 浅原木（米黄木箱）——参考图里木箱是最亮的元素，别压暗
  rail: 0x7d848c,
};

// ---------- 程序化材质纹理（钢甲板 / 锈 / 集装箱漆 / 条纹）----------
// 舰船钢甲板：偏冷的炭灰防滑钢板。参考图里甲板是哑光深灰而非刷白，
// 所以底色定在 #7d838a，再靠材质色相乘落到中性钢灰。
function steelDeckTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#7d838a";
  x.fillRect(0, 0, 512, 512);
  // 钢板分块
  for (let i = 0; i <= 512; i += 128) {
    x.strokeStyle = "#666c73";
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, 512);
    x.moveTo(0, i);
    x.lineTo(512, i);
    x.stroke();
  }
  // 防滑菱形纹
  x.strokeStyle = "rgba(0,0,0,0.11)";
  x.lineWidth = 1.6;
  for (let i = -512; i < 512; i += 16) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 512, 512);
    x.stroke();
  }
  // 漆面磨损 / 锈迹
  for (let i = 0; i < 2600; i++) {
    const px = Math.random() * 512, py = Math.random() * 512;
    const v = Math.random();
    x.fillStyle = v > 0.93 ? "rgba(120,70,30,0.45)" : v > 0.6 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.14)";
    x.fillRect(px, py, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // BoxGeometry 的每个面 UV 都是 0..1，所以 repeat 的比值必须**跟着甲板的长宽比**走，
  // 否则钢板的纹理会一边拉长一边压扁。甲板 40×68（≈1:1.7）→ 7×12 给出 5.7m 的方砖。
  t.repeat.set(7, 12);
  return t;
}

// 晴空：等距柱状投影贴图（天顶深蓝 → 地平线浅青白）+ 柔和云团。
// equirect 的 v=0 是天顶、v=0.5 是地平线，所以渐变的分界要落在 0.5。
function skyTexture() {
  const w = 2048, h = 1024;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, "#1a5aa6");
  g.addColorStop(0.30, "#4c9dd6");
  g.addColorStop(0.45, "#9ed0e8");
  g.addColorStop(0.50, "#dceef6"); // 地平线海雾
  g.addColorStop(0.54, "#8fc0cf");
  g.addColorStop(1.00, "#2f7d99"); // 地平线以下（大部分被海面挡住）
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);

  // 云：越靠近地平线越淡，避免出现硬边
  for (let i = 0; i < 110; i++) {
    const cx = Math.random() * w;
    const cy = Math.random() * h * 0.47;
    const r = 40 + Math.random() * 170;
    const a = (0.05 + Math.random() * 0.22) * (1 - cy / (h * 0.52));
    if (a <= 0.01) continue;
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, "rgba(255,255,255," + a.toFixed(3) + ")");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = rg;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }

  // 太阳：位置必须**与场景里那盏 DirectionalLight 的方向一致**，否则阴影方向会和
  // 天上的光源对不上（一眼假）。three 的 equirect 映射是
  //   u = atan2(dir.z, dir.x)/2π + 0.5，v = asin(dir.y)/π + 0.5，画布 y = (1-v)·h。
  // 光在 (-34, 78, 30) → 单位向量 (-0.377, 0.865, 0.333) → u=0.885、v=0.833
  // → 画布 (1813, 171)。改灯的坐标就得同步改这两个数。
  const sx = 1813, sy = 171;
  const halo = x.createRadialGradient(sx, sy, 0, sx, sy, 300);
  halo.addColorStop(0.00, "rgba(255,252,238,0.95)");
  halo.addColorStop(0.06, "rgba(255,248,220,0.55)");
  halo.addColorStop(0.30, "rgba(255,246,214,0.14)");
  halo.addColorStop(1.00, "rgba(255,246,214,0)");
  x.fillStyle = halo;
  x.beginPath();
  x.arc(sx, sy, 300, 0, Math.PI * 2);
  x.fill();
  const disc = x.createRadialGradient(sx, sy, 0, sx, sy, 30);
  disc.addColorStop(0, "rgba(255,255,252,1)");
  disc.addColorStop(0.62, "rgba(255,252,236,0.95)");
  disc.addColorStop(1, "rgba(255,246,214,0)");
  x.fillStyle = disc;
  x.beginPath();
  x.arc(sx, sy, 30, 0, Math.PI * 2);
  x.fill();

  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 海面贴图：大尺度涌浪明暗 + 细密白浪泡沫，滚动 offset 就能动起来
function waterTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff";
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const px = Math.random() * 512, py = Math.random() * 512;
    const r = 40 + Math.random() * 130;
    const dark = Math.random() > 0.5;
    const rg = x.createRadialGradient(px, py, 0, px, py, r);
    rg.addColorStop(0, dark ? "rgba(105,160,182,0.38)" : "rgba(226,250,255,0.32)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = rg;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  }
  // 白浪泡沫
  for (let i = 0; i < 3000; i++) {
    const px = Math.random() * 512, py = Math.random() * 512;
    const len = 3 + Math.random() * 15;
    const a = Math.random() * Math.PI;
    x.strokeStyle = "rgba(255,255,255," + (0.22 + Math.random() * 0.58).toFixed(2) + ")";
    x.lineWidth = 0.8 + Math.random() * 2.4;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  return t;
}

function hullTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#8e3a2c";
  x.fillRect(0, 0, 512, 256);
  // 锈迹流痕
  for (let i = 0; i < 120; i++) {
    const px = Math.random() * 512, len = 40 + Math.random() * 160;
    x.fillStyle = "rgba(40,20,10," + (0.1 + Math.random() * 0.3) + ")";
    x.fillRect(px, 0, 3 + Math.random() * 5, len);
  }
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = "rgba(0,0,0,0.1)";
    x.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}

// 集装箱表面贴图：波状瓦楞、端门 X 折线、角件、锈蚀，提升真实感
function containerFaceTexture(baseHex) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#" + baseHex.toString(16).padStart(6, "0");
  x.fillRect(0, 0, 256, 128);
  // 波状瓦楞同一性纹理
  for (let px = 0; px < 256; px += 8) {
    x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(px, 0, 4, 128);
    x.fillStyle = "rgba(255,255,255,0.10)"; x.fillRect(px + 4, 0, 2, 128);
  }
  // 上下横梁
  x.fillStyle = "rgba(18,22,28,0.55)";
  x.fillRect(0, 0, 256, 12); x.fillRect(0, 116, 256, 12);
  // 四角角件
  x.fillStyle = "rgba(18,20,24,0.75)";
  [[4, 4], [196, 4], [4, 104], [196, 104]].forEach(([px, py]) => x.fillRect(px, py, 56, 20));
  // 端门 X 折线
  x.strokeStyle = "rgba(10,12,14,0.55)";
  x.lineWidth = 5;
  x.beginPath();
  x.moveTo(72, 14); x.lineTo(128, 114);
  x.moveTo(128, 14); x.lineTo(72, 114);
  x.stroke();
  x.lineWidth = 3;
  x.strokeStyle = "rgba(255,255,255,0.20)";
  x.beginPath();
  x.moveTo(78, 14); x.lineTo(134, 114);
  x.moveTo(134, 14); x.lineTo(78, 114);
  x.stroke();
  // 锈蚀
  for (let i = 0; i < 1000; i++) {
    x.fillStyle = "rgba(110,60,20," + (0.07 + Math.random() * 0.22) + ")";
    x.fillRect(Math.random() * 256, Math.random() * 128, 3 + Math.random() * 7, 1 + Math.random() * 5);
  }
  const t = new THREE.CanvasTexture(c);
  // 贴图里烘的就是最终颜色，必须按 sRGB 解读；否则 Canvas 的 sRGB 字节会被当成线性值，
  // 再经输出转换亮一整档 —— 深绿箱会褪成灰白绿。
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 木箱表面：浅灰底 + 板缝 + 木纹（留白底，颜色交给材质 color 相乘去染）
function woodTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#e2e2e2";
  x.fillRect(0, 0, 128, 128);
  // 板缝：横竖各两条，做出「钉起来的木板箱」的感觉
  x.strokeStyle = "rgba(0,0,0,0.30)";
  x.lineWidth = 3;
  for (const p of [32, 64, 96]) {
    x.beginPath(); x.moveTo(0, p); x.lineTo(128, p); x.stroke();
    x.beginPath(); x.moveTo(p, 0); x.lineTo(p, 128); x.stroke();
  }
  // 木纹
  for (let i = 0; i < 320; i++) {
    const py = Math.random() * 128;
    x.strokeStyle = "rgba(90,60,25," + (0.05 + Math.random() * 0.16).toFixed(2) + ")";
    x.lineWidth = 0.6 + Math.random();
    x.beginPath();
    x.moveTo(Math.random() * 40, py);
    x.lineTo(60 + Math.random() * 68, py + (Math.random() - 0.5) * 5);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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

  // ===== 天空（晴天白昼）=====
  // 同一张贴图既做背景也做环境反射：省掉 RoomEnvironment（那是室内房间环境，
  // 在明亮天空下会让金属发脏），也少一个 CDN 依赖。
  const sky = skyTexture();
  scene.background = sky;
  scene.environment = sky;
  // 雾别太浓：船只有 68m 长，稍浓一点就会把船头那端的集装箱糊成一片白。
  scene.fog = new THREE.FogExp2(0xc4dcea, 0.0021);

  // ===== 海面 =====
  const waterGeo = new THREE.PlaneGeometry(2000, 2000, 72, 72);
  const waterMap = waterTexture();
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterMap,
    color: 0x1f6f9c,
    roughness: 0.34,
    metalness: 0.18,
    transparent: true,
    opacity: 0.97,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -2.4;
  scene.add(water);
  const wpos = waterGeo.attributes.position;
  const wbase = [];
  for (let i = 0; i < wpos.count; i++) wbase.push([wpos.getX(i), wpos.getY(i)]);

  // ===== 钢甲板 =====
  const deckTex = steelDeckTexture(); // 甲板 / 舷侧走道 / 舰体顶盖共用一张，省一次 canvas
  // metalness 必须≈0：甲板法线朝上，0.22 的金属度会把整片晴空环境反射糊在上面，
  // 深色甲板直接被照成浅蓝灰（实测比预期亮了一整档）。
  const deckMat = new THREE.MeshStandardMaterial({
    map: deckTex,
    color: PAL.deck,
    roughness: 0.93,
    metalness: 0.04,
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(DECK_W * 2, 0.6, DECK_L * 2), deckMat);
  deck.position.y = -0.3;
  deck.receiveShadow = true;
  scene.add(deck);

  // ===== 船体（红色舷侧 + 船首/船尾舰体块）=====
  const hullMat = new THREE.MeshStandardMaterial({ map: hullTexture(), color: 0xb8a396, roughness: 0.95 });
  for (const sx of [-1, 1]) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, DECK_L * 2), hullMat);
    hull.position.set(sx * (DECK_W + 0.4), -1.7, 0);
    scene.add(hull);
  }
  // 船首（-z，敌方一侧）与船尾（+z，我方一侧）的舰体：延伸出甲板之外，
  // 上面承载上层建筑，甲板本身保持净空（敌方 AI 在 -z 端刷出，不能被挡住）。
  const bowStern = [
    { z: -(DECK_L + 8), d: 16 }, // 船首
    { z: DECK_L + 5, d: 10 },    // 船尾
  ];
  for (const e of bowStern) {
    const blk = new THREE.Mesh(new THREE.BoxGeometry(DECK_W * 2 + 2, 6.2, e.d), hullMat);
    blk.position.set(0, -0.3, e.z);
    scene.add(blk);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(DECK_W * 2 + 2, 0.5, e.d), deckMat);
    cap.position.set(0, 2.75, e.z);
    scene.add(cap);
  }
  // ===== 舷侧走道（参考图最醒目的特征：两舷各一条抬高的钢板走道 + 栏杆）=====
  const sideMat = new THREE.MeshStandardMaterial({ map: deckTex, color: 0x9aa1a8, roughness: 0.85, metalness: 0.3 });
  const WALK_H = 0.4;
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.6, WALK_H, DECK_L * 2), sideMat);
    w.position.set(sx * (DECK_W - 0.8), WALK_H / 2, 0);
    w.castShadow = true;
    w.receiveShadow = true;
    scene.add(w);
    colliders.push({ x: sx * (DECK_W - 0.8), z: 0, hx: 0.8, hz: DECK_L, h: WALK_H });
    obstacles.push(w);
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
  //   · 两端两排（r0/r3）整排 2 层 —— 那是**前沿墙**，把两条出生区隔开，
  //     也是全图仅有的天际线起伏（中央大道两侧仍是齐平的 1 层，留出对枪线）。
  const STACK = [
    [2, 2, 2, 2], // z = -15.2  敌方前沿
    [0, 1, 1, 0], // z =  -6.2  外列让位给甲板室与爬梯
    [0, 1, 1, 0], // z =   6.2  同上
    [2, 2, 2, 2], // z =  15.2  我方前沿
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
          n >= 3 ? PAL.gray : PICK[(r * 3 + c * 5 + L * 2) % PICK.length]
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
  containers.push({ x: -3.85, z: 10.7, rot: SHORT, stack: 1, colors: [PAL.dgreen] });
  containers.push({ x: 3.85, z: -10.7, rot: SHORT, stack: 1, colors: [PAL.dgreen] });

  const faceCache = new Map(); // 同色集装箱共用一张瓦楞贴图（全局缓存，颜色只有 6 种）
  for (const spec of containers) {
    if (!containerProto) break;
    const total = spec.stack;
    for (let L = 0; L < total; L++) {
      const clone = containerProto.clone(true);
      clone.scale.setScalar(CONT_SCALE);
      clone.rotation.y = spec.rot + CONT_YAW;
      // 摆位前先量一次自己的包围盒：GLB 的几何中心不在原点（实测偏在本地 z≈+0.69、
      // y≈+0.06），直接 position.set(spec.x, CONT_H/2, spec.z) 会让整箱偏出碰撞盒 1.31m
      // —— 模型和碰撞盒各站各的，就是玩家摸到的「空气墙」。
      clone.position.set(0, 0, 0);
      const cc = new THREE.Box3().setFromObject(clone).getCenter(new THREE.Vector3());
      clone.position.set(spec.x - cc.x, CONT_H / 2 + L * CONT_H - cc.y, spec.z - cc.z);
      const col = spec.colors[L];
      if (!faceCache.has(col)) faceCache.set(col, containerFaceTexture(col));
      const faceTex = faceCache.get(col);
      clone.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.material) {
            o.material = o.material.clone();
            // 颜色已经烘进 containerFaceTexture，材质色必须留白 —— 两边都上色等于色值平方，
            // 深绿箱会直接黑成一块（实测 #2f5230 平方后只剩 #091a09）。
            o.material.color = new THREE.Color(0xffffff);
            o.material.map = faceTex;
            o.material.metalness = 0.12;
            o.material.roughness = 0.85;
            o.material.needsUpdate = true;
          }
        }
      });
      scene.add(clone);
      // **每一层都要进 obstacles**。以前只有 L===0 那一层进去，于是 2/3 层叠箱的上面两层
      // 是不挡子弹的 —— 对着三层塔的正脸开枪，弹道会从第二层穿过去打中后面的东西，
      // 属于「看到的掩体和实际掩体不符」。obstacles 只在开火/敌人开火/闪光判定时被射线扫一次，
      // 不是逐帧开销，多这几百个 mesh 不心疼。
      obstacles.push(clone);
      if (L === 0) {
        const rot = spec.rot;
        const lx = Math.abs(CONT_L / 2 * Math.cos(rot)) + Math.abs(CONT_T / 2 * Math.sin(rot));
        const lz = Math.abs(CONT_L / 2 * Math.sin(rot)) + Math.abs(CONT_T / 2 * Math.cos(rot));
        colliders.push({ x: spec.x, z: spec.z, hx: lx, hz: lz, h: CONT_H * total });
      }
    }
  }

  // ===== 木箱堆（参考图里的米黄木箱，CF 中主要的可穿透掩体/垫脚箱）=====
  const crateMats = new Map();
  const crateTex = woodTexture();
  function crateMat(hex) {
    if (!crateMats.has(hex)) {
      crateMats.set(hex, new THREE.MeshStandardMaterial({ map: crateTex, color: hex, roughness: 0.95, metalness: 0.03 }));
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
          m.material = m.material.clone();
          // **两种桶都要处理**，不能只管油桶：`barrel.glb`（木桶）原来的材质也是高金属度，
          // 而 `scene.environment` 是那张亮蓝天贴图 —— 金属度高的表面基本不吃反照率、
          // 只反天空，于是木桶在甲板上是**惨白薄荷绿**（跟深绿集装箱、米黄木箱放一起
          // 像塑料垃圾桶）。压金属度 + 提粗糙度之后才回得来本色。
          m.material.metalness = 0.15;
          m.material.roughness = 0.68;
          // 油桶 GLB 自带高饱和红/蓝漆带，跟军事配色打架；乘一层灰绿把饱和度压下去。
          // 木桶保留自己的木色，只压金属度（见上）。
          if (p.oil) m.material.color = new THREE.Color(0x5f6753);
        }
      }
    });
    scene.add(o);
    const h = bb.max.y - bb.min.y;
    if (h > 0.06) {
      // 碰撞盒按实际包围盒推，别再写死 1.0：缩放改了以后碰撞会跟模型对不上
      const hx = Math.max(0.28, (bb.max.x - bb.min.x) / 2);
      const hz = Math.max(0.28, (bb.max.z - bb.min.z) / 2);
      colliders.push({ x: p.x, z: p.z, hx, hz, h: Math.min(h, 1.2) });
      obstacles.push(o);
    }
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
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.82, metalness: 0.12 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x6d757c, roughness: 0.7, metalness: 0.3 });
  const roofDeck = new THREE.MeshStandardMaterial({ map: deckTex, color: 0x8e959b, roughness: 0.88, metalness: 0.12 });

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
  const stairSteps = (topY) => Math.max(2, Math.round(topY / RISER_WANT));
  // 梯子的水平投影长度（调用方要用它算梯脚位置，好让梯顶正好落在屋顶边缘）
  const stairRun = (topY) => stairSteps(topY) * TREAD;
  function addStairs(cx, zBottom, dir, topY, mat) {
    const n = stairSteps(topY);
    const rise = topY / n;
    let z = zBottom;
    for (let i = 0; i < n; i++) {
      const h = rise * (i + 1);
      const zc = z + dir * TREAD / 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(STAIR_W, h, TREAD), mat);
      m.position.set(cx, h / 2, zc);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m); obstacles.push(m);
      colliders.push({ x: cx, z: zc, hx: STAIR_W / 2, hz: TREAD / 2, h });
      z += dir * TREAD;
    }
    // 两侧的斜扶手（纯视觉，不给碰撞 —— 给了就是两道 4.9m 高的墙把梯子封死）
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, n * TREAD * 1.02), trimMat);
      rail.position.set(cx + sx * STAIR_W / 2, topY / 2 + 1.0, zBottom + dir * n * TREAD / 2);
      rail.rotation.x = -dir * Math.atan2(topY, n * TREAD);
      scene.add(rail);
    }
    return { zTop: zBottom + dir * n * TREAD };
  }

  // 一座「四面墙 + 南北贯通门洞 + 屋顶」的甲板室。
  // 墙做成一圈**环**：屋顶 collider 只在环上，中间那格是空的 —— 那正是可站立的室内地面。
  // （玩家站在屋里时头顶 4.6m 处有东西，但 y0 把它们放行了。）
  function addDeckHouse(cx, cz, hx, hz, topY, doorW) {
    const T = 0.28;               // 墙厚
    const HALF_LEN = topY * 0.42; // 门洞高 ≈ 2.06m（4.9m 净高的 42%）
    // 北墙 / 南墙：门洞两侧各一段
    for (const sz of [-1, 1]) {
      const segW = (hx * 2 - doorW) / 2;
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(segW, topY - HALF_LEN, T), wallMat);
        w.position.set(cx + sx * (doorW / 2 + segW / 2), HALF_LEN + (topY - HALF_LEN) / 2, cz + sz * hz);
        w.castShadow = true; w.receiveShadow = true;
        scene.add(w); obstacles.push(w);
        colliders.push({ x: w.position.x, z: w.position.z, hx: segW / 2, hz: T / 2, h: topY });
      }
      // 门楣（门洞上方那一段）
      const lin = new THREE.Mesh(new THREE.BoxGeometry(doorW, topY - HALF_LEN, T), wallMat);
      lin.position.set(cx, HALF_LEN + (topY - HALF_LEN) / 2, cz + sz * hz);
      lin.castShadow = true;
      scene.add(lin); obstacles.push(lin);
      // 门楣**不给碰撞**：它的竖直区间是 [2.06, 4.9]，而碰撞模型只会读 c.h ——
      // 给它一个 h=4.9 的盒子等于把 3.6m 宽的门洞重新堵死。
    }
    // 东西侧墙：各开一个窄门（贴地），同样只给「门洞两侧」的碰撞
    for (const sx of [-1, 1]) {
      const sideDoor = 2.2;
      const segD = (hz * 2 - sideDoor) / 2;
      for (const sz of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(T, topY, segD), wallMat);
        w.position.set(cx + sx * hx, topY / 2, cz + sz * (sideDoor / 2 + segD / 2));
        w.castShadow = true; w.receiveShadow = true;
        scene.add(w); obstacles.push(w);
        colliders.push({ x: w.position.x, z: w.position.z, hx: T / 2, hz: segD / 2, h: topY });
      }
      const lin = new THREE.Mesh(new THREE.BoxGeometry(T, topY - 2.2, sideDoor), wallMat);
      lin.position.set(cx + sx * hx, 2.2 + (topY - 2.2) / 2, cz);
      scene.add(lin); obstacles.push(lin);
    }
    // 屋顶：视觉上是一整块甲板，**碰撞只留一圈环**，中间那格空着 = 室内能站人。
    // 环宽取 0.9m（够站稳、够狙击手趴边）；屋顶四角各留 0.9m 的边条。
    const roof = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.4, 0.3, hz * 2 + 0.4), roofDeck);
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
  addStairs(PORT_X, PORT_HZ + P_RUN, -1, PORT_TOP, sideMat);   // 北梯：顶在屋顶北缘
  addStairs(PORT_X, -(PORT_HZ + P_RUN), 1, PORT_TOP, sideMat); // 南梯
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
  addStairs(STBD_X, STBD_HZ + S_RUN, -1, STBD_TOP, sideMat);
  addStairs(STBD_X, -(STBD_HZ + S_RUN), 1, STBD_TOP, sideMat);
  const pent = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.3, 3.6), wallMat);
  pent.position.set(STBD_X, STBD_TOP + 1.15, 0);
  pent.castShadow = true; pent.receiveShadow = true;
  scene.add(pent); obstacles.push(pent);
  colliders.push({ x: STBD_X, z: 0, hx: 1.5, hz: 1.8, h: STBD_TOP + 2.3, y0: STBD_TOP });

  // ===== 空中栈桥：把两座屋顶连起来 =====
  // 从右舷屋顶横跨中路到左舷屋顶（跨度由 PORT_X/STBD_X 派生，18.4m）。桥面 4.62m，
  // 玩家在甲板上从桥下走过（这就是 colliders 的 y0 存在的全部理由）。
  // 桥面 1.8m 宽、两侧 1.0m 栏杆（无碰撞）。
  // 它同时是全场最好用的观景位和最危险的靶子 —— 桥下的人在阴影里看得见桥上的人，反之困难。
  // **桥的净空是 HANG_Y 的上界约束**：桁架顶 ≈6.4m，所以吊箱底必须留在 8m 以上（见龙门吊一节）。
  {
    const BR_Y = STBD_TOP + 0.12, BR_W = 1.8;
    const xL = PORT_X + 2.4, xR = STBD_X - 2.4, span = xR - xL;
    const deckPlate = new THREE.Mesh(new THREE.BoxGeometry(span, 0.24, BR_W), roofDeck);
    deckPlate.position.set((xL + xR) / 2, BR_Y, 0);
    deckPlate.castShadow = true; deckPlate.receiveShadow = true;
    scene.add(deckPlate); obstacles.push(deckPlate);
    colliders.push({ x: (xL + xR) / 2, z: 0, hx: span / 2, hz: BR_W / 2, h: BR_Y + 0.12, y0: BR_Y - 0.12 });
    // 桁架：上下弦 + 斜腹杆（纯视觉，撑起「这是一座桥」的读感）
    for (const sz of [-1, 1]) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(span, 0.14, 0.14), trimMat);
      top.position.set((xL + xR) / 2, BR_Y + 1.35, sz * BR_W / 2);
      scene.add(top); obstacles.push(top);
      for (let i = 0; i <= span; i += 1.55) {
        const x = xL + i;
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.45, 0.1), trimMat);
        d.position.set(x, BR_Y + 0.72, sz * BR_W / 2);
        d.rotation.z = (i / 1.55) % 2 ? 0.62 : -0.62;
        scene.add(d);
      }
      for (const y of [0.5, 0.95, 1.35]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(span, 0.06, 0.06), trimMat);
        r.position.set((xL + xR) / 2, BR_Y + y, sz * BR_W / 2);
        scene.add(r);
      }
    }
  }

  // ===== 船中龙门吊（跨全船的起重机 + 悬吊集装箱）=====
  // 两条腿落在甲板**之外**（x = ±(DECK_W+1.6) = ±21.6，在 bounds.hw=19.35 之外），
  // 所以它不参与碰撞、也不挡路 —— 纯剪影。它给扁平的地图补上唯一一条**横跨全场的横向结构**，
  // 并且解释了「为什么船中那块甲板是空的」。
  // **BEAM_Y / HANG_Y 与船的长宽无关**，缩图时不要动：HANG_Y 只受栈桥桁架顶（≈6.4m）约束。
  const craneGroup = new THREE.Group();
  {
    const LEG_X = DECK_W + 1.6, BEAM_Y = 15.5;
    const steel = new THREE.MeshStandardMaterial({ color: 0xd8a92e, roughness: 0.62, metalness: 0.35 });
    // 腿落在 x=±21.6 —— **在船体（外壁 x=±20.4~21.0）之外、水面之上**，所以每条腿下面
    // 得先有一块属于自己的舷外平台，否则四条腿就是悬空站在海面上。
    // 平台从 -2.6（没入水线 y=-2.4 以下）顶到 +0.2，与甲板齐平。
    for (const sx of [-1, 1]) {
      const spon = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.8, 13.0), trimMat);
      spon.position.set(sx * LEG_X, -1.2, 0);
      spon.receiveShadow = true;
      craneGroup.add(spon);
      // 与船体相连的两根斜撑（不然平台像是贴在海上的孤岛）
      for (const dz of [-3.4, 3.4]) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.35), steel);
        st.position.set(sx * (LEG_X - 1.5), 1.1, dz);
        st.rotation.z = sx * -0.55;
        craneGroup.add(st);
      }
    }
    for (const sx of [-1, 1]) {
      for (const dz of [-2.4, 2.4]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, BEAM_Y, 0.7), steel);
        leg.position.set(sx * LEG_X, BEAM_Y / 2, dz);
        leg.castShadow = true;
        craneGroup.add(leg);
      }
      for (const y of [4, 8, 11.5]) {
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 5.5), steel);
        br.position.set(sx * LEG_X, y, 0);
        craneGroup.add(br);
      }
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), steel);
      brace.position.set(sx * LEG_X, 13.2, 0);
      brace.rotation.x = 0.6;
      craneGroup.add(brace);
    }
    // 主梁：两条箱型梁 + 上弦，中间留出小车轨道
    for (const dz of [-1.1, 1.1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(LEG_X * 2 + 2, 1.1, 0.8), steel);
      beam.position.set(0, BEAM_Y, dz);
      beam.castShadow = true;
      craneGroup.add(beam);
    }
    const tie = new THREE.Mesh(new THREE.BoxGeometry(LEG_X * 2 + 2, 0.4, 3.0), steel);
    tie.position.set(0, BEAM_Y + 0.8, 0);
    craneGroup.add(tie);
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
          o.castShadow = true;
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
  scene.add(craneGroup);

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
    const zoneMat = new THREE.MeshStandardMaterial({ color: 0xd8a92e, roughness: 0.62 });
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
  const superMat = new THREE.MeshStandardMaterial({ color: 0x9fa6ae, roughness: 0.75, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.35, roughness: 0.7 });
  const SZ = -(DECK_L + 8); // 与船首舰体块同一中心
  const house = new THREE.Mesh(new THREE.BoxGeometry(16, 4.4, 9), superMat);
  house.position.set(0, 5.2, SZ);
  house.castShadow = true;
  scene.add(house);
  // 舷窗带
  const winBand = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.9, 9.2), darkMat);
  winBand.position.set(0, 6.4, SZ);
  scene.add(winBand);
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
  // 船尾低矮甲板室
  const aft = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 6), superMat);
  aft.position.set(0, 3.7, DECK_L + 5);
  aft.castShadow = true;
  scene.add(aft);

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
    for (const b of bg) {
      const s = shipProto.clone(true);
      s.scale.setScalar(b.s);
      s.rotation.y = b.rot;
      s.position.set(b.x, -1.5, b.z);
      scene.add(s);
    }
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
    // 边界必须贴住可见的舷墙栏杆（两端在 z=±(DECK_L-0.2)=±33.8，两舷在 x=±19.8）。
    // 原来的 DECK_W-1.2 / DECK_L-1.2 比栏杆小了整 1m，
    // 于是船首船尾两端各有一道**看不见的墙**，玩家离栏杆还有一步就走不动了。
    // 现在 19.35 / 33.35 正好等于「玩家胶囊边缘（+PLAYER_RADIUS 0.45）贴到栏杆」。
    // **hl 还被 enemies.js 的刷出公式用作输入**（|z| ∈ [hl-10, hl-4]），改它等于改刷敌位置。
    bounds: { hw: DECK_W - 0.65, hl: DECK_L - 0.65 },
    update(t, dt) {
      this._n = (this._n || 0) + 1;
      // 海浪顶点动画
      for (let i = 0; i < wpos.count; i++) {
        const [bx, by] = wbase[i];
        const w =
          Math.sin(bx * 0.02 + t * 1.2) * 0.5 +
          Math.cos(by * 0.025 + t * 0.9) * 0.5;
        wpos.setZ(i, w);
      }
      wpos.needsUpdate = true;
      if (this._n % 3 === 0) waterGeo.computeVertexNormals();
      // 白浪随波滚动，纯 offset 动画，零额外逐帧 CPU
      waterMap.offset.x = t * 0.006;
      waterMap.offset.y = t * 0.004;
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
