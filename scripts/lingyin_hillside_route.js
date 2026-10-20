// Authored mountain route shared by the terrain mesh and the FPS collision.
// Y is relative to the temple terrace (source world Y=3.25m).
export const RIDGE_TRAIL = [
  [-2,47.2,.24],[-2,49,1.1],[-2,52,3.0],[-3,55,4.75],[-5,58,6.3],
  [-10,61,7.4],[-22,64,8.5],[-35,67,10.2],[-44,66,11.75],
  [-50,58,13.8],[-58,58,15.8],[-63,65,15.25],[-72,63,16.5],
  [-78,58,19],[-78,55,19.6],[-78,52,19.8],[-75,50,19.8],
];
export const RIDGE_SPUR = [
  [-58,58,15.8],[-58,55,15.8],[-58,52,15.8],[-58,50,15.8],
];
// The west-side temple hall opens onto a second climb. Its long contouring
// traverse avoids a direct, implausibly steep cut through the mountain.
export const WEST_RIDGE_TRAIL = [
  [-36.4,7,.95],[-40,7,1.4],[-44,8,2.6],[-47,12,4],
  [-47,18,5.3],[-44,22,6.2],[-47,27,8],[-49,33,10],
  [-49,40,11.5],[-37,46,11.8],[-37,57,12.4],[-50,58,13.8],
];
export const RIDGE_TRAILS = [RIDGE_TRAIL,RIDGE_SPUR,WEST_RIDGE_TRAIL];

export const RIDGE_HALF_WIDTH = 2.45;
export const RIDGE_RAIL_OFFSET = RIDGE_HALF_WIDTH + .27;
export const RIDGE_GRADED_WIDTH = RIDGE_HALF_WIDTH + 1.45;
export const RIDGE_SHOULDER = 7.2;
export const RIDGE_SURFACE_LIFT = .14;
export const RIDGE_JUNCTION = {x:-50,z:58,radius:4.5};
export const RIDGE_LOOKOUTS = [
  {x:-58,z:49,hx:4,hz:2.5,y:15.8,entryX:-58},
  {x:-75,z:50,hx:5,hz:4.5,y:19.8,entryX:-78},
];

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
      const atEntrance=(routeIndex===0&&along<2.2)||(routeIndex===2&&along<2.4);
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
  return p.distance<=RIDGE_HALF_WIDTH||
    Math.hypot(x-RIDGE_JUNCTION.x,z-RIDGE_JUNCTION.z)<=RIDGE_JUNCTION.radius?
      p.y+RIDGE_SURFACE_LIFT:null;
}

export function ridgeTrailDistance(x,z) {
  const p=ridgeTrailAt(x,z);
  let d=p.distance;
  for(const lookout of RIDGE_LOOKOUTS)d=Math.min(d,Math.hypot(
    Math.max(0,Math.abs(x-lookout.x)-lookout.hx),
    Math.max(0,Math.abs(z-lookout.z)-lookout.hz)));
  return d;
}
