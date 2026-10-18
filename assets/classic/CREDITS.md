# 经典 CF 素材来源

本目录记录浏览器游戏中使用的经典 CF 社区移植素材。它们并非本项目原创，也不属于 CC0；来源页面的“允许移植”说明不等于获得原权利人的完整再分发或商业授权。公开部署或商业使用时应逐项核对授权条件。

## M4A1-S 铁兽·帝皇金（用户提供素材）

- 原始文件由用户从本地目录提供，包括 GoldSrc v10 `models/v_ak47.mdl`（用于世界/掉落枪模）与 `compile/v_` 下完整 SMD/QC、贴图及 `sound/weapons/*.wav`。
- `tools/import_ironbeast_smd.py` 按 QC 导入 113 骨骼、手臂/手指/枪身、对应 Specular 高光层、12 个枪口/射击 VFX 材质，以及 idle、reload、select、fire、prefire、postfire 六段 SMD 动作；另从用户最初提供的 `models/v_ak47.mdl` 补回该版本独有的第七段 `knife-attack`。两份来源的 113 骨骼层级完全一致；旧包只有场景根骨和 VFX 辅助骨坐标约定不同，因此导入器只重定向枪身/双手动作，不替换当前模型、贴图或光效。`tools/import_ironbeast_m4.py` 生成世界/掉落物使用的静态枪模。
- 原始 6 个 WAV 原样放入 `audio/classic/ironbeast/`。QC 的 reload 事件帧 115/206 分别驱动帝皇金弹匣与 M4 卡入声；select 事件帧 135 驱动原始出枪音效；`knife-attack` 的第 1/500 秒事件播放原 `M4A1-S-Beast_knifeAttack.wav`，均按源动画时间线排程且不变调。游戏中仅炫金雷神可用右键触发这段枪托攻击；普通 M4A1-C 不受影响。原 SMD 不含 walk 动作，走动沿用现有摆动系统。
- 素材由用户提供；本地使用。未验证其公开再分发授权，勿将这些原始模型、贴图或音频单独打包公开发布。

## 运输船

- 来源：[CF Transport Ship](https://gamebanana.com/mods/111054)，下载文件 `cf_transport_ship_2.rar`，GameBanana 文件编号 `288721`。
- 原始地图/贴图：SmileGate；转换、道具、贴图、NAV：Riding crab snails；编译/截图/提交：ElysiumLeoSK。
- 来源页允许下载安装；重新分发、修改后分发和在其他模组中分发列为需询问；商业使用列为不允许。
- 本地转换：BSP v20 世界几何、材质、RGBExp32 烘焙光照、天空盒、凸体碰撞平面和双方出生点。排除 `func_buyzone` 的不可见编辑器体积。小道具的外部 MDL 未单独导入；玻璃动态子模型未实现；海面复用本项目的水材质。
- 本地场景按用户要求沿 X 轴左右镜像，几何、碰撞、出生点和雷达同步变换；补回原 BSP 中被旧过滤器遗漏的 156 个地下凸体，保留楼梯、地道和出口木箱。
- 产物：`transport/map.bin`、`map.json`、`lightmap.png` 和对应 PNG 贴图。

## 守望之城（源素材 CF Prison）

- 来源：[CF Prison](https://gamebanana.com/mods/119449)，下载文件 `cf_prison_fixed.rar`，GameBanana 文件编号 `288675`；下载包 MD5 `85a39a78351e992d760cf4e4585daf02`。
- 本地使用包内 `maps/cf_prison.bsp` 的 Source BSP v20 世界几何、光照、实体出生点和凸体碰撞，以及包内 `materials/` 的贴图。转换器为 `tools/import_cf_prison.py`，输出 `prison/map.json`、`map.bin`、`lightmap.png` 和 PNG 贴图。
- 该移植包依赖的少数 CS:S 基础材质并未随包提供；`fallback_*.png` 是本项目生成的中性色替代纹理。天空使用本项目程序生成的冷灰色云层。原地图比例按 Source 英寸换算到场景米，并将长轴对齐游戏的 Z 轴；出生点和碰撞同步转换。
- 游戏加载时将 X/Z 水平方向放大 2 倍、Y 垂直方向放大 1.3 倍（`scripts/prison_scale.js`）；人物高度和重力不变。碰撞平面系数、雷达轮廓、出生点及地图边界同步变换，避免画面与可通行空间错位。`scripts/prison_uv.js` 按各轴实际伸展程度重算漫反射贴图坐标，避免砖块和地砖随非等比缩放变形；烘焙光照坐标不变。
- 这是一份社区移植素材，不属于本项目原创或 CC0。来源页的移植或下载许可不等于原游戏权利人授予本项目再分发、商用或公开部署许可。

## 雪地求生（用户提供 GoldSrc `de_survivor` 包）

- 原始文件由用户放入本地 `cstrike/` 目录，包含 `de_survivor_new.bsp` / `de_survivor_night.bsp`、双方 NAV、地图说明、`zeditor.wad`、两套天空盒、34 个 GoldSrc v10 场景模型、环境音和部分精灵。地图说明标注作者为 Michael Visser（3D_Mike），并注明为 Condition Zero 制作、由 Rotary_chicken 提供协助。
- 正式游戏使用白天版 `de_survivor_new.bsp`。`tools/import_goldsrc_survivor.py` 直接读取 BSP v30 世界与静态子模型，转换 10 个 CT 与 10 个 T 出生点、内嵌调色板纹理、RGB 烘焙光照、凸体碰撞、天空盒及 230 个树木/山体/围栏等 MDL 实例；原 `func_bomb_target` 不进入团队竞技规则。
- 源包实体引用了未随包提供的 `snow.spr`、`flare1.spr`、`3dmflared.spr` 和 `3dmflaora.spr`。游戏没有伪造这些原文件，而是用程序化雪花点和加色光晕实现等价天气/亮点效果。GoldSrc 的轨道车辆、可破坏物脚本、镜头触发器与爆破流程没有移植为互动逻辑；其静态可见场景仍随 BSP 几何导入。
- 原始包没有附带可核验的再分发或商业授权说明。转换产物仅按用户要求用于本地项目，不据此推定公开发布或商用权。

## 黑色城镇（用户提供 GoldSrc `de_blackwidow` 包）

- 原始文件由用户放入本地 `黑色城镇/` 目录，包含 GoldSrc BSP v30、NAV、地图/overview 说明、overview 位图和 `btown` 六面 TGA 天空盒；BSP 内嵌 84 张调色板贴图与 RGB 烘焙光照，不依赖外置 WAD 或场景模型。
- `tools/import_goldsrc_survivor.py 黑色城镇 blacktown` 读取原 BSP 世界与静态 brush 子模型，转换双方各 16 个出生点、29,874 个三角面、1,541 个凸体碰撞单元、雷达轮廓、原天空盒和光照。为匹配本项目人物胶囊，黑色城镇画面、碰撞、出生点与雷达三轴统一使用标准英寸换算的 1.2 倍；原 `func_bomb_target`、地图镜头与爆破流程不进入团队竞技规则。
- 原始包没有附带可核验的作者署名、再分发或商业授权说明。转换产物仅按用户要求用于本地项目，不据此推定公开发布或商用权。

## SWAT

- 当前敌人外观改用用户提供的 `models/swat_bl.glb`（来源与许可见 `models/CREDITS.md`），生成的蒙皮权重为 `swat/swat_bl_weights.bin`。以下旧 SWAT 资源继续提供 50 根动画骨骼和权重参照；动作仍由本项目 IK 驱动。

- 来源：[Crossfire Character (Swat Reborn)](https://gamebanana.com/mods/213666)，`cf_swat_reborn.zip`，文件编号 `216863`，采用 `Without phong.zip`。
- 原始模型/贴图：Smilegate；重制、重建模、截图：Living4Things。
- 来源页标注 CC BY-NC-ND 4.0，同时把修改后分发/在其他模组中分发列为需询问。此记录不把社区许可扩大解释为对原游戏素材的商业授权。
- 本地转换：MDL v44 + VVD/VTX LOD0，50 根骨骼、3724 个三角面；原漫反射贴图及 VMT 指向的五张法线贴图转 PNG。骨骼动作由本项目 IK 系统驱动，**不是原 CF 动作数据**。按蒙皮头骨权重拆分头部命中面。
- 产物：`swat/swat.bin`、`swat.json` 与 PNG 贴图。

## AK-47

- 来源：[CrossFire AK-47](https://gamebanana.com/mods/592174)，`cf_ak47.7z`，文件编号 `1432478`。
- 原模型/贴图/动画/音效：Smilegate；修正/编译：kupidzhy；世界/第三人称模型移植：Kili Skiner。包内其他可选音效的作者还有 Valve 与 FunnkyHD，本次未使用可选音效。
- 来源页标注 CC BY-NC-ND 4.0。
- 本地使用包内 `extra stuff/compile/w_/AK47.smd`、`AK47.bmp`，转换成 798 三角面的静态 GLB。该模型用于敌人、掉落物以及第一人称视模加载失败时的回退。
- 第一人称另导入同包 `extra stuff/compile/v_/PV-AK47.smd`、`PV-AK47_GR.smd`、`FVIEW_ARM_GR.bmp`、`FVIEW_HAND_GR.bmp`、`PV-AK47.bmp` 和 `idle_0/reload/fire/select.smd`；保留 51 骨骼与对应纹理。动作按来源 `sequences.qc` 时间采样，换弹映射到本游戏周期；这不是对原客户端逐帧完全一致的保证。
- 切枪现在实际采样已导入的完整 `select` 片段；其 `Bone05` 枪机骨骼在约 `.274～.429s` 后移并复位，不再用程序化整枪抬起代替。切枪拉栓声使用下述原始 `G_RELOAD_AK47.WAV`；该文件与用户提供的 Festa CFS 2019 `SND/AK47/AK47_RELOAD.wav` SHA-256 相同，按 Festa MDL 的 select 第 77 帧（`.205333s`）事件播放。
- 原声音复制到 `audio/classic/`：`ak47-1.wav` → `ak47_fire.wav`、`G_MZC_AK47_CLIPOUT.WAV` → `ak47_out.wav`、`G_MZC_AK47_CLIPIN.WAV` → `ak47_in.wav`、`G_RELOAD_AK47.WAV` → `ak47_bolt.wav`。不变调。

## M4A1-C

- 来源：[CF M4A1-C Weapon Pack](https://gamebanana.com/mods/211325)，文件 `cf_m4a1_custom_pack_update.rar`，GameBanana 文件编号 `217470`；下载包 MD5 为 `605821e3b397c3a4d7731642f7fc9791`。
- 页面将原始模型、贴图、动画、声音归于 SmileGate；该更新包还标注修改过声音，故本地音效准确称为“该移植包提供的声音”，不声称逐字节等同某一版 CF 官方客户端。页面的移植白名单说明不等于公开再分发或商业授权。
- `m4c/m4a1_custom.glb` 继续使用 `Required/models/weapons/w_rif_sg552.{mdl,vvd,dx90.vtx}` 的 LOD0 枪身，用于大厅、掉落物和第三人称。第一人称则从 `v_rif_sg552.{mdl,vvd,dx90.vtx}` 完整导入 81 根骨骼、枪身/弹匣/枪机、双手网格以及 idle/reload/draw/shoot1–3 六段 Source 动作，资源位于 `m4c_view/`。包内只引用但未附带 CSS 原版 `v_hands` 贴图，因此复用项目中已由其他 CSS 视模导入的同款 `v_hands.png`。
- 默认 M4 皮肤显示为 `M4A1-C`；敌人、掉落物与大厅使用世界模型，玩家战场视角使用完整动作视模。转换脚本：`tools/import_cf_m4c.py` 和 `tools/import_cf_m4c_view.py`。
- 原样复制四段 WAV：`sg552/sg552-1.WAV` → `audio/classic/m4c_fire.wav`；`m4a1/m4a1_clipout.WAV`、`m4a1_clipin.WAV`、`m4a1_boltpull.WAV` 分别 → `m4c_out.wav`、`m4c_in.wav`、`m4c_bolt.wav`。玩家和敌人的 M4 开火共用同一采样；不变调、不另叠合成爆音。
- 换弹三声按源 MDL 事件帧 `10/38/69` 对齐；切枪在 draw 片段 `1/3s` 播放原拉枪机声。该更新包的 `weapon_sg552.txt` 将 `MuzzleFlashScale` 设为 `0`，因此 M4A1-C 不叠加项目通用枪口焰。

## 铁兽-帝皇金 M4A1-S

- 模型与贴图由用户随本地素材目录提供：`models/v_ak47.mdl`（GoldSrc v10，内嵌 Iron Beast Imperial Gold 贴图）。没有附带可核验的授权说明；仅在本地项目中按用户请求转换使用，不据此推定公开再分发或商业使用权。
- `tools/import_ironbeast_m4.py` 提取枪身及帝皇金贴图，转为 `assets/classic/m4_ironbeast/ironbeast.glb`。源手臂、动画和特效未导入；游戏复用现有 M4 手臂、射击、换弹和音效逻辑。

## 沙漠之鹰

- 来源：[CF Desert Eagle Pack](https://gamebanana.com/mods/207544)，下载文件 `cf_deagle_pack.rar`，GameBanana 文件编号 `217132`；下载包 MD5 `e065ff1c10834ac9039c2ad48caa876e`。
- `tools/import_cf_deagle.py` 从 `Required/models/weapons/w_pist_deagle.{mdl,vvd,dx90.vtx}` 导入枪体世界模型，并使用 `Choose Texture/Original/` 的原版配色 VTF，转换为 `deagle/desert_eagle.glb`（674 三角面）。这份模型继续用于世界中的敌人持枪与掉落物；第一人称动画另见下节。
- 4 号背包配备沙漠之鹰，其余三个背包保留 USP。四段 WAV 来源和映射见 `audio/CREDITS.txt`。
- 包内模型、贴图及声音是社区移植的商业游戏素材，不属于 CC0；本站的移植说明不能替代原权利人的再分发或商用授权。

## 转换与边界

- `tools/import_cf_source.py`：可重复转换地图/SWAT（Python + numpy + Pillow）。
- `tools/import_cf_ak.py`：可重复转换 AK SMD/贴图并复制音效。
- `tools/import_cf_m4c.py`：可重复转换 M4A1-C Source MDL/VVD/VTX 和 VTF，并复制四段 WAV。
- `tools/import_cf_m4c_view.py`：可重复提取 M4A1-C Source v44 的完整第一人称骨骼、蒙皮、六段动作与动作事件。
- `tools/import_ironbeast_smd.py`：从用户提供的 Iron Beast SMD/QC 转换第一人称完整视模、Specular/VFX 层与原始动作（Python 标准库）。
- `tools/import_ironbeast_m4.py`：从用户提供的 GoldSrc v10 MDL 转换铁兽-帝皇金静态枪模和内嵌贴图（Python 标准库）。
- `tools/import_cf_prison.py`：可重复转换守望之城源 BSP/VTF，并生成缺失基础材质的替代贴图。
- `tools/import_goldsrc_survivor.py`：从用户提供的 GoldSrc BSP v30、可选 MDL v10 与 TGA 天空盒重复生成雪地求生或黑色城镇地图资产；仅依赖 Python 标准库与 numpy。
- `tools/import_cf_deagle.py`：可重复转换沙漠之鹰 Source 模型/VTF，并复制四段 WAV。
- `tools/import_cf_view.py`：转换 AK 第一人称手臂、枪械与动画。
- 格式依据：[Valve Source SDK](https://github.com/ValveSoftware/source-sdk-2013/tree/master/src/public) 的 `bspfile.h`、`studio.h`、`optimize.h`。
- `manifest.json` 保存下载包及转换结果的 SHA-256，以区分实际使用的版本。
- 经典英文连杀男声来源另外记录于 `audio/CREDITS.txt`。
- AWM 仍为既有模型的经典配色，击杀军徽仍为自绘；枪感、AI、HUD、人物动作仍是本项目实现。不能称为完整 1:1 原版客户端。

## 小刀行为参考与标定

- [Crossfire Wiki — Knife](https://crossfirefps.fandom.com/wiki/Knife)：横划后接前刺、翻腕下刺的行为描述；属于社区资料。
- [Ult’s Melee Range Guide](https://forum.z8games.com/discussion/308868/ult-039-s-melee-range-guide)：2015 年玩家实测把基础小刀轻/重击归于同一距离档位；没有提供可直接移植的米数。
- 因此本项目把轻/重刀有效长度统一标定为 1.5m；时长、伤害、扫掠角度由本项目实现，未声称取自官方客户端参数。当前第一人称刀模型与动作来源见下节。

## 第一人称手枪与军刀动作（2026-10-13）

- 动作源：[Unity_CrossFire_base](https://github.com/Lem-c/Unity_CrossFire_base) 的 `All_Weapon_Prefab/knife.fbx` 与 `DesertEagle/Plain_DE/DesertEagle.fbx`。该项目说明这些模型是从 CF 素材移植到 Unity；仓库未提供可核验的公开再分发许可，不能据此推定商业使用或公开发布权。
- 使用 [Godot 维护的 FBX2glTF v0.13.1](https://github.com/godotengine/FBX2glTF/releases/tag/v0.13.1) 转成 `motions/knife_view.glb`、`motions/deagle_view.glb`。刀贴图从 `PV-KNIFE.bmp` 转为 `motions/knife.png`，刀手套/袖子复用本项目已导入的 AK 经典贴图；沙鹰原 BMP 改为 PNG 嵌入 GLB，避免浏览器无法识别 BMP MIME。
- 军刀保留源骨骼的待机、拔刀、两段连击和重击；轻/重击的伤害、有效范围与命中窗口仍由 `scripts/melee.js` 决定。沙鹰保留拔枪、待机、行走、三种开火、换弹骨骼片段，按本游戏射速/换弹时长重定时；第一人称枪身、套筒与弹匣由该视模驱动，世界模型不替换。
- 源沙鹰视模的前臂在画面中间露出截面，因此只显示其动画枪身，用本项目统一的经典手套/袖子代替源手臂；右手跟随源腕骨、换弹时左手也跟随源腕骨，枪口火光跟随枪身骨骼。军刀源袖管同样在画面中间截断，保留原骨骼手套和军刀，袖管改由经典手臂延伸到画面外并跟随双腕。USP 仍使用现有模型与动作；这次导入的是沙鹰和军刀的动作资源，并不声称已经为 USP 找到兼容骨骼片段。

## Festa CFS 2019 沙漠之鹰第一人称视模（2026-10-17，覆盖上一节沙鹰视模）

- 模型由用户随本地目录 `Festa CFS 2019 WS/models/v_deagle.mdl` 提供，SHA-256 `b007dbaa0b8ae9dc67a9480c8f8d102cf5f7d367218147b720ebc8ee537af1d2`。目录没有附带可核验的授权说明；仅按用户要求用于本地转换，不据此推定公开再分发或商用权。
- GoldSrc v10 MDL 含 49 根骨骼、完整手/指/手臂和 Festa CFS 2019 沙鹰枪身，保留 `idle_0 / fire / prefire / postfire / reload / select` 六段完整动作。`tools/import_ironbeast_view.py` 以 `forward-axis=x` 重复转换到 `assets/classic/deagle_festa/`：该模型在动画待机姿势下枪管沿源 `+X`，导入时映射到游戏相机 `-Z`，不能套步枪的源 `+Y` 轴。
- 第一人称画面现在显示这套完整源骨骼，不再使用上一节 `motions/deagle_view.glb` 与程序化经典袖管；旧 GLB 仅保留为加载失败回退。世界中的敌人持枪、掉落物及大厅静态模型继续使用 `deagle/desert_eagle.glb`，因为用户提供的是 `v_` 第一人称模型而非 `w_` 世界模型。
- MDL 的换弹/拔枪事件引用 `DesertEagleSilence_*.WAV`；这些文件位于用户目录的 `sound/SND/Desert Eagle-Silence/`。现将 `Select / BlowBack / ClipOut / ClipIn / DelBlowBack` 五段 WAV 原样接入，并严格按 MDL 的 5004 事件时刻播放；两份开火 WAV 同样原样接入，详情见 `audio/CREDITS.txt`。

## 经典手雷 / 闪光弹 / 烟雾弹

- 来源：[Crossfire Classic Grenades](https://gamebanana.com/mods/557024)，作者 HLXX50（移植）；原模型、贴图、音效：Smilegate。来源页标注 CC BY-NC-ND 4.0。本次仅用于本地适配，未发布。
- 下载：`pv-hegrenade.rar`（1325982）、`pv-flashbang.rar`（1325981）、`classicgrenades.rar`（1325980）。
- 导入原 SMD 的雷体、GR 手臂和 50 骨骼 idle/prefire/fire/reload 动作；保留 QC 的 30fps。手臂和雷体参考姿态分别校正到同一骨架，所有投掷物统一使用 AK 的手套/袖子 PNG。双臂延伸到画面外，避免截面可见。
- 烟雾使用来源声明共用于 flash/smoke 的 SMD 形体和动作；从 `Smokegrenade/Variants/Smokegrenade/models/v_smokegrenade.mdl` 提取默认烟雾贴图，替代闪光弹贴图。
- `tools/import_cf_grenades.py` 转换手雷/闪光源文件；`tools/import_cf_grenade_pack.py` 生成烟雾版本并复制四段原声音：拉环、手雷爆炸、闪光爆响、烟雾释放。输出 `assets/classic/grenades/` 与 `audio/classic/grenade_*.wav`。
- [CF 玩家投掷教学](https://cf.17173.com/content/04142025/174902046.shtml) 参考松开左键与移动/跳跃投掷；[经典闪光实战说明](https://games.sina.com.cn/o/z/cf/2014-07-17/1025557260.shtml) 参考背闪减时与实体遮挡。不是用于提取精确参数的官方技术文档。
- 模型与部分骨骼动作来自上述移植；速度、碰撞、伤害、引信、烟雾/闪光时长以及输入与动画衔接由本项目标定，并不保证与 CF 原客户端数值完全一致。

## Festa CFS 2019 凤凰斧（2026-10-17）

- 模型、内嵌贴图、双手骨骼及动作由用户提供的 `Festa CFS 2019 WS/models/v_knife.mdl`（GoldSrc v10）转换；源包未附可核验的授权说明，仅在本地项目中按用户要求使用，不推定公开再分发或商业使用权。
- `tools/import_ironbeast_view.py` 从 MDL 提取 47 根骨骼、手/斧网格、四张内嵌调色板贴图以及 `idle_0/select/combo_1/combo_2/bigshot` 等原动作，输出到 `axe_festa/view.json`、`view.bin` 和 PNG。
- `tools/import_ironbeast_m4.py` 从同一视模派生只含斧头的 `axe_festa/axe.glb`，仅用于大厅预览及动作视模失败时的静态回退。命中距离、伤害和扫掠判定仍由 `scripts/melee.js` 决定。

## 屠龙 Kukri（2026-10-18）

- 模型、VTF/VMT、双手骨骼、动作与音效由用户放入本地 `尼伯尔/` 目录；素材包未附带可核验的授权说明，仅按用户要求用于本地项目，不据此推定公开再分发或商业使用权。
- `tools/import_source_kukri.py` 从 Source v44 `v_knife_t.mdl/.vvd/.dx90.vtx` 导入 45 根骨骼、枪刃与双手六个材质部件，并完整保留 `idle/draw/stab/stab_miss/midslash1/midslash2` 六段动作。`w4` 与 `0` 按源 VMT 保留为独立 additive/self-illum 光效层；刀身保留 `KUKRI_BEAST_N_S` 反射遮罩，手臂保留法线和 AO 贴图。
- 同一脚本从 `w_knife_t` 生成 `kukri_dragon/world.glb` 用于背包预览和世界回退，并把九段 WAV 原样复制到 `audio/classic/kukri_dragon/`。源 MDL 没有动画事件，因此声音按文件名所表达的源动作语义接入，不臆造不存在的帧事件。

## NPC 步态参考（2026-10-16）

- [Quaternius Universal Animation Library 1 Standard](https://quaternius.com/packs/universalanimationlibrary.html)，作者 Quaternius，下载包 `License.txt` 标注 CC0 1.0。使用免费包中的 `Jog_Fwd_Loop`，由 `tools/extract_npc_gait.py` 在 32 个等距时刻提取左脚相对于骨盆的前后位移与抬脚高度，并归一化为 `scripts/npc_gait.js`。
- 游戏仍使用原 SWAT 模型、持枪 IK 和地形脚部 IK；新数据只决定步态的接地／摆腿节奏，根位移仍由碰撞与寻路控制。免费 Standard 包没有步枪专用动作或完整八方向片段，因此没有把手枪动画硬套到步枪上；换弹与转身的双臂／髋部动作由本项目补充。
