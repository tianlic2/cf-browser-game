// CF 风格的击杀图标图形库：**纯字符串常量 + 两个拼装函数**。
// 不 import THREE、不碰游戏状态（照 scripts/chat.js 的独立性）。
//
// 为什么是内联 SVG 字符串，而不是贴图 / Sprite / 字体图标：
//   ① 图标是 HUD 层的 2D 图元，走 DOM 才能跟着 CSS 的 `currentColor` 走 ——
//      普通击杀黄 / 爆头红 / 黄金爆头金各一档只改一个 class，不需要三份资源；
//   ② 不需要任何额外网络请求（本项目「无外部资源依赖」那条约定，见 audio.js）；
//   ③ 进 `.hud` 层就天然压在 `.scope` 之上（CF 开镜后击杀图标照常可见）。
//
// **绝不能把这些字符串塞进任何 `Object3D.userData`** —— `Object3D.copy()` 会把
// userData 过一遍 `JSON.parse(JSON.stringify(...))`（见 AGENTS.md 的 guncatalog 那条，
// `userData.baseMat` 里的 Color/Texture 就是这么丢的）。图标只活在 DOM 里。

// 武器 id → 图标形态。**刻意是一张静态表，不从 WEAPON_DEFS 派生** ——
// 从那里读要 import main.js，而这个模块必须保持「谁都能 import」的独立性
// （chat.js 同理）。代价是加新武器时要在这里补一行；兜底是 "rifle"，不会出现空图标。
export const ICON_KIND = {
  ak: "rifle",
  m4: "rifle",
  awm: "sniper",
  pistol: "pistol",
  knife: "melee",
  frag: "grenade",
  flash: "grenade",
  smoke: "grenade",
};

export function iconKindFor(weaponId) {
  return ICON_KIND[weaponId] || "rifle";
}

// 24×24 视野框里的单色剪影，全部 `fill="currentColor"`（颜色由 CSS 给）。
// 用一组基本图元拼而不是一条大 path：可读、可局部调整，出图一样是单色剪影。
// 朝向一律**枪口朝右**（这是图标惯例，与游戏里枪模的朝向无关）。
const ICON_BODY = {
  // 步枪：枪托 → 机匣 → 枪管，下挂弹匣（弯）+ 握把
  rifle:
    '<path d="M1.6 12.6 6 10.6v4L2.4 15.4Z"/>' +
    '<rect x="5.6" y="10.4" width="12.4" height="3.1"/>' +
    '<rect x="18" y="11.2" width="4.4" height="1.5"/>' +
    '<rect x="19.4" y="9.6" width="1.1" height="1.8"/>' +
    '<rect x="9.6" y="8.9" width="1.3" height="1.7"/>' +
    '<path d="M13 13.5h2.4l-.8 4.9h-2.3Z"/>' +
    '<path d="M8.4 13.5h2.8l.4 2.1q.4 2.8-2.4 3.3l-1.3-2.2q1.7-.7.5-3.2Z"/>',

  // 狙击：镜筒 + 两根镜座 + 更长的枪管 + 两脚架
  sniper:
    '<path d="M1.4 11.4 6 10.2v4.4L3 15.8Z"/>' +
    '<rect x="5.6" y="10.2" width="12.6" height="2.8"/>' +
    '<rect x="18" y="11" width="5" height="1.3"/>' +
    '<rect x="7.2" y="6.6" width="8.6" height="2.2" rx="1.1"/>' +
    '<rect x="8.8" y="8.6" width="1.1" height="1.8"/>' +
    '<rect x="13.2" y="8.6" width="1.1" height="1.8"/>' +
    '<path d="M12.6 13h2.4l-.7 4.8h-2.3Z"/>' +
    '<path d="M17.4 12.9h1l1.8 4.7-1 .3Z"/>',

  // 手枪：套筒 + 枪口 + 握把 + 扳机护圈
  pistol:
    '<rect x="5" y="7.6" width="13" height="3.2" rx="0.5"/>' +
    '<rect x="18" y="8.3" width="1.6" height="1.8"/>' +
    '<rect x="6.4" y="10.8" width="8.4" height="1.4"/>' +
    '<path d="M7 12.2h5.2L11 19H6.6Z"/>' +
    '<rect x="13.4" y="12.2" width="3.2" height="1"/>',

  // 匕首：正握的短剑（刃在上、柄在下），与游戏里倒握的持法无关 —— 图标认脸不认握法
  melee:
    '<path d="M12 2.4 14.2 6.2l-.9 8h-2.6l-.9-8Z"/>' +
    '<rect x="7.8" y="14.2" width="8.4" height="1.5" rx="0.4"/>' +
    '<rect x="10.7" y="15.7" width="2.6" height="5.4" rx="0.9"/>' +
    '<rect x="10.2" y="20.6" width="3.6" height="1.4" rx="0.6"/>',

  // 手雷：卵形弹体 + 引信颈 + 拉环与保险片
  grenade:
    '<rect x="7.6" y="8.2" width="8.8" height="11.4" rx="3.4"/>' +
    '<rect x="10.4" y="5.4" width="3.2" height="3" rx="0.6"/>' +
    '<path d="M13.6 5.8 17.4 6.6l-.4 1.4-3.4-.6Z"/>' +
    '<rect x="16.4" y="6.2" width="1.2" height="3.4" rx="0.6"/>',
};

// 爆头徽记：骷髅。**用 `fill-rule="evenodd"` 把眼窝与鼻洞挖成镂空**（不是画成深色块）——
// 深色块在金色底上会读成三个黑洞，镂空才是「徽记」的正确语汇，也自动适配任何底色。
//
// ⚠️ 这是一个**裸的 d 串**，与上面 `ICON_BODY` 那几条（自带 `<path>`/`<rect>` 标签）
// 形态不同 —— 拼装时必须由 `headshotBadgeSvg()` 补一层 `<path d="…"/>` 包起来。
// 曾经漏了这一步，`svg()` 直接把 d 串塞进 `<svg>…</svg>`，于是 **path 数据被当成文本内容**：
// 元素在、`fill-rule` 属性在、CSS 盒 57×57 也在，就是**一个 `<path>` 子节点都没有、零像素**。
// 这个假绿骗过了一轮 DOM 断言（`querySelector(".ki-hs")` 非空）与一份截图（只看到枪剪影），
// 最终靠「把 DOM 里的 SVG 抠出来喂 `Path2D` 数像素」才现形 —— 与 AGENTS.md 里
// 「审计脚本里的尺寸常数要跟着实测走」是同一族：**量的对象变了，量法没跟着变**。
const SKULL =
  "M12 2.8c-4.7 0-7.6 3.1-7.6 7.3 0 2.5 1 4.3 2.5 5.6l-.3 3.4c0 .9.6 1.5 1.4 1.5h8c.8 0 1.4-.6 1.4-1.5" +
  "l-.3-3.4c1.5-1.3 2.5-3.1 2.5-5.6C19.6 5.9 16.7 2.8 12 2.8Z" +
  "M9.4 8.5a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Z" +
  "M14.6 8.5a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Z" +
  "M12 12.4l1.1 2.2h-2.2Z";

function svg(inner, cls, fillRule) {
  return (
    '<svg class="' + cls + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"' +
    (fillRule ? ' fill-rule="evenodd"' : "") +
    ">" + inner + "</svg>"
  );
}

// 武器剪影。`cls` 由调用方给（DOM 里靠它挂尺寸与颜色）。
export function weaponIconSvg(weaponId, cls) {
  return svg(ICON_BODY[iconKindFor(weaponId)] || ICON_BODY.rifle, cls || "ico-gun");
}

// 爆头徽记。`golden` 只影响 class，颜色/发光全部交给 CSS
// （`.gold` 那档见 styles/game.css）—— 图形本身不变，与 CF 一致。
// `SKULL` 是裸 d 串，这里负责补 `<path>` 外壳（见上面那条 ⚠️）。
export function headshotBadgeSvg(golden, cls) {
  return svg('<path d="' + SKULL + '"/>', (cls || "ico-hs") + (golden ? " gold" : ""), true);
}
