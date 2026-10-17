# 生化模式资源来源

- 生化幽灵模型、纹理与动作：Rikindle3D，[Male City Zombie](https://opengameart.org/content/male-city-zombie-ready-for-use-in-game-engines)，CC0。源 FBX 转为 GLB，分别保留待机、奔跑、攻击、受击、死亡、嘶吼动作；纹理沿用原始 PNG。
- 生化禁区地图：本项目原创程序化几何与碰撞；墙面复用项目已收录的守望之城回退混凝土贴图。下列独立模型提供场景细节，并按本项目的米制尺度重新放置：
  - 工厂外墙模块：James Ray Cock，[Modular Factory Facade](https://polyhaven.com/a/modular_factory_facade)，[CC0](https://polyhaven.com/license)。使用官方 1K glTF 与随附贴图的墙体及窗户模块，存放于 `assets/bio/props/factory_facade/`；两栋可穿行厂房按模块重新组合，实际入口与碰撞缺口一致。
  - 混凝土防守路障：Amal Kumar，[Concrete Road Barrier 02](https://polyhaven.com/a/concrete_road_barrier_02)，[CC0](https://polyhaven.com/license)。使用官方 1K glTF、网格及 PBR 贴图，存放于 `assets/bio/props/concrete_road_barrier_02/`；按模型朝向放置在防守平台并同步生成碰撞体。
  - 破损沥青地面：Rob Tuytel，[Asphalt 02](https://polyhaven.com/a/asphalt_02)，[CC0](https://polyhaven.com/license)。使用 1K 漫反射及 OpenGL 法线贴图，存放于 `assets/bio/textures/`，平铺于生化战场地面。
  - 中央桥式起重机：Timothy3D，[Overhead Crane](https://polyhaven.com/a/overhead_crane)，[CC0](https://polyhaven.com/license)。使用官方 1K glTF、网格及 PBR 贴图，存放于 `assets/bio/props/overhead_crane/`；抬高至可通行高度，桥墩采用独立近似碰撞体。
  - 工业油桶：Jorge Camacho，[Barrel 02](https://polyhaven.com/a/Barrel_02)，[CC0](https://polyhaven.com/license)。从 Poly Haven 官方下载 1K glTF、二进制网格及漫反射／法线／ARM 贴图，存放于 `assets/bio/props/barrel_02/`；用独立碰撞代理放置为掩体。
  - 中央配电箱：YannickGodeau，[Electric Box](https://sketchfab.com/3d-models/electric-box-c7bba1e774d94e67b410e4c9fdfdee34)，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。
  - 生锈废弃汽车：Rashad Ibrahimli，[Crashed Abandoned Car - Game Ready](https://sketchfab.com/3d-models/crashed-abandoned-car-game-ready-66ef51a84c9843dda53bf0b4b9020011)，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。
  - 围墙外瞭望塔：standerwickd，[WWII Air Trafic Control Tower](https://sketchfab.com/3d-models/wwii-air-trafic-control-tower-9e7f035ed7f4449593ad1bebe6ac71b1)，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。
  - 三件模型从 [RohanVashisht1234/threejs-zombieshooter-game](https://github.com/RohanVashisht1234/threejs-zombieshooter-game) 的复合 `public/map.glb`，通过 `tools/extract_bio_props.py` 按节点和依赖分别提取为 GLB；保留原纹理，运行时设置尺寸与碰撞。复合地图里还有其他许可不同的素材，因此没有整体导入。
- 防化服生化幽灵：LxNazarov，[Zombie Hazmat](https://sketchfab.com/3d-models/zombie-hazmat-49b3b4307f6a4d2386fdb02354158d04)，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。GLB 从 [RohanVashisht1234/threejs-zombieshooter-game](https://github.com/RohanVashisht1234/threejs-zombieshooter-game) 的 `public/zombie_hazmat.glb` 获取；模型内元数据亦载明作者、来源及许可。项目在运行时缩放、调亮材质，并将原动作映射到本游戏的生化 AI。
- `vendor/three/examples/jsm/libs/meshopt_decoder.module.js`：meshoptimizer，Arseny Kapoulkine，[MIT 许可](https://github.com/zeux/meshoptimizer/blob/master/LICENSE.md)；用于解压防化服 GLB。

断电修复、照明压制、雨夜氛围是参考上述项目主题后在本项目重新编写的机制与场景；没有复制其程序代码。防化服感染者的水平根骨位移交给导航、竖直起伏保留，转身与攻击衔接由本项目控制。

模型是公开授权的替代素材，并非《穿越火线》的原始生化角色模型。
