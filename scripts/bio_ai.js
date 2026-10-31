// Tactical decision helpers for classic infection mode. Keep these functions
// independent from Three.js so their balance and state transitions can be
// tested without loading the renderer.

export const HUMAN_ROLES = Object.freeze(['anchor', 'support', 'scout', 'rear_guard']);
export const ZOMBIE_ROLES = Object.freeze(['pressure', 'flanker', 'cutoff', 'opportunist']);

export const DIRECTOR_PROFILES = Object.freeze({
  probe: Object.freeze({ aggression: .62, flank: .35, commit: .45, label: '试探' }),
  build: Object.freeze({ aggression: .86, flank: .72, commit: .72, label: '蓄压' }),
  assault: Object.freeze({ aggression: 1.12, flank: 1, commit: 1, label: '爆发' }),
  recover: Object.freeze({ aggression: .52, flank: .48, commit: .34, label: '回落' }),
});

const PHASE_ORDER = ['probe', 'build', 'assault', 'recover'];
const PHASE_SECONDS = Object.freeze({ probe: 7.5, build: 9, assault: 6.5, recover: 5.5 });

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function seededTraits(index, kind = 'human') {
  const seed = ((index + 1) * (kind === 'human' ? 2654435761 : 2246822519)) >>> 0;
  const unit = shift => (((seed >>> shift) ^ (seed * (shift + 3))) >>> 0) / 4294967295;
  if (kind === 'human') {
    return Object.freeze({
      courage: .38 + unit(3) * .48,
      teamwork: .48 + unit(7) * .45,
      accuracy: .72 + unit(11) * .22,
      reaction: .13 + (1 - unit(15)) * .19,
    });
  }
  return Object.freeze({
    patience: .32 + unit(3) * .56,
    aggression: .72 + unit(8) * .28,
    awareness: .68 + unit(13) * .3,
  });
}

export function humanRole(index, aliveCount) {
  if (aliveCount <= 1) return 'anchor';
  return HUMAN_ROLES[index % Math.min(HUMAN_ROLES.length, aliveCount)];
}

export function zombieRole(index, assaultSerial = 0) {
  return ZOMBIE_ROLES[(index + assaultSerial) % ZOMBIE_ROLES.length];
}

export function createDirector() {
  return {
    phase: 'probe', timer: PHASE_SECONDS.probe, phaseAge: 0,
    intensity: 0, shock: 0, serial: 0,
  };
}

export function updateDirector(state, situation, dt) {
  const nearest = Number.isFinite(situation.nearestThreat) ? situation.nearestThreat : 40;
  const proximity = clamp01((18 - nearest) / 15);
  const losses = clamp01(1 - situation.humansAlive / Math.max(1, situation.humansTotal));
  const combat = clamp01(situation.combatHeat || 0);
  const wanted = clamp01(proximity * .48 + losses * .22 + combat * .3 + state.shock * .25);
  state.intensity += (wanted - state.intensity) * (1 - Math.exp(-dt * 1.7));
  state.shock = Math.max(0, state.shock - dt * .24);
  state.timer -= dt;
  state.phaseAge += dt;

  // A costly breach ends the peak early, while an uneventful probe/build is
  // allowed to advance so the round never settles into permanent inactivity.
  const overwhelmed = state.phase === 'assault' && state.phaseAge > 3.4 && state.intensity > .86;
  if (state.timer > 0 && !overwhelmed) return false;
  const at = PHASE_ORDER.indexOf(state.phase);
  state.phase = PHASE_ORDER[(at + 1) % PHASE_ORDER.length];
  state.phaseAge = 0;
  state.timer = PHASE_SECONDS[state.phase];
  if (state.phase === 'assault') state.serial++;
  return true;
}

export function chooseIntent(current, lockTime, scores) {
  let best = current || 'hold';
  let bestScore = scores[best] ?? -Infinity;
  for (const [name, score] of Object.entries(scores)) {
    if (score > bestScore) { best = name; bestScore = score; }
  }
  // Hysteresis prevents frame-to-frame dithering. An emergency evade may
  // always interrupt, but ordinary choices must beat the current plan.
  if (lockTime > 0 && best !== 'evade') return current;
  if (current && best !== current && bestScore < (scores[current] ?? 0) + .16) return current;
  return best;
}

export function zombieTargetScore({ distance, visible, heard, memory, load, persistent,
  isolated, reloading, role }) {
  if (!visible && !heard && memory <= 0) return Infinity;
  let score = distance + load * 2.5 - persistent * 1.6;
  if (visible) score -= 2.4;
  else if (heard) score -= .7;
  else score += (1 - memory) * 3.5;
  if (role === 'opportunist') score -= isolated * 2.8 + reloading * 3.4;
  if (role === 'cutoff') score -= isolated * 1.4;
  return score;
}

export function directorProfile(state) {
  return DIRECTOR_PROFILES[state.phase] || DIRECTOR_PROFILES.probe;
}

export function recoveryStage(stuckFor) {
  const t = Math.max(0, Number(stuckFor) || 0);
  if (t < .28) return 0;
  if (t < .58) return 1;   // slide around the immediate blocker
  if (t < .95) return 2;   // back out of a bad contact and change side
  return 3;                // invalidate the route and pick a local detour
}

export function localAvoidanceVector({ position, desired, speed = 1, neighbors = [],
  radius = .45, horizon = .32, sideBias = 1 }) {
  let dx = Number(desired?.x) || 0, dz = Number(desired?.z) || 0;
  const length = Math.hypot(dx, dz);
  if (length < 1e-5) return { x: 0, z: 0, pressure: 0 };
  dx /= length; dz /= length;
  let steerX = dx, steerZ = dz, pressure = 0;
  const px = Number(position?.x) || 0, pz = Number(position?.z) || 0;
  const ownVX = dx * speed, ownVZ = dz * speed;
  for (const other of neighbors) {
    const rx = (Number(other.x) || 0) - px;
    const rz = (Number(other.z) || 0) - pz;
    const distance = Math.hypot(rx, rz);
    if (distance < 1e-4 || distance > 3.4) continue;
    const combined = radius + (Number(other.radius) || radius);
    const closeness = clamp01((combined + .85 - distance) / .85);
    if (closeness > 0) {
      steerX -= rx / distance * closeness * 1.2;
      steerZ -= rz / distance * closeness * 1.2;
      pressure = Math.max(pressure, closeness);
    }
    const rvx = (Number(other.vx) || 0) - ownVX;
    const rvz = (Number(other.vz) || 0) - ownVZ;
    const futureX = rx + rvx * horizon;
    const futureZ = rz + rvz * horizon;
    const futureDistance = Math.hypot(futureX, futureZ);
    const ahead = rx * dx + rz * dz;
    if (ahead <= 0 || futureDistance > combined + .35) continue;
    const avoid = clamp01((combined + .35 - futureDistance) / (combined + .35));
    const cross = dx * rz - dz * rx;
    const side = Math.abs(cross) > .08 ? -Math.sign(cross) : (sideBias < 0 ? -1 : 1);
    steerX += -dz * side * avoid * 1.45;
    steerZ += dx * side * avoid * 1.45;
    pressure = Math.max(pressure, avoid);
  }
  const steeredLength = Math.hypot(steerX, steerZ) || 1;
  return { x: steerX / steeredLength, z: steerZ / steeredLength, pressure };
}

export function attackSlotCandidates(target, count = 8, radius = 1.28, phase = 0) {
  const out = [];
  const total = Math.max(3, Math.floor(count));
  for (let index = 0; index < total; index++) {
    const angle = phase + index / total * Math.PI * 2;
    out.push({ index, x: target.x + Math.sin(angle) * radius,
      y: target.y || 0, z: target.z + Math.cos(angle) * radius, angle });
  }
  return out;
}

export function chooseAttackSlot({ agent, target, reserved = new Set(), count = 8,
  radius = 1.28, phase = 0, canOccupy = () => true, preferredIndex = null }) {
  if (Number.isInteger(preferredIndex) && preferredIndex >= 0 && preferredIndex < count &&
      !reserved.has(preferredIndex)) {
    const preferred = attackSlotCandidates(target, count, radius, phase)[preferredIndex];
    if (preferred && canOccupy(preferred)) return preferred;
  }
  let best = null, bestScore = Infinity;
  for (const slot of attackSlotCandidates(target, count, radius, phase)) {
    if (reserved.has(slot.index) || !canOccupy(slot)) continue;
    const travel = Math.hypot(slot.x - agent.x, slot.z - agent.z);
    const continuity = preferredIndex === null ? 0 :
      Math.min(Math.abs(slot.index - preferredIndex), count - Math.abs(slot.index - preferredIndex));
    const score = travel + continuity * .42;
    if (score < bestScore) { best = slot; bestScore = score; }
  }
  return best;
}

export function combatPositionScore({ pathCost, targetDistance, preferredDistance,
  visible, cover, crowd, danger, repeated, flank }) {
  if (!Number.isFinite(pathCost) || !visible) return -Infinity;
  return 8.5 - pathCost * .18 - Math.abs(targetDistance - preferredDistance) * .34 +
    cover * 2.1 - crowd * 2.6 + Math.min(18, danger) * .12 - repeated * 1.4 + flank * 1.25;
}
