// ===== 大厅（经典双阵营房间 + 四页签 + 本地房间消息）=====
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
  { keys: ["鼠标右键"], label: "开镜（狙击枪）· 凤凰斧重击 · 炫金雷神枪托" },
  { keys: ["V"], label: "开镜（备用键）" },
  { keys: ["R"], label: "换弹" },
  { keys: ["1"], label: "切换到主武器" },
  { keys: ["2"], label: "切换到副武器" },
  { keys: ["3"], label: "切换到凤凰斧" },
  { keys: ["4"], label: "循环切换手雷 / 闪光弹 / 烟雾弹" },
  { keys: ["Q"], label: "切回上一把武器（与当前武器往返切换）" },
  { keys: ["Z"], label: "特殊技：战术跃进（双充能）" },
  { keys: ["X"], label: "特殊技：部署折叠掩体" },
  { keys: ["C"], label: "绝招：超限状态" },
  { keys: ["Esc"], label: "游戏菜单：暂停 / 结束对局 / 刷新位置" },
  { keys: ["B"], label: "背包：悬停编号预览，点击或 1–9 确认并关闭" },
  { keys: ["G"], label: "丢弃当前武器" },
  { keys: ["Tab"], label: "按住查看战绩" },
  { keys: ["Enter"], label: "聊天（再按一次发送）" },
  { keys: ["+", "−"], label: "对局中增减敌人数量" },
  { keys: ["N"], label: "训练模式：在准心位置放置静止 NPC" },
  { keys: ["Delete"], label: "训练模式：删除瞄准 NPC；Shift + Delete 清空" },
  { keys: ["F8"], label: "训练模式：清空伤害统计" },
  { keys: ["F"], label: "浏览模式：自由飞行，再按返回起飞处" },
  { keys: ["Space", "Ctrl", "Shift"], label: "飞行时上升、下降、加速" },
  { keys: ["Esc"], label: "释放鼠标，回到大厅" },
];

const TAB_NAMES = { play: "大厅", manual: "作战手册", arsenal: "武器图鉴", storage: "仓库" };

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
    this._onEquip = typeof opts.onEquip === "function" ? opts.onEquip : null;
    this._storagePack = 0;
    this._storageSlot = 'primary';

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
    const form = this._root.querySelector("#roomChatForm");
    const input = this._root.querySelector("#roomChatInput");
    const log = this._root.querySelector("#roomChatLog");
    if (form && input && log) {
      // Local room messages only. Typing here must not trigger gameplay keys.
      for (const event of ["keydown", "keyup"]) input.addEventListener(event, e => {
        e.stopPropagation();
        if (event === "keydown" && e.code === "Escape") input.blur();
      });
      form.addEventListener("submit", e => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        const line = el("p", "room-message-player");
        line.append(el("b", null, "你："), document.createTextNode(text.slice(0, 100)));
        log.append(line);
        while (log.children.length > 50) {
          const oldest = log.querySelector(".room-message-player");
          if (!oldest) break;
          oldest.remove();
        }
        input.value = ""; log.scrollTop = log.scrollHeight;
      });
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
    if (chip) {
      const n = match.enemies;
      chip.textContent = match.browsing ? "单人参观 · 不限时" : `${n} 名电脑 · ${match.difficulty || "普通"}`;
    }
    const data = this._getData() || {};
    this._renderRoom(data.room);
    this._renderClassicLoadout(data.storage);
  }

  /** 对局中按 Esc 回到大厅时，主按钮要改成「返回战场」——
   *  否则玩家会以为点下去是**重开一局**（实际 `pointerlockchange` 的加锁分支里
   *  `if (state !== "playing") gameStart()` 为假，是原局续打）。 */
  setResume(on) {
    if (!this._startBtn) return;
    const want = !!on;
    if (want === this._resume) return;
    this._resume = want;
    this._startBtn.textContent = want ? "返回战场" : "开始游戏";
    const status = this._root?.querySelector("#classicRoomStatus");
    if (status) status.textContent = want ? "对局中" : "等待开始";
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
    // 房间骨架和对局设置 id 留在 HTML；成员行从游戏数据即时生成。
    if (tab === "play") {
      const data = this._getData() || {};
      this._renderRoom(data.room);
      this._renderClassicLoadout(data.storage);
      this._rendered.play = true;
      return;
    }
    const data = this._getData() || {};
    pane.replaceChildren();
    if (tab === "manual") pane.append(this._renderManual());
    else if (tab === "arsenal") pane.append(this._renderArsenal(data.arsenal));
    else if (tab === "storage") pane.append(this._renderInventory(data.inventory));
    this._rendered[tab] = true;
  }

  _head(title, desc) {
    const box = el("div", "lp-head");
    box.append(el("h2", "lp-h2", title));
    if (desc) box.append(el("p", "lp-desc", desc));
    return box;
  }

  _renderRoom(room) {
    for (const [id, rows] of [["roomEnemyList", room?.enemies], ["roomPlayerList", room?.players]]) {
      const list = this._root.querySelector("#" + id);
      if (!list) continue;
      list.replaceChildren();
      for (let i = 0; i < 8; i++) {
        const member = rows?.[i];
        const row = el("div", member ? "room-member occupied" : "room-member empty");
        if (member) {
          const rank = el("span", "room-rank", member.role === "房主" ? "★" : "»");
          if (member.rank?.icon) {
            rank.classList.add("has-military-rank");
            rank.textContent = "";
            rank.dataset.rankId = member.rank.id;
            rank.setAttribute("aria-label", `军衔：${member.rank.name}`);
            rank.title = `军衔：${member.rank.name}`;
            const icon = document.createElement("img");
            icon.src = member.rank.icon;
            icon.alt = "";
            rank.append(icon);
          } else rank.setAttribute("aria-hidden", "true");
          row.append(rank, el("span", "room-member-name", member.name), el("span", "room-member-role", member.role), el("span", "room-member-status", member.status));
          if (member.role === "房主") row.classList.add("is-host");
        } else row.setAttribute("aria-label", "空位");
        list.append(row);
      }
    }
    const enemies = Array.isArray(room?.enemies) ? room.enemies : [];
    const players = Array.isArray(room?.players) ? room.players : [];
    const population = `${Math.min(16, enemies.length + players.length)} / 16`;
    for (const selector of ["#classicRoomPopulation", "#classicRoomListPopulation"]) {
      const node = this._root.querySelector(selector);
      if (node) node.textContent = population;
    }
    const host = players.find(member => member.role === "房主") || players[0];
    const hostNode = this._root.querySelector("#classicRoomHost");
    if (hostNode && host?.name) hostNode.textContent = host.name;
    const status = this._root.querySelector("#classicRoomStatus");
    if (status) {
      const active = [...enemies, ...players].some(member => member.status === "对局中");
      status.textContent = active || this._resume ? "对局中" : "等待开始";
    }
  }

  _renderClassicLoadout(rows) {
    if (!Array.isArray(rows)) return;
    const bags = rows.filter(row => /^背包\s+\d+$/.test(row.slot || ""));
    const current = bags.find(row => row.cur) || bags[0];
    const name = this._root.querySelector("#classicLoadoutName");
    const skin = this._root.querySelector("#classicLoadoutSkin");
    const tabs = this._root.querySelector("#classicLoadoutTabs");
    if (name) name.textContent = current?.gun || "未配置主武器";
    if (skin) skin.textContent = current ? `${current.skin || "原厂"} · 当前配装` : "当前配装";
    if (!tabs) return;
    tabs.replaceChildren();
    bags.forEach((row, index) => {
      const tab = el("span", row.cur ? "on" : "", String(index + 1));
      tabs.append(tab);
    });
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

  _renderInventory(inventory) {
    const frag=document.createDocumentFragment();
    if (!inventory?.packs?.length) return frag;
    this._storagePack=Math.min(this._storagePack,inventory.packs.length-1);
    frag.append(this._head('个人仓库',inventory.editable ? '选择背包与装备槽，再从右侧武器中选择装备。配置会保存在本机。' : '对局进行中可查看配装；返回大厅结束对局后可修改。'));
    const root=el('div','inventory-layout'),left=el('section','inventory-pack'),right=el('section','inventory-collection');
    const packHeader=el('div','inventory-section-title','背包配置');left.append(packHeader);
    const tabs=el('div','inventory-pack-tabs');
    inventory.packs.forEach((pack,i)=>{
      const b=el('button',i===this._storagePack?'inventory-pack-tab active':'inventory-pack-tab',String(i+1));
      b.type='button';b.setAttribute('aria-label',`背包 ${i+1}`);b.setAttribute('aria-pressed',String(i===this._storagePack));
      b.onclick=()=>{this._storagePack=i;this._renderPane('storage');};tabs.append(b);
    });left.append(tabs);
    const labels={primary:'主武器',secondary:'副武器',melee:'近身武器'};
    const picture=(item,alt='')=>{const box=el('div','inventory-weapon-image');if(item.image){const img=document.createElement('img');img.src=item.image;img.alt=alt;box.append(img);}return box;};
    for(const slot of Object.keys(labels)) {
      const item=inventory.packs[this._storagePack][slot],button=el('button',slot===this._storageSlot?'inventory-slot active':'inventory-slot');
      button.type='button';button.dataset.slot=slot;button.setAttribute('aria-pressed',String(slot===this._storageSlot));
      const info=el('span','inventory-slot-info');info.append(el('small',null,labels[slot]),el('strong',null,item.name));
      button.append(picture(item),info);button.onclick=()=>{this._storageSlot=slot;this._renderPane('storage');};left.append(button);
    }
    const selected=inventory.packs[this._storagePack][this._storageSlot];
    const collectionHead=el('div','inventory-collection-head');
    collectionHead.append(el('div','inventory-section-title',labels[this._storageSlot]+' · 可用武器'));
    collectionHead.append(el('small',null,`已收录 ${(inventory.choices[this._storageSlot] || []).length} 件`));
    right.append(collectionHead);
    const focus=el('div','inventory-focus-stage');
    const focusVisual=el('div','inventory-focus-visual');
    focusVisual.append(picture(selected,selected.name));
    const focusCopy=el('div','inventory-focus-copy');
    focusCopy.append(el('small',null,`CURRENT LOADOUT · ${labels[this._storageSlot]}`));
    focusCopy.append(el('strong',null,selected.name));
    focusCopy.append(el('span',null,`背包 ${this._storagePack+1} · 当前装备`));
    focus.append(focusVisual,focusCopy);right.append(focus);
    const grid=el('div','inventory-grid');
    for(const item of inventory.choices[this._storageSlot] || []) {
      const equipped=item.id===selected.id&&item.skin===selected.skin;
      const b=el('button',equipped?'inventory-item active':'inventory-item');b.type='button';
      b.dataset.weapon=item.id;b.dataset.skin=item.skin;b.disabled=!inventory.editable;
      b.setAttribute('aria-pressed',String(equipped));b.append(picture(item),el('strong',null,item.name),el('small',null,equipped?'已装备':'装备到背包 '+(this._storagePack+1)));
      b.onclick=()=>{if(this._onEquip?.(this._storagePack,this._storageSlot,item.id,item.skin)){this._onUiSound?.('switch');this._renderPane('storage');}};
      grid.append(b);
    }
    right.append(grid);root.append(left,right);frag.append(root);return frag;
  }

  /** 房间日志里的系统说明，保留 lobbyTicker 的既有接线。 */
  _renderTicker(text) {
    const line = typeof text === "string" && text ? text : "CrossFire · 运输船 · 团队竞技";
    this._tickerEl.textContent = line;
  }
}
