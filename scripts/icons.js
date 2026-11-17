// CF 风格的击杀图标图形库：**纯字符串常量 + SVG 拼装函数**。
// 不 import THREE、不碰游戏状态（照 scripts/chat.js 的独立性）。
//
// 为什么是内联 SVG 字符串，而不是贴图 / Sprite / 字体图标：
//   ① 图标是 HUD 层的 2D 图元；武器剪影继承 CSS 的 `currentColor`，圆形连杀章
//      在 SVG 内用蓝钢与金色渐变画六档，不需要六张位图；
//   ② 不需要任何额外网络请求（本项目「无外部资源依赖」那条约定，见 audio.js）；
//   ③ 进 `.hud` 层就天然压在 `.scope` 之上（CF 开镜后击杀图标照常可见）。
//
// **绝不能把这些字符串塞进任何 `Object3D.userData`** —— `Object3D.copy()` 会把
// userData 过一遍 `JSON.parse(JSON.stringify(...))`（见 AGENTS.md 的 guncatalog 那条，
// `userData.baseMat` 里的 Color/Texture 就是这么丢的）。图标只活在 DOM 里。

// 武器 id → 图标形态。**刻意是一张静态表，不从 WEAPON_DEFS 派生** ——
import { CF_VANILLA } from './cf_vanilla_catalog.js';
// 从那里读要 import main.js，而这个模块必须保持「谁都能 import」的独立性
// （chat.js 同理）。代价是加新武器时要在这里补一行；兜底是 "rifle"，不会出现空图标。
export const ICON_KIND = {
  ...Object.fromEntries(CF_VANILLA.map(s=>[s.id,s.type==='shotgun'?'rifle':s.type])),
  ak: "rifle",
  m4: "rifle",
  ironbeast: "rifle",
  scar: "rifle",
  akgold: "rifle",
  kn57: "rifle",
  awm_nature: "sniper", hbr7: "sniper",
  awm: "sniper",
  barrett: "sniper",
  m200: "sniper",
  pistol: "pistol",
  deagle: "pistol",
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

// 右下角 HUD 使用的逐枪侧面剪影。这里刻意使用 120×48 的宽画布，而不是旧版
// 24×24 通用小图：长枪的枪托、机匣、弹匣、瞄具和枪口比例需要足够的横向采样，
// 才能在 132×60 的 HUD 区域里认出具体型号。仍然是内联 currentColor SVG，零请求、
// 零模型解析，不会为了图标拖慢对局。
const WEAPON_ICON_BODY = {
  ak:
    '<path d="M2 24 18 15l8 2v14l-8 3-16-4 9-3Z"/>' +
    '<path d="M24 18h39l8 5v8H25Z"/><path d="M37 13h26l8 8H54Z"/>' +
    '<path d="M68 19h37v3H68ZM103 18h15v5h-15Z"/>' +
    '<path d="M51 30h13l-2 16H51c7-5 7-10 0-16Z"/><path d="M39 30h9l-3 10h-7Z"/>',
  m4:
    '<path d="M2 20h18v3H2Zm4-6h4v18H6Zm8 3h14v12H14Z"/>' +
    '<path d="M25 18h43v15H25Z"/><path d="M33 12h24l8 6H37Z"/>' +
    '<path d="M67 20h42v4H67Zm39-3h4v10h-4Zm3 4h10v3h-10Z"/>' +
    '<path d="M48 32h12l-2 14H47Z"/><path d="M34 32h9l-3 10h-7Z"/>',
  ironbeast:
    '<path d="M2 25 17 13l12 5-5 16-12 2Z"/><path d="M23 17h47l8 6-5 10H27Z"/>' +
    '<path d="M34 11 48 7l18 10H36Z"/><path d="M67 18h39l-6 5 18 2-18 3H70Z"/>' +
    '<path d="m48 31 15 1-5 14H46Z"/><path d="m33 31 10 1-4 10h-8Z"/>' +
    '<path d="M78 13h4v8h-4Zm9 5 9-8 4 2-7 8Z"/>',
  scar:
    '<path d="M2 18h20l8 5-7 11H9l-7-5 12-3Z"/><path d="M25 18h45l7 6-5 9H27Z"/>' +
    '<path d="M31 13h42v5H31Z"/><path d="M69 20h39v4H69Zm37-4h4v11h-4Zm3 5h10v3h-10Z"/>' +
    '<path d="M50 32h12l-1 14H49Z"/><path d="M37 32h9l-3 10h-8Z"/>',
  akgold:
    '<path d="M2 24 18 15l8 2v14l-8 3-16-4 9-3Z"/><path d="M24 18h39l8 5v8H25Z"/>' +
    '<path d="M37 13h26l8 8H54Z"/><path d="M68 19h37v3H68Zm35-2h16v6h-16Z"/>' +
    '<path d="M51 30h13l-2 16H51c7-5 7-10 0-16Z"/><path d="M39 30h9l-3 10h-7Z"/>' +
    '<path d="m87 23 30 8-2 3-30-9Z"/>',
  kn57:
    '<path d="M2 25 15 15h20l8 8-8 12H16Z"/><path d="m31 16 42-3 11 8-9 13H36Z"/>' +
    '<path d="m43 9 28 1 8 6-39 2Z"/><path d="M75 19h33l10 4-10 5H74Z"/>' +
    '<path d="M56 32h14l-4 14H54Z"/><path d="M38 32h10l-4 10h-8Z"/>' +
    '<path d="m88 14 12 2 5 4H86Z"/>',
  barrett:
    '<path d="M2 24 18 16h17l-5 17H12Z"/><path d="M29 18h51l8 7-8 9H29Z"/>' +
    '<path d="M39 9h34l7 4-7 4H39l-6-4Z"/><path d="M43 16h4v4h-4Zm25 0h4v4h-4Z"/>' +
    '<path d="M79 21h31v4H79Zm29-3h10v10h-10Z"/><path d="M48 33h14l-2 13H47Z"/>' +
    '<path d="m84 32 4 1-8 13h-3Zm8 0 4-1 6 15h-3Z"/>',
  m200:
    '<path d="M2 25 14 14h20l11 8-10 13H17l7-7Z"/><path d="M33 18h47l9 7-9 8H34Z"/>' +
    '<path d="M43 8h35l8 5-8 4H43l-7-4Z"/><path d="M47 16h4v4h-4Zm27 0h4v4h-4Z"/>' +
    '<path d="M79 21h39v4H79Z"/><path d="M52 32h14l-3 14H50Z"/>' +
    '<path d="m88 31 4 1-8 14h-3Zm8 0 4-1 7 16h-3Z"/>',
  deagle:
    '<path d="M16 10h70l13 7-10 10H18L9 20Z"/><path d="M25 27h40L56 46H31Z"/>' +
    '<path d="M66 28h13l-3 7H64Z"/><path d="M85 13h25v10H88Z"/><path d="M30 7h48v4H30Z"/>',
  knife:
    '<path d="M4 12h48l17 8-14 8H5l20-5Z"/><path d="M49 18 73 3l17 5-18 12Z"/>' +
    '<path d="M53 27h31v5H53Z"/><path d="M78 31h31l9 5-10 6H78Z"/>',
  kukri:
    '<path d="M4 13c35 2 63 5 94-8 6-3 13-2 18 1-16 2-24 9-31 17-15 18-42 18-66 10Z"/>' +
    '<path d="M5 12h13v23H5Z"/><path d="M2 33h22v5H2Z"/>',
  frag:
    '<path d="M45 13h30v7h-30Z"/><path d="M39 20h42l8 9-6 17H37l-6-17Z"/>' +
    '<path d="M55 4h14v10H55Zm13 2h21v5H68Z"/>',
  flash:
    '<path d="M43 8h38v7H43Z"/><path d="M39 15h46v31H39Z"/><path d="M51 3h15v7H51Zm14 2h22v5H65Z"/>',
  smoke:
    '<path d="M44 7h36v8H44Z"/><path d="M40 15h44v31H40Z"/><path d="M55 2h14v7H55Zm13 2h19v5H68Z"/>',
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
  const inner = WEAPON_ICON_BODY[weaponId] || ICON_BODY[iconKindFor(weaponId)] || ICON_BODY.rifle;
  const viewBox = WEAPON_ICON_BODY[weaponId] ? "0 0 120 48" : "0 0 24 24";
  return '<svg class="' + (cls || "ico-gun") + '" viewBox="' + viewBox +
    '" fill="currentColor" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + inner + '</svg>';
}

// 爆头徽记。`golden` 只影响 class，颜色/发光全部交给 CSS
// （`.gold` 那档见 styles/game.css）—— 图形本身不变，与 CF 一致。
// `SKULL` 是裸 d 串，这里负责补 `<path>` 外壳（见上面那条 ⚠️）。
export function headshotBadgeSvg(golden, cls) {
  return svg('<path d="' + SKULL + '"/>', (cls || "ico-hs") + (golden ? " gold" : ""), true);
}

// 参考经典 CF 的八角星圆章：深钢外圈、蓝灰底、每杀一人点亮一道金色星芒。
// 八杀之后增加真实的星芒数量，不把连杀计数截断在八。
const MEDAL_GOLD_ORDER = [0, 1, 7, 2, 6, 3, 5, 4];
const medalPoint = (radius, angle) => {
  const x = 50 + radius * Math.cos(angle), y = 50 + radius * Math.sin(angle);
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
};
const medalTeeth = Array.from({ length: 32 }, (_, i) =>
  medalPoint(i % 2 ? 43.4 : 47.4, -Math.PI / 2 + i * Math.PI / 16)
).join("L");
function medalRay(angle, halfAngle, gold) {
  const left = medalPoint(14.5, angle - halfAngle);
  const tip = medalPoint(36, angle);
  const right = medalPoint(14.5, angle + halfAngle);
  return '<path class="ki-ray ' + (gold ? 'lit' : 'steel') + '" d="M50 50L' + left + 'L' + tip + 'L' + right + 'Z" fill="url(#ki-' + (gold ? 'gold' : 'steel') + ')" stroke="#152124" stroke-width="1.7" stroke-linejoin="round"/>' +
    '<path d="M50 50L' + left + 'L' + tip + 'Z" fill="' + (gold ? '#ffe8a1' : '#afc0be') + '" opacity=".52"/>';
}

export function killMedalSvg(streakCount, headshot, golden) {
  const count = Math.max(1, Math.floor(streakCount) || 1);
  const steelRays = Array.from({ length: 8 }, (_, i) =>
    medalRay(-Math.PI / 2 + i * Math.PI / 4, Math.PI / 8, false)
  ).join("");
  const goldRays = Array.from({ length: count }, (_, i) => {
    const slot = count <= 8 ? MEDAL_GOLD_ORDER[i] : i;
    const slots = count <= 8 ? 8 : count;
    return medalRay(-Math.PI / 2 + slot * 2 * Math.PI / slots,
      Math.min(Math.PI / 8, Math.PI / slots * 0.84), true);
  }).join("");
  return '<svg class="ki-medal" viewBox="0 0 100 100" data-tier="' + count + '" data-streak="' + count + '" aria-hidden="true">' +
    '<defs>' +
      '<radialGradient id="ki-rim"><stop stop-color="#768c8a"/><stop offset=".72" stop-color="#354c51"/><stop offset="1" stop-color="#152326"/></radialGradient>' +
      '<linearGradient id="ki-steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9eb2b2"/><stop offset=".45" stop-color="#536d75"/><stop offset="1" stop-color="#233b42"/></linearGradient>' +
      '<linearGradient id="ki-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff4bd"/><stop offset=".42" stop-color="#dfa84c"/><stop offset="1" stop-color="#805023"/></linearGradient>' +
    '</defs>' +
    '<path d="M' + medalTeeth + 'Z" fill="#101c20" stroke="#091114" stroke-width="2"/>' +
    '<circle cx="50" cy="50" r="42" fill="url(#ki-rim)" stroke="#a5b2a9" stroke-width="1.5"/>' +
    '<circle cx="50" cy="50" r="37" fill="#23383d" stroke="#0e1a1e" stroke-width="2.4"/>' +
    steelRays + goldRays +
    '<circle cx="50" cy="50" r="' + (count > 8 ? 9 : 7) + '" fill="' + (count > 8 ? '#21363c' : count >= 5 ? '#dba54c' : '#7d9798') + '" stroke="#17272a" stroke-width="2"/>' +
    (count > 8 ? '<text x="50" y="52.7" text-anchor="middle" fill="#fff0b5" font-family="Arial,sans-serif" font-weight="bold" font-size="' + (count >= 100 ? 5.5 : 8) + '">' + count + '</text>' : '') +
    (headshot ? '<circle class="ki-hs' + (golden ? ' gold' : '') + '" cx="50" cy="' + (count > 8 ? 39 : 50) + '" r="3.2" fill="' + (golden ? '#fff3bb' : '#d9e6df') + '"/>' : '') +
    '<circle cx="50" cy="50" r="40" fill="none" stroke="#0b171a" stroke-width="1.2"/>' +
    '</svg>';
}
