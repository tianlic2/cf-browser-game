// ===== 世界枪械目录（敌人手持 + 地面掉落物）=====
//
// 玩家那把枪是给**视模**定标的（最长边 def.targetLen、枪口朝本地 -z，见 main.js 的 loadWeapon）。
// 「掉在地上」和「端在敌人手里」的是**世界模型**，需要另一套归一化：
//   - 地面掉落物：沿用玩家那把的尺寸与朝向就够（它只是躺在那儿自转）
//   - 敌人手持：枪口必须朝本组 +z —— 骨架的正面 = 朝向 = 枪口方向（见 enemy_model.js），
//     并统一缩到 RIFLE_LEN，因为 enemy_model 的枪口锚点是写死的 RIFLE_HALF + 0.03
//
// 全部变体在启动时从**玩家已加载的枪**派生，不再额外拉 GLB
// （旧实现为了敌人单独又下载了一份 ak47.glb，那份已经删掉）。
//
// 材质按「枪型 × 皮肤」缓存、并在该组合的所有实例之间**共享**：
// 敌人的枪不进 rig.meshes（受击不闪红），地面掉落物建出来之后也不再改材质，
// 所以共享是安全的 —— 而且正是我们想要的（8 个敌人端着同款枪不该有 8 份材质）。
// **由此推出一条硬规则：回收掉落物只 scene.remove()，绝不 dispose 几何/材质。**
// 它们是目录里的共享对象，dispose 会把其它掉落物和目录本身一起弄坏
// （这一点与 main.js 里 grenadePool 的「用完即 dispose」正好相反）。

import * as THREE from "three";
import { RIFLE_LEN } from "./enemy_model.js";
import { paintSkin, skinsFor, findSkin } from "./skins.js";

// 会出现在世界里的枪。前三把是敌人随机携带的池子；手枪只用于「玩家丢掉副武器」。
const WORLD_GUN_IDS = ["ak", "m4", "awm", "pistol"];
export const ENEMY_GUN_IDS = ["ak", "m4", "awm"];

const cache = {}; // id → { world: {skinId: Object3D}, enemy: {skinId: Object3D} }
let built = false;

// 克隆一棵模型树，并**逐份克隆材质**、把 userData 里的两份元数据搬回克隆体。
//
// 为什么不能直接 clone(true) 了事：Object3D.copy() 会把 userData 走一遍
// `JSON.parse(JSON.stringify(...))`，而 baseMat 里存着 THREE.Color 与 THREE.Texture ——
// 走完那一趟，颜色变成普通 {r,g,b} 对象（paintSkin 还能凑合读）、**贴图引用直接丢失**
// （AWM/USP 的「原厂」迷彩就是这么没的）。clone() 保持子节点顺序，所以按下标配对
// 模板与克隆体是确定的。
function cloneWithMaterials(tpl) {
  const src = [];
  tpl.traverse((o) => {
    if (o.isMesh) src.push(o);
  });
  const out = tpl.clone(true);
  const dst = [];
  out.traverse((o) => {
    if (o.isMesh) dst.push(o);
  });
  for (let i = 0; i < src.length && i < dst.length; i++) {
    // 每个变体都要自己一份材质：变体之间要上**不同的皮肤**，共用材质会互相覆盖
    dst[i].material = src[i].material.clone();
    dst[i].userData.matName = src[i].userData.matName;
    // baseMat 只读，可以按引用共享同一份出厂快照
    dst[i].userData.baseMat = src[i].userData.baseMat;
  }
  return out;
}

// 从玩家那把枪派生一个世界变体。
// yaw = 目标绕 Y 角（决定枪口朝 -z 还是 +z）；len = 非 0 时把最长边缩到该长度。
function makeVariant(srcGun, yaw, len) {
  const g = cloneWithMaterials(srcGun);
  g.rotation.set(0, yaw, 0);
  if (len) {
    const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    g.scale.multiplyScalar(len / Math.max(size.x, size.y, size.z));
  }
  // 旋转（与缩放）之后再量一次包围盒、把中心拉回原点。
  // **对地面掉落物这一步是必须的**：它每帧都在自转，偏心（比如在旧朝向上量的中心）的模型
  // 转起来会「甩」出一个圈。Box3.setFromObject 内部会刷新 matrixWorld，
  // 所以量到的是含旋转的真实中心。
  g.updateWorldMatrix(false, true);
  g.position.sub(new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()));
  return g;
}

// 敌人手里的枪压暗一档：正午直射的世界光照比视模那套灯亮，不压会白得发光。
// **刻意不用旧 normalizeRifle 那个「往褐色 lerp」**——那会把金/红这类皮肤
// 整体染成脏橄榄，而敌人现在是有皮肤的。
function darkenForEnemy(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if (m.color) m.color.multiplyScalar(0.72);
    if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.45);
  });
}

// 启动时调一次。guns = { ak: Object3D, m4: …, awm: …, pistol: … }（传 owned[id].gun）
export function buildGunCatalog(guns) {
  for (const id of WORLD_GUN_IDS) {
    const src = guns[id];
    if (!src) continue; // 某把枪加载失败就跳过，掉落时按 null 处理
    const yaw = src.rotation.y; // 玩家那把已经摆成「枪口朝 -z」，+π 就是敌人要的 +z
    const world = {};
    const enemy = {};
    for (const skin of skinsFor(id)) {
      const w = makeVariant(src, yaw, 0);
      paintSkin(w, id, skin.id);
      world[skin.id] = w;

      const e = makeVariant(src, yaw + Math.PI, RIFLE_LEN);
      paintSkin(e, id, skin.id);
      darkenForEnemy(e); // 必须在 paintSkin **之后**（上漆会覆盖颜色）
      enemy[skin.id] = e;
    }
    cache[id] = { world, enemy };
  }
  built = true;
  return built;
}

export function catalogReady() {
  return built;
}

function pick(id, skinId, kind) {
  const c = cache[id];
  if (!c) return null;
  const s = findSkin(id, skinId); // 找不到会回退到原厂，绝不会是 undefined
  return (s && c[kind][s.id]) || null;
}

// 地面掉落物用的模型。**调用方可以 clone(true)**：克隆体与目录共享材质，
// 而掉落物建出来之后不再改材质，所以共享没问题；也正因为共享才不能 dispose。
// ⚠️ clone(true) 会把 userData 走一遍 JSON 往返，掉落物不需要 baseMat，无所谓。
export function worldModel(id, skinId) {
  return pick(id, skinId, "world");
}

// 敌人手持用的模型（枪口朝 +z、已缩到 RIFLE_LEN、已压暗）。交给 SoldierRig.setRifle()，
// 它会自己再 clone(true) 一份 —— 同上，克隆体不需要 userData。
export function enemyModel(id, skinId) {
  return pick(id, skinId, "enemy");
}

// 抽一份敌人配装：型号等概率抽一个，再在该型号的皮肤列表里等概率抽一款。
// 组合数 = 每个型号的皮肤款数之和（不是型号数 × 款数）：ak 2 + m4 6 + awm 3 = **11** 种。
// 全部能持枪的皮肤加 pistol 的 1 款 = **12**（`worldModels()` 断言的数就是它）。
// 表里只剩「原厂 + 模型皮肤」两类（见 skins.js 开头那条），所以这四个数就是
// 「型号的条目数」：ak 2 / m4 6 / awm 3 / pistol 1 / knife 1。
// 匕首不计入这里（`randomGunRoll` 也不抽匕首）。
// 注意这里**不排除模型皮肤**：敌人拿的仍是基础低模（目录只从 baseGun 派生），
// 但配色用的是那款模型皮肤的 `slots`。
export function randomGunRoll() {
  const id = ENEMY_GUN_IDS[(Math.random() * ENEMY_GUN_IDS.length) | 0];
  const list = skinsFor(id);
  const skin = list.length ? list[(Math.random() * list.length) | 0] : null;
  return { id, skin: skin ? skin.id : null };
}
