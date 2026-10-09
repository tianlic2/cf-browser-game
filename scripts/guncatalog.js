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
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RIFLE_LEN } from "./enemy_model.js";
import { paintSkin, skinsFor, findSkin, DEFAULT_SKIN } from "./skins.js";

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

// ---------- 目录侧的**按材质预合批**（每把枪 12~13 块 → 3 块）----------
//
// 世界里的枪是**刚体**（敌人手持、地面掉落物都只有整把枪的位移/旋转，没有任何一块
// 单独动），所以「同一材质名的那些网格」完全可以烘成一块几何。实测 AK 12 块 / M4 13 块，
// 而材质只有 **3 种**（AK: Dark_metal/Metal/Wood，M4: Primary/Secondary/Highlight）——
// 也就是说 8 个敌人手里的枪从 ~99 次绘制调用降到 ~24 次。
//
// **必须烘焙矩阵**（与 enemy_model.js 那套骨段合批不同，那边 box()/limb() 建几何时
// 就把偏移 translate 进去了、两块本来就在同一个局部系）：GLB 里每块网格各有自己的
// 变换，所以要先把它们各自相对**变体根**的矩阵乘进顶点。做法是
//   local = inverse(root.matrixWorld) · mesh.matrixWorld
// 变体是游离在场景外的树，`updateMatrixWorld(true)` 会把根当作世界根，所以这个式子是
// 确定性的（不依赖它在不在 scene 里）。
//
// **分组键是 `userData.matName`，不是材质对象** —— `cloneWithMaterials` 是**逐网格**
// 克隆材质的（同一个材质名也会被克隆出 12 份），按对象分组一个都合并不了。按名字分组
// 之后再核一遍「这一组的材质属性是不是真的一样」当保险：名字相同但属性不同（脏资产）
// 就整组跳过，宁可多几次调用也不能把两块不同颜色的件并成一块。
function matsEqual(a, b) {
  if (a.type !== b.type) return false;
  const same = (x, y) => (x === null || x === undefined) ? (y === null || y === undefined) : x === y;
  const num = (x, y) => Math.abs((x ?? 0) - (y ?? 0)) < 1e-6;
  const hex = (c) => (c ? c.getHexString() : "");
  return hex(a.color) === hex(b.color) && hex(a.emissive) === hex(b.emissive)
    && num(a.metalness, b.metalness) && num(a.roughness, b.roughness)
    && num(a.emissiveIntensity, b.emissiveIntensity) && same(a.map, b.map);
}

// 返回合并统计（给测试读）。合不了的组**原样留着**，不抛、不删。
//
// `?nobatch` 直接空转返回 —— 与 `enemy_model.js` 的 `mergePair` 读的是同一面旗子
// （那边管骨段、`scripts/map.js` 的 `NO_BATCH` 管地图静态合批）。三处合起来才是
// 「合批前」的完整对照；只关一处的话 A/B 比的是两个都合过一半的东西。
const NO_BATCH = typeof location !== "undefined"
  && new URLSearchParams(location.search).has("nobatch");

export function mergeByMaterial(root) {
  if (NO_BATCH) return { mergedGroups: 0, savedMeshes: 0 };
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse((o) => { if (o.isMesh) groups.set(o, o.userData.matName || o.material.name || "?"); });
  const byName = new Map();
  for (const [mesh, name] of groups) byName.set(name, (byName.get(name) || []).concat(mesh));

  let mergedGroups = 0, savedMeshes = 0;
  for (const [, list] of byName) {
    if (list.length < 2) continue;
    const ref = list[0].material;
    if (!list.every((m) => matsEqual(ref, m.material))) continue;   // 脏资产：整组跳过
    const geos = [];
    let bad = false;
    for (const m of list) {
      const g = m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      geos.push(g);
    }
    // 属性集不一致 / 索引态不一致时 mergeGeometries 返回 null 并在控制台留一行 error
    // （会污染「零报错」断言），所以这里自己吞掉异常、失败就整组保持原样。
    let geo = null;
    try { geo = mergeGeometries(geos, false); } catch (e) { geo = null; }
    if (!geo || !geo.attributes.position) { bad = true; }
    if (bad) { for (const g of geos) g.dispose(); continue; }

    const holder = new THREE.Group();
    holder.name = "merged_" + (list[0].userData.matName || "mat");
    for (const m of list) m.parent.remove(m);
    const mm = new THREE.Mesh(geo, ref);            // 一组共用一份材质
    mm.userData.matName = list[0].userData.matName;
    mm.userData.baseMat = list[0].userData.baseMat;
    mm.castShadow = false; mm.receiveShadow = false;
    holder.add(mm);
    root.add(holder);
    for (const g of geos) g.dispose();              // 烘完即弃：顶点已经进了合并几何
    mergedGroups++; savedMeshes += list.length - 1;
  }
  return { mergedGroups, savedMeshes };
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
export function buildGunCatalog(guns, models = {}) {
  for (const id of WORLD_GUN_IDS) {
    const src = guns[id];
    if (!src) continue; // 某把枪加载失败就跳过，掉落时按 null 处理
    const yaw = src.rotation.y; // 玩家那把已经摆成「枪口朝 -z」，+π 就是敌人要的 +z
    const world = {};
    const enemy = {};
    for (const skin of skinsFor(id)) {
      // Classic loadouts use the same geometry in hand, on enemies and on deck.
      const model=models[id]?.[skin.id] || src;
      const modelYaw=model===src ? yaw : model.rotation.y;
      const w = makeVariant(model, modelYaw, 0);
      paintSkin(w, id, skin.id);
      mergeByMaterial(w); // 必须在 paintSkin **之后**：分组键 matName 与属性核验都要看上完漆的结果
      world[skin.id] = w;

      const e = makeVariant(model, modelYaw + Math.PI, RIFLE_LEN);
      paintSkin(e, id, skin.id);
      darkenForEnemy(e); // 必须在 paintSkin **之后**（上漆会覆盖颜色）
      mergeByMaterial(e); // 同上，且必须在 darkenForEnemy 之后（压暗是逐材质的）
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

// Classic battlefield palette, including enemy drops. Catalog entries for the
// modern skins remain available, but do not enter the default match pool.
export function randomGunRoll() {
  const id = ENEMY_GUN_IDS[(Math.random() * ENEMY_GUN_IDS.length) | 0];
  return { id, skin: DEFAULT_SKIN[id] };
}
