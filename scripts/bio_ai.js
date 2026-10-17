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
