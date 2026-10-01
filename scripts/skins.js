// ============ CF 风格武器皮肤表 ============
//
// 一款皮肤 = 三件事：
//   1. `slots` —— 按 GLB 里的**原始材质名**分部位上漆（AK 的 Wood/Metal/Dark_metal、
//      M4 的 Primary/Secondary/Highlight、匕首的 knife_s_1/knife_s_2）。
//      只有这几把枪的材质是**按部位命名**的，所以能做出 CF 那种「枪身红、枪管金」的分色。
//      AWM 是单网格单材质、USP 是 16 网格共用一个材质 —— 这两把只能整枪染色。
//   2. `pulse` —— emissiveIntensity 上叠加的正弦呼吸（CF 英雄级武器的招牌）。
//      没有 pulse 的皮肤（无影）就是恒定，克制是它自己的风格。
//   3. `muzzle` —— 专属枪口焰/枪口光颜色。
//
// 坑：**AWM 与 USP 的材质带贴图，皮肤只能「染」（改 material.color），不能像
// 旧版 AWM 那样整个换掉材质** —— 换掉就等于把 GLB 自带的贴图丢了，只剩一块平涂色，
// 那样既做不出无影/极光，视觉上也比原厂更差。
//
//   4. `model` —— **模型皮肤**：这款皮肤自带一棵 GLB，选中它时替换实际模型（而不是只改材质）。
//      描述符 `{ file, rotY, targetLen, anchorKey, muzzleY? }`：
//        - `file` 文档相对路径（`./models/skins/…`）。
//        - `rotY` 把枪口转到本组 -z 所需的绕 Y 角。**每把枪都不一样**（实测+渲染验证过），
//          不能套用 `WEAPON_DEFS` 里基础枪的值。
//        - `targetLen` **必须与被替换的基础枪完全一致**：手上所有锚点都写在
//          「原点=包围盒中心、最长轴=targetLen、枪口朝 -z」这个坐标系里，换标尺那套数字就废了。
//        - `anchorKey` 指向 `viewarms.js` 的 `ARM_ANCHORS` 里**这个模型专用**的一格
//          （`ARM_ANCHORS[anchorKey] || ARM_ANCHORS[武器 id]`，取不到就回退）。
//          握持位是两个接触点（右手腕在扳机、左手腕在护木）+ 换弹的弹匣井，单个 Y/Z 平移
//          最多只对得准一个点，所以必须按模型各配一张表。
//      模型皮肤**照样要写 `slots`**：模型上材质名对不上时它们一个都不生效（模型显示自带外观），
//      但敌人与地面掉落物拿的是「基础低模 + 这身配色」，没有 `slots` 就会是一把没上漆的原厂枪。
//      **模型皮肤不要写 `keepMap`**：模型网格由 `prepareGunMeshes(gun, {keepMap:true})` 逐个
//      打上 `userData.keepMap`，那是「自带烘焙贴图」的正确表达；`keepMap` 是给基础枪用的，
//      写它会把基础枪的迷彩也一起留下（雷神那种本来就该丢贴图平涂的皮肤就变了样）。
//
// 命名是 CF 风格的致敬；要改中文名只动这里的 `name` 即可，不影响任何逻辑。

// 原厂（不上漆）的统一 id。slots 为空 = 全部还原成载入时记录的 base 值。
export const STOCK = "stock";

export const SKINS = {
  ak: [
    { id: STOCK, name: "原厂", slots: {}, accent: 0x2b2b2e },
    {
      id: "firekirin", name: "火麒麟", slots: {
        Dark_metal: { color: 0x6b0f12, metalness: 0.55, roughness: 0.48 },
        Metal: { color: 0xd4a72c, metalness: 0.85, roughness: 0.24, emissive: 0xff4a0e, emissiveIntensity: 0.18 },
        Wood: { color: 0x8e1a12, metalness: 0.4, roughness: 0.60 },
      },
      pulse: { amp: 0.10, speed: 2.0 }, muzzle: 0xff7a20, accent: 0xff4a0e,
    },
    {
      // 「黑武士」的金色必须放在 Dark_metal（弹匣/枪机/保险等小件）上，
      // 不能放 Metal —— Metal 覆盖枪管与机匣这一大片，金色放那儿就是一把黄枪
      // 配个黑枪托，跟「哑光黑 + 金线」完全不是一回事（第一版实测如此）。
      id: "blacksamurai", name: "黑武士", slots: {
        Metal: { color: 0x121215, metalness: 0.45, roughness: 0.58 },
        Dark_metal: { color: 0xb08a28, metalness: 0.72, roughness: 0.30, emissive: 0xd4a72c, emissiveIntensity: 0.10 },
        Wood: { color: 0x1b1a1e, metalness: 0.40, roughness: 0.60 },
      },
      pulse: { amp: 0.06, speed: 1.6 }, muzzle: 0xffc24a, accent: 0xb08a28,
    },
    {
      id: "goldenak", name: "黄金AK", slots: {
        Dark_metal: { color: 0xc9a02c, metalness: 0.72, roughness: 0.26 },
        Metal: { color: 0xd8b03a, metalness: 0.78, roughness: 0.24, emissive: 0x3a2a06, emissiveIntensity: 0.16 },
        Wood: { color: 0xc9a02c, metalness: 0.72, roughness: 0.28 },
      },
      pulse: { amp: 0.08, speed: 1.4 }, muzzle: 0xffd070, accent: 0xd8b03a,
    },
    {
      // 「老兵」= 木托经典 AK 的模型皮肤。没有 pulse —— 一把用旧了的钢木枪不该发光，
      // 克制是它自己的风格（与「无影」同一路数）。
      id: "classic", name: "老兵", slots: {
        Metal: { color: 0x6c7076, metalness: 0.72, roughness: 0.40 },
        Dark_metal: { color: 0x4a4d52, metalness: 0.66, roughness: 0.44 },
        Wood: { color: 0x8a5a2c, metalness: 0.22, roughness: 0.74 },
      },
      muzzle: 0xffb060, accent: 0x8a5a2c,
      model: {
        file: "./models/skins/ak_classic.glb", rotY: Math.PI / 2,
        targetLen: 0.82, anchorKey: "ak_classic",
      },
    },
  ],

  m4: [
    { id: STOCK, name: "原厂", slots: {}, accent: 0x2b2b2e },
    {
      id: "thor", name: "雷神", slots: {
        Primary: { color: 0x8894a3, metalness: 0.45, roughness: 0.36 },
        Secondary: { color: 0x152a55, metalness: 0.5, roughness: 0.44 },
        Highlight: { color: 0x2f93d8, metalness: 0.6, roughness: 0.3, emissive: 0x38b6ff, emissiveIntensity: 0.20 },
      },
      pulse: { amp: 0.12, speed: 2.6 }, muzzle: 0x66c8ff, accent: 0x38b6ff,
      // 模型升级：这身 `Primary/Secondary/Highlight` 配色**照旧生效于基础低模**
      // （敌人与地面掉落物拿的就是那一份），而模型自己的材质名是 `material_0`、
      // 与三个槽位都对不上 —— 于是模型上一个字段都不被覆盖，显示它自带的外观。两全。
      model: {
        file: "./models/skins/m4_thor.glb", rotY: Math.PI / 2,
        targetLen: 0.82, anchorKey: "m4_thor",
      },
    },
    {
      id: "blackdragon", name: "黑龙", slots: {
        Primary: { color: 0x131316, metalness: 0.45, roughness: 0.58 },
        Secondary: { color: 0x2c1215, metalness: 0.70, roughness: 0.45 },
        Highlight: { color: 0x8a1116, metalness: 0.80, roughness: 0.30, emissive: 0xff2a1a, emissiveIntensity: 0.16 },
      },
      pulse: { amp: 0.10, speed: 1.9 }, muzzle: 0xff3a20, accent: 0xff2a1a,
    },
    {
      id: "deathgod", name: "死神", slots: {
        Primary: { color: 0x17131f, metalness: 0.45, roughness: 0.54 },
        Secondary: { color: 0x2a1f3d, metalness: 0.70, roughness: 0.42 },
        Highlight: { color: 0x5b2a8c, metalness: 0.80, roughness: 0.30, emissive: 0xa855f7, emissiveIntensity: 0.20 },
      },
      pulse: { amp: 0.11, speed: 2.3 }, muzzle: 0xb066ff, accent: 0xa855f7,
    },
    {
      // 「霜白」：冷白涂层。基础低模这一版是**给敌人/掉落物**用的平涂配色。
      id: "frost", name: "霜白", slots: {
        Primary: { color: 0xe6ecf2, metalness: 0.42, roughness: 0.38 },
        Secondary: { color: 0xb4c0cc, metalness: 0.50, roughness: 0.42 },
        Highlight: { color: 0x9fb8d0, metalness: 0.58, roughness: 0.32, emissive: 0xcfe4ff, emissiveIntensity: 0.10 },
      },
      pulse: { amp: 0.07, speed: 1.7 }, muzzle: 0xcfe4ff, accent: 0xdfe8f0,
      model: {
        file: "./models/skins/m4_frost.glb", rotY: 0,
        targetLen: 0.82, anchorKey: "m4_frost",
      },
    },
    {
      // 「泡泡糖」：粉白糖果涂装。
      id: "bubblegum", name: "泡泡糖", slots: {
        Primary: { color: 0xf0a8c8, metalness: 0.38, roughness: 0.40 },
        Secondary: { color: 0x7a3352, metalness: 0.48, roughness: 0.46 },
        Highlight: { color: 0xff7ab8, metalness: 0.55, roughness: 0.30, emissive: 0xffa8d0, emissiveIntensity: 0.16 },
      },
      pulse: { amp: 0.10, speed: 2.1 }, muzzle: 0xff8fc0, accent: 0xff5fa2,
      model: {
        file: "./models/skins/m4_bubblegum.glb", rotY: Math.PI,
        targetLen: 0.82, anchorKey: "m4_bubblegum",
      },
    },
  ],

  // AWM 单网格单材质且带贴图 —— 整枪染色，贴图细节保留
  awm: [
    { id: STOCK, name: "原厂", slots: {}, accent: 0x2b2b2e },
    {
      id: "shadowless", name: "无影", slots: {
        "Material.001": { color: 0xd8dee4, metalness: 0.55, roughness: 0.34 },
      },
      muzzle: 0xdfe8f0, accent: 0xd8dee4,
    },
    {
      id: "aurora", name: "极光", slots: {
        "Material.001": { color: 0x113830, metalness: 0.62, roughness: 0.36, emissive: 0x35ffa8, emissiveIntensity: 0.13 },
      },
      pulse: { amp: 0.10, speed: 1.5 }, muzzle: 0x50ffb0, accent: 0x35ffa8,
    },
    {
      id: "goldawm", name: "黄金AWM", slots: {
        "Material.001": { color: 0xd9a92f, metalness: 0.78, roughness: 0.22, emissive: 0x2a1d05, emissiveIntensity: 0.18 },
      },
      pulse: { amp: 0.06, speed: 1.2 }, muzzle: 0xffd070, accent: 0xd9a92f,
    },
    {
      // 「紫电」：紫光放电。模型（AWM_1）自带的三个材质里 `light`/`light_2` **本身带 emissive**，
      // 所以额外给这两个名字写槽位（只改发光、`color` 保持纯白不动贴图）——
      // 现成的 pulse 呼吸机制就自动作用到它们身上了。这两个名字在基础 AWM 上不存在，
      // 所以对敌人/掉落物那一版完全无副作用。
      id: "volt", name: "紫电", slots: {
        "Material.001": { color: 0x3f2c78, metalness: 0.66, roughness: 0.30, emissive: 0x8b5cf6, emissiveIntensity: 0.16 },
        light: { color: 0xffffff, emissive: 0x8b5cf6, emissiveIntensity: 0.55 },
        light_2: { color: 0xffffff, emissive: 0x6ee7ff, emissiveIntensity: 0.65 },
      },
      pulse: { amp: 0.12, speed: 2.6 }, muzzle: 0xb066ff, accent: 0x8b5cf6,
      model: {
        file: "./models/skins/awm_volt.glb", rotY: Math.PI / 2,
        targetLen: 0.95, anchorKey: "awm_volt",
      },
    },
    {
      // 「荒原」：灰绿素色。没有 pulse —— 一身野战涂装，克制是对的。
      id: "field", name: "荒原", slots: {
        "Material.001": { color: 0x8a8776, metalness: 0.50, roughness: 0.44 },
      },
      muzzle: 0xd8d0b0, accent: 0x8a8776,
      model: {
        file: "./models/skins/awm_field.glb", rotY: -Math.PI / 2,
        targetLen: 0.95, anchorKey: "awm_field",
      },
    },
  ],

  pistol: [
    { id: STOCK, name: "原厂", slots: {}, accent: 0x2b2b2e },
    {
      id: "shura", name: "修罗", slots: {
        "P320_mat.001": { color: 0x4e0a0d, metalness: 0.55, roughness: 0.42, emissive: 0xff1a1a, emissiveIntensity: 0.12 },
      },
      pulse: { amp: 0.09, speed: 2.4 }, muzzle: 0xff2a2a, accent: 0xff1a1a,
    },
    {
      id: "deity", name: "天神", slots: {
        "P320_mat.001": { color: 0xa8871f, metalness: 0.75, roughness: 0.28, emissive: 0x3a2c08, emissiveIntensity: 0.13 },
      },
      pulse: { amp: 0.07, speed: 1.5 }, muzzle: 0xffe090, accent: 0xd4b04a,
    },
  ],

  // 匕首的部位映射是**实测**出来的，别照名字猜：
  // knife_s_1 = 刀柄（底部短的一截），knife_s_2 = 刀身（长的那条）。
  // 一开始按名字反着上了色，结果「屠龙」成了一柄金刃红柄的怪东西。
  knife: [
    { id: STOCK, name: "原厂", slots: {}, accent: 0x2b2b2e },
    {
      id: "dragonslayer", name: "屠龙", slots: {
        knife_s_1: { color: 0xc8a02c, metalness: 0.80, roughness: 0.30 },
        knife_s_2: { color: 0xa81015, metalness: 0.85, roughness: 0.22, emissive: 0xff2a10, emissiveIntensity: 0.16 },
      },
      pulse: { amp: 0.10, speed: 2.2 }, muzzle: 0xff2a10, accent: 0xff2a10,
    },
    {
      id: "dragonroar", name: "龙啸", slots: {
        knife_s_1: { color: 0x141210, metalness: 0.80, roughness: 0.40 },
        knife_s_2: { color: 0xd8b03a, metalness: 0.85, roughness: 0.20, emissive: 0xd8b03a, emissiveIntensity: 0.12 },
      },
      pulse: { amp: 0.08, speed: 1.8 }, muzzle: 0xd8b03a, accent: 0xd8b03a,
    },
  ],
};

// 每把武器**默认带**的皮肤：进战场就是它，换主武器时也回退到它。
// 刻意不是原厂 —— 这套皮肤是游戏的门面，默认穿上比默认裸枪更能体现它值。
// 想要「进战场就是原厂」只需把这里全改成 STOCK，其余逻辑无需改动。
export const DEFAULT_SKIN = {
  ak: "firekirin", m4: "thor", awm: "shadowless", pistol: "shura", knife: "dragonslayer",
};

// 枪口焰没上皮肤时的原色（与 muzzleShot / muzzleLight 的构造值一致）
export const DEFAULT_MUZZLE = { sprite: 0xffcf70, light: 0xffa040 };

export function skinsFor(weaponId) {
  return SKINS[weaponId] || [];
}

// 这款皮肤是不是**模型皮肤**（自带一棵 GLB）。取不到皮肤返回 null，
// 让调用方能区分「没有模型」与「这把武器压根没有皮肤表（投掷物）」。
export function modelOf(weaponId, skinId) {
  const s = findSkin(weaponId, skinId);
  return s && s.model ? s.model : null;
}

// 全部模型皮肤，形如 `[{ weaponId, skinId, model }]`，供 `__tactical.modelSkins()` 与测试用。
export function allModelSkins() {
  const out = [];
  for (const id of Object.keys(SKINS)) {
    for (const s of SKINS[id]) if (s.model) out.push({ weaponId: id, skinId: s.id, model: s.model });
  }
  return out;
}

// 找不到就回退到原厂 —— 不能返回 undefined，否则 applySkin 会把每个材质读成
// undefined 再写回去，枪会变成纯白/纯黑，而且没有任何报错。
export function findSkin(weaponId, skinId) {
  const list = skinsFor(weaponId);
  return list.find((s) => s.id === skinId) || list[0] || null;
}

// 该皮肤是否真的上了漆（原厂不算，HUD 上不必写「AK-47-原厂」）
export function isSkinned(weaponId, skinId) {
  const s = findSkin(weaponId, skinId);
  return !!(s && s.id !== STOCK);
}

export function skinLabel(weaponId, skinId) {
  const s = findSkin(weaponId, skinId);
  return s ? s.name : "";
}

// 把一款皮肤刷到**任意一棵**模型树上，返回需要做呼吸发光的材质列表。
// 依赖每个 mesh 上由 loadWeapon / guncatalog 记好的两份 userData：
//   - `matName`：GLB 原始材质名（皮肤按这个名字分部位上漆）
//   - `baseMat`：出厂材质快照 —— **每次都先还原到它、再叠皮肤**，
//     这是「切回原厂」能可靠回退、任意两皮肤来回切不残留上上款字段的唯一前提。
// 放在这个模块而不是 main.js：世界模型目录（scripts/guncatalog.js）也要用它，
// 而这里除了材质实例自己的方法之外什么都不依赖，不会形成循环 import。
// 返回 null 表示「这把武器没有皮肤表」（投掷物三件套靠 def.tint 区分，绝不能碰材质）。
export function paintSkin(root, weaponId, skinId) {
  const skin = findSkin(weaponId, skinId);
  if (!skin) return null;
  const slots = skin.slots || {};
  const glow = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.material || !o.userData.baseMat) return;
    const base = o.userData.baseMat;
    const m = o.material;
    // 1) 还原出厂
    if (base.color && m.color) m.color.copy(base.color);
    if (base.emissive && m.emissive) m.emissive.copy(base.emissive);
    if (base.metalness !== undefined) m.metalness = base.metalness;
    if (base.roughness !== undefined) m.roughness = base.roughness;
    if (base.emissiveIntensity !== undefined) m.emissiveIntensity = base.emissiveIntensity;
    if (base.envMapIntensity !== undefined) m.envMapIntensity = base.envMapIntensity;
    if (m.map !== undefined) {
      // material.color 是**乘在 map 上**的，所以带贴图的枪（AWM/USP）非原厂皮肤一律丢贴图；
      // 而「原厂」必须把迷彩贴图还原回来。切 map 的 null/非 null 会改变着色器的 USE_MAP
      // 分支，所以必须同时 needsUpdate。
      // 「保留贴图」有三个来源：原厂、皮肤自己声明（`keepMap`，给基础低模用）、
      // 以及**网格自己带的烘焙贴图**（`userData.keepMap`，由 prepareGunMeshes 在加载
      // 模型皮肤时打上）。第三条不能省：模型皮肤若被当成普通皮肤处理，
      // 模型自有贴图会被这一行整个抹掉，只剩一片平涂色。
      const want = (skin.id === STOCK || skin.keepMap || o.userData.keepMap) ? base.map : null;
      if (m.map !== want) {
        m.map = want;
        m.needsUpdate = true;
      }
    }
    // 2) 叠皮肤覆盖项（按 GLB 原始材质名对号入座）
    const ov = slots[o.userData.matName];
    if (!ov) return;
    if (ov.color !== undefined && m.color) m.color.setHex(ov.color);
    if (ov.emissive !== undefined && m.emissive) m.emissive.setHex(ov.emissive);
    if (ov.metalness !== undefined) m.metalness = ov.metalness;
    if (ov.roughness !== undefined) m.roughness = ov.roughness;
    if (ov.emissiveIntensity !== undefined) m.emissiveIntensity = ov.emissiveIntensity;
    if (ov.envMapIntensity !== undefined) m.envMapIntensity = ov.envMapIntensity;
    // 3) 登记发光呼吸的候选材质（只有真正带 emissive 的部位才呼吸）
    if (skin.pulse && ov.emissive !== undefined && m.emissive) {
      glow.push({ mat: m, base: m.emissiveIntensity, amp: skin.pulse.amp, speed: skin.pulse.speed });
    }
  });
  return glow;
}
