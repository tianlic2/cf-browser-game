// Approved player-weapon tuning exported from preview/weapon-tuner.html on
// 2026-10-31. This is the formal runtime source for combat, viewmodel, recoil
// and spread values. The preview draft/localStorage is intentionally not read
// by the game; only an explicitly approved export is copied here.
export const CF_VANILLA_POSE = Object.freeze({x:.006,y:-.035,z:-.004,pitch:0,yaw:0,roll:0,scale:.949});
export const WEAPON_TUNING = Object.freeze({
  cfv_m4a1: Object.freeze({
    stats:Object.freeze({magSize:30,reserve:90,dmg:37,head:113,interval:.1,reload:3.18518519,rangeMod:.98,wood:.75}),
    pose:CF_VANILLA_POSE,
    recoil:Object.freeze({vertical:1.025,horizontal:.688,reset:.4,hold:.15,viewTrack:1}),
    inacc:Object.freeze({stand:.0059,crouch:.00443,move:.16106,jump:.1295,fire:.00718,recover:.33856}),
    effects:Object.freeze({tracer:false}),
  }),
  cfv_awp: Object.freeze({
    stats:Object.freeze({magSize:10,reserve:30,dmg:130,head:300,interval:1.4,boltTime:1.4,reload:2.26666667,rangeMod:.98,wood:.75}),
    pose:Object.freeze({x:-.086,y:.028,z:.033,pitch:-.15,yaw:-.22,roll:-.12,scale:1}),
    recoil:Object.freeze({vertical:4.83,horizontal:.29,reset:.4,hold:.15,viewTrack:1}),
    inacc:Object.freeze({stand:.0808,crouch:.0606,move:.17648,jump:.13383,fire:.05385,recover:.345}),
    effects:Object.freeze({tracer:false}),
  }),
  awm_nature: Object.freeze({
    stats: Object.freeze({magSize:17,reserve:51,dmg:500,head:1000,interval:1.55,boltTime:2,reload:2.9,rangeMod:.99,wood:.8}),
    pose: Object.freeze({x:.02,y:-.02,z:.17,pitch:0,yaw:-.07,roll:0,scale:5,fov:49}),
    recoil: Object.freeze({vertical:4.83,horizontal:.29,reset:.55,hold:.22,viewTrack:1}),
    inacc: Object.freeze({stand:.0808,crouch:.0606,move:.17648,jump:.13383,fire:.05385,recover:.345}),
    effects: Object.freeze({tracer:false}),
  }),
  ak: Object.freeze({
    stats: Object.freeze({ magSize: 40, reserve: 120, dmg: 38, head: 140, interval: .1, reload: 2.43, rangeMod: .98, wood: .4 }),
    pose: Object.freeze({ x: .15, y: .31, z: .44, pitch: -.17, yaw: -.1, roll: 0, scale: 3.562 }),
    recoil: Object.freeze({ vertical: 2.01, horizontal: 1.95, reset: .55, hold: .15, viewTrack: 1 }),
    inacc: Object.freeze({ stand: .0025, crouch: 0, move: .17506, jump: .14076, fire: 0, recover: .368 }),
    effects: Object.freeze({ tracer: false }),
  }),
  m4: Object.freeze({
    stats: Object.freeze({ magSize: 40, reserve: 120, dmg: 33, head: 104, interval: .0901, reload: 3.1, rangeMod: .99, wood: .85 }),
    pose: Object.freeze({ x: -.42, y: -.2, z: -.18, pitch: 0, yaw: -1.58, roll: 0, scale: 1.23 }),
    recoil: Object.freeze({ vertical: 1.66, horizontal: 1.65, reset: .55, hold: .15, viewTrack: 1 }),
    inacc: Object.freeze({ stand: .0003, crouch: 0, move: .16106, jump: .1295, fire: .00718, recover: .33856 }),
    effects: Object.freeze({ tracer: false }),
  }),
  barrett: Object.freeze({
    stats: Object.freeze({ magSize: 15, reserve: 30, dmg: 306, head: 750, interval: 1.55, reload: 3.85, rangeMod: .99, wood: .8 }),
    pose: Object.freeze({ x: .82, y: 0, z: .34, pitch: -.03, yaw: -.02, roll: 0, scale: 5 }),
    recoil: Object.freeze({ vertical: 4.83, horizontal: .29, reset: .55, hold: .22, viewTrack: 1 }),
    inacc: Object.freeze({ stand: .0808, crouch: .0606, move: .17648, jump: .13383, fire: .05385, recover: .345 }),
    effects: Object.freeze({ tracer: false }),
  }),
  ironbeast: Object.freeze({
    stats: Object.freeze({ magSize: 41, reserve: 123, dmg: 36, head: 120, interval: 0.0901, reload: 3.1, rangeMod: 0.99, wood: 0.85 }),
    pose: Object.freeze({ x: 0.01, y: -0.02, z: 0.03, pitch: 0, yaw: -0.11, roll: 0, scale: 1 }),
    recoil: Object.freeze({ vertical: 1, horizontal: 1, reset: 0.3, hold: 0.12, viewTrack: 1 }),
    inacc: Object.freeze({ stand: 0, crouch: 0.00443, move: 0.1309, jump: 0.1295, fire: 0.00718, recover: 0.33856 }),
    effects: Object.freeze({ tracer: false }),
  }),
  scar: Object.freeze({
    stats: Object.freeze({ magSize: 41, reserve: 123, dmg: 37, head: 115, interval: 0.0901, reload: 2.47, rangeMod: 0.99, wood: 0.85 }),
    pose: Object.freeze({ x: -0.12, y: 0.01, z: 0.15, pitch: 0, yaw: -0.17, roll: 0, scale: 0.965 }),
    recoil: Object.freeze({ vertical: 1.01, horizontal: 1, reset: 0.35, hold: 0.15, viewTrack: 1 }),
    inacc: Object.freeze({ stand: 0, crouch: 0, move: 0.16106, jump: 0.1295, fire: 0.00718, recover: 0.33856 }),
    effects: Object.freeze({ tracer: false }),
  }),
  m200: Object.freeze({
    stats: Object.freeze({ magSize: 15, reserve: 30, dmg: 220, head: 500, interval: 1.55, reload: 3.42, rangeMod: .99, wood: .8 }),
    pose: Object.freeze({ x: .14, y: -.08, z: .1, pitch: 0, yaw: -.07, roll: 0, scale: .762 }),
    recoil: Object.freeze({ vertical: 4.83, horizontal: .29, reset: .55, hold: .22, viewTrack: 1 }),
    inacc: Object.freeze({ stand: .0808, crouch: .0606, move: .17648, jump: .13383, fire: .05385, recover: .345 }),
    effects: Object.freeze({ tracer: false }),
  }),
  akgold: Object.freeze({
    stats: Object.freeze({ magSize: 50, reserve: 150, dmg: 38, head: 130, interval: 0.1, reload: 2.71, rangeMod: 0.98, wood: 0.4 }),
    pose: Object.freeze({ x: 0, y: 0, z: 0.01, pitch: 0, yaw: -0.15, roll: 0, scale: 1.305 }),
    recoil: Object.freeze({ vertical: 1.18, horizontal: 1.11, reset: 0.3, hold: 0.15, viewTrack: 1 }),
    inacc: Object.freeze({ stand: 0.00641, crouch: 0, move: 0.17506, jump: 0.14076, fire: 0.0078, recover: 0.368 }),
    effects: Object.freeze({ tracer: false }),
  }),
  kn57: Object.freeze({
    stats: Object.freeze({ magSize: 50, reserve: 150, dmg: 60, head: 200, interval: 0.13, reload: 2.4594594594594597, rangeMod: 0.98, wood: 0.4 }),
    pose: Object.freeze({ x: 0.02, y: -0.01, z: -0.02, pitch: 0, yaw: 0, roll: 0, scale: 0.331 }),
    recoil: Object.freeze({ vertical: 1.25, horizontal: 0.4, reset: 0.2, hold: 0.13, viewTrack: 1 }),
    inacc: Object.freeze({ stand: 0.0173, crouch: 0.0036, move: 0.0863, jump: 0.0728, fire: 0.0102, recover: 0.158 }),
    effects: Object.freeze({ tracer: false }),
  }),
  deagle: Object.freeze({
    stats: Object.freeze({ magSize: 12, reserve: 48, dmg: 54, head: 120, interval: .24, reload: 2.35, rangeMod: .92, wood: .35 }),
    pose: Object.freeze({ x: .36, y: -.19, z: -.55, pitch: 0, yaw: -.29, roll: 0, scale: 1.487 }),
    recoil: Object.freeze({ vertical: 1.2, horizontal: 1.2, reset: .6, hold: .26, viewTrack: 1 }),
    inacc: Object.freeze({ stand: .01026, crouch: .0077, move: .2801, jump: .22522, fire: .01248, recover: .5888 }),
    effects: Object.freeze({ tracer: false }),
  }),
  knife: Object.freeze({
    stats: Object.freeze({ range: 1.5, lightDmg: 60, lightHead: 130, heavyDmg: 150, heavyHead: 180, lightInterval: .4, heavyInterval: 1 }),
    pose: Object.freeze({ x: .64, y: -.42, z: -1.39, pitch: .01, yaw: 1.55, roll: -.05, scale: 2.414 }),
    recoil: Object.freeze({ vertical: 0, horizontal: 0, reset: .55, hold: .15, viewTrack: 0 }),
    inacc: Object.freeze({ stand: 0, crouch: 0, move: 0, jump: 0, fire: 0, recover: 0 }),
  }),
  kukri: Object.freeze({
    stats: Object.freeze({ range: 1.65, lightDmg: 60, lightHead: 100, heavyDmg: 130, heavyHead: 180, lightInterval: .87, heavyInterval: .36 }),
    pose: Object.freeze({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, scale: 1.13 }),
    recoil: Object.freeze({ vertical: 0, horizontal: 0, reset: .55, hold: .15, viewTrack: 0 }),
    inacc: Object.freeze({ stand: 0, crouch: 0, move: 0, jump: 0, fire: 0, recover: 0 }),
  }),
});
