// All live characters use the same upright cylinder footprint. Resolve each
// horizontal axis against the swept circle, so a fast frame cannot skip over
// another character and the unblocked axis can still slide past them.
export const ACTOR_RADIUS = .45;
export const ACTOR_HEIGHT = 1.78;
const GAP = .008;

function positionOf(actor) {
  return actor?.group?.position || actor?.pos || actor?.position;
}

function active(actor, self) {
  return actor && actor !== self && !actor.dead && actor.alive !== false;
}

function sharesHeight(y, height, otherY, otherHeight) {
  return y < otherY + otherHeight - GAP && otherY < y + height - GAP;
}

export function overlapsActors(x, y, z, actors, self = null,
  radius = ACTOR_RADIUS, height = ACTOR_HEIGHT) {
  for (const actor of actors) {
    if (!active(actor, self)) continue;
    const p = positionOf(actor);
    if (!p || !sharesHeight(y, height, p.y, actor.actorHeight ?? ACTOR_HEIGHT)) continue;
    const r = radius + (actor.actorRadius ?? ACTOR_RADIUS) + GAP;
    // The sweep deliberately stops exactly at r. Leave a micron of numeric
    // tolerance so its endpoint is accepted instead of freezing at the old spot.
    if ((x - p.x) ** 2 + (z - p.z) ** 2 < (r - 1e-6) ** 2) return true;
  }
  return false;
}

export function sweepActorAxis(start, delta, fixed, y, actors, self, axis,
  radius = ACTOR_RADIUS, height = ACTOR_HEIGHT) {
  if (!Number.isFinite(delta) || delta === 0) return 0;
  let allowed = delta;
  for (const actor of actors) {
    if (!active(actor, self)) continue;
    const p = positionOf(actor);
    if (!p || !sharesHeight(y, height, p.y, actor.actorHeight ?? ACTOR_HEIGHT)) continue;
    const otherAxis = axis === 'x' ? p.x : p.z;
    const perpendicular = fixed - (axis === 'x' ? p.z : p.x);
    const r = radius + (actor.actorRadius ?? ACTOR_RADIUS) + GAP;
    if (Math.abs(perpendicular) >= r) continue;
    const reach = Math.sqrt(r * r - perpendicular * perpendicular);
    const lo = otherAxis - reach, hi = otherAxis + reach;
    if (delta > 0) {
      if (start < lo) allowed = Math.min(allowed, Math.max(0, lo - start));
      else if (start < hi && start <= otherAxis) allowed = 0;
    } else {
      if (start > hi) allowed = Math.max(allowed, Math.min(0, hi - start));
      else if (start > lo && start >= otherAxis) allowed = 0;
    }
  }
  return allowed;
}

// Used only when a character is created/teleported. The game's own terrain
// predicate still decides whether each candidate has a valid floor and room.
export function findActorSpawn(x, y, z, actors, valid, self = null) {
  for (let ring = 0; ring <= 12; ring++) {
    const count = ring ? Math.max(12, ring * 8) : 1;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const nx = x + ring * .6 * Math.cos(angle);
      const nz = z + ring * .6 * Math.sin(angle);
      if (valid(nx, y, nz) && !overlapsActors(nx, y, nz, actors, self))
        return [nx, y, nz];
    }
  }
  return null;
}
