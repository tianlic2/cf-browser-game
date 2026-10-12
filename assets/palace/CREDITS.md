# 王宫回廊地图素材

- 城堡拱门与侧门：Kenney, **Castle Kit**, CC0 1.0。
  原始发布页：https://kenney.nl/assets/castle-kit
  本地图使用了 `tower-square-arch.glb` 与 `gate.glb`，只作为立面装饰。
- 大理石地面颜色、OpenGL 法线和粗糙度贴图：Rob Tuytel / Poly Haven,
  **Floor Tiles 04**, CC0 1.0。
  原始发布页：https://polyhaven.com/a/floor_tiles_04
  使用 1K JPG 版本。
- 镀金油画画框：Rico Cilliers（建模）、Rob Tuytel（扫描与绘画）/ Poly Haven,
  **Fancy Picture Frame 01**, CC0 1.0。
  原始发布页：https://polyhaven.com/a/fancy_picture_frame_01
  使用 1K glTF 及其所需纹理。
- 黄铜水晶吊灯：Kirill Sannikov / Poly Haven,
  **Chandelier 03**, CC0 1.0。
  原始发布页：https://polyhaven.com/a/Chandelier_03
  使用 1K glTF 及其所需纹理，场景中复用一份模型资源。
- 墙体、走廊、楼梯、王座、栏杆、立柱及碰撞布局由本项目在
  `scripts/palace_map.js` 中建造。石灰岩、立柱大理石、胡桃木、天鹅绒的
  颜色、法线与粗糙度贴图由 `scripts/palace_textures.js` 程序化生成，
  不依赖外部图片素材。拱券、雕刻喷泉、王座靠背、旗帜、壁灯和天花藻井也由代码生成。

未使用 Sketchfab 上的候选宫殿模型：其下载接口要求账户授权；也未使用
Sponza，其官方 glTF 包标注 Cryengine Limited License Agreement。
