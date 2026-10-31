// Approved player-weapon tuning exported from preview/weapon-tuner.html on
// 2026-10-24. This is the formal runtime source for combat, viewmodel, recoil
// and spread values. The preview draft/localStorage is intentionally not read
// by the game; only an explicitly approved export is copied here.
export const WEAPON_TUNING = Object.freeze({
  ak: Object.freeze({
    stats: Object.freeze({ magSize: 36, reserve: 108, dmg: 37, head: 140, interval: .1, reload: 2.43, rangeMod: .98, wood: .4 }),
    pose: Object.freeze({ x: .38, y: -.18, z: .01, pitch: .01, yaw: .02, roll: 0, scale: 2.63 }),
    recoil: Object.freeze({ vertical: 2.01, horizontal: 1.95, reset: .55, hold: .15, viewTrack: 1 }),
    inacc: Object.freeze({ stand: .0025, crouch: 0, move: .17506, jump: .14076, fire: 0, recover: .368 }),
  }),
  m4: Object.freeze({
    stats: Object.freeze({ magSize: 30, reserve: 90, dmg: 33, head: 104, interval: .0901, reload: 3.1, rangeMod: .99, wood: .85 }),
    pose: Object.freeze({ x: -.42, y: -.2, z: -.18, pitch: 0, yaw: -1.58, roll: 0, scale: 1.23 }),
    recoil: Object.freeze({ vertical: 1.66, horizontal: 1.65, reset: .55, hold: .15, viewTrack: 1 }),
    inacc: Object.freeze({ stand: .0003, crouch: 0, move: .16106, jump: .1295, fire: .00718, recover: .33856 }),
  }),
  barrett: Object.freeze({
    stats: Object.freeze({ magSize: 15, reserve: 30, dmg: 300, head: 750, interval: 1.55, reload: 3.85, rangeMod: .99, wood: .8 }),
    pose: Object.freeze({ x: .9, y: 0, z: .34, pitch: -.03, yaw: -.02, roll: 0, scale: 5 }),
    recoil: Object.freeze({ vertical: 4.83, horizontal: .29, reset: .55, hold: .22, viewTrack: 1 }),
    inacc: Object.freeze({ stand: .0808, crouch: .0606, move: .17648, jump: .13383, fire: .05385, recover: .345 }),
  }),
  ironbeast: Object.freeze({
    stats: Object.freeze({ magSize: 41, reserve: 123, dmg: 35, head: 104, interval: 0.0901, reload: 3.1, rangeMod: 0.99, wood: 0.85 }),
    pose: Object.freeze({ x: 0, y: 0, z: 0.03, pitch: 0, yaw: 0, roll: 0, scale: 1 }),
    recoil: Object.freeze({ vertical: 4.16, horizontal: 2.73, reset: 0.45, hold: 0.12, viewTrack: 1 }),
    inacc: Object.freeze({ stand: 0.0313, crouch: 0.00443, move: 0.1309, jump: 0.1295, fire: 0.0198, recover: 0.33856 }),
    effects: Object.freeze({ tracer: false }),
  }),
  scar: Object.freeze({
    stats: Object.freeze({ magSize: 41, reserve: 123, dmg: 35, head: 104, interval: 0.0901, reload: 2.47, rangeMod: 0.99, wood: 0.85 }),
    pose: Object.freeze({ x: -0.12, y: 0.01, z: 0.11, pitch: 0, yaw: -0.16, roll: 0, scale: 1 }),
    recoil: Object.freeze({ vertical: 1.36, horizontal: 1.13, reset: 0.55, hold: 0.15, viewTrack: 1 }),
    inacc: Object.freeze({ stand: 0.0059, crouch: 0.00443, move: 0.16106, jump: 0.1295, fire: 0.00718, recover: 0.33856 }),
    effects: Object.freeze({ tracer: false }),
  }),
  m200: Object.freeze({
    stats: Object.freeze({ magSize: 15, reserve: 30, dmg: 220, head: 500, interval: 1.55, reload: 3.42, rangeMod: .99, wood: .8 }),
    pose: Object.freeze({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, scale: 1 }),
    recoil: Object.freeze({ vertical: 4.83, horizontal: .29, reset: .55, hold: .22, viewTrack: 1 }),
    inacc: Object.freeze({ stand: .0808, crouch: .0606, move: .17648, jump: .13383, fire: .05385, recover: .345 }),
  }),
  akgold: Object.freeze({
    stats: Object.freeze({ magSize: 41, reserve: 123, dmg: 37, head: 130, interval: 0.1, reload: 2.71, rangeMod: 0.98, wood: 0.4 }),
    pose: Object.freeze({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, scale: 1 }),
    recoil: Object.freeze({ vertical: 2.52, horizontal: 1.85, reset: 0.68, hold: 0.15, viewTrack: 1 }),
    inacc: Object.freeze({ stand: 0.0248, crouch: 0.00481, move: 0.17506, jump: 0.14076, fire: 0.0174, recover: 0.336 }),
    effects: Object.freeze({ tracer: false }),
  }),
  kn57: Object.freeze({
    stats: Object.freeze({ magSize: 70, reserve: 210, dmg: 500, head: 1000, interval: 0.15, reload: 2.4594594594594597, rangeMod: 0.98, wood: 0.4 }),
    pose: Object.freeze({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, scale: 1 }),
    recoil: Object.freeze({ vertical: 3.06, horizontal: 2.38, reset: 0.55, hold: 0.25, viewTrack: 1 }),
    inacc: Object.freeze({ stand: 0.0173, crouch: 0.0036, move: 0.17506, jump: 0.14076, fire: 0.0303, recover: 0.368 }),
    effects: Object.freeze({ tracer: false }),
  }),
  deagle: Object.freeze({
    stats: Object.freeze({ magSize: 12, reserve: 48, dmg: 54, head: 120, interval: .24, reload: 2.35, rangeMod: .92, wood: .35 }),
    pose: Object.freeze({ x: .23, y: -.19, z: -.55, pitch: 0, yaw: -.04, roll: 0, scale: 1.368 }),
    recoil: Object.freeze({ vertical: 1.2, horizontal: 1.2, reset: .6, hold: .26, viewTrack: 1 }),
    inacc: Object.freeze({ stand: .01026, crouch: .0077, move: .2801, jump: .22522, fire: .01248, recover: .5888 }),
  }),
  knife: Object.freeze({
    stats: Object.freeze({ range: 1.5, lightDmg: 60, lightHead: 130, heavyDmg: 150, heavyHead: 180, lightInterval: .4, heavyInterval: 1 }),
    pose: Object.freeze({ x: .64, y: -.42, z: -1.39, pitch: .01, yaw: 1.55, roll: -.05, scale: 2.414 }),
    recoil: Object.freeze({ vertical: 0, horizontal: 0, reset: .55, hold: .15, viewTrack: 0 }),
    inacc: Object.freeze({ stand: 0, crouch: 0, move: 0, jump: 0, fire: 0, recover: 0 }),
  }),
  kukri: Object.freeze({
    stats: Object.freeze({ range: 1.45, lightDmg: 60, lightHead: 100, heavyDmg: 130, heavyHead: 180, lightInterval: .87, heavyInterval: .36 }),
    pose: Object.freeze({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, scale: 1.13 }),
    recoil: Object.freeze({ vertical: 0, horizontal: 0, reset: .55, hold: .15, viewTrack: 0 }),
    inacc: Object.freeze({ stand: 0, crouch: 0, move: 0, jump: 0, fire: 0, recover: 0 }),
  }),
});
