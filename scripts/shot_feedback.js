// 开枪时的纯视觉相机震动。它与 aimPunch/弹道完全分离：调用方必须先完成
// 当前子弹的射线与命中结算，再触发这里的短促震动。
export const SHOT_SHAKE_PROFILES = Object.freeze({
  ak:      Object.freeze({ duration: .105, pitch: .00215, yaw: .00118, roll: .00155 }),
  m4:      Object.freeze({ duration: .095, pitch: .00172, yaw: .00092, roll: .00128 }),
  deagle:  Object.freeze({ duration: .120, pitch: .00255, yaw: .00135, roll: .00182 }),
  barrett: Object.freeze({ duration: .145, pitch: .00355, yaw: .00168, roll: .00235 }),
  default: Object.freeze({ duration: .100, pitch: .00165, yaw: .00090, roll: .00120 }),
});

export function createShotShakeState() {
  return { elapsed: 1, duration: 1, pitch: 0, yaw: 0, roll: 0, phase: 0, active: false };
}

export function resetShotShake(state) {
  state.elapsed = state.duration;
  state.pitch = state.yaw = state.roll = 0;
  state.active = false;
  return state;
}

export function triggerShotShake(state, weaponId, scoped = false, sequence = 0) {
  const profile = SHOT_SHAKE_PROFILES[weaponId] || SHOT_SHAKE_PROFILES.default;
  // 开镜时保留枪响的冲击，但适当收敛，避免高倍率镜筒让轻震被视觉放大成眩晕。
  const scopeScale = scoped ? .64 : 1;
  // 自动武器连续射击时保留少量上一发余震，随后限幅，避免帧率或射速令振幅无限叠加。
  const carry = state.active ? .24 : 0;
  state.pitch = Math.min(profile.pitch * 1.42, state.pitch * carry + profile.pitch * scopeScale);
  state.yaw = Math.min(profile.yaw * 1.42, state.yaw * carry + profile.yaw * scopeScale);
  state.roll = Math.min(profile.roll * 1.42, state.roll * carry + profile.roll * scopeScale);
  state.duration = profile.duration;
  state.elapsed = 0;
  state.phase = (sequence % 2 ? 1 : -1) * (0.58 + (sequence % 3) * .17);
  state.active = true;
  return state;
}

export function stepShotShake(state, dt) {
  if (!state.active) return { pitch: 0, yaw: 0, roll: 0, strength: 0 };
  state.elapsed = Math.min(state.duration, state.elapsed + Math.max(0, dt));
  const p = state.duration > 0 ? state.elapsed / state.duration : 1;
  // 二次衰减让第一下清楚、尾巴迅速收住；三条轴使用不同频率，避免机械式同步摆动。
  const envelope = (1 - p) * (1 - p);
  const pitch = state.pitch * envelope * (0.72 * Math.sin(p * Math.PI * 4.6 + state.phase) + .28);
  const yaw = state.yaw * envelope * Math.sin(p * Math.PI * 5.4 - state.phase * .7);
  const roll = state.roll * envelope * Math.sin(p * Math.PI * 6.2 + state.phase * 1.3);
  if (p >= 1) resetShotShake(state);
  return { pitch, yaw, roll, strength: envelope };
}
