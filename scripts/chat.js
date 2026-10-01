// 模拟聊天系统（CF 风格 · 左下角）。
//
// 敌人根据玩家的表现发话，玩家按回车也能在这个框里发言。这个模块**只管「说出来的话」**：
// 不 import THREE、不碰游戏状态，只拿 DOM 与几个回调（发言人名单、开输入的前置条件）。
//
// 三条贯穿全文件的硬约束：
//
// 1. **打字不能释放指针锁。** main.js 的 pointerlockchange 在失锁时会
//    `hud.classList.add("hidden")` + 弹出主菜单 —— 一解锁，整个 HUD 连同聊天框自己一起消失。
//    所以打字期间必须保住指针锁，改用「把整条键盘路径短路」的办法拦输入：
//    使用方把 handleKey(e) 挂在 keydown 监听的**第一条语句**上（且在 `keys[e.code] = true`
//    之前），返回 true 就立刻 return。漏在前面会让打出的 w/a/s/d 同时驱动玩家移动。
//
// 2. **全部时序由外部每帧调 update(dt) 推进**，绝不用 setTimeout、也不用 CSS 动画 ——
//    那样跟不上 __tactical.pause()（暂停只停 rAF），也没法在无头测试里定步长快进。
//    行寿命、限流冷却、应答延迟、冷场计时，四样都走 dt。
//
// 3. **正文一律走 textContent，绝不 innerHTML。** 聊天内容是任意用户输入，
//    与 pushKillFeed（内部可控字符串才敢用 innerHTML）不是一回事。

/** 玩家的聊天署名。与 main.js 的 PLAYER_NAME("你") **是两个常量**：
 *  战绩面板里「你」是从旁观视角看名册，聊天里第一人称「我」才顺。别复用。 */
export const PLAYER_CHAT_NAME = "我";

/** 一个存活敌人都没有时的兜底发言人。绝不凭空造 ENEMY_NAMES 之外的名字。 */
const SPEAKER_FALLBACK = "潜伏者";

/** 可在线微调的调参对象（照 ENEMY_TUNING / ARM_ANCHORS 的既有模式）。 */
export const CHAT_TUNING = {
  lineLife: 9.0,   // 每行存活秒数
  maxLines: 6,     // 同屏上限，超了从最旧摘（killfeed 用的是 5）
  cooldown: 2.5,   // 两条敌台词的**最小间隔** —— 防刷屏的唯一保障
  queueMax: 3,     // 待播队列上限，防止一次连杀把队列灌满
  replyMin: 0.6,   // 玩家发言后敌人的应答延迟
  replyMax: 1.6,
  idleMin: 25,     // 冷场闲聊的间隔
  idleMax: 40,
  quietGap: 8,     // 距上一条发言不足这个秒数就不插嘴
  firstIdleMin: 6, // 开局后第一条闲聊的延迟（比 idleMin 短，开局不至于太闷）
  firstIdleMax: 11,
  msgMax: 60,
};

/**
 * 台词库。**是导出的普通对象、不是冻结字面量** —— 加一类、加一句都不用动类本身。
 * 占位符：`{name}`（本类事件里的那个人，见 main.js 各钩子传的 ctx）。
 */
export const CHAT_LINES = {
  // ——— 玩家击杀了一名敌人，其余敌人对此的反应（{name} = 被打掉的那个队友）———
  kill: [
    "{name} 又送了，你能不能看一眼小地图",
    "对面手感来了，别硬顶",
    "别单走，{name} 就是单走没的",
    "他枪法可以，都架稳一点",
    "中路有人，报个点",
    "{name} 倒了，补上位置",
    "谁去把他按住，我不想再看见他了",
    "别急，等他自己露头",
  ],
  headshot: [
    "爆头？行，有点东西",
    "别露头了，对面枪口太高",
    "{name} 站着不动的下场",
    "他专打头，蹲低点走",
    "我都说了别走直线",
    "这枪是真准，服了",
    "别跟他对枪，绕后",
  ],
  multikill: [
    "他连杀起来了，都给我压住",
    "别乱，散开站位！",
    "{name} 他们几个是被同一个人收的？",
    "那个位置被架死了，别再往那走",
    "全员注意，对面那个很凶",
    "一起上，别一个一个喂",
  ],
  // ——— 玩家阵亡（发言人 = 击杀你的那个敌人）———
  death: [
    "又一个，收工",
    "就这？我还以为多强",
    "别急，等会儿还有",
    "这波打得不错，可惜对面是我",
    "枪不错，人不行",
    "复活了再来，我在这等你",
    "记住了，别站开阔地",
  ],
  // ——— 敌人临死前喊的一句（发言人 = 倒下的那个）———
  dyingWords: [
    "对面那枪是真快…",
    "他绕后了，小心！",
    "别走我这条路，有人架",
    "中门有人，报点",
    "我掉了，你们顶住",
    "帮我报仇…",
  ],
  // ——— 玩家捡起地上的枪 ———
  pickup: [
    "他还捡上枪了，穷成这样",
    "捡漏倒是挺快",
    "对面换枪了，注意火力",
    "捡吧捡吧，反正等会儿还是我的",
  ],
  // ——— 玩家往聊天框里打的话（关键词只做粗分流，不假装真懂语义）———
  reply_question: [
    "问那么多干嘛，打就完了",
    "你自己不会看吗",
    "想知道？打赢我再说",
    "这问题问得跟你枪法一样",
    "别问了，中路见真章",
  ],
  reply_taunt: [
    "嘴上挺厉害，手上呢",
    "等你过来，我就在这",
    "别急，马上就轮到你",
    "吵死了，来对枪啊",
    "菜就多练，别打字",
  ],
  reply_generic: [
    "嗯",
    "他在说什么，没听懂",
    "别理他，继续推",
    "话挺多，枪挺少",
    "直播呢？还聊天",
    "行了行了，中路见",
  ],
  // ——— 冷场时的一句闲聊 ———
  idle: [
    "对面怎么不动了，缩家里？",
    "这局有点闷啊",
    "谁还有烟？中路封一下",
    "别蹲了，出来打",
    "计时器在走，动作快点",
    "报点报点，人都哪去了",
  ],
  // ——— 开局的第一句（比 idle 早，见 _maybeIdle）———
  start: [
    "开局了，中路见",
    "都到位没有，报个数",
    "别浪，稳扎稳打",
    "今天谁先送谁是狗",
  ],
};

/**
 * 同一帧堆了多条时谁先出（onKill 一次就同时是击杀 + 爆头 + 连杀）。
 * `dyingWords` 刻意压到最低一档：它是纯风味，不该把「连杀/爆头」这种真正的战绩播报挤掉
 * —— 每次击杀都排队一条遗言的话，这一档就成了聊天框里的常客。
 * `death`（击杀者嘲讽玩家）最高：那是玩家最该看到的一条。
 */
const PRIORITY = {
  death: 6,
  multikill: 5,
  headshot: 4,
  kill: 3,
  pickup: 2,
  dyingWords: 2,
  start: 1,
  idle: 1,
};

export class Chat {
  constructor(opts = {}) {
    this._logEl = opts.logEl || null;
    this._input = opts.inputEl || null;
    this._wrapEl = opts.inputWrapEl || null;
    // 开输入的前置条件（由 main.js 判定：在不在战场、有没有锁指针）
    this._canOpen = opts.canOpen || null;
    // 输入态变化的回调。**必须**由 main.js 用来清 keys ——
    // keys 是 main.js 的模块级变量，这边碰不到，不清的话「按住 W 时敲回车」
    // 会让玩家在打字期间一直往前走。
    this._onTypingChange = opts.onTypingChange || null;
    // 返回当前**存活敌人**的 name 字符串数组。只读字符串、绝不留 Enemy 引用 ——
    // EnemyManager 是对象池，同一实例会反复易主，bindRoster 每次复用都会改写 name。
    this._getSpeakerNames = opts.getSpeakerNames || null;

    this._typing = false;
    this._composing = false;
    this._lines = [];
    this._deck = Object.create(null);
    this._queue = [];
    this._reply = null;
    this._cd = 0;
    this._quiet = 1e9;
    this._idleT = 0;
    this._firstIdle = true;

    // 节点缺失 = 浏览器缓存了旧 index.html（http.server 不发缓存头，实测出现过）。
    // 整个模块转「静默禁用」、所有方法 no-op：这里抛异常会一路掀掉整局
    // （#deathScreen 缺失那次就是这么塌的）。
    this._ok = !!(this._logEl && this._input && this._wrapEl);
    if (!this._ok) return;

    this._input.addEventListener("compositionstart", () => { this._composing = true; });
    this._input.addEventListener("compositionend", () => { this._composing = false; });
    this._setInputVisible(false);
    this._resetIdleClock(true);
  }

  // ---------------------------------------------------------------- 键盘

  /**
   * 唯一的键盘入口。返回 true = 已消费，调用方必须立刻 return（**不能**再往下走）。
   *
   * 使用方必须把它挂成 keydown 监听的**第一条语句**，且在 `keys[e.code] = true` 之前；
   * 也**不能**等走到后面再判 —— handler 末尾那两处 Space/方向键的 preventDefault
   * 提前 return 正好不执行，空格才打得进输入框。
   */
  handleKey(e) {
    if (!this._ok) return false;

    // 输入法组合态必须原样放行。中文输入法「选字」那一下也是 keydown Enter
    // （Chrome 报 isComposing=true、keyCode=229），不挡掉的话每条中文消息都会被
    // 当成「提交」而发成半截甚至空串。这也是所有聊天软件的惯例：第一次回车选字，
    // 第二次回车才发出去。
    if (e.isComposing || this._composing || e.keyCode === 229) return this._typing;

    if (this._typing) {
      // Tab 不挡的话浏览器会把焦点挪出输入框
      if (e.code === "Tab") { e.preventDefault(); return true; }
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        // 忽略 e.repeat：按住回车不放会反复开关/提交
        if (!e.repeat) this._submit();
        return true;
      }
      // Escape 在指针锁下通常**收不到**（Chrome 拿它去解锁），这里只是尽力而为。
      // 真正的取消路径是 pointerlockchange，见 main.js。
      if (e.code === "Escape") { e.preventDefault(); this.cancel(); return true; }
      // 其余按键放行给输入框，但整条游戏键盘路径在这里就断掉
      return true;
    }

    if ((e.code === "Enter" || e.code === "NumpadEnter") && !e.repeat) {
      if (this._canOpen && !this._canOpen()) return false;
      e.preventDefault();
      this.open();
      return true;
    }
    return false;
  }

  open() {
    if (!this._ok || this._typing) return;
    this._typing = true;
    if (this._input) this._input.value = "";
    this._setInputVisible(true);
    // 指针锁下没有光标，只能程序化聚焦（也正因如此，输入框不需要能点）
    try { this._input.focus(); } catch (err) { /* 忽略：拿不到焦点也不该掀掉整局 */ }
    if (this._onTypingChange) this._onTypingChange(true);
  }

  /** 丢弃草稿并收起输入框。幂等；不在输入态时什么都不做。 */
  cancel() {
    this._endInput();
  }

  isTyping() {
    return this._typing;
  }

  _endInput() {
    if (!this._typing) return;
    this._typing = false;
    if (this._input) {
      this._input.value = "";
      try { this._input.blur(); } catch (err) { /* 同上 */ }
    }
    this._setInputVisible(false);
    if (this._onTypingChange) this._onTypingChange(false);
  }

  /** 玩家发言（供 __tactical.chatSend 与提交路径共用，绕过输入框本身）。 */
  say(text) {
    const t = this._clean(text);
    if (!t) return false; // 空消息不占一行，也不触发应答
    this.push(PLAYER_CHAT_NAME, t, "me");
    this._scheduleReply(t);
    return true;
  }

  _submit() {
    const raw = this._input ? this._input.value : "";
    this._endInput();
    this.say(raw);
  }

  _clean(text) {
    const t = String(text == null ? "" : text)
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return t.slice(0, CHAT_TUNING.msgMax);
  }

  _setInputVisible(v) {
    if (this._wrapEl) this._wrapEl.classList.toggle("hidden", !v);
  }

  // ---------------------------------------------------------------- 台词

  /**
   * 导演入口。**只入队、不立刻发** —— 由 update(dt) 按冷却出队，
   * 这样同一帧的多类事件（onKill 一次就是击杀 + 爆头 + 连杀）能合并成一条。
   */
  taunt(cat, ctx) {
    if (!this._ok || !CHAT_LINES[cat] || !CHAT_LINES[cat].length) return;
    const pri = PRIORITY[cat] || 1;
    if (this._queue.length >= CHAT_TUNING.queueMax) {
      // 队列满了：只有比队里最低那条更高优先级的才挤得进来
      let low = 0;
      for (let i = 1; i < this._queue.length; i++) {
        if (this._queue[i].pri < this._queue[low].pri) low = i;
      }
      if (pri <= this._queue[low].pri) return;
      this._queue.splice(low, 1);
    }
    this._queue.push({ cat, ctx: ctx || {}, pri });
  }

  /** 直接说一句（不走队列）。测试与「系统播报」用。 */
  push(speaker, text, kind = "enemy") {
    if (!this._ok) return;
    const el = document.createElement("div");
    el.className = "chat-line " + kind;
    const nm = document.createElement("span");
    nm.className = "chat-name";
    nm.textContent = String(speaker == null ? "" : speaker) + "：";
    const tx = document.createElement("span");
    tx.className = "chat-text";
    tx.textContent = String(text == null ? "" : text); // 绝不 innerHTML
    el.appendChild(nm);
    el.appendChild(tx);
    el.style.opacity = "0";
    this._logEl.appendChild(el);

    this._lines.push({ speaker: String(speaker == null ? "" : speaker), text: String(text == null ? "" : text), kind, t: 0, el });
    while (this._lines.length > CHAT_TUNING.maxLines) {
      const old = this._lines.shift();
      if (old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el);
    }
    this._quiet = 0;
  }

  clear() {
    if (!this._ok) return;
    for (const L of this._lines) {
      if (L.el && L.el.parentNode) L.el.parentNode.removeChild(L.el);
    }
    this._lines.length = 0;
    this._queue.length = 0;
    this._reply = null;
    this._firstIdle = true;
    // 冷却与「刚说过话」的记账一起归零：新一局不该继承上一局的限流，
    // 也不该因为上一局的最后一句而把开局的冷场计时卡掉一轮。
    this._cd = 0;
    this._quiet = 1e9;
    this._resetIdleClock(true);
  }

  _resetIdleClock(first) {
    const lo = first ? CHAT_TUNING.firstIdleMin : CHAT_TUNING.idleMin;
    const hi = first ? CHAT_TUNING.firstIdleMax : CHAT_TUNING.idleMax;
    this._idleT = lo + Math.random() * Math.max(0, hi - lo);
  }

  // ---------------------------------------------------------------- 每帧

  update(dt) {
    if (!this._ok) return;
    const d = Number.isFinite(dt) && dt > 0 ? dt : 0;

    this._age(d);
    if (this._cd > 0) this._cd = Math.max(0, this._cd - d);
    this._quiet += d;

    // 玩家发言的应答排在最前：它是被明确「要求」的回应，不该被战斗播报挤掉
    if (this._reply) {
      this._reply.t -= d;
      if (this._reply.t <= 0 && this._cd <= 0) {
        const r = this._reply;
        this._reply = null;
        this._speak(r.cat, {});
      }
    }

    if (this._cd <= 0 && this._queue.length) {
      // 同一帧堆了多条 → 只出优先级最高的那条
      let best = 0;
      for (let i = 1; i < this._queue.length; i++) {
        if (this._queue[i].pri > this._queue[best].pri) best = i;
      }
      const it = this._queue.splice(best, 1)[0];
      this._speak(it.cat, it.ctx);
    }

    this._maybeIdle(d);
  }

  _age(dt) {
    const life = CHAT_TUNING.lineLife;
    for (let i = this._lines.length - 1; i >= 0; i--) {
      const L = this._lines[i];
      L.t += dt;
      if (L.t >= life) {
        if (L.el && L.el.parentNode) L.el.parentNode.removeChild(L.el);
        this._lines.splice(i, 1);
        continue;
      }
      if (!L.el) continue;
      // 淡入 0.15s，末尾 1.2s 淡出（每帧写 opacity，与 #crosshair 写 --gap 同一套做法）
      const fadeIn = Math.min(1, L.t / 0.15);
      const left = life - L.t;
      const fadeOut = left >= 1.2 ? 1 : Math.max(0, left / 1.2);
      L.el.style.opacity = (fadeIn * fadeOut).toFixed(3);
    }
  }

  _maybeIdle(dt) {
    this._idleT -= dt;
    if (this._idleT > 0) return;
    this._resetIdleClock(false);
    if (this._quiet < CHAT_TUNING.quietGap) return; // 刚有人说过话就别插嘴
    if (this._cd > 0) return;
    const cat = this._firstIdle ? "start" : "idle";
    this._firstIdle = false;
    this.taunt(cat, {});
  }

  _scheduleReply(text) {
    // 关键词只做**粗分流**：命中不了就落 generic。
    // 这张表绝不用来判「懂不懂」，只是让回应不至于永远同一档。
    const cat = /[?？]|吗|怎么|为什么|咋|多少|谁/.test(text)
      ? "reply_question"
      : /[!！]|菜|垃圾|来啊|不服|废物|怂|废/.test(text)
        ? "reply_taunt"
        : "reply_generic";
    const lo = CHAT_TUNING.replyMin;
    const hi = CHAT_TUNING.replyMax;
    this._reply = { cat, t: lo + Math.random() * Math.max(0, hi - lo) };
  }

  _pickSpeaker(ctx) {
    if (ctx && ctx.speaker) return String(ctx.speaker);
    const pool = this._getSpeakerNames ? this._getSpeakerNames() : null;
    if (pool && pool.length) return pool[(Math.random() * pool.length) | 0];
    return SPEAKER_FALLBACK;
  }

  /**
   * 洗牌袋：每个分类持一副没抽完的牌，抽空再洗一副新的。
   * 既保证「相邻两条不重复」，又保证长局里每句台词的出场率均匀 ——
   * 比「记住最后 N 条再重抽」稳得多。
   */
  _draw(cat) {
    const bank = CHAT_LINES[cat];
    if (!bank || !bank.length) return null;
    let deck = this._deck[cat];
    if (!deck || !deck.length) {
      deck = bank.map((_, i) => i);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const tmp = deck[i];
        deck[i] = deck[j];
        deck[j] = tmp;
      }
      this._deck[cat] = deck;
    }
    return bank[deck.pop()];
  }

  _speak(cat, ctx) {
    const tpl = this._draw(cat);
    if (!tpl) return;
    const text = tpl.replace(/\{(\w+)\}/g, (m, k) =>
      ctx && ctx[k] != null ? String(ctx[k]) : "")
      // 占位符补空之后会留下多余空格（"{name} 又送了" 缺 name 时变成 " 又送了"）。
      // 在源头收一次，任何分类以后加占位符都不用管调用方有没有给全。
      .replace(/\s{2,}/g, " ").trim();
    if (!text) return; // 整句都是占位符又没给值 → 宁可不发，也别发一条空的
    this.push(this._pickSpeaker(ctx), text, ctx && ctx.kind === "system" ? "system" : "enemy");
    this._cd = CHAT_TUNING.cooldown;
  }

  // ---------------------------------------------------------------- 只读快照

  state() {
    return {
      typing: this._typing,
      ok: this._ok,
      lines: this._lines.map((L) => ({ speaker: L.speaker, text: L.text, kind: L.kind, age: +L.t.toFixed(3) })),
      queued: this._queue.length,
      cooldown: +Math.max(0, this._cd).toFixed(2),
      hasReply: !!this._reply,
    };
  }
}
