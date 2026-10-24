export type WalkPoint = {x:number;y:number;z:number};
export type WalkSpan = {a:WalkPoint;b:WalkPoint;stair:boolean;index:number};
export type WalkRail = {a:WalkPoint;b:WalkPoint;corner:boolean};

/** One shared miter per side of each turn; never overlap independent rails. */
export function boardwalkLayout(nodes:WalkPoint[], stairs:Set<number>) {
  const directions=nodes.slice(1).map((b,i)=>{
    const a=nodes[i],length=Math.hypot(b.x-a.x,b.z-a.z);
    return {x:(b.x-a.x)/length,z:(b.z-a.z)/length,length};
  });
  const turns=nodes.map((_,i)=>{
    if(i===0||i===nodes.length-1)return {inset:0,mx:0,mz:0};
    const a=directions[i-1],b=directions[i];
    const dot=a.x*b.x+a.z*b.z;
    const mx=-a.z-b.z,mz=a.x+b.x,denom=1+dot;
    if(denom<.1)throw new Error('Boardwalk needs a wider hairpin landing');
    // Reserve a level transition on BOTH sides of a stair. A square slab
    // over the centre of a sloping flight swallows its final treads.
    const inset=2.325*Math.sqrt(Math.max(0,(1-dot)/denom));
    return {inset,mx:mx/denom,mz:mz/denom};
  });
  const offset=(p:WalkPoint,d:{x:number;z:number},distance:number)=>
    ({x:p.x+d.x*distance,y:p.y,z:p.z+d.z*distance});
  const sidePoint=(p:WalkPoint,d:{x:number;z:number},side:number,width:number)=>
    ({x:p.x-d.z*side*width,y:p.y,z:p.z+d.x*side*width});
  const spans:WalkSpan[]=directions.map((d,i)=>{
    const start=turns[i].inset,end=turns[i+1].inset;
    if(start+end>d.length-.2)throw new Error(`Boardwalk span ${i} has no clear flight`);
    return {a:offset(nodes[i],d,start),b:offset(nodes[i+1],d,-end),
      stair:stairs.has(i),index:i};
  });
  const rails:WalkRail[]=[],landings:WalkPoint[][]=[];
  const addRail=(a:WalkPoint,b:WalkPoint,corner=false)=>{
    if(Math.hypot(b.x-a.x,b.z-a.z)>.001)rails.push({a,b,corner});
  };
  spans.forEach((s,i)=>{
    for(const side of [-1,1])addRail(sidePoint(s.a,directions[i],side,2.05),
      sidePoint(s.b,directions[i],side,2.05));
    if(i===spans.length-1)return;
    const node=nodes[i+1],turn=turns[i+1],next=spans[i+1],d=directions[i],nd=directions[i+1];
    for(const side of [-1,1]) {
      const m={x:node.x+turn.mx*side*2.05,y:node.y,z:node.z+turn.mz*side*2.05};
      addRail(sidePoint(s.b,d,side,2.05),m,true);
      addRail(m,sidePoint(next.a,nd,side,2.05),true);
    }
    // The deck uses the same boundary, slightly outside the guard centreline.
    // The six-sided miter fills the turn without an overlapping square slab.
    const m=(side:number)=>({x:node.x+turn.mx*side*2.125,y:node.y,
      z:node.z+turn.mz*side*2.125});
    landings.push([sidePoint(s.b,d,1,2.125),m(1),sidePoint(next.a,nd,1,2.125),
      sidePoint(next.a,nd,-1,2.125),m(-1),sidePoint(s.b,d,-1,2.125)]);
  });
  return {spans,rails,landings};
}
