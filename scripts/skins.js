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
