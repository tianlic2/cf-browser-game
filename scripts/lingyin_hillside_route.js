// The only retained mountain route starts outside the west-side temple hall.
// Y is relative to the temple terrace (source world Y=3.25m). The former
// front-gate climb, spur and lookout decks were removed so the gate forecourt
// can remain a simple flat arrival space.
export const WEST_RIDGE_TRAIL = [
  [-36.4,7,.95],[-40,7,1.25],[-44,9,2],[-47,14,3],
  [-47,20,4.05],[-43,25,5.15],[-47,30,6.25],[-50,36,7.45],
  [-49,43,8.65],[-43,48,9.95],[-37,54,11.05],[-40,59,12],
  [-44.8,62,13],
];
export const RIDGE_TRAILS = [WEST_RIDGE_TRAIL];

export const RIDGE_HALF_WIDTH = 2.45;
export const RIDGE_RAIL_OFFSET = RIDGE_HALF_WIDTH + .27;
export const RIDGE_GRADED_WIDTH = RIDGE_HALF_WIDTH + 1.45;
export const RIDGE_SHOULDER = 7.2;
export const RIDGE_SURFACE_LIFT = .14;
export const RIDGE_LOOKOUTS = [
  {x:-50,z:62,y:13,hx:5.2,hz:4.2,entrySide:'east',entryX:-44.8,entryZ:62},
];
// Match the complete visible gate paving. Keeping the support footprint smaller
// than the stone plane creates an apparent air wall that can only be crossed
// while airborne because grounded movement consults canTraverse().
export const FRONT_GATE_FORECOURT = {x0:-24,x1:20,z0:45.5,z1:74.5,y:0};

// A single mitered centreline supplies both the paving and the physical rails.
// Adjacent segments share a corner frame, so they cannot leave triangular holes
// or create a second loose post at every bend.
export function ridgeRouteFrames(route,spacing=.9) {
  const normals=[];
  for(let i=0;i<route.length-1;i++) {
    const dx=route[i+1][0]-route[i][0],dz=route[i+1][1]-route[i][1];
    const length=Math.hypot(dx,dz);
    normals.push({x:-dz/length,z:dx/length});
  }
  const corners=route.map((_,i)=>{
    if(i===0)return normals[0];
    if(i===route.length-1)return normals.at(-1);
    const a=normals[i-1],b=normals[i];
    const x=a.x+b.x,z=a.z+b.z,length=Math.hypot(x,z);
    const ux=x/length,uz=z/length,scale=Math.min(1.45,1/(ux*b.x+uz*b.z));
    return {x:ux*scale,z:uz*scale};
  });
  const frames=[];
  let along=0;
  for(let i=0;i<route.length-1;i++) {
    const a=route[i],b=route[i+1];
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const steps=Math.ceil(length/spacing);
    const blend=Math.min(3,length*.45);
    for(let j=0;j<steps;j++) {
      const t=j/steps,from=Math.max(0,1-length*t/blend);
      const to=Math.max(0,1-length*(1-t)/blend);
      const n={x:normals[i].x*(1-from-to)+corners[i].x*from+corners[i+1].x*to,
        z:normals[i].z*(1-from-to)+corners[i].z*from+corners[i+1].z*to};
      frames.push({x:a[0]+dx*t,z:a[1]+dz*t,y:a[2]+(b[2]-a[2])*t,
        nx:n.x,nz:n.z,along:along+length*t});
    }
    along+=length;
  }
  const last=route.at(-1),normal=corners.at(-1);
  frames.push({x:last[0],z:last[1],y:last[2],nx:normal.x,nz:normal.z,along});
  return frames;
}

function distanceToRoute(x,z,route) {
  let best=Infinity;
  for(let i=0;i<route.length-1;i++) {
    const a=route[i],b=route[i+1],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
    best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }
  return best;
}

export function ridgeGuardSections(routeIndex,spacing=.9) {
  const frames=ridgeRouteFrames(RIDGE_TRAILS[routeIndex],spacing);
  const sections=[];
  const total=frames.at(-1).along;
  for(const side of [-1,1]) {
    let section=[];
    for(let i=0;i<frames.length-1;i++) {
      const a=frames[i],b=frames[i+1];
      const p={x:a.x+a.nx*side*RIDGE_RAIL_OFFSET,
        z:a.z+a.nz*side*RIDGE_RAIL_OFFSET,y:a.y,along:a.along};
      const q={x:b.x+b.nx*side*RIDGE_RAIL_OFFSET,
        z:b.z+b.nz*side*RIDGE_RAIL_OFFSET,y:b.y,along:b.along};
      const x=(p.x+q.x)/2,z=(p.z+q.z)/2,along=(p.along+q.along)/2;
      const atEntrance=along<2.4;
      const onTerrace=RIDGE_LOOKOUTS.some(t=>
        Math.abs(x-t.x)<t.hx+.3&&Math.abs(z-t.z)<t.hz+.3);
      const insideBranch=RIDGE_TRAILS.some((route,index)=>index!==routeIndex&&
        distanceToRoute(x,z,route)<RIDGE_HALF_WIDTH+.16);
      if(!atEntrance&&!onTerrace&&!insideBranch) {
        if(!section.length)section.push(p);
        section.push(q);
      } else if(section.length) {
        if(section.length>1)sections.push({routeIndex,side,points:section});
        section=[];
      }
    }
    if(section.length>1)sections.push({routeIndex,side,points:section});
  }
  return sections;
}

export function ridgeTrailAt(x,z) {
  let best=Infinity, result=null, along=0;
  for(let trail=0;trail<RIDGE_TRAILS.length;trail++) {
    const points=RIDGE_TRAILS[trail];
    for(let i=0;i<points.length-1;i++) {
      const a=points[i],b=points[i+1];
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(length*length)));
      const px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(x-px,z-pz);
      if(d<best) {
        best=d;
        result={distance:d,y:a[2]+(b[2]-a[2])*t,x:px,z:pz,
          trail,segment:i,t,along:along+length*t};
      }
      along+=length;
    }
  }
  return result;
}

export function ridgeLookoutContains(x,z) {
  return RIDGE_LOOKOUTS.find(p=>Math.abs(x-p.x)<=p.hx&&Math.abs(z-p.z)<=p.hz)||null;
}

export function ridgeTrailSurfaceAt(x,z) {
  const lookout=ridgeLookoutContains(x,z);
  if(lookout)return lookout.y;
  const p=ridgeTrailAt(x,z);
  return p.distance<=RIDGE_HALF_WIDTH?p.y+RIDGE_SURFACE_LIFT:null;
}

export function ridgeTrailDistance(x,z) {
  const p=ridgeTrailAt(x,z);
  let d=p.distance;
  for(const lookout of RIDGE_LOOKOUTS)d=Math.min(d,Math.hypot(
    Math.max(0,Math.abs(x-lookout.x)-lookout.hx),
    Math.max(0,Math.abs(z-lookout.z)-lookout.hz)));
  return d;
}
