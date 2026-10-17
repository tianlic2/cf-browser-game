// GoldSrc BSP solid leaves are excellent wall volumes, but their convex
// partition caps are not necessarily rendered floors. Build a small X/Z index
// from actual opaque triangles so actor feet use the surface the player sees.
export const GOLDSRC_COLLISION_SURFACE_MODE = 'visible-mesh-v1';

export function buildGoldsrcSurfaceIndex(data, binary) {
  const cellSize = 2;
  const cells = new Map(), wallCells = new Map();
  const cellKey = (x, z) => `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`;
  const addTriangle=(index,triangle,minX,maxX,minZ,maxZ)=>{
    for(let gx=Math.floor(minX/cellSize);gx<=Math.floor(maxX/cellSize);gx++)
      for(let gz=Math.floor(minZ/cellSize);gz<=Math.floor(maxZ/cellSize);gz++) {
        const key=`${gx},${gz}`;
        if(!index.has(key))index.set(key,[]);
        index.get(key).push(triangle);
      }
  };
  for (const part of data.parts) {
    // Transparent water and unlit MDL scenery are visual effects/props, not
    // authoritative BSP walking surfaces.
    if ((part.material.opacity ?? 1) < 1 || part.material.unlit) continue;
    const values = new Float32Array(binary, part.offset, part.count * 7);
    for (let i = 0; i < values.length; i += 21) {
      const ax=values[i], ay=values[i+1], az=values[i+2];
      const bx=values[i+7], by=values[i+8], bz=values[i+9];
      const cx=values[i+14], cy=values[i+15], cz=values[i+16];
      const ux=bx-ax, uy=by-ay, uz=bz-az, vx=cx-ax, vy=cy-ay, vz=cz-az;
      const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
      const normalLength=Math.hypot(nx,ny,nz);
      if (!normalLength) continue;
      const triangle={ax,ay,az,bx,by,bz,cx,cy,cz,
        minY:Math.min(ay,by,cy),maxY:Math.max(ay,by,cy)};
      const minX=Math.min(ax,bx,cx), maxX=Math.max(ax,bx,cx);
      const minZ=Math.min(az,bz,cz), maxZ=Math.max(az,bz,cz);
      addTriangle(Math.abs(ny)/normalLength>=.35?cells:wallCells,
        triangle,minX,maxX,minZ,maxZ);
    }
  }
  const surfacesAt=(x,z,ceiling=Infinity)=>{
    const heights=[];
    for(const t of cells.get(cellKey(x,z))||[]) {
      const denominator=(t.bz-t.cz)*(t.ax-t.cx)+(t.cx-t.bx)*(t.az-t.cz);
      if(Math.abs(denominator)<1e-9)continue;
      const a=((t.bz-t.cz)*(x-t.cx)+(t.cx-t.bx)*(z-t.cz))/denominator;
      const b=((t.cz-t.az)*(x-t.cx)+(t.ax-t.cx)*(z-t.cz))/denominator;
      const c=1-a-b;
      if(a<-.001||b<-.001||c<-.001)continue;
      const y=a*t.ay+b*t.by+c*t.cy;
      if(y<=ceiling+1e-4)heights.push(y);
    }
    heights.sort((a,b)=>a-b);
    return heights.filter((y,i)=>!i||y-heights[i-1]>.015);
  };
  const surfaceAt=(x,z,ceiling=Infinity)=>{
    const heights=surfacesAt(x,z,ceiling);
    return heights.length?heights[heights.length-1]:-Infinity;
  };
  const segmentDistanceSq=(px,pz,ax,az,bx,bz)=>{
    const dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz;
    const t=length?Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/length)):0;
    const x=ax+dx*t,z=az+dz*t;
    return (px-x)**2+(pz-z)**2;
  };
  const horizontalDistanceSq=(t,x,z)=>{
    const denominator=(t.bz-t.cz)*(t.ax-t.cx)+(t.cx-t.bx)*(t.az-t.cz);
    if(Math.abs(denominator)>1e-9) {
      const a=((t.bz-t.cz)*(x-t.cx)+(t.cx-t.bx)*(z-t.cz))/denominator;
      const b=((t.cz-t.az)*(x-t.cx)+(t.ax-t.cx)*(z-t.cz))/denominator;
      if(a>=0&&b>=0&&a+b<=1)return 0;
    }
    return Math.min(segmentDistanceSq(x,z,t.ax,t.az,t.bx,t.bz),
      segmentDistanceSq(x,z,t.bx,t.bz,t.cx,t.cz),
      segmentDistanceSq(x,z,t.cx,t.cz,t.ax,t.az));
  };
  const blockerAt=(x,z,feet=0,radius=.45,step=.5,height=1.78)=>{
    const low=feet+step,high=feet+height,radiusSq=radius*radius;
    const seen=new Set();
    for(let gx=Math.floor((x-radius)/cellSize);gx<=Math.floor((x+radius)/cellSize);gx++)
      for(let gz=Math.floor((z-radius)/cellSize);gz<=Math.floor((z+radius)/cellSize);gz++)
        for(const triangle of wallCells.get(`${gx},${gz}`)||[]) {
          if(seen.has(triangle))continue;
          seen.add(triangle);
          if(triangle.maxY<=low+1e-4||triangle.minY>=high-1e-4)continue;
          if(horizontalDistanceSq(triangle,x,z)<radiusSq-1e-5)return true;
        }
    return false;
  };
  return {surfaceAt,surfacesAt,blockerAt};
}

// Mandatory entry point for every imported GoldSrc map loader. It keeps legacy
// generated JSON usable, while new imports declare the mode explicitly.
export function prepareGoldsrcCollision(data, binary) {
  if (data.collisionSurfaceMode &&
      data.collisionSurfaceMode !== GOLDSRC_COLLISION_SURFACE_MODE)
    throw new Error(`Unsupported GoldSrc collision surface mode: ${data.collisionSurfaceMode}`);
  for (const collider of data.colliders || []) collider.localStep = true;
  return buildGoldsrcSurfaceIndex(data,binary);
}
