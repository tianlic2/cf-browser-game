// CF 风格的左上角小地图（俯视雷达）。
//
// 与 scripts/chat.js / scripts/icons.js 同一套独立性：**不 import THREE、不碰游戏状态**。
// 构造时收一个 canvas，之后由主循环喂一份纯数据的 `view`。所有 DOM 取用判空、节点缺失
// 或 2D 上下文拿不到时整个模块转「静默禁用」（照 chat.js 的 `_ok` 那条防线）——
// 浏览器缓存了旧 index.html 时 `getElementById` 会拿到 null，一抛异常就毁掉整局。
//
// 为什么是 2D canvas 而不是 WebGL / Sprite：
//   ① **零 WebGL draw call** —— 小地图每帧只做 1 次 `drawImage` + ≤8 个圆点 + 1 个箭头，
//      全在 2D 上下文里，不碰 `renderer.info`（`renderStats().callsPerFrame` 应纹丝不动）；
//   ② 底图（集装箱 / 甲板室 / 木箱 / 走道 / 栈桥）**烘一次离屏 canvas**，每帧只 blit 一次，
//      与地图上有多少件东西无关 —— 这是它能常驻的开销前提。
//
// 坐标系：**长轴竖直、船头（世界 -z）朝上**，与玩家出生在 +z 端一致（一进场就是「往上打」）。
//   sx = pad + (x + hw) / (2*hw) * innerW
//   sy = pad + (z + hl) / (2*hl) * innerH

// 敌人显形的四个条件（见 mmVisible）。**这是「不是透视挂」那条的实现**。
const MM_RANGE = 48;                       // ① 距离（米）。全图半对角 ≈39.4，所以基本覆盖全图，
                                           //    但仍能把「对角远端」筛掉（76m > 48）。
const MM_FOV_HALF = (50 * Math.PI) / 180;  // ② 视野锥半角
const MM_COMBAT_HOLD = 1.5;                // ④ 交火暴露持续（秒）
const MM_VIS_HZ = 10;                      // 可见性重算频率（点位仍每帧刷新）
const MM_SIGHT_H = 1.2;                    // 低于这个高度的碰撞体不挡 2D 视线（矮掩体：木箱 1.0m）
const MM_PAD = 7;                          // 地图四周留白（方向键标尺与玩家点不贴边）

// 配色。**只用 DESIGN.md 允许的 HUD 战术色**：结构一律是 `#9ca3af` 的透明度分档，
// 只有玩家/敌人两个动态点拿强调色。**绝不用大厅橙 `#ff9b1a`** —— 那是首页（CF 大厅）
// 的配色，HUD 与它是两套色（见 AGENTS.md 的首页配色那条）。
const MM_COLOR = {
  bg: "rgba(8, 12, 16, 0.55)",
  frame: "rgba(154, 163, 173, 0.55)",
  deck: "rgba(154, 163, 173, 0.10)",
  hull: "rgba(154, 163, 173, 0.10)",
  walk: "rgba(154, 163, 173, 0.16)",
  stairs: "rgba(154, 163, 173, 0.20)",
  bridge: "rgba(154, 163, 173, 0.22)",
  house: "rgba(154, 163, 173, 0.34)",
  crate: "rgba(154, 163, 173, 0.30)",
  container: "rgba(154, 163, 173, 0.48)",
  containerEdge: "rgba(229, 231, 235, 0.30)",
  player: "#4ade80",
  playerEdge: "rgba(8, 12, 16, 0.85)",
  enemy: "#ef4444",
  enemyCombat: "#fca5a5",
  enemyEdge: "rgba(8, 12, 16, 0.85)",
};

// 绘制顺序 = 从下往上。结构按 kind 分组（每一种一次性画完，少切 fillStyle）。
const MM_ORDER = ["hull", "deck", "walk", "stairs", "bridge", "house", "crate", "container"];

// 2D 线段 × AABB 相交（slab 法）。返回是否在 t ∈ [0,1] 内相交。
//   `colliders` 里只有几十个盒子，线性扫描极廉价，而且**确定性可测** ——
//   用 `THREE.Raycaster` 反而要引入 THREE、还要考虑高度与矩阵。
function segHitsBox(x0, z0, dx, dz, c) {
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x0 < c.x - c.hx || x0 > c.x + c.hx) return false;
  } else {
    let t1 = (c.x - c.hx - x0) / dx, t2 = (c.x + c.hx - x0) / dx;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (z0 < c.z - c.hz || z0 > c.z + c.hz) return false;
  } else {
    let t1 = (c.z - c.hz - z0) / dz, t2 = (c.z + c.hz - z0) / dz;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return false;
  }
  return true;
}

// 两个高度过滤与 `enemies.js` 的 `blockedAt()` 同源：
//   · `c.y0 >= 1.78`（`ENEMY_HEAD_ROOM` / `PLAYER_TOP`）—— 栈桥 / 屋顶在人的头顶，
//     甲板上的人的视线**从底下穿过去**，不该被它挡住；
//   · `c.h <= MM_SIGHT_H` —— 矮掩体（木箱、舷侧走道）挡不住站立者 1.6m 的视线。
function losBlocked(x0, z0, x1, z1, cs, y0=1.62, y1=1.5) {
  if (!cs || !cs.length) return false;
  const dx = x1 - x0, dz = z1 - z0;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if(c.planes) {
      if(Math.max(y0,y1)<c.y0||Math.min(y0,y1)>c.h||!segHitsBox(x0,z0,dx,dz,c))continue;
      let enter=0,exit=1,miss=false;
      for(const [nx,ny,nz,d] of c.planes) {
        const a=nx*x0+ny*y0+nz*z0-d,b=nx*x1+ny*y1+nz*z1-d;
        if(a>0&&b>0){miss=true;break;}
        if(a<=0&&b<=0)continue;
        const t=a/(a-b);
        if(a>b)enter=Math.max(enter,t);else exit=Math.min(exit,t);
      }
      if(!miss&&enter<=exit)return true;
      continue;
    }
    if (c.y0 !== undefined && c.y0 >= 1.78) continue;
    if (c.h !== undefined && c.h <= MM_SIGHT_H) continue;
    if (segHitsBox(x0, z0, dx, dz, c)) return true;
  }
  return false;
}

// 单个敌人是否显形。返回 `"fov" | "combat" | null`（null = 不显示）。
// **顺序即语义**：距离是绝对闸门，然后「看得见」（锥 + 视线 + 烟）优先，
// 最后才是「打起来了所以暴露」—— 这样 `reason` 给出的是**为什么**显示，
// 而不是「只要在交火就一律报 combat」。
export function mmVisible(e, view) {
  if (!e) return null;
  const dx = e.x - view.px, dz = e.z - view.pz;
  const dist = Math.hypot(dx, dz);
  if (dist > MM_RANGE) return null;

  const fx = -Math.sin(view.yaw), fz = -Math.cos(view.yaw); // 玩家前向（与 main.js 同源）
  const inv = dist > 1e-6 ? 1 / dist : 0;
  const dot = (dx * fx + dz * fz) * inv;
  if (dot >= Math.cos(MM_FOV_HALF)) {
    if (!losBlocked(view.px, view.pz, e.x, e.z, view.colliders,(view.py??0)+1.62,(e.y??0)+1.5)) {
      const sb = view.smokeBlocks;
      const smoked = sb ? sb(view.px, (view.py??0)+1.62, view.pz, e.x, (e.y??0)+1.5, e.z) : false;
      if (!smoked) return "fov";
    }
  }
  const t = view.time !== undefined ? view.time : 0;
  if (e.combatAt !== undefined && Number.isFinite(e.combatAt) && t - e.combatAt <= MM_COMBAT_HOLD) {
    return "combat";
  }
  return null;
}

export class Minimap {
  constructor(canvas, opts = {}) {
    this._canvas = canvas || null;
    this._ok = !!(canvas && typeof canvas.getContext === "function");
    this._ctx = this._ok ? canvas.getContext("2d") : null;
    if (!this._ctx) this._ok = false;
    this._opts = { pad: MM_PAD, ...opts };
    this._layout = [];
    this._bounds = null;
    this._base = null;      // 离屏底图
    this._w = 0; this._h = 0; this._dpr = 1;
    this._visT = 0;         // 可见性节流计时
    this._vis = [];         // 与 view.enemies 同序的可见性缓存
    this._player = null;
    this._enemies = [];
    this._stat = { items: 0, baked: 0, frames: 0, drawn: 0, visible: 0 };
  }

  // ---- 尺寸 ------------------------------------------------------------------
  // 尺寸的**唯一权威是 CSS**（`--mm-w/--mm-h` 在 styles/game.css 里，窄屏有一条媒体查询）。
  // 每帧调一次、只在与上一帧不同时才重设 backing store 并重烘底图 —— 窗口缩放、
  // 进出一级窄屏断点、dpr 变化（拖到外接屏）全都自动跟上，不需要外部挂 resize 监听。
  // **`#hud` 在菜单里是隐藏的**，那时 `clientWidth` 为 0 → 直接跳过（保留上一次的底图），
  // 不烘一张 0×0 的图。
  _sync() {
    if (!this._ok) return false;
    const c = this._canvas;
    const cw = c.clientWidth | 0, ch = c.clientHeight | 0;
    if (cw <= 0 || ch <= 0) return false;
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    if (cw === this._w && ch === this._h && dpr === this._dpr && this._base) return true;
    this._w = cw; this._h = ch; this._dpr = dpr;
    c.width = Math.round(cw * dpr);
    c.height = Math.round(ch * dpr);
    this._bake();
    return !!this._base;
  }

  // 测试/显式控制用；平时靠 `_sync()` 自己跟。
  resize(cssW, cssH, dpr) {
    if (!this._ok || cssW <= 0 || cssH <= 0) return;
    this._w = cssW;
    this._h = cssH;
    this._dpr = dpr || Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    this._canvas.width = Math.round(cssW * this._dpr);
    this._canvas.height = Math.round(cssH * this._dpr);
    this._canvas.style.width = cssW + "px";
    this._canvas.style.height = cssH + "px";
    this._bake();
  }

  // ---- 布局与底图 -------------------------------------------------------------
  setLayout(topdown, bounds) {
    this._layout = Array.isArray(topdown) ? topdown : [];
    this._bounds = bounds && Number.isFinite(bounds.hw) && Number.isFinite(bounds.hl)
      ? { hw: bounds.hw, hl: bounds.hl } : null;
    this._stat.items = this._layout.length;
    this._base = null;
    this._bake();
  }

  // 世界 → CSS 像素。少一维的 `sy` 也要暴露给测试，所以单独给一个。
  // Uniform metres-to-pixels scale; all deck corners fit inside the circular frame.
  // Sharing this transform with _box prevents stretched cover or drifting enemy dots.
  toPx(wx, wz) {
    const b = this._bounds;
    if (!b || this._w <= 0) return { sx: 0, sy: 0 };
    const radius = Math.min(this._w, this._h) / 2 - this._opts.pad;
    const scale = radius / Math.hypot(b.hw, b.hl);
    return { sx: this._w / 2 + wx * scale, sy: this._h / 2 + wz * scale };
  }

  _box(e) {
    const a = this.toPx(e.x - e.hx, e.z - e.hz);
    const b = this.toPx(e.x + e.hx, e.z + e.hz);
    return { x: a.sx, y: a.sy, w: Math.max(1, b.sx - a.sx), h: Math.max(1, b.sy - a.sy) };
  }

  _bake() {
    this._base = null;
    if (!this._ok || !this._bounds || this._w <= 0 || this._h <= 0) return;
    const cv = document.createElement("canvas");
    cv.width = Math.round(this._w * this._dpr);
    cv.height = Math.round(this._h * this._dpr);
    const g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    const p = this._opts.pad;

    // 背板（斜切角与首页面板同一套轮廓语言，但这里只是个小方框，切 4px 就够）
    const radius = Math.min(this._w, this._h) / 2 - 2;
    g.save();
    g.beginPath(); g.arc(this._w / 2, this._h / 2, radius, 0, Math.PI * 2); g.clip();
    g.fillStyle = MM_COLOR.bg; g.fillRect(0, 0, this._w, this._h);
    const deck = this._box({ x: 0, z: 0, hx: this._bounds.hw, hz: this._bounds.hl });
    g.fillStyle = MM_COLOR.deck; g.fillRect(deck.x, deck.y, deck.w, deck.h);

    for (const kind of MM_ORDER) {
      if (kind === "deck") continue;
      g.fillStyle = MM_COLOR[kind] || MM_COLOR.container;
      for (let i = 0; i < this._layout.length; i++) {
        const e = this._layout[i];
        if (e.kind !== kind) continue;
        const r = this._box(e);
        g.fillRect(r.x, r.y, r.w, r.h);
        if (kind === "container") {
          // 集装箱是本图的主要地标，给一道描边让彼此分得开（不然 2×2 相邻格糊成一块）
          g.strokeStyle = MM_COLOR.containerEdge;
          g.lineWidth = 1;
          g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        }
      }
    }

    // 外框
    g.strokeStyle = MM_COLOR.frame;
    g.lineWidth = 1;
    g.restore();
    g.strokeStyle = "rgba(218,220,207,.8)"; g.lineWidth = 2;
    g.beginPath(); g.arc(this._w / 2, this._h / 2, radius, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#e0e1d3"; g.font = "bold 9px Arial"; g.textAlign = "center";
    g.fillText("N", this._w / 2, 12);

    this._base = cv;
    this._stat.baked++;
  }

  // ---- 每帧 ------------------------------------------------------------------
  // `view = { px, pz, yaw, time, enemies:[{x,z,combatAt}], colliders, smokeBlocks }`
  update(dt, view) {
    if (!this._ok) return;
    if (!this._sync()) return;
    const v = view || {};
    const ctx = this._ctx;
    this._stat.frames++;
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    ctx.clearRect(0, 0, this._w, this._h);
    ctx.drawImage(this._base, 0, 0, this._w, this._h);

    const list = Array.isArray(v.enemies) ? v.enemies : [];

    // 可见性节流到 MM_VIS_HZ（**点位每帧刷新、判定不必**）—— 判定要扫几十个 AABB，
    // 而敌人在 10Hz 内最多移动 0.35m，肉眼分不出。
    this._visT -= dt;
    if (this._visT <= 0 || this._vis.length !== list.length) {
      this._visT = 1 / MM_VIS_HZ;
      const vis = new Array(list.length);
      for (let i = 0; i < list.length; i++) vis[i] = mmVisible(list[i], v);
      this._vis = vis;
    }

    let shown = 0;
    this._enemies = [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const why = this._vis[i] || null;
      if (!why) { this._enemies.push({ x: e.x, z: e.z, visible: false, reason: null }); continue; }
      shown++;
      const q = this.toPx(e.x, e.z);
      const rad = why === "combat" ? 3.6 : 3.2;
      ctx.beginPath();
      ctx.arc(q.sx, q.sy, rad, 0, Math.PI * 2);
      ctx.fillStyle = why === "combat" ? MM_COLOR.enemyCombat : MM_COLOR.enemy;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = MM_COLOR.enemyEdge;
      ctx.stroke();
      this._enemies.push({ x: e.x, z: e.z, visible: true, reason: why });
    }
    this._stat.drawn = shown;
    this._stat.visible = shown;

    // 玩家箭头（最后画，永远在最上层）
    const pp = this.toPx(v.px || 0, v.pz || 0);
    // 画布 +y 朝下（= 世界 +z），所以「世界 yaw 顺时针转」在画布上是**负角**：
    // yaw=0（面朝 -z = 屏幕上方）→ 0；yaw=π/2（面朝 -x = 屏幕左方）→ -π/2。
    const angle = -(v.yaw || 0);
    this._player = { x: v.px || 0, z: v.pz || 0, yaw: v.yaw || 0, angle };
    ctx.save();
    ctx.translate(pp.sx, pp.sy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -6.2);      // 箭尖
    ctx.lineTo(4.2, 4.6);
    ctx.lineTo(0, 2.4);       // 尾凹口
    ctx.lineTo(-4.2, 4.6);
    ctx.closePath();
    ctx.fillStyle = MM_COLOR.player;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = MM_COLOR.playerEdge;
    ctx.stroke();
    ctx.restore();
  }

  // 取合成后的像素（测试用：证明底图真的画了东西，而不是「元素在、CSS 盒在、零像素」）。
  // **必须有这一条** —— 与 icons.js 那个骷髅徽记是同一族陷阱：DOM 存在性断言全是假绿。
  sample(wx, wz) {
    if (!this._ok || !this._base) return null;
    const q = this.toPx(wx, wz);
    const x = Math.round(q.sx * this._dpr), y = Math.round(q.sy * this._dpr);
    if (x < 0 || y < 0 || x >= this._canvas.width || y >= this._canvas.height) return null;
    const d = this._ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  }

  state() {
    return {
      ok: this._ok,
      w: this._w, h: this._h, dpr: this._dpr,
      items: this._stat.items,
      baked: this._base ? 1 : 0,
      bakeCount: this._stat.baked,
      frames: this._stat.frames,
      drawn: this._stat.drawn,
      visible: this._stat.visible,
      bounds: this._bounds ? { hw: this._bounds.hw, hl: this._bounds.hl } : null,
    };
  }

  playerState() { return this._player; }
  enemyStates() { return this._enemies.slice(); }
}
