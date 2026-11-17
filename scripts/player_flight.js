// Shared camera-relative flight controls. Collision remains the player mover's job.
export function flightMotion(out, keys, yaw, pitch, speed = 6, fastSpeed = 16) {
  const forward=Number(!!keys.KeyW)-Number(!!keys.KeyS);
  const right=Number(!!keys.KeyD)-Number(!!keys.KeyA);
  const up=Number(!!keys.Space)-Number(!!(keys.ControlLeft||keys.ControlRight));
  const horizontal=forward*Math.cos(pitch),sin=Math.sin(yaw),cos=Math.cos(yaw);
  return out.set(right*cos-horizontal*sin,up+forward*Math.sin(pitch),-right*sin-horizontal*cos)
    .normalize().multiplyScalar(keys.ShiftLeft||keys.ShiftRight?fastSpeed:speed);
}
