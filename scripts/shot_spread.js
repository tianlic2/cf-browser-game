// Movement inaccuracy is a tangent-space radius: x/y offsets are applied to
// the local (0, 0, -1) shot direction before camera pitch/yaw are applied.
export function movementSpreadTangent(inacc, motion, moveScale = 0.125, jumpScale = 0.25) {
  if (!inacc) return 0;
  if (!motion.onGround) {
    const standing = motion.crouching ? inacc.crouch : inacc.stand;
    const airborne = inacc.jumpInitial + inacc.jump
      * Math.min(1, Math.abs(motion.verticalSpeed) / motion.jumpVelocity);
    return Math.max(0, airborne - standing) * jumpScale;
  }
  const speed = Math.max(0, motion.horizontalSpeed);
  if (speed < 0.05) return 0;
  const fraction = Math.min(1, speed / motion.runSpeed);
  const stanceScale = motion.crouching ? 0.7 : motion.sneaking ? 0.55 : 1;
  return inacc.move * moveScale * Math.pow(fraction, 0.65) * stanceScale;
}

// The ordinary moving shot samples a uniform-area disk. Unscoped snipers
// retain their existing empty-center ring; movement expands that ring.
export function sampleShotOffset(movingRadius, hipMin = 0, hipMax = 0, random = Math.random) {
  if (movingRadius <= 0 && hipMax <= 0) return { x: 0, y: 0 };
  const angle = random() * Math.PI * 2;
  const hipRadius = hipMax > 0
    ? Math.sqrt(hipMin ** 2 + random() * (hipMax ** 2 - hipMin ** 2)) : 0;
  const moving = movingRadius > 0 ? Math.sqrt(random()) * movingRadius : 0;
  const radius = hipRadius + moving;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
