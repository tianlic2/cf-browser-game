# AGENTS.md

## 项目概览
- **战术突击（Tactical Assault）**：基于原生 HTML + Three.js（CDN，无构建步骤）的浏览器第一人称射击（FPS）游戏，玩法对标穿越火线（CrossFire）。
- 战场为 CF 经典「运输船」集装箱货轮甲板（**晴天白昼**）；多武器系统（步枪/狙击/手枪/近战/投掷物三件套）。
- 纯静态站点，由 `python3 -m http.server` 提供静态资源服务（见 `.coze`）。

## 目录结构
- `index.html` — 页面骨架：画布容器、特效层、狙击镜 overlay、HUD（准星/血量/弹药/团队比分+倒计时+敌人数/击杀信息条/连杀播报/受击方向/**战绩面板**）、背包面板、开始菜单（**只有「对局设置」**：敌人数量步进器 1~8 + 难度三档；没有键位表、没有背包选枪行、没有皮肤行）、胜负结算、Three.js import map。**底部没有武器槽位栏**——武器身份只由右下角 `#weaponName` + 弹药数体现，与 CF 一致。
- `styles/game.css` — 全部样式（CF 风格 HUD、准星、背包、菜单、命中/受击/闪光特效、狙击镜）。层级：`.menu` 10 > `.fx-layer` 8 > `.hud` 7 > `.scope` 6 > 画布 1。
  - **首页走 CF 大厅配色（炭黑 + 琥珀橙 `#ff9b1a`），与战场 HUD 的战术绿/红是两套色**：大厅是「界面」，橙黄承担强调与可点性；HUD 保留绿/红/黄的功能色。这块是 `DESIGN.md`「避免大面积高饱和」那条禁忌的**明确例外**（CF 的大厅本来就是大面积橙黄）。
  - 轮廓语言：面板与所有可点控件都用 `clip-path` 切斜角（面板切左上+右下 26px，按钮切四角 8~14px），面板顶端一条橙色渐隐高光条（`.menu-panel::after`）。**`box-shadow` 会被 `clip-path` 一起裁掉** —— 面板的外发光做不出来，只剩内阴影；要外发光得另开一层不带 clip 的包裹元素。
  - 标题是 `background-clip:text` 的金属渐变字，**这种写法不能配 `text-shadow`**（填充透明时阴影会从字形里透出来，字是糊的），发光只能走 `filter: drop-shadow()`；结算画面的 `.menu-title.win/.lose/.draw` 必须把渐变还原成纯色（`background:none` + `-webkit-text-fill-color: currentColor`），否则 `color` 根本盖不住透明填充，胜负标题会变成看不见。
  - 「超高兜底」仍然保留（`.menu` 是 `overflow-y:auto` + `.menu-panel { margin:auto }`）。删掉键位表与配装区之后首页在 1280×900 与 480×900 下都不再溢出，但**这套兜底不能撤**——它是「内容一旦变高就点不到按钮」的唯一防线（flex 的 `align-items:center` 在内容超高时会把**上下两端同时裁掉且不可滚动**，实测踩到过）。
  - **窄屏不要用 `transform: scale()` 缩菜单**：缩放会让斜切角与 1px 描边发虚，也会把「进入战场」的可点区域一起缩掉。改成缩内边距与字号（见 `@media (max-width: 480px)`）。**HUD 必须高于 `.scope`**——CF 开镜后血量/弹药/击杀信息照常可见，若让镜筒黑场压住 HUD，开镜就等于看不见血条。
- `scripts/main.js` — 主游戏：Three 场景 + **独立的视模场景/相机（双通道渲染，见下）**、第一人称控制（指针锁定）、多武器系统（切换/换弹/后坐/投掷物/近战/**第一人称手臂**）、AWM 开镜、烟雾/闪光、多背包（`BACKPACKS` 菜单配装 + `B` 面板受限制切换）、射击射线命中、HUD 事件（击杀信息条/连杀播报/受击方向）、Tab 战绩面板与名册（`roster`）、团队竞技（比分/复活/补员/计时/**敌人数与难度**）驱动、游戏循环。
- `scripts/map.js` — 运输船地图（CF 经典「运输船」甲板）：炭灰钢甲板 / 船体 / 抬高的舷侧走道与栏杆、**4×4 集装箱网格（2 列/舷 × 4 排，共 20 只 + 2 只中央横置绿箱）**、米黄木质货箱堆、**左右舷两层甲板室（带外部楼梯 + 可上人屋顶）**、**横跨中路的栈桥**、船首舰桥（烟囱 + 桅杆）与船尾甲板室、舷边救生艇 / 黄白条纹遮阳棚 / **龙门吊** / 叉车、港口小道具（系缆桩/通风管/消防桶/舱盖/救生圈/信号灯/警示线）、海浪顶点动画、**烟囱白烟 / 海鸥 / 吊装小车等动态元素**；产出 `colliders`（AABB）、`obstacles`（射线阻挡）、`bounds`。
  - **船体尺寸**：`DECK_W = 20`（半宽）、`DECK_L = 34`（半长）→ 甲板 **40×68m**（原 52×104，缩到约 50% 面积）。`bounds = { hw: DECK_W-0.65, hl: DECK_L-0.65 } = {19.35, 33.35}`，船尾 `+z` 是我方出生、船头 `-z` 是敌方基地。船首（z=-(DECK_L+8)）舰桥 + 烟囱 + 桅杆，船尾（z=DECK_L+5）甲板室；两端各有一块 6.2m 高的红色舷侧舰体块（`hullTexture()`）。**`spawnRadius` 已删**（曾经是死代码，全仓库无消费点）。
  - **集装箱是「列 × 行」的 4×4 网格**，不是手摆的一堆坐标：
    - `COLS = [-11.6, -6.4, 6.4, 11.6]`（列心，**间距 5.2**，2 列/舷）；`ROWS = [-15.2, -6.2, 6.2, 15.2]`（行心，**间距 9.0**，4 排）；`STACK[r][c]` 是每格的叠放层数（0 = 空位），整体左右/前后镜像。**网格 12 个非空格 → 20 只箱**（两端两排 `r0/r3` 整排 2 层 = 前沿墙，中间两排只剩内列各 1 层），再加 2 只中央横置绿箱 = **22 只**。
      - **碰撞体是 14 个而不是 22 个**：`colliders` 是**每格一个**（不论叠几层），所以是 12 + 2。写审计断言时别按箱数写（曾经断言 22 → 假红），AGENTS.md 下面那条「审计脚本里的尺寸常数要跟着实测走」讲的就是这类空跑/假红。
    - **真实尺寸是 `CONT_T`(宽) 2.55 × `CONT_H` 2.43 × `CONT_L`(长) 6.00**（`CONT_SCALE = 1.9`）。**这个数字必须从 collider 直方图实测**（`dump` 脚本），照文件名或旧文档猜会得到 4.85×11.4 那种两倍多的值 —— 按错误尺寸排网格会得到 4.65m 的列距，箱子之间空得能开船，整张图散掉（实测踩过，是这次改图里代价最大的一个错）。
    - 由此**列通道净宽 = 5.2 − 2.55 = 2.65m**、**行通道净宽 = 9.0 − 6.00 = 3.0m**。中央大道是 x∈[-6.4+1.275, 6.4-1.275] ≈ ±5.1（约 10.25m）。中央 z=±10.7 各横置一只深绿箱（`rot=SHORT`）切断大道，形成 S 形交火线。
      - **这口横置绿箱绝不能摆在大道正中（`x=0`）** —— 见下面「AI 绕行的几何约束」一节，那是敌人 AI 的硬约束、不是美术选择。现在两口箱心在 **x = ∓3.85**（箱体压 x ∈ ±[2.575, 5.125]，东沿与内列箱西沿 5.125 齐平），两口分别偏两侧、z 也相反。
    - 前两版间距都失败过，别再走回去：**3.0m 列距**让 2.55m 宽的箱互相插进对方身体、糊成两堵实心墙；**7.2m 列距**又让列通道（4.65m）比中央大道还宽，主次颠倒、看着像停车场。
    - **改 `COLS/ROWS/STACK` 之前先读完 `map.js` 里那两条「缩图后的硬约束」注释**（在 `const COLS` 上方）：① 甲板室 ↔ 爬梯 ↔ 行距锁死的链；② 最外排行心受敌人刷出带的反向约束。两条都写在该处。
  - **AI 绕行的几何约束：摆在敌人推进路线上的障碍，沿推进方向的半宽（`hx`）必须 ≤ 2.85m。** 这是**从 `enemies.js` 的 `avoid()` 反推出来的布图规则**，不是美术偏好 —— 违反它的症状是「个别敌人以满速永久往复、净推进≈0」，非常难从现象反推（实测查了两轮）。
    - 推导：`avoid()` 是**纯局部反射 + 承诺**——前方被挡就把本帧位移转 90°，且 `detourT = 1.1s` 内不改方向。敌速 3.5m/s ⇒ **一次绕行只滑 3.85m**。而绕开一个半宽 `h` 的障碍需要滑过 `h + 1.0`（0.45 是 `ahead` 探针的 0.5 外扩 + 余量），所以 `h ≤ 2.85`。
    - `h > 2.85` 时：从正中滑一次**永远滑不到位**，滑到底撞上第二堵墙 → 重新探路 → 平手（两侧探针读数相同）→ 方向由 **`Math.sin(this.seed)`** 定，而 `seed = Math.random()*2π` 是**每敌人一个固定值**，于是同一个敌人永远挑同一边 → **以满速永久往复**。实测：60s 净推进 14m、累计路程 181m，8 人里 2 人中招。
    - 落地：① 中央那两口横置绿箱（`hx = 3.0`，超限）从 `x=0` 挪到 **`x = ∓3.85`**，被挡区间从「两侧窗口各 1.125m」变成「单侧窗口净宽 6.7m」；② 木箱堆 `nx ≤ 3`（半宽 1.40m）安全，`nx = 4` 时 1.875m 也仍在限内；把守出生口那两堆仍**偏心摆到 `x = ±3.0`**，给敌人让开中轴。
    - **改图之后必须重跑寻路回归**（不是只看有没有卡住的截图）：`t.pause()` 后定步长快进 60s，判据要用**累计路程**而不是位移（「原地画圈」和「完全没速度」的位移都是 0），见「无头测试的几个坑」。
  - **立体结构（`y0` 的用武之地）**：左右舷各一座 2 层甲板室（`PORT_X=-12.0` / `STBD_X=12.0`，`topY=4.5`），**外挂楼梯**上屋顶、屋顶整块可站人、屋内可进入；一条 `BR_Y=4.62` 的**栈桥**横跨中路连接两舷屋顶（跨度由 `PORT_X/STBD_X` 派生，缩图后 18.4m）。
    - 楼梯用 `addStairs(cx, zBottom, dir, topY, mat)` 生成，**`TREAD` 必须大于 `PLAYER_RADIUS`（0.45）** —— 这是本碰撞模型推出来的硬约束：分轴解算会把「下一级台阶」按玩家半径外扩，`TREAD ≤ 0.45` 时那一级的外扩盒正好盖住当前踏面，玩家永远站不上去。第一版 `TREAD = 0.40` 实测卡死在 z=13.47。现在 `TREAD = 0.62`（余量 0.17m），级高 `topY/round(topY/0.44)` ≈ 0.45（**不能取到正好等于 `STEP_H`(0.5)**，边界会抖）。
    - 屋顶是**一整块板**（`colliders.push({... h: topY, y0: topY - 0.3})`），不是一圈环。做成环（只有边上 0.95m 有碰撞）时，人从屋顶往中间一走就**穿过看得见的屋面板掉进屋里** —— `y0` 出现之后这个折衷就没必要了。
  - **`obstacles.push(clone)` 必须放在层循环里，不能包在 `if (L === 0)` 里**。曾经只有最底层进阻挡列表，于是 2/3 层塔的上面两层**不挡子弹**：对着三层塔的正脸开枪，弹道从第二层穿过去打中后面的东西（"显示的障碍与实际障碍不符"）。
  - **龙门吊**：`LEG_X = DECK_W + 1.6 = 21.6`（缩图前是写死的 27.6）的两条腿已经伸到船体（x=±20.4）外面，所以每条腿下都补了**舷外平台**否则整台吊机悬在水面上；`BEAM_Y = 15.5`，小车 `craneTrolley` 挂在梁下（**吊装的集装箱 `HANG_Y = 9.4`，底 ≈8.18m，必须高过栈桥桁架顶 ≈6.4m**，否则穿模）。**`HANG_Y` 受栈桥净空约束、与船的长宽无关，缩图时不要跟着 `DECK_*` 改**。
  - **动态元素**（都在 `update(t, dt)` 里驱动）：烟囱白烟 14 个 Sprite（`SMOKE_LIFE = 11.0` 循环，`FUNNEL_Z = -(DECK_L+8)+1`）、9 只海鸥绕圈（`r = 34+rand*62`，翅膀 `rotation.z` 拍打）、吊装小车 `craneTrolley.position.x = sin(t*0.11)*12`。
  - **太阳必须与那盏 DirectionalLight 同向**：three 的等距柱状映射是 `u = atan2(dir.z, dir.x)/2π + 0.5`、`v = asin(dir.y)/π + 0.5`、画布 `y = (1-v)·h`。灯在 `(-34, 78, 30)` → 单位向量 `(-0.377, 0.865, 0.333)` → `u=0.885, v=0.833` → 画布 `(1813, 171)`。**改灯的坐标就得同步改这两个数**，否则天上的太阳和地上的影子方向对不上，一眼假。
  - **警示线是 4 条细带描边，不是一块实心黄板**。实心板既刺眼、又因为甲板本身不在 `obstacles` 里而变成「朝空地开枪却打中东西」的隐形墙。描边同样不进 `obstacles`。
  - **舷侧走道**：`WALK_H = 0.4` 的抬高平台，位于 `x = ±(DECK_W-0.8) = ±19.2`（宽 1.6m，长 `DECK_L*2`），**进 `colliders`/`obstacles`**；所有栏杆与立柱整体抬升 `RAIL_Y = WALK_H`。留意：抬高的只是视觉与碰撞高度，玩家物理仍是平地（见下）。
    - 走道内缘（18.4）与甲板室外缘（14.0）之间缩图后腾出一条 **4.4m 的外带** —— 原图上这里只有 1.0m 夹缝。现在舷边道具（救生艇/遮阳棚/系缆桩 `EDGE_X = DECK_W-0.4`/通风管/消防桶/信号灯柱）全落在这条带上，不至于留一条空旷死带。**舷边件必须贴到栏杆内侧**：走道只有 1.6m 宽、玩家中心又被 `bounds.hw = 19.35` 卡住，系缆桩（半径 0.3）摆在走道中间会把走道口堵死 —— 等于把「一条空气墙」换成「一条真墙」。
  - **木质货箱堆**（`addCratePile`，缩图后 25 处 → **9 处**）是全场最亮的视觉元素，也是最主要的低矮掩体：中路 `(0,0)` 3×2×2 的大箱堆 + `(0,±5.2)` 的矮箱 + 两端出生区 `(±3.0, ±20.5)`（偏心摆，让开大道中轴）+ 舷边外带 `(±16.2, ±10.7)` 四堆（`nx=1`，半宽 0.45m）。
    - 木箱一律放**开阔处**：纵向巷净宽只有 2.65m，塞进 1.85m 的箱堆会把巷口堵死（`avoid()` 还要按 0.5m 外扩）。中央大道（|x| < 5.125）与横向巷道（3.0m）**不放任何东西**，留给走位。这一条与上面的「半宽 ≤ 2.85m」是同源的。
  - 散落道具（缩图后一并砍半）：油桶/木桶 4 组、系缆桩 4、通风管 4、消防桶 2、甲板舱盖 2、救生圈 2、信号灯柱 2、叉车 1。**所有 `|z| > 33` 的坐标都必须在缩图时挪进甲板内**（原图系缆桩 ±44、救生圈 ±34、信号灯柱 ±48 全在新甲板外）。
  - 程序化纹理：`containerFaceTexture(baseHex)` 为集装箱生成 CanvasTexture（瓦楞、门端 X 折线、角件、锈迹）+ `woodTexture()` 木箱板条纹理 + `stripeTexture()` 遮阳棚条纹；全部显式设 `colorSpace = THREE.SRGBColorSpace`。
    - **坑：颜色不能两边都上。** 把颜色烘进 `containerFaceTexture` 之后再写 `material.color = 该色`，等于色值平方（`#2f5230² ≈ #091a09`），深绿箱会黑成一块。正确做法是 `material.color = new THREE.Color(0xffffff)` + `material.map`，金属度压到 0.12、粗糙度 0.85。
    - **坑：`CanvasTexture.colorSpace` 默认是 `NoColorSpace`。** 不设就会被当线性数据读进来再被 sRGB 编码输出，整体亮一档（集装箱会发白）。
  - 天气：`skyTexture()` 生成 2048×1024 等距柱状天空（天顶 #1a5aa6 → 地平线 #dceef6 + 110 团柔和云），同时用于 `scene.background` 与 `scene.environment`（**不再依赖 RoomEnvironment**——室内环境贴图在晴空下会发脏）；`scene.fog = FogExp2(0xc4dcea, 0.0030)`；`waterTexture()` 512² 泡沫贴图滚动 `offset` 做水面流动；±500 处有低模海岸线与城市天际线。
  - 港口小道具**参与碰撞与射线阻挡**（`slashProp` 的 `solid` 参数决定给不给碰撞盒；给 `{r,h}` 的会同时进 `colliders` 与 `obstacles`）。曾经这里是「纯视觉」，于是通风管/系缆桩/消防桶/信号灯柱全都能一脚穿过去 —— 属于「显示的障碍与实际障碍不符」的另一半。**没给 `solid` 的那些（如救生圈、警示线条带）才是纯视觉**。
- `scripts/enemies.js` — 敌人系统（`Enemy` + `EnemyManager`）：**模型与动画全部委托给 `scripts/enemy_model.js` 的程序化骨架**（`this.rig` = 一个 `SoldierRig`，`this.meshes = this.rig.meshes`）、**手中的 AK-47**（`setRifle` → `normalizeRifle`）、追击（带障碍规避）/点射走位 AI（速度有惯性、转身限角速度）、基地(-z)刷敌（`spawnGroup`/`aliveCount`）、受击闪红（emissive）+ 硬直、爆头（头部网格 `userData.part==="head"`，由骨架打标）、闪光致盲（`blindT`/`blindAll`）、死亡倒地保留（`corpses`）、对象池（`free`/`acquire`/`release`）、`enemyManager.frozen` 冻结调试、`onFootstep` 回调供脚步声定位。**敌人没有血条**（与 CF 一致）。
  - **难度旋钮是导出的可变对象 `ENEMY_TUNING = { dmg, acc, speed, pause, aggro }`**（默认全 1，由 `main.js` 的 `applyDifficulty()` 灌入）。敌人在 `reset()`（`damage`/`speed`/`burstPause`）、`updateBurst()`（`burstPause`，经 `pauseFor()` 统一乘）、`update()`（`near = ENGAGE_NEAR / ENEMY_TUNING.aggro`、横移幅度 `* ENEMY_TUNING.aggro`）里**每次现读**，不在构造时捕获 —— 所以换难度立刻影响下一次点射/下一个刷出的人。**`ENEMY_HP` 不进难度表**（保住 AK 三枪死）。
  - `Enemy.takeDamage()` 只把 `health` 减到 0 并置 `e.dead`；**记战绩（`roster.deaths++`）与击杀播报是 `main.js` 的 `onEnemyDeath()` 干的**。所以调试/测试里想「制造一次阵亡」不能只调 `takeDamage`，得走 `fire()`/`meleeAttack()`/手雷那条正规路径（或直接写活的名册条目）。
  - **世界坐标在 `e.group.position`**，`e.root` 只是内层模型（现在等于 `e.rig.root`），调试时别读 `e.root.position`。
  - **四层结构：`group`（世界坐标 + 朝向）→ `tilt`（绕腰的放平 + 起伏）→ `body`（原点回到脚底）→ `rig.root`（骨架根，原点同样在脚底，`pelvis.position.y = PELVIS_Y`）。** 骨架内部的关节姿态（走位/瞄准/开火/受击/倒地）全部由 `rig.animate()` 负责；`tilt` 只为「整具尸体绕腰放平」这一个变换存在。
    - **倒地时 `tilt.position.y` 必须跟着降下去**（`BODY_PIVOT*(1-ease) + 0.26*ease`）。绕腰转 90° 会把**所有**点都留在转轴高度上——不降 pivot 的话整具尸体齐腰悬空。绕脚转（旧写法）才不需要这一步。
    - **这个 0.26 不是随手填的常数，是「身体前表面深度」的实测值**：放平后「身体前方」=「身体下方」，而脸/头盔脸罩在胸前方 0.18m、胸甲 0.125m。0.2 时整张脸扎进甲板（实测最低点 -0.041），0.26 时头盔前缘恰好落在 y≈0（实测 -0.001）。**换了骨架尺寸/头部造型就必须重量一遍**（脚本：遍历 `rig.root` 下所有 mesh 的 `geometry.boundingBox` 八个角 × `matrixWorld` 取最低 y）。
  - **朝向不再需要任何修正**：骨架是照着「本组 +z 是正面」现搭的，正面 = 朝向 = 枪口方向，没有旧 GLB 那个「模型正面在局部 +x、必须 `MODEL_YAW = -π/2`」的问题。+z 朝前同时决定了**右手在 -x 侧**（扣扳机那只手）。
  - **移动是「期望速度 → 实际速度」的惯性模型**，不是每帧瞬变：`vel += (target - vel) * (1-e^(-MOVE_ACCEL·dt))`，横移方向另用 `strafeBlend` 平滑翻转（否则速度向量会在一帧内 180° 掉头，看着像瞬移）。**平滑一律用 `1-e^(-k·dt)`，不要用 `dt*k`**（后者手感随帧率漂移）。实测单帧速度最大变化 0.215 m/s（修复前是每帧凭空 0~3.8 跳变）。
  - **转身是「角速度 + 积分」**：`turnVel += (clamp(diff*8, ±TURN_RATE) - turnVel) * (1-e^(-10·dt))`，再 `rotation.y += turnVel*dt`。直接写 `min(TURN_RATE*dt, diff*k)` 是匀速转到停，像机器人原地打转；先积角速度才有起转/收住。180° 掉头约 1.6s。
  - **没转正不开火**：`update()` 记 `this.aimErr`（本帧转完后仍偏离目标方向的角度），`updateBurst()` 里 `aimErr > AIM_TOL(0.35)` 就压制 `wantShoot` —— 否则会一边转身一边朝侧面泼子弹（敌人射击是 hitscan、与身体朝向无关，所以这纯粹是观感约束；容差别收太紧，贴身绕圈时敌人跟不上转速会一直不还击）。
  - **脚步声跟着「实际走过的路程」走**（`bobT += moved * 3.4`），不是按时间——速度慢步子就慢；被掩体顶住时 `moved≈0`，自然不响。
  - **绕行方向必须「承诺」，不能每帧重算。** `avoid()` 原来的写法是「前方被挡就把本帧位移转 90°」，而转哪一边取自 `Math.sin(this.group.rotation.y * 3.1 + this.seed)` —— **符号依赖敌人自己的朝向，而绕行本身就在改朝向**，于是符号每帧翻一次，敌人以满速原地画圈（实测 21 秒位移 0.1m，而 `moved` 每帧都是满的、`stuckT` 恒为 0）。现在 `detourSide` 只在一段绕行开始时定一次（两边各探 1.1m，挑真的空的那边），并保持 `detourT = 1.1s`。
    - 平手时按 `Math.sin(this.seed)` 定方向：**`this.seed` 是 `Math.random()*2π`，恒 ≥ 0**，直接拿它判号会让所有敌人都挑同一边、在同一个死角里挤成一团。
    - 修好后同一场景从「3/8 卡住、平均推进 42m」变成「8/8 推进 63~69m」（定步长快进 60 秒，三次运行一致）。
  - 被掩体顶住（`moved < wanted*0.4` 持续 0.8s）会**换一个绕行方向**并给速度衰减。注意这条判据**抓不到画圈**（画圈时每帧都在动）—— 所以另有一条**净推进监工**：`dist > ENGAGE_FAR+3` 时若「离玩家的距离 2.2s 内没有减少 0.35m」，就翻转 `detourSide` 并清 `detourT` 强制重新探测。这条是必要的，因为 far 距离下 `strafeBlend` 被强制衰减到 0（见 `update()` 里「远距离只压上，不横着飘」），原来那唯一一条逃生路（翻 `strafeDir`）在远距离**是个空操作**。
    - 调试这两个量：`e.detourSide` / `e.detourT` / `e.noProgT`；排查寻路问题时要看**累计路程**而不是位移，否则「原地画圈」和「完全没速度」分不开。
    - **`detourT = 1.1s` 这套时序对地图布局有一条硬约束**：敌速 3.5m/s ⇒ 一次绕行只滑 3.85m，所以**摆在推进路线上的障碍半宽必须 ≤ 2.85m**，否则滑不过去、退化成永久往复。这是布图规则不是 AI 缺陷，`avoid()` 的时序是历史调稳的、别去改它 —— 详见「`scripts/map.js`」一节的「AI 绕行的几何约束」。
  - **`this.speed` 必须在 `reset()` 里赋值**，且 `moveBy()` 有非有限值兜底：`update()` 里 `this.speed * dt` 一旦是 `undefined` → `sp` 变 NaN → `avoid()` 的 `NaN < c.hx` 恒为 false（误判成「没被挡住」）→ 位置被写成 NaN。而 NaN 不会自愈（之后每帧的 `dist`/`atan2` 全是 NaN），敌人会**静默地从场景里消失且永不再移动**，且没有任何报错。
- `scripts/enemy_model.js` — **程序化士兵骨架（`SoldierRig` + `normalizeRifle`）**：用基础几何现搭一套带关节的层级，走位/瞄准/开火/受击/倒地全是程序化驱动。**这就是「摒弃旧的敌人模型」那个改动的落点。**
  - **为什么弃用 `models/soldier.glb`**：它是**单网格静态姿势、没有骨骼也没有动画**（1 mesh / 2 node / 19 primitive），双臂垂在身侧，于是敌人只能整体平移、枪只能作为刚体飘在胸前——「跟随移动/开枪/受击」在几何层面就做不到。现在这个文件是**唯一**的敌人造型来源，GLB 只用来提供枪（`normalizeRifle`）。
  - **骨梯**：`root → pelvis`（`PELVIS_Y=0.95`）→ `spine`（+0.06）→ `chest`（+0.28）→ `neck`（+0.50，挂 spine 上）→ `head`（+0.14）；`chest → sh(±0.20, 0.22) → el(-UPPER) → hd(-FORE)`；`pelvis → hip(±0.10, -0.04) → knee(-THIGH) → ankle(-SHIN) → foot`。所有骨段网格沿**局部 -y** 伸展。身高 ≈1.82。
  - **旋转正负号（到处都要用，写代码前先看文件头注释）**：朝上的骨（spine/neck）`rotation.x > 0` = **上端往 +z 倒 = 前倾**；朝下的骨（四肢）`rotation.x > 0` = **末端往 -z 摆 = 向后摆**。所以「腿往前抬」是**负**的 `rotation.x`、「上身前倾」是**正**的。
    - 同一个约定连累了枪：`mount.rotation.x > 0` 把枪口压**低**，所以「朝上方的目标瞄准」要写 **减** `- aimPitch * (0.35+0.65k)`（`aimPitch = atan2(目标y-眼y, 距离)`，>0 = 目标在上）。写成加号会让敌人越瞄越朝下。
  - **`PELVIS_Y` 是「站立时膝角」的唯一旋钮**：髋(0.95-0.04=0.91) → 踝(0.10) 的跨度必须接近腿长 `THIGH+SHIN=0.82`。取 0.90 时跨度只有 0.76，膝盖被迫常弯 44° —— **站着也像半蹲**；0.95 时跨度 0.81（98.8%），膝角回到 ~18°。
  - **步态**：① 相位跟着**走过的路程**走（`phase += π·moved·CADENCE_SLIP / (2·halfStride)`），支撑脚才不会打滑；`halfStride = clamp(speed*0.10, 0.06, 0.32)`。`CADENCE_SLIP = 0.72` 是**故意**用 28% 的脚底打滑换回真人步频——腿长把跨步锁死在 ±0.32m，严格不打滑在 3.4m/s 下要 5Hz 步频（看着像小碎步）。② 脚的前后/抬高由 `strideOf()` 按相位解析给出（支撑期匀速后移、摆动期抬起前摆），`walkW = clamp01((speed-0.25)/1.1)` 在站定时把脚收回髋下。
  - **骨盆高度由「够得着」反推**：`bound = ANKLE_Y - HIP_DY + lift + √(max(0.02, (LEG_REACH*0.99)² - z²))`，`pelvisY → min(PELVIS_Y, min(boundR,boundL)) - 0.012*walkW`。这样走路的上下起伏是**自然生成**的（每步一次），且腿永远不会被拉脱臼。**必须在算脚的目标点之前定下来**——目标点是相对骨盆的，用上一帧的骨盆高度会把脚带偏 1~2cm（实测脚掌切进甲板）。
  - **腿用 2D 解析解而不是四元数 IK**（腿只在矢状面里摆，解析式更稳更省）：`base = atan2(dz, -dy)`，`thighA = base + acos((THIGH²+d²-SHIN²)/(2·THIGH·d))`（膝盖朝前顶），`hip.rotation.x = -thighA`，`knee.rotation.x = thighA - shinA`，`ankle.rotation.x = shinA - lift*1.6`（把脚掌踩平、摆动期让脚尖下垂）。**`solveLeg` 要取本腿的 `f`，别读错另一条腿的 lift。**
  - **手臂用两骨 3D IK（`ik2`）**，在**胸腔坐标系**里解（肩点与握点都在 chest 系）：末端被拉到 `_gripT`/`_hgT`，即 `GRIP`/`HANDGUARD` 经 `mount.matrix` 变换后的点——**手是每帧被 IK 按到枪上的**，这就是「看起来真的在持枪」的来源。落地实测：双手到目标点距离 0.0000。
    - **`GRIP`/`HANDGUARD` 的位置有硬约束，不是纯造型参数**：AK 归一化后是「中心归零、枪口朝 +z」的长枪，扳机握把在中心**之后** 0.19、木护木在中心**之前** 0.10（从实测截图上按像素比例反推）。更硬的一条是**左肩(0.20,0.22,0) 到护木点的距离必须明显小于臂展 `UPPER+FORE=0.61`**：护木取 z=0.20 时距离 0.577（≈95%），IK 会把支撑臂拉成一条直线，画面变成「枪飘在胸前、手够不着」。现在 ~0.50（84%），肘部自然弯 ~60°。
    - `MOUNT_CARRY`（低姿，pitch 0.30 枪口朝下）/ `MOUNT_AIM`（据枪，pitch 0）之间按 `aimBlend` 插值；**背心厚度也得配合**：`vest` 深度旧值 0.30 让前表面跑到 z=0.16，把「枪心前 0.36 的握把」整个包进胸甲里，正面看就是「手和枪都不见了、只剩一块黑板」。
    - **加/改 IK 目标点时先查有没有撞车**：`GRIP.applyMatrix4()` 会**改掉模块常量**（跨帧累积变换），必须 `_gripT.copy(GRIP).applyMatrix4(...)`；`ik2` 内部用自己的 `_i1/_i2/_i3/_iq`，**不能**把调用方的向量传进去当草稿纸（第一版就是这样把 `_gripT` 冲掉的）。
  - **倒地姿势有三条硬约束**（都踩过）：
    1. **绝不能把腿折起来**——`tilt` 会把整具身体绕腰转 90° 放平，折起的腿在那之后会朝天上翘成一团（实测尸体像只翻倒的虫子）。所以死亡只让四肢「松掉」（小幅微调），pelvis 高度也**不能在骨架里动**（放平后的高度由 `tilt.position.y` 负责）。
    2. **脊椎/脖子几乎不能往前弯**——放平后「前倾」= 「往甲板里扎」。脊椎 0.22 + 脖子 0.40 时头盔最低点 -0.219m。现在脊椎 0.08、脖子 0.10。
    3. **头要整个转向侧面**（`neck.rotation.y → 1.15`）：一来这才是「死人歪着头」，二来头盔 0.27m 的深度从「朝下」轴转到「朝侧」轴，直接退出扎地板的那条轴。
  - **倒地的枪必须绕 Y 横过来**（`RIFLE_DEATH_YAW = 1.5` 叠加在 `RIFLE_YAW` 上，位置同时收回体侧 `_mountDeadP`）。同样是几何必需而非审美：枪口在胸前方 0.85m，放平后那 0.85m 全变成「往下」，不横过来整根枪管从甲板底下捅出去（实测最低点 -0.586m）。横过来后枪沿 ±x 躺，而 x 轴在绕 X 的放平变换里不变，高度恒定在甲板之上。
  - `animate(dt, s)` 的入参：`s = { moved, speed, aim, aimPitch, blind, flinch, dead }`；内部再平滑成 `aimBlend`/`deathBlend`（`1-e^(-k·dt)`）。`breath` 驱动呼吸与致盲乱晃，`kick` 是开火后坐（`*= e^(-11·dt)`）。**顺序不能乱**：步幅 → 骨盆 → 脚目标 → 腿 → 躯干 → 头 → 枪 → 手臂 IK → 倒地覆盖。
  - `muzzleBody(out)` 用**解析式**把枪口从 `mount.matrix` 变换出来，`muzzleWorld()` 再按 `group.rotation.y` 手工旋转 + 平移。不用 `localToWorld`：后者依赖 `matrixWorld`，要等下一次 `render` 才更新，新生敌人的枪口会算到世界原点（`attachMuzzleTo` 那个历史 bug 的同一类）。
  - **步枪不在 `rig.meshes` 里**：① 受击闪红不该闪到枪上；② 子弹穿过枪身不算命中。`this.meshes` 只装身体网格，`part="head"` 的标签由骨架打。
  - 每个 `SoldierRig` 一份自己的材质（受击闪红必须各自独立），**几何体是模块级共享的**（`geo()` 只跑一次）；`G.jointBig`/`G.jointMid` 关节球塞在肩/肘/髋/膝，遮住低多边形骨段弯折时的断口。
  - `normalizeRifle(source)`：最长边定标到 `RIFLE_LEN=0.92`、`rotation.y = RIFLE_YAW = +π/2`（AK 枪口在本体 -x，转 90° 后指向 +z）、`position.sub(包围盒中心)` 居中、整体压暗（`multiplyScalar(0.6).lerp(0x6d6355, 0.2)`、`metalness ≤ 0.4`）。每个 `SoldierRig` 用 `rifleTemplate.clone(true)` 各拿一份（`clone` 会沿用同一份几何/材质，所以**枪的材质只在 `normalizeRifle` 里改一次**）。
- `scripts/audio.js` — 程序化音效（Web Audio API 合成枪声/换弹/切换/投掷/爆炸/近战/命中/爆头/受击/脚步/起跳/落地/烟雾/闪光耳鸣/连杀播报/回合开始结束等，无外部音频资源）。
  - **低频闷音总线的字段名必须叫 `this.muffleNode`，绝不能叫 `this.muffle`**：`SFX` 上本来就有一个 `muffle(dur, to)` **方法**，`ensure()` 里写 `this.muffle = this.ctx.createBiquadFilter()` 会用一个**实例属性盖掉同名原型方法**。`ensure()` 一跑（用户点「进入战场」那一下就会跑），`sfx.muffle` 就变成了 BiquadFilterNode，之后每次 `sfx.muffle(...)` 都抛 `TypeError: sfx.muffle is not a function`。而 `clearFlash()` 正是这么调的，它又是 **`beginDeath()` 与 `respawnPlayer()` 的第一行** —— 玩家一死，`beginDeath` 在 `clearFlash` 处抛异常（`dead=true` 已置、**死亡面板根本没机会显示**），3 秒后 `respawnPlayer` 每帧再抛一次：`update()` 走不完 → `renderer.render` 永不执行 → **画面彻底冻住、永远无法复活**（用户实测踩到，排查了两轮）。同一处撞车还连累 `flashbang()` → `this.muffle(d)`，闪光弹一炸也抛。**给类里加实例字段前先搜一遍有没有同名方法**（`panner()` 也是方法，目前没有同名字段，别踩）。
  - `clearFlash()` 现在只在 `ready()` 为真时才走音频（`muffle` 内部已有 `if (!this.ready()) return;`），**所以「无头测试里音频图没建起来」会让这一整类 bug 全部隐身**，见下方「无头测试的几个坑」第一条。
- `scripts/skins.js` — CF 风格武器皮肤表（`SKINS` / `STOCK` / `DEFAULT_SKIN` / `DEFAULT_MUZZLE` / `skinsFor` / `findSkin` / `isSkinned` / `skinLabel`）：5 把枪 + 匕首共 18 项（13 款设计的皮肤），每款 = 按 **GLB 原始材质名**分部位上漆 + `pulse` 发光呼吸 + 专属枪口焰色。**只有 AK/M4/匕首**材质是按部位命名的（`Dark_metal`/`Metal`/`Wood`、`Primary`/`Secondary`/`Highlight`、`knife_s_1`/`knife_s_2`），AWM 是单网格单材质、USP 是 16 网格共用 1 个材质——这两把只能整枪染色。**投掷物故意不做皮肤**（三件套现在纯靠 `def.tint` 区分，再叠皮肤就分不清手里是哪颗了）。
- `scripts/viewarms.js` — **第一人称手臂（`ViewArms`）+ 换弹时间线**：程序化几何（与 `enemy_model.js` 同一套做法：`geo()` 模块级惰性缓存、骨段沿**局部 -y** 伸展，于是 `fore.quaternion.setFromUnitVectors(DOWN, dir)` 直接可用），不是 GLB。**这就是「枪凭空浮在右下角，看不到握枪的手」那个反馈的落点。**
  - **结构**：`root`（`attach()` 重挂进当前武器组）→ `armR`/`armL` 两个 Group，每个里面 `palm`（手掌+四指+拇指，单独一组，**只有它能转**）+ `fore`（前臂）+ `mag`（左手换弹时拎的弹匣）。**没有上臂、没有两骨 IK、没有手指动画** —— 视图模型看不见上臂，75° FOV 下手指也看不出来。
  - **`root` 必须是武器组的子节点**，不能挂 `vmCamera`：`switchWeapon` / `applyScope` / `animateWeapon` 三处可见性写者都是写武器组的 `visible`，挂外面就会出现「开镜后手臂浮在镜筒上」。所以判「开镜时手有没有藏起来」要判**有效可见性**（沿 `parent` 链一路走上去都不能有 invisible 的祖先），只看 `viewArms.root.visible` 会误报（**实测踩到**：组已经隐藏了、root 自己的 visible 还是 true）。
  - **配色故意不用敌人那身近黑**（`0x1c1e21`）：枪本身就是近黑的，手再用同色就是一团分不出结构的黑（第一版实测：放大 4 倍也只看得出几片黑色平板）。现在是浅棕皮革手套 `0x7a5f45` + 橄榄绿袖 `0x474d3a`。
  - 每个 mesh 都要 `frustumCulled = false` 并打 `userData.viewArms = true`（后者是 `meshMats` 过滤的依据，见下）。
  - **`_aim(arm, wrist, elbow)` 的第三个参数必须是 Vector3，不能是数组**。第一版按下标读 `elbowArr[0]`，而换弹那条路径传的是 Vector3 → 三个分量都是 `undefined` → `_d` 变 NaN → **`d2 < 1e-8` 对 NaN 恒为 false**（本该拦住零向量的兜底完全失效）→ `setFromUnitVectors` 吃进 NaN 方向 → **前臂静默消失，不报错、不进 `loopErrors`**（排查了两轮）。`ELBOWS` 对外仍导出成数组，类内 `elbR`/`elbL` 转好再用。
  - **锚点表 `ARM_ANCHORS` 是导出可变对象**（`__tactical.setArmAnchor` 在线微调，改一条立刻生效、不必重启页面）。`configure()` 里 **`a.m` 必须 `fromArray` 不能 `copy`** —— `Vector3.copy(array)` 读的是 `.x/.y/.z`，数组上那三个是 `undefined`，copy 完 `magwell` 就是 NaN，插弹匣那半段左手直接消失（NaN 沿 lerp 传下去，`s=1` 时整条时间线都残废）。**实测踩到**。
  - **托枪手（左手）掌心要翻 `PALM_ROLL_SUPPORT = 1.30`**：默认那副「指头朝前」的拳形是给扣扳机的手造的（它握的是竖直握把）；护木是横的，不翻这一下左手就变成一块**搁在护木上**的方板。配套地，左手锚点的 y 要落在**护木下缘再低 2cm**（AK 护木下缘 y=0.043 → 锚点 y=0.023）—— 写在护木高度上，手会被枪身整个盖住。
  - **前臂长 0.62m**（静止位腕点到肘锚点实测 0.64）：太短的话换弹下探时前臂只画到一半，画面里只剩一只悬空的手（0.50 时实测如此）。
- `models/` — 本地 GLB 资源：`ak47.glb`、`m4.glb`、`awm.glb`、`pistol.glb`、`knife.glb`、`grenade.glb`、`container.glb`、`oilbarrels.glb`、`barrel.glb`、`forklift.glb`、`ship.glb`（随站点提供，避免外链失效）。**`soldier.glb` 与 `crane.glb` 已不再被加载**（前者被 `scripts/enemy_model.js` 的程序化骨架取代，见该节；后者在运输船改版中移除），文件保留备查 —— 别看到文件还在就以为敌人模型还是它。
  - 注意 AK 被加载**两次**：`ak47.glb` 一份给玩家（`loadAK()`，挂在 **`vmCamera`** 下、会被皮肤直接改材质），另一份走 `loadEnemyRifle()` → `enemyManager.setRifle()` 给敌人当枪模板。敌人的枪在 `normalizeRifle` 里**逐材质 `clone()`**（连同定标到世界尺寸、压暗），所以 `applySkinTo` 改玩家那把不会波及敌人；反过来也不能省掉这次单独加载——玩家那把是按 `def.rotY`/握持位摆好的相机子节点，直接复用会把它从相机上摘走。
- `DESIGN.md` — 视觉与交互设计规范（军事/战术风格、运输船场景、配色、排版、动效、禁忌）。

## 运行方式
- 开发预览：`.coze` 已配置 `python3 -m http.server ${DEPLOY_RUN_PORT}`，静态服务即可，无编译步骤。
- 所有 JS 为 ES Module，**`three@0.160.0` 已本地化到 `vendor/three/`**（`build/three.module.js` + `examples/jsm/loaders/GLTFLoader.js` + `examples/jsm/utils/BufferGeometryUtils.js`，后者是 GLTFLoader 的相对依赖，**少一个都加载不了**），由 `index.html` 的 import map 指向本地。无本地 npm 依赖（无 package.json）。
  - **不再依赖 jsdelivr。** 原来是 CDN，国内访问时常只回响应头不回正文、模块图卡死在 three 的 import 上且不报错（无头测试里靠拦截 CDN 喂本地镜像绕过，见「无头测试的几个坑」）。本地化之后那份镜像也就不需要了。
  - 升级 three 要**三件一起换**（版本必须一致），并同步 `REVISION`。
- GLB 模型走站点本地路径 `./models/*.glb`。
- **所有资源路径都是相对文档的（`./…`），不是根绝对路径**。`/styles/game.css`、`/scripts/main.js`、`/models/*.glb` 这类写法在 GitHub Pages 的**项目页**上会去根域找 → 整站 404（项目页的站点根在 `/<仓库名>/`）。改路径时注意：`fetch("./models/x.glb")` 是按**文档 URL**解析的，不是按模块 URL，所以写在 `scripts/*.js` 里也是对的。
- **线上部署**：<https://tianlic2.github.io/cf-browser-game/>（仓库 `tianlic2/cf-browser-game`，公开，Pages 发布 main 分支根目录）。改了代码 `git push` 后 Pages 会自动重建（约 1 分钟）。
  - **`vendor/` 必须入库**（`.gitignore` 里那条 `/vendor` 已因此移除），否则线上站点拉不到 three。
  - 部署后自检：从**子路径**起一个服务模拟项目页（把整个目录拷到 `<某目录>/cf-browser-game/` 再在 `<某目录>` 起 `http.server`），并**把所有 CDN 请求判失败**——这样这条用例才能真正证明「相对路径成立 + 零 CDN 依赖」，在根目录下测是测不出来的。

## 关键实现约定
- 瞄准单一数据源：`player.yaw/pitch` 为唯一朝向，**直接驱动相机**（`camera.rotation.x = player.pitch + recoilPitch`、`rotation.y = player.yaw + recoilYaw`，无缓动追赶）；移动方向与射击射线都由 `player.yaw/pitch` 计算，保证 W=视角正前方、子弹=准星方向。
- 视角控制：手动指针锁定 + `yaw/pitch`（`camera.rotation` order = "YXZ"）。
- **移动（CF 键位）**：**没有冲刺键**——默认奔跑 `RUN_SPEED=7.2`，`Shift` 是静步潜行 `SNEAK_SPEED=3.5`（且不触发脚步声），`Ctrl`（Left/Right）**按住**下蹲 `CROUCH_SPEED=3.0`。重力 `GRAVITY=21`、起跳 `JUMP_VEL=7.5`。
  - **连跳**依赖三件事同时成立：地面加速度 `ACCEL_GROUND=14` 而空中仅 `ACCEL_AIR=4`；落地时**不做速度归一**（水平动量保留）；`COYOTE_TIME=0.1` + `JUMP_BUFFER=0.12`（`dt` 被 clamp 到 0.05，严格同帧的 `keys["Space"] && onGround` 会漏掉落地帧）。
  - **落地缓冲走独立的 `player.viewDip`**，只在 `loop()` 的 `camera.position.set` 那一行相减；**绝不写进 `player.eyeH`**——`eyeH` 只由蹲伏驱动（站立 `EYE=1.62` ↔ 蹲下 `CROUCH_EYE=1.02`，速率 22/dt），混用会破坏蹲伏过渡。下蹲不阻塞切枪与开火。
  - 脚步声由 `strideAcc` 按水平速度累计步频触发；静步或空中不触发。
- 弹道=准星中心：子弹射线方向 `Euler(player.pitch + recoilPitch, player.yaw + recoilYaw)`，**不做任何随机散布**，保证准星所指必中（被实体掩体挡住除外）。
- 后坐力：用独立变量 `recoilPitch`（每枪加约 0.008，逐帧 `-= dt*0.55`）临时抬枪口 + `recoilYaw`（每枪加随机横向 ±0.006，逐帧乘性衰减）轻微侧晃，**不写入 player.pitch/yaw**，避免污染基础瞄准；**本枪后坐必须在命中处理之后才累加**（`fire()` 先用相机当前朝向发射，再把后坐加到后续子弹），否则首枪就比准星所见提前抬一枪的量（20m 处约 0.16m，足以越过头部）。**视模后坐是纯视觉的独立系统**：`owned[id].state.ks` 是每把枪一份的**临界阻尼弹簧**状态（`back/up/pitch/roll/yaw` 五轴，每轴 `{p,v,amp}`），`triggerKick(id, seed)` 按 `amp·rate·e` 给各轴一个冲量（`rate = 1/峰值时间`，反向由 seed 只在横向两轴上选符号），`animateWeapon` 每帧把各轴推进 dt 后取 `p` 作为 `kBack/kUp/kPitch/kYaw/kRoll`。**注意方向**：后坐是把枪往玩家方向推 —— 位置是 `bz + kBack`（`+z` 朝玩家），旋转是 `+kPitch`（绕 +x 抬枪口）。它**不写入 `recoilPitch/recoilYaw`**，与相机后坐完全解耦。
  - **必须用解析解步进，不能用显式欧拉**：`p(t) = (p₀ + (v₀ + r·p₀)·t)·e^(-r·t)`、`v(t) = (v₀ - r·(v₀ + r·p₀)·t)·e^(-r·t)`。欧拉的阻尼项一旦 `2·r·dt > 1`（r=16 即 dt>31ms，也就是 30fps 以下）会把速度一步推成负值，后坐直接消失；dt 被 clamp 到 0.05 时更会发散（实测幅度爆到 2.76）。解析解与帧率完全无关，峰值恒等于 `KICK` 表里填的值。
  - 单发峰值出现在 `t = 1/rate`，**永不过冲**（旧的 `exp(-rate·t)·sin(freq·t)` 是欠阻尼，会穿过静止位再弹回来，看着像橡皮筋）。连发时冲量自然叠加成持续抬枪，各轴用 `amp * 1.7` 封顶，免得长按扫射把枪折进肩膀里。
- **双通道视模渲染（`vmScene` + `vmCamera`）**：武器与手臂**不在主场景里**，而是挂在 `vmCamera`（原点、单位变换、`fov = BASE_FOV` 固定不跟随开镜、`near = 0.01`、`far ≈ 5`）下。渲染两遍：`renderer.autoClear = false` → `clear()` → `render(scene, camera)` → `clearDepth()` → `render(vmScene, vmCamera)`。**这就是「枪和手插进集装箱」那个穿模的解法**，也顺带让手臂永远不被掩体挡住。
  - **`vmScene.add(vmCamera)` 是必须的**：`WebGLRenderer.render(scene, camera)` 只遍历 scene 自己的层级，**挂在相机下、而相机不在场景里的对象永远不会被渲染，且不报错**（历史 bug：武器组挂在 `camera` 下、`camera` 不在 `scene` 里，那才是「枪口火光渲染在世界原点」那类问题的同一族）。两盏 vm 灯与 `vmCamera` 自己都 `add` 进 `vmScene`。
  - **`renderer.clear()` 不能省**：纹理背景走 `boxMesh` 路径且 `depthWrite:false`，只重绘颜色、不清深度，不显式清就会残留上一帧的深度把新帧挡掉。
  - **`vmScene.background` 绝不能设成天空贴图**（也不加雾）：那会在视模通道里铺一张全屏天空，把世界整个抹掉。同理 `autoClear` 被谁改回 true 是同一个后果。
  - **`vmScene.environment = scene.environment` 必须在 `await buildMap()` 之后设**：漏了这句，AWM 金皮（metalness 0.78）与匕首金皮（0.85）会几乎全黑 —— 高金属度表面的着色基本全靠 IBL。
  - **太阳光镜像要避开两个原地突变**：`sun.position.normalize()` 会把光源从 `(-34,78,30)` 缩成单位向量，影子相机的 `near/far` 就不再框住场景 → **影子静默消失**；`camera.quaternion.invert()` 会**改掉相机本身**，画面每隔一帧翻一次。两者都必须走 `copy()` 出来的临时量。
  - **`muzzleLight`（点光源）必须搬回主场景、挂主 `camera` 下**，`muzzleShot`（Sprite）跟着枪留在视模场景。搬错是**静默失败**：开枪不再照亮周围世界，不报错。位置每帧由 `c.group.matrix × muzzleLocal` 同步（用 `matrix` 不用 `matrixWorld`，后者要等 `vmScene` 更新过矩阵才有意义）。
  - **整个渲染段必须包在 `try/catch` 里**（`noteLoopError(err, "渲染")`）。历史上 `renderer.render` 在 try **外面**，视模通道每帧抛异常都不会进 `loopErrors` —— 而 AGENTS.md 的测试契约正是断言 `loopErrors() === 0 && lastError() === null`，会**假绿**。验证办法：给 `vmScene` 塞一个 `onBeforeRender` 里抛异常的 Mesh，断言 `lastError().msg` 命中（**注意 `lastError()` 返回的是 `{where,msg,count}` 对象，不是字符串**）。
  - **`pause()`（`__tactical` 钩子）只停 rAF、不重绘**：暂停期间做的任何状态改动（切枪、`poseReload` 定格）都不会进 `Page.captureScreenshot`，截出来是上一帧。要拍某个姿势必须先 `resume()` → 改 → `sleep(350)` → `pause()` → 截图；或者干脆全程不 pause，改用 `poseReload` 的 `reloadHoldP` 定格（循环照常跑、每帧重绘）。
- **第一人称手臂与换弹时间线**：武器组（`bx/by/bz`）下面挂 `viewArms.root`（见 `scripts/viewarms.js`）。`p = reloadT / reloadDur` 驱动一整条分段动作（下沉 → 左手离护木下探取弹匣 → 插入弹匣井 → 拍实 → 归位）。
  - **腰袋点 `POUCH` 是相机空间、弹匣井 `MAGWELL` 是武器组局部**，两者坐标系不同是**有意的**：手臂是武器组的子节点，组本身在换弹时会位移+旋转，腰袋若也用组局部就会被一起甩出画面（实测 p=0.40 时手落在屏幕 y≈1600px，整段下探全程在画面外）。`update()` 收一个「组矩阵的逆」，把腰袋点换回组局部，屏幕位置因此与枪怎么动无关。跟着 `_key()` 一起传 `invM`，漏传会退化成旧的组局部行为（看着像「手凭空消失又出现」）。
  - **`ELBOW_L_RELOAD` 也要在两套锚点之间过渡**（`w` 由 p 的 0.16→0.40 升、0.76→1.00 降）：手在护木时肘取枪上的 `elbL`，手下去掏弹匣时换相机空间的肘。全程用 `elbL` 的话前臂会横穿整个画面，像一根搁在屏幕下沿的木头。
  - **换弹时的枪身位移是「往上抬」不是「往下沉」**（`by + rDip*0.09`、俯仰 `-rRot*0.22`）。这是投影几何逼出来的：`px_y = 356.5 + 464.6·(y/(-z))`（1280×713、fov75），往下沉 y 更负、往近处拉 -z 更小，**两个方向都在放大偏移**。弹匣井在枪局部 y=-0.155，静止位算下来就已经在 `px_y≈671`（画面高 713），再沉 0.13 直接掉到 872 —— 整段「插弹匣」全在屏幕外。
  - **首尾都落在护木锚点上**，所以 p=1 时**精确回到静止姿势**（残留 < 1e-6，已断言），不会在 `updateReload` 翻掉 `reloading` 的那一帧跳一下。测试用 `__tactical.poseReload(p)` 定格 + `armsPose()` 读组局部坐标，再喂给 `project()` 换算屏幕像素 —— 调握位/查「手掉出画面」全靠这一条链路。
- **多武器系统**：`WEAPON_DEFS` 定义全部武器（AK-47/M4A1/AWM 主武器、USP 副武器、军刀近战、**手雷/闪光弹/烟雾弹三种投掷物**）。每把武器一个独立 `Group` 挂相机 child，含独立 `state`（mag/reserve/reloading/cooldown/throwCd/count）；`currentId` 为当前武器，`WEAPON_STATE = owned[currentId].state`，`cur()` 快捷取用。每把武器独立握持位（`bx/by/bz`）与 `muzzleLocal`。
  - **握持位是「手必须进画面」反推出来的，不是审美**：手心的屏幕高度 ≈ `464.6 · (y/(-z))`，握把越靠下、越靠近相机，手就越容易掉出屏幕下缘（原来 `by = -0.28` 时扣扳机那只手落在屏幕外 90px，无论手臂怎么做都看不见 —— 用户抱怨的「枪凭空浮在右下角」正是这个几何事实）。所以步枪/手枪/近战/投掷物各有一套（手枪握把更靠后，得**推远**到 `bz = -0.72` 手才落回画面内）。
  - **`reloadHoldP` 是换弹姿势的定格开关**（`__tactical.poseReload/clearReload`）：非 null 时 `animateWeapon` 用它当 `p` 而不读 `reloadT`。写 `reloadT` 只在暂停后有效，而暂停之后根本不重绘。
  - **伤害表（敌人固定 100 HP）**：AK-47 `34`（3 枪）、M4A1 `28`（4 枪）、AWM `120`（1 枪）、USP `30`（4 枪）、匕首 `75`（2 刀）；爆头一律秒杀。命中身体后按距离线性衰减：`max(0.65, 1-(d-18)/40*0.35)`。
  - **枪口火光必须用 `attachMuzzleTo(id)` 挂载**（`init()`/`gameStart()`/`switchWeapon()` 都要调）。历史上只在 `switchWeapon` 里挂，而 `gameStart()` 的 `switchWeapon("ak")` 因 `id === currentId` 提前 return，导致每局第一条命的枪口火光固定渲染在世界原点 (0,0,0)。
  - **枪口焰是程序化星芒贴图 + 每发随机，不是纯色 Sprite。** 无 `map` 的 `SpriteMaterial` 在 three 里就是**一块纯色实心方框**（旧版就是 0.45×0.45 的橙方块，枪口离相机仅 ≈0.93m，75° FOV 下约 250px、比整把枪还大）。现在 `flashTexture()` 用 canvas 生成 5 款（软核两层径向渐变 + 6~11 条角度/长度/粗细各异的尖刺 + 几粒余烬），`MUZZLE_FLASHES` 一次生成共用。
    - **贴图是白底 + alpha 形状，颜色交给 `material.color` 去乘** —— `applySkinTo` 的专属焰色（skins.js 每款皮肤的 `muzzle`）正是这么上色的；贴图自带橙黄会被色值再乘一遍变脏红。且**切 `map` 不必 `needsUpdate`**（非空 → 非空不改变 `USE_MAP` 分支），只有 `applySkinTo` 那条 null ↔ 非 null 才要。
    - **`muzzleT` 有三段语义：`MUZZLE_HOLD`(负数) = 本帧刚触发；`>=0` = 已过秒数；`Infinity` = 没在闪。** 第一版把「刚触发」也写成 0，而推进判据是 `if (muzzleT > 0) muzzleT += dt` —— 0 永远不 > 0，火光**卡在满亮永不消**（实测连打 6 发全程 `opacity=1`）。触发后停在 p=0 一帧是有意的：dt 被 clamp 到 0.05，进来就 `+= dt` 会让 20fps 下第一帧直接 p≈0.7、火光只剩 0.13 的不透明度，看着像没开火。
    - **涨消由 `animateWeapon` 每帧推进（`updateMuzzleFlash(dt)`），不能用 `setTimeout`**：旧版 `setTimeout(…, 55)` 既不受 `pause()` 影响、又与帧率脱钩（60fps 下正好一帧多就没了，掉一帧就整发不显示），连发时多个定时器还会互相踩着关灯。枪口点光源 `intensity = 2.5 * opacity` 同一份曲线。
    - 尺寸/时长按 `def.type` 取自 `MUZZLE_FLASH`（rifle 0.17/0.07s、sniper 0.21/0.10s、pistol 0.14/0.06s）。**这几个数是在 vm 通道里反推的**：Sprite 挂在武器组（= 相机空间）下、`vmCamera` 是单位变换 + fov 75，所以 `px = scale / (d·tan(fov/2)) · h/2` —— 0.17 → ≈95px、贴图里真正亮的核心约 30px。改尺寸请沿用这个换算，别靠截图目测。
    - `attachMuzzleTo` 会把在飞的火焰收掉（`muzzleT = Infinity` + opacity 0），`animateWeapon` 的 `scoped || dead` 早退分支同样要收 —— 那个早退不推进 `muzzleT`，不收的话退镜/复活时会补闪一下上一把枪的火焰。
- **武器皮肤（`scripts/skins.js` + `applySkinTo`）**：皮肤是**纯材质属性**（改 `material.color/metalness/roughness/emissive/emissiveIntensity` + 换不换 `map`），没有几何/贴图生成，所以切皮肤不需要任何缓存，开销可忽略。
  - **材质名 → 部位映射（实测，别照名字猜）**：AK `Dark_metal`=弹匣/枪机/保险等小件、`Metal`=**枪管 + 机匣（最大面积）**、`Wood`=护木/枪托；M4 `Primary`=主体、`Secondary`=深色件、`Highlight`=强调件；匕首 **`knife_s_1`=刀柄（短）**、**`knife_s_2`=刀身（长）**——匕首这两个名字是反直觉的，第一版按名字反着上色，「屠龙」就成了金刃红柄。
  - **「大面积部件」决定了皮肤的主色观感**：AK「黑武士」的金色必须放在 `Dark_metal`（小件）上。放 `Metal` 就是一把黄枪配个黑枪托，与「哑光黑 + 金线」完全不是一回事（实测如此）。
  - **`loadWeapon` 的 traverse 里必须按顺序做三件事**：①`clone()` **之前**记 `o.userData.matName = o.material.name`；②**之后**快照 `o.userData.baseMat`（color/metalness/roughness/emissive/emissiveIntensity/envMapIntensity/**map**）；③投掷物的 `def.tint` 上色必须在 base 快照**之后**（base 要记的是出厂值）。`applySkinTo` 每次先逐字段还原 base、再叠 `slots[matName]` 的覆盖项——**这是「原厂」能可靠回退的唯一前提**，也是任意两皮肤来回切不会残留上上款字段的原因（黄金AWM 的金色残留到无影的黑白上就是这么来的）。AWM 旧版那段「整个替换材质」的硬编码金色特判已删除，改走通用皮肤体系。
  - **`material.color` 是乘在 `map` 上的** → 带贴图的 AWM/USP 不能用染色做出浅色皮肤（深色迷彩 × 冷白只会得到脏橄榄）。所以规则是 **非原厂皮肤默认丢掉 `map`**（`want = (skin.id === STOCK || skin.keepMap) ? base.map : null`）。**`skin.id === STOCK` 这一支不能省**——原厂的 `slots` 是空的、根本不会写 `keepMap`，漏掉它会让「切回原厂」变成一把没有迷彩的灰枪。切 `map` 的 null/非 null 会改变着色器的 `USE_MAP` 分支，**必须同时 `m.needsUpdate = true`**。
  - **发光呼吸必须写在 `animateWeapon` 里那个 `if (scoped) { c.group.visible = false; return; }` 之前**——写在后面的话一开镜发光就停跳（那个早退是为了开镜藏枪模）。`updateSkinGlow()` 只推进 `owned[currentId].glowMats`，相位按材质下标 `i * 1.7` 错开，免得同枪多个发光件完全同步地一起闪。
  - **枪口焰是单例**（`muzzleShot` / `muzzleLight` 由 `attachMuzzleTo` 在切枪时重新挂载）→ `applySkinTo` **只改颜色、不重建、不重新挂载**。皮肤没写 `muzzle` 就还原 `DEFAULT_MUZZLE`。投掷物不吃皮肤（`findSkin` 返回 `null` → `applySkinTo` 直接 return），所以切到投掷物时焰色会停在上一把枪的值 —— 这是**无害的**，因为切回任何枪都会重新上漆覆盖掉。
  - **走 `switchWeapon` 一处挂钩即可覆盖所有入口**：`switchBackpack()` / `respawnPlayer()` / `gameStart()` 全都已经走 `switchWeapon(…, true)`，所以在 `attachMuzzleTo(id)` 旁边调一次 `applySkinTo(id, activeSkinId(id))` 就够。切投掷物也要走这一趟（要靠它把上一把枪改过的焰色还原回来）。
- **背包与切枪**：`BACKPACKS` 是 3 个背包，每个记 `{ primary, skin }`（默认 背包1=AK 火麒麟 / 背包2=M4 雷神 / 背包3=AWM 无影），**在代码里写死**——开始菜单里没有配装 UI（键位表、背包选枪行、皮肤行三者都已从首页移除，首页只剩「对局设置」）。游戏内也没有改配装的入口——背包面板与 `switchWeapon` 都不写 `BACKPACKS`（否则 debug 钩子 `switchWeapon("m4")` 会悄悄改掉背包 1）。
  - **「三背包 = 三把主武器」这条玩法没丢**：默认值恰好是 AK / M4 / AWM，所以进战场按 `B` + `1/2/3` 依然能在三把枪之间切。丢掉的只是「在菜单里自选哪把配哪个背包」。
  - **皮肤与配装机制整体保留**：`BACKPACKS[i].skin` / `GEAR_SKIN` / `skinForGun()` / `activeSkinId()` / `applySkinTo()` 以及 `__tactical.setSkin` / `skinState` 全部照常生效，删掉的只是 UI，不是能力。默认值与 `skins.js` 的 `DEFAULT_SKIN` 一致，所以「不做任何选择」得到的就是原来那套皮肤。
  - **`skinForGun()` 现在是"没有调用点"的守卫**：它唯一位于菜单选枪按钮里的调用点随 UI 一起删了。函数**保留**是有意的 —— 「M4 不许挂着 AK 的 skin id」这条不变式依然成立，只是触发点变成 `__tactical.setSkin` 这类程序化改动。删掉它等于把这条不变式重新变成「靠调用方自觉」。
  - 首页的「对局设置」（敌人数步进器 + 难度三档）由 `buildMenuMatch()` 生成，**全量重建**，状态存在 `enemyTarget` / `difficultyId` 两个模块级变量里。
  - **皮肤归属**：主武器皮肤**按背包各配一份**（`BACKPACKS[i].skin`，CF 原版逻辑「背包 = 武器 + 皮肤」）；副武器/近战是**全局一份** `GEAR_SKIN = { pistol, knife }`——因为 `BACKPACKS` 里根本没有副武器/近战的选择，按背包分只是「无差别的差别」。`activeSkinId(id)` 是唯一的取用点（主武器读当前背包、pistol/knife 读 `GEAR_SKIN`、投掷物返回 `null`）。
  - **换主武器时必须过 `skinForGun(新枪, 原 skin)` 校验归属**，不匹配就回退到 `DEFAULT_SKIN[新枪]`。不做这层校验会出现「M4 挂着 AK 的 skin id」——`findSkin` 找不到会按原厂处理（枪变黑），菜单却高亮着一个不存在的项，看起来像皮肤丢了。`activeSkinId` 假定「当前背包的主武器就是手上这把枪」，**直接改 `BACKPACKS[i].primary` 的测试代码必须先同步皮肤**，否则会取到别的枪的 skin id（实测踩到，见下方测试注意）。
  - 数字键 `1` 切到**当前背包的主武器**（`equippedPrimary()` → `BACKPACKS[curBp].primary`）、`2` 副武器、`3` 军刀、`4` 投掷物循环（手雷→闪光→烟雾，只在还有存货的种类间轮换）；`Q` 快速在主/副武器间切换。切枪为**即时生效、无前后摇**：`switchWeapon` 直接更新 `currentId`/显示/枪口火光，不设 `switching` 门闸，`fire/meleeAttack/throwGrenade` 与 `animateWeapon` 均不因切枪受阻，切枪后立即可开火。换枪一律退镜。
  - **`1` 不许按 `PRIMARY_IDS` 轮换**（`switchToPrimary()` 只做 `switchWeapon(equippedPrimary())`）。历史上这里是 AK→M4→AWM 轮换，于是「在背包选了 3 号 AWM，回头按一下 1」会从 AWM 的下一位绕回 **AK**，看起来就像背包选择被丢掉了。**选主武器的入口只有菜单配装**——与 CF 一致（CF 的 1 只是切到主武器槽，不轮换）。已拿着该枪时 `switchWeapon` 因 `id === currentId` 直接 return，按 `1` 无副作用。
  - **`switchWeapon(id, force)` 的 `force` 参数**：`force=true` 时即使 `id === currentId` 也重做显示与挂载。开局/复活必须传 `true`，否则 `currentId` 恰好就是目标枪时提前 return，武器组可见性与 `attachMuzzleTo` 都不刷新（枪口火光会留在世界原点——就是那个历史 bug 的复现路径）。`equippedPrimary()` 里那层 `owned[id] ? id : "ak"` 防御性回退也不能删——`switchWeapon` 对未加载的 id 是**静默 no-op**，会让 `currentId`/可见性/枪口火光全部停在旧状态。
  - **「按 1 跳回 AK」的历史根因是死亡，不是 1 键。** `respawnPlayer()` 与 `gameStart()` 历史上都硬编码 `switchWeapon("ak")`；AK 的 `slot` 是 `primary`，旧版 `switchWeapon` 会顺手把「已选主武器」也改成 `"ak"`，于是玩家选的 AWM 死一次就永久丢失，症状却长得像 `1` 键轮换。两处都改走 `equippedPrimary()`。
  - **切背包（`B` 面板 + 数字键，按 CF 原版限制）**：`B` 开面板后 `1/2/3` 选的是**第几个背包**（此时这些数字键不再切槽位，走早退分支）；小键盘无效、与 CF 同。限制 `canSwapBackpack()` = `state === "playing" && !dead && inSpawnZone() && !actedThisLife`——复活点安全区内（以 `(0, bounds.hl - 6)` 为心、半径 `SPAWN_SAFE_R = 9`，正是 `respawnPlayer()`/`gameStart()` 的复活点）、且本回合未行动。
    - `fire()`/`meleeAttack()`/`throwGrenade()` 在各自守卫**之后**置 `actedThisLife = true`（换弹**不算**行动，与 CF 一致）；`respawnPlayer()`/`gameStart()` 清回 `false`。`actedThisLife` 的置位点必须在守卫之后，否则「被冷却挡下的那一发」也会把本回合锁掉。
    - 被拦时不切枪、**面板保持打开**（免得玩家以为点空了），`swapBlockReason()` 统一给三种原因：阵亡中 / 本回合已开火 / 不在安全区。**`switchBackpack` 的 toast 与 `updateBackpack` 的 `#bpHint` 共用这一份**——照着旧写法各写一套两分支 `inSpawnZone() ? … : …` 会让「阵亡中」误报成「已开火」（实测踩到）。
  - **背包状态不拆成 3 套（等价性论证）。** 上面的限制意味着**每次合法换包都必然发生在满弹状态**：只能在复活点、且本回合没行动时换，而一旦行动本回合就锁死了。也就是说背包 A 被换下时它永远是满弹的——**每个背包的弹药/换弹状态是否独立，在游戏里根本观察不到**。所以沿用「每把枪一份 `owned[id].state`」即可，不需要 24 个状态对象、更不需要换包时搬运状态指针（那种做法一旦有代码缓存了 state 引用就会静默串台，是真正的坑）。**背包只决定「当前主武器是哪把」。**
    - **这个等价性只在上述限制成立时有效。** 若以后要改成「随时可切」，必须再拆成每背包一套状态——届时 `respawnPlayer()`/`gameStart()` 里那两个 `for (const k in owned)` 全量重置循环是必须同步改的地方。
- 射击：`Raycaster` 命中检测，把敌人/障碍拍平成纯 Mesh 列表做**非递归** `intersectObjects(meshes,false)`；**命中头部一击必杀**（伤害取 `enemy.health`，身体命中才用 `def.stats.dmg`）。按 `def.type` 分流：`melee`→`meleeAttack()`（短距射线近战，爆头同样秒杀）、`grenade`→`throwGrenade()`（`updateGrenades` 每帧推进）。
  - **射速闸门是每把枪一份的 `state.nextFireAt`（下次可开火的绝对时刻），不是模块级共享变量。** 曾经用一个全局 `lastFire` 去比「当前武器的 `fireInterval`」——那是拿 A 枪的间隔去卡 B 枪：AWM 打一发再切 M4，M4 会被 1.25s 的狙击间隔钉住，与「切枪即时生效、切枪后立即可开火」的约定相反。绝对时刻不需要逐帧递减，天然不受「只递减当前武器」的限制。`respawnPlayer()`/`gameStart()` 里连同 `cooldown` 一起归零。
  - 注意 `state.cooldown`（0.07s 的防连点）**只对当前武器递减**（主循环里 `if (WEAPON_STATE.cooldown > 0) ...`）。换走的枪冷却会被冻结到换回来才继续走——0.07s 的量级无感，但写测试时别依赖它（低帧率下要好几帧才归零）。
  - **`obstacleFlat` 必须用拍平后的列表**：`map.obstacles` 是 Mesh 与 Group 混装（实测 106 顶层 Mesh + 28 Group 内含 392 Mesh），`intersectObjects(obstacleMeshes, false)` 会**静默漏掉 Group 内的全部实体**——集装箱全是 Group，等于掩体完全不挡视线（实测 10 个箱体 0 命中）。初始化时拍平一次存进 `obstacleFlat`，`flatTargets()`/`enemiesShoot()`/`detonateFlash()` 全部用它（顺带免掉每次射击的 traverse）。
- **投掷物三件套**：`frag`/`flash`/`smoke` 各自独立 `count` 与冷却，`grenadePool` 条目带 `kind` 字段分流。
  - 落地物理：只在**真正撞击的那一帧**施加阻尼（`vel.y < -0.5` → 反弹 ×0.38、水平 ×0.72），贴地后改为按时间的摩擦 `1 - dt*2.2`。写成每帧乘一次会把水平速度迅速压成 0（手雷扔出去 2.2 秒只挪十几厘米）。
  - 手雷：半径 6.5m、中心 100 线性衰减的 AoE；对玩家按距离自伤，自伤传 `byEnemy=false` 不计敌方比分。
  - 闪光弹：强度 `clamp01(1-dist/22) * (0.35 + 0.65*max(0,dot(相机前向, 指向闪光)))`，**被掩体挡住则不生效**（用 `obstacleFlat` 射线判定）；玩家白屏走每帧写 `#flashOverlay` 的 `opacity`（前段死白 + 长尾 `pow(1-(p-0.12)/0.88, 2.2)`），敌人 `blindAll()` 致盲期间停火。
  - 烟雾弹：每颗 14 个 Sprite（"少而大"控制半透明 overdraw），材质 `NormalBlending` + `depthWrite:false` + `depthTest:true` + `renderOrder:10`；2.5s 膨胀到半径 5.4m；**绝不放进 `obstacleMeshes`**（子弹要穿烟），单独维护 `smokes[]`，用线段-球最近距离在 `enemiesShoot()` 的 LOS 循环里做遮挡判定。
- **AWM 开镜（右键）**：CF 同款**两级变倍** —— `scopeStage` 记 0/1/2，右键循环「退镜 → 一级镜(fov 22) → 二级镜(fov 11) → 退镜」，`scoped` 只是它的布尔视图（旧调用点照旧读 `scoped`）。只改 `camera.fov`、灵敏度和移速（一级 ×0.35 / 二级 ×0.22；移速 ×0.42），**不碰 `player.pitch/yaw`**——子弹方向由 `Euler(pitch+recoilPitch, yaw+recoilYaw)` 决定，完全独立于投影矩阵。开镜时隐藏武器组（`animateWeapon` 里 `c.group.visible = !scoped`）、显示 `#scope` overlay（`.x2` 收窄镜筒）、呼吸晃动只写 `camera.rotation.z`。`pointerlockchange`/`gameStart()`/`respawnPlayer()` 都要退镜。
  - **开火强制退镜**：`fire()` 里 `if (def.type === "sniper" && scoped) setScoped(false)`，这是 CF 的狙击惯例，顺带避免 0.05 的狙击后坐在 22° 视场里被放大 4 倍糊住画面。
  - **半自动不许按住连发**：主循环的自动开火必须门在 `WEAPON_DEFS[currentId].fullAuto` 上，否则按住左键 AWM 会按 1.25s 间隔自己一枪枪打出去。
  - **右键判定不能裸写 `e.button === 2`**：macOS 触控板的 Ctrl+单击在 Chrome 里报的是 `button:0 + ctrlKey:true`，会掉进开火分支——这正是「切到 AWM 却右键没反应」的原因。统一走 `isSecondaryClick(e)`（`button===2 || which===3 || (Mac && button===0 && ctrlKey)`）。另有 `V` 键兜底开镜，`contextmenu` 只要进了战场就 preventDefault（不再只看 `locked`，避免锁失效时弹出菜单让右键「看起来没反应」）。
  - **但 Ctrl 在本作里是蹲 —— 「Ctrl+单击当右键」与「按住蹲下再开枪」在事件层完全同形**（都是 `button:0 + ctrlKey:true`），上面那条一开始直接把蹲着开枪全吞了（步枪因为 `applyScope` 对无镜武器是 no-op，症状是「点了毫无反应」，连 `fireEnabled` 都没置位、自动连发一起哑）。现在 `isSecondaryClick` 分三层：
    1. `button===2 || which===3` → 右键（真右键永远优先）。
    2. Mac 且 `button===0 && ctrlKey`：**当前武器没有 `stats.zoom` 就直接返回 false** —— 步枪/手枪/刀/投掷物无镜可开，绝不吞枪。这条同时让 AK/M4（绝大多数对局）完全免疫这类误判。
    3. 有镜的武器（AWM）才看时间：`performance.now() - crouchDownAt <= CTRL_CLICK_MS`(250ms) 才算「Ctrl 刚按下就点」的右键手势，否则是蹲着开枪。分不清时**一律偏向开火**。
  - **`crouchDownAt` 必须按「抬起→按下」的状态跃迁记录（`if (!keys[IS_CROUCH]) crouchDownAt = performance.now()`），不能写 `if (!e.repeat)`。** 系统对按住不放的键会**持续补发 keydown**（实测一次 rawKeyDown 之后 500ms 内补发了 ~180 次、间隔 1~25ms），而这些补发事件的 **`e.repeat` 恒为 `false`** —— 每次 keydown 都刷新时间戳的话，按住 Ctrl 期间 `held` 永远是 0，第 3 层恒判为右键手势，AWM 就变成「蹲着按左键只会开镜/退镜、永远打不出子弹」。跃迁写法对 `repeat` 是否可靠完全不敏感。
  - **测这一条要用 `setCrouch(false)` 造干净状态，不要指望真的能把 Ctrl 抬起来**：无头 Chrome 会一直补发 Ctrl 的 keydown，`keys.Crouch` 几乎回不到 false，「新按下」这个跃迁在裸按键序列里造不出来。用例（无头 Chrome + CDP，临时脚本）6 条：AK 蹲着开枪 / AK Ctrl 刚按下 / AWM Ctrl 刚按下→开镜不掉弹 / AWM 蹲着开枪→开火且退镜 / 真右键开镜 / 无 Ctrl 左键开火。**AWM 那条要等过 1.25s 的 `nextFireAt`**，否则会把「射速闸门」误判成「没开火」。
- 武器模型：AK-47/M4/AWM/手枪/匕首挂 **`vmCamera` 子节点 weapon 组**（`loadWeapon` 里 `vmCamera.add(group)`；首帧初始主武器 AK 由 `viewArms.attach(owned.ak.group, "ak")` 挂上手臂）；加载后按包围盒归一化长度、按 `def.rotY` 旋转（如 AK 枪口在本体 -x，绕 Y 转 **-90°** 使枪口朝本地 -z=正前方）；枪口锚点取枪管前端。AWM 单独应用「金色高光涂装」（metalness≈1、roughness≈0.16）；三种投掷物共用 `grenade.glb`，靠 `def.tint` 上色区分。`scene.environment` 来自 `map.js` 的天空贴图，为金属/金色提供环境反射。
- 敌人进攻：从敌方基地（-z 端）刷出，追击至射程内开火，先做视线遮挡判定（障碍 + 烟团）再判定命中概率（概率随距离下降，且玩家移动时更难被击中）；带简单障碍规避、点射与左右走位。
- 敌人模型：**不再注入 GLB 模板**。每个 `Enemy` 在构造时 `new SoldierRig(enemyManager.rifle)` 现搭一副可动骨架（见 `scripts/enemy_model.js`），身高约 1.82；头部网格打 `userData.part="head"` 供爆头；骨架自带每敌人独立材质（受击闪红互不串）。枪口火光/枪声定位用 `e.muzzleWorld()`。
- 启动加载：`init()` 内 `await Promise.all([loadAK(), loadWeapon(pistol), loadWeapon(knife), loadWeapon(frag/flash/smoke), loadEnemyRifle()])` 确保枪械/近战/投掷/**敌人用步枪模板**就绪后再进入游戏（士兵骨架不需要加载；初始主武器 AK 可见，并立即 `attachMuzzleTo("ak")`）。
- 地图碰撞：集装箱/平台/油桶木桶等以 AABB `colliders {x,z,hx,hz,h}` 表示，玩家分轴解算碰撞；修改布局需同步维护。
  - **`y0` 是可选的下沿高度**（默认 0），专给**悬空结构**用：栈桥、屋顶板、通风管都靠它才能「脚下能走、头上能站」。两条判据都要认它：
    - `blockedBy(x,z,feetY)`：`c.y0 !== undefined && c.y0 >= feetY + PLAYER_TOP` 时**放行**（人从底下走过去）；否则按矩形外扩 `PLAYER_RADIUS` 且 `c.h > feetY + STEP_H` 才算挡住。
    - `supportAt(x,z,feetY)`：用**未外扩**的矩形取「`c.h <= feetY + STEP_H` 的最高 `c.h`」，且 `c.y0 > feetY + STEP_H` 的跳过。
  - `y0` 出现之前，「屋里能进人」和「屋顶能站人」在同一个 AABB 里是互斥的（要么屋顶是实心整块、进不去屋；要么屋顶留洞、人掉进去）。**新增悬空结构一律走 `y0`，不要再做「只有边上有一圈碰撞」那种环**（见 `map.js` 屋顶那条）。
  - 敌人在自己的 `avoid()` 里**必须过滤掉 `c.y0 >= 1.2` 的碰撞体**（桥/屋顶在敌人的高度上什么都没有）。不过滤的话桥下的整条通道对 AI 变成死路，敌人永远走不过中路。
- 团队竞技（Team Deathmatch）：`TDM_LIMIT=40`、`TDM_SPAWN_INTERVAL=2.4`、`TDM_TIME=600`（10 分钟倒计时）。双方比分 `kills`（我方/蓝队）/`enemyScore`（敌方/红队）；**结束条件三态**——先到 40 击杀，或倒计时归零时比分领先；`endTDM(result)` 接受 `"win" | "lose" | "draw"`（也兼容旧的 `true/false`），平局显示「平局 / DRAW」。结算面板用 `goTitle`/`goSub`/`goMine`/`goEnemy`/`goLimit`。
- 敌方刷出：`enemyManager.spawnGroup(count, bounds)` 仅在敌方基地（-z 端）刷敌；`refillEnemies()` 把在场敌人补到 `enemyTarget`，主循环用 `spawnAcc` 计时（每 `TDM_SPAWN_INTERVAL` 秒补一次）。
- **敌人数与难度（开局菜单选，对局中可调）**：`TDM_TARGET` 那个常量已删除，改成可变的 **`enemyTarget`**（`ENEMY_MIN=1` / `ENEMY_MAX=8`，默认 8），**唯一数据源**，菜单与对局共用一份。
  - 菜单里 `#enemyMinus`/`#enemyPlus` 步进 + 难度三档 `#mlDiff`，都在 `buildMenuMatch()` 里按 `DIFFICULTIES` 重建，所以**状态必须存在模块级变量里**（`enemyTarget` / `difficultyId`），不能只放 DOM。
  - 对局中 `+`（`Equal` / `NumpadAdd`）/ `-`（`Minus` / `NumpadSubtract`）每次增减 1 人，仍夹在 1~8。判定用 **`e.code` 而非 `e.key`**（`+` 在不同布局/输入法下 `e.key` 不一样；Shift+Equal 与小键盘加号是稳定的物理键）。这两行放在 `if (state !== "playing") return;` **之后**、`if (dead)` **之前** —— 死亡视角那 3 秒里也能调人数是有意的。
  - `DIFFICULTIES` 三档（`easy/normal/hard`）各带 5 个乘数：`dmg` / `acc` / `speed` / `pause` / `aggro`（简单 0.6/0.65/0.85/1.5/0.7、普通全 1、困难 1.25/1.35/1.12/0.7/1.3）。`applyDifficulty()` 把它们 `Object.assign` 进 `scripts/enemies.js` 导出的可变对象 **`ENEMY_TUNING`**，敌人在 `reset()`/`updateBurst()`/`update()` 里**现读**它 —— 所以换难度**立刻作用于下一次点射与下一个刷出的人，但不会回溯改已在场敌人的 `damage`/`speed`**（那是在 `reset()` 里赋的值）。**写测试时必须先改难度再重开一局（或重刷）再断言**，直接对场上敌人断言会拿到旧难度（实测踩到）。**敌人 HP 固定 100，不进难度表**，为的是保住「AK 三枪死」这条数值。
  - **`setEnemyTarget(n)` 是一个原子操作：变量、在场实例、名册三处必须一起改。** 只改 `enemyTarget` 会留下两种不一致：**调大**时 `refillEnemies()` 会补人但名册没条目，`bindRoster` 走到兜底的 `|| roster[0]`，两个敌人共用一条 → 阵亡时战绩互相覆盖；**调小**时 `refillEnemies()` 的 `alive >= enemyTarget` 恒成立、直接 return，多出来的人永远不下线。
    - **下线敌人绝不能设 `e.dead = true`** —— 下一帧 `EnemyManager.update()` 会把它转入 `corpses`、播一遍倒地动画，并经 `onEnemyDeath` 记一次阵亡：语义就变成了「被打死」（会白送对面一分、还在击杀信息条上冒一条）。正确做法是「解绑名册（`slot.enemy = null; e.roster = null`，**不记 `deaths++`**）→ `enemyManager.release(e)`」，最后一次性 `enemyManager.enemies = list.filter(...)` 摘除。
    - **名册裁剪绝不调 `initRoster()`** —— 它会清空全部 `kills`/`deaths`/`playerDeaths`。用 `resizeRoster(n)`：变长就 push 新条目；变短先**从尾部**摘掉 `enemy === null` 的空闲条目（不动战绩），仍超长才强删并解绑。被裁掉那些条目的战绩是有意丢弃的（人少了，槽位也少）。
  - `gameStart()` 里顺序不能乱：`applyDifficulty()` 必须在刷人**之前**（`Enemy.reset()` 现读 `ENEMY_TUNING`），`enemyTarget` 必须在 `initRoster()` **之前**定好（名册长度 = `enemyTarget`）。
  - HUD 顶部 `.rb-mid` 的 `#enemyNumVal` 与菜单步进器 `#enemyCountVal` 由 `refreshEnemyCountUi()` 一起写，**只在「人数变了 / 新开一局」时写、不做每帧更新**（免得踩 `renderScoreboard()` 那种「面板隐藏就早退」的坑）。
- 玩家死亡不再结束游戏：`damagePlayer(amount, byEnemy=true, killer=null)` 血量归零时敌方 `enemyScore+1`（手雷自伤传 `byEnemy=false` 不计入敌方），随后进入 **3 秒死亡视角**再复活（见下节）。复活回出生基地（`player.pos.set(random±5,0,bounds.hl-6)`）、血量回满、补充弹药、授予 `player.invuln`（约 1.2s 复活保护，受伤前判定 `invuln>0` 则忽略伤害），并退镜、清闪光。
- **死亡流程（击杀者信息 → 3 秒死亡视角 → 延迟复活）**：血量归零调 `beginDeath(killer, byEnemy)`，**不再当场 `respawnPlayer()`**。`dead` 从此多了一层语义——**「正在死亡视角中」**（复活时才由 `cancelDeath()` 清掉），`canSwapBackpack()` 的「阵亡中」提示因此自动正确。
  - `DEATH_DELAY = 3.0`（`deathT` 倒计时）、`DEATH_TURN = 0.9`（头 0.9s 转完，余下停在击杀者方向）。推进写在主循环 `update(dt, rawDt)` 里（`deathT -= ddt` → `stepDeathCam(ddt)` → `updateDeathBar` → `deathT <= 0` 时 `respawnPlayer()`），**不用 `setTimeout`**：① 转向本来就要逐帧插值；② `__tactical.pause()` 只停 RAF，用 dt 才能连死亡视角一起冻结（旧 `TDM_RESPAWN` 那个 `setTimeout` 既不受 pause 影响、**又没有 clearTimeout**，重开一局/连死会残留）；③ 顺带消灭了那个野定时器。
  - **死亡计时必须走 `rawDt`（真实帧间隔），不能用被 clamp 到 0.05 的 `dt`** —— 这是本流程最容易踩且最像「游戏卡死」的坑。`dt` 的 clamp 是给物理/碰撞用的（低帧率下单帧位移不失控），而死亡停顿是**纯计时**：用 dt 的话 3 秒会被拉长成「20fps → 6 秒、软渲染 1.6fps → **37 秒**」，玩家看到的就是「被打死后画面定住不动了」。`loop()` 里两个都算好（`rawDt` 原始、`dt` clamp 后），`update(dt, rawDt)` 只把 `rawDt` 交给死亡计时与死亡镜头（`const ddt = Math.min(1, rawDt)`，上限 1 秒只是防标签页切回来时一帧把死亡跳完）。实测 60fps 下恰为 3.002s。
  - **镜头转向走加法偏移 `deathCam.yawOff/pitchOff`，绝不写回 `player.yaw/pitch`**（与 `recoilPitch/recoilYaw` 同一套模式，只叠在 `camera.rotation.x/y` 那一行）。朝向公式照抄 `showHitDir()`：`toYaw = Math.atan2(-dx, -dz)`、`toPitch = Math.atan2(dy, 水平距)`，`dYaw` 必须过 `normAngle()` 走最短弧；`toPitch` 要 clamp 到 `±(π/2 - 0.05)`，否则「仰头时被脚下的人打死」会让镜头翻过去。**击杀者世界坐标读 `killer.group.position`**（不是 `killer.root.position`）。自杀（`killer === null`）时 `dYaw/dPitch` 为 0，退化成镜头不转，面板文案换成「自己的手雷」。
  - **`damagePlayer()` 开头必须 `if (dead) return;`**：死亡那 3 秒里 `enemiesShoot()` 照常朝尸体开火，少了这句会反复走死亡分支，比分/名册/击杀条被重复记账。
  - **`movePlayer(dt)` 只门控「输入读取」（局部 `const canAct = !dead;` 包住 WASD / 蹲与静步 / 跳跃缓冲），不能整块跳过**——跳过的话重力也停了，空中阵亡的尸体就挂在天上 3 秒。碰撞与落地照常。跳跃那一段**两处**都要带 `canAct`：只挡缓冲的写入不够，尸体会带着上一帧的缓冲蹦起来（`canAct && keys["Space"]` 与 `canAct && player.jumpBuf > 0 && player.coyote > 0`）。
  - **死亡面板的 DOM 取用一律判空**（`showDeathPanel`/`hideDeathPanel`/`updateDeathBar` 三处）。`cancelDeath()` 会被 `gameStart()` 第一行调到，一旦它抛异常，整局就毁在「`state` 已置 playing、但 `initRoster()`/`refillEnemies()` 都没跑」的半截状态：敌人永远刷不出来、名册为空、每 2.4 秒在 `bindRoster` 抛一次 `Cannot set properties of undefined (setting 'enemy')`、画面停住。触发条件很现实——浏览器缓存了没有 `#deathScreen` 的旧 `index.html`（`http.server` 不带缓存头，实测复现过；修好后同一个场景 8 个敌人正常刷出、死亡→复活全程零报错）。
  - 其余门控：`mousemove`/`mousedown`、`fire()`/`meleeAttack()`/`throwGrenade()` 各加 `dead`；`keydown` 在 `state !== "playing"` 之后加一层 `if (dead) { …preventDefault 空格与方向键…; return; }` 挡掉 R/1/2/3/4/Q/B；`animateWeapon` 用 `if (scoped || dead) { c.group.visible = false; return; }`（**必须放在 `updateSkinGlow()` 之后**，遵循发光呼吸那条既有约束）。
  - **`cancelDeath()` 的调用点一个都不能漏**：`respawnPlayer()` 结尾、`gameStart()`（替掉原来的 `dead = false`）、`endTDM()`。少了 `endTDM()` 那一处，死亡中回合结束会在结算画面上照样瞬移回出生点并弹「已复活」。
  - **三层兜底：任何一处抛异常都不许让玩家「永远卡在死亡态」或让画布冻死。** 起因是 `sfx.muffle is not a function` 那次事故（见 `audio.js` 一节）——异常发生在 `update()` 里时，`renderer.render` 是 `loop()` 的最后一行，于是**画布永久停在最后一帧**，用户只看到「卡住」，控制台之外没有任何提示。
    - `loop()` 里 `update()` + `animateWeapon()` 整体 `try/catch`（`noteLoopError` 只报一次同消息，并留底到 `__tactical.lastError()`/`loopErrors()`）→ 逻辑坏了也照常出画面。**代价：被吃掉的异常不再冒泡到 `window.onerror`，写测试必须断言 `loopErrors() === 0`**，否则会「假绿」。
    - 死亡块里 `respawnPlayer()` 单独 `try/catch`，catch 里 `cancelDeath()` → 复活过程哪怕炸了也一定解除死亡态。
    - `armDeathWatchdog()`：死亡期间每 1.5 秒检查一次，**判据是 `frameCount` 有没有推进**（不是墙上时钟——低帧率机器上倒计时本来就会慢于真实时间，实测 1.2fps 下 3 秒要走 6.4 秒墙上时钟，按秒数判会把好机器误判成卡死）；只有「整整 1.5 秒一帧都没动」才由兜底直接复活。`cancelDeath()` 里 `clearTimeout`，每次 `beginDeath` 重挂。唯一的副作用：`__tactical.pause()`（只停 RAF）期间死亡视角不再被冻结，兜底会照常复活。
  - `bindRoster()` 开头有 `if (!roster.length) initRoster();` 自愈：`gameStart()` 把 `state = "playing"` 放在**第一行**，一旦它中途抛异常，名册就停在 `[]` 而 `update()` 照样跑 `refillEnemies()`，于是每 2.4 秒抛一次 `Cannot set properties of undefined (setting 'enemy')`（实测踩到）。
  - UI 是 `#hud` 内的 `#deathScreen`（层内 z-index 4，天然压住 `.scope` 6、低于 `.fx-layer` 8），红晕 +「你被击杀」+ 击杀者名 + 武器 + 倒计时条；**进度条每帧写 `width`、不做 CSS 动画**（与 `#crosshair` 每帧写 `--gap` 同一套做法，CSS 动画跟不上 `pause()`/变速）。敌人没有 weapon 字段，全体共用 `const ENEMY_WEAPON = "步枪"`，死亡面板与 `pushKillFeed` 两处同源。
- HUD：顶部单条计分板 `teamScoreVal`（蓝）/`roundTime` 倒计时/`limitVal` 目标/`enemyScoreVal`（红）；左下 `hpVal`+`hpFill`；右下 `weaponName`+`ammoVal`+`ammoFill`；右上 `killfeed`；中上 `streak`；中心 `killIcon` 与 `hitdir`。`pushKillFeed()`/`showStreak()`/`showKillIcon()`/`showHitDir()` 驱动，连杀播报同时走浏览器语音合成（失败静默降级）。
- **战绩面板（按住 Tab，与 CF 一致）**：`#scoreboard` 插在 `#hud` 内，左右两列各「名字/击杀/死亡」，表头是我方·保卫者 vs 敌方·潜伏者 + 目标击杀。
  - **统计必须挂在名册上，不能挂在敌人对象上。** `EnemyManager` 是对象池（`free`/`acquire`/`release`），同一个 `Enemy` 实例会反复易主；把 `kills/deaths` 存在 `Enemy` 上会在复用后串台。`roster` 是长度 = `enemyTarget` 的**常驻条目**数组，`bindRoster(e)` 在补员时把条目挂到敌人（`e.roster`），`onEnemyDeath()` 记 `deaths` 后**解绑**（`roster.enemy = null`）——名册条目活过敌人的一生。对局中改敌人数时由 `resizeRoster()` 跟长度（见上节）。
  - 玩家侧只有一行（`PLAYER_NAME = "你"`），`kills` 直接复用 TDM 比分，死亡数走 `playerDeaths`（`damagePlayer` 里自增）；击杀者的 `roster.kills` 由 `damagePlayer(amount, byEnemy, killer)` 的 `killer` 参数归属。
  - 浮层是 `pointer-events:none` + 半透明暗底，**不能挡住准星与开火**；`renderScoreboard()` 有 `sbAcc` 节流（0.2s）避免每帧重排 DOM，且面板隐藏时直接 return。
  - 收起时机一个都不能漏：Tab `keyup`、`window` `blur`、`pointerlockchange`（失锁）、`gameStart()`、`endTDM()`。`gameStart()` 还要 `initRoster()` 清零上一局的击杀/死亡。
- 命中与受击特效复用单一粒子池（`pool`），按 `emit(point, hex, big, vel, grav, life)` 发射；命中敌人喷**血雾**（红、带重力），命中掩体喷**火花/尘**，二者共用池子避免频繁创建/销毁。

## 注意事项
- 地图集装箱/平台坐标与 `map.js` 中 `colliders` 一一对应，移动模型需同步碰撞。
- 新增音效统一走 `SFX`（Web Audio 合成），保持无外部资源依赖。枪声 `shoot(kind)` 分武器类型（rifle/sniper/pistol）多层合成（crack+body+低频冲击+弹壳`叮`+金属货舱反射），并在 `ensure()` 内建 ConvolverNode 空间混响总线 `send(node)` 提升真实感；`sfx.shoot(def.type)` 由 `fire()` 传入。
  - **信号链**：`master` → `muffle`（lowpass，常温 20000Hz 即全通）→ destination。闪光耳鸣的闷音只需把 `muffle` 频率拉低，混响尾巴在链路上游会一起被闷住。**耳鸣（4.4kHz）必须走独立的 `hf` 总线直连 destination**，否则会被 700Hz 低通削没。
  - **定位音**（敌人枪声/脚步）走 `out3d(node, x, y, z)` → `PannerNode`（`equalpower`，比 `hrtf` 省 CPU）；每帧在 `update()` 里调一次 `sfx.updateListener(player.pos, player.yaw)` 同步听者位姿。玩家自身音效（起跳/落地）传空坐标即直连 master，不做定位。
- **无头测试的几个坑**（用无头 Chrome + CDP 验证时）：
  - **测试音频相关路径前，必须先让音频图「活起来」，否则整条音频链路全程隐身。** `SFX` 的每个方法都以 `if (!this.ready()) return;` 开头，而 `ready()` 是 `this.enabled && this.ctx`；`ctx` 只在 `sfx.ensure()` 里创建，`ensure()` 又只由「进入战场」/「再来一局」两个按钮的 click 调起。历史上所有用例都是直接 `__tactical.beginGame()`，于是 `ctx` 恒为 null、所有 `sfx.*` 都是静默 no-op —— **`this.muffle` 覆盖 `muffle()` 那个致命 bug 因此整整两轮都没测出来**。现在用例开头一律先 `document.getElementById("startBtn").click()`（无头下这次点击没有用户手势，`requestPointerLock` 会以未处理的 Promise 拒绝告警收场，用 `Input.dispatchMouseEvent` 发真点击或直接忽略这个 `unhandledrejection` 都行，但**音频图一定会建起来**），然后再 `beginGame()`。
  - **`try/catch` 会把异常藏起来，测试要断言 `loopErrors() === 0` 且 `lastError() === null`。** 主循环和死亡块都有兜底（见死亡流程一节），异常不再冒泡到 `window.onerror`，只看 `__errs` 会得到一片「零报错」的假绿。想验证兜底本身有效，可以故意弄坏一个每帧都会被写的 DOM（如给 `#crosshair` 的 `style` 装一个抛异常的 getter，`update()` 每帧都会写它的 `--gap`）。
  - **判断「画面是不是卡住了」要看绘制调用，不能看 `frames()`。** `loop()` 里 `rid = requestAnimationFrame(loop)` 排在**最前面**，所以哪怕 `update()`/`renderer.render` 每帧都抛异常，`frames()` 依旧每帧 +1（看起来完全正常），而画布其实一动不动。用 CDP 注入一段计数 `WebGL2RenderingContext.prototype.drawArrays/drawElements` 的探针，**绘制计数不再增长才是真的卡死**（实测：坏版本死亡后 2 秒内绘制 +0，`frames()` 却 +121）。
  - **别用 swiftshader 测「跟时间/帧率有关」的行为**：`--use-angle=swiftshader` 在本机只有 ~1.2~1.6fps（单帧要 0.8 秒），`dt` 被 clamp 到 0.05 会让仿真时间只有墙上时间的 8%（游戏内计时器 7 分钟才走 34 秒），「3 秒」的东西要等 37 秒，看起来全都像卡死。**换成硬件渲染 `--use-angle=metal`（Mac）即可拿到真实 60fps**（`page.gl.getParameter(WEBGL_debug_renderer_info.UNMASKED_RENDERER_WEBGL)` 会报 `ANGLE Metal Renderer: Apple M4`），死亡流程、后坐、音效这类都该在这个模式下验。软渲染只留给「能不能跑起来」的冒烟测试。
  - **必须加 `--disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding`**，否则后台标签的 `requestAnimationFrame` 会被节流到接近 0，`frames()` 增量为 0，看起来像主循环挂了（其实是测试环境问题）。帧率低时 **`dt` 会被 clamp 到 0.05，逐帧衰减类的量（`cooldown`、后坐、`fov` 插值）单次等待根本走不完**，测这些要么等够多帧，要么像 `nextFireAt` 那样用绝对时刻。
  - **想让仿真跑满速又不画**：`renderer.render = () => {}`（只 stub 渲染，`update`/`loop` 照常）帧率立刻回到 ~60fps。**但只能临时用**：渲染被摘掉后就看不到真正的画面了，而且一旦漏了保存原函数（`window.__origRender`）会在每帧抛 `renderer.render is not a function`，把 `dt` 拉回「每帧 0.05」的假 60fps——测时间类行为会得到假结果。
  - **测「AI 寻路 / 移动」这类慢过程，要用定步长快进，不要 `sleep` 等墙上时钟。** `__tactical.pause()`（停 RAF）之后直接密集调用子系统自己的 `update`，几十秒仿真在一个 eval 里几百毫秒跑完，结果与机器负载、帧率完全无关：
    ```js
    t.pause();
    const cs = t.colliders();
    for (let i = 0; i < 3600; i++) t.enemyManager.update(1/60, t.player, cs);   // 60 秒
    ```
    用 `sleep(7000)` 那套写法在负载高的机器（本次实测 load average 54，用户自己的 Chrome + Spotlight 索引）会直接超时，而且 `dt` 被 clamp 到 0.05 会把「60 秒」拉成几百秒。
  - **判「有没有卡住」要看累计路程，不能看位移。** 「原地绕圈」和「根本没速度」的位移都是 0，但前者每帧都在动、路程正常。只按位移判会把画圈误报成卡死（本次就是这样绕了两轮）；只按 `moved` 判又会漏掉画圈。**采样的周期性还会骗人**：每 10 秒采一次位置，敌人若正好在画圈，采样点会反复落在同一相位，看起来「z 恒定不变」。
  - **每次跑完记得杀干净无头 Chrome。** `h.proc.kill()` 只杀主进程，GPU/renderer 子进程会活下来继续吃 CPU（本次累积到 load 54、后续用例全部超时）。补一刀 `pkill -f "user-data-dir=/tmp/cfskin"`，并顺手 `rm -rf` 那次的 profile 目录。
  - **复现「浏览器缓存了旧页面」的混合加载**（`http.server` 不发缓存头，很容易出现新 `main.js` + 旧 `index.html`）：用 CDP `Fetch.enable` 拦截 `index.html`、`Fetch.fulfillRequest` 回一份剥掉某个元素的 HTML，就能稳定复现「模块级 `getElementById` 拿到 null」那类崩溃。
  - **比一次 CDP 往返还短的瞬时状态，必须在页面里按 rAF 逐帧采样。** 一次 `Runtime.evaluate` 往返约 100ms，
    而枪口焰只有 60~100ms —— 从 node 轮询只能随机撞见一两帧，很容易写出「不衰减」「卡在满亮」这类**假红/假绿**
    （实测：采样点几乎全落在火焰熄灭之后，读到的 `opacity` 恒为 0，而 `scale` 还是上一帧的残留值，看着像「尺寸超标」）。
    写法：把采样循环塞进 `new Promise(res => { const tick = () => {…; ++n < N ? requestAnimationFrame(tick) : res(out) }; requestAnimationFrame(tick); })`
    再 `await` 它，顺便把要触发的动作（`forceFire()`）也放进去，保证与采样同帧对齐。
  - **`pause()` 只停 rAF、不重绘**：暂停期间做的任何状态改动（切枪、改姿势）都不会进 `Page.captureScreenshot`，
    截出来还是上一帧。**这个坑在本次改动里连吞了两轮截图**（6 张『逐把枪握位图』全拍成了 AK，一整套
    『换弹分相位』全是静止位）。要拍某个姿势：`resume()` → 改 → `sleep(350)` → `pause()` → 截图；
    或者干脆全程不 pause，改用 `poseReload` 的 `reloadHoldP` 定格（循环照常跑、每帧重绘）。
  - **判「手/枪有没有进画面」要走数值，不要只看截图**：`armsPose()` 给组局部坐标、`project()` 换算成屏幕像素，
    一把枪 10 个相位一次跑完、直接看哪一格越界。截图只能告诉你「某一帧看着不对」，
    而「整段下探全程在画面外」这种错在截图里只表现为「手凭空消失又出现」，极容易误判成别的原因。
  - **`Vector3.copy(x)` / `Vector3.copy(数组)` 是静默 NaN 生成器**：`copy` 读的是 `.x/.y/.z`，
    数组上那三个是 `undefined`。锚点表这类「数组形式写的坐标」一律要用 `fromArray`。
    NaN 之后不会抛异常，只会让矩阵变 NaN、网格消失，`loopErrors()` 还是 0。
  - **`_aim` 那类「两种入参形态」的坑**：函数按下标读数组、调用方却传了 Vector3，同样得到 NaN。
    这类 bug 的共同症状是「某个网格不见了但控制台干净」，排查时先把可疑点的三个分量打出来看。
  - **每个用例前先 `beginGame()` 归零状态**：否则上一条用例残留的 `actedThisLife`/`curBp`/面板开合状态会串到下一题（尤其**被拦下的换背包不会关上 `B` 面板**，下一次按 `B` 只是把它关掉，随后的数字键就掉进「切槽位」分支，结果看起来像功能坏了）。
  - **直接改 `BACKPACKS[i].primary` 的测试必须先同步 `skin`**：`activeSkinId(主武器)` 读的是**当前背包**的 skin，所以「背包 1 改成 M4 之后再去 `switchWeapon("ak")`」是个实战里进不来的非法状态，`findSkin("ak", <M4 的 skin id>)` 会回退成原厂，测出来的枪口焰色/材质色全是原厂的——很容易误判成功能坏了（实测踩到过一次）。改配装要么走菜单点击，要么 `setSkin` 一起改。
  - **别用 `while (backpackState().curBp !== want) switchBackpack(...)` 这种循环等待**：`forceFire()` 会置 `actedThisLife`，换背包随即被拦下，循环**永远不退出**（页面直接卡死）。要么先 `setActed(false)`，要么写成有次数上限的 `for`。
- HUD 元素 id 与 `main.js` 内 DOM 取用一一对应，勿随意改动命名。
- `window.__tactical` 调试钩子（`?debug` 开启）暴露 `ready/curId/switchWeapon/switchNade/switchToPrimary/switchBackpack/backpackState/setActed/setScoped/cycleScope/scopeStage/isScoped/fov/tdmScores/onKill/hurt/endTDM/forceFire/getAmmo/nadeCounts/smokeBlocks/frames/showScoreboard/scoreboard/skinState/setSkin/meshMats/deathState/deathPanel/pause/resume/loopErrors/lastError` 等，改动这些签名时保持向后兼容。写测试时注意：`isScoped()`/`scopeStage()` 是函数而 `scoped` 是内部布尔量，别把前者当属性读；`loopErrors()` 返回**数字**不是数组（没有 `.length`）；**`lastError()` 返回 `{where,msg,count}` 对象**（无异常时才是 `null`），不是字符串；`scoreboard().roster` 给的是**副本**（改了不影响游戏内的名册）。
  - **视模 / 手臂**：`vmScene` / `vmCamera` / `viewArms` / `muzzleShot` / `muzzleLight` 直接暴露；`vmState()`（`renders` 视模通道渲染次数、`sceneIsParent`、`bg`、`env`、`gunVisible`、`armsVisible`、`armsParent`、`fov`、`aspect`）、`armsPose()`（双手的**武器组局部**坐标 + `lRest` + `magVisible` + `meshes`）、`reloadPhase()`、`poseReload(p)` / `clearReload()`（姿势定格）、`armAnchors()` / `setArmAnchor(id, {r,l,m})`（握位在线微调）、`project(v)`（**武器组局部** → 屏幕像素）。`project()` 配 `armsPose()` 是查「手有没有掉出画面」的标准链路。
  - `meshMats(id)` **已滤掉 `userData.viewArms` 的手臂网格** —— 不滤的话手臂会混进材质快照，皮肤测试的「条数/下标」断言会全线崩，而且报错完全指不到手臂身上（实测：每把武器 16 个手臂网格）。
  - **敌人数与难度**：`enemyTarget()` / `setEnemyTarget(n)` / `enemyBounds()` / `difficulty()` / `difficulties()` / `setDifficulty(id)` / `enemyTuning()`。`setEnemyTarget` 会顺带 `buildMenuMatch()`，`setDifficulty` 只改 `ENEMY_TUNING`、**不改已在场敌人的 `damage`/`speed`** —— 测试要先改难度再重开一局/重刷再断言。
  - `colliders()` / `obstacles()` **都给的是拍平后的列表**（`obstacles` 在 `map.js` 里是 Mesh 与 Group 混装，直接给外面会让「扫一遍找有没有两件东西占同一块地方」的审计静默漏掉全部集装箱）。改图之后用它们跑碰撞审计：把「道具」和「集装箱」按尺寸分开，两两做 AABB 重叠 —— 排完网格最容易出的错就是道具有一半长进了箱子里。
  - **审计脚本里的尺寸常数要跟着实测走**：集装箱曾经被误当成 4.85×11.4，于是审计的 `isBox()` 一个箱子都没匹配上、断言全绿但**是空跑的**（打印出来的「箱数: 0」才是真相）。写这种审计时一定要把匹配到的数量也打出来看一眼。