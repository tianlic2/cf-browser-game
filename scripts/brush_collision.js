// Shared Source-brush collision. Coordinates and planes use metres, Y up.
export function intersectsBrush(c, x, z, feet = 0, radius = .45, step = .5, height = 1.78) {
  if (c.h <= feet + step || (c.y0 ?? 0) >= feet + height) return false;
  if (Math.abs(x-c.x) >= c.hx+radius || Math.abs(z-c.z) >= c.hz+radius) return false;
  if (!c.planes) return true;
  const cy=feet+(step+height)*.5, hy=(height-step)*.5;
  return c.planes.every(([nx,ny,nz,d]) => nx*x+ny*cy+nz*z < d+radius*Math.hypot(nx,nz)+Math.abs(ny)*hy-1e-5);
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
