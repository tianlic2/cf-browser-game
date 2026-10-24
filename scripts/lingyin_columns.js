// Authored dimensions, before the main interior's X/Z expansion transform.
export const MAIN_INTERIOR_COLUMNS=[[-7.7,-4.75],[7.7,-4.75],[-7.7,-2],[7.7,-2],[-5.5,.5],[5.5,.5]];
export const MAIN_COLUMN_PARTS=[
  {role:'bronze',rt:.79,rb:.85,h:.24,y:1.47,segments:32},
  {role:'lacquer',rt:.58,rb:.66,h:7.67,y:5.535,segments:32},
  {role:'gilt',rt:.63,rb:.63,h:.075,y:1.73,segments:32},
  {role:'gilt',rt:.66,rb:.62,h:.12,y:9.19,segments:32},
];
export const MAIN_CENSER={x:0,z:-.55,scale:.66};
export const MAIN_CENSER_PROFILE=[[.43,0],[.72,.14],[.92,.48],[1.02,.78],[.92,.86],[.74,.77],[.66,.52],[.3,.47]];
export const MAIN_HALL_FIXTURES=[
 {name:'backscreen',role:'darkWood',w:17.4,h:7.65,d:.22,x:0,y:3.89,z:-6.67,support:false},
 {name:'dais-lower',role:'darkWood',w:16.2,h:.38,d:3.5,x:0,y:.19,z:-4.72,support:true},
 {name:'dais-upper',role:'darkWood',w:14.4,h:.28,d:2.8,x:0,y:.48,z:-4.8,support:true},
 {name:'altar-top',role:'darkWood',w:13.5,h:.2,d:1.25,x:0,y:1.2,z:-2.06,support:true},
 {name:'altar-apron',role:'darkWood',w:13.3,h:.48,d:.22,x:0,y:.84,z:-1.44,support:false},
 ...[-4.6,0,4.6].flatMap((x,i)=>[
  {name:`statue-pad-${i}`,role:'bronze',w:x===0?3.85:3,h:.24,d:2.1,x,y:.71,z:-4.85,support:true},
  {name:`statue-pad-cap-${i}`,role:'gilt',w:x===0?3.7:2.88,h:.07,d:2,x,y:.87,z:-4.85,support:true},
 ]),
 ...[-6.3,-3.2,0,3.2,6.3].map((x,i)=>({name:`altar-leg-${i}`,role:'lacquer',w:.34,h:1,d:.37,x,y:.57,z:-2.55,support:false})),
];

export function hallPerimeterColumns(s){
 const out=[],hw=s.w/2,hd=s.d/2,nx=Math.max(3,Math.round(s.w/3.4)),nz=Math.max(2,Math.round(s.d/3.6));
 const height=s.eave-s.plinth-.35;
 for(const side of [-1,1])for(let i=0;i<=nx;i++){
  const x=-hw+1+(s.w-2)*i/nx;
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
