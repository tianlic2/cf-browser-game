// Shared Source-brush collision. Coordinates and planes use metres, Y up.
export function intersectsBrush(c, x, z, feet = 0, radius = .45, step = .5, height = 1.78) {
  if (c.h <= feet + step || (c.y0 ?? 0) >= feet + height) return false;
  if (Math.abs(x-c.x) >= c.hx+radius || Math.abs(z-c.z) >= c.hz+radius) return false;
  if (!c.planes) return true;
  const cy=feet+(step+height)*.5, hy=(height-step)*.5;
  return c.planes.every(([nx,ny,nz,d]) => nx*x+ny*cy+nz*z < d+radius*Math.hypot(nx,nz)+Math.abs(ny)*hy-1e-5);
}

// Conservative horizontal depth inside the brush's radius-expanded AABB.
// This is used only for recovery after a vertical move has left a player
// overlapping a wall; the exact convex-plane test remains authoritative.
function horizontalDepth(c, x, z, radius) {
  return Math.max(0, Math.min(
    c.hx + radius - Math.abs(x - c.x),
    c.hz + radius - Math.abs(z - c.z),
  ));
}

// Normal movement may enter no new brush. If the starting point is already
// overlapping (for example after falling against a crate side), allow only a
// move that exits a blocker or makes every remaining overlap strictly shallower.
// The old unconditional "stuck means move anywhere" rule let repeated jump
// contacts walk the capsule all the way into a box.
export function canMoveThroughBrushes(colliders, fromX, fromZ, toX, toZ,
  feet = 0, radius = .45, step = .5, height = 1.78) {
  let next = null;
  for (const c of colliders) {
    if (intersectsBrush(c, toX, toZ, feet, radius, step, height)) (next ||= []).push(c);
  }
  if (!next?.length) return true;
  let current = null;
  for (const c of colliders) {
    if (intersectsBrush(c, fromX, fromZ, feet, radius, step, height)) (current ||= []).push(c);
  }
  if (!current?.length) return false;
  const before = new Map(current.map(c => [c, horizontalDepth(c, fromX, fromZ, radius)]));
  let improved = next.length < current.length;
  for (const c of next) {
    const oldDepth = before.get(c);
    if (oldDepth === undefined) return false;
    const newDepth = horizontalDepth(c, toX, toZ, radius);
    if (newDepth > oldDepth + 1e-5) return false;
    if (newDepth < oldDepth - 1e-5) improved = true;
  }
  return improved;
}

// Push an overlapping capsule to the nearest side of the brush's expanded
// AABB. Since the AABB contains the convex brush, the returned point is always
// outside the exact brush too. This is a last-resort correction for vertical
// descent beside a crate, not the normal movement path.
export function brushHorizontalEscape(c, x, z, radius = .45) {
  const eps = 2e-5;
  const candidates = [
    { x: c.x - c.hx - radius - eps - x, z: 0 },
    { x: c.x + c.hx + radius + eps - x, z: 0 },
    { x: 0, z: c.z - c.hz - radius - eps - z },
    { x: 0, z: c.z + c.hz + radius + eps - z },
  ];
  candidates.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  return candidates[0];
}

export function brushTop(c, x, z) {
  if (Math.abs(x-c.x)>c.hx || Math.abs(z-c.z)>c.hz) return -Infinity;
  if (!c.planes) return c.h;
  let top=Infinity, bottom=-Infinity;
  for (const [nx,ny,nz,d] of c.planes) {
    const rem=d-nx*x-nz*z;
    if (Math.abs(ny)<1e-6) { if (rem < -1e-5) return -Infinity; }
    else if (ny>0) top=Math.min(top,rem/ny);
    else bottom=Math.max(bottom,rem/ny);
  }
  return top>=bottom-1e-5 ? top : -Infinity;
}

// The original .396m stair spacing is shorter than the character radius.
// A heel/toe contact patch lets the foot land on a tread before the torso hits
// the next riser. Restrict this to imported stair flights, never box edges.
export function brushSupport(c,x,z) {
  const center=brushTop(c,x,z);
  return c.stair ? Math.max(center,brushTop(c,x,z-.12),brushTop(c,x,z+.12)) : center;
}

// Lowest point of a brush above a vertical cylinder, including its radius.
// Used only for upward motion: the tunnel roof must stop a jump from below.
export function brushBottom(c,x,z,radius=0) {
  if(Math.abs(x-c.x)>c.hx+radius||Math.abs(z-c.z)>c.hz+radius)return Infinity;
  if(!c.planes)return c.y0??0;
  let top=Infinity,bottom=-Infinity;
  for(const [nx,ny,nz,d] of c.planes) {
    const rem=d-nx*x-nz*z+radius*Math.hypot(nx,nz);
    if(Math.abs(ny)<1e-6){if(rem< -1e-5)return Infinity;}
    else if(ny>0)top=Math.min(top,rem/ny);
    else bottom=Math.max(bottom,rem/ny);
  }
  return top>=bottom-1e-5?bottom:Infinity;
}
