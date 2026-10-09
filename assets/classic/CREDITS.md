# 经典 CF 素材来源

本目录用于用户要求的本地浏览器复刻。以下是商业游戏素材的社区移植，并非本项目原创，也不属于 CC0。没有在本次修改中发布、上传或申请任何新的授权。公开发布或商业使用前应按来源页面的条件另行取得许可；来源网站的“允许移植”说明不等于获得原权利人的完整授权。

## 运输船

- 来源：[CF Transport Ship](https://gamebanana.com/mods/111054)，下载文件 `cf_transport_ship_2.rar`，GameBanana 文件编号 `288721`。
- 原始地图/贴图：SmileGate；转换、道具、贴图、NAV：Riding crab snails；编译/截图/提交：ElysiumLeoSK。
- 来源页允许下载安装；重新分发、修改后分发和在其他模组中分发列为需询问；商业使用列为不允许。
- 本地转换：BSP v20 世界几何、材质、RGBExp32 烘焙光照、天空盒、凸体碰撞平面和双方出生点。排除 `func_buyzone` 的不可见编辑器体积。小道具的外部 MDL 未单独导入；玻璃动态子模型未实现；海面复用本项目的水材质。
- 本地场景按用户要求沿 X 轴左右镜像，几何、碰撞、出生点和雷达同步变换；补回原 BSP 中被旧过滤器遗漏的 156 个地下凸体，保留楼梯、地道和出口木箱。
- 产物：`transport/map.bin`、`map.json`、`lightmap.png` 和对应 PNG 贴图。

## SWAT

- 来源：[Crossfire Character (Swat Reborn)](https://gamebanana.com/mods/213666)，`cf_swat_reborn.zip`，文件编号 `216863`，采用 `Without phong.zip`。
- 原始模型/贴图：Smilegate；重制、重建模、截图：Living4Things。
- 来源页标注 CC BY-NC-ND 4.0，同时把修改后分发/在其他模组中分发列为需询问。此记录不把社区许可扩大解释为对原游戏素材的商业授权。
- 本地转换：MDL v44 + VVD/VTX LOD0，50 根骨骼、3724 个三角面；原贴图转 PNG。骨骼动作由本项目 IK 系统驱动，**不是原 CF 动作数据**。按蒙皮头骨权重拆分头部命中面。
- 产物：`swat/swat.bin`、`swat.json` 与 PNG 贴图。

## AK-47

- 来源：[CrossFire AK-47](https://gamebanana.com/mods/592174)，`cf_ak47.7z`，文件编号 `1432478`。
- 原模型/贴图/动画/音效：Smilegate；修正/编译：kupidzhy；世界/第三人称模型移植：Kili Skiner。包内其他可选音效的作者还有 Valve 与 FunnkyHD，本次未使用可选音效。
- 来源页标注 CC BY-NC-ND 4.0。
- 本地使用包内 `extra stuff/compile/w_/AK47.smd`、`AK47.bmp`，转换成 798 三角面的静态 GLB。该模型用于敌人、掉落物以及第一人称视模加载失败时的回退。
- 第一人称另导入同包 `extra stuff/compile/v_/PV-AK47.smd`、`PV-AK47_GR.smd`、`FVIEW_ARM_GR.bmp`、`FVIEW_HAND_GR.bmp`、`PV-AK47.bmp` 和 `idle_0/reload/fire/select.smd`；保留 51 骨骼与对应纹理。动作按来源 `sequences.qc` 时间采样，换弹映射到本游戏周期；这不是对原客户端逐帧完全一致的保证。
- 原声音复制到 `audio/classic/`：`ak47-1.wav` → `ak47_fire.wav`、`G_MZC_AK47_CLIPOUT.WAV` → `ak47_out.wav`、`G_MZC_AK47_CLIPIN.WAV` → `ak47_in.wav`、`G_RELOAD_AK47.WAV` → `ak47_bolt.wav`。不变调。

## 转换与边界

- `tools/import_cf_source.py`：可重复转换地图/SWAT（Python + numpy + Pillow）。
- `tools/import_cf_ak.py`：可重复转换 AK SMD/贴图并复制音效。
- `tools/import_cf_view.py`：转换 AK 第一人称手臂、枪械与动画。
- 格式依据：[Valve Source SDK](https://github.com/ValveSoftware/source-sdk-2013/tree/master/src/public) 的 `bspfile.h`、`studio.h`、`optimize.h`。
- `manifest.json` 保存下载包及转换结果的 SHA-256，以区分实际使用的版本。
- 经典英文连杀男声来源另外记录于 `audio/CREDITS.txt`。
- M4/AWM 仍为既有模型的经典配色，击杀军徽仍为自绘；枪感、AI、HUD、人物动作仍是本项目实现。不能称为完整 1:1 原版客户端。

## 小刀行为参考与标定

- [Crossfire Wiki — Knife](https://crossfirefps.fandom.com/wiki/Knife)：横划后接前刺、翻腕下刺的行为描述；属于社区资料。
- [Ult’s Melee Range Guide](https://forum.z8games.com/discussion/308868/ult-039-s-melee-range-guide)：2015 年玩家实测把基础小刀轻/重击归于同一距离档位；没有提供可直接移植的米数。
- 因此本项目把轻/重刀有效长度统一标定为 1.4m；时长、伤害、扫掠角度和动作曲线均明确为近似实现，未声称取自官方客户端参数。当前刀模型与动作没有导入新的第三方素材。

## 经典手雷 / 闪光弹 / 烟雾弹

- 来源：[Crossfire Classic Grenades](https://gamebanana.com/mods/557024)，作者 HLXX50（移植）；原模型、贴图、音效：Smilegate。来源页标注 CC BY-NC-ND 4.0。本次仅用于本地适配，未发布。
- 下载：`pv-hegrenade.rar`（1325982）、`pv-flashbang.rar`（1325981）、`classicgrenades.rar`（1325980）。
- 导入原 SMD 的雷体、GR 手臂和 50 骨骼 idle/prefire/fire/reload 动作；保留 QC 的 30fps。手臂和雷体参考姿态分别校正到同一骨架，所有投掷物统一使用 AK 的手套/袖子 PNG。双臂延伸到画面外，避免截面可见。
- 烟雾使用来源声明共用于 flash/smoke 的 SMD 形体和动作；从 `Smokegrenade/Variants/Smokegrenade/models/v_smokegrenade.mdl` 提取默认烟雾贴图，替代闪光弹贴图。
- `tools/import_cf_grenades.py` 转换手雷/闪光源文件；`tools/import_cf_grenade_pack.py` 生成烟雾版本并复制四段原声音：拉环、手雷爆炸、闪光爆响、烟雾释放。输出 `assets/classic/grenades/` 与 `audio/classic/grenade_*.wav`。
- [CF 玩家投掷教学](https://cf.17173.com/content/04142025/174902046.shtml) 参考松开左键与移动/跳跃投掷；[经典闪光实战说明](https://games.sina.com.cn/o/z/cf/2014-07-17/1025557260.shtml) 参考背闪减时与实体遮挡。不是用于提取精确参数的官方技术文档。
- 模型与部分骨骼动作来自上述移植；速度、碰撞、伤害、引信、烟雾/闪光时长以及输入与动画衔接由本项目标定，并不保证与 CF 原客户端数值完全一致。
