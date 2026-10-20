// 生化模式的视觉/感知预算。AI 的位置、攻击和碰撞仍逐帧推进；这里只降低
// 昂贵的遮挡感知与骨骼动画频率，不能让屏幕外角色从规则世界中“消失”。
export const BIO_ZOMBIE_SENSE_INTERVAL = .12;
export const BIO_HUMAN_SENSE_INTERVAL = .14;
export const BIO_ZOMBIE_ROUTE_INTERVAL = .18;

export function bioSenseOffset(index, count, interval) {
  const total = Math.max(1, Number(count) || 1);
  return (Math.max(0, Number(index) || 0) % total) / total * interval;
}

// 返回 0 表示逐帧更新。真正处在玩家画面里的中近距离人物必须保持满帧动作；
// 视野外人物只保留低频姿态推进，重新进入画面时最多补 250ms，不会从旧姿势瞬移。
export function bioAnimationInterval(inView, distance) {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : Infinity;
  if (d <= 10) return 0;          // 身后近战也不能降频，玩家可能瞬间转身
  if (inView && d <= 32) return 0;
  if (inView) return .05;         // 远处仍在画面：20Hz 骨骼足够，位置仍逐帧
  if (d <= 16) return .10;        // 近处但在视野外：10Hz，兼顾快速回头
  return .25;                     // 远处视野外：4Hz
}

export function bioBudgetDue(elapsed, interval) {
  return interval === 0 || elapsed + 1e-9 >= interval;
}
