import type { WalkPoint, WalkRail } from './boardwalk_layout';

/** The last stair ends at the terrace entrance, NOT at the pavilion centre. */
export function pavilionTerraceLayout(entry:WalkPoint,previous:WalkPoint) {
  const length=Math.hypot(entry.x-previous.x,entry.z-previous.z);
  const forward={x:(entry.x-previous.x)/length,z:(entry.z-previous.z)/length};
  const normal={x:-forward.z,z:forward.x};
  const point=(u:number,v:number):WalkPoint=>({x:entry.x+forward.x*u+normal.x*v,
    y:entry.y,z:entry.z+forward.z*u+normal.z*v});
  const outline=[[0,-3.95],[1.4,-5.65],[10.6,-5.65],[13.15,-3.7],
    [13.15,3.7],[10.6,5.65],[1.4,5.65],[0,3.95]].map(([u,v])=>point(u,v));
  // One OPEN chain around the terrace. Its two endpoints exactly coincide
  // with the last flight's guards; no fence or sill crosses the entrance.
  const guard=[[0,-2.05],[0,-3.8],[1.5,-5.5],[10.5,-5.5],[13,-3.6],
    [13,3.6],[10.5,5.5],[1.5,5.5],[0,3.8],[0,2.05]].map(([u,v])=>point(u,v));
  const rails:WalkRail[]=guard.slice(1).map((b,i)=>({a:guard[i],b,corner:true}));
  const pavilion=point(8.7,-.45);
  const signedDistance=(x:number,z:number)=>{
    let inside=true,distance=Infinity;
    for(let i=0;i<outline.length;i++) {
      const a=outline[i],b=outline[(i+1)%outline.length];
      const dx=b.x-a.x,dz=b.z-a.z;
      if(dx*(z-a.z)-dz*(x-a.x)<-1e-7)inside=false;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
      distance=Math.min(distance,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
    }
    return inside?-distance:distance;
  };
  return {entry,forward,normal,outline,guard,rails,pavilion,signedDistance};
}
