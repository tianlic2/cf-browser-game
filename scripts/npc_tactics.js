// Decisions are deliberately separate from collision and animation. A bot can
// act on remembered information without ever reading the player's live position.
export const SIGHT_MEMORY = 5.0;
export const SOUND_MEMORY = 3.0;

export function makeAwareness(x, y, z, seed = 0) {
  return { x, y, z, homeX: x, homeY: y, homeZ: z, memory: 0,
    visible: false, reaction: 0, mode: 'patrol', searchT: 0,
    searchStep: 0, seed,
    waypointMode: '', waypointX: x, waypointY: y, waypointZ: z,
    waypointAge: 0, waypointHold: 0, waypointReached: false };
}

export function updateAwareness(a, dt, sight, sound) {
  const previousMode = a.mode;
  const wasVisible = a.visible;
  a.memory = Math.max(0, a.memory - dt);
  a.reaction = Math.max(0, a.reaction - dt);
  a.waypointAge = (a.waypointAge || 0) + dt;
  a.waypointHold = Math.max(0, (a.waypointHold || 0) - dt);
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
  if (a.mode !== previousMode) {
    a.waypointMode = '';
    a.waypointAge = 0;
    a.waypointHold = 0;
    a.waypointReached = false;
    if (a.mode === 'engage' || a.mode === 'investigate') a.searchStep = 0;
  }
  return a;
}

const SEARCH_TURNS = [0, .62, -.72, 1.05, -1.18, 1.72, -1.82];
const PATROL_TURNS = [0, .78, -.86, 1.42, -1.48, Math.PI];

function setWaypoint(a, mode) {
  const search = mode === 'search';
  const turns = search ? SEARCH_TURNS : PATROL_TURNS;
  const step = Math.max(0, a.searchStep | 0);
  const lap = Math.floor(step / turns.length);
  const angle = a.seed + turns[step % turns.length] + lap * .29;
  const radius = search ? Math.min(3.4, 1.35 + step * .34) : 3.4;
  const baseX = search ? a.x : a.homeX;
  const baseY = search ? a.y : a.homeY;
  const baseZ = search ? a.z : a.homeZ;
  a.waypointMode = mode;
  a.waypointX = baseX + Math.sin(angle) * radius;
  a.waypointY = baseY;
  a.waypointZ = baseZ + Math.cos(angle) * radius;
  a.waypointAge = 0;
  a.waypointHold = 0;
  a.waypointReached = false;
}

export function awarenessGoal(a, current = null) {
  if (a.mode === 'engage' || a.mode === 'investigate')
    return { x: a.x, y: a.y, z: a.z };

  const mode = a.mode === 'search' ? 'search' : 'patrol';
  if (a.waypointMode !== mode) setWaypoint(a, mode);
  const distance = current
    ? Math.hypot(a.waypointX - current.x, a.waypointZ - current.z)
    : Infinity;

  // Do not choose a new look direction from a wall clock. The old 1.35 s
  // stepping made a bot abandon a route mid-stride and pivot around the same
  // spot. A waypoint now stays committed until it is reached (brief hold) or
  // has genuinely failed to make progress for several seconds.
  if (!a.waypointReached && distance < .72 && a.waypointAge > .3) {
    a.waypointReached = true;
    a.waypointHold = .42 + (Math.sin(a.seed * 13.7 + a.searchStep) * .5 + .5) * .36;
    a.waypointX = current.x;
    a.waypointY = current.y ?? a.waypointY;
    a.waypointZ = current.z;
  }
  if ((a.waypointReached && a.waypointHold <= 0) || a.waypointAge > 5.2) {
    a.searchStep = (a.searchStep | 0) + 1;
    setWaypoint(a, mode);
  }
  return { x: a.waypointX, y: a.waypointY, z: a.waypointZ };
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
