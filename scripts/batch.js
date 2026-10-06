// ===== 静态几何合批：把大量同材质的小 mesh 合成寥寥几个，压绘制调用 =====
//
// 为什么要它：实测每帧 1453 次绘制调用、1455 个 mesh。其中**远景货轮**一项就占 376 次
// （`ship.glb` 88 个 node / 94 个 primitive，被 clone 了 4 份 = 376），而它们只是天边的剪影，
// 既不在 obstacles 也不在 colliders。按材质合批后 4 份船总共只剩 9 次绘制。
//
// **三条铁律（违反的症状都是静默的，且很难从现象反推）**：
//
//  ① 只喂**静止**对象。任何被 `update(t, dt)` 驱动的对象（海浪、水贴图 offset、吊装小车、
//     烟雾 Sprite、海鸥）绝不能进来 —— 烘进几何之后它就永远冻在第一帧的位置上。
//
//  ② 合并 `obstacles` 里的对象时，**必须原子地**做「从 obstacles 剔除原对象 → scene.remove
//     → 把合并产物 push 回 obstacles」。原因：`Raycaster.intersectObject` 只读 `matrixWorld`，
//     **不要求对象在场景里**。只 remove 却留在 obstacles 里，子弹会继续命中一个用陈旧矩阵
//     算出来的点，而且 `h.point` 是错的 —— 这正是 AGENTS.md 反复警告的「显示的障碍与实际
//     障碍不符」。所以本模块把重指的动作做成 `onReplace` 回调，逼调用方显式处理。
//
//  ③ 合并会抹掉每个 mesh 自己的 `userData`（敌人靠 `userData.part === "head"` 判爆头），
//     所以只喂纯场景件，绝不喂敌人网格。
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// 合并只需要这三件。多带属性会让 `mergeGeometries` 因「属性集不一致」直接返回 null
// （并在控制台留一行 error，污染「零报错」的断言）。
const KEEP = ["position", "normal", "uv"];

// 把一个 mesh 的几何烘到**世界坐标**，并裁成三件套。
// `applyMatrix4` 会用 normalMatrix 正确变换法线，所以带旋转/缩放的实例烘完光照仍然对。
function bake(mesh) {
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
  g.morphAttributes = {};
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

// 按材质把一组 mesh 合成若干几何。返回 `[{ geometry, material, meshes }]`。
// 调用方需保证 `scene.updateMatrixWorld(true)` 已经跑过（`batchStatic` 会代劳）。
export function mergeByMaterial(meshes) {
  const groups = new Map(); // material.uuid → { material, geos, meshes }
  for (const m of meshes) {
    if (!m.isMesh || !m.geometry || !m.material) continue;
    const key = m.material.uuid;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { material: m.material, geos: [], meshes: [] }));
    g.geos.push(bake(m));
    g.meshes.push(m);
  }
  const out = [];
  for (const g of groups.values()) {
    // 索引模式必须全体一致：`mergeGeometries` 的判据是「index 要么都有、要么都没有」，
    // 混着喂它会返回 null（不抛异常，只在控制台留一行 error）。
    const allIdx = g.geos.every((x) => !!x.index);
    const anyIdx = g.geos.some((x) => !!x.index);
    const geos = anyIdx && !allIdx ? g.geos.map((x) => (x.index ? x.toNonIndexed() : x)) : g.geos;
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) {
      console.warn(`[batch] 合并失败，跳过该材质的 ${g.meshes.length} 个网格`);
      for (const x of geos) x.dispose();
      continue;
    }
    merged.computeBoundingSphere();
    out.push({ geometry: merged, material: g.material, meshes: g.meshes });
  }
  return out;
}

// 原子替换：合成 → 把新 mesh 加进 scene → 摘掉原 mesh → 让调用方重指 obstacles。
// `onReplace(oldMeshes, newMeshes)` 是给 obstacles 用的钩子；这批对象不在 obstacles 里时可省。
// 返回合并出来的新 mesh 数组。
export function batchStatic(scene, meshes, { onReplace, castShadow = false, receiveShadow = false } = {}) {
  const list = meshes.filter((m) => m && m.isMesh && m.geometry && m.material);
  if (!list.length) return [];
  scene.updateMatrixWorld(true); // 必须先刷新：bake() 读的就是 matrixWorld
  const merged = mergeByMaterial(list);
  const fresh = [];
  for (const m of merged) {
    const mesh = new THREE.Mesh(m.geometry, m.material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    scene.add(mesh);
    fresh.push(mesh);
  }
  for (const m of list) if (m.parent) m.parent.remove(m);
  if (onReplace) onReplace(list, fresh);
  return fresh;
}
