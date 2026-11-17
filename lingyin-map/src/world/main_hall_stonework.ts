import * as THREE from 'three';
import { box, merge, projectedTempleUV } from './geom';
import { MAIN_HALL_FLOOR_Y, MAIN_HALL_RAIL as R, MAIN_HALL_STAIRS as S,
  hallRailX, mainHallStair } from '../../../scripts/lingyin_main_hall.js';

type Point = {x:number;z:number;y:number};

// Carve the face itself. The paired scrolls flank a three-petal lotus; their
// sloping shoulders catch the same side light as the surrounding cut stone.
function lotusPanel(length:number) {
  const width=length-.20, height=.36, nx=Math.ceil(width/.030), ny=16;
  const heights=new Float32Array((nx+1)*(ny+1));
  const curve=new THREE.CurvePath<THREE.Vector2>();
  function stroke(ax:number,ay:number,bx:number,by:number,cx:number,cy:number,dx:number,dy:number) {
    curve.add(new THREE.CubicBezierCurve(new THREE.Vector2(ax,ay),new THREE.Vector2(bx,by),
      new THREE.Vector2(cx,cy),new THREE.Vector2(dx,dy)));
  }
  stroke(0,-.11,-.11,-.05,-.068,.055,0,.135);
  stroke(0,.135,.067,.055,.105,-.065,0,-.11);
  for(const side of [-1,1]){
    stroke(0,-.096,side*.12,-.13,side*.19,-.015,side*.20,.063);
    stroke(side*.20,.063,side*.10,.054,side*.065,.011,side*.051,-.014);
    stroke(side*.14,-.077,side*.36,-.20,side*.33,.125,side*.53,.089);
    stroke(side*.53,.089,side*.68,.057,side*.58,-.088,side*.47,-.026);
  }
  for(const line of curve.curves){
    const samples=line.getPoints(18);
    for(let s=1;s<samples.length;s++){
      const a=samples[s-1],b=samples[s];
      const ax=a.x*width*.69, bx=b.x*width*.69, dx=bx-ax,dy=b.y-a.y;
      const x0=Math.max(0,Math.floor(((Math.min(ax,bx)-.032)/width+.5)*nx));
      const x1=Math.min(nx,Math.ceil(((Math.max(ax,bx)+.032)/width+.5)*nx));
      const y0=Math.max(0,Math.floor(((Math.min(a.y,b.y)-.032)/height+.5)*ny));
      const y1=Math.min(ny,Math.ceil(((Math.max(a.y,b.y)+.032)/height+.5)*ny));
      for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
        const x=(i/nx-.5)*width,y=(j/ny-.5)*height;
        const t=THREE.MathUtils.clamp(((x-ax)*dx+(y-a.y)*dy)/(dx*dx+dy*dy),0,1);
        const d=Math.hypot(x-ax-dx*t,y-a.y-dy*t);
        const k=j*(nx+1)+i;
        heights[k]=Math.max(heights[k],.030*Math.max(0,1-(d/.032)**2));
      }
    }
  }
  const face=new THREE.PlaneGeometry(width,height,nx,ny);
  const pos=face.getAttribute('position'), tones=new Float32Array(pos.count*3);
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const k=j*(nx+1)+i,h=heights[(ny-j)*(nx+1)+i];
    const margin=Math.min(i/nx*width,(1-i/nx)*width,j/ny*height,(1-j/ny)*height);
    pos.setZ(k,h+.011*(1-THREE.MathUtils.smoothstep(margin,.009,.024)));
    tones.fill(.80+.16*h/.03,k*3,k*3+3);
  }
  face.setAttribute('color',new THREE.BufferAttribute(tones,3));
  face.computeVertexNormals();
  return face;
}

export function mainHallCutTread(i:number) {
  const {z,top}=mainHallStair(i);
  const depth=(S.treadDepth+.02)/2;
  // Keep the tread surface and footprint on the physical stair. Only the
  // exposed arris loses material, most noticeably along the processional route.
  const vertices:number[]=[];
  const quad=(a:number[],b:number[],c:number[],d:number[])=>vertices.push(...a,...b,...d,...b,...c,...d);
  const section=(x:number)=>{
    const path=Math.exp(-(((x+.23*Math.sin(i*1.37))/2.3)**2));
    const radius=.008+path*(.032+.009*Math.sin(1.9*x+i*2.1)+.004*Math.sin(6.2*x-i));
    const ring=[[x,0,z-depth],[x,0,z+depth]];
    for(let j=0;j<=4;j++){
      const a=Math.PI*j/8;
      ring.push([x,top-radius+radius*Math.sin(a),z+depth-radius+radius*Math.cos(a)]);
    }
    ring.push([x,top,z-depth]);
    return ring;
  };
  let left=section(-S.width/2);
  for(let j=1;j<=28;j++){
    const right=section(S.width*(j/28-.5));
    for(let k=0;k<left.length;k++){
      const next=(k+1)%left.length;
      quad(left[k],right[k],right[next],left[next]);
    }
    if(j===1 || j===28){
      const edge=j===1?left:right;
      for(let k=1;k<edge.length-1;k++)
        vertices.push(...edge[0],...edge[j===1?k:k+1],...edge[j===1?k+1:k]);
    }
    left=right;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.computeVertexNormals();
  return geo;
}

export function mainHallStoneRails() {
  const parts:THREE.BufferGeometry[]=[];
  const reliefCache=new Map<number,THREE.BufferGeometry>();
  function add(g:THREE.BufferGeometry,tone:number) {
    if(!g.getAttribute('color')){
      g.setAttribute('color',new THREE.Float32BufferAttribute(
        new Float32Array(g.getAttribute('position').count*3).fill(tone),3));
    }
    parts.push(g);
  }
  function newel(p:Point) {
    const w=R.halfPost*2;
    add(box(w,.18,w,p.x,p.y+.09,p.z),.85);
    add(box(w-.07,.65,w-.07,p.x,p.y+.48,p.z),.97);
    add(box(w-.026,.072,w-.026,p.x,p.y+.81,p.z),.90);
    add(box(w,.05,w,p.x,p.y+R.postShoulder-.025,p.z),.98);
    const profile=[[.082,0],[.11,.03],[.113,.07],[.097,.116],[.060,.164],[.018,.194],[0,.20]];
    const bud=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),48);
    const vertices=bud.getAttribute('position');
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
      const angle=Math.atan2(x,z);
      const petal=Math.cos(8*angle+.32*Math.sin(y*19));
      const scale=1.-.135*((petal+1)/2)**4*Math.sin(Math.PI*y/.20);
      vertices.setXYZ(i,x*scale,y,z*scale);
    }
    bud.computeVertexNormals();
    bud.translate(p.x,p.y+R.postShoulder,p.z);add(bud,1.0);
  }
  // Longitudinal coordinates are horizontal metres. Shearing just the Y
  // coordinate keeps posts and panel ends plumb even on inclined flights.
  function bay(a:Point,b:Point) {
    const dx=b.x-a.x,dz=b.z-a.z,run=Math.hypot(dx,dz),midY=(a.y+b.y)/2;
    const length=run-.335, slope=(b.y-a.y)/run, angle=-Math.atan2(dz,dx);
    function place(g:THREE.BufferGeometry,tone:number){
      const pos=g.getAttribute('position');
      for(let i=0;i<pos.count;i++)pos.setY(i,pos.getY(i)+pos.getX(i)*slope);
      g.computeVertexNormals();g.rotateY(angle);
      g.translate((a.x+b.x)/2,midY,(a.z+b.z)/2);add(g,tone);
    }
    place(box(length,.19,.255,0,.115,0),.87);
    place(box(length,.405,.15,0,.402,0),.87);
    place(box(length,.055,.214,0,.61,0),.91);
    place(box(length,.052,R.capWidth,0,R.capTop-.063,0),.97);
    place(box(length,.048,R.capWidth-.042,0,R.capTop-.024,0),1.);
    const key=Math.round(length*1e4);
    if(!reliefCache.has(key))reliefCache.set(key,lotusPanel(length));
    for(const sign of [-1,1]){
      const face=reliefCache.get(key)!.clone();
      if(sign<0)face.rotateY(Math.PI);
      face.translate(0,.405,sign*.077);
      place(face,1.);
    }
  }
  for(const sign of [-1,1]){
    const x=sign*hallRailX;
    // A stepped sill under the panel seats follows all twelve visible treads.
    for(let i=0;i<S.count;i++){
      const step=mainHallStair(i);
      add(box(.29,step.top+.09,S.treadDepth+.003,x,(step.top+.09)/2,step.z),.84);
    }
    const posts:Point[]=R.postSteps.map(i=>({x,z:mainHallStair(i).z,y:mainHallStair(i).top}));
    posts.forEach(newel);
    for(let j=1;j<posts.length;j++)bay(posts[j-1],posts[j]);
    const start=Math.abs(x);
    const landing:Point[]=Array.from({length:R.landingBays+1},(_,i)=>({
      x:sign*(start+(R.endX-start)*i/R.landingBays),y:MAIN_HALL_FLOOR_Y,z:R.landingZ}));
    // Join the upper terminal and the horizontal return with a short saddle.
    const last=posts[posts.length-1],first=landing[0];
    add(box(.285,.52,Math.abs(last.z-first.z),x,first.y+.27,(last.z+first.z)/2),.92);
    landing.forEach(newel);
    for(let j=1;j<landing.length;j++)bay(landing[j-1],landing[j]);
  }
  const geometry=projectedTempleUV(merge(parts),.9);
  const material=new THREE.MeshStandardMaterial({name:'main-hall-carved-balustrade',color:0xc3c6c3,
    roughness:.86,metalness:0,vertexColors:true});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='main-hall-stair-carving';mesh.castShadow=true;mesh.receiveShadow=true;
  return mesh;
}
