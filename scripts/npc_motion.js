// Small, allocation-free movement helpers. Collision still owns root position.
export function angleDelta(target, current) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

export function advanceFacing(actor, target, dt, maxTurn) {
  const diff = angleDelta(target, actor.group.rotation.y);
  const desired = Math.max(-maxTurn, Math.min(maxTurn, diff * 8));
  actor.turnVel += (desired - actor.turnVel) * (1 - Math.exp(-10 * dt));
  let step = actor.turnVel * dt;
  // Arrive without overshooting and oscillating around a fixed heading.
  if (step * diff >= 0 && Math.abs(step) >= Math.abs(diff)) {
    step = diff;
    actor.turnVel = 0;
  }
  actor.group.rotation.y += step;
  actor.turnRate = dt > 0 ? step / dt : 0;
}

export function separationOffset(self, peers, dt, radius, push, maxFraction, out) {
  let x = 0, z = 0, overlaps = 0;
  const p = self.group.position;
  for (const peer of peers || []) {
    if (peer === self || peer.dead || peer.alive === false) continue;
    const q = peer.group.position;
    if (Math.abs(p.y - q.y) > 1.2) continue; // no pushing through floors
    const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz);
    if (!Number.isFinite(d) || d >= radius) continue;
    if (d < 1e-4) { overlaps++; continue; }
    const weight = 1 - d / radius;
    x += dx / d * weight; z += dz / d * weight;
  }
  let length = Math.hypot(x, z);
  if (length < 1e-4 && overlaps > 0) {
    x = Math.sin(self.seed); z = Math.cos(self.seed); length = 1;
  }
  // A lone or symmetrically spaced soldier must NOT drift at rest.
  const scale = length > 1e-6
    ? Math.min(1, push / length, maxFraction * self.speed * dt / length) : 0;
  out.x = x * scale; out.z = z * scale;
  return out;
}
