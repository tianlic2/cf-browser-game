import * as THREE from 'three';
import { LingyinMasterplanBlockout } from './masterplan_blockout';
import { heightAt, WORLD } from './heightfield';
import { merge } from './geom';
import { pavilionTerraceLayout } from './pavilion_terrace';
import type { WalkPoint } from './boardwalk_layout';

// Admission adapter for the reviewed landscape. Art, stairs, miters and guards
// come from the same generator as the editor, never a second approximate route.
export function createApprovedLingyinLandscape(world:THREE.Group) {
  const landscape=new LingyinMasterplanBlockout();
  landscape.group.name='lingyin-approved-landscape';
  landscape.gradeBoardwalkTerrain(world);
  world.add(landscape.group);
  const oldTrail=world.getObjectByName('hillside-pilgrimage-trail');
  if(oldTrail)oldTrail.visible=false;
  const oldWater=world.getObjectByName('water');
  if(oldWater)oldWater.visible=false;

  const layout=landscape.westBoardwalk.userData.railLayout;
  const nodes=landscape.westBoardwalk.userData.route as WalkPoint[];
  const terrace=pavilionTerraceLayout(nodes.at(-1)!,nodes.at(-2)!);
  const solids:any[]=[],radar:any[]=[];
  // Convex footprints retain orientation instead of blocking the large AABB
  // around diagonal rails or the cut corners of a landing.
  const polygon=(points:WalkPoint[],bottom:number,top:number,stepSurface=false)=>{
    const xs=points.map(p=>p.x),zs=points.map(p=>p.z);
    const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
    const area=points.reduce((sum,p,i)=>sum+p.x*points[(i+1)%points.length].z-p.z*points[(i+1)%points.length].x,0);
    if(Math.abs(area)<1e-7)return;
    const planes:number[][]=[[0,1,0,top],[0,-1,0,-bottom]];
    points.forEach((a,i)=>{
      const b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
      if(length<1e-7)return;
      const sign=area>0?1:-1,nx=sign*dz/length,nz=-sign*dx/length;
      planes.push([nx,0,nz,nx*a.x+nz*a.z]);
    });
    solids.push({x,z,hx:(Math.max(...xs)-Math.min(...xs))/2,
      hz:(Math.max(...zs)-Math.min(...zs))/2,y0:bottom,h:top,planes,stepSurface,walkable:false});
  };
  const slab=(a:WalkPoint,b:WalkPoint,width:number,bottom:number,top:number,stepSurface=false)=>{
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),nx=-dz/length*width/2,nz=dx/length*width/2;
    polygon([{x:a.x+nx,z:a.z+nz,y:0},{x:b.x+nx,z:b.z+nz,y:0},
      {x:b.x-nx,z:b.z-nz,y:0},{x:a.x-nx,z:a.z-nz,y:0}],bottom,top,stepSurface);
  };
  for(const s of layout.spans) {
    const length=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z);
    const steps=s.stair?Math.max(5,Math.ceil(length/.48),Math.ceil(Math.abs(s.b.y-s.a.y)/.18)):1;
    for(let i=0;i<steps;i++) {
      const p=(t:number)=>({x:THREE.MathUtils.lerp(s.a.x,s.b.x,t),z:THREE.MathUtils.lerp(s.a.z,s.b.z,t),y:0});
      const top=THREE.MathUtils.lerp(s.a.y,s.b.y,(i+1)/steps);
      slab(p(i/steps),p((i+1)/steps),4.25,top-(s.stair ? .24 : .30),top,s.stair);
    }
    radar.push({kind:'walk',x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2,
      hx:Math.abs(s.b.x-s.a.x)/2+2.125,hz:Math.abs(s.b.z-s.a.z)/2+2.125});
  }
  for(const points of layout.landings)polygon(points,points[0].y-.30,points[0].y);
  polygon(terrace.outline,terrace.entry.y-.70,terrace.entry.y);
  const box=(x:number,z:number,hx:number,hz:number,y0:number,h:number)=>
    solids.push({x,z,hx,hz,y0,h,walkable:false});
  // Posts are shared with the visual de-duplication pass, including supports
  // beneath the deck. Horizontal rails are emitted by the runtime adapter.
  for(const p of landscape.westBoardwalk.userData.postPoints as WalkPoint[]) {
    box(p.x,p.z,.11,.11,Math.min(heightAt(p.x,p.z)-WORLD.platform.y,p.y-1.1),p.y+1.22);
  }
  for(const p of landscape.westBoardwalk.userData.litPostPoints as WalkPoint[])
    box(p.x,p.z,.26,.26,p.y+1.16,p.y+1.825);
  for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4+Math.PI/8;
    box(terrace.pavilion.x+Math.cos(angle)*2.65,terrace.pavilion.z+Math.sin(angle)*2.65,
      .18,.18,13,16.71);
  }
  // Roof catches bullets/jumps but stays above standing players.
  box(terrace.pavilion.x,terrace.pavilion.z,3.55,3.55,16.4,17.95);
  // Upper rail/post faces can catch a descending jump, rather than letting
  // the feet fall into the beam and then forcing a lateral recovery every
  // frame. They come from the very same visible triangles as the deck.
  const walkNames=['phase1-boardwalk-deck','phase1-pavilion-terrace-paving',
    'phase1-boardwalk-supports','phase1-boardwalk-lantern-frames','phase1-boardwalk-lanterns'];
  const walkGeometry=merge(walkNames.map(name=>{
    const mesh=landscape.group.getObjectByName(name) as THREE.Mesh;
    return mesh.geometry.clone();
  }));
  // Keep the east bank/pavilion scenic for now: the bridge remains the same
  // approved combat footprint, with no invisible walking surface over water.
  // Its outward steps are included in the bullet proxy, not NPC destinations.
  return {group:landscape.group,solids,rails:[...layout.rails,...terrace.rails],
    radar,walkGeometry,nodes,terrace,update:(time:number)=>landscape.update(time)};
}
