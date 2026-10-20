// Gameplay footprint of the authored Lingyin scene. Source coordinates are kept
// intact in X/Z; the temple platform (source Y=3.25) becomes gameplay Y=0.
import { RIDGE_HALF_WIDTH, RIDGE_LOOKOUTS, RIDGE_TRAILS,
  ridgeGuardSections, ridgeTrailSurfaceAt } from './lingyin_hillside_route.js?v=hillside-6';

export const LINGYIN_BOUNDS = { hw: 84, hl: 70 };
export const LINGYIN_PLATFORM_Y = 3.25;

const brush = (x, z, hx, hz, y0, h, walkable = false) =>
  ({ x, z, hx, hz, y0, h, walkable });

export function lingyinLayout() {
  const colliders = [];
  const add = (...args) => colliders.push(brush(...args));
  // Perimeter solids match the visible wall, closed bridge doors, and north
  // terrace rail. The bridge and exterior path remain scenic beyond them.
  add(-35.5, -21.1, .19, 24.9, .35, 1.85);
  add(-35.5, 27.95, .19, 17.75, .35, 1.85);
  for(const z of [3.8,10.2])add(-35.5,z,.39,.39,0,3.7);
  add(-35.5,7,.64,3.55,3.825,4.175); // visible west-gate lintel
  add(-4, -47, 32, .19, .35, 1.85);
  add(27.5, -12, .19, 35, .35, 1.85);
  add(27.5, 39, .19, 6, .35, 1.85);
  add(27.5, 28, .19, 5, .35, 3.1);
  add(-20.25, 45.7, 15.25, .14, .1, 1.08);
  add(14.25, 45.7, 13.25, .14, .1, 1.08);
  for(const x of [-5,1])add(x,45.7,.28,.28,0,1.25);

  // Generate collision from precisely the same visible rail sections. At a
  // junction only the interior branch rail opens; the outer edge stays fenced.
  for(let routeIndex=0;routeIndex<RIDGE_TRAILS.length;routeIndex++) {
    for(const section of ridgeGuardSections(routeIndex)) {
      let lastPost=-Infinity;
      for(const [i,p] of section.points.entries()) {
        if(i===0||i===section.points.length-1||p.along-lastPost>=2.25) {
          add(p.x,p.z,.1,.1,p.y-.18,p.y+1.58);
          lastPost=p.along;
        }
        if(i===0)continue;
        const q=section.points[i-1];
        const hx=Math.abs(p.x-q.x)/2+.085,hz=Math.abs(p.z-q.z)/2+.085;
        for(const beamY of [1.03,1.45])
          add((p.x+q.x)/2,(p.z+q.z)/2,hx,hz,
            Math.min(p.y,q.y)+beamY-.07,
            Math.max(p.y,q.y)+beamY+.07);
      }
    }
  }
  for(const lookout of RIDGE_LOOKOUTS) {
    const deckY=lookout.y;
    const overlookEdge=(x,z,hx,hz) => {
      add(x,z,hx,hz,deckY,deckY+.72);
      add(x,z,hx+.02,hz+.02,deckY+.96,deckY+1.08);
      const horizontal=hx>hz,length=(horizontal?hx:hz)*2;
      const count=Math.max(1,Math.round(length/2.4));
      for(let i=0;i<=count;i++) {
        const offset=(i/count-.5)*length;
        add(x+(horizontal?offset:0),z+(horizontal?0:offset),
          .09,.09,deckY+.72,deckY+1.08);
      }
    };
    overlookEdge(lookout.x-lookout.hx,lookout.z,.17,lookout.hz);
    overlookEdge(lookout.x+lookout.hx,lookout.z,.17,lookout.hz);
    overlookEdge(lookout.x,lookout.z-lookout.hz,lookout.hx,.17);
    const left=lookout.x-lookout.hx,right=lookout.x+lookout.hx;
    const gap0=Math.max(left,lookout.entryX-1.5);
    const gap1=Math.min(right,lookout.entryX+1.5);
    if(gap0-left>.2)overlookEdge((left+gap0)/2,lookout.z+lookout.hz,
      (gap0-left)/2,.17);
    if(right-gap1>.2)overlookEdge((gap1+right)/2,lookout.z+lookout.hz,
      (right-gap1)/2,.17);
  }

  // The five halls are real rooms. Their plinths and stair treads are walkable;
  // the same local transforms are used for visual Temple.buildHall() and here.
  const structures = [
    {name:'gate',x:-2,z:40,w:15,d:8.5,eave:5.4,plinth:.8,rot:0},
    {name:'main',x:-2,z:-12,w:27,d:17,eave:8,plinth:1.1,rot:0},
    {name:'west',x:-25.5,z:7,w:9,d:16,eave:5,plinth:.7,rot:Math.PI/2},
    {name:'east',x:19,z:7,w:9,d:16,eave:5,plinth:.7,rot:-Math.PI/2},
    {name:'rear',x:-2,z:-38,w:17,d:10,eave:6.4,plinth:.9,rot:0},
  ];
  const floors = [];
  const world = (s,lx,lz) => ({x:s.x+lx*Math.cos(s.rot)+lz*Math.sin(s.rot),
    z:s.z-lx*Math.sin(s.rot)+lz*Math.cos(s.rot)});
  const local = (s,x,z) => ({x:(x-s.x)*Math.cos(s.rot)-(z-s.z)*Math.sin(s.rot),
    z:(x-s.x)*Math.sin(s.rot)+(z-s.z)*Math.cos(s.rot)});
  const addLocal = (s,lx,lz,hw,hz,y0,top,walkable=false) => {
    const p=world(s,lx,lz);
    add(p.x,p.z,Math.abs(Math.cos(s.rot))*hw+Math.abs(Math.sin(s.rot))*hz,
      Math.abs(Math.sin(s.rot))*hw+Math.abs(Math.cos(s.rot))*hz,y0,top,walkable);
  };
  for (const s of structures) {
    const hw=s.w/2,hd=s.d/2,roomY=s.plinth+.25;
    addLocal(s,0,0,hw+1.2,hd+1.2,0,roomY,true);
    floors.push({s,lx:0,lz:0,hx:hw+1.37,hz:hd+1.37,y:roomY});
    // The original treads are 0.4m apart; a narrow support overlap accounts
    // for a character's foot contact patch without changing their visible art.
    for(let i=0;i<5;i++) {
      const z=hd+1.35+(4-i)*.4+(s.plinth-.8)*.25;
      const y=.24+i*.16;
      addLocal(s,0,z,2.5,.25,0,y,true);
      floors.push({s,lx:0,lz:z,hx:2.5,hz:.3,y});
      if(s.name==='gate') {
        const back=-hd-1.35-(4-i)*.4;
        addLocal(s,0,back,2.5,.25,0,y,true);
        floors.push({s,lx:0,lz:back,hx:2.5,hz:.3,y});
      }
    }
    const inset=1.35,gap=s.name==='main'?5.4:s.name==='rear'||s.name==='gate'?4.6:3.4;
    const wallY=roomY,wallTop=s.eave-s.plinth-.15;
    const wallX=hw-inset,wallZ=hd-inset;
    const seg=(s.w-2*inset-gap)/2;
    for(const sign of [-1,1]) {
      if(s.name==='gate')addLocal(s,sign*(hw-2.2),wallZ,1.2,.18,wallY,wallTop);
      else addLocal(s,sign*(gap/2+seg/2),wallZ,seg/2,.18,wallY,wallTop);
      addLocal(s,sign*wallX,0,.18,hd-inset,wallY,wallTop);
    }
    if(s.name==='gate'||s.name==='west') {
      for(const sign of [-1,1])addLocal(s,sign*(gap/2+seg/2),-wallZ,seg/2,.18,wallY,wallTop);
    } else addLocal(s,0,-wallZ,wallX,.18,wallY,wallTop);
    // Perimeter columns are visible cylinders, including those beside open
    // doors. Keep their collision small enough to preserve the actual bay.
    const colsX=Math.max(3,Math.round(s.w/3.4));
    const colsZ=Math.max(2,Math.round(s.d/3.6));
    const columnTop=s.eave-s.plinth-.35;
    for(const zs of [-1,1])for(let i=0;i<=colsX;i++){
      const x=-hw+1+((s.w-2)*i)/colsX;
      if((s.name==='main'&&zs===1&&Math.abs(x)<1.6)||
         (s.name==='gate'&&Math.abs(x)<1))continue;
      addLocal(s,x,zs*(hd-.9),.29,.29,roomY,columnTop);
    }
    for(const xs of [-1,1])for(let i=1;i<colsZ;i++){
      const z=-hd+1+((s.d-2)*i)/colsZ;
      addLocal(s,xs*(hw-.9),z,.29,.29,roomY,columnTop);
    }
    if(s.name==='main'){
      const railW=hw+1.2,railZ=hd+1.45;
      for(const sign of [-1,1]){
        addLocal(s,sign*(railW+3.6)/2,railZ,(railW-3.6)/2,.14,.45,1.35);
        addLocal(s,sign*railW,0,.14,railZ,.45,1.35);
      }
    }
    if(s.name!=='gate'&&s.name!=='main'&&s.name!=='west') {
      // Back-wall altar: visible geometry and capsule obstruction agree.
      addLocal(s,0,-hd+2.7,Math.min(5.5,(s.w-3.25)*.62)*.5,.7,wallY,roomY+1.05);
    }
  }
  // Raised stone link between the west hall's rear bay and the open gate.
  add(-34.25,7,2.16,1.63,0,.98,true);
  add(-31, 33, 3.1, 3.1, 0, 8);
  // The censer is a tripod, not a solid cube: its three feet and upper bowl
  // have separate collision so actors and shots can pass between the legs.
  for(let i=0;i<3;i++) {
    const a=i*Math.PI*2/3;
    const lx=Math.cos(a)*1.9,lz=Math.sin(a)*1.9;
    const ux=Math.cos(a)*1.55,uz=Math.sin(a)*1.55;
    add(-2+(lx+ux)/2,22+(lz+uz)/2,
      Math.abs(lx-ux)/2+.18,Math.abs(lz-uz)/2+.18,.015,1.98);
  }
  add(-2,22,1.5,1.5,1.9,3.32); // bowl and lid, clear of standing heads
  add(-2,22,.28,.28,3.32,4.1); // finial
  add(-2,-10.25,1.9,1.2,1.1,5.7); // Buddha and throne, moved up against the mural wall
  add(-2,-11.4,4.25,.13,.4,7.0); // prevent walking through the mural backing
  for (const [x,z] of [[-7.5,44],[3.5,44],[-10,34],[6,34],[5,10],[-10,10],[25,33]])
    add(x,z,.39,.39,0,2.45);
  for (const x of [-10.5,6.5]) add(x,41.5,.74,1.08,0,2.15);
  add(7.5,33,1.06,.86,0,2.9); // rotated 冷泉 stone stele
  for(const x of [-12,8])add(x,37,.11,.11,0,4.2); // prayer-ribbon posts

  const insideTemple = (x,z) => x > -35.5 && x < 27.5 && z > -46.8 && z < 45.7;
  const surfacesAt = (x,z,maxHeight = Infinity) => {
    const ridgeY=ridgeTrailSurfaceAt(x,z);
    if(!insideTemple(x,z)&&ridgeY===null)return [];
    const heights=maxHeight>=0&&insideTemple(x,z)?[0]:[];
    if(ridgeY!==null&&ridgeY<=maxHeight)heights.push(ridgeY);
    for(const f of floors) {
      if(f.y>maxHeight)continue;
      const p=local(f.s,x,z);
      if(Math.abs(p.x-f.lx)<=f.hx&&Math.abs(p.z-f.lz)<=f.hz)heights.push(f.y);
    }
    if(Math.abs(x+34.25)<=2.16&&Math.abs(z-7)<=1.63&&.98<=maxHeight)
      heights.push(.98);
    return [...new Set(heights)].sort((a,b)=>a-b);
  };
  const surfaceAt = (x,z,maxHeight = Infinity) => surfacesAt(x,z,maxHeight).at(-1) ?? null;

  const player = [[-25,0,28],[-22,0,31],[-28,0,24],[-18,0,27],[-24,0,20],[-17,0,33],[-30,0,18],[-20,0,21]];
  const enemy = [[21,0,-29],[18,0,-31],[23,0,-25],[17,0,-27],[22,0,-33],[15,0,-29],[24,0,-20],[18,0,-24]];
  const topdown = [
    {kind:'hull',x:-35.5,z:-21.1,hx:.2,hz:24.9},
    {kind:'hull',x:-35.5,z:27.95,hx:.2,hz:17.75},
    {kind:'hull',x:27.5,z:0,hx:.2,hz:46},
    {kind:'hull',x:-4,z:-47,hx:32,hz:.2},
    ...structures.map(({x,z,w,d,rot})=>({kind:'house',x,z,
      hx:Math.abs(Math.cos(rot))*w/2+Math.abs(Math.sin(rot))*d/2,
      hz:Math.abs(Math.sin(rot))*w/2+Math.abs(Math.cos(rot))*d/2})),
    {kind:'house',x:-31,z:33,hx:3,hz:3},
    ...RIDGE_TRAILS.flatMap(route=>route.slice(0,-1).map((a,i)=>{
      const b=route[i+1];
      return {kind:'walk',x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,
        hx:Math.abs(a[0]-b[0])/2+RIDGE_HALF_WIDTH,
        hz:Math.abs(a[1]-b[1])/2+RIDGE_HALF_WIDTH};
    })),
    ...RIDGE_LOOKOUTS.map(p=>({kind:'bridge',x:p.x,z:p.z,hx:p.hx,hz:p.hz})),
  ];
  return { colliders, bounds: LINGYIN_BOUNDS, spawns:{player,enemy},
    spawnYaws:{player:player.map(()=>0)},
    topdown, surfacesAt, surfaceAt, floorY:0,
    navigationMaxHeight:21, navigationStep:.7, stepHeight:.52 };
}
