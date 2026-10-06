// ===== 贴地假影（blob shadow）：给「不会投射真实阴影」的动态物体补一层接地感 =====
//
// 为什么需要它：`main.js` 在 init 末尾把阴影贴图冻住了（`shadowMap.autoUpdate = false`，
// 静态几何只烘一次），而敌人骨架本来就显式 `castShadow = false`（`enemy_model.js`）——
// 于是所有会动的东西都**完全没有影子**，脚踩在甲板上像悬空。冻结阴影换来的是每帧
// −378 次绘制调用，这个收益要保住，接地感就由这层程序化假影来补。
//
// **三条硬约束**：
//  ① **绝不能进 `obstacles`/`colliders`**。它是一张纯视觉的薄片：进了 obstacles 就变成
//     「朝空地开枪却打中东西」的隐形墙（AGENTS.md 里警示线那块实心黄板踩过同一个坑）。
//  ② **绝不能进敌人的 `rig.meshes`**。`main.js` 的 `flatTargets()` 只遍历 `e.meshes` 做
//     射线目标，假影混进去会让子弹打在地面上也能"击中敌人"。
//  ③ **材质是全体共享的，所以只能改 `scale`、不能改 `opacity`**。池子里 8 个敌人若各自
//     要一份淡出曲线，就得 8 份材质 + 8 次 uniform 上传，而这里只需要"尸体下沉时影子
//     一起收掉"——缩放到 0 是等价的，且零成本。
//
// 贴图是**黑 RGB + 径向 alpha 渐变**：颜色直接烘进画布，材质 `color` 保持默认白。
// （这与 AGENTS.md 反复强调的「颜色不能两边都上」不冲突 —— 那里说的是两边都上色会
//  色值平方；这里是黑色乘白色，本来就是想要的。）
import * as THREE from "three";

const TEX_SIZE = 128;

// 单位平面（1×1），预先转平到 XZ 面（法线朝 +Y）。
// **几何体只此一份**：尺寸差异全部走 `mesh.scale`，所以无论多少层假影共用一份 VBO。
const GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

let MAT = null;

function blobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = TEX_SIZE;
  const g = c.getContext("2d");
  const r = TEX_SIZE * 0.5;
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  // 中心浓、外缘透明。0.55 那一档是让边缘的衰减更快一点 —— 纯线性渐变会得到一个
  // 「边上还灰着、突然断掉」的硬边，看着像一块贴纸而不是影子。
  grd.addColorStop(0.0, "rgba(0,0,0,0.90)");
  grd.addColorStop(0.55, "rgba(0,0,0,0.52)");
  grd.addColorStop(0.82, "rgba(0,0,0,0.14)");
  grd.addColorStop(1.0, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  const t = new THREE.CanvasTexture(c);
  // RGB 恒为 0，所以这一行对画面**没有影响**（sRGB 解码 0 还是 0），写它只是为了
  // 全仓库「CanvasTexture 一律显式声明 colorSpace」这条规矩不留例外。
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function blobMaterial() {
  if (MAT) return MAT;
  MAT = new THREE.MeshBasicMaterial({
    map: blobTexture(),
    transparent: true,
    // 半透明薄片写深度会在自己身上产生排序artifact，而且它下面就是甲板、不挡任何东西
    depthWrite: false,
    opacity: 0.55,
  });
  return MAT;
}

// 一张默认尺寸的假影。调用方自己决定挂在谁下面、要不要随状态改 scale。
// `y` 抬离地面 2cm：贴面共面会 z-fighting（甲板顶面 y=0），2cm 在俯视下看不出偏移。
export function makeBlobShadow(w = 1.3, d = 1.05, y = 0.02) {
  const m = new THREE.Mesh(GEO, blobMaterial());
  m.scale.set(w, 1, d);
  m.position.y = y;
  m.castShadow = false;
  m.receiveShadow = false;
  // 显式排在不透明件之后、烟雾 Sprite（renderOrder 10）之前
  m.renderOrder = 1;
  return m;
}
