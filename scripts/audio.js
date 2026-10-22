// ===== 音效系统：采样 + 合成混合（Web Audio API）=====
//
// 架构（两句话）：
//   ① **现实里存在的声音**（枪声 / 脚步 / 命中 / 爆炸 / 倒地 / 拉栓 /
//      **空枪干击 / 开镜退镜 / 按钮与页签 / 面板开合**）走 `audio/`
//      里的 CC0 真实录音（逐文件署名见 `audio/CREDITS.txt`）；
//   ② 命中标记保持合成；每杀确认音使用短金属采样，连杀使用 CF 经典英文男声采样。
//      连杀是明确例外：固定的人声演绎才是还原目标，不使用系统 TTS 或电子音阶。
//      announcer/ 的游戏语音不是 CC0，来源与归属单列在 audio/CREDITS.txt。
//   ③ 切枪、换弹、近战攻击只播放对应武器素材包中的原声；没有原声就静音，绝不以
//      振荡器、噪声、通用枪械录音或点击声补齐。
//
// 叙事内采样入口采用「采样优先、合成兜底」，兜底函数是 _playMapped() 的第三个参数：
//
//     this._playMapped("shoot", { id: "ak47_fire" }, () => this._shootSynth(kind));
//
// 把兜底做成**参数**而不是 `if (this.has(x))` 分支，是为了让「加了采样就忘了回退」在结构上
// 不可能发生。动作原声与连杀人声是明确例外：缺失时静默降级，避免退回用户明确不要的
// 合成或通用替代声。
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
//   · USP / AWM 当前没有自己的换弹原声，因此换弹保持静音；不会借用 AK 或合成点击声。
//   · 脚步录音是**混凝土/石材**，而地图是钢甲板 —— 用叠加合成金属环来补偿，不是真钢面脚步。
// =============================================================================

// ---- 素材表：槽位 id → 一组 stem（每个 stem 展开成 .ogg + .m4a 两个候选 URL）----
// 变体数 > 1 的槽位在每次播放时轮换（见 _pick），这是「同一段录音听不出在重复」的前提。
const SAMPLES = {
  axe_festa_attack_1: ["classic/axe_festa/attack_1.wav"],
  axe_festa_attack_2: ["classic/axe_festa/attack_2.wav"],
  axe_festa_attack_3: ["classic/axe_festa/attack_3.wav"],
  axe_festa_put_up: ["classic/axe_festa/put_up.wav"],
  kukri_dragon_deploy: ["classic/kukri_dragon/deploy.wav"],
  kukri_dragon_slash1: ["classic/kukri_dragon/slash1.wav"],
  kukri_dragon_slash2: ["classic/kukri_dragon/slash2.wav"],
  kukri_dragon_stab: ["classic/kukri_dragon/stab.wav"],
  kukri_dragon_hit: ["classic/kukri_dragon/hit1.wav", "classic/kukri_dragon/hit2.wav",
    "classic/kukri_dragon/hit3.wav", "classic/kukri_dragon/hit4.wav"],
  kukri_dragon_hitwall: ["classic/kukri_dragon/hitwall.wav"],
  ironbeast_fire: ["classic/ironbeast/fire_1.wav", "classic/ironbeast/fire_2.wav"],
  ironbeast_reload: ["classic/ironbeast/reload.wav"],
  ironbeast_clipin_gold: ["classic/ironbeast/clipin_gold.wav"],
  ironbeast_clipin: ["classic/ironbeast/clipin.wav"],
  ironbeast_knife_attack: ["classic/ironbeast/knife_attack.wav"],
  bio_attack: ["bio/attack.wav"],
  bio_infect: ["bio/infect.wav"],
  bio_mother: ["bio/mother.wav"],
  bio_death: ["bio/death.wav"],
  bio_countdown: ["bio/countdown.ogg"],
  cf_ak_fire: ["classic/ak47_fire.wav"],
  cf_ak_out: ["classic/ak47_out.wav"],
  cf_ak_in: ["classic/ak47_in.wav"],
  cf_ak_bolt: ["classic/ak47_bolt.wav"],
  cf_m4c_fire: ["classic/m4c_fire.wav"],
  cf_m4c_out: ["classic/m4c_out.wav"],
  cf_m4c_in: ["classic/m4c_in.wav"],
  cf_m4c_bolt: ["classic/m4c_bolt.wav"],
  deagle_festa_fire: ["classic/deagle_festa/fire_1.wav", "classic/deagle_festa/fire_2.wav"],
  deagle_festa_select: ["classic/deagle_festa/select.wav"],
  deagle_festa_blowback: ["classic/deagle_festa/blowback.wav"],
  deagle_festa_clipout: ["classic/deagle_festa/clipout.wav"],
  deagle_festa_clipin: ["classic/deagle_festa/clipin.wav"],
  deagle_festa_del_blowback: ["classic/deagle_festa/del_blowback.wav"],
  cf_grenade_pin: ["classic/grenade_pin.wav"],
  cf_grenade_explode: ["classic/grenade_explode.wav"],
  cf_grenade_flash: ["classic/grenade_flash.wav"],
  cf_grenade_smoke: ["classic/grenade_smoke.wav"],
  // 「Fire in the hole!」—— 玩家**丢出**投掷物那一下喊的一声（素材由用户提供，见 `vo/`
  // 这一层目录的用意、以及下方 `fireInTheHole()` 与 CREDITS.txt 第七节）。
  // 写成带扩展名的 stem ⇒ 走 `_loadOne` 那条「自带扩展名、原样用」的分支，只有一个候选
  // URL（不产生 404），也因此不进 M4A_ONLY —— 与 `impacts/headshot_kill.mp3` 同一套处理：
  // 素材是**用户给的原始 wav，原样入库、未转码**。
  // ⚠️ 它与上面那四条 `cf_grenade_*` 不是一回事：那四条是 **CF 原声里投掷物的物音**
  // （拉环 / 爆炸 / 闪爆 / 烟爆），这条是**玩家自己的人声台词**，两者来源不同（见 CREDITS）。
  fireinthehole: ["vo/fireinthehole.wav"],
  ak47_fire:    ["weapons/ak47_fire"],
  ak47_distant: ["weapons/ak47_distant_a", "weapons/ak47_distant_b"],
  awp_fire:     ["weapons/awp_fire"],
  // CF M82A1 原枪声与拉栓声：见 audio/CREDITS.txt 第九节。
  barrett_fire: ["classic/barrett_fire.wav"],
  barrett_bolt: ["classic/barrett_bolt.wav"],
  barrett_draw: ["classic/barrett_draw.wav"],
  barrett_clipout: ["classic/barrett_clipout.wav"],
  barrett_clipin: ["classic/barrett_clipin.wav"],
  awp_bolt:     ["weapons/awp_bolt_1", "weapons/awp_bolt_2"],
  step:         ["footsteps/step_concrete_1", "footsteps/step_concrete_2", "footsteps/step_concrete_3",
                 "footsteps/step_concrete_4", "footsteps/step_concrete_5", "footsteps/step_concrete_6"],
  impact_wall:  ["impacts/impact_concrete_1", "impacts/impact_concrete_2", "impacts/impact_concrete_3",
                 "impacts/impact_concrete_4", "impacts/impact_concrete_5", "impacts/impact_concrete_6"],
  impact_flesh: ["impacts/impact_flesh_1", "impacts/impact_flesh_2", "impacts/impact_flesh_3"],
  ricochet:     ["impacts/ricochet_1", "impacts/ricochet_2"],
  headshot:     ["impacts/headshot"],
  kill_confirm: ["impacts/kill_confirm.wav"],
  // 爆头**击杀**的确认音（用户提供的素材，见下面 headshotKill() 与 CREDITS.txt 第六节）。
  // **与上面那条 `headshot` 是两个槽位、两件事**：那条是「打中了头」的命中标记音（含
  // 没打死的那一枪），这条只在「爆头 + 这一杀没续上连杀」时播。写成带扩展名的 stem
  // ⇒ 走 `_loadOne` 里那条「自带扩展名、原样用」的分支，只有一个候选 URL（不产生 404），
  // 也因此不进 M4A_ONLY —— 素材是**原始 mp3 原样入库**，没有转码（见下条注释）。
  headshot_kill: ["impacts/headshot_kill.mp3"],
  hurt:         ["impacts/hurt"],
  brass:        ["impacts/brass_1", "impacts/brass_2", "impacts/brass_3",
                 "impacts/brass_4", "impacts/brass_5"],
  whiz:         ["impacts/whiz"],
  bodyfall:     ["foley/bodyfall"],
  explosion:    ["foley/c4_explode"],
  knife_wall:   ["melee/knife_wall"],
  knife_flesh:  ["melee/knife_flesh_1", "melee/knife_flesh_2", "melee/knife_flesh_3"],
  // ---- 页面交互声：真实金属键（Kenney 合成 blip 已下线，见下）----
  ui_click:     ["ui/ui_click"],
  ui_switch:    ["ui/ui_switch"],
  ui_open:      ["ui/ui_panel_open"],
  ui_close:     ["ui/ui_panel_close"],
  // ---- 手上动作 ----
  // 通用切枪、收枪和换弹替代声已经下线：动作只使用武器素材包自己的原声。
  //
  // ⚠️ 这里曾经还有一个 `match_start`（船笛），由 `roundStart()` 在开局那一下播放。
  // **已整个删除**（槽位 / 录音 / `roundStart()` / `_hornSynth()` 全没了）。照「现实里
  // 存不存在」那条分界线它本来是对的，但那是一段 0.97s、基频 ≈150Hz 的持续低鸣 ——
  // 用户实际听成「水牛的叫声」。**别再把它（或任何开局长鸣）加回来。**
  sw_dryfire:        ["sw/dryfire"],
  sw_scope_in:       ["sw/scope_in_click.wav"],
  sw_scope_out:      ["sw/scope_out_click.wav"],
  music:        ["ui/lobby_theme"],
  // CF Global Risk 男声：2~8 杀七档；超过 8 杀只保留击杀确认音，计数与 HUD 不封顶。
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
  "sw/dryfire",
]);

// 自动武器只播「初始爆裂声」，丢掉 1.7 s 的尾巴（不丢的话 0.09 s 的射击间隔会堆成一团糊音）。
// window = 0 表示整段播完（巴雷特原声含较长的回响尾部）。
const GUN = {
  ak:     { sample: "cf_ak_fire", rate: 1.00, window: 0.8, vol: 0.85, crack: 0 },
  m4:     { sample: "cf_m4c_fire", rate: 1.00, window: 0, vol: 0.92, crack: 0 },
  awm:    { sample: "awp_fire",  rate: 1.00, window: 0,    vol: 1.00, crack: 0 },
  barrett:{ sample: "barrett_fire", rate: 1.00, window: 0, vol: 1.00, crack: 0 },
  pistol: { sample: "ak47_fire", rate: 1.22, window: 0.22, vol: 0.78, crack: 0.25 },
  deagle: { sample: "deagle_festa_fire", rate: 1.00, window: 0, vol: 0.95, crack: 0 },
};
const GUN_BY_TYPE = { rifle: "ak", sniper: "awm", pistol: "pistol" };

const MAX_VOICES = 64;      // 普通音效并发上限；留出足够余量避免战斗声互相挤掉
const KILL_VOICE_RESERVE = 16; // 击杀反馈专用余量，不被普通枪声/环境音占满
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
  bio(kind, x, y, z) {
    const id = 'bio_' + kind;
    const opts = { id, vol: kind === 'mother' ? .72 : kind === 'countdown' ? .7 : .53,
      rateJitter: kind === 'countdown' ? 0 : .08, wet: kind === 'countdown' ? 0 : .3,
      hudBus: kind === 'countdown' };
    if (Number.isFinite(x)) Object.assign(opts, { x, y, z });
    return this._playMapped('bio', opts, () => {});
  }
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.muted = false;

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
      out.gain.value = this.muted ? 0 : 0.6;

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
      this.hf.gain.value = this.muted ? 0 : 1;
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
    // stem **自带扩展名**（`.wav` / `.mp3`）时原样用、不拼候选 —— 这叫「这条素材就这一个文件」：
    // `classic/*.wav` 是 CF 原始 wav，`impacts/headshot_kill.mp3` 与 `vo/fireinthehole.wav`
    // 是用户提供的原始素材（**不做转码**：mp3 / wav 三家浏览器都原生解，转一道只是白挨一次
    // 有损转码；何况 wav 转出来的只能是没有 ogg 的 m4a，白白多一份 404）。
    const cands = /\.(wav|mp3|ogg)$/i.test(stem) ? [""] : M4A_ONLY.has(stem) ? [".m4a"] : [".ogg", ".m4a"];
    let last = "./audio/" + stem + cands[0];
    let err = null;
    for (const ext of cands) {
      last = "./audio/" + stem + ext;
      try {
        // These two files were replaced in place. Version only their requests so
        // an already-played local build cannot reuse the old decoded HTTP body.
        const request=(id==="sw_scope_in"||id==="sw_scope_out")
          ? last+"?v=scope-210018-1":last;
        const res = await fetch(request);
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
      // A deploy event can be scheduled ahead of its authored animation frame.
      // If the weapon is switched away before that frame, cancel it before its
      // AudioBufferSource ever starts instead of fading a sound that should not exist.
      cancelPending: () => {
        if (h.stopped) return;
        h.stopped = true;
        const now = c.currentTime;
        try { gain.gain.cancelScheduledValues(now); } catch (_) {}
        try { gain.gain.setValueAtTime(0.0001, now); } catch (_) {}
        try { src.stop(now); } catch (_) {}
      },
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

  // 单个入口：采样优先；只有显式传入 synthFn 的音效才允许合成兜底。
  // 切枪、换弹、拉栓与近战动作不传 synthFn，素材缺失时保持静音。
  _playMapped(method, o, synthFn) {
    o = o || {};
    const voiceLimit = this.maxVoices + (["kill", "damageMilestone"].includes(method) ? KILL_VOICE_RESERVE : 0);
    if (this._voices >= voiceLimit) { this._note(method, o, "capped", 0); return false; }
    const h = this._sample(o.sample || o.id, o);
    if (h) { this._note(method, o, "sample", h.dur); return true; }
    if (typeof synthFn === "function") {
      synthFn();
      this._note(method, o, "synth", 0);
    } else {
      this._note(method, o, "missing", 0);
    }
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
  cancelPendingDeploy() {
    if (!this._scheduled.size) return;
    const now = this.ctx?.currentTime ?? 0;
    for (const h of Array.from(this._scheduled)) {
      if (h.method === "deploy" && h.at > now) h.cancelPending();
    }
  }
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

  setMuted(muted) {
    this.muted = !!muted;
    if (!this.ctx) {
      if (!this.muted) this.ensure();
      return this.muted;
    }
    const now = this.ctx.currentTime;
    this.master?.gain.setTargetAtTime(this.muted ? 0 : 0.6, now, .018);
    this.hf?.gain.setTargetAtTime(this.muted ? 0 : 1, now, .018);
    return this.muted;
  }

  // ==========================================================================
  // 采集入口（采样优先）
  // ==========================================================================

  // 枪声。`id` 是**武器 id**（ak/m4/awm/barrett/pistol）—— 只有它能区分 AK 与 M4，两者的
  // `def.type` 都是 "rifle"。省略时按 type 兜底。
  shoot(kind, id, skin) {
    if (!this.ready()) return;
    const key = GUN[id] ? id : (GUN_BY_TYPE[kind] || "ak");
    const g = GUN[key];
    const exactM4C = id === "m4" && skin === "classic";
    this._playMapped("shoot", {
      id: id || kind || "rifle",   // 记录的是**武器 id**，读口靠它区分 AK / M4
      sample: id === "m4" && skin === "ironbeastgold" ? "ironbeast_fire" : g.sample,
      kind: kind || "rifle",
      rate: g.rate, window: g.window, vol: g.vol,
      volJitter: exactM4C ? 0 : undefined,
      rateJitter: (key==='ak' || key==='barrett' || exactM4C)?0:0.012,
      wet: (key==='ak' || key==='barrett' || exactM4C)?0:1,
    }, () => this._shootSynth(kind));
    // 手枪仍由 AK 变调派生；M4A1-C 自带完整开火瞬态，无需合成爆音。
    if (g.crack > 0) this._crackLayer(g.crack);
    // 空弹壳：0.42s 后落地。**quiet** —— 这是子层，不该覆盖 lastAttempt
    this._playMapped("brass", {
      id: "brass", delay: 0.42, vol: 0.35, wet: 0.3, rateJitter: 0.06, quiet: true,
    }, () => this.shellPing(this.ctx.currentTime + 0.055));
  }

  // 拉栓：按武器选自己的采样。巴雷特的原声前 0.8s 很响，因此让拉栓
  // 在原射击 SMD 的第 50/35 秒帧进入；AWM 保持原来的 0.20s。两段声都不变速。
  // AWM 的两个 take 是独立录音、随机选一个；巴雷特只有原枪专用的一段。
  bolt(id = "awm", options = {}) {
    if (!this.ready()) return;
    const sample = id === "barrett" ? "barrett_bolt" : "awp_bolt";
    const sourceDelay = id === "barrett" ? 50 / 35 : 0.2;
    const delay = Number.isFinite(options.delay) ? options.delay : sourceDelay;
    this._playMapped("bolt", {
      id: sample, delay, vol: 1.0, wet: id === "barrett" ? 0 : 0.4,
      rateJitter: id === "barrett" ? 0 : 0.03, schedule: "bolt",
    });
  }

  // 换弹。三段**按 reloadDur 的比例**排程（p = 0.16 / 0.58 / 0.80），
  // **绝不拉伸采样**（0.7s 的 foley 拉到 2.4s 是 0.29× 慢放，会变成怪声）。
  // 三段顺序由「三个不同的槽位」保证，不会被变体轮换打乱。
  reload(o) {
    if (!this.ready()) return;
    const dur = (o && o.dur) || 2.43;
    const wid = (o && o.id) || "reload";
    if (wid === "barrett") {
      // Original Barrett QC: clip out frame 10, clip in frame 35, bolt frame 70
      // of the 90-frame reload. Keep each source recording at its original rate.
      const frames=[10,35,70],ids=["barrett_clipout","barrett_clipin","barrett_bolt"];
      const hits=ids.map((id,i)=>this._sample(id,{delay:frames[i]/90*dur,
        vol:i===2?0.95:0.9,wet:0.25,schedule:"reload"}));
      this._note("reload",{id:wid,kind:wid,events:frames},hits.some(Boolean)?"sample":"missing",frames[2]/90*dur);
      return;
    }
    if (wid === "deagle") {
      // Exact MDL events from the supplied Festa CFS 2019 rig. The source
      // reload has 270 samples (frames 0..269 at 125 fps); gameplay stretches
      // the animation to reloadDur, so preserve each event's normalized phase.
      const frames=[1,29,124,193];
      const ids=["deagle_festa_blowback","deagle_festa_clipout",
        "deagle_festa_clipin","deagle_festa_del_blowback"];
      const hits=ids.map((id,i)=>this._sample(id,{delay:frames[i]/269*dur,
        vol:1,volJitter:0,rate:1,rateJitter:0,wet:0,schedule:"reload"}));
      this._note("reload",{id:wid,kind:wid,events:frames},hits.some(Boolean)?"sample":"missing",
        frames.at(-1)/269*dur);
      return;
    }
    // AK's authored reload events are frames 39 / 102 / 202 of 299.
    const ps = wid==='ak' ? [39/299,102/299,202/299] : [0.16, 0.58, 0.80];
    const ironbeast = wid==='m4' && o?.skin === 'ironbeastgold';
    if (ironbeast) {
      // Exact QC events from reload.smd: gold insert at frame 115, then the
      // M4 magazine seat at frame 206. Both 300-frame clips map across reloadDur.
      const frames=[115,206],ids=["ironbeast_clipin_gold","ironbeast_clipin"];
      const hits=ids.map((id,i)=>this._sample(id,{delay:frames[i]/299*dur,
        vol:0.9,wet:0.5,schedule:"reload"}));
      this._note("reload",{id:wid,kind:wid,events:frames},hits.some(Boolean)?"sample":"missing",frames[1]/299*dur);
      return;
    }
    if (wid === "m4" && o?.skin === "classic") {
      // Source v44 sequence events from the supplied M4A1-C view model:
      // clipout frame 10, clipin frame 38 and bolt frame 69 of frames 0..93.
      // Gameplay maps the complete authored reload clip across reloadDur.
      const frames=[10,38,69],ids=["cf_m4c_out","cf_m4c_in","cf_m4c_bolt"];
      const hits=ids.map((id,i)=>this._sample(id,{delay:frames[i]/93*dur,
        vol:1,volJitter:0,rate:1,rateJitter:0,wet:0,schedule:"reload"}));
      this._note("reload",{id:wid,kind:"m4c",events:frames},hits.some(Boolean)?"sample":"missing",frames[2]/93*dur);
      return;
    }
    const ids = wid==='ak' ? ["cf_ak_out", "cf_ak_in", "cf_ak_bolt"]
      : wid==='m4' ? ["cf_m4c_out", "cf_m4c_in", "cf_m4c_bolt"]
      : null;
    if (!ids) {
      this._note("reload", { id: wid, kind: wid }, "missing", 0);
      return;
    }
    const hits = [];
    for (let i = 0; i < 3; i++) {
      const h = this._sample(ids[i], { delay: ps[i] * dur, vol: 0.9, wet: 0.5, schedule: "reload" });
      hits.push(!!h);
    }
    this._note("reload", { id: wid, kind: wid }, hits.some(Boolean) ? "sample" : "missing", ps[2] * dur);
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

  // 每次击杀都播放参考视频里的确认音，不依赖连杀状态。击杀之间不互相取消，
  // 也不加入可被阵亡/连杀播报逻辑取消的排程组；爆头和连杀时压低一点让专属音/人声清楚。
  kill(headshot = false, streak = false) {
    if (!this.ready()) return;
    this._playMapped("kill", {
      id: "kill_confirm", kind: headshot ? "head" : streak ? "streak" : "normal",
      vol: headshot ? 0.65 : streak ? 0.73 : 1.05,
      volJitter: 0, rateJitter: 0, wet: 0,
    }, () => this._killSynth());
  }

  // 生化模式每累计造成 1000 实际伤害的阶段奖励：直接复用击杀确认原声。
  // 单独的 method 名让调试可以区分击杀与千伤，但两者享有同一个不被战斗声挤掉的预留声道。
  damageMilestone() {
    if (!this.ready()) return;
    this._playMapped("damageMilestone", {
      id: "kill_confirm", kind: "bio-1000", vol: 1.05,
      volJitter: 0, rateJitter: 0, wet: 0,
    }, () => this._killSynth());
  }

  // 玩家受伤
  hurt() {
    if (!this.ready()) return;
    this._playMapped("hurt", { id: "hurt", vol: 0.85, wet: 0.2, rateJitter: 0.04 },
      () => this._hurtSynth());
  }

  // 敌人使用与玩家相同的枪型采样/变调/截窗；距离只改变空间听感，
  // 不再把 M4/AWM（或远处的 AK）替换成统一的 AK 远景录音。
  // gunId 缺省为 AK，兼容原有的三坐标调用。
  enemyShoot(x, y, z, gunId = "ak") {
    if (!this.ready()) return;
    const key = GUN[gunId] ? gunId : "ak";
    const g = GUN[key];
    const dist = this._dist3(x, y, z);
    const far = dist > 25;
    this._playMapped("enemyShoot", {
      id: key, sample: g.sample,
      kind: far ? "far" : "near",
      x, y, z, wet: 0, vol: g.vol * (far ? 0.72 : 1),
      rate: g.rate, window: g.window, rateJitter: key === "ak" ? 0 : 0.012,
      lowpass: this._absorb(dist),
    }, () => this._enemyShootSynth(x, y, z, key));
    if (g.crack > 0) this._crackLayer(g.crack, x, y, z, this._absorb(dist));
  }

  // 爆头（奖励音调，但也换成了采样：那一声「叮」本来就是录音更好听）
  // ⚠️ 这是**命中**音（打中头就打，哪怕没打死），与下面的 `headshotKill()` 不是一回事。
  headshot() {
    if (!this.ready()) return;
    this._playMapped("headshot", { id: "headshot", vol: 0.95, wet: 0.2 },
      () => this._headshotSynth());
  }

  // 爆头**击杀**确认音。**只在「这一杀没有续上连杀」时由 onKill 调**（见 main.js 那条注释）：
  // 一旦进了连杀，紧接着就是经典人声播报，再叠一声会抢开头。
  // 素材是用户提供的原始 mp3（未转码，见 SAMPLES / CREDITS.txt 第六节），整段约 1.0s。
  // 与 `headshot()` 同一次击杀里**前后各响一声**是有意的（CF 也是命中一声、确认一声），
  // 所以这里不压 `headshot()` 的音量、也不把它挤掉。
  headshotKill() {
    if (!this.ready()) return;
    this._playMapped("headshotKill", { id: "headshot_kill", vol: 0.9, wet: 0.15 },
      () => this._headshotKillSynth());
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
  impact(p, kind = "wall", meleeSkin = null) {
    if (!this.ready()) return;
    const x = p ? p.x : undefined, y = p ? p.y : 0, z = p ? p.z : undefined;
    let slot = "impact_wall", vol = 0.75;
    if (meleeSkin === "dragon" && kind === "knife_flesh") slot = "kukri_dragon_hit";
    else if (meleeSkin === "dragon" && kind === "knife_wall") slot = "kukri_dragon_hitwall";
    else if (kind === "flesh") slot = "impact_flesh";
    else if (kind === "knife_flesh") slot = "knife_flesh";
    else if (kind === "knife_wall") slot = "knife_wall";
    else if (kind === "metal" || Math.random() < 0.3) slot = "ricochet";
    if (kind === "flesh" || kind === "knife_flesh") vol = 0.9;
    this._playMapped("impact", {
      id: slot, kind, x, y, z, vol, wet: meleeSkin === "dragon" ? 0 : 0.35,
      rateJitter: meleeSkin === "dragon" ? 0 : 0.05,
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

  // 近战挥砍只播放斧头素材包对应的三段原声；缺失时静音。
  // 砍中人体 / 砍中钢板由调用方另外调 impact("knife_flesh" / "knife_wall")。
  melee(kindOrHeavy, meleeSkin = null, stage = "swing") {
    if (!this.ready()) return;
    const kind = typeof kindOrHeavy === "string" ? kindOrHeavy : kindOrHeavy ? "heavy" : "light";
    const heavy = kind === "heavy";
    const sample = meleeSkin === "dragon"
      ? (kind === "thrust" || (heavy && stage === "windup")
          ? "kukri_dragon_slash2" : heavy ? "kukri_dragon_stab" : "kukri_dragon_slash1")
      : kind === "thrust" ? "axe_festa_attack_2" : heavy ? "axe_festa_attack_3" : "axe_festa_attack_1";
    this._playMapped("melee", {
      id: sample, kind, stage,
      vol: heavy ? 1.0 : 0.9, rate: 1, rateJitter: 0, wet: meleeSkin === "dragon" ? 0 : 0.4,
    });
  }

  // 炫金雷神右键枪托：只播用户源包内 `M4A1-S-Beast_knifeAttack.wav`。
  // 源 MDL 的 knife-attack 序列在第 1/500 秒触发 5004 事件，因此保留这点延迟；
  // 缺失时静音，不用斧头、通用挥风声或合成音替代。
  ironbeastMelee(delay = 1 / 500) {
    if (!this.ready()) return;
    this._playMapped("ironbeastMelee", {
      id: "ironbeast_knife_attack", delay: Math.max(0, delay),
      kind: "ironbeast", vol: 1, rate: 1, rateJitter: 0, wet: 0,
    });
  }

  // 手雷抛出不再借用近战的合成挥风声；拉环与喊话各走自己的源素材。
  throwGrenade() {
    if (!this.ready()) return;
    this._note("throwGrenade", null, "silent", 0);
  }

  // 「Fire in the hole!」—— **出手那一帧**喊的那一声（调用点在 main.js 的 `throwGrenade()` 里，
  // 紧挨着上面的 `throwGrenade()` 甩手声；拉环那一下是 `grenadePin()`，与本方法无关）。
  // **只有手雷会走到这里**：调用点门在 `def.nade === "frag"` 上（闪光/烟雾故意留空，等用户各自
  // 补素材）。本方法自己**不判武器** —— 它只负责「把这句话喊出来」，「什么时候喊」归调用点。
  // 与上面那声甩手 whoosh 是**两件事、两个方法**：那个是手臂动作，这个是台词。所以素材缺了
  // 也不影响甩手声（那条路径自己照常响）——「听感退化、不会静音」。
  //
  // 路由：**不带 x/y/z** ⇒ 不走 panner，走 `master` + 混响（`wet` 0.2），与 `hurt()` 同一条，
  // 因为这是**玩家自己的喊声**。也**刻意不走 `hudBus`**：那条总线绕开了闪光弹的低通闷音，
  // 而这声是发生在世界里的喊话 —— 被闪了就该跟着一起闷。
  //
  // **没有合成兜底**（这里不用 `_playMapped` 的第三个参数）：人声合不出来，退回振荡器只会
  // 得到一段「不像人」的怪声，而这正是 `streak()` 当年定下的那条线（绝不退回 TTS 一类的
  // 声线，声线随设备变）。素材缺失/还没加载完时只留一个 `reason: "missing"` 的记录。
  fireInTheHole() {
    if (!this.ready()) return false;
    const opts = {
      id: "fireinthehole", kind: "nade",
      vol: 0.8, volJitter: 0, rate: 1, rateJitter: 0, wet: 0.2,
    };
    const h = this._sample("fireinthehole", opts);
    this._note("fireInTheHole", opts, h ? "sample" : "missing", h ? h.dur : 0);
    return !!h;
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
  // 40ms 起播窗口把同一帧的手雷多杀合并到最后一档；旧句在 35ms 内淡出并停止。
  // 缺素材只保留视觉反馈，绝不退回系统 TTS（声线随设备变）或旧方波琶音。
  // 语音只有七档；超过 8 杀收掉上一句且不再播报，击杀确认音由 main.js 照常播放。
  streak(n) {
    if (!this.ready() || !Number.isFinite(n) || n < 2) return false;
    this.cancelStreak();
    if (n > 8) return false;
    const id = "cf_streak_" + Math.floor(n);
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

  // 收枪没有武器素材包对应的独立事件，因此保持静音。
  holster(type) {
    if (!this.ready()) return;
    this._note("holster", { kind: type || null }, "silent", 0);
  }

  // 出枪只播放武器素材包自身的事件：AK、炫金雷神、巴雷特、凤凰斧、沙鹰和 AWM。
  // 其余武器没有对应源原声时静音，不再叠通用摆弄录音或合成扫频。
  deploy(type, options = {}) {
    if (!this.ready()) return;
    const ironbeast = options.skin === "ironbeastgold";
    const barrett = options.weaponId === "barrett";
    const axe = options.weaponId === "knife" && options.meleeSkin !== "dragon";
    const kukri = options.weaponId === "knife" && options.meleeSkin === "dragon";
    const deagle = options.weaponId === "deagle";
    const ak = options.weaponId === "ak";
    const m4c = options.weaponId === "m4" && options.m4c;
    const awm = options.weaponId === "awm";
    const selectEventDelay = ironbeast ? (options.selectDur || 0) * 135 / 319
      : barrett ? (Number.isFinite(options.selectBoltAt) ? options.selectBoltAt : 30 / 35)
      : kukri ? 0
      : axe ? (Number.isFinite(options.axeSelectAt) ? options.axeSelectAt : .01)
      : deagle ? (Number.isFinite(options.deagleSelectAt) ? options.deagleSelectAt : .01)
      : ak ? (Number.isFinite(options.akSelectAt) ? options.akSelectAt : 77 / 375)
      : m4c ? (Number.isFinite(options.m4cSelectAt) ? options.m4cSelectAt : 1 / 3)
      : awm ? .16 : 0;
    const sample = ironbeast ? "ironbeast_reload"
      : barrett ? "barrett_bolt"
      : kukri ? "kukri_dragon_deploy"
      : axe ? "axe_festa_put_up"
      : deagle ? "deagle_festa_select"
      : ak ? "cf_ak_bolt"
      : m4c ? "cf_m4c_bolt"
      : awm ? "awp_bolt"
      : null;
    if (!sample) {
      this._note("deploy", { kind: type || null, id: options.weaponId || null }, "missing", 0);
      return;
    }
    this._playMapped("deploy", {
      // Supplied Barrett QC: draw frame 30 fires Weapon_AWP.Bolt. It does not
      // fire Weapon_AWP.Draw, even though awp_draw.wav also exists in the pack.
      id: sample,
      delay: selectEventDelay,
      kind: type || null,
      vol: barrett ? 1.0 : ironbeast ? 0.9 : 1.0,
      volJitter: deagle || ak || m4c ? 0 : undefined,
      rate: 1.0, rateJitter: awm ? 0.03 : 0,
      wet: barrett || deagle || ak || m4c ? 0 : ironbeast ? 0.5 : axe ? 0.35 : 0.2,
      // Keep draw/select events separate from a post-shot bolt cycle. Every
      // delayed deploy event (including Barrett and Desert Eagle) can then be
      // withdrawn if its source animation is interrupted before that frame.
      schedule: "deploy",
    });
  }

  // 两把狙击枪共用专门录制的短促镜筒机械声；巴雷特略低沉，二级倍率略高。
  // 原文件的瞬态已经标准化，不再随机音量，避免同一次开镜反馈忽强忽弱。
  scopeIn(weaponId = "awm", stage = 1) {
    if (!this.ready()) return;
    const heavy = weaponId === "barrett";
    this._playMapped("scopeIn", {
      id: "sw_scope_in", kind: weaponId + ":" + stage,
      vol: heavy ? (stage === 2 ? 0.96 : 1.0) : (stage === 2 ? 0.94 : 0.98),
      rate: heavy ? (stage === 2 ? 1.06 : 0.96) : (stage === 2 ? 1.13 : 1.02),
      volJitter: 0, rateJitter: 0, wet: 0,
    }, () => this._scopeInSynth(weaponId, stage));
  }
  scopeOut(weaponId = "awm") {
    if (!this.ready()) return;
    const heavy = weaponId === "barrett";
    this._playMapped("scopeOut", {
      id: "sw_scope_out", kind: weaponId,
      vol: heavy ? 1.0 : 0.96, rate: heavy ? 0.90 : 0.96,
      volJitter: 0, rateJitter: 0, wet: 0,
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

  // 手枪的高频机匣爆音（仍由 AK 变调派生，靠这一层把音色拉开）
  _crackLayer(level, x, y, z, lowpass) {
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
    src.connect(hp);
    if (lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = lowpass;
      hp.connect(lp).connect(g);
    } else hp.connect(g);
    this.out3d(g, x, y, z, x === undefined ? 0.4 : 0);
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

  // 开镜 / 退镜回退：镜筒贴脸的短促「咔」+ 一层很轻的金属共鸣
  _scopeInSynth(weaponId = "awm", stage = 1) {
    this._scopeClick((weaponId === "barrett" ? 600 : 760) + (stage === 2 ? 110 : 0), 0.05, 0.30);
  }
  _scopeOutSynth() { this._scopeClick(520, 0.045, 0.23); }
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
    this.send(g, 0.02);
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

  // 采样暂不可用时也保留三种枪的不同瞬态与尾长，不退回统一的闷响。
  _enemyShootSynth(x, y, z, gunId = "ak") {
    const ctx = this.ctx, t = ctx.currentTime;
    const profile = {
      ak: { dur: 0.16, hi: 2400, lo: 300, amp: 0.42 },
      m4: { dur: 0.12, hi: 3100, lo: 500, amp: 0.34 },
      awm: { dur: 0.38, hi: 1700, lo: 180, amp: 0.58 },
      barrett: { dur: 0.42, hi: 1500, lo: 150, amp: 0.65 },
      pistol: { dur: 0.10, hi: 3500, lo: 650, amp: 0.28 },
    }[gunId] || { dur: 0.16, hi: 2400, lo: 300, amp: 0.42 };
    const noise = this.noiseBuffer(profile.dur);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(profile.hi, t);
    filter.frequency.exponentialRampToValueAtTime(profile.lo, t + profile.dur - 0.02);
    const g = ctx.createGain();
    g.gain.setValueAtTime(profile.amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + profile.dur);
    src.connect(filter).connect(g);
    this.out3d(g, x, y, z, 0);
    src.start(t);
    src.stop(t + profile.dur);
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

  // 爆头**击杀**确认音（`headshot_kill` 采样缺失 / 还没加载完时的回退）。
  // **必须与上面那声命中「叮」听得出是两回事**，否则采样挂掉之后这两件事就分不清了：
  // 命中音是单声高频下滑，这一条是「低频冲击 + 一声上行短音」。
  _headshotKillSynth() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o0 = ctx.createOscillator();
    o0.type = "sine";
    o0.frequency.setValueAtTime(300, t);
    o0.frequency.exponentialRampToValueAtTime(120, t + 0.16);
    const g0 = ctx.createGain();
    g0.gain.setValueAtTime(0.30, t);
    g0.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o0.connect(g0).connect(this.master);
    o0.start(t); o0.stop(t + 0.20);

    const up = ctx.createOscillator();
    up.type = "triangle";
    up.frequency.setValueAtTime(1400, t + 0.02);
    up.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.22, t + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    up.connect(g1).connect(this.master);
    up.start(t + 0.02); up.stop(t + 0.18);
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
      muted: !!this.muted,
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
      killVoiceLimit: this.maxVoices + KILL_VOICE_RESERVE,
      lastAttempt: this._last ? { ...this._last } : null,
      scheduled,
      music: { on: !!this._musicOn, playing: !!this._music, gain: this._music ? this._music.gain.gain.value : 0 },
    };
  }
}
