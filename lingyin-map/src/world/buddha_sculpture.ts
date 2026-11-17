import * as THREE from 'three';
import { merge, projectedTempleUV } from './geom';
import { bakeSculptureVisibility } from './sculpture_occlusion';
import { configureProjectedLOD } from './distant_geometry';

import { lotusFacePoint } from './lotus_buddha_face';
import { centralSurface } from './central_robe';

type CurvePoint=[number,number,number];
type Palette='gold'|'lap'|'crease'|'hair';
const smooth=THREE.MathUtils.smoothstep;
const gaussian=(x:number,y:number,cx:number,cy:number,sx:number,sy:number)=>
  Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));

// New full-volume Chinese temple sculpture. All curves are authored in
// metres, including the hands, ears, cloth returns and back of the shoulders.
function sculptFigure(variant:number,quality:number,grain:THREE.Texture,detail:THREE.Texture,robe:THREE.Texture) {
  const lotusBearer=variant===1;
  const pools:Record<Palette,THREE.BufferGeometry[]>={gold:[],lap:[],crease:[],hair:[]};
  const seg=Math.max(12,Math.round(48*quality));
  function add(g:THREE.BufferGeometry,role:Palette='gold'){
    if(role==='gold'||role==='lap'){
      const chart=g.userData.chart??5;
      const sleeve=lotusBearer&&(chart===1||chart===2);
      // The broad carved folds have their own relief. The old sleeve atlas
      // models much finer pleats, so use its neutral cell on these surfaces.
      const cell=(chart===3||chart===4||sleeve)?5:chart;
      const uv=g.getAttribute('uv'),carving=new Float32Array(uv.count*2);
      for(let i=0;i<uv.count;i++){
        carving[i*2]=(cell%3+(5+374*uv.getX(i))/384)/3;
        carving[i*2+1]=(Math.floor(cell/3)+(5+374*uv.getY(i))/384)/2;
      }
      if(role==='lap'){
        // Keep continuous cloth coordinates across the planar UV projection seams.
        // Negative U distinguishes the underlying shins from the overlapping panel.
        const panelUV=new Float32Array(uv.count*2);
        for(let i=0;i<uv.count;i++){
          panelUV[2*i]=g.userData.finish?uv.getX(i):-1;
          panelUV[2*i+1]=uv.getY(i);
        }
        g.setAttribute('apronUv',new THREE.BufferAttribute(panelUV,2));
      }
      if(lotusBearer){
        const finish=new Float32Array(uv.count);
        for(let i=0;i<uv.count;i++){
          if(sleeve)finish[i]=.58+.38*smooth(uv.getY(i),.66,.93);
          else finish[i]=g.userData.finish??0;
        }
        g.setAttribute('robeFinish',new THREE.BufferAttribute(finish,1));
      }
      g.setAttribute('uv1',new THREE.BufferAttribute(carving,2));
    }
    pools[role].push(g);
  }
  function ellipsoid(x:number,y:number,z:number,rx:number,ry:number,rz:number,role:Palette='gold'){
    add(new THREE.SphereGeometry(1,role==='hair'?(quality>.5&&variant!==1?8:6):Math.max(8,seg/2),role==='hair'?(quality>.5&&variant!==1?6:4):Math.max(5,seg/3)).scale(rx,ry,rz).translate(x,y,z),role);
  }
  function strand(points:CurvePoint[],radius:number,role:Palette='gold',radial=7){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(curve,Math.max(3,Math.round(points.length*4*quality)),radius,quality<.3?4:radial,false),role);
  }
  function surface(nu:number,nv:number,at:(u:number,v:number)=>THREE.Vector3,role:Palette='gold',chart=5,finish=0){
    const positions:number[]=[],uv:number[]=[],indices:number[]=[];
    nu=Math.max(3,Math.round(nu*quality));nv=Math.max(3,Math.round(nv*quality));
    for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
      const p=at(i/nu,j/nv);positions.push(p.x,p.y,p.z);uv.push(i/nu,j/nv);
      if(i<nu&&j<nv){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(a,b,c,b,d,c);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.chart=chart;g.userData.finish=finish;add(g,role);
    return g;
  }
  // Turned lotus seat with real petals curling over its outer rim.
  const lotus=new THREE.LatheGeometry([[0,0],[1.65,0],[1.80,.08],[1.89,.19],[1.84,.30],[1.66,.40],[0,.40]]
    .map(([r,y])=>new THREE.Vector2(r,y)),seg*2);
  lotus.scale(1,1,.64);add(lotus);
  const petalCount=Math.max(12,Math.round(26*quality));
  for(const tier of [0,1])for(let i=0;i<petalCount;i++){
    const angle=(i+tier*.5)*Math.PI*2/petalCount;
    surface(10,12,(u,v)=>{
      const a=(u-.5)*.24;
      const width=Math.sin(Math.PI*v)*a;
      const r=1.74+.17*Math.sin(Math.PI*v);
      const y=tier?.19+.20*v:.20-.16*v;
      return new THREE.Vector3(Math.sin(angle+width)*r,y+.035*Math.sin(Math.PI*v)*(1-(2*u-1)**2),
        Math.cos(angle+width)*r*.64);
    });
  }
  // All three share the same robe construction. The outer sleeves turn
  // towards the resting knee on the lateral figures.
  const restingSide=variant===1?-1:variant===2?1:0;
  {
    const sections=[[134,118],[60,74],[60,74],[68,82],[68,82]];
    sections.forEach(([around,along],chart)=>{
      surface(around,along,(u,v)=>{
        const p=new THREE.Vector3().fromArray(centralSurface(chart,u,v,false,lotusBearer));
        if((chart===1&&restingSide===-1)||(chart===2&&restingSide===1)){
          const reach=smooth(v,.58,1);
          p.x+=restingSide*.60*reach;p.y-=.13*reach;
        }
        if(lotusBearer){
          if(chart<=2){
            // Lower both acromia into one continuous slope from neck to upper arm.
            const shoulder=gaussian(Math.abs(p.x),p.y,.73,2.98,.46,.37);
            p.y-=.16*shoulder;
            if(chart>0){
              const inner=.14*Math.exp(-((v-.18)**2)/.032);
              p.x*=1-inner;
            }
          }
          if(chart===1){
            const settle=smooth(v,.54,.93);
            p.y-=.072*settle;p.z+=.095*settle;
          }
        }
        return p;
      }, 'gold',chart);
    });
  }
  // Rounded transverse sections describe both knees and the lower shin between
  // them. The top descends in the lap, while the leading knee turns forward.
  const leading=restingSide||1;
  // An overlapping fold has a long light-facing slope and a shorter return underneath.
  // The varying breadth keeps the three crests distinct as they turn around a kneecap.
  function turnedFold(distance:number,breadth:number,relief:number){
    const t=distance/breadth;
    const crown=Math.exp(-t*t*(t>0?.86:3.2));
    const hollow=Math.exp(-((t+1.02)**2)/.26);
    return relief*(crown-.29*hollow);
  }
  surface(128,74,(u,v)=>{
    const angle=2*Math.PI*u,across=-Math.cos(Math.PI*v);
    const section=Math.sin(Math.PI*v)**.46;
    const outer=Math.abs(across);
    const knee=Math.exp(-((outer-.76)**2)/.085);
    const advance=leading*across;
    const centreY=.72+.13*knee+.053*advance;
    const sin=-Math.sin(angle),cos=Math.cos(angle);
    const upper=.43+.13*knee,lower=centreY-.31;
    const y=centreY+(sin>0?upper:lower)*section*sin;
    const depth=1.04+.18*knee+.080*advance;
    const lift=.21*outer**1.65+.058*advance;
    const spread=.87+.16*knee+.08*advance;
    const line=(y-lift-.53)/spread+.53;
    const pressed=gaussian(across,y,restingSide*.57,1.08,.22,.17);
    const folds=turnedFold(line-.434,.093,.111)
      +turnedFold(line-.650-.025*across,.109,.160)
      +turnedFold(line-.896+.029*across,.092,.126)*(1-.60*pressed);
    const x=1.96*across,front=Math.max(0,cos);
    return new THREE.Vector3(x,y,-.01+.14*knee+section*cos*(depth+folds*front));
  },'lap');
  if(lotusBearer){
    // One folded breadth is pinned below the resting palm. Its free edge
    // drops across the lap and rolls back underneath so it reads in profile.
    surface(86,44,(u,v)=>{
      const x=-1.32+2.07*u+.10*(1-v)*Math.sin(2*Math.PI*u);
      const sag=Math.sin(Math.PI*u);
      const bottom=.88-.47*sag+.15*u;
      const top=1.26-.18*sag+.20*u-.065*gaussian(x,0,-1.05,0,.22,1);
      const y=THREE.MathUtils.lerp(bottom,top,v)+.029*Math.sin(Math.PI*v)*Math.cos(3*Math.PI*u);
      const pressure=gaussian(x,y,-1.06,1.18,.25,.17);
      const sweep=v+.11*Math.sin(Math.PI*u*1.7)+.19*sag;
      const turn=turnedFold(sweep-.374,.174,.181)+turnedFold(sweep-.77,.166,.106);
      const depth=1.17+.17*sag-.12*x*x+.044*Math.sin(Math.PI*v)
        +turn*(1-.78*pressure)-.09*pressure-.105*(1-smooth(v,0,.17));
      const returnDepth=.23*smooth(v,.80,1)+.14*(1-smooth(u,0,.14))+.14*smooth(u,.88,1);
      return new THREE.Vector3(x,y,depth-returnDepth);
    },'lap',5,-1);
  }else{
    surface(76,54,(u,v)=>{
      const lateral=2*u-1,sag=1-lateral*lateral,span=.55+.22*v;
      const curve=.17*lateral*lateral+.044*leading*lateral;
      const y=.48+.83*v+curve;
      const track=v-.22*lateral*lateral+.047*leading*lateral;
      const lip=turnedFold(track-.22,.16,.161)+turnedFold(track-.59,.155,.118);
      const turn=.15*(1-smooth(v,0,.145))+.13*smooth(v,.8,1);
      return new THREE.Vector3(span*lateral,y,1.18+.10*sag+.062*Math.sin(Math.PI*v)+lip-turn);
    },'lap',5,1);
  }
  const breast=(x:number,y:number)=>{
    const v=(y-1.03)/2.26;
    let lo=0,hi=.22;
    for(let i=0;i<12;i++){
      const m=(lo+hi)*.5;
      if(centralSurface(0,m,v)[0]<Math.abs(x))lo=m;else hi=m;
    }
    return centralSurface(0,(lo+hi)*.5,v)[2];
  };
  for(let turn=0;turn<4;turn++){
    const a=turn*Math.PI/2;
    const points:CurvePoint[]=[[0,0],[0,.097],[.092,.097]].map(([dx,dy])=>{
      const x=dx*Math.cos(a)-dy*Math.sin(a),y=2.73+dx*Math.sin(a)+dy*Math.cos(a);
      return [x,y,breast(x,y)+.012];
    });
    for(let i=1;i<points.length;i++){
      const p=new THREE.Vector3(...points[i-1]),q=new THREE.Vector3(...points[i]);
      const g=new THREE.BoxGeometry(.024,p.distanceTo(q)+.010,.020);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),q.clone().sub(p).normalize()));
      const c=p.lerp(q,.5);add(g.translate(c.x,c.y,c.z));
    }
  }
  // The exposed neck, robe collar and the gently sloping shoulders.
  if(lotusBearer){
    // A flared root flows into the robe; the narrowest section is below the jaw.
    surface(76,32,(u,v)=>{
      const a=2*Math.PI*u,r=.315+.255*(1-smooth(v,0,.58))+.042*smooth(v,.64,1);
      const depth=.25+.07*smooth(v,0,.34)-.054*smooth(v,.34,.64);
      return new THREE.Vector3(r*Math.sin(a),2.94+.54*v,-.18+depth*Math.cos(a));
    });
  }else ellipsoid(0,3.23,-.16,.29,.35,.28);
  for(const side of [-1,1]){
    const lowered=side===restingSide;
    if(lotusBearer)continue;
    ellipsoid(side*(lowered?1.06:.49),lowered?1.35:1.47,.64,.155,.12,.14);
  }
  // Rounded Chinese face. Its nasal bridge, cheeks, orbital hollows and
  // nasolabial transition deform the continuous head surface.
  const headStart={gold:pools.gold.length,crease:pools.crease.length,hair:pools.hair.length};
  const faceAt=(u:number,v:number)=>{
    const y=3.29+v*1.13,a=2*Math.PI*u,latitude=Math.PI*v;
    const fullness=Math.sin(latitude)**.44*(.94+.06*smooth(v,.32,.65));
    const x=.485*Math.sin(a)*fullness;
    const front=Math.max(0,Math.cos(a));
    let z=-.17+.365*Math.cos(a)*Math.sin(latitude)**.45;
    const yy=(y-3.29)/1.13;
    const nose=.155*gaussian(x,yy,0,.52,.078,.20)+.079*gaussian(x,yy,0,.41,.087,.052);
    const cheeks=.054*(gaussian(x,yy,-.23,.39,.12,.16)+gaussian(x,yy,.23,.39,.12,.16));
    const eyes=-.041*(gaussian(x,yy,-.17,.59,.12,.055)+gaussian(x,yy,.17,.59,.12,.055));
    const lips=.039*gaussian(x,yy,0,.255,.122,.026)
      +.032*(gaussian(x,yy,-.052,.291,.060,.021)+gaussian(x,yy,.052,.291,.060,.021))
      -.018*gaussian(x,yy,0,.218,.110,.022);
    const chin=.040*gaussian(x,yy,0,.14,.22,.095);
    const orbitalRim=.042*(gaussian(x,yy,-.17,.65,.145,.050)+gaussian(x,yy,.17,.65,.145,.050));
    const eyelids=.047*(gaussian(x,yy,-.16,.57,.11,.037)+gaussian(x,yy,.16,.57,.11,.037));
    const wing=.048*gaussian(Math.abs(x),yy,.082,.407,.043,.042);
    const philtrum=-.021*gaussian(x,yy,0,.335,.023,.038);
    const lipCorner=-.023*gaussian(Math.abs(x),yy,.127,.277,.037,.034);
    const jaw=.069*gaussian(x,yy,0,.146,.17,.07);
    const cheekPlane=.046*gaussian(Math.abs(x),yy,.234,.45,.105,.088)
      -.029*gaussian(Math.abs(x),yy,.164,.315,.052,.067);
    z+=(nose+cheeks+eyes+lips+chin+orbitalRim+eyelids+wing+philtrum+lipCorner+jaw+cheekPlane)*front**5;
    return new THREE.Vector3(x,y,z);
  };
  if(lotusBearer){
    const face=surface(194,184,(u,v)=>{
      const {x,y,z}=lotusFacePoint(u,v);
      return new THREE.Vector3(x,y,z);
    });
    const uv=face.getAttribute('uv'),normal=face.getAttribute('normal'),finish=face.getAttribute('robeFinish');
    // Ordinary split cylindrical UVs produce a visible crease down a nose.
    // Evaluate normals on the periodic surface across that seam at every LOD.
    const h=.00025,du=new THREE.Vector3(),dv=new THREE.Vector3();
    for(let i=0;i<uv.count;i++){
      const u=uv.getX(i),v=uv.getY(i),l=lotusFacePoint(u-h,v),r=lotusFacePoint(u+h,v);
      const b=lotusFacePoint(u,Math.max(0,v-h)),t=lotusFacePoint(u,Math.min(1,v+h));
      du.set(r.x-l.x,r.y-l.y,r.z-l.z);dv.set(t.x-b.x,t.y-b.y,t.z-b.z);
      du.cross(dv).normalize();normal.setXYZ(i,du.x,du.y,du.z);
      finish.setX(i,2+lotusFacePoint(u,v).patina);
    }
    const urna=lotusFacePoint(0,(4.044-3.29)/1.13);
    ellipsoid(0,urna.y,urna.z+.002,.011,.012,.006);
    for(const side of [-1,1]){
      // A pendant lobe widens below a scooped concha. The pinna's rim
      // fades into the cheek on its inner edge.
      surface(50,42,(u,v)=>{
        const angle=2*Math.PI*(side>0?u:1-u),arc=Math.sin(Math.PI*v)**.44;
        const width=.063+.025*Math.exp(-((v-.77)**2)/.038)+.013*Math.exp(-((v-.14)**2)/.022);
        const s=Math.sin(angle),c=Math.cos(angle),rim=Math.exp(-((s-.67)**2)/.041);
        const cup=Math.exp(-((v-.68)**2)/.046);
        return new THREE.Vector3(side*(.469+.025*v+width*arc*s),
          3.475+.644*v,-.13+arc*(.092*c+Math.max(c,0)*cup*(.038*rim-.065)));
      });
    }
  }else{
    surface(144,112,faceAt);
    const faceZ=(x:number,y:number)=>{
      const v=THREE.MathUtils.clamp((y-3.29)/1.13,.01,.99);
      const width=.485*Math.sin(Math.PI*v)**.44*(.94+.06*smooth(v,.32,.65));
      return faceAt(Math.asin(THREE.MathUtils.clamp(x/width,-.99,.99))/(2*Math.PI),v).z;
    };
    // Downcast eyelids sit in their orbital hollows. Incisions are bronze,
    // while the upper lid catches reflected gold.
    for(const side of [-1,1]){
      const lid:CurvePoint[]=[];
      for(let i=0;i<=10;i++){
        const t=i/10,x=side*(.057+t*.292),y=3.924-.025*Math.sin(t*Math.PI)+.038*t;
        lid.push([x,y,faceZ(x,y)+.004]);
      }
      strand(lid,.0095,'crease',5);
      // Taper both ends of the upper lid into the orbital surface.
      surface(22,8,(u,v)=>{
        u=side<0?1-u:u;
        const x=side*(.057+.292*u);
        const line=3.924-.025*Math.sin(Math.PI*u)+.038*u;
        const y=line+.091*Math.sin(Math.PI*u)*v;
        const relief=(.034)*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
        return new THREE.Vector3(x,y,faceZ(x,y)+relief+.001);
      });
      const brow:CurvePoint[]=[];
      for(let i=0;i<=12;i++){
        const t=i/12,x=side*(.047+t*.305);const y=4.008+.103*Math.sin(t*Math.PI*.92)-.009*t;brow.push([x,y,faceZ(x,y)+.006]);
      }
      strand(brow,.0115,'crease',6);
      ellipsoid(side*.064,3.745,faceZ(side*.064,3.745)+.003,.019,.010,.009,'crease');
      // Elongated ears with an inset concha and a folded helix.
      ellipsoid(side*.473,3.83,-.125,.086,.29,.085);
      ellipsoid(side*.492,3.87,-.041,.035,.16,.014);
      const ear:CurvePoint[]=[];
      for(let i=0;i<=20;i++){
        const t=i/20*Math.PI*2;
        ear.push([side*(.489+.048*Math.sin(t)),3.83+.244*Math.cos(t),-.035]);
      }
      strand(ear,.013);
      ellipsoid(side*.484,3.58,-.084,.058,.085,.058);
    }
    const mouth:CurvePoint[]=[];
    for(let i=0;i<=12;i++){
      const x=(i/12-.5)*.29,y=3.600+.015*(x/.12)**2+.004*Math.cos(x/.12*Math.PI*2);
      mouth.push([x,y,faceZ(x,y)+.003]);
    }
    strand(mouth,.0070,'crease');
    strand(mouth.map(([x,y])=>[x,y-.014,faceZ(x,y-.014)+.004]),.008);
    ellipsoid(0,4.015,faceZ(0,4.015)+.008,.019,.019,.010);
  }
  // Hundreds of small shell curls follow the scalp, with a low ushnisha.
  if(lotusBearer){
    // Seat the curls on a continuous cap following the new forehead.
    // The hairline rises over the brow and drops at the temples.
    const scalp=(u:number,v:number)=>{
      const a=2*Math.PI*u,hairline=4.07+.09*Math.cos(a);
      const phi=v*Math.PI/2,r=Math.cos(phi),c=Math.cos(a);
      return new THREE.Vector3(.476*r*Math.sin(a),hairline+(4.505-hairline)*Math.sin(phi),
        -.17+r*(c<0?.398*c:.388*c**.77));
    };
    surface(90,34,scalp,'hair');
    ellipsoid(0,4.474,-.17,.148,.086,.139,'hair');
    const rows=Math.max(3,Math.round(14*quality));
    for(let j=0;j<rows;j++){
      const v=(j+.5)/rows,r=Math.cos(v*Math.PI*.5),n=Math.max(5,Math.round(66*r*quality));
      for(let i=0;i<n;i++){
        const p=scalp((i+.5*(j%2))/n,v);
        ellipsoid(p.x,p.y,p.z,.033,.031,.034,'hair');
      }
    }
  }else{
    ellipsoid(0,4.23,-.18,.479,.26,.38,'hair');
    ellipsoid(0,4.44,-.18,.19,.14,.19,'hair');
    const curlRows=Math.max(3,Math.round(10*quality));
    for(let row=0;row<curlRows;row++){
      const phi=(row+.5)/curlRows*Math.PI*.57,r=Math.sin(phi),n=Math.max(6,Math.round(42*r*quality));
      for(let i=0;i<n;i++){
        const a=(i+(row%2)*.5)*Math.PI*2/n;
        ellipsoid(.480*r*Math.sin(a),4.19+.300*Math.cos(phi),-.18+.374*r*Math.cos(a),
          .038,.037,.038,'hair');
      }
    }
  }
  {
    for(const role of Object.keys(headStart) as (keyof typeof headStart)[]){
      for(const piece of pools[role].slice(headStart[role])){
        piece.translate(0,-3.28,.16);
        if(lotusBearer)piece.scale(1.09,1.045,1.07);
        piece.rotateX(lotusBearer?.072:.11).translate(0,lotusBearer?3.235:3.28,-.16);
      }
    }
  }
  // Hands are built from palms, separately bent fingers and opposing thumbs.
  function hand(side:number){
    const down=side===restingSide,level=down?1.34:side<0?1.46:1.54;
    const start=pools.gold.length;
    const palm=new THREE.SphereGeometry(1,seg,seg/2).scale(.24,.083,.17);
    add(palm.translate(side*.23,level,.71));
    for(let f=0;f<4;f++){
      const reach=[.19,.24,.22,.16][f];
      surface(12,16,(u,v)=>{
        const a=-side*u*2*Math.PI,r=(.041-.012*v)*(1-smooth(v,.81,1))+.002;
        return new THREE.Vector3(side*(.15-(.13+reach)*v),
          level+.015-.033*v*v+r*.79*Math.cos(a),.835-.077*f+.038*Math.sin(Math.PI*v)+r*Math.sin(a));
      });
    }
    strand([[side*.35,level,.63],[side*.26,level+.08,.69],[side*.14,level+.10,.75],[side*.032,level+.096,.76]],.04);
    if(down){
      for(const g of pools.gold.slice(start)){
        g.translate(-side*.23,-level,-.71).rotateZ(side*.26).rotateY(side*1.34).rotateX(.52)
          .translate(side*1.08,1.34,.78);
      }
    }
  }
  if(!lotusBearer){hand(-1);hand(1);}
  if(lotusBearer){
    // Continuous tapered digits bend from the metacarpals over the knee
    // and underneath the calyx. All sections stay in their original UV chart.
    const finger=(points:CurvePoint[],radius:number)=>{
      const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
      surface(12,22,(u,v)=>{
        const p=path.getPoint(v),t=path.getTangent(v);
        const n=new THREE.Vector3(0,1,0).cross(t).normalize(),b=t.clone().cross(n);
        const a=2*Math.PI*u,r=radius*(1-.24*v)*(1-smooth(v,.83,1));
        return p.addScaledVector(n,r*Math.cos(a)).addScaledVector(b,.84*r*Math.sin(a));
      },'gold',5,points[0][0]>0?-2:0);
    };
    // The heel of each palm overlaps the open cuff and the first knuckles.
    const palm=(p:CurvePoint,scale:CurvePoint,pitch:number,yaw:number)=>{
      const g=new THREE.SphereGeometry(1,seg,seg/2).scale(...scale).rotateX(pitch).rotateY(yaw).translate(...p);
      g.userData.finish=p[0]>0?-2:0;add(g);
    };
    palm([-1.075,1.263,.835],[.175,.117,.237],.29,-.10);
    for(let i=0;i<4;i++){
      const x=-1.20+.075*i,tip=[1.09,1.145,1.154,1.116][i];
      finger([[x,1.285,.88],[x-.012,1.277,1.055],[x-.024,1.176,tip+.055],[x-.006,1.033+.018*Math.abs(i-1),tip]],.048-.002*i);
    }
    finger([[-.988,1.286,.786],[-.916,1.268,.854],[-.891,1.19,.93],[-.91,1.153,.948]],.061);
    palm([.491,1.528,.661],[.159,.084,.130],-.10,-.17);
    palm([.349,1.523,.712],[.242,.098,.177],-.12,-.18);
    for(let i=0;i<4;i++){
      const z=.847-.076*i,tip=[-.124,-.156,-.127,-.065][i];
      finger([[.305,1.536,z],[.166,1.512,z+.035],[.014,1.534,z+.024],[tip,1.572,z-.003]],.049-.002*i);
    }
    finger([[.405,1.543,.647],[.335,1.61,.637],[.244,1.65,.677],[.197,1.646,.73]],.055);
    const bloomX=.054,bloomY=1.54,bloomZ=.746;
    const bowl=new THREE.LatheGeometry([[0,0],[.074,.002],[.113,.044],[.168,.099],[.204,.157],[.181,.154],[.107,.067],[0,.048]]
      .map(([r,y])=>new THREE.Vector2(r,y)),seg);
    add(bowl.translate(bloomX,bloomY,bloomZ));
    for(let tier=0;tier<2;tier++)for(let i=0;i<8;i++){
      const a=(i+tier*.5)*Math.PI/4;
      surface(10,14,(u,v)=>{
        const l=2*u-1,w=l*(.012+.092*Math.sin(Math.PI*v)**.75);
        const r=.092+.105*v+.033*Math.sin(Math.PI*v)+.026*l*l-.03*tier;
        return new THREE.Vector3(bloomX+r*Math.sin(a)+w*Math.cos(a),
          bloomY+.04+.195*v+.035*tier-.025*l*l,bloomZ+r*Math.cos(a)-w*Math.sin(a));
      });
    }
  }else if(variant===2){
    ellipsoid(-.16,1.69,.73,.16,.157,.15);
  }
  const result=new THREE.Group();
  for(const role of Object.keys(pools) as Palette[]){
    if(!pools[role].length)continue;
    const material=new THREE.MeshStandardMaterial({name:'hall-authored-buddha-'+role,
      color:role==='lap'?0xd1a462:role==='gold'?0xc18b49:role==='hair'?(lotusBearer?0x977344:0x48301c):0x593523,
      metalness:role==='lap'?.57:role==='gold'?.77:.55,roughness:role==='lap'?.51:role==='gold'?.70:lotusBearer?.40:.56});
    if(role==='gold'||role==='lap'){
      material.roughnessMap=grain;material.bumpMap=grain;material.bumpScale=.00065;
      material.normalMap=robe;material.normalScale.set(.82,.82);
    }
    const clothShader=lotusBearer&&role==='gold';
    material.onBeforeCompile=shader=>{
      shader.uniforms.uChasedDetail={value:detail};
      shader.vertexShader='attribute float sculptVisibility; varying float vVisibility; varying vec3 vSculpt;\n'+shader.vertexShader
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvVisibility=sculptVisibility; vSculpt=position;');
      shader.fragmentShader='uniform sampler2D uChasedDetail; varying float vVisibility; varying vec3 vSculpt;\n'+shader.fragmentShader
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          #ifdef USE_ROUGHNESSMAP
            vec2 detailUV=vec2(vSculpt.x/4.1+.5,vSculpt.y/4.7);
            #ifdef CENTRAL_CARVING
              if(vSculpt.y>3.36){
                vec2 yz=vSculpt.yz-vec2(3.28,-.16);
                detailUV.y=(3.28+cos(.11)*yz.x+sin(.11)*yz.y)/4.7;
              }
            #endif
            float chased=(texture2D(uChasedDetail,detailUV).r-.502)*2.55;
            float face=smoothstep(3.29,3.47,vSculpt.y)*(1.-smoothstep(4.11,4.24,vSculpt.y));
            float mantle=smoothstep(1.48,1.68,vSculpt.y)*(1.-smoothstep(3.07,3.22,vSculpt.y));
            float front=smoothstep(-.04,.16,vSculpt.z);
            float widthFade=1.-smoothstep(.33,.47,abs(vSculpt.x));
            diffuseColor.rgb*=exp(chased*front*(.95*face*widthFade+.65*mantle));
            float oxide=texture2D(roughnessMap,vRoughnessMapUv).b;
            float lap=1.-smoothstep(1.2,1.6,vSculpt.y);
            float carvedHem=smoothstep(.36,.52,vSculpt.y)*(1.-smoothstep(1.21,1.42,vSculpt.y));
            diffuseColor.rgb*=exp(.19*chased*front*carvedHem);
            float chinShade=1.-vVisibility;
            diffuseColor.rgb *= mix(vec3(1.),vec3(.56,.36,.27),clamp(oxide+.70*chinShade+.13*lap,0.,1.));
            roughnessFactor=clamp(roughnessFactor+.12*chinShade-.045*smoothstep(3.3,3.7,vSculpt.y),.27,.64);
            #ifdef CENTRAL_CARVING
              float cheek=smoothstep(3.42,3.72,vSculpt.y)*(1.-smoothstep(4.12,4.28,vSculpt.y));
              float breast=exp(-pow(abs(vSculpt.x)/.49,2.)-pow(abs(vSculpt.y-2.73)/.51,2.));
              float hand=exp(-pow(abs(vSculpt.x)/.54,2.)-pow(abs(vSculpt.y-1.48)/.14,2.))*front;
              roughnessFactor=clamp(roughnessFactor+.165*breast+.065*(1.-cheek)-.080*cheek-.047*hand,.24,.69);
              diffuseColor.rgb*=mix(vec3(.98,.94,.91),vec3(1.20,1.16,1.09),cheek);
              roughnessFactor-=.055*hand;
              diffuseColor.rgb*=1.+.09*cheek*front;
            #endif
            #ifdef LOTUS_BEARER
              // Smoother gold leaf across the face, with darker rubbed recesses in the lap.
              float skin=face*widthFade*front;
              diffuseColor.rgb*=exp(-chased*front*(.72*face*widthFade+.43*mantle));
              diffuseColor.rgb*=mix(vec3(1.07,1.11,1.02),vec3(1.20,1.22,1.04),skin);
              roughnessFactor=mix(roughnessFactor,.43,.66*skin);
              roughnessFactor=mix(roughnessFactor,.51,.55*breast);
            #endif
          #endif`)
        .replace('#include <aomap_fragment>',`#include <aomap_fragment>
          reflectedLight.indirectDiffuse*=.29+.55*vVisibility;
          reflectedLight.indirectSpecular*=.19+.76*vVisibility;
          // The indoor probe includes vermilion columns. Soften the red
          // contribution on worn gilding, especially below the cheek and knees.
          float warmRebound=max(0.,reflectedLight.indirectSpecular.r-2.20*reflectedLight.indirectSpecular.g);
          reflectedLight.indirectSpecular+=warmRebound*vec3(-.38,.22,.055);
          reflectedLight.directDiffuse*=.63+.37*vVisibility;
          reflectedLight.directSpecular*=.33+.67*vVisibility;`);
      if(role==='lap'){
        shader.vertexShader='varying float vFoldCrown;\n'+shader.vertexShader
          .replace('#include <begin_vertex>','#include <begin_vertex>\nvFoldCrown=smoothstep(.10,.63,normal.y)*(1.-smoothstep(.81,1.,normal.y))*smoothstep(.0,.47,normal.z);');
        shader.fragmentShader='varying float vFoldCrown;\n'+shader.fragmentShader
          .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
            float crown=clamp(vFoldCrown,0.,1.);
            // Gold leaf stays cleaner on the rolled lip; oxidation collects in the return.
            float leaf=texture2D(roughnessMap,vRoughnessMapUv*.68).g;
            float worn=crown*crown*(.43+.48*smoothstep(.18,.79,leaf));
            diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*vec3(1.19,1.12,1.01),.06+.58*worn);
            diffuseColor.rgb*=.98+.12*worn+.18*(leaf-.5);
            roughnessFactor=mix(.54,.39,worn)+.10*(leaf-.5)+.05*(1.-vVisibility);
            metalnessFactor=mix(.70,.50,worn);`);
      }
      if(role==='lap'){
        shader.vertexShader='attribute vec2 apronUv; varying vec2 vApronUv;\n'+shader.vertexShader
          .replace('#include <begin_vertex>','#include <begin_vertex>\nvApronUv=apronUv;');
        shader.fragmentShader='varying vec2 vApronUv;\n'+shader.fragmentShader
          .replace('#include <normal_fragment_begin>', `
            #ifdef FLANKING_LAP
              if(vApronUv.x>=0. || vSculpt.z>.12){
            #else
              if(vApronUv.x>=0.){
            #endif
              // Lay the leaf along the two curved hems. Sample the existing finish at
              // two physical scales so broad losses survive minification at the door.
              float lateral=2.*vApronUv.x-1.;
              vec2 cloth=vec2(vApronUv.x,vApronUv.y-.22*lateral*lateral+.047*lateral);
              vec2 patchScale=vec2(1.35,1.11),flakeScale=vec2(6.1,7.3),offset=vec2(.29,.17);
              float wearBias=0.,polish=1.;
              #ifdef FLANKING_LAP
                bool panel=vApronUv.x>=0.;
                #ifdef LOTUS_BEARER
                  // Short breaks in the folded breadth pinched beneath the resting palm.
                  cloth.y=vApronUv.y+.11*sin(5.34*vApronUv.x)+.19*sin(3.14159*vApronUv.x);
                  patchScale=vec2(1.62,1.14);flakeScale=vec2(8.1,6.6);offset=vec2(.67,.34);
                  float pinched=exp(-dot((vSculpt.xy-vec2(-.96,1.06))*vec2(2.25,3.4),
                                         (vSculpt.xy-vec2(-.96,1.06))*vec2(2.25,3.4)));
                  wearBias=.014+.047*pinched;
                  polish=.84+.15*(1.-pinched);
                #else
                  // Longer intact arcs towards the outside of the raised knee.
                  patchScale=vec2(.98,1.65);flakeScale=vec2(5.4,9.6);offset=vec2(.13,.81);
                  wearBias=.018-.058*smoothstep(.22,1.63,vSculpt.x);
                  polish=.90+.31*smoothstep(-.25,1.45,vSculpt.x);
                #endif
                if(!panel){
                  float sweep=vSculpt.y-.20*pow(abs(vSculpt.x)/1.96,1.65);
                  cloth=vec2(.53*vSculpt.x+.18*vSculpt.z,sweep+.11*vSculpt.z);
                }
              #endif
              vec3 islands=texture2D(roughnessMap,cloth*patchScale+offset).rgb;
              vec3 flakes=texture2D(roughnessMap,cloth*flakeScale+vec2(.17,.68)).rgb;
              float coverage=.60*islands.b+.40*flakes.b+.37*(flakes.r-.50);
              float missing=smoothstep(.217,.335,coverage+wearBias);
              float crest=clamp(vFoldCrown,0.,1.);
              float intact=(1.-missing)*crest*polish;
              float abrasion=missing*(.32+.68*crest);
              diffuseColor.rgb*=mix(vec3(1.),vec3(.62,.58,.51),abrasion);
              diffuseColor.rgb*=1.+intact*(.11+.31*flakes.r);
              roughnessFactor=clamp(roughnessFactor+.14*abrasion-.064*intact,.28,.79);
              metalnessFactor=mix(metalnessFactor,.49,abrasion);
            }
            #include <normal_fragment_begin>`);
      }
      if(clothShader){
        shader.vertexShader='attribute float robeFinish; varying float vRobeFinish;\n'+shader.vertexShader
          .replace('#include <begin_vertex>','#include <begin_vertex>\nvRobeFinish=robeFinish;');
        shader.fragmentShader='varying float vRobeFinish;\n'+shader.fragmentShader
          .replace('#include <aomap_fragment>', `#include <aomap_fragment>
            // Cut and darkened lines in gilding return much less of the hall
            // reflection than the rounded lid, even along a grazing view.
            float cutPatina=smoothstep(.065,.85,clamp(vRobeFinish-2.,0.,1.));
            reflectedLight.directSpecular*=1.-.94*cutPatina;
            reflectedLight.indirectSpecular*=1.-.95*cutPatina;
            reflectedLight.directDiffuse*=1.-.48*cutPatina;
          `)
          .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
            float faceSurface=step(1.5,vRobeFinish);
            float sleeveFinish=clamp(vRobeFinish,0.,1.)*(1.-faceSurface);
            float engraving=clamp(vRobeFinish-2.,0.,1.);
            diffuseColor.rgb*=mix(vec3(1.),vec3(.092,.058,.034),engraving);
            diffuseColor.rgb*=mix(vec3(1.),vec3(1.25,1.29,1.10),faceSurface*(1.-engraving));
            roughnessFactor=mix(roughnessFactor,.45+.15*engraving,.82*faceSurface);
            metalnessFactor=mix(metalnessFactor,.67-.22*engraving,faceSurface);
            float hemFinish=1.-min(1.,abs(vRobeFinish+1.));
            float handFinish=max(0.,-vRobeFinish-1.);
            diffuseColor.rgb*=mix(vec3(1.),vec3(.76,.71,.64),sleeveFinish);
            diffuseColor.rgb*=exp(-.15*chased*front*carvedHem*hemFinish);
            diffuseColor.rgb*=mix(vec3(1.),vec3(1.16,1.12,1.02),hemFinish);
            roughnessFactor=mix(roughnessFactor,.57,.64*sleeveFinish+.48*hemFinish);
            diffuseColor.rgb*=mix(vec3(1.),vec3(1.48,1.40,1.16),handFinish);
            roughnessFactor=mix(roughnessFactor,.36,handFinish);
            metalnessFactor=mix(metalnessFactor,.60,handFinish);
          `);
      }
    };
    material.defines={...(material.defines??{}),CENTRAL_CARVING:1,...(role==='lap'&&variant!==0?{FLANKING_LAP:1}:{}),...(lotusBearer?{LOTUS_BEARER:1}:{})};
    material.customProgramCacheKey=()=>role==='lap'?(variant===0?'hall-central-apron-leaf-1':'hall-flanking-apron-leaf-1'):clothShader?'hall-lotus-face-1':'hall-gilding-visibility-1';
    const mesh=new THREE.Mesh(projectedTempleUV(merge(pools[role]),.72),material);
    mesh.castShadow=true;mesh.receiveShadow=true;result.add(mesh);
  }
  return result;
}

export function sculptedTempleBuddha(variant:number,grain:THREE.Texture,detail:THREE.Texture,robe:THREE.Texture) {
  const lod=new THREE.LOD();
  lod.addLevel(sculptFigure(variant,.76,grain,detail,robe),0);
  lod.addLevel(sculptFigure(variant,.38,grain,detail,robe),20,.12);
  lod.addLevel(sculptFigure(variant,.12,grain,detail,robe),40,.12);
  bakeSculptureVisibility(lod);
  configureProjectedLOD(lod);
  return lod;
}
