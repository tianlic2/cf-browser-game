// ===== 程序化音效系统（Web Audio API，无需外部音频资源）=====
export class SFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  ensure() {
    // 需在用户手势后调用以解锁 AudioContext
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const out = this.ctx.createGain();
      out.gain.value = 0.6;
      // master 与 destination 之间插一个低通：闪光弹的「听力闷住」直接调它的截止频率。
      // 这样 send() 一行都不用改，且 verb→wet→master 在这条链上游，混响尾巴会一起被闷住。
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
      out.connect(this.muffleNode).connect(this.ctx.destination);
      this.master = out;
      // 耳鸣是 4.4kHz 高频，过 700Hz 低通会被削没 —— 单独一条不经过 muffle 的总线
      this.hf = this.ctx.createGain();
      this.hf.gain.value = 1;
      this.hf.connect(this.ctx.destination);
      // 小型空间混响（仓库/金属货舱回声），增强真实感
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
  }

  // 同时送干声到主输出与踢入混响
  send(node) {
    node.connect(this.master);
    if (this.verb) node.connect(this.verb);
  }

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

  // ---- 位置音效（敌人枪声 / 敌人脚步）----
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

  // 有声源坐标就走 panner 定位，否则直接进主输出
  out3d(node, x, y, z) {
    if (x === undefined || x === null) { this.send(node); return; }
    const pn = this.panner(x, y, z);
    node.connect(pn);
    this.send(pn);
  }

  noiseBuffer(dur) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(rate * dur), rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // 枪声（分武器类型：步枪/狙击/手枪），多层合成 + 混响 + 弹壳叮声
  shoot(kind) {
    if (!this.ready()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const v = kind || "rifle";
    const base = {
      rifle:  { crackF: 2600, bodyF: 780,  tail: 0.30, amp: 0.95, detune: 0.7,  sub: 0.18, ring: 1150, ringAmp: 0.09 },
      sniper: { crackF: 3400, bodyF: 950,  tail: 0.52, amp: 1.0,  detune: 0.5,  sub: 0.26, ring: 780,  ringAmp: 0.16 },
      pistol: { crackF: 3000, bodyF: 1100, tail: 0.20, amp: 0.78, detune: 0.85, sub: 0.12, ring: 1500, ringAmp: 0.08 },
    }[v];
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

    // 5) 空弹壳弹出“叮”（略带金属音）
    this.shellPing(t + 0.055);
  }

  // 空弹壳抛出的金属“叮”
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

  // 换弹（弹匣抽出/插入/上膛，金属咔哒节奏）
  reload() {
    if (!this.ready()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // [延迟, 频段] 步骤：扣弹匣→抽出→插入→上膛
    const steps = [
      [0.00, 900],
      [0.16, 650],
      [0.42, 850],
      [0.72, 700],
    ];
    steps.forEach(([dt, f]) => {
      // 主体：方波“咔哒”
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(f, t + dt);
      osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + dt + 0.05);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.2, t + dt + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.06);
      osc.connect(g); this.send(g);
      osc.start(t + dt); osc.stop(t + dt + 0.07);
      // 金属泛音：短促高频“叮”
      const m = ctx.createOscillator();
      m.type = "triangle";
      m.frequency.setValueAtTime(f * 2.6, t + dt);
      m.frequency.exponentialRampToValueAtTime(f * 1.3, t + dt + 0.04);
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(0.0001, t + dt);
      mg.gain.exponentialRampToValueAtTime(0.1, t + dt + 0.006);
      mg.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.05);
      m.connect(mg).connect(this.master);
      m.start(t + dt); m.stop(t + dt + 0.05);
    });
  }

  // 空枪
  empty() {
    if (!this.ready()) return;
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

  // 命中敌人
  hit() {
    if (!this.ready()) return;
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
  kill() {
    if (!this.ready()) return;
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

  // 玩家受击
  hurt() {
    if (!this.ready()) return;
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
  enemyShoot(x, y, z) {
    if (!this.ready()) return;
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
    this.out3d(g, x, y, z);
    src.start(t);
    src.stop(t + 0.15);
  }

  // 爆头：比普通命中更亮更脆的金属「叮」，CF 里最爽的一声
  headshot() {
    if (!this.ready()) return;
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

  // 脚步：钢甲板上的短促脆响 + 一点金属余韵。静步不触发（由调用方决定）
  footstep(x, y, z) {
    if (!this.ready()) return;
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
    this.out3d(g, x, y, z);
    src.start(t);
    src.stop(t + 0.1);

    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(250 + Math.random() * 70, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og);
    this.out3d(og, x, y, z);
    o.start(t); o.stop(t + 0.12);
  }

  // 起跳（衣物摩擦的低频）
  jump() {
    if (!this.ready()) return;
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
  land(strength = 1) {
    if (!this.ready()) return;
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
  smokeHiss(x, y, z) {
    if (!this.ready()) return;
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
  flashbang(dur = 5) {
    if (!this.ready()) return;
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
    this.send(g);
    src.start(t);
    src.stop(t + 0.32);

    const d = Math.max(2, dur);
    this.tinnitus(d, 0.075);
    this.muffle(d * 0.9);
  }

  // 连杀播报 stinger：音高随连杀数递增，走高频总线以免被闪光的闷音吃掉。
  // `notes` 的档数与 `main.js` 的播报阶梯是两回事 —— 这里只是「越高越尖」，8 档之后
  // 停在最高音（连杀 10 往上仍然是同一条 stinger，靠文案与辉光区分，听感不会退步）。
  streak(n) {
    if (!this.ready()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = [0, 4, 7, 12, 16, 19, 24, 28].map((s) => 440 * Math.pow(2, s / 12));
    const k = Math.min(Math.max(n - 2, 0), notes.length - 1);
    for (let i = 0; i < 3; i++) {
      const f = notes[Math.min(k + i, notes.length - 1)];
      const at = t + i * 0.09;
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.13, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      o.connect(g).connect(this.hf);
      o.start(at);
      o.stop(at + 0.22);
    }
  }

  // 回合开始 / 结束播报
  roundStart() {
    if (!this.ready()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [330, 440, 587].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const at = t + i * 0.16;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      o.connect(g).connect(this.hf);
      o.start(at);
      o.stop(at + 0.3);
    });
  }

  roundEnd(win) {
    if (!this.ready()) return;
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

  // 切枪（机械滑膛声）
  switchWeapon() {
    if (!this.ready()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // 机械滑动
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1400;
    osc.connect(f).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.14);
    // 卡扣
    const tick = ctx.createOscillator();
    tick.type = "square";
    tick.frequency.value = 900;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + 0.14);
    g2.gain.exponentialRampToValueAtTime(0.2, t + 0.146);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    tick.connect(g2).connect(this.master);
    tick.start(t + 0.14);
    tick.stop(t + 0.21);
  }

  // 收枪（武器下沉出画）：一段向下滑的机械摩擦 + 收到底那声闷响（磕到装备带）。
  // 为什么把切枪拆成两个声音：时间线现在是「收 → 出」两段，一个声音落在中间就没有
  // 「先收后出」的听感了。旧的 switchWeapon() 保留给 selectSkin 那类原地重挂用。
  // **注意别加同名的实例字段** —— `this.holster = ...` 会盖掉这个方法（audio.js 历史上
  // 因为 `this.muffle` 盖掉 `muffle()` 让死亡流程整个冻住，见 AGENTS.md）。
  holster(type) {
    if (!this.ready()) return;
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
    osc.connect(f).connect(g).connect(this.master);
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
    thud.connect(g2).connect(this.master);
    thud.start(t + 0.14);
    thud.stop(t + 0.25);
  }

  // 出枪（武器升起入画）：一段向上滑的机械声 + 清脆的入位卡扣。
  // 狙击多两声拉栓刮擦（`type === "sniper"`）—— 与动画里那个 sin 单峰位移同源。
  deploy(type) {
    if (!this.ready()) return;
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
    osc.connect(f).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
    const tick = ctx.createOscillator();
    tick.type = "square";
    tick.frequency.value = 1050;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + 0.13);
    g2.gain.exponentialRampToValueAtTime(0.19, t + 0.136);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    tick.connect(g2).connect(this.master);
    tick.start(t + 0.13);
    tick.stop(t + 0.2);
    if (type === "sniper") {
      for (let i = 0; i < 2; i++) {
        const b = ctx.createOscillator();
        b.type = "square";
        b.frequency.value = i ? 620 : 420;
        const bg = ctx.createGain();
        const t0 = t + 0.16 + i * 0.09;
        bg.gain.setValueAtTime(0.0001, t0);
        bg.gain.exponentialRampToValueAtTime(0.13, t0 + 0.012);
        bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
        b.connect(bg).connect(this.master);
        b.start(t0);
        b.stop(t0 + 0.08);
      }
    }
  }

  // AWM 开镜 / 退镜：镜筒贴脸的短促「咔」+ 一层很轻的金属共鸣
  scopeIn() { this.scopeClick(760, 0.05, 0.14); }
  scopeOut() { this.scopeClick(520, 0.045, 0.11); }
  scopeClick(freq, dur, vol) {
    if (!this.ready()) return;
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
    this.send(g); // send() 已同时接 master 与混响总线，别再 connect(master) 一次
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 近战挥砍（风声）
  // 挥刀。`heavy` = 重击（CS 的轻/重两档，见 WEAPON_DEFS.knife）：更长、更低、更响一声。
  melee(heavy) {
    if (!this.ready()) return;
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
  throwGrenade() {
    if (!this.ready()) return;
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
    // 落地的低声闷响
    const thud = ctx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(160, t + 0.1);
    thud.frequency.exponentialRampToValueAtTime(80, t + 0.2);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.2, t + 0.13);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    thud.connect(g2).connect(this.master);
    thud.start(t + 0.1);
    thud.stop(t + 0.23);
  }

  // 爆炸（低频轰鸣 + 噪声）
  explosion() {
    if (!this.ready()) return;
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

  ready() {
    return this.enabled && this.ctx;
  }
}