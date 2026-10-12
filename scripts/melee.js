// Default knife: short alternating cuts and a slower overhead stab.
// Range is measured from the camera to the first hit surface, in scene metres.
// The 1.5 m reach is an approximation; community CF tables are not engine units.
export const KNIFE = {
  range: 1.5,
  light: { dmg: 35, head: 90, backstab: 120, interval: .4, hitStart: .11, hitEnd: .20, arc: .22, sweepSign: 1, pitchArc: .025 },
  thrust: { dmg: 35, head: 90, backstab: 120, interval: .5, hitStart: .15, hitEnd: .23, arc: .22, sweepSign: -1, pitchArc: -.025 },
  heavy: { dmg: 90, head: 180, backstab: 180, interval: 1.0, hitStart: .38, hitEnd: .48, arc: .09, sweepSign: 1, pitchArc: .12 },
};
const zero=[0,0,0,0,0,0];
// Position and Euler offsets, relative to the calibrated knife rest grip.
// The right hand and knife move as one; the free hand is held in camera space.
const poses={
  light:[[0,zero],[.075,[.085,.035,.045,.14,-.22,-.36]],
    [.165,[-.225,.015,-.19,-.17,.36,.90]],[.245,[-.18,-.025,-.12,-.12,.22,.62]],[.4,zero]],
  // The follow-up cuts back across the screen instead of poking forward.
  thrust:[[0,zero],[.11,[-.11,.045,.045,.12,.24,.40]],
    [.20,[.19,.01,-.20,-.16,-.35,-.83]],[.29,[.14,-.025,-.12,-.10,-.20,-.55]],[.5,zero]],
  heavy:[[0,zero],[.24,[.045,.17,.04,.29,-.24,-.42]],
    [.35,[.005,.18,-.025,.48,-.10,-.50]],
    [.43,[-.13,-.075,-.26,-.47,.12,.18]],
    [.60,[-.09,-.095,-.14,-.27,.08,.14]],[1,zero]],
};
export function knifePose(kind,t) {
  const keys=poses[kind];if(!keys)return zero;
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]) {
    const [ta,a]=keys[i-1],[tb,b]=keys[i];let u=Math.max(0,Math.min(1,(t-ta)/(tb-ta)));u=u*u*(3-2*u);
    return a.map((v,k)=>v+(b[k]-v)*u);
  }
  return zero;
}
