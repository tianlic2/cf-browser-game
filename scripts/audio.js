// ===== 音效系统：采样 + 合成混合（Web Audio API）=====
//
// 架构（两句话）：
//   ① **现实里存在的声音**（枪声 / 脚步 / 换弹 / 命中 / 近战 / 爆炸 / 倒地 / 拉栓 /
//      **切枪收出 / 空枪干击 / 开镜退镜 / 按钮与页签 / 面板开合**）走 `audio/`
//      里的 CC0 真实录音（逐文件署名见 `audio/CREDITS.txt`）；
//   ② 回合结束 / 命中标记 / 单杀奖励音保持合成；连杀按用户要求使用 CF 经典英文男声采样。
//      连杀是明确例外：固定的人声演绎才是还原目标，不使用系统 TTS 或电子音阶。
//      announcer/ 的游戏语音不是 CC0，来源与归属单列在 audio/CREDITS.txt。
//
// 叙事内采样入口采用「采样优先、合成兜底」，兜底函数是 _playMapped() 的第三个参数：
//
//     this._playMapped("shoot", { id: "ak47_fire" }, () => this._shootSynth(kind));
//
// 把兜底做成**参数**而不是 `if (this.has(x))` 分支，是为了让「加了采样就忘了回退」在结构上
// 不可能发生。连杀人声独立处理：缺失时静默降级，避免退回用户明确不想要的合成播报。
//
// ---------------------------------------------------------------------------
// 三条纪律，改动本文件前先读：
//
// ① **绝不用实例字段覆盖原型方法名。** 本类有 30+ 个原型方法（shoot / reload / hit / kill /
//    hurt / footstep / muffle / send / empty / land / …）。历史上 `ensure()` 里写过
//    `this.muffle = ctx.createBiquadFilter()`，把同名方法 `muffle()` 整个盖掉，于是
//    `clearFlash()`（`beginDeath()` / `respawnPlayer()` 的第一行）每次调用都抛
//    `TypeError: sfx.muffle is not a function` —— 玩家一死死亡面板就不出现，3 秒后
//    `respawnPlayer` 每帧再抛一次、`update()` 走不完、`renderer.render` 永不执行：
//    **画面彻底冻住且永远无法复活**（实测踩到，排查了两轮）。
//    所以：信号链节点沿用 `master` / `hf` / `verb` / `wet` 这几个既有名字（都不是方法名），
//    **其余新增字段一律加下划线前缀**（`_buffers` / `_voices` / `_scheduled` / `_music` …）。
//
// ② **路径必须是文档相对字符串 `"./audio/..."`**。`fetch` 按**文档 URL** 解析，对 GitHub
//    Pages 的项目页（站点根在 `/<仓库名>/`）是对的。**绝不用
//    `new URL("./audio/x.ogg", import.meta.url)`** —— 那会解析到 `scripts/audio/...`，
//    静默 404（控制台只有一行 fetch 失败，游戏照跑）。
//
// ③ **排程一律用 Web Audio 的未来时刻 `start(t + delay)`，绝不用 `setTimeout`。**
//    `__tactical.pause()` 只停 rAF，用 ctx 时间轴才能一起冻住；无头用例也才能定步长快进。
//    代价是排出去的声音必须能被 `cancelReload()` / `cancelBolt()` 收回（换枪时旧枪的
//    换弹声不能接着响）。
//
// 已知局限（如实记录，不要当成做完了）：
//   · 只搬了一段 AK 换弹录音、切成三段，**M4 / 手枪 / AWM 共用** ⇒ 音色与枪不符。
//   · 三段之间是独立的 foley，不再是连续点击声 —— 这是一次真实的听感行为变化。
//   · **手枪与 M4 没有独立录音**，用 AK 变调（rate 1.22 / 1.08）派生，差异可辨但不如独立录音。
//   · 脚步录音是**混凝土/石材**，而地图是钢甲板 —— 用叠加合成金属环来补偿，不是真钢面脚步。
// =============================================================================

// ---- 素材表：槽位 id → 一组 stem（每个 stem 展开成 .ogg + .m4a 两个候选 URL）----
// 变体数 > 1 的槽位在每次播放时轮换（见 _pick），这是「同一段录音听不出在重复」的前提。
const SAMPLES = {
  cf_ak_fire: ["classic/ak47_fire.wav"],
  cf_ak_out: ["classic/ak47_out.wav"],
  cf_ak_in: ["classic/ak47_in.wav"],
  cf_ak_bolt: ["classic/ak47_bolt.wav"],
  cf_grenade_pin: ["classic/grenade_pin.wav"],
  cf_grenade_explode: ["classic/grenade_explode.wav"],
  cf_grenade_flash: ["classic/grenade_flash.wav"],
  cf_grenade_smoke: ["classic/grenade_smoke.wav"],
  ak47_fire:    ["weapons/ak47_fire"],
  ak47_distant: ["weapons/ak47_distant_a", "weapons/ak47_distant_b"],
  awp_fire:     ["weapons/awp_fire"],
  awp_bolt:     ["weapons/awp_bolt_1", "weapons/awp_bolt_2"],
  reload_1:     ["weapons/ak47_reload_1"],   // 弹匣出 / 弹匣入 / 拉栓上膛 —— 三段各自一个固定槽位，
  reload_2:     ["weapons/ak47_reload_2"],   // **绝不合成一个多元素槽位**（变体轮换会把三段顺序打乱）
  reload_3:     ["weapons/ak47_reload_3"],
  step:         ["footsteps/step_concrete_1", "footsteps/step_concrete_2", "footsteps/step_concrete_3",
                 "footsteps/step_concrete_4", "footsteps/step_concrete_5", "footsteps/step_concrete_6"],
  impact_wall:  ["impacts/impact_concrete_1", "impacts/impact_concrete_2", "impacts/impact_concrete_3",
                 "impacts/impact_concrete_4", "impacts/impact_concrete_5", "impacts/impact_concrete_6"],
  impact_flesh: ["impacts/impact_flesh_1", "impacts/impact_flesh_2", "impacts/impact_flesh_3"],
  ricochet:     ["impacts/ricochet_1", "impacts/ricochet_2"],
  headshot:     ["impacts/headshot"],
  hurt:         ["impacts/hurt"],
  brass:        ["impacts/brass_1", "impacts/brass_2", "impacts/brass_3",
                 "impacts/brass_4", "impacts/brass_5"],
  whiz:         ["impacts/whiz"],
  bodyfall:     ["foley/bodyfall"],
  explosion:    ["foley/c4_explode"],
  knife_swing:  ["melee/knife_swing"],
  knife_wall:   ["melee/knife_wall"],
  knife_flesh:  ["melee/knife_flesh_1", "melee/knife_flesh_2", "melee/knife_flesh_3"],
  // ---- 页面交互声：真实金属键（Kenney 合成 blip 已下线，见下）----
  ui_click:     ["ui/ui_click"],
  ui_switch:    ["ui/ui_switch"],
  ui_open:      ["ui/ui_panel_open"],
  ui_close:     ["ui/ui_panel_close"],
  // ---- 手上动作：同样是真实录音 ----
  // 这一批是「切枪是卡通音效」那次返工的落点：原来 `holster` / `deploy` /
  // `switchWeapon` / `empty` / `scopeIn` / `scopeOut` 全是 Web Audio 振荡器扫频（锯齿 +
  // 方波 + 正弦顿音），`ui` 是 Kenney 的 35~68ms 合成 click —— 都是「现实里不存在的声音」，
  // 听感就是卡通。现在全部换成 CC0 真实录音（枪械摆弄 / 金属按键），合成版降级成
  // `_…Synth` 兜底。逐条曲目见 `audio/CREDITS.txt`。
  //
  // ⚠️ 这里曾经还有一个 `match_start`（船笛），由 `roundStart()` 在开局那一下播放。
  // **已整个删除**（槽位 / 录音 / `roundStart()` / `_hornSynth()` 全没了）。照「现实里
  // 存不存在」那条分界线它本来是对的，但那是一段 0.97s、基频 ≈150Hz 的持续低鸣 ——
  // 用户实际听成「水牛的叫声」。**别再把它（或任何开局长鸣）加回来。**
  sw_deploy:         ["sw/deploy"],
  sw_holster:        ["sw/holster"],
  sw_deploy_pistol:  ["sw/deploy_pistol"],
  sw_holster_pistol: ["sw/holster_pistol"],
  // 刀（近战）**必须有自己的两条**：`type` 是 "melee"，在下面 `holster()` / `deploy()` 的
  // `pistol = type === "pistol"` 判据里既不等于 "pistol" 也不等于 "sniper"，于是原来
  // 落到**长枪那两条**上 —— 而它们的素材本来就是「M16 换弹全程」/「步枪摆弄」，听感是
  // 「子弹上膛」（用户报的正是这条）。这两条取的是金属入鞘/出鞘的脆响，与长枪/手枪同族
  // 但更亮（谱心 7.2k / 4.9k），素材出处与选片理由见 `audio/CREDITS.txt`。
  sw_deploy_knife:   ["sw/deploy_knife"],
  sw_holster_knife:  ["sw/holster_knife"],
  sw_dryfire:        ["sw/dryfire"],
  sw_scope_in:       ["sw/scope_in"],
  sw_scope_out:      ["sw/scope_out"],
  music:        ["ui/lobby_theme"],
  // CF Global Risk 男声：2~8 杀七档，8 杀以上沿用最高档；计数与 HUD 不封顶。
  cf_streak_2: ["announcer/cf_gr_2"],
  cf_streak_3: ["announcer/cf_gr_3"],
  cf_streak_4: ["announcer/cf_gr_4"],
  cf_streak_5: ["announcer/cf_gr_5"],
  cf_streak_6: ["announcer/cf_gr_6"],
  cf_streak_7: ["announcer/cf_gr_7"],
  cf_streak_8: ["announcer/cf_gr_8"],
};

// 只有 .m4a、没有 .ogg 的 stem（**按 stem 路径写，不是槽位 id**）。
// 原因：本机没有 Vorbis 编码器 —— macOS 的 afconvert 能解码 ogg、能写 AAC/m4a，但只写
// m4af / WAVE / AIFF / AIFC / CAF / ADTS，**写不了 Ogg 容器**。而这些不是从参考项目搬来的，
// 是我们自己从 wav / mp3 编的，所以只能出 m4a。列在这里是为了**不去请求不存在的 .ogg**
// （否则每个 stem 白挨一次 404，`failed[]` 也会被污染 —— 那是「零加载失败」断言的污染）。
const M4A_ONLY = new Set([
  "ui/ui_click", "ui/ui_switch", "ui/ui_panel_open", "ui/ui_panel_close", "ui/lobby_theme",
  "sw/deploy", "sw/holster", "sw/deploy_pistol", "sw/holster_pistol",
  "sw/deploy_knife", "sw/holster_knife",
  "sw/dryfire", "sw/scope_in", "sw/scope_out",
]);

// 自动武器只播「初始爆裂声」，丢掉 1.7 s 的尾巴（不丢的话 0.09 s 的射击间隔会堆成一团糊音）。
// window = 0 表示整段播完（狙击的射击间隔 1.45 s，够长）。
const GUN = {
  ak:     { sample: "cf_ak_fire", rate: 1.00, window: 0.8, vol: 0.85, crack: 0 },
  m4:     { sample: "ak47_fire", rate: 1.08, window: 0.26, vol: 0.92, crack: 0.55 },
  awm:    { sample: "awp_fire",  rate: 1.00, window: 0,    vol: 1.00, crack: 0 },
  pistol: { sample: "ak47_fire", rate: 1.22, window: 0.22, vol: 0.78, crack: 0.25 },
};
const GUN_BY_TYPE = { rifle: "ak", sniper: "awm", pistol: "pistol" };

const MAX_VOICES = 24;      // 声部上限（超了直接丢，不排队）—— 与参考项目同量级
const MUSIC_VOL = 0.5;      // 大厅 BGM 的干声电平（master 还有 0.6，所以实际约 0.3）
const RATE_JITTER = 0.015;  // 默认 ±1.5% 变调；脚步 / 命中另给更大的抖动

// decodeAudioData 有 promise 与回调两副面孔（老 Safari 只有回调）。
// 两副都接上：重复 settle 是无害的 no-op。
function decode(dec, ab) {
  return new Promise((res, rej) => {
    const p = dec.decodeAudioData(ab, res, rej);
    if (p && typeof p.then === "function") p.then(res, rej);
  });
}

export class SFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;

    this.maxVoices = MAX_VOICES;
    this._voices = 0;
    this._buffers = new Map();   // 槽位 id → AudioBuffer[]
    this._variantIdx = {};       // 槽位 id → 上一个用过的下标（绝不连着重复同一个变体）
    this._loaded = [];           // 成功解码的 "stem.ext"
    this._failed = [];           // { id, url, err }
    this._done = 0;
    this._total = 0;
    this._preloadPromise = null;
    this._preloadDone = false;
    this._decoder = null;        // OfflineAudioContext，纯解码器（AudioBuffer 与创建它的 context 无关）
    this._scheduled = new Set(); // 可取消的排程句柄（换弹 / 拉栓）
    this._last = null;           // 最近一次发声尝试（?debug 读口）
    this._lpos = null;           // 听者位置（每帧由 updateListener 写）
    this._music = null;
    this._musicOn = false;

    // 首次手势解锁 AudioContext。**这与 #startBtn 里那句 sfx.ensure() 是两回事**：
    // 那句是无头测试引导音频图的既定入口（保留原样、不要动），而这一句让「点一下大厅页签」
    // 也能把 context 建起来 —— 否则第一次交互的 UI 声与大堂 BGM 全是哑的。
    const unlock = () => {
      if (!this.ctx) { this.ensure(); return; }
      if (this.ctx.state !== "running") this.ctx.resume();
    };
    addEventListener("pointerdown", unlock);
    addEventListener("keydown", unlock);
  }

  ensure() {
    // 需在用户手势后调用以解锁 AudioContext
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: "interactive" });
      const out = this.ctx.createGain();
      out.gain.value = 0.6;

      // master 与 destination 之间插两级：
      //   comp      —— 总线压缩。它的职责是兜住**病态并发**（同一帧十几声这种），
      //               不是常态满梭的保险：开窗播放之后一次真实满梭（20 发 @83ms）旁路
      //               峰值只有 0.788，本来就不削顶（见 DESIGN.md「音效设计」那节）。
      //               注意 Chromium 的 comp 带一段**未写进规范的 makeup gain**，阈值以下
      //               也抬 +1.97 dB —— 别拿「阈值以下透明」当调试前提。
      //   muffleNode—— 闪光弹的「听力闷住」直接调它的截止频率。
      // 顺序是 master → comp → muffleNode → destination：混响尾巴从 master 上游进来，
      // 所以闷音会把混响一起闷住（这是想要的）。
      //
      // 字段名必须叫 muffleNode：叫 this.muffle 会**盖掉同名的 muffle() 方法**（原型方法被
      // 实例属性遮蔽），ensure() 一跑 sfx.muffle 就变成 BiquadFilterNode，之后每次
      // sfx.muffle(...) 都抛 "sfx.muffle is not a function"。clearFlash() 正是这么调的，
      // 而它是 beginDeath()/respawnPlayer() 的第一行 —— 于是玩家一死，死亡面板不出现，
      // 3 秒后 respawnPlayer 每帧抛异常、update() 走不完、renderer.render 永不执行：
      // 画面彻底冻住且永远无法复活（实测踩到，且因为旧的无头用例从不点「进入战场」、
      // sfx.ensure() 没跑过，这条路径一直没被覆盖）。
      this.muffleNode = this.ctx.createBiquadFilter();
      this.muffleNode.type = "lowpass";
      this.muffleNode.frequency.value = 20000; // 常温即全通
      this.muffleNode.Q.value = 0.0001;

      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -10;
      this.comp.knee.value = 12;
      this.comp.ratio.value = 4;
      this.comp.attack.value = 0.002;
      this.comp.release.value = 0.12;

      out.connect(this.comp).connect(this.muffleNode).connect(this.ctx.destination);
      this.master = out;

      // 耳鸣是 4.4kHz 高频，过 700Hz 低通会被削没 —— 单独一条不经过 muffle 的总线
      this.hf = this.ctx.createGain();
      this.hf.gain.value = 1;
      this.hf.connect(this.ctx.destination);

      // 小型空间混响（仓库/金属货舱回声）。注意：**录音自带的尾音已经过了空间渲染**，
      // 所以 enemyShoot / explosion / whiz / UI 一律走 wet 0 或很小的 wet（见各处）。
      this.verb = this.ctx.createConvolver();
      const len = this.ctx.sampleRate * 1.1;
      const imp = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = imp.getChannelData(ch);
        for (let i = 0; i < len; i++)
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      this.verb.buffer = imp;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.16;
      this.verb.connect(wet).connect(this.master);
      this.wet = wet;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    // context 建起来了 —— 补触发素材预载与「大厅 BGM 的意愿」（可能是在 ctx 之前就被设上的）
    if (!this._preloadPromise) this.preload();
    if (this._musicOn && !this._music) this._startMusic();
  }

  // ---- 预载（与 ensure() 分离）----
  // **绝不能把预载塞进 ensure()**：ensure() 的语义是「同步、幂等、只由用户手势调起」，
  // 变成异步网络副作用会让第一局在缓冲还在下载时开局。
  // preload() 幂等、**永不 reject** —— 每个文件独立 try/catch 并记入 _failed。
  // （异步预载的 reject 会绕过 __errs 与 loopErrors()，所以必须在这里内部捕获。）
  preload() {
    if (this._preloadPromise) return this._preloadPromise;
    this._preloadPromise = this._doPreload();
    return this._preloadPromise;
  }

  async _doPreload() {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    let dec = this.ctx;
    if (!dec && !this._decoder) this._decoder = OAC ? new OAC(1, 1, 48000) : null;
    if (!dec) dec = this._decoder;
    if (!dec) { this._preloadDone = true; return this; }   // 浏览器连解码器都没有 —— 全部退回合成
    const jobs = [];
    for (const [id, stems] of Object.entries(SAMPLES)) {
      for (const stem of stems) { this._total++; jobs.push(this._loadOne(dec, id, stem)); }
    }
    await Promise.all(jobs);
    this._preloadDone = true;
    if (this._musicOn && this.ctx && !this._music) this._startMusic();
    return this;
  }

  async _loadOne(dec, id, stem) {
    const cands = /\.wav$/i.test(stem) ? [""] : M4A_ONLY.has(stem) ? [".m4a"] : [".ogg", ".m4a"];
    let last = "./audio/" + stem + cands[0];
    let err = null;
    for (const ext of cands) {
      last = "./audio/" + stem + ext;
      try {
        const res = await fetch(last);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const buf = await decode(dec, await res.arrayBuffer());
        if (!this._buffers.has(id)) this._buffers.set(id, []);
        this._buffers.get(id).push(buf);
        this._loaded.push(stem + ext);
        this._done++;
        return;
      } catch (e) { err = e; }
    }
    this._failed.push({ id, url: last, err: String((err && err.message) || err) });
    this._done++;
    // 只在开发时提示，不是错误：整条链路会退回合成，游戏照跑
    if (typeof console !== "undefined") console.warn("audio: 素材加载失败", last, err);
  }

  // 同时送干声到主输出与踢入混响。`wet` 是**逐次播放**的混响量：
  // ak47_distant_* / c4_explode / bodyfall / whiz 与全部 UI 声**自带尾音或不该有混响**，
  // 一律传 0；枪声、命中、脚步这类「发生在货舱里」的才给 1。
  send(node, wet = 1) {
    node.connect(this.master);
    if (!this.verb || wet <= 0) return;
    if (wet >= 1) { node.connect(this.verb); return; }
    const g = this.ctx.createGain();
    g.gain.value = wet;
    node.connect(g).connect(this.verb);
  }

  // ---- 素材播放原语 ----
  // 绝不连着重复同一个变体（洗牌袋的轻量版：只记上一个下标）
  _pick(id) {
    const a = id ? this._buffers.get(id) : null;
    if (!a || !a.length) return null;
    if (a.length === 1) return a[0];
    let i = Math.floor(Math.random() * a.length);
    if (i === this._variantIdx[id]) i = (i + 1) % a.length;
    this._variantIdx[id] = i;
    return a[i];
  }

  _dist3(x, y, z) {
    const p = this._lpos;
    if (!p || typeof x !== "number") return 12;
    const dx = x - p.x, dy = (y == null ? 0 : y) - p.y, dz = z - p.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // 空气吸收：距离越远高频越少。上限夹在 900Hz（再低就成水下音了）。
  _absorb(dist) {
    return Math.max(900, 20000 - dist * 180);
  }

  /**
   * 播一条采样。返回句柄 `{ src, gain, dur, at, delay, stop }` 或 null（没有这个槽位）。
   * `o` 支持：id/sample（槽位）、vol、rate、rateJitter、window、lowpass、wet、
   *           delay、x/y/z（世界坐标 → panner）、schedule（可取消标签）、volJitter、hudBus
   */
  _sample(id, o = {}) {
    if (!this.ready()) return null;
    const buf = this._pick(id);
    if (!buf) return null;
    const c = this.ctx;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = buf;
    const rate = (o.rate == null ? 1 : o.rate) *
      (1 + (Math.random() - 0.5) * 2 * (o.rateJitter == null ? RATE_JITTER : o.rateJitter));
    src.playbackRate.value = rate;
    const full = buf.duration / rate;
    const win = o.window > 0 ? Math.min(o.window, full) : 0;
    const dur = win || full;

    let node = src;
    if (o.lowpass) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = Math.max(300, o.lowpass);
      f.Q.value = 0.5;
      node.connect(f);
      node = f;
    }

    const gain = c.createGain();
    // ±1.5 dB 的音量抖动 —— 与变调抖动一起构成「听不出在重复」
    const volJitter = o.volJitter == null ? 0.17 : o.volJitter;
    const vol = Math.max(0.0001, (o.vol == null ? 1 : o.vol) * (1 + (Math.random() - 0.5) * 2 * volJitter));
    gain.gain.value = vol;
    if (win) {
      // 窗口末尾 20ms 的 release 斜坡：硬切会切出一声 click
      const rel = Math.min(0.02, dur * 0.5);
      gain.gain.setValueAtTime(vol, Math.max(t, t + dur - rel));
      gain.gain.linearRampToValueAtTime(0.0001, t + dur);
    }
    node.connect(gain);

    if (o.hudBus) {
      // 固定的界面人声：不受距离、闪光低通或货舱混响影响。
      gain.connect(this.hf);
    } else if (typeof o.x === "number") {
      // 有世界坐标 → 走 panner（左右 + 远近），这正是 FPS 里最关键的听觉信息
      const pn = this.panner(o.x, o.y == null ? 0 : o.y, o.z);
      gain.connect(pn);
      this.send(pn, o.wet == null ? 1 : o.wet);
    } else {
      this.send(gain, o.wet == null ? 1 : o.wet);
    }

    // start(when, offset, duration)：duration 的单位是**缓冲秒**，所以输出 win 秒要乘 rate。
    // 排程用未来时刻而不是 setTimeout（见文件头纪律 ③）。
    if (win) src.start(t, 0, win * rate); else src.start(t);
    this._voices++;

    const h = {
      src, gain, dur, at: t, delay: o.delay || 0, method: o.schedule || null, stopped: false,
      stop: (fade = 0.03) => {
        if (h.stopped) return;
        h.stopped = true;
        const now = c.currentTime;
        try { gain.gain.cancelScheduledValues(now); } catch (_) {}
        try { gain.gain.setTargetAtTime(0, now, Math.max(0.001, fade / 3)); } catch (_) {}
        try { src.stop(now + fade + 0.02); } catch (_) {}
      },
    };
    src.onended = () => {
      this._voices--;
      if (h.method) this._scheduled.delete(h);
      try { src.disconnect(); gain.disconnect(); } catch (_) {}
    };
    if (o.schedule) this._scheduled.add(h);
    return h;
  }

  // 单个入口：采样优先、合成兜底。**兜底函数是参数**，结构上不可能忘记。
  _playMapped(method, o, synthFn) {
    o = o || {};
    if (this._voices >= this.maxVoices) { this._note(method, o, "capped", 0); return false; }
    const h = this._sample(o.sample || o.id, o);
    if (h) { this._note(method, o, "sample", h.dur); return true; }
    synthFn();
    this._note(method, o, "synth", 0);
    return false;
  }

  // ?debug 读口的唯一数据源 —— 没有它，「混合式」与「采样全挂、全靠合成」在听感上都正常。
  _note(method, o, reason, dur) {
    if (o && o.quiet) return;
    this._last = {
      method,
      kind: (o && o.kind) || null,
      id: (o && o.id) || null,
      dur: Math.round((dur || 0) * 1000) / 1000,
      reason,
    };
  }

  // ---- 取消：预先排出去的排程必须能收回（换枪时旧枪的换弹声不能接着响）----
  cancelScheduled(method, fade = 0.03) {
    if (!this._scheduled.size) return;
    for (const h of Array.from(this._scheduled)) {
      if (method && h.method !== method) continue;
      h.stop(fade);
    }
  }
  cancelReload() { this.cancelScheduled("reload"); }
  cancelBolt() { this.cancelScheduled("bolt"); }
  cancelStreak() { this.cancelScheduled("streak", 0.015); }

  // ---- 闪光弹：听力闷住 / 耳鸣 ----
  // 快速闷住再缓慢回升（频率天然 >0，不会踩到 exponentialRamp 目标值为 0 的坑）
  muffle(dur = 5.5, to = 700) {
    if (!this.ready()) return;
    const f = this.muffleNode.frequency, t = this.ctx.currentTime;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(f.value, 1), t);
    f.exponentialRampToValueAtTime(to, t + 0.05);
    f.setValueAtTime(to, t + dur * 0.45);
    f.exponentialRampToValueAtTime(20000, t + dur);
  }

  // 耳鸣：两个邻近高频正弦的拍频制造「滋滋」感，走独立高频总线不被低通削掉
  tinnitus(dur = 6, level = 0.07) {
    if (!this.ready()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.02);
    g.gain.setValueAtTime(level, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.hf);
    for (const f of [4400, 4420]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    // 轻微的音量起伏，比纯正弦更像真实耳鸣
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.3;
    const lg = ctx.createGain();
    lg.gain.value = level * 0.35;
    lfo.connect(lg).connect(g.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }

  // ---- 位置音效（敌人枪声 / 敌人脚步 / 命中 / 倒地）----
  panner(x, y, z) {
    const p = this.ctx.createPanner();
    p.panningModel = "equalpower";   // hrtf 每节点 CPU 明显更高，同屏十几个不划算
    p.distanceModel = "inverse";
    p.refDistance = 6;
    p.maxDistance = 90;
    p.rolloffFactor = 1.1;
    if (p.positionX) {
      p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
    } else if (p.setPosition) {
      p.setPosition(x, y, z);
    }
    return p;
  }

  // 每帧同步一次听者位姿（位置 + 朝向），PannerNode 便自动给出左右与远近
  updateListener(pos, yaw) {
    if (!this.ctx) return;
    this._lpos = { x: pos.x, y: pos.y, z: pos.z };
    const L = this.ctx.listener;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(pos.x, t, 0.02);
      L.positionY.setTargetAtTime(pos.y, t, 0.02);
      L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fx, t, 0.02);
      L.forwardY.setTargetAtTime(0, t, 0.02);
      L.forwardZ.setTargetAtTime(fz, t, 0.02);
      L.upX.setTargetAtTime(0, t, 0.02);
      L.upY.setTargetAtTime(1, t, 0.02);
      L.upZ.setTargetAtTime(0, t, 0.02);
    } else if (L.setPosition) {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  // 有声源坐标就走 panner 定位，否则直接进主输出（合成回退专用）
  out3d(node, x, y, z, wet = 1) {
    if (x === undefined || x === null) { this.send(node, wet); return; }
    const pn = this.panner(x, y, z);
    node.connect(pn);
    this.send(pn, wet);
  }

  noiseBuffer(dur) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(rate * dur), rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  ready() {
    return this.enabled && this.ctx;
  }

  // ==========================================================================
  // 采集入口（采样优先）
  // ==========================================================================

  // 枪声。`id` 是**武器 id**（ak/m4/awm/pistol）—— 只有它能区分 AK 与 M4，两者的
  // `def.type` 都是 "rifle"。省略时按 type 兜底。
  shoot(kind, id) {
    if (!this.ready()) return;
    const key = GUN[id] ? id : (GUN_BY_TYPE[kind] || "ak");
    const g = GUN[key];
    this._playMapped("shoot", {
      id: id || kind || "rifle",   // 记录的是**武器 id**，读口靠它区分 AK / M4
      sample: g.sample,
      kind: kind || "rifle",
      rate: g.rate, window: g.window, vol: g.vol, rateJitter: key==='ak'?0:0.012, wet: key==='ak'?0:1,
    }, () => this._shootSynth(kind));
    // M4 / 手枪没有独立录音（用 AK 变调派生）—— 叠一层更高的合成机匣爆音把音色拉开
    if (g.crack > 0) this._crackLayer(g.crack);
    // 空弹壳：0.42s 后落地。**quiet** —— 这是子层，不该覆盖 lastAttempt
    this._playMapped("brass", {
      id: "brass", delay: 0.42, vol: 0.35, wet: 0.3, rateJitter: 0.06, quiet: true,
    }, () => this.shellPing(this.ctx.currentTime + 0.055));
  }

  // 拉栓（AWM）。延迟 0.20s 让 1.31s 枪声的起音先出来。
  // 两个 take 是**独立的两段录音**，随机选一个，不是一段动作的两半 —— 所以是一个多元素槽位。
  bolt() {
    if (!this.ready()) return;
    this._playMapped("bolt", {
      id: "awp_bolt", delay: 0.2, vol: 1.0, wet: 0.4, rateJitter: 0.03, schedule: "bolt",
    }, () => this._boltSynth(0.2));
  }

  // 换弹。三段**按 reloadDur 的比例**排程（p = 0.16 / 0.58 / 0.80），
  // **绝不拉伸采样**（0.7s 的 foley 拉到 2.4s 是 0.29× 慢放，会变成怪声）。
  // 三段顺序由「三个不同的槽位」保证，不会被变体轮换打乱。
  reload(o) {
    if (!this.ready()) return;
    const dur = (o && o.dur) || 2.43;
    const wid = (o && o.id) || "reload";
    // AK's authored reload events are frames 39 / 102 / 202 of 299.
    const ps = wid==='ak' ? [39/299,102/299,202/299] : [0.16, 0.58, 0.80];
    const ids = wid==='ak' ? ["cf_ak_out", "cf_ak_in", "cf_ak_bolt"] : ["reload_1", "reload_2", "reload_3"];
    const fs = [900, 650, 700];
    const times = ps.map((p) => this.ctx.currentTime + p * dur);
    const hits = [];
    for (let i = 0; i < 3; i++) {
      const h = this._sample(ids[i], { delay: ps[i] * dur, vol: 0.9, wet: 0.5, schedule: "reload" });
      hits.push(!!h);
      if (!h) this._click(times[i], fs[i], 0.2);   // 采样缺一段就补一段合成点击
    }
    this._note("reload", { id: wid, kind: wid }, hits.some(Boolean) ? "sample" : "synth", ps[2] * dur);
  }

  // 空枪：真枪干击（`sw/dryfire` = 725402 那一下，后面全是静音，所以窗口够干净）。
  // 这个声音出现得很频繁（空弹匣时按住左键每次都响），所以**故意压得比其它动作轻**、
  // 且 rate 抖动略大 —— 连响十下要像「同一个动作重复」，不能像十种不同的声音。
  empty() {
    if (!this.ready()) return;
    this._playMapped("empty", {
      id: "sw_dryfire", vol: 0.5, rateJitter: 0.07, wet: 0.12,
    }, () => this._emptySynth());
  }

  // 命中敌人（奖励标记音 —— 与 impact 的肉体采样同时响，CF 的手感就靠这一声）
  hit() {
    if (!this.ready()) return;
    this._note("hit", null, "synth", 0);
    this._hitSynth();
  }

  // 击杀播报（奖励音调）
  kill() {
    if (!this.ready()) return;
    this._note("kill", null, "synth", 0);
    this._killSynth();
  }

  // 玩家受伤
  hurt() {
    if (!this.ready()) return;
    this._playMapped("hurt", { id: "hurt", vol: 0.85, wet: 0.2, rateJitter: 0.04 },
      () => this._hurtSynth());
  }

  // 敌人射击。远（> 25m）用专门录的「隔着战场的一枪」，近用枪声本体。
  // **一律 wet 0**：录音本身已经过了空间渲染，再叠我们的 convolver 就是双重空间化。
  // 仍走 panner —— 方向感是 FPS 的关键信息。
  enemyShoot(x, y, z) {
    if (!this.ready()) return;
    const dist = this._dist3(x, y, z);
    const far = dist > 25;
    this._playMapped("enemyShoot", {
      id: far ? "ak47_distant" : "ak47_fire",
      kind: far ? "far" : "near",
      x, y, z, wet: 0, vol: far ? 0.72 : 0.85, rateJitter: 0.05,
      lowpass: this._absorb(dist),
    }, () => this._enemyShootSynth(x, y, z));
  }

  // 爆头（奖励音调，但也换成了采样：那一声「叮」本来就是录音更好听）
  headshot() {
    if (!this.ready()) return;
    this._playMapped("headshot", { id: "headshot", vol: 0.95, wet: 0.2 },
      () => this._headshotSynth());
  }

  // 脚步。**玩家与敌人必须分档**：玩家的不带坐标 ⇒ 绕过 panner、全声级抵达耳边；
  // 敌人走 panner（refDistance 6 / rolloff 1.1）。采样峰值统一归一到 0.95，同声级播放
  // 会让**玩家自己的脚步盖掉敌人脚步**，而脚步方向是关键的 FPS 信息。
  footstep(x, y, z) {
    if (!this.ready()) return;
    const local = x === undefined || x === null;
    const mapped = this._sample("step", {
      x, y, z, vol: local ? 0.5 : 0.95, rateJitter: 0.06, wet: 0.35,
    });
    this._note("footstep", { id: "step", kind: local ? "player" : "enemy" }, mapped ? "sample" : "synth", mapped ? mapped.dur : 0);
    // 金属环层：**无损叠加**（不是回退）—— 录音是混凝土/石材，地图是钢甲板，
    // 这一层是「脚下是船」的唯一线索。玩家侧给得比敌人侧轻，别盖过头。
    this._footstepRing(x, y, z, local);
  }

  // 起跳（衣物摩擦的低频）
  jump() {
    if (!this.ready()) return;
    this._note("jump", null, "synth", 0);
    this._jumpSynth();
  }

  // 落地闷响，强度按冲击速度（玩家自馈，合成更可控 —— 保持合成）
  land(strength = 1) {
    if (!this.ready()) return;
    this._note("land", null, "synth", 0);
    this._landSynth(strength);
  }

  // 烟雾弹落地后的嘶嘶声
  smokeHiss(x, y, z) {
    if (!this.ready()) return;
    this._note("smokeHiss", null, "synth", 0);
    this._playMapped('smokeHiss',{id:'cf_grenade_smoke',x,y,z,vol:.8,wet:0},()=>this._smokeHissSynth(x,y,z));
  }

  // 闪光弹：爆响 + 耳鸣 + 听力闷住，一次调完
  flashbang(dur = 5,position) {
    if (!this.ready()) return;
    this._note("flashbang", null, "synth", 0);
    this._playMapped('flashbang',{id:'cf_grenade_flash',x:position?.x,y:position?.y,z:position?.z,vol:.9,wet:0},()=>this._flashbangSynth(0,position));
    if(dur>0){this.tinnitus(dur,.075);this.muffle(dur*.9);}
  }

  // 子弹打在掩体或人身上。`p` 给 { x, y, z }（THREE.Vector3 也行）。
  // kind: "wall"（30% 跳弹）/ "flesh" / "metal"（跳弹）/ "knife_wall" / "knife_flesh"
  impact(p, kind = "wall") {
    if (!this.ready()) return;
    const x = p ? p.x : undefined, y = p ? p.y : 0, z = p ? p.z : undefined;
    let slot = "impact_wall", vol = 0.75;
    if (kind === "flesh") slot = "impact_flesh";
    else if (kind === "knife_flesh") slot = "knife_flesh";
    else if (kind === "knife_wall") slot = "knife_wall";
    else if (kind === "metal" || Math.random() < 0.3) slot = "ricochet";
    if (kind === "flesh" || kind === "knife_flesh") vol = 0.9;
    this._playMapped("impact", {
      id: slot, kind, x, y, z, vol, wet: 0.35, rateJitter: 0.05,
    }, () => this._impactSynth(kind));
  }

  // 子弹掠过耳边（敌人打偏）。坐标由 main.js 按弹道算好传进来。
  whiz(x, y, z) {
    if (!this.ready()) return;
    this._playMapped("whiz", { id: "whiz", x, y, z, vol: 0.8, wet: 0, rateJitter: 0.08 },
      () => this._whizSynth(x, y, z));
  }

  // 敌人倒地（替代「击杀只有一声音调」：现在还有一具身体砸在钢甲板上）
  enemyDeath(x, z, head) {
    if (!this.ready()) return;
    this._playMapped("enemyDeath", {
      id: "bodyfall", kind: head ? "head" : "body",
      x, y: 0.2, z, vol: 0.95, wet: 0.3, rateJitter: 0.04,
    }, () => this._bodyfallSynth(x, z));
  }

  // 近战挥砍。`heavy` 只影响**合成回退**与音量 —— 采样是同一段挥风声
  // （砍中人体 / 砍中钢板由调用方另外调 impact("knife_flesh" / "knife_wall")）。
  melee(heavy) {
    if (!this.ready()) return;
    this._playMapped("melee", {
      id: "knife_swing", kind: heavy ? "heavy" : "light",
      vol: heavy ? 1.0 : 0.85, rate: heavy ? 0.9 : 1.0, rateJitter: 0.05, wet: 0.4,
    }, () => this._meleeSynth(heavy));
  }

  // 手雷拉环与抛出
  throwGrenade() {
    if (!this.ready()) return;
    this._note("throwGrenade", null, "synth", 0);
    this._meleeSynth(false);
  }

  grenadePin() {
    if(!this.ready())return;
    this._playMapped('grenadePin',{id:'cf_grenade_pin',vol:.7,wet:0},()=>this._throwGrenadeSynth());
  }

  grenadeBounce(p,speed) {
    if(!this.ready())return;
    const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type='triangle';o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(85,t+.09);
    g.gain.setValueAtTime(Math.min(.16,.025*speed),t);g.gain.exponentialRampToValueAtTime(.0001,t+.12);
    o.connect(g);this.out3d(g,p.x,p.y,p.z,.15);o.start(t);o.stop(t+.13);
  }

  // 爆炸。**wet 0** —— c4_explode 录音自带 2.4s 的轰鸣尾音，再踢进 convolver 会糊成一片。
  explosion(position) {
    if (!this.ready()) return;
    this._playMapped("explosion", { id: "cf_grenade_explode", x:position?.x,y:position?.y,z:position?.z,vol: 1.0, wet: 0 },
      () => this._explosionSynth());
  }

  // ---- 页面交互声（只做点击与切换，不做悬停）----
  // 四个 kind：click（按钮）/ switch（页签）/ open / close（面板开合）
  //
  // 四个槽位现在是**四段不同的真实录音**（金属按键 / 金属夹克扣），不再共用一个合成 blip。
  // 音色本来就分开（质心 6.4k / 6.3k / 5.0k / 3.3k Hz），`rate` 只做**方向感**的微差
  // （页签往上一点、面板收起来往下一点）—— 这是设计，不是没换素材。
  // `wet: 0`：UI 声不该有混响（与 enemyShoot / explosion 同一条理由）。
  ui(kind = "click") {
    if (!this.ready()) return;
    const S = {
      click: { slot: "ui_click", rate: 1.00, vol: 0.70 },
      switch: { slot: "ui_switch", rate: 1.06, vol: 0.68 },
      open: { slot: "ui_open", rate: 0.96, vol: 0.70 },
      close: { slot: "ui_close", rate: 0.94, vol: 0.70 },
    };
    const s = S[kind] || S.click;
    this._playMapped("ui", {
      id: s.slot, kind, vol: s.vol, rate: s.rate, wet: 0, rateJitter: 0.03,
    }, () => this._uiSynth(kind));
  }

  // ---- 大厅背景音乐（循环）----
  // 幂等：重复设同一状态不会重启播放。ctx 还没建起来时只记下意愿，ensure() 里补。
  setMusic(on) {
    on = !!on;
    if (this._musicOn === on) return;
    this._musicOn = on;
    if (!this.ctx) return;
    if (on) this._startMusic();
    else this._stopMusic();
  }

  _startMusic() {
    if (this._music || !this.ready()) return;
    const buf = this._pick("music");
    if (!buf) return;   // 素材没加载出来就静默（大厅没背景音乐，游戏照跑）
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(MUSIC_VOL, c.currentTime + 0.6);
    src.connect(g).connect(this.master);
    src.start();
    this._music = { src, gain: g };
  }

  _stopMusic() {
    const m = this._music;
    this._music = null;
    if (!m) return;
    const now = this.ctx.currentTime;
    try { m.gain.gain.cancelScheduledValues(now); } catch (_) {}
    try { m.gain.gain.setValueAtTime(Math.max(0.0001, m.gain.gain.value), now); } catch (_) {}
    try { m.gain.gain.linearRampToValueAtTime(0.0001, now + 0.6); } catch (_) {}
    try { m.src.stop(now + 0.65); } catch (_) {}
  }

  // ==========================================================================
  // 连杀人声 / 奖励音调
  // ==========================================================================

  // CF 经典保卫者男声。每次只保留最新一档，不排成长队、不叠电子音阶。
  // 40ms 起播窗口把同一帧的手雷多杀合并到最高档；旧句在 35ms 内淡出并停止。
  // 缺素材只保留视觉反馈，绝不退回系统 TTS（声线随设备变）或旧方波琶音。
  // 语音只有七档；8 杀以上复用最后一句，真实连杀计数仍由 main.js 无限递增。
  streak(n) {
    if (!this.ready() || !Number.isFinite(n) || n < 2) return false;
    this.cancelStreak();
    const id = "cf_streak_" + Math.min(8, Math.floor(n));
    const opts = {
      id, kind: "streak", vol: 0.65, volJitter: 0,
      rate: 1, rateJitter: 0, wet: 0, hudBus: true,
      delay: 0.04, schedule: "streak",
    };
    // 独立单声道人声不受枪声池抢占；前一句已收掉，不会持续叠加声部。
    const h = this._sample(id, opts);
    this._note("streak", opts, h ? "sample" : "missing", h ? h.dur : 0);
    return !!h;
  }

  // ⚠️ 这里曾有两个方法：`roundStart()`（开局那一下）与它的合成兜底 `_hornSynth()`
  // （低音锯齿 + 五度叠音的汽笛）。**两个都已删除** —— 连同它们用的 `match_start` 槽位
  // 与 `audio/ui/match_start.m4a`。理由见文件上方 SAMPLES 那段 ⚠️：0.97s / ≈150Hz 的持续
  // 低鸣，用户听成「水牛的叫声」。**别再写回来。**
  // 这条与「现实里存不存在」那条分界线不冲突：删它是因为**听感不对**，不是因为判据变了。

  roundEnd(win) {
    if (!this.ready()) return;
    this._note("roundEnd", { kind: win ? "win" : "lose" }, "synth", 0);
    const ctx = this.ctx, t = ctx.currentTime;
    const seq = win ? [523, 659, 784, 1046] : [523, 440, 349, 262];
    seq.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const at = t + i * 0.18;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
      o.connect(g).connect(this.hf);
      o.start(at);
      o.stop(at + 0.45);
    });
  }

  // 波次开始
  wave() {
    if (!this.ready()) return;
    this._note("wave", null, "synth", 0);
    const ctx = this.ctx, t = ctx.currentTime;
    [220, 330, 440].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16);
      osc.connect(g).connect(this.master);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.18);
    });
  }

  // 收枪（武器下沉出画）。时间线是「收 → 出」两段，所以这里是**两个独立的声音**，
  // 一个声音落在中间就没有「先收后出」的听感了。
  // 现在是 `sw/holster`（步枪摆弄录音里一下够闷的磕碰）—— 收枪本来就该是闷响、不是脆响。
  // **刀另走 `sw_holster_knife`**：长枪那两条录音是「M16 换弹全程」/「步枪摆弄」，收刀听成
  // 「子弹上膛」正是用户报的问题。判据不能只写 `pistol`（刀的 `type` 是 `"melee"`，
  // 既不等于 `"pistol"` 也不等于 `"sniper"`，会静默落回长枪那一条）。
  // **注意别加同名的实例字段** —— `this.holster = ...` 会盖掉这个方法（见文件头纪律 ①）。
  holster(type) {
    if (!this.ready()) return;
    const pistol = type === "pistol";
    const melee = type === "melee";
    this._playMapped("holster", {
      id: melee ? "sw_holster_knife" : pistol ? "sw_holster_pistol" : "sw_holster",
      kind: type || null,
      // 下沉 = 音高往下走一点（rate < 1），与三把枪的收枪动画同向
      vol: pistol || melee ? 0.62 : 0.72, rate: pistol ? 0.95 : melee ? 0.95 : 0.93,
      rateJitter: 0.04, wet: 0.2,
    }, () => (melee ? this._knifeHolsterSynth() : this._holsterSynth()));
  }

  // 出枪（武器升起入画）。现在是 `sw/deploy`（枪从背上抬起来那一下的机械录音）。
  // 刀走 `sw_deploy_knife`（金属出鞘的一记「叮」，谱心 7.2k，是全场最亮的一条）。
  // 狙击多两声拉栓刮擦（`type === "sniper"`）—— 与动画里那个 sin 单峰位移同源：
  // 采样在飞时**叠一段现成的 `awp_bolt` 录音**（延迟 0.16s），采样缺了则由
  // `_deploySynth(type)` 用合成方波出那两声。这条子层**不进 `lastAttempt`**（直接走
  // `_sample`，不经 `_playMapped`）—— 否则打完一枪再切枪，读口会报成 "bolt" 而不是 "deploy"。
  deploy(type) {
    if (!this.ready()) return;
    const pistol = type === "pistol";
    const melee = type === "melee";
    const ok = this._playMapped("deploy", {
      id: melee ? "sw_deploy_knife" : pistol ? "sw_deploy_pistol" : "sw_deploy",
      kind: type || null,
      // 升起 = 音高往上走一点（rate > 1）
      vol: melee ? 0.72 : pistol ? 0.70 : 0.85,
      rate: pistol ? 1.02 : melee ? 1.02 : 1.04, rateJitter: 0.035, wet: 0.2,
    }, () => (melee ? this._knifeDeploySynth() : this._deploySynth(type)));
    if (ok && type === "sniper") {
      // 拉栓录音没加载出来就退回合成刮擦（`_boltSynth` 与 `bolt()` 的兜底同源）
      if (!this._sample("awp_bolt", { delay: 0.16, vol: 0.85, wet: 0.4, rateJitter: 0.03 })) {
        this._boltSynth(0.16);
      }
    }
  }

  // AWM 开镜 / 退镜：镜筒贴脸的短促「咔」。
  // 两段**不同**的录音（725403 里两次真静音包围的极轻握持摩擦），方向感另用 rate 补
  // （进 1.10 往上、退 0.90 往下）—— 这两下本来就该「几乎听不见」，音色故意接近。
  scopeIn() {
    if (!this.ready()) return;
    this._playMapped("scopeIn", {
      id: "sw_scope_in", vol: 0.55, rate: 1.10, rateJitter: 0.03, wet: 0.05,
    }, () => this._scopeInSynth());
  }
  scopeOut() {
    if (!this.ready()) return;
    this._playMapped("scopeOut", {
      id: "sw_scope_out", vol: 0.55, rate: 0.90, rateJitter: 0.03, wet: 0.05,
    }, () => this._scopeOutSynth());
  }

  // ==========================================================================
  // 合成回退 / 合成实现（下划线前缀 = 私有，绝不与上面的公开方法重名）
  // ==========================================================================

  // 枪声（分武器类型：步枪/狙击/手枪），多层合成 + 混响。
  // 采样加载失败时走这里 —— 听感退化但绝不静音。
  _shootSynth(kind) {
    const ctx = this.ctx, t = ctx.currentTime;
    const v = kind || "rifle";
    const base = {
      rifle:  { crackF: 2600, bodyF: 780,  tail: 0.30, amp: 0.95, detune: 0.7,  sub: 0.18, ring: 1150, ringAmp: 0.09 },
      sniper: { crackF: 3400, bodyF: 950,  tail: 0.52, amp: 1.0,  detune: 0.5,  sub: 0.26, ring: 780,  ringAmp: 0.16 },
      pistol: { crackF: 3000, bodyF: 1100, tail: 0.20, amp: 0.78, detune: 0.85, sub: 0.12, ring: 1500, ringAmp: 0.08 },
    }[v] || { crackF: 2600, bodyF: 780, tail: 0.30, amp: 0.95, detune: 0.7, sub: 0.18, ring: 1150, ringAmp: 0.09 };
    // 每发音高/时长微随机，去机械感
    const det = 1 + (Math.random() - 0.5) * 0.1;

    // 1) 击发瞬态 crack（高通噪声，极短促的“啪”）
    const crack = ctx.createBufferSource();
    crack.buffer = this.noiseBuffer(0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = base.crackF;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(base.amp, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    crack.connect(hp).connect(cg); this.send(cg);
    crack.start(t);

    // 2) 枪声主体（带通噪声，爆音尾巴）
    const body = ctx.createBufferSource();
    body.buffer = this.noiseBuffer(base.tail);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = base.bodyF * det; bp.Q.value = 0.55;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(base.amp * 0.85, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + base.tail);
    body.connect(bp).connect(bg); this.send(bg);
    body.start(t);

    // 3) 低频冲击（胸腔震动）
    const subO = ctx.createOscillator();
    subO.type = "sine";
    subO.frequency.setValueAtTime(150 * det, t);
    subO.frequency.exponentialRampToValueAtTime(40, t + base.sub);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.95, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + base.sub + 0.02);
    subO.connect(sg); this.send(sg);
    subO.start(t); subO.stop(t + base.sub + 0.03);

    // 4) 金属余韵：货舱钢板把枪声反射回来的那一声「咣」
    const ring = ctx.createOscillator();
    ring.type = "triangle";
    ring.frequency.setValueAtTime(base.ring * det, t);
    ring.frequency.exponentialRampToValueAtTime(base.ring * 0.62, t + base.tail * 0.8);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(base.ringAmp, t + 0.008);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + base.tail * 0.9);
    ring.connect(rg); this.send(rg);
    ring.start(t); ring.stop(t + base.tail * 0.95);

    // 弹壳不在这里 —— 它是独立的一层（采样优先，见 shoot()），保证两条路径只发一次
  }

  // M4 / 手枪的高频机匣爆音（采样是 AK 变调，靠这一层把音色拉开）
  _crackLayer(level) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.045);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * level, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(g);
    this.send(g, 0.4);
    src.start(t);
    src.stop(t + 0.06);
  }

  // 空弹壳抛出的金属“叮”（brass 采样缺失时的回退）
  shellPing(t) {
    if (!this.ready()) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(4600, t);
    osc.frequency.exponentialRampToValueAtTime(1700, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.17, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.11);
  }

  // 单声金属点击（换弹采样的补位）。`t` 是**绝对时刻**。
  _click(at, f, amp) {
    const ctx = this.ctx;
    if (at < ctx.currentTime) at = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(f, at);
    osc.frequency.exponentialRampToValueAtTime(f * 0.7, at + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(amp, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    osc.connect(g); this.send(g);
    osc.start(at); osc.stop(at + 0.07);
    // 金属泛音：短促高频“叮”
    const m = ctx.createOscillator();
    m.type = "triangle";
    m.frequency.setValueAtTime(f * 2.6, at);
    m.frequency.exponentialRampToValueAtTime(f * 1.3, at + 0.04);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(0.0001, at);
    mg.gain.exponentialRampToValueAtTime(amp * 0.5, at + 0.006);
    mg.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    m.connect(mg).connect(this.master);
    m.start(at); m.stop(at + 0.05);
  }

  // 换弹回退：4 声（扣弹匣→抽出→插入→上膛）。`times` = 三段采样本该落下的绝对时刻。
  _reloadSynth(times) {
    const t0 = times[0], t1 = times[1], t2 = times[2];
    this._click(t0, 900, 0.2);
    this._click(t0 + 0.16, 650, 0.2);
    this._click(t1, 850, 0.2);
    this._click(t2, 700, 0.2);
  }

  // 拉栓回退：两声刮擦
  _boltSynth(delay) {
    const ctx = this.ctx, t = ctx.currentTime + (delay || 0);
    for (let i = 0; i < 2; i++) {
      const b = ctx.createOscillator();
      b.type = "square";
      b.frequency.value = i ? 620 : 420;
      const bg = ctx.createGain();
      const t0 = t + i * 0.09;
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.exponentialRampToValueAtTime(0.13, t0 + 0.012);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
      b.connect(bg).connect(this.master);
      b.start(t0);
      b.stop(t0 + 0.08);
    }
  }

  // 空枪
  _emptySynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  // 收枪回退：一段向下滑的机械摩擦 + 收到底那声闷响（磕到装备带）。
  // 混响量刻意与 `sw_holster` 那条采样取同一个数（0.2），不然采样一挂听感会「空间变小」。
  _holsterSynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1100;
    osc.connect(f).connect(g);
    this.send(g, 0.2);
    osc.start(t);
    osc.stop(t + 0.18);
    const thud = ctx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(140, t + 0.14);
    thud.frequency.exponentialRampToValueAtTime(80, t + 0.22);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + 0.14);
    g2.gain.exponentialRampToValueAtTime(0.22, t + 0.152);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    thud.connect(g2);
    this.send(g2, 0.2);
    thud.start(t + 0.14);
    thud.stop(t + 0.25);
  }

  // 出枪回退：一段向上滑的机械声 + 清脆的入位卡扣；狙击多两声拉栓刮擦。
  // 那两声与采样路径的 `awp_bolt` 子层同源（`type === "sniper"`）。
  _deploySynth(type) {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.17, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1500;
    osc.connect(f).connect(g);
    this.send(g, 0.2);
    osc.start(t);
    osc.stop(t + 0.16);
    const tick = ctx.createOscillator();
    tick.type = "square";
    tick.frequency.value = 1050;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + 0.13);
    g2.gain.exponentialRampToValueAtTime(0.19, t + 0.136);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    tick.connect(g2);
    this.send(g2, 0.2);
    tick.start(t + 0.13);
    tick.stop(t + 0.2);
    if (type === "sniper") this._boltSynth(0.16);
  }

  // 刀那两条回退走的是**金属**，不是长枪/手枪那两条低通扫频的机械摩擦 —— 这条分界线
  // 就是用户报的那个问题（收出刀听着像子弹上膛）。`_clink` 把几个**非整数比**的分音
  // 一起衰减，那才是「叮」的来历；写成整数倍会听成一根有音高的柱子，不像金属。
  // 分音越低的那条给得越响（`/(1+i*0.7)`），否则高频那几条听起来像电子表报时。
  _clink(freqs, t0, vol, dur) {
    const ctx = this.ctx;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 0.82, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol / (1 + i * 0.7), t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      this.send(g, 0.2);
      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
    });
  }

  // 收刀回退：金属入鞘的一记脆响 + 底下很短的一层闷碰（鞘口/装备带撞到）。
  // 混响量刻意与采样那条取同一个数（0.2），不然采样一挂听感会「空间变小」。
  _knifeHolsterSynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    this._clink([2900, 4100, 5600], t, 0.16, 0.13);
    const thud = ctx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(150, t);
    thud.frequency.exponentialRampToValueAtTime(85, t + 0.08);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.14, t + 0.012);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
    thud.connect(g2);
    this.send(g2, 0.2);
    thud.start(t);
    thud.stop(t + 0.11);
  }

  // 出刀回退：比收刀**更亮、更长**的一记金属「叮」（分音多一条高的、衰减 0.13→0.20）。
  // 「出亮收钝」这条与采样那对（7.2k / 4.9k）同向 —— 别把两条写成一个音色。
  _knifeDeploySynth() {
    this._clink([3400, 4900, 6800, 9200], this.ctx.currentTime, 0.17, 0.20);
  }

  // 开镜 / 退镜回退：镜筒贴脸的短促「咔」+ 一层很轻的金属共鸣
  _scopeInSynth() { this._scopeClick(760, 0.05, 0.14); }
  _scopeOutSynth() { this._scopeClick(520, 0.045, 0.11); }
  _scopeClick(freq, dur, vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.62, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 3;
    osc.connect(f).connect(g);
    this.send(g, 0.05);   // 与两条 scope 采样同档，保「几乎听不见」
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 命中敌人（奖励标记）
  _hitSynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // 击杀
  _killSynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    const noise = this.noiseBuffer(0.4);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900, t);
    filter.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(filter).connect(g); this.send(g);
    src.start(t);
    src.stop(t + 0.42);
    // 音调下降
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.35);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(og); this.send(og);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  // 玩家受击（hurt 采样缺失时的回退）
  _hurtSynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  // 敌人射击（远处闷响；给了坐标就做左右/远近定位）
  _enemyShootSynth(x, y, z) {
    const ctx = this.ctx, t = ctx.currentTime;
    const noise = this.noiseBuffer(0.14);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(320, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.42, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(filter).connect(g);
    this.out3d(g, x, y, z, 0);
    src.start(t);
    src.stop(t + 0.15);
  }

  // 爆头：比普通命中更亮更脆的金属「叮」，CF 里最爽的一声（headshot 采样缺失时的回退）
  _headshotSynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(2400, t);
    o.frequency.exponentialRampToValueAtTime(1300, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.13);

    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(3600, t);
    o2.frequency.exponentialRampToValueAtTime(2000, t + 0.06);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.18, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o2.connect(g2).connect(this.master);
    o2.start(t); o2.stop(t + 0.1);
  }

  // 脚步的金属环层（**不是回退**，是叠加）：钢甲板的低频共鸣。
  // 玩家（local）给得轻，敌人给得重 —— 录音是混凝土，这一层是「脚下是船」的唯一线索。
  _footstepRing(x, y, z, local) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(250 + Math.random() * 70, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const og = ctx.createGain();
    const peak = local ? 0.035 : 0.06;
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og);
    this.out3d(og, x, y, z, 0.5);
    o.start(t); o.stop(t + 0.12);
  }

  // 脚步（合成回退）：钢甲板上的短促脆响
  _footstepSynth(x, y, z) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.08);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(1800 + Math.random() * 600, t);
    f.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(f).connect(g);
    this.out3d(g, x, y, z, 0.35);
    src.start(t);
    src.stop(t + 0.1);
  }

  // 起跳（衣物摩擦的低频）
  _jumpSynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.13);
  }

  // 落地闷响，强度按冲击速度
  _landSynth(strength = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.14);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(420, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(f).connect(g); this.send(g);
    src.start(t); src.stop(t + 0.16);

    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.14);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.16 * strength, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.17);
  }

  // 烟雾弹落地后的嘶嘶声
  _smokeHissSynth(x, y, z) {
    const ctx = this.ctx, t = ctx.currentTime;
    const len = 1.6;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(len);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + len);
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g);
    this.out3d(g, x, y, z);
    src.start(t);
    src.stop(t + len + 0.05);
  }

  // 闪光弹：爆响 + 耳鸣 + 听力闷住，一次调完
  _flashbangSynth(dur = 5,position) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.3);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(f).connect(g);
    if(position)this.out3d(g,position.x,position.y,position.z);else this.send(g);
    src.start(t);
    src.stop(t + 0.32);

    if(dur>0){this.tinnitus(dur,0.075);this.muffle(dur*.9);}
  }

  // 命中材质（impact 采样缺失时的回退）。flesh 更低更闷，wall 更脆更短。
  _impactSynth(kind) {
    const ctx = this.ctx, t = ctx.currentTime;
    const flesh = kind === "flesh" || kind === "knife_flesh";
    const len = flesh ? 0.11 : 0.07;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(len);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(flesh ? 620 : 2400, t);
    f.frequency.exponentialRampToValueAtTime(flesh ? 260 : 900, t + len);
    f.Q.value = flesh ? 1.4 : 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(flesh ? 0.42 : 0.36, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g); this.send(g, 0.35);
    src.start(t);
    src.stop(t + len + 0.02);
  }

  // 子弹掠过（whiz 采样缺失时的回退）：一段快速下扫的带通噪声
  _whizSynth(x, y, z) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.18);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(3600, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.16);
    f.Q.value = 3.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    src.connect(f).connect(g);
    this.out3d(g, x, y, z, 0);
    src.start(t);
    src.stop(t + 0.19);
  }

  // 倒地（bodyfall 采样缺失时的回退）：一记低频闷响
  _bodyfallSynth(x, z) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.2);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(320, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(f).connect(g);
    this.out3d(g, x, 0.2, z, 0.3);
    src.start(t);
    src.stop(t + 0.24);

    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.22, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(og);
    this.out3d(og, x, 0.2, z, 0.3);
    o.start(t); o.stop(t + 0.24);
  }

  // 近战挥砍（风声）。`heavy` = 重击（CS 的轻/重两档，见 WEAPON_DEFS.knife）：
  // 更长、更低、更响一声。
  _meleeSynth(heavy) {
    const ctx = this.ctx, t = ctx.currentTime;
    const len = heavy ? 0.34 : 0.18;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const p = i / data.length;
      data[i] = (Math.random() * 2 - 1) * (1 - p) * (0.4 + 0.6 * Math.abs(Math.sin(p * (heavy ? 11 : 20))));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(heavy ? 260 : 600, t);
    f.frequency.exponentialRampToValueAtTime(heavy ? 900 : 2000, t + len);
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(heavy ? 0.72 : 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  // 手雷拉环与抛出
  _throwGrenadeSynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    // 拉环尖声
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.12);
    // Landing sound is emitted by the actual collision, never on pin pull.
  }

  // 爆炸（c4_explode 采样缺失时的回退）
  _explosionSynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    const len = 0.7;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.4) * 0.8;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(90, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g); this.send(g);
    src.start(t);
    // 低频冲击
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(70, t);
    sub.frequency.exponentialRampToValueAtTime(35, t + 0.5);
    const gs = ctx.createGain();
    gs.gain.setValueAtTime(0.6, t);
    gs.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    sub.connect(gs); this.send(gs);
    sub.start(t);
    sub.stop(t + 0.6);
  }

  // UI 声（Kenney 采样缺失时的回退）：四个 kind 各有自己的扫频方向
  _uiSynth(kind) {
    const ctx = this.ctx, t = ctx.currentTime;
    const spec = {
      click:  { f: 1100, to: 700,  dur: 0.05, vol: 0.14, type: "square" },
      switch: { f: 760,  to: 980,  dur: 0.07, vol: 0.12, type: "triangle" },
      open:   { f: 520,  to: 1150, dur: 0.11, vol: 0.13, type: "triangle" },
      close:  { f: 980,  to: 460,  dur: 0.09, vol: 0.13, type: "triangle" },
    }[kind] || { f: 1100, to: 700, dur: 0.05, vol: 0.14, type: "square" };
    const o = ctx.createOscillator();
    o.type = spec.type;
    o.frequency.setValueAtTime(spec.f, t);
    o.frequency.exponentialRampToValueAtTime(spec.to, t + spec.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(spec.vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
    o.connect(g).connect(this.master);   // UI 声不进混响 —— 它是「界面」不是「世界」
    o.start(t); o.stop(t + spec.dur + 0.02);
  }

  // ==========================================================================
  // ?debug 读口
  // ==========================================================================
  audioState() {
    const loaded = [];
    for (const [k, v] of this._buffers) if (v.length) loaded.push(k);
    const pending = [];
    if (!this._preloadDone) for (const k of Object.keys(SAMPLES)) if (!this._buffers.has(k)) pending.push(k);
    const now = this.ctx ? this.ctx.currentTime : 0;
    const scheduled = [];
    for (const h of this._scheduled) {
      scheduled.push({
        method: h.method,
        at: Math.round(h.at * 1000) / 1000,
        delay: Math.round(h.delay * 1000) / 1000,
        secsSinceTrigger: Math.round((now - (h.at - h.delay)) * 1000) / 1000,
      });
    }
    scheduled.sort((a, b) => a.delay - b.delay);
    return {
      ready: !!this.ready(),
      ctxState: this.ctx ? this.ctx.state : null,
      sampleRate: this.ctx ? this.ctx.sampleRate : (this._decoder ? this._decoder.sampleRate : 0),
      decodeSupported: !!(this.ctx || this._decoder),
      loaded,
      pending,
      failed: this._failed.slice(),
      loadedStems: this._loaded.length,
      totalStems: this._total,
      preloadDone: !!this._preloadDone,
      voices: this._voices,
      maxVoices: this.maxVoices,
      lastAttempt: this._last ? { ...this._last } : null,
      scheduled,
      music: { on: !!this._musicOn, playing: !!this._music, gain: this._music ? this._music.gain.gain.value : 0 },
    };
  }
}
