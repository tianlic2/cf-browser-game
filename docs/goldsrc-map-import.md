# GoldSrc 地图导入与空气墙检查

本项目导入 GoldSrc BSP 时，不能把 BSP 凸实心叶的顶面直接当作玩家地面。一个可见地面下方通常由多个相邻实心叶组成；叶之间的内部切面不是地面。斜坡所在叶的全局 AABB 顶点也可能远高于人物脚下的局部坡面。两者分别会造成“人物被托高一层”和“坡道/楼梯前出现空气墙”。

## 强制实现规则

1. 所有由 `tools/import_goldsrc_survivor.py` 产生的凸体必须带 `localStep=true`，地图 JSON 必须声明 `collisionSurfaceMode="visible-mesh-v1"`。
2. 新地图加载 `map.bin` 后必须调用 `prepareGoldsrcCollision(data, binary)`，并把返回的 `surfaceAt`、`surfacesAt`、`blockerAt` 全部放进地图对象。禁止重新使用 `max(brushSupport(...))` 作为 GoldSrc 地图的落脚高度。
3. BSP 凸体负责精确实体范围与顶棚判定，但水平阻挡必须同时得到 `blockerAt` 的可见陡直三角面确认；玩家、NPC、爬阶放行和导航节点的 Y 高度以不透明、非 MDL 装饰的可见三角形为准。透明水面和无碰撞场景模型不能成为支撑面或墙面。
4. `brushSupportIsExposed()` 必须过滤仍位于另一实心叶内部的候选顶面。不能通过简单提高 `stepHeight`、缩小人物胶囊或删除大块碰撞来掩盖问题。
5. 无渲染面的 brush entity 默认不作为团队竞技碰撞；若新地图确实需要 `clip`，必须先明确其用途并为它增加专项测试，不能全量恢复隐藏 blocker。

## 新地图导入流程

1. 在导入器 `PROFILES` 中登记源 BSP、坐标中心、比例、天空盒及素材依赖。
2. 运行导入器生成 `assets/classic/<asset-id>/map.json` 与 `map.bin`。
3. 地图加载器调用：

   ```js
   const binary = await binaryResponse.arrayBuffer();
   const collisionSurfaces = prepareGoldsrcCollision(data, binary);
   return { ...data, ...collisionSurfaces, /* 该地图其余配置 */ };
   ```

4. 运行通用审计：

   ```sh
   node --experimental-default-type=module tools/audit_goldsrc_collision.mjs <asset-id> <navigation-max-height> 1.2
   ```

5. 地图专项测试必须额外断言：所有出生点与可见地面误差不超过 `.03m`；所有导航节点落在可见三角形上；双方出生点跨图连通；审计确实移除无可见墙面的水平 blocker，同时保留可见墙体、箱体和洞壁阻挡。
6. 最后在浏览器实际检查出生区、洞口、连续楼梯、斜坡、屋顶边缘、箱体堆与上下层重叠区域，并确认控制台无警告或错误。

## 已知失败征兆

- 高度恰好相差 8/16 个源单位：通常是 BSP 内部切面被当成地面。
- 斜坡低端被挡、远端正常：通常是用整个凸体的 `c.h` 代替 `brushTop(c,x,z)`。
- 人物站在不可见平面上：通常是外露的碰撞帽没有对应渲染三角面，应由 `surfaceAt()` 决定脚底高度。
- 脚底高度正确但平地仍过不去：通常是水平碰撞仍只信 BSP 实心叶，没有再由 `blockerAt()` 确认可见墙面。
- NPC 能走、玩家被挡或反之：玩家碰撞、NPC 碰撞、`GroundNavigation` 没有共用同一套 `surfaceAt/surfacesAt/blockerAt`。
