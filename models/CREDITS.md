# 新增模型来源

- `swat_bl.glb`：用户于 2026-10-11 提供的原始文件，原样复制。GLB 内嵌元数据记载作品 [Swat BL](https://sketchfab.com/3d-models/swat-bl-a52f9d4c9cbd4443b50a4c46cb652d14)、作者 marcosacevez57、许可证 CC BY 4.0；本项目未独立核验页面条款或原素材的上游权利。文件本身没有骨骼或动画；`tools/rig_swat_bl.py` 依据现有 SWAT 网格的蒙皮数据生成 `assets/classic/swat/swat_bl_weights.bin`，游戏仍由现有程序化骨架驱动行走、持枪和倒地。

- `m9_knife.glb`：基于 khairul169 的 [M9 Knife PBR](https://opengameart.org/content/m9-knife-pbr)，页面标注 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。从原包的 `m9_knife.obj` 与 Handle/Knife 漫反射贴图转换为 GLB；贴图缩至 1024px，并调整为游戏内的金属与粗糙度材质。原始 ZIP 未放入仓库。
- 旧的 `knife.glb` 保留为原有文件，当前游戏不再加载它。

- `barrett_m82.glb`：Gintoki1234 的 [Barrett M82](https://gintoki1234.itch.io/barrett-m82)，作者在发布页声明 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，允许修改及用于商业游戏，需署名。由下载包 `Barrett-M82.zip` 的 FBX 转为 GLB；将骨架当前姿势烘成静态网格，五张基础色贴图从 4096px 缩至 1024px，枪身材质调为深灰色，独立展示用的三枚子弹从游戏模型中移除。原始 ZIP 未放入仓库。模型作者：Gintoki1234；转换与优化：本项目。
