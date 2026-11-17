import { CF_VANILLA } from './cf_vanilla_catalog.js';
import { CF_VANILLA_POSE } from './weapon_tuning.js?v=cf-vanilla-m4-approved-1';

// Approved on the ordinary M4A1. All 24 native rigs use the same camera-space
// transform, applied to the entire gun-and-hands rig to preserve grip/animation.
export { CF_VANILLA_POSE };
export const CF_VANILLA_POSES = Object.freeze(Object.fromEntries(
  CF_VANILLA.map(spec=>[spec.id,CF_VANILLA_POSE])
));
