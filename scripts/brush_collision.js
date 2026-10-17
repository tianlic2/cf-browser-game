// Shared Source-brush collision. Coordinates and planes use metres, Y up.
export function brushContainsPoint(c, x, y, z, epsilon = 1e-5) {
  if (Math.abs(x-c.x) > c.hx+epsilon || Math.abs(z-c.z) > c.hz+epsilon ||
      y < (c.y0 ?? 0)-epsilon || y > c.h+epsilon) return false;
  if (!c.planes) return true;
  return c.planes.every(([nx,ny,nz,d]) => nx*x+ny*y+nz*z <= d+epsilon);
}

// GoldSrc BSP collision is emitted as adjacent convex solid leaves. A face
// between two solid leaves is an implementation detail, not a floor: accepting
// it as support creates an invisible ledge inside the solid union and leaves an
// actor floating above the rendered ground. Probe just above the candidate face
// and reject it whenever that point is still inside another solid leaf.
export function brushSupportIsExposed(colliders, source, x, z, surface,
    epsilon = 2e-4) {
  if (!colliders || !Number.isFinite(surface)) return true;
  const y = surface + epsilon;
  for (const c of colliders) {
    if (c === source) continue;
    if (brushContainsPoint(c, x, y, z, epsilon * .25)) return false;
  }
  return true;
}

export function intersectsBrush(c, x, z, feet = 0, radius = .45, step = .5,
    height = 1.78, solidSet = null, surfaceAt = null, blockerAt = null) {
  if ((c.y0 ?? 0) >= feet + height) return false;
  if (Math.abs(x-c.x) >= c.hx+radius || Math.abs(z-c.z) >= c.hz+radius) return false;
  // Rectangular/programmatic brushes keep the classic global-top shortcut.
  // Imported BSP leaves may overlap vertically, so their top is a legal step
  // only when that face is exposed on the outside of the complete solid union.
  if (c.h <= feet + step) {
    const visible = surfaceAt ? surfaceAt(x,z,feet+step+.02) : c.h;
    if (!c.localStep || (brushSupportIsExposed(solidSet, c, x, z, c.h) &&
        Number.isFinite(visible) && Math.abs(visible-c.h)<.08)) return false;
  }
  if (!c.planes) return !c.localStep||!blockerAt||blockerAt(x,z,feet,radius,step,height);
  // A BSP solid leaf below a ramp can span from the ramp's lowest point all
  // the way to its highest point.  Its global AABB top (`c.h`) therefore says
  // “wall” even when the authored surface directly under the actor is within
  // the legal step height.  Treat that local top as ground and let supportAt()
  // raise the feet onto it.  We deliberately require the actor centre to be
  // inside the convex footprint: near a true wall edge brushTop() is -Infinity,
  // so the radius-expanded plane test below still blocks the capsule.
  const localTop = c.localStep ? brushTop(c, x, z) : -Infinity;
  const visibleTop = surfaceAt ? surfaceAt(x,z,feet+step+.02) : localTop;
  if (Number.isFinite(localTop) && localTop <= feet + step + 1e-5 &&
      brushSupportIsExposed(solidSet, c, x, z, localTop) &&
      Number.isFinite(visibleTop) && Math.abs(visibleTop-localTop)<.08) return false;
  const cy=feet+(step+height)*.5, hy=(height-step)*.5;
  const hit=c.planes.every(([nx,ny,nz,d]) => nx*x+ny*cy+nz*z < d+radius*Math.hypot(nx,nz)+Math.abs(ny)*hy-1e-5);
  return hit&&(!c.localStep||!blockerAt||blockerAt(x,z,feet,radius,step,height));
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
  feet = 0, radius = .45, step = .5, height = 1.78, surfaceAt = null,
  blockerAt = null) {
  let next = null;
  for (const c of colliders) {
    if (intersectsBrush(c, toX, toZ, feet, radius, step, height, colliders,
      surfaceAt,blockerAt)) (next ||= []).push(c);
  }
  if (!next?.length) return true;
  let current = null;
  for (const c of colliders) {
    if (intersectsBrush(c, fromX, fromZ, feet, radius, step, height, colliders,
      surfaceAt,blockerAt)) (current ||= []).push(c);
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

// A uniformly enlarged map needs the same authored jump *height*, not the same
// launch speed.  With unchanged gravity, height is proportional to v^2.
export function jumpVelocityForHeightScale(baseVelocity, heightScale = 1) {
  const scale = Number.isFinite(heightScale) && heightScale > 0 ? heightScale : 1;
  return baseVelocity * Math.sqrt(scale);
}

// Classic step movement traces a short distance down after horizontal motion.
// Without this, every descending stair tread briefly turns into a fall: the
// player alternates between ground/air and the camera visibly judders.
export function shouldSnapDownToSupport(wasGrounded, verticalVelocity,
    previousFeetY, supportY, maxDrop) {
  if (!wasGrounded || verticalVelocity > 0 || !Number.isFinite(supportY)) return false;
  const drop = previousFeetY - supportY;
  return drop >= -1e-5 && drop <= Math.max(0, maxDrop || 0) + 1e-5;
}

export function preserveCameraAcrossGroundStep(offset, deltaY, limit = .5) {
  const next = offset - deltaY;
  return Math.max(-limit, Math.min(limit, next));
}

export function decayGroundViewOffset(offset, amount) {
  const step = Math.max(0, amount);
  if (offset > 0) return Math.max(0, offset - step);
  if (offset < 0) return Math.min(0, offset + step);
  return 0;
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
