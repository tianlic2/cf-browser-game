import * as THREE from 'three';
import { box } from './geom';

type Tier = {
  halfWidth: number; halfDepth: number; innerWidth: number; innerDepth: number;
  eave: number; rise: number; lift: number; upper: boolean;
};
type Point = (t: number, v: number) => THREE.Vector3;
const lerp = THREE.MathUtils.lerp;
const gableFoot = .49;
const tilePitch = .315;

// t runs along the eave, v uphill. Both adjoining slopes share the corner
// locus. On the upper tier the hip stops at the foot of the timber gable.
function surface(tier: Tier, front: boolean, side: number): Point {
  return (t, v) => {
    const vHip = tier.upper ? Math.min(v / gableFoot, 1) : v;
    const halfWidth = lerp(tier.halfWidth, tier.innerWidth, vHip);
    const halfDepth = lerp(tier.halfDepth, tier.innerDepth, v);
    const corner = Math.abs(t) ** 7 * (1-vHip) ** 2;
    const lift = tier.lift * corner;
    return new THREE.Vector3(
      front ? t*(halfWidth+.49*corner) : side*(halfWidth+.49*corner),
      tier.eave + tier.rise*v**1.47 + lift,
      front ? side*(halfDepth+.49*corner) : t*(halfDepth+.49*corner));
  };
}

// A metre-scaled relief on the shell itself: each row has a convex cover
// tile, sloping shoulders and a pan. The terminal disk meets its own crest.
function tileField(point: Point, rows: number, depth: number, end: number, flip: boolean) {
  const pos: number[]=[], uv: number[]=[], indices: number[]=[];
  const across=rows*4, uphill=Math.ceil(depth*end/.78);
  for(let j=0;j<=uphill;j++) {
    const v=end*j/uphill;
    for(let i=0;i<=across;i++){
      const p=point(i/across*2-1,v);
      const cap=[0,.018,.085,.018][i%4];
      p.y+=cap;
      pos.push(p.x,p.y,p.z);
      // The existing photograph contains nine barrel rows, and repeats once
      // every five UV units. Keep the tile bands centred on the geometry.
      uv.push((i/4+.04)/9*5,v*depth*1.7);
      if(j===uphill || i===across)continue;
      const a=j*(across+1)+i,b=a+1,c=a+across+1,d=c+1;
      if(flip) indices.push(a,c,b,b,c,d); else indices.push(a,b,c,b,d,c);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}

function moulding(points: THREE.Vector3[],radius: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),points.length*2,radius,8,false);
}

function plank(a: THREE.Vector3,b: THREE.Vector3,width: number,height: number) {
  const along=b.clone().sub(a);
  const g=box(width,height,along.length(),0,0,0);
  const rotation=new THREE.Matrix4().lookAt(b,a,new THREE.Vector3(0,1,0));
  return g.applyMatrix4(rotation).translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
}

function ribbon(sample: (t:number)=>THREE.Vector3, inset: (t:number)=>THREE.Vector3, steps:number) {
  const pos:number[]=[],uv:number[]=[];
  for(let i=0;i<steps;i++){
    const lo=i/steps,hi=(i+1)/steps;
    const a=sample(lo),b=sample(hi),c=inset(hi),d=inset(lo);
    for(const p of [a,b,c,a,c,d]){pos.push(p.x,p.y,p.z);uv.push(p.x+p.z,p.y);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
  return g;
}

function reverseFaces(g: THREE.BufferGeometry) {
  const count=g.getAttribute('position').count;
  g.setIndex(Array.from({length:count},(_,i)=>i-i%3+[0,2,1][i%3]));
  g.computeVertexNormals();
}

function ridgeEnd(){
  // A low jaw on the ridge saddle and a tall swept tail with a hooked lip.
  const s=new THREE.Shape();
  s.moveTo(-.51,0);s.lineTo(-.54,.19);s.quadraticCurveTo(-.69,.28,-.58,.40);
  s.quadraticCurveTo(-.46,.49,-.26,.42);s.quadraticCurveTo(-.30,.74,-.51,.91);
  s.quadraticCurveTo(-.08,.93,.06,.61);s.quadraticCurveTo(.40,.93,.21,1.36);
  s.quadraticCurveTo(.66,1.22,.73,.92);s.quadraticCurveTo(.84,.60,.58,.28);
  s.lineTo(.40,0);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.30,bevelEnabled:true,bevelSegments:2,
    bevelSize:.044,bevelThickness:.035,curveSegments:7});
  return g.translate(0,0,-.15);
}

export function mainHallRoof(w: number,d: number,eave: number,rise: number) {
  const tiles: THREE.BufferGeometry[]=[], timber: THREE.BufferGeometry[]=[], trim: THREE.BufferGeometry[]=[];
  const rafters: THREE.BufferGeometry[]=[];
  const lower:Tier={halfWidth:w/2+2.8,halfDepth:d/2+2.8,innerWidth:w/2-.6,innerDepth:d/2-.6,
    eave:eave+.1,rise:1.50,lift:1.65,upper:false};
  const upper:Tier={halfWidth:w/2-.08,halfDepth:d/2-.08,innerWidth:w*.356,innerDepth:0,
    eave:eave+3.24,rise:rise+2.8,lift:1.83,upper:true};
  for(const tier of [lower,upper]){
    for(const front of [true,false])for(const side of [-1,1]){
      const point=surface(tier,front,side),span=2*(front?tier.halfWidth:tier.halfDepth);
      const count=Math.round(span/tilePitch);
      const end=tier.upper&&!front?gableFoot:1;
      const run=tier.upper?tier.halfDepth:lower.halfDepth-lower.innerDepth;
      tiles.push(tileField(point,count,Math.hypot(run,tier.rise),end,front?side<0:side>0));
      const samples=Array.from({length:31},(_,i)=>point(i/15-1,0));
      trim.push(moulding(samples,.077));
      // Close the underside to the wall line. Use a dark timber lining and
      // square flying rafters which radiate along the curve at the corners.
      const innerV=tier.upper?.30:.94;
      const below=(t:number,v:number,h:number)=>point(t*2-1,v).add(new THREE.Vector3(0,-h,0));
      for(let k=0;k<5;k++){
        const lo=innerV*k/5,hi=innerV*(k+1)/5;
        const lining=ribbon(t=>below(t,lo,.115),t=>below(t,hi,.115),56);
        if(lining.getAttribute('normal').getY(0)>0)reverseFaces(lining);
        timber.push(lining);
      }
      for(let i=0;i<count;i++){
        const t=(i+.5)/count, p=point(2*t-1,0);
        const disk=new THREE.CylinderGeometry(.090,.093,.10,10);
        if(front)disk.rotateX(side*Math.PI/2);else disk.rotateZ(-side*Math.PI/2);
        trim.push(disk.translate(p.x,p.y+.004,p.z));
        if(i%2===0){
          for(let k=0;k<3;k++){
            const a=below(t,lerp(.016,innerV,k/3),.19),b=below(t,lerp(.016,innerV,(k+1)/3),.19);
            rafters.push(plank(a,b,.13,.16));
          }
        }
      }
      if(front)for(const sx of [-1,1]){
        const length=tier.upper?gableFoot:1;
        const hip=Array.from({length:15},(_,i)=>point(sx,length*i/14).add(new THREE.Vector3(0,.12,0)));
        trim.push(moulding(hip,tier.upper?.16:.14));
        // The wing tip swells out of the sloping ridge, then tapers in both
        // width and depth. Its lower edge is seated on the last cover tile.
        const toe=hip[0],out=new THREE.Vector3(sx,0,side).normalize();
        const lip=new THREE.Shape();
        lip.moveTo(-.47,-.09);lip.quadraticCurveTo(.02,-.07,.40,.14);
        lip.quadraticCurveTo(.58,.35,.60,.54);lip.quadraticCurveTo(.27,.25,-.12,.14);
        lip.lineTo(-.47,.085);lip.closePath();
        const crest=new THREE.ExtrudeGeometry(lip,{depth:.19,bevelEnabled:true,bevelSize:.025,
          bevelThickness:.024,bevelSegments:1,curveSegments:8});
        crest.translate(0,0,-.095);
        const pos=crest.getAttribute('position');
        for(let i=0;i<pos.count;i++)pos.setZ(i,pos.getZ(i)*lerp(1,.26,
          THREE.MathUtils.smoothstep(pos.getX(i),-.12,.60)));
        crest.computeVertexNormals();crest.rotateY(-Math.atan2(out.z,out.x));
        trim.push(crest.translate(toe.x,toe.y,toe.z));
        for(const v of [.06,.13,.22]){
          const p=point(sx,length*v);
          const bead=new THREE.LatheGeometry([[.084,0],[.108,.05],[.075,.10],[.083,.15],[.035,.22],[0,.26]]
            .map(([r,y])=>new THREE.Vector2(r,y)),8);
          trim.push(bead.translate(p.x,p.y+.19,p.z));
        }
      }
    }
  }
  for(const sx of [-1,1]){
    const gable=ribbon(t=>{
      const v=gableFoot+(1-gableFoot)*(1-Math.abs(2*t-1));
      return surface(upper,true,t<.5?-1:1)(sx,v);
    },t=>new THREE.Vector3(sx*upper.innerWidth,upper.eave+upper.rise*gableFoot**1.47,
      (2*t-1)*upper.halfDepth*(1-gableFoot)),32);
    // Front winding for the outward gable cheek.
    if(gable.getAttribute('normal').getX(0)*sx<0)reverseFaces(gable);
    timber.push(gable);
    for(const side of [-1,1]){
      const line=Array.from({length:17},(_,i)=>surface(upper,true,side)(sx,gableFoot+(1-gableFoot)*i/16)
        .add(new THREE.Vector3(.055*sx,.08,0)));
      trim.push(moulding(line,.148));
    }
  }
  const ridgeY=upper.eave+upper.rise, half=upper.innerWidth;
  trim.push(box(2*half+.36,.36,.54,0,ridgeY+.19,0));
  trim.push(moulding([-half,0,half].map(x=>new THREE.Vector3(x,ridgeY+.47,0)),.20));
  for(let i=-Math.floor(half/.84);i<=Math.floor(half/.84);i++){
    const band=new THREE.CylinderGeometry(.216,.216,.056,12).rotateZ(Math.PI/2);
    trim.push(band.translate(i*.84,ridgeY+.47,0));
  }
  for(const sx of [-1,1]){
    const end=ridgeEnd();if(sx<0)end.rotateY(Math.PI);
    trim.push(end.translate(sx*half,ridgeY+.37,0));
  }
  // Ridge masonry and cut tile ends sample a small patch of fired clay.
  // Whole-roof tile bands belong only on the slopes.
  for(const g of trim){
    const uv=g.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,.195+.04*uv.getX(i),.31+.05*uv.getY(i));
  }
  return {tiles:tiles.concat(trim),timber,rafters};
}
