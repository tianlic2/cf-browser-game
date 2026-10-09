// Classic default knife behavior. Distances are metres to the hit surface,
// Do not copy unverified community table units straight into the scene.
// Timings/range are this project's calibrated approximation, not client data.
export const KNIFE = {
  range: 1.4,
  light: { dmg: 35, head: 90, backstab: 120, interval: .4, hitStart: .11, hitEnd: .20, arc: .24 },
  thrust: { dmg: 35, head: 90, backstab: 120, interval: .5, hitStart: .15, hitEnd: .23, arc: .08 },
  heavy: { dmg: 90, head: 180, backstab: 180, interval: 1.0, hitStart: .38, hitEnd: .48, arc: .10 },
};
const zero=[0,0,0,0,0,0];
// Position and Euler offsets, relative to the calibrated knife rest grip.
// The right hand and knife move as one; the free hand is held in camera space.
const poses={
  light:[[0,zero],[.07,[.045,.015,.025,.10,-.18,-.28]],
    [.17,[-.28,.025,-.13,-.20,.46,1.05]],[.25,[-.20,-.025,-.07,-.12,.28,.75]],[.4,zero]],
  thrust:[[0,zero],[.10,[.02,-.035,.045,.25,-.08,-.18]],
    [.20,[-.12,.02,-.24,-.18,.20,.22]],[.29,[-.09,0,-.17,-.12,.12,.16]],[.5,zero]],
  heavy:[[0,zero],[.24,[.055,.19,.05,.30,-.28,-2.45]],
    [.35,[.01,.17,-.015,.52,-.12,-2.65]],
    [.43,[-.16,-.085,-.22,-.42,.14,-2.85]],
    [.60,[-.11,-.11,-.13,-.30,.10,-2.6]],[1,zero]],
};
export function knifePose(kind,t) {
  const keys=poses[kind];if(!keys)return zero;
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]) {
    const [ta,a]=keys[i-1],[tb,b]=keys[i];let u=Math.max(0,Math.min(1,(t-ta)/(tb-ta)));u=u*u*(3-2*u);
    return a.map((v,k)=>v+(b[k]-v)*u);
  }
  return zero;
}
