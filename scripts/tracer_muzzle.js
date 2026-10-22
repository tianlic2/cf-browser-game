// User-approved values from preview/tracer-muzzle.html. Position corrections are
// camera-local metres relative to the animated model muzzle; angles are degrees
// relative to the already sampled shot direction (including movement spread).
export const TRACER_MUZZLE_CALIBRATION=Object.freeze({
  ak:Object.freeze({offset:Object.freeze({x:0,y:0,z:0}),yawDeg:3.7,pitchDeg:2.6}),
  m4:Object.freeze({offset:Object.freeze({x:0,y:0,z:0}),yawDeg:1.3,pitchDeg:.6}),
  ironbeast:Object.freeze({offset:Object.freeze({x:0,y:0,z:0}),yawDeg:.6,pitchDeg:.5}),
  barrett:Object.freeze({offset:Object.freeze({x:0,y:0,z:0}),yawDeg:4.1,pitchDeg:1.4}),
  deagle:Object.freeze({offset:Object.freeze({x:0,y:0,z:0}),yawDeg:.9,pitchDeg:1}),
});

export function tracerMuzzleKey(weaponId,skinId='classic'){
  if(weaponId==='m4')return skinId==='ironbeastgold'?'ironbeast':'m4';
  return TRACER_MUZZLE_CALIBRATION[weaponId]?weaponId:null;
}

export function tracerMuzzleProfile(weaponId,skinId='classic'){
  const key=tracerMuzzleKey(weaponId,skinId);
  return key?TRACER_MUZZLE_CALIBRATION[key]:null;
}

export function applyTracerLaunchCorrection(localShotDirection,profile,out){
  const length=Math.hypot(localShotDirection.x,localShotDirection.y,localShotDirection.z)||1;
  let x=localShotDirection.x/length,y=localShotDirection.y/length,z=localShotDirection.z/length;
  if(profile){
    // Quaternion for Three.js Euler order YXZ with z=0. Kept dependency-free so
    // calibration math can be verified directly by the Node test harness.
    const hx=profile.pitchDeg*Math.PI/360,hy=profile.yawDeg*Math.PI/360;
    const sx=Math.sin(hx),cx=Math.cos(hx),sy=Math.sin(hy),cy=Math.cos(hy);
    const qx=sx*cy,qy=cx*sy,qz=-sx*sy,qw=cx*cy;
    const ix=qw*x+qy*z-qz*y,iy=qw*y+qz*x-qx*z,iz=qw*z+qx*y-qy*x,iw=-qx*x-qy*y-qz*z;
    x=ix*qw+iw*-qx+iy*-qz-iz*-qy;
    y=iy*qw+iw*-qy+iz*-qx-ix*-qz;
    z=iz*qw+iw*-qz+ix*-qy-iy*-qx;
  }
  return out.set(x,y,z).normalize();
}
