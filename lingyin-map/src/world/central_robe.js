// Parametric carving patterns shared by the game mesh and the offline normal bake.
// u wraps once around each section; v follows the grain from its root to its end.
export const CENTRAL_CHARTS=['mantle','leftSleeve','rightSleeve','leftLeg','rightLeg'];
const clamp=x=>Math.max(0,Math.min(1,x));
function smooth(a,b,x){const t=clamp((x-a)/(b-a));return t*t*(3-2*t);}
function bell(x,centre,width){return Math.exp(-((x-centre)**2)/(width*width));}
const tau=2*Math.PI;
function spline(rows,t){
  const k=clamp(t)*(rows.length-1),i=Math.min(rows.length-2,Math.floor(k)),v=k-i;
  const a=rows[Math.max(0,i-1)],b=rows[i],c=rows[i+1],d=rows[Math.min(rows.length-1,i+2)];
  return b.map((n,j)=>.5*(2*n+(-a[j]+c[j])*v+(2*a[j]-5*n+4*c[j]-d[j])*v*v+(-a[j]+3*n-3*c[j]+d[j])*v*v*v));
}
const trunk=[[.72,.48],[.82,.54],[.84,.53],[.78,.50],[.84,.48],[.92,.45],[.91,.40],[.71,.34],[.30,.27]];
const arm=[[.35,3.10,-.18,.085,.12],[.70,2.97,-.14,.24,.24],[.93,2.61,-.12,.24,.32],
 [1,2.22,-.06,.22,.30],[1.05,1.85,.11,.25,.32],[.94,1.66,.36,.23,.28],[.72,1.55,.53,.18,.21],[.47,1.48,.64,.146,.175]];
const leg=[[.22,.68,-.36,.25,.28],[.77,.75,-.32,.40,.47],[1.32,.77,-.18,.42,.45],
 [1.56,.77,.10,.39,.39],[1.38,.81,.45,.34,.37],[.96,.88,.62,.29,.32],[.43,.99,.69,.225,.28],[-.29,1.11,.71,.125,.16]];
// Long tensile folds follow the grain from the shoulder. At the elbow the
// shorter, transverse compression folds turn into the inside of the bend.
// Vary the spacing of the channels across the shoulder cap. Their paths converge
// towards the elbow, where the supported forearm interrupts the hanging folds.
const crests=[[-2.90,.22,.041],[-2.33,.23,.054],[-1.69,.23,.058],[-1.04,.24,.067],
 [-.48,.19,.053],[.02,.20,.062],[.61,.21,.058],[1.21,.24,.071],
 [1.94,.26,.057],[2.62,.22,.046]];
function hangingSleeve(angle,v,side,lotusBearer){
 const bend=smooth(.16,.72,v),front=Math.cos(angle);
 const pull=side*(.13+.77*bend)+(lotusBearer?.13:-.10)*Math.sin(Math.PI*v);
 let relief=0;
 for(const [root,width,height] of crests){
   const course=root+.64*pull-.33*bend*Math.sin(root)+.16*Math.sin(Math.PI*v+root);
   const offset=Math.atan2(Math.sin(angle-course),Math.cos(angle-course));
   const taper=smooth(.008,.13+.025*Math.cos(root),v)*(1-smooth(.52+.09*Math.sin(root),.76,v));
   relief+=taper*(height*bell(offset,0,width)-.037*bell(offset,width*1.21,width*.79));
 }
 const gather=v+.062*front+.040*side*Math.sin(angle);
 const elbow=(.047*bell(gather,.595,.059)-.021*bell(gather,.66,.039)
   +.041*bell(gather,.744,.052))*(.77+.23*Math.cos(angle-side*.63));
 return relief+elbow+.035*bell(gather,.856,.042)+.029*bell(v,.948,.033);
}
export function centralSurface(part,u,v,fine=false,lotusBearer=false){
 const a=tau*u,cs=Math.cos(a),sn=Math.sin(a);
 if(part===0){
   const y=1.03+2.26*v,[rx,rz]=spline(trunk,v),x=rx*sn;
   const collar=(Math.abs(x+.018*Math.sin(2.4*y))**2.6+(Math.max(0,3.08-y)*.49)**2.6)**(1/2.6);
   const chest=bell(x,0,.42)*bell(y,2.74,.52);
   let z=rz*cs-.19;
   const lips=[.49,.575,.665,.785,.9];
   for(let i=0;i<lips.length;i++){
     const distance=collar-lips[i]-.014*Math.sin(4.6*y+i*.95+x*3);
     z+=Math.max(0,cs)*(.042*bell(distance,0,.029)-.027*bell(distance,.042,.024));
   }
   z+=Math.max(0,cs)*(.065*chest-.031*bell(x,0,.07)*bell(y,2.75,.31)-.037*bell(y,2.4,.05)*bell(x,0,.38));
   if(fine)z+=.0038*Math.cos(236*collar+1.6*Math.sin(y*6))*smooth(.45,.59,collar)*Math.max(0,cs);
   return [x,y,z];
 }
 const sleeve=part===1||part===2,side=part===1||part===3?-1:1;
 const rows=sleeve?arm:leg;
 const p=spline(rows,v),p0=spline(rows,v-.001),p1=spline(rows,v+.001);
 let tx=side*(p1[0]-p0[0]),ty=p1[1]-p0[1],tz=p1[2]-p0[2];
 const l=Math.hypot(tx,ty,tz);tx/=l;ty/=l;tz/=l;
 // Use a consistent up axis around the bent shins, and forward around sleeves.
 const dot=sleeve?tz:ty;
 let nx=-dot*tx,ny=(sleeve?0:1)-dot*ty,nz=(sleeve?1:0)-dot*tz;
 const nl=Math.hypot(nx,ny,nz);nx/=nl;ny/=nl;nz/=nl;
 const bx=ty*nz-tz*ny,by=tz*nx-tx*nz,bz=tx*ny-ty*nx;
 let fold=0;
 if(sleeve){
   fold=hangingSleeve(a,v,side,lotusBearer);
   if(fine)fold+=.0018*Math.sin(19*a+4.8*v)*smooth(.04,.21,v)*(1-smooth(.63,.84,v));
 }else{
   // Broad sweeps follow the shin towards the crossed ankle.
   const path=v+.083*Math.sin(a+side*.48)+.028*cs;
   fold=.037*bell(path,.44,.081)-.016*bell(path,.528,.055)
     +.046*bell(path,.63,.072)+.029*bell(path,.82,.054);
   if(fine)fold+=.0018*Math.cos(82*path)*smooth(.22,.51,v);
 }
 // Sink the hidden root and roll both cuffs into the underlying wrist.
 const cap=sleeve?((.34+.66*smooth(0,.18,v))*(1-.26*smooth(.973,1,v))):(.42+.58*smooth(0,.12,v));
 const r1=(p[3]+fold)*cap,r2=(p[4]+fold)*cap;
 const crossed=sleeve?0:side*.10*smooth(.47,.94,v);
 // Turn the supporting cuff back toward the forearm, exposing the heel of
 // the palm. The last rings roll into the wrist and hide the open tube end.
 const turnback=lotusBearer&&part===2?smooth(.72,1,v):0;
 return [side*p[0]+.115*turnback+nx*r1*cs+bx*r2*sn,p[1]+crossed+.062*turnback+ny*r1*cs+by*r2*sn,p[2]-.035*turnback+nz*r1*cs+bz*r2*sn];
}
