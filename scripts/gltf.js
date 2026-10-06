// ===== GLTFLoader 兼容层：KHR_materials_pbrSpecularGlossiness =====
//
// 为什么需要它：glTF 2.0 早期的两大材质模型之一是「镜面反射 + 光泽度」
// （KHR_materials_pbrSpecularGlossiness），Sketchfab / 3ds Max 那批导出器大量使用它。
// 该扩展后来被 Khronos 废弃、并入 metallic-roughness，three 也在 r150 前后把支持整个删了
// —— 本项目的 three r160 里只剩一句 `Unknown extension "…pbrSpecularGlossiness"` 的
// **警告**，然后照 `pbrMetallicRoughness` 的**默认值**造材质：baseColor 纯白、
// metalness 1、roughness 1、**一张贴图都不挂**。于是这类模型在游戏里一律是一团纯白。
//
// 实测（不是推测）：`models/fps_arms.glb` 的 4 张贴图（漫反射/镜面光泽度/法线/AO）全丢，
// 整个手臂是白的；`models/skins/awm_field.glb` 三个材质全白、2 张贴图全丢。
// **这不是「模型导错了」，是加载器不认这个扩展** —— 换任何模型来都一样。
//
// 这里按官方给的那套转换公式把它接到 MeshStandardMaterial 上：
//   diffuseFactor    → color       （两边都是线性空间，语义完全一致）
//   diffuseTexture   → map         （sRGB，与 baseColorTexture 同一条通路）
//   metalness        → 0           （spec-gloss 没有金属度概念，漫反射项就是反照率）
//   glossinessFactor → 1 − 光泽度  （两种模型对「光滑」的定义互补：粗糙度 = 1 − 光泽度）
// 只做这一条通路。`specularFactor` / `specularGlossinessTexture` 有意丢弃 —— 前者是
// 高光颜色、后者是光泽度贴图，metalness 恒为 0 的介质高光基本是常数，而为了它们把
// three r149 里那整条 ~200 行的 spec-gloss 分支搬回来并不划算。
//
// 用法：**每一处加载 GLB 都必须走 `makeGLTFLoader()`**，不要直接 `new GLTFLoader()`。
// 漏一处 = 那一处的这类模型静默变白，而且控制台只有一行 warning（很容易被当成噪声）。
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const SPEC_GLOSS = "KHR_materials_pbrSpecularGlossiness";

class GLTFSpecGlossExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = SPEC_GLOSS;
  }

  // 只接管带这个扩展的材质；其余一律返回 null，让别的扩展或默认分支去决定类型。
  // （GLTFLoader 用 `_invokeOne` 收集这个返回值，第一个非空的胜出。）
  getMaterialType(materialIndex) {
    const def = this.parser.json.materials[materialIndex];
    return def && def.extensions && def.extensions[SPEC_GLOSS] ? THREE.MeshStandardMaterial : null;
  }

  extendMaterialParams(materialIndex, params) {
    const def = this.parser.json.materials[materialIndex];
    const ext = def && def.extensions && def.extensions[SPEC_GLOSS];
    if (!ext) return Promise.resolve();

    const pending = [];

    // 这个钩子跑在 GLTFLoader 灌完 pbrMetallicRoughness 默认值**之后**，
    // 而 spec-gloss 材质根本没有那个块 —— 所以要覆盖的是「白 + 全金属 + 全粗糙」这一组默认值。
    params.color = new THREE.Color(1, 1, 1);
    params.opacity = 1;
    const d = ext.diffuseFactor;
    if (Array.isArray(d)) {
      // glTF 里的 factor 是**线性**值，必须显式声明色彩空间 —— 与 GLTFLoader 处理
      // baseColorFactor 时用的是同一条 `setRGB(..., LinearSRGBColorSpace)`。
      // 当成 sRGB 读会整体偏亮一档。
      params.color.setRGB(d[0], d[1], d[2], THREE.LinearSRGBColorSpace);
      if (d[3] !== undefined) params.opacity = d[3];
    }
    if (ext.diffuseTexture) {
      pending.push(this.parser.assignTexture(params, "map", ext.diffuseTexture, THREE.SRGBColorSpace));
    }
    params.metalness = 0;
    params.roughness = ext.glossinessFactor === undefined ? 1 : 1 - ext.glossinessFactor;

    return Promise.all(pending);
  }
}

// 造一个「认识 KHR_materials_pbrSpecularGlossiness」的 GLTFLoader。
export function makeGLTFLoader() {
  const loader = new GLTFLoader();
  loader.register((parser) => new GLTFSpecGlossExtension(parser));
  return loader;
}
