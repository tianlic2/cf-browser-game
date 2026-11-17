// Cross sections of the lotus bearer's head, in the same local metres as the robe.
// Each row is height, half-width, forward depth and rear depth from the ear plane.
const sections=[
  [3.29,.02,.09,.06],[3.315,.18,.22,.16],[3.38,.302,.313,.25],
  [3.49,.385,.346,.30],[3.66,.445,.343,.352],[3.84,.466,.348,.374],
  [4.015,.474,.360,.388],[4.16,.466,.371,.382],[4.28,.433,.342,.344],
  [4.37,.334,.252,.285],[4.42,.02,.035,.024],
];
function section(y:number,k:number){
  let i=0;
  while(i<sections.length-2&&y>sections[i+1][0])i++;
  const a=sections[i],b=sections[i+1],p=sections[Math.max(0,i-1)],q=sections[Math.min(sections.length-1,i+2)];
  const span=b[0]-a[0],v=Math.max(0,Math.min(1,(y-a[0])/span));
  const da=span*(b[k]-p[k])/(b[0]-p[0]),db=span*(q[k]-a[k])/(q[0]-a[0]);
  return (1-v)*a[k]+v*b[k]+v*(1-v)*((1-v)*(da-b[k]+a[k])+v*(b[k]-a[k]-db));
}
const bell=(x:number,w:number)=>Math.exp(-(x*x)/(w*w));
const spot=(x:number,y:number,wx:number,wy:number)=>bell(x,wx)*bell(y,wy);
const clamp=(v:number)=>Math.max(0,Math.min(1,v));

// Lowered lids, the alar turn and the two lip rolls are part of the skin
// surface. Only narrow incisions receive patina, independent of the lights.
function landmarks(x:number,y:number){
  const ax=Math.abs(x);
  const u=clamp((ax-.053)/.296),arch=Math.sin(Math.PI*u);
  const eyeWidth=arch**.68,lidY=3.89+.051*u-.024*arch;
  const browY=3.948+.035*u+.090*Math.sin(Math.PI*u)**.82;
  const almond=.014+.059*arch,eye=y-lidY,brow=y-browY;
  let z=.061*spot(ax-.245,y-3.76,.15,.15)-.036*spot(ax-.20,y-3.942,.145,.084);
  z+=eyeWidth*(.051*bell(eye-.52*almond,almond*.85)
    +.023*bell(eye+.024,.031)-.022*bell(eye,.012+.005*arch)
    +.022*bell(brow+.007,.043)-.009*bell(brow-.026,.029));
  let patina=eyeWidth*(.92*bell(eye,.012+.004*arch)+1.05*bell(brow,.014+.009*arch));
  // Broad flat dorsal plane tapers into the medial brow. The cut beneath the
  // nose runs out under the alae instead of outlining two spherical nostrils.
  const bridgeWidth=.046+.019*bell(y-3.76,.13);
  z+=.116*Math.exp(-((ax/bridgeWidth)**2.3))*bell(y-3.856,.184)
    +.082*spot(x,y-3.728,.080,.054)+.043*spot(ax-.070,y-3.724,.038,.042)
    +.035*spot(x,y-3.693,.029,.033)-.033*spot(ax-.051,y-3.699,.025,.012)
    -.024*spot(ax-.103,y-3.715,.020,.041);
  patina+=.79*spot(ax-.051,y-3.699,.025,.011)+.20*spot(x,y-3.692,.085,.020);
  const lip=clamp(1-(ax/.151)**2)**1.35,mouthY=3.581+.020*(ax/.151)**2+.007*bell(ax-.047,.034);
  const dy=y-mouthY;
  z+=lip*(.047*bell(dy-.020,.021)+.052*bell(dy+.024,.028)-.018*bell(dy,.009))
    -.020*spot(ax-.149,y-3.577,.017,.020)-.012*spot(x,y-3.627,.022,.035)
    +.018*spot(ax-.033,y-3.625,.023,.038);
  patina+=lip*(.84*bell(dy,.007)+.28*bell(dy+.050,.012));
  z+=.033*spot(x,y-3.443,.174,.074)-.009*spot(x,y-3.496,.115,.023);
  return [z,clamp(patina)];
}
export function lotusFacePoint(u:number,v:number){
  const t=u*Math.PI*2,a=t-.57*Math.sin(t),y=3.29+1.13*v,cs=Math.cos(a);
  const x=section(y,1)*Math.sin(a),front=Math.max(0,cs);
  const [relief,patina]=front>0?landmarks(x,y):[0,0];
  const z=-.17+(cs<0?section(y,3)*cs:section(y,2)*front**.77)+relief*front**1.65;
  return {x,y,z,patina:patina*front};
}
