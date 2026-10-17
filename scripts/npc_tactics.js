// Decisions are deliberately separate from collision and animation. A bot can
// act on remembered information without ever reading the player's live position.
export const SIGHT_MEMORY = 5.0;
export const SOUND_MEMORY = 3.0;

export function makeAwareness(x, y, z, seed = 0) {
  return { x, y, z, homeX: x, homeY: y, homeZ: z, memory: 0,
    visible: false, reaction: 0, mode: 'patrol', searchT: 0,
    searchStep: 0, seed };
}

export function updateAwareness(a, dt, sight, sound) {
  const wasVisible = a.visible;
  a.memory = Math.max(0, a.memory - dt);
  a.reaction = Math.max(0, a.reaction - dt);
  a.visible = !!sight;
  if (sight) {
    if (!wasVisible) a.reaction = .16 + (Math.sin(a.seed * 17.3) * .5 + .5) * .20;
    a.x = sight.x; a.y = sight.y; a.z = sight.z;
    a.memory = SIGHT_MEMORY;
    a.mode = 'engage';
    a.searchT = 0;
  } else if (sound && a.memory < SOUND_MEMORY) {
    a.x = sound.x; a.y = sound.y; a.z = sound.z;
    a.memory = SOUND_MEMORY;
    a.mode = 'investigate';
    a.searchT = 0;
  } else if (a.memory > 0) {
    a.mode = 'search';
    a.searchT += dt;
  } else {
    a.mode = 'patrol';
    a.searchT += dt;
  }
  return a;
}

export function awarenessGoal(a, current) {
  if (a.mode === 'engage' || a.mode === 'investigate')
    return { x: a.x, y: a.y, z: a.z };
  if (a.mode === 'search') {
    // Search a few metres around the last contact, not its exact old pixel.
    const step = Math.floor(a.searchT / 1.35);
    const angle = a.seed + step * 2.3999632297;
    const radius = Math.min(3.2, 1.2 + step * .48);
    return { x: a.x + Math.sin(angle) * radius, y: a.y,
      z: a.z + Math.cos(angle) * radius };
  }
  const step = Math.floor(a.searchT / 3.2);
  const angle = a.seed + step * 1.9;
  return { x: a.homeX + Math.sin(angle) * 3.4, y: a.homeY,
    z: a.homeZ + Math.cos(angle) * 3.4 };
}

export function chooseCover(colliders, self, threat, valid) {
  let best = null, score = Infinity;
  for (const c of colliders || []) {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.z) ||
        !Number.isFinite(c.hx) || !Number.isFinite(c.hz) ||
        c.h < self.y + .8 || c.y0 > self.y + .8) continue;
    const cx = c.x - threat.x, cz = c.z - threat.z;
    const len = Math.hypot(cx, cz);
    if (len < 2 || len > 35) continue;
    const xAxis = Math.abs(cx / len) * c.hx >= Math.abs(cz / len) * c.hz;
    const x = c.x + (xAxis ? Math.sign(cx) * (c.hx + .72) : 0);
    const z = c.z + (!xAxis ? Math.sign(cz) * (c.hz + .72) : 0);
    const travel = Math.hypot(x - self.x, z - self.z);
    if (travel > 9 || travel < .6 || !valid(x, z)) continue;
    const value = travel + Math.abs(len - 10) * .04;
    if (value < score) { score = value; best = { x, y: self.y, z }; }
  }
  return best;
}
