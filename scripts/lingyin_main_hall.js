// One plan for the expanded shell, interior transform, gameplay and radar.
export const MAIN_HALL = Object.freeze({
  name:'main',x:-2,z:-26,w:31.5,d:24,eave:11,plinth:1.1,rot:0,
});
export const MAIN_HALL_SCALE = Object.freeze({x:MAIN_HALL.w/27,z:MAIN_HALL.d/17});
export function mainHallPoint(x,z) {
  return {x:MAIN_HALL.x+x*MAIN_HALL_SCALE.x,z:MAIN_HALL.z+z*MAIN_HALL_SCALE.z};
}
