// ===== 第一人称手臂（视模）+ 换弹动作 =====
// 当前默认：classic_arms.js 从 AK 原视模烘出同一副手套/袖子，复用本文件的握点与动作。
// 下方 fps_arms.glb 的材质、烘焙和说明保留为素材加载失败时的回退路径。
//
// 为什么要有这个模块：武器是挂在相机下的一个 Group，`animateWeapon()` 每帧写它的位移/旋转，
// 于是枪看起来是**从右下角凭空浮出来**的 —— 没有手、也没有「人在操作它」的证据。
//
// **几何来源：`models/fps_arms.glb`（一具 47 骨的蒙皮骨架：一双手 + 两条前臂）。**
// 上一版借的是 `models/cs/ak47.glb` 的 `HandR`/`ArmR`/`HandL`/`ArmL` 四个节点
// （参考项目 counter-strike-in-browser-main，MIT）—— 那是四块**没有骨骼、没有手指、
// 没有掌心结构**的静态壳，放大看就是几个方块拼出的拳。现在这份是**真的手**：
// 四指与拇指各有 3 节可用骨（外加两侧共 10 根「IBM 是单位阵、且不被任何顶点引用」的末节骨），
// bind 姿势是左右**严格镜像**的放松张开手，手上有半指战术手套 + 露出肤色手指，
// 前臂是螺旋缠布。
//
// 【一具有骨架的模型怎么用】蒙皮只作用在**顶点**上，而且在装载期一次性算完 ——
// 游戏里 47 根骨头一帧都不会再动。所以 `bakeFpsArms()` 在装载时：
//   ① 按「指根连线」为轴把手指程序化弯成握拳（轴与符号都是量出来的，见 curlRotations）；
//   ② 把 bind 姿势烘成静态顶点（位置与法线一起，推导见 bakeFpsArms）；
//   ③ 按主导关节切成四块（手 L/R、前臂 L/R），与 CS 那四块**同构** ——
//      于是 `_install()` 之后的一切（handWrap 枢轴 / armWrap 转正 / armStretch / _aim）
//      一个字都不用改。75° FOV 下手指本来就看不出动画，烘成静态反而省掉了
//      `SkinnedMesh` 分侧、共享 skeleton、每帧重算 47 个矩阵的全部复杂度。
//
// **配色走「重映射模型自带的贴图」**：保留作者那套 1024² 漫反射/法线/AO 与它们的
// **结构细节**（肤色手指、缠布棱线），只在装载期按亮度把近黑的手套映到本作的
// 皮革棕 / 橄榄绿调色板，并把 `glossinessFactor = 1`（经 gltf.js 之后 = roughness 0，
// 也就是一副镜面黑手套）压到 0.62 上下。见 `fpsArmMaterial()`。
//
// **材质：重映射模型自带的贴图（`fpsArmMaterial()`）。**
// 上一版是自己现画四套程序化 canvas PBR（针织 / 粒面皮革 / 橡胶垫 / ripstop 袖布，
// 见 git 历史），那是在「手上根本没有贴图」的前提下才划算的做法。现在这份模型自带
// 4 张 1024² 作者贴图（diffuse / spec-gloss / normal / AO），手背的织纹、指关节的褶皱、
// 缠布一圈圈的棱线全都在里面，再拿程序化贴图去盖只会把它糊掉。所以改走「保留结构、重映配色」：
//   ① 反照率 = 拿 diffuse 逐像素按亮度过一条 ramp，把手套的近黑抬到本作的皮革棕 / 橄榄绿，
//      肤色手指天然落在 ramp 的亮端 —— 「戴着手套的手」这个对比正是选这条路的理由；
//   ② 法线 / AO 原样共用，`repeat` 固定 (1,1)（UV 是作者为这张图排的，**绝不能**再去
//      反推「一张图铺多少米」—— 那是给程序化平铺贴图用的）；
//   ③ `roughness` 显式压到 ~0.62：源文件 `glossinessFactor = 1`，经 gltf.js 之后是
//      `roughness = 0` 的一副**镜面黑手套**（与 `m4_gold` 那个 met 1 / rou 0 同类）。
//
// 唯一还吃程序化贴图的是**袖口束带**（`_cuff()` / `cuffMaps()`）—— 那是我们现加的构件、
// 模型里没有对应的贴图。几何按袖管的实测半径现造，UV 烘成「格数」（见 cuffGeo 的注释）。
//
// 坐标系：武器组的局部坐标 = **相机空间**（-z 前、+x 右、+y 上）。
// 因为组挂在相机下、且组自身的变换只由 animateWeapon 写，所以组局部就是「相对眼睛」的坐标。
//
// 骨段约定：**从原点向局部 -y 伸展**。于是「把前臂指向肘部」就是
// `fore.quaternion.setFromUnitVectors(DOWN, normalize(elbow - wrist))`。
// 新模型的前臂也不是轴对齐的（实测腕→肘 ≈ (±0.19, +0.17, ∓0.97) 这种斜的），
// 所以装载时要先把它转正到 -Y，否则 setFromUnitVectors 会把它指歪 —— 见 FPS_SRC 的注释。
import * as THREE from "three";
import { makeGLTFLoader } from "./gltf.js";
import { bakeClassicArms } from './classic_arms.js';
// 只 import 这份文件**真的用到**的原语（纹理管线的实现全在那边）：
// 袖口束带那套程序化贴图（vnoise/field/lowField/buildMaps）＋ 重映射用的色彩转换
// （hexLin 线性化、lin2srgb 回写、makeCanvas/texFrom 出贴图）。
// **手套/袖布那四套程序化配方已删** —— 手上现在自带 4 张 1024² 作者贴图，走 fpsArmMaterial()。
import { vnoise, field, lowField, hexLin, buildMaps, makeCanvas, texFrom, lin2srgb } from "./texturekit.js";

const DOWN = new THREE.Vector3(0, -1, 0);
const _d = new THREE.Vector3();

// 配色：**故意不用源贴图那副近黑手套**。枪本身就是近黑的，手再用同色，整块就是一团
// 分不出结构的黑。棕色皮革 + 橄榄绿袖 —— 与敌人装备仍是同一套迷彩体系，
// 但在枪身上有明确明暗对比。
//
// **这五个色是「重映射 ramp」的两端，不是 `material.color`。**
// `fpsArmMaterial()` 拿 diffuse 的亮度在 `[PALM → GLOVE]`（手）与 `[CUFF → SLEEVE]`（前臂）
// 之间插值，材质那边固定 `color = 0xffffff`。**两边都上色会色值平方**
// （`0x60492e² ≈ 0x241b0d`，手套直接黑成一块；AGENTS.md 记过集装箱那个坑，这会是第三次）。
// 想调色改这里，改完贴图与材质会一起跟着变。
const GLOVE = 0x60492e;   // 手背：暖棕（原手背针织的基色，现在当手的 ramp 亮端）
const PALM = 0x2e2114;    // 掌心 / 指缝：更深的棕，当手的 ramp 暗端
const PAD = 0x26241f;     // 虎口橡胶垫：近黑（保留给袖口束带的暗部）
// 袖布这**一对照旧值（0x474d3a / 0x2c3023）整体压暗了一档**，理由是实拍而不是配色偏好：
// 视模那四盏灯（hemi + sun + fill + rim）是**为枪**配的，枪上有大量近黑与木质面能吃下它们，
// 而袖子是一整根 43cm 的素色圆柱、没有任何结构去承接，同样的照度下它整根泛白，
// 在小臂那一块读成一根塑料管子、比枪还亮（实测截图里它是最浅的一块）。
// 压暗之后手（暖棕）与袖（橄榄绿）才拉开明暗，而不是两个同亮度的色块并排。
const SLEEVE = 0x363d24;  // 袖布：橄榄绿，前臂 ramp 的亮端
// 袖口罗纹束带。**它必须比袖布（0x363d24）深得明显**，不能只深十几个色阶 ——
// 束带是一圈**朝向天空的小圆柱**，`vmHemi`/`vmRim` 打在上面的能量比斜着的袖管高一大截，
// 实测同色阶时它反而比袖子亮，读成"手腕上套了个亮箍"（截图里最扎眼的一块）。
const CUFF = 0x232818;
// 前臂 ramp 的**暗端**不能直接用 `CUFF`：0x3d4231 比 SLEEVE 只深 10 个色阶，
// 那个量级是给 3cm 宽的袖口束带用的（够读出「这里收了一道」），
// 但铺到 43cm 长的小臂上就等于整条袖子一个色 —— 实测（照顶点 UV 采样）暗端到亮端
// 只有 rgb 61..71，缠布那圈圈棱线完全读不出来，而「保住棱线」正是选重映射这条路的全部理由。
// 所以单列一个真正深的暗端：与 SLEEVE 同色相、压到约 40% 亮度。
const SLEEVE_DK = 0x1f2316;

// ---------- fps_arms 源数据的实测常数（**装载期现量，不写死**）----------
// 上一版这里躺的是 CS 的六个数（由 `node /tmp/glbpca.mjs models/cs/ak47.glb` 从顶点云
// PCA 反推），现在源模型换了，那段与那六个数一起作废。
//
// **为什么这次不写死**：fps_arms 是一具 47 骨的蒙皮骨架，「手掌枢轴」「腕点」「前臂主轴」
// 都是骨架里现成的数（`inverse(IBM)` 的平移就是那根骨在 bind 姿势里的世界位置），
// 结算方式与 CS 那套「从一堆顶点里反推」完全不同。所以 `bakeFpsArms()` 在烘焙完成后
// **当场量**它们写进这张表 —— 换模型只要换文件、不需要重新抄一遍数。
//
// 三个字段的语义与旧版一致（都是**烘焙之后**的武器组局部坐标，单位米）：
//   · handPivot = 手那一半的**包围盒中心** —— 装进来后落在 ARM_ANCHORS 的 `r`/`l` 上。
//   · armWrist  = 腕骨在 bind 姿势里的位置。
//   · armDir    = 归一化的「腕 → 肘」，**由腕指向肘**。
//
// 为什么 armDir 是关键：源数据的前臂是**斜的**，直接塞进 `fore` 再让 `_aim` 去指，等于在
// 「本来就歪的模型」上再叠一次旋转，前臂会指着枪托。所以装载时先
// `setFromUnitVectors(armDir, DOWN)` 把它转正，此后 `_aim` 才说了算。
// **注意这里量的是「掰正之后」的轴**（= `FPS_ARM_DIR`）—— 源数据那份近乎顺着视线，
// 会让小臂扎进相机里被近平面切开，由烘焙里的整体旋转修掉，见 `FPS_ARM_DIR`。
//
// **它同时决定了焊缝**：`ELBOW_DIR == armDir` ⇒ `q_aim = q_axis⁻¹` ⇒ 手与袖的总相对旋转是
// 单位阵 ⇒ `ARM_ANCHORS` 的 `hr`/`hl` 取 0 时腕子上**严丝合缝**。所以 `bakeFpsArms()`
// 量到 armDir 之后会把它一并写进 `ELBOW_DIR`（见下）。两个值必须同源。
export const FPS_SRC = {
  handPivot: { R: [0, 0, 0], L: [0, 0, 0] },
  armWrist: { R: [0, 0, 0], L: [0, 0, 0] },
  armDir: { R: [0, 0, 1], L: [0, 0, 1] },
  // 拳的握持轴 = 归一化的「食指掌指关节 → 小指掌指关节」。**它现在不是调参依据**：
  // 实测它与前臂轴近似正交，而握把柱几乎顺着前臂 ⇒ 对进通道要把手相对小臂拧 ~98°，
  // 那是一道撕焊缝的折角。所以 `hr`/`hl` 恒为 0，这个量留在表里只当「为什么拧不了」的证据
  // （由 `bakeFpsArms` 量、结论见 `ARM_ANCHORS` 上方那段）。
  gripAxis: { R: [1, 0, 0], L: [-1, 0, 0] },
};

// 双手的源文件。用**相对文档**的路径（`fetch` 按文档 URL 解析，写在 scripts/ 里也是对的）。
export const FPS_ARMS_URL = "./models/fps_arms.glb";

// 手指弯曲量：0 = bind 姿势（张开），越大拳越紧。
//
// **单位是弧度、而且是「全手指合计」**：`CURL_W` 把这一份量按 0.42/0.33/0.25 分摊到
// 三节指骨上，再乘 `CURL_STEM` 那根手指的整体系数，所以中指（系数 1.00）三节分别转
// 1.16 / 0.91 / 0.69 rad（合计 2.75 rad ≈ 158°）。**握拳需要合计 ~2.5 rad** ——
// 1.0 只弯 57°，那是一只「放松的手」不是拳。
const FPS_CURL = 2.75;

// 拇指的弯曲量单独打个折：拇指的掌腕关节在真人身上只能屈 ~50°（四指是 ~90°），
// 全量拧会让拇指横穿掌心插进对面。**0.55 时拇指是「竖着的」**（截图里读成点赞手势），
// 0.72 才落到「横搭在食指上」这一档（合计 0.72×2.75 ≈ 1.98 rad ≈ 113°，仍小于真人的 ~130°）。
const FPS_CURL_THUMB = 0.72;

// 源单位 → 米。**定标依据：让这双手与 CS 那双手在画面上一样大**
// （包围盒对角线对齐：CS 0.2408m ↔ fps 24.22 单位 ⇒ 0.0099）。于是 `ARM_ANCHORS` 里的
// `s`（步枪 0.743 …）一个都不用动 —— 那个 0.743 是 `0.82 / 1.1036` 推出来的，
// 与手的大小无关，是「视模超尺寸」这条既有约定的产物。
const FPS_BAKE_SCALE = 0.0099;

// 源模型的造型朝向：**肘在 -z、手指朝 +z、右手在 -x**，绕 Y 转 180° 之后才对上武器组
// （枪口 -z、右手 +x）。一记 180° 偏航同时把「前后」和「左右手」一起掰正 ——
// 源文件里右手在 -x，不转的话两只手会左右互换。
//
// 【别用 PCA 去"验证"这个方向】手枪那次踩过：PCA 主轴会被握把那一团顶点拽偏。
// 这里判朝向只用**骨的对称性**（bind 姿势左右严格镜像，手心 / 手背哪边朝上是可读的）。
const FPS_BAKE_ROT_Y = Math.PI;

// 摊在「基础旋转」（`RY(π)·S`）之上的**整体掰正**：把前臂轴从源数据的方向转到它该指的方向。
// 坐标是**武器组局部**（与 ARM_ANCHORS / ELBOW_DIR 同一个系）：+x 右 / +y 上 / +z 朝玩家。
//
// 【为什么必须掰】源数据的 bind 姿势是「双手前伸、小臂几乎顺着视线」。基础旋转之后实测
// `armDir(R) = (0.187, 0.165, 0.968)` —— 肘在腕的**右上方、且几乎正对着相机**（离视轴
// 只有 14.5°）。装进武器组之后右腕落在相机 z = −0.355，前臂长 0.326m ⇒ 肘到 z ≈ −0.039，
// **直接进了相机里面**；`vmCamera.near = 0.01` 把筒壁齐刷刷切开，看到的是内壁，画面上就是
// 一片「扭曲的板」（实测 `foreR` 的相机空间 z 最大到 −0.0047，确实越过了近平面）。
// 左臂没被切，但同样近乎轴向，沿长度方向摊开 1.9 倍，读起来也像张板。
//
// 【为什么在烘焙里转，而不是去改 ELBOW_DIR】改 `ELBOW_DIR` 会把腕子撕开一道折角
// （`hr == R_total` 才是零焊缝，见 FPS_SRC 的推导）。在烘焙里转是手与袖**一起**转，
// 相对关系一个字没动，焊缝仍然是零 —— 所以目标方向只能写在烘焙这一侧。
//
// 取值照 CS 那套手感（它那份是 `(0.23, -0.83, 0.51)`）：肘在腕的**右下方、稍靠后**，
// 于是小臂从画面右下角斜着出画，而不是正面怼向镜头。左臂由它镜像而来（见 bakeFpsArms）。
const FPS_ARM_DIR = [0.23, -0.80, 0.55];

// 绕前臂轴的**滚转**（弧度）。**只拧不掰**，所以焊缝不受影响 —— 它唯一的作用是调手的朝向
// （掌心朝哪、拇指倒向哪边）。先取 0，靠截图与 `setArmAnchor` 调不出来时才动这里。
const FPS_ARM_ROLL = 0;

// 按部位分组的骨名（`<side>_<part><n>_<id>` 里的 `<part>`）。
// `wrist` **归手**（不是归前臂）：手腕本来就该跟着手转，而且这样前臂组正好从腕根干净地开始。
const FPS_HAND_PARTS = new Set(["wrist", "thumb", "point", "middle", "ring", "pink"]);
const FPS_FORE_PARTS = new Set(["arm", "elbow"]);

// 腕 → 肘 的方向（**单位向量**，武器组局部）。两侧各自固定：这是「人的胳膊往哪撇」，
// 与手里是哪把枪无关 —— 所以它**不是** ELBOWS 那种绝对点，而是一个方向，
// 由 configure() 按当前武器的手腕锚点现算成肘点（见该处）。
// **值由 `bakeFpsArms()` 在装载期写入**（= 实测的 `FPS_SRC.armDir`），初值只是占位。
// 上面那两条约束仍然成立，而且现在多了一条更硬的：**它必须与 `FPS_SRC.armDir` 相等**，
// 否则手与袖的相对旋转不是单位阵，腕子会裂开一道折角 —— 见 FPS_SRC 的注释。
export const ELBOW_DIR = { r: [0, 0, 1], l: [0, 0, 1] };
// 肘到腕的距离只影响方向、不影响画面（前臂只有 ~0.25m 长，肘点永远在画外），
// 取 0.62 是为了让「方向」在数值上稳定，不至于被浮点噪声放大。
const ELBOW_DIST = 0.62;

// 前臂的**轴向拉伸**。视模的前臂必须一直画到**画面外**才不像「凭空长在手后面的一截管子」。
//
// CS 那份左袖只有 0.284m、袖口停在画面里（(773,638)，画布高 713），所以要拉 1.8 倍。
// **fps_arms 的前臂长得多**：`fore` 组从腕一直含到肩（源单位 ≈51 → 0.508m），
// 两侧都已经远远伸出画外，所以是 1.0 / 1.0 —— 但**这个结论要用 `armTip()` + `project()`
// 量过再落**（见验证清单），别照着「前臂更长了所以不用拉」这句话推。
//
// 拉伸只作用在**轴向**（`fore` 空间的局部 y，因为 armStretch 是 fore 的子节点），
// 袖管是等截面的，拉长只是变长、不会变成一根细面条。
const ARM_STRETCH = { R: 1.0, L: 1.0 };

// =====================================================================================
// 装载期烘焙：把 `models/fps_arms.glb` 的骨架烘成静态几何
// =====================================================================================

/** 骨名 `<side>_<part><level>_<id>` → `{ side, part, level }`；不是手/臂骨就返回 null。
 *  **实测**的全表（47 根）长这样：
 *    `L_arm_01` `L_elbow_02` `L_wrist_03`                        ← 臂骨**没有** level 位
 *    `L_thumb1_04` … `L_thumb4_07` `L_point1_08` … `L_pink4_022` ← 指骨有
 *    `R_arm_023` `R_thumb1_026` … `R_pink4_045`
 *  三个坑都在这一行正则里：① 臂骨没有 level，所以 `(\d*)` 必须允许空、缺省补 1；
 *  ② `part` 部分对指骨是**贪婪不起来的**（`middle2` 要切成 `middle`+`2`），所以
 *  用非贪婪的 `([a-z]+?)`；③ 尾号补零位数**不统一**（`_00` 与 `_045` 并存），
 *  只能写 `\d+`，写死 `_\d{2}$` 会漏掉一半。 */
const FPS_BONE_RE = /^([LR])_([a-z]+?)(\d*)_\d+$/;
function fpsBone(name) {
  const m = FPS_BONE_RE.exec(name);
  return m ? { side: m[1], part: m[2], level: m[3] ? +m[3] : 1 } : null;
}

/** 骨名 → `handR` / `handL` / `foreR` / `foreL`；不是四肢骨（只有 `_rootJoint`）返回 null。 */
function fpsPartOf(name) {
  const b = fpsBone(name);
  if (!b) return null;
  if (FPS_HAND_PARTS.has(b.part)) return "hand" + b.side;
  if (FPS_FORE_PARTS.has(b.part)) return "fore" + b.side;
  return null;
}

/** 按 `侧_部位_节号` 查骨数组下标的闭包（顶点权重索引的就是骨数组，不是场景树）。
 *  **建表必须走 `fpsBone()`**，不能再自己 `exec` 一遍：臂骨的 level 是「缺省补 1」而不是 0，
 *  两处各写一次必然分叉 —— 第一版这里写了 `+m[3]`（空串 → 0），
 *  于是 `wrist`/`elbow` 全部查不到、`FPS_SRC.armWrist` 与 `armDir` **静默**停在占位值上
 *  （不抛异常，只是量出来的枢轴恒为 [0,0,0] / [0,0,1]）。 */
function fpsBoneFinder(bones) {
  const map = new Map();
  bones.forEach((b, i) => {
    const m = fpsBone(b.name);
    if (m) map.set(`${m.side}_${m.part}_${m.level}`, i);
  });
  return (side, part, level) => (map.has(`${side}_${part}_${level}`) ? map.get(`${side}_${part}_${level}`) : -1);
}

// 每根手指三节的弯曲权重，**合计 1.0**：乘上 FPS_CURL 就是「这条手指一共弯多少弧度」。
// **只有 3 节** —— 每根手指的第 4 节骨在源文件里 IBM 是单位阵（bind 位置落在原点、
// 且不被任何顶点引用），拿它当旋转轴会绕着一个不存在的点转。所以那 10% 的权重
// 按比例（0.40/0.30/0.20/0.10 → 0.42/0.33/0.25）并进前三节，合计仍是 1.0。
const CURL_W = { thumb: [0.34, 0.36, 0.30], finger: [0.42, 0.33, 0.25] };
// 每根手指的**整体系数**（相对中指）。**真人握拳不是四指齐平**：小指收得最紧、食指最松，
// 拳面是一条从食指弯到小指的弧。四指共用同一组权重时截图上是「一排等高的小肉柱」，
// 加上这条 0.90→1.18 的梯度才读得出指节。这条同时压低了食指末端 —— 托护木那只手
// 原来指尖会探到手背上沿之外，看着像爪子。
const CURL_STEM = { point: 0.90, middle: 1.00, ring: 1.08, pink: 1.18 };
const FINGER_STEMS = ["point", "middle", "ring", "pink"];

/**
 * 算出「把手指弯成握拳」所需的逐骨旋转（**只有轴与角度，不是矩阵**）。
 *
 * 轴与符号全部**量出来**，一个都不猜：
 *   · 四指的轴 = **指根连线** `pinky1 − point1`（横跨拳面的一条线）。绕它转手指就往掌心收
 *     —— 这正是真人指关节的自由度方向。
 *   · 符号 = 让指尖**朝掌心那一侧**转。判据是「旋转的一阶位移 `K × F` 是否指向掌心」，
 *     掌心那一侧用**拇指**的位置代表（真人手掌上拇指与四指相对，这个近似在张开的手上很准）。
 *   · 拇指的轴 = **掌面法线** `K × F`（拇指绕法线扫过掌心），符号同理，
 *     但参照物换成食指指节（拇指靠近四指就是攥拳）。
 *
 * bind 姿势左右**严格镜像**，所以两侧各自算出来会**自动得到同一个符号** —— 镜像同时翻掉
 * 轴线与参照物的 x 分量，点积里的 x 项相消。这正是「两侧同一个符号」那条实测结论的来历，
 * 也意味着**不需要**任何按侧取号的特判。
 */
function curlRotations(bones, head, curl) {
  const out = new Array(bones.length).fill(null);
  if (!(curl > 0)) return out;
  const at = fpsBoneFinder(bones);
  for (const side of ["L", "R"]) {
    const p1 = at(side, "point", 1), k1 = at(side, "pink", 1);
    const m1 = at(side, "middle", 1), m3 = at(side, "middle", 3);
    const t1 = at(side, "thumb", 1), t3 = at(side, "thumb", 3);
    const p2 = at(side, "point", 2);
    if ([p1, k1, m1, m3, t1, t3, p2].some((i) => i < 0)) continue;  // 骨名对不上就不弯这只手
    const K = head[k1].clone().sub(head[p1]).normalize();            // 指根连线
    const F = head[m3].clone().sub(head[m1]).normalize();            // 中指指向（拳面内的前向）
    const N = K.clone().cross(F).normalize();                        // 掌面法线
    const sF = N.dot(head[t1].clone().sub(head[m1])) > 0 ? 1 : -1;

    for (const stem of FINGER_STEMS) {
      const g = CURL_STEM[stem] === undefined ? 1 : CURL_STEM[stem];
      CURL_W.finger.forEach((w, k) => {
        const bi = at(side, stem, k + 1);
        if (bi >= 0) out[bi] = { axis: K.clone(), angle: sF * w * curl * g };
      });
    }
    const Ft = head[t3].clone().sub(head[t1]).normalize();
    const sT = N.clone().cross(Ft).dot(head[p2].clone().sub(head[t1])) > 0 ? 1 : -1;
    CURL_W.thumb.forEach((w, k) => {
      const bi = at(side, "thumb", k + 1);
      if (bi >= 0) out[bi] = { axis: N.clone(), angle: sT * w * curl * FPS_CURL_THUMB };
    });
  }
  return out;
}

/**
 * 把一具蒙皮骨架烘成四块静态几何（手 L/R、前臂 L/R），并**当场量出** `FPS_SRC`
 * 与 `ELBOW_DIR`。返回 `{ handR, handL, foreR, foreL }`（都是 `BufferGeometry`）。
 *
 * ## 核心推导：蒙皮矩阵 `M_i` 恰好就是「绕关节点的累积旋转」
 *
 * 记 `W0[i] = inverse(IBM[i])`（第 i 根骨在 **bind 姿势**下的世界矩阵），
 * `W[i]` 为当前姿势、`D[i]` 为叠在骨自身局部空间上的额外旋转，则
 * `W[i] = W[parent]·(W0[parent]⁻¹·W0[i])·D[i]`。
 * 令 `A[i] := W[i]·W0[i]⁻¹`，代入得 `A[i] = A[parent]·(W0[i]·D[i]·W0[i]⁻¹)`。
 * 而蒙皮矩阵是 `M_i = W[i]·IBM[i]`，又因 `W0[i]·IBM[i] = I`：
 *
 *     M_i = A[parent] · (W0[i]·D[i]·W0[i]⁻¹) · W0[i] · IBM[i] = A[i]
 *
 * 即 **`M_i` 就是 `A[i]`**，而 `A[i]` 的每一项都是「绕该骨的 bind 关节点、按该骨的世界轴
 * 转一个角」的复合（`W0[i]·D[i]·W0[i]⁻¹` 正是把局部旋转搬到世界系的共轭）。
 * 于是顶点只要按权重混合 `A[i]·v` —— **连 bind 矩阵都不必碰**，也不需要遍历场景树。
 *
 * 这条推导自带一个现成的自检：`curl = 0` 时 `D[i] = I` ⇒ `A[i] = I` ⇒
 * **输出必须逐点等于原始 `POSITION`**。那是「bind 重构写对了没有」的唯一判据。
 *
 * ## 为什么用 bind 姿势而不是节点姿势
 * `bone.matrixWorld` 是**节点姿势**，实测 46/47 根与 `W0` 不一致、最大差 33.8 ——
 * 按它烘会得到一副完全不同的架子。而且 bind 姿势左右**严格镜像**（拟合出来的拳左右一致）、
 * 还是一只干净的放松张开手（握拳的起点）。文件里 0 段动画，直接渲染出来的是节点姿势，
 * 所以「看起来是那样」**不能**拿来当依据。
 */
export function bakeFpsArms(gltf, curl = FPS_CURL) {
  const root = gltf.scene;
  let sm = null;
  root.traverse((n) => { if (n.isSkinnedMesh && !sm) sm = n; });
  if (!sm || !sm.skeleton || !sm.skeleton.bones.length) throw new Error("fps_arms: 找不到 SkinnedMesh / skeleton");
  const bones = sm.skeleton.bones, nb = bones.length;

  const W0 = sm.skeleton.boneInverses.map((ibm) => new THREE.Matrix4().copy(ibm).invert());
  const head = W0.map((m) => new THREE.Vector3().setFromMatrixPosition(m));

  // 父子索引用**骨数组下标**（顶点权重索引的就是这个数组）。实测骨数组是「父先于子」的，
  // 所以下面一次正序扫描就能把 A[] 递推完；若将来换了模型，这里要改成拓扑序。
  const idxOf = new Map();
  bones.forEach((b, i) => idxOf.set(b, i));
  const parentOf = bones.map((b) => (b.parent && idxOf.has(b.parent) ? idxOf.get(b.parent) : -1));

  // ---- ① 逐骨累积旋转 A[i] = A[parent] · 绕关节点(h[i])、绕世界轴(axis)、转(angle) ----
  const rots = curlRotations(bones, head, curl);
  const A = new Array(nb).fill(null);
  const _rq = new THREE.Quaternion(), _rm = new THREE.Matrix4(), _tm = new THREE.Matrix4();
  for (let i = 0; i < nb; i++) {
    const own = new THREE.Matrix4();
    const r = rots[i];
    // 关节点落在原点（`_rootJoint` 与十根末节骨）时跳过：绕原点转会把整只手甩出去。
    if (r && head[i].lengthSq() > 1e-12) {
      _rq.setFromAxisAngle(r.axis, r.angle);
      own.makeTranslation(head[i].x, head[i].y, head[i].z);
      own.multiply(_rm.makeRotationFromQuaternion(_rq));
      own.multiply(_tm.makeTranslation(-head[i].x, -head[i].y, -head[i].z));
    } else {
      own.identity();
    }
    const p = parentOf[i];
    A[i] = own;
    if (p >= 0 && A[p]) A[i].premultiply(A[p]);   // A[i] = A[p] · own
  }

  // ---- ② 逐顶点：位置与法线一起做 LBS ----
  const g = sm.geometry;
  const posA = g.attributes.position, norA = g.attributes.normal;
  const siA = g.attributes.skinIndex, swA = g.attributes.skinWeight;
  const uvA = g.attributes.uv, uv1A = g.attributes.uv1;   // uv1 是 aoMap 要的那一套
  if (!norA || !siA || !swA) throw new Error("fps_arms: 缺 NORMAL / JOINTS_0 / WEIGHTS_0");
  const N = posA.count;

  const vPart = new Array(N);
  const bPos = new Float32Array(N * 3), bNor = new Float32Array(N * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const acc = new THREE.Vector3(), acn = new THREE.Vector3();
  const vv = new THREE.Vector3(), vn = new THREE.Vector3();
  const m3 = new THREE.Matrix3();
  for (let i = 0; i < N; i++) {
    p.fromBufferAttribute(posA, i);
    n.fromBufferAttribute(norA, i);
    acc.set(0, 0, 0); acn.set(0, 0, 0);
    let best = -1, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = swA.getComponent(i, k);
      if (w <= 0) continue;
      const bi = siA.getComponent(i, k);
      if (w > bw) { bw = w; best = bi; }
      const a = A[bi];
      if (!a) continue;
      acc.addScaledVector(vv.copy(p).applyMatrix4(a), w);
      // 法线走 A 的**旋转部分**（A 是刚体变换，其正常矩阵就是它的上左 3×3；
      // 因为 A 是正交阵，用 `setFromMatrix4` 而不是 `getNormalMatrix` 更省也等价）。
      acn.addScaledVector(vn.copy(n).applyMatrix3(m3.setFromMatrix4(a)), w);
    }
    bPos[i * 3] = acc.x; bPos[i * 3 + 1] = acc.y; bPos[i * 3 + 2] = acc.z;
    // curl = 0 时 Σw = 1 且 A = I，这一步是恒等（连归一化都不改变它）—— 自检就落在这里。
    if (acn.lengthSq() > 1e-12) acn.normalize();
    bNor[i * 3] = acn.x; bNor[i * 3 + 1] = acn.y; bNor[i * 3 + 2] = acn.z;
    vPart[i] = best >= 0 ? fpsPartOf(bones[best].name) : null;
  }

  // ---- ③ 按主导关节切四份 ----
  const src = g.index;
  const triCount = (src ? src.count : N) / 3;
  const bucket = { handR: [], handL: [], foreR: [], foreL: [] };
  for (let t = 0; t < triCount; t++) {
    const a = src ? src.getX(t * 3) : t * 3;
    const b = src ? src.getX(t * 3 + 1) : t * 3 + 1;
    const c = src ? src.getX(t * 3 + 2) : t * 3 + 2;
    const q = [vPart[a], vPart[b], vPart[c]];
    // 跨切缝的三角形**每个部位各收一份**（顶点重复）。这样即使 hr 带了点掰弯，
    // 缝上也不会露出一条空洞；重复的那一份在 hr = 0 时与另一份的变换完全相同
    // （见 FPS_SRC 注释里那条焊缝推导），深度与颜色都一致，看不出重叠。
    for (let s = 0; s < 3; s++) {
      if (!q[s]) continue;
      if (s === 1 && q[1] === q[0]) continue;
      if (s === 2 && (q[2] === q[0] || q[2] === q[1])) continue;
      bucket[q[s]].push(a, b, c);
    }
  }

  // ---- ④ 出四块非索引几何，并统一做「缩放 + 绕 Y 180° + 前臂掰正」 ----
  // （顺序是 `R_fix · RY · S` —— 均匀缩放与旋转可交换，这里写清楚只是为了别再纠结。）
  const S = FPS_BAKE_SCALE;
  const BASE = new THREE.Matrix4().makeRotationY(FPS_BAKE_ROT_Y)
    .multiply(new THREE.Matrix4().makeScale(S, S, S));

  // 掰正量由**基础旋转之后**的实测前臂轴反推 —— 源数据怎么歪都不必手抄一个角（见 FPS_ARM_DIR）。
  // 查不到腕骨/肘骨时 `M` 停在纯基础旋转上：**这不影响焊缝**，因为 ELBOW_DIR 是从同一个 M 量的。
  const M = { R: BASE, L: BASE };
  {
    const at0 = fpsBoneFinder(bones);
    const wi = at0("R", "wrist", 1), ei = at0("R", "elbow", 1);
    if (wi >= 0 && ei >= 0) {
      const tgt = new THREE.Vector3().fromArray(FPS_ARM_DIR).normalize();
      const a = head[ei].clone().applyMatrix4(BASE).sub(head[wi].clone().applyMatrix4(BASE)).normalize();
      // 先「转向」再「绕新轴拧」：`qRoll · qDir` 作用在向量上就是 qDir 先跑。
      const qR = new THREE.Quaternion().setFromAxisAngle(tgt, FPS_ARM_ROLL)
        .multiply(new THREE.Quaternion().setFromUnitVectors(a, tgt));
      // 左臂取 **x 共轭镜像**（`(x,y,z,w) → (x,-y,-z,w)`）而不是各算各的 setFromUnitVectors：
      // 两者数值上等价（`M_x·R(u,θ)·M_x = R(M_x·u, -θ)`），但显式镜像保证两只手严格对称。
      const qL = new THREE.Quaternion(qR.x, -qR.y, -qR.z, qR.w);
      M.R = new THREE.Matrix4().makeRotationFromQuaternion(qR).multiply(BASE);
      M.L = new THREE.Matrix4().makeRotationFromQuaternion(qL).multiply(BASE);
    }
  }
  const M_KEY = { handR: "R", handL: "L", foreR: "R", foreL: "L" };
  const out = {};
  for (const key of ["handR", "handL", "foreR", "foreL"]) {
    const tri = bucket[key];
    if (!tri.length) continue;
    const cnt = tri.length;
    const P = new Float32Array(cnt * 3), Nr = new Float32Array(cnt * 3);
    const U = uvA ? new Float32Array(cnt * 2) : null;
    const U1 = uv1A ? new Float32Array(cnt * 2) : null;
    for (let j = 0; j < cnt; j++) {
      const v = tri[j];
      P[j * 3] = bPos[v * 3]; P[j * 3 + 1] = bPos[v * 3 + 1]; P[j * 3 + 2] = bPos[v * 3 + 2];
      Nr[j * 3] = bNor[v * 3]; Nr[j * 3 + 1] = bNor[v * 3 + 1]; Nr[j * 3 + 2] = bNor[v * 3 + 2];
      if (U) { U[j * 2] = uvA.getX(v); U[j * 2 + 1] = uvA.getY(v); }
      if (U1) { U1[j * 2] = uv1A.getX(v); U1[j * 2 + 1] = uv1A.getY(v); }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(P, 3));
    bg.setAttribute("normal", new THREE.BufferAttribute(Nr, 3));
    if (U) bg.setAttribute("uv", new THREE.BufferAttribute(U, 2));
    if (U1) bg.setAttribute("uv1", new THREE.BufferAttribute(U1, 2));
    // 位置与法线一起变换（法线走 normalMatrix 并自动归一化）。**必须在烘焙之后**：
    // 先把 M 揉进几何，下面量出来的枢轴/轴才与 `_install` 拿到的是同一个坐标系。
    bg.applyMatrix4(M[M_KEY[key]]);
    bg.computeBoundingBox();
    out[key] = bg;
  }

  // ---- ⑤ 当场量枢轴（换模型不用重抄数；量的是**烘焙之后**的几何）----
  const at = fpsBoneFinder(bones);
  for (const side of ["L", "R"]) {
    const hand = out["hand" + side];
    if (hand) FPS_SRC.handPivot[side] = hand.boundingBox.getCenter(new THREE.Vector3()).toArray();
    // 指根连线（食指掌指关节 → 小指掌指关节）= 拳的**握持轴**。量它的**初衷**是「握竖直
    // 握把时它应当与握把平行」，好在 `hr`/`hl` 上算出该拧多少 —— 但实测把这条否掉了：
    // 它与前臂轴近似正交（点积 0.067，这是人体的事实：握杆时杆 ⟂ 小臂），而握把柱离前臂轴
    // 只有 ~20°，对进通道要拧 ~98°，摊在腕上就是一道骨折级的折角。
    // **所以 `hr`/`hl` 八把枪全是 0**，这个量现在是「为什么不能拧」的证据，不再是调参依据 ——
    // 见 `ARM_ANCHORS` 上那段结论。掌指关节本身不随 `curlRotations` 动（转动绕着它们各自的头），
    // 所以这一步与 curl 无关。
    {
      const p1 = at(side, "point", 1), p5 = at(side, "pink", 1);
      if (p1 >= 0 && p5 >= 0) {
        const rot = new THREE.Matrix3().setFromMatrix4(M[side]);
        FPS_SRC.gripAxis[side] = head[p5].clone().sub(head[p1]).applyMatrix3(rot).normalize().toArray();
      }
    }
    const wi = at(side, "wrist", 1), ei = at(side, "elbow", 1);
    if (wi < 0 || ei < 0) continue;
    // 逐侧各用自己的 M —— 掰正量左右互为镜像，混用会把一侧的轴量错。
    const w = head[wi].clone().applyMatrix4(M[side]);
    const e = head[ei].clone().applyMatrix4(M[side]);
    FPS_SRC.armWrist[side] = w.toArray();
    const dir = e.sub(w).normalize();
    FPS_SRC.armDir[side] = dir.toArray();
    // **焊缝**：ELBOW_DIR 必须与 armDir 同源，否则手与袖的相对旋转不是单位阵、腕子会裂。
    if (side === "R") ELBOW_DIR.r = dir.toArray(); else ELBOW_DIR.l = dir.toArray();
  }
  return out;
}

// =====================================================================================
// 手部材质：把模型自带的贴图**重映射**到本作的调色板
// =====================================================================================
//
// 源材质是 `KHR_materials_pbrSpecularGlossiness`，经 `gltf.js` 之后拿到 `map`（← diffuse），
// `normalMap` / `aoMap` 是 GLTFLoader 顶层的处理（与那个扩展无关），所以三张都在。
//
// 【为什么是「重映射」而不是「另画一套」】见文件头。要点只有一条：**保留 diffuse 的亮度结构**。
// 那几张 1024² 里写着作者的全部结构信息 —— 手套的织纹、指关节的褶皱、缠布一圈圈的棱线。
// 我们只做一次逐像素的**亮度 → 配色**映射，把近黑的手套抬到皮革棕 / 橄榄绿，
// 而肤色手指天然落在 ramp 的亮端：**「戴着半指手套的手」这个对比正是选这条路的理由**，
// 换成程序化贴图就等于把它整条丢掉。
//
// 【窗口 `lo`/`knee`/`hi` 是这一段唯一的旋钮，而且必须**按部位实测**，不能照整张图取】
// 源片子上手和袖各占几块岛，整图分位会被别的岛带偏。实测（`/tmp/glbview/bake.html` 第 3 节：
// 把每个部位的顶点 UV 打到贴图上取亮度）：
//   hand  n=7755  min 0.000  p05 0.000  p50 0.484  p95 0.684  max 0.919   ← 双峰：手套暗簇 + 皮肤亮簇
//   fore  n=2925  min 0.012  p05 0.031  p50 0.102  p95 0.164  max 0.216   ← 单峰，缠布整体压在底部
// 两个窗口的宽度因此差三倍多，而且**形状都不一样**：
// 手的暗簇（0.00~0.20）与亮簇（0.40~0.92）之间那段 0.20~0.40 整张图几乎没有像素（实测空隙），
// 所以手走两段式、拐点落在空隙里，两簇各吃半个 ramp；袖只有一簇，一条线性就够。
// 反例（都实测过）：袖用 lo 0.04/hi 0.38 ⇒ 袖布最高只走到 ramp 的 46%，重映射后的直方图
// 是一根柱子，整条袖子读成一块没有起伏的橄榄色；手用一条线性跨双峰 ⇒ 手套那一簇被压进
// [0, 0.2] 里，整块手套读成一片没有起伏的深棕。**两端各吃满**才是这条的目的。
const REMAP = {
  // 手：双峰，`knee` 落在实测的空隙（0.20~0.40 之间整张图几乎没有像素）上，两簇各吃一半 ramp，
  //     否则手套那一簇会被压进 [0, 0.2] 里、整块手套读成一片没有起伏的深棕。
  hand: { dark: PALM, light: GLOVE, lo: 0.02, knee: 0.30, hi: 0.90 },
  // 袖：单峰，`knee: null` ⇒ 一条普通线性 ramp 就够（数据只占 [0.01, 0.22]）。
  fore: { dark: SLEEVE_DK, light: SLEEVE, lo: 0.02, knee: null, hi: 0.21 },
};

/**
 * 把一张 sRGB 反照率按亮度重映射到 [dark, light]。返回新的 `CanvasTexture`（sRGB）。
 * 不变的就只有亮度本身 —— 源片子的每一点明暗（织纹、褶皱、AO）都被完整保留下来。
 */
function remapAlbedo(srcTex, { dark, light, lo, knee, hi }, size = 1024) {
  const img = srcTex && srcTex.image;
  if (!img) return null;
  const cv = makeCanvas(size);
  cv.height = size;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);
  const px = ctx.getImageData(0, 0, size, size).data;
  // 两端色**转成线性**再插值：hex 写的是 sRGB 的观感值，而插值必须在线性空间里做，
  // 否则暗部会被系统性压暗（texturekit 的 lin2srgb 注释讲的就是这一条）。
  const d = hexLin(dark), l = hexLin(light);
  const loSpan = Math.max(1e-6, (knee ?? hi) - lo);
  const hiSpan = knee == null ? 1 : Math.max(1e-6, hi - knee);
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  for (let i = 0; i < px.length; i += 4) {
    // 亮度用 sRGB 字节上的加权：这**正是**「人眼看到的明暗」，也正是我们要保住的那个量。
    const lum = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
    // 有 knee 就把 [lo, knee] / [knee, hi] 各映到 ramp 的一半；没有就是一条线性。
    const t = knee == null
      ? clamp01((lum - lo) / loSpan)
      : lum < knee ? 0.5 * clamp01((lum - lo) / loSpan)
                   : 0.5 + 0.5 * clamp01((lum - knee) / hiSpan);
    px[i] = lin2srgb(d[0] + (l[0] - d[0]) * t) * 255;
    px[i + 1] = lin2srgb(d[1] + (l[1] - d[1]) * t) * 255;
    px[i + 2] = lin2srgb(d[2] + (l[2] - d[2]) * t) * 255;
    // alpha 原样保留
  }
  ctx.putImageData(new ImageData(px, size, size), 0, 0);
  const out = texFrom(cv, true);        // → SRGBColorSpace + RepeatWrapping
  // **`flipY` 必须跟着源贴图**：glTF 的 UV 原点在左上，GLTFLoader 给每张贴图都设了
  // `flipY = false`，而 `CanvasTexture` 默认是 `true` —— 不跟就会把整张贴图上下翻过来
  // （手上的织纹会倒着长，而且缝的位置全错）。
  out.flipY = srcTex.flipY;
  out.wrapS = srcTex.wrapS;
  out.wrapT = srcTex.wrapT;
  return out;
}

/**
 * 出这对材质。返回 `{ hand, fore }`。
 *
 * **不挂 `aoMap`**：AO 本来就有一部分烘在 diffuse 里，而我们的 ramp 是**保亮度**的，
 * 也就是把它原样搬到了新配色上；再叠一张 aoMap 等于把遮蔽关系平方一次
 * （折痕会黑成一道沟）。`aoMapIntensity` 那条路留给「源片子没烘 AO」的模型。
 *
 * **`color` 必须留白**：颜色已经在重映射后的 albedo 里了，两边都上等于色值平方 ——
 * 这个坑在 `containerFaceTexture` 与上一版的 `_mat()` 上各踩过一次。
 *
 * **`roughness = 0.62` 是必须显式写的**：源文件 `glossinessFactor = 1`，
 * `gltf.js` 按 `roughness = 1 − glossiness` 转出来是 **0**，也就是一副镜面黑手套
 * （白昼天空下就是那面天穹的镜像，与 `m4_gold` 的 met 1 / rou 0 同一类）。
 * 法的起伏交给 normalMap，粗糙度不再挂图。
 */
export function fpsArmMaterial(gltf) {
  let sm = null;
  gltf.scene.traverse((n) => { if (n.isSkinnedMesh && !sm) sm = n; });
  const src = sm && (Array.isArray(sm.material) ? sm.material[0] : sm.material);
  if (!src) throw new Error("fps_arms: 找不到源材质");
  const maps = { hand: remapAlbedo(src.map, REMAP.hand), fore: remapAlbedo(src.map, REMAP.fore) };
  // **法线强度两份不同，这是量出来的**：手背在源 diffuse 里是一整片**没有任何细节的亮面**
  // （dump 出来看过：纹理右半是一块均匀的浅棕），指节、掌纹全在 normalMap 里。
  // 0.85 时那一块渲染出来就是一个光滑的肉包 —— 用户报的「手不自然」主要是这里。
  // 前臂反过来：缠布的褶皱 diffuse 里本来就画得很足，法线再顶高会变成搓衣板。
  const mk = (map, kind) => {
    const hand = kind === "hand";
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff,             // 见上：颜色在贴图里，这里只能是白的
      map,
      metalness: 0.02,
      roughness: hand ? 0.66 : 0.80,   // 皮革手套带一点光泽，袖布是哑的
      envMapIntensity: 0.85,
    });
    if (src.normalMap) {
      // **共用、不 clone**：`repeat` 是 (1,1)、UV 是作者为这张图排的，两份材质用同一张正好。
      m.normalMap = src.normalMap;
      // 源贴图的 `normalScale` 是它作者的强度（glTF 的 `normalTexture.scale`，默认 1）。
      // 手取 1.45（把指节的起伏顶出来），前臂 1.05。
      const ns = hand ? 1.45 : 1.05;
      m.normalScale = new THREE.Vector2(ns, ns);
    }
    return m;
  };
  return { hand: mk(maps.hand, "hand"), fore: mk(maps.fore, "fore"), maps };
}

// ---------- 袖口束带的最小贴图预算 ----------
// 手套 / 袖布那四套程序化配方已删：手上现在自带 4 张 1024² 作者贴图，走 `fpsArmMaterial()`
// 的亮度重映射（见文件头与 REMAP）。**只有袖口束带还吃程序化贴图** —— 它是我们现加的
// 构件，模型里没有对应的一块。所以这里只留它需要的两个数。
// 目标：一张贴图铺满多少米。袖口 3cm 一格 = 每 3cm 三道棱（见 cuffMaps）。
const TEX_TILE = { cuff: 0.03 };
const TEX_PX = { cuff: 256 };


/** 袖口束带：**罗纹弹力布**（一圈圈细密的竖棱）。它存在的意义是给「袖子插着一只手」
 *  那个断口一个交代 —— 袖口本来就是收口的、比袖管深一档，这一块是画面里
 *  唯一能把「衣服」和「胳膊」分开的构件，所以给它自己的贴图、不复用袖管那张。
 *  UV 由 cuffGeo 烘成「格数」，材质那边 repeat 固定 (1,1)。 */
function cuffMaps() {
  const S = TEX_PX.cuff;
  const RIBS = 3;      // 3cm 一格 → 每 3cm 三道棱，棱距 1cm（一圈约 38 道）
  const rib = field(S, (u) => Math.cos(u * Math.PI * 2 * RIBS));
  const fuzz = lowField(S, (u, v) => vnoise(u * 160, v * 160, 160, 71), 4);
  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = rib[i] * 0.8 + (fuzz[i] - 0.5) * 0.1;

  const base = hexLin(CUFF);
  return buildMaps(S, h, 3.0, 0.75,
    (i, o) => {
      const l = (1 + 0.22 * rib[i]) * (1 + 0.10 * (fuzz[i] - 0.5));
      o[0] = base[0] * l; o[1] = base[1] * l; o[2] = base[2] * l;
    },
    (i) => 0.78 + 0.10 * fuzz[i]);        // 弹力布比平织滑一点
}

// 全局共用 —— 纯数据、不可变，每个 ViewArms 实例各建一份纯属浪费。
let TEX_SETS = null;
function texSets() {
  if (TEX_SETS) return TEX_SETS;
  TEX_SETS = { cuff: cuffMaps() };
  return TEX_SETS;
}

// ---------- 几何体全局共享（照抄 enemy_model.js 的惰性缓存：每把武器重建会漏 buffer geometry）----------
// 换弹中段左手带的弹匣。**只有这一块还是程序化的** —— CS 那份里没有可拎的弹匣。
let GEO = null;
function geo() {
  if (GEO) return GEO;
  const box = (w, h, d, tx = 0, ty = 0, tz = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(tx, ty, tz);
    return g;
  };
  GEO = {
    // 换弹中段左手带的弹匣（要穿过掌心，位置由 _buildArm 定）
    mag: box(0.030, 0.110, 0.070, 0, -0.058, 0),
    // 袖口的束口环：**按「袖管在腕端的半径」现做**（见 _install 里实测那段），
    // 这里只给一个占位用的单位环，实际几何在 _cuffGeo() 里按实测算出来。
    cuff: null,
  };
  return GEO;
}

// 袖口那一圈束带的几何：一个**开口圆柱**，半径与长度按实测的袖管尺寸推。
// 为什么值得专门做一块：手套和袖子是两份网格直接对接的，接口处只有「颜色突然换掉」
// 一条信息 —— 画面上就是一个绿管子插着一只棕手。真实的袖口是**有厚度的束口**，
// 而且在腕上鼓出来一圈，它同时干掉了「管子断口」和「手肘以下没有结构」两件事。
// 半径给 1.16 倍：束带本来就比袖管粗一点，而且留出余量避免与袖管 Z-fighting。
// **UV 直接烘成「格数」**（uv 单位 = 一个 TEX_TILE），所以它的材质用 repeat(1,1)：
// 圆柱的默认 UV 是 [0,1] 归一化，周长 0.28m 与长度 0.04m 会差 7 倍，
// 交给 repeat 去补就会撞上 _mat() 里那条「两轴差 3 倍以上按各向同性」的保护 ——
// 那条保护是给「拿不到 UV 的网格」用的，在这里会把束带的织纹压成一条线。
function cuffGeo(rad, len, tile) {
  const g = new THREE.CylinderGeometry(rad * 1.16, rad * 1.10, len, 18, 1, true);
  g.translate(0, -len / 2, 0);   // 顶点沿 -y 伸展，与整套骨架的约定一致（见文件头）
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * (2 * Math.PI * rad * 1.13) / tile, uv.getY(i) * len / tile);
  }
  uv.needsUpdate = true;
  return g;
}


// ---------- 握持锚点表（武器组局部）----------
// r = 右手（扣扳机那只）腕点，l = 左手（托举）腕点，null 表示这把枪只用一只手。
// m = 弹匣井（换弹时左手把弹匣插进去的位置）。
//
// **整张表是照着「逐 mesh 实测的包围盒」推的，不是估的。** 方法：在武器组局部用 Box3 量出每个
// 材质段的 y/z 区间，认出「护木 / 握把 / 弹匣」三块，再让手**从下方包住**那一块。
// 关键实测值（AK）：护木 Wood y∈[0.043,0.112] z∈[-0.202,-0.07]、握把 Wood y∈[-0.055,0.031]
// z∈[0.112,0.185]、弹匣 Dark_metal y∈[-0.119,0.055] z∈[-0.095,0.043]。
// M4：护木 Primary y∈[0.017,0.126] z∈[-0.236,0.012]、握把在 Primary z∈[0.009,0.245] 的后段；
// 手枪 P320 的握把与套筒同在一个 mesh（y 下探到 -0.18），只能按「握把在后下方」估；
// **匕首这一条是跟着 `WEAPON_DEFS.knife.orient` 走的一组值，改朝向就必须重跑一次。**
// 三个前提**全部换过**，老读数一条都不能用：① 模型从旧的 FBX 双材质刀换成了
// `models/knife.glb`（单材质 `Knife`）；② 手从 CS 四块换成了 `fps_arms.glb` 烘的那副；
// ③ `orient` 是新加的（旧 `rotY: 0` 是照更早的方块小刀量的，对新模型是错的）。
// 现在这一组是**量出来的**：刀柄在组局部沿刃轴从刀尾到护手，握点取柄上 60% 处，
// 拳宽/柄宽 = 1.07、拳/柄长 = 0.82（捏得住、不埋进柄里），`s` 直接用步枪那个 0.743
// ——「手的大小与步枪一致」比「刀粗所以缩手」更该是基准，因为手是同一双手。
// 投掷物是半径 0.11 的球，手从**后下方**托着，掌心必须落进球的下半部才有"握住"的读感。
//
// `s` = **整只手（含前臂）的缩放**，绕腕点缩（作用在 grp 上，见 configure）。
// **这不是装饰参数**：视模是超尺寸的（手枪 0.55 / 匕首 0.50 的归一化长度都远大于真枪），
// 握把截面因此比真枪粗得多，不缩的话手会整个埋进握把里、什么都看不见；反过来匕首柄又太细。
// 步枪的 0.743 是**推导出来的**：CS 那把 AK 长 1.1036、我们归一化到 0.82 → 0.82/1.1036。
// 其余几把没有对应关系（CS 没有手枪/投掷物），按「手的绝对尺寸与步枪一致」起步、再目视微调。
//
// `hr` / `hl` = 左右手**各自的旋转**（弧度，XYZ），逐把修手相对枪的朝向。**八把枪目前全是 0**
// （= 不写这个字段），这不是「还没调」，是量过之后的结论：
//
//   · 拳的**握把通道轴** = `FPS_SRC.gripAxis`（四指的指根连线，`curlRotations` 就是绕它弯的）。
//     实测它与**前臂轴 `armDir` 近似正交**（点积 0.067）—— 这是人体的事实：握杆时杆 ⟂ 小臂。
//   · 而 AK 的握把柱在组局部里≈ `(0, -0.94, 0.34)`，与前臂轴只差 ~20°。要把它对进拳的通道里
//     就得把手相对小臂转 ~98°，摊到腕子上就是一道骨折级别的折角（`hr ≠ R_total` 的部分直接撕焊缝）。
//   · 实测对照：把 `ak_classic` 的 hr 换成那 98° 的六种候选（正负两个符号 × 三档绕前臂滚转），
//     缩略图上「像不像在握」并不比 0 好，而焊缝上多欠了 _cuff 一整条折角。
//   · 源模型 bind 姿势的手**本身就是按握东西摆的**（`palm` 不需要修正），所以两边都留 0。
//
// 真要单独微调某把枪（比如以后换更细的握把），可用的**自由**方向只有「绕前臂轴滚转」——
// 那是不撕焊缝的分量，等价于改烘焙期的 `FPS_ARM_ROLL`，但它只能调「掌心朝哪、拇指倒向哪边」，
// **改不了通道轴的方向**（通道轴躺在 ⊥ 前臂的那个平面里，绕前臂滚只是在平面内转）。
export const ARM_ANCHORS = {
  ak_cf: { r: [0.014,-0.028,0.14], l: [-0.012,0.045,-0.145], s: 0.743, m: [0,-0.11,-0.02] },
  ak:     { r: [ 0.006,  0.001,  0.155], l: [-0.025,  0.041, -0.146], s: 0.743 },
  m4:     { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190], s: 0.743 },
  awm:    { r: [ 0.018, -0.045,  0.160], l: [-0.025, -0.030, -0.230], s: 0.743 },
  pistol: { r: [-0.028, -0.100,  0.160], l: [-0.048, -0.135,  0.115], s: 0.800, m: [ 0.0, -0.230, 0.140] },
  knife:  { r: [ 0.0369, -0.0946,  0.0638], s: 0.743, l: [-.62,-.18,.04] },
  frag:   { r: [-0.030, -0.035,  0.080], s: 0.650, l: null },
  flash:  { r: [-0.030, -0.035,  0.080], s: 0.650, l: null },
  smoke:  { r: [-0.030, -0.035,  0.080], s: 0.650, l: null },

  // ---- 模型皮肤专用锚点表 ----
  // 每款模型皮肤各一张，键名由皮肤 `model.anchorKey` 指定（`configure()` 取不到就回退到
  // 武器 id 那张，再取不到回退 ak）。为什么要按模型分而不是给枪加一个 Y/Z 平移：
  // 一次握持是**两个**接触点（右手腕咬扳机、左手腕托护木）**加**换弹的弹匣井，单一个平移
  // 最多只对得准一个点，另外两个必然漂；它还会挪动整把枪，破坏 bx/by/bz 当初按
  // 「手必须落在画面内」反推出来的构图。
  // 初值一律复制所属武器那一套（含 `m` = 弹匣井，显式写出来是为了让它可单独调），
  // 之后靠 `armsPose()` + `project()` 的数值逐个调 —— 视模从不读枪的几何自适应，只能量。
  ak_classic:   { r: [ 0.018, -0.030,  0.145], l: [-0.025,  0.023, -0.175], s: 0.743, m: [0, -0.155, 0.020] },
  m4_thor:      { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190], s: 0.743, m: [0, -0.155, 0.020] },
  m4_frost:     { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190], s: 0.743, m: [0, -0.155, 0.020] },
  m4_bubblegum: { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190], s: 0.743, m: [0, -0.155, 0.020] },
  m4_goldenm4:  { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190], s: 0.743, m: [0, -0.155, 0.020] },
  m4_xuanjin:   { r: [ 0.018, -0.045,  0.175], l: [-0.025, -0.003, -0.190], s: 0.743, m: [0, -0.155, 0.020] },
  awm_volt:     { r: [ 0.018, -0.045,  0.160], l: [-0.025, -0.030, -0.230], s: 0.743, m: [0, -0.155, 0.020] },
  awm_field:    { r: [ 0.018, -0.045,  0.160], l: [-0.025, -0.030, -0.230], s: 0.743, m: [0, -0.155, 0.020] },
};

// 肘点（武器组局部）由 configure() 现算成 `anchor + ELBOW_DIR * ELBOW_DIST`。
// 为什么不再是一张固定的绝对点表：肘的**方向**是人的姿势（与枪无关），而腕点随枪走 ——
// 固定绝对点会让「换一把枪」同时改掉前臂的角度，于是同一双手在八把枪上指着八个方向。
// 对外仍导出 `ELBOWS` 给调试钩子读（值是最近一次 configure 算出来的绝对点，只读）。
export const ELBOWS = { r: [0, 0, 0], l: [0, 0, 0] };

// 换弹中段的两个落点。**注意这两者处在不同的坐标系里，这是有意的**：
//
//  · MAGWELL / MAG_SLAP 是**武器组局部**坐标（弹匣井是枪身上的一块，必须跟着枪走）。
//  · POUCH 是**相机空间**坐标（腰侧弹匣袋钉在屏幕上，不能跟着枪走）。
//
// 为什么必须分开：手臂是武器组的子节点，而换弹时组本身会下沉、再俯仰。
// 腰袋点若也用组局部坐标，就会被这组变换一起甩出去 —— 实测 p=0.40 时手落在屏幕 y≈1600px，
// 整段下探全程在画面外（相机空间 (-0.28,-0.45,-0.62) 经 -49° 俯仰后 y 变成 -0.665、
// z 变成 -0.249，投影直接爆掉）。所以 POUCH 在 update() 里用过组矩阵的**逆**换回组局部，
// 屏幕位置因此与枪怎么沉、怎么转完全无关。
const POUCH = new THREE.Vector3(-0.320, -0.200, -0.620); // 相机空间：胸前弹匣袋 ≈ px(400,506)
// 导出的理由只有一个：`armAnchors()` 这个读口要把**生效的**弹匣井补进每条锚点里
// （表里只有手枪显式写了 `m`，其余武器走这个常量）。让测试去写死 0.020/0.155 这类魔法数，
// 等于把「换弹时左手有没有对上弹匣井」这条断言挂在一个会跟产品漂移的副本上。
export const MAGWELL = new THREE.Vector3(0.000, -0.155, 0.020); // 组局部：弹匣井（现有弹匣下缘再低一点）
const MAG_SLAP = new THREE.Vector3(0.000, -0.128, 0.020); // 组局部：拍实，往上顶一点点

// 换弹时间线的关键帧（p ∈ [0,1]）。首尾都落在护木锚点上 —— 所以 p=1 时**精确回到静止姿势**，
// 不会在 updateReload 翻掉 reloading 的那一帧跳一下。
//   0.00–0.16 枪身下沉外倾、左手离开护木
//   0.16–0.40 左手下探到腰侧弹匣袋
//   0.40–0.58 带弹匣上抬、插入弹匣井
//   0.58–0.76 拍实（过冲再落回）
//   0.76–1.00 左手归位到护木、枪身抬回
const KEYS = [
  { p: 0.00, k: "L" },
  { p: 0.16, k: "L" },
  { p: 0.40, k: "P" },
  { p: 0.58, k: "M" },
  { p: 0.67, k: "S" },
  { p: 0.76, k: "M" },
  { p: 1.00, k: "L" },
];
// 弹匣盒可见区间：从「手已到弹匣袋」到「插进弹匣井」。
// 上限 0.62 是必须的 —— 枪自己的弹匣是模型的一部分、卸不掉，带过去的弹匣若在弹匣井里
// 还亮着，就会和枪上那只**穿模**。让它在「手捂住井口」的那一刻消失，肉眼看不出来。
const MAG_ON = 0.32, MAG_OFF = 0.62;

const smooth = (t) => t * t * (3 - 2 * t); // smoothstep，与 animateWeapon 里那条同源

// 换弹期间左肘的**相机空间**位置：前臂从这里往画面左下伸出去。远端落在屏幕外是刻意的 ——
// 一条整整齐齐收在画面里的前臂看着像贴在镜头上的塑料管，出画才像「手长在自己身上」。
const ELBOW_L_RELOAD = new THREE.Vector3(-0.590, -0.410, -0.450);

const _tmpL = new THREE.Vector3();
const _tmpE = new THREE.Vector3();
const _tmpR = new THREE.Vector3();
const _kA = new THREE.Vector3();
const _kB = new THREE.Vector3();
const _dirR = new THREE.Vector3();
const _dirL = new THREE.Vector3();

export class ViewArms {
  loadClassic(view) {
    const parts=bakeClassicArms(view);
    this.classic=true;
    for(const side of ['R','L']) {
      const p=parts[side];FPS_SRC.handPivot[side]=p.pivot;FPS_SRC.armWrist[side]=[0,0,0];
      FPS_SRC.armDir[side]=p.axis;ELBOW_DIR[side.toLowerCase()]=p.axis;
      this._install(side==='R'?this.armR:this.armL,new THREE.Mesh(p.hand,parts.material.hand),new THREE.Mesh(p.fore,parts.material.fore),parts.material);
    }
    this.handsReady=true;this.configure(this.weaponId);return true;
  }
  constructor() {
    const G = geo();
    // 材质每个实例一份（与 SoldierRig 同理：将来若要做「受击/变色」不会互相串）。
    // **手部四块网格的材质是在 _install 里按「源材质名 + 左右」现建的** —— 因为
    // 贴图的 repeat 必须按那条网格**实测的 UV 密度**反推（见 _mat），构造期拿不到。
    this.matMag = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.68, metalness: 0.28 });
    this._matCache = new Map();

    this.root = new THREE.Group();
    this.root.name = "viewArms";
    this.armR = this._buildArm(G, 1, "R");
    this.armL = this._buildArm(G, -1, "L");
    // 弹匣只挂在左手上（右手的枪自己带着弹匣）
    this.magL = this.armL.mag;
    this.root.add(this.armR.grp, this.armL.grp);

    // 手部网格是异步装进来的（见 load()）。这把锁只用于**降级提示**：
    // 装载失败时枪照常显示、只是没有手，而不是整局崩掉。
    this.handsReady = false;

    // 初值直接读锚点表，不要另抄一份常量 —— 抄一份就会出现「表改了、静止姿势没跟上」
    this.anchorR = new THREE.Vector3().fromArray(ARM_ANCHORS.ak.r);
    this.anchorL = new THREE.Vector3().fromArray(ARM_ANCHORS.ak.l);
    this.magwell = MAGWELL.clone();
    // 肘锚点：对外是数组，内部一律用 Vector3（_aim 只收 Vector3，见该函数注释）
    this.elbR = new THREE.Vector3().fromArray(ELBOWS.r);
    this.elbL = new THREE.Vector3().fromArray(ELBOWS.l);
    this.hasLeft = true;
    this.weaponId = "ak";
    this.magL.visible = false;
    this._solveElbows();
    this._aim(this.armR, this.anchorR, this.elbR);
    this._aim(this.armL, this.anchorL, this.elbL);
  }

  /**
   * 装载 `models/fps_arms.glb`：**烘成静态 → 切四块 → 装进已经搭好的骨架**。
   * **必须在第一帧之前完成**（main.js 的 init() 把它并进 Promise.all）——
   * 否则开局那一帧是「枪浮在空中」。
   * 失败**不是静默 no-op**：返回 false，由调用方 toast 报错；枪照常显示、只是没有手。
   */
  load(url = FPS_ARMS_URL, curl = FPS_CURL) {
    return new Promise((resolve) => {
      makeGLTFLoader().load(
        url,
        (gltf) => {
          // 烘焙与装载都可能抛。**必须在这里接住**：GLTFLoader 的 onLoad 里抛出的异常
          // 会被它转给 onError，于是一路退化成「静默无手」，控制台之外没有任何痕迹 ——
          // 实测踩到过一次（取表用了 arm.side 那个 ±1 的数字而不是 arm.tag，取到 undefined），
          // 排查了三轮。现在多了一条更硬的理由：`bakeFpsArms` 里有十来处断言式的 throw。
          let parts, mat;
          try {
            parts = bakeFpsArms(gltf, curl);
            mat = fpsArmMaterial(gltf);
          } catch (err) {
            console.error("[viewarms] 双手烘焙失败", err);
            return resolve(false);
          }
          if (!parts.handR || !parts.foreR) return resolve(false);   // 只有右手也认作失败
          // `bakeFpsArms` 出的是**纯几何**（BufferGeometry，便于独立跑数值自检），
          // 装进场景要在这里包成 Mesh。**别把这层省掉**：`Object3D.add(几何)` 不会抛，
          // three 只 `console.error` 一句 `object not an instance of THREE.Object3D` 就返回，
          // 于是手**静默不显示**、`handsReady` 还是 true，`armsPose().loaded` 也是 true ——
          // 正是 AGENTS.md 反复记的那类「控制台之外无痕迹」的失败。
          const mesh = (g) => { const m = new THREE.Mesh(g, mat.hand); m.frustumCulled = false; return m; };
          try {
            this._install(this.armR, mesh(parts.handR), mesh(parts.foreR), mat);
            if (parts.handL && parts.foreL) this._install(this.armL, mesh(parts.handL), mesh(parts.foreL), mat);
          } catch (err) {
            console.error("[viewarms] 双手装载失败", err);
            return resolve(false);
          }
          this.handsReady = true;
          resolve(true);
        },
        undefined,
        (err) => { console.error("[viewarms] 双手 GLB 加载失败", err); resolve(false); }
      );
    });
  }

  // 把一对「手 + 袖」挂进一只骨架的手臂上（坐标系与枢轴见文件头与 FPS_SRC 注释）
  _install(arm, handMesh, armMesh, mat) {
    // **用 arm.tag（"R"/"L"）取表，不是 arm.side（±1）**：FPS_SRC / ARM_STRETCH 都以字母为键，
    // 传数字会取到 undefined，紧接着 `hp[0]` 抛异常 —— 而那异常在 GLTFLoader 的 onLoad 里，
    // 会被它吞成 onError，表现是「手静默不显示」而不是报错。
    const side = arm.tag;
    // 手：枢轴 = 手掌包围盒中心，于是它正好落在 ARM_ANCHORS 的 r/l 上
    const hp = FPS_SRC.handPivot[side], aw = FPS_SRC.armWrist[side], ad = FPS_SRC.armDir[side];
    arm.handWrap.position.set(-hp[0], -hp[1], -hp[2]);
    arm.handWrap.add(handMesh);

    // 前臂：① 转正 —— 把它的**真实主轴**旋到局部 -Y（否则 _aim 会把它指歪，见 FPS_SRC 注释）；
    //        ② 再把腕端挪到 fore 的原点，于是 fore 的位置就是腕点、_aim 转的就是整根前臂。
    const axis = new THREE.Vector3().fromArray(ad);
    const q = new THREE.Quaternion().setFromUnitVectors(axis, DOWN);
    arm.armWrap.quaternion.copy(q);
    arm.armWrap.position.copy(new THREE.Vector3().fromArray(aw)).applyQuaternion(q).negate();
    // 袖管挂在 **armWrap** 上（不是 armStretch）——层级是 fore → armStretch(scale) → armWrap(quat) → 网格，
    // 顶点才会先转正、再沿前臂轴拉伸。挂错一层就退回「沿源空间的歪轴拉」，见 _buildArm 里那段注释。
    arm.armWrap.add(armMesh);

    // **腕点相对手心的偏移必须在这里写**（不是 _buildArm）：`FPS_SRC` 要等烘焙完才有值，
    // 而 _buildArm 是在构造函数里跑的（那时模型还没下载）。写在这里两者才同源。
    arm.fore.position.set(aw[0] - hp[0], aw[1] - hp[1], aw[2] - hp[2]);

    // 袖管的轴向长度（腕 → 肘）。**按顶点沿轴的真实跨度**量：这是非索引几何（烘焙时
    // 已经把 index 拆成了三角形列表），拿包围盒的 8 个角去点乘轴会在斜轴 + 弯臂上**放大**
    // 出好十几厘米 —— 于是 armTip() 把「袖口出没出画」判错。
    let mn = Infinity, mx = -Infinity;
    const v = new THREE.Vector3();
    for (const o of collectMeshes(armMesh)) {
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const d = v.fromBufferAttribute(pos, i).dot(axis);
        if (d < mn) mn = d;
        if (d > mx) mx = d;
      }
    }
    // axis 是**腕 → 肘**，而腕落在投影小的一端，所以长度就是整个跨度
    arm.armLen = mx - mn;

    // 材质是**整副共享**的（`fpsArmMaterial` 只出两份：手一份、前臂一份）——
    // 源模型全程只有一个材质，四块几何各分到手的/臂的那一份即可。
    for (const o of collectMeshes(handMesh)) o.material = mat.hand;
    for (const o of collectMeshes(armMesh)) o.material = mat.fore;
    // 袖口束带：位置与粗细全部由**实测**推出（袖管在腕端的半径 + 袖管本身的长度比例），
    // 不写死数字 —— 换了源模型（换手）它自己就跟着变。
    // **必须在下面那个打标循环之前造出来并挂上**，否则它不进 collectMeshes、拿不到
    // `userData.viewArms`，会被 meshMats() 当成武器材质导出去（皮肤测试的条数断言会红）。
    const cuff = this.classic?null:this._cuff(armMesh, axis, new THREE.Vector3().fromArray(aw), arm.armLen, side);
    if (cuff) arm.fore.add(cuff);

    for (const o of [...collectMeshes(handMesh), ...collectMeshes(armMesh)]) {
      o.frustumCulled = false;   // 视模紧贴相机，视锥剔除只会带来闪烁
      o.castShadow = false;
      o.receiveShadow = false;
      // 手臂不属于「武器材质」——meshMats() 会遍历整个武器组导出材质快照，
      // 不过滤的话皮肤测试的条数/下标断言会全线崩（见 main.js 的 meshMats）。
      o.userData.viewArms = true;
    }
    if (cuff) { cuff.frustumCulled = false; cuff.userData.viewArms = true; }
  }

  /**
   * 袖口那圈束带。半径取「腕端附近那些顶点到前臂轴的半径」，只统计靠腕的那一段
   * （靠肘那端是喇叭口，拿它做束带会得到一个比手还粗的环）。
   * 全部按**源模型坐标**造 —— 它是 armWrap 的兄弟节点，与网格同一个坐标系。
   */
  _cuff(armMesh, axis, wrist, armLen, side) {
    const r90 = [];
    const v = new THREE.Vector3();
    for (const o of collectMeshes(armMesh)) {
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).sub(wrist);
        const t = v.dot(axis);                       // 沿轴的坐标（腕 = 0）
        if (t < 0 || t > armLen * 0.22) continue;    // 只看靠腕的 22%
        r90.push(Math.sqrt(Math.max(0, v.lengthSq() - t * t)));
      }
    }
    if (r90.length < 8) return null;
    r90.sort((a, b) => a - b);
    const rad = r90[Math.floor(r90.length * 0.9)];   // 90 分位：不被个别飞点带大
    if (!(rad > 1e-4)) return null;
    return new THREE.Mesh(cuffGeo(rad, armLen * 0.10, TEX_TILE.cuff), this._cuffMat());
  }

  /**
   * 袖口束带的材质。**这是全模块唯一还吃程序化贴图的一件**（它不是模型里的构件）。
   *
   * `repeat` 固定 (1,1)：`cuffGeo` 已经把那圈圆柱的 UV 烘成「**格数**」了
   * （uv 单位 = 一个 TEX_TILE），再乘一次密度就成了平方。
   * 全局共用一个材质（不带左右 —— 束带是圆柱、UV 是对称烘的，两侧一模一样）。
   */
  _cuffMat() {
    if (this._matCache.has("cuff")) return this._matCache.get("cuff");
    const src = texSets().cuff;
    const m = new THREE.MeshStandardMaterial({
      // **必须是白的**：本色已经烘进 albedo 了（cuffMaps 用 hexLin(CUFF) 当基色），
      // 而 `color` 是**乘**在 map 上的 —— 两边都上等于色值平方（`0x3d4231² ≈ 0x0f1109`）。
      color: 0xffffff,
      roughness: 1,          // 完全交给 roughnessMap（roughness 是**乘**在贴图上的倍率）
      metalness: 0.02,
      envMapIntensity: 0.85,
      normalScale: src.normalScale.clone(),
      map: src.map,
      normalMap: src.normalMap,
      roughnessMap: src.roughnessMap,
    });
    this._matCache.set("cuff", m);
    return m;
  }

  // side = +1 右手 / -1 左手
  _buildArm(G, side, tag) {
    const grp = new THREE.Group();
    // 手掌单独一组：按武器/握把角度微调「手的姿态」只动这一组，
    // **不能**动 grp —— grp 的旋转会叠加到 fore 的四元数上，把前臂指歪（见 _aim）。
    const palm = new THREE.Group();
    // 手的枢轴修正再往里一层：`handWrap` 只负责把网络的包围盒中心挪到原点 + 承接每把枪的
    // 姿态修正（hr/hl），换上层的 palm 是为了让「按武器调角度」与「按源数据摆枢轴」分开，
    // 免得两者写在同一个 quaternion 上互相覆盖。
    const handWrap = new THREE.Group();
    palm.add(handWrap);
    grp.add(palm);

    // 前臂挂在**腕点**（由 _install 把源前臂的腕端挪到这里）。fore 的 quaternion 由 _aim 每帧覆盖，
    // 所以任何「让袖子转个角度」的修正都必须写在里层的 armWrap 上，不能写在这一层。
    const fore = new THREE.Group();
    // fore.position（腕点相对手心的偏移）**由 _install 写**，不在这里：它要读 `FPS_SRC`，
    // 而那是烘焙之后才有的值，_buildArm 是在构造函数里跑的（那时模型还没下载）。
    // 两边都是「同一份源数据推出来的两个点」，不会各调各的、最后在腕子上裂一道缝。
    // 拉伸层与旋转层的**嵌套顺序是有讲究的，反了会把袖口从腕上掰开**（实测踩到）：
    //   · `armWrap` 自带源模型枪空间的旋转 q（把前臂的真实主轴旋到局部 -Y），
    //     所以它**内层**的坐标是**源模型的枪空间** —— 而源空间里的 Y 根本不是前臂的轴
    //     （实测差 33°）。在这层做 `scale.y` 等于沿着一根歪轴拉，袖口被挪走 **0.0619m**、
    //     整根管子还歪 33°：画面上就是「袖子和小手之间裂一道缝」。
    //   · `fore` 的局部 -Y **才是**前臂轴 —— `_aim()` 每帧用
    //     `setFromUnitVectors(DOWN, normalize(elbow - wrist))` 保证了这一点。
    //     所以拉伸必须放在 `fore` 与 `armWrap` 之间。
    //   · 而且**不需要**为位置做补偿：腕端 `aw` 经 q 与 p 之后恰好落在 fore 的原点上，
    //     而原点对任何 `scale` 都是不动点。写 `armWrap` 的 position 那一行照旧即可。
    // 为什么不用 `fore.scale` 直接拉：`armWrap.position` 是 fore 的子节点，
    // 会跟着一起被缩放，腕点就滑出手心了（子节点的 position 活在父节点的缩放空间里）。
    const armStretch = new THREE.Group();
    armStretch.scale.set(1, ARM_STRETCH[tag], 1);
    const armWrap = new THREE.Group();
    armStretch.add(armWrap);
    fore.add(armStretch);
    grp.add(fore);

    // 换弹时左手拎着的弹匣（只在左手；右手那把枪的弹匣始终插在枪上）
    const mag = new THREE.Mesh(G.mag, this.matMag);
    // 弹匣要**穿过掌心**：弹匣顶得压在掌心以上，否则手和弹匣之间会露出一道缝，
    // 看着像两块分开的板（实测）。
    mag.position.set(0, -0.005, 0.010);
    mag.visible = false;
    mag.frustumCulled = false;
    mag.userData.viewArms = true;
    grp.add(mag);

    return { grp, palm, handWrap, fore, armWrap, armStretch, mag, side, tag };
  }

  // 挂到某把武器的组里。手臂必须是**武器组的子节点**（而不是 vmCamera 的兄弟）——
  // switchWeapon / applyScope / animateWeapon 这三处都在写 group.visible，
  // 挂在组里才能让「开镜时手臂跟着枪一起消失」自动成立。
  attach(group, weaponId) {
    if (this.root.parent !== group) group.add(this.root);
    this.configure(weaponId);
  }

  configure(weaponId) {
    const a = ARM_ANCHORS[weaponId] || ARM_ANCHORS.ak;
    this.weaponId = weaponId;
    this.anchorR.fromArray(a.r);
    this.hasLeft = !!a.l;
    // **必须 fromArray，不能 copy**：a.m 是数组，而 Vector3.copy() 读的是 `.x/.y/.z`
    // —— 数组上那三个是 undefined，copy 完 magwell 就是 NaN，插弹匣那半段左手直接消失
    // （NaN 沿 lerp 传下去，s=1 时整条时间线都残废）。锚点表里其它几个字段走的就是 fromArray。
    if (a.m) this.magwell.fromArray(a.m);
    else this.magwell.copy(MAGWELL);
    if (this.hasLeft) this.anchorL.fromArray(a.l);
    if(this.classic) {
      if(weaponId.startsWith('m4'))this.anchorL.add(new THREE.Vector3(.025,.035,0));
      if(weaponId.startsWith('awm'))this.anchorL.x+=.015;
      if(weaponId==='pistol'){this.anchorR.y+=.05;this.anchorL.y+=.05;}
    }
    // 手部缩放：缩的是 grp，而 grp 的原点就是腕点 —— 所以整只手（含前臂、弹匣）
    // 是「绕腕点缩小」，腕点本身不动、仍然咬在握把上。
    const s = a.s || 1;
    this.armR.grp.scale.setScalar(s);
    this.armL.grp.scale.setScalar(s);
    for(const arm of [this.armR,this.armL]) {
      arm.restFore ||= arm.fore.position.clone();
      arm.fore.position.copy(arm.restFore);arm.armStretch.scale.y=1;
    }
    // 每把枪的手部姿态修正（CS 的手是照它那把枪烘的，换到我们的枪上角度不完全吻合）
    this.armR.palm.rotation.fromArray(a.hr || [0, 0, 0]);
    this.armL.palm.rotation.fromArray(a.hl || [0, 0, 0]);
    this.armL.grp.visible = this.hasLeft;
    this.magL.visible = false;
    this._solveElbows();
    // 立刻摆到静止位：切枪那一帧手臂不这么放的话，会有一帧停在上一把枪的握位上
    this._aim(this.armR, this.anchorR, this.elbR);
    if (this.hasLeft) this._aim(this.armL, this.anchorL, this.elbL);
  }

  // 袖口在**武器组局部**的坐标。判「前臂有没有画到画面外」靠它：喂给 main.js 的 project()
  // 就知道袖口落在第几个像素，是**数值判据**而不是截图目测（截图只告诉你某一帧看着不对）。
  // 解析算出，不走 Box3 —— Box3 是世界坐标、旋转下会把盒子撑大，拿来判「出没出画」会偏保守。
  armTip(side, out = new THREE.Vector3()) {
    const a = side === "l" ? this.armL : this.armR;
    const L = (a.armLen || 0) * (a.armStretch ? a.armStretch.scale.y : 1);
    // 前臂的伸展方向恒为 fore 的局部 -y（_aim 就是把它转到腕→肘方向上的）。
    // **`fore` 是 `grp` 的子节点、而 `grp` 的原点就是腕点**（`_aim` 里 `grp.position = wrist`），
    // 所以上面这一串天然算的是「相对腕点」的坐标 —— 必须再过一次 `grp.matrix` 才落到
    // 武器组局部（`root` 恒为单位变换，不必再乘）。少了这一步量到的点就与手上是哪把枪**无关**
    // （实测：八把枪的 armTip 读数一模一样，因为它只随 ELBOW_DIR 变），
    // 而 main.js 的 `project()` 收的是武器组局部 ⇒ 那条「袖口出没出画」的判据整条形同虚设。
    a.grp.updateMatrix();
    return out.set(0, -L, 0).applyQuaternion(a.fore.quaternion).add(a.fore.position)
      .applyMatrix4(a.grp.matrix);
  }

  // 肘 = 腕 + 方向 × 距离。**方向是固定的、腕点随枪走** —— 见 ELBOW_DIR 的注释。
  _solveElbows() {
    _dirR.fromArray(ELBOW_DIR.r).normalize();
    _dirL.fromArray(ELBOW_DIR.l).normalize();
    this.elbR.copy(this.anchorR).addScaledVector(_dirR, ELBOW_DIST);
    this.elbL.copy(this.anchorL).addScaledVector(_dirL, ELBOW_DIST);
    ELBOWS.r = this.elbR.toArray();
    ELBOWS.l = this.elbL.toArray();
  }

  // 把腕点摆到 wrist、前臂指向 elbow。零向量要提前拦掉 ——
  // normalize(0) 会得到 NaN 四元数，污染矩阵后 animateWeapon 每帧抛异常，
  // 被 loop 的 try/catch 吃掉，表现就是「手臂凭空消失」且控制台之外无提示。
  // `elbow` 是 Vector3。**这里踩过一次**：函数原先按下标读数组（`elbowArr[0]`），
  // 换弹那条路径传进来的却是 Vector3 —— 三个分量全是 undefined，`_d` 变 NaN，
  // `d2 < 1e-8` 对 NaN 恒为 false，于是 setFromUnitVectors 吃进一个 NaN 方向，
  // 前臂的四元数整条污染：**前臂静默消失，不报错、不进 loopErrors**（实测排查了两轮）。
  // 现在统一走 Vector3，两边不会再串。
  _aim(arm, wrist, elbow) {
    arm.grp.position.copy(wrist);
    _d.set(elbow.x - wrist.x, elbow.y - wrist.y, elbow.z - wrist.z);
    const d2 = _d.lengthSq();
    if (d2 < 1e-8) arm.fore.quaternion.identity();
    else arm.fore.quaternion.setFromUnitVectors(DOWN, _d.multiplyScalar(1 / Math.sqrt(d2)));
  }

  // 左手在换弹时间线上的位置（**组局部**，由 _key 把相机空间的腰袋点换进来）。
  // 写到 out 上避免每帧新建向量。
  _reloadLeft(p, out, invM) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = KEYS[i], b = KEYS[i + 1];
      if (p > b.p) continue;
      const t = b.p > a.p ? (p - a.p) / (b.p - a.p) : 0;
      const s = smooth(Math.max(0, Math.min(1, t)));
      const va = this._key(a.k, _kA, invM), vb = this._key(b.k, _kB, invM);
      return out.set(va.x + (vb.x - va.x) * s, va.y + (vb.y - va.y) * s, va.z + (vb.z - va.z) * s);
    }
    return out.copy(this.anchorL);
  }
  // 组局部坐标 ⇄ 相机空间：invM 是武器组矩阵的逆（组是 vmCamera 的子节点、vmCamera 是单位变换，
  // 所以「组矩阵」本身就是 局部→相机 的映射）。缺省当单位阵，方便单独调用。
  _key(k, out, invM) {
    if (k === "L") return out.copy(this.anchorL);
    if (k === "M") return out.copy(this.magwell);
    // 拍实用量很小（3cm），只是给「拍到位」一个可见的过冲
    if (k === "S") return out.set(this.magwell.x, this.magwell.y + 0.030, this.magwell.z);
    out.copy(POUCH);
    if (invM) out.applyMatrix4(invM);
    return out;
  }

  /**
   * @param reloading 当前武器是否在换弹（门控在 st.reloading 上，不能只看 p）
   * @param p         st.reloadT / st.reloadDur，被 clamp 到 [0,1]
   * @param invM      武器组矩阵的逆（相机空间 → 组局部）。换弹时组的俯仰很大，
   *                  腰袋点必须走这个逆变换才能钉在屏幕上；省略则退化为旧的纯组局部行为。
   */
  poseGrenade(action,invM) {
    // The right hand stays on the body while the left reaches the pin, pulls
    // away, then clears the throwing arm. Elbows remain below the camera.
    _tmpR.set(.62,-.70,-.10).applyMatrix4(invM);
    this._aim(this.armR,this.anchorR,_tmpR);
    this.armR.armStretch.scale.y=Math.max(1,this.anchorR.distanceTo(_tmpR)/(this.armR.armLen*this.armR.grp.scale.x)+.15);
    this.armL.grp.visible=!!action&&!action.thrown;
    this.magL.visible=false;
    if(!action||action.thrown)return;
    const pull=smooth(Math.min(1,Math.max(0,(action.t-.08)/.25)));
    _tmpL.copy(this.anchorR).add(new THREE.Vector3(-.015-.25*pull,.12+.015*pull,-.025));
    _tmpE.set(-.52,-.70,-.13).applyMatrix4(invM);
    this._aim(this.armL,_tmpL,_tmpE);
    this.armL.armStretch.scale.y=Math.max(1,_tmpL.distanceTo(_tmpE)/(this.armL.armLen*this.armL.grp.scale.x)+.15);
  }

  update(reloading, p, invM) {
    this._aim(this.armR, this.anchorR, this.elbR);
    if (!this.hasLeft) return;
    if (this.weaponId==='knife' && invM) {
      // Elbows stay near the player's shoulders while the wrist turns the knife.
      // Rotating the whole forearm with the blade would expose its cut-off end.
      _tmpR.set(.68,-.62,-.10).applyMatrix4(invM);
      this._aim(this.armR,this.anchorR,_tmpR);
      this.armR.armStretch.scale.y=Math.max(1,this.anchorR.distanceTo(_tmpR)/(this.armR.armLen*this.armR.grp.scale.x)+.2);
      // The free hand guards the lower left; it does not sweep with the blade.
      _tmpL.set(-.24,-.29,-.60).applyMatrix4(invM);
      _tmpE.set(-.43,-.63,-.22).applyMatrix4(invM);
      this._aim(this.armL,_tmpL,_tmpE);this.magL.visible=false;
      this.armL.palm.quaternion.setFromRotationMatrix(invM);
      this.armL.fore.position.copy(this.armL.restFore).applyQuaternion(this.armL.palm.quaternion);
      this.armL.armStretch.scale.y=Math.max(1,_tmpL.distanceTo(_tmpE)/(this.armL.armLen*this.armL.grp.scale.x)+.2);
      return;
    }
    this.armL.palm.rotation.fromArray((ARM_ANCHORS[this.weaponId]||ARM_ANCHORS.ak).hl||[0,0,0]);
    if (reloading) {
      this._reloadLeft(p, _tmpL, invM);
      // 左肘要跟着「手还在不在枪上」在两套锚点之间过渡：
      // 手在护木时肘取枪上的 elbL（前臂贴着枪身），手下去掏弹匣时换成相机空间的肘位。
      // 全程用 elbL 不行 —— 手都到腰上了、肘还挂在枪上，前臂会横穿整个画面，
      // 看着像一根搁在屏幕下沿的木头（实测 p=0.16 / 0.40 都是这样）。
      _tmpR.copy(ELBOW_L_RELOAD);
      if (invM) _tmpR.applyMatrix4(invM);
      const w = p <= 0.16 ? 0
        : p < 0.40 ? smooth((p - 0.16) / 0.24)
          : p <= 0.76 ? 1
            : 1 - smooth((p - 0.76) / 0.24);
      _tmpE.copy(this.elbL).lerp(_tmpR, w);
      this._aim(this.armL, _tmpL, _tmpE);
      // 弹匣只在「手已到弹匣袋」到「插进井里」之间可见；位置在 _buildArm 里定死，
      // 这里不要再写一次（重复写会盖掉「穿过掌心」那个修正）。
      this.magL.visible = p > MAG_ON && p < MAG_OFF;
    } else {
      this._aim(this.armL, this.anchorL, this.elbL);
      this.magL.visible = false;
    }
  }
}

// 生成器 / 多 primitive 网格在 three 里会成为 Group，所以一律往下收一层。
// （CS 的 HandR/HandL 各带 3 个材质 → 3 个 primitive → 一定是 Group。）
function collectMeshes(o) {
  const out = [];
  o.traverse((m) => { if (m.isMesh) out.push(m); });
  return out;
}
