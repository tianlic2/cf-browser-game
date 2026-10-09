// ============ CF 风格武器皮肤表 ============
//
// 一款皮肤 = 三件事：
//   1. `slots` —— 按 GLB 里的**原始材质名**分部位上漆（AK 的 Wood/Metal/Dark_metal、
//      M4 的 Primary/Secondary/Highlight）。只有这几把枪的材质是**按部位命名**的，
//      所以能做出 CF 那种「枪身红、枪管金」的分色。
//      AWM 是单网格单材质、USP 是 16 网格共用一个材质 —— 这两把只能整枪染色。
//   2. `pulse` —— emissiveIntensity 上叠加的正弦呼吸（CF 英雄级武器的招牌）。
//      没有 pulse 的皮肤就是恒定，克制是它自己的风格。
//   3. `muzzle` —— 专属枪口焰/枪口光颜色。
//
// 坑：**AWM 与 USP 的材质带贴图，皮肤只能「染」（改 material.color），不能像
// 旧版 AWM 那样整个换掉材质** —— 换掉就等于把 GLB 自带的贴图丢了，只剩一块平涂色，
// 那样视觉上比原厂更差。
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

// ⚠️ 这份表里**只有两类条目**，加新皮肤时必须落在其中一类里：
//   1. 原厂（`STOCK`）——「不上漆」本身，也是唯一保证 `skinsFor(id)` **永不为空**的那一条。
//   2. **模型皮肤** —— 带 `model` 字段、自带一棵 GLB。面板上会因此渲染出「模型」徽章。
// 曾经的 10 款**纯改色皮肤**（火麒麟/黑武士/黄金AK/黑龙/死神/无影/极光/黄金AWM/修罗/天神）
// 已全部删除：它们只是把基础低模染个色，在「换整把模型」这件事面前没有任何辨识度，
// 面板里和原厂挤在一起、只靠一行色块区分，读起来像一份没做完的调色板。
// **原厂必须留着**：删掉它 `skinsFor("pistol")` / `skinsFor("knife")` 会变成空数组，
// 而 `findSkin` 的兜底正是 `list[0] || null` —— 一个空表会让它返回 null，
// 于是 `paintSkin` 返回 null、`applySkinTo` 变成空转，`guncatalog` 里那把枪**整个从世界目录消失**
// （掉落的手枪再也刷不出来，而且没有任何报错）。原厂对应的是基础枪自己的 GLB，
// 「有对应模型」这句话对它是成立的。
export const SKINS = {
  ak: [
    { id: STOCK, name: "原厂", slots: {}, accent: 0x2b2b2e },
    {
      // 「老兵」= 木托经典 AK 的模型皮肤。没有 pulse —— 一把用旧了的钢木枪不该发光，
      // 克制是它自己的风格。
      // 分部位上漆的教训留在这一款上（它的 `slots` 就是给敌人/掉落物那份基础低模用的）：
      // **大面积部件决定主色观感** —— AK 的 `Metal` 覆盖枪管与机匣一大片、`Dark_metal`
      // 只是弹匣/枪机/保险那些小件。想要「哑光黑 + 金线」就得把金放在 Dark_metal；
      // 放 Metal 会得到一把黄枪配黑枪托（第一版实测如此）。以后加 AK 的改色皮肤别再踩。
      id: "classic", name: "经典", slots: {
        Metal: { color: 0x6c7076, metalness: 0.72, roughness: 0.40 },
        Dark_metal: { color: 0x4a4d52, metalness: 0.66, roughness: 0.44 },
        Wood: { color: 0x8a5a2c, metalness: 0.22, roughness: 0.74 },
      },
      muzzle: 0xffb060, accent: 0x8a5a2c,
      model: {
        file: "./assets/classic/ak/ak47.glb", rotY: 0,
        targetLen: 0.82, anchorKey: "ak_cf", muzzleY: 0.075,
      },
    },
  ],

  m4: [
    { id: STOCK, name: "原厂", slots: {}, accent: 0x2b2b2e },
    {
      // Reuse the detailed M4 geometry with classic parkerized steel / polymer.
      // The source has no albedo textures; material slots preserve every model detail.
      id: "classic", name: "经典", slots: {
        Primary: { color: 0x343b3e, metalness: 0.55, roughness: 0.52 },
        Secondary: { color: 0x262b2b, metalness: 0.12, roughness: 0.76 },
        Highlight: { color: 0x5b6160, metalness: 0.60, roughness: 0.46 },
        matM4_1: { color: 0x303334, metalness: 0.32, roughness: 0.62, envMapIntensity: 0.35 },
        matM4_2: { color: 0x444847, metalness: 0.38, roughness: 0.55, envMapIntensity: 0.35 },
        matM4_3: { color: 0x222624, metalness: 0.08, roughness: 0.78, envMapIntensity: 0.3 },
      },
      accent: 0x343b3e, muzzle: 0xffbc72,
      model: { file: "./models/skins/m4_gold.glb", rotY: 0, targetLen: 0.82, anchorKey: "m4_goldenm4" },
    },
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
      // 「霜白」：冷白涂层。基础低模这一版是**给敌人/掉落物**用的平涂配色。
      id: "frost", name: "霜白", slots: {
        Primary: { color: 0xe6ecf2, metalness: 0.42, roughness: 0.38 },
        Secondary: { color: 0xb4c0cc, metalness: 0.50, roughness: 0.42 },
        Highlight: { color: 0x9fb8d0, metalness: 0.58, roughness: 0.32, emissive: 0xcfe4ff, emissiveIntensity: 0.10 },
        // `phongE1SG` 是**模型皮肤那把 GLB 自己的**材质名（models/skins/m4_frost.glb）。
        // 上面三个槽位是基础低模 M4 的名字，选中这款皮肤时模型整把换掉、那三个一个都匹配不上，
        // 而 `m4_frost.glb` 本身**一点颜色都没有**（无 baseColorFactor、0 张图、无 COLOR_0 顶点色，
        // 实测确认），于是整枪渲染成纯白哑光 —— 就是「颜色没显示出来」。
        // 模型皮肤可以额外点名自己 GLB 的材质名（`slots` 是按**实际材质名**查表的，
        // 加不加这一条都不影响基础低模那条路），取主体色 + 一层很淡的冰蓝自发光，
        // 让 `pulse` 的呼吸在这把单材质模型上也有效果。
        phongE1SG: { color: 0xe6ecf2, metalness: 0.42, roughness: 0.38, emissive: 0xcfe4ff, emissiveIntensity: 0.06 },
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
    {
      // 「黄金M4」= 落到 models/skins/m4_gold.glb 的那把金色模型。
      // 上面三个槽位面向**基础低模**（敌人手里那把与地面掉落物拿的就是它）。
      // 模型自己的材质名是 `matM4_1` / `matM4_2` / `matM4_3`，**单独点名**了 ——
      // 与「雷神」的取舍不同，这里是有理由的：那把 GLB 的三个材质是
      // metalness 1 / roughness 0 的**纯镜面**，颜色全在 `baseColorFactor` 里
      // （线性 `[0.823 0.609 0]` / `[1 0.691 0]` / `[0.622 0.430 0]`），没有 baseColorTexture。
      // 颜色本身是对的（不存在「显示不出来」），但 rou 0 + met 1 在白昼天空下整把枪
      // 是那面天穹的镜像，读出来是一块**荧光黄绿**而不是金（截图对比过：
      // 原值实拍 vs 降到 ~0.8/0.25 实拍，后者才像 黄金AK）。
      // 所以这三条**只改光泽度、不写 color** —— 颜色仍取模型自带的出厂值，
      // 只把镜面压到 黄金AK 那一档（met 0.72~0.88 / rou 0.20~0.32），三档明暗关系照模型原意。
      id: "goldenm4", name: "黄金M4", slots: {
        Primary: { color: 0xeacd00, metalness: 0.86, roughness: 0.26 },
        Secondary: { color: 0xb8901c, metalness: 0.80, roughness: 0.34 },
        Highlight: { color: 0xffd900, metalness: 0.92, roughness: 0.20, emissive: 0x4a3800, emissiveIntensity: 0.18 },
        matM4_1: { metalness: 0.78, roughness: 0.26 },
        matM4_2: { metalness: 0.88, roughness: 0.20 },
        matM4_3: { metalness: 0.72, roughness: 0.32 },
      },
      pulse: { amp: 0.08, speed: 1.5 }, muzzle: 0xffd070, accent: 0xeacd00,
      model: {
        // rotY = 0：muzzle 本来就在模型局部 −z（渲染核对过，不是照抄基础枪的 −π/2）。
        file: "./models/skins/m4_gold.glb", rotY: 0,
        targetLen: 0.82, anchorKey: "m4_goldenm4",
      },
    },
    {
      // 「炫金」：白描金纹的华丽 M4（7 个网格、13 张贴图、18406 顶点）。
      // 与「雷神」同一路数 —— 槽位只面向**基础低模**（敌人那把与地面掉落物），
      // 模型自己的材质名是 `mat_15.001` / `mat_26`~`mat_31`、一个都对不上，
      // 于是挂上模型时**没有任何字段被覆盖**，显示出厂贴图。
      // 这把**不需要**像 goldenm4 那样压光泽度：它出厂就是 met 0 / rou 0.5 的普通 PBR，
      // 颜色全在贴图里（`baseColorFactor` 是白的乘数）。所以这里只写基础低模那三个槽位。
      id: "xuanjin", name: "炫金", slots: {
        Primary: { color: 0xe8dcc0, metalness: 0.72, roughness: 0.26 },
        Secondary: { color: 0xb8892c, metalness: 0.82, roughness: 0.22 },
        Highlight: { color: 0xffe9a8, metalness: 0.88, roughness: 0.18, emissive: 0x6a4f10, emissiveIntensity: 0.14 },
      },
      pulse: { amp: 0.07, speed: 1.6 }, muzzle: 0xffe09a, accent: 0xd8b03a,
      model: {
        // rotY = π：muzzle 在模型局部 **+z**（从 ±x 各拍一张核对的 —— 屏幕右分别是世界 −z / +z，
        // 两次都看到枪口在 +z 那一侧）。不是 0、更不是基础枪的 −π/2。
        file: "./models/skins/m4_xuanjin.glb", rotY: Math.PI,
        targetLen: 0.82, anchorKey: "m4_xuanjin",
      },
    },
  ],

  // AWM 单网格单材质且带贴图 —— 整枪染色，贴图细节保留
  awm: [
    { id: STOCK, name: "原厂", slots: {}, accent: 0x2b2b2e },
    {
      id: "classic", name: "经典", slots: {
        "Material.001": { color: 0x526245, metalness: 0.12, roughness: 0.72 },
        lambert1: { color: 0x172522, metalness: 0.30, roughness: 0.15 },
        lambert2: { color: 0x303536, metalness: 0.58, roughness: 0.46 },
        lambert3: { color: 0x526245, metalness: 0.08, roughness: 0.74 },
      },
      accent: 0x526245, muzzle: 0xffbc72,
      model: { file: "./models/skins/awm_field.glb", rotY: -Math.PI / 2, targetLen: 0.95, anchorKey: "awm_field" },
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

  // 手枪没有模型皮肤 —— 只剩原厂。
  pistol: [
    { id: STOCK, name: "原厂", slots: {}, accent: 0x2b2b2e },
  ],

  // 匕首也只有原厂。曾经的两款（「屠龙」「龙啸」）点的槽位是 `knife_s_1` / `knife_s_2`，
  // 那是**换刀之前**那把 knife.glb 的材质名；现在 models/knife.glb 是 3 个网格共用
  // **一个** `Knife` 材质，这两个名字在整个仓库里一个 GLB 都对应不上，选中时画面纹丝不动。
  // 新刀的材质名是 `Knife`，本身带贴图（蓝钢刀身），原厂即正确外观。
  knife: [
    { id: STOCK, name: "原厂", slots: {}, accent: 0x2b2b2e },
  ],
};

// 每把武器**默认带**的皮肤：进战场就是它，换主武器时也回退到它。
// 有模型皮肤的那三把都默认穿模型皮肤（它是游戏的门面），手枪与匕首只有原厂。
// **这里的每个 id 都必须在上面的表里真实存在** —— `skinForGun` 的回退是
// `DEFAULT_SKIN[gunId] || STOCK`，一旦指向一个被删掉的 id，`findSkin` 会静静地回退成原厂，
// 表现为「默认皮肤莫名其妙没了」。
export const DEFAULT_SKIN = {
  ak: "classic", m4: "classic", awm: "classic", pistol: STOCK, knife: STOCK,
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
    // 2) 皮肤覆盖项（按 GLB 原始材质名对号入座）。必须在下面判 map 之前取出来 ——
    // 有没有这一项决定了「丢不丢贴图」，见 want 的第四个来源。
    const ov = slots[o.userData.matName];
    if (m.map !== undefined) {
      // material.color 是**乘在 map 上**的，所以带贴图的枪（AWM/USP）非原厂皮肤一律丢贴图；
      // 而「原厂」必须把迷彩贴图还原回来。切 map 的 null/非 null 会改变着色器的 USE_MAP
      // 分支，所以必须同时 needsUpdate。
      // 「保留贴图」有四个来源：① 原厂；② 皮肤自己声明（`keepMap`，给基础低模用）；
      // ③ **网格自己带的烘焙贴图**（`userData.keepMap`，由 prepareGunMeshes 在加载
      // 模型皮肤时打上）—— 模型皮肤若被当成普通皮肤处理，模型自有贴图会被这一行整个抹掉，
      // 只剩一片平涂色；④ **这款皮肤根本没有匹配到这个材质名**（`!ov`）。
      // ④ 是「用户导入的 GLB 变白」那半个症结：皮肤是按**旧模型的材质名**写的槽位表
      // （匕首是 `knife_s_1`/`knife_s_2`），换掉模型文件之后新材质名（`Knife`）一个都对不上，
      // 于是整把枪既没上色、又因为这一行把自带的 1024² 贴图丢了 —— 双重落空，渲染成纯白。
      // 没被皮肤点名的材质就是「这款皮肤不管它」，那它就该原样保留自己的贴图；
      // 皮肤只管自己写了槽位的那些部位。
      const want = (skin.id === STOCK || skin.keepMap || o.userData.keepMap || !ov) ? base.map : null;
      if (m.map !== want) {
        m.map = want;
        m.needsUpdate = true;
      }
    }
    // 没被这款皮肤点名 → 只还原出厂值，不动它
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
