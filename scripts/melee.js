import { WEAPON_TUNING } from './weapon_tuning.js?v=approved-2026-10-24';

// Festa axe: alternate the two authored light attacks and use bigshot for heavy.
// Range is measured from the camera to the first hit surface, in scene metres.
// The 1.5 m reach is an approximation; community CF tables are not engine units.
// The approved export uses the authored clip timing directly; action phases,
// hit windows and cooldowns all share this single scale.
export const AXE_ACTION_TIME_SCALE = 1;
const slowed = (seconds) => seconds * AXE_ACTION_TIME_SCALE;
const approved = WEAPON_TUNING.knife.stats;
export const KNIFE = {
  range: approved.range,
  light: { dmg: approved.lightDmg, head: approved.lightHead, backstab: 120, interval: approved.lightInterval, hitStart: slowed(.11), hitEnd: slowed(.20), arc: .22, sweepSign: 1, pitchArc: .025 },
  thrust: { dmg: approved.lightDmg, head: approved.lightHead, backstab: 120, interval: approved.lightInterval, hitStart: slowed(.15), hitEnd: slowed(.23), arc: .22, sweepSign: -1, pitchArc: -.025 },
  heavy: { dmg: approved.heavyDmg, head: approved.heavyHead, backstab: 180, interval: approved.heavyInterval, hitStart: slowed(.38), hitEnd: slowed(.48), arc: .09, sweepSign: 1, pitchArc: .12 },
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
  t/=AXE_ACTION_TIME_SCALE;
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]) {
    const [ta,a]=keys[i-1],[tb,b]=keys[i];let u=Math.max(0,Math.min(1,(t-ta)/(tb-ta)));u=u*u*(3-2*u);
    return a.map((v,k)=>v+(b[k]-v)*u);
  }
  return zero;
}
