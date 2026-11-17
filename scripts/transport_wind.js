// One wind front reaches the loose corners on the starboard row first.
// The seven-metre gap between the rows gives the second sheet time to respond.
export function freightGust(time) {
  const phase=((time%17)+17)%17;
  const second=phase>=6.8;
  const age=second?phase-6.8:phase;
  const duration=second?2.15:2.7;
  if (age>=duration) return 0;
  const rise=Math.min(1,age/.51);
  const fall=Math.max(0,(age-.57)/(duration-.57));
  return (second?.68:1)*rise*rise*(3-2*rise)*(1-fall*fall*(3-2*fall));
}
