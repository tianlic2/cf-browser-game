# 经典 CF 素材来源

本目录记录浏览器游戏中使用的经典 CF 社区移植素材。它们并非本项目原创，也不属于 CC0；来源页面的“允许移植”说明不等于获得原权利人的完整再分发或商业授权。公开部署或商业使用时应逐项核对授权条件。

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
- 原声音复制到 `audio/classic/`：`ak47-1.wav` → `ak47_fire.wav`、`G_MZC_AK47_CLIPOUT.WAV` → `ak47_out.wav`、`G_MZC_AK47_CLIPIN.WAV` → `ak47_in.wav`、`G_RELOAD_AK47.WAV` → `ak47_bolt.wav`。不变调。

## M4A1-C

- 来源：[CF M4A1-C Weapon Pack](https://gamebanana.com/mods/211325)，文件 `cf_m4a1_custom_pack_update.rar`，GameBanana 文件编号 `217470`；下载包 MD5 为 `605821e3b397c3a4d7731642f7fc9791`。
- 页面将原始模型、贴图、动画、声音归于 SmileGate；该更新包还标注修改过声音，故本地音效准确称为“该移植包提供的声音”，不声称逐字节等同某一版 CF 官方客户端。页面的移植白名单说明不等于公开再分发或商业授权。
- 使用包内 `Black (Original)` 两张 VTF，及 `Required/models/weapons/w_rif_sg552.{mdl,vvd,dx90.vtx}` 的 LOD0 枪身，转换为 `m4c/m4a1_custom.glb`。世界模型与第一人称模型的枪身顶点数相同；取世界模型可避开包内独立的手部网格，继续复用本项目的统一手臂。未导入 Source 动画；开火/换弹动作仍由本项目驱动。
- 默认 M4 皮肤显示为 `M4A1-C`，玩家、敌人和掉落物共用这把模型。转换脚本：`tools/import_cf_m4c.py`。
- 原样复制四段 WAV：`sg552/sg552-1.WAV` → `audio/classic/m4c_fire.wav`；`m4a1/m4a1_clipout.WAV`、`m4a1_clipin.WAV`、`m4a1_boltpull.WAV` 分别 → `m4c_out.wav`、`m4c_in.wav`、`m4c_bolt.wav`。玩家和敌人的 M4 开火共用同一采样；不变调、不另叠合成爆音。

## 沙漠之鹰

- 来源：[CF Desert Eagle Pack](https://gamebanana.com/mods/207544)，下载文件 `cf_deagle_pack.rar`，GameBanana 文件编号 `217132`；下载包 MD5 `e065ff1c10834ac9039c2ad48caa876e`。
- `tools/import_cf_deagle.py` 从 `Required/models/weapons/w_pist_deagle.{mdl,vvd,dx90.vtx}` 导入枪体世界模型，并使用 `Choose Texture/Original/` 的原版配色 VTF，转换为 `deagle/desert_eagle.glb`（674 三角面）。这份模型继续用于世界中的敌人持枪与掉落物；第一人称动画另见下节。
- 4 号背包配备沙漠之鹰，其余三个背包保留 USP。四段 WAV 来源和映射见 `audio/CREDITS.txt`。
- 包内模型、贴图及声音是社区移植的商业游戏素材，不属于 CC0；本站的移植说明不能替代原权利人的再分发或商用授权。

## 转换与边界

- `tools/import_cf_source.py`：可重复转换地图/SWAT（Python + numpy + Pillow）。
- `tools/import_cf_ak.py`：可重复转换 AK SMD/贴图并复制音效。
- `tools/import_cf_m4c.py`：可重复转换 M4A1-C Source MDL/VVD/VTX 和 VTF，并复制四段 WAV。
- `tools/import_cf_prison.py`：可重复转换守望之城源 BSP/VTF，并生成缺失基础材质的替代贴图。
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

## 经典手雷 / 闪光弹 / 烟雾弹

- 来源：[Crossfire Classic Grenades](https://gamebanana.com/mods/557024)，作者 HLXX50（移植）；原模型、贴图、音效：Smilegate。来源页标注 CC BY-NC-ND 4.0。本次仅用于本地适配，未发布。
- 下载：`pv-hegrenade.rar`（1325982）、`pv-flashbang.rar`（1325981）、`classicgrenades.rar`（1325980）。
- 导入原 SMD 的雷体、GR 手臂和 50 骨骼 idle/prefire/fire/reload 动作；保留 QC 的 30fps。手臂和雷体参考姿态分别校正到同一骨架，所有投掷物统一使用 AK 的手套/袖子 PNG。双臂延伸到画面外，避免截面可见。
- 烟雾使用来源声明共用于 flash/smoke 的 SMD 形体和动作；从 `Smokegrenade/Variants/Smokegrenade/models/v_smokegrenade.mdl` 提取默认烟雾贴图，替代闪光弹贴图。
- `tools/import_cf_grenades.py` 转换手雷/闪光源文件；`tools/import_cf_grenade_pack.py` 生成烟雾版本并复制四段原声音：拉环、手雷爆炸、闪光爆响、烟雾释放。输出 `assets/classic/grenades/` 与 `audio/classic/grenade_*.wav`。
- [CF 玩家投掷教学](https://cf.17173.com/content/04142025/174902046.shtml) 参考松开左键与移动/跳跃投掷；[经典闪光实战说明](https://games.sina.com.cn/o/z/cf/2014-07-17/1025557260.shtml) 参考背闪减时与实体遮挡。不是用于提取精确参数的官方技术文档。
- 模型与部分骨骼动作来自上述移植；速度、碰撞、伤害、引信、烟雾/闪光时长以及输入与动画衔接由本项目标定，并不保证与 CF 原客户端数值完全一致。
