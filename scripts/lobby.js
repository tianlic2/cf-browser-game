// ===== 大厅（CF 风格首页：全屏四页签 + 战况简报 + 公告跑马灯）=====
//
// 与 `scripts/chat.js` / `scripts/minimap.js` 同一套独立性约定：
//   · 不 import THREE、不碰任何游戏状态；
//   · 数据靠构造时注入的 `getData()` 现取（**每次渲染都调**，不是构造时快照一次
//     —— `BACKPACKS` 会被捡枪改写、`GEAR_SKIN` 会被 setSkin 改写，快照会显示过期配装）；
//   · 所有 DOM 取用判空，缺节点即整体转静默禁用（`_ok`）；
//   · 正文一律 `createElement` + `textContent`，**绝不 innerHTML**；
//   · 字段一律下划线前缀（`_tab` / `_data` / `_ok`）—— 防「实例字段盖掉同名原型方法」
//     那类事故（audio.js 里 `this.muffle` 盖掉 `muffle()` 让整局冻死过一次）。
//
// 本模块**只做展示**：三张只读表不许出现任何可点选项。
// 「改配装」这件事在大厅里从来没有入口 —— 换主武器只有菜单外的 `B` 面板那条路
// （见 AGENTS.md「背包与切枪」）。别在这里加 switchWeapon / setSkin 的调用。

/**
 * 作战手册的键位表。
 *
 * ⚠️ **这张表与 `scripts/main.js` 里 `document.addEventListener("keydown", …)` 那个
 * handler 一一对应，改键位时两边必须一起改。**
 *
 * 它**故意不自动生成**：键位在代码里是一堆带状态守卫的 `if (e.code === …)` 分支，
 * 同一个物理键在不同状态下语义不同（`Digit1` 在背包面板开着时是「选第 N 个背包」、
 * 否则是「切到主武器」；`Space`/方向键在死亡态被吞掉）。
 * 拿代码生成出来的是一张会撒谎的表。
 */
const KEYBINDS = [
  { keys: ["W", "A", "S", "D"], label: "移动（默认奔跑）" },
  { keys: ["Shift"], label: "静步潜行（不触发脚步声）" },
  { keys: ["Ctrl"], label: "按住下蹲" },
  { keys: ["Space"], label: "跳跃（落地瞬间再按可连跳）" },
  { keys: ["鼠标左键"], label: "开火 / 按住拉环、松开投掷" },
  { keys: ["鼠标右键"], label: "开镜（AWM）· 军刀重击" },
  { keys: ["V"], label: "开镜（备用键）" },
  { keys: ["R"], label: "换弹" },
  { keys: ["1"], label: "切换到主武器" },
  { keys: ["2"], label: "切换到副武器" },
  { keys: ["3"], label: "切换到军刀" },
  { keys: ["4"], label: "循环切换手雷 / 闪光弹 / 烟雾弹" },
  { keys: ["Q"], label: "主武器 ⇄ 副武器 快速切换" },
  { keys: ["B"], label: "背包面板（再用 1 / 2 / 3 选，选完自动收起）" },
  { keys: ["G"], label: "丢弃当前武器" },
  { keys: ["Tab"], label: "按住查看战绩" },
  { keys: ["Enter"], label: "聊天（再按一次发送）" },
  { keys: ["+", "−"], label: "对局中增减敌人数量" },
  { keys: ["Esc"], label: "释放鼠标，回到大厅" },
];

const TAB_NAMES = { play: "开始游戏", manual: "作战手册", arsenal: "武器库", storage: "个人仓库" };

/** 建一个元素。cls 可省，text 可省（0 与 "" 要能正常写入，所以判的是 null/undefined）。 */
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

export class Lobby {
  /**
   * @param {object} opts
   *   root      #menu 本身（用来 querySelector 找 pane）
   *   tabsEl    #lobbyTabs
   *   tickerEl  #lobbyTicker（跑马灯内容容器）
   *   startBtn  #startBtn（mid-match 回大厅时要换文案）
   *   getData   () => ({ ticker, arsenal, storage, match })
   *   onUiSound (kind) 可选。页签被**玩家点击**时回调一次（kind 目前只有 "switch"）。
   *            走注入而不是让本模块 import `scripts/audio.js`：这个模块的纪律是
   *            「不 import THREE、不碰游戏状态」，音频对象显然属于游戏状态那一侧。
   */
  constructor(opts = {}) {
    this._root = opts.root || null;
    this._tabsEl = opts.tabsEl || null;
    this._tickerEl = opts.tickerEl || null;
    this._startBtn = opts.startBtn || null;
    this._getData = typeof opts.getData === "function" ? opts.getData : null;
    this._onUiSound = typeof opts.onUiSound === "function" ? opts.onUiSound : null;

    this._tab = "play";
    this._panes = new Map(); // data-pane -> element
    this._tabs = new Map();  // data-tab  -> button
    this._resume = false;
    this._rendered = { play: false, manual: false, arsenal: false, storage: false };

    // 节点缺失 = 浏览器缓存了旧的 index.html（http.server 不发缓存头，实测踩过）。
    // 缺任何一个就整体禁用，绝不能抛 —— 大厅在模块级加载路径上，抛了整局都起不来。
    this._ok = !!(this._root && this._tabsEl && this._getData);
    if (!this._ok) return;

    for (const b of this._tabsEl.querySelectorAll("[data-tab]")) {
      const name = b.dataset.tab;
      if (!TAB_NAMES[name]) continue;
      this._tabs.set(name, b);
      // ⚠️ 声音**只挂在这个 click 上**，绝不能放进 `show()`：`refresh()` 会调 `show()`，
      // 而 `refresh()` 在每次指针锁定/失锁回大厅时都触发 —— 放进去就变成「每次回大厅都叮一声」。
      b.addEventListener("click", () => { if (this._onUiSound) this._onUiSound("switch"); this.show(name); });
    }
    for (const p of this._root.querySelectorAll("[data-pane]")) {
      this._panes.set(p.dataset.pane, p);
    }
    if (!this._tabs.size || !this._panes.size) {
      this._ok = false;
      return;
    }
    this.refresh();
  }

  /** 切到某个页签。未知名字忽略（保持当前页）。 */
  show(tab) {
    if (!this._ok || !TAB_NAMES[tab] || !this._panes.has(tab)) return;
    this._tab = tab;
    for (const [name, btn] of this._tabs) {
      const on = name === tab;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    }
    for (const [name, pane] of this._panes) {
      pane.classList.toggle("hidden", name !== tab);
    }
    // 每次切到某页都重渲染那一页：个人仓库要反映捡枪（以及程序化的 setSkin）之后的最新配装。
    this._renderPane(tab);
  }

  /** 当前页签 + 全部页签重渲染（数据可能变了）。主循环/失锁路径调它即可。 */
  refresh() {
    if (!this._ok) return;
    const data = this._getData() || {};
    if (data.match) this.setMatch(data.match);
    if (this._tickerEl) this._renderTicker(data.ticker);
    this.show(this._tab);
  }

  /** 顶栏那个「8 人 · 普通」徽章。由 main.js 的 buildMenuMatch() 调（那是 enemyTarget
   *  与 difficultyId 的唯一既有汇总点，挂在它后面就不会漏）。 */
  setMatch(match) {
    if (!this._ok || !match) return;
    const chip = this._root.querySelector("#lobbyMatchChip");
    if (!chip) return;
    const n = match.enemies;
    chip.textContent = `${n} 人 · ${match.difficulty || "普通"}`;
  }

  /** 对局中按 Esc 回到大厅时，主按钮要改成「返回战场」——
   *  否则玩家会以为点下去是**重开一局**（实际 `pointerlockchange` 的加锁分支里
   *  `if (state !== "playing") gameStart()` 为假，是原局续打）。 */
  setResume(on) {
    if (!this._startBtn) return;
    const want = !!on;
    if (want === this._resume) return;
    this._resume = want;
    this._startBtn.textContent = want ? "返回战场" : "进入战场";
  }

  /** 供 __tactical 读口用（`.lobbyState()`）。 */
  state() {
    return {
      ok: this._ok,
      tab: this._tab,
      tabs: [...this._tabs.keys()],
      panes: [...this._panes.keys()],
      rendered: { ...this._rendered },
      resume: this._resume,
    };
  }

  // ---------- 渲染 ----------

  _renderPane(tab) {
    const pane = this._panes.get(tab);
    if (!pane) return;
    // 开始游戏页的正文是 index.html 里写死的（对局设置那套 id 必须留在 HTML 里，
    // buildMenuMatch 与 init 的步进器都是模块级无保护取用），只写顶栏那个徽章。
    if (tab === "play") {
      this._rendered.play = true;
      return;
    }
    const data = this._getData() || {};
    pane.replaceChildren();
    if (tab === "manual") pane.append(this._renderManual());
    else if (tab === "arsenal") pane.append(this._renderArsenal(data.arsenal));
    else if (tab === "storage") pane.append(this._renderStorage(data.storage));
    this._rendered[tab] = true;
  }

  _head(title, desc) {
    const box = el("div", "lp-head");
    box.append(el("h2", "lp-h2", title));
    if (desc) box.append(el("p", "lp-desc", desc));
    return box;
  }

  _renderManual() {
    const frag = document.createDocumentFragment();
    frag.append(
      this._head(
        "作战手册",
        "本作的全部键位。鼠标左键开火、右键开镜；Enter 聊天、Tab 看战绩。"
      )
    );
    const grid = el("div", "lv-keys");
    for (const k of KEYBINDS) {
      const row = el("div", "lv-key-row");
      const caps = el("div", "lv-key-cap");
      k.keys.forEach((key, i) => {
        if (i) caps.append(el("span", "lv-key-plus", "+"));
        caps.append(el("kbd", null, key));
      });
      row.append(caps, el("span", "lv-key-txt", k.label));
      grid.append(row);
    }
    frag.append(grid);

    const hint = el("div", "lv-hint");
    hint.append(
      el("div", null, "· 换弹不算「本回合已行动」，所以在复活点换完弹仍然可以按 B 换背包；开过一枪就不行了。"),
      el("div", null, "· 背包面板打开时，数字键选的是「第几个背包」而不是武器槽位。"),
      el("div", null, "· 打字期间视角定住、整条游戏键盘路径被短路，但游戏照常跑 —— 真的会被打死。")
    );
    frag.append(hint);
    return frag;
  }

  _renderArsenal(rows) {
    const frag = document.createDocumentFragment();
    frag.append(
      this._head("武器库", "全部武器与投掷物的出厂数值。伤害为命中躯干的基础值，随距离按 CS 公式衰减；爆头一律一击必杀。")
    );
    const table = el("div", "lv-table");
    const head = el("div", "lv-tr lv-th");
    head.append(
      el("span", "lv-name", "武器"),
      el("span", "lv-c-kind", "类型"),
      el("span", null, "伤害"),
      el("span", "lv-c-mag", "弹匣/弹量"),
      el("span", "lv-c-res", "备弹/射程"),
      el("span", "lv-c-reload", "换弹/间隔"),
      el("span", "lv-c-skin", "皮肤")
    );
    table.append(head);
    for (const w of rows || []) {
      const tr = el("div", "lv-tr");
      tr.append(
        el("span", "lv-name", w.name),
        el("span", "lv-c-kind", w.kind),
        el("span", "lv-num", w.dmg),
        el("span", "lv-num lv-c-mag", w.mag),
        el("span", "lv-num lv-c-res", w.res),
        el("span", "lv-num lv-c-reload", w.reload),
        el("span", "lv-num lv-c-skin", w.skins)
      );
      table.append(tr);
    }
    frag.append(table);
    frag.append(
      el(
        "div",
        "lv-hint",
        rows && rows.length ? "· 皮肤数含「原厂」。带「模型」标记的那几款会整把换掉武器模型。" : ""
      )
    );
    return frag;
  }

  _renderStorage(rows) {
    const frag = document.createDocumentFragment();
    frag.append(
      this._head(
        "个人仓库",
        "当前配置（只读）。主武器按背包各配一份，副武器与近战是全局一份；大厅里不提供改装配入口 —— 对局中按 B 打开背包面板。"
      )
    );
    const cards = el("div", "lv-cards");
    for (const s of rows || []) {
      const card = el("div", s.cur ? "lv-card lv-cur" : "lv-card");
      const head = el("div", "lv-card-head");
      const slot = el("span", "lv-card-slot");
      if (s.cur) slot.append(el("em", null, "● "), document.createTextNode(s.slot));
      else slot.append(document.createTextNode(s.slot));
      head.append(slot);
      card.append(head);
      card.append(el("div", "lv-card-gun", s.gun));
      const skinLine = el("div", s.model || s.skined ? "lv-card-skin" : "lv-card-skin is-stock");
      skinLine.append(document.createTextNode(s.skin || "原厂"));
      if (s.model) skinLine.append(el("span", "lv-badge", "模型"));
      card.append(skinLine);
      cards.append(card);
    }
    frag.append(cards);
    return frag;
  }

  /** 跑马灯：写**两遍**同一段内容，配 CSS 的 translateX(-50%) 才是无缝循环。 */
  _renderTicker(text) {
    const line = typeof text === "string" && text ? text : "战术突击 · 运输船 · 团队竞技";
    this._tickerEl.replaceChildren();
    for (let i = 0; i < 2; i++) {
      const span = el("span", null, line);
      // 只有第一份要写给读屏（第二份纯属动画的补位）
      if (i === 1) span.setAttribute("aria-hidden", "true");
      this._tickerEl.append(span);
    }
  }
}
