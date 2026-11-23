// Presentation velocities, not changes to hitscan damage or weapon balance.
export function enemyRoundProfile(id='ak') {
  const key=id.replace(/^cfv_/,'');
  const speed=/m4|scar|aug|famas/.test(key)?880:/barrett|m200|awp|awm|scout|hbr7/.test(key)?820:
    /deagle|pistol|usp|elite|m1911/.test(key)?330:715;
  return {speed,segment:speed*.0045,radius:.004,nearRadius:2.5};
}
export function closestBulletPass(start,end,listener,speed=715) {
  const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z,lengthSq=dx*dx+dy*dy+dz*dz;
  if(lengthSq<1)return null;
  const u=((listener.x-start.x)*dx+(listener.y-start.y)*dy+(listener.z-start.z)*dz)/lengthSq;
  // Endpoints are impacts, not a completed flypast. Never extend through cover.
  if(u<=0||u>=1)return null;
  const x=start.x+dx*u,y=start.y+dy*u,z=start.z+dz*u;
  const distance=Math.hypot(listener.x-x,listener.y-y,listener.z-z),length=Math.sqrt(lengthSq),along=length*u;
  if(distance<.12||distance>2.5||along<1)return null;
  return {x,y,z,distance,along,speed,delay:along/speed+distance/343,
    dx:dx/length,dy:dy/length,dz:dz/length,before:Math.min(4,along),after:Math.min(8,length-along),supersonic:speed>343};
}
