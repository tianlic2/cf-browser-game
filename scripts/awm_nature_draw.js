// Skip the first half of the source clip, which lifts and lowers the entire
// rifle. Raise the rifle from below while blending into its remaining bolt action.
export const AWM_DRAW_DURATION = 1.43;
export const AWM_DRAW_BLEND_SECONDS = .24;
export const AWM_DRAW_START_PHASE = .5;
export const AWM_DRAW_TIME_SPLIT = AWM_DRAW_BLEND_SECONDS / AWM_DRAW_DURATION;
export function awmDrawSourcePhase(timePhase) {
  const t=Math.max(0,Math.min(1,timePhase));
  return t<=AWM_DRAW_TIME_SPLIT ? AWM_DRAW_START_PHASE
    : AWM_DRAW_START_PHASE+(t-AWM_DRAW_TIME_SPLIT)/(1-AWM_DRAW_TIME_SPLIT)*(1-AWM_DRAW_START_PHASE);
}
export function awmDrawTimePhase(sourcePhase) {
  const s=Math.max(0,Math.min(1,sourcePhase));
  return s<=AWM_DRAW_START_PHASE ? AWM_DRAW_TIME_SPLIT
    : AWM_DRAW_TIME_SPLIT+(s-AWM_DRAW_START_PHASE)/(1-AWM_DRAW_START_PHASE)*(1-AWM_DRAW_TIME_SPLIT);
}
