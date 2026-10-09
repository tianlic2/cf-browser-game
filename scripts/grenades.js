import * as THREE from 'three';

// Classic-style timings in this game's metre scale, not extracted CF constants.
export const GRENADE = Object.freeze({ prime:20/30, release:.18, recover:.42, speed:17, lift:3.2, gravity:16, radius:.085 });

// Swept sphere vs convex Source brushes (or fallback AABBs). Crossing a thin
// wall in one frame must still collide; slab entry also supplies the true normal.
export function sweepGrenade(from,to,colliders,radius=GRENADE.radius,floorY=0) {
  let best=null;
  for(const c of colliders) {
    if(Math.max(from.x,to.x)<c.x-c.hx-radius||Math.min(from.x,to.x)>c.x+c.hx+radius||
       Math.max(from.z,to.z)<c.z-c.hz-radius||Math.min(from.z,to.z)>c.z+c.hz+radius||
       Math.min(from.y,to.y)>c.h+radius||Math.max(from.y,to.y)<(c.y0??0)-radius)continue;
    const planes=c.planes||[[1,0,0,c.x+c.hx],[-1,0,0,-c.x+c.hx],[0,1,0,c.h],[0,-1,0,-(c.y0??0)],[0,0,1,c.z+c.hz],[0,0,-1,-c.z+c.hz]];
    let enter=-Infinity,exit=1,normal=null,miss=false;
    for(const [x,y,z,d] of planes) {
      const a=x*from.x+y*from.y+z*from.z-d-radius,b=x*to.x+y*to.y+z*to.z-d-radius;
      if(a>0&&b>0){miss=true;break;}
      if(a<=0&&b<=0)continue;
      const t=a/(a-b);
      if(a>b){if(t>enter){enter=t;normal=new THREE.Vector3(x,y,z);}}
      else exit=Math.min(exit,t);
    }
    if(!miss&&normal&&enter>=0&&enter<=exit&&enter<=1&&(!best||enter<best.t))best={t:enter,normal};
  }
  // The fallback deck is at zero; the imported ship's lowest floor is below
  // its tunnels. Never seal the tunnel stairs with an invisible plane at y=0.
  if(from.y>=floorY+radius&&to.y<floorY+radius){const t=(from.y-floorY-radius)/(from.y-to.y);if(!best||t<best.t)best={t,normal:new THREE.Vector3(0,1,0)};}
  return best;
}

export function advanceGrenade(g,dt,colliders,onBounce=()=>{},floorY=0) {
  let remaining=Math.min(dt,Math.max(0,g.fuse-g.t));
  const end=new THREE.Vector3();
  while(remaining>1e-7) {
    const step=Math.min(remaining,1/120);remaining-=step;g.t+=step;
    g.vel.y-=GRENADE.gravity*step;
    let travel=step;
    for(let i=0;i<3&&travel>1e-6;i++) {
      end.copy(g.mesh.position).addScaledVector(g.vel,travel);
      const hit=sweepGrenade(g.mesh.position,end,colliders,GRENADE.radius,floorY);
      if(!hit){g.mesh.position.copy(end);break;}
      g.mesh.position.lerp(end,hit.t).addScaledVector(hit.normal,.001);
      const impact=-g.vel.dot(hit.normal);
      if(impact>0){
        g.vel.addScaledVector(hit.normal,impact*(impact<.65?1:1.43));
        if(hit.normal.y>.55){g.vel.x*=.78;g.vel.z*=.78;}
        if(impact>1.2&&g.t-(g.lastBounce??-1)>.08){onBounce(g.mesh.position,impact);g.lastBounce=g.t;}
      }
      travel*=1-hit.t;
    }
    if(g.vel.lengthSq()>.1){g.mesh.rotation.x+=step*7;g.mesh.rotation.z+=step*5;}
  }
  if(g.fuse-g.t<1e-6)g.t=g.fuse;
}

export function grenadePose(action) {
  if(!action)return [0,0,0,0,0,0];
  const pull=Math.min(1,action.t/GRENADE.prime);
  const wind=Number.isFinite(action.releaseAt)?Math.max(0,Math.min(1,(action.t-action.releaseAt+GRENADE.release)/GRENADE.release)):0;
  if(action.thrown){const p=Math.min(1,(action.t-action.releaseAt)/GRENADE.recover);return [-.12*(1-p),-.20*p,-.22*(1-p),-.8*(1-p),0,-.2*(1-p)];}
  return [-.035*pull,.035*pull+.12*wind,.045*pull+.12*wind,.18*pull+.65*wind,0,-.12*pull];
}
