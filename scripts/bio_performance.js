// 生化模式的视觉/感知预算。AI 的位置、攻击和碰撞仍逐帧推进；这里只降低
// 昂贵的遮挡感知与骨骼动画频率，不能让屏幕外角色从规则世界中“消失”。
export const BIO_ZOMBIE_SENSE_INTERVAL = .12;
export const BIO_HUMAN_SENSE_INTERVAL = .14;
export const BIO_ZOMBIE_ROUTE_INTERVAL = .18;

export function bioSenseOffset(index, count, interval) {
  const total = Math.max(1, Number(count) || 1);
  return (Math.max(0, Number(index) || 0) % total) / total * interval;
}

// 返回 0 表示逐帧更新。近战范围保持满帧；其余人物按距离和可见性错峰推进骨骼，
// 位置、碰撞和攻击仍逐帧计算，重新进入画面时最多补 200ms。
export function bioAnimationInterval(inView, distance) {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : Infinity;
  if (d <= 7) return 0;           // 近战距离保持逐帧，攻击和受击姿态不能降级
  if (inView && d <= 18) return 1 / 30;
  if (inView && d <= 36) return .05;
  if (inView) return .10;
  if (d <= 16) return .10;
  return .20;
}

export function bioBudgetDue(elapsed, interval) {
  return interval === 0 || elapsed + 1e-9 >= interval;
}
