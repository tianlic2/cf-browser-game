// One plan for the expanded shell, interior transform, gameplay and radar.
// The extra metre is a complete second terrace tier: the hall superstructure
// moves with it instead of becoming shorter inside a taller stone block.
export const MAIN_HALL_RAISE = 1.0;
export const MAIN_HALL = Object.freeze({
  name:'main',x:-2,z:-26,w:31.5,d:24,eave:12,plinth:2.1,rot:0,
});
export const MAIN_HALL_FLOOR_Y = MAIN_HALL.plinth + .25;
export const MAIN_HALL_STAIRS = Object.freeze({
  count:12,width:7.2,treadDepth:.42,treadHeight:.16,frontGap:1.42,
  railWidth:.32,railHeight:.72,
});
// The stair axis remains clear between the inward-open leaves. All dimensions
// here are physical metres relative to the hall centre and its finished floor.
export const MAIN_PORTAL=Object.freeze({
  halfClear:MAIN_HALL_STAIRS.width/2, jambWidth:.34, leafThickness:.22,
  leafDepth:MAIN_HALL_STAIRS.width/2, clearHeight:5.95, flankX:6.76,
  wallZ:MAIN_HALL.d/2-1.35,
});
export const mainPortalWallHalf=MAIN_PORTAL.halfClear+MAIN_PORTAL.jambWidth;
export function mainPortalTimbers(){
  const {halfClear:r,jambWidth:j,leafThickness:t,leafDepth:d,clearHeight:h,wallZ:z}=MAIN_PORTAL;
  const parts=[];
  const add=(name,role,w,height,depth,x,y,z)=>parts.push({name,role,w,h:height,d:depth,x,y,z});
  for(const side of [-1,1]){
    add('jamb','lacquer',j,h,.55,side*(r+j/2),h/2,z);
    add('door-leaf','lacquer',t,h-.12,d,side*(r+t/2),h/2,z-d/2-.08);
  }
  add('lintel','lacquer',2*(r+j)+.34,.39,.65,0,h+.195,z);
  add('transom-cap','darkWood',2*(r+j)+.54,.22,.69,0,h+1.31,z);
  for(const x of [-r-j/2,0,r+j/2])add('transom-post','lacquer',x===0?.15:j,.81,.29,x,h+.795,z);
  return parts;
}
export function mainHallStair(index) {
  const i=Math.max(0,Math.min(MAIN_HALL_STAIRS.count-1,index));
  return {
    z:MAIN_HALL.d/2+MAIN_HALL_STAIRS.frontGap+
      (MAIN_HALL_STAIRS.count-1-i)*MAIN_HALL_STAIRS.treadDepth,
    top:.24+i*MAIN_HALL_STAIRS.treadHeight,
  };
}
export const MAIN_HALL_SCALE = Object.freeze({x:MAIN_HALL.w/27,z:MAIN_HALL.d/17});
export function mainHallPoint(x,z) {
  return {x:MAIN_HALL.x+x*MAIN_HALL_SCALE.x,z:MAIN_HALL.z+z*MAIN_HALL_SCALE.z};
}

// Newels, capstones and collision use the same axis on either side of the clear stair.
export const MAIN_HALL_RAIL = Object.freeze({
  halfPost:.205, postTop:1.09, postShoulder:.89, capWidth:.30, capTop:.74,
  postSteps:Object.freeze([0,4,8,11]), landingBays:5,
  landingZ:MAIN_HALL.d/2+1.05, endX:MAIN_HALL.w/2+1.0,
});
export const hallRailX = MAIN_HALL_STAIRS.width/2 + MAIN_HALL_RAIL.halfPost;
export function hallRailGrade(z) {
  const foot=mainHallStair(0);
  return foot.top+(foot.z-z)*MAIN_HALL_STAIRS.treadHeight/MAIN_HALL_STAIRS.treadDepth;
}
