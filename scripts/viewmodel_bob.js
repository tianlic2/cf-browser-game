export const VIEWMODEL_BOB_AMPLITUDE_SCALE = .5;
export const VIEWMODEL_BOB_FREQUENCY_SCALE = .5;
export const VIEWMODEL_BOB_DISTANCE = .013;

// Shared by the fallback arms and every authored first-person weapon view.
// Returning the final phase rate and amplitude here keeps guns, melee weapons,
// grenades and their visible hands on exactly the same movement curve.
export function viewmodelBobProfile(horizontalSpeed, onGround, crouching, sneaking, weaponType) {
  const moving = horizontalSpeed > .6 && onGround;
  if (!moving) return { moving: false, rate: 0, amplitude: 0 };
  const careful = crouching || sneaking;
  const baseRate = careful ? 6 : horizontalSpeed > 5.6 ? 12 : 8;
  const baseAmplitude = careful ? .55 : horizontalSpeed > 5.6 ? 1.3 : 1;
  return {
    moving: true,
    rate: baseRate * VIEWMODEL_BOB_FREQUENCY_SCALE,
    amplitude: baseAmplitude * VIEWMODEL_BOB_AMPLITUDE_SCALE *
      (weaponType === 'grenade' ? .15 : 1),
  };
}
