export const LOOK_INERTIA = Object.freeze({
  spring: 14,
  horizontalImpulse: .012,
  verticalImpulse: .009,
  maxX: .028,
  maxY: .018,
});

// Measured from the visible vertices of the approved Akgold idle viewmodel.
// A world-space offset must grow with viewmodel depth and tan(FOV/2) to cover
// the same number of screen pixels. Rotation needs only the FOV correction.
export const LOOK_INERTIA_REFERENCE = Object.freeze({ depth: .84825, fov: 75 });

export function lookInertiaScreenScale(depth, fov) {
  const safeDepth = Number.isFinite(depth) && depth > .02 ? depth : LOOK_INERTIA_REFERENCE.depth;
  const safeFov = Number.isFinite(fov) && fov > 1 && fov < 179 ? fov : LOOK_INERTIA_REFERENCE.fov;
  const lens = Math.tan(safeFov * Math.PI / 360) /
    Math.tan(LOOK_INERTIA_REFERENCE.fov * Math.PI / 360);
  return { translation: safeDepth / LOOK_INERTIA_REFERENCE.depth * lens, rotation: lens };
}

export function createLookInertiaState() {
  return { x: 0, y: 0, vx: 0, vy: 0 };
}

// Pointer movement gives the viewmodel a velocity impulse opposite to the
// camera turn. The camera and shot direction themselves are never modified.
export function pushLookInertia(state, movementX, movementY) {
  if (!state) return;
  const dx = Math.max(-180, Math.min(180, Number(movementX) || 0));
  const dy = Math.max(-180, Math.min(180, Number(movementY) || 0));
  state.vx += -dx * LOOK_INERTIA.horizontalImpulse;
  state.vy += dy * LOOK_INERTIA.verticalImpulse;
}

function stepAxis(p, v, dt, limit) {
  const r = LOOK_INERTIA.spring;
  const t = Math.max(0, Math.min(.05, Number(dt) || 0));
  const b = v + r * p;
  const e = Math.exp(-r * t);
  let nextP = (p + b * t) * e;
  let nextV = (v - r * b * t) * e;
  if (nextP > limit) { nextP = limit; nextV = Math.min(0, nextV); }
  if (nextP < -limit) { nextP = -limit; nextV = Math.max(0, nextV); }
  if (Math.abs(nextP) < 1e-5 && Math.abs(nextV) < 1e-4) return [0, 0];
  return [nextP, nextV];
}

export function stepLookInertia(state, dt, screenScale = { translation: 1, rotation: 1 }) {
  [state.x, state.vx] = stepAxis(state.x, state.vx, dt, LOOK_INERTIA.maxX);
  [state.y, state.vy] = stepAxis(state.y, state.vy, dt, LOOK_INERTIA.maxY);
  const fallback = Number(screenScale.translation) || 0;
  const xx = Number.isFinite(screenScale.xx) ? screenScale.xx : fallback;
  const xy = Number(screenScale.xy) || 0;
  const yx = Number(screenScale.yx) || 0;
  const yy = Number.isFinite(screenScale.yy) ? screenScale.yy : fallback;
  const rotation = Math.max(0, Number(screenScale.rotation) || 0);
  return {
    x: state.x * xx + state.y * xy,
    y: state.x * yx + state.y * yy,
    pitch: state.y * .7 * rotation,
    yaw: -state.x * .8 * rotation,
    roll: -state.x * .35 * rotation,
  };
}

export function resetLookInertia(state) {
  state.x = state.y = state.vx = state.vy = 0;
}
