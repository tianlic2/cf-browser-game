// Keep the firing snap at its source speed; stretch the subsequent authored
// bolt motion to fill the requested gameplay lock without cutting it short.
export const AWM_BOLT_DURATION = 2;
export const AWM_BOLT_LEAD = .2;
export const AWM_BOLT_SOURCE_DURATION = 42 / 30;
const scale = (AWM_BOLT_DURATION-AWM_BOLT_LEAD)/(AWM_BOLT_SOURCE_DURATION-AWM_BOLT_LEAD);
export function awmBoltElapsedAt(sourceTime) {
  return sourceTime<=AWM_BOLT_LEAD ? sourceTime : AWM_BOLT_LEAD+(sourceTime-AWM_BOLT_LEAD)*scale;
}
export function awmBoltSourceAt(elapsed) {
  return elapsed<=AWM_BOLT_LEAD ? elapsed : AWM_BOLT_LEAD+(elapsed-AWM_BOLT_LEAD)/scale;
}
