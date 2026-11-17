import { MAIN_PORTAL } from './lingyin_main_hall.js?v=grand-portal-1';
// Authored dimensions, before the main interior's X/Z expansion transform.
export const MAIN_INTERIOR_COLUMNS=[[-9.25,-4.75],[9.25,-4.75],[-9.25,-2],[9.25,-2],[-9.25,.5],[9.25,.5]];
export const MAIN_COLUMN_PARTS=[
  {role:'bronze',rt:.79,rb:.85,h:.24,y:1.47,segments:32},
  {role:'lacquer',rt:.58,rb:.66,h:7.67,y:5.535,segments:32},
  {role:'gilt',rt:.63,rb:.63,h:.075,y:1.73,segments:32},
  {role:'gilt',rt:.66,rb:.62,h:.12,y:9.19,segments:32},
];
// Shared by the visible joinery, floor support and projectile proxies.
export const OFFERING_TABLE=Object.freeze({w:4.74,d:.82,top:.64,z:-1.51,legX:2.13,legZ:.29});
export const OFFERING_STONE=Object.freeze({z:-3.02,d:1.06,wingX:4.67,wingW:4.64,wingTop:.86,centreTop:.71});
export const MAIN_CENSER={x:0,z:OFFERING_TABLE.z,scale:.40,baseY:OFFERING_TABLE.top-.065*.40};
export const MAIN_VOTIVE_LAMPS={x:7.58,z:-3.74,profile:[[.32,.60],[.44,.74],[.38,.87],[.29,1.07],[.34,1.16],[.135,4.23],[.22,4.34],[.09,4.45],[0,4.66]]};
export const MAIN_CENSER_PROFILE=[[.43,0],[.72,.14],[.92,.48],[1.02,.78],[.92,.86],[.74,.77],[.66,.52],[.3,.47]];
// Dimensions in the hall's authoring coordinates. The statue receives a
// uniform world scale, whereas the casework follows the hall's plan scale.
export const MAIN_SHRINE=Object.freeze({
  pitch:5.30, scale:1.27, statueZ:-5.10, seatY:1.115,
  frontZ:-4.17, backZ:-6.46, postWidth:.20, sillY:.62, corniceY:7.89,
});
const shrine=MAIN_SHRINE;
export const MAIN_HALL_FIXTURES=[
 {name:'backscreen',role:'darkWood',w:18.65,h:7.82,d:.22,x:0,y:3.89,z:-6.67,support:false},
 {name:'dais-lower',role:'darkWood',w:18.3,h:.38,d:3.5,x:0,y:.19,z:-4.72,support:true},
 {name:'dais-upper',role:'darkWood',w:17.6,h:.28,d:2.8,x:0,y:.48,z:-4.8,support:true},
 {name:'altar-top',role:'darkWood',w:OFFERING_TABLE.w,h:.08,d:OFFERING_TABLE.d,
  x:0,y:OFFERING_TABLE.top-.04,z:OFFERING_TABLE.z,support:true},
 {name:'altar-apron',role:'darkWood',w:2*OFFERING_TABLE.legX,h:.15,d:.08,x:0,
  y:OFFERING_TABLE.top-.155,z:OFFERING_TABLE.z+OFFERING_TABLE.legZ,support:false},
 ...[-1,1].flatMap(side=>[-1,1].map(end=>({name:'altar-leg-'+side+'-'+end,role:'darkWood',
  w:.20,h:OFFERING_TABLE.top-.08,d:.19,x:side*OFFERING_TABLE.legX,
  y:(OFFERING_TABLE.top-.08)/2,z:OFFERING_TABLE.z+end*OFFERING_TABLE.legZ,support:false}))),
 ...[-1,0,1].map(side=>{
  const stone=OFFERING_STONE,top=side?stone.wingTop:stone.centreTop;
  return {name:'altar-stone-'+side,role:'darkWood',w:side?stone.wingW:2*stone.wingX-stone.wingW,
   h:top,d:stone.d,x:side*stone.wingX,y:top/2,z:stone.z,support:true};
 }),
 {name:'niche-soffit',role:'darkWood',w:3*shrine.pitch,h:.14,d:shrine.frontZ-shrine.backZ,
   x:0,y:7.75,z:(shrine.frontZ+shrine.backZ)/2,support:true},
 ...[-1.5,-.5,.5,1.5].map((bay,i)=>({
   name:`niche-return-${i}`,role:'darkWood',w:shrine.postWidth,
   h:shrine.corniceY-shrine.sillY,d:shrine.frontZ-shrine.backZ,x:bay*shrine.pitch,
   y:(shrine.corniceY+shrine.sillY)/2,z:(shrine.frontZ+shrine.backZ)/2,support:false,
 })),
 ...[-shrine.pitch,0,shrine.pitch].flatMap((x,i)=>[
  {name:`statue-pad-${i}`,role:'darkWood',w:4.70,h:.39,d:2.63,x,y:.815,z:shrine.statueZ,support:true},
  {name:`statue-pad-cap-${i}`,role:'bronze',w:4.58,h:.105,d:2.54,x,y:1.0625,z:shrine.statueZ,support:true},
 ]),

];

// The visible stone shoes on the front colonnade rise from the finished
// terrace. Each ring is also used by the round movement and bullet proxies.
export const MAIN_PORCH_SHOE=[
  {y:0,r:.455},{y:.052,r:.455},{y:.082,r:.437},{y:.205,r:.416},
  {y:.242,r:.425},{y:.267,r:.406},{y:.298,r:.352},
];
export function hallPerimeterColumns(s){
 const out=[],hw=s.w/2,hd=s.d/2,nx=Math.max(3,Math.round(s.w/3.4)),nz=Math.max(2,Math.round(s.d/3.6));
 const height=s.eave-s.plinth-.35;
 for(const side of [-1,1])for(let i=0;i<=nx;i++){
  let x=-hw+1+(s.w-2)*i/nx;
  if(s.name==='main'&&side===1){
    // Widen the middle bay and distribute the remaining spans evenly out to
    // the existing corner posts. Brackets and projectile solids use this list.
    const post=MAIN_PORTAL.halfClear+.46, end=hw-1;
    const rank=Math.abs(i-nx/2)-.5;
    x=Math.sign(x)*(post+(end-post)*rank/((nx-1)/2));
  }
  if((s.name==='main'&&side===1&&Math.abs(x)<1.6)||(s.name==='gate'&&Math.abs(x)<1))continue;
  out.push({x,z:side*(hd-.9),height:s.name==='gate'&&Math.abs(x)>4?3.7:height});
 }
 for(const side of [-1,1])for(let i=1;i<nz;i++)out.push({x:side*(hw-.9),z:-hd+1+(s.d-2)*i/nz,
  height:s.name==='gate'?3.7:height});
 return out;
}

// Exact polygonal tapered cylinder, including non-uniform X/Z expansion.
// The same dimensions create a lightweight ray proxy; never use the ellipse's
// enclosing rectangle as a player wall or a bullet blocker.
export function columnBrush(x,z,y0,h,rt,rb,sx=1,sz=1,rot=0,segments=16,name='column'){
 const co=Math.cos(rot),si=Math.sin(rot),radius=Math.max(rt,rb),slope=(rt-rb)/(h-y0);
 const planes=[[0,1,0,h],[0,-1,0,-y0]],apothem=Math.cos(Math.PI/segments);
 for(let i=0;i<segments;i++){
  const angle=(i+.5)*2*Math.PI/segments,lx=Math.sin(angle)/sx,lz=Math.cos(angle)/sz;
  const nx=lx*co+lz*si,nz=-lx*si+lz*co,ny=-apothem*slope;
  planes.push([nx,ny,nz,nx*x+nz*z+apothem*(rb-slope*y0)]);
 }
 return {name,x,z,hx:radius*Math.hypot(sx*co,sz*si),hz:radius*Math.hypot(sx*si,sz*co),y0,h,
  planes,preciseEscape:true,walkable:false,round:{rt,rb,sx,sz,rot,segments}};
}
